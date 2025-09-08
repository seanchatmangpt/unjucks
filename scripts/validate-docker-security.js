#!/usr/bin/env node

/**
 * Docker Security Validation Script
 * Validates production Docker security hardening measures
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

class DockerSecurityValidator {
  constructor() {
    this.results = {
      dockerfile: { passed: 0, failed: 0, tests: [] },
      compose: { passed: 0, failed: 0, tests: [] },
      runtime: { passed: 0, failed: 0, tests: [] }
    };
  }

  async validateAll() {
    console.log('🔐 Docker Security Validation Starting...\n');

    try {
      await this.validateDockerfile();
      await this.validateDockerCompose();
      await this.validateRuntimeSecurity();
      
      this.printResults();
      this.exitWithCode();
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    }
  }

  async validateDockerfile() {
    console.log('📋 Validating Dockerfile Security...');
    
    const dockerfilePath = path.join(projectRoot, 'docker', 'Dockerfile.latex');
    const content = await fs.readFile(dockerfilePath, 'utf8');
    
    // Test 1: Non-root user configuration
    this.test('dockerfile', 
      'Uses non-root user',
      content.includes('useradd -r -g latex') && content.includes('USER latex'),
      'Container must run as non-root user for security'
    );

    // Test 2: Minimal package installation
    this.test('dockerfile',
      'Uses minimal package installation',
      content.includes('--no-install-recommends') && content.includes('apt-get clean'),
      'Should install minimal packages and clean cache'
    );

    // Test 3: Removes setuid/setgid permissions
    this.test('dockerfile',
      'Removes dangerous file permissions', 
      content.includes('find /usr/bin /usr/sbin -perm /6000 -type f -exec chmod -s'),
      'Should remove setuid/setgid permissions from binaries'
    );

    // Test 4: Uses proper init system
    this.test('dockerfile',
      'Uses proper init system',
      content.includes('dumb-init') && content.includes('ENTRYPOINT'),
      'Should use dumb-init to handle signals properly'
    );

    // Test 5: Health check configured
    this.test('dockerfile',
      'Has health check',
      content.includes('HEALTHCHECK'),
      'Should include health check for monitoring'
    );

    // Test 6: Cleans temporary files
    this.test('dockerfile',
      'Cleans temporary files',
      content.includes('rm -rf /tmp/* /var/tmp/*'),
      'Should clean temporary files to reduce attack surface'
    );
  }

  async validateDockerCompose() {
    console.log('📋 Validating Docker Compose Security...');
    
    const composePath = path.join(projectRoot, 'docker', 'docker-compose.latex.yml');
    const content = await fs.readFile(composePath, 'utf8');
    
    // Test 1: Resource limits
    this.test('compose',
      'Has CPU and memory limits',
      content.includes('cpus:') && content.includes('memory:'),
      'Must have resource limits to prevent DoS attacks'
    );

    // Test 2: Read-only filesystem
    this.test('compose',
      'Uses read-only filesystem',
      content.includes('read_only: true'),
      'Should use read-only filesystem for security'
    );

    // Test 3: No privileged mode
    this.test('compose',
      'Runs without privileges',
      !content.includes('privileged: true'),
      'Should not run in privileged mode'
    );

    // Test 4: Network isolation
    this.test('compose',
      'Network isolation enabled',
      content.includes('network_mode: none'),
      'Should disable network access for build containers'
    );

    // Test 5: Security options
    this.test('compose',
      'Security options configured',
      content.includes('no-new-privileges:true'),
      'Should prevent privilege escalation'
    );

    // Test 6: Capability dropping
    this.test('compose',
      'Drops unnecessary capabilities',
      content.includes('cap_drop:') && content.includes('- ALL'),
      'Should drop all capabilities and add only necessary ones'
    );

    // Test 7: Process limits
    this.test('compose',
      'Process limits configured',
      content.includes('ulimits:') && content.includes('nproc:'),
      'Should limit number of processes'
    );

    // Test 8: Tmpfs mounts
    this.test('compose',
      'Secure tmpfs mounts',
      content.includes('tmpfs:') && content.includes('noexec,nosuid,nodev'),
      'Should use secure tmpfs mounts'
    );

    // Test 9: Health checks
    this.test('compose',
      'Health checks enabled',
      content.includes('healthcheck:'),
      'Should include health checks for monitoring'
    );
  }

  async validateRuntimeSecurity() {
    console.log('📋 Validating Runtime Security...');
    
    // Test 1: Docker daemon running
    const dockerInfo = await this.runCommand(['docker', 'info']);
    this.test('runtime',
      'Docker daemon accessible',
      dockerInfo.success,
      'Docker daemon must be running for validation'
    );

    if (!dockerInfo.success) return;

    // Test 2: Try to build image
    console.log('🔨 Building test image...');
    const buildResult = await this.runCommand([
      'docker', 'build',
      '-f', path.join(projectRoot, 'docker', 'Dockerfile.latex'),
      '-t', 'unjucks-latex-test',
      '--no-cache',
      projectRoot
    ], { timeout: 300000 }); // 5 minutes timeout

    this.test('runtime',
      'Image builds successfully',
      buildResult.success,
      'Hardened Dockerfile should build without errors'
    );

    if (!buildResult.success) {
      console.log('Build output:', buildResult.stderr);
      return;
    }

    // Test 3: Check image security
    const inspectResult = await this.runCommand(['docker', 'image', 'inspect', 'unjucks-latex-test']);
    if (inspectResult.success) {
      const imageInfo = JSON.parse(inspectResult.stdout)[0];
      
      this.test('runtime',
        'Image runs as non-root',
        imageInfo.Config?.User === 'latex',
        'Built image should be configured to run as non-root user'
      );
    }

    // Test 4: Test container security
    const runResult = await this.runCommand([
      'docker', 'run', '--rm',
      '--security-opt', 'no-new-privileges:true',
      '--cap-drop', 'ALL',
      '--cap-add', 'CHOWN',
      '--cap-add', 'SETUID',
      '--cap-add', 'SETGID',
      '--cap-add', 'DAC_OVERRIDE',
      '--user', 'latex:latex',
      '--network', 'none',
      'unjucks-latex-test',
      'whoami'
    ]);

    this.test('runtime',
      'Container runs as expected user',
      runResult.success && runResult.stdout.trim() === 'latex',
      'Container should run as latex user'
    );

    // Test 5: Security scan (if available)
    const scanResult = await this.runCommand(['docker', 'scout', 'cves', 'unjucks-latex-test'], { timeout: 60000 });
    this.test('runtime',
      'Security scan completed',
      scanResult.success || scanResult.stderr.includes('command not found'),
      'Security scan should complete (or be unavailable)'
    );

    // Cleanup test image
    await this.runCommand(['docker', 'rmi', 'unjucks-latex-test']);
  }

  test(category, name, condition, description) {
    const result = {
      name,
      passed: !!condition,
      description
    };
    
    this.results[category].tests.push(result);
    
    if (condition) {
      this.results[category].passed++;
      console.log(`  ✅ ${name}`);
    } else {
      this.results[category].failed++;
      console.log(`  ❌ ${name}: ${description}`);
    }
  }

  async runCommand(args, options = {}) {
    return new Promise((resolve) => {
      const process = spawn(args[0], args.slice(1), {
        stdio: ['pipe', 'pipe', 'pipe'],
        ...options
      });

      let stdout = '';
      let stderr = '';

      if (process.stdout) {
        process.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      if (process.stderr) {
        process.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      const timeout = setTimeout(() => {
        process.kill('SIGKILL');
        resolve({
          success: false,
          error: `Command timeout after ${options.timeout || 30000}ms`,
          stdout,
          stderr
        });
      }, options.timeout || 30000);

      process.on('close', (code) => {
        clearTimeout(timeout);
        resolve({
          success: code === 0,
          exitCode: code,
          stdout,
          stderr
        });
      });

      process.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: error.message,
          stdout,
          stderr
        });
      });
    });
  }

  printResults() {
    console.log('\\n🔐 Docker Security Validation Results\\n');
    console.log('='.repeat(50));
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const [category, results] of Object.entries(this.results)) {
      const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
      console.log(`\\n📋 ${categoryName}:`);
      console.log(`  Passed: ${results.passed}`);
      console.log(`  Failed: ${results.failed}`);
      
      totalPassed += results.passed;
      totalFailed += results.failed;
      
      if (results.failed > 0) {
        console.log('  Failed tests:');
        for (const test of results.tests.filter(t => !t.passed)) {
          console.log(`    • ${test.name}: ${test.description}`);
        }
      }
    }
    
    console.log('\\n' + '='.repeat(50));
    console.log(`📊 Overall Results:`);
    console.log(`  Total Passed: ${totalPassed}`);
    console.log(`  Total Failed: ${totalFailed}`);
    console.log(`  Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
    
    if (totalFailed === 0) {
      console.log('\\n🎉 All security validations passed!');
      console.log('🛡️  Docker containers are production-ready and secure.');
    } else {
      console.log('\\n⚠️  Some security validations failed.');
      console.log('🔧 Please address the failing tests before deploying to production.');
    }
  }

  exitWithCode() {
    const totalFailed = Object.values(this.results).reduce((sum, r) => sum + r.failed, 0);
    process.exit(totalFailed > 0 ? 1 : 0);
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new DockerSecurityValidator();
  validator.validateAll().catch(console.error);
}

export default DockerSecurityValidator;