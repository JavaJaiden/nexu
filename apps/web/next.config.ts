import type { NextConfig } from "next";
import { withTamagui } from "@tamagui/next-plugin";

// Set TAMAGUI_TARGET for build-time CSS extraction
process.env.TAMAGUI_TARGET = "web";

const nextConfig: NextConfig = {
  transpilePackages: [
    "tamagui",
    "@tamagui/core",
    "@tamagui/config",
    "@tamagui/font-inter",
    "@tamagui/animations-css",
    "@tamagui/shorthands",
    "@tamagui/themes",
  ],
  turbopack: {},
};

export default withTamagui({
  config: "./tamagui.config.ts",
  components: ["tamagui"],
})(nextConfig);
