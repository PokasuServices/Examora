/**
 * Shared Tailwind preset — design tokens per DS-18 §2 (Color palette, Typography
 * scale, Spacing, Border radius). Original values only; never sampled from
 * /screens (ADR-0008). Sprint 0 placeholder — refined with real brand design
 * starting Sprint 2 (see docs/TECHNICAL_DEBT_REGISTER.md TD-001).
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        secondary: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
        },
        success: { 500: "#22c55e", 600: "#16a34a" },
        warning: { 500: "#f59e0b", 600: "#d97706" },
        error: { 500: "#ef4444", 600: "#dc2626" },
        neutral: {
          50: "#fafafa",
          100: "#f5f5f5",
          200: "#e5e5e5",
          300: "#d4d4d4",
          400: "#a3a3a3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          900: "#171717",
        },
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      fontSize: {
        caption: ["0.75rem", { lineHeight: "1rem" }],
        body: ["1rem", { lineHeight: "1.5rem" }],
        heading: ["1.5rem", { lineHeight: "2rem", fontWeight: "600" }],
      },
    },
  },
};
