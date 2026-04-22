/* ================================================================
   APP — Main entry point & orchestrator
================================================================ */
import { ThemeManager } from "./theme.js";
import { UI } from "./ui.js";
import { ContentLoader } from "./contentLoader.js";
import { Search } from "./search.js";
import { Navigation } from "./navigation.js";
import { DiagramController } from "./diagram.js";

/* ── Manifest URL ─────────────────────────────────────────── */
const MANIFEST_URL = "content/manifest.json";

/* ── Load the manifest JSON ─────────────────────────────── */
async function loadManifest() {
  const response = await fetch(MANIFEST_URL);
  if (!response.ok)
    throw new Error(`Manifest fetch failed: HTTP ${response.status}`);
  return response.json();
}

/* ── Show a critical error (manifest failed) ──────────────── */
function showCriticalError(err) {
  const grid = document.getElementById("subjects-grid");
  const errMsg = err ? String(err) : "";
  const html =
    '<div class="server-notice" style="grid-column:1/-1">' +
    '<div class="server-notice__icon">🚧</div>' +
    '<h1 class="server-notice__title">Failed to start</h1>' +
    '<p class="server-notice__body">LearnPath needs a local web server. Run in the project folder:</p>' +
    '<code class="server-notice__code">npx serve . --listen 8080</code>' +
    '<p class="server-notice__body" style="margin-top:16px">Then open <strong>http://localhost:8080</strong></p>' +
    (errMsg
      ? '<p style="font-size:var(--text-xs);color:var(--text-muted);margin-top:12px">Detail: ' +
        errMsg +
        "</p>"
      : "") +
    "</div>";

  if (grid) {
    grid.innerHTML = html;
  } else {
    const main = document.getElementById("main");
    if (main)
      main.innerHTML =
        '<div class="container" style="padding-top:var(--sp-16)">' +
        html +
        "</div>";
  }
}

/* ── Boot sequence ─────────────────────────────────────────── */
async function boot() {
  try {
    ThemeManager.init();
    UI.init();
    ContentLoader.init();
    DiagramController.init();
    // Hook diagram button injection into topic content loading
    ContentLoader.setDiagramInjector((articleEl, subject, section, topic) => {
      DiagramController.onTopicLoaded(articleEl, subject, section, topic);
    });
  } catch (err) {
    console.error("LearnPath: init failed", err);
    showCriticalError(err);
    return;
  }

  let manifest;
  try {
    manifest = await loadManifest();
  } catch (err) {
    console.error("LearnPath: manifest load failed", err);
    showCriticalError(err);
    return;
  }

  try {
    Search.init(manifest);
    Navigation.init(manifest);
  } catch (err) {
    console.error("LearnPath: navigation init failed", err);
    showCriticalError(err);
  }
}

/* ── Wait for DOM then boot ───────────────────────────────── */
// ES modules are deferred — DOM is always ready by the time this runs.
// DOMContentLoaded guard retained for safety.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
