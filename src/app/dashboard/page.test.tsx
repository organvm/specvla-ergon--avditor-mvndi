import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { getDashboardMetrics } from "@/lib/dashboard";

vi.mock("@/lib/dashboard", () => ({
  getDashboardMetrics: vi.fn(),
}));

const mockGetDashboardMetrics = vi.mocked(getDashboardMetrics);

async function renderAsync(ui: Promise<React.JSX.Element>) {
  const resolved = await ui;
  return render(resolved);
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDashboardMetrics.mockResolvedValue({
      generatedAt: "2026-06-19T12:00:00Z",
      status: "healthy",
      usage: {
        totalAudits: 42,
        auditsLast7Days: 6,
        auditsLast30Days: 15,
        uniqueUsers: 9,
        totalLeads: 5,
        leadConversionRate: 12.5,
        activeSchedules: 3,
        totalSchedules: 4,
      },
      quality: {
        averageScore: 76.2,
        scoredAudits: 40,
      },
      trends: {
        auditsByDay: [
          { date: "2026-06-13", count: 0 },
          { date: "2026-06-14", count: 1 },
          { date: "2026-06-15", count: 0 },
          { date: "2026-06-16", count: 2 },
          { date: "2026-06-17", count: 1 },
          { date: "2026-06-18", count: 0 },
          { date: "2026-06-19", count: 2 },
        ],
      },
      topDomains: [
        { domain: "example.com", count: 7 },
        { domain: "shop.dev", count: 3 },
      ],
      topBusinessTypes: [
        { type: "SaaS", count: 12 },
        { type: "Ecommerce", count: 5 },
      ],
      services: [
        { name: "Audit History", state: "operational", detail: "42 records readable" },
        { name: "Lead Capture", state: "operational", detail: "5 records readable" },
        { name: "Schedules", state: "operational", detail: "3 active" },
      ],
      readiness: [
        { category: "database", configured: 2, total: 2 },
        { category: "ai", configured: 1, total: 1 },
      ],
      recentAudits: [
        { id: "audit-1", link: "https://example.com", businessType: "SaaS", createdAt: "2026-06-19T10:00:00Z" },
      ],
    });
  });

  it("renders status, usage metrics, and ranked sections", async () => {
    const { default: DashboardPage } = await import("./page");
    await renderAsync(DashboardPage());

    expect(screen.getByRole("heading", { name: "Status Dashboard" })).toBeInTheDocument();
    expect(screen.getAllByText("Healthy").length).toBeGreaterThan(0);
    expect(screen.getByText("Total audits")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("15 in the last 30 days")).toBeInTheDocument();
    expect(screen.getByText("Lead conversion")).toBeInTheDocument();
    expect(screen.getByText("12.5%")).toBeInTheDocument();
    expect(screen.getByText("Audit History")).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.getAllByText("SaaS").length).toBeGreaterThan(0);
    expect(screen.getByText("https://example.com")).toBeInTheDocument();
  });
});
