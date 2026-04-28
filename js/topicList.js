/* ================================================================
   TOPIC LIST — Renders the Video Topics section for a subject
================================================================ */
import { getTopics } from "./topicsData.js";
import { renderTopicCard } from "./topicCard.js";

const LS_KEY_PREFIX = "lastVideo:";

/**
 * Render the full "Video Topics" section HTML.
 * @param {string} subjectId
 * @param {string|null} activeTopicId
 * @returns {string}
 */
export function renderTopicList(subjectId, activeTopicId = null) {
  const topics = getTopics(subjectId);
  if (!topics.length) return "";

  // Restore last watched from localStorage if no active topic given
  if (!activeTopicId) {
    try {
      activeTopicId = localStorage.getItem(LS_KEY_PREFIX + subjectId) || null;
    } catch (_) {}
  }

  const cardsHTML = topics
    .map((t) => renderTopicCard(t, subjectId, t.id === activeTopicId))
    .join("");

  return `
    <section
      class="topics-section"
      aria-label="Video Topics"
      data-subject-id="${subjectId}"
    >
      <div class="topics-section__header">
        <span class="topics-section__icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>
          </svg>
        </span>
        <h2 class="topics-section__title">Video Topics</h2>
        <span class="topics-section__count">${topics.length}</span>
      </div>
      <p class="topics-section__desc">Curated YouTube videos to reinforce your learning.</p>
      <div class="topics-section__list" role="list">
        ${cardsHTML}
      </div>
    </section>
  `;
}

/**
 * Attach click / keyboard handlers to topic cards inside articleEl.
 * Navigates to #/video/:subjectId/:topicId and saves to localStorage.
 * @param {HTMLElement} articleEl
 */
export function mountTopicListHandlers(articleEl) {
  const section = articleEl.querySelector(".topics-section");
  if (!section) return;

  const subjectId = section.dataset.subjectId;

  section.querySelectorAll(".topic-card").forEach((card) => {
    const activate = () => {
      const topicId = card.dataset.topicId;

      // Highlight selected card immediately
      section
        .querySelectorAll(".topic-card")
        .forEach((c) => c.classList.remove("is-active"));
      card.classList.add("is-active");

      // Save last watched
      try {
        localStorage.setItem(LS_KEY_PREFIX + subjectId, topicId);
      } catch (_) {}

      // Navigate to video route
      window.location.hash = `#/video/${subjectId}/${topicId}`;
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
