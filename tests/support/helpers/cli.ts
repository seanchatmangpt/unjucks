import * as path from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

export interface CLITestResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  command: string;
  args: string[];
}

export interface CLIScenario {
  name: string;
  command: string;
  args: string[];
  expectedExitCode: number;
  expectedOutput?: string;
  expectedError?: string;
  shouldContain?: string[];
  shouldNotContain?: string[];
  timeout?: number;
  setupFiles?: { path: string; content: string }[];
  workingDir?: string;
}

export class CLITestHelper {
  private static readonly CLI_PATH = path.resolve(process.cwd(), 'dist/cli.mjs');
  private static readonly DEFAULT_TIMEOUT = 30000;

  /**
   * Execute CLI command with comprehensive result tracking
   */
  static async executeCommand(
    args: string[],
    options: {
      cwd?: string;
      timeout?: number;
      env?: NodeJS.ProcessEnv;
      input?: string;
    } = {}
  ): Promise<CLITestResult> {
    const startTime = performance.now();
    const command = 'node';
    const fullArgs = [this.CLI_PATH, ...args];
    const workingDir = options.cwd || process.cwd();
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;

    try {
      const result = execSync(`"${command}" ${fullArgs.map(arg => `"${arg}"`).join(' ')}`, {
        cwd: workingDir,
        timeout,
        encoding: 'utf8',
        env: { ...process.env, NODE_ENV: 'test', ...options.env },
        maxBuffer: 1024 * 1024 // 1MB buffer
      });

      return {
        exitCode: 0,
        stdout: result.toString(),
        stderr: '',
        duration: performance.now() - startTime,
        command,
        args: fullArgs
      };
    } catch (error: any) {
      return {
        exitCode: error.status || 1,
        stdout: error.stdout ? error.stdout.toString() : '',
        stderr: error.stderr ? error.stderr.toString() : error.message || '',
        duration: performance.now() - startTime,
        command,
        args: fullArgs
      };
    }
  }

  /**
   * Execute CLI command with streaming output (for long-running commands)
   */
  static async executeStreamingCommand(
    args: string[],
    options: {
      cwd?: string;
      timeout?: number;
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
      input?: string;
    } = {}
  ): Promise<CLITestResult> {
    const startTime = performance.now();
    const command = 'node';
    const fullArgs = [this.CLI_PATH, ...args];
    const workingDir = options.cwd || process.cwd();
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let exitCode = 0;

      const child = spawn(command, fullArgs, {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' }
      });

      // Set up timeout
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        exitCode = 124; // Standard timeout exit code
      }, timeout);

      child.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        options.onStdout?.(chunk);
      });

      child.stderr?.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        options.onStderr?.(chunk);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        exitCode = code || 0;
        resolve({
          exitCode,
          stdout,
          stderr,
          duration: performance.now() - startTime,
          command,
          args: fullArgs
        });
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        resolve({
          exitCode: 1,
          stdout,
          stderr: stderr + error.message,
          duration: performance.now() - startTime,
          command,
          args: fullArgs
        });
      });

      // Send input if provided
      if (options.input) {
        child.stdin?.write(options.input);
        child.stdin?.end();
      }
    });
  }

  /**
   * Run a complete CLI test scenario
   */
  static async runScenario(scenario: CLIScenario, baseDir: string): Promise<{
    passed: boolean;
    result: CLITestResult;
    errors: string[];
  }> {
    const errors: string[] = [];
    const workingDir = scenario.workingDir ? path.join(baseDir, scenario.workingDir) : baseDir;

    // Setup files if needed
    if (scenario.setupFiles) {
      const fs = await import('fs-extra');
      for (const file of scenario.setupFiles) {
        const filePath = path.join(workingDir, file.path);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, file.content);
      }
    }

    // Execute command
    const result = await this.executeCommand(scenario.args, {
      cwd: workingDir,
      timeout: scenario.timeout
    });

    // Validate exit code
    if (result.exitCode !== scenario.expectedExitCode) {
      errors.push(
        `Expected exit code ${scenario.expectedExitCode}, got ${result.exitCode}`
      );
    }

    // Validate expected output
    if (scenario.expectedOutput && !result.stdout.includes(scenario.expectedOutput)) {
      errors.push(
        `Expected output "${scenario.expectedOutput}" not found in stdout: "${result.stdout}"`
      );
    }

    // Validate expected error
    if (scenario.expectedError && !result.stderr.includes(scenario.expectedError)) {
      errors.push(
        `Expected error "${scenario.expectedError}" not found in stderr: "${result.stderr}"`
      );
    }

    // Validate content that should be present
    if (scenario.shouldContain) {
      for (const content of scenario.shouldContain) {
        if (!result.stdout.includes(content) && !result.stderr.includes(content)) {
          errors.push(`Expected content "${content}" not found in output`);
        }
      }
    }

    // Validate content that should not be present
    if (scenario.shouldNotContain) {
      for (const content of scenario.shouldNotContain) {
        if (result.stdout.includes(content) || result.stderr.includes(content)) {
          errors.push(`Unexpected content "${content}" found in output`);
        }
      }
    }

    return {
      passed: errors.length === 0,
      result,
      errors
    };
  }

  /**
   * Generate standard CLI test scenarios
   */
  static getStandardScenarios(): CLIScenario[] {
    return [
      {
        name: 'Help command',
        command: 'unjucks',
        args: ['--help'],
        expectedExitCode: 0,
        shouldContain: ['Usage:', 'Commands:', 'Options:']
      },
      {
        name: 'Version command',
        command: 'unjucks',
        args: ['--version'],
        expectedExitCode: 0,
        shouldContain: ['unjucks']
      },
      {
        name: 'List generators - no templates dir',
        command: 'unjucks',
        args: ['list'],
        expectedExitCode: 1,
        shouldContain: ['No generators found', '_templates']
      },
      {
        name: 'List generators - empty templates dir',
        command: 'unjucks',
        args: ['list'],
        expectedExitCode: 0,
        setupFiles: [{ path: '_templates/.gitkeep', content: '' }],
        shouldContain: ['No generators found']
      },
      {
        name: 'Generate - missing generator name',
        command: 'unjucks',
        args: ['generate'],
        expectedExitCode: 1,
        shouldContain: ['Generator name is required']
      },
      {
        name: 'Generate - non-existent generator',
        command: 'unjucks',
        args: ['generate', 'nonexistent'],
        expectedExitCode: 1,
        setupFiles: [{ path: '_templates/.gitkeep', content: '' }],
        shouldContain: ['Generator "nonexistent" not found']
      },
      {
        name: 'Dry run mode',
        command: 'unjucks',
        args: ['generate', 'test', '--dry-run'],
        expectedExitCode: 0,
        setupFiles: [
          {
            path: '_templates/test/new.txt.ejs',
            content: '---\nto: output.txt\n---\nHello {{ name }}!'
          }
        ],
        shouldContain: ['[DRY RUN]', 'would create']
      },
      {
        name: 'Force flag',
        command: 'unjucks',
        args: ['generate', 'test', '--name=World', '--force'],
        expectedExitCode: 0,
        setupFiles: [
          {
            path: '_templates/test/new.txt.ejs',
            content: '---\nto: output.txt\n---\nHello {{ name }}!'
          },
          { path: 'output.txt', content: 'Existing content' }
        ]
      },
      {
        name: 'Invalid template syntax',
        command: 'unjucks',
        args: ['generate', 'broken', '--name=Test'],
        expectedExitCode: 1,
        setupFiles: [
          {
            path: '_templates/broken/new.txt.ejs',
            content: '---\nto: output.txt\n---\nHello {{ unclosedTag'
          }
        ],
        shouldContain: ['Template error', 'syntax']
      },
      {
        name: 'Interactive mode simulation',
        command: 'unjucks',
        args: ['generate', 'interactive'],
        expectedExitCode: 0,
        setupFiles: [
          {
            path: '_templates/interactive/new.txt.ejs',
            content: '---\nto: {{ filename }}.txt\nvariables:\n  filename:\n    type: string\n    required: true\n---\nContent: {{ filename }}'
          }
        ],
        shouldContain: ['Enter value for', 'filename']
      }
    ];
  }

  /**
   * Run performance benchmarks for CLI commands
   */
  static async runPerformanceBenchmarks(
    scenarios: CLIScenario[],
    baseDir: string,
    iterations: number = 5
  ): Promise<{
    scenario: string;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    successRate: number;
  }[]> {
    const results = [];

    for (const scenario of scenarios) {
      const durations: number[] = [];
      let successes = 0;

      for (let i = 0; i < iterations; i++) {
        const { passed, result } = await this.runScenario(scenario, baseDir);
        durations.push(result.duration);
        if (passed) successes++;
      }

      results.push({
        scenario: scenario.name,
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        successRate: (successes / iterations) * 100
      });
    }

    return results;
  }

  /**
   * Create stress test scenarios
   */
  static createStressTestScenarios(): CLIScenario[] {
    return [
      {
        name: 'Large template generation',
        command: 'unjucks',
        args: ['generate', 'large', '--items=1000'],
        expectedExitCode: 0,
        timeout: 60000,
        setupFiles: [
          {
            path: '_templates/large/new.txt.ejs',
            content: [
              '---',
              'to: large-output.txt',
              'variables:',
              '  items:',
              '    type: number',
              '    default: 100',
              '---',
              'Generated {{ items }} items:',
              '{% for i in range(0, items) %}',
              'Item {{ i }}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
              '{% endfor %}'
            ].join('\n')
          }
        ]
      },
      {
        name: 'Multiple concurrent generators',
        command: 'unjucks',
        args: ['generate', 'multi', '--count=50'],
        expectedExitCode: 0,
        timeout: 30000,
        setupFiles: [
          {
            path: '_templates/multi/new.txt.ejs',
            content: [
              '---',
              'to: multi-{{ i }}.txt',
              'variables:',
              '  count:',
              '    type: number',
              '    default: 10',
              '---',
              '{% for i in range(0, count) %}',
              'File {{ i }} content with timestamp {{ "now" | date }}',
              '{% endfor %}'
            ].join('\n')
          }
        ]
      }
    ];
  }

  /**
   * Validate CLI exists and is executable
   */
  static async validateCLIExists(): Promise<{ exists: boolean; executable: boolean; version?: string }> {
    const fs = await import('fs-extra');
    
    const exists = await fs.pathExists(this.CLI_PATH);
    if (!exists) {
      return { exists: false, executable: false };
    }

    try {
      const result = await this.executeCommand(['--version']);
      return {
        exists: true,
        executable: result.exitCode === 0,
        version: result.stdout.trim()
      };
    } catch {
      return { exists: true, executable: false };
    }
  }
}