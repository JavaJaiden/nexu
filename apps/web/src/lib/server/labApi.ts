import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { AssetScope } from "@/lib/assets";

export type ApiAuthContext = {
  userId: string;
  orgId?: string | null;
  orgRole?: string | null;
};

export function parseScope(scope: string | null): AssetScope {
  return scope === "org" ? "org" : "private";
}

export async function getApiAuthContext() {
  const state = await auth();
  if (!state.userId) return null;
  const ctx: ApiAuthContext = {
    userId: state.userId,
    orgId: state.orgId,
    orgRole: state.orgRole,
  };
  return ctx;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function serverError(message = "Unexpected server error") {
  return NextResponse.json({ error: message }, { status: 500 });
}
