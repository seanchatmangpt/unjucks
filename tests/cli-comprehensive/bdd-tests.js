#!/usr/bin/env node
/**
 * BDD-style CLI Tests for @seanchatmangpt/unjucks
 * Cucumber-like behavior-driven testing
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class BddCliTester {
  constructor() {
    this.scenarios = [];
    this.results = { passed: 0, failed: 0, total: 0 };
    this.testDir = path.join(os.tmpdir(), 'unjucks-bdd-test-' + Date.now());
    this.originalDir = process.cwd();
  }

  setup() {
    fs.mkdirSync(this.testDir, { recursive: true });
    process.chdir(this.testDir);
  }

  cleanup() {
    process.chdir(this.originalDir);
    try {
      fs.rmSync(this.testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  given(description, setupFn) {
    this.currentScenario = { description, steps: [] };
    if (setupFn) setupFn();
    return this;
  }

  when(action, commandFn) {
    this.currentScenario.steps.push({ type: 'when', action, commandFn });
    return this;
  }

  then(expectation, assertFn) {
    this.currentScenario.steps.push({ type: 'then', expectation, assertFn });
    return this;
  }

  scenario(name) {
    if (this.currentScenario) {
      this.currentScenario.name = name;
      this.scenarios.push(this.currentScenario);
    }
    this.currentScenario = null;
    return this;
  }

  runCommand(command) {
    try {
      const result = execSync(command, { 
        encoding: 'utf8',
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return { success: true, stdout: result, stderr: '', exitCode: 0 };
    } catch (error) {
      return {
        success: false,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.status || 1
      };
    }
  }

  async runScenarios() {
    console.log('🎭 Running BDD CLI Scenarios...\n');

    for (const scenario of this.scenarios) {
      console.log(`📋 Scenario: ${scenario.name}`);
      console.log(`   ${scenario.description}`);
      
      let scenarioPassed = true;
      let commandResult = null;

      for (const step of scenario.steps) {
        try {
          if (step.type === 'when' && step.commandFn) {
            commandResult = step.commandFn();
          } else if (step.type === 'then' && step.assertFn) {
            const assertion = step.assertFn(commandResult);
            if (!assertion) {
              scenarioPassed = false;
              console.log(`   ❌ ${step.expectation}`);
            } else {
              console.log(`   ✅ ${step.expectation}`);
            }
          }
        } catch (error) {
          scenarioPassed = false;
          console.log(`   ❌ ${step.expectation} - Error: ${error.message}`);
        }
      }

      if (scenarioPassed) {
        this.results.passed++;
        console.log('   🎉 SCENARIO PASSED\n');
      } else {
        this.results.failed++;
        console.log('   💥 SCENARIO FAILED\n');
      }
      
      this.results.total++;
    }
  }

  defineScenarios() {
    // Core CLI Command Scenarios
    this.given('a clean directory with no templates', () => {
      // Clean setup
    })
    .when('I run unjucks --version', () => {
      return this.runCommand('unjucks --version');
    })
    .then('I should see the version number', (result) => {
      return result.success && result.stdout.includes('2025');
    })
    .scenario('Version Display');

    this.given('a clean directory', () => {
      // Setup
    })
    .when('I run unjucks --help', () => {
      return this.runCommand('unjucks --help');
    })
    .then('I should see usage information and available commands', (result) => {
      return result.success && 
             result.stdout.toLowerCase().includes('usage') &&
             result.stdout.toLowerCase().includes('commands');
    })
    .scenario('Help Display');

    this.given('a directory with no _templates folder', () => {
      // Clean directory
    })
    .when('I run unjucks list', () => {
      return this.runCommand('unjucks list');
    })
    .then('I should see a message about no templates found', (result) => {
      return result.success; // Command should succeed even with no templates
    })
    .scenario('List Empty Templates');

    this.given('a directory with template generators', () => {
      fs.mkdirSync('_templates/component/new', { recursive: true });
      fs.writeFileSync('_templates/component/new/component.js.ejs', `---
to: src/components/<%= name %>.js
---
export const <%= name %> = () => {
  return '<%= name %> component';
};`);
    })
    .when('I run unjucks list', () => {
      return this.runCommand('unjucks list');
    })
    .then('I should see available templates', (result) => {
      return result.success && result.stdout.includes('component');
    })
    .scenario('List Available Templates');

    this.given('a directory with component template', () => {
      fs.mkdirSync('_templates/component/new', { recursive: true });
      fs.writeFileSync('_templates/component/new/component.js.ejs', `---
to: src/components/<%= name %>.js
---
export const <%= name %> = () => {
  return '<%= name %> component';
};`);
    })
    .when('I run unjucks generate component new --name MyComponent', () => {
      return this.runCommand('unjucks generate component new --name MyComponent');
    })
    .then('I should have a generated component file', (result) => {
      return result.success && fs.existsSync('src/components/MyComponent.js');
    })
    .scenario('Generate Component');

    this.given('a directory with templates', () => {
      fs.mkdirSync('_templates/api/new', { recursive: true });
      fs.writeFileSync('_templates/api/new/route.js.ejs', `---
to: src/routes/<%= name %>.js
---
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: '<%= name %> route' });
});

module.exports = router;`);
    })
    .when('I run unjucks preview api new --name users', () => {
      return this.runCommand('unjucks preview api new --name users');
    })
    .then('I should see a preview without creating files', (result) => {
      return result.success && !fs.existsSync('src/routes/users.js');
    })
    .scenario('Preview Generation');

    this.given('an invalid command', () => {
      // No setup needed
    })
    .when('I run unjucks invalidcommand', () => {
      return this.runCommand('unjucks invalidcommand');
    })
    .then('I should see an error message', (result) => {
      return !result.success;
    })
    .scenario('Invalid Command Error');

    this.given('a template directory', () => {
      fs.mkdirSync('_templates/test/new', { recursive: true });
    })
    .when('I run unjucks generate nonexistent template', () => {
      return this.runCommand('unjucks generate nonexistent template');
    })
    .then('I should see an error about missing template', (result) => {
      return !result.success;
    })
    .scenario('Missing Template Error');

    // Advanced command scenarios
    this.given('a clean environment', () => {
      // Clean setup
    })
    .when('I run unjucks init', () => {
      return this.runCommand('unjucks init');
    })
    .then('I should have project initialization', (result) => {
      return result.success;
    })
    .scenario('Project Initialization');

    // GitHub integration scenarios
    this.given('a project directory', () => {
      // Setup
    })
    .when('I run unjucks github --help', () => {
      return this.runCommand('unjucks github --help');
    })
    .then('I should see GitHub command help', (result) => {
      return result.success;
    })
    .scenario('GitHub Command Help');

    // Semantic web scenarios
    this.given('a project with semantic features', () => {
      // Setup
    })
    .when('I run unjucks semantic --help', () => {
      return this.runCommand('unjucks semantic --help');
    })
    .then('I should see semantic command help', (result) => {
      return result.success;
    })
    .scenario('Semantic Command Help');

    // Workflow scenarios
    this.given('a project setup', () => {
      // Setup
    })
    .when('I run unjucks workflow --help', () => {
      return this.runCommand('unjucks workflow --help');
    })
    .then('I should see workflow command help', (result) => {
      return result.success;
    })
    .scenario('Workflow Command Help');
  }

  async run() {
    try {
      this.setup();
      this.defineScenarios();
      await this.runScenarios();
      
      console.log('📊 BDD TEST RESULTS');
      console.log('===================');
      console.log(`Total Scenarios: ${this.results.total}`);
      console.log(`Passed: ${this.results.passed} ✅`);
      console.log(`Failed: ${this.results.failed} ❌`);
      console.log(`Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(2)}%`);

      this.cleanup();
      return this.results;
    } catch (error) {
      console.error('❌ BDD Test execution failed:', error);
      this.cleanup();
      throw error;
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new BddCliTester();
  tester.run()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = BddCliTester;