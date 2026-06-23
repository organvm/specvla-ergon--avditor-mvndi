import { describe, it, expect, vi, beforeEach } from "vitest";

// auth.ts reads ADMIN_EMAILS / AUTH_PASSWORD at module-load time, so the env
// must be set before the module is imported. vi.hoisted runs before imports.
// capturedConfig must also be hoisted so the vi.mock factory (which is hoisted
// by Vitest) can reference it without a TDZ error.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { capturedConfigHolder } = vi.hoisted(() => {
  process.env.ADMIN_EMAILS = "admin@growthauditor.ai, boss@corp.com";
  process.env.AUTH_PASSWORD = "cosmic"; // allow-secret
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const capturedConfigHolder: { value: any } = { value: undefined };
  return { capturedConfigHolder };
});

vi.mock("next-auth", () => ({
  default: vi.fn((config) => {
    capturedConfigHolder.value = config;
    return { handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() };
  }),
}));

// Each provider factory just echoes the config it was given so the captured
// NextAuth config keeps the original authorize() implementation intact.
vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn((config) => ({ ...config, id: "credentials", type: "credentials" })),
}));
vi.mock("next-auth/providers/google", () => ({
  default: vi.fn((config) => ({ ...config, id: "google", type: "oauth" })),
}));
vi.mock("next-auth/providers/github", () => ({
  default: vi.fn((config) => ({ ...config, id: "github", type: "oauth" })),
}));

vi.mock("@/lib/db", () => ({
  getSubscription: vi.fn(),
}));

import "./auth";
import { getSubscription } from "@/lib/db";

const mockGetSubscription = vi.mocked(getSubscription);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAuthorize(): (creds: any) => Promise<any> {
  const provider = capturedConfigHolder.value.providers.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: any) => typeof p.authorize === "function"
  );
  return provider.authorize;
}

describe("auth credentials authorize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authenticates an admin email with the correct password", async () => {
    const user = await getAuthorize()({
      email: "admin@growthauditor.ai",
      password: "cosmic", // allow-secret
    });

    expect(user).toMatchObject({
      id: "1",
      email: "admin@growthauditor.ai",
      name: "admin",
      isAdmin: true,
    });
  });

  it("authenticates a non-admin email but marks isAdmin false", async () => {
    const user = await getAuthorize()({
      email: "user@example.com",
      password: "cosmic", // allow-secret
    });

    expect(user).toMatchObject({ email: "user@example.com", isAdmin: false });
  });

  it("trims whitespace around configured admin emails", async () => {
    // "boss@corp.com" is configured with a leading space in ADMIN_EMAILS
    const user = await getAuthorize()({
      email: "boss@corp.com",
      password: "cosmic", // allow-secret
    });

    expect(user?.isAdmin).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const user = await getAuthorize()({
      email: "admin@growthauditor.ai",
      password: "wrong", // allow-secret
    });

    expect(user).toBeNull();
  });

  it("rejects when email is not a string", async () => {
    const user = await getAuthorize()({
      email: undefined,
      password: "cosmic", // allow-secret
    });

    expect(user).toBeNull();
  });
});

describe("auth jwt callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks isAdmin and isPro for an admin with an active pro subscription", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetSubscription.mockResolvedValue({ plan: "pro", status: "active" } as any);

    const token = await capturedConfigHolder.value.callbacks.jwt({
      token: {},
      user: { email: "admin@growthauditor.ai" },
    });

    expect(token.isAdmin).toBe(true);
    expect(token.isPro).toBe(true);
    expect(mockGetSubscription).toHaveBeenCalledWith("admin@growthauditor.ai");
  });

  it("sets isPro false for a non-pro subscription", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetSubscription.mockResolvedValue({ plan: "free", status: "active" } as any);

    const token = await capturedConfigHolder.value.callbacks.jwt({
      token: {},
      user: { email: "user@example.com" },
    });

    expect(token.isAdmin).toBe(false);
    expect(token.isPro).toBe(false);
  });

  it("sets isPro false when the pro subscription is not active", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetSubscription.mockResolvedValue({ plan: "pro", status: "canceled" } as any);

    const token = await capturedConfigHolder.value.callbacks.jwt({
      token: {},
      user: { email: "user@example.com" },
    });

    expect(token.isPro).toBe(false);
  });

  it("marks premium trialing subscriptions as premium paid access", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetSubscription.mockResolvedValue({ plan: "premium", status: "trialing" } as any);

    const token = await capturedConfigHolder.value.callbacks.jwt({
      token: {},
      user: { email: "user@example.com" },
    });

    expect(token.plan).toBe("premium");
    expect(token.isPro).toBe(true);
    expect(token.isPremium).toBe(true);
  });

  it("defaults isPro to false when the subscription lookup throws", async () => {
    mockGetSubscription.mockRejectedValue(new Error("db unavailable"));

    const token = await capturedConfigHolder.value.callbacks.jwt({
      token: {},
      user: { email: "user@example.com" },
    });

    expect(token.isPro).toBe(false);
  });

  it("returns the existing token untouched on refresh (no user)", async () => {
    const existing = { isAdmin: true, isPro: true, sub: "abc" };

    const token = await capturedConfigHolder.value.callbacks.jwt({ token: existing });

    expect(token).toBe(existing);
    expect(mockGetSubscription).not.toHaveBeenCalled();
  });
});

describe("auth session callback", () => {
  it("copies isAdmin and isPro from token to session.user", async () => {
    const session = await capturedConfigHolder.value.callbacks.session({
      session: { user: { email: "u@example.com" }, expires: "" },
      token: { isAdmin: true, isPro: false },
    });

    expect(session.user.isAdmin).toBe(true);
    expect(session.user.isPro).toBe(false);
  });

  it("returns the session unchanged when there is no user", async () => {
    const input = { session: { expires: "" }, token: { isAdmin: true, isPro: true } };

    const session = await capturedConfigHolder.value.callbacks.session(input);

    expect(session).toEqual({ expires: "" });
  });
});
