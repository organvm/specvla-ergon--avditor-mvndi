import { NextResponse } from "next/server";
import { saveAudit } from "@/lib/db";
import { sendAuditWebhook } from "@/services/webhook";
import crypto from "crypto";
import { auth } from "@/auth";
import { createRateLimiter, getClientIP } from "@/lib/rate-limit";
import { type AIProvider } from "@/services/aiProvider";
import { orchestrateCosmicAudit } from "@/services/aiOrchestrator";
import { z } from "zod";
import { getEffectivePlan, getEntitlements } from "@/lib/plans";

const rateLimiter = createRateLimiter({ max: 5, windowMs: 60 * 60 * 1000 });

const auditSchema = z.object({
  link: z.string().url(),
  businessType: z.string().min(2),
  goals: z.string().min(5),
  teamId: z.string().optional(),
});

/**
 * AUDIT API ENDPOINT (ICEBERG TIP)
 * Implements the Modular Testament by delegating all logic to the 
 * aiOrchestrator and database services.
 */
export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);
    const { limited } = rateLimiter.check(ip);

    if (limited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. The cosmic portal is temporarily closed." },
        { status: 429 }
      );
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing Authorization." }, { status: 401 });
    }

    const apiKey = authHeader.split(" ")[1]; // allow-secret
    const provider = (request.headers.get("X-AI-Provider") || "gemini") as AIProvider;

    const body = await request.json();
    const validation = auditSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid alignment data.", details: validation.error.format() }, { status: 400 });
    }

    const { link, businessType, goals, teamId } = validation.data;
    const session = await auth();
    const plan = getEffectivePlan(session?.user?.plan, {
      isAdmin: session?.user?.isAdmin,
      isPro: session?.user?.isPro,
      isPremium: session?.user?.isPremium,
    });
    const entitlements = getEntitlements(plan);

    // DELEGATE TO SUBMERGED ORCHESTRATOR
    const result = await orchestrateCosmicAudit({
      link,
      businessType,
      goals,
      provider,
      auth: apiKey,
      isPro: entitlements.advancedAudit,
      scrapeDepth: entitlements.scrapeDepth,
      advancedAudit: entitlements.advancedAudit,
    });

    const auditId = crypto.randomUUID();

    try {
      await saveAudit({
        id: auditId,
        userEmail: session?.user?.email || undefined,
        teamId: teamId || undefined,
        link,
        businessType,
        goals,
        markdownAudit: result.markdownAudit,
        scores: JSON.stringify(result.scores || {})
      });
      
      sendAuditWebhook({
        id: auditId,
        link,
        businessType,
        goals,
        scores: result.scores || {},
        userEmail: session?.user?.email || undefined,
      }).catch(() => {});
    } catch (dbError) {
      console.error("Submerged DB failure:", dbError);
    }

    return NextResponse.json({
      id: auditId,
      audit: result.markdownAudit,
      scores: result.scores,
      meta: {
        evaluationScore: result.evaluationScore,
        iterations: result.iterations
      }
    });
  } catch (error: unknown) {
    console.error("Surface API Error:", error);
    return NextResponse.json({ error: "Cosmic interference detected. Please try again." }, { status: 500 });
  }
}
