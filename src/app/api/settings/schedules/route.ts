import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getScheduledAudits,
  getScheduledAuditById,
  saveScheduledAudit,
  updateScheduledAudit,
  deleteScheduledAudit,
  getTeamMembers,
} from "@/lib/db";
import { ScheduleSchema } from "@/lib/schemas";
import { getEffectivePlan, getEntitlements } from "@/lib/plans";

async function canAccessSchedule(id: string, userEmail: string) {
  const schedule = await getScheduledAuditById(id);
  if (!schedule) return false;
  if (schedule.userEmail === userEmail) return true;
  if (schedule.teamId) {
    const members = await getTeamMembers(schedule.teamId);
    return members.some((m) => m.email === userEmail);
  }
  return false;
}

function canUseScheduledAudits(session: Awaited<ReturnType<typeof auth>>): boolean {
  if (!session?.user) return false;
  const plan = getEffectivePlan(session.user.plan, {
    isAdmin: session.user.isAdmin,
    isPro: session.user.isPro,
    isPremium: session.user.isPremium,
  });
  return getEntitlements(plan).scheduledAudits;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canUseScheduledAudits(session)) {
      return NextResponse.json({ error: "Pro subscription required for scheduled audits" }, { status: 403 });
    }

    const schedules = await getScheduledAudits(session.user.email);
    return NextResponse.json(schedules);
  } catch (error: unknown) {
    console.error("GET Schedules Error:", error);
    return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canUseScheduledAudits(session)) {
      return NextResponse.json({ error: "Pro subscription required for scheduled audits" }, { status: 403 });
    }

    const body = await request.json();
    const validation = ScheduleSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid schedule data.", details: validation.error.format() }, { status: 400 });
    }

    const { link, businessType, goals, frequency, teamId } = validation.data;

    const id = await saveScheduledAudit({
      userEmail: session.user.email,
      teamId: teamId || undefined,
      link,
      businessType,
      goals,
      frequency,
      enabled: true,
    });

    return NextResponse.json({ id, message: "Schedule created successfully" });
  } catch (error: unknown) {
    console.error("POST Schedule Error:", error);
    return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canUseScheduledAudits(session)) {
      return NextResponse.json({ error: "Pro subscription required" }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing schedule ID" }, { status: 400 });
    }

    if (!(await canAccessSchedule(id, session.user.email))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await updateScheduledAudit(id, updates);
    return NextResponse.json({ message: "Schedule updated successfully" });
  } catch (error: unknown) {
    console.error("PUT Schedule Error:", error);
    return NextResponse.json({ error: "Failed to update schedule" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canUseScheduledAudits(session)) {
      return NextResponse.json({ error: "Pro subscription required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing schedule ID" }, { status: 400 });
    }

    if (!(await canAccessSchedule(id, session.user.email))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteScheduledAudit(id);
    return NextResponse.json({ message: "Schedule deleted successfully" });
  } catch (error: unknown) {
    console.error("DELETE Schedule Error:", error);
    return NextResponse.json({ error: "Failed to delete schedule" }, { status: 500 });
  }
}
