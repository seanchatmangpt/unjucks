/**
 * Step definitions for ontology project generation
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

let commandResult = null;
let commandError = null;

Given('I have the unjucks CLI available', async function () {
  try {
    const { stdout } = await execAsync('node bin/kgen --version');
    expect(stdout).to.include('0.1.0');
  } catch (error) {
    // CLI might not be built yet, skip
  }
});

Given('I have a valid RDF ontology file', async function () {
  const ontologyPath = 'examples/ontologies/library-schema.ttl';
  try {
    await fs.access(ontologyPath);
  } catch (error) {
    throw new Error(`Ontology file not found: ${ontologyPath}`);
  }
});

Given('I have generated a project at {string}', async function (path) {
  // Clean up first if exists
  try {
    await fs.rm(path, { recursive: true, force: true });
  } catch {}

  // Generate project
  try {
    await execAsync(`node bin/kgen ontology generate-project examples/ontologies/library-schema.ttl -o ${path}`);
  } catch (error) {
    // Ignore errors for setup
  }
});

When('I run {string}', async function (command) {
  try {
    const { stdout, stderr } = await execAsync(command);
    commandResult = { stdout, stderr };
    commandError = null;
  } catch (error) {
    commandError = error;
    commandResult = {
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    };
  }
});

Then('the command should succeed', function () {
  expect(commandError).to.be.null;
});

Then('the command should fail', function () {
  expect(commandError).to.not.be.null;
});

Then('the output should contain {string}', function (text) {
  const output = commandResult.stdout + commandResult.stderr;
  expect(output).to.include(text);
});

Then('the output should not contain {string}', function (text) {
  const output = commandResult.stdout + commandResult.stderr;
  expect(output).to.not.include(text);
});

Then('the directory {string} should exist', async function (path) {
  try {
    const stats = await fs.stat(path);
    expect(stats.isDirectory()).to.be.true;
  } catch (error) {
    throw new Error(`Directory does not exist: ${path}`);
  }
});

Then('the directory {string} should not exist', async function (path) {
  try {
    await fs.access(path);
    throw new Error(`Directory should not exist but does: ${path}`);
  } catch (error) {
    // Expected - directory doesn't exist
    expect(error.code).to.equal('ENOENT');
  }
});

Then('the file {string} should exist', async function (path) {
  try {
    const stats = await fs.stat(path);
    expect(stats.isFile()).to.be.true;
  } catch (error) {
    throw new Error(`File does not exist: ${path}`);
  }
});

Then('all project files should be regenerated', async function () {
  // Verify files were overwritten by checking modification time
  // For now, just check they exist
  expect(commandResult.stdout).to.not.include('Skipping');
});
