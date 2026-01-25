import { createAnimations } from "@tamagui/animations-react-native";
import { createInterFont } from "@tamagui/font-inter";
import { createMedia } from "@tamagui/react-native-media-driver";
import { shorthands } from "@tamagui/shorthands";
import { themes, tokens as defaultTokens } from "@tamagui/themes";
import { createTamagui, createTokens } from "tamagui";

const animations = createAnimations({
  fast: {
    type: "spring",
    damping: 20,
    mass: 1,
    stiffness: 300,
  },
  medium: {
    type: "spring",
    damping: 15,
    mass: 1,
    stiffness: 200,
  },
  slow: {
    type: "spring",
    damping: 20,
    stiffness: 100,
  },
});

const headingFont = createInterFont({
  size: {
    1: 12,
    2: 14,
    3: 16,
    4: 18,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 40,
    10: 48,
  },
  weight: {
    1: "400",
    2: "500",
    3: "600",
    4: "700",
  },
  face: {
    700: { normal: "InterBold" },
    600: { normal: "InterSemiBold" },
    500: { normal: "InterMedium" },
    400: { normal: "InterRegular" },
  },
});

const bodyFont = createInterFont(
  {
    face: {
      700: { normal: "InterBold" },
      600: { normal: "InterSemiBold" },
      500: { normal: "InterMedium" },
      400: { normal: "InterRegular" },
    },
  },
  {
    sizeSize: (size) => Math.round(size * 1.1),
    sizeLineHeight: (size) => Math.round(size * 1.5),
  }
);

const customTokens = createTokens({
  ...defaultTokens,
  color: {
    ...defaultTokens.color,
    // Light backgrounds
    background: "#ffffff",
    backgroundSecondary: "#f8f8f8",

    // Accent
    accent: "#000000",
    accentMuted: "#666666",

    // Text
    text: "#000000",
    textMuted: "#666666",
    textSubtle: "#999999",

    // Borders
    border: "#e5e5e5",
    borderStrong: "#d4d4d4",

    // Status
    success: "#22c55e",
    error: "#ef4444",
  },
  space: {
    ...defaultTokens.space,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    ...defaultTokens.radius,
    sm: 6,
    md: 10,
    lg: 14,
    full: 9999,
  },
});

const lightTheme = {
  background: customTokens.color.background,
  backgroundHover: customTokens.color.backgroundSecondary,
  backgroundPress: customTokens.color.backgroundSecondary,
  backgroundFocus: customTokens.color.backgroundSecondary,
  backgroundTransparent: "transparent",

  color: customTokens.color.text,
  colorHover: customTokens.color.text,
  colorPress: customTokens.color.textMuted,
  colorFocus: customTokens.color.text,

  borderColor: customTokens.color.border,
  borderColorHover: customTokens.color.borderStrong,
  borderColorFocus: customTokens.color.accent,

  placeholderColor: customTokens.color.textSubtle,

  accent: customTokens.color.accent,
  accentMuted: customTokens.color.accentMuted,
  textMuted: customTokens.color.textMuted,
  textSubtle: customTokens.color.textSubtle,
  border: customTokens.color.border,
  borderStrong: customTokens.color.borderStrong,
  backgroundSecondary: customTokens.color.backgroundSecondary,
  success: customTokens.color.success,
  error: customTokens.color.error,
};

const config = createTamagui({
  defaultTheme: "light",
  shouldAddPrefersColorThemes: false,
  themeClassNameOnRoot: true,
  shorthands,
  fonts: {
    heading: headingFont,
    body: bodyFont,
  },
  themes: {
    ...themes,
    light: lightTheme,
  },
  tokens: customTokens,
  animations,
  media: createMedia({
    xs: { maxWidth: 660 },
    sm: { maxWidth: 800 },
    md: { maxWidth: 1020 },
    lg: { maxWidth: 1280 },
  }),
});

export default config;

export type AppConfig = typeof config;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppConfig {}
}
