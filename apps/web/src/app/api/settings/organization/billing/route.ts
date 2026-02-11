import { NextResponse } from "next/server";
import {
  addManualCredits,
  createStripeCheckoutSession,
  createStripePortalSession,
  getOrganizationBilling,
  getOrganizationContext,
  updateBillingSettings,
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
  if (
    message.includes("required") ||
    message.includes("configured") ||
    message.includes("Failed to create")
  ) {
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
    const billing = await getOrganizationBilling(ctx.userId, context.organization.id);
    if (!billing) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }
    return NextResponse.json({
      ...billing,
      memberships: context.memberships,
      selectedOrganizationId: context.organization.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load billing.";
    return errorResponse(message);
  }
}

export async function PATCH(req: Request) {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();

  let body: {
    organizationId?: string;
    autoReloadEnabled?: boolean;
    reloadThresholdCents?: number;
    reloadAmountCents?: number;
    monthlyMaxCents?: number;
    billingEmail?: string;
    billingAddress?: string;
    currentPlan?: "free" | "pro" | "enterprise";
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return settingsBadRequest("Invalid billing settings payload.");
  }

  try {
    const context = await getOrganizationContext(
      ctx.userId,
      body.organizationId || parseOrganizationId(req)
    );
    if (!context) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }
    const updated = await updateBillingSettings(ctx.userId, context.organization.id, {
      autoReloadEnabled: body.autoReloadEnabled,
      reloadThresholdCents: body.reloadThresholdCents,
      reloadAmountCents: body.reloadAmountCents,
      monthlyMaxCents: body.monthlyMaxCents,
      billingEmail: body.billingEmail,
      billingAddress: body.billingAddress,
      currentPlan: body.currentPlan,
    });
    if (!updated) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update billing settings.";
    return errorResponse(message);
  }
}

export async function POST(req: Request) {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();

  let body: {
    organizationId?: string;
    action?: "manual_credit" | "stripe_portal" | "stripe_checkout";
    amountCents?: number;
    description?: string;
    priceId?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return settingsBadRequest("Invalid billing action payload.");
  }

  if (!body.action) return settingsBadRequest("action is required.");

  try {
    const context = await getOrganizationContext(
      ctx.userId,
      body.organizationId || parseOrganizationId(req)
    );
    if (!context) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }
    const organizationId = context.organization.id;

    if (body.action === "manual_credit") {
      if (typeof body.amountCents !== "number" || !Number.isFinite(body.amountCents)) {
        return settingsBadRequest("amountCents is required.");
      }
      const creditAccount = await addManualCredits(
        ctx.userId,
        organizationId,
        body.amountCents,
        body.description
      );
      return NextResponse.json({ ok: true, creditAccount });
    }

    if (body.action === "stripe_portal") {
      const url = await createStripePortalSession(ctx.userId, organizationId);
      return NextResponse.json({ ok: true, url });
    }

    if (body.action === "stripe_checkout") {
      if (!body.priceId?.trim()) {
        return settingsBadRequest("priceId is required.");
      }
      const url = await createStripeCheckoutSession(ctx.userId, organizationId, body.priceId.trim());
      return NextResponse.json({ ok: true, url });
    }

    return settingsBadRequest("Unsupported billing action.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Billing action failed.";
    return errorResponse(message);
  }
}
