import { NextResponse } from "next/server";
import {
  getNotificationSettings,
  updateNotificationSettings,
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
    const settings = await getNotificationSettings(ctx.userId);
    return NextResponse.json({ settings });
  } catch {
    return settingsServerError("Failed to load notification settings.");
  }
}

export async function PATCH(req: Request) {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return settingsBadRequest("Invalid notification settings payload.");
  }

  try {
    const settings = await updateNotificationSettings(ctx.userId, {
      contacts: typeof body.contacts === "boolean" ? body.contacts : undefined,
      inbox: typeof body.inbox === "boolean" ? body.inbox : undefined,
      weeklySummary: typeof body.weeklySummary === "boolean" ? body.weeklySummary : undefined,
      securityEmails: typeof body.securityEmails === "boolean" ? body.securityEmails : undefined,
      usageAt90: typeof body.usageAt90 === "boolean" ? body.usageAt90 : undefined,
      usageExceeded: typeof body.usageExceeded === "boolean" ? body.usageExceeded : undefined,
      newsletter: typeof body.newsletter === "boolean" ? body.newsletter : undefined,
      productUpdates: typeof body.productUpdates === "boolean" ? body.productUpdates : undefined,
      transactionalEmails:
        typeof body.transactionalEmails === "boolean" ? body.transactionalEmails : undefined,
      billingAlerts: typeof body.billingAlerts === "boolean" ? body.billingAlerts : undefined,
      marketingNewsletter:
        typeof body.marketingNewsletter === "boolean" ? body.marketingNewsletter : undefined,
    });
    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save notification settings.";
    return settingsServerError(message);
  }
}
