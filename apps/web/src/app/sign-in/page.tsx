"use client";

import { SignIn } from "@clerk/nextjs";
import { YStack } from "tamagui";

export default function SignInPage() {
  return (
    <YStack
      flex={1}
      backgroundColor="$background"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
    >
      <SignIn
        appearance={{
          elements: {
            rootBox: {
              width: "100%",
              maxWidth: "400px",
            },
          },
        }}
      />
    </YStack>
  );
}
