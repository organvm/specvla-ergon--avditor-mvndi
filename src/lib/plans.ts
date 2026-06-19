/**
 * Subscription plan catalog — the single source of truth for tiers,
 * per-tier entitlements, and Stripe price-ID resolution.
 *
 * Safe to import from any context (client components, API routes, auth).
 * No SQLite, no native modules, no filesystem access. The price-resolution
 * helpers read `process.env` lazily (server-only) and are never called from
 * client code, so they don't leak Stripe price IDs into the browser bundle.
 */

export type PlanId = "free" | "pro" | "premium";

/**
 * What each tier unlocks. Gating throughout the app keys off these so the
 * rules live in one place rather than being scattered as `plan === "pro"`
 * string checks.
 */
export interface PlanEntitlements {
  /** Access to the gated Growth Vault playbooks. */
  vaultAccess: boolean;
  /** Full (unscrubbed) tactical recommendations in audits. */
  advancedAudit: boolean;
  /** Number of pages crawled per audit. */
  scrapeDepth: number;
  /** Recurring scheduled audits. */
  scheduledAudits: boolean;
  /** White-label / custom-logo PDF reports. */
  whiteLabel: boolean;
  /** Team seats included. */
  teamSeats: number;
  /** Public PAT-authenticated API access. */
  apiAccess: boolean;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  /** Display price, e.g. "$0", "$29", "$99". */
  priceLabel: string;
  /** Monthly price in whole dollars (0 for free). */
  priceMonthly: number;
  /** Billing interval suffix shown next to the price, e.g. "/mo". */
  interval?: string;
  description: string;
  features: string[];
  cta: string;
  /** Visually emphasise this tier on the pricing page. */
  highlight?: boolean;
  /** Marketing badge text, e.g. "MOST POPULAR". */
  badge?: string;
  entitlements: PlanEntitlements;
  /** Env var that holds the Stripe recurring price ID for this tier. */
  stripePriceEnv?: string;
}

export const PLAN_CATALOG: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Basic",
    priceLabel: "$0",
    priceMonthly: 0,
    description: "For individual creators and hobbyists.",
    features: [
      "Single-page audits",
      "Manual PDF exports",
      "Standard AI models",
      "Public sharing",
    ],
    cta: "Current Plan",
    entitlements: {
      vaultAccess: false,
      advancedAudit: false,
      scrapeDepth: 1,
      scheduledAudits: false,
      whiteLabel: false,
      teamSeats: 1,
      apiAccess: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceLabel: "$29",
    priceMonthly: 29,
    interval: "/mo",
    description: "For professional founders and growing agencies.",
    features: [
      "Multi-page deep analysis",
      "Full tactical recommendations",
      "Scheduled recurring audits",
      "White-label PDF reports",
      "Growth Vault access",
      "Team collaboration (3 seats)",
    ],
    cta: "Manifest Pro",
    highlight: true,
    badge: "MOST POPULAR",
    entitlements: {
      vaultAccess: true,
      advancedAudit: true,
      scrapeDepth: 3,
      scheduledAudits: true,
      whiteLabel: true,
      teamSeats: 3,
      apiAccess: true,
    },
    stripePriceEnv: "STRIPE_PRICE_PRO",
  },
  premium: {
    id: "premium",
    name: "Premium",
    priceLabel: "$99",
    priceMonthly: 99,
    interval: "/mo",
    description: "For agencies and consultants operating at scale.",
    features: [
      "Everything in Pro",
      "Deepest multi-page analysis",
      "Most capable AI models",
      "Priority scheduled audits",
      "Public API access",
      "Team collaboration (10 seats)",
    ],
    cta: "Ascend to Premium",
    badge: "BEST VALUE",
    entitlements: {
      vaultAccess: true,
      advancedAudit: true,
      scrapeDepth: 5,
      scheduledAudits: true,
      whiteLabel: true,
      teamSeats: 10,
      apiAccess: true,
    },
    stripePriceEnv: "STRIPE_PRICE_PREMIUM",
  },
};

/** Ordered list for rendering (free → pro → premium). */
export const PLAN_ORDER: PlanId[] = ["free", "pro", "premium"];

/** Paid tiers that can be purchased via Stripe checkout. */
export const PAID_PLAN_IDS: PlanId[] = ["pro", "premium"];

/** Relative rank, used for "at least this tier" comparisons. */
const PLAN_RANK: Record<PlanId, number> = { free: 0, pro: 1, premium: 2 };

/** Normalise an arbitrary stored plan string to a known PlanId. */
export function normalizePlanId(plan: string | null | undefined): PlanId {
  if (plan && plan in PLAN_CATALOG) return plan as PlanId;
  // Legacy/unknown values ("basic", null, etc.) collapse to free.
  return "free";
}

export function getPlan(plan: string | null | undefined): PlanDefinition {
  return PLAN_CATALOG[normalizePlanId(plan)];
}

export function isPaidPlan(plan: string | null | undefined): boolean {
  return PLAN_RANK[normalizePlanId(plan)] >= PLAN_RANK.pro;
}

export function isPremiumPlan(plan: string | null | undefined): boolean {
  return normalizePlanId(plan) === "premium";
}

/** True when `plan` is at least `minimum` in the tier hierarchy. */
export function planAtLeast(
  plan: string | null | undefined,
  minimum: PlanId,
): boolean {
  return PLAN_RANK[normalizePlanId(plan)] >= PLAN_RANK[minimum];
}

export function getEntitlements(
  plan: string | null | undefined,
): PlanEntitlements {
  return getPlan(plan).entitlements;
}

// ──────────────────────────────────────────────
// Stripe price-ID resolution (server-only)
// ──────────────────────────────────────────────

/**
 * Resolve the configured Stripe price ID for a paid tier. Returns null when
 * the tier is free/unknown or its price env var is unset.
 */
export function getStripePriceId(plan: string | null | undefined): string | null {
  const def = getPlan(plan);
  if (!def.stripePriceEnv) return null;
  return process.env[def.stripePriceEnv] || null;
}

/**
 * Reverse lookup: given a Stripe price ID (e.g. from a webhook), find which
 * tier it belongs to. Defaults to "pro" when no env var matches so legacy
 * single-tier subscriptions keep their pro entitlements.
 */
export function resolvePlanFromPriceId(
  priceId: string | null | undefined,
): PlanId {
  if (priceId) {
    for (const id of PAID_PLAN_IDS) {
      const envKey = PLAN_CATALOG[id].stripePriceEnv;
      if (envKey && process.env[envKey] && process.env[envKey] === priceId) {
        return id;
      }
    }
  }
  return "pro";
}
