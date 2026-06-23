import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSubscription, updateBranding } from "@/lib/db";
import { BrandingSchema } from "@/lib/schemas";
import { getEffectivePlan, getEntitlements, isActiveSubscriptionStatus } from "@/lib/plans";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sub = await getSubscription(session.user.email);
    if (!sub) return NextResponse.json({});

    const canUseWhiteLabel = !!session.user.isAdmin
      || (isActiveSubscriptionStatus(sub.status) && getEntitlements(sub.plan).whiteLabel);

    return NextResponse.json({
      plan: sub.plan,
      status: sub.status,
      customLogoUrl: canUseWhiteLabel ? sub.customLogoUrl : undefined,
    });
  } catch (error: unknown) {
    console.error("GET Branding Error:", error);
    return NextResponse.json({ error: "Failed to fetch branding" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const plan = getEffectivePlan(session.user.plan, {
      isAdmin: session.user.isAdmin,
      isPro: session.user.isPro,
      isPremium: session.user.isPremium,
    });
    const { whiteLabel } = getEntitlements(plan);
    if (!whiteLabel) {
      return NextResponse.json({ error: "Pro subscription required for custom branding" }, { status: 403 });
    }

    const body = await request.json();
    const validation = BrandingSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid branding data.", details: validation.error.format() }, { status: 400 });
    }

    await updateBranding(session.user.email, validation.data.logoUrl);
    return NextResponse.json({ message: "Branding updated successfully" });
  } catch (error: unknown) {
    console.error("POST Branding Error:", error);
    return NextResponse.json({ error: "Failed to update branding" }, { status: 500 });
  }
}
