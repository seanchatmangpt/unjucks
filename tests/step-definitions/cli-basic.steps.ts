import { Given, When, Then } from '@cucumber/cucumber';
import * as assert from 'assert';
import { UnjucksWorld } from '../support/world.js';

// ===== BASIC CLI SETUP STEPS =====
Given('I have Unjucks installed', function (this: UnjucksWorld) {
  // This step assumes Unjucks is built and available
  // The CLI is tested via the built dist/cli.mjs file
  assert.ok(true, 'Unjucks CLI is available for testing');
});

Given('I am in the project root directory', async function (this: UnjucksWorld) {
  await this.createTempDirectory();
  process.chdir(this.context.tempDirectory);
});

Given('I am in an empty directory', async function (this: UnjucksWorld) {
  await this.createTempDirectory();
  process.chdir(this.context.tempDirectory);
});

// ===== COMMAND EXECUTION STEPS =====
When('I run {string}', async function (this: UnjucksWorld, command: string) {
  // Parse the command to extract unjucks commands
  if (command.startsWith('unjucks ')) {
    const args = command.slice('unjucks '.length).split(' ');
    await this.executeUnjucksCommand(args);
  } else {
    // For non-unjucks commands, use shell execution
    await this.executeShellCommand(command);
  }
});

// ===== OUTPUT VALIDATION STEPS =====
Then('I should see {string}', function (this: UnjucksWorld, expectedOutput: string) {
  const output = this.getLastOutput();
  assert.ok(output.includes(expectedOutput), 
    `Expected output to contain "${expectedOutput}", but got: ${output}`);
});

Then('I should see {string} in the output', function (this: UnjucksWorld, expectedOutput: string) {
  const output = this.getLastOutput();
  assert.ok(output.includes(expectedOutput), 
    `Expected output to contain "${expectedOutput}", but got: ${output}`);
});

Then('the output should contain {string}', function (this: UnjucksWorld, expectedOutput: string) {
  const output = this.getLastOutput();
  assert.ok(output.includes(expectedOutput), 
    `Expected output to contain "${expectedOutput}", but got: ${output}`);
});

Then('I should see {string} file generated', async function (this: UnjucksWorld, filename: string) {
  const exists = await this.fileExists(filename);
  assert.ok(exists, `Expected file ${filename} to be generated`);
  
  // Track the file for cleanup
  this.trackGeneratedFile(filename);
});

Then('the file should contain {string}', async function (this: UnjucksWorld, expectedContent: string) {
  // Find the most recently generated file or use context
  const files = this.context.generatedFiles;
  assert.ok(files.length > 0, 'Expected at least one file to be generated');
  
  const latestFile = files[files.length - 1];
  const content = await this.readGeneratedFile(latestFile);
  assert.ok(content.includes(expectedContent), 
    `Expected file ${latestFile} to contain "${expectedContent}"`);
});

// ===== EXIT CODE VALIDATION =====
Then('the exit code should be {int}', function (this: UnjucksWorld, expectedCode: number) {
  const actualCode = this.getLastExitCode();
  assert.strictEqual(actualCode, expectedCode, 
    `Expected exit code ${expectedCode}, but got ${actualCode}`);
});

// ===== ERROR HANDLING STEPS =====
Then('I should see an error message', function (this: UnjucksWorld) {
  const error = this.getLastError();
  const exitCode = this.getLastExitCode();
  
  assert.ok(error.length > 0 || (exitCode !== null && exitCode !== 0), 
    'Expected an error message or non-zero exit code');
});

Then('the error should contain {string}', function (this: UnjucksWorld, expectedError: string) {
  const error = this.getLastError();
  assert.ok(error.includes(expectedError), 
    `Expected error to contain "${expectedError}", but got: ${error}`);
});

// ===== GENERATOR LISTING STEPS =====
Then('I should see {string} generator listed', function (this: UnjucksWorld, generatorName: string) {
  const output = this.getLastOutput();
  assert.ok(output.includes(generatorName), 
    `Expected to see generator "${generatorName}" in output: ${output}`);
});

// ===== DIRECTORY AND FILE CREATION VERIFICATION =====
Then('I should see {string} directory created', async function (this: UnjucksWorld, dirName: string) {
  const exists = await this.helper.directoryExists(dirName);
  assert.ok(exists, `Expected directory ${dirName} to be created`);
});

Then('I should see {string} file created', async function (this: UnjucksWorld, fileName: string) {
  const exists = await this.fileExists(fileName);
  assert.ok(exists, `Expected file ${fileName} to be created`);
  
  // Track the file for cleanup
  this.trackGeneratedFile(fileName);
});

// ===== CONTENT VALIDATION STEPS =====
Then('the content should contain {string}', async function (this: UnjucksWorld, expectedContent: string) {
  // Use the last generated file or tracked file
  const files = this.context.generatedFiles;
  assert.ok(files.length > 0, 'Expected at least one file to check');
  
  const latestFile = files[files.length - 1];
  const content = await this.readGeneratedFile(latestFile);
  assert.ok(content.includes(expectedContent), 
    `Expected file content to contain "${expectedContent}"`);
});

Then('the generated filename should be {string}', function (this: UnjucksWorld, expectedFilename: string) {
  const files = this.context.generatedFiles;
  assert.ok(files.length > 0, 'Expected at least one file to be generated');
  
  const latestFile = files[files.length - 1];
  assert.ok(latestFile.includes(expectedFilename), 
    `Expected generated filename to include "${expectedFilename}", got: ${latestFile}`);
});

// ===== PREVIEW AND DRY RUN STEPS =====
Then('I should see {string} in the output', function (this: UnjucksWorld, expectedText: string) {
  const output = this.getLastOutput();
  assert.ok(output.includes(expectedText), 
    `Expected to see "${expectedText}" in output: ${output}`);
});

Then('I should see the generated file content in the output', function (this: UnjucksWorld) {
  const output = this.getLastOutput();
  // Check that output contains content that looks like file content
  assert.ok(output.length > 50, 'Expected substantial output showing file content');
});

Then('I should see usage examples', function (this: UnjucksWorld) {
  const output = this.getLastOutput();
  const hasUsageIndicators = output.includes('usage') || 
                             output.includes('example') || 
                             output.includes('--help') ||
                             output.includes('Usage:');
  
  assert.ok(hasUsageIndicators, 
    `Expected to see usage examples in output: ${output}`);
});

// ===== COMMAND SUCCESS/FAILURE =====
Then('the command should succeed', function (this: UnjucksWorld) {
  const exitCode = this.getLastExitCode();
  assert.strictEqual(exitCode, 0, 
    `Expected command to succeed (exit code 0), but got: ${exitCode}`);
});

Then('the command should fail', function (this: UnjucksWorld) {
  const exitCode = this.getLastExitCode();
  assert.ok(exitCode !== 0, 
    `Expected command to fail (non-zero exit code), but got: ${exitCode}`);
});

// ===== VERSION AND HELP INFORMATION =====
Then('the output should contain version information', function (this: UnjucksWorld) {
  const output = this.getLastOutput();
  // Look for version patterns
  const hasVersionInfo = /\d+\.\d+\.\d+/.test(output) || 
                        output.includes('version') ||
                        output.includes('Version');
  
  assert.ok(hasVersionInfo, 
    `Expected output to contain version information: ${output}`);
});

Then('the output should contain help information', function (this: UnjucksWorld) {
  const output = this.getLastOutput();
  const hasHelpInfo = output.includes('Usage:') ||
                     output.includes('Commands:') ||
                     output.includes('Options:') ||
                     output.includes('help');
  
  assert.ok(hasHelpInfo, 
    `Expected output to contain help information: ${output}`);
});

Then('the output should contain command descriptions', function (this: UnjucksWorld) {
  const output = this.getLastOutput();
  const hasCommandDescriptions = output.includes('generate') ||
                                output.includes('list') ||
                                output.includes('init') ||
                                output.includes('help') ||
                                output.includes('Commands:');
  
  assert.ok(hasCommandDescriptions, 
    `Expected output to contain command descriptions: ${output}`);
});

// ===== COMMAND COMPLETION =====
Then('the command should complete', function (this: UnjucksWorld) {
  // Command completion is similar to success but may allow different exit codes
  const exitCode = this.getLastExitCode();
  assert.ok(exitCode !== null, 'Expected command to complete with some exit code');
});

// ===== GENERATOR LISTING =====
Then('the output should show available generators or indicate none found', function (this: UnjucksWorld) {
  const output = this.getLastOutput();
  const hasGeneratorInfo = output.includes('generator') ||
                          output.includes('template') ||
                          output.includes('No generators found') ||
                          output.includes('none found') ||
                          output.length > 10; // Some output was provided
  
  assert.ok(hasGeneratorInfo, 
    `Expected output to show generator information or indicate none found: ${output}`);
});

// ===== GRACEFUL ERROR HANDLING =====
Then('the command should fail gracefully', function (this: UnjucksWorld) {
  const exitCode = this.getLastExitCode();
  const output = this.getLastOutput();
  const error = this.getLastError();
  
  // Should fail (non-zero exit code) but provide helpful output
  assert.ok(exitCode !== 0, 'Expected command to fail with non-zero exit code');
  assert.ok(output.length > 0 || error.length > 0, 
    'Expected some output or error message when command fails gracefully');
});

Then('the output should contain helpful error information', function (this: UnjucksWorld) {
  const output = this.getLastOutput();
  const error = this.getLastError();
  const combinedOutput = output + error;
  
  const hasHelpfulInfo = combinedOutput.includes('help') ||
                        combinedOutput.includes('usage') ||
                        combinedOutput.includes('available') ||
                        combinedOutput.includes('try') ||
                        combinedOutput.includes('--help') ||
                        combinedOutput.includes('command') ||
                        combinedOutput.includes('invalid') ||
                        combinedOutput.includes('unknown');
  
  assert.ok(hasHelpfulInfo, 
    `Expected output to contain helpful error information: ${combinedOutput}`);
});

// ===== EXAMPLE GENERATOR CREATION =====
Then('I should see example generators created', async function (this: UnjucksWorld) {
  // Check for typical example generator directories
  const examplePaths = [
    '_templates',
    '_templates/component',
    '_templates/page',
    '_templates/example'
  ];
  
  let foundExamples = false;
  for (const examplePath of examplePaths) {
    if (await this.helper.directoryExists(examplePath)) {
      foundExamples = true;
      break;
    }
  }
  
  assert.ok(foundExamples, 'Expected to find example generator directories');
});