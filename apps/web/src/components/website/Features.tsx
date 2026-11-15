import {
  BarChart3,
  BookOpen,
  ClipboardList,
  ListChecks,
  MessageSquare,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "./SectionHeading";

// Every entry maps to a module that exists in the product today.
const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: BookOpen,
    title: "Structured courses",
    body: "Lessons organised into modules, with your progress saved as you go so you can pick up exactly where you left off.",
  },
  {
    icon: ListChecks,
    title: "Quizzes & mock tests",
    body: "Timed attempts with autosave, instant scoring, and a question-by-question review of what you got right and wrong.",
  },
  {
    icon: ClipboardList,
    title: "Assignments with feedback",
    body: "Submit your work and get rubric-based reviews, so you know exactly how to improve your answers.",
  },
  {
    icon: UserCheck,
    title: "Personal mentoring",
    body: "A mentor who follows your progress, keeps notes, sets tasks and schedules meetings with you.",
  },
  {
    icon: MessageSquare,
    title: "Community discussions",
    body: "Ask questions on discussion boards, reply and react to others, and bookmark the threads that helped.",
  },
  {
    icon: BarChart3,
    title: "Analytics & recommendations",
    body: "See your strengths and weak spots at a glance, and follow a recommended learning path for what to study next.",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 bg-neutral-50 py-16 lg:py-24">
      <div className="mx-auto max-w-screen-xl px-4 md:px-6">
        <SectionHeading
          eyebrow="Features"
          title="Everything you need to prepare, in one place"
          description="No more juggling notes, test papers and chat groups — Examora keeps your whole preparation together."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-theme-xs transition-shadow hover:shadow-theme-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-neutral-800">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-500">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
