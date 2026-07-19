import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

/**
 * Single shared flat config for the whole monorepo. Every workspace's `lint`
 * script points here via `--config`, so there is exactly one ruleset to
 * maintain (see docs/adr/0001-monorepo-tooling.md).
 */
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/generated/**",
      "**/*.config.{js,cjs,mjs}",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      // Deliberately OFF, not "warn": its --fix converts constructor-injected
      // classes and NestJS param-decorated DTOs to `import type`, which erases
      // them from `design:paramtypes` metadata and silently breaks DI /
      // ValidationPipe at runtime. See TD-011 in TECHNICAL_DEBT_REGISTER.md.
      "@typescript-eslint/consistent-type-imports": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  prettierConfig,
);
