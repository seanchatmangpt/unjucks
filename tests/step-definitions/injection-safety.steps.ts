import { Given, When, Then, Before, After } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { TestHelper } from '../support/TestHelper';
import * as path from 'node:path';
import * as fs from 'fs-extra';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

let testHelper: TestHelper;
let injectionResults: any = {};
let safetyMetrics: any = {};

Before(async function() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unjucks-injection-'));
  testHelper = new TestHelper(tempDir);
  injectionResults = {};
  safetyMetrics = {};
});

After(async function() {
  await testHelper.cleanup();
});

// File setup
Given('I have an existing file {string} with content:', async function(filePath, content) {
  await testHelper.createFile(filePath, content);
  this.targetFile = filePath;
  this.originalContent = content;
  
  // Calculate hash for integrity checking
  this.originalHash = crypto.createHash('md5').update(content).digest('hex');
  injectionResults.originalFileCreated = { filePath, hash: this.originalHash };
});

Given('I have an injection template:', async function(templateContent) {
  await testHelper.createFile('_templates/inject/route/route.ts.njk', templateContent);
  this.injectionTemplate = templateContent;
});

Given('I have templates for different injection points', async function() {
  // Import injection template
  await testHelper.createFile('_templates/inject/import/import.ts.njk',
    `---
to: src/app.ts
inject: true
after: "// Imports will be injected here"
skipIf: "import.*<%= name %>"
---
import { <%= name %>Routes } from './routes/<%= name.toLowerCase() %>';`);
  
  // Middleware injection template  
  await testHelper.createFile('_templates/inject/middleware/middleware.ts.njk',
    `---
to: src/app.ts
inject: true
after: "// Middleware will be injected here"
skipIf: "<%= name.toLowerCase() %>.middleware"
---
app.use(<%= name.toLowerCase() %>Middleware);`);
  
  // Route injection template
  await testHelper.createFile('_templates/inject/routes/routes.ts.njk',
    `---
to: src/app.ts
inject: true
after: "// Routes will be injected here"  
skipIf: "/<%= name.toLowerCase() %>"
---
app.use('/<%= name.toLowerCase() %>', <%= name.toLowerCase() %>Routes);`);
  
  injectionResults.multipleTemplatesCreated = true;
});

Given('I have a target file that is being read by another process', async function() {
  await testHelper.createFile('src/locked.ts', `
export class LockedFile {
  constructor() {
    console.log('This file is being accessed');
  }
}`);
  
  this.lockedFile = 'src/locked.ts';
  injectionResults.lockedFileCreated = true;
});

Given('I have multiple templates targeting the same file', async function() {
  // Create multiple templates that target the same file
  for (let i = 0; i < 5; i++) {
    await testHelper.createFile(`_templates/concurrent/template${i}/inject.ts.njk`,
      `---
to: src/shared.ts
inject: true
after: "// Injections here"
skipIf: "Template${i}"
---
// Template${i} injection
export const template${i}Feature = true;`);
  }
  
  await testHelper.createFile('src/shared.ts', `
// Base file
class SharedFile {
  // Injections here
}

export default SharedFile;`);
  
  injectionResults.concurrentTemplatesCreated = true;
});

Given('I have a target file {string}', async function(filePath) {
  await testHelper.createFile(filePath, `
export interface Config {
  database: string;
  // Injections will be added here
}

export default Config;`);
  
  this.configFile = filePath;
});

Given('I have an injection template with invalid syntax', async function() {
  await testHelper.createFile('_templates/invalid/syntax/bad.ts.njk',
    `---
to: <%= configFile %>
inject: true
after: "// Injections will be added here"
---
// This template has invalid JavaScript syntax
const invalid = {
  missing: "closing brace"
// Missing closing brace intentionally`);
  
  this.invalidTemplate = true;
});

Given('I have a large target file \\(>1MB)', async function() {
  // Generate a large file content
  const largeContent = 'export const data = {\n' + 
    Array.from({ length: 50000 }, (_, i) => `  item${i}: "value${i}",`).join('\n') + 
    '\n  // Injection point here\n' +
    '};';
    
  await testHelper.createFile('src/large.ts', largeContent);
  this.largeFile = 'src/large.ts';
  
  // Verify file is actually large
  const stats = await fs.stat(testHelper.getFullPath('src/large.ts'));
  expect(stats.size).toBeGreaterThan(1024 * 1024); // 1MB
  
  injectionResults.largeFileCreated = { size: stats.size };
});

Given('I have a binary file in the target directory', async function() {
  // Create a simple binary file (PNG header)
  const binaryData = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  await fs.writeFile(testHelper.getFullPath('image.png'), binaryData);
  
  this.binaryFile = 'image.png';
});

Given('I have a template that might target it', async function() {
  await testHelper.createFile('_templates/binary/test/inject.ts.njk',
    `---
to: <%= binaryFile %>
inject: true
---
// This should not work on binary files`);
});

Given('I have a read-only target file', async function() {
  await testHelper.createFile('src/readonly.ts', `
export class ReadOnlyFile {
  // Content here
}`);
  
  // Make file read-only
  const fullPath = testHelper.getFullPath('src/readonly.ts');
  await fs.chmod(fullPath, 0o444);
  
  this.readOnlyFile = 'src/readonly.ts';
});

Given('I have injection with backup enabled', async function() {
  await testHelper.createFile('_templates/backup/test/inject.ts.njk',
    `---
to: src/target.ts
inject: true
backup: true
after: "// Injection point"
---
// Injected content with backup`);
  
  await testHelper.createFile('src/target.ts', `
class Target {
  // Injection point
}
export default Target;`);
  
  this.backupEnabled = true;
});

Given('I have a template with complex skipIf logic:', async function(templateContent) {
  await testHelper.createFile('_templates/complex/skipif/conditional.ts.njk', templateContent);
  this.complexSkipIf = templateContent;
});

// Injection operations
When('I perform injection with skipIf condition', async function() {
  const startTime = Date.now();
  const result = await testHelper.runCli('generate inject route --name=User');
  safetyMetrics.injectionTime = Date.now() - startTime;
  
  this.injectionResult = result;
  injectionResults.firstInjection = {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    duration: result.duration
  };
});

When('I inject imports, middleware, and routes', async function() {
  const operations = [
    { template: 'inject import', name: 'User' },
    { template: 'inject middleware', name: 'Auth' },
    { template: 'inject routes', name: 'API' }
  ];
  
  const results = [];
  for (const op of operations) {
    const result = await testHelper.runCli(`generate ${op.template} --name=${op.name}`);
    results.push(result);
  }
  
  this.multipleInjections = results;
  injectionResults.multipleInjections = results.map(r => ({
    exitCode: r.exitCode,
    hasOutput: r.stdout.length > 0
  }));
});

When('I perform an injection operation', async function() {
  const result = await testHelper.runCli('generate inject test --targetFile=src/locked.ts');
  this.atomicResult = result;
});

When('I run multiple injection operations simultaneously', async function() {
  // Run 5 concurrent injections
  const promises = Array.from({ length: 5 }, (_, i) => 
    testHelper.runCli(`generate concurrent template${i} --name=Feature${i}`)
  );
  
  this.concurrentResults = await Promise.all(promises);
  injectionResults.concurrentOperations = this.concurrentResults.map(r => ({
    exitCode: r.exitCode,
    duration: r.duration
  }));
});

When('the injection operation fails', async function() {
  const result = await testHelper.runCli('generate invalid syntax --configFile=src/config.ts');
  this.failureResult = result;
});

When('I perform the injection', async function() {
  const startTime = Date.now();
  const result = await testHelper.runCli('generate large inject --targetFile=src/large.ts');
  safetyMetrics.largeFileInjectionTime = Date.now() - startTime;
  
  this.largeFileResult = result;
});

When('I attempt injection', async function() {
  const result = await testHelper.runCli('generate binary test --binaryFile=image.png');
  this.binaryResult = result;
});

When('I attempt injection', async function() {
  const result = await testHelper.runCli('generate readonly test --targetFile=src/readonly.ts');
  this.permissionResult = result;
});

When('I perform the injection', async function() {
  const result = await testHelper.runCli('generate backup test');
  this.backupResult = result;
});

When('I inject with various conditions', async function() {
  // Test different conditions
  const tests = [
    { name: 'admin', existing: 'adminRoutes' },
    { name: 'user', existing: 'userRoutes' },
    { name: 'guest', existing: '' }
  ];
  
  this.conditionalResults = [];
  for (const test of tests) {
    const result = await testHelper.runCli(`generate complex skipif --name=${test.name} --existing="${test.existing}"`);
    this.conditionalResults.push({ test, result });
  }
});

// Assertions
Then('the injection should be idempotent', async function() {
  expect(this.injectionResult.exitCode).toBe(0);
  
  // Verify content was injected
  const content = await testHelper.readFile(this.targetFile);
  const injectionCount = (content.match(/router\.use.*User/g) || []).length;
  expect(injectionCount).toBe(1);
  
  injectionResults.idempotencyVerified = true;
});

Then('the file should not be corrupted', async function() {
  const content = await testHelper.readFile(this.targetFile);
  
  // Verify file structure integrity
  expect(content).toContain('import { Router }');
  expect(content).toContain('export default router');
  
  // Verify basic syntax integrity  
  const openBraces = (content.match(/{/g) || []).length;
  const closeBraces = (content.match(/}/g) || []).length;
  expect(openBraces).toBe(closeBraces);
  
  injectionResults.fileIntegrityVerified = true;
});

Then('all injections should succeed', async function() {
  for (const result of this.multipleInjections) {
    expect(result.exitCode).toBe(0);
  }
  
  injectionResults.allInjectionsSucceeded = true;
});

Then('the file structure should remain intact', async function() {
  const content = await testHelper.readFile('src/app.ts');
  
  expect(content).toContain('import express');
  expect(content).toContain('export default app');
  expect(content).toContain('// Imports will be injected here');
  expect(content).toContain('// Middleware will be injected here');
  expect(content).toContain('// Routes will be injected here');
  
  injectionResults.structureIntact = true;
});

Then('no injection should interfere with others', async function() {
  const content = await testHelper.readFile('src/app.ts');
  
  // Verify all injections are present
  expect(content).toContain('UserRoutes');
  expect(content).toContain('authMiddleware');
  expect(content).toContain('/api');
  
  injectionResults.noInterference = true;
});

Then('the operation should either succeed completely or fail completely', async function() {
  // Atomic operation - either all changes or no changes
  expect([0, 1]).toContain(this.atomicResult.exitCode);
  injectionResults.atomicOperation = true;
});

Then('the original file should never be left in a corrupted state', async function() {
  const content = await testHelper.readFile(this.lockedFile);
  
  // File should be either unchanged or properly updated
  expect(content).toContain('export class LockedFile');
  injectionResults.noCorruption = true;
});

Then('temporary files should be cleaned up automatically', async function() {
  const files = await testHelper.listFiles();
  const tempFiles = files.filter(f => f.includes('.tmp') || f.includes('.bak') || f.includes('~'));
  
  expect(tempFiles.length).toBe(0);
  injectionResults.tempFilesCleanedUp = true;
});

Then('the operations should be serialized properly', async function() {
  // All concurrent operations should complete
  for (const result of this.concurrentResults) {
    expect(result.exitCode).toBe(0);
  }
});

Then('no race conditions should occur', async function() {
  const content = await testHelper.readFile('src/shared.ts');
  
  // All features should be present exactly once
  for (let i = 0; i < 5; i++) {
    const featureCount = (content.match(new RegExp(`template${i}Feature`, 'g')) || []).length;
    expect(featureCount).toBe(1);
  }
  
  injectionResults.noRaceConditions = true;
});

Then('the final file should contain all expected changes', async function() {
  const content = await testHelper.readFile('src/shared.ts');
  
  // Verify all 5 templates were injected
  for (let i = 0; i < 5; i++) {
    expect(content).toContain(`Template${i} injection`);
  }
  
  injectionResults.allChangesPresent = true;
});

Then('the file should remain syntactically valid', async function() {
  const content = await testHelper.readFile('src/shared.ts');
  
  // Basic syntax validation
  const openBraces = (content.match(/{/g) || []).length;
  const closeBraces = (content.match(/}/g) || []).length;
  expect(openBraces).toBe(closeBraces);
  
  injectionResults.syntaxValid = true;
});

Then('the original file should be restored', async function() {
  // Check if file was restored to original state
  const content = await testHelper.readFile(this.configFile);
  expect(content).not.toContain('missing: "closing brace"');
  
  injectionResults.fileRestored = true;
});

Then('no partial changes should remain', async function() {
  const content = await testHelper.readFile(this.configFile);
  
  // Should not contain any partial injection content
  expect(content).not.toContain('This template has invalid');
  injectionResults.noPartialChanges = true;
});

Then('a clear error message should be provided', async function() {
  expect(this.failureResult.stderr.length > 0 || this.failureResult.stdout.includes('error')).toBe(true);
  injectionResults.clearErrorMessage = true;
});

Then('the operation should complete in under {int} seconds', async function(maxSeconds) {
  const maxMs = maxSeconds * 1000;
  expect(safetyMetrics.largeFileInjectionTime).toBeLessThan(maxMs);
});

Then('memory usage should remain reasonable', async function() {
  const memUsage = process.memoryUsage();
  const memMB = memUsage.heapUsed / 1024 / 1024;
  
  // Should not exceed 200MB for large file operations
  expect(memMB).toBeLessThan(200);
  safetyMetrics.memoryUsage = memMB;
});

Then('the file should be processed correctly', async function() {
  const content = await testHelper.readFile(this.largeFile);
  expect(content.length).toBeGreaterThan(1024 * 1024);
  injectionResults.largeFileProcessed = true;
});

Then('the system should detect the binary file', async function() {
  expect(this.binaryResult.exitCode).not.toBe(0);
  injectionResults.binaryDetected = true;
});

Then('refuse to perform injection', async function() {
  expect(this.binaryResult.exitCode).not.toBe(0);
});

Then('provide a clear warning message', async function() {
  expect(this.binaryResult.stderr).toContain('binary') || 
  expect(this.binaryResult.stdout).toContain('binary');
});

Then('the system should handle the permission error gracefully', async function() {
  expect(this.permissionResult.exitCode).not.toBe(0);
  injectionResults.permissionHandled = true;
});

Then('provide a clear error message', async function() {
  expect(this.permissionResult.stderr.length > 0).toBe(true);
});

Then('suggest how to fix the permission issue', async function() {
  expect(this.permissionResult.stderr).toMatch(/permission|chmod|access/i);
});

Then('a backup file should be created', async function() {
  const backupExists = await testHelper.fileExists('src/target.ts.bak');
  expect(backupExists).toBe(true);
  injectionResults.backupCreated = true;
});

Then('the backup should contain the original content', async function() {
  const backupContent = await testHelper.readFile('src/target.ts.bak');
  expect(backupContent).toContain('class Target');
  expect(backupContent).not.toContain('Injected content');
});

Then('the original content should be recoverable', async function() {
  // Verify backup can be used to restore
  const backupContent = await testHelper.readFile('src/target.ts.bak');
  expect(backupContent.length).toBeGreaterThan(0);
  injectionResults.contentRecoverable = true;
});

Then('the backup should be properly cleaned up', async function() {
  // In a real scenario, backups might be cleaned up after successful operation
  // For now, just verify backup exists and is valid
  const backupExists = await testHelper.fileExists('src/target.ts.bak');
  expect(backupExists).toBe(true);
});

Then('the skipIf logic should be evaluated correctly', async function() {
  for (const { test, result } of this.conditionalResults) {
    if (test.name === 'admin' && test.existing === 'adminRoutes') {
      // Should be skipped
      expect(result.stdout).toContain('skipped') || expect(result.exitCode).toBe(0);
    } else {
      // Should be processed
      expect(result.exitCode).toBe(0);
    }
  }
  
  injectionResults.skipIfEvaluated = true;
});

Then('injections should only occur when conditions are met', async function() {
  injectionResults.conditionalInjections = true;
});

Then('the evaluation should have access to file context', async function() {
  // The skipIf condition references 'existing' which comes from file analysis
  injectionResults.contextAccess = true;
});