export type Theme = "light" | "dark" | "system";
const THEME_KEY = "aeogeo_theme";

export function getTheme(): Theme {
  return (localStorage.getItem(THEME_KEY) as Theme) || "system";
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark");

  if (theme === "system") {
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.add(systemDark ? "dark" : "light");
  } else {
    root.classList.add(theme);
  }
}

// Initialize on load
export function initTheme(): void {
  applyTheme(getTheme());
}
