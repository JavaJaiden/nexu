import "server-only";

import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import {
  type AssetCategory,
  type AssetComplexity,
  type AssetRecord,
  type AssetScope,
  type AssetType,
  type FavoriteRecord,
  type FileAssetPayload,
  type ModelPresetPayload,
  type ProjectRecord,
} from "@/lib/assets";

const DB_DIR = path.join(process.cwd(), "apps/web/cache");
const DB_FILE = path.join(DB_DIR, "lab-assets-db.json");
const UPLOAD_DIR = path.join(DB_DIR, "lab-uploads");

type DbRecord = {
  projects: ProjectRecord[];
  assets: AssetRecord[];
  favorites: FavoriteRecord[];
};

type AuthContext = {
  userId: string;
  orgId?: string | null;
  orgRole?: string | null;
};

type AssetListFilters = {
  scope: AssetScope;
  type?: AssetType | AssetType[] | "all";
  projectId?: string;
  search?: string;
  category?: AssetCategory | "all";
  complexity?: AssetComplexity | "all";
  sort?: "most_used" | "recent" | "highest_rated";
  ownerOnly?: boolean;
  favoritesOnly?: boolean;
};

type CreateProjectInput = {
  scope: AssetScope;
  name: string;
  description?: string;
};

type UpdateProjectInput = {
  name?: string;
  description?: string;
};

type CreateAssetInput = {
  scope: AssetScope;
  projectId?: string;
  type: AssetType;
  name: string;
  description?: string;
  tags?: string[];
  category?: AssetCategory;
  complexity?: AssetComplexity;
  rating?: number | null;
  useCount?: number;
  payload: Record<string, unknown>;
};

type UpdateAssetInput = {
  name?: string;
  description?: string;
  tags?: string[];
  category?: AssetCategory;
  complexity?: AssetComplexity;
  rating?: number | null;
  useCount?: number;
  payload?: Record<string, unknown>;
  projectId?: string | null;
};

let writeQueue = Promise.resolve();

const EMPTY_DB: DbRecord = {
  projects: [],
  assets: [],
  favorites: [],
};

function isOrgAdmin(role?: string | null) {
  if (!role) return false;
  return role.includes("admin") || role.includes("owner");
}

async function ensureDbFile() {
  await fs.mkdir(DB_DIR, { recursive: true });
  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify(EMPTY_DB, null, 2), "utf8");
  }
}

async function readDb(): Promise<DbRecord> {
  await ensureDbFile();
  const raw = await fs.readFile(DB_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as Partial<DbRecord>;
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      assets: Array.isArray(parsed.assets) ? parsed.assets : [],
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
    };
  } catch {
    return { ...EMPTY_DB };
  }
}

async function writeDb(next: DbRecord) {
  const tmp = `${DB_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(next, null, 2), "utf8");
  await fs.rename(tmp, DB_FILE);
}

function normalizeTags(tags: string[] | undefined) {
  if (!Array.isArray(tags)) return [];
  return Array.from(
    new Set(
      tags
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, 25)
    )
  );
}

function canAccessRecord(scope: AssetScope, ownerId: string, orgId: string | undefined, ctx: AuthContext) {
  if (scope === "private") return ownerId === ctx.userId;
  return Boolean(ctx.orgId && orgId && ctx.orgId === orgId);
}

function canEditRecord(scope: AssetScope, ownerId: string, orgId: string | undefined, ctx: AuthContext) {
  if (scope === "private") return ownerId === ctx.userId;
  if (!ctx.orgId || !orgId || ctx.orgId !== orgId) return false;
  return ownerId === ctx.userId || isOrgAdmin(ctx.orgRole);
}

async function withWrite<T>(updater: (db: DbRecord) => Promise<T> | T): Promise<T> {
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

function assetMatchesSearch(asset: AssetRecord, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  const base = [
    asset.name,
    asset.description ?? "",
    asset.tags.join(" "),
    asset.type,
  ]
    .join(" ")
    .toLowerCase();

  if (base.includes(q)) return true;
  if (asset.type === "file") {
    const payload = asset.payload as Partial<FileAssetPayload>;
    if ((payload.filename ?? "").toLowerCase().includes(q)) return true;
  }
  return false;
}

export function createStorageKey(filename: string) {
  const extension = path.extname(filename).replace(/[^a-zA-Z0-9.]/g, "");
  return `${Date.now()}-${randomUUID()}${extension}`;
}

export async function writeUploadFile(storageKey: string, bytes: Uint8Array) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filePath = path.join(UPLOAD_DIR, storageKey);
  await fs.writeFile(filePath, bytes);
  return filePath;
}

export function getUploadPath(storageKey: string) {
  return path.join(UPLOAD_DIR, storageKey);
}

export async function listProjects(ctx: AuthContext, scope: AssetScope) {
  const db = await readDb();
  const projects = db.projects
    .filter((project) => {
      if (scope === "private") {
        return project.scope === "private" && project.ownerId === ctx.userId;
      }
      if (!ctx.orgId) return false;
      return project.scope === "org" && project.orgId === ctx.orgId;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return projects;
}

export async function createProject(ctx: AuthContext, input: CreateProjectInput) {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Project name is required.");
  }
  if (input.scope === "org" && !ctx.orgId) {
    throw new Error("Organization scope is unavailable for this user.");
  }

  return withWrite(async (db) => {
    const now = new Date().toISOString();
    const project: ProjectRecord = {
      id: randomUUID(),
      scope: input.scope,
      orgId: input.scope === "org" ? ctx.orgId ?? undefined : undefined,
      ownerId: ctx.userId,
      name,
      description: input.description?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    db.projects.unshift(project);
    return project;
  });
}

export async function updateProject(ctx: AuthContext, id: string, input: UpdateProjectInput) {
  return withWrite(async (db) => {
    const index = db.projects.findIndex((project) => project.id === id);
    if (index < 0) return null;
    const current = db.projects[index];
    if (!canEditRecord(current.scope, current.ownerId, current.orgId, ctx)) {
      throw new Error("Forbidden");
    }

    const nextName = input.name?.trim();
    const nextDescription =
      typeof input.description === "string" ? input.description.trim() || undefined : current.description;

    const updated: ProjectRecord = {
      ...current,
      name: nextName || current.name,
      description: nextDescription,
      updatedAt: new Date().toISOString(),
    };
    db.projects[index] = updated;
    return updated;
  });
}

export async function deleteProject(ctx: AuthContext, id: string) {
  return withWrite(async (db) => {
    const project = db.projects.find((entry) => entry.id === id);
    if (!project) return false;
    if (!canEditRecord(project.scope, project.ownerId, project.orgId, ctx)) {
      throw new Error("Forbidden");
    }

    db.projects = db.projects.filter((entry) => entry.id !== id);
    const removedAssetIds = new Set(
      db.assets.filter((asset) => asset.projectId === id).map((asset) => asset.id)
    );
    db.assets = db.assets.filter((asset) => asset.projectId !== id);
    db.favorites = db.favorites.filter((favorite) => !removedAssetIds.has(favorite.assetId));
    return true;
  });
}

function sortAssets(assets: AssetRecord[], sort?: AssetListFilters["sort"]) {
  const sorted = [...assets];
  if (sort === "most_used") {
    sorted.sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0));
    return sorted;
  }
  if (sort === "highest_rated") {
    sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return sorted;
  }
  sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return sorted;
}

export async function listAssets(ctx: AuthContext, filters: AssetListFilters) {
  const db = await readDb();
  const favoriteIds = new Set(
    db.favorites.filter((favorite) => favorite.userId === ctx.userId).map((favorite) => favorite.assetId)
  );

  const normalizedTypes = Array.isArray(filters.type)
    ? filters.type
    : filters.type && filters.type !== "all"
      ? [filters.type]
      : null;
  const search = (filters.search ?? "").trim();

  const assets = db.assets.filter((asset) => {
    if (filters.scope === "private") {
      if (!(asset.scope === "private" && asset.ownerId === ctx.userId)) return false;
    } else {
      if (!ctx.orgId) return false;
      if (!(asset.scope === "org" && asset.orgId === ctx.orgId)) return false;
    }
    if (filters.ownerOnly && asset.ownerId !== ctx.userId) return false;
    if (filters.favoritesOnly && !favoriteIds.has(asset.id)) return false;
    if (normalizedTypes && !normalizedTypes.includes(asset.type)) return false;
    if (filters.projectId && asset.projectId !== filters.projectId) return false;
    if (filters.category && filters.category !== "all" && asset.category !== filters.category) return false;
    if (filters.complexity && filters.complexity !== "all" && asset.complexity !== filters.complexity) {
      return false;
    }
    if (!assetMatchesSearch(asset, search)) return false;
    return true;
  });

  return sortAssets(assets, filters.sort).map((asset) => ({
    ...asset,
    isFavorite: favoriteIds.has(asset.id),
  }));
}

export async function getAssetById(ctx: AuthContext, id: string) {
  const db = await readDb();
  const asset = db.assets.find((entry) => entry.id === id);
  if (!asset) return null;
  if (!canAccessRecord(asset.scope, asset.ownerId, asset.orgId, ctx)) return null;
  const isFavorite = db.favorites.some(
    (favorite) => favorite.userId === ctx.userId && favorite.assetId === id
  );
  return { ...asset, isFavorite };
}

export async function createAsset(ctx: AuthContext, input: CreateAssetInput) {
  if (!input.name.trim()) {
    throw new Error("Asset name is required.");
  }
  if (input.scope === "org" && !ctx.orgId) {
    throw new Error("Organization scope is unavailable for this user.");
  }

  return withWrite(async (db) => {
    if (input.projectId) {
      const project = db.projects.find((entry) => entry.id === input.projectId);
      if (!project) {
        throw new Error("Selected project was not found.");
      }
      if (!canAccessRecord(project.scope, project.ownerId, project.orgId, ctx)) {
        throw new Error("Selected project is not accessible.");
      }
      if (project.scope !== input.scope) {
        throw new Error("Project scope must match asset scope.");
      }
    }

    const now = new Date().toISOString();
    const asset: AssetRecord = {
      id: randomUUID(),
      scope: input.scope,
      orgId: input.scope === "org" ? ctx.orgId ?? undefined : undefined,
      ownerId: ctx.userId,
      projectId: input.projectId,
      type: input.type,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      tags: normalizeTags(input.tags),
      category: input.category ?? null,
      complexity: input.complexity ?? null,
      rating: typeof input.rating === "number" ? input.rating : null,
      useCount: typeof input.useCount === "number" ? input.useCount : 0,
      payload: input.payload,
      createdAt: now,
      updatedAt: now,
    };
    db.assets.unshift(asset);
    return asset;
  });
}

export async function updateAsset(ctx: AuthContext, id: string, input: UpdateAssetInput) {
  return withWrite(async (db) => {
    const index = db.assets.findIndex((entry) => entry.id === id);
    if (index < 0) return null;
    const current = db.assets[index];
    if (!canEditRecord(current.scope, current.ownerId, current.orgId, ctx)) {
      throw new Error("Forbidden");
    }

    let projectId = current.projectId;
    if (typeof input.projectId !== "undefined") {
      if (!input.projectId) {
        projectId = undefined;
      } else {
        const project = db.projects.find((entry) => entry.id === input.projectId);
        if (!project) {
          throw new Error("Selected project was not found.");
        }
        if (!canAccessRecord(project.scope, project.ownerId, project.orgId, ctx)) {
          throw new Error("Selected project is not accessible.");
        }
        if (project.scope !== current.scope) {
          throw new Error("Project scope must match asset scope.");
        }
        projectId = input.projectId;
      }
    }

    const next: AssetRecord = {
      ...current,
      name: typeof input.name === "string" ? input.name.trim() || current.name : current.name,
      description:
        typeof input.description === "string" ? input.description.trim() || undefined : current.description,
      tags: Array.isArray(input.tags) ? normalizeTags(input.tags) : current.tags,
      category: typeof input.category !== "undefined" ? input.category : current.category,
      complexity: typeof input.complexity !== "undefined" ? input.complexity : current.complexity,
      rating: typeof input.rating !== "undefined" ? input.rating : current.rating,
      useCount: typeof input.useCount !== "undefined" ? input.useCount : current.useCount,
      payload: input.payload ?? current.payload,
      projectId,
      updatedAt: new Date().toISOString(),
    };
    db.assets[index] = next;
    return next;
  });
}

export async function deleteAsset(ctx: AuthContext, id: string) {
  return withWrite(async (db) => {
    const asset = db.assets.find((entry) => entry.id === id);
    if (!asset) return false;
    if (!canEditRecord(asset.scope, asset.ownerId, asset.orgId, ctx)) {
      throw new Error("Forbidden");
    }
    db.assets = db.assets.filter((entry) => entry.id !== id);
    db.favorites = db.favorites.filter((favorite) => favorite.assetId !== id);
    return true;
  });
}

export async function setAssetFavorite(ctx: AuthContext, assetId: string, favorite: boolean) {
  return withWrite(async (db) => {
    const asset = db.assets.find((entry) => entry.id === assetId);
    if (!asset) return null;
    if (!canAccessRecord(asset.scope, asset.ownerId, asset.orgId, ctx)) {
      throw new Error("Forbidden");
    }

    const existing = db.favorites.find(
      (entry) => entry.userId === ctx.userId && entry.assetId === assetId
    );
    if (favorite && !existing) {
      db.favorites.push({
        id: randomUUID(),
        userId: ctx.userId,
        assetId,
        createdAt: new Date().toISOString(),
      });
    }
    if (!favorite && existing) {
      db.favorites = db.favorites.filter((entry) => entry.id !== existing.id);
    }

    return favorite;
  });
}

export async function incrementAssetUseCount(ctx: AuthContext, assetId: string) {
  return withWrite(async (db) => {
    const index = db.assets.findIndex((entry) => entry.id === assetId);
    if (index < 0) return null;
    const asset = db.assets[index];
    if (!canAccessRecord(asset.scope, asset.ownerId, asset.orgId, ctx)) return null;
    db.assets[index] = {
      ...asset,
      useCount: (asset.useCount ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    return db.assets[index];
  });
}

export async function getModelPresetAsset(ctx: AuthContext, id: string) {
  const asset = await getAssetById(ctx, id);
  if (!asset) return null;
  if (asset.type !== "model_preset") return null;
  return asset;
}

export function assertValidPresetPayload(value: unknown): ModelPresetPayload {
  if (!value || typeof value !== "object") {
    throw new Error("Preset payload is required.");
  }
  const payload = value as Partial<ModelPresetPayload>;
  if (!Array.isArray(payload.modelIds) || payload.modelIds.length === 0) {
    throw new Error("Model presets require at least one model.");
  }
  const routingMode = payload.routingMode ?? "auto";
  if (!["auto", "single", "multi"].includes(routingMode)) {
    throw new Error("Invalid routing mode.");
  }
  return {
    modelIds: Array.from(
      new Set(payload.modelIds.map((id) => String(id).trim()).filter(Boolean))
    ),
    aggregatorId:
      typeof payload.aggregatorId === "string" && payload.aggregatorId.trim()
        ? payload.aggregatorId.trim()
        : undefined,
    routingMode: routingMode as ModelPresetPayload["routingMode"],
    temperature:
      typeof payload.temperature === "number" && Number.isFinite(payload.temperature)
        ? Math.max(0, Math.min(1, payload.temperature))
        : undefined,
    maxTokens:
      typeof payload.maxTokens === "number" && Number.isFinite(payload.maxTokens)
        ? Math.max(128, Math.min(8192, Math.round(payload.maxTokens)))
        : undefined,
  };
}
