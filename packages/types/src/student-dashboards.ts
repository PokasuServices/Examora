/** Tab overview summaries for the student module (Practice, Discuss, Colleges, Rewards) and bell alerts. */

/** Tabs that remember when the student last looked (for "new since your last visit"). */
export const DASHBOARD_SEEN_KEYS = ["practice", "discuss", "colleges", "rewards"] as const;
export type DashboardSeenKey = (typeof DASHBOARD_SEEN_KEYS)[number];

/** Practice → Part B (sketching) status; the rest of Practice comes from its overview. */
export interface PracticeDashboardSummary {
  lastSeenAt: string | null;
  sketches: {
    /** My uploads (all versions). */
    uploads: number;
    /** Uploads I haven't rated myself yet. */
    toSelfEvaluate: number;
    /** Uploads with no expert marks yet. */
    waitingForExpert: number;
    /** Expert marks received since my last visit. */
    newExpertReviews: number;
  };
  /** Latest expert reviews of my sketches. */
  recentReviews: {
    workId: string;
    quizId: string | null;
    question: string;
    at: string;
    isNew: boolean;
  }[];
}

export interface DiscussDashboard {
  lastSeenAt: string | null;
  counts: {
    myThreads: number;
    /** Replies from others on my threads since my last visit. */
    newReplies: number;
    /** My threads nobody else has replied to yet. */
    unanswered: number;
    /** Likes on my threads and replies, plus claps on my question doubts. */
    likesReceived: number;
    myDoubts: number;
    /** Replies on my question doubts since my last visit. */
    newDoubtReplies: number;
  };
  latestReplies: {
    threadId: string;
    threadTitle: string;
    authorName: string;
    excerpt: string;
    at: string;
    isNew: boolean;
  }[];
  popularThisWeek: { threadId: string; title: string; replies: number; likes: number }[];
}

export interface CollegesDashboard {
  shortlisted: { id: string; name: string; slug: string; city: string }[];
  /** Webinars I registered for that haven't ended yet. */
  myWebinars: {
    id: string;
    title: string;
    slug: string;
    startsAt: string;
    joinUrl: string | null;
  }[];
  /** Upcoming published webinars I haven't registered for. */
  otherUpcomingWebinars: number;
  enquiries: { id: string; collegeName: string; collegeSlug: string; status: string; at: string }[];
}

export interface RewardsDashboard {
  total: number;
  thisWeek: number;
  thisMonth: number;
  /** Where the XP came from, largest first. */
  byReason: { reason: string; label: string; amount: number; count: number }[];
  recent: { reason: string; label: string; amount: number; at: string }[];
}

/** Result of creating the student's pending bell alerts. */
export interface StudentAlertsSync {
  created: number;
}
