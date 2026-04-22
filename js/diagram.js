/* ================================================================
   DIAGRAM CONTROLLER — Orchestrates data loading, layout,
   rendering, overlay management, pan/zoom, minimap
================================================================ */

import { DiagramDataLoader } from "./dataLoader.js";
import { LayoutEngine } from "./layoutEngine.js";
import { DiagramRenderer } from "./diagramRenderer.js";

/* ── Module state ────────────────────────────────────────── */
let _overlay = null;
let _viewport = null;
let _wrapper = null;
let _minimapCanvas = null;
let _panZoom = null;
let _currentDiagram = null;
let _currentLayout = null;

/* ── Init — call once at app boot ────────────────────────── */
function init() {
  _overlay = document.getElementById("diagram-overlay");
  _viewport = document.getElementById("diagram-viewport");
  _wrapper = document.getElementById("diagram-canvas-wrapper");
  _minimapCanvas = document.getElementById("diagram-minimap-canvas");

  if (!_overlay) return;

  /* Toolbar controls */
  _on("diagram-close", "click", hide);
  _on("diagram-zoom-in", "click", () =>
    _panZoom?.setZoom(_panZoom.getZoom() * 1.25),
  );
  _on("diagram-zoom-out", "click", () =>
    _panZoom?.setZoom(_panZoom.getZoom() * 0.8),
  );
  _on("diagram-reset", "click", () => _panZoom?.resetView());
  _on("diagram-fullscreen", "click", _toggleFullscreen);

  /* Backdrop click closes */
  _overlay.addEventListener("click", (e) => {
    if (
      e.target === _overlay ||
      e.target.classList.contains("diagram-overlay__backdrop")
    )
      hide();
  });

  /* Keyboard shortcuts (only active while overlay is open) */
  document.addEventListener("keydown", (e) => {
    if (!_overlay || _overlay.hidden) return;
    if (e.target.closest("input, textarea")) return;
    switch (e.key) {
      case "Escape":
        hide();
        break;
      case "+":
      case "=":
        _panZoom?.setZoom(_panZoom.getZoom() * 1.2);
        break;
      case "-":
        _panZoom?.setZoom(_panZoom.getZoom() * 0.8);
        break;
      case "0":
        _panZoom?.resetView();
        break;
      case "f":
      case "F":
        _toggleFullscreen();
        break;
    }
  });
}

/* ── Hook called by ContentLoader after each topic renders ── */
async function onTopicLoaded(articleEl, subject, section, topic) {
  // Remove any leftover diagram button
  articleEl.querySelector(".dg-topic-trigger")?.remove();

  const exists = await DiagramDataLoader.hasDiagram(topic.id);
  if (!exists) return;

  const btn = document.createElement("div");
  btn.className = "dg-topic-trigger";
  btn.innerHTML = `
    <button class="dg-topic-btn" aria-label="Open interactive diagram for ${topic.title}">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <circle cx="17.5" cy="17.5" r="3" stroke-width="1.5"/>
        <path d="M17.5 14.5v1.5M17.5 20.5v-1.5M14.5 17.5h1.5M20.5 17.5h-1.5"/>
      </svg>
      View Interactive Diagram
      <span class="dg-topic-btn__tag">Visual</span>
    </button>
  `;

  btn
    .querySelector(".dg-topic-btn")
    .addEventListener("click", () => openForTopic(subject, section, topic));

  // Inject just before the markdown content block
  const mdContent = articleEl.querySelector(".md-content");
  if (mdContent) articleEl.insertBefore(btn, mdContent);
  else articleEl.prepend(btn);
}

/* ── Open overlay for a specific topic ──────────────────── */
async function openForTopic(subject, section, topic) {
  if (!_overlay) return;
  show();
  _setLoading(true);
  try {
    const diagram = await DiagramDataLoader.loadOrGenerate(
      subject,
      section,
      topic,
    );
    _render(diagram);
  } catch (err) {
    console.error("DiagramController: render failed", err);
    _setLoading(false);
    _showError();
  }
}

/* ── Core render pipeline ────────────────────────────────── */
function _render(diagram) {
  _currentDiagram = diagram;

  /* Layout calculation */
  const layout = LayoutEngine.calculateLayout(diagram);
  _currentLayout = layout;

  /* Size the wrapper to match diagram canvas */
  _wrapper.style.width = layout.canvasW + "px";
  _wrapper.style.height = layout.canvasH + "px";
  _wrapper.style.opacity = "0";

  /* Render node cards + SVG connections */
  DiagramRenderer.render(_wrapper, diagram, layout);

  /* Wire up pan/zoom */
  _panZoom = DiagramRenderer.setupPanZoom(_viewport, _wrapper, (state) => {
    _updateZoomLabel(state.scale);
    _updateMinimap(state);
  });

  /* Update toolbar title */
  const titleEl = document.getElementById("diagram-title");
  const subtitleEl = document.getElementById("diagram-subtitle");
  if (titleEl) titleEl.textContent = diagram.title || "";
  if (subtitleEl) subtitleEl.textContent = diagram.subtitle || "";

  /* Reveal */
  _setLoading(false);
  requestAnimationFrame(() => {
    _wrapper.style.transition = "opacity 0.3s ease";
    _wrapper.style.opacity = "1";
    setTimeout(() => (_wrapper.style.transition = ""), 350);
  });

  /* Minimap */
  _initMinimap(diagram, layout);
}

/* ── Minimap ─────────────────────────────────────────────── */
function _initMinimap(diagram, layout) {
  if (!_minimapCanvas) return;
  _minimapCanvas.width = 160;
  _minimapCanvas.height = 100;
  DiagramRenderer.renderMinimap(_minimapCanvas, diagram, layout, null);
}

function _updateMinimap(viewState) {
  if (!_minimapCanvas || !_currentDiagram || !_currentLayout) return;
  DiagramRenderer.renderMinimap(
    _minimapCanvas,
    _currentDiagram,
    _currentLayout,
    viewState,
  );
}

/* ── Overlay show / hide ─────────────────────────────────── */
function show() {
  if (!_overlay) return;
  _overlay.hidden = false;
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => _overlay.classList.add("is-open"));
}

function hide() {
  if (!_overlay) return;
  _overlay.classList.remove("is-open");
  document.body.style.overflow = "";
  setTimeout(() => {
    _overlay.hidden = true;
    // Reset wrapper for next open
    if (_wrapper) _wrapper.innerHTML = "";
    _currentDiagram = null;
    _currentLayout = null;
  }, 280);
}

/* ── Helpers ─────────────────────────────────────────────── */
function _setLoading(on) {
  const el = document.getElementById("diagram-loading");
  if (el) el.hidden = !on;
}

function _showError() {
  if (!_wrapper) return;
  _wrapper.innerHTML = `
    <div class="dg-error-state">
      <span>⚠️</span>
      <p>Could not load diagram data</p>
    </div>`;
  _wrapper.style.opacity = "1";
}

function _updateZoomLabel(scale) {
  const el = document.getElementById("diagram-zoom-level");
  if (el) el.textContent = Math.round(scale * 100) + "%";
}

function _toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    _overlay?.requestFullscreen?.();
  }
}

function _on(id, ev, fn) {
  document.getElementById(id)?.addEventListener(ev, fn);
}

/* ── Public API ──────────────────────────────────────────── */
export const DiagramController = {
  init,
  onTopicLoaded,
  openForTopic,
  show,
  hide,
};
