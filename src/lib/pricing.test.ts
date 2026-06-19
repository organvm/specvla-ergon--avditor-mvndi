import { describe, it, expect, afterEach } from "vitest";
import { PLANS, PAID_TIER_IDS, isPaidTier, priceIdForTier } from "./pricing";

describe("pricing catalog", () => {
  it("exposes a free tier plus paid tiers in the $29–$99 range", () => {
    const free = PLANS.find((p) => p.id === "basic");
    expect(free?.priceNumeric).toBe(0);
    expect(free?.paid).toBeFalsy();

    const paid = PLANS.filter((p) => p.paid);
    expect(paid.length).toBeGreaterThanOrEqual(1);
    for (const plan of paid) {
      expect(plan.priceNumeric).toBeGreaterThanOrEqual(29);
      expect(plan.priceNumeric).toBeLessThanOrEqual(99);
    }
  });

  it("marks every PAID_TIER_ID as a paid plan in the catalog", () => {
    for (const id of PAID_TIER_IDS) {
      const plan = PLANS.find((p) => p.id === id);
      expect(plan?.paid).toBe(true);
    }
  });

  it("isPaidTier only accepts known paid tier ids", () => {
    expect(isPaidTier("pro")).toBe(true);
    expect(isPaidTier("agency")).toBe(true);
    expect(isPaidTier("basic")).toBe(false);
    expect(isPaidTier("enterprise")).toBe(false);
    expect(isPaidTier(undefined)).toBe(false);
    expect(isPaidTier(42)).toBe(false);
  });
});

describe("priceIdForTier", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env.STRIPE_PRICE_PRO = original.STRIPE_PRICE_PRO;
    process.env.STRIPE_PRICE_AGENCY = original.STRIPE_PRICE_AGENCY;
  });

  it("resolves configured price IDs from the environment", () => {
    process.env.STRIPE_PRICE_PRO = "price_pro_live";
    process.env.STRIPE_PRICE_AGENCY = "price_agency_live";
    expect(priceIdForTier("pro")).toBe("price_pro_live");
    expect(priceIdForTier("agency")).toBe("price_agency_live");
  });

  it("returns undefined for unknown or non-paid tiers", () => {
    expect(priceIdForTier("basic")).toBeUndefined();
    expect(priceIdForTier("nope")).toBeUndefined();
  });

  it("returns undefined when a tier's price is not configured", () => {
    delete process.env.STRIPE_PRICE_PRO;
    expect(priceIdForTier("pro")).toBeUndefined();
  });
});
