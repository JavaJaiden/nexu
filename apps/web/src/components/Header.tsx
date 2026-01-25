"use client";

import { useUser, SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Text, XStack, YStack, Avatar } from "tamagui";
import { LogOut } from "lucide-react";

export default function Header() {
  const { user } = useUser();
  const pathname = usePathname();

  return (
    <XStack
      paddingHorizontal="$lg"
      paddingVertical="$md"
      alignItems="center"
      justifyContent="space-between"
      borderBottomWidth={1}
      borderBottomColor="$border"
      backgroundColor="$background"
    >
      <Link href="/" style={{ textDecoration: "none" }}>
        <Text fontSize={20} fontWeight="600" color="$color">
          Notes
        </Text>
      </Link>

      <XStack alignItems="center" gap="$md">
        {user ? (
          <>
            {pathname !== "/notes" && (
              <Link href="/notes">
                <Button
                  size="$3"
                  backgroundColor="$color"
                  color="$background"
                  borderRadius="$sm"
                  pressStyle={{ opacity: 0.8 }}
                >
                  My Notes
                </Button>
              </Link>
            )}
            <XStack alignItems="center" gap="$sm">
              {user.imageUrl ? (
                <Avatar circular size="$3">
                  <Avatar.Image src={user.imageUrl} />
                  <Avatar.Fallback backgroundColor="$backgroundSecondary" />
                </Avatar>
              ) : (
                <YStack
                  width={32}
                  height={32}
                  borderRadius={16}
                  backgroundColor="$backgroundSecondary"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text fontSize={14} fontWeight="500" color="$color">
                    {user.firstName?.[0] || "U"}
                  </Text>
                </YStack>
              )}
              <SignOutButton>
                <Button
                  size="$3"
                  backgroundColor="transparent"
                  borderWidth={0}
                  paddingHorizontal="$sm"
                >
                  <LogOut size={18} color="#666" />
                </Button>
              </SignOutButton>
            </XStack>
          </>
        ) : (
          <XStack gap="$sm">
            <Link href="/notes">
              <Button
                size="$3"
                backgroundColor="transparent"
                color="$color"
                borderWidth={1}
                borderColor="$border"
                borderRadius="$sm"
                pressStyle={{ opacity: 0.8 }}
              >
                Sign in
              </Button>
            </Link>
            <Link href="/notes">
              <Button
                size="$3"
                backgroundColor="$color"
                color="$background"
                borderRadius="$sm"
                pressStyle={{ opacity: 0.8 }}
              >
                Get Started
              </Button>
            </Link>
          </XStack>
        )}
      </XStack>
    </XStack>
  );
}
