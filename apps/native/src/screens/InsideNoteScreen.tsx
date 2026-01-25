import { ArrowLeft } from "@tamagui/lucide-icons";
import { useState } from "react";
import { ScrollView } from "react-native";
import { Button, H2, Paragraph, Text, XStack, YStack } from "tamagui";

export default function InsideNoteScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const { item } = route.params;
  const [activeTab, setActiveTab] = useState<"original" | "summary">("original");

  const hasSummary = !!item.summary;

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Header */}
      <XStack
        paddingHorizontal="$md"
        paddingVertical="$md"
        alignItems="center"
        justifyContent="space-between"
        borderBottomWidth={1}
        borderBottomColor="$border"
      >
        <Button
          size="$3"
          circular
          backgroundColor="transparent"
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={22} color="$color" />
        </Button>
        <H2
          fontSize={17}
          fontWeight="600"
          color="$color"
          numberOfLines={1}
          flex={1}
          textAlign="center"
          paddingHorizontal="$sm"
        >
          {item.title}
        </H2>
        <YStack width={40} />
      </XStack>

      {/* Tab Switcher */}
      <XStack
        marginHorizontal="$lg"
        marginTop="$md"
        backgroundColor="$backgroundSecondary"
        borderRadius="$md"
        padding="$xs"
      >
        <Button
          flex={1}
          size="$3"
          backgroundColor={activeTab === "original" ? "$background" : "transparent"}
          borderRadius="$sm"
          onPress={() => setActiveTab("original")}
        >
          <Text
            fontSize={14}
            fontWeight="500"
            color={activeTab === "original" ? "$color" : "$textMuted"}
          >
            Original
          </Text>
        </Button>

        <Button
          flex={1}
          size="$3"
          backgroundColor={activeTab === "summary" ? "$background" : "transparent"}
          borderRadius="$sm"
          onPress={() => hasSummary && setActiveTab("summary")}
          opacity={hasSummary ? 1 : 0.4}
          disabled={!hasSummary}
        >
          <Text
            fontSize={14}
            fontWeight="500"
            color={activeTab === "summary" ? "$color" : "$textMuted"}
          >
            Summary
          </Text>
        </Button>
      </XStack>

      {/* Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
      >
        {activeTab === "original" ? (
          <YStack>
            <Text fontSize={12} color="$textSubtle" marginBottom="$md">
              Original Content
            </Text>
            <Paragraph fontSize={16} lineHeight={26} color="$color">
              {item.content}
            </Paragraph>
          </YStack>
        ) : (
          <YStack>
            <Text fontSize={12} color="$textSubtle" marginBottom="$md">
              AI Summary
            </Text>
            <Paragraph fontSize={16} lineHeight={26} color="$color">
              {item.summary || "No summary available"}
            </Paragraph>
          </YStack>
        )}
      </ScrollView>
    </YStack>
  );
}
