import { NextResponse } from "next/server";
import { changeUserEmail } from "@/lib/server/settingsDatabase";
import {
  getSettingsAuthContext,
  settingsBadRequest,
  settingsServerError,
  settingsUnauthorized,
} from "@/lib/server/settingsApi";

export async function POST(req: Request) {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();

  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return settingsBadRequest("Invalid email change payload.");
  }

  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? "";
  if (!email) return settingsBadRequest("New email is required.");
  if (!password) return settingsBadRequest("Password confirmation is required.");

  try {
    const user = await changeUserEmail(ctx.userId, email, password);
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to change email.";
    if (
      message.includes("incorrect") ||
      message.includes("required") ||
      message.includes("already")
    ) {
      return settingsBadRequest(message);
    }
    return settingsServerError(message);
  }
}
