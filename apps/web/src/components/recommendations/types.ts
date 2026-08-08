import {
  BookOpen,
  ClipboardList,
  HelpCircle,
  MessageSquare,
  Milestone,
  PlayCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { RecommendationType } from "@examora/types";

/**
 * Display metadata per RECOMMENDATION_TYPES (packages/types/src/recommendations.ts)
 * — the same enum the admin feature-flag system uses. Individual recommendation
 * items don't carry a `type` field themselves (it's implicit in which endpoint
 * returned them), so each section passes its own real type in in the UI.
 */
export const RECOMMENDATION_TYPE_META: Record<
  RecommendationType,
  { label: string; icon: LucideIcon }
> = {
  COURSE: { label: "Course", icon: BookOpen },
  SIMILAR_COURSES: { label: "Similar course", icon: BookOpen },
  LEARNING_PATH: { label: "Learning path", icon: Milestone },
  CONTINUE_LEARNING: { label: "Continue learning", icon: PlayCircle },
  QUIZ: { label: "Quiz", icon: HelpCircle },
  ASSIGNMENT: { label: "Assignment", icon: ClipboardList },
  COMMUNITY_DISCUSSION: { label: "Discussion", icon: MessageSquare },
};

export const AI_ICON = Sparkles;
