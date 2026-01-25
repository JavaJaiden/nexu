import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "./ConvexClientProvider";
import { TamaguiProvider } from "./TamaguiProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Notes App",
  description: "A simple notes app with AI summaries.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/tamagui.css" />
      </head>
      <body className={inter.className} style={{ margin: 0, padding: 0 }}>
        <TamaguiProvider>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </TamaguiProvider>
      </body>
    </html>
  );
}
