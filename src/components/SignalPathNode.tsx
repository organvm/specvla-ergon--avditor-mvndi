"use client";

import { useState, type FormEvent } from "react";
import CosmicIcon, { IconType } from "./CosmicIcons";

interface PathNodeProps {
  pathNumber: number;
  title: string;
  description: string;
  buttonText: string;
  isPrimary?: boolean;
  icon: IconType;
  color: string;
  checkoutPathNumber?: number;
}

export default function SignalPathNode({ 
  pathNumber, 
  title, 
  description, 
  buttonText, 
  isPrimary,
  icon,
  color,
  checkoutPathNumber
}: PathNodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleCTA = () => {
    if (checkoutPathNumber) {
      setShowModal(true);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!checkoutPathNumber) return;

    setIsRedirecting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pathNumber: checkoutPathNumber, title }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create checkout session");
      }
    } catch (error) {
      console.error(error);
      setIsRedirecting(false);
      alert("Failed to connect to checkout. Please try again.");
    }
  };

  return (
    <>
    <div className="form-group" style={{ width: "100%" }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="card"
        style={{
          padding: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "1.5rem",
          borderColor: isOpen ? color : "var(--glass-border)",
          borderWidth: "1px",
          textAlign: "left",
          width: "100%",
          cursor: "pointer",
          transition: "all 0.3s ease",
          background: isOpen ? "rgba(255,255,255,0.05)" : "var(--glass-bg)"
        }}
      >
        <div style={{
          width: "40px",
          height: "40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0
        }}>
          <CosmicIcon type={icon} size="100%" />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 800, color: color, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "0.25rem" }}>
            Alignment Node 0{pathNumber}
          </div>
          <h3 style={{ fontSize: "1.1rem", margin: 0, color: "#fff", fontWeight: 700 }}>{title}</h3>
        </div>
        <div style={{ 
          fontSize: "1rem", 
          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", 
          transition: "transform 0.3s",
          color: "var(--text-muted)",
          opacity: 0.5
        }}>
          ↓
        </div>
      </button>

      {isOpen && (
        <div 
          className="card" 
          style={{ 
            marginTop: "-0.5rem", 
            borderTopLeftRadius: 0, 
            borderTopRightRadius: 0,
            padding: "2rem 1.5rem 1.5rem",
            animation: "fadeIn 0.3s ease-out",
            borderTop: "none",
            borderColor: color,
            borderWidth: "1px",
            background: "rgba(0,0,0,0.3)"
          }}
        >
          <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem", lineHeight: "1.6", fontSize: "0.95rem" }}>{description}</p>
          <button
            type="button"
            className="btn"
            onClick={handleCTA}
            disabled={isRedirecting}
            style={{ background: isPrimary ? color : "rgba(255,255,255,0.05)", boxShadow: isPrimary ? `0 0 20px ${color}44` : "none" }}
          >
            {buttonText}
          </button>
        </div>
      )}
    </div>
    {showModal && (
      <div className="modal-overlay" onClick={() => setShowModal(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <button type="button" className="close-btn" onClick={() => setShowModal(false)}>×</button>
          <form onSubmit={handleSubmit}>
            <h3>{title}</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
              Enter your email to continue to checkout.
            </p>
            <div className="form-group">
              <input
                type="email"
                className="input"
                placeholder="your@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button type="submit" className="btn" disabled={isRedirecting}>
              {isRedirecting ? "Opening Checkout..." : "Continue to Checkout"}
            </button>
          </form>
        </div>
      </div>
    )}
    </>
  );
}
