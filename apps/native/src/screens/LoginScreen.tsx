import { useAuth, useOAuth } from "@clerk/clerk-expo";
import { useEffect } from "react";
import { Alert, Image } from "react-native";
import { Button, H1, Paragraph, Separator, Text, XStack, YStack } from "tamagui";

const LoginScreen = ({ navigation }: { navigation: any }) => {
  const { isSignedIn } = useAuth();

  const { startOAuthFlow: startGoogleAuthFlow } = useOAuth({
    strategy: "oauth_google",
  });
  const { startOAuthFlow: startAppleAuthFlow } = useOAuth({
    strategy: "oauth_apple",
  });

  useEffect(() => {
    if (isSignedIn) {
      navigation.navigate("NotesDashboardScreen");
    }
  }, [isSignedIn, navigation]);

  const onPress = async (authType: string) => {
    try {
      const startFlow =
        authType === "google" ? startGoogleAuthFlow : startAppleAuthFlow;
      const result = await startFlow();
      const { createdSessionId, setActive, signUp } = result;

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        navigation.navigate("NotesDashboardScreen");
      } else if (signUp && signUp.status === "missing_requirements") {
        const { createdSessionId: newSessionId } = await signUp.create({});
        if (newSessionId && setActive) {
          await setActive({ session: newSessionId });
          navigation.navigate("NotesDashboardScreen");
        }
      }
    } catch (err: any) {
      Alert.alert("Error", `Failed to sign in. ${err.message || ""}`);
    }
  };

  return (
    <YStack flex={1} backgroundColor="$background" justifyContent="center" padding="$lg">
      <YStack alignItems="center" marginBottom="$xxl">
        <Image
          source={require("../assets/icons/logo.png")}
          style={{ width: 64, height: 64, borderRadius: 12 }}
          resizeMode="contain"
        />
      </YStack>

      <YStack alignItems="center" marginBottom="$xl">
        <H1 fontSize={28} fontWeight="600" color="$color" marginBottom="$sm">
          Welcome
        </H1>
        <Paragraph fontSize={16} color="$textMuted" textAlign="center">
          Sign in to continue
        </Paragraph>
      </YStack>

      <YStack gap="$md">
        <Button
          size="$5"
          backgroundColor="$color"
          color="$background"
          borderRadius="$md"
          onPress={() => onPress("google")}
          pressStyle={{ opacity: 0.8 }}
        >
          Continue with Google
        </Button>

        <Button
          size="$5"
          backgroundColor="transparent"
          color="$color"
          borderWidth={1}
          borderColor="$border"
          borderRadius="$md"
          onPress={() => onPress("apple")}
          pressStyle={{ opacity: 0.8 }}
        >
          Continue with Apple
        </Button>
      </YStack>

      <XStack alignItems="center" marginVertical="$xl" gap="$md">
        <Separator flex={1} backgroundColor="$border" />
        <Text fontSize={13} color="$textSubtle">
          Secure login
        </Text>
        <Separator flex={1} backgroundColor="$border" />
      </XStack>

      <Paragraph fontSize={13} color="$textSubtle" textAlign="center">
        By continuing, you agree to our Terms and Privacy Policy
      </Paragraph>
    </YStack>
  );
};

export default LoginScreen;
