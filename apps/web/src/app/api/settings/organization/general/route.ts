import { NextResponse } from "next/server";
import {
  deleteOrganization,
  getOrganizationContext,
  updateOrganizationGeneral,
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
  if (message.includes("required") || message.includes("exists") || message.includes("invalid")) {
    return settingsBadRequest(message);
  }
  return settingsServerError(message);
}

export async function GET(req: Request) {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();

  try {
    const organizationId = parseOrganizationId(req);
    const context = await getOrganizationContext(ctx.userId, organizationId);
    if (!context) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }
    return NextResponse.json({
      organization: context.organization,
      role: context.role,
      memberships: context.memberships,
      selectedOrganizationId: context.organization.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load organization settings.";
    return errorResponse(message);
  }
}

export async function PATCH(req: Request) {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();

  let body: {
    organizationId?: string;
    name?: string;
    slug?: string;
    logoUrl?: string;
    address?: string;
    website?: string;
    socialLinks?: string[];
    billingEmail?: string;
    billingAddress?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return settingsBadRequest("Invalid organization settings payload.");
  }

  try {
    const context = await getOrganizationContext(
      ctx.userId,
      body.organizationId || parseOrganizationId(req)
    );
    if (!context) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }
    const organization = await updateOrganizationGeneral(ctx.userId, context.organization.id, {
      name: body.name,
      slug: body.slug,
      logoUrl: body.logoUrl,
      address: body.address,
      website: body.website,
      socialLinks: body.socialLinks,
      billingEmail: body.billingEmail,
      billingAddress: body.billingAddress,
    });
    if (!organization) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }
    return NextResponse.json({ organization });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update organization settings.";
    return errorResponse(message);
  }
}

export async function DELETE(req: Request) {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();

  const organizationId = parseOrganizationId(req);
  if (!organizationId) {
    return settingsBadRequest("organizationId is required.");
  }

  try {
    await deleteOrganization(ctx.userId, organizationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete organization.";
    return errorResponse(message);
  }
}
