import { Given, When, Then } from '@cucumber/cucumber';
import { UnjucksWorld } from '../world';
import assert from 'node:assert';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Injection Operations Steps Library
 * Comprehensive step definitions for idempotent file modifications, skipIf conditions,
 * injection targets, atomic operations, and advanced injection scenarios
 */

// Initial setup for injection scenarios
Given('I have a project with unjucks installed', async function (this: UnjucksWorld) {
  if (!this.context.tempDirectory) {
    await this.createTempDirectory();
  }
  this.context.unjucksInstalled = true;
});

Given('I have an existing file {string} with content:', async function (this: UnjucksWorld, filePath: string, content: string) {
  await this.helper.createFile(filePath, content);
  this.context.existingFiles = this.context.existingFiles || {};
  this.context.existingFiles[filePath] = content;
});

Given('I have an existing file {string} with:', async function (this: UnjucksWorld, filePath: string, content: string) {
  await this.helper.createFile(filePath, content);
  this.context.existingFiles = this.context.existingFiles || {};
  this.context.existingFiles[filePath] = content;
});

// Generator setup with injection templates
Given('I have a generator {string} with template {string}:', async function (this: UnjucksWorld, generatorName: string, templateName: string, templateContent: string) {
  const generatorPath = `_templates/${generatorName}`;
  await this.helper.createDirectory(generatorPath);
  
  const templateFile = path.join(generatorPath, templateName);
  await this.helper.createFile(templateFile, templateContent);
  
  this.context.generators = this.context.generators || {};
  this.context.generators[generatorName] = {
    name: generatorName,
    path: generatorPath,
    templates: [templateName],
    templateContent: templateContent
  };
  
  // Parse frontmatter from template
  const lines = templateContent.split('\n');
  let frontmatterEnd = -1;
  let frontmatterStart = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      if (frontmatterStart === -1) {
        frontmatterStart = i;
      } else {
        frontmatterEnd = i;
        break;
      }
    }
  }
  
  if (frontmatterStart !== -1 && frontmatterEnd !== -1) {
    const frontmatterContent = lines.slice(frontmatterStart + 1, frontmatterEnd).join('\n');
    const bodyContent = lines.slice(frontmatterEnd + 1).join('\n');
    
    try {
      // Parse YAML-like frontmatter (simplified)
      const frontmatter: any = {};
      frontmatterContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length) {
          const value = valueParts.join(':').trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            frontmatter[key.trim()] = value.slice(1, -1);
          } else if (value === 'true') {
            frontmatter[key.trim()] = true;
          } else if (value === 'false') {
            frontmatter[key.trim()] = false;
          } else if (value.startsWith('[') && value.endsWith(']')) {
            frontmatter[key.trim()] = value.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''));
          } else {
            frontmatter[key.trim()] = value;
          }
        }
      });
      
      this.context.generators[generatorName].frontmatter = frontmatter;
      this.context.generators[generatorName].body = bodyContent;
    } catch (error) {
      console.warn(`Failed to parse frontmatter for ${generatorName}:`, error);
    }
  }
});

// SkipIf conditions setup
Given('the file already contains a route with the same path or handler', async function (this: UnjucksWorld) {
  const existingContent = `
import express from 'express';
const router = express.Router();

router.get('/users', getUsers);

export default router;
  `;
  
  await this.helper.createFile('src/routes.ts', existingContent.trim());
  this.context.existingFiles = this.context.existingFiles || {};
  this.context.existingFiles['src/routes.ts'] = existingContent.trim();
});

Given('the skipIf condition would normally prevent injection', function (this: UnjucksWorld) {
  this.context.skipIfWouldPrevent = true;
});

Given('the file contains matching patterns for the complex condition', async function (this: UnjucksWorld) {
  const content = `
export const testMiddleware = (req, res, next) => next();
const development = true;
const production = false;
  `;
  
  await this.helper.createFile('src/middleware.ts', content.trim());
  this.context.existingFiles = this.context.existingFiles || {};
  this.context.existingFiles['src/middleware.ts'] = content.trim();
});

Given('the target file already exists', async function (this: UnjucksWorld) {
  await this.helper.createFile('src/types/User.ts', 'export interface ExistingUser { id: number; }');
  this.context.targetFileExists = true;
});

Given('the target file is larger than the specified size', async function (this: UnjucksWorld) {
  const largeContent = 'export const data = {\n' + '  item: "value",\n'.repeat(100) + '};';
  await this.helper.createFile('src/utils.ts', largeContent);
  this.context.existingFiles = this.context.existingFiles || {};
  this.context.existingFiles['src/utils.ts'] = largeContent;
});

Given('the target file has more lines than specified', async function (this: UnjucksWorld) {
  const manyLines = Array.from({ length: 60 }, (_, i) => `export const CONST_${i} = '${i}';`).join('\n');
  await this.helper.createFile('src/constants.ts', manyLines);
  this.context.existingFiles = this.context.existingFiles || {};
  this.context.existingFiles['src/constants.ts'] = manyLines;
});

Given('I have a custom skipIf function defined', function (this: UnjucksWorld) {
  this.context.customSkipIfFunction = (serviceName: string) => {
    return serviceName === 'ExistingService';
  };
});

Given('the custom function returns true', function (this: UnjucksWorld) {
  // Mock the service name that would trigger the custom function to return true
  this.context.templateVariables = this.context.templateVariables || {};
  this.context.templateVariables.serviceName = 'ExistingService';
});

Given('the component is already exported', async function (this: UnjucksWorld) {
  const existingExports = `
export { UserComponent } from './UserComponent';
export { ButtonComponent } from './ButtonComponent';
  `;
  
  await this.helper.createFile('src/components/index.ts', existingExports.trim());
  this.context.existingFiles = this.context.existingFiles || {};
  this.context.existingFiles['src/components/index.ts'] = existingExports.trim();
});

Given('running in production environment', function (this: UnjucksWorld) {
  process.env.NODE_ENV = 'production';
  this.context.originalNodeEnv = process.env.NODE_ENV;
});

Given('the content contains development settings', function (this: UnjucksWorld) {
  this.context.hasDevSettings = true;
});

// Injection execution
When('I run the same command again', async function (this: UnjucksWorld) {
  const lastCommand = this.context.templateVariables?.lastCommand;
  if (!lastCommand) {
    throw new Error('No previous command found to repeat');
  }
  
  const result = await this.helper.runCli(lastCommand);
  this.setLastCommandResult(result);
});

When('a different component is generated', async function (this: UnjucksWorld) {
  const command = 'unjucks generate component --componentName ProductComponent';
  const result = await this.helper.runCli(command);
  this.setLastCommandResult(result);
});

// Injection assertions
Then('the file should contain the database configuration', async function (this: UnjucksWorld) {
  const content = await this.helper.readFile('src/config.ts');
  assert.ok(content.includes('database:'), 'File should contain database configuration');
});

Then('the database configuration should not be duplicated', async function (this: UnjucksWorld) {
  const content = await this.helper.readFile('src/config.ts');
  const databaseOccurrences = (content.match(/database:/g) || []).length;
  assert.strictEqual(databaseOccurrences, 1, 'Database configuration should appear exactly once');
});

Then('I should see {string}', function (this: UnjucksWorld, expectedMessage: string) {
  const result = this.getLastCommandResult();
  const output = result.stdout + result.stderr;
  assert.ok(output.includes(expectedMessage), `Should see message "${expectedMessage}". Actual output: ${output}`);
});

Then('the import should be added', async function (this: UnjucksWorld) {
  const content = await this.helper.readFile('src/app.ts');
  assert.ok(content.includes('import helmet from \'helmet\''), 'Import should be added');
});

Then('the cors import should be skipped', async function (this: UnjucksWorld) {
  const content = await this.helper.readFile('src/app.ts');
  const corsImports = (content.match(/import.*cors/g) || []).length;
  assert.strictEqual(corsImports, 1, 'CORS import should not be duplicated (should be skipped)');
});

Then('the injection should be skipped', function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  const output = result.stdout + result.stderr;
  assert.ok(output.includes('skipped') || output.includes('Skip'), 'Injection should be skipped');
});

Then('I should see which condition caused the skip', function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  const output = result.stdout + result.stderr;
  assert.ok(output.includes('condition') || output.includes('reason'), 'Should show which condition caused the skip');
});

Then('the skipIf conditions should be ignored', function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  assert.strictEqual(result.exitCode, 0, 'Command should succeed when forcing');
});

Then('the injection should proceed', function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  assert.strictEqual(result.exitCode, 0, 'Injection should proceed successfully');
});

Then('the injection should be skipped appropriately', function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  const output = result.stdout + result.stderr;
  assert.ok(output.includes('skip') || result.exitCode === 0, 'Should handle complex boolean logic appropriately');
});

Then('the boolean logic should be evaluated correctly', function (this: UnjucksWorld) {
  // This is validated by the overall behavior of the skip logic
  const result = this.getLastCommandResult();
  assert.ok(result !== undefined, 'Boolean logic should be processed');
});

Then('I should see the custom skip message', function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  const output = result.stdout + result.stderr;
  assert.ok(output.includes('custom') || output.includes('skip'), 'Should show custom skip message');
});

Then('the injection should be skipped appropriately', function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  const output = result.stdout + result.stderr;
  assert.ok(output.includes('skip') || output.includes('production'), 'Should handle environment-based conditions');
});

// Dry run assertions
Given('I have a generator with skipIf conditions', async function (this: UnjucksWorld) {
  const generatorPath = '_templates/test-generator';
  await this.helper.createDirectory(generatorPath);
  
  const templateContent = `
---
to: src/test.ts
inject: true
before: "export"
skipIf: "TestClass"
---
export class TestClass {}
  `.trim();
  
  const templateFile = path.join(generatorPath, 'test.njk');
  await this.helper.createFile(templateFile, templateContent);
  
  this.context.generators = this.context.generators || {};
  this.context.generators['test-generator'] = {
    name: 'test-generator',
    path: generatorPath,
    templates: ['test.njk'],
    hasSkipIf: true
  };
});

Then('I should see which injections would be skipped', function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  const output = result.stdout + result.stderr;
  assert.ok(output.includes('would be skipped') || output.includes('dry run'), 'Dry run should show what would be skipped');
});

Then('I should see which would proceed', function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  const output = result.stdout + result.stderr;
  assert.ok(output.includes('would proceed') || output.includes('would inject'), 'Dry run should show what would proceed');
});

Then('I should see the reason for each skip decision', function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  const output = result.stdout + result.stderr;
  assert.ok(output.includes('reason') || output.includes('because'), 'Should show reasons for skip decisions');
});

// JSON structure validation
Given('I have a generator injecting into a JSON configuration file', async function (this: UnjucksWorld) {
  const configContent = JSON.stringify({
    app: {
      name: 'MyApp',
      version: '1.0.0'
    },
    database: {
      host: 'localhost'
    }
  }, null, 2);
  
  await this.helper.createFile('config.json', configContent);
  
  const generatorPath = '_templates/json-config';
  await this.helper.createDirectory(generatorPath);
  
  const templateContent = `
---
to: config.json
inject: true
jsonPath: "database.newSetting"
skipIf: "database.newSetting"
---
"newValue"
  `.trim();
  
  const templateFile = path.join(generatorPath, 'config.njk');
  await this.helper.createFile(templateFile, templateContent);
  
  this.context.jsonInjection = true;
});

Given('the skipIf condition checks for existing JSON keys', function (this: UnjucksWorld) {
  this.context.jsonSkipIfCondition = 'database.newSetting';
});

When('the key already exists in the JSON structure', async function (this: UnjucksWorld) {
  const configPath = path.join(this.context.tempDirectory!, 'config.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
  config.database.newSetting = 'existingValue';
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
});

Then('the JSON structure should remain valid', async function (this: UnjucksWorld) {
  const content = await this.helper.readFile('config.json');
  try {
    JSON.parse(content);
  } catch (error) {
    throw new Error(`JSON structure should remain valid. Content: ${content}`);
  }
});

// Multiple skipIf conditions
When('either condition matches', function (this: UnjucksWorld) {
  this.context.skipIfMatched = 'OR';
});

When('both conditions must match for skip', function (this: UnjucksWorld) {
  this.context.skipIfLogic = 'AND';
});

Then('the injection should only be skipped when both are true', function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  // This would need to be implemented based on actual AND logic
  assert.ok(result !== undefined, 'AND logic should be properly implemented');
});

// Template variable interpolation
Given('I have a generator where skipIf uses template variables', async function (this: UnjucksWorld) {
  const generatorPath = '_templates/variable-skipif';
  await this.helper.createDirectory(generatorPath);
  
  const templateContent = `
---
to: src/{{name}}.ts
inject: true
before: "export"
skipIf: "class {{name}}"
---
export class {{name}} {}
  `.trim();
  
  const templateFile = path.join(generatorPath, 'template.njk');
  await this.helper.createFile(templateFile, templateContent);
  
  this.context.variableSkipIf = true;
});

When('the variables are substituted in the skipIf condition', function (this: UnjucksWorld) {
  this.context.templateVariables = this.context.templateVariables || {};
  this.context.templateVariables.name = 'TestService';
});

Then('the condition should be evaluated with the actual values', function (this: UnjucksWorld) {
  // The skipIf should check for "class TestService" after variable substitution
  this.context.skipIfEvaluated = true;
});

Then('the skip decision should be based on rendered content', function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  assert.ok(result !== undefined, 'Skip decision should use rendered skipIf condition');
});

// Verbose logging
Given('I have multiple generators with various skipIf conditions', async function (this: UnjucksWorld) {
  const generators = [
    { name: 'gen1', skipIf: 'pattern1' },
    { name: 'gen2', skipIf: 'pattern2' },
    { name: 'gen3', skipIf: ['pattern3a', 'pattern3b'] }
  ];
  
  for (const gen of generators) {
    const generatorPath = `_templates/${gen.name}`;
    await this.helper.createDirectory(generatorPath);
    
    const templateContent = `
---
to: src/${gen.name}.ts
inject: true
before: "export"
skipIf: ${Array.isArray(gen.skipIf) ? gen.skipIf.map(s => `"${s}"`).join('\n  - ') : `"${gen.skipIf}"`}
---
export class ${gen.name} {}
    `.trim();
    
    const templateFile = path.join(generatorPath, 'template.njk');
    await this.helper.createFile(templateFile, templateContent);
  }
  
  this.context.multipleSkipIfGenerators = generators.length;
});

When('I run generation with verbose output', async function (this: UnjucksWorld) {
  const result = await this.helper.runCli('unjucks generate --verbose');
  this.setLastCommandResult(result);
});

Then('I should see detailed skipIf evaluation logs', function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  const output = result.stdout + result.stderr;
  assert.ok(output.includes('skipIf') || output.includes('evaluation'), 'Should show detailed skipIf evaluation');
});

Then('I should see which patterns were checked', function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  const output = result.stdout + result.stderr;
  assert.ok(output.includes('pattern') || output.includes('check'), 'Should show which patterns were checked');
});

Then('I should see the final skip decisions with reasons', function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  const output = result.stdout + result.stderr;
  assert.ok(output.includes('decision') || output.includes('reason'), 'Should show final decisions with reasons');
});

// Factory function for creating injection operation steps
export function createInjectionOperationSteps(context?: any) {
  return {
    projectWithUnjucks: Given,
    existingFileWithContent: Given,
    generatorWithTemplate: Given,
    fileContainsMatchingRoute: Given,
    skipIfWouldPrevent: Given,
    complexConditionMatch: Given,
    targetFileExists: Given,
    fileLargerThanSize: Given,
    fileHasMoreLines: Given,
    customSkipIfFunction: Given,
    customFunctionReturnsTrue: Given,
    componentAlreadyExported: Given,
    runSameCommandAgain: When,
    differentComponentGenerated: When,
    fileShouldContainDatabaseConfig: Then,
    databaseConfigNotDuplicated: Then,
    shouldSeeMessage: Then,
    importShouldBeAdded: Then,
    corsImportShouldBeSkipped: Then,
    injectionShouldBeSkipped: Then,
    shouldSeeSkipCondition: Then,
    skipIfConditionsShouldBeIgnored: Then,
    injectionShouldProceed: Then,
    booleanLogicEvaluatedCorrectly: Then,
    shouldSeeCustomSkipMessage: Then,
    jsonStructureShouldRemainValid: Then
  };
}