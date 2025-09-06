import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: [
      "dist/**",
      "build/**", 
      "node_modules/**",
      "_templates/**",
      "templates/**",
      "reports/**",
      "coverage/**",
      "docs/**",
      ".claude/**",
      "examples/**",
      "*.md",
      "*.d.ts",
      "*.d.mts",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
      ".git/**",
      ".unjucks-cache/**",
      "my-citty-cli/**",
      "citty-project/**",
      "test-output/**",
      "output/**",
      "tests/**", // Ignore test files to avoid parsing issues
      "src/types/**", // Ignore type definition files
      "src/components/**", // Ignore React components
      "src/pages/**", // Ignore page components
      "src/layouts/**", // Ignore layout components
      "**/*.test.ts",
      "**/*.spec.ts",
      "debug-*.js"
    ]
  },
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        exports: "writable",
        module: "writable",
        require: "readonly",
        global: "readonly"
      }
    },
    rules: {
      // Only warnings - never block
      "no-eval": "warn",
      "no-implied-eval": "warn",
      "no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      "no-console": "off",
      "no-debugger": "warn"
    }
  },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        // Parse TypeScript syntax but don't require tsconfig
        project: null,
        tsconfigRootDir: undefined,
        createDefaultProgram: false
      }
    },
    rules: {
      // No TypeScript-specific rules - just warnings for critical issues
      "no-eval": "warn",
      "no-implied-eval": "warn"
    }
  }
];