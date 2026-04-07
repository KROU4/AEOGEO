import { useState, useEffect } from "react";
import { getTheme, setTheme as setThemeStorage, type Theme } from "@/lib/theme";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getTheme());

  const setTheme = (newTheme: Theme) => {
    setThemeStorage(newTheme);
    setThemeState(newTheme);
  };

  useEffect(() => {
    // Listen for system preference changes
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (getTheme() === "system") {
        setThemeStorage("system"); // re-apply
      }
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  return { theme, setTheme };
}
