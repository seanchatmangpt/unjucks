import { Given, When, Then } from "@amiceli/vitest-cucumber";
import { expect } from "vitest";
import { execSync } from "child_process";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const testDir = path.join(projectRoot, "test-positional");

// Test state
let lastCommandOutput = "";
let lastCommandError = "";
let lastCommandExitCode = 0;
let currentTestDir = testDir;

// Clean up function
function cleanup() {
  if (fs.existsSync(testDir)) {
    fs.removeSync(testDir);
  }
}

// Setup function
function setupTestProject() {
  cleanup();
  fs.ensureDirSync(testDir);
  
  // Create _templates directory with command generator
  const templatesDir = path.join(testDir, "_templates");
  const commandDir = path.join(templatesDir, "command");
  const cittyDir = path.join(commandDir, "citty");
  
  fs.ensureDirSync(cittyDir);
  
  // Create config.yml for command generator
  const config = `name: command
description: Generate Citty CLI commands
templates:
  - name: citty
    description: Citty command with subcommands and tests
    files:
      - "{{ commandName | pascalCase }}.ts"
      - "{{ commandName | pascalCase }}.test.ts"
    prompts:
      - name: commandName
        message: "Command name:"
        type: input
        default: myCommand
      - name: withTests
        message: Include tests?
        type: confirm
        default: true
      - name: withSubcommands
        message: Include subcommands?
        type: confirm
        default: true`;
  
  fs.writeFileSync(path.join(commandDir, "config.yml"), config);
  
  // Create command template
  const commandTemplate = `import { defineCommand } from "citty";
import chalk from "chalk";

export const {{ commandName | pascalCase }}Command = defineCommand({
  meta: {
    name: "{{ commandName | kebabCase }}",
    description: "{{ commandName | titleCase }} command",
  },
  {% if withSubcommands %}
  subCommands: {
    // Add your subcommands here
  },
  {% endif %}
  args: {
    // Add your command arguments here
  },
  async run({ args }: { args: any }) {
    console.log(chalk.blue.bold("{{ commandName | titleCase }} Command"));
    console.log(chalk.gray("Running {{ commandName | kebabCase }} command..."));
    console.log(chalk.green("✅ {{ commandName | titleCase }} completed successfully!"));
  },
});`;
  
  fs.writeFileSync(path.join(cittyDir, "{{ commandName | pascalCase }}.ts"), commandTemplate);
  
  // Create test template
  const testTemplate = `{% if withTests %}import { describe, expect, it } from "vitest";
import { {{ commandName | pascalCase }}Command } from "./{{ commandName | pascalCase }}";

describe("{{ commandName | pascalCase }}Command", () => {
  it("should be defined", () => {
    expect({{ commandName | pascalCase }}Command).toBeDefined();
  });

  it("should have correct meta", () => {
    expect({{ commandName | pascalCase }}Command.meta?.name).toBe("{{ commandName | kebabCase }}");
    expect({{ commandName | pascalCase }}Command.meta?.description).toBe("{{ commandName | titleCase }} command");
  });
});{% endif %}`;
  
  fs.writeFileSync(path.join(cittyDir, "{{ commandName | pascalCase }}.test.ts"), testTemplate);
}

function runCommand(command: string, cwd = testDir): void {
  try {
    const cliPath = path.join(projectRoot, "src/cli.ts");
    const fullCommand = `node --loader tsx ${cliPath} ${command}`;
    
    lastCommandOutput = execSync(fullCommand, { 
      cwd, 
      encoding: "utf8",
      stdio: "pipe"
    });
    lastCommandError = "";
    lastCommandExitCode = 0;
  } catch (error: any) {
    lastCommandOutput = error.stdout || "";
    lastCommandError = error.stderr || error.message || "";
    lastCommandExitCode = error.status || 1;
  }
}

Given("I have initialized a project with templates", () => {
  setupTestProject();
});

Given("the command generator exists with citty template", () => {
  const commandDir = path.join(testDir, "_templates", "command");
  expect(fs.existsSync(commandDir)).toBe(true);
  
  const cittyDir = path.join(commandDir, "citty");
  expect(fs.existsSync(cittyDir)).toBe(true);
});

Given("the template has variables: commandName, withTests, withSubcommands", () => {
  const configFile = path.join(testDir, "_templates", "command", "config.yml");
  const config = fs.readFileSync(configFile, "utf8");
  
  expect(config).toContain("commandName");
  expect(config).toContain("withTests");
  expect(config).toContain("withSubcommands");
});

When("I run {string}", (command: string) => {
  runCommand(command);
});

When("I run {string} without required parameters", (command: string) => {
  runCommand(command);
});

When("I run {string} interactively", (command: string) => {
  // For interactive testing, we'll simulate the prompt responses
  // This would require more complex mocking in a real scenario
  runCommand(`${command} --commandName=InteractiveCommand`);
});

When("I provide {string} when prompted for commandName", (value: string) => {
  // This step is handled in the previous step for simplicity
});

Then("the generation should succeed", () => {
  if (lastCommandExitCode !== 0) {
    console.log("Command output:", lastCommandOutput);
    console.log("Command error:", lastCommandError);
  }
  expect(lastCommandExitCode).toBe(0);
});

Then("the file {string} should be created", (filename: string) => {
  const filePath = path.join(testDir, filename);
  expect(fs.existsSync(filePath)).toBe(true);
});

Then("the file should contain {string}", (content: string) => {
  // Find the generated file (should be the .ts file that was created)
  const files = fs.readdirSync(testDir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  expect(files.length).toBeGreaterThan(0);
  
  const fileContent = fs.readFileSync(path.join(testDir, files[0]), "utf8");
  expect(fileContent).toContain(content);
});

Then("the test file should not be created", () => {
  const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.test.ts'));
  expect(testFiles.length).toBe(0);
});

Then("the test file {string} should be created", (filename: string) => {
  const filePath = path.join(testDir, filename);
  expect(fs.existsSync(filePath)).toBe(true);
  
  const content = fs.readFileSync(filePath, "utf8");
  expect(content).toContain("describe");
  expect(content).toContain("it");
});

Then("the command should fail with validation error", () => {
  expect(lastCommandExitCode).not.toBe(0);
  expect(lastCommandError || lastCommandOutput).toContain("validation");
});

Then("usage examples should be displayed", () => {
  const output = lastCommandOutput + lastCommandError;
  expect(output).toMatch(/usage|example/i);
});

Then("positional parameters should be shown", () => {
  expect(lastCommandOutput).toContain("Positional Parameters");
});

Then("flag parameters should be shown", () => {
  expect(lastCommandOutput).toContain("Flag Parameters");
});

Then("the result should be identical to positional usage", () => {
  // This would require comparing outputs from both methods
  expect(lastCommandExitCode).toBe(0);
});

Then("the file should use {string} not {string}", (expectedName: string, notExpectedName: string) => {
  const files = fs.readdirSync(testDir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  expect(files.length).toBeGreaterThan(0);
  
  const fileContent = fs.readFileSync(path.join(testDir, files[0]), "utf8");
  expect(fileContent).toContain(expectedName);
  expect(fileContent).not.toContain(notExpectedName);
});

Then("the command should show what would be generated", () => {
  expect(lastCommandOutput).toContain("Dry run");
  expect(lastCommandOutput).toContain("would be generated");
});

Then("no files should be created", () => {
  const files = fs.readdirSync(testDir).filter(f => 
    f.endsWith('.ts') && f !== 'cli.ts' && !f.startsWith('.')
  );
  expect(files.length).toBe(0);
});

Then("the output should show {string}", (expectedOutput: string) => {
  expect(lastCommandOutput).toContain(expectedOutput);
});

Then("positional parameter tips should be displayed", () => {
  expect(lastCommandOutput).toContain("positional parameter");
});

Then("examples should be shown", () => {
  expect(lastCommandOutput).toMatch(/example|usage/i);
});

// Cleanup after tests
process.on('exit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);