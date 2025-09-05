import { loadFeature, defineFeature } from 'vitest-cucumber';
import { expect } from 'vitest';
import { UnjucksWorld } from '../support/world';

export const templateGenerationStepDefinitions = {
  'I have a project with templates directory': async (world: UnjucksWorld) => {
    if (!world.context.tempDirectory) {
      await world.createTempDirectory();
    }
    await world.helper.createDirectory('_templates');
  },

  'I am in the project root directory': async (world: UnjucksWorld) => {
    if (!world.context.tempDirectory) {
      await world.createTempDirectory();
    }
    await world.helper.changeToTempDir();
  },

  'I have a {string} generator with {string} template': async (world: UnjucksWorld, generatorName: string, templateName: string) => {
    await world.helper.createDirectory(`_templates/${generatorName}/${templateName}`);
    await world.helper.createFile(
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
  },

  'I have a {string} generator': async (world: UnjucksWorld, generatorName: string) => {
    await world.helper.createDirectory(`_templates/${generatorName}`);
  },

  'I have generators {string} and {string}': async (world: UnjucksWorld, generator1: string, generator2: string) => {
    await world.helper.createDirectory(`_templates/${generator1}`);
    await world.helper.createDirectory(`_templates/${generator2}`);
  },

  'I am in an empty directory': async (world: UnjucksWorld) => {
    if (!world.context.tempDirectory) {
      await world.createTempDirectory();
    }
    await world.helper.changeToTempDir();
  },

  'I run {string}': async (world: UnjucksWorld, command: string) => {
    // Ensure we have a working directory
    if (!world.context.tempDirectory) {
      await world.createTempDirectory();
    }
    
    const result = await world.helper.runCli(command);
    world.setLastCommandResult(result);
    
    // Store command for potential re-use
    world.context.templateVariables.lastCommand = command;
  },

  'I should see {string} file generated': async (world: UnjucksWorld, filename: string) => {
    const exists = await world.helper.fileExists(filename);
    if (!exists) {
      const files = await world.helper.listFiles();
      throw new Error(`File '${filename}' not found. Available files: ${files.join(', ')}`);
    }
    expect(exists).toBe(true);
  },

  'the file should contain {string}': async (world: UnjucksWorld, content: string) => {
    const files = await world.helper.listFiles();
    const generatedFile = files.find((file) => file.includes('.ts'));
    
    if (!generatedFile) {
      throw new Error(`No .ts file found. Available files: ${files.join(', ')}`);
    }

    const fileContent = await world.helper.readFile(generatedFile);
    if (!fileContent.includes(content)) {
      throw new Error(`Content '${content}' not found in file '${generatedFile}'. File content:\n${fileContent}`);
    }
    expect(fileContent).toContain(content);
  },

  'the generated filename should be {string}': async (world: UnjucksWorld, filename: string) => {
    const files = await world.helper.listFiles();
    if (!files.includes(filename)) {
      throw new Error(`Expected filename '${filename}' not found. Available files: ${files.join(', ')}`);
    }
    expect(files).toContain(filename);
  },

  'the content should contain {string}': async (world: UnjucksWorld, content: string) => {
    const files = await world.helper.listFiles();
    const generatedFile = files.find((file) => file.includes('.ts'));
    expect(generatedFile).toBeDefined();

    if (generatedFile) {
      const fileContent = await world.helper.readFile(generatedFile);
      expect(fileContent).toContain(content);
    }
  },

  'I should see an error message': (world: UnjucksWorld) => {
    const result = world.getLastCommandResult();
    if (result.exitCode === 0) {
      throw new Error(`Expected command to fail, but it succeeded. Output: ${result.stdout}`);
    }
    expect(result.exitCode).not.toBe(0);
  },

  'the error should contain {string}': (world: UnjucksWorld, errorText: string) => {
    const result = world.getLastCommandResult();
    const errorOutput = result.stderr || result.stdout; // Some CLIs output errors to stdout
    if (!errorOutput.includes(errorText)) {
      throw new Error(`Error text '${errorText}' not found. Error output: ${errorOutput}`);
    }
    expect(errorOutput).toContain(errorText);
  },

  'I should see {string} generator listed': (world: UnjucksWorld, generatorName: string) => {
    const result = world.getLastCommandResult();
    expect(result.stdout).toContain(generatorName);
  },

  'I should see {string} directory created': async (world: UnjucksWorld, dirName: string) => {
    const exists = await world.helper.fileExists(dirName);
    expect(exists).toBe(true);
  },

  'I should see {string} file created': async (world: UnjucksWorld, fileName: string) => {
    const exists = await world.helper.fileExists(fileName);
    expect(exists).toBe(true);
  },

  'I should see example generators created': async (world: UnjucksWorld) => {
    const commandExists = await world.helper.fileExists('_templates/command');
    const cliExists = await world.helper.fileExists('_templates/cli');
    expect(commandExists).toBe(true);
    expect(cliExists).toBe(true);
  }
};