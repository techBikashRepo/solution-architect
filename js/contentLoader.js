/* ================================================================
   CONTENT LOADER — Fetch Markdown, Render, TOC, Code Highlighting
================================================================ */
import { UI } from "./ui.js";
import { ProgressManager } from "./progress.js";
import { renderTopicList, mountTopicListHandlers } from "./topicList.js";
import { renderVideoPlayer } from "./videoPlayer.js";
import { getTopics, getEmbedUrl } from "./topicsData.js";
import { getPdfs, getPdfUrl } from "./pdfData.js";

// TOC IntersectionObserver handle (module-level, no self-reference needed)
let _tocObserver = null;

/* ── Marked.js configuration (compatible with marked@9+) ── */
function configureMarked() {
  if (typeof marked === "undefined") return;

  // In marked@9+, renderer functions receive a token object.
  // { heading }  token: { depth, text, tokens }
  // { link    }  token: { href, title, text, tokens }
  marked.use({
    gfm: true,
    breaks: false,
    pedantic: false,
    renderer: {
      // Inject slug-id + anchor link into every heading
      heading(token) {
        const level = token.depth;
        // token.text is the raw string; build the slug from it
        const rawText = token.text || "";
        const id = rawText
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .trim();

        // Inline-parse the heading tokens to preserve bold/code etc.
        const parsedText =
          this.parser && this.parser.parseInline
            ? this.parser.parseInline(token.tokens || [])
            : rawText;

        const anchor =
          level <= 3
            ? `<a class="heading-anchor" href="#${id}" aria-label="Link to ${rawText}">#</a>`
            : "";

        return `<h${level} id="${id}">${parsedText}${anchor}</h${level}>\n`;
      },

      // Open external links in a new tab safely
      link(token) {
        const href = token.href || "";
        const title = token.title || "";
        const isExternal =
          href.startsWith("http://") || href.startsWith("https://");

        const parsedText =
          this.parser && this.parser.parseInline
            ? this.parser.parseInline(token.tokens || [])
            : token.text || href;

        const relAttr = isExternal
          ? ' target="_blank" rel="noopener noreferrer"'
          : "";
        const titleAttr = title ? ` title="${title}"` : "";

        return `<a href="${href}"${titleAttr}${relAttr}>${parsedText}</a>`;
      },
    },
  });
}

/* ── Optional diagram-button injector ───────────────────── */
let _diagramInjector = null;

function setDiagramInjector(fn) {
  _diagramInjector = typeof fn === "function" ? fn : null;
}

/* ── Fetch a markdown file ───────────────────────────────── */
async function fetchMarkdown(filePath) {
  const response = await fetch(filePath);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${filePath}`);
  }
  return response.text();
}

/* ── Parse and render markdown → HTML ───────────────────── */
function renderMarkdown(rawMd) {
  if (typeof marked === "undefined") {
    // Fallback: wrap in pre if marked unavailable
    return `<pre>${rawMd.replace(/</g, "&lt;")}</pre>`;
  }
  return marked.parse(rawMd);
}

/* ── Add copy buttons to code blocks ────────────────────── */
function addCopyButtons(container) {
  container.querySelectorAll("pre").forEach((pre) => {
    if (pre.querySelector(".copy-btn")) return; // already added
    const btn = document.createElement("button");
    btn.className = "copy-btn";
    btn.setAttribute("aria-label", "Copy code to clipboard");
    btn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        Copy
      `;

    btn.addEventListener("click", () => {
      const code = pre.querySelector("code");
      if (!code) return;
      navigator.clipboard
        .writeText(code.textContent || "")
        .then(() => {
          btn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Copied!`;
          btn.classList.add("copied");
          setTimeout(() => {
            btn.innerHTML = `
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copy`;
            btn.classList.remove("copied");
          }, 2200);
        })
        .catch(() => {
          if (window.UI) UI.toast("Could not copy to clipboard", "warning");
        });
    });

    pre.appendChild(btn);
  });
}

/* ── Syntax highlight via highlight.js ──────────────────── */
function highlightCode(container) {
  if (typeof hljs === "undefined") return;
  container.querySelectorAll("pre code").forEach((block) => {
    if (block.classList.contains("language-mermaid")) return; // rendered by mermaid.js
    hljs.highlightElement(block);
  });
}

/* ── Render mermaid diagram blocks ───────────────────────── */
async function renderMermaid(container) {
  if (typeof mermaid === "undefined") return;
  const blocks = container.querySelectorAll("pre code.language-mermaid");
  if (!blocks.length) return;
  blocks.forEach((codeEl) => {
    const pre = codeEl.parentElement;
    const graphDef = codeEl.textContent;
    const wrapper = document.createElement("div");
    wrapper.className = "mermaid-diagram-wrapper";
    const div = document.createElement("div");
    div.className = "mermaid";
    div.textContent = graphDef;
    wrapper.appendChild(div);
    pre.replaceWith(wrapper);
  });
  try {
    await mermaid.run({ nodes: container.querySelectorAll(".mermaid") });
  } catch (e) {
    console.warn("Mermaid render error", e);
  }
}

/* ── Generate Table of Contents ─────────────────────────── */
function generateTOC(container) {
  const headings = container.querySelectorAll("h2, h3");
  const tocNav = document.getElementById("toc-nav");
  const tocAside = document.getElementById("toc-aside");

  if (!tocNav) return;

  if (headings.length === 0) {
    if (tocAside) tocAside.style.visibility = "hidden";
    return;
  }

  if (tocAside) tocAside.style.visibility = "visible";

  const list = document.createElement("nav");
  list.className = "toc-nav-list";
  list.setAttribute("aria-label", "Page sections");

  headings.forEach((h) => {
    if (!h.id) {
      h.id = h.textContent
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .trim();
    }

    const a = document.createElement("a");
    a.href = `#${h.id}`;
    a.className = `toc-nav-item${h.tagName === "H3" ? " toc-nav-item--h3" : ""}`;
    a.textContent = h.textContent.replace(/#$/, "").trim();
    a.addEventListener("click", (e) => {
      e.preventDefault();
      UI.scrollToElement(`#${h.id}`, 8);
    });

    list.appendChild(a);
  });

  tocNav.innerHTML = "";
  tocNav.appendChild(list);

  // Activate TOC item on scroll (IntersectionObserver)
  initTOCHighlight(headings, list);
}

/* ── IntersectionObserver for TOC highlight ─────────────── */
function initTOCHighlight(headings, tocList) {
  const options = {
    root: null,
    rootMargin: "-64px 0px -60% 0px",
    threshold: 0,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const link = tocList.querySelector(`a[href="#${entry.target.id}"]`);
      if (link) link.classList.toggle("is-active", entry.isIntersecting);
    });
  }, options);

  headings.forEach((h) => observer.observe(h));
  _tocObserver = observer;
}

/* ── Disconnect any active TOC observer ─────────────────── */
function cleanupTOC() {
  if (_tocObserver) {
    _tocObserver.disconnect();
    _tocObserver = null;
  }
}

/* ── Build file path for a topic ─────────────────────────── */
function buildFilePath(subject, section, topic) {
  return `content/${subject.path}/${section.path}/${topic.file}`;
}

/* ── Render subject overview (no markdown needed) ────────── */
function renderSubjectOverview(subject) {
  const progress = ProgressManager.getSubjectProgress(subject);
  const allTopics = subject.sections.flatMap((s) => s.topics);

  const sectionsHTML = subject.sections
    .map((section) => {
      const sectionTopics = section.topics
        .map((topic) => {
          const done = ProgressManager.isCompleted(topic.id);
          return `
          <div
            class="overview-topic-item${done ? " is-done" : ""}"
            role="listitem"
            data-topic-hash="#/topic/${subject.id}/${section.id}/${topic.id}"
            tabindex="0"
            aria-label="${topic.title}${done ? " (completed)" : ""}"
          >
            <span class="overview-topic-item__dot" aria-hidden="true"></span>
            ${topic.title}
            <span style="margin-left:auto;font-size:var(--text-xs);color:var(--text-muted)">${topic.readTime}m</span>
          </div>
        `;
        })
        .join("");

      return `
        <div class="overview-section-card" data-section-id="${section.id}">
          <div class="overview-section-card__header">
            <span class="overview-section-card__icon" aria-hidden="true">${section.icon}</span>
            <span class="overview-section-card__title">${section.title}</span>
            <span class="overview-section-card__count">${section.topics.length}</span>
          </div>
          <div class="overview-section-card__topics" role="list">
            ${sectionTopics}
          </div>
        </div>
      `;
    })
    .join("");

  return `
      <div
        class="subject-overview__header"
        style="background:${subject.gradient}"
        role="banner"
        aria-label="${subject.title} subject"
      >
        <span class="subject-overview__icon" aria-hidden="true">${subject.icon}</span>
        <div class="subject-overview__text">
          <h1 class="subject-overview__title">${subject.title}</h1>
          <p class="subject-overview__desc">${subject.description}</p>
        </div>
      </div>

      <div class="overview-stats" role="group" aria-label="${subject.title} statistics">
        <div class="overview-stat">
          <span class="overview-stat__value">${allTopics.length}</span>
          <span class="overview-stat__label">Topics</span>
        </div>
        <div class="overview-stat">
          <span class="overview-stat__value">${subject.sections.length}</span>
          <span class="overview-stat__label">Sections</span>
        </div>
        <div class="overview-stat">
          <span class="overview-stat__value">${progress.completed}</span>
          <span class="overview-stat__label">Completed</span>
        </div>
        <div class="overview-stat">
          <span class="overview-stat__value">${progress.percentage}%</span>
          <span class="overview-stat__label">Progress</span>
        </div>
      </div>

      <h2 style="font-size:var(--text-lg);font-weight:var(--weight-bold);color:var(--text-primary);margin-bottom:var(--sp-4)">
        Sections
      </h2>
      <div class="overview-sections" role="list">
        ${sectionsHTML}
      </div>
    `;
}

/* ── Load & render a markdown topic ─────────────────────── */
async function loadTopic(subject, section, topic) {
  const articleEl = document.getElementById("content-article");
  if (!articleEl) return;

  cleanupTOC();
  UI.resetReadingProgress();
  UI.scrollToTop(false);

  // Show loading state in article
  articleEl.innerHTML = `
      <div style="display:flex;gap:12px;padding:48px 0;justify-content:center" aria-live="polite">
        <div class="spinner">
          <div class="spinner__dot"></div>
          <div class="spinner__dot"></div>
          <div class="spinner__dot"></div>
        </div>
      </div>`;

  const filePath = buildFilePath(subject, section, topic);

  try {
    const rawMd = await fetchMarkdown(filePath);
    const html = renderMarkdown(rawMd);

    // Wrap in md-content class for styling
    articleEl.innerHTML = `<div class="md-content">${html}</div>`;

    const mdContainer = articleEl.querySelector(".md-content");
    highlightCode(mdContainer);
    await renderMermaid(mdContainer);
    addCopyButtons(mdContainer);
    generateTOC(mdContainer);

    // Inject diagram button if a handler is registered
    if (_diagramInjector) {
      _diagramInjector(articleEl, subject, section, topic);
    }

    // Announce for screen readers
    articleEl.setAttribute("tabindex", "-1");
    articleEl.focus();
  } catch (err) {
    console.error("ContentLoader: fetch failed", err);
    articleEl.innerHTML = renderFetchError(filePath);
  }
}

/* ── Error state when fetch fails ───────────────────────── */
function renderFetchError(filePath) {
  return `
      <div class="server-notice">
        <div class="server-notice__icon">🚧</div>
        <h2 class="server-notice__title">Content unavailable</h2>
        <p class="server-notice__body">
          This app needs a local web server to load markdown files.
          Open a terminal in the project folder and run:
        </p>
        <code class="server-notice__code">python -m http.server 8080</code>
        <p class="server-notice__body" style="margin-top:16px">
          Then open <strong>http://localhost:8080</strong> in your browser.
        </p>
        <p style="font-size:var(--text-xs);color:var(--text-muted);margin-top:12px">
          Failed: <code>${filePath}</code>
        </p>
      </div>
    `;
}

/* ── Render subject overview into article ────────────────── */
function loadSubjectOverview(subject) {
  const articleEl = document.getElementById("content-article");
  const tocNav = document.getElementById("toc-nav");
  const tocAside = document.getElementById("toc-aside");

  cleanupTOC();
  UI.resetReadingProgress();
  UI.scrollToTop(false);

  if (articleEl) {
    articleEl.innerHTML = renderSubjectOverview(subject);

    // Click on topic in overview → navigate
    articleEl.querySelectorAll("[data-topic-hash]").forEach((el) => {
      el.addEventListener("click", () => {
        window.location.hash = el.dataset.topicHash;
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          window.location.hash = el.dataset.topicHash;
        }
      });
    });
  }

  if (tocNav) tocNav.innerHTML = "";
  if (tocAside) tocAside.style.visibility = "hidden";

  // Inject Video Topics section
  if (articleEl) {
    const topicsHTML = renderTopicList(subject.id);
    if (topicsHTML) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = topicsHTML;
      articleEl.appendChild(wrapper.firstElementChild);
      mountTopicListHandlers(articleEl);
    }
  }
}

/* ── Load video player into article ─────────────────────── */
function loadVideoPlayer(topic, subjectId, subject) {
  const articleEl = document.getElementById("content-article");
  const tocNav = document.getElementById("toc-nav");
  const tocAside = document.getElementById("toc-aside");

  cleanupTOC();
  UI.resetReadingProgress();
  UI.scrollToTop(false);

  if (articleEl) {
    articleEl.innerHTML = renderVideoPlayer(topic, subjectId, subject);
  }

  if (tocNav) tocNav.innerHTML = "";
  if (tocAside) tocAside.style.visibility = "hidden";
}

/* ── Load all-videos gallery page ─────────────────────── */
function loadVideosPage(subject) {
  const articleEl = document.getElementById("content-article");
  const tocNav = document.getElementById("toc-nav");
  const tocAside = document.getElementById("toc-aside");

  cleanupTOC();
  UI.resetReadingProgress();
  UI.scrollToTop(false);

  const topics = getTopics(subject.id);

  const cardsHTML = topics
    .map(
      (t) => `
      <div
        class="video-gallery-card"
        data-subject-id="${subject.id}"
        data-topic-id="${t.id}"
        role="listitem"
        tabindex="0"
        aria-label="Watch: ${t.title}"
      >
        <div class="video-gallery-card__thumb" aria-hidden="true">
          <svg class="video-gallery-card__play" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </div>
        <div class="video-gallery-card__body">
          <span class="topic-card__badge">YouTube</span>
          <h3 class="video-gallery-card__title">${t.title}</h3>
        </div>
        <svg class="video-gallery-card__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </div>
    `,
    )
    .join("");

  const html = `
    <div class="videos-page">
      <div class="videos-page__header" style="background:${subject.gradient}">
        <span class="videos-page__icon" aria-hidden="true">${subject.icon}</span>
        <div class="videos-page__header-text">
          <h1 class="videos-page__title">${subject.title}</h1>
          <p class="videos-page__subtitle">Video Topics</p>
        </div>
      </div>
      <p class="videos-page__meta">${topics.length} videos &mdash; click any card to watch</p>
      <div class="videos-page__grid" role="list">
        ${cardsHTML}
      </div>
    </div>
  `;

  if (articleEl) {
    articleEl.innerHTML = html;
    articleEl.querySelectorAll(".video-gallery-card").forEach((card) => {
      const activate = () => {
        window.location.hash = `#/video/${card.dataset.subjectId}/${card.dataset.topicId}`;
      };
      card.addEventListener("click", activate);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
    });
  }

  if (tocNav) tocNav.innerHTML = "";
  if (tocAside) tocAside.style.visibility = "hidden";
}

/* ── Load PDF gallery page ─────────────────────────── */
function loadPdfsPage(subject) {
  const articleEl = document.getElementById("content-article");
  const tocNav = document.getElementById("toc-nav");
  const tocAside = document.getElementById("toc-aside");

  cleanupTOC();
  UI.resetReadingProgress();
  UI.scrollToTop(false);

  const pdfs = getPdfs(subject.id);

  const cardsHTML = pdfs.length
    ? pdfs
        .map(
          (p) => `
      <div
        class="pdf-gallery-card"
        data-subject-id="${subject.id}"
        data-pdf-id="${p.id}"
        role="listitem"
        tabindex="0"
        aria-label="Read: ${p.title}"
      >
        <div class="pdf-gallery-card__thumb" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </div>
        <div class="pdf-gallery-card__body">
          <span class="pdf-badge">PDF</span>
          <h3 class="pdf-gallery-card__title">${p.title}</h3>
        </div>
        <svg class="pdf-gallery-card__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </div>
    `,
        )
        .join("")
    : `<p class="pdfs-page__empty">No PDFs available yet for this subject.</p>`;

  const html = `
    <div class="pdfs-page">
      <div class="pdfs-page__header" style="background:${subject.gradient}">
        <span class="pdfs-page__icon" aria-hidden="true">${subject.icon}</span>
        <div class="pdfs-page__header-text">
          <h1 class="pdfs-page__title">${subject.title}</h1>
          <p class="pdfs-page__subtitle">Reference PDFs</p>
        </div>
      </div>
      <p class="pdfs-page__meta">${pdfs.length} document${pdfs.length !== 1 ? "s" : ""} &mdash; click to read inline</p>
      <div class="pdfs-page__grid" role="list">
        ${cardsHTML}
      </div>
    </div>
  `;

  if (articleEl) {
    articleEl.innerHTML = html;
    articleEl.querySelectorAll(".pdf-gallery-card").forEach((card) => {
      const activate = () => {
        window.location.hash = `#/pdf/${card.dataset.subjectId}/${card.dataset.pdfId}`;
      };
      card.addEventListener("click", activate);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
    });
  }

  if (tocNav) tocNav.innerHTML = "";
  if (tocAside) tocAside.style.visibility = "hidden";
}

/* ── Load PDF reader (inline iframe) ───────────────────── */
function loadPdfReader(pdf, subject) {
  const articleEl = document.getElementById("content-article");
  const tocNav = document.getElementById("toc-nav");
  const tocAside = document.getElementById("toc-aside");

  cleanupTOC();
  UI.resetReadingProgress();
  UI.scrollToTop(false);

  const pdfUrl = getPdfUrl(pdf);
  const backUrl = `#/pdfs/${subject.id}`;

  const html = `
    <div class="pdf-reader">
      <div class="pdf-reader__toolbar">
        <a href="${backUrl}" class="btn-back pdf-reader__back" aria-label="Back to ${subject.title} PDFs">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to PDFs
        </a>
        <h1 class="pdf-reader__title">${pdf.title}</h1>
        <a
          class="pdf-reader__download"
          href="${pdfUrl}"
          download="${pdf.file}"
          aria-label="Download ${pdf.title}"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download
        </a>
      </div>
      <div class="pdf-reader__frame-wrap">
        <iframe
          class="pdf-reader__frame"
          src="${pdfUrl}"
          title="${pdf.title}"
        ></iframe>
      </div>
    </div>
  `;

  if (articleEl) {
    articleEl.innerHTML = html;
  }

  if (tocNav) tocNav.innerHTML = "";
  if (tocAside) tocAside.style.visibility = "hidden";
}

/* ── Init (configure marked.js + mermaid) ───────────────── */
function init() {
  configureMarked();
  if (typeof mermaid !== "undefined") {
    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      themeVariables: {
        primaryColor: "#E3F2FD",
        primaryTextColor: "#000",
        primaryBorderColor: "#1E88E5",
        lineColor: "#555",
        background: "#ffffff",
        nodeBorder: "#999",
        clusterBkg: "#f5f5f5",
        edgeLabelBackground: "#ffffff",
      },
      securityLevel: "loose",
      fontFamily: "Inter, system-ui, sans-serif",
    });
  }
}

export const ContentLoader = {
  init,
  loadTopic,
  loadSubjectOverview,
  loadVideoPlayer,
  loadVideosPage,
  loadPdfsPage,
  loadPdfReader,
  renderMarkdown,
  buildFilePath,
  setDiagramInjector,
};
