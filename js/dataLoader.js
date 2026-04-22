/* ================================================================
   DATA LOADER — Loads diagram JSON from content/diagrams/
   Caches results, falls back to manifest-derived auto-generation
================================================================ */

const DIAGRAMS_BASE = "content/diagrams/";
const DIAGRAMS_INDEX = "content/diagrams/index.json";

let _index = null;
const _cache = new Map();

/* ── Load the diagram registry ───────────────────────────── */
async function loadIndex() {
  if (_index) return _index;
  try {
    const res = await fetch(DIAGRAMS_INDEX);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _index = await res.json();
    return _index;
  } catch (err) {
    console.warn("DiagramDataLoader: index load failed", err);
    _index = { version: "1.0", diagrams: {} };
    return _index;
  }
}

/* ── Load a specific diagram by topic ID ─────────────────── */
async function loadDiagram(topicId) {
  if (_cache.has(topicId)) return _cache.get(topicId);

  const index = await loadIndex();
  const filePath = index.diagrams?.[topicId];

  if (!filePath) return null;

  try {
    const res = await fetch(DIAGRAMS_BASE + filePath);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _cache.set(topicId, data);
    return data;
  } catch (err) {
    console.warn(
      `DiagramDataLoader: diagram load failed for "${topicId}"`,
      err,
    );
    return null;
  }
}

/* ── Check if a diagram exists for a topic ID ────────────── */
async function hasDiagram(topicId) {
  const index = await loadIndex();
  return !!index.diagrams?.[topicId];
}

/* ── Load multiple diagrams (batch preload) ──────────────── */
async function preloadDiagrams(topicIds) {
  await Promise.allSettled(topicIds.map((id) => loadDiagram(id)));
}

/* ── Auto-generate a simple hierarchy diagram from manifest ─ */
function generateFromTopic(subject, section, topic) {
  const theme = _themeForSubject(subject.id);
  const nodes = [
    {
      id: "root",
      label: topic.title,
      icon: section.icon || subject.icon || "📄",
      type: "root",
      description: `Part of: ${section.title} — ${subject.title}`,
    },
  ];

  // Add section siblings as branches to give visual structure
  const siblings = section.topics.slice(0, 6).filter((t) => t.id !== topic.id);
  if (siblings.length > 0) {
    nodes.push({
      id: "related",
      label: "Related Topics",
      icon: "🔗",
      type: "branch",
      parent: "root",
      color: subject.color || "#6366f1",
      description: `Other topics in ${section.title}`,
    });
    siblings.forEach((t) => {
      nodes.push({
        id: `sibling-${t.id}`,
        label: t.title,
        icon: "📄",
        type: "leaf",
        parent: "related",
        items: [`${t.readTime} min read`],
      });
    });
  }

  return {
    id: topic.id,
    title: topic.title,
    subtitle: `${subject.title} › ${section.title}`,
    type: "hierarchy",
    theme,
    layout: "top-down",
    generated: true,
    nodes,
  };
}

/* ── Load or auto-generate for a full topic context ─────── */
async function loadOrGenerate(subject, section, topic) {
  const data = await loadDiagram(topic.id);
  if (data) return data;
  return generateFromTopic(subject, section, topic);
}

/* ── Internal helpers ────────────────────────────────────── */
function _themeForSubject(subjectId) {
  const map = {
    "system-design": "indigo",
    "aws-cloud": "amber",
    dsa: "emerald",
  };
  return map[subjectId] || "indigo";
}

/* ── Cache management ────────────────────────────────────── */
function clearCache() {
  _cache.clear();
  _index = null;
}

function cacheSize() {
  return _cache.size;
}

export const DiagramDataLoader = {
  loadIndex,
  loadDiagram,
  hasDiagram,
  preloadDiagrams,
  generateFromTopic,
  loadOrGenerate,
  clearCache,
  cacheSize,
};
