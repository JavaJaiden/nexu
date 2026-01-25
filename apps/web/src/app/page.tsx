"use client";

import Header from "@/components/Header";
import Link from "next/link";
import { Button, H1, Paragraph, Text, XStack, YStack } from "tamagui";
import { FileText, Sparkles, Zap } from "lucide-react";

export default function Home() {
  return (
    <YStack flex={1} backgroundColor="$background" minHeight="100vh">
      <Header />

      {/* Hero */}
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        padding="$xl"
        paddingTop="$xxl"
      >
        <H1
          fontSize={48}
          fontWeight="700"
          color="$color"
          textAlign="center"
          marginBottom="$md"
        >
          Simple notes.
          <br />
          AI summaries.
        </H1>
        <Paragraph
          fontSize={18}
          color="$textMuted"
          textAlign="center"
          maxWidth={500}
          marginBottom="$xl"
        >
          Write notes, get AI-powered summaries. No clutter, no distractions.
        </Paragraph>
        <Link href="/notes">
          <Button
            size="$5"
            backgroundColor="$color"
            color="$background"
            borderRadius="$md"
            pressStyle={{ opacity: 0.8 }}
          >
            Get Started
          </Button>
        </Link>
      </YStack>

      {/* Features */}
      <YStack padding="$xl" paddingTop={0}>
        <XStack
          flexWrap="wrap"
          justifyContent="center"
          gap="$lg"
          maxWidth={900}
          marginHorizontal="auto"
        >
          <YStack
            width={260}
            padding="$lg"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$md"
          >
            <FileText size={24} color="#000" style={{ marginBottom: 12 }} />
            <Text fontSize={16} fontWeight="600" color="$color" marginBottom="$xs">
              Simple Notes
            </Text>
            <Paragraph fontSize={14} color="$textMuted">
              Create and organize your thoughts with ease.
            </Paragraph>
          </YStack>

          <YStack
            width={260}
            padding="$lg"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$md"
          >
            <Sparkles size={24} color="#000" style={{ marginBottom: 12 }} />
            <Text fontSize={16} fontWeight="600" color="$color" marginBottom="$xs">
              AI Summaries
            </Text>
            <Paragraph fontSize={14} color="$textMuted">
              Get instant AI-generated summaries of your notes.
            </Paragraph>
          </YStack>

          <YStack
            width={260}
            padding="$lg"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$md"
          >
            <Zap size={24} color="#000" style={{ marginBottom: 12 }} />
            <Text fontSize={16} fontWeight="600" color="$color" marginBottom="$xs">
              Fast & Simple
            </Text>
            <Paragraph fontSize={14} color="$textMuted">
              No bloat. Just notes and summaries.
            </Paragraph>
          </YStack>
        </XStack>
      </YStack>

      {/* Footer */}
      <XStack
        padding="$lg"
        borderTopWidth={1}
        borderTopColor="$border"
        justifyContent="center"
      >
        <Text fontSize={14} color="$textSubtle">
          Notes App
        </Text>
      </XStack>
    </YStack>
  );
}
