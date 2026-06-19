import { describe, it, expect, afterEach } from "vitest";
import {
  PLAN_CATALOG,
  PAID_PLAN_IDS,
  normalizePlanId,
  getPlan,
  isPaidPlan,
  isPremiumPlan,
  planAtLeast,
  getEntitlements,
  getStripePriceId,
  resolvePlanFromPriceId,
} from "./plans";

describe("plan catalog", () => {
  it("prices every paid tier within the $29–$99 range", () => {
    for (const id of PAID_PLAN_IDS) {
      const price = PLAN_CATALOG[id].priceMonthly;
      expect(price).toBeGreaterThanOrEqual(29);
      expect(price).toBeLessThanOrEqual(99);
    }
  });

  it("keeps the free tier free", () => {
    expect(PLAN_CATALOG.free.priceMonthly).toBe(0);
  });

  it("escalates entitlements as the tier rises", () => {
    expect(PLAN_CATALOG.free.entitlements.vaultAccess).toBe(false);
    expect(PLAN_CATALOG.pro.entitlements.vaultAccess).toBe(true);
    expect(PLAN_CATALOG.premium.entitlements.scrapeDepth).toBeGreaterThan(
      PLAN_CATALOG.pro.entitlements.scrapeDepth,
    );
    expect(PLAN_CATALOG.premium.entitlements.teamSeats).toBeGreaterThan(
      PLAN_CATALOG.pro.entitlements.teamSeats,
    );
  });
});

describe("normalizePlanId", () => {
  it("passes through known plan ids", () => {
    expect(normalizePlanId("free")).toBe("free");
    expect(normalizePlanId("pro")).toBe("pro");
    expect(normalizePlanId("premium")).toBe("premium");
  });

  it("collapses legacy/unknown/null values to free", () => {
    expect(normalizePlanId("basic")).toBe("free");
    expect(normalizePlanId(null)).toBe("free");
    expect(normalizePlanId(undefined)).toBe("free");
    expect(normalizePlanId("enterprise")).toBe("free");
  });
});

describe("tier predicates", () => {
  it("isPaidPlan is true for pro and premium only", () => {
    expect(isPaidPlan("free")).toBe(false);
    expect(isPaidPlan("pro")).toBe(true);
    expect(isPaidPlan("premium")).toBe(true);
    expect(isPaidPlan(null)).toBe(false);
  });

  it("isPremiumPlan is true only for premium", () => {
    expect(isPremiumPlan("pro")).toBe(false);
    expect(isPremiumPlan("premium")).toBe(true);
  });

  it("planAtLeast respects the hierarchy", () => {
    expect(planAtLeast("premium", "pro")).toBe(true);
    expect(planAtLeast("pro", "pro")).toBe(true);
    expect(planAtLeast("free", "pro")).toBe(false);
    expect(planAtLeast("pro", "premium")).toBe(false);
  });
});

describe("getPlan / getEntitlements", () => {
  it("returns the definition for a tier", () => {
    expect(getPlan("premium").name).toBe("Premium");
  });

  it("falls back to free entitlements for unknown plans", () => {
    expect(getEntitlements("mystery").scrapeDepth).toBe(
      PLAN_CATALOG.free.entitlements.scrapeDepth,
    );
  });
});

describe("Stripe price resolution", () => {
  const ORIGINAL = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it("returns null for free tier", () => {
    expect(getStripePriceId("free")).toBeNull();
  });

  it("reads the configured price id for a paid tier", () => {
    process.env.STRIPE_PRICE_PRO = "price_pro_live";
    process.env.STRIPE_PRICE_PREMIUM = "price_premium_live";
    expect(getStripePriceId("pro")).toBe("price_pro_live");
    expect(getStripePriceId("premium")).toBe("price_premium_live");
  });

  it("returns null when the env var is unset", () => {
    delete process.env.STRIPE_PRICE_PRO;
    expect(getStripePriceId("pro")).toBeNull();
  });

  it("reverse-resolves a price id to its tier", () => {
    process.env.STRIPE_PRICE_PRO = "price_pro_live";
    process.env.STRIPE_PRICE_PREMIUM = "price_premium_live";
    expect(resolvePlanFromPriceId("price_premium_live")).toBe("premium");
    expect(resolvePlanFromPriceId("price_pro_live")).toBe("pro");
  });

  it("defaults unknown price ids to pro for legacy compatibility", () => {
    process.env.STRIPE_PRICE_PRO = "price_pro_live";
    expect(resolvePlanFromPriceId("price_unknown")).toBe("pro");
    expect(resolvePlanFromPriceId(null)).toBe("pro");
  });
});
