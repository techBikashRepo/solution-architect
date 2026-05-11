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
    {
      id: "sd-doc-2",
      title: "A Framework For System Design Interviews",
      file: "003 A Framework For System Design Interviews.docx",
      dir: "content/01-System-Design/interview-questions",
    },
    {
      id: "sd-doc-3",
      title: "Scalability (Vertical vs Horizontal)",
      file: "100 Scalability (Vertical vs Horizontal).docx",
      dir: "content/01-System-Design/interview-questions",
      youtubeUrl: "https://www.youtube.com/watch?v=lrDpzc4oVeM",
    },
    {
      id: "sd-doc-4",
      title: "Latency vs Throughput",
      file: "101 Latency vs Throughput.docx",
      dir: "content/01-System-Design/interview-questions",
      youtubeUrl: "https://www.youtube.com/watch?v=muBblpFxbzs",
    },
    {
      id: "sd-doc-5",
      title: "CAP Theorem",
      file: "102 CAP Theorem.docx",
      dir: "content/01-System-Design/interview-questions",
      youtubeUrl: "https://www.youtube.com/watch?v=BFMAwBwiOsY",
    },
    {
      id: "sd-doc-6",
      title: "Consistency Models (Strong vs Eventual)",
      file: "103 Consistency Models (Strong vs Eventual).docx",
      dir: "content/01-System-Design/interview-questions",
      youtubeUrl: "https://www.youtube.com/watch?v=CUWQN_8cgck",
    },
    {
      id: "sd-doc-7",
      title: "Load Balancing",
      file: "104 Load Balancing.docx",
      dir: "content/01-System-Design/interview-questions",
      youtubeUrl: "https://www.youtube.com/watch?v=PJyimTiICLQ",
    },
    {
      id: "sd-doc-8",
      title: "Caching (Redis Basics + Invalidation)",
      file: "105 Caching (Redis basics + invalidation basics).docx",
      dir: "content/01-System-Design/interview-questions",
      youtubeUrl: "https://www.youtube.com/watch?v=VNiJJT14OpI",
    },
    {
      id: "sd-doc-9",
      title: "Database Basics (SQL vs NoSQL)",
      file: "106 Database Basics (SQL vs NoSQL).docx",
      dir: "content/01-System-Design/interview-questions",
      youtubeUrl: "https://www.youtube.com/watch?v=lV820VM-0H8",
    },
    {
      id: "sd-doc-10",
      title: "Estimation — Users to Requests/sec",
      file: "107 Estimation - Users → Requestssec.docx",
      dir: "content/01-System-Design/interview-questions",
      youtubeUrl: "https://www.youtube.com/watch?v=SRivcmRuN7U",
    },
    {
      id: "sd-doc-11",
      title: "Estimation — Read vs Write Ratio",
      file: "109 Estimation - Read vs Write ratio.docx",
      dir: "content/01-System-Design/interview-questions",
    },
    {
      id: "sd-doc-12",
      title: "API Gateway",
      file: "110 API Gateway.docx",
      dir: "content/01-System-Design/interview-questions",
    },
    {
      id: "sd-doc-13",
      title: "CDN",
      file: "111 CDN.docx",
      dir: "content/01-System-Design/interview-questions",
    },
    {
      id: "sd-doc-14",
      title: "Load Balancer",
      file: "112 Load Balancer.docx",
      dir: "content/01-System-Design/interview-questions",
    },
    {
      id: "sd-doc-15",
      title: "Message Queue (Kafka + SQS)",
      file: "113 Message Queue (Kafka concept, SQS practical) .docx",
      dir: "content/01-System-Design/interview-questions",
    },
    {
      id: "sd-doc-16",
      title: "Rate Limiting",
      file: "114 Rate Limiting.docx",
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
  return `${doc.dir}/${encodeURIComponent(doc.file)}`;
}
