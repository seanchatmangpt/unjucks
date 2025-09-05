module.exports = {
  default: {
    paths: ["features/**/*.feature"],
    import: [
      "tests/support/**/*.ts",
      "tests/step-definitions/**/*.ts"
    ],
    requireModule: ["tsx/esm"],
    worldParameters: {
      baseUrl: process.env.BASE_URL || "http://localhost:3000",
      timeout: 30_000,
      testDataPath: "./tests/fixtures",
    },
    format: [
      "json:reports/cucumber-report.json",
      "html:reports/cucumber-report.html",
      "progress-bar",
    ],
    formatOptions: {
      snippetInterface: "async-await"
    },
    parallel: 0,
    timeout: 30_000,
    retry: 1,
    tags: "@smoke or @regression",
  },
  smoke: {
    paths: ["features/**/*.feature"],
    import: [
      "tests/support/**/*.ts",
      "tests/step-definitions/**/*.ts"
    ],
    requireModule: ["tsx/esm"],
    format: ["progress-bar"],
    formatOptions: {
      snippetInterface: "async-await"
    },
    tags: "@smoke",
    parallel: 0,
  },
  regression: {
    paths: ["features/**/*.feature"],
    import: [
      "tests/support/**/*.ts", 
      "tests/step-definitions/**/*.ts"
    ],
    requireModule: ["tsx/esm"],
    format: ["json:reports/regression-report.json", "progress-bar"],
    formatOptions: {
      snippetInterface: "async-await"
    },
    tags: "@regression",
    parallel: 0,
  },
  integration: {
    paths: ["features/**/*.feature"],
    import: [
      "tests/support/**/*.ts",
      "tests/step-definitions/**/*.ts"
    ],
    requireModule: ["tsx/esm"],
    format: ["progress-bar"],
    formatOptions: {
      snippetInterface: "async-await"
    },
    tags: "@integration",
    parallel: 0,
  },
  comprehensive: {
    paths: ["features/**/*.feature"],
    import: [
      "tests/support/**/*.ts",
      "tests/step-definitions/**/*.ts"
    ],
    requireModule: ["tsx/esm"],
    format: [
      "json:reports/comprehensive-report.json",
      "html:reports/comprehensive-report.html",
      "progress-bar"
    ],
    formatOptions: {
      snippetInterface: "async-await"
    },
    tags: "@comprehensive",
    parallel: 0,
    timeout: 60_000,
  },
};