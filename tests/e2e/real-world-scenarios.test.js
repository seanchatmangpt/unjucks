#!/usr/bin/env node
/**
 * Real-World E2E Scenario Tests for Unjucks
 * Tests actual developer workflows and common use cases
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test environment setup
const TEST_ENV = {
  tempDir: path.join(os.tmpdir(), 'unjucks-real-world-test'),
  projectRoot: path.resolve(__dirname, '../..'),
  cliPath: null, // Will be determined
  timeout: 45000 // 45 seconds for complex operations
};

// Results tracking
const scenarioResults = {
  scenarios: [],
  totalTime: 0,
  passed: 0,
  failed: 0
};

/**
 * Determine CLI path based on available options
 */
async function findCLIPath() {
  const options = [
    path.join(TEST_ENV.projectRoot, 'bin/unjucks.cjs'),
    path.join(TEST_ENV.projectRoot, 'bin/unjucks-standalone.cjs'),
    path.join(TEST_ENV.projectRoot, 'src/cli/index.js')
  ];

  for (const cliPath of options) {
    try {
      await fs.access(cliPath);
      return cliPath;
    } catch {
      continue;
    }
  }
  
  throw new Error('No CLI executable found');
}

/**
 * Execute CLI command with proper environment
 */
async function runCLI(args, options = {}) {
  const cliPath = TEST_ENV.cliPath;
  const isJS = cliPath.endsWith('.js');
  const command = isJS ? 'node' : cliPath;
  const finalArgs = isJS ? [cliPath, ...args] : args;

  return new Promise((resolve, reject) => {
    const proc = spawn(command, finalArgs, {
      cwd: options.cwd || TEST_ENV.tempDir,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' },
      timeout: TEST_ENV.timeout
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });

    proc.on('error', reject);

    setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Command timed out'));
    }, TEST_ENV.timeout);
  });
}

/**
 * Setup test environment
 */
async function setupEnvironment() {
  // Clean and create test directory
  await fs.rm(TEST_ENV.tempDir, { recursive: true, force: true });
  await fs.mkdir(TEST_ENV.tempDir, { recursive: true });
  
  // Find CLI
  TEST_ENV.cliPath = await findCLIPath();
  console.log(`🔧 Using CLI: ${TEST_ENV.cliPath}`);
}

/**
 * Run a scenario test
 */
async function runScenario(name, testFn) {
  console.log(`\n🎬 Scenario: ${name}`);
  const startTime = this.getDeterministicTimestamp();
  
  try {
    await testFn();
    const duration = this.getDeterministicTimestamp() - startTime;
    
    scenarioResults.scenarios.push({
      name,
      status: 'PASSED',
      duration,
      error: null
    });
    scenarioResults.passed++;
    
    console.log(`✅ PASSED: ${name} (${duration}ms)`);
  } catch (error) {
    const duration = this.getDeterministicTimestamp() - startTime;
    
    scenarioResults.scenarios.push({
      name,
      status: 'FAILED',
      duration,
      error: error.message
    });
    scenarioResults.failed++;
    
    console.log(`❌ FAILED: ${name}`);
    console.log(`   Error: ${error.message}`);
  }
}

/**
 * Assert helper
 */
function expect(actual, message = '') {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`${message}: Expected ${expected}, got ${actual}`);
      }
    },
    toContain(substring) {
      if (!String(actual).includes(substring)) {
        throw new Error(`${message}: Expected "${actual}" to contain "${substring}"`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`${message}: Expected truthy value, got ${actual}`);
      }
    },
    toExist() {
      return fs.access(actual).catch(() => {
        throw new Error(`${message}: File ${actual} does not exist`);
      });
    }
  };
}

/**
 * SCENARIO TESTS
 */

// Scenario 1: Complete React Component Development Workflow
await runScenario('React Component Development Workflow', async () => {
  // Setup React project structure
  const srcDir = path.join(TEST_ENV.tempDir, 'src');
  await fs.mkdir(srcDir, { recursive: true });

  // Copy existing template from project
  const templateSource = path.join(TEST_ENV.projectRoot, '_templates/component');
  const templateDest = path.join(TEST_ENV.tempDir, '_templates/component');
  
  try {
    await fs.cp(templateSource, templateDest, { recursive: true });
  } catch {
    // Create basic React component template if copy fails
    await fs.mkdir(path.join(templateDest, 'new'), { recursive: true });
    const reactTemplate = `---
to: src/components/<%= Name %>.jsx
---
import React from 'react';

export const <%= Name %> = ({ children, ...props }) => {
  return (
    <div className="<%= name %>-component" {...props}>
      {children}
    </div>
  );
};

export default <%= Name %>;
`;
    await fs.writeFile(path.join(templateDest, 'new/component.ejs.t'), reactTemplate);
  }

  // Generate React component
  const result = await runCLI(['component', 'new', 'UserProfile']);
  expect(result.success, 'Component generation').toBeTruthy();

  // Verify component file exists
  const componentFile = path.join(TEST_ENV.tempDir, 'src/components/UserProfile.jsx');
  await expect(componentFile, 'Component file').toExist();

  // Verify content
  const content = await fs.readFile(componentFile, 'utf8');
  expect(content, 'Component content').toContain('UserProfile');
  expect(content, 'Component export').toContain('export const UserProfile');
});

// Scenario 2: Full-Stack API Development
await runScenario('Full-Stack API Development', async () => {
  // Create API template structure
  const apiTemplateDir = path.join(TEST_ENV.tempDir, '_templates/api/endpoint');
  await fs.mkdir(apiTemplateDir, { recursive: true });

  // API route template
  const routeTemplate = `---
to: src/api/routes/<%= name %>.js
---
import express from 'express';
const router = express.Router();

// GET /<%= name %>
router.get('/', async (req, res) => {
  try {
    // TODO: Implement <%= name %> listing
    res.json({ message: 'List <%= name %>' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /<%= name %>
router.post('/', async (req, res) => {
  try {
    // TODO: Implement <%= name %> creation
    res.status(201).json({ message: 'Created <%= name %>' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
`;

  // Model template
  const modelTemplate = `---
to: src/models/<%= Name %>.js
---
export class <%= Name %> {
  constructor(data = {}) {
    this.id = data.id;
    this.createdAt = data.createdAt || this.getDeterministicDate();
    this.updatedAt = data.updatedAt || this.getDeterministicDate();
  }

  static async findAll() {
    // TODO: Implement database query
    return [];
  }

  static async findById(id) {
    // TODO: Implement database query
    return null;
  }

  async save() {
    // TODO: Implement database save
    this.updatedAt = this.getDeterministicDate();
    return this;
  }
}
`;

  await fs.writeFile(path.join(apiTemplateDir, 'route.ejs.t'), routeTemplate);
  await fs.writeFile(path.join(apiTemplateDir, 'model.ejs.t'), modelTemplate);

  // Generate API endpoint
  const result = await runCLI(['api', 'endpoint', '--name', 'users']);
  expect(result.success, 'API generation').toBeTruthy();

  // Verify files
  const routeFile = path.join(TEST_ENV.tempDir, 'src/api/routes/users.js');
  const modelFile = path.join(TEST_ENV.tempDir, 'src/models/Users.js');

  await expect(routeFile, 'Route file').toExist();
  await expect(modelFile, 'Model file').toExist();

  // Verify content
  const routeContent = await fs.readFile(routeFile, 'utf8');
  expect(routeContent, 'Route content').toContain('List users');
  expect(routeContent, 'Route exports').toContain('export default router');

  const modelContent = await fs.readFile(modelFile, 'utf8');
  expect(modelContent, 'Model content').toContain('class Users');
});

// Scenario 3: Progressive Web App (PWA) Setup
await runScenario('Progressive Web App Setup', async () => {
  // Create PWA template
  const pwaTemplateDir = path.join(TEST_ENV.tempDir, '_templates/pwa/init');
  await fs.mkdir(pwaTemplateDir, { recursive: true });

  const manifestTemplate = `---
to: public/manifest.json
---
{
  "name": "<%= appName %>",
  "short_name": "<%= shortName || appName %>",
  "description": "<%= description || 'Progressive Web App' %>",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "<%= themeColor || '#000000' %>",
  "background_color": "<%= backgroundColor || '#ffffff' %>",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icon-512.png", 
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
`;

  const serviceWorkerTemplate = `---
to: public/sw.js
---
const CACHE_NAME = '<%= appName.toLowerCase().replace(/\s+/g, '-') %>-v1';
const urlsToCache = [
  '/',
  '/static/css/main.css',
  '/static/js/main.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});
`;

  await fs.writeFile(path.join(pwaTemplateDir, 'manifest.ejs.t'), manifestTemplate);
  await fs.writeFile(path.join(pwaTemplateDir, 'sw.ejs.t'), serviceWorkerTemplate);

  // Generate PWA files
  const result = await runCLI([
    'pwa', 'init',
    '--appName', 'My Awesome App',
    '--themeColor', '#2196F3',
    '--description', 'An awesome progressive web app'
  ]);
  expect(result.success, 'PWA generation').toBeTruthy();

  // Verify PWA files
  const manifestFile = path.join(TEST_ENV.tempDir, 'public/manifest.json');
  const swFile = path.join(TEST_ENV.tempDir, 'public/sw.js');

  await expect(manifestFile, 'Manifest file').toExist();
  await expect(swFile, 'Service worker file').toExist();

  // Verify manifest content
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
  expect(manifest.name, 'App name').toBe('My Awesome App');
  expect(manifest.theme_color, 'Theme color').toBe('#2196F3');
  expect(manifest.description, 'App description').toBe('An awesome progressive web app');
});

// Scenario 4: Test Suite Generation
await runScenario('Test Suite Generation', async () => {
  // Create test template
  const testTemplateDir = path.join(TEST_ENV.tempDir, '_templates/test/unit');
  await fs.mkdir(testTemplateDir, { recursive: true });

  const testTemplate = `---
to: tests/<%= name %>.test.js
---
import { <%= Name %> } from '../src/<%= name %>';

describe('<%= Name %>', () => {
  beforeEach(() => {
    // Setup test environment
  });

  afterEach(() => {
    // Cleanup test environment
  });

  describe('constructor', () => {
    it('should create instance with default values', () => {
      const instance = new <%= Name %>();
      expect(instance).toBeDefined();
    });

    it('should create instance with provided data', () => {
      const data = { id: 1, name: 'test' };
      const instance = new <%= Name %>(data);
      expect(instance.id).toBe(1);
      expect(instance.name).toBe('test');
    });
  });

  describe('methods', () => {
    let instance;

    beforeEach(() => {
      instance = new <%= Name %>();
    });

    it('should implement core functionality', () => {
      // TODO: Add specific tests for <%= name %> methods
      expect(instance).toBeDefined();
    });
  });
});
`;

  await fs.writeFile(path.join(testTemplateDir, 'test.ejs.t'), testTemplate);

  // Generate test file
  const result = await runCLI(['test', 'unit', '--name', 'userService']);
  expect(result.success, 'Test generation').toBeTruthy();

  // Verify test file
  const testFile = path.join(TEST_ENV.tempDir, 'tests/userService.test.js');
  await expect(testFile, 'Test file').toExist();

  const testContent = await fs.readFile(testFile, 'utf8');
  expect(testContent, 'Test imports').toContain('import { UserService }');
  expect(testContent, 'Test describe').toContain("describe('UserService'");
  expect(testContent, 'Test cases').toContain('should create instance with default values');
});

// Scenario 5: Database Migration Generation
await runScenario('Database Migration Generation', async () => {
  // Create migration template
  const migrationTemplateDir = path.join(TEST_ENV.tempDir, '_templates/migration/create');
  await fs.mkdir(migrationTemplateDir, { recursive: true });

  const migrationTemplate = `---
to: migrations/<%= timestamp %>_create_<%= tableName %>_table.js
---
exports.up = async function(knex) {
  return knex.schema.createTable('<%= tableName %>', function(table) {
    table.increments('id').primary();
    <% if (columns) { -%>
    <% columns.split(',').forEach(function(column) { -%>
    table.string('<%= column.trim() %>');
    <% }); -%>
    <% } -%>
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  return knex.schema.dropTable('<%= tableName %>');
};
`;

  await fs.writeFile(path.join(migrationTemplateDir, 'migration.ejs.t'), migrationTemplate);

  // Generate migration with timestamp
  const timestamp = this.getDeterministicDate().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const result = await runCLI([
    'migration', 'create',
    '--tableName', 'users',
    '--columns', 'email, username, password_hash',
    '--timestamp', timestamp
  ]);
  expect(result.success, 'Migration generation').toBeTruthy();

  // Verify migration file
  const migrationFile = path.join(TEST_ENV.tempDir, 'migrations', `${timestamp}_create_users_table.js`);
  await expect(migrationFile, 'Migration file').toExist();

  const migrationContent = await fs.readFile(migrationFile, 'utf8');
  expect(migrationContent, 'Migration up').toContain("createTable('users'");
  expect(migrationContent, 'Migration down').toContain("dropTable('users'");
  expect(migrationContent, 'Migration columns').toContain("table.string('email')");
});

// Scenario 6: Documentation Generation
await runScenario('Documentation Generation', async () => {
  // Create documentation template
  const docsTemplateDir = path.join(TEST_ENV.tempDir, '_templates/docs/api');
  await fs.mkdir(docsTemplateDir, { recursive: true });

  const readmeTemplate = `---
to: docs/<%= moduleName %>/README.md
---
# <%= moduleName %> Module

## Overview

The <%= moduleName %> module provides functionality for <%= description || 'module operations' %>.

## Installation

\`\`\`bash
npm install <%= moduleName %>
\`\`\`

## Usage

\`\`\`javascript
import { <%= ClassName %> } from '<%= moduleName %>';

const <%= instanceName %> = new <%= ClassName %>();
\`\`\`

## API Reference

### <%= ClassName %>

#### Constructor

\`\`\`javascript
new <%= ClassName %>(options)
\`\`\`

- \`options\` (Object): Configuration options

#### Methods

<% if (methods) { -%>
<% methods.split(',').forEach(function(method) { -%>
##### <%= method.trim() %>()

Description of <%= method.trim() %> method.

\`\`\`javascript
<%= instanceName %>.<%= method.trim() %>();
\`\`\`

<% }); -%>
<% } -%>

## Examples

TODO: Add usage examples

## License

MIT
`;

  await fs.writeFile(path.join(docsTemplateDir, 'readme.ejs.t'), readmeTemplate);

  // Generate documentation
  const result = await runCLI([
    'docs', 'api',
    '--moduleName', 'payment-processor',
    '--ClassName', 'PaymentProcessor',
    '--instanceName', 'processor',
    '--description', 'payment processing and transaction handling',
    '--methods', 'processPayment, refundPayment, validateCard'
  ]);
  expect(result.success, 'Documentation generation').toBeTruthy();

  // Verify documentation
  const readmeFile = path.join(TEST_ENV.tempDir, 'docs/payment-processor/README.md');
  await expect(readmeFile, 'README file').toExist();

  const readmeContent = await fs.readFile(readmeFile, 'utf8');
  expect(readmeContent, 'Module title').toContain('# payment-processor Module');
  expect(readmeContent, 'Class reference').toContain('### PaymentProcessor');
  expect(readmeContent, 'Method documentation').toContain('##### processPayment()');
});

/**
 * Main test runner
 */
async function runRealWorldScenarios() {
  console.log('🌍 Starting Real-World Scenario Tests');
  
  const overallStart = this.getDeterministicTimestamp();
  
  try {
    await setupEnvironment();
    
    // Tests are run by the await runScenario calls above
    
    scenarioResults.totalTime = this.getDeterministicTimestamp() - overallStart;
    
    // Generate report
    console.log('\n' + '='.repeat(50));
    console.log('🌍 REAL-WORLD SCENARIOS REPORT');
    console.log('='.repeat(50));
    console.log(`Total Scenarios: ${scenarioResults.scenarios.length}`);
    console.log(`✅ Passed: ${scenarioResults.passed}`);
    console.log(`❌ Failed: ${scenarioResults.failed}`);
    console.log(`⏱️  Total Time: ${scenarioResults.totalTime}ms`);
    console.log(`📈 Success Rate: ${((scenarioResults.passed / scenarioResults.scenarios.length) * 100).toFixed(1)}%`);

    if (scenarioResults.failed > 0) {
      console.log('\n❌ FAILED SCENARIOS:');
      scenarioResults.scenarios
        .filter(s => s.status === 'FAILED')
        .forEach(scenario => {
          console.log(`  • ${scenario.name}: ${scenario.error}`);
        });
    }

    // Save detailed results
    const reportDir = path.join(TEST_ENV.projectRoot, 'tests/reports');
    await fs.mkdir(reportDir, { recursive: true });
    
    const reportFile = path.join(reportDir, 'real-world-scenarios.json');
    await fs.writeFile(reportFile, JSON.stringify({
      ...scenarioResults,
      timestamp: this.getDeterministicDate().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        cliPath: TEST_ENV.cliPath
      }
    }, null, 2));

    console.log(`\n📄 Report saved: ${reportFile}`);

    return scenarioResults;

  } catch (error) {
    console.error('💥 Scenario tests failed:', error);
    throw error;
  } finally {
    // Cleanup
    await fs.rm(TEST_ENV.tempDir, { recursive: true, force: true });
  }
}

// Export for use in other modules
export { scenarioResults, runRealWorldScenarios };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runRealWorldScenarios()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(() => {
      process.exit(1);
    });
}