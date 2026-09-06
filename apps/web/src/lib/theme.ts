export type Theme = "light" | "dark";
const STORAGE_KEY = "clouddeploy-theme";

/** Inlined into a blocking <script> in the root layout so the class lands
 * before first paint — the theme toggle only ever reads/writes the same
 * key and class, never introducing a second source of truth. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}if(t==="dark")document.documentElement.classList.add("dark");}catch(e){}})();`;

export function getStoredTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private-browsing or storage-disabled — the toggle still works for
    // this page load, it just won't persist across visits.
  }
}
