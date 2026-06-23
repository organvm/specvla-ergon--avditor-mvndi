import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend } = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockSend: vi.fn().mockResolvedValue({ id: "email-123" }) as any,
}));

vi.mock("stripe", () => {
  return {
    default: function Stripe() {
      return {
        webhooks: {
          constructEvent: vi.fn(),
        },
      };
    },
  };
});

vi.mock("resend", () => {
  return {
    Resend: function () {
      return { emails: { send: mockSend } };
    },
  };
});

vi.mock("@/lib/db", () => ({
  updateSubscription: vi.fn(),
}));

import { POST } from "./route";
import { updateSubscription } from "@/lib/db";

function makeWebhookRequest(event: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": "sig_test",
    },
    body: JSON.stringify(event),
  });
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when body is invalid JSON", async () => {
    const req = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "sig_test",
      },
      body: "not-valid-json",
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Webhook Error:");
  });

  it("handles checkout.session.completed for one-time payment and sends welcome email", async () => {
    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "payment",
          customer_details: { email: "buyer@test.com" },
          metadata: { pathNumber: "2" },
        },
      },
    };

    const res = await POST(makeWebhookRequest(event));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "buyer@test.com",
        subject: "Your Manifestation Path is Confirmed ✦",
      })
    );
  });

  it("handles checkout.session.completed for subscription and sends subscription email", async () => {
    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          customer_details: { email: "subscriber@test.com" },
          metadata: { pathNumber: "1", plan: "premium" },
        },
      },
    };

    const res = await POST(makeWebhookRequest(event));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.received).toBe(true);
    expect(updateSubscription).toHaveBeenCalledWith("subscriber@test.com", "premium", "active");
    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "subscriber@test.com",
        subject: "Your Monthly Alignment is Active ✦",
      })
    );
  });

  it("handles customer.subscription.deleted event", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const event = {
      type: "customer.subscription.deleted",
      data: {
        object: {
          metadata: { userEmail: "canceled@test.com" },
        },
      },
    };

    const res = await POST(makeWebhookRequest(event));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.received).toBe(true);
    expect(updateSubscription).toHaveBeenCalledWith("canceled@test.com", "free", "inactive");
    expect(consoleSpy).toHaveBeenCalledWith(
      "Subscription canceled for",
      "canceled@test.com"
    );

    consoleSpy.mockRestore();
  });

  it("handles customer.subscription.updated event", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          metadata: { userEmail: "updated@test.com" },
          status: "trialing",
          items: { data: [{ price: { id: "price_unknown" } }] },
        },
      },
    };

    const res = await POST(makeWebhookRequest(event));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.received).toBe(true);
    expect(updateSubscription).toHaveBeenCalledWith("updated@test.com", "pro", "trialing");
    expect(consoleSpy).toHaveBeenCalledWith(
      "Subscription updated for",
      "updated@test.com"
    );

    consoleSpy.mockRestore();
  });

  it("returns { received: true } for unhandled event types", async () => {
    const event = {
      type: "invoice.payment_succeeded",
      data: { object: {} },
    };

    const res = await POST(makeWebhookRequest(event));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
