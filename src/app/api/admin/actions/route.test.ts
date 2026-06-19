import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getAudits: vi.fn(),
  saveAudit: vi.fn(),
}));

vi.mock("@/services/aiOrchestrator", () => ({
  orchestrateCosmicAudit: vi.fn(),
}));

import { POST } from "./route";
import { auth } from "@/auth";
import { getAudits, saveAudit } from "@/lib/db";
import { orchestrateCosmicAudit } from "@/services/aiOrchestrator";

const mockAuth = vi.mocked(auth);
const mockGetAudits = vi.mocked(getAudits);
const mockSaveAudit = vi.mocked(saveAudit);
const mockOrchestrate = vi.mocked(orchestrateCosmicAudit);

function makeRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/admin/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function asAdmin() {
  mockAuth.mockResolvedValue({
    user: { email: "admin@growthauditor.ai", name: "Admin" },
    expires: "",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

const orchestratorResult = {
  markdownAudit: "# Audit",
  scores: { communication: 80, aesthetic: 75, drive: 70, structure: 85 },
  evaluationScore: 85,
  iterations: 1,
};

describe("POST /api/admin/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "fake-gemini-key"; // allow-secret
    process.env.ADMIN_EMAILS = "admin@growthauditor.ai";
  });

  it("returns 401 when not authenticated", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAuth.mockResolvedValue(null as any);

    const res = await POST(makeRequest({ action: "runMonthlyAudit" }));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 403 when the user is not an admin", async () => {
    mockAuth.mockResolvedValue({
      user: { email: "nobody@example.com", name: "Nobody" },
      expires: "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await POST(makeRequest({ action: "runMonthlyAudit" }));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("Admin access required");
  });

  it("returns 400 for an unknown action", async () => {
    asAdmin();

    const res = await POST(makeRequest({ action: "bogus" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid action");
  });

  describe("action=runMonthlyAudit", () => {
    it("returns 400 when required fields are missing", async () => {
      asAdmin();

      const res = await POST(
        makeRequest({ action: "runMonthlyAudit", userEmail: "u@example.com" })
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Missing required fields");
      expect(mockOrchestrate).not.toHaveBeenCalled();
    });

    it("generates and saves an audit for a single user", async () => {
      asAdmin();
      mockOrchestrate.mockResolvedValue(orchestratorResult);
      mockSaveAudit.mockResolvedValue(undefined);

      const res = await POST(
        makeRequest({
          action: "runMonthlyAudit",
          userEmail: "user@example.com",
          link: "https://example.com",
          businessType: "SaaS",
          goals: "grow",
        })
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.audit.markdownAudit).toBe("# Audit");
      expect(data.audit.id).toEqual(expect.any(String));

      expect(mockOrchestrate).toHaveBeenCalledWith(
        expect.objectContaining({
          link: "https://example.com",
          businessType: "SaaS",
          goals: "grow",
          provider: "gemini",
          isPro: true,
        })
      );
      expect(mockSaveAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userEmail: "user@example.com",
          link: "https://example.com",
          markdownAudit: "# Audit",
        })
      );
    });

    it("returns 500 when GEMINI_API_KEY is not configured", async () => {
      asAdmin();
      delete process.env.GEMINI_API_KEY;

      const res = await POST(
        makeRequest({
          action: "runMonthlyAudit",
          userEmail: "user@example.com",
          link: "https://example.com",
          businessType: "SaaS",
          goals: "grow",
        })
      );
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("GEMINI_API_KEY not configured");
    });
  });

  describe("action=runAllMonthlyAudits", () => {
    it("runs one audit per unique user email and reports results", async () => {
      asAdmin();
      mockGetAudits.mockResolvedValue([
        {
          id: "a1",
          userEmail: "alice@example.com",
          link: "https://alice.com",
          businessType: "SaaS",
          goals: "grow",
          markdownAudit: "x",
          scores: "{}",
          createdAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "a2",
          userEmail: "alice@example.com",
          link: "https://alice.com/2",
          businessType: "SaaS",
          goals: "convert",
          markdownAudit: "y",
          scores: "{}",
          createdAt: "2026-02-01T00:00:00Z",
        },
        {
          id: "a3",
          userEmail: "bob@example.com",
          link: "https://bob.com",
          businessType: "Agency",
          goals: "leads",
          markdownAudit: "z",
          scores: "{}",
          createdAt: "2026-03-01T00:00:00Z",
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any);
      mockOrchestrate.mockResolvedValue(orchestratorResult);
      mockSaveAudit.mockResolvedValue(undefined);

      const res = await POST(makeRequest({ action: "runAllMonthlyAudits" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      // alice (deduped) + bob = 2 unique users
      expect(data.processed).toBe(2);
      expect(data.results).toHaveLength(2);
      expect(mockOrchestrate).toHaveBeenCalledTimes(2);
      expect(data.results.every((r: { success: boolean }) => r.success)).toBe(true);
    });

    it("records per-user failures without aborting the whole run", async () => {
      asAdmin();
      mockGetAudits.mockResolvedValue([
        {
          id: "a1",
          userEmail: "alice@example.com",
          link: "https://alice.com",
          businessType: "SaaS",
          goals: "grow",
          markdownAudit: "x",
          scores: "{}",
          createdAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "a3",
          userEmail: "bob@example.com",
          link: "https://bob.com",
          businessType: "Agency",
          goals: "leads",
          markdownAudit: "z",
          scores: "{}",
          createdAt: "2026-03-01T00:00:00Z",
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any);
      mockOrchestrate
        .mockResolvedValueOnce(orchestratorResult)
        .mockRejectedValueOnce(new Error("orchestrator boom"));
      mockSaveAudit.mockResolvedValue(undefined);

      const res = await POST(makeRequest({ action: "runAllMonthlyAudits" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.processed).toBe(1);
      expect(data.results).toHaveLength(2);

      const failure = data.results.find((r: { success: boolean }) => !r.success);
      expect(failure).toBeDefined();
      expect(failure.error).toBe("orchestrator boom");
    });

    it("skips audits without a user email", async () => {
      asAdmin();
      mockGetAudits.mockResolvedValue([
        {
          id: "anon",
          userEmail: undefined,
          link: "https://anon.com",
          businessType: "SaaS",
          goals: "grow",
          markdownAudit: "x",
          scores: "{}",
          createdAt: "2026-01-01T00:00:00Z",
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any);

      const res = await POST(makeRequest({ action: "runAllMonthlyAudits" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.processed).toBe(0);
      expect(mockOrchestrate).not.toHaveBeenCalled();
    });
  });

  it("returns 500 when the request body is not valid JSON", async () => {
    asAdmin();

    const badReq = new Request("http://localhost:3000/api/admin/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const res = await POST(badReq);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toEqual(expect.any(String));
  });
});
