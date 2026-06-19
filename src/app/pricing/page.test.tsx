import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PricingPage from "./page";

// Mock fetch
global.fetch = vi.fn();

// Mock next-auth
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({ data: { user: { email: "test@example.com" } } })),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("PricingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders pricing plans", () => {
    render(<PricingPage />);
    expect(screen.getByText("Basic")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    // Pro is $29/mo, Premium is $99/mo (pricing comes from src/lib/plans.ts)
    expect(screen.getByText("$29")).toBeInTheDocument();
    expect(screen.getByText("$99")).toBeInTheDocument();
  });

  it("triggers stripe checkout on button click", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://stripe.com/checkout" }),
    } as Response);

    // Mock window.location
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: "" },
      writable: true,
    });

    render(<PricingPage />);
    const proButton = screen.getByText(/Manifest Pro/i);
    fireEvent.click(proButton);

    await vi.waitFor(() => {
      expect(window.location.href).toBe("https://stripe.com/checkout");
    });

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });
});
