/* ================================================================
   TOPIC CARD — Single video topic card renderer
================================================================ */

/**
 * Render a single topic card as an HTML string.
 * @param {{ id: string, title: string, youtubeUrl: string }} topic
 * @param {string} subjectId
 * @param {boolean} isActive
 * @returns {string}
 */
export function renderTopicCard(topic, subjectId, isActive = false) {
  return `
    <div
      class="topic-card${isActive ? " is-active" : ""}"
      data-topic-id="${topic.id}"
      data-subject-id="${subjectId}"
      role="listitem"
      tabindex="0"
      aria-label="Watch: ${topic.title}"
    >
      <div class="topic-card__thumb" aria-hidden="true">
        <svg class="topic-card__play" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      </div>
      <span class="topic-card__title">${topic.title}</span>
      <span class="topic-card__badge" aria-hidden="true">YouTube</span>
      <svg class="topic-card__arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <path d="M5 12h14M12 5l7 7-7 7"/>
      </svg>
    </div>
  `;
}
