export type MemberRole = "owner" | "admin" | "member";

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
  passwordHash?: string;
  mfaEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  ownerId: string;
  address?: string;
  website?: string;
  socialLinks?: string[];
  billingEmail?: string;
  billingAddress?: string;
  currentPlan?: "free" | "pro" | "enterprise";
  createdAt: string;
  updatedAt: string;
};

export type OrganizationMemberRecord = {
  id: string;
  organizationId: string;
  userId: string;
  role: MemberRole;
  createdAt: string;
};

export type NotificationSettingsRecord = {
  userId: string;
  contacts: boolean;
  inbox: boolean;
  weeklySummary: boolean;
  securityEmails: boolean;
  usageAt90: boolean;
  usageExceeded: boolean;
  newsletter: boolean;
  productUpdates: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiKeyRecord = {
  id: string;
  organizationId: string;
  name: string;
  hashedKey: string;
  keyPrefix: string;
  lastUsedAt?: string;
  usageCount: number;
  createdAt: string;
  revokedAt?: string;
};

export type CreditAccountRecord = {
  organizationId: string;
  balanceCents: number;
  autoReloadEnabled: boolean;
  reloadThresholdCents: number;
  reloadAmountCents: number;
  monthlyMaxCents: number;
  createdAt: string;
  updatedAt: string;
};

export type TransactionRecord = {
  id: string;
  organizationId: string;
  amountCents: number;
  type: "usage" | "reload" | "manual";
  createdAt: string;
  description?: string;
  stripePaymentIntentId?: string;
};

export type OrganizationInvitationRecord = {
  id: string;
  organizationId: string;
  email: string;
  role: Exclude<MemberRole, "owner">;
  invitedByUserId: string;
  status: "pending" | "accepted" | "revoked";
  createdAt: string;
};

export type UserSessionRecord = {
  id: string;
  userId: string;
  label: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  lastActiveAt: string;
  revokedAt?: string;
};

export type UserConnectionRecord = {
  id: string;
  userId: string;
  provider: "google";
  connectedAt: string;
};
