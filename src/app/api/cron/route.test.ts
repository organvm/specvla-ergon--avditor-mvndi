import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  getScheduledAudits: vi.fn(),
  updateScheduledAudit: vi.fn(),
  saveAudit: vi.fn(),
  getSubscription: vi.fn(),
  getTeamMembers: vi.fn(),
}));

vi.mock("@/services/aiOrchestrator", () => ({
  orchestrateCosmicAudit: vi.fn(),
}));

vi.mock("resend", () => {
  const mockSend = vi.fn().mockResolvedValue({ id: "email-id" });
  function MockResend() {
    return { emails: { send: mockSend } };
  }
  return { Resend: MockResend };
});

import { GET } from "./route";
import {
  getScheduledAudits,
  updateScheduledAudit,
  saveAudit,
  getSubscription,
  getTeamMembers,
} from "@/lib/db";
import { orchestrateCosmicAudit } from "@/services/aiOrchestrator";

const mockGetScheduledAudits = vi.mocked(getScheduledAudits);
const mockUpdateScheduledAudit = vi.mocked(updateScheduledAudit);
const mockSaveAudit = vi.mocked(saveAudit);
const mockGetSubscription = vi.mocked(getSubscription);
const mockGetTeamMembers = vi.mocked(getTeamMembers);
const mockOrchestrate = vi.mocked(orchestrateCosmicAudit);

function makeRequest(authHeader?: string): Request {
  return new Request("http://localhost:3000/api/cron", {
    method: "GET",
    headers: authHeader ? { Authorization: authHeader } : {},
  });
}

describe("GET /api/cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test_cron_secret";
    process.env.GEMINI_API_KEY = "fake-gemini-key"; // allow-secret
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await GET(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 401 when Authorization header has wrong secret", async () => {
    const res = await GET(makeRequest("Bearer wrong_secret"));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns success with 0 processed when there are no enabled schedules", async () => {
    mockGetScheduledAudits.mockResolvedValue([]);

    const res = await GET(makeRequest("Bearer test_cron_secret"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.processedSchedules).toBe(0);
    expect(mockOrchestrate).not.toHaveBeenCalled();
  });

  it("returns success with 0 processed when all schedules are disabled", async () => {
    mockGetScheduledAudits.mockResolvedValue([
      {
        id: "sched-1",
        userEmail: "user@example.com",
        link: "https://example.com",
        businessType: "SaaS",
        goals: "grow",
        frequency: "monthly",
        enabled: false,
        lastRunAt: undefined,
        teamId: undefined,
        createdAt: "2026-01-01T00:00:00Z",
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const res = await GET(makeRequest("Bearer test_cron_secret"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.processedSchedules).toBe(0);
    expect(mockOrchestrate).not.toHaveBeenCalled();
  });

  it("skips schedules that are not yet due", async () => {
    // lastRunAt was just now — not due for another 30 days
    const recentRunAt = new Date().toISOString();
    mockGetScheduledAudits.mockResolvedValue([
      {
        id: "sched-1",
        userEmail: "user@example.com",
        link: "https://example.com",
        businessType: "SaaS",
        goals: "grow",
        frequency: "monthly",
        enabled: true,
        lastRunAt: recentRunAt,
        teamId: undefined,
        createdAt: "2026-01-01T00:00:00Z",
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const res = await GET(makeRequest("Bearer test_cron_secret"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.processedSchedules).toBe(0);
    expect(mockOrchestrate).not.toHaveBeenCalled();
  });

  it("processes due schedules and updates lastRunAt", async () => {
    // lastRunAt was 31 days ago — monthly schedule is due
    const oldRunAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    mockGetScheduledAudits.mockResolvedValue([
      {
        id: "sched-1",
        userEmail: "user@example.com",
        link: "https://example.com",
        businessType: "SaaS",
        goals: "grow",
        frequency: "monthly",
        enabled: true,
        lastRunAt: oldRunAt,
        teamId: undefined,
        createdAt: "2026-01-01T00:00:00Z",
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    mockGetSubscription.mockResolvedValue({
      plan: "pro",
      status: "active",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockOrchestrate.mockResolvedValue({
      markdownAudit: "Scheduled audit result",
      scores: { communication: 80, aesthetic: 75, drive: 70, structure: 85 },
      evaluationScore: 85,
      iterations: 1,
    });
    mockSaveAudit.mockResolvedValue(undefined);
    mockUpdateScheduledAudit.mockResolvedValue(undefined);
    mockGetTeamMembers.mockResolvedValue([]);

    const res = await GET(makeRequest("Bearer test_cron_secret"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.processedSchedules).toBe(1);
    expect(mockOrchestrate).toHaveBeenCalledOnce();
    expect(mockOrchestrate).toHaveBeenCalledWith(
      expect.objectContaining({
        link: "https://example.com",
        businessType: "SaaS",
        goals: "grow",
        provider: "gemini",
        scrapeDepth: 3,
        advancedAudit: true,
      })
    );
    expect(mockSaveAudit).toHaveBeenCalledOnce();
    expect(mockUpdateScheduledAudit).toHaveBeenCalledWith(
      "sched-1",
      expect.objectContaining({ lastRunAt: expect.any(String) })
    );
  });

  it("skips a due weekly schedule without an active subscription", async () => {
    // lastRunAt was 8 days ago — weekly schedule is due
    const oldRunAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    mockGetScheduledAudits.mockResolvedValue([
      {
        id: "sched-2",
        userEmail: "user@example.com",
        link: "https://weekly.com",
        businessType: "Agency",
        goals: "leads",
        frequency: "weekly",
        enabled: true,
        lastRunAt: oldRunAt,
        teamId: undefined,
        createdAt: "2026-01-01T00:00:00Z",
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    mockGetSubscription.mockResolvedValue(null);
    mockOrchestrate.mockResolvedValue({
      markdownAudit: "Weekly audit result",
      scores: { communication: 60, aesthetic: 55, drive: 65, structure: 70 },
      evaluationScore: 62,
      iterations: 1,
    });
    mockSaveAudit.mockResolvedValue(undefined);
    mockUpdateScheduledAudit.mockResolvedValue(undefined);
    mockGetTeamMembers.mockResolvedValue([]);

    const res = await GET(makeRequest("Bearer test_cron_secret"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.processedSchedules).toBe(0);
    expect(mockOrchestrate).not.toHaveBeenCalled();
  });

  it("skips a schedule that has never run when the subscription is missing", async () => {
    mockGetScheduledAudits.mockResolvedValue([
      {
        id: "sched-new",
        userEmail: "newuser@example.com",
        link: "https://newsite.com",
        businessType: "E-commerce",
        goals: "conversions",
        frequency: "monthly",
        enabled: true,
        lastRunAt: undefined,
        teamId: undefined,
        createdAt: "2026-03-20T00:00:00Z",
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    mockGetSubscription.mockResolvedValue(null);
    mockOrchestrate.mockResolvedValue({
      markdownAudit: "First-run audit",
      scores: { communication: 72, aesthetic: 68, drive: 74, structure: 80 },
      evaluationScore: 74,
      iterations: 1,
    });
    mockSaveAudit.mockResolvedValue(undefined);
    mockUpdateScheduledAudit.mockResolvedValue(undefined);
    mockGetTeamMembers.mockResolvedValue([]);

    const res = await GET(makeRequest("Bearer test_cron_secret"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.processedSchedules).toBe(0);
    expect(mockOrchestrate).not.toHaveBeenCalled();
  });
});
