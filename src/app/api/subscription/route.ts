import { NextResponse } from "next/server";
import Stripe from "stripe";
import { LRUCache } from "lru-cache";
import {
  PAID_PLAN_IDS,
  getStripePriceId,
  resolvePlanFromPriceId,
  normalizePlanId,
  type PlanId,
} from "@/lib/plans";

const stripeSecret = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder";
const stripe = new Stripe(stripeSecret, {
  apiVersion: "2026-02-25.clover",
});

const rateLimit = new LRUCache({
  max: 100,
  ttl: 1000 * 60 * 60,
});

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const currentUsage = (rateLimit.get(ip) as number) || 0;

    if (currentUsage >= 10) {
      return NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { status: 429 });
    }
    rateLimit.set(ip, currentUsage + 1);

    const { email, tier, priceId } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Resolve the target plan and its Stripe price. Prefer the tier key
    // (the client never sends a raw price ID — we resolve it server-side so
    // a caller can't subscribe themselves to an arbitrary price). A direct
    // `priceId` is still accepted for legacy/admin callers.
    let plan: PlanId;
    let resolvedPriceId: string | null;

    if (tier) {
      plan = normalizePlanId(tier);
      if (!PAID_PLAN_IDS.includes(plan)) {
        return NextResponse.json({ error: "Invalid subscription tier" }, { status: 400 });
      }
      resolvedPriceId = getStripePriceId(plan);
    } else if (priceId) {
      plan = resolvePlanFromPriceId(priceId);
      resolvedPriceId = priceId;
    } else {
      return NextResponse.json({ error: "A tier or priceId is required" }, { status: 400 });
    }

    if (stripeSecret === "sk_test_placeholder") {
      console.warn("Using placeholder Stripe key. Simulating subscription checkout URL.");
      return NextResponse.json({ url: "https://checkout.stripe.com/pay/cs_test_mock123" });
    }

    if (!resolvedPriceId) {
      console.error(`No Stripe price configured for tier "${plan}". Set the corresponding STRIPE_PRICE_* env var.`);
      return NextResponse.json({ error: "This plan is not available for purchase yet." }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price: resolvedPriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      // Plan is recorded on both the session and the subscription so the
      // webhook can persist the correct tier on every lifecycle event.
      metadata: {
        userEmail: email,
        plan,
      },
      success_url: `${baseUrl}/results?success=true&subscription=active`,
      cancel_url: `${baseUrl}/settings?canceled=true`,
      subscription_data: {
        metadata: {
          userEmail: email,
          plan,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Subscription Checkout Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
