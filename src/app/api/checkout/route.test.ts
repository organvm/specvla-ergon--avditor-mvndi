import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGet, mockSet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
}));

vi.mock("stripe", () => {
  const MockStripe = function () {
    return {
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({ url: "https://stripe.com/session" }),
        },
      },
    };
  };
  return { default: MockStripe };
});

vi.mock("lru-cache", () => {
  const MockLRUCache = function () {
    return { get: mockGet, set: mockSet };
  };
  return { LRUCache: MockLRUCache };
});

import { POST } from "./route";

function makeRequest(body: Record<string, unknown>, ip?: string): Request {
  return new Request("http://localhost:3000/api/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ip ? { "x-forwarded-for": ip } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(0);
  });

  it("returns mock checkout URL when using placeholder Stripe key", async () => {
    const res = await POST(makeRequest({ email: "user@test.com", pathNumber: 1, title: "Plan" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.url).toBe("https://checkout.stripe.com/pay/cs_test_mock123");
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(makeRequest({ pathNumber: 1, title: "Plan" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Email is required");
  });

  it("returns 400 for an invalid checkout path", async () => {
    const res = await POST(makeRequest({ email: "user@test.com", pathNumber: 99, title: "Plan" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid checkout path");
  });

  it("returns 429 when rate limited", async () => {
    mockGet.mockReturnValue(10);

    const res = await POST(makeRequest({ email: "user@test.com", pathNumber: 1, title: "Plan" }, "1.2.3.4"));
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toContain("Rate limit exceeded");
  });
});
