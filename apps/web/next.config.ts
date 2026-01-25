import type { NextConfig } from "next";
import { withTamagui } from "@tamagui/next-plugin";

const nextConfig: NextConfig = {
  transpilePackages: ["tamagui", "@tamagui/core", "@tamagui/config"],
  turbopack: {},
};

export default withTamagui({
  config: "./tamagui.config.ts",
  components: ["tamagui"],
  outputCSS: "./public/tamagui.css",
})(nextConfig);
