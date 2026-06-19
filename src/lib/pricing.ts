// Central pricing catalog for the premium subscription tiers.
//
// This module is client-safe: it contains NO Stripe secret price IDs. The
// browser sends a tier `id` to /api/subscription, and the server resolves it to
// the real Stripe price ID via STRIPE_PRICE_* env vars (see priceIdForTier).
// That keeps the Stripe catalog server-side and prevents a client from
// subscribing a user to an arbitrary price.

export type PlanTier = {
  id: string;
  name: string;
  price: string;
  priceNumeric: number;
  interval?: string;
  description: string;
  features: string[];
  cta: string;
  highlight?: boolean;
  disabled?: boolean;
  paid?: boolean;
};

export const PLANS: PlanTier[] = [
  {
    id: "basic",
    name: "Aspirant",
    price: "$0",
    priceNumeric: 0,
    description: "For individual creators and hobbyists.",
    features: [
      "Single-page audits",
      "Manual PDF exports",
      "Standard AI models",
      "Public sharing",
    ],
    cta: "Current Plan",
    disabled: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29",
    priceNumeric: 29,
    interval: "/mo",
    description: "For professional founders and solo operators.",
    features: [
      "Multi-page deep analysis",
      "The full Growth Vault (90% depth)",
      "Scheduled recurring audits",
      "White-label PDF reports",
      "Premium AI models (Claude Sonnet)",
    ],
    cta: "Manifest Pro",
    highlight: true,
    paid: true,
  },
  {
    id: "agency",
    name: "Agency",
    price: "$99",
    priceNumeric: 99,
    interval: "/mo",
    description: "For agencies and consultants serving clients.",
    features: [
      "Everything in Pro",
      "Team collaboration",
      "Public API access (PAT)",
      "Custom agency branding",
      "Priority support",
    ],
    cta: "Ascend to Agency",
    paid: true,
  },
];

export const PAID_TIER_IDS = ["pro", "agency"] as const;
export type PaidTierId = (typeof PAID_TIER_IDS)[number];

export function isPaidTier(id: unknown): id is PaidTierId {
  return typeof id === "string" && (PAID_TIER_IDS as readonly string[]).includes(id);
}

/**
 * Resolve a paid tier id to its configured Stripe price ID. Server-only — reads
 * STRIPE_PRICE_PRO / STRIPE_PRICE_AGENCY. Returns undefined when the tier is
 * unknown or its price has not been configured in the environment.
 */
export function priceIdForTier(id: string): string | undefined {
  if (!isPaidTier(id)) return undefined;
  const map: Record<PaidTierId, string | undefined> = {
    pro: process.env.STRIPE_PRICE_PRO,
    agency: process.env.STRIPE_PRICE_AGENCY,
  };
  return map[id];
}
