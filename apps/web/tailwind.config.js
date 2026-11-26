const basePreset = require("@examora/ui/tailwind-preset");
const colors = require("tailwindcss/colors");

/**
 * apps/web token overrides, layered on top of the shared @examora/ui
 * preset. Values below come directly from the Student Dashboard design spec
 * (docs artifact, 2026-08-01) — Primary #4F46E5, Accent #06B6D4, Success
 * #10B981, Warning #F59E0B, Danger #EF4444, Background #F8FAFC, Text
 * Primary #0F172A, Text Secondary #64748B all happen to be exact matches
 * for Tailwind's own indigo-600 / cyan-500 / emerald-500 / amber-500 /
 * red-500 / slate-50 / slate-900 / slate-500, so those scales are aliased
 * directly rather than hand-rolled, keeping full 50-900 ramps for existing
 * `*-50` … `*-900` usage across the app.
 *
 * apps/admin mirrors this same override set (see
 * apps/admin/tailwind.config.js) — both apps render one design language.
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
        // TMS/TailAdmin architecture: controls and cards share the crisp
        // 6px `rounded-md`. `rounded-card` stays its own key so card
        // surfaces can diverge from controls later without a sweep.
        md: "6px",
        card: "6px",
      },
      // Quiet entrance motion for cards and score bars. Always used through
      // motion-safe: so it is off for people who ask for reduced motion.
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "grow-x": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 480ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "grow-x": "grow-x 800ms cubic-bezier(0.22, 1, 0.36, 1) both",
      },
      boxShadow: {
        // TMS/TailAdmin elevation: cards are flat (border + theme-xs);
        // hover lift uses theme-md.
        soft: "0px 1px 2px 0px rgba(16, 24, 40, 0.05)",
        "soft-hover":
          "0px 4px 8px -2px rgba(16, 24, 40, 0.1), 0px 2px 4px -2px rgba(16, 24, 40, 0.06)",
      },
    },
  },
};
