import "server-only";

import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { User } from "@clerk/nextjs/server";
import type {
  ApiKeyRecord,
  CreditAccountRecord,
  MemberRole,
  NotificationSettingsRecord,
  OrganizationInvitationRecord,
  OrganizationMemberRecord,
  OrganizationRecord,
  TransactionRecord,
  UserConnectionRecord,
  UserOpenRouterKeyRecord,
  UserRecord,
  UserSessionRecord,
} from "@/lib/settingsTypes";

type SettingsDb = {
  users: UserRecord[];
  organizations: OrganizationRecord[];
  organizationMembers: OrganizationMemberRecord[];
  notificationSettings: NotificationSettingsRecord[];
  apiKeys: ApiKeyRecord[];
  creditAccounts: CreditAccountRecord[];
  transactions: TransactionRecord[];
  invitations: OrganizationInvitationRecord[];
  sessions: UserSessionRecord[];
  connections: UserConnectionRecord[];
  openRouterKeys: UserOpenRouterKeyRecord[];
};

type StripeChargeResult = {
  paymentIntentId?: string;
  amountCents: number;
};

const DB_DIR = path.join(process.cwd(), "apps/web/cache");
const DB_FILE = path.join(DB_DIR, "settings-db.json");
const UPLOAD_DIR = path.join(DB_DIR, "settings-uploads");
const OPENROUTER_KEYS_URL = "https://openrouter.ai/api/v1/keys";

const DEFAULT_OPENROUTER_DAILY_REQUEST_LIMIT = 200;
const DEFAULT_OPENROUTER_CREDIT_LIMIT = 10;

function normalizeDailyRequestLimit(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0)
    return DEFAULT_OPENROUTER_DAILY_REQUEST_LIMIT;
  return parsed;
}

function normalizeCreditLimit(value: string | undefined) {
  const parsed = Number.parseFloat(value ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0)
    return DEFAULT_OPENROUTER_CREDIT_LIMIT;
  return parsed;
}

const OPENROUTER_DAILY_REQUEST_LIMIT = normalizeDailyRequestLimit(
  process.env.OPENROUTER_USER_DAILY_REQUEST_LIMIT
);
const OPENROUTER_CREDIT_LIMIT = normalizeCreditLimit(
  process.env.OPENROUTER_USER_CREDIT_LIMIT
);

const EMPTY_DB: SettingsDb = {
  users: [],
  organizations: [],
  organizationMembers: [],
  notificationSettings: [],
  apiKeys: [],
  creditAccounts: [],
  transactions: [],
  invitations: [],
  sessions: [],
  connections: [],
  openRouterKeys: [],
};

let writeQueue = Promise.resolve();

function isAdminRole(role: MemberRole) {
  return role === "owner" || role === "admin";
}

function asSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function nowIso() {
  return new Date().toISOString();
}

function currentDateKey() {
  return nowIso().slice(0, 10);
}

function getDefaultNotificationSettings(
  userId: string
): NotificationSettingsRecord {
  const now = nowIso();
  return {
    userId,
    contacts: true,
    inbox: true,
    weeklySummary: true,
    securityEmails: true,
    usageAt90: true,
    usageExceeded: true,
    newsletter: false,
    productUpdates: true,
    createdAt: now,
    updatedAt: now,
  };
}

type LegacyNotificationSettings = Partial<NotificationSettingsRecord> & {
  transactionalEmails?: boolean;
  billingAlerts?: boolean;
  marketingNewsletter?: boolean;
};

function normalizeNotificationSettings(
  userId: string,
  input?: LegacyNotificationSettings | null
): NotificationSettingsRecord {
  const defaults = getDefaultNotificationSettings(userId);
  return {
    userId,
    contacts:
      typeof input?.contacts === "boolean"
        ? input.contacts
        : typeof input?.transactionalEmails === "boolean"
          ? input.transactionalEmails
          : defaults.contacts,
    inbox:
      typeof input?.inbox === "boolean"
        ? input.inbox
        : typeof input?.transactionalEmails === "boolean"
          ? input.transactionalEmails
          : defaults.inbox,
    weeklySummary:
      typeof input?.weeklySummary === "boolean"
        ? input.weeklySummary
        : defaults.weeklySummary,
    securityEmails:
      typeof input?.securityEmails === "boolean"
        ? input.securityEmails
        : defaults.securityEmails,
    usageAt90:
      typeof input?.usageAt90 === "boolean"
        ? input.usageAt90
        : typeof input?.billingAlerts === "boolean"
          ? input.billingAlerts
          : defaults.usageAt90,
    usageExceeded:
      typeof input?.usageExceeded === "boolean"
        ? input.usageExceeded
        : typeof input?.billingAlerts === "boolean"
          ? input.billingAlerts
          : defaults.usageExceeded,
    newsletter:
      typeof input?.newsletter === "boolean"
        ? input.newsletter
        : typeof input?.marketingNewsletter === "boolean"
          ? input.marketingNewsletter
          : defaults.newsletter,
    productUpdates:
      typeof input?.productUpdates === "boolean"
        ? input.productUpdates
        : defaults.productUpdates,
    createdAt:
      typeof input?.createdAt === "string" && input.createdAt
        ? input.createdAt
        : defaults.createdAt,
    updatedAt:
      typeof input?.updatedAt === "string" && input.updatedAt
        ? input.updatedAt
        : defaults.updatedAt,
  };
}

function getDefaultCreditAccount(organizationId: string): CreditAccountRecord {
  const now = nowIso();
  return {
    organizationId,
    balanceCents: 0,
    autoReloadEnabled: false,
    reloadThresholdCents: 1000,
    reloadAmountCents: 5000,
    monthlyMaxCents: 50000,
    createdAt: now,
    updatedAt: now,
  };
}

function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password: string, encoded: string) {
  const [algo, saltHex, hashHex] = encoded.split(":");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const derived = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const original = Buffer.from(hashHex, "hex");
  if (derived.length !== original.length) return false;
  return timingSafeEqual(derived, original);
}

function generateApiKeySecret() {
  const raw = randomBytes(24).toString("base64url");
  return `nxs_${raw}`;
}

function hashApiKey(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function getApiKeyPrefix(secret: string) {
  return secret.slice(0, 12);
}

type OpenRouterCreateKeyResponse = {
  key?: string;
  data?: {
    hash?: string;
    name?: string;
    limit?: number | null;
    limit_remaining?: number | null;
    limit_reset?: "daily" | "weekly" | "monthly" | null;
    disabled?: boolean;
    created_at?: string;
    updated_at?: string;
    expires_at?: string;
  };
  error?: {
    message?: string;
  };
};

function getOpenRouterManagementKey() {
  return process.env.OR_MANAGEMENT_KEY ?? process.env.OR_API_KEY ?? "";
}

async function createOpenRouterUserKey(
  userId: string
): Promise<UserOpenRouterKeyRecord> {
  const managementKey = getOpenRouterManagementKey();
  if (!managementKey) {
    throw new Error(
      "Missing OR_MANAGEMENT_KEY or OR_API_KEY for OpenRouter key provisioning."
    );
  }

  const name = `nexu-user-${userId}`;
  const response = await fetch(OPENROUTER_KEYS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${managementKey}`,
      "Content-Type": "application/json",
      "X-Title": "Nexu",
    },
    body: JSON.stringify({
      name,
      label: name,
      limit: OPENROUTER_CREDIT_LIMIT,
    }),
  });

  const payload = (await response
    .json()
    .catch(() => null)) as OpenRouterCreateKeyResponse | null;
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      `OpenRouter key creation failed (${response.status})`;
    throw new Error(message);
  }

  const key = payload?.key?.trim();
  if (!key) {
    throw new Error("OpenRouter did not return a usable API key.");
  }

  const createdAt = payload?.data?.created_at ?? nowIso();
  const updatedAt = payload?.data?.updated_at ?? createdAt;

  return {
    id: payload?.data?.hash || randomUUID(),
    userId,
    key,
    name: payload?.data?.name || name,
    hash: payload?.data?.hash,
    disabled: Boolean(payload?.data?.disabled),
    limit:
      typeof payload?.data?.limit === "number"
        ? payload.data.limit
        : OPENROUTER_CREDIT_LIMIT,
    limitRemaining:
      typeof payload?.data?.limit_remaining === "number"
        ? payload.data.limit_remaining
        : null,
    limitReset: payload?.data?.limit_reset ?? null,
    createdAt,
    updatedAt,
    expiresAt: payload?.data?.expires_at || undefined,
    requestCountDate: currentDateKey(),
    requestCount: 0,
  };
}

export async function consumeUserOpenRouterAccess(userId: string) {
  return withWrite(async (db) => {
    let keyRecord =
      db.openRouterKeys.find(
        (entry) => entry.userId === userId && !entry.disabled && entry.key
      ) ?? null;

    if (!keyRecord) {
      keyRecord = await createOpenRouterUserKey(userId);
      db.openRouterKeys = db.openRouterKeys.filter(
        (entry) => entry.userId !== userId
      );
      db.openRouterKeys.push(keyRecord);
    }

    const dateKey = currentDateKey();
    if (keyRecord.requestCountDate !== dateKey) {
      keyRecord.requestCountDate = dateKey;
      keyRecord.requestCount = 0;
    }

    if (keyRecord.requestCount >= OPENROUTER_DAILY_REQUEST_LIMIT) {
      throw new Error(
        `Daily model request limit reached (${OPENROUTER_DAILY_REQUEST_LIMIT}/day).`
      );
    }

    keyRecord.requestCount += 1;
    keyRecord.updatedAt = nowIso();

    return {
      apiKey: keyRecord.key,
      limitPerDay: OPENROUTER_DAILY_REQUEST_LIMIT,
      requestsUsedToday: keyRecord.requestCount,
      requestsRemainingToday: Math.max(
        0,
        OPENROUTER_DAILY_REQUEST_LIMIT - keyRecord.requestCount
      ),
    };
  });
}

async function ensureDbFile() {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify(EMPTY_DB, null, 2), "utf8");
  }
}

async function readDb(): Promise<SettingsDb> {
  await ensureDbFile();
  const raw = await fs.readFile(DB_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as Partial<SettingsDb>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      organizations: Array.isArray(parsed.organizations)
        ? parsed.organizations
        : [],
      organizationMembers: Array.isArray(parsed.organizationMembers)
        ? parsed.organizationMembers
        : [],
      notificationSettings: Array.isArray(parsed.notificationSettings)
        ? parsed.notificationSettings
        : [],
      apiKeys: Array.isArray(parsed.apiKeys) ? parsed.apiKeys : [],
      creditAccounts: Array.isArray(parsed.creditAccounts)
        ? parsed.creditAccounts
        : [],
      transactions: Array.isArray(parsed.transactions)
        ? parsed.transactions
        : [],
      invitations: Array.isArray(parsed.invitations) ? parsed.invitations : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
      openRouterKeys: Array.isArray(parsed.openRouterKeys)
        ? parsed.openRouterKeys
        : [],
    };
  } catch {
    return { ...EMPTY_DB };
  }
}

async function writeDb(db: SettingsDb) {
  const tmpPath = `${DB_FILE}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmpPath, DB_FILE);
}

async function withWrite<T>(
  fn: (db: SettingsDb) => Promise<T> | T
): Promise<T> {
  const task = writeQueue.then(async () => {
    const db = await readDb();
    const result = await fn(db);
    await writeDb(db);
    return result;
  });
  writeQueue = task.then(
    () => undefined,
    () => undefined
  );
  return task;
}

function ensureSession(db: SettingsDb, userId: string) {
  const existing = db.sessions.find(
    (session) => session.userId === userId && !session.revokedAt
  );
  if (existing) {
    existing.lastActiveAt = nowIso();
    return existing;
  }
  const session: UserSessionRecord = {
    id: randomUUID(),
    userId,
    label: "Current session",
    createdAt: nowIso(),
    lastActiveAt: nowIso(),
  };
  db.sessions.push(session);
  return session;
}

function ensureConnection(db: SettingsDb, userId: string, provider: "google") {
  const exists = db.connections.some(
    (connection) =>
      connection.userId === userId && connection.provider === provider
  );
  if (exists) return;
  db.connections.push({
    id: randomUUID(),
    userId,
    provider,
    connectedAt: nowIso(),
  });
}

export async function ensureUserFromClerk(
  userId: string,
  clerkUser?: User | null
) {
  return withWrite(async (db) => {
    let user = db.users.find((entry) => entry.id === userId);
    const email =
      clerkUser?.primaryEmailAddress?.emailAddress ??
      clerkUser?.emailAddresses[0]?.emailAddress ??
      `${userId}@example.local`;
    const fullName = [clerkUser?.firstName, clerkUser?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    const name =
      fullName || clerkUser?.username || email.split("@")[0] || "User";

    if (!user) {
      user = {
        id: userId,
        email,
        name,
        phone: clerkUser?.phoneNumbers[0]?.phoneNumber || undefined,
        avatarUrl: clerkUser?.imageUrl || undefined,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.users.push(user);
      db.notificationSettings.push(getDefaultNotificationSettings(userId));
    } else {
      user.email = email;
      if (!user.name) user.name = name;
      if (!user.avatarUrl && clerkUser?.imageUrl)
        user.avatarUrl = clerkUser.imageUrl;
      user.updatedAt = nowIso();
    }

    ensureSession(db, userId);
    if (
      clerkUser?.externalAccounts.some(
        (account) => account.provider === "oauth_google"
      )
    ) {
      ensureConnection(db, userId, "google");
    }
    return user;
  });
}

function getUserMemberships(db: SettingsDb, userId: string) {
  const memberships = db.organizationMembers
    .filter((member) => member.userId === userId)
    .map((member) => ({
      ...member,
      organization: db.organizations.find(
        (org) => org.id === member.organizationId
      ),
    }))
    .filter(
      (
        entry
      ): entry is OrganizationMemberRecord & {
        organization: OrganizationRecord;
      } => Boolean(entry.organization)
    );
  return memberships;
}

export async function getSettingsOverview(userId: string) {
  const db = await readDb();
  const user = db.users.find((entry) => entry.id === userId) ?? null;
  const notifications = normalizeNotificationSettings(
    userId,
    db.notificationSettings.find((entry) => entry.userId === userId)
  );
  const memberships = getUserMemberships(db, userId).sort((a, b) =>
    a.organization.name.localeCompare(b.organization.name)
  );

  return {
    user,
    notifications,
    organizations: memberships.map((entry) => ({
      organization: entry.organization,
      role: entry.role,
    })),
  };
}

export async function updateUserProfile(
  userId: string,
  input: { name?: string; phone?: string; avatarUrl?: string }
) {
  return withWrite(async (db) => {
    const user = db.users.find((entry) => entry.id === userId);
    if (!user) return null;
    if (typeof input.name === "string")
      user.name = input.name.trim() || user.name;
    if (typeof input.phone === "string")
      user.phone = input.phone.trim() || undefined;
    if (typeof input.avatarUrl === "string")
      user.avatarUrl = input.avatarUrl.trim() || undefined;
    user.updatedAt = nowIso();
    return user;
  });
}

export async function deleteUserAccount(userId: string) {
  return withWrite(async (db) => {
    const user = db.users.find((entry) => entry.id === userId);
    if (!user) return false;

    const ownedOrganizations = db.organizations.filter(
      (org) => org.ownerId === userId
    );

    for (const organization of ownedOrganizations) {
      const members = db.organizationMembers.filter(
        (member) =>
          member.organizationId === organization.id && member.userId !== userId
      );
      const promotedMember =
        members.find((member) => member.role === "admin") ?? members[0] ?? null;

      if (promotedMember) {
        organization.ownerId = promotedMember.userId;
        promotedMember.role = "owner";
        organization.updatedAt = nowIso();
      } else {
        db.organizations = db.organizations.filter(
          (entry) => entry.id !== organization.id
        );
        db.organizationMembers = db.organizationMembers.filter(
          (entry) => entry.organizationId !== organization.id
        );
        db.creditAccounts = db.creditAccounts.filter(
          (entry) => entry.organizationId !== organization.id
        );
        db.transactions = db.transactions.filter(
          (entry) => entry.organizationId !== organization.id
        );
        db.apiKeys = db.apiKeys.filter(
          (entry) => entry.organizationId !== organization.id
        );
        db.invitations = db.invitations.filter(
          (entry) => entry.organizationId !== organization.id
        );
      }
    }

    db.organizationMembers = db.organizationMembers.filter(
      (entry) => entry.userId !== userId
    );
    db.notificationSettings = db.notificationSettings.filter(
      (entry) => entry.userId !== userId
    );
    db.sessions = db.sessions.filter((entry) => entry.userId !== userId);
    db.connections = db.connections.filter((entry) => entry.userId !== userId);
    db.openRouterKeys = db.openRouterKeys.filter(
      (entry) => entry.userId !== userId
    );
    db.invitations = db.invitations.filter(
      (entry) =>
        entry.invitedByUserId !== userId &&
        entry.email.toLowerCase() !== user.email.toLowerCase()
    );
    db.users = db.users.filter((entry) => entry.id !== userId);
    return true;
  });
}

export async function changeUserEmail(
  userId: string,
  nextEmail: string,
  password: string
) {
  return withWrite(async (db) => {
    const user = db.users.find((entry) => entry.id === userId);
    if (!user) return null;
    if (user.passwordHash) {
      if (!verifyPassword(password, user.passwordHash)) {
        throw new Error("Current password is incorrect.");
      }
    } else if (!password) {
      throw new Error("Password confirmation is required.");
    }
    const normalized = nextEmail.trim().toLowerCase();
    const duplicate = db.users.find(
      (entry) => entry.email.toLowerCase() === normalized && entry.id !== userId
    );
    if (duplicate) throw new Error("That email is already in use.");
    user.email = normalized;
    user.updatedAt = nowIso();
    return user;
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  nextPassword: string
) {
  if (!nextPassword || nextPassword.length < 8) {
    throw new Error("New password must be at least 8 characters.");
  }
  return withWrite(async (db) => {
    const user = db.users.find((entry) => entry.id === userId);
    if (!user) return null;
    if (user.passwordHash) {
      if (!verifyPassword(currentPassword, user.passwordHash)) {
        throw new Error("Current password is incorrect.");
      }
    } else if (!currentPassword) {
      throw new Error("Current password is required.");
    }
    user.passwordHash = hashPassword(nextPassword);
    user.updatedAt = nowIso();
    return true;
  });
}

export async function listSecurityData(userId: string) {
  const db = await readDb();
  const user = db.users.find((entry) => entry.id === userId) ?? null;
  if (!user) return null;
  const sessions = db.sessions
    .filter((entry) => entry.userId === userId && !entry.revokedAt)
    .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  const connections = db.connections.filter((entry) => entry.userId === userId);
  return {
    mfaEnabled: Boolean(user.mfaEnabled),
    sessions,
    connections,
  };
}

export async function setMfaEnabled(userId: string, enabled: boolean) {
  return withWrite(async (db) => {
    const user = db.users.find((entry) => entry.id === userId);
    if (!user) return null;
    user.mfaEnabled = enabled;
    user.updatedAt = nowIso();
    return enabled;
  });
}

export async function revokeSession(userId: string, sessionId: string) {
  return withWrite(async (db) => {
    const session = db.sessions.find(
      (entry) => entry.id === sessionId && entry.userId === userId
    );
    if (!session) return false;
    session.revokedAt = nowIso();
    return true;
  });
}

export async function getNotificationSettings(userId: string) {
  const db = await readDb();
  const existing = db.notificationSettings.find(
    (entry) => entry.userId === userId
  );
  return normalizeNotificationSettings(userId, existing);
}

export async function updateNotificationSettings(
  userId: string,
  updates: Partial<NotificationSettingsRecord> & {
    transactionalEmails?: boolean;
    billingAlerts?: boolean;
    marketingNewsletter?: boolean;
  }
) {
  return withWrite(async (db) => {
    let settings = db.notificationSettings.find(
      (entry) => entry.userId === userId
    );
    if (!settings) {
      settings = getDefaultNotificationSettings(userId);
      db.notificationSettings.push(settings);
    } else {
      Object.assign(settings, normalizeNotificationSettings(userId, settings));
    }

    if (typeof updates.transactionalEmails === "boolean") {
      settings.contacts = updates.transactionalEmails;
      settings.inbox = updates.transactionalEmails;
    }
    if (typeof updates.billingAlerts === "boolean") {
      settings.usageAt90 = updates.billingAlerts;
      settings.usageExceeded = updates.billingAlerts;
    }
    if (typeof updates.marketingNewsletter === "boolean") {
      settings.newsletter = updates.marketingNewsletter;
    }

    settings.contacts = Boolean(updates.contacts ?? settings.contacts);
    settings.inbox = Boolean(updates.inbox ?? settings.inbox);
    settings.weeklySummary = Boolean(
      updates.weeklySummary ?? settings.weeklySummary
    );
    settings.securityEmails = Boolean(
      updates.securityEmails ?? settings.securityEmails
    );
    settings.usageAt90 = Boolean(updates.usageAt90 ?? settings.usageAt90);
    settings.usageExceeded = Boolean(
      updates.usageExceeded ?? settings.usageExceeded
    );
    settings.newsletter = Boolean(updates.newsletter ?? settings.newsletter);
    settings.productUpdates = Boolean(
      updates.productUpdates ?? settings.productUpdates
    );
    settings.updatedAt = nowIso();
    return settings;
  });
}

export async function createOrganization(
  userId: string,
  input: { name: string; slug?: string; logoUrl?: string }
) {
  const name = input.name.trim();
  if (!name) throw new Error("Organization name is required.");
  return withWrite(async (db) => {
    const slug = asSlug(input.slug || name);
    if (!slug) throw new Error("Organization slug is required.");
    const duplicate = db.organizations.find((entry) => entry.slug === slug);
    if (duplicate) throw new Error("Slug already exists.");

    const now = nowIso();
    const organization: OrganizationRecord = {
      id: randomUUID(),
      name,
      slug,
      logoUrl: input.logoUrl?.trim() || undefined,
      ownerId: userId,
      currentPlan: "free",
      createdAt: now,
      updatedAt: now,
    };
    db.organizations.push(organization);
    db.organizationMembers.push({
      id: randomUUID(),
      organizationId: organization.id,
      userId,
      role: "owner",
      createdAt: now,
    });
    db.creditAccounts.push(getDefaultCreditAccount(organization.id));
    return organization;
  });
}

export async function listOrganizationsForUser(userId: string) {
  const db = await readDb();
  return getUserMemberships(db, userId)
    .map((entry) => ({
      organization: entry.organization,
      role: entry.role,
    }))
    .sort((a, b) => a.organization.name.localeCompare(b.organization.name));
}

export async function getOrganizationContext(
  userId: string,
  organizationId?: string
) {
  const db = await readDb();
  const memberships = getUserMemberships(db, userId);
  if (memberships.length === 0) return null;

  const selected =
    (organizationId
      ? memberships.find((entry) => entry.organizationId === organizationId)
      : memberships[0]) ?? null;
  if (!selected) return null;
  return {
    organization: selected.organization,
    role: selected.role,
    memberships: memberships.map((entry) => ({
      organization: entry.organization,
      role: entry.role,
    })),
  };
}

function assertCanManageMembers(role: MemberRole) {
  if (!isAdminRole(role)) {
    throw new Error("Forbidden");
  }
}

function assertCanManageBilling(role: MemberRole) {
  if (role !== "owner") {
    throw new Error("Forbidden");
  }
}

async function getMembership(
  db: SettingsDb,
  userId: string,
  organizationId: string
) {
  return db.organizationMembers.find(
    (member) =>
      member.organizationId === organizationId && member.userId === userId
  );
}

export async function updateOrganizationGeneral(
  userId: string,
  organizationId: string,
  updates: Partial<OrganizationRecord>
) {
  return withWrite(async (db) => {
    const member = await getMembership(db, userId, organizationId);
    if (!member || !isAdminRole(member.role)) throw new Error("Forbidden");
    const org = db.organizations.find((entry) => entry.id === organizationId);
    if (!org) return null;

    const nextSlug =
      typeof updates.slug === "string" ? asSlug(updates.slug) : org.slug;
    if (!nextSlug) throw new Error("Slug is invalid.");
    const duplicate = db.organizations.find(
      (entry) => entry.slug === nextSlug && entry.id !== organizationId
    );
    if (duplicate) throw new Error("Slug already exists.");

    org.name =
      typeof updates.name === "string"
        ? updates.name.trim() || org.name
        : org.name;
    org.slug = nextSlug;
    org.logoUrl =
      typeof updates.logoUrl === "string"
        ? updates.logoUrl.trim() || undefined
        : org.logoUrl;
    org.address =
      typeof updates.address === "string"
        ? updates.address.trim() || undefined
        : org.address;
    org.website =
      typeof updates.website === "string"
        ? updates.website.trim() || undefined
        : org.website;
    org.billingEmail =
      typeof updates.billingEmail === "string"
        ? updates.billingEmail.trim() || undefined
        : org.billingEmail;
    org.billingAddress =
      typeof updates.billingAddress === "string"
        ? updates.billingAddress.trim() || undefined
        : org.billingAddress;
    if (Array.isArray(updates.socialLinks)) {
      org.socialLinks = Array.from(
        new Set(
          updates.socialLinks
            .map((entry) => entry.trim())
            .filter(Boolean)
            .slice(0, 6)
        )
      );
    }
    org.updatedAt = nowIso();
    return org;
  });
}

export async function deleteOrganization(
  userId: string,
  organizationId: string
) {
  return withWrite(async (db) => {
    const member = await getMembership(db, userId, organizationId);
    if (!member || member.role !== "owner") throw new Error("Forbidden");
    db.organizations = db.organizations.filter(
      (org) => org.id !== organizationId
    );
    db.organizationMembers = db.organizationMembers.filter(
      (entry) => entry.organizationId !== organizationId
    );
    db.creditAccounts = db.creditAccounts.filter(
      (entry) => entry.organizationId !== organizationId
    );
    db.transactions = db.transactions.filter(
      (entry) => entry.organizationId !== organizationId
    );
    db.apiKeys = db.apiKeys.filter(
      (entry) => entry.organizationId !== organizationId
    );
    db.invitations = db.invitations.filter(
      (entry) => entry.organizationId !== organizationId
    );
    return true;
  });
}

export async function listOrganizationMembers(
  userId: string,
  organizationId: string
) {
  const db = await readDb();
  const member = await getMembership(db, userId, organizationId);
  if (!member) throw new Error("Forbidden");

  const members = db.organizationMembers
    .filter((entry) => entry.organizationId === organizationId)
    .map((entry) => ({
      ...entry,
      user: db.users.find((user) => user.id === entry.userId) ?? null,
    }))
    .sort((a, b) => {
      const roleOrder: Record<MemberRole, number> = {
        owner: 0,
        admin: 1,
        member: 2,
      };
      if (roleOrder[a.role] !== roleOrder[b.role])
        return roleOrder[a.role] - roleOrder[b.role];
      return (a.user?.name ?? "").localeCompare(b.user?.name ?? "");
    });

  const invitations = db.invitations
    .filter(
      (entry) =>
        entry.organizationId === organizationId && entry.status === "pending"
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return { members, invitations, role: member.role };
}

export async function inviteOrganizationMember(
  userId: string,
  organizationId: string,
  input: { email: string; role: "admin" | "member" }
) {
  return withWrite(async (db) => {
    const member = await getMembership(db, userId, organizationId);
    if (!member) throw new Error("Forbidden");
    assertCanManageMembers(member.role);

    const email = input.email.trim().toLowerCase();
    if (!email) throw new Error("Email is required.");

    const existingUser = db.users.find(
      (user) => user.email.toLowerCase() === email
    );
    if (existingUser) {
      const existingMember = db.organizationMembers.find(
        (entry) =>
          entry.organizationId === organizationId &&
          entry.userId === existingUser.id
      );
      if (existingMember) {
        throw new Error("User is already a member.");
      }
      db.organizationMembers.push({
        id: randomUUID(),
        organizationId,
        userId: existingUser.id,
        role: input.role,
        createdAt: nowIso(),
      });
      return { mode: "joined" as const };
    }

    const duplicateInvite = db.invitations.find(
      (entry) =>
        entry.organizationId === organizationId &&
        entry.email.toLowerCase() === email &&
        entry.status === "pending"
    );
    if (duplicateInvite)
      throw new Error("An invitation is already pending for that email.");

    db.invitations.push({
      id: randomUUID(),
      organizationId,
      email,
      role: input.role,
      invitedByUserId: userId,
      status: "pending",
      createdAt: nowIso(),
    });

    return { mode: "invited" as const };
  });
}

export async function updateOrganizationMemberRole(
  userId: string,
  organizationId: string,
  memberUserId: string,
  role: "admin" | "member"
) {
  return withWrite(async (db) => {
    const actor = await getMembership(db, userId, organizationId);
    if (!actor) throw new Error("Forbidden");
    assertCanManageMembers(actor.role);

    const target = db.organizationMembers.find(
      (entry) =>
        entry.organizationId === organizationId && entry.userId === memberUserId
    );
    if (!target) return null;
    if (target.role === "owner") {
      throw new Error("Cannot change owner role.");
    }
    target.role = role;
    return target;
  });
}

export async function removeOrganizationMember(
  userId: string,
  organizationId: string,
  memberUserId: string
) {
  return withWrite(async (db) => {
    const actor = await getMembership(db, userId, organizationId);
    if (!actor) throw new Error("Forbidden");
    assertCanManageMembers(actor.role);

    const target = db.organizationMembers.find(
      (entry) =>
        entry.organizationId === organizationId && entry.userId === memberUserId
    );
    if (!target) return false;
    if (target.role === "owner")
      throw new Error("Cannot remove organization owner.");
    db.organizationMembers = db.organizationMembers.filter(
      (entry) =>
        !(
          entry.organizationId === organizationId &&
          entry.userId === memberUserId
        )
    );
    return true;
  });
}

export async function revokeInvitation(
  userId: string,
  organizationId: string,
  invitationId: string
) {
  return withWrite(async (db) => {
    const actor = await getMembership(db, userId, organizationId);
    if (!actor) throw new Error("Forbidden");
    assertCanManageMembers(actor.role);
    const invitation = db.invitations.find(
      (entry) =>
        entry.id === invitationId && entry.organizationId === organizationId
    );
    if (!invitation) return false;
    invitation.status = "revoked";
    return true;
  });
}

export async function getOrganizationBilling(
  userId: string,
  organizationId: string
) {
  const db = await readDb();
  const member = await getMembership(db, userId, organizationId);
  if (!member) throw new Error("Forbidden");
  const org = db.organizations.find((entry) => entry.id === organizationId);
  if (!org) return null;
  const creditAccount =
    db.creditAccounts.find(
      (entry) => entry.organizationId === organizationId
    ) ?? getDefaultCreditAccount(organizationId);
  const transactions = db.transactions
    .filter((entry) => entry.organizationId === organizationId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);
  return {
    organization: org,
    role: member.role,
    creditAccount,
    transactions,
  };
}

export async function updateBillingSettings(
  userId: string,
  organizationId: string,
  updates: Partial<CreditAccountRecord> & {
    billingEmail?: string;
    billingAddress?: string;
    currentPlan?: "free" | "pro" | "enterprise";
  }
) {
  return withWrite(async (db) => {
    const member = await getMembership(db, userId, organizationId);
    if (!member) throw new Error("Forbidden");
    assertCanManageBilling(member.role);

    const org = db.organizations.find((entry) => entry.id === organizationId);
    if (!org) return null;
    let credit = db.creditAccounts.find(
      (entry) => entry.organizationId === organizationId
    );
    if (!credit) {
      credit = getDefaultCreditAccount(organizationId);
      db.creditAccounts.push(credit);
    }

    if (typeof updates.autoReloadEnabled === "boolean") {
      credit.autoReloadEnabled = updates.autoReloadEnabled;
    }
    if (typeof updates.reloadThresholdCents === "number") {
      credit.reloadThresholdCents = Math.max(
        0,
        Math.round(updates.reloadThresholdCents)
      );
    }
    if (typeof updates.reloadAmountCents === "number") {
      credit.reloadAmountCents = Math.max(
        100,
        Math.round(updates.reloadAmountCents)
      );
    }
    if (typeof updates.monthlyMaxCents === "number") {
      credit.monthlyMaxCents = Math.max(
        100,
        Math.round(updates.monthlyMaxCents)
      );
    }
    credit.updatedAt = nowIso();

    if (typeof updates.billingEmail === "string") {
      org.billingEmail = updates.billingEmail.trim() || undefined;
    }
    if (typeof updates.billingAddress === "string") {
      org.billingAddress = updates.billingAddress.trim() || undefined;
    }
    if (updates.currentPlan) {
      org.currentPlan = updates.currentPlan;
    }
    org.updatedAt = nowIso();

    return { organization: org, creditAccount: credit };
  });
}

export async function addManualCredits(
  userId: string,
  organizationId: string,
  amountCents: number,
  description?: string
) {
  return withWrite(async (db) => {
    const member = await getMembership(db, userId, organizationId);
    if (!member) throw new Error("Forbidden");
    assertCanManageBilling(member.role);

    let credit = db.creditAccounts.find(
      (entry) => entry.organizationId === organizationId
    );
    if (!credit) {
      credit = getDefaultCreditAccount(organizationId);
      db.creditAccounts.push(credit);
    }
    credit.balanceCents += Math.max(0, Math.round(amountCents));
    credit.updatedAt = nowIso();
    db.transactions.push({
      id: randomUUID(),
      organizationId,
      amountCents: Math.max(0, Math.round(amountCents)),
      type: "manual",
      createdAt: nowIso(),
      description: description || "Manual credit adjustment",
    });
    return credit;
  });
}

async function maybeCreateStripePaymentIntent(
  organization: OrganizationRecord,
  amountCents: number
): Promise<StripeChargeResult | null> {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) return null;

  const body = new URLSearchParams();
  body.set("amount", String(amountCents));
  body.set("currency", "usd");
  body.set("description", `Auto-reload for ${organization.name}`);
  body.set("metadata[organization_id]", organization.id);

  const response = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { id?: string };
  return {
    paymentIntentId: payload.id,
    amountCents,
  };
}

async function triggerAutoReload(
  db: SettingsDb,
  organizationId: string
): Promise<StripeChargeResult | null> {
  const organization = db.organizations.find(
    (entry) => entry.id === organizationId
  );
  const credit = db.creditAccounts.find(
    (entry) => entry.organizationId === organizationId
  );
  if (!organization || !credit) return null;
  if (!credit.autoReloadEnabled) return null;
  if (credit.balanceCents > credit.reloadThresholdCents) return null;

  const monthPrefix = new Date().toISOString().slice(0, 7);
  const monthTotal = db.transactions
    .filter(
      (tx) =>
        tx.organizationId === organizationId &&
        tx.type === "reload" &&
        tx.createdAt.startsWith(monthPrefix)
    )
    .reduce((sum, tx) => sum + tx.amountCents, 0);
  if (monthTotal + credit.reloadAmountCents > credit.monthlyMaxCents) {
    return null;
  }

  const stripeCharge = await maybeCreateStripePaymentIntent(
    organization,
    credit.reloadAmountCents
  );
  credit.balanceCents += credit.reloadAmountCents;
  credit.updatedAt = nowIso();
  db.transactions.push({
    id: randomUUID(),
    organizationId,
    amountCents: credit.reloadAmountCents,
    type: "reload",
    createdAt: nowIso(),
    description: "Auto reload",
    stripePaymentIntentId: stripeCharge?.paymentIntentId,
  });
  return stripeCharge;
}

export async function listApiKeys(userId: string, organizationId: string) {
  const db = await readDb();
  const member = await getMembership(db, userId, organizationId);
  if (!member) throw new Error("Forbidden");
  if (!isAdminRole(member.role)) throw new Error("Forbidden");
  const credit =
    db.creditAccounts.find(
      (entry) => entry.organizationId === organizationId
    ) ?? getDefaultCreditAccount(organizationId);
  const keys = db.apiKeys
    .filter(
      (entry) => entry.organizationId === organizationId && !entry.revokedAt
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    role: member.role,
    creditAccount: credit,
    keys,
  };
}

export async function createApiKey(
  userId: string,
  organizationId: string,
  name: string
) {
  return withWrite(async (db) => {
    const member = await getMembership(db, userId, organizationId);
    if (!member || !isAdminRole(member.role)) throw new Error("Forbidden");

    const displayName = name.trim();
    if (!displayName) throw new Error("API key name is required.");

    const secret = generateApiKeySecret();
    const record: ApiKeyRecord = {
      id: randomUUID(),
      organizationId,
      name: displayName,
      hashedKey: hashApiKey(secret),
      keyPrefix: getApiKeyPrefix(secret),
      usageCount: 0,
      createdAt: nowIso(),
    };
    db.apiKeys.push(record);
    return {
      key: secret,
      record,
    };
  });
}

export async function revokeApiKey(
  userId: string,
  organizationId: string,
  keyId: string
) {
  return withWrite(async (db) => {
    const member = await getMembership(db, userId, organizationId);
    if (!member || !isAdminRole(member.role)) throw new Error("Forbidden");
    const key = db.apiKeys.find(
      (entry) =>
        entry.id === keyId &&
        entry.organizationId === organizationId &&
        !entry.revokedAt
    );
    if (!key) return false;
    key.revokedAt = nowIso();
    return true;
  });
}

export async function authenticateApiKey(secret: string) {
  const db = await readDb();
  const hashed = hashApiKey(secret);
  const key = db.apiKeys.find(
    (entry) => entry.hashedKey === hashed && !entry.revokedAt
  );
  if (!key) return null;
  const credit = db.creditAccounts.find(
    (entry) => entry.organizationId === key.organizationId
  );
  if (!credit || credit.balanceCents <= 0) {
    return {
      ok: false as const,
      reason: "insufficient_credits" as const,
      key,
      creditAccount: credit ?? null,
    };
  }
  return {
    ok: true as const,
    key,
    creditAccount: credit,
  };
}

export async function consumeCreditsByApiKey(
  apiKeyId: string,
  amountCents: number,
  description?: string
) {
  return withWrite(async (db) => {
    const key = db.apiKeys.find(
      (entry) => entry.id === apiKeyId && !entry.revokedAt
    );
    if (!key) return null;
    const credit = db.creditAccounts.find(
      (entry) => entry.organizationId === key.organizationId
    );
    if (!credit) return null;
    const debit = Math.max(0, Math.round(amountCents));
    if (credit.balanceCents < debit) {
      return {
        ok: false as const,
        reason: "insufficient_credits" as const,
      };
    }

    credit.balanceCents -= debit;
    credit.updatedAt = nowIso();
    key.usageCount += 1;
    key.lastUsedAt = nowIso();
    db.transactions.push({
      id: randomUUID(),
      organizationId: key.organizationId,
      amountCents: -debit,
      type: "usage",
      createdAt: nowIso(),
      description: description ?? "API usage",
    });

    const reload = await triggerAutoReload(db, key.organizationId);
    return {
      ok: true as const,
      balanceCents: credit.balanceCents,
      autoReload: reload,
    };
  });
}

export async function createStripePortalSession(
  userId: string,
  organizationId: string
) {
  const db = await readDb();
  const member = await getMembership(db, userId, organizationId);
  if (!member || member.role !== "owner") throw new Error("Forbidden");
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    throw new Error("Stripe is not configured.");
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const body = new URLSearchParams();
  body.set("customer", `org_${organizationId}`);
  body.set(
    "return_url",
    `${appUrl}/settings/organization/billing?organizationId=${organizationId}`
  );

  const response = await fetch(
    "https://api.stripe.com/v1/billing_portal/sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );
  if (!response.ok) {
    throw new Error("Failed to create Stripe portal session.");
  }
  const payload = (await response.json()) as { url?: string };
  return payload.url ?? null;
}

export async function createStripeCheckoutSession(
  userId: string,
  organizationId: string,
  priceId: string
) {
  const db = await readDb();
  const member = await getMembership(db, userId, organizationId);
  if (!member || member.role !== "owner") throw new Error("Forbidden");
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    throw new Error("Stripe is not configured.");
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set(
    "success_url",
    `${appUrl}/settings/organization/billing?organizationId=${organizationId}`
  );
  body.set(
    "cancel_url",
    `${appUrl}/settings/organization/billing?organizationId=${organizationId}`
  );
  body.set("line_items[0][price]", priceId);
  body.set("line_items[0][quantity]", "1");
  body.set("metadata[organization_id]", organizationId);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) {
    throw new Error("Failed to create Stripe checkout session.");
  }
  const payload = (await response.json()) as { url?: string };
  return payload.url ?? null;
}

export async function writeSettingsUpload(
  storageName: string,
  bytes: Uint8Array
) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const safeName = storageName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(UPLOAD_DIR, `${Date.now()}-${safeName}`);
  await fs.writeFile(filePath, bytes);
  return filePath;
}

export function getRelativeUploadPath(filePath: string) {
  return path.relative(process.cwd(), filePath);
}
