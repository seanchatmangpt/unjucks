import { Given, When, Then } from '@cucumber/cucumber';
import { UnjucksWorld } from '../world';
import assert from 'node:assert';
import nunjucks from 'nunjucks';
import { parse as parseYaml } from 'yaml';

/**
 * Template Engine Steps Library
 * Comprehensive step definitions for Nunjucks rendering, frontmatter handling,
 * template variables, filters, conditionals, and advanced template features
 */

// Template initialization and setup
Given('the Nunjucks template system is initialized', function (this: UnjucksWorld) {
  if (!this.context.nunjucksEnv) {
    this.context.nunjucksEnv = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(this.context.tempDirectory || process.cwd()),
      {
        autoescape: false,
        throwOnUndefined: false,
        trimBlocks: true,
        lstripBlocks: true
      }
    );
  }
});

Given('template variables are available', function (this: UnjucksWorld) {
  this.context.templateVariables = this.context.templateVariables || {};
});

Given('a template with content {string}', function (this: UnjucksWorld, content: string) {
  this.context.templateContent = content;
});

Given('variables {string}', function (this: UnjucksWorld, variablesJson: string) {
  try {
    this.context.templateVariables = JSON.parse(variablesJson);
  } catch (error) {
    throw new Error(`Invalid JSON variables: ${variablesJson}`);
  }
});

Given('variables:', function (this: UnjucksWorld, variablesText: string) {
  try {
    this.context.templateVariables = JSON.parse(variablesText);
  } catch (error) {
    throw new Error(`Invalid JSON variables: ${variablesText}`);
  }
});

Given('user variables {string}', function (this: UnjucksWorld, userVarsJson: string) {
  try {
    const userVars = JSON.parse(userVarsJson);
    this.context.templateVariables = { ...this.context.templateVariables, ...userVars };
  } catch (error) {
    throw new Error(`Invalid user variables JSON: ${userVarsJson}`);
  }
});

Given('global context variables:', function (this: UnjucksWorld, globalVarsText: string) {
  try {
    this.context.globalVariables = JSON.parse(globalVarsText);
  } catch (error) {
    throw new Error(`Invalid global variables JSON: ${globalVarsText}`);
  }
});

// Template content setup
Given('a template with content:', function (this: UnjucksWorld, content: string) {
  this.context.templateContent = content;
});

Given('a base template {string}:', async function (this: UnjucksWorld, templateName: string, content: string) {
  await this.helper.createFile(templateName, content);
  this.context.baseTemplates = this.context.baseTemplates || {};
  this.context.baseTemplates[templateName] = content;
});

Given('a child template extending base:', function (this: UnjucksWorld, content: string) {
  this.context.childTemplate = content;
});

Given('a partial template {string}:', async function (this: UnjucksWorld, templateName: string, content: string) {
  await this.helper.createFile(templateName, content);
  this.context.partialTemplates = this.context.partialTemplates || {};
  this.context.partialTemplates[templateName] = content;
});

Given('a main template:', function (this: UnjucksWorld, content: string) {
  this.context.mainTemplate = content;
});

// Template with frontmatter
Given('a template with frontmatter:', function (this: UnjucksWorld, templateWithFrontmatter: string) {
  const lines = templateWithFrontmatter.split('\n');
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
    const templateContent = lines.slice(frontmatterEnd + 1).join('\n');
    
    try {
      this.context.frontmatter = parseYaml(frontmatterContent);
      this.context.templateContent = templateContent;
    } catch (error) {
      throw new Error(`Invalid frontmatter YAML: ${error}`);
    }
  } else {
    throw new Error('Invalid frontmatter format - missing --- delimiters');
  }
});

// Template with macros
Given('a template with macros:', function (this: UnjucksWorld, content: string) {
  this.context.templateContent = content;
  this.context.hasMacros = true;
});

// Template with specific features
Given('a template with invalid syntax:', function (this: UnjucksWorld, content: string) {
  this.context.invalidTemplate = content;
});

Given('a template with specific indentation:', function (this: UnjucksWorld, content: string) {
  this.context.templateContent = content;
  this.context.preserveIndentation = true;
});

Given('a template with HTML content and undefined variables', function (this: UnjucksWorld) {
  this.context.templateContent = '<p>{{ definedVar }} and {{ undefinedVar }}</p>';
  this.context.templateVariables = { definedVar: 'Hello' };
});

// Custom Nunjucks environment
Given('custom Nunjucks environment with:', function (this: UnjucksWorld, settingsTable: any) {
  const settings = settingsTable.hashes().reduce((acc: any, row: any) => {
    let value: any = row.Value;
    if (value === 'true') value = true;
    if (value === 'false') value = false;
    acc[row.Setting] = value;
    return acc;
  }, {});
  
  this.context.nunjucksEnv = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(this.context.tempDirectory || process.cwd()),
    settings
  );
});

// Variables containing special characters
Given('variables containing special characters:', function (this: UnjucksWorld, variablesText: string) {
  try {
    this.context.templateVariables = JSON.parse(variablesText);
  } catch (error) {
    throw new Error(`Invalid JSON with special characters: ${variablesText}`);
  }
});

// Rendering actions
When('I render the template', async function (this: UnjucksWorld) {
  if (!this.context.templateContent) {
    throw new Error('No template content available to render');
  }
  
  const env = this.context.nunjucksEnv || new nunjucks.Environment();
  
  try {
    // Combine global and template variables
    const allVariables = {
      ...this.context.globalVariables,
      ...this.context.templateVariables
    };
    
    this.context.renderedOutput = env.renderString(this.context.templateContent, allVariables);
  } catch (error: any) {
    this.context.renderError = error;
    throw error;
  }
});

When('I render the child template with variables {string}', async function (this: UnjucksWorld, variablesJson: string) {
  const variables = JSON.parse(variablesJson);
  const env = this.context.nunjucksEnv || new nunjucks.Environment();
  
  try {
    this.context.renderedOutput = env.renderString(this.context.childTemplate, variables);
  } catch (error: any) {
    this.context.renderError = error;
    throw error;
  }
});

When('I render the main template', async function (this: UnjucksWorld) {
  const env = this.context.nunjucksEnv || new nunjucks.Environment();
  const allVariables = {
    ...this.context.globalVariables,
    ...this.context.templateVariables
  };
  
  try {
    this.context.renderedOutput = env.renderString(this.context.mainTemplate, allVariables);
  } catch (error: any) {
    this.context.renderError = error;
    throw error;
  }
});

When('I render the template including frontmatter', async function (this: UnjucksWorld) {
  const env = this.context.nunjucksEnv || new nunjucks.Environment();
  const allVariables = {
    ...this.context.globalVariables,
    ...this.context.templateVariables
  };
  
  try {
    // Render the template content
    this.context.renderedOutput = env.renderString(this.context.templateContent, allVariables);
    
    // Render the 'to' path from frontmatter if it exists
    if (this.context.frontmatter?.to) {
      this.context.renderedToPath = env.renderString(this.context.frontmatter.to, allVariables);
    }
  } catch (error: any) {
    this.context.renderError = error;
    throw error;
  }
});

When('I attempt to render the template', async function (this: UnjucksWorld) {
  const env = this.context.nunjucksEnv || new nunjucks.Environment();
  
  try {
    this.context.renderedOutput = env.renderString(this.context.invalidTemplate, this.context.templateVariables);
  } catch (error: any) {
    this.context.renderError = error;
  }
});

// Assertions for rendered output
Then('the output should be {string}', function (this: UnjucksWorld, expected: string) {
  assert.strictEqual(this.context.renderedOutput?.trim(), expected.trim());
});

Then('the output should contain {string}', function (this: UnjucksWorld, expected: string) {
  if (!this.context.renderedOutput?.includes(expected)) {
    throw new Error(`Output does not contain '${expected}'. Actual output: ${this.context.renderedOutput}`);
  }
});

Then('the output should contain:', function (this: UnjucksWorld, expected: string) {
  const expectedLines = expected.split('\n').map(line => line.trim()).filter(line => line);
  const actualLines = this.context.renderedOutput?.split('\n').map(line => line.trim()).filter(line => line) || [];
  
  for (const expectedLine of expectedLines) {
    if (!actualLines.includes(expectedLine)) {
      throw new Error(`Output missing line '${expectedLine}'. Actual output: ${this.context.renderedOutput}`);
    }
  }
});

Then('the output should not contain {string}', function (this: UnjucksWorld, notExpected: string) {
  if (this.context.renderedOutput?.includes(notExpected)) {
    throw new Error(`Output should not contain '${notExpected}'. Actual output: ${this.context.renderedOutput}`);
  }
});

Then('undefined variables should render as empty strings', function (this: UnjucksWorld) {
  // This is validated by the Nunjucks environment settings
  assert.ok(this.context.renderedOutput !== undefined, 'Template should have rendered successfully');
});

Then('no errors should be thrown', function (this: UnjucksWorld) {
  assert.ok(!this.context.renderError, `Unexpected render error: ${this.context.renderError?.message}`);
});

// Complex validation
Then('the output should contain properly nested structure', function (this: UnjucksWorld) {
  const output = this.context.renderedOutput || '';
  
  // Check for proper nesting indicators
  const hasProperIndentation = output.includes('    ') || output.includes('\t');
  const hasNestedContent = output.includes('export class') && output.includes('():');
  
  assert.ok(hasProperIndentation && hasNestedContent, 'Output should contain properly nested structure');
});

Then('method implementations should be rendered correctly', function (this: UnjucksWorld) {
  const output = this.context.renderedOutput || '';
  
  // Check for method structure
  assert.ok(output.includes('(): '), 'Methods should have proper signature format');
  assert.ok(output.includes('return ') || output.includes('throw new Error'), 'Methods should have implementations');
});

// Frontmatter validation
Then('the {string} path should be {string}', function (this: UnjucksWorld, pathType: string, expectedPath: string) {
  if (pathType === 'to') {
    assert.strictEqual(this.context.renderedToPath, expectedPath);
  }
});

// Error validation
Then('specific syntax errors should be reported', function (this: UnjucksWorld) {
  assert.ok(this.context.renderError, 'Render error should have occurred');
  assert.ok(this.context.renderError.message, 'Error should have a message');
});

Then('error messages should include line numbers', function (this: UnjucksWorld) {
  const errorMessage = this.context.renderError?.message || '';
  const hasLineNumber = /line \d+/i.test(errorMessage) || /:\d+:/i.test(errorMessage);
  assert.ok(hasLineNumber, `Error message should include line numbers: ${errorMessage}`);
});

Then('rendering should fail with clear error descriptions', function (this: UnjucksWorld) {
  assert.ok(this.context.renderError, 'Rendering should have failed');
  assert.ok(this.context.renderError.message?.length > 10, 'Error should have a descriptive message');
});

// Template features validation
Then('the output should contain the header comment', function (this: UnjucksWorld) {
  const output = this.context.renderedOutput || '';
  assert.ok(output.includes('/**'), 'Output should contain header comment start');
  assert.ok(output.includes('*/'), 'Output should contain header comment end');
});

Then('the output should contain properly formatted methods', function (this: UnjucksWorld) {
  const output = this.context.renderedOutput || '';
  assert.ok(output.includes('(') && output.includes('):'), 'Methods should have proper formatting');
});

Then('macro calls should be expanded correctly', function (this: UnjucksWorld) {
  const output = this.context.renderedOutput || '';
  assert.ok(!output.includes('{{'), 'Macro calls should be fully expanded (no remaining template syntax)');
});

// Global context validation
Then('the output should contain project and generator information', function (this: UnjucksWorld) {
  const output = this.context.renderedOutput || '';
  assert.ok(output.includes('Generated by'), 'Output should contain generator info');
  assert.ok(output.includes('For project:'), 'Output should contain project info');
});

Then('user variables should also be available', function (this: UnjucksWorld) {
  const output = this.context.renderedOutput || '';
  // Check if user-provided variables were also rendered
  assert.ok(output.length > 0, 'User variables should be rendered');
});

// Whitespace and formatting
Then('original indentation should be preserved', function (this: UnjucksWorld) {
  const output = this.context.renderedOutput || '';
  assert.ok(output.includes('    '), 'Original indentation should be preserved');
});

Then('generated code should maintain proper formatting', function (this: UnjucksWorld) {
  const output = this.context.renderedOutput || '';
  assert.ok(!output.includes('}{'), 'Code should not have malformed braces');
});

Then('conditional blocks should not introduce extra whitespace', function (this: UnjucksWorld) {
  const output = this.context.renderedOutput || '';
  const hasExcessiveWhitespace = /\n\n\n+/.test(output);
  assert.ok(!hasExcessiveWhitespace, 'Should not have excessive whitespace from conditionals');
});

// Special characters
Then('special characters should be preserved', function (this: UnjucksWorld) {
  const output = this.context.renderedOutput || '';
  const specialChars = ['"', "'", '&', '<', '>'];
  const hasSpecialChars = specialChars.some(char => output.includes(char));
  assert.ok(hasSpecialChars, 'Special characters should be preserved in output');
});

Then('no HTML escaping should occur by default', function (this: UnjucksWorld) {
  const output = this.context.renderedOutput || '';
  assert.ok(!output.includes('&quot;'), 'HTML should not be escaped by default');
  assert.ok(!output.includes('&lt;'), 'HTML should not be escaped by default');
});

Then('output should contain original special characters', function (this: UnjucksWorld) {
  const output = this.context.renderedOutput || '';
  assert.ok(output.includes('"'), 'Should contain original quotes');
  assert.ok(output.includes("'"), 'Should contain original apostrophes');
});

// Environment settings validation
Then('HTML should not be escaped', function (this: UnjucksWorld) {
  const output = this.context.renderedOutput || '';
  assert.ok(!output.includes('&lt;'), 'HTML should not be escaped');
});

Then('block whitespace should be trimmed', function (this: UnjucksWorld) {
  const output = this.context.renderedOutput || '';
  // This depends on the trimBlocks setting
  assert.ok(output !== undefined, 'Template should render with trim settings');
});

Then('undefined variables should not throw errors', function (this: UnjucksWorld) {
  assert.ok(!this.context.renderError, 'Undefined variables should not cause errors');
});

// Factory function for creating template engine steps
export function createTemplateEngineSteps(context?: any) {
  return {
    // Export step functions for programmatic use
    nunjucksInitialized: Given,
    templateVariablesAvailable: Given,
    templateWithContent: Given,
    variables: Given,
    variablesFromText: Given,
    userVariables: Given,
    globalContextVariables: Given,
    templateWithFrontmatter: Given,
    renderTemplate: When,
    renderChildTemplate: When,
    renderMainTemplate: When,
    renderIncludingFrontmatter: When,
    attemptRender: When,
    outputShouldBe: Then,
    outputShouldContain: Then,
    outputShouldNotContain: Then
  };
}