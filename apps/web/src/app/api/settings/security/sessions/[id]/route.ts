import { NextResponse } from "next/server";
import { revokeSession } from "@/lib/server/settingsDatabase";
import {
  getSettingsAuthContext,
  settingsServerError,
  settingsUnauthorized,
} from "@/lib/server/settingsApi";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();
  const { id } = await context.params;

  try {
    const ok = await revokeSession(ctx.userId, id);
    if (!ok) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to revoke session.";
    return settingsServerError(message);
  }
}
