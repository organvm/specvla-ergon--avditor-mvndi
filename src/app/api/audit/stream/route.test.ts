import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockStreamText = vi.fn().mockReturnValue({
  toTextStreamResponse: vi.fn().mockReturnValue(new Response(new ReadableStream())),
});

vi.mock("ai", () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
}));

vi.mock("@/services/aiModelFactory", () => ({
  createAIModel: vi.fn().mockReturnValue({}),
}));

vi.mock("@/services/scraper", () => ({
  scrapeWebsite: vi.fn().mockResolvedValue("scraped content"),
}));

vi.mock("@/services/vision", () => ({
  captureScreenshot: vi.fn().mockResolvedValue("base64mockscreenshot"),
}));

vi.mock("@/services/pagespeed", () => ({
  getPageSpeedInsights: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/db", () => ({
  saveAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { email: "test@example.com" } }),
}));

describe("API Route /api/audit/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if Authorization header is missing", async () => {
    const request = new Request("http://localhost/api/audit/stream", {
      method: "POST",
      body: JSON.stringify({ link: "test.com", businessType: "test", goals: "test" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 if required fields are missing", async () => {
    const request = new Request("http://localhost/api/audit/stream", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-key", // allow-secret
      },
      body: JSON.stringify({
        link: "test.com",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 if request JSON is empty or malformed", async () => {
    const request = new Request("http://localhost/api/audit/stream", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-key", // allow-secret
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("returns a streaming response for valid input", async () => {
    const request = new Request("http://localhost/api/audit/stream", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-key", // allow-secret
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        link: "https://test.com",
        businessType: "SaaS",
        goals: "Scale",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockStreamText).toHaveBeenCalled();
  });
});
