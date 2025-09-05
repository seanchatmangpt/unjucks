import { Before, After, BeforeAll, AfterAll, Status } from "@cucumber/cucumber";
import { UnjucksWorld, CustomWorld } from "./world.ts";

BeforeAll(async function () {
  console.log("🚀 Starting Cucumber test suite...");
  
  if (process.env.CI) {
    console.log("Running in CI environment");
  }
});

AfterAll(async function () {
  console.log("✅ Cucumber test suite completed");
});

Before(async function (this: CustomWorld) {
  await this.setupTempDir();
  this.clearVariables();
  
  if (this.debugMode) {
    console.log(`\n📝 Starting scenario: ${this.testCaseStartedId}`);
  }
});

After(async function (this: CustomWorld, { result }) {
  if (result?.status === Status.FAILED) {
    console.error("❌ Scenario failed");
    
    if (this.lastResult) {
      console.log("Last command output:");
      console.log("stdout:", this.lastResult.stdout);
      console.log("stderr:", this.lastResult.stderr);
      console.log("exitCode:", this.lastResult.exitCode);
    }
    
    if (this.debugMode) {
      console.log("Test directory:", this.helper.tempDir);
      console.log("Variables:", this.variables);
    }
  }
  
  await this.helper.cleanup();
});

Before({ tags: "@smoke" }, async function (this: CustomWorld) {
  this.log("Running smoke test");
});

Before({ tags: "@regression" }, async function (this: CustomWorld) {
  this.log("Running regression test");
});

Before({ tags: "@integration" }, async function (this: CustomWorld) {
  this.log("Running integration test");
});

Before({ tags: "@performance" }, async function (this: CustomWorld) {
  this.log("Running performance test");
  this.setVariable("performanceStartTime", Date.now());
});

After({ tags: "@performance" }, async function (this: CustomWorld) {
  const startTime = this.getVariable("performanceStartTime");
  if (startTime) {
    const duration = Date.now() - startTime;
    console.log(`⏱️ Performance test completed in ${duration}ms`);
  }
});