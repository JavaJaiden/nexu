import { NextResponse } from "next/server";
import {
  createApiKey,
  getOrganizationContext,
  listApiKeys,
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
  if (message.includes("required")) {
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
    const data = await listApiKeys(ctx.userId, context.organization.id);
    return NextResponse.json({
      organization: context.organization,
      memberships: context.memberships,
      selectedOrganizationId: context.organization.id,
      ...data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load API keys.";
    return errorResponse(message);
  }
}

export async function POST(req: Request) {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();

  let body: {
    organizationId?: string;
    name?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return settingsBadRequest("Invalid API key payload.");
  }

  if (!body.name?.trim()) return settingsBadRequest("API key name is required.");

  try {
    const context = await getOrganizationContext(
      ctx.userId,
      body.organizationId || parseOrganizationId(req)
    );
    if (!context) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }
    const created = await createApiKey(ctx.userId, context.organization.id, body.name);
    return NextResponse.json({ ok: true, ...created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create API key.";
    return errorResponse(message);
  }
}
