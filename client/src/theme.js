// Dark is REV's default (the Steam-style look from the README); light is optional.
// The choice is saved in localStorage: a harmless preference, nothing private.
const KEY = "rev-theme";
const THEME_COLORS = { dark: "#101826", light: "#eef2f6" };

function paint(theme) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[theme]);
}

export function applySavedTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    // Private windows can block storage; the default theme still works.
  }
  paint(saved === "light" ? "light" : "dark");
}

export function currentTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

// Every ThemeToggle listens for this, so two toggles never disagree.
export const THEME_EVENT = "rev:theme-change";

export function saveTheme(theme) {
  paint(theme);
  window.dispatchEvent(new Event(THEME_EVENT));
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Ignore: the theme still changes for this visit.
  }
}
