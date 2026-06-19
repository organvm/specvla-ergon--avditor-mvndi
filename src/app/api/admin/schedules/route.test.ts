import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  getConfig: vi.fn(() => null),
}));

vi.mock("@/lib/db", () => ({
  getScheduledAudits: vi.fn(),
  saveScheduledAudit: vi.fn(),
  updateScheduledAudit: vi.fn(),
  deleteScheduledAudit: vi.fn(),
}));

import { GET, POST, DELETE, PATCH } from "./route";
import { auth } from "@/auth";
import {
  getScheduledAudits,
  saveScheduledAudit,
  updateScheduledAudit,
  deleteScheduledAudit,
} from "@/lib/db";

const mockAuth = vi.mocked(auth);
const mockGetScheduledAudits = vi.mocked(getScheduledAudits);
const mockSaveScheduledAudit = vi.mocked(saveScheduledAudit);
const mockUpdateScheduledAudit = vi.mocked(updateScheduledAudit);
const mockDeleteScheduledAudit = vi.mocked(deleteScheduledAudit);

const URL_BASE = "http://localhost:3000/api/admin/schedules";

function makeRequest(method: string, search = "", body?: unknown): Request {
  return new Request(`${URL_BASE}${search}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function asAdmin() {
  mockAuth.mockResolvedValue({
    user: { email: "admin@growthauditor.ai", name: "Admin" },
    expires: "",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

function asUser() {
  mockAuth.mockResolvedValue({
    user: { email: "nobody@example.com", name: "Nobody" },
    expires: "",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// Shared admin-gate behaviour across every handler.
describe.each([
  ["GET", () => GET(makeRequest("GET"))],
  ["POST", () => POST(makeRequest("POST", "", { userEmail: "a", link: "b", businessType: "c", goals: "d" }))],
  ["DELETE", () => DELETE(makeRequest("DELETE", "?id=s1"))],
  ["PATCH", () => PATCH(makeRequest("PATCH", "?id=s1", { enabled: false }))],
])("auth gate for %s", (_name, call) => {
  it("returns 401 when not authenticated", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAuth.mockResolvedValue(null as any);

    const res = await call();
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 403 when the user is not an admin", async () => {
    asUser();

    const res = await call();
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("Admin access required");
  });
});

describe("GET /api/admin/schedules", () => {
  it("returns all schedules for an admin", async () => {
    asAdmin();
    const schedules = [{ id: "s1" }, { id: "s2" }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetScheduledAudits.mockResolvedValue(schedules as any);

    const res = await GET(makeRequest("GET"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.schedules).toEqual(schedules);
    expect(mockGetScheduledAudits).toHaveBeenCalledWith(undefined);
  });

  it("forwards the userEmail filter from the query string", async () => {
    asAdmin();
    mockGetScheduledAudits.mockResolvedValue([]);

    await GET(makeRequest("GET", "?userEmail=user%40example.com"));

    expect(mockGetScheduledAudits).toHaveBeenCalledWith("user@example.com");
  });

  it("returns 500 when the db throws", async () => {
    asAdmin();
    mockGetScheduledAudits.mockRejectedValue(new Error("db down"));

    const res = await GET(makeRequest("GET"));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});

describe("POST /api/admin/schedules", () => {
  it("returns 400 when required fields are missing", async () => {
    asAdmin();

    const res = await POST(makeRequest("POST", "", { userEmail: "u@example.com" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Missing required fields");
    expect(mockSaveScheduledAudit).not.toHaveBeenCalled();
  });

  it("saves a schedule and returns its id, defaulting frequency to monthly", async () => {
    asAdmin();
    mockSaveScheduledAudit.mockResolvedValue("sched-123");

    const res = await POST(
      makeRequest("POST", "", {
        userEmail: "user@example.com",
        link: "https://example.com",
        businessType: "SaaS",
        goals: "grow",
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.id).toBe("sched-123");
    expect(mockSaveScheduledAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: "user@example.com",
        link: "https://example.com",
        businessType: "SaaS",
        goals: "grow",
        frequency: "monthly",
        enabled: true,
      })
    );
  });

  it("honours an explicit frequency", async () => {
    asAdmin();
    mockSaveScheduledAudit.mockResolvedValue("sched-w");

    await POST(
      makeRequest("POST", "", {
        userEmail: "user@example.com",
        link: "https://example.com",
        businessType: "SaaS",
        goals: "grow",
        frequency: "weekly",
      })
    );

    expect(mockSaveScheduledAudit).toHaveBeenCalledWith(
      expect.objectContaining({ frequency: "weekly" })
    );
  });
});

describe("DELETE /api/admin/schedules", () => {
  it("returns 400 when id query param is missing", async () => {
    asAdmin();

    const res = await DELETE(makeRequest("DELETE"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("id query param required");
    expect(mockDeleteScheduledAudit).not.toHaveBeenCalled();
  });

  it("deletes the schedule by id", async () => {
    asAdmin();
    mockDeleteScheduledAudit.mockResolvedValue(undefined);

    const res = await DELETE(makeRequest("DELETE", "?id=sched-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDeleteScheduledAudit).toHaveBeenCalledWith("sched-1");
  });
});

describe("PATCH /api/admin/schedules", () => {
  it("returns 400 when id query param is missing", async () => {
    asAdmin();

    const res = await PATCH(makeRequest("PATCH", "", { enabled: false }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("id query param required");
    expect(mockUpdateScheduledAudit).not.toHaveBeenCalled();
  });

  it("applies the update for the given id", async () => {
    asAdmin();
    mockUpdateScheduledAudit.mockResolvedValue(undefined);

    const res = await PATCH(makeRequest("PATCH", "?id=sched-1", { enabled: false }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUpdateScheduledAudit).toHaveBeenCalledWith("sched-1", { enabled: false });
  });
});
