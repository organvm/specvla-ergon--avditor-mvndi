import { describe, it, expect, vi, beforeEach } from "vitest";
import { orchestrateCosmicAudit, OrchestratedAuditRequest } from "./aiOrchestrator";
import { generateText } from "ai";
import * as evaluator from "./evaluator";
import { scrapeWebsite } from "./scraper";

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("./aiModelFactory", () => ({
  createAIModel: vi.fn().mockReturnValue({}),
}));

vi.mock("./evaluator", () => ({
  evaluateAudit: vi.fn(),
}));

vi.mock("./scraper", () => ({
  scrapeWebsite: vi.fn().mockResolvedValue("scraped"),
}));

vi.mock("./vision", () => ({
  captureScreenshot: vi.fn().mockResolvedValue("screenshot"),
}));

vi.mock("./pagespeed", () => ({
  getPageSpeedInsights: vi.fn().mockResolvedValue({}),
}));

describe("aiOrchestrator service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockReq: OrchestratedAuditRequest = {
    link: "https://test.com",
    businessType: "SaaS",
    goals: "Growth",
    provider: "gemini",
    auth: "key", // allow-secret
    isPro: true,
  };

  it("orchestrates a successful audit flow in one iteration", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({ markdownAudit: "Audit", scores: { communication: 90 } }),
    } as Awaited<ReturnType<typeof generateText>>);
    vi.mocked(evaluator.evaluateAudit).mockResolvedValue({ score: 90, passed: true, feedback: "Excellent" });

    const result = await orchestrateCosmicAudit(mockReq);
    expect(result.iterations).toBe(1);
    expect(result.evaluationScore).toBe(90);
    expect(evaluator.evaluateAudit).toHaveBeenCalled();
  });

  it("regenerates once if initial evaluation fails", async () => {
    vi.mocked(generateText)
      .mockResolvedValueOnce({ text: JSON.stringify({ markdownAudit: "Bad", scores: {} }) } as Awaited<ReturnType<typeof generateText>>)
      .mockResolvedValueOnce({ text: JSON.stringify({ markdownAudit: "Better", scores: {} }) } as Awaited<ReturnType<typeof generateText>>);

    vi.mocked(evaluator.evaluateAudit).mockResolvedValue({ score: 40, passed: false, feedback: "Improve" });

    const result = await orchestrateCosmicAudit(mockReq);
    expect(result.iterations).toBe(2);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("uses an explicit entitlement scrape depth when provided", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({ markdownAudit: "Audit", scores: { communication: 90 } }),
    } as Awaited<ReturnType<typeof generateText>>);
    vi.mocked(evaluator.evaluateAudit).mockResolvedValue({ score: 90, passed: true, feedback: "Excellent" });

    await orchestrateCosmicAudit({ ...mockReq, scrapeDepth: 5 });

    expect(scrapeWebsite).toHaveBeenCalledWith("https://test.com", 5);
  });
});
