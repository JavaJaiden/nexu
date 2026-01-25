"use client";

import type { Id } from "@packages/backend/convex/_generated/dataModel";
import Header from "@/components/Header";
import NoteDetails from "@/components/notes/NoteDetails";
import { YStack } from "tamagui";
import { useParams } from "next/navigation";

export default function Page() {
  const params = useParams();
  const slug = params.slug as string;

  return (
    <YStack flex={1} backgroundColor="$background" minHeight="100vh">
      <Header />
      <NoteDetails noteId={slug as Id<"notes">} />
    </YStack>
  );
}
