module.exports = {
  default: {
    paths: ["features/smoke/basic-cli.feature"],
    import: [
      "tests/step-definitions/basic-cli.steps.ts"
    ],
    requireModule: ["tsx/esm"],
    format: ["progress-bar"],
    formatOptions: {
      snippetInterface: "async-await"
    },
    parallel: 0,
    timeout: 30_000,
    tags: "@smoke",
  },
};