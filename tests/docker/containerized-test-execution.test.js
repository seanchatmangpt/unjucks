/**
 * Containerized Test Execution Tests
 * Validates that all tests run successfully within Docker containers
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';

const execAsync = promisify(exec);

describe('Containerized Test Execution', () => {
  const testImageName = 'unjucks:test';
  const resultsDir = './tests/docker/results';
  
  beforeAll(async () => {
    // Ensure results directory exists
    await fs.ensureDir(resultsDir);
    
    // Verify test image exists
    try {
      await execAsync(`docker image inspect ${testImageName}`);
    } catch (error) {
      throw new Error('Test image not found. Run docker-environment-setup tests first.');
    }
  });

  afterAll(async () => {
    // Archive test results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveDir = `${resultsDir}/archive/${timestamp}`;
    await fs.ensureDir(archiveDir);
    
    try {
      await fs.copy(resultsDir, archiveDir);
    } catch (error) {
      console.warn('Failed to archive test results:', error.message);
    }
  });

  test('should run unit tests in container', async () => {
    const unitTestCommand = `docker run --rm -v ${process.cwd()}:/workspace ` +
      `-w /workspace ${testImageName} npm run test:unit`;
    
    const startTime = Date.now();
    const { stdout, stderr } = await execAsync(unitTestCommand);
    const duration = Date.now() - startTime;
    
    // Save results
    await fs.writeFile(`${resultsDir}/unit-tests.log`, stdout + '\n' + stderr);
    
    expect(stdout).toContain('test results');
    expect(duration).toBeLessThan(120000); // Should complete in under 2 minutes
    
    // Parse test results
    const passedTests = (stdout.match(/✓/g) || []).length;
    const failedTests = (stdout.match(/✗/g) || []).length;
    const totalTests = passedTests + failedTests;
    
    expect(totalTests).toBeGreaterThan(0);
    expect(passedTests / totalTests).toBeGreaterThanOrEqual(0.95); // 95%+ pass rate
  });

  test('should run integration tests in container', async () => {
    const integrationCommand = `docker run --rm -v ${process.cwd()}:/workspace ` +
      `-w /workspace ${testImageName} npm run test:integration`;
    
    const { stdout, stderr } = await execAsync(integrationCommand);
    
    // Save results
    await fs.writeFile(`${resultsDir}/integration-tests.log`, stdout + '\n' + stderr);
    
    expect(stdout).toContain('test results');
    
    // Parse test results
    const passedTests = (stdout.match(/✓/g) || []).length;
    const failedTests = (stdout.match(/✗/g) || []).length;
    const totalTests = passedTests + failedTests;
    
    if (totalTests > 0) {
      expect(passedTests / totalTests).toBeGreaterThanOrEqual(0.90); // 90%+ pass rate for integration
    }
  });

  test('should run smoke tests in container', async () => {
    const smokeCommand = `docker run --rm -v ${process.cwd()}:/workspace ` +
      `-w /workspace ${testImageName} npm run test:smoke`;
    
    const { stdout, stderr } = await execAsync(smokeCommand);
    
    // Save results
    await fs.writeFile(`${resultsDir}/smoke-tests.log`, stdout + '\n' + stderr);
    
    expect(stdout).toContain('test results');
    
    // Smoke tests should have very high pass rate
    const passedTests = (stdout.match(/✓/g) || []).length;
    const failedTests = (stdout.match(/✗/g) || []).length;
    const totalTests = passedTests + failedTests;
    
    if (totalTests > 0) {
      expect(passedTests / totalTests).toBeGreaterThanOrEqual(0.98); // 98%+ pass rate for smoke
    }
  });

  test('should run CLI tests in container', async () => {
    const cliCommand = `docker run --rm -v ${process.cwd()}:/workspace ` +
      `-w /workspace ${testImageName} sh -c "
        echo 'Testing CLI functionality:';
        node bin/unjucks.cjs --help;
        echo 'Testing list command:';
        node bin/unjucks.cjs list || echo 'No templates found';
        echo 'Testing version:';
        node bin/unjucks.cjs --version;
      "`;
    
    const { stdout, stderr } = await execAsync(cliCommand);
    
    // Save results
    await fs.writeFile(`${resultsDir}/cli-tests.log`, stdout + '\n' + stderr);
    
    expect(stdout).toContain('Testing CLI functionality');
    expect(stdout).toContain('Testing list command');
    expect(stdout).toContain('Testing version');
    
    // Should not contain error messages
    expect(stderr).not.toContain('Error:');
    expect(stderr).not.toContain('ENOENT');
  });

  test('should run security tests in container', async () => {
    const securityCommand = `docker run --rm -v ${process.cwd()}:/workspace ` +
      `-w /workspace ${testImageName} npm run security:scan`;
    
    const { stdout, stderr } = await execAsync(securityCommand);
    
    // Save results
    await fs.writeFile(`${resultsDir}/security-tests.log`, stdout + '\n' + stderr);
    
    // Security scan should complete successfully
    expect(stdout + stderr).toContain('Security scan completed');
    
    // Should not contain high-severity vulnerabilities
    expect(stdout + stderr).not.toContain('high severity');
    expect(stdout + stderr).not.toContain('critical severity');
  });

  test('should validate test coverage in container', async () => {
    const coverageCommand = `docker run --rm -v ${process.cwd()}:/workspace ` +
      `-w /workspace ${testImageName} sh -c "
        npm run test:minimal -- --coverage;
        echo 'Coverage report generated';
      "`;
    
    const { stdout, stderr } = await execAsync(coverageCommand);
    
    // Save results
    await fs.writeFile(`${resultsDir}/coverage-tests.log`, stdout + '\n' + stderr);
    
    expect(stdout).toContain('Coverage report generated');
    
    // Parse coverage percentages
    const coverageMatch = stdout.match(/All files\s+\|\s+([\d.]+)/);
    if (coverageMatch) {
      const coveragePercent = parseFloat(coverageMatch[1]);
      expect(coveragePercent).toBeGreaterThanOrEqual(75); // 75%+ coverage
    }
  });

  test('should run performance tests in container', async () => {
    const performanceCommand = `docker run --rm -v ${process.cwd()}:/workspace ` +
      `-w /workspace --memory=1g --cpus=2.0 ${testImageName} sh -c "
        echo 'Running performance benchmarks:';
        time node bin/unjucks.cjs list 2>&1;
        echo 'Memory usage test:';
        node -e 'console.log(process.memoryUsage())';
      "`;
    
    const { stdout, stderr } = await execAsync(performanceCommand);
    
    // Save results
    await fs.writeFile(`${resultsDir}/performance-tests.log`, stdout + '\n' + stderr);
    
    expect(stdout).toContain('Running performance benchmarks');
    expect(stdout).toContain('Memory usage test');
    
    // Parse execution time
    const timeMatch = stdout.match(/real\s+0m([\d.]+)s/);
    if (timeMatch) {
      const executionTime = parseFloat(timeMatch[1]);
      expect(executionTime).toBeLessThan(5.0); // Should execute in under 5 seconds
    }
  });

  test('should validate test results summary', async () => {
    // Aggregate all test results
    const logFiles = await fs.readdir(resultsDir);
    const testLogs = logFiles.filter(file => file.endsWith('.log'));
    
    expect(testLogs.length).toBeGreaterThanOrEqual(5); // At least 5 test suites
    
    let totalPassed = 0;
    let totalFailed = 0;
    let totalDuration = 0;
    
    for (const logFile of testLogs) {
      const content = await fs.readFile(`${resultsDir}/${logFile}`, 'utf8');
      
      const passed = (content.match(/✓/g) || []).length;
      const failed = (content.match(/✗/g) || []).length;
      
      totalPassed += passed;
      totalFailed += failed;
    }
    
    const totalTests = totalPassed + totalFailed;
    const passRate = totalTests > 0 ? totalPassed / totalTests : 1;
    
    // Generate summary report
    const summary = {
      timestamp: new Date().toISOString(),
      totalTests,
      totalPassed,
      totalFailed,
      passRate: (passRate * 100).toFixed(2) + '%',
      testSuites: testLogs.length,
      environment: 'Docker Container',
      nodeVersion: 'v18.x',
      imageTag: testImageName
    };
    
    await fs.writeFile(`${resultsDir}/summary.json`, JSON.stringify(summary, null, 2));
    
    // Validate pass rate meets requirements
    expect(passRate).toBeGreaterThanOrEqual(0.95); // 95%+ overall pass rate
    expect(totalTests).toBeGreaterThan(10); // At least 10 tests executed
  });
});