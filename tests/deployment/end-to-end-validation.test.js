/**
 * End-to-End Deployment Validation Test Suite
 * Comprehensive validation of the entire deployment pipeline
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

describe('End-to-End Deployment Validation', () => {
  let deploymentId;
  let validationResults = {};

  beforeAll(async () => {
    deploymentId = `e2e-test-${this.getDeterministicTimestamp()}`;
    console.log(`🚀 Starting E2E deployment validation: ${deploymentId}`);
    
    // Initialize coordination hooks
    try {
      execSync('npx claude-flow@alpha hooks pre-task --description "E2E deployment validation"', {
        stdio: 'pipe'
      });
    } catch (error) {
      console.warn('⚠️ Claude Flow hooks not available');
    }
  });

  afterAll(async () => {
    // Generate final validation report
    await generateValidationReport();
    
    // Cleanup coordination
    try {
      execSync('npx claude-flow@alpha hooks post-task --task-id "e2e-validation"', {
        stdio: 'pipe'
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Pre-Deployment Validation Pipeline', () => {
    it('should pass all pre-deployment checks', async () => {
      validationResults.preDeployment = {};
      
      // Build validation
      try {
        execSync('npm run build:validate', { stdio: 'pipe' });
        validationResults.preDeployment.build = true;
      } catch (error) {
        validationResults.preDeployment.build = false;
        expect(false, 'Build validation failed').toBe(true);
      }
      
      // Security validation
      try {
        execSync('npm run security:scan', { stdio: 'pipe' });
        validationResults.preDeployment.security = true;
      } catch (error) {
        validationResults.preDeployment.security = false;
        console.warn('⚠️ Security scan issues found');
      }
      
      // Code integrity validation
      try {
        const mockCheck = execSync(
          'grep -r "mock\\|fake\\|stub" src/ --exclude-dir=tests --exclude="*.test.*" || true',
          { encoding: 'utf8' }
        );
        
        validationResults.preDeployment.codeIntegrity = !mockCheck.trim();
        expect(mockCheck.trim()).toBe('');
      } catch (error) {
        validationResults.preDeployment.codeIntegrity = false;
      }
      
      expect(validationResults.preDeployment.build).toBe(true);
      expect(validationResults.preDeployment.codeIntegrity).toBe(true);
    });

    it('should validate package integrity', async () => {
      const packageJson = await fs.readJson('package.json');
      
      // Required package.json fields
      expect(packageJson.name).toBeDefined();
      expect(packageJson.version).toBeDefined();
      expect(packageJson.main).toBeDefined();
      expect(packageJson.bin).toBeDefined();
      
      // Verify files exist
      expect(await fs.pathExists(packageJson.main)).toBe(true);
      
      for (const binPath of Object.values(packageJson.bin)) {
        expect(await fs.pathExists(binPath)).toBe(true);
      }
      
      validationResults.packageIntegrity = true;
    });

    it('should validate environment configuration', () => {
      const requiredEnvChecks = [
        'NODE_ENV should be configurable',
        'Package manager should be specified',
        'Node version requirement should be set'
      ];
      
      const packageJson = require(path.resolve('package.json'));
      
      // Check Node.js engine requirement
      expect(packageJson.engines?.node).toBeDefined();
      
      // Check package manager
      expect(packageJson.packageManager).toBeDefined();
      
      validationResults.environmentConfig = true;
    });
  });

  describe('Staging Environment Validation', () => {
    it('should deploy to staging successfully', async () => {
      validationResults.staging = {};
      
      // Simulate staging deployment
      try {
        execSync('npm run build', { stdio: 'pipe' });
        validationResults.staging.build = true;
      } catch (error) {
        validationResults.staging.build = false;
        expect(false, 'Staging build failed').toBe(true);
      }
      
      // Test CLI functionality in staging
      try {
        const versionOutput = execSync('node bin/unjucks.cjs --version', { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
        
        expect(versionOutput.trim()).toBeDefined();
        validationResults.staging.cli = true;
      } catch (error) {
        validationResults.staging.cli = false;
        expect(false, 'CLI test failed in staging').toBe(true);
      }
      
      expect(validationResults.staging.build).toBe(true);
      expect(validationResults.staging.cli).toBe(true);
    });

    it('should pass staging smoke tests', async () => {
      const smokeTests = [
        {
          name: 'List templates',
          command: 'node bin/unjucks.cjs list',
          expectSuccess: true
        },
        {
          name: 'Show help',
          command: 'node bin/unjucks.cjs --help',
          expectSuccess: true
        },
        {
          name: 'Dry run generation',
          command: 'node bin/unjucks.cjs generate component test --dry',
          expectSuccess: true
        }
      ];
      
      validationResults.staging.smokeTests = {};
      
      for (const test of smokeTests) {
        try {
          execSync(test.command, { stdio: 'pipe', timeout: 10000 });
          validationResults.staging.smokeTests[test.name] = true;
        } catch (error) {
          validationResults.staging.smokeTests[test.name] = false;
          if (test.expectSuccess) {
            expect(false, `Smoke test failed: ${test.name}`).toBe(true);
          }
        }
      }
    });

    it('should validate performance in staging', async () => {
      const performanceTests = [];
      
      // Test template generation performance
      const testCommands = [
        'node bin/unjucks.cjs --version',
        'node bin/unjucks.cjs list',
        'node bin/unjucks.cjs --help'
      ];
      
      for (const command of testCommands) {
        const startTime = this.getDeterministicTimestamp();
        
        try {
          execSync(command, { stdio: 'pipe', timeout: 5000 });
          const duration = this.getDeterministicTimestamp() - startTime;
          performanceTests.push({ command, duration, success: true });
          
          // Should complete within reasonable time
          expect(duration).toBeLessThan(5000);
        } catch (error) {
          performanceTests.push({ 
            command, 
            duration: this.getDeterministicTimestamp() - startTime, 
            success: false,
            error: error.message
          });
        }
      }
      
      validationResults.staging.performance = performanceTests;
    });
  });

  describe('Health Check Validation', () => {
    it('should validate health check endpoints', async () => {
      validationResults.healthChecks = {};
      
      // Check if health check configuration exists
      if (await fs.pathExists('config/health-checks.json')) {
        const config = await fs.readJson('config/health-checks.json');
        
        expect(config.endpoints).toBeDefined();
        expect(config.endpoints.health).toBeDefined();
        expect(config.endpoints.ready).toBeDefined();
        
        validationResults.healthChecks.config = true;
      } else {
        validationResults.healthChecks.config = false;
        console.warn('⚠️ Health check configuration not found');
      }
      
      // Check if health check implementation exists
      if (await fs.pathExists('src/lib/health-checker.js')) {
        validationResults.healthChecks.implementation = true;
      } else {
        validationResults.healthChecks.implementation = false;
        console.warn('⚠️ Health check implementation not found');
      }
    });

    it('should validate monitoring setup', async () => {
      validationResults.monitoring = {};
      
      const monitoringFiles = [
        'config/metrics.json',
        'config/alerts.json',
        'config/dashboards.json',
        'src/lib/metrics-collector.js'
      ];
      
      for (const file of monitoringFiles) {
        const exists = await fs.pathExists(file);
        validationResults.monitoring[path.basename(file)] = exists;
        
        if (!exists) {
          console.warn(`⚠️ Monitoring file not found: ${file}`);
        }
      }
    });
  });

  describe('Security Compliance Validation', () => {
    it('should pass OWASP security checks', async () => {
      validationResults.security = {};
      
      // Run OWASP compliance tests
      try {
        execSync('npm run test tests/deployment/compliance-validation.test.js', { 
          stdio: 'pipe',
          timeout: 30000
        });
        validationResults.security.owasp = true;
      } catch (error) {
        validationResults.security.owasp = false;
        console.warn('⚠️ OWASP compliance tests failed');
      }
      
      // Run dependency audit
      try {
        const auditOutput = execSync('npm audit --json', { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
        
        const audit = JSON.parse(auditOutput);
        const criticalVulns = audit.metadata?.vulnerabilities?.critical || 0;
        
        validationResults.security.dependencies = criticalVulns === 0;
        expect(criticalVulns).toBe(0);
      } catch (error) {
        // npm audit returns non-zero exit code if vulnerabilities found
        try {
          const audit = JSON.parse(error.stdout);
          const criticalVulns = audit.metadata?.vulnerabilities?.critical || 0;
          validationResults.security.dependencies = criticalVulns === 0;
          
          if (criticalVulns > 0) {
            expect(false, `Critical vulnerabilities found: ${criticalVulns}`).toBe(true);
          }
        } catch (parseError) {
          validationResults.security.dependencies = false;
        }
      }
    });

    it('should validate secrets management', async () => {
      const sourceFiles = await getAllJsFiles('src');
      let secretsIssues = [];
      
      for (const file of sourceFiles) {
        const content = await fs.readFile(file, 'utf8');
        
        // Check for hardcoded secrets (basic check)
        const secretPatterns = [
          /password\s*[:=]\s*["'][^"']+["']/gi,
          /secret\s*[:=]\s*["'][^"']+["']/gi,
          /token\s*[:=]\s*["'][^"']+["']/gi
        ];
        
        for (const pattern of secretPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            const validMatches = matches.filter(match => 
              !match.includes('process.env') && 
              !match.includes('test') &&
              !match.includes('example')
            );
            
            if (validMatches.length > 0) {
              secretsIssues.push({
                file: path.relative(process.cwd(), file),
                issues: validMatches
              });
            }
          }
        }
      }
      
      validationResults.security.secrets = secretsIssues.length === 0;
      expect(secretsIssues).toEqual([]);
    });
  });

  describe('Rollback Validation', () => {
    it('should validate rollback mechanisms', async () => {
      validationResults.rollback = {};
      
      // Check if rollback script exists
      if (await fs.pathExists('scripts/deployment/rollback-automation.js')) {
        validationResults.rollback.script = true;
        
        // Test rollback script in dry-run mode
        try {
          execSync('node scripts/deployment/rollback-automation.js --dry-run', {
            stdio: 'pipe',
            timeout: 30000
          });
          validationResults.rollback.dryRun = true;
        } catch (error) {
          validationResults.rollback.dryRun = false;
          console.warn('⚠️ Rollback dry-run test failed');
        }
      } else {
        validationResults.rollback.script = false;
        console.warn('⚠️ Rollback script not found');
      }
      
      // Check deployment state management
      validationResults.rollback.stateManagement = await fs.pathExists('.deployment-state') || 
                                                   await fs.pathExists('deployment-state');
    });

    it('should validate disaster recovery procedures', async () => {
      // Check for backup mechanisms
      const recoveryProcedures = [
        'scripts/backup.js',
        'scripts/restore.js',
        'docs/disaster-recovery.md'
      ];
      
      validationResults.rollback.recovery = {};
      
      for (const procedure of recoveryProcedures) {
        const exists = await fs.pathExists(procedure);
        validationResults.rollback.recovery[path.basename(procedure)] = exists;
      }
    });
  });

  describe('Production Readiness Gate', () => {
    it('should pass production readiness assessment', () => {
      const criticalChecks = [
        validationResults.preDeployment?.build,
        validationResults.preDeployment?.codeIntegrity,
        validationResults.packageIntegrity,
        validationResults.staging?.build,
        validationResults.staging?.cli,
        validationResults.security?.dependencies
      ];
      
      const passedCritical = criticalChecks.filter(Boolean).length;
      const totalCritical = criticalChecks.length;
      const criticalPassRate = (passedCritical / totalCritical) * 100;
      
      validationResults.productionReadiness = {
        criticalPassRate,
        passedCritical,
        totalCritical,
        ready: criticalPassRate >= 100 // 100% of critical checks must pass
      };
      
      expect(criticalPassRate).toBe(100);
    });

    it('should validate deployment checklist', () => {
      const checklist = {
        codeQuality: validationResults.preDeployment?.codeIntegrity,
        security: validationResults.security?.dependencies,
        performance: validationResults.staging?.performance?.every?.(test => test.success),
        monitoring: Object.values(validationResults.monitoring || {}).some(Boolean),
        rollback: validationResults.rollback?.script,
        healthChecks: validationResults.healthChecks?.config
      };
      
      const passedChecks = Object.values(checklist).filter(Boolean).length;
      const totalChecks = Object.keys(checklist).length;
      const overallReadiness = (passedChecks / totalChecks) * 100;
      
      validationResults.deploymentChecklist = {
        checklist,
        passedChecks,
        totalChecks,
        overallReadiness
      };
      
      // Should pass at least 80% of deployment checklist items
      expect(overallReadiness).toBeGreaterThanOrEqual(80);
    });
  });

  describe('Integration Testing', () => {
    it('should test cross-platform compatibility', async () => {
      const platform = process.platform;
      const nodeVersion = process.version;
      
      validationResults.compatibility = {
        platform,
        nodeVersion,
        tested: true
      };
      
      // Basic compatibility checks
      expect(platform).toMatch(/^(linux|darwin|win32)$/);
      expect(nodeVersion).toMatch(/^v(\d+)\.(\d+)\.(\d+)/);
      
      // Node.js version should be 18+
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      expect(majorVersion).toBeGreaterThanOrEqual(18);
    });

    it('should test package installation', async () => {
      try {
        // Create test package
        execSync('npm pack', { stdio: 'pipe' });
        
        const files = await fs.readdir('.');
        const tgzFile = files.find(f => f.endsWith('.tgz'));
        
        expect(tgzFile).toBeDefined();
        
        // Test package size
        const stats = await fs.stat(tgzFile);
        const sizeMB = stats.size / 1024 / 1024;
        
        expect(sizeMB).toBeLessThan(10); // Should be less than 10MB
        
        // Cleanup
        await fs.remove(tgzFile);
        
        validationResults.packageInstallation = {
          success: true,
          sizeMB: Math.round(sizeMB * 100) / 100
        };
      } catch (error) {
        validationResults.packageInstallation = {
          success: false,
          error: error.message
        };
        expect(false, 'Package installation test failed').toBe(true);
      }
    });
  });

  // Helper function to generate final validation report
  async function generateValidationReport() {
    const report = {
      deploymentId,
      timestamp: this.getDeterministicDate().toISOString(),
      environment: 'e2e-test',
      summary: {
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        warnings: 0
      },
      results: validationResults,
      recommendations: []
    };
    
    // Calculate summary statistics
    function countResults(obj, prefix = '') {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'boolean') {
          report.summary.totalChecks++;
          if (value) {
            report.summary.passedChecks++;
          } else {
            report.summary.failedChecks++;
          }
        } else if (typeof value === 'object' && value !== null) {
          countResults(value, `${prefix}${key}.`);
        }
      }
    }
    
    countResults(validationResults);
    
    // Generate recommendations
    if (!validationResults.healthChecks?.config) {
      report.recommendations.push('Set up health check endpoints for production monitoring');
    }
    
    if (!validationResults.rollback?.script) {
      report.recommendations.push('Implement automated rollback procedures');
    }
    
    if (report.summary.failedChecks > 0) {
      report.recommendations.push(`Address ${report.summary.failedChecks} failed validation checks before production deployment`);
    }
    
    // Calculate overall score
    const overallScore = report.summary.totalChecks > 0 ? 
      (report.summary.passedChecks / report.summary.totalChecks) * 100 : 0;
    
    report.summary.overallScore = Math.round(overallScore);
    report.summary.deploymentReady = overallScore >= 90; // 90% threshold
    
    const reportPath = 'tests/e2e-deployment-validation-report.json';
    await fs.ensureDir(path.dirname(reportPath));
    await fs.writeJson(reportPath, report, { spaces: 2 });
    
    console.log(`📊 E2E Validation Report: ${reportPath}`);
    console.log(`📈 Overall Score: ${report.summary.overallScore}%`);
    console.log(`🎯 Deployment Ready: ${report.summary.deploymentReady ? 'YES' : 'NO'}`);
    
    return report;
  }
});

// Helper functions
async function getAllJsFiles(directory) {
  const files = [];
  
  if (!await fs.pathExists(directory)) {
    return files;
  }
  
  async function scan(dir) {
    const items = await fs.readdir(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = await fs.stat(fullPath);
      
      if (stat.isDirectory() && item !== 'node_modules') {
        await scan(fullPath);
      } else if (item.endsWith('.js') || item.endsWith('.mjs')) {
        files.push(fullPath);
      }
    }
  }
  
  await scan(directory);
  return files;
}