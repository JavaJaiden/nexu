"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, H1, Input, Paragraph, Text, XStack, YStack } from "tamagui";

type OrganizationMembership = {
  role: "owner" | "admin" | "member";
  organization: {
    id: string;
    name: string;
    slug: string;
  };
};

type BillingResponse = {
  organization: {
    id: string;
    name: string;
    currentPlan?: "free" | "pro" | "enterprise";
    billingEmail?: string;
    billingAddress?: string;
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
  transactions: Array<{
    id: string;
    amountCents: number;
    type: "usage" | "reload" | "manual";
    createdAt: string;
    description?: string;
  }>;
};

function centsToDollars(value: number) {
  return (value / 100).toFixed(2);
}

function toCents(value: string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.round(numberValue * 100);
}

export default function OrganizationBillingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<"portal" | "checkout" | "credits" | null>(null);
  const [data, setData] = useState<BillingResponse | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const [plan, setPlan] = useState<"free" | "pro" | "enterprise">("free");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [autoReloadEnabled, setAutoReloadEnabled] = useState(false);
  const [reloadThreshold, setReloadThreshold] = useState("10");
  const [reloadAmount, setReloadAmount] = useState("25");
  const [monthlyMax, setMonthlyMax] = useState("500");
  const [manualCredit, setManualCredit] = useState("25");
  const [priceId, setPriceId] = useState("");

  const canManageBilling = useMemo(() => data?.role === "owner", [data?.role]);

  const hydrate = useCallback((payload: BillingResponse) => {
    setData(payload);
    setSelectedOrganizationId(payload.selectedOrganizationId);
    setPlan(payload.organization.currentPlan ?? "free");
    setBillingEmail(payload.organization.billingEmail ?? "");
    setBillingAddress(payload.organization.billingAddress ?? "");
    setAutoReloadEnabled(Boolean(payload.creditAccount.autoReloadEnabled));
    setReloadThreshold(centsToDollars(payload.creditAccount.reloadThresholdCents));
    setReloadAmount(centsToDollars(payload.creditAccount.reloadAmountCents));
    setMonthlyMax(centsToDollars(payload.creditAccount.monthlyMaxCents));
  }, []);

  const load = useCallback(
    async (organizationId?: string) => {
      const query = organizationId
        ? `?organizationId=${encodeURIComponent(organizationId)}`
        : "";
      const res = await fetch(`/api/settings/organization/billing${query}`, {
        cache: "no-store",
      });
      const payload = (await res.json()) as BillingResponse & { error?: string };
      if (!res.ok) throw new Error(payload.error || "Failed to load billing settings.");
      hydrate(payload);
    },
    [hydrate]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (error) {
        if (!cancelled) {
          setNotice({
            kind: "error",
            text: error instanceof Error ? error.message : "Failed to load billing settings.",
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

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/organization/billing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: data.organization.id,
          currentPlan: plan,
          billingEmail,
          billingAddress,
          autoReloadEnabled,
          reloadThresholdCents: toCents(reloadThreshold),
          reloadAmountCents: toCents(reloadAmount),
          monthlyMaxCents: toCents(monthlyMax),
        }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to save billing settings.");
      }
      await load(data.organization.id);
      setNotice({ kind: "success", text: "Billing settings updated." });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to save billing settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const openPortal = async () => {
    if (!data) return;
    setActing("portal");
    setNotice(null);
    try {
      const res = await fetch("/api/settings/organization/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: data.organization.id,
          action: "stripe_portal",
        }),
      });
      const payload = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !payload.ok) throw new Error(payload.error || "Failed to open billing portal.");
      if (payload.url) {
        window.location.href = payload.url;
      } else {
        setNotice({ kind: "error", text: "Stripe portal URL was not returned." });
      }
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to open billing portal.",
      });
    } finally {
      setActing(null);
    }
  };

  const startCheckout = async () => {
    if (!data) return;
    if (!priceId.trim()) {
      setNotice({ kind: "error", text: "Stripe price ID is required to upgrade plan." });
      return;
    }
    setActing("checkout");
    setNotice(null);
    try {
      const res = await fetch("/api/settings/organization/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: data.organization.id,
          action: "stripe_checkout",
          priceId: priceId.trim(),
        }),
      });
      const payload = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !payload.ok) throw new Error(payload.error || "Failed to start checkout.");
      if (payload.url) {
        window.location.href = payload.url;
      } else {
        setNotice({ kind: "error", text: "Stripe checkout URL was not returned." });
      }
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to start checkout.",
      });
    } finally {
      setActing(null);
    }
  };

  const addCredits = async () => {
    if (!data) return;
    setActing("credits");
    setNotice(null);
    try {
      const amountCents = toCents(manualCredit);
      if (amountCents <= 0) {
        throw new Error("Manual credit amount must be greater than zero.");
      }
      const res = await fetch("/api/settings/organization/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: data.organization.id,
          action: "manual_credit",
          amountCents,
          description: "Manual credit purchase",
        }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) throw new Error(payload.error || "Failed to add credits.");
      await load(data.organization.id);
      setNotice({ kind: "success", text: "Credits added." });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to add credits.",
      });
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <YStack gap="$sm">
        <H1 fontSize={28}>Organization: Billing</H1>
        <Paragraph color="$textMuted">Loading billing settings...</Paragraph>
      </YStack>
    );
  }

  if (!data) {
    return (
      <YStack gap="$sm">
        <H1 fontSize={28}>Organization: Billing</H1>
        <Paragraph color="$textMuted">No organization found for this account.</Paragraph>
      </YStack>
    );
  }

  return (
    <YStack gap="$lg">
      <YStack gap="$xs">
        <H1 fontSize={28} color="$color">
          Organization: Billing
        </H1>
        <Paragraph color="$textMuted">
          Manage plan, credit balance, and auto-reload settings.
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

        <XStack
          justifyContent="space-between"
          alignItems="center"
          padding="$sm"
          borderRadius="$md"
          borderWidth={1}
          borderColor="$border"
          backgroundColor="$background"
        >
          <Text fontSize={14} color="$color">
            Credit balance
          </Text>
          <Text fontSize={16} fontWeight="700" color="$color">
            ${centsToDollars(data.creditAccount.balanceCents)}
          </Text>
        </XStack>

        <XStack gap="$sm" flexWrap="wrap" alignItems="center">
          <Text fontSize={13} color="$textMuted">
            Plan
          </Text>
          <select
            value={plan}
            onChange={(event) => setPlan(event.currentTarget.value as "free" | "pro" | "enterprise")}
            disabled={!canManageBilling}
            style={{ padding: 10, borderRadius: 8, border: "1px solid var(--border)" }}
          >
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </XStack>

        <Input
          value={billingEmail}
          onChangeText={setBillingEmail}
          placeholder="Billing email"
          backgroundColor="$background"
          borderColor="$border"
          disabled={!canManageBilling}
        />
        <Input
          value={billingAddress}
          onChangeText={setBillingAddress}
          placeholder="Billing address"
          backgroundColor="$background"
          borderColor="$border"
          disabled={!canManageBilling}
        />

        <XStack gap="$sm" flexWrap="wrap" alignItems="center">
          <input
            type="checkbox"
            checked={autoReloadEnabled}
            onChange={(event) => setAutoReloadEnabled(event.currentTarget.checked)}
            disabled={!canManageBilling}
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
            placeholder="Reload threshold ($)"
            backgroundColor="$background"
            borderColor="$border"
            width={220}
            disabled={!canManageBilling}
          />
          <Input
            value={reloadAmount}
            onChangeText={setReloadAmount}
            placeholder="Reload amount ($)"
            backgroundColor="$background"
            borderColor="$border"
            width={220}
            disabled={!canManageBilling}
          />
          <Input
            value={monthlyMax}
            onChangeText={setMonthlyMax}
            placeholder="Monthly max ($)"
            backgroundColor="$background"
            borderColor="$border"
            width={220}
            disabled={!canManageBilling}
          />
        </XStack>

        <XStack gap="$sm" flexWrap="wrap">
          <Button
            size="$3"
            backgroundColor="$color"
            color="$background"
            onPress={save}
            disabled={!canManageBilling || saving}
          >
            {saving ? "Saving..." : "Save billing settings"}
          </Button>
          <Button
            size="$3"
            backgroundColor="$background"
            borderWidth={1}
            borderColor="$border"
            onPress={openPortal}
            disabled={!canManageBilling || acting === "portal"}
          >
            {acting === "portal" ? "Opening..." : "Open Stripe portal"}
          </Button>
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
          Upgrade plan
        </Text>
        <Input
          value={priceId}
          onChangeText={setPriceId}
          placeholder="Stripe price id (e.g. price_...)"
          backgroundColor="$background"
          borderColor="$border"
          disabled={!canManageBilling}
        />
        <Button
          size="$3"
          alignSelf="flex-start"
          backgroundColor="$color"
          color="$background"
          onPress={startCheckout}
          disabled={!canManageBilling || acting === "checkout"}
        >
          {acting === "checkout" ? "Starting..." : "Upgrade plan"}
        </Button>
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
          Add manual credits
        </Text>
        <XStack gap="$sm" alignItems="center" flexWrap="wrap">
          <Input
            value={manualCredit}
            onChangeText={setManualCredit}
            placeholder="Amount in dollars"
            backgroundColor="$background"
            borderColor="$border"
            width={220}
            disabled={!canManageBilling}
          />
          <Button
            size="$3"
            backgroundColor="$color"
            color="$background"
            onPress={addCredits}
            disabled={!canManageBilling || acting === "credits"}
          >
            {acting === "credits" ? "Adding..." : "Add credits"}
          </Button>
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
          Transaction history
        </Text>
        {data.transactions.length ? (
          data.transactions.map((transaction) => (
            <XStack
              key={transaction.id}
              justifyContent="space-between"
              alignItems="center"
              gap="$md"
              padding="$sm"
              borderRadius="$md"
              borderWidth={1}
              borderColor="$border"
              backgroundColor="$background"
            >
              <YStack flex={1}>
                <Text fontSize={13} color="$color">
                  {transaction.description || transaction.type}
                </Text>
                <Text fontSize={11} color="$textMuted">
                  {new Date(transaction.createdAt).toLocaleString()}
                </Text>
              </YStack>
              <Text
                fontSize={13}
                color={transaction.amountCents >= 0 ? "$success" : "$error"}
                fontWeight="600"
              >
                {transaction.amountCents >= 0 ? "+" : "-"}$
                {centsToDollars(Math.abs(transaction.amountCents))}
              </Text>
            </XStack>
          ))
        ) : (
          <Paragraph color="$textMuted">No transactions yet.</Paragraph>
        )}
      </YStack>
    </YStack>
  );
}
