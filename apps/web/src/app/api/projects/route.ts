import { NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/server/labDatabase";
import {
  badRequest,
  getApiAuthContext,
  parseScope,
  serverError,
  unauthorized,
} from "@/lib/server/labApi";

export async function GET(req: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) return unauthorized();

  const { searchParams } = new URL(req.url);
  const scope = parseScope(searchParams.get("scope"));

  try {
    const projects = await listProjects(ctx, scope);
    return NextResponse.json({
      projects,
      organizationEnabled: Boolean(ctx.orgId),
    });
  } catch {
    return serverError("Failed to load projects.");
  }
}

export async function POST(req: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) return unauthorized();

  let body: { name?: string; scope?: string; description?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return badRequest("Invalid project payload.");
  }

  if (!body?.name || !body.name.trim()) {
    return badRequest("Project name is required.");
  }

  const scope = parseScope(body.scope ?? "private");

  try {
    const project = await createProject(ctx, {
      name: body.name,
      scope,
      description: body.description,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create project.";
    if (message.includes("unavailable")) return badRequest(message);
    return serverError(message);
  }
}
