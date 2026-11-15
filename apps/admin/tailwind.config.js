const basePreset = require("@examora/ui/tailwind-preset");
const colors = require("tailwindcss/colors");

/**
 * apps/admin token overrides, layered on top of the shared @examora/ui
 * preset — mirrors apps/web/tailwind.config.js exactly (UI unification
 * pass) so both apps render the same design language: Primary #4F46E5,
 * Accent #06B6D4, Success #10B981, Warning #F59E0B, Danger #EF4444 — all
 * exact matches for Tailwind's indigo-600 / cyan-500 / emerald-500 /
 * amber-500 / red-500, so those scales are aliased directly.
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
        md: "6px",
        card: "6px",
      },
      boxShadow: {
        soft: "0px 1px 2px 0px rgba(16, 24, 40, 0.05)",
        "soft-hover":
          "0px 4px 8px -2px rgba(16, 24, 40, 0.1), 0px 2px 4px -2px rgba(16, 24, 40, 0.06)",
      },
    },
  },
};
