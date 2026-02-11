import { NextResponse } from "next/server";
import { listSecurityData } from "@/lib/server/settingsDatabase";
import {
  getSettingsAuthContext,
  settingsServerError,
  settingsUnauthorized,
} from "@/lib/server/settingsApi";

export async function GET() {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();

  try {
    const security = await listSecurityData(ctx.userId);
    if (!security) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json({ connections: security.connections });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load connections.";
    return settingsServerError(message);
  }
}
