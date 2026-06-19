import { NextResponse } from "next/server";
import Stripe from "stripe";
import { LRUCache } from "lru-cache";
import { isPaidTier, priceIdForTier } from "@/lib/pricing";

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

    const { email, tier } = await request.json();

    if (!email || !isPaidTier(tier)) {
      return NextResponse.json({ error: "Email and a valid tier are required" }, { status: 400 });
    }

    if (stripeSecret === "sk_test_placeholder") {
      console.warn("Using placeholder Stripe key. Simulating subscription checkout URL.");
      return NextResponse.json({ url: "https://checkout.stripe.com/pay/cs_test_mock123" });
    }

    const priceId = priceIdForTier(tier);
    if (!priceId) {
      console.error(`No Stripe price configured for tier "${tier}". Set STRIPE_PRICE_${tier.toUpperCase()}.`);
      return NextResponse.json({ error: "This plan is not available right now. Please try again later." }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${baseUrl}/results?success=true&subscription=active`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
      subscription_data: {
        metadata: {
          userEmail: email,
          tier,
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
