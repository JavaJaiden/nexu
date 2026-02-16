import { UserProfile } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Paragraph, Text, YStack } from "tamagui";

export default async function PhoneRequiredPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const nextPath =
    typeof params?.returnTo === "string" && params.returnTo.startsWith("/")
      ? params.returnTo
      : "/dashboard";

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
