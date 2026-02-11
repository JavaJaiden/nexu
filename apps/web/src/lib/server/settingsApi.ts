import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ensureUserFromClerk } from "@/lib/server/settingsDatabase";

export type SettingsAuthContext = {
  userId: string;
};

export async function getSettingsAuthContext() {
  const state = await auth();
  if (!state.userId) return null;
  const clerkUser = await currentUser();
  await ensureUserFromClerk(state.userId, clerkUser);
  const ctx: SettingsAuthContext = {
    userId: state.userId,
  };
  return ctx;
}

export function settingsUnauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function settingsBadRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function settingsServerError(message = "Settings request failed") {
  return NextResponse.json({ error: message }, { status: 500 });
}
