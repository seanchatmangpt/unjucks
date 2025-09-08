import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    typecheck: { enabled: false },
    environment: "node",
    globals: true,
    
    // Include cross-platform compatibility tests
    include: [
      "tests/cross-platform-compatibility.test.js",
      "tests/node-version-compatibility.test.js", 
      "tests/package-manager-compatibility.test.js",
      "tests/container-deployment.test.js"
    ],
    
    exclude: [
      "node_modules/**",
      "dist/**"
    ],
    
    testTimeout: 30_000,
    hookTimeout: 10_000,
    
    // Detailed reporting for compatibility tests
    reporters: ['verbose'],
    
    // Use forks instead of threads to support process.chdir
    pool: "forks",
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: 1,
      },
    },
    
    isolate: true,
    passWithNoTests: false,
  },
});