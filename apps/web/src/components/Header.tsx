"use client";

import { useUser, SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Text, XStack, YStack, Avatar } from "tamagui";
import { LogOut, Moon, Sun } from "lucide-react";
import { useThemeSetting } from "@/lib/themeContext";

export default function Header() {
  const { user } = useUser();
  const pathname = usePathname();
  const { theme, setTheme } = useThemeSetting();
  const navItems = [
    { label: "Studio", href: "/studio" },
    { label: "Model Hub", href: "/models" },
    { label: "Laboratory", href: "/lab" },
  ];

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
          Nexus
        </Text>
      </Link>

      <XStack alignItems="center" gap="$md">
        <XStack alignItems="center" gap="$md" display="flex" flexWrap="wrap">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <Text
                  fontSize={14}
                  fontWeight={isActive ? "600" : "400"}
                  color={isActive ? "$color" : "$textMuted"}
                >
                  {item.label}
                </Text>
              </Link>
            );
          })}
        </XStack>

        {user ? (
          <>
            {pathname !== "/studio" && (
              <Link href="/studio">
                <Button
                  size="$3"
                  backgroundColor="$color"
                  color="$background"
                  borderRadius="$sm"
                  pressStyle={{ opacity: 0.8 }}
                >
                  Studio
                </Button>
              </Link>
            )}
            <Button
              size="$3"
              backgroundColor="transparent"
              borderWidth={1}
              borderColor="$border"
              borderRadius="$sm"
              onPress={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={16} color="#f5f5f5" /> : <Moon size={16} color="#111" />}
            </Button>
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
            <Button
              size="$3"
              backgroundColor="transparent"
              borderWidth={1}
              borderColor="$border"
              borderRadius="$sm"
              onPress={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={16} color="#f5f5f5" /> : <Moon size={16} color="#111" />}
            </Button>
            <Link href="/studio">
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
            <Link href="/studio">
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
