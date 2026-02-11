import { NextResponse } from "next/server";
import { deleteProject, updateProject } from "@/lib/server/labDatabase";
import {
  badRequest,
  forbidden,
  getApiAuthContext,
  serverError,
  unauthorized,
} from "@/lib/server/labApi";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const ctx = await getApiAuthContext();
  if (!ctx) return unauthorized();
  const { id } = await context.params;

  let body: { name?: string; description?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return badRequest("Invalid project update payload.");
  }

  try {
    const project = await updateProject(ctx, id, {
      name: body?.name,
      description: body?.description,
    });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json({ project });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update project.";
    if (message === "Forbidden") return forbidden();
    return serverError(message);
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const ctx = await getApiAuthContext();
  if (!ctx) return unauthorized();
  const { id } = await context.params;

  try {
    const deleted = await deleteProject(ctx, id);
    if (!deleted) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete project.";
    if (message === "Forbidden") return forbidden();
    return serverError(message);
  }
}
