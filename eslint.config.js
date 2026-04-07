import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  // Ignore built output and generated files
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "packages/web/src/vite-env.d.ts",
    ],
  },

  // Base JS recommended
  js.configs.recommended,

  // TypeScript strict for all TS/TSX files
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Server-specific config (Node.js ESM)
  {
    files: ["packages/server/src/**/*.ts"],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        project: "./packages/server/tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
    },
  },

  // Web-specific config (browser + React)
  {
    files: ["packages/web/src/**/*.{ts,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        project: "./packages/web/tsconfig.app.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
    },
  },

  // Vite config files (Node.js context, relaxed)
  {
    files: ["packages/web/vite.config.ts"],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        project: "./packages/web/tsconfig.node.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
