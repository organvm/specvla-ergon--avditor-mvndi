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
  return new Request("http://localhost:3000/api/subscription", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ip ? { "x-forwarded-for": ip } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(0);
  });

  it("returns mock URL with placeholder key for a valid tier", async () => {
    const res = await POST(makeRequest({ email: "user@test.com", tier: "pro" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.url).toBe("https://checkout.stripe.com/pay/cs_test_mock123");
  });

  it("accepts the agency tier", async () => {
    const res = await POST(makeRequest({ email: "user@test.com", tier: "agency" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.url).toBe("https://checkout.stripe.com/pay/cs_test_mock123");
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(makeRequest({ tier: "pro" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Email and a valid tier are required");
  });

  it("returns 400 when tier is missing", async () => {
    const res = await POST(makeRequest({ email: "user@test.com" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Email and a valid tier are required");
  });

  it("returns 400 for an unknown/non-paid tier", async () => {
    const res = await POST(makeRequest({ email: "user@test.com", tier: "basic" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Email and a valid tier are required");
  });

  it("returns 429 on rate limit", async () => {
    mockGet.mockReturnValue(10);

    const res = await POST(makeRequest({ email: "user@test.com", tier: "pro" }, "1.2.3.4"));
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toContain("Rate limit exceeded");
  });
});
