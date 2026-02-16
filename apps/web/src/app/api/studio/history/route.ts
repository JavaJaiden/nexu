import { NextResponse } from "next/server";
import {
  getSettingsAuthContext,
  settingsBadRequest,
  settingsServerError,
  settingsUnauthorized,
} from "@/lib/server/settingsApi";
import {
  getUserHistory,
  mergeUserHistoryEntries,
  upsertUserHistoryEntry,
} from "@/lib/server/studioHistoryDatabase";
import { normalizeHistoryEntries, type HistoryEntry } from "@/lib/historyStore";

export async function GET() {
  try {
    const ctx = await getSettingsAuthContext();
    if (!ctx) return settingsUnauthorized();
    const entries = await getUserHistory(ctx.userId);
    return NextResponse.json({ entries });
  } catch {
    return settingsServerError("Failed to load studio history");
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getSettingsAuthContext();
    if (!ctx) return settingsUnauthorized();

    const payload = (await req.json()) as {
      entry?: HistoryEntry;
      entries?: HistoryEntry[];
    };

    if (payload.entry) {
      const entries = await upsertUserHistoryEntry(ctx.userId, payload.entry);
      return NextResponse.json({ entries });
    }

    if (Array.isArray(payload.entries)) {
      const normalized = normalizeHistoryEntries(payload.entries);
      const entries = await mergeUserHistoryEntries(ctx.userId, normalized);
      return NextResponse.json({ entries });
    }

    return settingsBadRequest("Expected entry or entries in request body.");
  } catch {
    return settingsServerError("Failed to persist studio history");
  }
}
