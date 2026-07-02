import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AdminPage from "./page";

// Mock Loader component
vi.mock("@/components/Loader", () => {
  return {
    default: () => <div data-testid="loader">Loading...</div>,
  };
});

describe("AdminPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders loader initially", () => {
    // Mock fetch to never resolve so we can see the loading state
    global.fetch = vi.fn(() => new Promise(() => {}));
    render(<AdminPage />);
    expect(screen.getByTestId("loader")).toBeInTheDocument();
  });

  it("shows error when access is denied", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
      } as Response)
    );

    render(<AdminPage />);
    
    await waitFor(() => {
      expect(screen.getByText("Admin Access Denied")).toBeInTheDocument();
    });
  });

  it("renders overview when access is granted", async () => {
    global.fetch = vi.fn((url) => {
      if (url === "/api/admin?type=stats") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
    });

    render(<AdminPage />);
    
    await waitFor(() => {
      expect(screen.getByText("Avditor Mvndi Admin")).toBeInTheDocument();
    });
  });
});
