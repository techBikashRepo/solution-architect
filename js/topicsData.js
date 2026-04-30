/* ================================================================
   TOPICS DATA — YouTube video topics per subject
================================================================ */

export const TOPICS = {
  "system-design": [
    {
      id: "sd-1",
      title: "Rate Limiting Algorithms",
      youtubeUrl: "https://www.youtube.com/watch?v=mQCJJqUfn9Y",
    },
    {
      id: "sd-2",
      title: "Consistent Hashing Explained",
      youtubeUrl: "https://www.youtube.com/watch?v=UF9Iqmg94tk",
    },
    {
      id: "sd-3",
      title: "CAP Theorem Deep Dive",
      youtubeUrl: "https://www.youtube.com/watch?v=k-Yaq8AHlFA",
    },
    {
      id: "sd-4",
      title: "System Design: URL Shortener",
      youtubeUrl: "https://www.youtube.com/watch?v=fMZMm_0ZhK4",
    },
    {
      id: "sd-5",
      title: "Microservices vs Monolith",
      youtubeUrl: "https://www.youtube.com/watch?v=NdeTGlZ__Do",
    },
    {
      id: "sd-6",
      title: "Load Balancing Strategies",
      youtubeUrl: "https://www.youtube.com/watch?v=sCR3SAVdyCc",
    },
    {
      id: "sd-7",
      title: "Database Sharding Explained",
      youtubeUrl: "https://www.youtube.com/watch?v=5faMjKuB9bc",
    },
    {
      id: "sd-8",
      title: "Message Queues & Event Driven",
      youtubeUrl: "https://www.youtube.com/watch?v=oUJbuFMyBDk",
    },
  ],
  "aws-cloud": [
    {
      id: "aws-1",
      title: "AWS EC2 Deep Dive",
      youtubeUrl: "https://www.youtube.com/watch?v=oHAQ3TZqv90",
    },
    {
      id: "aws-2",
      title: "AWS Lambda & Serverless",
      youtubeUrl: "https://www.youtube.com/watch?v=eOBq__h4OJ4",
    },
    {
      id: "aws-3",
      title: "S3 & CloudFront Architecture",
      youtubeUrl: "https://www.youtube.com/watch?v=66f_gbiyMn0",
    },
    {
      id: "aws-4",
      title: "VPC & Networking Explained",
      youtubeUrl: "https://www.youtube.com/watch?v=hiKPPy584Mg",
    },
    {
      id: "aws-5",
      title: "RDS vs DynamoDB",
      youtubeUrl: "https://www.youtube.com/watch?v=ummDHtlcipE",
    },
    {
      id: "aws-6",
      title: "SQS & SNS Messaging",
      youtubeUrl: "https://www.youtube.com/watch?v=mXk0MNjlO7A",
    },
    {
      id: "aws-7",
      title: "IAM Best Practices",
      youtubeUrl: "https://www.youtube.com/watch?v=3y596T43JFM",
    },
    {
      id: "aws-8",
      title: "AWS Auto Scaling & High Availability",
      youtubeUrl: "https://www.youtube.com/watch?v=nk3b2yGrMCo",
    },
  ],
  dsa: [
    {
      id: "dsa-1",
      title: "Arrays & Two Pointer Technique",
      youtubeUrl: "https://www.youtube.com/watch?v=BoHivFGAbu8",
    },
    {
      id: "dsa-2",
      title: "Binary Search Mastery",
      youtubeUrl: "https://www.youtube.com/watch?v=GU7DpgHINWQ",
    },
    {
      id: "dsa-3",
      title: "Dynamic Programming Patterns",
      youtubeUrl: "https://www.youtube.com/watch?v=mBNrRy2_hVs",
    },
    {
      id: "dsa-4",
      title: "Graph Algorithms (BFS / DFS)",
      youtubeUrl: "https://www.youtube.com/watch?v=tWVWeAqZ0WU",
    },
    {
      id: "dsa-5",
      title: "Trees & Binary Search Trees",
      youtubeUrl: "https://www.youtube.com/watch?v=RBSGKlAvoiM",
    },
    {
      id: "dsa-6",
      title: "Sliding Window Technique",
      youtubeUrl: "https://www.youtube.com/watch?v=GcW4mgmgSbw",
    },
    {
      id: "dsa-7",
      title: "Heap & Priority Queue",
      youtubeUrl: "https://www.youtube.com/watch?v=HqPJF2L5h9U",
    },
    {
      id: "dsa-8",
      title: "Recursion & Backtracking",
      youtubeUrl: "https://www.youtube.com/watch?v=DKCbsiDBN6c",
    },
  ],
};

/**
 * Convert a YouTube watch URL to an embed URL.
 * Handles both ?v= and youtu.be/ formats.
 */
export function getEmbedUrl(youtubeUrl) {
  const vParam = youtubeUrl.match(/[?&]v=([^&]+)/);
  if (vParam) return `https://www.youtube.com/embed/${vParam[1]}`;
  const short = youtubeUrl.match(/youtu\.be\/([^?&]+)/);
  if (short) return `https://www.youtube.com/embed/${short[1]}`;
  return null;
}

/** Return topics array for a subject, or [] if not found. */
export function getTopics(subjectId) {
  return TOPICS[subjectId] || [];
}

/** Find a single topic by subjectId + topicId. */
export function findVideoTopic(subjectId, topicId) {
  return (TOPICS[subjectId] || []).find((t) => t.id === topicId) || null;
}

/* ================================================================
   BYTEBYTEGO CHANNEL — Curated ByteByteGo system design videos
================================================================ */

export const BYTEBYTEGO_TOPICS = {
  "system-design": [
    {
      id: "bbg-sd-1",
      title: "Scaling From Zero To Millions",
      youtubeUrl: "https://youtu.be/gUxmd3a6REA",
    },
    {
      id: "bbg-sd-2",
      title: "Back-of-the-envelope Estimation",
      youtubeUrl: "https://youtu.be/hxVnYuLf8pc",
    },
    {
      id: "bbg-sd-3",
      title: "A Framework For System Design Interviews",
      youtubeUrl: "https://youtu.be/oVdphFbJbb4",
    },
  ],
  "aws-cloud": [],
  dsa: [],
};

/** Return ByteByteGo topics for a subject, or []. */
export function getByteByteGoTopics(subjectId) {
  return BYTEBYTEGO_TOPICS[subjectId] || [];
}

/** Find a single ByteByteGo topic by subjectId + topicId. */
export function findByteByteGoTopic(subjectId, topicId) {
  return (
    (BYTEBYTEGO_TOPICS[subjectId] || []).find((t) => t.id === topicId) || null
  );
}
