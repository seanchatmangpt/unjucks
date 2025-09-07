module.exports = {
  default: {
    paths: ["features/**/*.feature"],
    import: [
      "tests/support/**/*.js",
      "tests/step-definitions/**/*.js"
    ],
    require: ["tsx/cjs"],
    worldClass: "./tests/support/world.js:UnjucksWorld",
    worldParameters: {
      baseUrl: process.env.BASE_URL || "http://localhost:3000",
      timeout: 30_000,
      testDataPath: "./tests/fixtures",
    },
    // Comprehensive reporting formats
    format: [
      "json:reports/cucumber/cucumber-report.json",
      "html:reports/cucumber/cucumber-report.html",
      "junit:reports/cucumber/junit-report.xml",
      "@cucumber/pretty-formatter:reports/cucumber/cucumber-pretty.txt",
      "usage:reports/cucumber/usage-report.txt",
      "rerun:reports/cucumber/rerun.txt",
      "progress-bar",
      "summary"
    ],
    formatOptions: {
      snippetInterface: "async-away",
      colorsEnabled: true,
      theme: "bootstrap"
    },
    parallel: 0,
    timeout: 30_000,
    retry: 2, // Increased retry for flaky test detection
    retryTagFilter: "@flaky",
    tags: "@smoke or @regression",
    // Performance and memory monitoring
    publishQuiet: true,
    strict: true,
    dryRun: false,
  },
  smoke: {
    paths: ["features/**/*.feature"],
    import: [
      "tests/support/**/*.js",
      "tests/step-definitions/**/*.js"
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
      "tests/support/**/*.js",
      "tests/step-definitions/**/*.js"
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
      "tests/support/**/*.js",
      "tests/step-definitions/**/*.js"
    ],
    requireModule: ["tsx/esm"],
    // Full comprehensive reporting suite
    format: [
      "json:reports/cucumber/comprehensive-report.json",
      "html:reports/cucumber/comprehensive-report.html",
      "junit:reports/cucumber/comprehensive-junit.xml",
      "@cucumber/pretty-formatter:reports/cucumber/comprehensive-pretty.txt",
      "usage:reports/cucumber/comprehensive-usage.txt",
      "timeline:reports/cucumber/timeline.html",
      "attachments:reports/cucumber/attachments",
      "progress-bar",
      "summary"
    ],
    formatOptions: {
      snippetInterface: "async-await",
      colorsEnabled: true,
      theme: "bootstrap",
      showSource: true,
      showDuration: true
    },
    tags: "@comprehensive",
    parallel: 0,
    timeout: 60_000,
    retry: 3,
    retryTagFilter: "@flaky or @unstable",
    // Advanced reporting features
    publishQuiet: false,
    strict: true,
    backtrace: true,
    dryRun: false,
    failFast: false
  },
};