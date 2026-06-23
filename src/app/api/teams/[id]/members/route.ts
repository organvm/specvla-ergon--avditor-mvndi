import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addTeamMember, getTeamMembers } from "@/lib/db";
import { getEffectivePlan, getEntitlements } from "@/lib/plans";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const members = await getTeamMembers(id);
    // Verify user is a member of this team
    const isMember = members.some(m => m.email === session.user?.email);
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(members);
  } catch (error: unknown) {
    console.error("GET Team Members Error:", error);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, role = "member" } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const members = await getTeamMembers(id);
    const isOwnerOrAdmin = members.some(m => m.email === session.user?.email && (m.role === "owner" || m.role === "admin"));
    if (!isOwnerOrAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const plan = getEffectivePlan(session.user.plan, {
      isAdmin: session.user.isAdmin,
      isPro: session.user.isPro,
      isPremium: session.user.isPremium,
    });
    const { teamSeats } = getEntitlements(plan);
    if (!session.user.isAdmin && members.length >= teamSeats) {
      return NextResponse.json({ error: `Team seat limit reached for your current plan (${teamSeats})` }, { status: 403 });
    }

    await addTeamMember(id, email, role);
    return NextResponse.json({ message: "Member added successfully" });
  } catch (error: unknown) {
    console.error("POST Team Member Error:", error);
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }
}
