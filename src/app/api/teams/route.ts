import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createTeam, getTeamsByEmail } from "@/lib/db";
import { getEffectivePlan, getEntitlements } from "@/lib/plans";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teams = await getTeamsByEmail(session.user.email);
    return NextResponse.json(teams);
  } catch (error: unknown) {
    console.error("GET Teams Error:", error);
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const plan = getEffectivePlan(session.user.plan, {
      isAdmin: session.user.isAdmin,
      isPro: session.user.isPro,
      isPremium: session.user.isPremium,
    });
    if (!session.user.isAdmin && getEntitlements(plan).teamSeats < 2) {
      return NextResponse.json({ error: "A paid plan is required for team collaboration" }, { status: 403 });
    }

    const { name } = await request.json();
    if (!name) {
      return NextResponse.json({ error: "Team name is required" }, { status: 400 });
    }

    const team = await createTeam(name, session.user.email);
    return NextResponse.json(team);
  } catch (error: unknown) {
    console.error("POST Team Error:", error);
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }
}
