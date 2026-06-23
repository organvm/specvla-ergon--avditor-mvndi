import { NextResponse } from "next/server";
import { getUserByToken, getSubscription } from "@/lib/db";
import { scrapeWebsite } from "@/services/scraper";
import { getCosmicAuditPrompt } from "@/services/promptTemplates";
import { getPageSpeedInsights } from "@/services/pagespeed";
import { createAIModel } from "@/services/aiModelFactory";
import { generateText } from "ai";
import { getEntitlements, isActiveSubscriptionStatus } from "@/lib/plans";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid PAT" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1]; // allow-secret
    const userEmail = await getUserByToken(token);

    if (!userEmail) {
      return NextResponse.json({ error: "Invalid PAT" }, { status: 401 });
    }

    const sub = await getSubscription(userEmail);
    if (!sub || !isActiveSubscriptionStatus(sub.status)) {
      return NextResponse.json({ error: "Active subscription required for API access" }, { status: 403 });
    }

    const { link, businessType, goals } = await request.json();
    if (!link || !businessType || !goals) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Public API access is a paid entitlement; deeper crawls scale with the tier.
    const entitlements = getEntitlements(sub.plan);
    if (!entitlements.apiAccess) {
      return NextResponse.json({ error: "A paid plan is required for API access" }, { status: 403 });
    }
    const { scrapeDepth } = entitlements;
    const apiKey = process.env.GEMINI_API_KEY; // allow-secret

    const [scrapedContent, seoData] = await Promise.all([
      scrapeWebsite(link, scrapeDepth),
      getPageSpeedInsights(link).catch(() => null),
    ]);

    const model = createAIModel("gemini", apiKey || "");
    const prompt = getCosmicAuditPrompt(link, businessType, goals, scrapedContent, seoData);

    const { text } = await generateText({
      model,
      prompt,
    });

    let parsedResult;
    try {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonText = jsonMatch ? jsonMatch[1].trim() : text.trim();
      parsedResult = JSON.parse(jsonText);
    } catch {
      return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
    }

    return NextResponse.json(parsedResult);
  } catch (error: unknown) {
    console.error("Public API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
