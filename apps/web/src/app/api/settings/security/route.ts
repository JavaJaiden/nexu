import { NextResponse } from "next/server";
import {
  changePassword,
  listSecurityData,
  setMfaEnabled,
} from "@/lib/server/settingsDatabase";
import {
  getSettingsAuthContext,
  settingsBadRequest,
  settingsServerError,
  settingsUnauthorized,
} from "@/lib/server/settingsApi";

export async function GET() {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();

  try {
    const security = await listSecurityData(ctx.userId);
    if (!security) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json(security);
  } catch {
    return settingsServerError("Failed to load security settings.");
  }
}

export async function PATCH(req: Request) {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();

  let body: {
    currentPassword?: string;
    newPassword?: string;
    mfaEnabled?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return settingsBadRequest("Invalid security payload.");
  }

  try {
    if (typeof body.mfaEnabled === "boolean") {
      const enabled = await setMfaEnabled(ctx.userId, body.mfaEnabled);
      if (enabled === null) return NextResponse.json({ error: "User not found." }, { status: 404 });
      return NextResponse.json({ ok: true, mfaEnabled: enabled });
    }

    if (body.newPassword) {
      await changePassword(ctx.userId, body.currentPassword ?? "", body.newPassword);
      return NextResponse.json({ ok: true });
    }

    return settingsBadRequest("No security updates provided.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update security settings.";
    if (message.includes("password") || message.includes("required")) {
      return settingsBadRequest(message);
    }
    return settingsServerError(message);
  }
}
