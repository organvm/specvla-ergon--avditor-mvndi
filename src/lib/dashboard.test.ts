import { describe, expect, it, vi, beforeEach } from "vitest";
import { getAudits, getLeads, getScheduledAudits } from "@/lib/db";
import { getEnvStatus } from "@/lib/env";
import { getDashboardMetrics } from "./dashboard";

vi.mock("@/lib/db", () => ({
  getAudits: vi.fn(),
  getLeads: vi.fn(),
  getScheduledAudits: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getEnvStatus: vi.fn(),
}));

const mockGetAudits = vi.mocked(getAudits);
const mockGetLeads = vi.mocked(getLeads);
const mockGetScheduledAudits = vi.mocked(getScheduledAudits);
const mockGetEnvStatus = vi.mocked(getEnvStatus);

describe("getDashboardMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEnvStatus.mockReturnValue([
      { key: "NEXT_PUBLIC_SUPABASE_URL", label: "Supabase URL", configured: true, required: false, category: "database" },
      { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Supabase Key", configured: false, required: false, category: "database" },
      { key: "GEMINI_API_KEY", label: "Gemini API Key", configured: true, required: false, category: "ai" },
    ]);
  });

  it("aggregates usage, quality, trend, and readiness metrics", async () => {
    mockGetAudits.mockResolvedValue([
      {
        id: "audit-1",
        userEmail: "a@example.com",
        link: "https://www.example.com/path",
        businessType: "SaaS",
        goals: "Grow",
        markdownAudit: "",
        scores: JSON.stringify({ communication: 80, aesthetic: 70, drive: 90, structure: 60 }),
        createdAt: "2026-06-19T10:00:00Z",
      },
      {
        id: "audit-2",
        userEmail: "b@example.com",
        link: "example.com/pricing",
        businessType: "SaaS",
        goals: "Convert",
        markdownAudit: "",
        scores: JSON.stringify({ communication: 50, aesthetic: 70 }),
        createdAt: "2026-06-18T10:00:00Z",
      },
      {
        id: "audit-3",
        link: "https://shop.dev",
        businessType: "Ecommerce",
        goals: "Sales",
        markdownAudit: "",
        scores: "not-json",
        createdAt: "2026-06-12T10:00:00Z",
      },
      {
        id: "audit-4",
        userEmail: "a@example.com",
        link: "not a url",
        businessType: "Creator",
        goals: "Audience",
        markdownAudit: "",
        scores: JSON.stringify({ communication: "high" }),
        createdAt: "2026-05-01T10:00:00Z",
      },
    ]);
    mockGetLeads.mockResolvedValue([
      { id: "lead-1", email: "one@example.com", source: "audit_gate" },
      { id: "lead-2", email: "two@example.com", source: "audit_gate" },
    ]);
    mockGetScheduledAudits.mockResolvedValue([
      {
        id: "schedule-1",
        userEmail: "a@example.com",
        link: "https://example.com",
        businessType: "SaaS",
        goals: "Grow",
        frequency: "weekly",
        enabled: true,
      },
      {
        id: "schedule-2",
        userEmail: "b@example.com",
        link: "https://shop.dev",
        businessType: "Ecommerce",
        goals: "Sell",
        frequency: "monthly",
        enabled: false,
      },
    ]);

    const metrics = await getDashboardMetrics(new Date("2026-06-19T12:00:00Z"));

    expect(metrics.status).toBe("healthy");
    expect(metrics.usage).toMatchObject({
      totalAudits: 4,
      auditsLast7Days: 2,
      auditsLast30Days: 3,
      uniqueUsers: 2,
      totalLeads: 2,
      leadConversionRate: 50,
      activeSchedules: 1,
      totalSchedules: 2,
    });
    expect(metrics.quality).toEqual({ averageScore: 67.5, scoredAudits: 2 });
    expect(metrics.trends.auditsByDay).toEqual([
      { date: "2026-06-13", count: 0 },
      { date: "2026-06-14", count: 0 },
      { date: "2026-06-15", count: 0 },
      { date: "2026-06-16", count: 0 },
      { date: "2026-06-17", count: 0 },
      { date: "2026-06-18", count: 1 },
      { date: "2026-06-19", count: 1 },
    ]);
    expect(metrics.topDomains[0]).toEqual({ domain: "example.com", count: 2 });
    expect(metrics.topBusinessTypes[0]).toEqual({ type: "SaaS", count: 2 });
    expect(metrics.readiness).toContainEqual({ category: "database", configured: 1, total: 2 });
    expect(metrics.readiness).toContainEqual({ category: "ai", configured: 1, total: 1 });
    expect(metrics.recentAudits.map((audit) => audit.id)).toEqual(["audit-1", "audit-2", "audit-3", "audit-4"]);
  });

  it("marks the dashboard degraded when a data source fails", async () => {
    mockGetAudits.mockRejectedValue(new Error("database unavailable"));
    mockGetLeads.mockResolvedValue([]);
    mockGetScheduledAudits.mockRejectedValue(new Error("schedule table unavailable"));

    const metrics = await getDashboardMetrics(new Date("2026-06-19T12:00:00Z"));

    expect(metrics.status).toBe("degraded");
    expect(metrics.usage.totalAudits).toBe(0);
    expect(metrics.services).toContainEqual({
      name: "Audit History",
      state: "degraded",
      detail: "Read failed",
    });
    expect(metrics.services).toContainEqual({
      name: "Schedules",
      state: "degraded",
      detail: "Read failed",
    });
  });
});
