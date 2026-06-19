import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SignalPathNode from "./SignalPathNode";

const props = {
  pathNumber: 1,
  title: "The Builder",
  description: "Implementation support.",
  buttonText: "Inquire for Execution",
  icon: "hammer" as const,
  color: "#7000ff",
};

describe("SignalPathNode", () => {
  it("opens the checkout email modal when checkout is enabled", () => {
    render(<SignalPathNode {...props} checkoutPathNumber={1} />);

    fireEvent.click(screen.getByRole("button", { name: /Alignment Node 01/i }));
    fireEvent.click(screen.getByRole("button", { name: "Inquire for Execution" }));

    expect(screen.getByText("Enter your email to continue to checkout.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to Checkout" })).toBeInTheDocument();
  });

  it("does not open the checkout modal when checkout is disabled", () => {
    render(<SignalPathNode {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /Alignment Node 01/i }));
    fireEvent.click(screen.getByRole("button", { name: "Inquire for Execution" }));

    expect(screen.queryByText("Enter your email to continue to checkout.")).not.toBeInTheDocument();
  });
});
