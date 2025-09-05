import { Given, When, Then } from '@cucumber/cucumber';
import * as assert from 'assert';
import { UnjucksWorld } from '../support/world';

Given('I have a {string} generator', async function (this: UnjucksWorld, name: string) {
  this.setTemplateVariables({ generatorName: name });
  await this.createTemplateStructure({ [`${name}/new.ts`]: 'export default {};' });
});

Given('I have a generator {string} with action {string}', async function (
  this: UnjucksWorld,
  generator: string,
  action: string
) {
  this.setTemplateVariables({ generatorName: generator, action });
  await this.createTemplateStructure({ [`${generator}/${action}.ts`]: 'export default {};' });
});

Given('I have a template file {string} with content:', async function (
  this: UnjucksWorld,
  filePath: string,
  content: string
) {
  const templates: Record<string, string> = {};
  templates[filePath] = content;
  await this.createTemplateStructure(templates);
});

Given('I set variable {string} to {string}', async function (
  this: UnjucksWorld,
  key: string,
  value: string
) {
  this.setTemplateVariables({ [key]: value });
});

When('I run {string}', async function (this: UnjucksWorld, command: string) {
  console.log(`Running command: ${command}`);
  
  // Handle full node commands like "node dist/cli.mjs --version"
  if (command.includes('node dist/cli.mjs')) {
    const result = await this.helper.executeCommand(command);
    console.log(`Command result: { exitCode: ${result.exitCode}, stdout: '${result.stdout}', stderr: '${result.stderr}' }`);
    
    // Set the command result in world context
    this.context.lastCommandOutput = result.stdout;
    this.context.lastCommandError = result.stderr;
    this.context.lastCommandCode = result.exitCode;
    return;
  }
  
  // Handle unjucks commands
  const args = command.split(' ').filter(arg => arg.trim().length > 0);
  await this.executeUnjucksCommand(args);
});

When('I run unjucks {string}', async function (this: UnjucksWorld, args: string) {
  const argArray = args.split(' ').filter(arg => arg.trim().length > 0);
  await this.executeUnjucksCommand(argArray);
});

Then('I should see {string}', function (this: UnjucksWorld, text: string) {
  assert.ok(this.getLastOutput().includes(text), `Expected output to contain '${text}', but got: ${this.getLastOutput()}`);
});

Then('I should not see {string}', function (this: UnjucksWorld, text: string) {
  assert.ok(!this.getLastOutput().includes(text), `Expected output not to contain '${text}', but it does: ${this.getLastOutput()}`);
});

Then('the command should succeed', function (this: UnjucksWorld) {
  this.assertCommandSucceeded();
});

Then('the command should fail', function (this: UnjucksWorld) {
  this.assertCommandFailed();
});

Then('the exit code should be {int}', function (this: UnjucksWorld, exitCode: number) {
  assert.strictEqual(this.getLastExitCode(), exitCode, `Expected exit code ${exitCode}, but got ${this.getLastExitCode()}`);
});

Then('the file {string} should exist', async function (this: UnjucksWorld, filePath: string) {
  assert.strictEqual(await this.fileExists(filePath), true, `Expected file '${filePath}' to exist, but it doesn't`);
});

Then('the file {string} should not exist', async function (this: UnjucksWorld, filePath: string) {
  assert.strictEqual(await this.fileExists(filePath), false, `Expected file '${filePath}' not to exist, but it does`);
});

Then('the file {string} should contain {string}', async function (
  this: UnjucksWorld,
  filePath: string,
  expectedContent: string
) {
  const content = await this.readGeneratedFile(filePath);
  assert.ok(content.includes(expectedContent), `Expected file '${filePath}' to contain '${expectedContent}', but got: ${content}`);
});

Then('the file {string} should not contain {string}', async function (
  this: UnjucksWorld,
  filePath: string,
  unexpectedContent: string
) {
  const content = await this.readGeneratedFile(filePath);
  assert.ok(!content.includes(unexpectedContent), `Expected file '${filePath}' not to contain '${unexpectedContent}', but it does: ${content}`);
});

Then('the file {string} should match:', async function (
  this: UnjucksWorld,
  filePath: string,
  expectedContent: string
) {
  const content = await this.readGeneratedFile(filePath);
  assert.strictEqual(content.trim(), expectedContent.trim(), `Expected file '${filePath}' to exactly match content`);
});

Given('a temporary directory', async function (this: UnjucksWorld) {
  await this.createTempDirectory();
});

Given('the following files exist:', async function (this: UnjucksWorld, dataTable: any) {
  const templates: Record<string, string> = {};
  const files = dataTable.hashes();
  for (const file of files) {
    templates[file.path] = file.content || '';
  }
  await this.createTemplateStructure(templates);
});

When('I create a directory {string}', async function (this: UnjucksWorld, dir: string) {
  await (this as any).createDirectory(dir);
});

When('I write to file {string} with content {string}', async function (
  this: UnjucksWorld,
  filePath: string,
  content: string
) {
  await (this as any).createFile(filePath, content);
});

Then('the stderr should contain {string}', function (this: UnjucksWorld, text: string) {
  assert.ok(this.getLastError().includes(text), `Expected stderr to contain '${text}', but got: ${this.getLastError()}`);
});

Then('the stdout should be empty', function (this: UnjucksWorld) {
  assert.strictEqual(this.getLastOutput().trim(), '', `Expected stdout to be empty, but got: ${this.getLastOutput()}`);
});

Then('the stderr should be empty', function (this: UnjucksWorld) {
  assert.strictEqual(this.getLastError().trim(), '', `Expected stderr to be empty, but got: ${this.getLastError()}`);
});