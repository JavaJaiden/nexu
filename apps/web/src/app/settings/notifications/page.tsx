"use client";

import { useEffect, useState } from "react";
import { Button, H1, Paragraph, Text, XStack, YStack } from "tamagui";

type NotificationSettings = {
  contacts: boolean;
  inbox: boolean;
  weeklySummary: boolean;
  securityEmails: boolean;
  usageAt90: boolean;
  usageExceeded: boolean;
  newsletter: boolean;
  productUpdates: boolean;
};

const DEFAULT_SETTINGS: NotificationSettings = {
  contacts: true,
  inbox: true,
  weeklySummary: true,
  securityEmails: true,
  usageAt90: true,
  usageExceeded: true,
  newsletter: false,
  productUpdates: true,
};

export default function SettingsNotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/settings/notifications", { cache: "no-store" });
        const data = (await res.json()) as {
          settings?: Partial<NotificationSettings>;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Failed to load notification settings.");
        if (cancelled) return;
        setSettings({ ...DEFAULT_SETTINGS, ...(data.settings ?? {}) });
      } catch (error) {
        if (cancelled) return;
        setNotice({
          kind: "error",
          text: error instanceof Error ? error.message : "Failed to load notification settings.",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = (await res.json()) as { settings?: NotificationSettings; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to save notification settings.");
      if (data.settings) setSettings(data.settings);
      setNotice({ kind: "success", text: "Notification preferences updated." });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to save notification settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: keyof NotificationSettings, next: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: next }));
  };

  const sections: Array<{
    id: string;
    title: string;
    description: string;
    rows: Array<{ key: keyof NotificationSettings; label: string; hint: string }>;
  }> = [
    {
      id: "transactional",
      title: "Transactional Emails",
      description: "Critical updates related to account activity and security.",
      rows: [
        {
          key: "contacts",
          label: "Contacts",
          hint: "Contact-related updates for your account and team.",
        },
        {
          key: "inbox",
          label: "Inbox",
          hint: "Important inbox notifications and service messages.",
        },
        {
          key: "weeklySummary",
          label: "Weekly Summary",
          hint: "A weekly digest of activity and usage.",
        },
        {
          key: "securityEmails",
          label: "Security Emails",
          hint: "Security alerts and sign-in changes.",
        },
      ],
    },
    {
      id: "billing",
      title: "Billing Notifications",
      description: "Usage threshold updates and overage warnings.",
      rows: [
        {
          key: "usageAt90",
          label: "Usage at 90%",
          hint: "Get notified when usage reaches 90% of limits.",
        },
        {
          key: "usageExceeded",
          label: "Usage exceeded",
          hint: "Get notified when usage exceeds limits.",
        },
      ],
    },
    {
      id: "marketing",
      title: "Marketing Emails",
      description: "Optional communications about product news and updates.",
      rows: [
        {
          key: "newsletter",
          label: "Newsletter",
          hint: "Product and educational announcements.",
        },
        {
          key: "productUpdates",
          label: "Product updates",
          hint: "Feature launches and release notes.",
        },
      ],
    },
  ];

  if (loading) {
    return (
      <YStack gap="$sm">
        <H1 fontSize={28}>Notifications</H1>
        <Paragraph color="$textMuted">Loading notification settings...</Paragraph>
      </YStack>
    );
  }

  return (
    <YStack gap="$lg">
      <YStack gap="$xs">
        <H1 fontSize={28} color="$color">
          Notifications
        </H1>
        <Paragraph color="$textMuted">
          Choose what you want to hear about and how often.
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

      <YStack gap="$md">
        {sections.map((section) => (
          <YStack
            key={section.id}
            gap="$sm"
            padding="$lg"
            borderRadius="$lg"
            borderWidth={1}
            borderColor="$border"
            backgroundColor="$backgroundSecondary"
          >
            <YStack gap="$xs">
              <Text fontSize={16} fontWeight="600" color="$color">
                {section.title}
              </Text>
              <Text fontSize={12} color="$textMuted">
                {section.description}
              </Text>
            </YStack>

            {section.rows.map((row) => (
              <XStack
                key={row.key}
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
                  <Text fontSize={14} color="$color">
                    {row.label}
                  </Text>
                  <Text fontSize={12} color="$textMuted">
                    {row.hint}
                  </Text>
                </YStack>
                <input
                  type="checkbox"
                  checked={settings[row.key]}
                  onChange={(event) => toggle(row.key, event.currentTarget.checked)}
                  aria-label={row.label}
                />
              </XStack>
            ))}
          </YStack>
        ))}

        <Button
          marginTop="$sm"
          size="$3"
          alignSelf="flex-start"
          backgroundColor="$color"
          color="$background"
          onPress={save}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save preferences"}
        </Button>
      </YStack>
    </YStack>
  );
}
