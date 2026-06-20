import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGet, mockSet, mockCreateSession } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockCreateSession: vi.fn().mockResolvedValue({ url: "https://stripe.com/session" }),
}));

vi.mock("stripe", () => {
  const MockStripe = function () {
    return {
      checkout: {
        sessions: {
          create: mockCreateSession,
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

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { POST } from "./route";
import { auth } from "@/auth";

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
    vi.mocked(auth).mockResolvedValue({
      user: { email: "user@test.com", isAdmin: false },
      expires: "",
    });
  });

  it("returns mock URL with placeholder key for a tier", async () => {
    const res = await POST(makeRequest({ tier: "premium" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.url).toBe("https://checkout.stripe.com/pay/cs_test_mock123");
  });

  it("accepts a legacy priceId for backward compatibility", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: "admin@test.com", isAdmin: true },
      expires: "",
    });

    const res = await POST(makeRequest({ priceId: "price_123" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.url).toBe("https://checkout.stripe.com/pay/cs_test_mock123");
  });

  it("returns 401 when the user is not signed in", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null);

    const res = await POST(makeRequest({ tier: "pro" }));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Authentication required");
  });

  it("returns 400 when neither tier nor priceId is given", async () => {
    const res = await POST(makeRequest({}));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("A tier or priceId is required");
  });

  it("returns 400 for a non-purchasable tier", async () => {
    const res = await POST(makeRequest({ tier: "free" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid subscription tier");
  });

  it("returns 429 on rate limit", async () => {
    mockGet.mockReturnValue(10);

    const res = await POST(makeRequest({ tier: "pro" }, "1.2.3.4"));
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toContain("Rate limit exceeded");
  });

  it("rejects raw price IDs for non-admin callers", async () => {
    const res = await POST(makeRequest({ priceId: "price_123" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("A tier is required");
  });
});
