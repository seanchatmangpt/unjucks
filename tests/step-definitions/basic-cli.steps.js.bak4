import { Given, When, Then, setWorldConstructor } from '@cucumber/cucumber';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as assert from 'node:assert';

const execAsync = promisify(exec);

class BasicWorld {
  constructor() {
    this.lastCommand = undefined;
    this.lastResult = undefined;
  }

  async executeCommand(command) {
    try {
      const result = await execAsync(command, {
        timeout: 10000,
        maxBuffer: 1024 * 1024
      });
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0
      };
    } catch (error) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.code || 1
      };
    }
  }
}

setWorldConstructor(BasicWorld);

When('I run {string}', async function(command) {
  this.lastCommand = command;
  this.lastResult = await this.executeCommand(command);
});

Then('the command should exit with code {int}', function(expectedCode) {
  assert.strictEqual(this.lastResult?.exitCode, expectedCode);
});

Then('the output should contain {string}', function(expectedText) {
  const output = (this.lastResult?.stdout || '') + (this.lastResult?.stderr || '');
  assert.ok(output.includes(expectedText), 
    `Expected output to contain "${expectedText}", but got: ${output}`);
});

Then('the output should contain version information', function() {
  const output = this.lastResult?.stdout || '';
  // Check for semantic version pattern (e.g., "0.0.0", "1.2.3")
  assert.ok(/\d+\.\d+\.\d+/.test(output), 
    `Expected version information in output, but got: ${output}`);
});