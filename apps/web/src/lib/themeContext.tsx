"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ThemeName = "light" | "dark";

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
});

export function ThemeSettingProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("nexus_theme");
    return stored === "dark" || stored === "light" ? stored : "light";
  });

  useEffect(() => {
    window.localStorage.setItem("nexus_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.documentElement.classList.remove("t_light", "t_dark");
    document.documentElement.classList.add(`t_${theme}`);
    if (document.body) {
      document.body.classList.remove("t_light", "t_dark");
      document.body.classList.add(`t_${theme}`);
    }
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useThemeSetting() {
  return useContext(ThemeContext);
}
