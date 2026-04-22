/* ================================================================
   PROGRESS MANAGER — LocalStorage-backed topic completion tracking
================================================================ */

/* ================================================================
   PROGRESS MANAGER — LocalStorage-backed topic completion tracking
================================================================ */

const STORAGE_KEY = "learnpath_progress";

/** Load raw progress object from storage */
function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

/** Persist progress object to storage */
function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("LearnPath: could not save progress", e);
  }
}

/** Check if a topic (by id) is marked complete */
function isCompleted(topicId) {
  return !!load()[topicId];
}

/**
 * Mark a topic complete or incomplete.
 * @param {string}  topicId
 * @param {boolean} completed - defaults to true
 */
function markComplete(topicId, completed = true) {
  const data = load();
  if (completed) {
    data[topicId] = Date.now(); // store timestamp
  } else {
    delete data[topicId];
  }
  save(data);
  document.dispatchEvent(
    new CustomEvent("progress:updated", {
      detail: { topicId, completed },
    }),
  );
}

/** Toggle completion for a topic */
function toggle(topicId) {
  markComplete(topicId, !isCompleted(topicId));
  return !isCompleted(topicId); // return NEW state after toggle
}

/**
 * Get progress stats for a single subject.
 * @param {object} subject - from manifest
 * @returns {{ completed: number, total: number, percentage: number }}
 */
function getSubjectProgress(subject) {
  const data = load();
  const allTopics = subject.sections.flatMap((s) => s.topics);
  const completedCount = allTopics.filter((t) => !!data[t.id]).length;
  const total = allTopics.length;
  return {
    completed: completedCount,
    total,
    percentage: total > 0 ? Math.round((completedCount / total) * 100) : 0,
  };
}

/**
 * Get overall progress across the whole manifest.
 * @param {object} manifest
 * @returns {{ completed: number, total: number, percentage: number }}
 */
function getTotalProgress(manifest) {
  const data = load();
  const allTopics = manifest.subjects.flatMap((s) =>
    s.sections.flatMap((sec) => sec.topics),
  );
  const completedCount = allTopics.filter((t) => !!data[t.id]).length;
  const total = allTopics.length;
  return {
    completed: completedCount,
    total,
    percentage: total > 0 ? Math.round((completedCount / total) * 100) : 0,
  };
}

/**
 * Find the last-accessed (most recently completed) topic.
 * Returns { subject, section, topic } or null.
 */
function getLastAccessed(manifest) {
  const data = load();
  let latest = null;
  let latestTs = 0;

  manifest.subjects.forEach((subject) => {
    subject.sections.forEach((section) => {
      section.topics.forEach((topic) => {
        const ts = data[topic.id];
        if (ts && ts > latestTs) {
          latestTs = ts;
          latest = { subject, section, topic };
        }
      });
    });
  });

  return latest;
}

export const ProgressManager = {
  isCompleted,
  markComplete,
  toggle,
  getSubjectProgress,
  getTotalProgress,
  getLastAccessed,
};
