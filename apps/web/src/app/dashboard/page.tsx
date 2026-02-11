"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, H1, Paragraph, Text, XStack, YStack } from "tamagui";
import { Settings, User } from "lucide-react";
import Header from "@/components/Header";

type ProfileUser = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
};

export default function DashboardPage() {
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/settings/profile", { cache: "no-store" });
        const data = (await res.json()) as { user?: ProfileUser; error?: string };
        if (!res.ok) throw new Error(data.error || "Failed to load dashboard.");
        if (cancelled) return;
        setUser(data.user ?? null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background">
      <Header />
      <YStack maxWidth={980} width="100%" marginHorizontal="auto" padding="$lg" gap="$lg">
        <YStack gap="$xs">
          <H1 fontSize={30} color="$color">
            Dashboard
          </H1>
          <Paragraph color="$textMuted">Your account overview and quick settings access.</Paragraph>
        </YStack>

        <YStack
          gap="$md"
          padding="$lg"
          borderWidth={1}
          borderColor="$border"
          borderRadius="$lg"
          backgroundColor="$backgroundSecondary"
        >
          <XStack alignItems="center" gap="$sm">
            <User size={16} color="currentColor" />
            <Text fontSize={16} fontWeight="600" color="$color">
              Account Summary
            </Text>
          </XStack>
          {loading ? (
            <Text color="$textMuted">Loading...</Text>
          ) : error ? (
            <Text color="$error">{error}</Text>
          ) : (
            <YStack gap="$xs">
              <Text color="$color">{`Name: ${user?.name ?? "Unknown"}`}</Text>
              <Text color="$color">{`Email: ${user?.email ?? "Unknown"}`}</Text>
              <Text color="$color">{`Phone: ${user?.phone ?? "Not set"}`}</Text>
            </YStack>
          )}

          <XStack>
            <Link href="/settings/profile" style={{ textDecoration: "none" }}>
              <Button
                size="$3"
                backgroundColor="$color"
                color="$background"
                icon={<Settings size={14} color="currentColor" />}
              >
                Open Profile Settings
              </Button>
            </Link>
          </XStack>
        </YStack>
      </YStack>
    </YStack>
  );
}
