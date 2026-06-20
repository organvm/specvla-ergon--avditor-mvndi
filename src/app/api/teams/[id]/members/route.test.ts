import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { GET, POST } from "./route";
import * as db from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  addTeamMember: vi.fn(),
  getTeamMembers: vi.fn(),
}));

describe("Team Members API", () => {
  const mockEmail = "owner@example.com";
  const teamId = "team-123";

  beforeEach(() => {
    vi.resetAllMocks();
    (auth as unknown as Mock).mockResolvedValue({ user: { email: mockEmail, plan: "pro", isPro: true } });
  });

  describe("GET", () => {
    it("returns members if user is a member", async () => {
      const mockMembers = [{ id: "m1", teamId: "team-123", email: mockEmail, role: "owner" as const }];
      vi.mocked(db.getTeamMembers).mockResolvedValue(mockMembers);

      const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: teamId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockMembers);
    });

    it("returns 403 if user is not a member", async () => {
      vi.mocked(db.getTeamMembers).mockResolvedValue([{ id: "m2", teamId: "team-123", email: "other@test.com", role: "owner" as const }]);

      const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: teamId }) });
      expect(res.status).toBe(403);
    });
  });

  describe("POST", () => {
    it("adds a member if user is owner/admin", async () => {
      vi.mocked(db.getTeamMembers).mockResolvedValue([{ id: "m1", teamId: "team-123", email: mockEmail, role: "owner" as const }]);

      const req = new Request(`http://localhost/api/teams/${teamId}/members`, {
        method: "POST",
        body: JSON.stringify({ email: "new@test.com", role: "member" }),
      });

      const res = await POST(req, { params: Promise.resolve({ id: teamId }) });
      expect(res.status).toBe(200);
      expect(db.addTeamMember).toHaveBeenCalledWith(teamId, "new@test.com", "member");
    });

    it("returns 403 if user is just a member", async () => {
      vi.mocked(db.getTeamMembers).mockResolvedValue([{ id: "m1", teamId: "team-123", email: mockEmail, role: "member" as const }]);

      const req = new Request(`http://localhost/api/teams/${teamId}/members`, {
        method: "POST",
        body: JSON.stringify({ email: "new@test.com" }),
      });

      const res = await POST(req, { params: Promise.resolve({ id: teamId }) });
      expect(res.status).toBe(403);
    });

    it("returns 403 when the current plan seat limit is reached", async () => {
      vi.mocked(db.getTeamMembers).mockResolvedValue([
        { id: "m1", teamId: "team-123", email: mockEmail, role: "owner" as const },
        { id: "m2", teamId: "team-123", email: "a@test.com", role: "member" as const },
        { id: "m3", teamId: "team-123", email: "b@test.com", role: "member" as const },
      ]);

      const req = new Request(`http://localhost/api/teams/${teamId}/members`, {
        method: "POST",
        body: JSON.stringify({ email: "new@test.com" }),
      });

      const res = await POST(req, { params: Promise.resolve({ id: teamId }) });
      expect(res.status).toBe(403);
      expect(db.addTeamMember).not.toHaveBeenCalled();
    });
  });
});
