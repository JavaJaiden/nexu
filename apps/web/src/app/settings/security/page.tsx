"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, H1, Input, Paragraph, Text, XStack, YStack } from "tamagui";

type SecuritySession = {
  id: string;
  label: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  lastActiveAt: string;
};

type SecurityConnection = {
  id: string;
  provider: string;
  connectedAt: string;
};

type SecurityData = {
  mfaEnabled: boolean;
  sessions: SecuritySession[];
  connections: SecurityConnection[];
};

export default function SettingsSecurityPage() {
  const [loading, setLoading] = useState(true);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingMfa, setSavingMfa] = useState(false);
  const [security, setSecurity] = useState<SecurityData | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const hasGoogleConnection = useMemo(
    () => Boolean(security?.connections.some((entry) => entry.provider === "google")),
    [security?.connections]
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/settings/security", { cache: "no-store" });
        const data = (await res.json()) as SecurityData & { error?: string };
        if (!res.ok) throw new Error(data.error || "Failed to load security settings.");
        if (cancelled) return;
        setSecurity({
          mfaEnabled: Boolean(data.mfaEnabled),
          sessions: Array.isArray(data.sessions) ? data.sessions : [],
          connections: Array.isArray(data.connections) ? data.connections : [],
        });
      } catch (error) {
        if (cancelled) return;
        setNotice({
          kind: "error",
          text: error instanceof Error ? error.message : "Failed to load security settings.",
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

  const changePassword = async () => {
    if (!currentPassword || !newPassword) {
      setNotice({ kind: "error", text: "Current and new password are required." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotice({ kind: "error", text: "New password confirmation does not match." });
      return;
    }
    setSavingPassword(true);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update password.");
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice({ kind: "success", text: "Password updated." });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to update password.",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const toggleMfa = async () => {
    if (!security) return;
    const next = !security.mfaEnabled;
    setSavingMfa(true);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaEnabled: next }),
      });
      const data = (await res.json()) as { mfaEnabled?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to update MFA.");
      setSecurity((prev) => (prev ? { ...prev, mfaEnabled: Boolean(data.mfaEnabled) } : prev));
      setNotice({ kind: "success", text: `MFA ${next ? "enabled" : "disabled"}.` });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to update MFA.",
      });
    } finally {
      setSavingMfa(false);
    }
  };

  const revoke = async (sessionId: string) => {
    setNotice(null);
    try {
      const res = await fetch(`/api/settings/security/sessions/${sessionId}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to revoke session.");
      }
      setSecurity((prev) =>
        prev ? { ...prev, sessions: prev.sessions.filter((entry) => entry.id !== sessionId) } : prev
      );
      setNotice({ kind: "success", text: "Session signed out." });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to revoke session.",
      });
    }
  };

  if (loading) {
    return (
      <YStack gap="$sm">
        <H1 fontSize={28}>Security</H1>
        <Paragraph color="$textMuted">Loading security settings...</Paragraph>
      </YStack>
    );
  }

  return (
    <YStack gap="$lg">
      <YStack gap="$xs">
        <H1 fontSize={28} color="$color">
          Security
        </H1>
        <Paragraph color="$textMuted">
          Manage your password, session access, and security preferences.
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
        <Text fontSize={16} fontWeight="600" color="$color">
          Change password
        </Text>
        <Input
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          placeholder="Current password"
          backgroundColor="$background"
          borderColor="$border"
        />
        <Input
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="New password"
          backgroundColor="$background"
          borderColor="$border"
        />
        <Input
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Confirm new password"
          backgroundColor="$background"
          borderColor="$border"
        />
        <Button
          size="$3"
          alignSelf="flex-start"
          backgroundColor="$color"
          color="$background"
          onPress={changePassword}
          disabled={savingPassword}
        >
          {savingPassword ? "Saving..." : "Update password"}
        </Button>
      </YStack>

      <YStack
        gap="$md"
        padding="$lg"
        borderRadius="$lg"
        borderWidth={1}
        borderColor="$border"
        backgroundColor="$backgroundSecondary"
      >
        <Text fontSize={16} fontWeight="600" color="$color">
          Multi-factor authentication
        </Text>
        <Paragraph color="$textMuted">
          Use an authenticator app to add another layer of account protection.
        </Paragraph>
        <Button
          size="$3"
          alignSelf="flex-start"
          backgroundColor={security?.mfaEnabled ? "$red10" : "$color"}
          color="$background"
          onPress={toggleMfa}
          disabled={savingMfa || !security}
        >
          {savingMfa
            ? "Updating..."
            : security?.mfaEnabled
              ? "Disable MFA"
              : "Enable MFA"}
        </Button>
      </YStack>

      <YStack
        gap="$md"
        padding="$lg"
        borderRadius="$lg"
        borderWidth={1}
        borderColor="$border"
        backgroundColor="$backgroundSecondary"
      >
        <Text fontSize={16} fontWeight="600" color="$color">
          Connected accounts
        </Text>
        <XStack
          justifyContent="space-between"
          alignItems="center"
          padding="$sm"
          borderRadius="$md"
          borderWidth={1}
          borderColor="$border"
          backgroundColor="$background"
        >
          <YStack>
            <Text fontSize={14} color="$color">
              Google
            </Text>
            <Text fontSize={12} color="$textMuted">
              {hasGoogleConnection ? "Connected" : "Not connected"}
            </Text>
          </YStack>
          <Button size="$2" disabled>
            {hasGoogleConnection ? "Connected" : "Connection managed by auth provider"}
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
        <Text fontSize={16} fontWeight="600" color="$color">
          Active sessions
        </Text>
        {security?.sessions.length ? (
          security.sessions.map((session) => (
            <XStack
              key={session.id}
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
                  {session.label}
                </Text>
                <Text fontSize={12} color="$textMuted">
                  Last active {new Date(session.lastActiveAt).toLocaleString()}
                </Text>
              </YStack>
              <Button
                size="$2"
                backgroundColor="$red10"
                color="$background"
                onPress={() => revoke(session.id)}
              >
                Sign out
              </Button>
            </XStack>
          ))
        ) : (
          <Paragraph color="$textMuted">No active sessions found.</Paragraph>
        )}
      </YStack>
    </YStack>
  );
}
