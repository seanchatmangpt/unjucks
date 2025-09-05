import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert";
import { UnjucksWorld } from "../support/world";

Given("I have a project with templates directory", async function (this: UnjucksWorld) {
  if (!this.context.tempDirectory) {
    await this.createTempDirectory();
  }
  await this.helper.createDirectory("_templates");
});

Given("I am in the project root directory", async function (this: UnjucksWorld) {
  if (!this.context.tempDirectory) {
    await this.createTempDirectory();
  }
  await this.helper.changeToTempDir();
});

Given(
  "I have a {string} generator with {string} template",
  async function (this: UnjucksWorld, generatorName: string, templateName: string) {
    await this.helper.createDirectory(`_templates/${generatorName}/${templateName}`);
    await this.helper.createFile(
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
});`,
    );
  },
);

Given("I have a {string} generator", async function (this: UnjucksWorld, generatorName: string) {
  await this.helper.createDirectory(`_templates/${generatorName}`);
});

Given(
  "I have generators {string} and {string}",
  async function (this: UnjucksWorld, generator1: string, generator2: string) {
    await this.helper.createDirectory(`_templates/${generator1}`);
    await this.helper.createDirectory(`_templates/${generator2}`);
  },
);

Given("I am in an empty directory", async function (this: UnjucksWorld) {
  if (!this.context.tempDirectory) {
    await this.createTempDirectory();
  }
  await this.helper.changeToTempDir();
});

When("I run {string}", async function (this: UnjucksWorld, command: string) {
  // Ensure we have a working directory
  if (!this.context.tempDirectory) {
    await this.createTempDirectory();
  }
  
  const result = await this.helper.runCli(command);
  this.setLastCommandResult(result);
  
  // Store command for potential re-use
  this.context.templateVariables.lastCommand = command;
});

Then("I should see {string} file generated", async function (this: UnjucksWorld, filename: string) {
  const exists = await this.helper.fileExists(filename);
  if (!exists) {
    const files = await this.helper.listFiles();
    throw new Error(`File '${filename}' not found. Available files: ${files.join(', ')}`);
  }
  assert.strictEqual(exists, true, `File '${filename}' should exist`);
});

Then("the file should contain {string}", async function (this: UnjucksWorld, content: string) {
  const files = await this.helper.listFiles();
  const generatedFile = files.find((file) => file.includes(".ts"));
  
  if (!generatedFile) {
    throw new Error(`No .ts file found. Available files: ${files.join(', ')}`);
  }

  const fileContent = await this.helper.readFile(generatedFile);
  if (!fileContent.includes(content)) {
    throw new Error(`Content '${content}' not found in file '${generatedFile}'. File content:\n${fileContent}`);
  }
  assert.ok(fileContent.includes(content), `File should contain '${content}'`);
});

Then("the generated filename should be {string}", async function (this: UnjucksWorld, filename: string) {
  const files = await this.helper.listFiles();
  if (!files.includes(filename)) {
    throw new Error(`Expected filename '${filename}' not found. Available files: ${files.join(', ')}`);
  }
  assert.ok(files.includes(filename), `Files should include '${filename}'`);
});

Then("the content should contain {string}", async function (this: UnjucksWorld, content: string) {
  const files = await this.helper.listFiles();
  const generatedFile = files.find((file) => file.includes(".ts"));
  assert.ok(generatedFile, "Generated .ts file should exist");

  if (generatedFile) {
    const fileContent = await this.helper.readFile(generatedFile);
    assert.ok(fileContent.includes(content), `File should contain '${content}'`);
  }
});

Then("I should see an error message", function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  if (result.exitCode === 0) {
    throw new Error(`Expected command to fail, but it succeeded. Output: ${result.stdout}`);
  }
  assert.notStrictEqual(result.exitCode, 0, "Command should have failed");
});

Then("the error should contain {string}", function (this: UnjucksWorld, errorText: string) {
  const result = this.getLastCommandResult();
  const errorOutput = result.stderr || result.stdout; // Some CLIs output errors to stdout
  if (!errorOutput.includes(errorText)) {
    throw new Error(`Error text '${errorText}' not found. Error output: ${errorOutput}`);
  }
  assert.ok(errorOutput.includes(errorText), `Error should contain '${errorText}'`);
});

Then("I should see {string} generator listed", function (this: UnjucksWorld, generatorName: string) {
  const result = this.getLastCommandResult();
  assert.ok(result.stdout.includes(generatorName), `Output should contain generator '${generatorName}'`);
});

Then("I should see {string} directory created", async function (this: UnjucksWorld, dirName: string) {
  const exists = await this.helper.fileExists(dirName);
  assert.strictEqual(exists, true, `Directory '${dirName}' should exist`);
});

Then("I should see {string} file created", async function (this: UnjucksWorld, fileName: string) {
  const exists = await this.helper.fileExists(fileName);
  assert.strictEqual(exists, true, `File '${fileName}' should exist`);
});

Then("I should see example generators created", async function (this: UnjucksWorld) {
  const commandExists = await this.helper.fileExists("_templates/command");
  const cliExists = await this.helper.fileExists("_templates/cli");
  assert.strictEqual(commandExists, true, "Command generator should exist");
  assert.strictEqual(cliExists, true, "CLI generator should exist");
});
