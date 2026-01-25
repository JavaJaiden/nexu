"use client";

import Header from "@/components/Header";
import Notes from "@/components/notes/Notes";
import { YStack } from "tamagui";

export default function NotesPage() {
  return (
    <YStack flex={1} backgroundColor="$background" minHeight="100vh">
      <Header />
      <Notes />
    </YStack>
  );
}
