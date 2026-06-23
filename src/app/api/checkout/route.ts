import { NextResponse } from "next/server";
import Stripe from "stripe";
import { LRUCache } from "lru-cache";

const stripeSecret = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder";
const stripe = new Stripe(stripeSecret, {
  apiVersion: "2026-02-25.clover",
});

const rateLimit = new LRUCache({
  max: 100,
  ttl: 1000 * 60 * 60,
});

const CHECKOUT_PATHS: Record<number, { unitAmount: number; label: string }> = {
  1: { unitAmount: 150000, label: "The Builder" },
  2: { unitAmount: 29700, label: "The Vault" },
  3: { unitAmount: 50000, label: "The Oracle" },
};

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const currentUsage = (rateLimit.get(ip) as number) || 0;
    
    if (currentUsage >= 10) {
      return NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { status: 429 });
    }
    rateLimit.set(ip, currentUsage + 1);

    const { email, pathNumber, title } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const pathConfig = CHECKOUT_PATHS[Number(pathNumber)];
    if (!pathConfig) {
      return NextResponse.json({ error: "Invalid checkout path" }, { status: 400 });
    }
    const checkoutTitle = typeof title === "string" && title.trim() ? title.trim() : pathConfig.label;

    if (stripeSecret === "sk_test_placeholder") {
      console.warn("Using placeholder Stripe key. Simulating checkout URL.");
      return NextResponse.json({ url: "https://checkout.stripe.com/pay/cs_test_mock123" });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Avditor Mvndi - ${checkoutTitle}`,
              description: `Cosmic Growth Path ${pathNumber}: ${pathConfig.label}`,
            },
            unit_amount: pathConfig.unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/results?success=true`,
      cancel_url: `${baseUrl}/results?canceled=true`,
      metadata: {
        pathNumber: pathNumber.toString(),
        userEmail: email,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Stripe Checkout Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
