/**
 * CLI Test Setup for KGEN CLI
 * Sets up environment for command-line interface testing
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import fs from 'fs-extra';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Global CLI test state
let testWorkspaceDir;
let originalCwd;
let originalEnv;

/**
 * Global setup before all CLI tests
 */
beforeAll(async () => {
  // Setup CLI test environment
  process.env.NODE_ENV = 'test';
  process.env.KGEN_CLI_TEST_MODE = 'true';
  process.env.TZ = 'UTC';
  
  // Store original environment
  originalCwd = process.cwd();
  originalEnv = { ...process.env };
  
  // Create test workspace
  testWorkspaceDir = resolve(process.cwd(), 'test-workspace');
  await fs.ensureDir(testWorkspaceDir);
  
  // Setup CLI test utilities
  global.cliTestUtils = {
    workspaceDir: testWorkspaceDir,
    originalCwd,
    execKGen: execKGenCommand,
    spawnKGen: spawnKGenCommand,
    createTestProject: createTestProject,
    cleanupTestProject: cleanupTestProject,
    captureOutput: captureCommandOutput,
    waitForFile: waitForFileExists,
    compareFiles: compareFileContents
  };
});

/**
 * Global cleanup after all CLI tests
 */
afterAll(async () => {
  // Restore original working directory
  process.chdir(originalCwd);
  
  // Restore original environment
  Object.keys(process.env).forEach(key => {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  });
  Object.assign(process.env, originalEnv);
  
  // Cleanup test workspace
  if (testWorkspaceDir && await fs.pathExists(testWorkspaceDir)) {
    await fs.remove(testWorkspaceDir);
  }
});

/**
 * Setup before each CLI test
 */
beforeEach(async () => {
  // Ensure we're in test workspace
  process.chdir(testWorkspaceDir);
  
  // Reset CLI state
  process.env.KGEN_CONFIG_PATH = resolve(testWorkspaceDir, '.kgen.config.js');
  process.env.KGEN_CACHE_DIR = resolve(testWorkspaceDir, '.kgen-cache');
  
  // Create fresh test directories
  await fs.ensureDir(resolve(testWorkspaceDir, 'input'));
  await fs.ensureDir(resolve(testWorkspaceDir, 'output'));
  await fs.ensureDir(resolve(testWorkspaceDir, 'templates'));
});

/**
 * Cleanup after each CLI test
 */
afterEach(async () => {
  // Clean up test workspace contents
  const contents = await fs.readdir(testWorkspaceDir);
  
  for (const item of contents) {
    const itemPath = resolve(testWorkspaceDir, item);
    await fs.remove(itemPath);
  }
});

/**
 * Execute KGEN CLI command and return result
 */
async function execKGenCommand(args = [], options = {}) {
  const kgenBinary = resolve(originalCwd, 'bin/kgen'); // Adjust path as needed
  const command = `node ${kgenBinary} ${args.join(' ')}`;
  
  const execOptions = {
    cwd: testWorkspaceDir,
    env: { ...process.env, ...options.env },
    timeout: options.timeout || 30000,
    ...options
  };
  
  try {
    const { stdout, stderr } = await execAsync(command, execOptions);
    return {
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0
    };
  } catch (error) {
    return {
      success: false,
      stdout: error.stdout?.trim() || '',
      stderr: error.stderr?.trim() || '',
      exitCode: error.code || 1,
      error: error.message
    };
  }
}

/**
 * Spawn KGEN CLI command for interactive testing
 */
function spawnKGenCommand(args = [], options = {}) {
  const kgenBinary = resolve(originalCwd, 'bin/kgen');
  
  const spawnOptions = {
    cwd: testWorkspaceDir,
    env: { ...process.env, ...options.env },
    stdio: options.stdio || 'pipe',
    ...options
  };
  
  return spawn('node', [kgenBinary, ...args], spawnOptions);
}

/**
 * Create a test project structure
 */
async function createTestProject(projectName, config = {}) {
  const projectDir = resolve(testWorkspaceDir, projectName);
  await fs.ensureDir(projectDir);
  
  // Create basic project structure
  await fs.ensureDir(resolve(projectDir, 'src'));
  await fs.ensureDir(resolve(projectDir, 'data'));
  await fs.ensureDir(resolve(projectDir, 'templates'));
  await fs.ensureDir(resolve(projectDir, 'output'));
  
  // Create package.json
  const packageJson = {
    name: projectName,
    version: '1.0.0',
    description: 'Test project for KGEN CLI',
    main: 'index.js',
    scripts: {
      test: 'echo "Error: no test specified" && exit 1'
    },
    ...config.packageJson
  };
  
  await fs.writeJson(resolve(projectDir, 'package.json'), packageJson, { spaces: 2 });
  
  // Create KGEN config
  const kgenConfig = {
    mode: 'development',
    input: {
      sources: ['./data/**/*.ttl', './data/**/*.rdf'],
      format: 'turtle'
    },
    output: {
      directory: './output',
      format: 'javascript'
    },
    templates: {
      directory: './templates'
    },
    ...config.kgenConfig
  };
  
  await fs.writeJson(resolve(projectDir, '.kgen.config.js'), kgenConfig, { spaces: 2 });
  
  return projectDir;
}

/**
 * Cleanup test project
 */
async function cleanupTestProject(projectName) {
  const projectDir = resolve(testWorkspaceDir, projectName);
  
  if (await fs.pathExists(projectDir)) {
    await fs.remove(projectDir);
  }
}

/**
 * Capture command output with timeout
 */
async function captureCommandOutput(command, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', command], {
      cwd: testWorkspaceDir,
      stdio: 'pipe'
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      resolve({
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
    
    child.on('error', reject);
    
    // Timeout handling
    setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Command timeout after ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Wait for file to exist
 */
async function waitForFileExists(filePath, timeout = 5000) {
  const startTime = this.getDeterministicTimestamp();
  const fullPath = resolve(testWorkspaceDir, filePath);
  
  while (this.getDeterministicTimestamp() - startTime < timeout) {
    if (await fs.pathExists(fullPath)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return false;
}

/**
 * Compare file contents
 */
async function compareFileContents(file1Path, file2Path) {
  const fullPath1 = resolve(testWorkspaceDir, file1Path);
  const fullPath2 = resolve(testWorkspaceDir, file2Path);
  
  if (!await fs.pathExists(fullPath1) || !await fs.pathExists(fullPath2)) {
    return false;
  }
  
  const content1 = await fs.readFile(fullPath1, 'utf8');
  const content2 = await fs.readFile(fullPath2, 'utf8');
  
  return content1 === content2;
}

/**
 * Create sample RDF data for testing
 */
export async function createSampleRDFFile(filename, entityType = 'person', name = 'Test Entity') {
  const rdfContent = `
    @prefix ex: <http://example.org/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    
    ex:${name.toLowerCase().replace(/\s+/g, '_')} a ex:${entityType} ;
      ex:hasName "${name}" ;
      ex:hasId "test-${this.getDeterministicTimestamp()}" ;
      ex:createdAt "${this.getDeterministicDate().toISOString()}"^^xsd:dateTime .
  `;
  
  const filePath = resolve(testWorkspaceDir, 'data', filename);
  await fs.ensureDir(resolve(testWorkspaceDir, 'data'));
  await fs.writeFile(filePath, rdfContent.trim());
  
  return filePath;
}

/**
 * Create sample template for testing
 */
export async function createSampleTemplate(filename, templateContent) {
  const filePath = resolve(testWorkspaceDir, 'templates', filename);
  await fs.ensureDir(resolve(testWorkspaceDir, 'templates'));
  await fs.writeFile(filePath, templateContent);
  
  return filePath;
}