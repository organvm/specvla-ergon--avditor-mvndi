import { NextResponse } from "next/server";
import Stripe from "stripe";
import { Resend } from "resend";
import { updateSubscription } from "@/lib/db";
import { normalizePlanId, resolvePlanFromPriceId } from "@/lib/plans";

const stripeSecret = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_placeholder";
const stripe = new Stripe(stripeSecret, {
  apiVersion: "2026-02-25.clover",
});

const resend = new Resend(process.env.RESEND_API_KEY || "re_test_placeholder");

function getCheckoutEmail(session: Stripe.Checkout.Session): string | undefined {
  return session.metadata?.userEmail
    || session.customer_email
    || session.customer_details?.email
    || undefined;
}

function getCheckoutSubscriptionStatus(session: Stripe.Checkout.Session): string {
  const subscription = session.subscription;
  if (subscription && typeof subscription === "object" && "status" in subscription) {
    return subscription.status;
  }
  return "active";
}

function getSubscriptionPlan(subscription: Stripe.Subscription) {
  if (subscription.metadata?.plan) {
    return normalizePlanId(subscription.metadata.plan);
  }

  return resolvePlanFromPriceId(subscription.items?.data?.[0]?.price?.id);
}

async function getSubscriptionEmail(subscription: Stripe.Subscription): Promise<string | undefined> {
  if (subscription.metadata?.userEmail) return subscription.metadata.userEmail;

  const customer = subscription.customer;
  if (customer && typeof customer === "object" && !("deleted" in customer && customer.deleted)) {
    return customer.email || undefined;
  }

  if (stripeSecret !== "sk_test_placeholder" && typeof customer === "string") {
    const retrieved = await stripe.customers.retrieve(customer);
    if (!("deleted" in retrieved && retrieved.deleted)) {
      return retrieved.email || undefined;
    }
  }

  return undefined;
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") as string;

  let event: Stripe.Event;

  try {
    if (stripeSecret !== "sk_test_placeholder") {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // Mock event for local testing
      event = JSON.parse(body);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = getCheckoutEmail(session);
    const pathNumber = session.metadata?.pathNumber;
    const isSubscription = session.mode === "subscription";

    if (email) {
      if (isSubscription) {
        // Default to "pro" when no plan metadata is present so legacy
        // single-tier checkouts still grant paid entitlements.
        const plan = normalizePlanId(session.metadata?.plan || "pro");
        await updateSubscription(email, plan, getCheckoutSubscriptionStatus(session));

        try {
          await resend.emails.send({
            from: "Avditor Mvndi <hello@growthauditor.ai>",
            to: email,
            subject: "Your Monthly Alignment is Active ✦",
            html: `
              <h1>Welcome to Your Recurring Growth Cycle</h1>
              <p>Your subscription is now active. Every month, you'll receive a fresh Cosmic Delta Report showing how your scores have evolved.</p>
              <p>The first re-audit will run on the 1st of next month.</p>
              <p>Stay cosmic,</p>
              <p>The Avditor Mvndi Team</p>
            `,
          });
          console.log("Welcome email sent to", email);
        } catch (emailError) {
          console.error("Failed to send welcome email:", emailError);
        }
      } else {
        try {
          await resend.emails.send({
            from: "Avditor Mvndi <hello@growthauditor.ai>",
            to: email,
            subject: "Your Manifestation Path is Confirmed ✦",
            html: `
              <h1>Welcome to the Next Level of Growth</h1>
              <p>You have successfully aligned with Path ${pathNumber}.</p>
              <p>Our team (or your new templates) will be in touch shortly to begin the execution phase.</p>
              <p>Stay cosmic,</p>
              <p>The Avditor Mvndi Team</p>
            `,
          });
          console.log("Welcome email sent to", email);
        } catch (emailError) {
          console.error("Failed to send welcome email:", emailError);
        }
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const email = await getSubscriptionEmail(subscription);

    if (email) {
      await updateSubscription(email, "free", "inactive");
      console.log("Subscription canceled for", email);
    }
  }

  if (
    event.type === "customer.subscription.created"
    || event.type === "customer.subscription.updated"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const email = await getSubscriptionEmail(subscription);

    if (email) {
      const plan = getSubscriptionPlan(subscription);
      const status = subscription.status;
      await updateSubscription(email, plan, status);
      console.log("Subscription updated for", email);
    }
  }

  return NextResponse.json({ received: true });
}
