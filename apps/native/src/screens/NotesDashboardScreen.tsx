import { useUser } from "@clerk/clerk-expo";
import { Plus, Search } from "@tamagui/lucide-icons";
import { api } from "@packages/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { useState } from "react";
import { FlatList, Pressable } from "react-native";
import {
  Avatar,
  Button,
  H2,
  Input,
  Paragraph,
  Text,
  XStack,
  YStack,
} from "tamagui";

const NotesDashboardScreen = ({ navigation }: { navigation: any }) => {
  const user = useUser();
  const imageUrl = user?.user?.imageUrl;
  const firstName = user?.user?.firstName;

  const allNotes = useQuery(api.notes.getNotes);
  const [search, setSearch] = useState("");

  const finalNotes = search
    ? allNotes?.filter(
        (note) =>
          note.title.toLowerCase().includes(search.toLowerCase()) ||
          note.content.toLowerCase().includes(search.toLowerCase())
      )
    : allNotes;

  const renderItem = ({
    item,
  }: {
    item: NonNullable<typeof allNotes>[number];
  }) => (
    <Pressable
      onPress={() => navigation.navigate("InsideNoteScreen", { item })}
    >
      <YStack
        paddingVertical="$md"
        paddingHorizontal="$lg"
        borderBottomWidth={1}
        borderBottomColor="$border"
      >
        <Text fontSize={16} fontWeight="500" color="$color" numberOfLines={1}>
          {item.title}
        </Text>
        <Paragraph
          fontSize={14}
          color="$textMuted"
          numberOfLines={2}
          marginTop="$xs"
        >
          {item.content}
        </Paragraph>
        {item.summary && (
          <Text fontSize={12} color="$textSubtle" marginTop="$xs">
            AI summary available
          </Text>
        )}
      </YStack>
    </Pressable>
  );

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Header */}
      <XStack
        paddingHorizontal="$lg"
        paddingVertical="$md"
        alignItems="center"
        justifyContent="space-between"
        borderBottomWidth={1}
        borderBottomColor="$border"
      >
        <YStack>
          <Text fontSize={13} color="$textSubtle">
            Welcome back
          </Text>
          <H2 fontSize={20} fontWeight="600" color="$color">
            {firstName || "Notes"}
          </H2>
        </YStack>
        {imageUrl ? (
          <Avatar circular size="$3">
            <Avatar.Image src={imageUrl} />
            <Avatar.Fallback backgroundColor="$backgroundSecondary" />
          </Avatar>
        ) : (
          <YStack
            width={36}
            height={36}
            borderRadius={18}
            backgroundColor="$backgroundSecondary"
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize={16} fontWeight="500" color="$color">
              {firstName?.[0] || "U"}
            </Text>
          </YStack>
        )}
      </XStack>

      {/* Search */}
      <XStack
        paddingHorizontal="$lg"
        paddingVertical="$md"
        alignItems="center"
        gap="$sm"
        borderBottomWidth={1}
        borderBottomColor="$border"
      >
        <Search size={18} color="$textSubtle" />
        <Input
          flex={1}
          value={search}
          onChangeText={setSearch}
          placeholder="Search notes..."
          placeholderTextColor="$textSubtle"
          backgroundColor="transparent"
          borderWidth={0}
          fontSize={15}
          color="$color"
          padding={0}
        />
      </XStack>

      {/* Notes List */}
      {!finalNotes || finalNotes.length === 0 ? (
        <YStack flex={1} alignItems="center" justifyContent="center" padding="$xl">
          <H2 fontSize={18} fontWeight="500" color="$color">
            No notes yet
          </H2>
          <Paragraph fontSize={14} color="$textMuted" marginTop="$sm">
            Tap + to create your first note
          </Paragraph>
        </YStack>
      ) : (
        <FlatList
          data={finalNotes}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <Button
        position="absolute"
        bottom={30}
        right={24}
        width={56}
        height={56}
        borderRadius={28}
        backgroundColor="$color"
        pressStyle={{ opacity: 0.8 }}
        onPress={() => navigation.navigate("CreateNoteScreen")}
      >
        <Plus size={24} color="#fff" />
      </Button>
    </YStack>
  );
};

export default NotesDashboardScreen;
