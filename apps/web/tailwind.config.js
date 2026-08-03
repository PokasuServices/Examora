const basePreset = require("@examora/ui/tailwind-preset");
const colors = require("tailwindcss/colors");

/**
 * apps/web-only token overrides, layered on top of the shared @examora/ui
 * preset (which apps/admin still consumes unmodified). Values below come
 * directly from the Student Dashboard design spec (docs artifact,
 * 2026-08-01) — Primary #4F46E5, Accent #06B6D4, Success #10B981,
 * Warning #F59E0B, Danger #EF4444, Background #F8FAFC, Text Primary
 * #0F172A, Text Secondary #64748B all happen to be exact matches for
 * Tailwind's own indigo-600 / cyan-500 / emerald-500 / amber-500 / red-500 /
 * slate-50 / slate-900 / slate-500, so those scales are aliased directly
 * rather than hand-rolled, keeping full 50-900 ramps for existing
 * `*-50` … `*-900` usage across the app.
 *
 * Scoped to apps/web deliberately, not the shared preset — apps/admin was
 * not part of this task and keeps its current (Sprint-0 placeholder)
 * palette until it's explicitly redesigned too.
 */
module.exports = {
  presets: [basePreset],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: colors.indigo,
        accent: colors.cyan,
        success: colors.emerald,
        warning: colors.amber,
        error: colors.red,
        danger: colors.red,
        neutral: colors.slate,
      },
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "var(--font-body)", "ui-sans-serif", "sans-serif"],
      },
      borderRadius: {
        // Spec: buttons & inputs 12px — overrides the shared preset's 8px
        // `md`, so @examora/ui's Button/Input pick this up with no source
        // changes (Tailwind resolves each app's own compiled theme).
        md: "12px",
        // Spec: cards 20px. Kept as its own named key (`rounded-card`)
        // rather than overloading `xl`/`2xl`, since 20px isn't a stock step.
        card: "20px",
      },
      boxShadow: {
        // "Very soft only" per spec — two low-opacity layers, paired with a
        // hairline border on cards rather than a harder single shadow.
        soft: "0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.05)",
        "soft-hover": "0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 28px rgba(15, 23, 42, 0.08)",
      },
    },
  },
};
