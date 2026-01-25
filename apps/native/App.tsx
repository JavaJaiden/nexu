import { useFonts } from "expo-font";
import { LogBox, Platform, StatusBar } from "react-native";
import { TamaguiProvider, Theme, View } from "tamagui";
import ConvexClientProvider from "./ConvexClientProvider";
import Navigation from "./src/navigation/Navigation";
import config from "./tamagui.config";

export default function App() {
  LogBox.ignoreLogs(["Warning: ..."]);
  LogBox.ignoreAllLogs();

  const [loaded] = useFonts({
    // Inter fonts for Tamagui
    Inter: require("@tamagui/font-inter/otf/Inter-Medium.otf"),
    InterBold: require("@tamagui/font-inter/otf/Inter-Bold.otf"),
    InterSemiBold: require("@tamagui/font-inter/otf/Inter-SemiBold.otf"),
    InterMedium: require("@tamagui/font-inter/otf/Inter-Medium.otf"),
    InterRegular: require("@tamagui/font-inter/otf/Inter-Regular.otf"),
    InterLight: require("@tamagui/font-inter/otf/Inter-Light.otf"),

    // Legacy font names for compatibility
    Bold: require("./src/assets/fonts/Inter-Bold.ttf"),
    SemiBold: require("./src/assets/fonts/Inter-SemiBold.ttf"),
    Medium: require("./src/assets/fonts/Inter-Medium.ttf"),
    Regular: require("./src/assets/fonts/Inter-Regular.ttf"),

    MBold: require("./src/assets/fonts/Montserrat-Bold.ttf"),
    MSemiBold: require("./src/assets/fonts/Montserrat-SemiBold.ttf"),
    MMedium: require("./src/assets/fonts/Montserrat-Medium.ttf"),
    MRegular: require("./src/assets/fonts/Montserrat-Regular.ttf"),
    MLight: require("./src/assets/fonts/Montserrat-Light.ttf"),
  });

  if (!loaded) {
    return null;
  }

  const STATUS_BAR_HEIGHT =
    Platform.OS === "ios" ? 50 : StatusBar.currentHeight || 0;

  return (
    <TamaguiProvider config={config} defaultTheme="light">
      <Theme name="light">
        <ConvexClientProvider>
          <View flex={1} backgroundColor="$background">
            <View
              height={STATUS_BAR_HEIGHT}
              backgroundColor="$background"
            >
              <StatusBar
                translucent
                backgroundColor="transparent"
                barStyle="dark-content"
              />
            </View>
            <View flex={1}>
              <Navigation />
            </View>
          </View>
        </ConvexClientProvider>
      </Theme>
    </TamaguiProvider>
  );
}
