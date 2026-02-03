"use client";

import { SignUp } from "@clerk/nextjs";
import { YStack } from "tamagui";

export default function SignUpPage() {
  return (
    <YStack
      flex={1}
      backgroundColor="$background"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
    >
      <SignUp
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
