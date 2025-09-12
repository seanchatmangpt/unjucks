const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

describe('Error Handler Action', () => {
  const actionPath = path.join(__dirname, '../../.github/actions/error-handler');
  const testDir = path.join(__dirname, 'temp');
  
  before(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Set required environment variables
    process.env.GITHUB_WORKFLOW = 'Test Workflow';
    process.env.GITHUB_JOB = 'test-job';
    process.env.GITHUB_RUN_ID = '123456789';
    process.env.GITHUB_REPOSITORY = 'test/repo';
    process.env.GITHUB_OUTPUT = path.join(testDir, 'github-output.txt');
    
    // Ensure output file exists
    fs.writeFileSync(process.env.GITHUB_OUTPUT, '');
  });
  
  after(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  beforeEach(() => {
    // Clear output file before each test
    fs.writeFileSync(process.env.GITHUB_OUTPUT, '');
  });

  describe('Basic Functionality', () => {
    it('should execute successful commands', async () => {
      const result = await runErrorHandler({
        command: 'echo "Hello World"',
        maxRetries: 1,
        retryDelay: 1,
        errorClassification: 'info'
      });
      
      expect(result.exitCode).to.equal(0);
      
      const outputs = parseGitHubOutputs();
      expect(outputs.success).to.equal('true');
      expect(outputs['exit-code']).to.equal('0');
      expect(outputs.attempts).to.equal('1');
      expect(outputs['error-type']).to.equal('success');
    });
    
    it('should handle command failures', async () => {
      const result = await runErrorHandler({
        command: 'exit 1',
        maxRetries: 1,
        retryDelay: 1,
        errorClassification: 'warning'
      });
      
      expect(result.exitCode).to.equal(1);
      
      const outputs = parseGitHubOutputs();
      expect(outputs.success).to.equal('false');
      expect(outputs['exit-code']).to.equal('1');
      expect(outputs.attempts).to.equal('1');
      expect(outputs['error-type']).to.equal('general_error');
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed commands', async () => {
      // Create a script that fails twice then succeeds
      const scriptPath = path.join(testDir, 'retry-test.sh');
      fs.writeFileSync(scriptPath, `#!/bin/bash
counter_file="${testDir}/counter"
if [ ! -f "$counter_file" ]; then
  echo "1" > "$counter_file"
  exit 1
elif [ "$(cat "$counter_file")" = "1" ]; then
  echo "2" > "$counter_file"
  exit 1
else
  echo "success"
  exit 0
fi`);
      fs.chmodSync(scriptPath, '755');
      
      const result = await runErrorHandler({
        command: `bash ${scriptPath}`,
        maxRetries: 3,
        retryDelay: 1,
        exponentialBackoff: false,
        errorClassification: 'warning'
      });
      
      expect(result.exitCode).to.equal(0);
      
      const outputs = parseGitHubOutputs();
      expect(outputs.success).to.equal('true');
      expect(outputs.attempts).to.equal('3');
    });
    
    it('should respect max retry limit', async () => {
      const result = await runErrorHandler({
        command: 'exit 1',
        maxRetries: 2,
        retryDelay: 1,
        errorClassification: 'warning'
      });
      
      expect(result.exitCode).to.equal(1);
      
      const outputs = parseGitHubOutputs();
      expect(outputs.success).to.equal('false');
      expect(outputs.attempts).to.equal('2');
    });
    
    it('should implement exponential backoff', async () => {
      const startTime = this.getDeterministicTimestamp();
      
      await runErrorHandler({
        command: 'exit 1',
        maxRetries: 3,
        retryDelay: 1,
        exponentialBackoff: true,
        errorClassification: 'warning'
      });
      
      const endTime = this.getDeterministicTimestamp();
      const duration = endTime - startTime;
      
      // With exponential backoff: 1s + 2s + 4s = 7s minimum
      // Adding some tolerance for execution overhead
      expect(duration).to.be.at.least(6000);
    });
  });

  describe('Error Classification', () => {
    const testCases = [
      { command: 'bash -c "echo error >&2; exit 127"', expectedType: 'command_not_found' },
      { command: 'bash -c "echo permission denied >&2; exit 126"', expectedType: 'permission_error' },
      { command: 'bash -c "echo network timeout >&2; exit 1"', expectedType: 'network_error' },
      { command: 'bash -c "echo authentication failed >&2; exit 1"', expectedType: 'authentication_error' },
      { command: 'bash -c "echo rate limit exceeded >&2; exit 1"', expectedType: 'rate_limit_error' },
      { command: 'bash -c "echo out of memory >&2; exit 1"', expectedType: 'memory_error' },
      { command: 'bash -c "echo disk full >&2; exit 1"', expectedType: 'disk_space_error' }
    ];
    
    testCases.forEach(({ command, expectedType }) => {
      it(`should classify ${expectedType} correctly`, async () => {
        await runErrorHandler({
          command,
          maxRetries: 1,
          retryDelay: 1,
          errorClassification: 'warning'
        });
        
        const outputs = parseGitHubOutputs();
        expect(outputs['error-type']).to.equal(expectedType);
      });
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running commands', async () => {
      const startTime = this.getDeterministicTimestamp();
      
      const result = await runErrorHandler({
        command: 'sleep 10',
        maxRetries: 1,
        retryDelay: 1,
        timeout: 0.1, // 0.1 minutes = 6 seconds
        errorClassification: 'warning'
      });
      
      const endTime = this.getDeterministicTimestamp();
      const duration = endTime - startTime;
      
      // Should timeout in approximately 6 seconds
      expect(duration).to.be.lessThan(8000);
      expect(result.exitCode).to.not.equal(0);
    });
  });

  describe('Diagnostic Collection', () => {
    it('should collect diagnostics on failure', async () => {
      await runErrorHandler({
        command: 'exit 1',
        maxRetries: 1,
        retryDelay: 1,
        collectDiagnostics: true,
        errorClassification: 'warning'
      });
      
      const outputs = parseGitHubOutputs();
      expect(outputs.diagnostics).to.exist;
      expect(outputs.diagnostics).to.not.be.empty;
      
      // Decode and verify diagnostics content
      const diagnostics = Buffer.from(outputs.diagnostics, 'base64').toString();
      expect(diagnostics).to.include('System Information');
      expect(diagnostics).to.include('Environment Variables');
      expect(diagnostics).to.include('Process Information');
    });
    
    it('should skip diagnostics when disabled', async () => {
      await runErrorHandler({
        command: 'exit 1',
        maxRetries: 1,
        retryDelay: 1,
        collectDiagnostics: false,
        errorClassification: 'warning'
      });
      
      const outputs = parseGitHubOutputs();
      expect(outputs.diagnostics).to.equal('');
    });
  });

  describe('Graceful Degradation', () => {
    it('should succeed with graceful degradation enabled', async () => {
      const result = await runErrorHandler({
        command: 'exit 1',
        maxRetries: 1,
        retryDelay: 1,
        gracefulDegradation: true,
        errorClassification: 'warning', // Non-critical
      });
      
      expect(result.exitCode).to.equal(0);
      
      const outputs = parseGitHubOutputs();
      expect(outputs.success).to.equal('true');
      expect(outputs['recovery-action']).to.equal('graceful_degradation');
    });
    
    it('should not degrade critical errors', async () => {
      const result = await runErrorHandler({
        command: 'exit 1',
        maxRetries: 1,
        retryDelay: 1,
        gracefulDegradation: true,
        errorClassification: 'critical',
      });
      
      expect(result.exitCode).to.equal(1);
      
      const outputs = parseGitHubOutputs();
      expect(outputs.success).to.equal('false');
    });
  });

  describe('Recovery Strategies', () => {
    it('should handle skip recovery strategy', async () => {
      const result = await runErrorHandler({
        command: 'exit 1',
        maxRetries: 1,
        retryDelay: 1,
        recoveryStrategy: 'skip',
        errorClassification: 'warning'
      });
      
      expect(result.exitCode).to.equal(0);
      
      const outputs = parseGitHubOutputs();
      expect(outputs.success).to.equal('true');
      expect(outputs['recovery-action']).to.equal('skip');
    });
    
    it('should handle fail recovery strategy', async () => {
      const result = await runErrorHandler({
        command: 'exit 1',
        maxRetries: 3,
        retryDelay: 1,
        recoveryStrategy: 'fail',
        errorClassification: 'warning'
      });
      
      expect(result.exitCode).to.equal(1);
      
      const outputs = parseGitHubOutputs();
      expect(outputs.success).to.equal('false');
      expect(outputs.attempts).to.equal('1'); // Should fail fast
      expect(outputs['recovery-action']).to.equal('fail');
    });
  });

  describe('Environment Variables', () => {
    it('should set environment variables from input', async () => {
      const result = await runErrorHandler({
        command: 'echo "TEST_VAR=$TEST_VAR"',
        maxRetries: 1,
        retryDelay: 1,
        environment: '{"TEST_VAR": "test_value"}',
        errorClassification: 'info'
      });
      
      expect(result.exitCode).to.equal(0);
      expect(result.output).to.include('TEST_VAR=test_value');
    });
  });

  describe('Working Directory', () => {
    it('should execute commands in specified directory', async () => {
      const result = await runErrorHandler({
        command: 'pwd',
        maxRetries: 1,
        retryDelay: 1,
        workingDirectory: testDir,
        errorClassification: 'info'
      });
      
      expect(result.exitCode).to.equal(0);
      expect(result.output.trim()).to.include(testDir);
    });
  });

  // Helper functions
  async function runErrorHandler(options) {
    return new Promise((resolve) => {
      const {
        command,
        maxRetries = 3,
        retryDelay = 5,
        exponentialBackoff = true,
        timeout = 30,
        errorClassification = 'warning',
        collectDiagnostics = true,
        gracefulDegradation = false,
        recoveryStrategy = 'retry',
        workingDirectory = testDir,
        environment = '{}'
      } = options;
      
      // Create the error handler script
      const errorHandlerScript = fs.readFileSync(path.join(actionPath, 'action.yml'), 'utf8');
      const scriptMatch = errorHandlerScript.match(/cat > error_handler\.sh << 'EOF'\n([\s\S]*?)\nEOF/);
      
      if (!scriptMatch) {
        throw new Error('Could not extract error handler script from action.yml');
      }
      
      const scriptContent = scriptMatch[1];
      const scriptPath = path.join(testDir, 'error_handler.sh');
      fs.writeFileSync(scriptPath, scriptContent);
      fs.chmodSync(scriptPath, '755');
      
      // Execute the error handler
      const args = [
        command,
        maxRetries.toString(),
        retryDelay.toString(),
        exponentialBackoff.toString(),
        timeout.toString(),
        errorClassification,
        collectDiagnostics.toString(),
        gracefulDegradation.toString(),
        recoveryStrategy,
        workingDirectory,
        environment
      ];
      
      const child = spawn('bash', [scriptPath, ...args], {
        cwd: testDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });
      
      let output = '';
      let errorOutput = '';
      
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      child.on('close', (code) => {
        resolve({
          exitCode: code,
          output: output,
          errorOutput: errorOutput
        });
      });
    });
  }
  
  function parseGitHubOutputs() {
    const outputFile = process.env.GITHUB_OUTPUT;
    if (!fs.existsSync(outputFile)) {
      return {};
    }
    
    const content = fs.readFileSync(outputFile, 'utf8');
    const outputs = {};
    
    content.split('\n').forEach(line => {
      if (line.includes('=')) {
        const [key, value] = line.split('=', 2);
        outputs[key] = value;
      }
    });
    
    return outputs;
  }
});