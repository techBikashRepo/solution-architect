/* ================================================================
   NAVIGATION — Hash Router, Sidebar, Breadcrumbs, Prev/Next,
                Dashboard card rendering, Mobile drawer nav
================================================================ */
import { ContentLoader } from "./contentLoader.js";
import { ProgressManager } from "./progress.js";
import { UI } from "./ui.js";
import { Search } from "./search.js";
import { ThemeManager } from "./theme.js";
import { findVideoTopic, findByteByteGoTopic } from "./topicsData.js";
import { findPdf } from "./pdfData.js";
import { getDocs, findDoc } from "./docsData.js";

let _manifest = null;
let _currentSubject = null;
let _currentSection = null;
let _currentTopic = null;

/* ─────────────────────────────────────────────────────────
     ROUTE PARSING
  ───────────────────────────────────────────────────────── */

/**
 * Parse the window.location.hash and return a route object.
 * Supported hashes:
 *   #/                                    → dashboard
 *   #/subject/:subjectId                  → subject overview
 *   #/topic/:subjectId/:sectionId/:topicId → topic view
 *   #/videos/:subjectId                   → all videos gallery
 *   #/video/:subjectId/:topicId           → single video player
 *   #/pdfs/:subjectId                    → all PDFs gallery
 *   #/pdf/:subjectId/:pdfId              → PDF reader
 */
function parseHash(hash = window.location.hash) {
  const clean = hash.replace(/^#/, "") || "/";
  const parts = clean.split("/").filter(Boolean); // remove empty strings

  if (parts.length === 0 || (parts.length === 1 && parts[0] === "")) {
    return { view: "dashboard" };
  }

  if (parts[0] === "subject" && parts[1]) {
    return { view: "subject", subjectId: parts[1] };
  }

  if (parts[0] === "topic" && parts[1] && parts[2] && parts[3]) {
    return {
      view: "topic",
      subjectId: parts[1],
      sectionId: parts[2],
      topicId: parts[3],
    };
  }

  if (parts[0] === "videos" && parts[1]) {
    return { view: "videos", subjectId: parts[1] };
  }

  if (parts[0] === "video" && parts[1] && parts[2]) {
    return { view: "video", subjectId: parts[1], topicId: parts[2] };
  }

  if (parts[0] === "pdfs" && parts[1]) {
    return { view: "pdfs", subjectId: parts[1] };
  }

  if (parts[0] === "pdf" && parts[1] && parts[2]) {
    return { view: "pdf", subjectId: parts[1], pdfId: parts[2] };
  }

  if (parts[0] === "bytebytego" && parts[1]) {
    return { view: "bytebytego", subjectId: parts[1] };
  }

  if (parts[0] === "bbvideo" && parts[1] && parts[2]) {
    return { view: "bbvideo", subjectId: parts[1], topicId: parts[2] };
  }

  if (parts[0] === "docs" && parts[1]) {
    return { view: "docs", subjectId: parts[1] };
  }

  if (parts[0] === "doc" && parts[1] && parts[2]) {
    return { view: "doc", subjectId: parts[1], docId: parts[2] };
  }

  return { view: "dashboard" };
}

/* ─────────────────────────────────────────────────────────
     LOOKUP HELPERS
  ───────────────────────────────────────────────────────── */

function findSubject(subjectId) {
  return _manifest.subjects.find((s) => s.id === subjectId) || null;
}

function findSection(subject, sectionId) {
  return subject.sections.find((s) => s.id === sectionId) || null;
}

function findTopic(section, topicId) {
  return section.topics.find((t) => t.id === topicId) || null;
}

/** Flatten all topics in a subject for prev/next navigation */
function flattenTopics(subject) {
  return subject.sections.flatMap((sec) =>
    sec.topics.map((t) => ({ subject, section: sec, topic: t })),
  );
}

/* ─────────────────────────────────────────────────────────
     VIEWS
  ───────────────────────────────────────────────────────── */

function showView(viewId) {
  ["view-dashboard", "view-content"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.hidden = id !== viewId;
  });
}

/* ─────────────────────────────────────────────────────────
     DASHBOARD
  ───────────────────────────────────────────────────────── */

function renderDashboard() {
  showView("view-dashboard");
  _currentSubject = null;
  _currentSection = null;
  _currentTopic = null;
  UI.resetReadingProgress();

  // Update stats
  const progress = ProgressManager.getTotalProgress(_manifest);
  const statTotal = document.getElementById("stat-total");
  const statCompleted = document.getElementById("stat-completed");
  const statPct = document.getElementById("stat-pct");

  if (statTotal) statTotal.textContent = progress.total;
  if (statCompleted) statCompleted.textContent = progress.completed;
  if (statPct) statPct.textContent = progress.percentage + "%";

  // Drive hero XP bar
  const xpFill = document.getElementById("hero-xp-fill");
  const xpPct = document.getElementById("hero-xp-pct");
  const xpBar = document.getElementById("hero-xp-bar");
  if (xpFill) xpFill.style.width = progress.percentage + "%";
  if (xpPct) xpPct.textContent = progress.percentage + "%";
  if (xpBar) xpBar.setAttribute("aria-valuenow", progress.percentage);

  renderSubjectCards();
}

/* Convert a 3- or 6-digit hex color to "r, g, b" triplet */
function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

function renderSubjectCards() {
  const grid = document.getElementById("subjects-grid");
  if (!grid) return;

  grid.innerHTML = _manifest.subjects
    .map((subject, i) => {
      const progress = ProgressManager.getSubjectProgress(subject);
      const circumference = 138.23; // 2π × 22
      const offset =
        circumference - (circumference * progress.percentage) / 100;

      return `
        <article
          class="subject-card"
          role="listitem"
          tabindex="0"
          aria-label="${subject.title}: ${progress.completed} of ${progress.total} topics completed"
          data-subject-id="${subject.id}"
          data-title="${subject.title.toLowerCase()}"
          style="animation-delay:${i * 80}ms; --card-accent:${hexToRgb(subject.color || "#6366f1")}"
        >
          <div class="subject-card__header" style="background:${subject.gradient}">
            <span class="subject-card__icon" aria-hidden="true">${subject.icon}</span>
            <div class="progress-ring-wrap" aria-hidden="true">
              <svg class="progress-ring" viewBox="0 0 60 60" role="img" aria-label="${progress.percentage}% complete">
                <circle class="progress-ring__bg"   cx="30" cy="30" r="22"/>
                <circle class="progress-ring__fill" cx="30" cy="30" r="22"
                  stroke-dasharray="${circumference}"
                  stroke-dashoffset="${offset}"
                />
              </svg>
              <span class="progress-ring__label">${progress.percentage}%</span>
            </div>
          </div>
          <div class="subject-card__body">
            <h2 class="subject-card__title">${subject.title}</h2>
            <p class="subject-card__desc">${subject.description}</p>
            <div class="subject-card__meta">
              <span class="subject-card__meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                ${subject.sections.length} sections
              </span>
              <span class="subject-card__meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ${subject.sections.flatMap((s) => s.topics).length} topics
              </span>
            </div>
            <div class="subject-card__progress-bar" aria-hidden="true">
              <div
                class="subject-card__progress-fill"
                style="width:${progress.percentage}%;background:${subject.gradient}"
              ></div>
            </div>
            <div class="subject-card__footer">
              <span class="subject-card__completed">${progress.completed} / ${progress.total} completed</span>
              <span class="subject-card__arrow" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                ${progress.completed === 0 ? "Start" : progress.percentage < 100 ? "Continue" : "Review"}
              </span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  // Click / keyboard activation
  grid.querySelectorAll(".subject-card").forEach((card) => {
    const id = card.dataset.subjectId;
    card.addEventListener("click", () => {
      window.location.hash = `#/subject/${id}`;
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        window.location.hash = `#/subject/${id}`;
      }
    });
  });
}

/* ─────────────────────────────────────────────────────────
     SUBJECT OVERVIEW
  ───────────────────────────────────────────────────────── */

function renderSubjectView(subjectId) {
  const subject = findSubject(subjectId);
  if (!subject) {
    window.location.hash = "#/";
    return;
  }

  _currentSubject = subject;
  _currentSection = null;
  _currentTopic = null;

  showView("view-content");
  renderSidebar(subject, null, null);
  updateBreadcrumb(subject, null, null);
  hideTopicFooter();
  ContentLoader.loadSubjectOverview(subject);
  updateMobileDrawer(subject);
  updateSidebarProgress(subject);
}

/* ─────────────────────────────────────────────────────────
     TOPIC VIEW
  ───────────────────────────────────────────────────────── */

function renderTopicView(subjectId, sectionId, topicId) {
  const subject = findSubject(subjectId);
  if (!subject) {
    window.location.hash = "#/";
    return;
  }

  const section = findSection(subject, sectionId);
  if (!section) {
    window.location.hash = `#/subject/${subjectId}`;
    return;
  }

  const topic = findTopic(section, topicId);
  if (!topic) {
    window.location.hash = `#/subject/${subjectId}`;
    return;
  }

  _currentSubject = subject;
  _currentSection = section;
  _currentTopic = topic;

  showView("view-content");
  renderSidebar(subject, section, topic);
  updateBreadcrumb(subject, section, topic);
  showTopicFooter(subject, section, topic);
  ContentLoader.loadTopic(subject, section, topic);
  updateMobileDrawer(subject, section, topic);
  updateSidebarProgress(subject);

  // Update document title
  document.title = `${topic.title} — ${subject.title} | LearnPath`;
}

/* ─────────────────────────────────────────────────────────
     VIDEOS GALLERY VIEW
  ───────────────────────────────────────────────────────── */

function renderVideosView(subjectId) {
  const subject = findSubject(subjectId);
  if (!subject) {
    window.location.hash = "#/";
    return;
  }

  _currentSubject = subject;
  _currentSection = null;
  _currentTopic = null;

  showView("view-content");
  renderSidebar(subject, null, null);
  updateBreadcrumb(subject, null, null, "videos");
  hideTopicFooter();
  ContentLoader.loadVideosPage(subject);
  updateMobileDrawer(subject);
  updateSidebarProgress(subject);

  document.title = `Videos — ${subject.title} | LearnPath`;
}

/* ─────────────────────────────────────────────────────────
     VIDEO VIEW
  ───────────────────────────────────────────────────────── */

function renderVideoView(subjectId, topicId) {
  const subject = findSubject(subjectId);
  if (!subject) {
    window.location.hash = "#/";
    return;
  }

  const topic = findVideoTopic(subjectId, topicId);
  if (!topic) {
    window.location.hash = `#/subject/${subjectId}`;
    return;
  }

  _currentSubject = subject;
  _currentSection = null;
  _currentTopic = null;

  showView("view-content");
  renderSidebar(subject, null, null);
  updateBreadcrumb(subject, null, null);
  hideTopicFooter();
  ContentLoader.loadVideoPlayer(topic, subjectId, subject);
  updateMobileDrawer(subject);
  updateSidebarProgress(subject);

  document.title = `${topic.title} — ${subject.title} | LearnPath`;
}

/* ─────────────────────────────────────────────────────────
     PDFS GALLERY VIEW
  ───────────────────────────────────────────────────────── */

function renderPdfsView(subjectId) {
  const subject = findSubject(subjectId);
  if (!subject) {
    window.location.hash = "#/";
    return;
  }

  _currentSubject = subject;
  _currentSection = null;
  _currentTopic = null;

  showView("view-content");
  renderSidebar(subject, null, null);
  updateBreadcrumb(subject, null, null, "pdfs");
  hideTopicFooter();
  ContentLoader.loadPdfsPage(subject);
  updateMobileDrawer(subject);
  updateSidebarProgress(subject);

  document.title = `PDFs — ${subject.title} | LearnPath`;
}

/* ─────────────────────────────────────────────────────────
     PDF READER VIEW
  ───────────────────────────────────────────────────────── */

function renderPdfReaderView(subjectId, pdfId) {
  const subject = findSubject(subjectId);
  if (!subject) {
    window.location.hash = "#/";
    return;
  }

  const pdf = findPdf(subjectId, pdfId);
  if (!pdf) {
    window.location.hash = `#/pdfs/${subjectId}`;
    return;
  }

  _currentSubject = subject;
  _currentSection = null;
  _currentTopic = null;

  showView("view-content");
  renderSidebar(subject, null, null);
  updateBreadcrumb(subject, null, null, "pdf-reader");
  hideTopicFooter();
  ContentLoader.loadPdfReader(pdf, subject);
  updateMobileDrawer(subject);
  updateSidebarProgress(subject);

  document.title = `${pdf.title} — ${subject.title} | LearnPath`;
}

/* ─────────────────────────────────────────────────────────
     BYTEBYTEGO CHANNEL VIEW
  ───────────────────────────────────────────────────────── */

function renderByteByteGoView(subjectId) {
  const subject = findSubject(subjectId);
  if (!subject) {
    window.location.hash = "#/";
    return;
  }

  _currentSubject = subject;
  _currentSection = null;
  _currentTopic = null;

  showView("view-content");
  renderSidebar(subject, null, null);
  updateBreadcrumb(subject, null, null, "bytebytego");
  hideTopicFooter();
  ContentLoader.loadByteByteGoPage(subject);
  updateMobileDrawer(subject);
  updateSidebarProgress(subject);

  document.title = `ByteByteGo Videos — ${subject.title} | LearnPath`;
}

/* ─────────────────────────────────────────────────────────
     BYTEBYTEGO VIDEO PLAYER VIEW
  ───────────────────────────────────────────────────────── */

function renderBbVideoView(subjectId, topicId) {
  const subject = findSubject(subjectId);
  if (!subject) {
    window.location.hash = "#/";
    return;
  }

  const topic = findByteByteGoTopic(subjectId, topicId);
  if (!topic) {
    window.location.hash = `#/bytebytego/${subjectId}`;
    return;
  }

  _currentSubject = subject;
  _currentSection = null;
  _currentTopic = null;

  showView("view-content");
  renderSidebar(subject, null, null);
  updateBreadcrumb(subject, null, null, "bytebytego");
  hideTopicFooter();
  ContentLoader.loadByteByteGoVideo(topic, subjectId, subject);
  updateMobileDrawer(subject);
  updateSidebarProgress(subject);

  document.title = `${topic.title} — ByteByteGo | LearnPath`;
}

/* ─────────────────────────────────────────────────────────
     DOCS GALLERY VIEW
  ───────────────────────────────────────────────────────── */

function renderDocsView(subjectId) {
  const subject = findSubject(subjectId);
  if (!subject) {
    window.location.hash = "#/";
    return;
  }

  _currentSubject = subject;
  _currentSection = null;
  _currentTopic = null;

  showView("view-content");
  renderSidebar(subject, null, null);
  updateBreadcrumb(subject, null, null, "docs");
  hideTopicFooter();
  ContentLoader.loadDocsPage(subject);
  updateMobileDrawer(subject);
  updateSidebarProgress(subject);

  document.title = `Interview Docs — ${subject.title} | LearnPath`;
}

/* ─────────────────────────────────────────────────────────
     DOC READER VIEW
  ───────────────────────────────────────────────────────── */

function renderDocReaderView(subjectId, docId) {
  const subject = findSubject(subjectId);
  if (!subject) {
    window.location.hash = "#/";
    return;
  }

  const doc = findDoc(subjectId, docId);
  if (!doc) {
    window.location.hash = `#/docs/${subjectId}`;
    return;
  }

  _currentSubject = subject;
  _currentSection = null;
  _currentTopic = null;

  showView("view-content");
  renderSidebar(subject, null, null);
  updateBreadcrumb(subject, null, null, "doc-reader");
  hideTopicFooter();
  ContentLoader.loadDocReader(doc, subject);
  updateMobileDrawer(subject);
  updateSidebarProgress(subject);

  document.title = `${doc.title} — Interview Docs | LearnPath`;
}

/* ─────────────────────────────────────────────────────────
     SIDEBAR
  ───────────────────────────────────────────────────────── */

function renderSidebar(subject, activeSection, activeTopic) {
  // Subject header
  const subjectEl = document.getElementById("sidebar-subject");
  if (subjectEl) {
    subjectEl.innerHTML = `
        <span class="sidebar__subject-icon" aria-hidden="true">${subject.icon}</span>
        <span class="sidebar__subject-name">${subject.title}</span>
      `;
  }

  // Section + topic list
  const navEl = document.getElementById("sidebar-nav");
  if (!navEl) return;

  navEl.innerHTML = subject.sections
    .map((section) => {
      const isActiveSection = activeSection && section.id === activeSection.id;
      const completedCount = section.topics.filter((t) =>
        ProgressManager.isCompleted(t.id),
      ).length;

      const topicsHTML = section.topics
        .map((topic) => {
          const isActiveTopic = activeTopic && topic.id === activeTopic.id;
          const isDone = ProgressManager.isCompleted(topic.id);
          return `
          <li class="sidebar-topic">
            <button
              class="sidebar-topic__btn${isActiveTopic ? " is-active" : ""}${isDone ? " is-done" : ""}"
              data-hash="#/topic/${subject.id}/${section.id}/${topic.id}"
              aria-current="${isActiveTopic ? "page" : "false"}"
              aria-label="${topic.title}${isDone ? " (completed)" : ""}"
              title="${topic.title} · ${topic.readTime} min"
            >
              <span class="sidebar-topic__status" aria-hidden="true">${isDone ? "✓" : ""}</span>
              <span class="sidebar-topic__title">${topic.title}</span>
              <span class="sidebar-topic__time" aria-hidden="true">${topic.readTime}m</span>
            </button>
          </li>
        `;
        })
        .join("");

      return `
        <div class="sidebar-section${!isActiveSection && activeSection ? " is-collapsed" : ""}" data-section-id="${section.id}">
          <button
            class="sidebar-section__toggle"
            aria-expanded="${isActiveSection || !activeSection ? "true" : "false"}"
            aria-controls="section-topics-${section.id}"
          >
            <span class="sidebar-section__icon" aria-hidden="true">${section.icon}</span>
            <span class="sidebar-section__title">${section.title}</span>
            <span class="sidebar-section__count" aria-label="${completedCount} of ${section.topics.length} done">${completedCount}/${section.topics.length}</span>
            <svg class="sidebar-section__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <ul class="sidebar-section__topics" id="section-topics-${section.id}" role="list">
            ${topicsHTML}
          </ul>
        </div>
      `;
    })
    .join("");

  // Collapse/expand sections via event delegation
  navEl.addEventListener("click", handleSidebarClick);
}

function handleSidebarClick(e) {
  // Topic button click
  const topicBtn = e.target.closest(".sidebar-topic__btn");
  if (topicBtn && topicBtn.dataset.hash) {
    window.location.hash = topicBtn.dataset.hash;
    UI.closeDrawer();
    return;
  }

  // Section toggle
  const toggle = e.target.closest(".sidebar-section__toggle");
  if (toggle) {
    const section = toggle.closest(".sidebar-section");
    if (section) {
      const isCollapsed = section.classList.toggle("is-collapsed");
      toggle.setAttribute("aria-expanded", !isCollapsed ? "true" : "false");
    }
  }
}

function updateSidebarProgress(subject) {
  const fill = document.getElementById("sidebar-progress-fill");
  const label = document.getElementById("sidebar-progress-label");
  const progress = ProgressManager.getSubjectProgress(subject);

  if (fill) fill.style.width = progress.percentage + "%";
  if (label) label.textContent = `${progress.completed} / ${progress.total}`;
}

/* ─────────────────────────────────────────────────────────
     BREADCRUMB
  ───────────────────────────────────────────────────────── */

function updateBreadcrumb(subject, section, topic, pageType = null) {
  const el = document.getElementById("breadcrumb");
  if (!el) return;

  const items = [
    `<span class="breadcrumb__item">
        <a class="breadcrumb__link" href="#/" aria-label="Dashboard">Home</a>
      </span>`,
    `<span class="breadcrumb__sep" aria-hidden="true">/</span>`,
    `<span class="breadcrumb__item">
        <a class="breadcrumb__link" href="#/subject/${subject.id}">${subject.title}</a>
      </span>`,
  ];

  if (section && topic) {
    items.push(
      `<span class="breadcrumb__sep" aria-hidden="true">/</span>`,
      `<span class="breadcrumb__item">
          <span class="breadcrumb__current" aria-current="page">${topic.title}</span>
        </span>`,
    );
  }

  if (pageType === "videos") {
    items.push(
      `<span class="breadcrumb__sep" aria-hidden="true">/</span>`,
      `<span class="breadcrumb__item">
          <span class="breadcrumb__current" aria-current="page">Videos</span>
        </span>`,
    );
  }

  if (pageType === "pdfs") {
    items.push(
      `<span class="breadcrumb__sep" aria-hidden="true">/</span>`,
      `<span class="breadcrumb__item">
          <span class="breadcrumb__current" aria-current="page">PDFs</span>
        </span>`,
    );
  }

  if (pageType === "pdf-reader") {
    items.push(
      `<span class="breadcrumb__sep" aria-hidden="true">/</span>`,
      `<span class="breadcrumb__item">
          <a class="breadcrumb__link" href="#/pdfs/${subject.id}">PDFs</a>
        </span>`,
    );
  }

  if (pageType === "bytebytego") {
    items.push(
      `<span class="breadcrumb__sep" aria-hidden="true">/</span>`,
      `<span class="breadcrumb__item">
          <a class="breadcrumb__link" href="#/videos/${subject.id}">Videos</a>
        </span>`,
      `<span class="breadcrumb__sep" aria-hidden="true">/</span>`,
      `<span class="breadcrumb__item">
          <span class="breadcrumb__current" aria-current="page">ByteByteGo</span>
        </span>`,
    );
  }

  if (pageType === "docs") {
    items.push(
      `<span class="breadcrumb__sep" aria-hidden="true">/</span>`,
      `<span class="breadcrumb__item">
          <span class="breadcrumb__current" aria-current="page">Interview Docs</span>
        </span>`,
    );
  }

  if (pageType === "doc-reader") {
    items.push(
      `<span class="breadcrumb__sep" aria-hidden="true">/</span>`,
      `<span class="breadcrumb__item">
          <a class="breadcrumb__link" href="#/docs/${subject.id}">Interview Docs</a>
        </span>`,
    );
  }

  // Action pills pushed to far right — hidden on their own gallery pages
  const pills = [];
  if (pageType !== "videos" && pageType !== "bytebytego") {
    pills.push(
      `<a class="breadcrumb__videos-btn" href="#/videos/${subject.id}" aria-label="View all videos for ${subject.title}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Videos
      </a>`,
    );
  }
  if (pageType !== "pdfs" && pageType !== "pdf-reader") {
    pills.push(
      `<a class="breadcrumb__pdf-btn" href="#/pdfs/${subject.id}" aria-label="View all PDFs for ${subject.title}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        PDF
      </a>`,
    );
  }
  if (
    getDocs(subject.id).length > 0 &&
    pageType !== "docs" &&
    pageType !== "doc-reader"
  ) {
    pills.push(
      `<a class="breadcrumb__docs-btn" href="#/docs/${subject.id}" aria-label="View Interview Docs for ${subject.title}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
        Interview Docs
      </a>`,
    );
  }
  if (pills.length) {
    items.push(`<span class="breadcrumb__pills">${pills.join("")}</span>`);
  }

  el.innerHTML = items.join("");
}

/* ─────────────────────────────────────────────────────────
     TOPIC FOOTER (Prev / Complete / Next)
  ───────────────────────────────────────────────────────── */

function showTopicFooter(subject, section, topic) {
  const footer = document.getElementById("topic-footer");
  const prevBtn = document.getElementById("btn-prev");
  const nextBtn = document.getElementById("btn-next");
  const complBtn = document.getElementById("btn-complete");
  const complLbl = document.getElementById("btn-complete-label");

  if (!footer) return;
  footer.hidden = false;

  const flat = flattenTopics(subject);
  const idx = flat.findIndex((f) => f.topic.id === topic.id);
  const prev = flat[idx - 1] || null;
  const next = flat[idx + 1] || null;

  if (prevBtn) {
    prevBtn.disabled = !prev;
    prevBtn.onclick = prev
      ? () => {
          window.location.hash = `#/topic/${prev.subject.id}/${prev.section.id}/${prev.topic.id}`;
        }
      : null;
  }

  if (nextBtn) {
    nextBtn.disabled = !next;
    nextBtn.onclick = next
      ? () => {
          window.location.hash = `#/topic/${next.subject.id}/${next.section.id}/${next.topic.id}`;
        }
      : null;
  }

  if (complBtn && complLbl) {
    updateCompleteButton(topic.id);

    // Remove old listener by cloning the button
    const newBtn = complBtn.cloneNode(true);
    complBtn.parentNode.replaceChild(newBtn, complBtn);
    const newLbl = document.getElementById("btn-complete-label");

    newBtn.addEventListener("click", () => {
      const nowDone = !ProgressManager.isCompleted(topic.id);
      ProgressManager.markComplete(topic.id, nowDone);
      updateCompleteButton(topic.id);
      updateSidebarTopicStatus(topic.id, nowDone);
      updateSidebarProgress(subject);
      refreshDashboardStats();

      if (nowDone) {
        UI.toast("Topic marked as complete! 🎉", "success");
        // Auto-advance after short delay
        if (next) {
          setTimeout(() => {
            window.location.hash = `#/topic/${next.subject.id}/${next.section.id}/${next.topic.id}`;
          }, 800);
        }
      } else {
        UI.toast("Marked as incomplete", "info", 2000);
      }
    });
  }
}

function updateCompleteButton(topicId) {
  const btn = document.getElementById("btn-complete");
  const lbl = document.getElementById("btn-complete-label");
  if (!btn || !lbl) return;

  const done = ProgressManager.isCompleted(topicId);
  btn.classList.toggle("is-done", done);
  lbl.textContent = done ? "Completed ✓" : "Mark Complete";
  btn.setAttribute(
    "aria-label",
    done ? "Mark topic as incomplete" : "Mark topic as complete",
  );
}

function updateSidebarTopicStatus(topicId, done) {
  const btn = document.querySelector(
    `.sidebar-topic__btn[data-hash*="/${topicId}"]`,
  );
  if (!btn) return;
  btn.classList.toggle("is-done", done);
  const statusEl = btn.querySelector(".sidebar-topic__status");
  if (statusEl) statusEl.textContent = done ? "✓" : "";
}

function hideTopicFooter() {
  const footer = document.getElementById("topic-footer");
  if (footer) footer.hidden = true;
}

function refreshDashboardStats() {
  // Only update DOM if dashboard is visible
  const dashboard = document.getElementById("view-dashboard");
  if (dashboard && !dashboard.hidden && _manifest) {
    const p = ProgressManager.getTotalProgress(_manifest);
    const el = document.getElementById("stat-completed");
    const ep = document.getElementById("stat-pct");
    if (el) el.textContent = p.completed;
    if (ep) ep.textContent = p.percentage + "%";
  }
}

/* ─────────────────────────────────────────────────────────
     MOBILE DRAWER (subject & section/topic list)
  ───────────────────────────────────────────────────────── */

function updateMobileDrawer(subject, section, topic) {
  const body = document.getElementById("mobile-drawer-body");
  if (!body || !_manifest) return;

  if (!subject) {
    // Show subject list
    body.innerHTML = `
        <p style="font-size:var(--text-xs);font-weight:var(--weight-semibold);text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:var(--sp-3)">Subjects</p>
        ${_manifest.subjects
          .map((s) => {
            const p = ProgressManager.getSubjectProgress(s);
            return `
            <a class="drawer-subject-item" href="#/subject/${s.id}">
              <span class="drawer-subject-item__icon" style="background:${s.color}22">${s.icon}</span>
              <span>${s.title}</span>
              <span style="margin-left:auto;font-size:var(--text-xs);color:var(--text-muted)">${p.percentage}%</span>
            </a>
          `;
          })
          .join("")}
      `;
  } else {
    // Show current subject's sections/topics
    body.innerHTML = `
        <a class="btn-back" href="#/" style="display:inline-flex;margin-bottom:var(--sp-4)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          All Subjects
        </a>
        ${subject.sections
          .map((sec) => {
            const topicsHTML = sec.topics
              .map((t) => {
                const done = ProgressManager.isCompleted(t.id);
                const active = topic && t.id === topic.id;
                return `
              <a
                class="sidebar-topic__btn${active ? " is-active" : ""}${done ? " is-done" : ""}"
                href="#/topic/${subject.id}/${sec.id}/${t.id}"
                style="display:flex;align-items:center;gap:12px;padding:8px 16px 8px 20px;text-decoration:none;font-size:var(--text-sm);color:var(--text-secondary);border-radius:0;transition:all var(--ease-fast)"
              >
                <span class="sidebar-topic__status">${done ? "✓" : ""}</span>
                <span>${t.title}</span>
                <span style="margin-left:auto;font-size:var(--text-xs);color:var(--text-muted)">${t.readTime}m</span>
              </a>
            `;
              })
              .join("");

            return `
            <div style="margin-bottom:var(--sp-2)">
              <p style="font-size:var(--text-xs);font-weight:var(--weight-semibold);text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);padding:8px 16px 4px">${sec.icon} ${sec.title}</p>
              ${topicsHTML}
            </div>
          `;
          })
          .join("")}
      `;
  }

  // Close drawer on link click
  body.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => UI.closeDrawer());
  });
}

/* ─────────────────────────────────────────────────────────
     HASH ROUTER
  ───────────────────────────────────────────────────────── */

function handleHashChange() {
  const route = parseHash();

  switch (route.view) {
    case "subject":
      renderSubjectView(route.subjectId);
      break;
    case "topic":
      renderTopicView(route.subjectId, route.sectionId, route.topicId);
      break;
    case "videos":
      renderVideosView(route.subjectId);
      break;
    case "video":
      renderVideoView(route.subjectId, route.topicId);
      break;
    case "pdfs":
      renderPdfsView(route.subjectId);
      break;
    case "pdf":
      renderPdfReaderView(route.subjectId, route.pdfId);
      break;
    case "bytebytego":
      renderByteByteGoView(route.subjectId);
      break;
    case "bbvideo":
      renderBbVideoView(route.subjectId, route.topicId);
      break;
    case "docs":
      renderDocsView(route.subjectId);
      break;
    case "doc":
      renderDocReaderView(route.subjectId, route.docId);
      break;
    default:
      renderDashboard();
      document.title = "LearnPath — Solution Architect Academy";
  }
}

/* ─────────────────────────────────────────────────────────
     KEYBOARD NAVIGATION
  ───────────────────────────────────────────────────────── */

function handleKeyboard(e) {
  // Don't interfere with input fields
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName))
    return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  switch (e.key) {
    case "ArrowLeft":
    case "ArrowRight": {
      if (!_currentSubject || !_currentTopic) return;
      const flat = flattenTopics(_currentSubject);
      const idx = flat.findIndex((f) => f.topic.id === _currentTopic.id);
      const target = e.key === "ArrowLeft" ? flat[idx - 1] : flat[idx + 1];
      if (target) {
        window.location.hash = `#/topic/${target.subject.id}/${target.section.id}/${target.topic.id}`;
      }
      break;
    }
    case " ": {
      // Space = toggle complete (only in topic view)
      if (
        _currentTopic &&
        document.getElementById("view-content") &&
        !document.getElementById("view-content").hidden
      ) {
        e.preventDefault();
        const btn = document.getElementById("btn-complete");
        if (btn) btn.click();
      }
      break;
    }
    case "Escape": {
      if (_currentSubject) {
        window.location.hash = _currentTopic
          ? `#/subject/${_currentSubject.id}`
          : "#/";
      }
      break;
    }
    case "h":
    case "H": {
      window.location.hash = "#/";
      break;
    }
    case "d":
    case "D": {
      ThemeManager.toggle();
      break;
    }
    case "?": {
      UI.openModal();
      break;
    }
  }
}

/* ─────────────────────────────────────────────────────────
     BACK BUTTON
  ───────────────────────────────────────────────────────── */

function initBackButton() {
  const backBtn = document.getElementById("btn-back");
  if (backBtn) {
    backBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.hash = "#/";
    });
  }
}

/* ─────────────────────────────────────────────────────────
     CONTINUE LEARNING BUTTON
  ───────────────────────────────────────────────────────── */

function initContinueLearning() {
  const btn = document.getElementById("btn-continue-learning");
  if (!btn || !_manifest) return;

  btn.addEventListener("click", () => {
    const last = ProgressManager.getLastAccessed(_manifest);
    if (last) {
      window.location.hash = `#/topic/${last.subject.id}/${last.section.id}/${last.topic.id}`;
    } else {
      // Start from the very first topic
      const first = _manifest.subjects[0];
      if (first) {
        const sec = first.sections[0];
        const topic = sec?.topics[0];
        if (sec && topic) {
          window.location.hash = `#/topic/${first.id}/${sec.id}/${topic.id}`;
        }
      }
    }
  });
}

/* ─────────────────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────────────────── */

function init(manifest) {
  _manifest = manifest;

  initBackButton();
  initContinueLearning();

  // Listen for hash changes (back/forward navigation)
  window.addEventListener("hashchange", handleHashChange);

  // Keyboard shortcuts
  document.addEventListener("keydown", handleKeyboard);

  // Listen for progress updates to refresh sidebar counts
  document.addEventListener("progress:updated", () => {
    if (_currentSubject) {
      // Refresh sidebar section counters without full re-render
      _manifest.subjects.forEach((subject) => {
        if (subject.id === _currentSubject.id) {
          subject.sections.forEach((sec) => {
            const counter = document.querySelector(
              `[data-section-id="${sec.id}"] .sidebar-section__count`,
            );
            if (counter) {
              const done = sec.topics.filter((t) =>
                ProgressManager.isCompleted(t.id),
              ).length;
              counter.textContent = `${done}/${sec.topics.length}`;
            }
          });
        }
      });
    }
  });

  // Initial route
  handleHashChange();
}

export const Navigation = {
  init,
  renderDashboard,
  handleHashChange,
  getCurrentSubject: () => _currentSubject,
  getCurrentTopic: () => _currentTopic,
};
