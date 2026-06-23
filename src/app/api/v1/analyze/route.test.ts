import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import * as db from "@/lib/db";
import { generateText } from "ai";
import * as scraper from "@/services/scraper";
import * as pagespeed from "@/services/pagespeed";

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("@/services/aiModelFactory", () => ({
  createAIModel: vi.fn().mockReturnValue({}),
}));

vi.mock("@/services/scraper", () => ({
  scrapeWebsite: vi.fn(),
}));

vi.mock("@/services/pagespeed", () => ({
  getPageSpeedInsights: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getUserByToken: vi.fn(),
  getSubscription: vi.fn(),
}));

describe("Public API /api/v1/analyze", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(scraper.scrapeWebsite).mockResolvedValue("scraped content");
    vi.mocked(pagespeed.getPageSpeedInsights).mockResolvedValue({
      performanceScore: 80,
      seoScore: 80,
      accessibilityScore: 80,
      bestPracticesScore: 80,
      lcp: "1s"
    });
  });

  it("returns 401 if token is missing", async () => {
    const req = new Request("http://localhost/api/v1/analyze", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 if user has no active subscription", async () => {
    vi.mocked(db.getUserByToken).mockResolvedValue("test@example.com");
    vi.mocked(db.getSubscription).mockResolvedValue({ status: "inactive" });

    const req = new Request("http://localhost/api/v1/analyze", {
      method: "POST",
      headers: { "Authorization": "Bearer valid-token" },
      body: JSON.stringify({ link: "http://test.com", businessType: "test", goals: "test" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns audit results for a valid request", async () => {
    vi.mocked(db.getUserByToken).mockResolvedValue("test@example.com");
    vi.mocked(db.getSubscription).mockResolvedValue({ plan: "pro", status: "active" });
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({ markdownAudit: "Audit text", scores: { communication: 80, aesthetic: 70, drive: 60, structure: 90 } }),
    } as Awaited<ReturnType<typeof generateText>>);

    const req = new Request("http://localhost/api/v1/analyze", {
      method: "POST",
      headers: { "Authorization": "Bearer valid-token" },
      body: JSON.stringify({ link: "http://test.com", businessType: "test", goals: "test goals" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.markdownAudit).toBe("Audit text");
    expect(scraper.scrapeWebsite).toHaveBeenCalledWith("http://test.com", 3);
  });

  it("uses premium depth for trialing premium subscriptions", async () => {
    vi.mocked(db.getUserByToken).mockResolvedValue("test@example.com");
    vi.mocked(db.getSubscription).mockResolvedValue({ plan: "premium", status: "trialing" });
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({ markdownAudit: "Audit text", scores: { communication: 80 } }),
    } as Awaited<ReturnType<typeof generateText>>);

    const req = new Request("http://localhost/api/v1/analyze", {
      method: "POST",
      headers: { "Authorization": "Bearer valid-token" },
      body: JSON.stringify({ link: "http://test.com", businessType: "test", goals: "test goals" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(scraper.scrapeWebsite).toHaveBeenCalledWith("http://test.com", 5);
  });
});
