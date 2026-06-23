import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { GET, POST, PUT, DELETE } from "./route";
import * as db from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getScheduledAudits: vi.fn(),
  getScheduledAuditById: vi.fn(),
  saveScheduledAudit: vi.fn(),
  updateScheduledAudit: vi.fn(),
  deleteScheduledAudit: vi.fn(),
  getTeamMembers: vi.fn(),
}));

describe("Schedules API Route", () => {
  const mockEmail = "test@example.com";

  beforeEach(() => {
    vi.resetAllMocks();
    (auth as unknown as Mock).mockResolvedValue({ user: { email: mockEmail, isPro: true } });
  });

  describe("GET", () => {
    it("returns unauthorized if no session", async () => {
      (auth as unknown as Mock).mockResolvedValue(null);
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("returns 403 for free users", async () => {
      (auth as unknown as Mock).mockResolvedValue({ user: { email: mockEmail, plan: "free", isPro: false } });

      const res = await GET();
      expect(res.status).toBe(403);
    });

    it("returns schedules for the user", async () => {
      const mockSchedules = [{ id: "1", userEmail: mockEmail, link: "https://test.com", businessType: "SaaS", goals: "Growth", frequency: "monthly" as const, enabled: true }];
      vi.mocked(db.getScheduledAudits).mockResolvedValue(mockSchedules);

      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockSchedules);
      expect(db.getScheduledAudits).toHaveBeenCalledWith(mockEmail);
    });
  });

  describe("POST", () => {
    it("creates a new schedule", async () => {
      const payload = {
        link: "https://test.com",
        businessType: "SaaS",
        goals: "Growth",
        frequency: "weekly",
      };
      vi.mocked(db.saveScheduledAudit).mockResolvedValue("new-id");

      const req = new Request("http://localhost/api/settings/schedules", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe("new-id");
      expect(db.saveScheduledAudit).toHaveBeenCalledWith({
        ...payload,
        userEmail: mockEmail,
        enabled: true,
      });
    });

    it("returns 400 if fields missing", async () => {
      const req = new Request("http://localhost/api/settings/schedules", {
        method: "POST",
        body: JSON.stringify({ link: "test" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe("PUT", () => {
    it("updates a schedule", async () => {
      const payload = { id: "1", enabled: false };
      vi.mocked(db.getScheduledAuditById).mockResolvedValue({ id: "1", userEmail: mockEmail, link: "https://test.com", businessType: "SaaS", goals: "Growth", frequency: "monthly" as const, enabled: true });

      const req = new Request("http://localhost/api/settings/schedules", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      const res = await PUT(req);
      expect(res.status).toBe(200);
      expect(db.updateScheduledAudit).toHaveBeenCalledWith("1", { enabled: false });
    });
  });

  describe("DELETE", () => {
    it("deletes a schedule", async () => {
      vi.mocked(db.getScheduledAuditById).mockResolvedValue({ id: "1", userEmail: mockEmail, link: "https://test.com", businessType: "SaaS", goals: "Growth", frequency: "monthly" as const, enabled: true });

      const req = new Request("http://localhost/api/settings/schedules?id=1", {
        method: "DELETE",
      });

      const res = await DELETE(req);
      expect(res.status).toBe(200);
      expect(db.deleteScheduledAudit).toHaveBeenCalledWith("1");
    });
  });
});
