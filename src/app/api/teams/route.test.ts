import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { GET, POST } from "./route";
import * as db from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  createTeam: vi.fn(),
  getTeamsByEmail: vi.fn(),
}));

describe("Teams API", () => {
  const mockEmail = "test@example.com";

  beforeEach(() => {
    vi.resetAllMocks();
    (auth as unknown as Mock).mockResolvedValue({ user: { email: mockEmail, plan: "pro", isPro: true } });
  });

  describe("GET", () => {
    it("returns teams for the user", async () => {
      const mockTeams = [{ id: "1", name: "Team A", ownerEmail: mockEmail }];
      vi.mocked(db.getTeamsByEmail).mockResolvedValue(mockTeams);

      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockTeams);
    });
  });

  describe("POST", () => {
    it("creates a new team", async () => {
      const payload = { name: "New Team" };
      vi.mocked(db.createTeam).mockResolvedValue({ id: "2", ...payload, ownerEmail: mockEmail });

      const req = new Request("http://localhost/api/teams", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe("New Team");
      expect(db.createTeam).toHaveBeenCalledWith("New Team", mockEmail);
    });

    it("returns 403 for free users", async () => {
      (auth as unknown as Mock).mockResolvedValue({ user: { email: mockEmail, plan: "free", isPro: false } });

      const req = new Request("http://localhost/api/teams", {
        method: "POST",
        body: JSON.stringify({ name: "Free Team" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      expect(db.createTeam).not.toHaveBeenCalled();
    });
  });
});
