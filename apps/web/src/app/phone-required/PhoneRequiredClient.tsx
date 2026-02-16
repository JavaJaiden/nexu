"use client";

import { UserProfile, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Button, Paragraph, Text, YStack } from "tamagui";

export default function PhoneRequiredClient() {
  const { isLoaded, userId } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => {
    const returnTo = searchParams.get("returnTo");
    return typeof returnTo === "string" && returnTo.startsWith("/")
      ? returnTo
      : "/dashboard";
  }, [searchParams]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      router.replace("/sign-in");
    }
  }, [isLoaded, userId, router]);

  if (!isLoaded || !userId) {
    return null;
  }

  return (
    <YStack
      flex={1}
      minHeight="100vh"
      backgroundColor="$background"
      alignItems="center"
      justifyContent="center"
      padding="$lg"
      gap="$md"
    >
      <Text fontSize={24} fontWeight="700" color="$color">
        Phone Number Required
      </Text>
      <Paragraph
        fontSize={14}
        color="$textMuted"
        maxWidth={680}
        textAlign="center"
      >
        Add and verify a phone number to continue using Nexu.
      </Paragraph>

      <YStack
        width="100%"
        maxWidth={820}
        borderWidth={1}
        borderColor="$border"
        borderRadius="$md"
      >
        <UserProfile />
      </YStack>

      <Link href={nextPath}>
        <Button size="$4">Continue</Button>
      </Link>
    </YStack>
  );
}
