import { createAnimations } from "@tamagui/animations-css";
import { createInterFont } from "@tamagui/font-inter";
import { shorthands } from "@tamagui/shorthands";
import { themes, tokens as defaultTokens } from "@tamagui/themes";
import { createTamagui, createTokens } from "tamagui";

const animations = createAnimations({
  fast: "ease-out 150ms",
  medium: "ease-out 250ms",
  slow: "ease-out 350ms",
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
});

const bodyFont = createInterFont();

const customTokens = createTokens({
  ...defaultTokens,
  color: {
    ...defaultTokens.color,
    background: "#ffffff",
    backgroundSecondary: "#f8f8f8",
    accent: "#000000",
    accentMuted: "#666666",
    text: "#000000",
    textMuted: "#666666",
    textSubtle: "#999999",
    border: "#e5e5e5",
    borderStrong: "#d4d4d4",
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

const darkTheme = {
  background: "#0b0c0f",
  backgroundHover: "#14161b",
  backgroundPress: "#14161b",
  backgroundFocus: "#14161b",
  backgroundTransparent: "transparent",

  color: "#f5f5f5",
  colorHover: "#ffffff",
  colorPress: "#d4d4d8",
  colorFocus: "#ffffff",

  borderColor: "#2a2f38",
  borderColorHover: "#3a404c",
  borderColorFocus: "#4b5563",

  placeholderColor: "#71717a",

  accent: "#ffffff",
  accentMuted: "#a1a1aa",
  textMuted: "#a1a1aa",
  textSubtle: "#71717a",
  border: "#2a2f38",
  borderStrong: "#3a404c",
  backgroundSecondary: "#14161b",
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
    dark: darkTheme,
  },
  tokens: customTokens,
  animations,
});

export default config;

export type AppConfig = typeof config;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppConfig {}
}
