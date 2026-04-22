/* ================================================================
   SEARCH — Global topic search + dashboard subject filter
================================================================ */

/* ================================================================
   SEARCH — Global topic search + dashboard subject filter
================================================================ */

// ── State ──────────────────────────────────────────────
let _manifest = null;
let _allTopics = []; // flattened search index

// ── Build search index from manifest ─────────────────────
function buildIndex(manifest) {
  _manifest = manifest;
  _allTopics = [];

  manifest.subjects.forEach((subject) => {
    subject.sections.forEach((section) => {
      section.topics.forEach((topic) => {
        _allTopics.push({
          subjectId: subject.id,
          subjectTitle: subject.title,
          subjectIcon: subject.icon,
          subjectColor: subject.color,
          sectionId: section.id,
          sectionTitle: section.title,
          topicId: topic.id,
          topicTitle: topic.title,
          readTime: topic.readTime,
          // build navigation hash
          hash: `#/topic/${subject.id}/${section.id}/${topic.id}`,
        });
      });
    });
  });
}

// ── Sanitize text before injecting into HTML ─────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Fuzzy-style text match: highlight matched chars ───────
function highlight(text, query) {
  if (!query) return escapeHtml(text);
  const safeText = escapeHtml(text);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safeText.replace(new RegExp(`(${escaped})`, "gi"), "<mark>$1</mark>");
}

// ── Search across flattened index ────────────────────────
function queryTopics(q) {
  if (!q || q.trim() === "") return [];
  const lower = q.toLowerCase().trim();
  return _allTopics
    .filter(
      (t) =>
        t.topicTitle.toLowerCase().includes(lower) ||
        t.subjectTitle.toLowerCase().includes(lower) ||
        t.sectionTitle.toLowerCase().includes(lower),
    )
    .slice(0, 10); // cap at 10 results
}

// ── Render dropdown results ───────────────────────────────
function renderDropdown(results, query, dropdownEl) {
  dropdownEl.hidden = results.length === 0 && query.length < 1;

  if (results.length === 0 && query.length > 0) {
    dropdownEl.hidden = false;
    dropdownEl.innerHTML = `
        <div class="search-no-results">
          <div style="font-size:1.5rem;margin-bottom:8px">🔍</div>
          No results for "<strong>${escapeHtml(query)}</strong>"
        </div>`;
    return;
  }

  dropdownEl.innerHTML = results
    .map(
      (r) => `
      <a
        class="search-result-item"
        href="${escapeHtml(r.hash)}"
        role="option"
        aria-label="${escapeHtml(r.topicTitle)} in ${escapeHtml(r.subjectTitle)}"
      >
        <span
          class="search-result-item__icon"
          style="background:${escapeHtml(r.subjectColor)}22"
          aria-hidden="true"
        >${escapeHtml(r.subjectIcon)}</span>
        <span class="search-result-item__body">
          <span class="search-result-item__title">${highlight(r.topicTitle, query)}</span>
          <span class="search-result-item__meta">${escapeHtml(r.subjectTitle)} › ${escapeHtml(r.sectionTitle)} · ${escapeHtml(String(r.readTime))} min read</span>
        </span>
      </a>
    `,
    )
    .join("");
}

// ── Global header search init ─────────────────────────────
function initGlobalSearch() {
  const input = document.getElementById("global-search");
  const dropdown = document.getElementById("search-dropdown");
  if (!input || !dropdown) return;

  let debounceTimer;

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const q = input.value.trim();
      const results = queryTopics(q);
      renderDropdown(results, q, dropdown);
    }, 180);
  });

  // Keyboard: ArrowDown / ArrowUp navigation in dropdown
  input.addEventListener("keydown", (e) => {
    if (dropdown.hidden) return;
    const items = dropdown.querySelectorAll(".search-result-item");
    const focused = dropdown.querySelector('[aria-selected="true"]');
    let idx = Array.from(items).indexOf(focused);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      idx = (idx + 1) % items.length;
      items.forEach((i) => i.removeAttribute("aria-selected"));
      if (items[idx]) items[idx].setAttribute("aria-selected", "true");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      idx = (idx - 1 + items.length) % items.length;
      items.forEach((i) => i.removeAttribute("aria-selected"));
      if (items[idx]) items[idx].setAttribute("aria-selected", "true");
    } else if (e.key === "Enter") {
      const sel = dropdown.querySelector('[aria-selected="true"]');
      if (sel) {
        e.preventDefault();
        sel.click();
        closeDropdown();
      }
    } else if (e.key === "Escape") {
      closeDropdown();
      input.blur();
    }
  });

  // Close when clicking outside
  document.addEventListener("click", (e) => {
    if (!input.parentElement.contains(e.target)) closeDropdown();
  });

  // Open on focus if query exists
  input.addEventListener("focus", () => {
    if (input.value.trim()) {
      const results = queryTopics(input.value.trim());
      renderDropdown(results, input.value.trim(), dropdown);
    }
  });

  function closeDropdown() {
    dropdown.hidden = true;
    dropdown.innerHTML = "";
  }

  // Keyboard shortcut: ⌘K / Ctrl+K
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
}

// ── Dashboard subject filter ──────────────────────────────
function initSubjectFilter() {
  const filterInput = document.getElementById("subject-search");
  const filterTags = document.getElementById("filter-tags");
  const grid = document.getElementById("subjects-grid");

  if (!filterInput || !filterTags || !grid) return;

  // Filter by text input
  filterInput.addEventListener("input", () => {
    const q = filterInput.value.toLowerCase().trim();
    const cards = grid.querySelectorAll(".subject-card");
    cards.forEach((card) => {
      const title = (card.dataset.title || "").toLowerCase();
      const match = !q || title.includes(q);
      card.style.display = match ? "" : "none";
    });
  });

  // Filter by tag (event delegation)
  filterTags.addEventListener("click", (e) => {
    const tag = e.target.closest(".tag");
    if (!tag) return;

    const filter = tag.dataset.filter;
    filterTags.querySelectorAll(".tag").forEach((t) => {
      t.classList.toggle("tag--active", t === tag);
      t.setAttribute("aria-pressed", t === tag ? "true" : "false");
    });

    const cards = grid.querySelectorAll(".subject-card");
    cards.forEach((card) => {
      const match = filter === "all" || card.dataset.subjectId === filter;
      card.style.display = match ? "" : "none";
    });
  });
}

// ── Populate tag buttons for each subject ─────────────────
function populateFilterTags(manifest) {
  const filterTags = document.getElementById("filter-tags");
  if (!filterTags) return;

  manifest.subjects.forEach((subject) => {
    const btn = document.createElement("button");
    btn.className = "tag";
    btn.dataset.filter = subject.id;
    btn.setAttribute("aria-pressed", "false");
    btn.innerHTML = `${subject.icon} ${subject.title}`;
    filterTags.appendChild(btn);
  });
}

// ── Public API ────────────────────────────────────────────
function init(manifest) {
  buildIndex(manifest);
  initGlobalSearch();
  initSubjectFilter();
  populateFilterTags(manifest);
}

export const Search = { init, buildIndex, queryTopics };
