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

type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  address?: string;
  website?: string;
  socialLinks?: string[];
  billingEmail?: string;
  billingAddress?: string;
};

type GeneralResponse = {
  organization: OrganizationRecord;
  role: "owner" | "admin" | "member";
  memberships: OrganizationMembership[];
  selectedOrganizationId: string;
};

export default function OrganizationGeneralPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [data, setData] = useState<GeneralResponse | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>("");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [socialLinksInput, setSocialLinksInput] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingAddress, setBillingAddress] = useState("");

  const canEdit = useMemo(() => data?.role === "owner" || data?.role === "admin", [data?.role]);
  const canDelete = useMemo(() => data?.role === "owner", [data?.role]);

  const hydrateForm = useCallback((payload: GeneralResponse) => {
    setData(payload);
    setSelectedOrganizationId(payload.selectedOrganizationId);
    setName(payload.organization.name ?? "");
    setSlug(payload.organization.slug ?? "");
    setLogoUrl(payload.organization.logoUrl ?? "");
    setAddress(payload.organization.address ?? "");
    setWebsite(payload.organization.website ?? "");
    setSocialLinksInput((payload.organization.socialLinks ?? []).join(", "));
    setBillingEmail(payload.organization.billingEmail ?? "");
    setBillingAddress(payload.organization.billingAddress ?? "");
  }, []);

  const load = useCallback(
    async (organizationId?: string) => {
      const query = organizationId
        ? `?organizationId=${encodeURIComponent(organizationId)}`
        : "";
      const res = await fetch(`/api/settings/organization/general${query}`, {
        cache: "no-store",
      });
      const payload = (await res.json()) as GeneralResponse & { error?: string };
      if (!res.ok) throw new Error(payload.error || "Failed to load organization settings.");
      hydrateForm(payload);
    },
    [hydrateForm]
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
            text: error instanceof Error ? error.message : "Failed to load organization settings.",
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
      const socialLinks = socialLinksInput
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      const res = await fetch("/api/settings/organization/general", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: data.organization.id,
          name,
          slug,
          logoUrl,
          address,
          website,
          socialLinks,
          billingEmail,
          billingAddress,
        }),
      });
      const payload = (await res.json()) as { organization?: OrganizationRecord; error?: string };
      if (!res.ok) throw new Error(payload.error || "Failed to save organization settings.");
      await load(data.organization.id);
      setNotice({ kind: "success", text: "Organization settings updated." });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to save organization settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!data) return;
    if (!window.confirm(`Delete organization "${data.organization.name}"? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/settings/organization/general?organizationId=${encodeURIComponent(data.organization.id)}`,
        { method: "DELETE" }
      );
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to delete organization.");
      }
      await load();
      setNotice({ kind: "success", text: "Organization deleted." });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to delete organization.",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <YStack gap="$sm">
        <H1 fontSize={28}>Organization: General</H1>
        <Paragraph color="$textMuted">Loading organization settings...</Paragraph>
      </YStack>
    );
  }

  if (!data) {
    return (
      <YStack gap="$sm">
        <H1 fontSize={28}>Organization: General</H1>
        <Paragraph color="$textMuted">No organization found for this account.</Paragraph>
      </YStack>
    );
  }

  return (
    <YStack gap="$lg">
      <YStack gap="$xs">
        <H1 fontSize={28} color="$color">
          Organization: General
        </H1>
        <Paragraph color="$textMuted">
          Manage organization identity and basic workspace details.
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

        <Input
          value={name}
          onChangeText={setName}
          placeholder="Organization name"
          backgroundColor="$background"
          borderColor="$border"
          disabled={!canEdit}
        />
        <Input
          value={slug}
          onChangeText={setSlug}
          placeholder="Organization slug"
          backgroundColor="$background"
          borderColor="$border"
          disabled={!canEdit}
        />
        <Input
          value={logoUrl}
          onChangeText={setLogoUrl}
          placeholder="Logo URL"
          backgroundColor="$background"
          borderColor="$border"
          disabled={!canEdit}
        />
        <Input
          value={address}
          onChangeText={setAddress}
          placeholder="Address"
          backgroundColor="$background"
          borderColor="$border"
          disabled={!canEdit}
        />
        <Input
          value={website}
          onChangeText={setWebsite}
          placeholder="Website"
          backgroundColor="$background"
          borderColor="$border"
          disabled={!canEdit}
        />
        <Input
          value={socialLinksInput}
          onChangeText={setSocialLinksInput}
          placeholder="Social links (comma separated)"
          backgroundColor="$background"
          borderColor="$border"
          disabled={!canEdit}
        />
        <Input
          value={billingEmail}
          onChangeText={setBillingEmail}
          placeholder="Billing email"
          backgroundColor="$background"
          borderColor="$border"
          disabled={!canEdit}
        />
        <Input
          value={billingAddress}
          onChangeText={setBillingAddress}
          placeholder="Billing address"
          backgroundColor="$background"
          borderColor="$border"
          disabled={!canEdit}
        />

        <XStack gap="$sm" flexWrap="wrap">
          <Button
            size="$3"
            backgroundColor="$color"
            color="$background"
            onPress={save}
            disabled={!canEdit || saving}
          >
            {saving ? "Saving..." : "Save changes"}
          </Button>
          {canDelete && (
            <Button
              size="$3"
              backgroundColor="$red10"
              color="$background"
              onPress={onDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete organization"}
            </Button>
          )}
        </XStack>

        {!canEdit && (
          <Paragraph color="$textMuted">
            You have read-only access. Ask an owner or admin to make changes.
          </Paragraph>
        )}
      </YStack>
    </YStack>
  );
}
