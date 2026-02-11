import { NextResponse } from "next/server";
import { revokeApiKey } from "@/lib/server/settingsDatabase";
import {
  getSettingsAuthContext,
  settingsBadRequest,
  settingsServerError,
  settingsUnauthorized,
} from "@/lib/server/settingsApi";

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();

  const { id } = await context.params;
  const url = new URL(req.url);
  const organizationId = url.searchParams.get("organizationId");
  if (!organizationId) return settingsBadRequest("organizationId is required.");

  try {
    const ok = await revokeApiKey(ctx.userId, organizationId, id);
    if (!ok) return NextResponse.json({ error: "API key not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to revoke API key.";
    if (message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return settingsServerError(message);
  }
}
