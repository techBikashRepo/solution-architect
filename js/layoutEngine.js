/* ================================================================
   LAYOUT ENGINE — Calculates x/y positions for all diagram types
   Returns: { nodes: Map<id, {x,y,w,h}>, canvasW, canvasH }
================================================================ */

const NODE_W = 200; // default node width
const NODE_H = 90; // default node height
const ROOT_W = 220;
const ROOT_H = 100;
const LEAF_W = 190;
const LEAF_H = 130; // leaves can be taller (have items list)
const H_GAP = 48; // horizontal gap between siblings
const V_GAP = 80; // vertical gap between levels
const RADIAL_INNER = 220; // center → branch distance (mindmap)
const RADIAL_OUTER = 420; // branch → leaf distance (mindmap)

/* ── Main dispatcher ─────────────────────────────────────── */
function calculateLayout(diagram) {
  switch (diagram.type) {
    case "hierarchy":
      return _hierarchyLayout(diagram);
    case "mindmap":
      return _mindmapLayout(diagram);
    case "flowchart":
    case "architecture":
      return _graphLayout(diagram);
    case "comparison":
      return _comparisonLayout(diagram);
    case "process":
      return _processLayout(diagram);
    default:
      return _hierarchyLayout(diagram);
  }
}

/* ================================================================
   HIERARCHY LAYOUT — top-down tree
================================================================ */
function _hierarchyLayout(diagram) {
  const nodes = diagram.nodes;
  const posMap = new Map(); // id → {x, y, w, h}
  const children = new Map(); // id → [child ids]
  const roots = [];

  // Build parent→children index
  nodes.forEach((n) => {
    children.set(n.id, []);
  });
  nodes.forEach((n) => {
    if (n.parent) {
      const arr = children.get(n.parent);
      if (arr) arr.push(n.id);
    } else {
      roots.push(n.id);
    }
  });

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Measure each node
  function measure(id) {
    const n = nodeById.get(id);
    const ch = children.get(id) || [];
    const isRoot = !n.parent;
    const isLeaf = ch.length === 0;
    const w = isRoot ? ROOT_W : isLeaf ? LEAF_W : NODE_W;
    const h = isRoot ? ROOT_H : isLeaf && n.items?.length ? LEAF_H : NODE_H;
    return { w, h };
  }

  // Compute subtree width (for centering)
  const subtreeW = new Map();
  function computeSubtreeW(id) {
    const ch = children.get(id) || [];
    if (ch.length === 0) {
      const { w } = measure(id);
      subtreeW.set(id, w);
      return w;
    }
    const childrenTotal = ch.reduce((sum, c) => {
      return sum + computeSubtreeW(c);
    }, 0);
    const gap = H_GAP * (ch.length - 1);
    const total = Math.max(measure(id).w, childrenTotal + gap);
    subtreeW.set(id, total);
    return total;
  }

  roots.forEach((r) => computeSubtreeW(r));

  // Place nodes
  function place(id, x, y) {
    const { w, h } = measure(id);
    posMap.set(id, { x, y, w, h });

    const ch = children.get(id) || [];
    if (ch.length === 0) return;

    const totalChildW =
      ch.reduce((s, c) => s + subtreeW.get(c), 0) + H_GAP * (ch.length - 1);
    let cx = x + w / 2 - totalChildW / 2;
    const cy = y + h + V_GAP;

    ch.forEach((c) => {
      const cw = subtreeW.get(c);
      const { w: nw } = measure(c);
      place(c, cx + cw / 2 - nw / 2, cy);
      cx += cw + H_GAP;
    });
  }

  // Place each root tree side by side
  let totalRootW =
    roots.reduce((s, r) => s + subtreeW.get(r), 0) + H_GAP * (roots.length - 1);
  let rx = 40;
  roots.forEach((r) => {
    const rw = subtreeW.get(r);
    const { w } = measure(r);
    place(r, rx + rw / 2 - w / 2, 40);
    rx += rw + H_GAP;
  });

  // Canvas dimensions
  let maxX = 0,
    maxY = 0;
  posMap.forEach(({ x, w, y, h }) => {
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });

  return { posMap, canvasW: maxX + 60, canvasH: maxY + 60 };
}

/* ================================================================
   MINDMAP LAYOUT — radial from center
================================================================ */
function _mindmapLayout(diagram) {
  const nodes = diagram.nodes;
  const posMap = new Map();

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map();
  nodes.forEach((n) => childrenOf.set(n.id, []));
  nodes.forEach((n) => {
    if (n.parent) {
      const arr = childrenOf.get(n.parent);
      if (arr) arr.push(n.id);
    }
  });

  const root = nodes.find((n) => !n.parent || n.type === "root");
  if (!root) return _hierarchyLayout(diagram);

  const branches = childrenOf.get(root.id) || [];
  const nBranches = branches.length || 1;

  // Center
  const cx = RADIAL_OUTER + RADIAL_INNER + 100;
  const cy = RADIAL_OUTER + RADIAL_INNER + 100;

  posMap.set(root.id, {
    x: cx - ROOT_W / 2,
    y: cy - ROOT_H / 2,
    w: ROOT_W,
    h: ROOT_H,
  });

  branches.forEach((branchId, i) => {
    const angle = (2 * Math.PI * i) / nBranches - Math.PI / 2;
    const bx = cx + Math.cos(angle) * RADIAL_INNER;
    const by = cy + Math.sin(angle) * RADIAL_INNER;
    posMap.set(branchId, {
      x: bx - NODE_W / 2,
      y: by - NODE_H / 2,
      w: NODE_W,
      h: NODE_H,
    });

    const leaves = childrenOf.get(branchId) || [];
    const nLeaves = leaves.length || 1;
    const spreadAngle = Math.min(Math.PI * 0.7, (nLeaves - 1) * 0.45);
    const startAngle = angle - spreadAngle / 2;

    leaves.forEach((leafId, j) => {
      const la =
        nLeaves === 1 ? angle : startAngle + (spreadAngle * j) / (nLeaves - 1);
      const lx = cx + Math.cos(la) * (RADIAL_INNER + RADIAL_OUTER * 0.55);
      const ly = cy + Math.sin(la) * (RADIAL_INNER + RADIAL_OUTER * 0.55);
      posMap.set(leafId, {
        x: lx - LEAF_W / 2,
        y: ly - LEAF_H / 2,
        w: LEAF_W,
        h: LEAF_H,
      });
    });
  });

  // Canvas
  let minX = Infinity,
    minY = Infinity,
    maxX = 0,
    maxY = 0;
  posMap.forEach(({ x, y, w, h }) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });
  // Shift so nothing is off-canvas
  const padX = minX < 20 ? 20 - minX : 0;
  const padY = minY < 20 ? 20 - minY : 0;
  if (padX > 0 || padY > 0) {
    posMap.forEach((pos) => {
      pos.x += padX;
      pos.y += padY;
    });
    maxX += padX;
    maxY += padY;
  }

  return { posMap, canvasW: maxX + 60, canvasH: maxY + 60 };
}

/* ================================================================
   GRAPH LAYOUT — flowchart / architecture (auto-tier)
================================================================ */
function _graphLayout(diagram) {
  const nodes = diagram.nodes;
  const connections = diagram.connections || [];
  const posMap = new Map();

  // Determine tiers by connectivity (topological sort)
  const indegree = new Map(nodes.map((n) => [n.id, 0]));
  const adj = new Map(nodes.map((n) => [n.id, []]));

  connections.forEach(({ from, to }) => {
    if (indegree.has(to)) indegree.set(to, indegree.get(to) + 1);
    if (adj.has(from)) adj.get(from).push(to);
  });

  // Kahn's BFS for layers
  const layers = [];
  let queue = nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id);

  while (queue.length) {
    layers.push([...queue]);
    const next = [];
    queue.forEach((id) => {
      (adj.get(id) || []).forEach((child) => {
        const deg = (indegree.get(child) || 1) - 1;
        indegree.set(child, deg);
        if (deg === 0) next.push(child);
      });
    });
    queue = next;
  }

  // Collect any nodes not placed (cycles)
  const placed = new Set(layers.flat());
  const unplaced = nodes.filter((n) => !placed.has(n.id));
  if (unplaced.length) layers.push(unplaced.map((n) => n.id));

  // Measure width of each layer
  const isHoriz = diagram.layout === "left-right";
  const GAP_CROSS = 56; // gap between nodes in same layer
  const GAP_DEPTH = 100; // gap between layers

  let depthOffset = 40;
  layers.forEach((layer) => {
    const totalCross =
      layer.reduce((s) => s + NODE_W, 0) + GAP_CROSS * (layer.length - 1);
    let crossOffset = 40;

    // Find max canvas cross-dim so far for centering
    const maxPrevCross = Math.max(
      ...layers.map((l) => l.length * NODE_W + GAP_CROSS * (l.length - 1)),
      totalCross,
    );
    crossOffset = Math.max(40, (maxPrevCross - totalCross) / 2 + 40);

    layer.forEach((id) => {
      const nodeData = nodes.find((n) => n.id === id);
      const isLeaf = nodeData?.items?.length > 0;
      const h = isLeaf ? LEAF_H : NODE_H;
      if (isHoriz) {
        posMap.set(id, { x: depthOffset, y: crossOffset, w: NODE_W, h });
        crossOffset += h + GAP_CROSS;
      } else {
        posMap.set(id, { x: crossOffset, y: depthOffset, w: NODE_W, h });
        crossOffset += NODE_W + GAP_CROSS;
      }
    });

    const layerH = Math.max(
      ...layer.map((id) => {
        const p = posMap.get(id);
        return p ? p.h : NODE_H;
      }),
    );
    depthOffset += (isHoriz ? NODE_W : layerH) + GAP_DEPTH;
  });

  let maxX = 0,
    maxY = 0;
  posMap.forEach(({ x, w, y, h }) => {
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });

  return { posMap, canvasW: maxX + 60, canvasH: maxY + 60 };
}

/* ================================================================
   COMPARISON LAYOUT — side-by-side columns
================================================================ */
function _comparisonLayout(diagram) {
  const nodes = diagram.nodes;
  const posMap = new Map();

  const HEADER_H = 100;
  const ROW_H = 130;
  const FOOTER_H = 110;
  const COL_W = 280;
  const COL_GAP = 60;
  const DIVIDER_X = 40 + COL_W + COL_GAP / 2; // middle

  // Sort nodes into column-left and column-right
  const leftHeaders = nodes.filter((n) => n.type === "header-left");
  const rightHeaders = nodes.filter((n) => n.type === "header-right");
  const leftRows = nodes.filter((n) => n.type === "row-left");
  const rightRows = nodes.filter((n) => n.type === "row-right");
  const leftFooters = nodes.filter((n) => n.type === "footer-left");
  const rightFooters = nodes.filter((n) => n.type === "footer-right");

  // Special types for CAP triangle "pillar" / "result"
  const pillars = nodes.filter((n) => n.type === "pillar");
  const results = nodes.filter((n) => n.type === "result");
  const insights = nodes.filter((n) => n.type === "insight");

  if (pillars.length > 0) {
    // Triangle layout: 3 pillars at triangle vertices + results below
    return _triangleLayout(diagram);
  }

  const leftX = 40;
  const rightX = 40 + COL_W + COL_GAP;
  let y = 40;

  // Headers
  leftHeaders.forEach((n) => {
    posMap.set(n.id, { x: leftX, y, w: COL_W, h: HEADER_H });
  });
  rightHeaders.forEach((n) => {
    posMap.set(n.id, { x: rightX, y, w: COL_W, h: HEADER_H });
  });
  if (leftHeaders.length || rightHeaders.length) y += HEADER_H + 20;

  // Rows (paired)
  const maxRows = Math.max(leftRows.length, rightRows.length);
  for (let i = 0; i < maxRows; i++) {
    if (leftRows[i])
      posMap.set(leftRows[i].id, { x: leftX, y, w: COL_W, h: ROW_H });
    if (rightRows[i])
      posMap.set(rightRows[i].id, { x: rightX, y, w: COL_W, h: ROW_H });
    y += ROW_H + 16;
  }

  y += 10;
  // Footers
  leftFooters.forEach((n) => {
    posMap.set(n.id, { x: leftX, y, w: COL_W, h: FOOTER_H });
  });
  rightFooters.forEach((n) => {
    posMap.set(n.id, { x: rightX, y, w: COL_W, h: FOOTER_H });
  });
  if (leftFooters.length || rightFooters.length) y += FOOTER_H + 20;

  return {
    posMap,
    canvasW: rightX + COL_W + 60,
    canvasH: y + 40,
    dividerX: DIVIDER_X,
  };
}

/* ── CAP Theorem triangle layout ─────────────────────────── */
function _triangleLayout(diagram) {
  const nodes = diagram.nodes;
  const posMap = new Map();

  const pillars = nodes.filter((n) => n.type === "pillar");
  const results = nodes.filter((n) => n.type === "result");
  const insights = nodes.filter((n) => n.type === "insight");

  const CX = 460,
    CY = 240;
  const R = 240;

  // Place 3 pillars at triangle vertices (top, bottom-left, bottom-right)
  const angles = [
    -Math.PI / 2,
    Math.PI / 2 + Math.PI / 3,
    Math.PI / 2 - Math.PI / 3,
  ];
  pillars.forEach((n, i) => {
    const a = angles[i] || 0;
    posMap.set(n.id, {
      x: CX + Math.cos(a) * R - COL_W / 2 + 20,
      y: CY + Math.sin(a) * R - NODE_H / 2,
      w: 200,
      h: 140,
    });
  });

  // Place results between pairs
  const resultAngles = [Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6];
  results.forEach((n, i) => {
    const a =
      resultAngles[i] !== undefined ? resultAngles[i] : i * ((2 * Math.PI) / 3);
    posMap.set(n.id, {
      x: CX + Math.cos(a - Math.PI / 2) * (R * 0.52) - 90,
      y: CY + Math.sin(a - Math.PI / 2) * (R * 0.52) - 60,
      w: 180,
      h: 130,
    });
  });

  // Place insight at bottom
  insights.forEach((n, i) => {
    posMap.set(n.id, { x: CX - 180, y: CY + R + 60 + i * 150, w: 360, h: 120 });
  });

  let maxX = 0,
    maxY = 0;
  posMap.forEach(({ x, w, y, h }) => {
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });

  return { posMap, canvasW: maxX + 60, canvasH: maxY + 60 };
}

/* ================================================================
   PROCESS LAYOUT — linear sequential steps
================================================================ */
function _processLayout(diagram) {
  const nodes = diagram.nodes;
  const posMap = new Map();
  const isHoriz = diagram.layout === "left-right";
  const STEP_GAP = isHoriz ? NODE_W + 60 : NODE_H + 60;
  const CROSS = 40;

  nodes.forEach((n, i) => {
    if (isHoriz) {
      posMap.set(n.id, {
        x: CROSS + i * STEP_GAP,
        y: 80,
        w: NODE_W,
        h: NODE_H,
      });
    } else {
      posMap.set(n.id, {
        x: 80,
        y: CROSS + i * STEP_GAP,
        w: NODE_W,
        h: NODE_H,
      });
    }
  });

  let maxX = 0,
    maxY = 0;
  posMap.forEach(({ x, w, y, h }) => {
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });
  return { posMap, canvasW: maxX + 60, canvasH: maxY + 60 };
}

/* ── Compute anchor points for connections ───────────────── */
function getAnchor(pos, direction = "bottom") {
  const { x, y, w, h } = pos;
  switch (direction) {
    case "top":
      return { x: x + w / 2, y };
    case "bottom":
      return { x: x + w / 2, y: y + h };
    case "left":
      return { x, y: y + h / 2 };
    case "right":
      return { x: x + w, y: y + h / 2 };
    case "center":
      return { x: x + w / 2, y: y + h / 2 };
    default:
      return { x: x + w / 2, y: y + h };
  }
}

/* ── Determine best connection direction between two nodes ── */
function bestAnchors(fromPos, toPos) {
  const fc = { x: fromPos.x + fromPos.w / 2, y: fromPos.y + fromPos.h / 2 };
  const tc = { x: toPos.x + toPos.w / 2, y: toPos.y + toPos.h / 2 };
  const dx = tc.x - fc.x;
  const dy = tc.y - fc.y;

  if (Math.abs(dy) >= Math.abs(dx)) {
    // Mostly vertical
    return dy > 0
      ? { from: getAnchor(fromPos, "bottom"), to: getAnchor(toPos, "top") }
      : { from: getAnchor(fromPos, "top"), to: getAnchor(toPos, "bottom") };
  } else {
    // Mostly horizontal
    return dx > 0
      ? { from: getAnchor(fromPos, "right"), to: getAnchor(toPos, "left") }
      : { from: getAnchor(fromPos, "left"), to: getAnchor(toPos, "right") };
  }
}

/* ── Build cubic bezier path string ──────────────────────── */
function bezierPath(from, to) {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const cx = dx * 0.5;
  const cy = dy * 0.5;

  // Determine control point direction based on movement
  const horizontal = dx > dy;
  const cp1x = horizontal ? from.x + cx : from.x;
  const cp1y = horizontal ? from.y : from.y + cy;
  const cp2x = horizontal ? to.x - cx : to.x;
  const cp2y = horizontal ? to.y : to.y - cy;

  return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
}

export const LayoutEngine = {
  calculateLayout,
  getAnchor,
  bestAnchors,
  bezierPath,
};
