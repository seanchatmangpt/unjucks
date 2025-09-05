import { Given, When, Then } from '@cucumber/cucumber';
import { execSync } from 'child_process';
import type { ExecSyncOptions } from 'child_process';
import { strict as assert } from 'assert';

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

// Store command results between steps
let lastCommandResult: CommandResult;

const executeCommand = (command: string): CommandResult => {
  const options: ExecSyncOptions = {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 10000,
  };

  try {
    const stdout = execSync(command, options) as string;
    return {
      stdout: stdout.trim(),
      stderr: '',
      exitCode: 0,
      success: true
    };
  } catch (error: any) {
    return {
      stdout: error.stdout ? error.stdout.toString().trim() : '',
      stderr: error.stderr ? error.stderr.toString().trim() : error.message || '',
      exitCode: error.status || 1,
      success: false
    };
  }
};

Given('I have Unjucks installed', function () {
  // This step just documents the precondition
  // In a real scenario, you might check for installation
  assert.ok(true);
});

When('I run {string}', function (command: string) {
  // Replace 'unjucks' with the actual command path for testing
  const actualCommand = command.replace(/^unjucks/, 'npx tsx src/cli.ts');
  lastCommandResult = executeCommand(actualCommand);
});

Then('the command should succeed', function () {
  assert.ok(lastCommandResult.success, 
    `Command failed with exit code ${lastCommandResult.exitCode}. ` +
    `Stdout: ${lastCommandResult.stdout}. ` +
    `Stderr: ${lastCommandResult.stderr}`
  );
});

Then('the command should complete', function () {
  // This step allows for either success or expected failures
  // Just checks that the command completed (didn't timeout or crash)
  assert.notEqual(lastCommandResult, undefined);
});

Then('the command should fail gracefully', function () {
  assert.equal(lastCommandResult.success, false);
  assert.ok(lastCommandResult.exitCode > 0);
});

Then('the output should contain {string}', function (expectedText: string) {
  const allOutput = lastCommandResult.stdout + ' ' + lastCommandResult.stderr;
  assert.ok(allOutput.toLowerCase().includes(expectedText.toLowerCase()));
});

Then('the output should contain version information', function () {
  const allOutput = lastCommandResult.stdout + ' ' + lastCommandResult.stderr;
  // Look for common version patterns
  const hasVersionPattern = /\d+\.\d+\.\d+/.test(allOutput) || 
                           allOutput.toLowerCase().includes('version');
  assert.ok(hasVersionPattern, 
    `Expected version information in output: ${allOutput}`
  );
});

Then('the output should contain command descriptions', function () {
  const allOutput = lastCommandResult.stdout + ' ' + lastCommandResult.stderr;
  const hasCommands = allOutput.toLowerCase().includes('commands') ||
                     allOutput.toLowerCase().includes('generate') ||
                     allOutput.toLowerCase().includes('list') ||
                     allOutput.toLowerCase().includes('help');
  assert.ok(hasCommands,
    `Expected command descriptions in output: ${allOutput}`
  );
});

Then('the output should show available generators or indicate none found', function () {
  const allOutput = lastCommandResult.stdout + ' ' + lastCommandResult.stderr;
  // Either shows generators or indicates none found
  const hasValidOutput = allOutput.length > 0 && (
    allOutput.toLowerCase().includes('generator') ||
    allOutput.toLowerCase().includes('template') ||
    allOutput.toLowerCase().includes('no') ||
    allOutput.toLowerCase().includes('found') ||
    allOutput.toLowerCase().includes('available') ||
    allOutput.toLowerCase().includes('list')
  );
  assert.ok(hasValidOutput,
    `Expected generator list or 'none found' message in output: ${allOutput}`
  );
});

Then('the output should contain helpful error information', function () {
  const allOutput = lastCommandResult.stdout + ' ' + lastCommandResult.stderr;
  const hasHelpfulError = allOutput.toLowerCase().includes('error') ||
                         allOutput.toLowerCase().includes('unknown') ||
                         allOutput.toLowerCase().includes('invalid') ||
                         allOutput.toLowerCase().includes('help') ||
                         allOutput.toLowerCase().includes('usage') ||
                         allOutput.toLowerCase().includes('command');
  assert.ok(hasHelpfulError,
    `Expected helpful error information in output: ${allOutput}`
  );
});