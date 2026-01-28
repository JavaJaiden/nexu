"use client";

import Header from "@/components/Header";
import Link from "next/link";
import { Button, H1, Paragraph, Text, XStack, YStack } from "tamagui";
import { Sparkles, Layers, Beaker } from "lucide-react";

export default function Home() {
  return (
    <YStack flex={1} backgroundColor="$background" minHeight="100vh">
      <Header />

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
          Nexus Studio
          <br />
          Homework, routed to the best model.
        </H1>
        <Paragraph
          fontSize={18}
          color="$textMuted"
          textAlign="center"
          maxWidth={620}
          marginBottom="$xl"
        >
          Paste a question, get a structured answer, and see exactly which model
          was chosen and why.
        </Paragraph>
        <XStack gap="$sm" flexWrap="wrap" justifyContent="center">
          <Link href="/studio">
            <Button
              size="$5"
              backgroundColor="$color"
              color="$background"
              borderRadius="$md"
              pressStyle={{ opacity: 0.8 }}
            >
              Open Studio
            </Button>
          </Link>
          <Link href="/models">
            <Button
              size="$5"
              backgroundColor="transparent"
              color="$color"
              borderWidth={1}
              borderColor="$border"
              borderRadius="$md"
              pressStyle={{ opacity: 0.8 }}
            >
              Explore Model Hub
            </Button>
          </Link>
        </XStack>
      </YStack>

      <YStack padding="$xl" paddingTop={0}>
        <XStack
          flexWrap="wrap"
          justifyContent="center"
          gap="$lg"
          maxWidth={960}
          marginHorizontal="auto"
        >
          <YStack
            width={280}
            padding="$lg"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$md"
          >
            <Sparkles size={22} color="#000" style={{ marginBottom: 12 }} />
            <Text fontSize={16} fontWeight="600" color="$color" marginBottom="$xs">
              Studio
            </Text>
            <Paragraph fontSize={14} color="$textMuted">
              Auto-route each question to the best model by subject and
              performance.
            </Paragraph>
          </YStack>

          <YStack
            width={280}
            padding="$lg"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$md"
          >
            <Layers size={22} color="#000" style={{ marginBottom: 12 }} />
            <Text fontSize={16} fontWeight="600" color="$color" marginBottom="$xs">
              Model Hub
            </Text>
            <Paragraph fontSize={14} color="$textMuted">
              Compare models by accuracy, latency, and subject strengths.
            </Paragraph>
          </YStack>

          <YStack
            width={280}
            padding="$lg"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$md"
          >
            <Beaker size={22} color="#000" style={{ marginBottom: 12 }} />
            <Text fontSize={16} fontWeight="600" color="$color" marginBottom="$xs">
              Laboratory
            </Text>
            <Paragraph fontSize={14} color="$textMuted">
              Run multiple models in parallel and save your best stacks.
            </Paragraph>
          </YStack>
        </XStack>
      </YStack>

      <XStack
        padding="$lg"
        borderTopWidth={1}
        borderTopColor="$border"
        justifyContent="center"
      >
        <Text fontSize={14} color="$textSubtle">
          Nexus
        </Text>
      </XStack>
    </YStack>
  );
}
