import { useEffect, useState } from "react";
import { currentTheme, saveTheme, THEME_EVENT } from "../theme.js";
import { MoonIcon, SunIcon } from "./Icons.jsx";

// withLabel: show the words too (the Profile page), not just the icon (the header).
export default function ThemeToggle({ withLabel = false }) {
  const [theme, setTheme] = useState(currentTheme);
  const next = theme === "dark" ? "light" : "dark";

  // Another toggle changed the theme: update this one's icon.
  useEffect(() => {
    const sync = () => setTheme(currentTheme());
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);

  return (
    <button
      type="button"
      className={withLabel ? "button" : "icon-button"}
      onClick={() => saveTheme(next)}
      aria-label={withLabel ? undefined : `Switch to ${next} theme`}
      title={withLabel ? undefined : `Switch to ${next} theme`}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      {withLabel && <span>Switch to {next} theme</span>}
    </button>
  );
}
