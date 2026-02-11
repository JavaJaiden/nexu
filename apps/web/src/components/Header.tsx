"use client";

import { useUser, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Text, XStack } from "tamagui";
import { FlaskConical, LayoutDashboard, Moon, Sun, Database } from "lucide-react";
import { useThemeSetting } from "@/lib/themeContext";
import ProfileDropdown from "@/components/ProfileDropdown";

export default function Header() {
  const { isLoaded } = useUser();
  const { isSignedIn } = useAuth();
  const pathname = usePathname();
  const { theme, setTheme } = useThemeSetting();
  const navItems = [
    { label: "Studio", href: "/studio", icon: LayoutDashboard },
    { label: "Model Hub", href: "/models", icon: Database },
    { label: "Laboratory", href: "/lab", icon: FlaskConical },
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
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <XStack
                  alignItems="center"
                  gap="$xs"
                >
                  <Icon size={16} />
                  <Text
                    fontSize={14}
                    fontWeight={isActive ? "600" : "400"}
                    color={isActive ? "$color" : "$textMuted"}
                  >
                    {item.label}
                  </Text>
                </XStack>
              </Link>
            );
          })}
        </XStack>

        {!isLoaded ? (
          // Loading state - show minimal header
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
          </XStack>
        ) : isSignedIn ? (
          <>
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
            <ProfileDropdown />
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
            <Link href="/sign-in">
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
            <Link href="/sign-up">
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
