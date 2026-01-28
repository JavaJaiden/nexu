"use client";

import { TamaguiProvider as TamaguiProviderOG, Theme } from "tamagui";
import config from "../../tamagui.config";
import { ThemeSettingProvider, useThemeSetting } from "@/lib/themeContext";

function TamaguiInner({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeSetting();
  return (
    <TamaguiProviderOG config={config} defaultTheme={theme}>
      <Theme name={theme}>{children}</Theme>
    </TamaguiProviderOG>
  );
}

export function TamaguiProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeSettingProvider>
      <TamaguiInner>{children}</TamaguiInner>
    </ThemeSettingProvider>
  );
}
