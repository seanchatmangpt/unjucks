import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "vitest";
import { TestHelper, setupTestEnvironment, cleanupTestEnvironment } from "../helpers/test-helper.js";
import path from "node:path";

let helper: TestHelper;
let lastCommandResult: { stdout: string; stderr: string; exitCode: number } | null = null;

Given("I have a project with templates directory", async () => {
  helper = await setupTestEnvironment();
  await helper.createDirectory("_templates");
});

Given("I am in the project root directory", async () => {
  await helper.changeToTempDir();
});

Given("I have a {string} generator with {string} template", async (generatorName: string, templateName: string) => {
  await helper.createDirectory(`_templates/${generatorName}/${templateName}`);
  await helper.createFile(
    `_templates/${generatorName}/${templateName}/{{ commandName | pascalCase }}.ts`,
    `import { defineCommand } from "citty";
import chalk from "chalk";

export const {{ commandName | pascalCase }}Command = defineCommand({
  meta: {
    name: "{{ commandName | kebabCase }}",
    description: "{{ commandName | titleCase }} command",
  },
  async run({ args }: { args: any }) {
    console.log(chalk.blue.bold("{{ commandName | titleCase }} Command"));
    console.log(chalk.gray("Running {{ commandName | kebabCase }} command..."));
  },
});`
  );
});

Given("I have a {string} generator", async (generatorName: string) => {
  await helper.createDirectory(`_templates/${generatorName}`);
});

Given("I have generators {string} and {string}", async (generator1: string, generator2: string) => {
  await helper.createDirectory(`_templates/${generator1}`);
  await helper.createDirectory(`_templates/${generator2}`);
});

Given("I am in an empty directory", async () => {
  helper = await setupTestEnvironment();
  await helper.changeToTempDir();
});

When("I run {string}", async (command: string) => {
  lastCommandResult = await helper.runCli(command);
});

Then("I should see {string} file generated", async (filename: string) => {
  expect(await helper.fileExists(filename)).toBe(true);
});

Then("the file should contain {string}", async (content: string) => {
  const files = await helper.listFiles();
  const generatedFile = files.find(file => file.includes(".ts"));
  expect(generatedFile).toBeDefined();
  
  if (generatedFile) {
    const fileContent = await helper.readFile(generatedFile);
    expect(fileContent).toContain(content);
  }
});

Then("the generated filename should be {string}", async (filename: string) => {
  const files = await helper.listFiles();
  expect(files).toContain(filename);
});

Then("the content should contain {string}", async (content: string) => {
  const files = await helper.listFiles();
  const generatedFile = files.find(file => file.includes(".ts"));
  expect(generatedFile).toBeDefined();
  
  if (generatedFile) {
    const fileContent = await helper.readFile(generatedFile);
    expect(fileContent).toContain(content);
  }
});

Then("I should see an error message", () => {
  expect(lastCommandResult).toBeDefined();
  expect(lastCommandResult!.exitCode).not.toBe(0);
});

Then("the error should contain {string}", (errorText: string) => {
  expect(lastCommandResult).toBeDefined();
  expect(lastCommandResult!.stderr).toContain(errorText);
});

Then("I should see {string} generator listed", (generatorName: string) => {
  expect(lastCommandResult).toBeDefined();
  expect(lastCommandResult!.stdout).toContain(generatorName);
});

Then("I should see {string} directory created", async (dirName: string) => {
  expect(await helper.fileExists(dirName)).toBe(true);
});

Then("I should see {string} file created", async (fileName: string) => {
  expect(await helper.fileExists(fileName)).toBe(true);
});

Then("I should see example generators created", async () => {
  expect(await helper.fileExists("_templates/command")).toBe(true);
  expect(await helper.fileExists("_templates/cli")).toBe(true);
});

// Cleanup after each scenario
After(async () => {
  if (helper) {
    await cleanupTestEnvironment(helper);
  }
  lastCommandResult = null;
});
