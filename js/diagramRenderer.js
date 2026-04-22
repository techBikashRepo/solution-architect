/* ================================================================
   DIAGRAM RENDERER — SVG connections + HTML node cards
   Handles: hierarchy, mindmap, flowchart, architecture, comparison
   Features: animated paths, hover highlight, pan/zoom, minimap
================================================================ */

import { LayoutEngine } from "./layoutEngine.js";

/* ── Theme palettes ──────────────────────────────────────── */
const THEMES = {
  indigo: {
    p: "#6366f1",
    l: "#818cf8",
    d: "#4f46e5",
    glow: "rgba(99,102,241,0.3)",
    bg: "rgba(99,102,241,0.08)",
  },
  amber: {
    p: "#f97316",
    l: "#fb923c",
    d: "#ea580c",
    glow: "rgba(249,115,22,0.3)",
    bg: "rgba(249,115,22,0.08)",
  },
  cyan: {
    p: "#06b6d4",
    l: "#22d3ee",
    d: "#0891b2",
    glow: "rgba(6,182,212,0.3)",
    bg: "rgba(6,182,212,0.08)",
  },
  violet: {
    p: "#8b5cf6",
    l: "#a78bfa",
    d: "#7c3aed",
    glow: "rgba(139,92,246,0.3)",
    bg: "rgba(139,92,246,0.08)",
  },
  emerald: {
    p: "#10b981",
    l: "#34d399",
    d: "#059669",
    glow: "rgba(16,185,129,0.3)",
    bg: "rgba(16,185,129,0.08)",
  },
  rose: {
    p: "#f43f5e",
    l: "#fb7185",
    d: "#e11d48",
    glow: "rgba(244,63,94,0.3)",
    bg: "rgba(244,63,94,0.08)",
  },
};

const COLOR_META = {
  "#6366f1": "rgba(99,102,241,0.15)",
  "#10b981": "rgba(16,185,129,0.15)",
  "#f59e0b": "rgba(245,158,11,0.15)",
  "#06b6d4": "rgba(6,182,212,0.15)",
  "#f43f5e": "rgba(244,63,94,0.15)",
  "#8b5cf6": "rgba(139,92,246,0.15)",
  "#f97316": "rgba(249,115,22,0.15)",
  "#3b82f6": "rgba(59,130,246,0.15)",
};

/* ── Main render function ────────────────────────────────── */
/**
 * Render diagram into wrapperEl.
 * @param {HTMLElement} wrapperEl  - The pannable container
 * @param {Object}      diagram    - Diagram JSON data
 * @param {Object}      layoutResult - { posMap, canvasW, canvasH }
 * @returns {{ canvas, svg, nodeEls, pathEls }}
 */
function render(wrapperEl, diagram, layoutResult) {
  wrapperEl.innerHTML = "";

  const theme = THEMES[diagram.theme] || THEMES.indigo;
  const { posMap, canvasW, canvasH } = layoutResult;

  /* ── Canvas layer ──────────────────────────────────────── */
  const canvas = document.createElement("div");
  canvas.className = "dg-canvas";
  canvas.style.width = canvasW + "px";
  canvas.style.height = canvasH + "px";
  wrapperEl.appendChild(canvas);

  /* ── SVG connection layer (behind nodes) ───────────────── */
  const svg = _createSVG(canvasW, canvasH);
  canvas.appendChild(svg);

  /* ── Build arrowhead markers ───────────────────────────── */
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  _buildMarkers(defs, theme);
  svg.appendChild(defs);

  /* ── Draw comparison divider first (under everything) ──── */
  if (diagram.type === "comparison" && layoutResult.dividerX) {
    _drawDivider(svg, layoutResult.dividerX, canvasH, theme);
  }

  /* ── Connections ───────────────────────────────────────── */
  const connections = _buildConnectionList(diagram);
  const pathEls = new Map(); // "from→to" → SVGPathElement

  connections.forEach((conn) => {
    const fromPos = posMap.get(conn.from);
    const toPos = posMap.get(conn.to);
    if (!fromPos || !toPos) return;

    const anchors = LayoutEngine.bestAnchors(fromPos, toPos);
    const pathStr = LayoutEngine.bezierPath(anchors.from, anchors.to);
    const pathEl = _createPath(svg, pathStr, conn, theme);
    if (pathEl) pathEls.set(`${conn.from}→${conn.to}`, pathEl);

    if (conn.label) _createLabel(svg, anchors.from, anchors.to, conn.label);
  });

  /* ── Node cards ────────────────────────────────────────── */
  const nodeEls = new Map();
  const nodeById = new Map(diagram.nodes.map((n) => [n.id, n]));

  diagram.nodes.forEach((node, idx) => {
    const pos = posMap.get(node.id);
    if (!pos) return;

    const el = _createNodeCard(node, pos, theme, idx);
    canvas.appendChild(el);
    nodeEls.set(node.id, el);
  });

  /* ── Animate draw-in for solid paths ───────────────────── */
  requestAnimationFrame(() => _animatePaths(svg));

  /* ── Hover interactions ────────────────────────────────── */
  _setupHover(nodeEls, pathEls, connections, theme);

  return { canvas, svg, nodeEls, pathEls };
}

/* ── Build connection list ───────────────────────────────── */
function _buildConnectionList(diagram) {
  if (diagram.connections?.length) return diagram.connections;

  // Auto parent→child for hierarchy / mindmap
  const conns = [];
  diagram.nodes.forEach((node) => {
    if (node.parent) {
      conns.push({ from: node.parent, to: node.id, style: "solid" });
    }
  });
  return conns;
}

/* ── Create SVG element ──────────────────────────────────── */
function _createSVG(w, h) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);
  svg.setAttribute("class", "dg-svg");
  return svg;
}

/* ── Arrow markers ───────────────────────────────────────── */
function _buildMarkers(defs, theme) {
  [
    { id: "dg-arrow", color: theme.p, opacity: "0.7" },
    { id: "dg-arrow-dim", color: theme.p, opacity: "0.15" },
    { id: "dg-arrow-hover", color: theme.l, opacity: "1" },
    { id: "dg-arrow-animated", color: theme.l, opacity: "0.9" },
  ].forEach(({ id, color, opacity }) => {
    const marker = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "marker",
    );
    marker.setAttribute("id", id);
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refX", "9");
    marker.setAttribute("refY", "5");
    marker.setAttribute("markerWidth", "6");
    marker.setAttribute("markerHeight", "6");
    marker.setAttribute("orient", "auto-start-reverse");

    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    p.setAttribute("fill", color);
    p.setAttribute("fill-opacity", opacity);
    marker.appendChild(p);
    defs.appendChild(marker);
  });
}

/* ── Create a single path element ───────────────────────── */
function _createPath(svg, pathStr, conn, theme) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const isAnimated = Boolean(conn.animated);
  const isDashed = conn.style === "dashed";

  path.setAttribute("d", pathStr);
  path.setAttribute("fill", "none");
  path.dataset.from = conn.from;
  path.dataset.to = conn.to;

  if (isAnimated) {
    // Flowing dash animation via CSS
    path.setAttribute("stroke", theme.l);
    path.setAttribute("stroke-opacity", "0.85");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-dasharray", "8 5");
    path.setAttribute("marker-end", "url(#dg-arrow-animated)");
    path.setAttribute("class", "dg-path dg-path--animated");
    path.dataset.type = "animated";
  } else if (isDashed) {
    // Static dashes — shown immediately
    path.setAttribute("stroke", theme.p);
    path.setAttribute("stroke-opacity", "0.45");
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("stroke-dasharray", "6 4");
    path.setAttribute("marker-end", "url(#dg-arrow)");
    path.setAttribute("class", "dg-path dg-path--dashed");
    path.dataset.type = "dashed";
  } else {
    // Solid — draw-in animation
    path.setAttribute("stroke", theme.p);
    path.setAttribute("stroke-opacity", "0"); // starts invisible
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("marker-end", "url(#dg-arrow)");
    path.setAttribute("class", "dg-path dg-path--solid");
    path.dataset.type = "solid";
    path.dataset.len = "1"; // placeholder, real length read after DOM insert
  }

  svg.appendChild(path);

  // Now read real path length (works since svg is in DOM via wrapperEl)
  if (!isAnimated && !isDashed) {
    const len = path.getTotalLength?.() || 400;
    path.dataset.len = String(len);
    path.setAttribute("stroke-dasharray", String(len));
    path.setAttribute("stroke-dashoffset", String(len));
  }

  return path;
}

/* ── Animate solid paths draw-in ─────────────────────────── */
function _animatePaths(svg) {
  const paths = svg.querySelectorAll(".dg-path--solid");
  paths.forEach((path, i) => {
    const len = parseFloat(path.dataset.len || "400");
    setTimeout(
      () => {
        path.style.transition =
          "stroke-dashoffset 0.65s cubic-bezier(0.4,0,0.2,1), stroke-opacity 0.3s ease";
        path.setAttribute("stroke-opacity", "0.65");
        path.setAttribute("stroke-dashoffset", "0");
        // After animation ends, clean up dasharray so rendering is crisp
        setTimeout(() => {
          path.removeAttribute("stroke-dasharray");
          path.removeAttribute("stroke-dashoffset");
          path.style.transition = "";
        }, 750);
      },
      i * 55 + 80,
    );
  });
}

/* ── Connection label ────────────────────────────────────── */
function _createLabel(svg, from, to, text) {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const w = text.length * 6 + 12;

  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("class", "dg-edge-label");

  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", mx - w / 2);
  rect.setAttribute("y", my - 9);
  rect.setAttribute("width", w);
  rect.setAttribute("height", 17);
  rect.setAttribute("rx", "4");
  rect.setAttribute("fill", "var(--bg-elevated)");
  rect.setAttribute("stroke", "var(--border)");
  rect.setAttribute("stroke-width", "0.5");

  const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
  t.setAttribute("x", mx);
  t.setAttribute("y", my + 4);
  t.setAttribute("text-anchor", "middle");
  t.setAttribute("font-size", "9");
  t.setAttribute("fill", "var(--text-muted)");
  t.setAttribute("font-family", "var(--font-sans)");
  t.setAttribute("pointer-events", "none");
  t.textContent = text;

  g.appendChild(rect);
  g.appendChild(t);
  svg.appendChild(g);
}

/* ── Comparison divider line ─────────────────────────────── */
function _drawDivider(svg, x, h, theme) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x);
  line.setAttribute("y1", 20);
  line.setAttribute("x2", x);
  line.setAttribute("y2", h - 20);
  line.setAttribute("stroke", theme.p);
  line.setAttribute("stroke-opacity", "0.18");
  line.setAttribute("stroke-width", "1");
  line.setAttribute("stroke-dasharray", "5 5");
  svg.appendChild(line);
}

/* ── Create a node card HTML element ─────────────────────── */
function _createNodeCard(node, pos, theme, idx) {
  const el = document.createElement("div");
  const accent = node.color || theme.p;
  const accentBg = COLOR_META[accent] || theme.bg;

  el.className = `dg-node dg-node--${node.type || "process"}`;
  el.dataset.nodeId = node.id;
  el.style.cssText = `
    left:${pos.x}px;
    top:${pos.y}px;
    width:${pos.w}px;
    min-height:${pos.h}px;
    animation-delay:${idx * 40 + 60}ms;
  `;

  el.innerHTML = _nodeHTML(node, accent, accentBg);
  return el;
}

/* ── Node HTML factory ───────────────────────────────────── */
function _nodeHTML(node, accent, accentBg) {
  const type = node.type || "process";
  const badge = node.badge
    ? `<span class="dg-node__badge" style="--badge-color:${accent}">${node.badge}</span>`
    : "";
  const icon = node.icon
    ? `<span class="dg-node__icon">${node.icon}</span>`
    : "";
  const desc = node.description
    ? `<p class="dg-node__desc">${node.description}</p>`
    : "";
  const items = node.items?.length
    ? `<ul class="dg-node__items">${node.items.map((it) => `<li>${it}</li>`).join("")}</ul>`
    : "";

  switch (type) {
    case "root":
      return `
        <div class="dg-inner dg-inner--root" style="--a:${accent};--ab:${accentBg}">
          <div class="dg-icon-wrap dg-icon-wrap--root" style="background:${accentBg};border-color:${accent}40">${icon}</div>
          <div class="dg-body">
            <div class="dg-label dg-label--root">${node.label}</div>
            ${desc}
          </div>
        </div>`;

    case "branch":
      return `
        <div class="dg-inner dg-inner--branch" style="--a:${accent};border-left:3px solid ${accent}">
          ${badge}
          <div class="dg-row">
            ${icon}
            <span class="dg-label">${node.label}</span>
          </div>
          ${desc}
        </div>`;

    case "leaf":
      return `
        <div class="dg-inner dg-inner--leaf" style="--a:${accent}">
          <div class="dg-row">
            ${icon}
            <span class="dg-label dg-label--leaf">${node.label}</span>
          </div>
          ${items}
        </div>`;

    case "start":
      return `
        <div class="dg-inner dg-inner--pill" style="--a:${accent}">
          ${icon}<span class="dg-label">${node.label}</span>
          ${desc ? `<p class="dg-node__desc dg-node__desc--xs">${node.description}</p>` : ""}
        </div>`;

    case "end":
      return `
        <div class="dg-inner dg-inner--pill dg-inner--pill-end" style="--a:${accent}">
          ${icon}<span class="dg-label">${node.label}</span>
        </div>`;

    case "decision":
      return `
        <div class="dg-inner dg-inner--decision" style="--a:${accent}">
          ${icon}<span class="dg-label">${node.label}</span>
          ${desc}
        </div>`;

    case "process":
    case "architecture":
      return `
        <div class="dg-inner dg-inner--process" style="--a:${accent};border-top:2px solid ${accent}">
          ${badge}
          <div class="dg-row">
            ${icon}
            <span class="dg-label">${node.label}</span>
          </div>
          ${desc}
          ${items}
        </div>`;

    case "pillar":
      return `
        <div class="dg-inner dg-inner--pillar" style="--a:${accent};background:linear-gradient(135deg,${accent}18,${accent}06);border:1px solid ${accent}33">
          <div class="dg-badge-lg" style="background:${accent}">${node.badge || node.icon}</div>
          <span class="dg-label dg-label--pillar">${node.label}</span>
          ${desc}
          ${node.items?.length ? `<ul class="dg-node__items dg-node__items--sm">${node.items.map((it) => `<li>${it}</li>`).join("")}</ul>` : ""}
        </div>`;

    case "result":
      return `
        <div class="dg-inner dg-inner--result" style="--a:${accent};border:1px solid ${accent}33;background:${accentBg}">
          <div class="dg-row">
            <div class="dg-badge-sm" style="background:${accent}">${node.badge}</div>
            <span class="dg-label">${node.label}</span>
          </div>
          ${desc}
          ${node.items?.length ? `<ul class="dg-node__items dg-node__items--sm">${node.items.map((it) => `<li>${it}</li>`).join("")}</ul>` : ""}
        </div>`;

    case "insight":
      return `
        <div class="dg-inner dg-inner--insight" style="--a:${accent};border:1px solid ${accent}33;background:linear-gradient(135deg,${accent}10,transparent)">
          <div class="dg-row">${icon}<span class="dg-label">${node.label}</span></div>
          ${desc}
          ${items}
        </div>`;

    case "header-left":
    case "header-right":
      return `
        <div class="dg-inner dg-inner--col-header" style="background:linear-gradient(135deg,${accent}ee,${accent}99)">
          <span class="dg-icon-xl">${node.icon}</span>
          <div>
            <div class="dg-label dg-label--header">${node.label}</div>
            ${node.description ? `<p class="dg-node__desc dg-node__desc--header">${node.description}</p>` : ""}
          </div>
        </div>`;

    case "row-left":
    case "row-right":
      return `
        <div class="dg-inner dg-inner--col-row" style="--a:${accent}">
          <div class="dg-row">${icon}<span class="dg-label dg-label--sm">${node.label}</span></div>
          ${items}
        </div>`;

    case "footer-left":
    case "footer-right":
      return `
        <div class="dg-inner dg-inner--col-footer" style="--a:${accent};border:1px solid ${accent}44;background:${accentBg}">
          <div class="dg-row">${icon}<span class="dg-label">${node.label}</span></div>
          ${
            node.items?.length
              ? `<ul class="dg-node__items">${node.items.map((it) => `<li class="dg-item--check">✓ ${it}</li>`).join("")}</ul>`
              : ""
          }
        </div>`;

    default:
      return `
        <div class="dg-inner dg-inner--process" style="--a:${accent}">
          ${icon}<span class="dg-label">${node.label}</span>
        </div>`;
  }
}

/* ── Hover interactions ──────────────────────────────────── */
function _setupHover(nodeEls, pathEls, connections, theme) {
  nodeEls.forEach((el, id) => {
    el.addEventListener("mouseenter", () => {
      // Dim all
      pathEls.forEach((p) => {
        p.setAttribute("stroke-opacity", "0.08");
        p.setAttribute("marker-end", "url(#dg-arrow-dim)");
      });
      nodeEls.forEach((nel, nid) => {
        if (nid !== id) nel.classList.add("dg-node--dim");
      });

      // Highlight connected
      const peers = new Set([id]);
      connections.forEach((conn) => {
        const key = `${conn.from}→${conn.to}`;
        if (conn.from === id || conn.to === id) {
          const p = pathEls.get(key);
          if (p) {
            p.setAttribute("stroke-opacity", "0.95");
            p.setAttribute("stroke-width", "2.5");
            p.setAttribute("marker-end", "url(#dg-arrow-hover)");
          }
          peers.add(conn.from);
          peers.add(conn.to);
        }
      });
      peers.forEach((pid) =>
        nodeEls.get(pid)?.classList.remove("dg-node--dim"),
      );
      el.classList.add("dg-node--active");
    });

    el.addEventListener("mouseleave", () => {
      pathEls.forEach((p) => {
        const t = p.dataset.type;
        if (t === "animated") {
          p.setAttribute("stroke-opacity", "0.85");
          p.setAttribute("stroke-width", "2");
          p.setAttribute("marker-end", "url(#dg-arrow-animated)");
        } else if (t === "dashed") {
          p.setAttribute("stroke-opacity", "0.45");
          p.setAttribute("stroke-width", "1.5");
          p.setAttribute("marker-end", "url(#dg-arrow)");
        } else {
          p.setAttribute("stroke-opacity", "0.65");
          p.setAttribute("stroke-width", "1.5");
          p.setAttribute("marker-end", "url(#dg-arrow)");
        }
      });
      nodeEls.forEach((nel) => nel.classList.remove("dg-node--dim"));
      el.classList.remove("dg-node--active");
    });
  });
}

/* ── Pan & Zoom ──────────────────────────────────────────── */
/**
 * Set up mouse/touch pan + wheel zoom on a viewport element.
 * @param {HTMLElement} viewportEl - clips content, receives events
 * @param {HTMLElement} wrapperEl  - the element to transform
 * @param {Function}    onUpdate   - called with { x, y, scale, viewW, viewH }
 */
function setupPanZoom(viewportEl, wrapperEl, onUpdate) {
  let scale = 1,
    tx = 0,
    ty = 0;
  let dragging = false,
    sx = 0,
    sy = 0,
    stx = 0,
    sty = 0;
  let lastPinchDist = 0;

  function apply(animated) {
    if (animated)
      wrapperEl.style.transition = "transform 0.3s cubic-bezier(0.4,0,0.2,1)";
    wrapperEl.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
    wrapperEl.style.transformOrigin = "0 0";
    if (animated) setTimeout(() => (wrapperEl.style.transition = ""), 320);
    onUpdate?.({
      x: tx,
      y: ty,
      scale,
      viewW: viewportEl.clientWidth,
      viewH: viewportEl.clientHeight,
    });
  }

  function clamp() {
    const cw = wrapperEl.offsetWidth * scale;
    const ch = wrapperEl.offsetHeight * scale;
    const vw = viewportEl.clientWidth;
    const vh = viewportEl.clientHeight;
    tx = Math.max(Math.min(vw * 0.3, tx), Math.min(0, vw - cw - vw * 0.1));
    ty = Math.max(Math.min(vh * 0.3, ty), Math.min(0, vh - ch - vh * 0.1));
  }

  /* Wheel zoom */
  viewportEl.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const rect = viewportEl.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.88 : 1.14;
      const newS = Math.max(0.15, Math.min(3.5, scale * factor));
      tx = mx - (mx - tx) * (newS / scale);
      ty = my - (my - ty) * (newS / scale);
      scale = newS;
      clamp();
      apply(false);
    },
    { passive: false },
  );

  /* Mouse drag */
  viewportEl.addEventListener("mousedown", (e) => {
    if (e.button !== 0 || e.target.closest(".dg-node")) return;
    dragging = true;
    sx = e.clientX;
    sy = e.clientY;
    stx = tx;
    sty = ty;
    viewportEl.style.cursor = "grabbing";
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    tx = stx + e.clientX - sx;
    ty = sty + e.clientY - sy;
    clamp();
    apply(false);
  });

  window.addEventListener("mouseup", () => {
    if (dragging) {
      dragging = false;
      viewportEl.style.cursor = "";
    }
  });

  /* Touch pan + pinch-zoom */
  viewportEl.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0],
          t2 = e.touches[1];
        lastPinchDist = Math.hypot(
          t2.clientX - t1.clientX,
          t2.clientY - t1.clientY,
        );
      } else {
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
        stx = tx;
        sty = ty;
        dragging = true;
      }
    },
    { passive: true },
  );

  viewportEl.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0],
          t2 = e.touches[1];
        const d = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const rect = viewportEl.getBoundingClientRect();
        const mx = (t1.clientX + t2.clientX) / 2 - rect.left;
        const my = (t1.clientY + t2.clientY) / 2 - rect.top;
        const ns = Math.max(0.15, Math.min(3.5, scale * (d / lastPinchDist)));
        tx = mx - (mx - tx) * (ns / scale);
        ty = my - (my - ty) * (ns / scale);
        scale = ns;
        lastPinchDist = d;
        clamp();
        apply(false);
      } else if (dragging) {
        tx = stx + e.touches[0].clientX - sx;
        ty = sty + e.touches[0].clientY - sy;
        clamp();
        apply(false);
      }
      e.preventDefault();
    },
    { passive: false },
  );

  viewportEl.addEventListener("touchend", () => (dragging = false));

  /* Fit diagram into viewport */
  function resetView(animated = true) {
    const vw = viewportEl.clientWidth;
    const vh = viewportEl.clientHeight;
    const dw = wrapperEl.offsetWidth || 800;
    const dh = wrapperEl.offsetHeight || 600;
    const pad = 80;
    scale = Math.min(1, (vw - pad) / dw, (vh - pad) / dh);
    tx = (vw - dw * scale) / 2;
    ty = (vh - dh * scale) / 2;
    apply(animated);
  }

  function setZoom(newScale, animated = true) {
    const cx = viewportEl.clientWidth / 2;
    const cy = viewportEl.clientHeight / 2;
    tx = cx - (cx - tx) * (newScale / scale);
    ty = cy - (cy - ty) * (newScale / scale);
    scale = Math.max(0.15, Math.min(3.5, newScale));
    clamp();
    apply(animated);
  }

  function getZoom() {
    return scale;
  }

  // Initial fit after layout settles
  requestAnimationFrame(() => requestAnimationFrame(() => resetView(false)));

  return { resetView, setZoom, getZoom };
}

/* ── Minimap renderer ────────────────────────────────────── */
/**
 * Draw scaled diagram overview onto a <canvas> element.
 * @param {HTMLCanvasElement} canvasEl
 * @param {Object}            diagram
 * @param {Object}            layoutResult
 * @param {Object|null}       viewport  - { x, y, scale, viewW, viewH }
 */
function renderMinimap(canvasEl, diagram, layoutResult, viewport) {
  const { posMap, canvasW, canvasH } = layoutResult;
  const mmW = canvasEl.width;
  const mmH = canvasEl.height;
  const sx = mmW / canvasW;
  const sy = mmH / canvasH;
  const theme = THEMES[diagram.theme] || THEMES.indigo;

  const ctx = canvasEl.getContext("2d");
  ctx.clearRect(0, 0, mmW, mmH);

  // Node rectangles
  diagram.nodes.forEach((node) => {
    const pos = posMap.get(node.id);
    if (!pos) return;
    const accent = node.color || theme.p;
    ctx.fillStyle = accent + "30";
    ctx.strokeStyle = accent + "90";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(pos.x * sx, pos.y * sy, pos.w * sx, pos.h * sy, 2);
    } else {
      ctx.rect(pos.x * sx, pos.y * sy, pos.w * sx, pos.h * sy);
    }
    ctx.fill();
    ctx.stroke();
  });

  // Viewport indicator
  if (viewport) {
    const vx = (-viewport.x / viewport.scale) * sx;
    const vy = (-viewport.y / viewport.scale) * sy;
    const vw = (viewport.viewW / viewport.scale) * sx;
    const vh = (viewport.viewH / viewport.scale) * sy;
    ctx.strokeStyle = theme.l;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = theme.l + "18";
    ctx.fillRect(vx, vy, vw, vh);
    ctx.strokeRect(vx, vy, vw, vh);
  }
}

export const DiagramRenderer = {
  render,
  setupPanZoom,
  renderMinimap,
};
