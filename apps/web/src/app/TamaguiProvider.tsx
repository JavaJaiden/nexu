"use client";

import { TamaguiProvider as TamaguiProviderOG, Theme } from "tamagui";
import config from "../../tamagui.config";

export function TamaguiProvider({ children }: { children: React.ReactNode }) {
  return (
    <TamaguiProviderOG config={config} defaultTheme="light">
      <Theme name="light">{children}</Theme>
    </TamaguiProviderOG>
  );
}
