import { Check, GraduationCap, Users } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

const AUDIENCES = [
  {
    icon: GraduationCap,
    title: "For students",
    points: [
      "A clear dashboard showing what to continue and what's due next",
      "Practice quizzes and mock tests with instant results",
      "Rubric-based feedback on every assignment",
      "Personal analytics and a recommended learning path",
    ],
  },
  {
    icon: Users,
    title: "For mentors",
    points: [
      "One view of every assigned student's progress and activity",
      "Private notes, tasks and meeting scheduling per student",
      "Spot who's falling behind before it becomes a problem",
      "Mentor analytics across your whole group",
    ],
  },
];

export function Audience() {
  return (
    <section id="mentoring" className="scroll-mt-20 bg-neutral-50 py-16 lg:py-24">
      <div className="mx-auto max-w-screen-xl px-4 md:px-6">
        <SectionHeading
          eyebrow="Mentoring"
          title="Built for students and the mentors who guide them"
          description="Preparation works best with someone in your corner. Examora connects students and mentors in the same workspace."
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {AUDIENCES.map(({ icon: Icon, title, points }) => (
            <div key={title} className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                  <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="text-xl font-semibold text-neutral-800">{title}</h3>
              </div>
              <ul className="mt-6 space-y-3">
                {points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-neutral-600">
                    <Check
                      size={18}
                      strokeWidth={2}
                      className="mt-0.5 shrink-0 text-success-500"
                      aria-hidden="true"
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
