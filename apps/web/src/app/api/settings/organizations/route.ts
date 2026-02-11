import { NextResponse } from "next/server";
import {
  createOrganization,
  inviteOrganizationMember,
  listOrganizationsForUser,
} from "@/lib/server/settingsDatabase";
import {
  getSettingsAuthContext,
  settingsBadRequest,
  settingsServerError,
  settingsUnauthorized,
} from "@/lib/server/settingsApi";

function normalizeInvites(invites: unknown) {
  if (!Array.isArray(invites)) return [];
  return Array.from(
    new Set(
      invites
        .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
        .filter(Boolean)
    )
  );
}

export async function GET() {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();

  try {
    const organizations = await listOrganizationsForUser(ctx.userId);
    return NextResponse.json({ organizations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load organizations.";
    return settingsServerError(message);
  }
}

export async function POST(req: Request) {
  const ctx = await getSettingsAuthContext();
  if (!ctx) return settingsUnauthorized();

  let body: {
    name?: string;
    slug?: string;
    logoUrl?: string;
    invites?: string[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return settingsBadRequest("Invalid organization payload.");
  }

  if (!body.name?.trim()) {
    return settingsBadRequest("Organization name is required.");
  }

  try {
    const organization = await createOrganization(ctx.userId, {
      name: body.name,
      slug: body.slug,
      logoUrl: body.logoUrl,
    });

    const invites = normalizeInvites(body.invites);
    const invited: string[] = [];
    const failed: Array<{ email: string; reason: string }> = [];

    for (const email of invites) {
      try {
        await inviteOrganizationMember(ctx.userId, organization.id, {
          email,
          role: "member",
        });
        invited.push(email);
      } catch (error) {
        failed.push({
          email,
          reason: error instanceof Error ? error.message : "Failed to invite member.",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      organization,
      invites: {
        attempted: invites.length,
        invited,
        failed,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create organization.";
    if (message.includes("required") || message.includes("exists")) {
      return settingsBadRequest(message);
    }
    return settingsServerError(message);
  }
}
