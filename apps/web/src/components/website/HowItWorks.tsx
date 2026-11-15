import { SectionHeading } from "./SectionHeading";

const STEPS = [
  {
    title: "Create your account",
    body: "Sign up in a minute with your email or Google account.",
  },
  {
    title: "Enrol in a course",
    body: "Browse the catalogue and join a free or paid course for your exam.",
  },
  {
    title: "Learn, practise, improve",
    body: "Work through lessons, take quizzes, submit assignments and track your progress with your mentor.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-white dark:bg-neutral-900 py-16 lg:py-24">
      <div className="mx-auto max-w-screen-xl px-4 md:px-6">
        <SectionHeading eyebrow="How it works" title="Get started in three simple steps" />
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="relative rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-base font-semibold text-white">
                {index + 1}
              </span>
              <h3 className="mt-5 text-lg font-semibold text-neutral-800 dark:text-white/90">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
