import { getLeaderboardModels } from "@/lib/leaderboard";

export const runtime = "nodejs";

export async function GET() {
  const { updatedAt, models } = await getLeaderboardModels();
  return Response.json({ updatedAt, models });
}
