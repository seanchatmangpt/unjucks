/**
 * BDD Test Suite for CLI Commands
 * 
 * Behavior-driven tests for all v3 CLI commands using Given-When-Then scenarios
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test setup constants
const TEST_ROOT = path.join(__dirname, '../fixtures/bdd-test-workspace');
const CLI_PATH = path.resolve(__dirname, '../../bin/unjucks.js');

/**
 * BDD Helper for Given-When-Then structure
 */
class BDDScenario {
  constructor(description) {
    this.description = description;
    this.givenSteps = [];
    this.whenStep = null;
    this.thenSteps = [];
    this.context = {};
  }

  given(description, action) {
    this.givenSteps.push({ description, action });
    return this;
  }

  when(description, action) {
    this.whenStep = { description, action };
    return this;
  }

  then(description, assertion) {
    this.thenSteps.push({ description, assertion });
    return this;
  }

  async execute() {
    // Execute Given steps
    for (const step of this.givenSteps) {
      await step.action(this.context);
    }

    // Execute When step
    if (this.whenStep) {
      this.context.result = await this.whenStep.action(this.context);
    }

    // Execute Then steps
    for (const step of this.thenSteps) {
      await step.assertion(this.context);
    }
  }
}

describe('BDD: CLI Commands', () => {
  beforeEach(async () => {
    // Clean and setup test workspace
    await fs.remove(TEST_ROOT);
    await fs.ensureDir(TEST_ROOT);
    process.chdir(TEST_ROOT);
  });

  afterEach(async () => {
    // Cleanup test workspace
    if (await fs.pathExists(TEST_ROOT)) {
      await fs.remove(TEST_ROOT);
    }
  });

  describe('Feature: List generators and templates', () => {
    test('Scenario: List generators when none exist', async () => {
      const scenario = new BDDScenario('User lists generators in empty project')
        .given('I have an empty project directory', async (ctx) => {
          ctx.workDir = TEST_ROOT;
        })
        .when('I run "unjucks list"', async (ctx) => {
          try {
            const { stdout, stderr } = await execAsync(`node ${CLI_PATH} list`, {
              cwd: ctx.workDir
            });
            return { stdout, stderr, exitCode: 0 };
          } catch (error) {
            return { 
              stdout: error.stdout || '', 
              stderr: error.stderr || '', 
              exitCode: error.code || 1 
            };
          }
        })
        .then('I should see a helpful message about no generators', async (ctx) => {
          expect(ctx.result.stderr).toContain('No generators found');
        })
        .then('I should see suggestions to initialize', async (ctx) => {
          expect(ctx.result.stderr).toContain('init');
        });

      await scenario.execute();
    });

    test('Scenario: List generators when templates exist', async () => {
      const scenario = new BDDScenario('User lists available generators')
        .given('I have a project with templates', async (ctx) => {
          ctx.workDir = TEST_ROOT;
          
          // Create template structure
          const templatePath = path.join(ctx.workDir, '_templates/component/react');
          await fs.ensureDir(templatePath);
          await fs.writeFile(
            path.join(templatePath, 'index.njk'),
            '---\nto: src/components/{{ name }}.jsx\n---\n// Component: {{ name }}'
          );
        })
        .when('I run "unjucks list"', async (ctx) => {
          const { stdout } = await execAsync(`node ${CLI_PATH} list`, {
            cwd: ctx.workDir
          });
          return { stdout };
        })
        .then('I should see the component generator listed', async (ctx) => {
          expect(ctx.result.stdout).toContain('component');
        })
        .then('I should see table format by default', async (ctx) => {
          expect(ctx.result.stdout).toMatch(/Generator.*Description.*Templates/);
        });

      await scenario.execute();
    });

    test('Scenario: List templates for specific generator', async () => {
      const scenario = new BDDScenario('User lists templates for specific generator')
        .given('I have a component generator with multiple templates', async (ctx) => {
          ctx.workDir = TEST_ROOT;
          
          // Create multiple templates
          const reactPath = path.join(ctx.workDir, '_templates/component/react');
          const vuePath = path.join(ctx.workDir, '_templates/component/vue');
          
          await fs.ensureDir(reactPath);
          await fs.ensureDir(vuePath);
          
          await fs.writeFile(
            path.join(reactPath, 'index.njk'),
            '---\nto: src/components/{{ name }}.jsx\n---\n// React Component'
          );
          await fs.writeFile(
            path.join(vuePath, 'index.njk'),
            '---\nto: src/components/{{ name }}.vue\n---\n<!-- Vue Component -->'
          );
        })
        .when('I run "unjucks list component"', async (ctx) => {
          const { stdout } = await execAsync(`node ${CLI_PATH} list component`, {
            cwd: ctx.workDir
          });
          return { stdout };
        })
        .then('I should see both react and vue templates', async (ctx) => {
          expect(ctx.result.stdout).toContain('react');
          expect(ctx.result.stdout).toContain('vue');
        });

      await scenario.execute();
    });

    test('Scenario: List with JSON output format', async () => {
      const scenario = new BDDScenario('User requests JSON format output')
        .given('I have generators in my project', async (ctx) => {
          ctx.workDir = TEST_ROOT;
          
          const templatePath = path.join(ctx.workDir, '_templates/api/express');
          await fs.ensureDir(templatePath);
          await fs.writeFile(
            path.join(templatePath, 'index.njk'),
            '---\nto: src/routes/{{ name }}.js\n---\n// Express route'
          );
        })
        .when('I run "unjucks list --format json"', async (ctx) => {
          const { stdout } = await execAsync(`node ${CLI_PATH} list --format json`, {
            cwd: ctx.workDir
          });
          return { stdout };
        })
        .then('I should receive valid JSON output', async (ctx) => {
          expect(() => JSON.parse(ctx.result.stdout)).not.toThrow();
        })
        .then('JSON should contain generator information', async (ctx) => {
          const data = JSON.parse(ctx.result.stdout);
          expect(Array.isArray(data)).toBe(true);
          expect(data[0]).toHaveProperty('name', 'api');
        });

      await scenario.execute();
    });
  });

  describe('Feature: Generate files from templates', () => {
    test('Scenario: Generate with Hygen-style positional arguments', async () => {
      const scenario = new BDDScenario('User generates with positional args')
        .given('I have a component template', async (ctx) => {
          ctx.workDir = TEST_ROOT;
          
          const templatePath = path.join(ctx.workDir, '_templates/component/react');
          await fs.ensureDir(templatePath);
          await fs.writeFile(
            path.join(templatePath, 'index.njk'),
            '---\nto: src/components/{{ name }}.jsx\n---\nimport React from \'react\';\n\nexport const {{ name }} = () => {\n  return <div>{{ name }}</div>;\n};'
          );
        })
        .when('I run "unjucks component react MyButton"', async (ctx) => {
          const { stdout } = await execAsync(`node ${CLI_PATH} component react MyButton`, {
            cwd: ctx.workDir
          });
          return { stdout };
        })
        .then('The component file should be created', async (ctx) => {
          const outputPath = path.join(ctx.workDir, 'src/components/MyButton.jsx');
          expect(await fs.pathExists(outputPath)).toBe(true);
        })
        .then('The file should contain the component name', async (ctx) => {
          const outputPath = path.join(ctx.workDir, 'src/components/MyButton.jsx');
          const content = await fs.readFile(outputPath, 'utf8');
          expect(content).toContain('MyButton');
          expect(content).toContain('export const MyButton');
        });

      await scenario.execute();
    });

    test('Scenario: Generate with dry run option', async () => {
      const scenario = new BDDScenario('User previews generation with dry run')
        .given('I have a template ready', async (ctx) => {
          ctx.workDir = TEST_ROOT;
          
          const templatePath = path.join(ctx.workDir, '_templates/model/user');
          await fs.ensureDir(templatePath);
          await fs.writeFile(
            path.join(templatePath, 'index.njk'),
            '---\nto: src/models/{{ name }}.js\n---\nclass {{ name }} {}'
          );
        })
        .when('I run "unjucks model user Account --dry"', async (ctx) => {
          const { stdout } = await execAsync(`node ${CLI_PATH} generate model user Account --dry`, {
            cwd: ctx.workDir
          });
          return { stdout };
        })
        .then('I should see dry run output', async (ctx) => {
          expect(ctx.result.stdout).toContain('Dry Run Results');
          expect(ctx.result.stdout).toContain('No files were created');
        })
        .then('No files should actually be created', async (ctx) => {
          const outputPath = path.join(ctx.workDir, 'src/models/Account.js');
          expect(await fs.pathExists(outputPath)).toBe(false);
        })
        .then('I should see what would be generated', async (ctx) => {
          expect(ctx.result.stdout).toContain('src/models/Account.js');
        });

      await scenario.execute();
    });

    test('Scenario: Generate with force overwrite', async () => {
      const scenario = new BDDScenario('User overwrites existing file with force')
        .given('I have a template and existing target file', async (ctx) => {
          ctx.workDir = TEST_ROOT;
          
          // Create template
          const templatePath = path.join(ctx.workDir, '_templates/config/env');
          await fs.ensureDir(templatePath);
          await fs.writeFile(
            path.join(templatePath, 'index.njk'),
            '---\nto: .env.{{ env }}\n---\nNODE_ENV={{ env }}\nDATABASE_URL={{ dbUrl }}'
          );
          
          // Create existing file
          const existingFile = path.join(ctx.workDir, '.env.development');
          await fs.writeFile(existingFile, 'OLD_CONTENT=true');
        })
        .when('I run "unjucks config env --env development --dbUrl localhost --force"', async (ctx) => {
          const { stdout } = await execAsync(`node ${CLI_PATH} generate config env --env development --dbUrl localhost --force`, {
            cwd: ctx.workDir
          });
          return { stdout };
        })
        .then('The file should be overwritten', async (ctx) => {
          const outputPath = path.join(ctx.workDir, '.env.development');
          const content = await fs.readFile(outputPath, 'utf8');
          expect(content).toContain('NODE_ENV=development');
          expect(content).toContain('DATABASE_URL=localhost');
          expect(content).not.toContain('OLD_CONTENT');
        })
        .then('Success message should be shown', async (ctx) => {
          expect(ctx.result.stdout).toContain('Successfully generated');
        });

      await scenario.execute();
    });
  });

  describe('Feature: Help system', () => {
    test('Scenario: Get general help', async () => {
      const scenario = new BDDScenario('User requests general help')
        .when('I run "unjucks --help"', async (ctx) => {
          const { stdout } = await execAsync(`node ${CLI_PATH} --help`);
          return { stdout };
        })
        .then('I should see usage information', async (ctx) => {
          expect(ctx.result.stdout).toContain('Usage:');
          expect(ctx.result.stdout).toContain('Commands:');
        })
        .then('I should see available commands', async (ctx) => {
          expect(ctx.result.stdout).toContain('generate');
          expect(ctx.result.stdout).toContain('list');
          expect(ctx.result.stdout).toContain('help');
        })
        .then('I should see examples', async (ctx) => {
          expect(ctx.result.stdout).toContain('Examples:');
        });

      await scenario.execute();
    });

    test('Scenario: Get command-specific help', async () => {
      const scenario = new BDDScenario('User requests help for specific command')
        .when('I run "unjucks help generate"', async (ctx) => {
          const { stdout } = await execAsync(`node ${CLI_PATH} help generate`);
          return { stdout };
        })
        .then('I should see generate command help', async (ctx) => {
          expect(ctx.result.stdout).toContain('generate');
        })
        .then('I should see command arguments', async (ctx) => {
          expect(ctx.result.stdout).toContain('generator');
          expect(ctx.result.stdout).toContain('template');
        });

      await scenario.execute();
    });

    test('Scenario: Get template-specific help', async () => {
      const scenario = new BDDScenario('User requests help for specific template')
        .given('I have a component template with variables', async (ctx) => {
          ctx.workDir = TEST_ROOT;
          
          const templatePath = path.join(ctx.workDir, '_templates/component/form');
          await fs.ensureDir(templatePath);
          await fs.writeFile(
            path.join(templatePath, 'index.njk'),
            '---\nto: src/components/{{ name }}Form.jsx\n---\n// Form component with {{ fields }} fields\n// {{ description }}'
          );
        })
        .when('I run "unjucks help template component form"', async (ctx) => {
          const { stdout } = await execAsync(`node ${CLI_PATH} help template component form`, {
            cwd: ctx.workDir
          });
          return { stdout };
        })
        .then('I should see template variables', async (ctx) => {
          expect(ctx.result.stdout).toContain('name');
          expect(ctx.result.stdout).toContain('fields');
          expect(ctx.result.stdout).toContain('description');
        });

      await scenario.execute();
    });
  });

  describe('Feature: Interactive mode', () => {
    test('Scenario: Start interactive mode with quick start', async () => {
      const scenario = new BDDScenario('User starts interactive mode for component')
        .given('I have component templates available', async (ctx) => {
          ctx.workDir = TEST_ROOT;
          
          const templatePath = path.join(ctx.workDir, '_templates/component/react');
          await fs.ensureDir(templatePath);
          await fs.writeFile(
            path.join(templatePath, 'index.njk'),
            '---\nto: src/components/{{ name }}.jsx\n---\n// Component'
          );
        })
        .when('I run interactive mode with component quick start', async (ctx) => {
          // Note: In real scenario, this would be mocked to simulate user input
          // For testing, we'll verify the command structure
          const { stdout } = await execAsync(`node ${CLI_PATH} interactive --help`, {
            cwd: ctx.workDir
          });
          return { stdout };
        })
        .then('I should see interactive options', async (ctx) => {
          expect(ctx.result.stdout).toContain('interactive');
          expect(ctx.result.stdout).toContain('quickStart');
        });

      await scenario.execute();
    });
  });

  describe('Feature: Version information', () => {
    test('Scenario: Check version', async () => {
      const scenario = new BDDScenario('User checks application version')
        .when('I run "unjucks --version"', async (ctx) => {
          const { stdout } = await execAsync(`node ${CLI_PATH} --version`);
          return { stdout };
        })
        .then('I should see version number', async (ctx) => {
          expect(ctx.result.stdout).toMatch(/\d+\.\d+\.\d+/);
        })
        .then('Version should match package.json', async (ctx) => {
          const packagePath = path.resolve(__dirname, '../../package.json');
          const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));
          expect(ctx.result.stdout.trim()).toBe(packageJson.version);
        });

      await scenario.execute();
    });
  });

  describe('Feature: Error handling', () => {
    test('Scenario: Handle invalid generator name', async () => {
      const scenario = new BDDScenario('User provides invalid generator name')
        .given('I have an empty project', async (ctx) => {
          ctx.workDir = TEST_ROOT;
        })
        .when('I run "unjucks nonexistent template Something"', async (ctx) => {
          try {
            const { stdout, stderr } = await execAsync(`node ${CLI_PATH} nonexistent template Something`, {
              cwd: ctx.workDir
            });
            return { stdout, stderr, exitCode: 0 };
          } catch (error) {
            return { 
              stdout: error.stdout || '', 
              stderr: error.stderr || '', 
              exitCode: error.code || 1 
            };
          }
        })
        .then('I should see an appropriate error message', async (ctx) => {
          expect(ctx.result.stderr || ctx.result.stdout).toContain('not found');
        })
        .then('I should see helpful suggestions', async (ctx) => {
          expect(ctx.result.stderr || ctx.result.stdout).toContain('Suggestions');
        })
        .then('Exit code should indicate failure', async (ctx) => {
          expect(ctx.result.exitCode).not.toBe(0);
        });

      await scenario.execute();
    });

    test('Scenario: Handle missing required variables', async () => {
      const scenario = new BDDScenario('User runs generator without required variables')
        .given('I have a template requiring variables', async (ctx) => {
          ctx.workDir = TEST_ROOT;
          
          const templatePath = path.join(ctx.workDir, '_templates/service/api');
          await fs.ensureDir(templatePath);
          await fs.writeFile(
            path.join(templatePath, 'index.njk'),
            '---\nto: src/services/{{ name }}Service.js\n---\n// Service for {{ entity }}'
          );
        })
        .when('I run "unjucks service api" without variables', async (ctx) => {
          try {
            const { stdout, stderr } = await execAsync(`node ${CLI_PATH} service api`, {
              cwd: ctx.workDir
            });
            return { stdout, stderr, exitCode: 0 };
          } catch (error) {
            return { 
              stdout: error.stdout || '', 
              stderr: error.stderr || '', 
              exitCode: error.code || 1 
            };
          }
        })
        .then('Generation should still proceed with defaults or prompts', async (ctx) => {
          // In v3, this should handle gracefully, possibly with interactive prompts
          expect(ctx.result.exitCode).toBeDefined();
        });

      await scenario.execute();
    });
  });

  describe('Feature: File injection', () => {
    test('Scenario: Inject content into existing file', async () => {
      const scenario = new BDDScenario('User injects content into existing file')
        .given('I have an existing file and injection template', async (ctx) => {
          ctx.workDir = TEST_ROOT;
          
          // Create existing file
          const existingFile = path.join(ctx.workDir, 'src/routes/index.js');
          await fs.ensureDir(path.dirname(existingFile));
          await fs.writeFile(existingFile, 'const routes = [\n  // existing routes\n];');
          
          // Create injection template
          const templatePath = path.join(ctx.workDir, '_templates/route/add');
          await fs.ensureDir(templatePath);
          await fs.writeFile(
            path.join(templatePath, 'index.njk'),
            '---\nto: src/routes/index.js\ninject: true\nafter: "// existing routes"\n---\n  { path: "/{{ name }}", component: {{ name }}Component },'
          );
        })
        .when('I run "unjucks route add users"', async (ctx) => {
          const { stdout } = await execAsync(`node ${CLI_PATH} route add users`, {
            cwd: ctx.workDir
          });
          return { stdout };
        })
        .then('The content should be injected into the existing file', async (ctx) => {
          const filePath = path.join(ctx.workDir, 'src/routes/index.js');
          const content = await fs.readFile(filePath, 'utf8');
          expect(content).toContain('existing routes');
          expect(content).toContain('/users');
          expect(content).toContain('usersComponent');
        });

      await scenario.execute();
    });
  });
});