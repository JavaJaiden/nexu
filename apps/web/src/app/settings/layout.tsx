"use client";

import Link from "next/link";
import { User, Shield, Bell, Building2, Users2, CreditCard, KeyRound } from "lucide-react";
import { Text, XStack, YStack } from "tamagui";
import Header from "@/components/Header";

const accountLinks = [
  { href: "/settings/profile", label: "Profile", icon: User },
  { href: "/settings/security", label: "Security", icon: Shield },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
];

const organizationLinks = [
  { href: "/settings/organization/general", label: "General", icon: Building2 },
  { href: "/settings/organization/members", label: "Members", icon: Users2 },
  { href: "/settings/organization/billing", label: "Billing", icon: CreditCard },
  { href: "/settings/organization/api-keys", label: "API Keys", icon: KeyRound },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background">
      <Header />
      <XStack flex={1} maxWidth={1400} width="100%" marginHorizontal="auto" padding="$lg" gap="$lg">
        <YStack
          width={280}
          minWidth={280}
          gap="$lg"
          padding="$md"
          backgroundColor="$backgroundSecondary"
          borderRadius="$lg"
          borderWidth={1}
          borderColor="$border"
          style={{ position: "sticky", top: 24, alignSelf: "flex-start" }}
        >
          <YStack gap="$xs">
            <Text fontSize={13} color="$textMuted" fontWeight="600">
              Account
            </Text>
            {accountLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link href={item.href} key={item.href} style={{ textDecoration: "none" }}>
                  <XStack
                    alignItems="center"
                    gap="$sm"
                    padding="$sm"
                    borderRadius="$md"
                    borderWidth={1}
                    borderColor="$border"
                    backgroundColor="$background"
                  >
                    <Icon size={16} color="currentColor" />
                    <Text fontSize={14} color="$color">
                      {item.label}
                    </Text>
                  </XStack>
                </Link>
              );
            })}
          </YStack>

          <YStack gap="$xs">
            <Text fontSize={13} color="$textMuted" fontWeight="600">
              Organization
            </Text>
            {organizationLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link href={item.href} key={item.href} style={{ textDecoration: "none" }}>
                  <XStack
                    alignItems="center"
                    gap="$sm"
                    padding="$sm"
                    borderRadius="$md"
                    borderWidth={1}
                    borderColor="$border"
                    backgroundColor="$background"
                  >
                    <Icon size={16} color="currentColor" />
                    <Text fontSize={14} color="$color">
                      {item.label}
                    </Text>
                  </XStack>
                </Link>
              );
            })}
          </YStack>
        </YStack>

        <YStack flex={1} gap="$md">
          {children}
        </YStack>
      </XStack>
    </YStack>
  );
}
