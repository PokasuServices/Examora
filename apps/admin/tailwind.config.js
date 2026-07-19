const basePreset = require("@examora/ui/tailwind-preset");

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [basePreset],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
};
