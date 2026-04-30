/* ================================================================
   DOCS DATA — Interview Word documents per subject
================================================================ */

export const DOCS = {
  "system-design": [
    {
      id: "sd-doc-1",
      title: "Scale From Zero To Millions Of Users",
      file: "001 Scale From Zero To Millions Of Users.docx",
      dir: "content/01-System-Design/interview-questions",
    },
  ],
  "aws-cloud": [],
  dsa: [],
};

/** Return docs array for a subject, or []. */
export function getDocs(subjectId) {
  return DOCS[subjectId] || [];
}

/** Find a single doc by subjectId + docId. */
export function findDoc(subjectId, docId) {
  return (DOCS[subjectId] || []).find((d) => d.id === docId) || null;
}

/** Build the fetch URL for a doc. */
export function getDocUrl(doc) {
  return `${doc.dir}/${doc.file}`;
}
