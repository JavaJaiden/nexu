import { NextResponse } from "next/server";
import {
  getOrganizationContext,
  inviteOrganizationMember,
  listOrganizationMembers,
  removeOrganizationMember,
  updateOrganizationMemberRole,
} from "@/lib/server/settingsDatabase";
import {
  getSettingsAuthContext,
  settingsBadRequest,
  settingsServerError,
  settingsUnauthorized,
} from "@/lib/server/settingsApi";

function parseOrganizationId(req: Request) {
  const url = new URL(req.url);
  return url.searchParams.get("organizationId") ?? undefined;
}

function errorResponse(message: string) {
  if (message === "Forbidden") {
    return NextResponse.json({ error: message }, { status: 403 });
  }
  if (message.includes("required") || message.includes("pending") || message.includes("already")) {
    return settingsBadRequest(message);
  }
  return settingsServerError(message);
}

export async function GET(req: Request) {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();

  try {
    const context = await getOrganizationContext(ctx.userId, parseOrganizationId(req));
    if (!context) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }
    const data = await listOrganizationMembers(ctx.userId, context.organization.id);
    return NextResponse.json({
      organization: context.organization,
      role: data.role,
      memberships: context.memberships,
      selectedOrganizationId: context.organization.id,
      members: data.members,
      invitations: data.invitations,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load members.";
    return errorResponse(message);
  }
}

export async function POST(req: Request) {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();

  let body: {
    organizationId?: string;
    email?: string;
    role?: "admin" | "member";
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return settingsBadRequest("Invalid member invitation payload.");
  }

  if (!body.email) return settingsBadRequest("Email is required.");
  if (body.role !== "admin" && body.role !== "member") {
    return settingsBadRequest("Role must be admin or member.");
  }

  try {
    const context = await getOrganizationContext(
      ctx.userId,
      body.organizationId || parseOrganizationId(req)
    );
    if (!context) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }
    const result = await inviteOrganizationMember(ctx.userId, context.organization.id, {
      email: body.email,
      role: body.role,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to invite member.";
    return errorResponse(message);
  }
}

export async function PATCH(req: Request) {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();

  let body: {
    organizationId?: string;
    memberUserId?: string;
    role?: "admin" | "member";
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return settingsBadRequest("Invalid member role payload.");
  }

  if (!body.memberUserId) return settingsBadRequest("memberUserId is required.");
  if (body.role !== "admin" && body.role !== "member") {
    return settingsBadRequest("Role must be admin or member.");
  }

  try {
    const context = await getOrganizationContext(
      ctx.userId,
      body.organizationId || parseOrganizationId(req)
    );
    if (!context) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }
    const member = await updateOrganizationMemberRole(
      ctx.userId,
      context.organization.id,
      body.memberUserId,
      body.role
    );
    if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    return NextResponse.json({ ok: true, member });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update member role.";
    return errorResponse(message);
  }
}

export async function DELETE(req: Request) {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();

  const url = new URL(req.url);
  const memberUserId = url.searchParams.get("memberUserId");
  const organizationId = url.searchParams.get("organizationId") ?? undefined;
  if (!memberUserId) return settingsBadRequest("memberUserId is required.");

  try {
    const context = await getOrganizationContext(ctx.userId, organizationId);
    if (!context) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }
    const ok = await removeOrganizationMember(ctx.userId, context.organization.id, memberUserId);
    if (!ok) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove member.";
    return errorResponse(message);
  }
}
