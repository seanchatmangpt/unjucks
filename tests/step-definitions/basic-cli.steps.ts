import { Given, When, Then, setWorldConstructor } from '@cucumber/cucumber';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as assert from 'node:assert';

const execAsync = promisify(exec);

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

class BasicWorld {
  lastCommand?: string;
  lastResult?: CommandResult;

  async executeCommand(command: string): Promise<CommandResult> {
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
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.code || 1
      };
    }
  }
}

setWorldConstructor(BasicWorld);

When('I run {string}', async function(this: BasicWorld, command: string) {
  this.lastCommand = command;
  this.lastResult = await this.executeCommand(command);
});

Then('the command should exit with code {int}', function(this: BasicWorld, expectedCode: number) {
  assert.strictEqual(this.lastResult?.exitCode, expectedCode);
});

Then('the output should contain {string}', function(this: BasicWorld, expectedText: string) {
  const output = (this.lastResult?.stdout || '') + (this.lastResult?.stderr || '');
  assert.ok(output.includes(expectedText), 
    `Expected output to contain "${expectedText}", but got: ${output}`);
});

Then('the output should contain version information', function(this: BasicWorld) {
  const output = this.lastResult?.stdout || '';
  // Check for semantic version pattern (e.g., "0.0.0", "1.2.3")
  assert.ok(/\d+\.\d+\.\d+/.test(output), 
    `Expected version information in output, but got: ${output}`);
});