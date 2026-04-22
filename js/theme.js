/* ================================================================
   THEME MANAGER — Dark / Light mode toggle with system preference
================================================================ */
import { UI } from "./ui.js";

const THEME_KEY = "learnpath_theme";
const html = document.documentElement;

/** Detect OS-level preference */
function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Apply a theme: update attribute, icons, code-highlight style */
function applyTheme(theme) {
  html.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);

  // Swap highlight.js CSS for readable code blocks
  const hljsLink = document.getElementById("hljs-theme");
  if (hljsLink) {
    hljsLink.href =
      theme === "dark"
        ? "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css"
        : "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-light.min.css";
  }

  // Sync theme-color meta (mobile browser chrome)
  const metaTheme = document.getElementById("theme-color-meta");
  if (metaTheme) {
    metaTheme.content = theme === "dark" ? "#0c0c1d" : "#f0f2fc";
  }

  // Fire event so other modules can react
  document.dispatchEvent(
    new CustomEvent("theme:changed", { detail: { theme } }),
  );
}

/** Toggle between dark and light */
function toggle() {
  const current = html.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  UI.toast(next === "light" ? "☀️ Light mode" : "🌙 Dark mode", "info", 1800);
}

/** Initialize: read storage or system preference */
function init() {
  const stored = localStorage.getItem(THEME_KEY);
  applyTheme(stored || getSystemTheme());

  // Button click
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.addEventListener("click", toggle);

  // Keyboard shortcut (D key) — registered in app.js keyboard handler
  // System preference change (only when user hasn't chosen manually)
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      if (!localStorage.getItem(THEME_KEY)) {
        applyTheme(e.matches ? "dark" : "light");
      }
    });
}

export const ThemeManager = { init, toggle, applyTheme };
