"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, H1, Input, Paragraph, Text, XStack, YStack } from "tamagui";
import Header from "@/components/Header";
import { readResponseError, readResponseJson } from "@/lib/http";

function normalizeInviteEmails(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,;\s]+/)
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

export default function NewOrganizationPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [inviteEmails, setInviteEmails] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const createOrganization = async () => {
    if (!name.trim()) {
      setNotice({ kind: "error", text: "Organization name is required." });
      return;
    }
    setSaving(true);
    setNotice(null);

    try {
      const invites = normalizeInviteEmails(inviteEmails);
      const res = await fetch("/api/settings/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
          invites,
        }),
      });
      const payload = await readResponseJson<{
        ok?: boolean;
        organization?: { id: string; name: string };
        invites?: { attempted: number; invited: string[]; failed: Array<{ email: string; reason: string }> };
        error?: string;
      }>(res);
      if (!res.ok || !payload?.ok || !payload.organization) {
        throw new Error(readResponseError(res, payload, "Failed to create organization."));
      }

      const failedCount = payload.invites?.failed?.length ?? 0;
      if (failedCount > 0) {
        setNotice({
          kind: "success",
          text: `Organization created. ${failedCount} invite(s) could not be sent.`,
        });
      } else {
        setNotice({ kind: "success", text: "Organization created successfully." });
      }

      setTimeout(() => {
        router.push("/organizations");
      }, 400);
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to create organization.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <YStack flex={1} backgroundColor="$background" minHeight="100vh">
      <Header />
      <YStack maxWidth={900} width="100%" marginHorizontal="auto" padding="$lg" gap="$lg">
        <YStack gap="$xs">
          <H1 fontSize={30} color="$color">
            Create Organization
          </H1>
          <Paragraph color="$textMuted">
            Set up a shared organization and invite your friends to collaborate.
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
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Organization name"
            backgroundColor="$background"
            borderColor="$border"
          />
          <Input
            value={slug}
            onChangeText={setSlug}
            placeholder="Slug (optional)"
            backgroundColor="$background"
            borderColor="$border"
          />
          <Input
            value={logoUrl}
            onChangeText={setLogoUrl}
            placeholder="Logo URL (optional)"
            backgroundColor="$background"
            borderColor="$border"
          />
          <YStack gap="$xs">
            <Text fontSize={13} color="$textMuted">
              Invite friends (optional)
            </Text>
            <textarea
              value={inviteEmails}
              onChange={(event) => setInviteEmails(event.currentTarget.value)}
              placeholder="friend1@example.com, friend2@example.com"
              style={{
                minHeight: 110,
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "var(--background)",
                color: "var(--color)",
                padding: 12,
                fontFamily: "inherit",
                fontSize: 14,
              }}
            />
            <Text fontSize={12} color="$textMuted">
              Separate emails with commas, spaces, or new lines.
            </Text>
          </YStack>

          <XStack gap="$sm">
            <Button
              size="$3"
              backgroundColor="$color"
              color="$background"
              onPress={createOrganization}
              disabled={saving}
            >
              {saving ? "Creating..." : "Create organization"}
            </Button>
            <Button
              size="$3"
              backgroundColor="$background"
              borderWidth={1}
              borderColor="$border"
              onPress={() => router.push("/organizations")}
            >
              Cancel
            </Button>
          </XStack>
        </YStack>
      </YStack>
    </YStack>
  );
}
