"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, H1, Input, Paragraph, Text, XStack, YStack } from "tamagui";
import { readResponseError, readResponseJson } from "@/lib/http";

type OrganizationMembership = {
  role: "owner" | "admin" | "member";
  organization: {
    id: string;
    name: string;
    slug: string;
  };
};

type ApiKeyRecord = {
  id: string;
  name: string;
  keyPrefix: string;
  usageCount: number;
  createdAt: string;
  lastUsedAt?: string;
};

type ApiKeysResponse = {
  organization: {
    id: string;
    name: string;
  };
  role: "owner" | "admin" | "member";
  memberships: OrganizationMembership[];
  selectedOrganizationId: string;
  creditAccount: {
    balanceCents: number;
    autoReloadEnabled: boolean;
    reloadThresholdCents: number;
    reloadAmountCents: number;
    monthlyMaxCents: number;
  };
  keys: ApiKeyRecord[];
};

type BillingResponse = {
  creditAccount: {
    balanceCents: number;
    autoReloadEnabled: boolean;
    reloadThresholdCents: number;
    reloadAmountCents: number;
    monthlyMaxCents: number;
  };
};

function centsToDollars(value: number) {
  return (value / 100).toFixed(2);
}

function toCents(value: string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.round(numberValue * 100);
}

function formatDate(value?: string) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export default function OrganizationApiKeysPage() {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingAutoReload, setSavingAutoReload] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [data, setData] = useState<ApiKeysResponse | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [autoReloadEnabled, setAutoReloadEnabled] = useState(false);
  const [reloadThreshold, setReloadThreshold] = useState("10");
  const [reloadAmount, setReloadAmount] = useState("25");
  const [monthlyMax, setMonthlyMax] = useState("500");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const canManageKeys = useMemo(
    () => data?.role === "owner" || data?.role === "admin",
    [data?.role]
  );
  const canManageAutoReload = useMemo(() => data?.role === "owner", [data?.role]);

  const stats = useMemo(() => {
    const keys = data?.keys ?? [];
    const totalUsage = keys.reduce((sum, key) => sum + (key.usageCount || 0), 0);
    const activeCount = keys.length;
    const usedLast30Days = keys.filter((key) => {
      if (!key.lastUsedAt) return false;
      const age = Date.now() - new Date(key.lastUsedAt).getTime();
      return age <= 30 * 24 * 60 * 60 * 1000;
    }).length;
    return { totalUsage, activeCount, usedLast30Days };
  }, [data?.keys]);

  const load = useCallback(async (organizationId?: string) => {
    const query = organizationId
      ? `?organizationId=${encodeURIComponent(organizationId)}`
      : "";

    const [keysRes, billingRes] = await Promise.all([
      fetch(`/api/settings/organization/api-keys${query}`, { cache: "no-store" }),
      fetch(`/api/settings/organization/billing${query}`, { cache: "no-store" }),
    ]);

    const keysPayload = await readResponseJson<ApiKeysResponse & { error?: string }>(keysRes);
    if (!keysRes.ok || !keysPayload) {
      throw new Error(readResponseError(keysRes, keysPayload, "Failed to load API keys."));
    }

    const billingPayload = await readResponseJson<BillingResponse & { error?: string }>(billingRes);
    if (!billingRes.ok || !billingPayload) {
      throw new Error(readResponseError(billingRes, billingPayload, "Failed to load auto-reload settings."));
    }

    setData(keysPayload);
    setSelectedOrganizationId(keysPayload.selectedOrganizationId);
    setAutoReloadEnabled(Boolean(billingPayload.creditAccount.autoReloadEnabled));
    setReloadThreshold(centsToDollars(billingPayload.creditAccount.reloadThresholdCents));
    setReloadAmount(centsToDollars(billingPayload.creditAccount.reloadAmountCents));
    setMonthlyMax(centsToDollars(billingPayload.creditAccount.monthlyMaxCents));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (error) {
        if (!cancelled) {
          setNotice({
            kind: "error",
            text: error instanceof Error ? error.message : "Failed to load API keys.",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const createKey = async () => {
    if (!data) return;
    if (!newKeyName.trim()) {
      setNotice({ kind: "error", text: "API key name is required." });
      return;
    }
    setCreating(true);
    setNotice(null);
    setRevealedKey(null);
    try {
      const res = await fetch("/api/settings/organization/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: data.organization.id,
          name: newKeyName.trim(),
        }),
      });
      const payload = await readResponseJson<{
        ok?: boolean;
        key?: string;
        record?: ApiKeyRecord;
        error?: string;
      }>(res);
      if (!res.ok || !payload?.ok || !payload.record || !payload.key) {
        throw new Error(readResponseError(res, payload, "Failed to create API key."));
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              keys: [payload.record as ApiKeyRecord, ...prev.keys],
            }
          : prev
      );
      setNewKeyName("");
      setRevealedKey(payload.key);
      setNotice({ kind: "success", text: "API key created. Copy it now; it will not be shown again." });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to create API key.",
      });
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (keyId: string) => {
    if (!data) return;
    setRevokingId(keyId);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/settings/organization/api-keys/${encodeURIComponent(
          keyId
        )}?organizationId=${encodeURIComponent(data.organization.id)}`,
        { method: "DELETE" }
      );
      const payload = await readResponseJson<{ ok?: boolean; error?: string }>(res);
      if (!res.ok || !payload?.ok) {
        throw new Error(readResponseError(res, payload, "Failed to revoke API key."));
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              keys: prev.keys.filter((entry) => entry.id !== keyId),
            }
          : prev
      );
      setNotice({ kind: "success", text: "API key revoked." });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to revoke API key.",
      });
    } finally {
      setRevokingId(null);
    }
  };

  const saveAutoReload = async () => {
    if (!data) return;
    setSavingAutoReload(true);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/organization/billing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: data.organization.id,
          autoReloadEnabled,
          reloadThresholdCents: toCents(reloadThreshold),
          reloadAmountCents: toCents(reloadAmount),
          monthlyMaxCents: toCents(monthlyMax),
        }),
      });
      const payload = await readResponseJson<{ ok?: boolean; error?: string }>(res);
      if (!res.ok || !payload?.ok) {
        throw new Error(readResponseError(res, payload, "Failed to save auto-reload settings."));
      }
      await load(data.organization.id);
      setNotice({ kind: "success", text: "Auto-reload settings updated." });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to save auto-reload settings.",
      });
    } finally {
      setSavingAutoReload(false);
    }
  };

  if (loading) {
    return (
      <YStack gap="$sm">
        <H1 fontSize={28}>Organization: API Keys</H1>
        <Paragraph color="$textMuted">Loading API keys...</Paragraph>
      </YStack>
    );
  }

  if (!data) {
    return (
      <YStack gap="$sm">
        <H1 fontSize={28}>Organization: API Keys</H1>
        <Paragraph color="$textMuted">No organization found for this account.</Paragraph>
      </YStack>
    );
  }

  return (
    <YStack gap="$lg">
      <YStack gap="$xs">
        <H1 fontSize={28} color="$color">
          Organization: API Keys
        </H1>
        <Paragraph color="$textMuted">
          Manage API access, monitor usage, and configure auto-reload safety limits.
        </Paragraph>
      </YStack>

      {notice && (
        <XStack
          padding="$sm"
          borderRadius="$md"
          borderWidth={1}
          borderColor={notice.kind === "success" ? "$success" : "$error"}
          backgroundColor={notice.kind === "success" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)"}
        >
          <Text fontSize={13} color={notice.kind === "success" ? "$success" : "$error"}>
            {notice.text}
          </Text>
        </XStack>
      )}

      <YStack
        gap="$md"
        padding="$lg"
        borderRadius="$lg"
        borderWidth={1}
        borderColor="$border"
        backgroundColor="$backgroundSecondary"
      >
        <YStack gap="$xs">
          <Text fontSize={13} color="$textMuted">
            Organization
          </Text>
          <select
            value={selectedOrganizationId}
            onChange={(event) => {
              const next = event.currentTarget.value;
              setSelectedOrganizationId(next);
              void load(next);
            }}
            style={{ padding: 10, borderRadius: 8, border: "1px solid var(--border)" }}
          >
            {data.memberships.map((entry) => (
              <option key={entry.organization.id} value={entry.organization.id}>
                {entry.organization.name} ({entry.role})
              </option>
            ))}
          </select>
        </YStack>

        <XStack gap="$md" flexWrap="wrap">
          <YStack
            flex={1}
            minWidth={180}
            padding="$sm"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$md"
            backgroundColor="$background"
          >
            <Text fontSize={12} color="$textMuted">
              Credit balance
            </Text>
            <Text fontSize={20} fontWeight="700" color="$color">
              ${centsToDollars(data.creditAccount.balanceCents)}
            </Text>
          </YStack>
          <YStack
            flex={1}
            minWidth={180}
            padding="$sm"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$md"
            backgroundColor="$background"
          >
            <Text fontSize={12} color="$textMuted">
              Active keys
            </Text>
            <Text fontSize={20} fontWeight="700" color="$color">
              {stats.activeCount}
            </Text>
          </YStack>
          <YStack
            flex={1}
            minWidth={180}
            padding="$sm"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$md"
            backgroundColor="$background"
          >
            <Text fontSize={12} color="$textMuted">
              Total key uses
            </Text>
            <Text fontSize={20} fontWeight="700" color="$color">
              {stats.totalUsage}
            </Text>
          </YStack>
          <YStack
            flex={1}
            minWidth={180}
            padding="$sm"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$md"
            backgroundColor="$background"
          >
            <Text fontSize={12} color="$textMuted">
              Used in last 30 days
            </Text>
            <Text fontSize={20} fontWeight="700" color="$color">
              {stats.usedLast30Days}
            </Text>
          </YStack>
        </XStack>
      </YStack>

      <YStack
        gap="$sm"
        padding="$lg"
        borderRadius="$lg"
        borderWidth={1}
        borderColor="$border"
        backgroundColor="$backgroundSecondary"
      >
        <Text fontSize={15} fontWeight="600" color="$color">
          Auto-reload settings
        </Text>
        <XStack gap="$sm" alignItems="center" flexWrap="wrap">
          <input
            type="checkbox"
            checked={autoReloadEnabled}
            onChange={(event) => setAutoReloadEnabled(event.currentTarget.checked)}
            disabled={!canManageAutoReload}
            aria-label="Enable auto reload"
          />
          <Text fontSize={13} color="$color">
            Enable auto-reload
          </Text>
        </XStack>
        <XStack gap="$sm" flexWrap="wrap">
          <Input
            value={reloadThreshold}
            onChangeText={setReloadThreshold}
            placeholder="Threshold ($)"
            backgroundColor="$background"
            borderColor="$border"
            width={200}
            disabled={!canManageAutoReload}
          />
          <Input
            value={reloadAmount}
            onChangeText={setReloadAmount}
            placeholder="Reload amount ($)"
            backgroundColor="$background"
            borderColor="$border"
            width={200}
            disabled={!canManageAutoReload}
          />
          <Input
            value={monthlyMax}
            onChangeText={setMonthlyMax}
            placeholder="Monthly max ($)"
            backgroundColor="$background"
            borderColor="$border"
            width={200}
            disabled={!canManageAutoReload}
          />
        </XStack>
        <Button
          size="$3"
          alignSelf="flex-start"
          backgroundColor="$color"
          color="$background"
          onPress={saveAutoReload}
          disabled={!canManageAutoReload || savingAutoReload}
        >
          {savingAutoReload ? "Saving..." : "Save auto-reload"}
        </Button>
        {!canManageAutoReload && (
          <Paragraph color="$textMuted">
            Only organization owners can update auto-reload settings.
          </Paragraph>
        )}
      </YStack>

      <YStack
        gap="$sm"
        padding="$lg"
        borderRadius="$lg"
        borderWidth={1}
        borderColor="$border"
        backgroundColor="$backgroundSecondary"
      >
        <Text fontSize={15} fontWeight="600" color="$color">
          Create API key
        </Text>
        <XStack gap="$sm" alignItems="center" flexWrap="wrap">
          <Input
            value={newKeyName}
            onChangeText={setNewKeyName}
            placeholder="Key name (e.g. production-worker)"
            backgroundColor="$background"
            borderColor="$border"
            width={320}
            disabled={!canManageKeys}
          />
          <Button
            size="$3"
            backgroundColor="$color"
            color="$background"
            onPress={createKey}
            disabled={!canManageKeys || creating}
          >
            {creating ? "Creating..." : "Create key"}
          </Button>
        </XStack>
        {!canManageKeys && (
          <Paragraph color="$textMuted">
            You can view stats, but only owners/admins can create or revoke API keys.
          </Paragraph>
        )}

        {revealedKey && (
          <YStack
            gap="$sm"
            padding="$sm"
            borderWidth={1}
            borderColor="$success"
            borderRadius="$md"
            backgroundColor="rgba(34,197,94,0.08)"
          >
            <Text fontSize={13} color="$success" fontWeight="600">
              New key (shown once)
            </Text>
            <Text fontSize={13} color="$color" selectable>
              {revealedKey}
            </Text>
            <Button
              size="$2"
              alignSelf="flex-start"
              onPress={() => {
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  void navigator.clipboard.writeText(revealedKey);
                }
              }}
            >
              Copy key
            </Button>
          </YStack>
        )}
      </YStack>

      <YStack
        gap="$sm"
        padding="$lg"
        borderRadius="$lg"
        borderWidth={1}
        borderColor="$border"
        backgroundColor="$backgroundSecondary"
      >
        <Text fontSize={15} fontWeight="600" color="$color">
          API keys
        </Text>
        {data.keys.length ? (
          data.keys.map((key) => (
            <XStack
              key={key.id}
              justifyContent="space-between"
              alignItems="center"
              gap="$md"
              padding="$sm"
              borderWidth={1}
              borderColor="$border"
              borderRadius="$md"
              backgroundColor="$background"
            >
              <YStack flex={1}>
                <Text fontSize={14} color="$color">
                  {key.name}
                </Text>
                <Text fontSize={12} color="$textMuted">
                  Prefix: {key.keyPrefix}
                </Text>
                <Text fontSize={12} color="$textMuted">
                  Uses: {key.usageCount} • Last used: {formatDate(key.lastUsedAt)}
                </Text>
              </YStack>
              {canManageKeys && (
                <Button
                  size="$2"
                  backgroundColor="$red10"
                  color="$background"
                  onPress={() => revokeKey(key.id)}
                  disabled={revokingId === key.id}
                >
                  {revokingId === key.id ? "Revoking..." : "Revoke"}
                </Button>
              )}
            </XStack>
          ))
        ) : (
          <Paragraph color="$textMuted">No active API keys.</Paragraph>
        )}
      </YStack>
    </YStack>
  );
}
