import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import {
  deleteUserAccount,
  getSettingsOverview,
  updateUserProfile,
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
    const overview = await getSettingsOverview(ctx.userId);
    return NextResponse.json({
      user: overview.user,
      organizations: overview.organizations,
    });
  } catch {
    return settingsServerError("Failed to load profile.");
  }
}

export async function PATCH(req: Request) {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();

  let body: {
    name?: string;
    phone?: string;
    avatarUrl?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return settingsBadRequest("Invalid profile payload.");
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    return settingsBadRequest("Name is required.");
  }

  try {
    const user = await updateUserProfile(ctx.userId, {
      name: body.name,
      phone: body.phone,
      avatarUrl: body.avatarUrl,
    });
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile.";
    return settingsServerError(message);
  }
}

export async function DELETE(req: Request) {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();

  let body: { confirmation?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return settingsBadRequest("Invalid delete profile payload.");
  }

  if (body.confirmation !== "DELETE") {
    return settingsBadRequest('Type "DELETE" to confirm account deletion.');
  }

  try {
    const client = await clerkClient();
    await client.users.deleteUser(ctx.userId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete auth account.";
    return settingsServerError(message);
  }

  try {
    const deleted = await deleteUserAccount(ctx.userId);
    if (!deleted) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete profile.";
    return settingsServerError(message);
  }
}
