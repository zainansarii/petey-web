import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "dist-third-space", "dist-third-space-admin", "dist-david-lloyd", "dist-david-lloyd-admin", ".third-space-source", ".david-lloyd-source", "coverage", "demo-media", "functions/lib", "functions/node_modules", "functions-third-space/lib", "functions-third-space/node_modules", "functions-david-lloyd/lib", "functions-david-lloyd/node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    files: ["src/**/*.test.{ts,tsx}", "src/test/**/*.ts"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ["functions/src/**/*.ts", "functions/vitest.config.ts", "functions-third-space/**/*.ts", "functions-david-lloyd/**/*.ts", "scripts/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
);
