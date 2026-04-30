/* ================================================================
   VIDEO PLAYER — Renders the YouTube embed player view
================================================================ */
import { getEmbedUrl } from "./topicsData.js";

/**
 * Render the video player page HTML.
 * @param {{ id: string, title: string, youtubeUrl: string }} topic
 * @param {string} subjectId
 * @param {{ title: string }|null} subject  manifest subject object
 * @param {{ url?: string, label?: string }|null} [back]  override back button
 * @returns {string}
 */
export function renderVideoPlayer(topic, subjectId, subject, back = null) {
  const embedUrl = getEmbedUrl(topic.youtubeUrl);
  const subjectTitle = subject ? subject.title : "Subject";
  const backUrl = back?.url ?? `#/subject/${subjectId}`;
  const backLabel = back?.label ?? subjectTitle;

  if (!embedUrl) {
    return `
      <div class="server-notice">
        <div class="server-notice__icon">⚠️</div>
        <h2 class="server-notice__title">Invalid video URL</h2>
        <p class="server-notice__body">Could not extract a valid YouTube video ID from the provided URL.</p>
      </div>
    `;
  }

  return `
    <div class="video-player">
      <a href="${backUrl}" class="btn-back video-player__back" aria-label="Back to ${backLabel}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        ${backLabel}
      </a>

      <h1 class="video-player__title">${topic.title}</h1>

      <div class="video-player__frame-wrap">
        <iframe
          class="video-player__frame"
          src="${embedUrl}"
          title="${topic.title}"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
        ></iframe>
      </div>

      <div class="video-player__meta">
        <span class="topic-card__badge">YouTube</span>
        <a
          class="video-player__external"
          href="${topic.youtubeUrl}"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open ${topic.title} on YouTube"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Open on YouTube
        </a>
      </div>
    </div>
  `;
}
