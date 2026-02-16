import "server-only";

import { promises as fs } from "fs";
import path from "path";
import {
  MAX_HISTORY_ENTRIES,
  mergeHistoryEntries,
  normalizeHistoryEntries,
  type HistoryEntry,
} from "@/lib/historyStore";

type StudioHistoryDb = {
  users: Record<string, HistoryEntry[]>;
};

const DB_DIR = path.join(process.cwd(), "apps/web/cache");
const DB_FILE = path.join(DB_DIR, "studio-history-db.json");

const EMPTY_DB: StudioHistoryDb = {
  users: {},
};

let writeQueue = Promise.resolve();

async function ensureDbFile() {
  await fs.mkdir(DB_DIR, { recursive: true });
  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify(EMPTY_DB, null, 2), "utf8");
  }
}

async function readDb(): Promise<StudioHistoryDb> {
  await ensureDbFile();
  const raw = await fs.readFile(DB_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as Partial<StudioHistoryDb>;
    const users = parsed.users && typeof parsed.users === "object" ? parsed.users : {};
    return { users: users as Record<string, HistoryEntry[]> };
  } catch {
    return { ...EMPTY_DB };
  }
}

async function writeDb(db: StudioHistoryDb) {
  const tmpPath = `${DB_FILE}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmpPath, DB_FILE);
}

async function withWrite<T>(
  updater: (db: StudioHistoryDb) => Promise<T> | T
): Promise<T> {
  const task = writeQueue.then(async () => {
    const db = await readDb();
    const result = await updater(db);
    await writeDb(db);
    return result;
  });
  writeQueue = task.then(
    () => undefined,
    () => undefined
  );
  return task;
}

export async function getUserHistory(userId: string) {
  const db = await readDb();
  return normalizeHistoryEntries(db.users[userId] ?? []);
}

export async function upsertUserHistoryEntry(userId: string, entry: HistoryEntry) {
  return withWrite(async (db) => {
    const current = normalizeHistoryEntries(db.users[userId] ?? []);
    const next = mergeHistoryEntries([entry], current).slice(0, MAX_HISTORY_ENTRIES);
    db.users[userId] = next;
    return next;
  });
}

export async function mergeUserHistoryEntries(userId: string, entries: HistoryEntry[]) {
  return withWrite(async (db) => {
    const current = normalizeHistoryEntries(db.users[userId] ?? []);
    const incoming = normalizeHistoryEntries(entries);
    const next = mergeHistoryEntries(incoming, current).slice(0, MAX_HISTORY_ENTRIES);
    db.users[userId] = next;
    return next;
  });
}
