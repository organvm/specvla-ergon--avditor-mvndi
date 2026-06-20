import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { GET, POST } from "./route";
import * as db from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getSubscription: vi.fn(),
  updateBranding: vi.fn(),
}));

describe("Branding API", () => {
  const mockEmail = "test@example.com";

  beforeEach(() => {
    vi.resetAllMocks();
    (auth as unknown as Mock).mockResolvedValue({ user: { email: mockEmail, isPro: true } });
  });

  describe("GET", () => {
    it("returns branding info for the user", async () => {
      const mockSub = { plan: "pro", status: "active", customLogoUrl: "https://logo.com" };
      vi.mocked(db.getSubscription).mockResolvedValue(mockSub);

      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockSub);
    });

    it("does not expose saved branding for inactive subscriptions", async () => {
      vi.mocked(db.getSubscription).mockResolvedValue({
        plan: "pro",
        status: "canceled",
        customLogoUrl: "https://logo.com",
      });

      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ plan: "pro", status: "canceled" });
    });
  });

  describe("POST", () => {
    it("updates branding if user is Pro", async () => {
      const payload = { logoUrl: "https://newlogo.com" };
      const req = new Request("http://localhost/api/settings/branding", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(db.updateBranding).toHaveBeenCalledWith(mockEmail, payload.logoUrl);
    });

    it("returns 403 if user is not Pro", async () => {
      (auth as unknown as Mock).mockResolvedValue({ user: { email: mockEmail, isPro: false } });
      const req = new Request("http://localhost/api/settings/branding", {
        method: "POST",
        body: JSON.stringify({ logoUrl: "test" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
    });
  });
});
