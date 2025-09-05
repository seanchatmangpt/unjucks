// Simple BDD test to prove infrastructure works
// Using plain JavaScript ESM to avoid TypeScript compilation issues

import { Given, When, Then } from '@cucumber/cucumber';
import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';

let testResult;

console.log('Loading simple BDD step definitions...');

Given('I have a working test environment', function () {
  assert.ok(true, 'Test environment should be accessible');
  console.log('✅ Test environment validated');
});

Given('I have access to Node.js environment', function () {
  assert.ok(process.version, 'Node.js should be available');
  console.log(`✅ Node.js version: ${process.version}`);
});

When('I run a basic assertion', function () {
  testResult = { success: true, message: 'Basic assertion passed' };
  console.log('✅ Basic assertion executed');
});

When('I check the Node version', function () {
  testResult = process.version;
  console.log(`✅ Node version captured: ${testResult}`);
});

Then('it should pass successfully', function () {
  assert.ok(testResult.success, testResult.message);
  console.log('✅ Success assertion passed');
});

Then('it should return a valid version string', function () {
  assert.ok(testResult, 'Node version should be defined');
  assert.ok(typeof testResult === 'string', 'Version should be a string');
  assert.ok(testResult.startsWith('v'), 'Version should start with v');
  console.log('✅ Version string validation passed');
});

Given('I have file system access', function () {
  assert.ok(typeof fs.existsSync === 'function', 'File system should be accessible');
  console.log('✅ File system access confirmed');
});

When('I check if package.json exists', function () {
  const packagePath = path.resolve(process.cwd(), 'package.json');
  testResult = fs.existsSync(packagePath);
  console.log(`✅ Package.json existence check: ${testResult}`);
});

Then('it should be found in the current directory', function () {
  assert.ok(testResult === true, 'package.json should exist in current directory');
  console.log('✅ Package.json found in current directory');
});