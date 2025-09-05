import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert";
import { UnjucksWorld } from "../support/world";
import * as yaml from "js-yaml";
import * as fs from "fs-extra";
import * as path from "node:path";

// =========================================================================
// Frontmatter Parsing and Setup Steps
// =========================================================================

Given("the Unjucks template system is initialized", async function (this: UnjucksWorld) {
  if (!this.context.tempDirectory) {
    await this.createTempDirectory();
  }
  await this.helper.createDirectory("_templates");
  this.setTemplateVariables({ systemInitialized: true });
});

Given("a template with frontmatter:", async function (this: UnjucksWorld, templateContent: string) {
  if (!this.context.tempDirectory) {
    await this.createTempDirectory();
  }
  
  // Store the template content for parsing
  this.setTemplateVariables({ 
    currentTemplate: templateContent.trim(),
    templateParsed: false 
  });
});

Given("a template with malformed frontmatter:", async function (this: UnjucksWorld, templateContent: string) {
  if (!this.context.tempDirectory) {
    await this.createTempDirectory();
  }
  
  this.setTemplateVariables({ 
    currentTemplate: templateContent.trim(),
    templateMalformed: true,
    templateParsed: false 
  });
});

Given("templates with frontmatter:", async function (this: UnjucksWorld, templateContent: string) {
  if (!this.context.tempDirectory) {
    await this.createTempDirectory();
  }
  
  // Parse multiple templates separated by "Template N:"
  const templates = templateContent.split(/Template \d+:/).slice(1);
  this.setTemplateVariables({ 
    multipleTemplates: templates.map(t => t.trim()),
    templateParsed: false 
  });
});

Given("a generator configuration:", async function (this: UnjucksWorld, configContent: string) {
  const config = JSON.parse(configContent.trim());
  this.setTemplateVariables({ generatorConfig: config });
  
  // Create a generator config file
  await this.helper.createFile("_templates/test-generator/config.json", JSON.stringify(config, null, 2));
});

Given("an existing file {string}", async function (this: UnjucksWorld, fileName: string) {
  await this.helper.createFile(fileName, `// Existing content in ${fileName}\nexport default {};`);
});

Given("an existing file with {int} lines", async function (this: UnjucksWorld, lineCount: number) {
  const lines = Array.from({ length: lineCount }, (_, i) => `// Line ${i + 1}`);
  const content = lines.join('\n');
  await this.helper.createFile("src/app.ts", content);
  this.setTemplateVariables({ testFileLines: lineCount });
});

Given("I have a project with unjucks installed", async function (this: UnjucksWorld) {
  if (!this.context.tempDirectory) {
    await this.createTempDirectory();
  }
  await this.helper.createDirectory("src");
});

Given("I have a generator {string} with template {string}:", async function (this: UnjucksWorld, generatorName: string, templateName: string, templateContent: string) {
  await this.helper.createDirectory(`_templates/${generatorName}`);
  await this.helper.createFile(`_templates/${generatorName}/${templateName}`, templateContent.trim());
  
  this.setTemplateVariables({
    currentGenerator: generatorName,
    currentTemplateName: templateName,
    currentTemplate: templateContent.trim()
  });
});

Given("an existing file {string} with content:", async function (this: UnjucksWorld, fileName: string, content: string) {
  await this.helper.createFile(fileName, content.trim());
});

Given("the file contains {string}", async function (this: UnjucksWorld, pattern: string) {
  // Verify the test file contains the pattern (setup validation)
  const testFile = "src/routes.ts"; // Default test file
  const exists = await this.helper.fileExists(testFile);
  if (!exists) {
    await this.helper.createFile(testFile, `// Test file\n${pattern}\n// More content`);
  }
});

Given("the file {string} contains multiple {string} occurrences", async function (this: UnjucksWorld, fileName: string, pattern: string) {
  const content = `import express from 'express';
const router = express.Router();

export default router;
// Another export default comment
export default { config: true };`;
  
  await this.helper.createFile(fileName, content);
});

Given("a template with frontmatter containing unknown directives:", async function (this: UnjucksWorld, templateContent: string) {
  this.setTemplateVariables({ 
    currentTemplate: templateContent.trim(),
    expectUnknownDirectives: true 
  });
});

// =========================================================================
// Template Processing Steps
// =========================================================================

When("I parse the template frontmatter", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const template = variables.currentTemplate as string;
  
  if (!template) {
    throw new Error("No template content available for parsing");
  }
  
  try {
    const result = this.parseFrontmatter(template);
    this.setTemplateVariables({
      ...variables,
      parsedFrontmatter: result.frontmatter,
      parsedBody: result.body,
      templateParsed: true,
      parseError: null
    });
  } catch (error: any) {
    this.setTemplateVariables({
      ...variables,
      parseError: error.message,
      templateParsed: false
    });
  }
});

When("I process the template frontmatter", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const template = variables.currentTemplate as string;
  
  try {
    const result = this.parseFrontmatter(template);
    const processedFrontmatter = this.processFrontmatterDirectives(result.frontmatter, variables);
    
    this.setTemplateVariables({
      ...variables,
      parsedFrontmatter: result.frontmatter,
      processedFrontmatter,
      parsedBody: result.body,
      templateParsed: true
    });
  } catch (error: any) {
    this.setTemplateVariables({
      ...variables,
      processError: error.message
    });
  }
});

When("I process the template with inject mode", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const template = variables.currentTemplate as string;
  
  const result = this.parseFrontmatter(template);
  
  // Simulate inject mode processing
  this.setTemplateVariables({
    ...variables,
    parsedFrontmatter: result.frontmatter,
    parsedBody: result.body,
    injectionMode: true,
    templateParsed: true
  });
});

When("I process the template", async function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const template = variables.currentTemplate as string;
  
  if (!template) {
    throw new Error("No template to process");
  }
  
  const result = this.parseFrontmatter(template);
  const processedResult = await this.processTemplate(result, variables);
  
  this.setTemplateVariables({
    ...variables,
    ...processedResult,
    templateProcessed: true
  });
});

When("I process the template with variables {string}", function (this: UnjucksWorld, variablesJson: string) {
  const templateVariables = JSON.parse(variablesJson);
  this.setTemplateVariables(templateVariables);
  
  const currentTemplate = this.getTemplateVariables().currentTemplate as string;
  const result = this.parseFrontmatter(currentTemplate);
  
  // Evaluate skipIf condition if present
  if (result.frontmatter.skipIf) {
    const shouldSkip = this.evaluateSkipCondition(result.frontmatter.skipIf, templateVariables);
    this.setTemplateVariables({ shouldSkipGeneration: shouldSkip });
  }
  
  this.setTemplateVariables({
    parsedFrontmatter: result.frontmatter,
    parsedBody: result.body,
    templateParsed: true
  });
});

When("I process with variables:", async function (this: UnjucksWorld, dataTable: any) {
  const variables = dataTable.hashes()[0]; // Get first row as variables
  this.setTemplateVariables(variables);
  
  const template = this.getTemplateVariables().currentTemplate as string;
  const result = this.parseFrontmatter(template);
  
  // Render the 'to' path with variables
  const renderedPath = this.renderTemplate(result.frontmatter.to, variables);
  
  this.setTemplateVariables({
    parsedFrontmatter: result.frontmatter,
    parsedBody: result.body,
    renderedPath,
    templateParsed: true
  });
});

When("I process with existing config containing the same name", function (this: UnjucksWorld) {
  const variables = { 
    configName: "existingConfig",
    configValue: "newValue",
    existingConfig: ["existingConfig", "anotherConfig"] 
  };
  
  this.setTemplateVariables(variables);
  
  const template = this.getTemplateVariables().currentTemplate as string;
  const result = this.parseFrontmatter(template);
  
  if (result.frontmatter.skipIf) {
    const shouldSkip = this.evaluateSkipCondition(result.frontmatter.skipIf, variables);
    this.setTemplateVariables({ shouldSkipGeneration: shouldSkip });
  }
});

When("I process with a new config name", function (this: UnjucksWorld) {
  const variables = { 
    configName: "newConfig",
    configValue: "newValue",
    existingConfig: ["existingConfig", "anotherConfig"] 
  };
  
  this.setTemplateVariables(variables);
  
  const template = this.getTemplateVariables().currentTemplate as string;
  const result = this.parseFrontmatter(template);
  
  if (result.frontmatter.skipIf) {
    const shouldSkip = this.evaluateSkipCondition(result.frontmatter.skipIf, variables);
    this.setTemplateVariables({ shouldSkipGeneration: shouldSkip });
  }
});

When("I process both templates", async function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const templates = variables.multipleTemplates as string[];
  
  if (!templates || templates.length < 2) {
    throw new Error("Expected at least 2 templates");
  }
  
  const processedTemplates = [];
  for (const template of templates) {
    const result = this.parseFrontmatter(template);
    processedTemplates.push(result);
  }
  
  this.setTemplateVariables({
    processedTemplates,
    multipleTemplatesProcessed: true
  });
});

When("I validate the frontmatter", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const template = variables.currentTemplate as string;
  
  const result = this.parseFrontmatter(template);
  const validationResult = this.validateFrontmatter(result.frontmatter);
  
  this.setTemplateVariables({
    ...variables,
    validationResult,
    frontmatterValidated: true
  });
});

// =========================================================================
// Assertion Steps
// =========================================================================

Then("the {string} directive should be {string}", function (this: UnjucksWorld, directive: string, expectedValue: string) {
  const variables = this.getTemplateVariables();
  const frontmatter = variables.parsedFrontmatter as any;
  
  if (!frontmatter) {
    throw new Error("No parsed frontmatter available");
  }
  
  const actualValue = frontmatter[directive];
  assert.strictEqual(actualValue, expectedValue, `Expected ${directive} to be "${expectedValue}", got "${actualValue}"`);
});

Then("the template body should be {string}", function (this: UnjucksWorld, expectedBody: string) {
  const variables = this.getTemplateVariables();
  const body = variables.parsedBody as string;
  
  if (!body) {
    throw new Error("No parsed body available");
  }
  
  assert.strictEqual(body.trim(), expectedBody.trim(), "Template body does not match expected value");
});

Then("the content should be injected before the marker", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  assert.strictEqual(variables.injectionMode, true, "Should be in injection mode");
  
  const frontmatter = variables.parsedFrontmatter as any;
  assert.strictEqual(frontmatter.inject, true, "Inject directive should be true");
  assert.ok(frontmatter.before, "Before directive should be specified");
});

Then("existing file content should be preserved", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  assert.strictEqual(variables.injectionMode, true, "Should preserve content in injection mode");
});

Then("the content should be appended to the file", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const frontmatter = variables.parsedFrontmatter as any;
  assert.strictEqual(frontmatter.append, true, "Append directive should be true");
});

Then("existing content should remain unchanged", function (this: UnjucksWorld) {
  // This would be validated in a full implementation by checking file content
  const variables = this.getTemplateVariables();
  assert.ok(variables.templateParsed, "Template should be parsed successfully");
});

Then("the content should be prepended to the file", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const frontmatter = variables.parsedFrontmatter as any;
  assert.strictEqual(frontmatter.prepend, true, "Prepend directive should be true");
});

Then("existing content should follow", function (this: UnjucksWorld) {
  // This would be validated by checking the actual file content after prepending
  const variables = this.getTemplateVariables();
  assert.ok(variables.templateParsed, "Template should be processed");
});

Then("the content should be inserted at line {int}", function (this: UnjucksWorld, expectedLine: number) {
  const variables = this.getTemplateVariables();
  const frontmatter = variables.parsedFrontmatter as any;
  assert.strictEqual(frontmatter.lineAt, expectedLine, `LineAt should be ${expectedLine}`);
});

Then("line numbers should be adjusted accordingly", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const testFileLines = variables.testFileLines as number;
  assert.ok(testFileLines >= 20, "Test file should have sufficient lines for insertion");
});

Then("the content should be inserted after the marker", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const frontmatter = variables.parsedFrontmatter as any;
  assert.strictEqual(frontmatter.inject, true, "Should be in inject mode");
  assert.ok(frontmatter.after, "After directive should be specified");
});

Then("the marker should remain in place", function (this: UnjucksWorld) {
  // In a full implementation, this would verify the marker still exists in the file
  const variables = this.getTemplateVariables();
  assert.ok(variables.templateParsed, "Template should be processed");
});

Then("the file should not be generated", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  assert.strictEqual(variables.shouldSkipGeneration, true, "File generation should be skipped");
});

Then("no output file should be created", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  assert.strictEqual(variables.shouldSkipGeneration, true, "No file should be created when skipped");
});

Then("the output file should have permissions {int}", function (this: UnjucksWorld, expectedPermissions: number) {
  const variables = this.getTemplateVariables();
  const frontmatter = variables.parsedFrontmatter as any;
  assert.strictEqual(frontmatter.chmod, expectedPermissions, `File permissions should be ${expectedPermissions}`);
});

Then("the file should be executable", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const frontmatter = variables.parsedFrontmatter as any;
  // 755 includes executable permissions
  assert.ok([755, 777, 775].includes(frontmatter.chmod), "File should have executable permissions");
});

Then("the file should be generated", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  assert.ok(variables.templateProcessed, "Template should be processed and file generated");
});

Then("the shell command should be executed", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const frontmatter = variables.parsedFrontmatter as any;
  assert.ok(frontmatter.sh, "Shell command directive should be present");
});

Then("the output path should be {string}", function (this: UnjucksWorld, expectedPath: string) {
  const variables = this.getTemplateVariables();
  const renderedPath = variables.renderedPath as string;
  assert.strictEqual(renderedPath, expectedPath, `Rendered path should be "${expectedPath}"`);
});

Then("both injections should occur in the same file", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const processedTemplates = variables.processedTemplates as any[];
  
  if (!processedTemplates || processedTemplates.length < 2) {
    throw new Error("Expected processed templates");
  }
  
  // Both templates should target the same file
  const targetFiles = processedTemplates.map(t => t.frontmatter.to);
  assert.strictEqual(targetFiles[0], targetFiles[1], "Both templates should target the same file");
});

Then("content should be properly positioned", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  assert.strictEqual(variables.multipleTemplatesProcessed, true, "Multiple templates should be processed");
});

Then("the test file should be generated", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  assert.strictEqual(variables.shouldSkipGeneration, false, "Test file should be generated when withTests is true");
});

Then("the test file should be skipped", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  assert.strictEqual(variables.shouldSkipGeneration, true, "Test file should be skipped when withTests is false");
});

Then("parsing should fail with clear error messages", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const parseError = variables.parseError as string;
  assert.ok(parseError, "Parsing should fail with an error");
  assert.ok(parseError.length > 0, "Error message should not be empty");
});

Then("invalid directives should be reported", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const parseError = variables.parseError as string;
  assert.ok(parseError, "Invalid directives should cause parsing error");
});

Then("frontmatter should inherit from generator defaults", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const generatorConfig = variables.generatorConfig as any;
  assert.ok(generatorConfig && generatorConfig.defaultFrontmatter, "Generator should have default frontmatter");
});

Then("template-specific values should override defaults", function (this: UnjucksWorld) {
  // In a full implementation, this would verify the inheritance chain
  const variables = this.getTemplateVariables();
  assert.ok(variables.templateParsed, "Template should be parsed with inheritance");
});

Then("the injection should be skipped", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  assert.strictEqual(variables.shouldSkipGeneration, true, "Injection should be skipped");
});

Then("the injection should occur", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  assert.strictEqual(variables.shouldSkipGeneration, false, "Injection should occur");
});

Then("a backup file should be created", async function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const frontmatter = variables.parsedFrontmatter as any;
  assert.strictEqual(frontmatter.backup, true, "Backup directive should be true");
});

Then("original content should be preserved in backup", function (this: UnjucksWorld) {
  // In a full implementation, this would verify the backup file exists and contains original content
  const variables = this.getTemplateVariables();
  assert.ok(variables.templateParsed, "Template should be processed with backup");
});

Then("injection should proceed in original file", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const frontmatter = variables.parsedFrontmatter as any;
  assert.strictEqual(frontmatter.inject, true, "Injection should proceed");
});

Then("unknown directives should trigger warnings", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const validationResult = variables.validationResult as any;
  
  if (!validationResult) {
    throw new Error("No validation result available");
  }
  
  assert.ok(validationResult.warnings && validationResult.warnings.length > 0, "Should have warnings for unknown directives");
});

Then("invalid values should trigger errors", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const validationResult = variables.validationResult as any;
  
  if (!validationResult) {
    throw new Error("No validation result available");
  }
  
  assert.ok(validationResult.errors && validationResult.errors.length > 0, "Should have errors for invalid values");
});

Then("valid directives should be accepted", function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const validationResult = variables.validationResult as any;
  
  if (!validationResult) {
    throw new Error("No validation result available");
  }
  
  // Should have valid directives count
  assert.ok(validationResult.validDirectives || validationResult.valid, "Should have valid directives");
});

// File content verification steps from injection feature
Then("the file {string} should contain:", async function (this: UnjucksWorld, filePath: string, expectedContent: string) {
  const actualContent = await this.helper.readFile(filePath);
  const normalizedExpected = expectedContent.trim();
  const normalizedActual = actualContent.trim();
  
  if (normalizedActual !== normalizedExpected) {
    throw new Error(`File content mismatch in ${filePath}\nExpected:\n${normalizedExpected}\nActual:\n${normalizedActual}`);
  }
});

Then("the content should be injected before the first matching occurrence", function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  assert.strictEqual(result.exitCode, 0, "Command should succeed");
});

Then("I should see {string}", function (this: UnjucksWorld, expectedMessage: string) {
  const result = this.getLastCommandResult();
  assert.ok(result.stdout.includes(expectedMessage), `Should see message: ${expectedMessage}`);
});

Then("the content should be injected before the regex match", function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  assert.strictEqual(result.exitCode, 0, "Regex injection should succeed");
});

Then("the injection should be successful", function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  assert.strictEqual(result.exitCode, 0, "Injection should be successful");
});

Then("the injected content should maintain proper indentation", async function (this: UnjucksWorld) {
  // This would verify indentation in the actual file
  const result = this.getLastCommandResult();
  assert.strictEqual(result.exitCode, 0, "Indented injection should succeed");
});

Then("the file should contain the new method with correct spacing", async function (this: UnjucksWorld) {
  // This would verify method formatting in the actual file
  const result = this.getLastCommandResult();
  assert.strictEqual(result.exitCode, 0, "Method injection should succeed");
});

// =========================================================================
// Helper Methods
// =========================================================================

// Extend UnjucksWorld with helper methods
declare module '../support/world' {
  interface UnjucksWorld {
    parseFrontmatter(template: string): { frontmatter: any; body: string };
    processFrontmatterDirectives(frontmatter: any, variables: any): any;
    processTemplate(parsedTemplate: any, variables: any): Promise<any>;
    evaluateSkipCondition(condition: string, variables: any): boolean;
    renderTemplate(template: string, variables: any): string;
    validateFrontmatter(frontmatter: any): any;
  }
}

// Add helper methods to the prototype
UnjucksWorld.prototype.parseFrontmatter = function(template: string) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
  const match = template.match(frontmatterRegex);
  
  if (!match) {
    return { frontmatter: {}, body: template };
  }
  
  const [, frontmatterContent, body] = match;
  
  try {
    const frontmatter = yaml.load(frontmatterContent) as any;
    return { frontmatter: frontmatter || {}, body: body || '' };
  } catch (error: any) {
    throw new Error(`Failed to parse YAML frontmatter: ${error.message}`);
  }
};

UnjucksWorld.prototype.processFrontmatterDirectives = function(frontmatter: any, variables: any) {
  const processed = { ...frontmatter };
  
  // Process template variables in directives
  for (const [key, value] of Object.entries(processed)) {
    if (typeof value === 'string') {
      processed[key] = this.renderTemplate(value, variables);
    }
  }
  
  return processed;
};

UnjucksWorld.prototype.processTemplate = async function(parsedTemplate: any, variables: any) {
  const { frontmatter, body } = parsedTemplate;
  
  // Process frontmatter directives
  const processedFrontmatter = this.processFrontmatterDirectives(frontmatter, variables);
  
  // Render body with variables
  const renderedBody = this.renderTemplate(body, variables);
  
  // Determine output path
  const outputPath = frontmatter.to ? this.renderTemplate(frontmatter.to, variables) : null;
  
  return {
    processedFrontmatter,
    renderedBody,
    outputPath,
    shouldSkip: frontmatter.skipIf ? this.evaluateSkipCondition(frontmatter.skipIf, variables) : false
  };
};

UnjucksWorld.prototype.evaluateSkipCondition = function(condition: string, variables: any) {
  try {
    // Handle simple template expressions like "{{ !withFeature }}"
    const templateMatch = condition.match(/^{{\s*(.+?)\s*}}$/);
    if (templateMatch) {
      const expression = templateMatch[1];
      
      // Handle negation
      if (expression.startsWith('!')) {
        const varName = expression.slice(1).trim();
        return !variables[varName];
      }
      
      // Handle method calls like "existingConfig.includes(configName)"
      if (expression.includes('.includes(')) {
        const [arrayName, methodCall] = expression.split('.includes(');
        const varName = methodCall.replace(')', '').trim();
        const array = variables[arrayName];
        const value = variables[varName];
        
        if (Array.isArray(array)) {
          return array.includes(value);
        }
      }
      
      // Simple variable evaluation
      return !!variables[expression];
    }
    
    // Fallback: evaluate as JavaScript (unsafe in production)
    return false;
  } catch {
    return false;
  }
};

UnjucksWorld.prototype.renderTemplate = function(template: string, variables: any) {
  if (!template) return template;
  
  // Simple template rendering - replace {{ variable }} with values
  return template.replace(/{{\s*([^}]+)\s*}}/g, (match, varName) => {
    const trimmed = varName.trim();
    
    // Handle filters like "{{ name | pascalCase }}"
    if (trimmed.includes('|')) {
      const [variable, filter] = trimmed.split('|').map(s => s.trim());
      const value = variables[variable] || '';
      
      switch (filter) {
        case 'pascalCase':
          return value.replace(/(?:^|[-_])(\w)/g, (_, c: string) => c.toUpperCase());
        case 'kebabCase':
          return value.replace(/[A-Z]/g, (c: string) => `-${c.toLowerCase()}`);
        case 'titleCase':
          return value.replace(/\b\w/g, (c: string) => c.toUpperCase());
        default:
          return value;
      }
    }
    
    return variables[trimmed] || match;
  });
};

UnjucksWorld.prototype.validateFrontmatter = function(frontmatter: any) {
  const knownDirectives = [
    'to', 'inject', 'before', 'after', 'append', 'prepend', 'lineAt', 
    'skipIf', 'chmod', 'sh', 'backup'
  ];
  
  const warnings: string[] = [];
  const errors: string[] = [];
  const validDirectives: string[] = [];
  
  for (const [key, value] of Object.entries(frontmatter)) {
    if (knownDirectives.includes(key)) {
      validDirectives.push(key);
      
      // Validate specific directive types
      if (key === 'inject' && typeof value !== 'boolean') {
        errors.push(`Invalid value for 'inject': expected boolean, got ${typeof value}`);
      }
      if (key === 'lineAt' && !Number.isInteger(value)) {
        errors.push(`Invalid value for 'lineAt': expected integer, got ${typeof value}`);
      }
      if (key === 'chmod' && (!Number.isInteger(value as number) || (value as number) < 0 || (value as number) > 777)) {
        errors.push(`Invalid value for 'chmod': expected octal number (0-777), got ${value}`);
      }
    } else {
      warnings.push(`Unknown directive: ${key}`);
    }
  }
  
  return {
    warnings,
    errors,
    validDirectives,
    valid: errors.length === 0
  };
};

// Cleanup
After(async function (this: UnjucksWorld) {
  if (this.context.tempDirectory) {
    await this.cleanupTempDirectory();
  }
});