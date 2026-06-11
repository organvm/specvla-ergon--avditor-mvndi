import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AlignmentSigil from "./AlignmentSigil";

// p5 runs a canvas-based animation loop — mock it entirely so jsdom doesn't choke
vi.mock("./loadP5", () => {
  class MockP5 {
    constructor(_sketch: unknown, container: HTMLElement) {
      // Simulate p5 attaching a canvas to the container
      if (container) {
        const canvas = document.createElement("canvas");
        canvas.setAttribute("data-testid", "p5-canvas");
        container.appendChild(canvas);
      }
    }
    remove() {}
  }
  return { loadP5: async () => MockP5 };
});

const defaultScores = {
  communication: 75,
  aesthetic: 60,
  drive: 45,
  structure: 80,
};

describe("AlignmentSigil", () => {
  it("renders without crashing", () => {
    const { container } = render(<AlignmentSigil scores={defaultScores} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders the Alignment Sigil label", () => {
    render(<AlignmentSigil scores={defaultScores} />);
    expect(screen.getByText("Alignment Sigil")).toBeInTheDocument();
  });

  it("renders the container div for p5", () => {
    const { container } = render(<AlignmentSigil scores={defaultScores} />);
    // The card wrapper should be present
    const card = container.querySelector(".card");
    expect(card).toBeInTheDocument();
  });

  it("renders with zero scores without crashing", () => {
    render(<AlignmentSigil scores={{ communication: 0, aesthetic: 0, drive: 0, structure: 0 }} />);
    expect(screen.getByText("Alignment Sigil")).toBeInTheDocument();
  });

  it("renders with max scores without crashing", () => {
    render(<AlignmentSigil scores={{ communication: 100, aesthetic: 100, drive: 100, structure: 100 }} />);
    expect(screen.getByText("Alignment Sigil")).toBeInTheDocument();
  });

  it("p5 canvas is attached to container", async () => {
    render(<AlignmentSigil scores={defaultScores} />);
    // The mock p5 constructor attaches a canvas element
    expect(await screen.findByTestId("p5-canvas")).toBeInTheDocument();
  });
});
