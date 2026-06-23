"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PLAN_ORDER, PLAN_CATALOG, type PlanId } from "@/lib/plans";

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState<PlanId | null>(null);

  const currentPlan = (session?.user?.plan as PlanId | undefined) ?? "free";

  const handleSubscribe = async (tier: PlanId) => {
    if (!session) {
      router.push("/api/auth/signin");
      return;
    }

    setLoading(tier);
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to start checkout");
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <main className="main">
      <div className="hero">
        <div className="astro-badge">
          <span aria-hidden="true">✦</span>
          Ascend Your Growth
        </div>
        <h1>Simple, Cosmic Pricing</h1>
        <p>Choose the path that aligns with your digital manifestation goals.</p>
      </div>

      <div className="container" style={{ maxWidth: "1100px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem", marginBottom: "4rem" }}>
        {PLAN_ORDER.map((id) => {
          const plan = PLAN_CATALOG[id];
          const isFree = plan.priceMonthly === 0;
          const isCurrent = currentPlan === id;
          const cta = isCurrent ? "Current Plan" : plan.cta;
          const disabled = isFree || isCurrent || loading === id;

          return (
            <div
              key={plan.id}
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                borderColor: plan.highlight ? "var(--primary)" : "rgba(255,255,255,0.1)",
                borderWidth: plan.highlight ? "2px" : "1px",
                position: "relative",
              }}
            >
              {plan.badge && (
                <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", backgroundColor: plan.highlight ? "var(--primary)" : "var(--accent)", color: "#000", padding: "0.25rem 0.75rem", borderRadius: "20px", fontSize: "0.7rem", fontWeight: 800, whiteSpace: "nowrap" }}>
                  {plan.badge}
                </div>
              )}
              <h2 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>{plan.name}</h2>
              <div style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "1rem" }}>
                {plan.priceLabel}<span style={{ fontSize: "0.9rem", fontWeight: 400, color: "var(--text-muted)" }}>{plan.interval}</span>
              </div>
              <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem", minHeight: "2.5rem", fontSize: "0.9rem" }}>{plan.description}</p>

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 2rem 0", flex: 1 }}>
                {plan.features.map((feature) => (
                  <li key={feature} style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
                    <span style={{ color: "var(--primary)", minWidth: "1.25rem" }}>✓</span> {feature}
                  </li>
                ))}
              </ul>

              <button
                className={`btn ${plan.highlight ? "" : "btn-secondary"}`}
                onClick={() => !isFree && handleSubscribe(plan.id)}
                disabled={disabled}
              >
                {loading === plan.id ? "Opening Portal..." : cta}
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
