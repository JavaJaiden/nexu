import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "openrouter leaderboard ingest",
  { hours: 6 },
  internal.leaderboardModels.ingestOpenRouterModels,
  {
    trigger: "cron",
  }
);

export default crons;
