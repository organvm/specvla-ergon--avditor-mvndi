import { streamText } from "ai";
import { scrapeWebsite } from "@/services/scraper";
import { getStreamingAuditPrompt } from "@/services/promptTemplates";
import { captureScreenshot } from "@/services/vision";
import { getPageSpeedInsights } from "@/services/pagespeed";
import { saveAudit } from "@/lib/db";
import crypto from "crypto";
import { auth } from "@/auth";
import { createRateLimiter, getClientIP } from "@/lib/rate-limit";
import { createAIModel, type AIProvider } from "@/services/aiModelFactory";
import { AuditSchema } from "@/lib/schemas";

const rateLimiter = createRateLimiter({ max: 5, windowMs: 60 * 60 * 1000 });

function parseScoresFromText(text: string): { communication: number; aesthetic: number; drive: number; structure: number } | null {
  const scoresMatch = text.match(/## Scores[\s\S]*$/);
  if (!scoresMatch) return null;
  const scores: Record<string, number> = {};
  const lines = scoresMatch[0].split("\n");
  for (const line of lines) {
    const match = line.match(/(\w+):\s*(\d+)/);
    if (match) {
      const key = match[1].toLowerCase();
      scores[key] = parseInt(match[2], 10);
    }
  }
  return Object.keys(scores).length >= 4 ? (scores as { communication: number; aesthetic: number; drive: number; structure: number }) : null;
}

/**
 * STREAMING AUDIT ENDPOINT (ICEBERG TIP)
 * Provides immediate feedback (the tip) while the recursive scraper and 
 * multi-model orchestration run submerged.
 */
export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);
    const { limited } = rateLimiter.check(ip);

    if (limited) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429 });
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const apiKey = authHeader.split(" ")[1]; // allow-secret
    const provider = (request.headers.get("X-AI-Provider") || "gemini") as AIProvider;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
    }

    const validation = AuditSchema.safeParse(body);

    if (!validation.success) {
      return new Response(JSON.stringify({ error: "Missing required fields", details: validation.error.format() }), { status: 400 });
    }

    const { link, businessType, goals, teamId, language } = validation.data;

    const session = await auth();
    const isPro = session?.user?.isPro || session?.user?.isAdmin;

    // Submerged context gathering
    const [scrapedContent, , seoData] = await Promise.all([
      scrapeWebsite(link, isPro ? 3 : 1),
      captureScreenshot(link).catch(() => null),
      getPageSpeedInsights(link).catch(() => null),
    ]);

    const model = createAIModel(provider, apiKey);
    const prompt = getStreamingAuditPrompt(link, businessType, goals, scrapedContent, seoData, language);

    const result = streamText({
      model,
      prompt,
      onFinish: async ({ text }) => {
        const auditId = crypto.randomUUID();
        const scores = parseScoresFromText(text);

        try {
          await saveAudit({
            id: auditId,
            userEmail: session?.user?.email || undefined,
            teamId: teamId || undefined,
            link,
            businessType,
            goals,
            markdownAudit: text,
            scores: JSON.stringify(scores || {}),
          });
        } catch (dbError) {
          console.error("Submerged stream save failure:", dbError);
        }
      },
    });

    return result.toTextStreamResponse();
  } catch (error: unknown) {
    console.error("Stream Error:", error);
    return new Response(JSON.stringify({ error: "Portal interference." }), { status: 500 });
  }
}
