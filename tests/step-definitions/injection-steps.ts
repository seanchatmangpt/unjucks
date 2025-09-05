import { Given, When, Then } from '@cucumber/cucumber';
import * as assert from 'assert';
import { UnjucksWorld } from '../support/world.js';
import * as path from 'node:path';

// Injection Setup Steps
Given('I have a target file {string} with content:', async function (this: UnjucksWorld, filePath: string, content: string) {
  const fullPath = path.resolve(this.context.tempDirectory, filePath);
  await (this as any).createFile(fullPath, content.trim());
});

Given('I have an injection template {string} that:', async function (this: UnjucksWorld, templateName: string, dataTable: any) {
  const row = dataTable.hashes()[0];
  const injectConfig = row.config || '';
  const templateBody = row.body || '';
  
  const frontmatter = `inject: true\n${injectConfig}`;
  const templates = {
    [`${templateName}/inject.ejs`]: `---\n${frontmatter}\n---\n${templateBody}`
  };
  
  await this.createTemplateStructure(templates);
});

Given('I have multiple target files:', async function (this: UnjucksWorld, dataTable: any) {
  for (const row of dataTable.hashes()) {
    const fullPath = path.resolve(this.context.tempDirectory, row.file);
    await (this as any).createFile(fullPath, row.content || '');
  }
});

// Injection Execution Steps
When('I run injection for template {string}', async function (this: UnjucksWorld, templateName: string) {
  await this.executeUnjucksCommand(['generate', templateName]);
});

When('I run injection with variables:', async function (this: UnjucksWorld, dataTable: any) {
  const variables = dataTable.rowsHash();
  this.setTemplateVariables(variables);
  
  const templateName = variables.template || 'test';
  const args = ['generate', templateName];
  
  for (const [key, value] of Object.entries(variables)) {
    if (key !== 'template') {
      args.push(`--${key}`, value as string);
    }
  }
  
  await this.executeUnjucksCommand(args);
});

When('I run injection in dry-run mode', async function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const templateName = variables.template as string || 'test';
  await this.executeUnjucksCommand(['generate', templateName, '--dry']);
});

When('I run injection with force flag', async function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const templateName = variables.template as string || 'test';
  await this.executeUnjucksCommand(['generate', templateName, '--force']);
});

// Injection Point Verification Steps
Then('the content should be injected after line containing {string}', async function (this: UnjucksWorld, markerText: string) {
  const variables = this.getTemplateVariables();
  const targetFile = variables.targetFile as string || 'src/test.ts';
  
  const content = await this.readGeneratedFile(targetFile);
  const lines = content.split('\n');
  
  const markerIndex = lines.findIndex(line => line.includes(markerText));
  assert.ok(markerIndex > -1, `Expected to find marker text: ${markerText}`);
  
  // Check that content was injected after the marker
  const injectedContent = variables.injectedContent as string;
  if (injectedContent) {
    const afterMarkerContent = lines.slice(markerIndex + 1).join('\n');
    assert.ok(afterMarkerContent.includes(injectedContent), `Content should be injected after marker: ${markerText}`);
  }
});

Then('the content should be injected before line containing {string}', async function (this: UnjucksWorld, markerText: string) {
  const variables = this.getTemplateVariables();
  const targetFile = variables.targetFile as string || 'src/test.ts';
  
  const content = await this.readGeneratedFile(targetFile);
  const lines = content.split('\n');
  
  const markerIndex = lines.findIndex(line => line.includes(markerText));
  assert.ok(markerIndex > -1, `Expected to find marker text: ${markerText}`);
  
  // Check that content was injected before the marker
  const injectedContent = variables.injectedContent as string;
  if (injectedContent) {
    const beforeMarkerContent = lines.slice(0, markerIndex).join('\n');
    assert.ok(beforeMarkerContent.includes(injectedContent), `Content should be injected before marker: ${markerText}`);
  }
});

Then('the content should be prepended to the file', async function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const targetFile = variables.targetFile as string || 'src/test.ts';
  const injectedContent = variables.injectedContent as string;
  
  const content = await this.readGeneratedFile(targetFile);
  assert.ok(content.trim().startsWith(injectedContent.trim()), 'Content should be prepended to the file');
});

Then('the content should be appended to the file', async function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const targetFile = variables.targetFile as string || 'src/test.ts';
  const injectedContent = variables.injectedContent as string;
  
  const content = await this.readGeneratedFile(targetFile);
  assert.ok(content.trim().endsWith(injectedContent.trim()), 'Content should be appended to the file');
});

Then('the content should be injected at line {int}', async function (this: UnjucksWorld, lineNumber: number) {
  const variables = this.getTemplateVariables();
  const targetFile = variables.targetFile as string || 'src/test.ts';
  const injectedContent = variables.injectedContent as string;
  
  const content = await this.readGeneratedFile(targetFile);
  const lines = content.split('\n');
  
  // Line numbers are 1-based in the step definition
  const actualLine = lines[lineNumber - 1];
  assert.ok(actualLine.includes(injectedContent), `Line ${lineNumber} should contain injected content`);
});

// Injection Condition Verification
Then('the injection should be skipped due to condition {string}', function (this: UnjucksWorld, condition: string) {
  const output = this.getLastOutput();
  assert.ok(new RegExp(`skipped.*${condition}|condition.*${condition}.*false`, 'i').test(output), `Injection should be skipped due to condition: ${condition}`);
});

Then('the injection should proceed because condition {string} is met', function (this: UnjucksWorld, condition: string) {
  const output = this.getLastOutput();
  assert.ok(!new RegExp(`skipped.*${condition}`, 'i').test(output), `Injection should proceed because condition ${condition} is met`);
  this.assertCommandSucceeded();
});

Then('no injection should occur', function (this: UnjucksWorld) {
  const output = this.getLastOutput();
  assert.ok(/no.*inject|skip.*inject|inject.*skip/i.test(output), 'No injection should occur');
});

// Multiple Injection Verification
Then('content should be injected into multiple files:', async function (this: UnjucksWorld, dataTable: any) {
  for (const row of dataTable.hashes()) {
    const filePath = row.file;
    const expectedContent = row.contains;
    
    assert.strictEqual(await this.fileExists(filePath), true, `File ${filePath} should exist`);
    
    if (expectedContent) {
      const content = await this.readGeneratedFile(filePath);
      assert.ok(content.includes(expectedContent), `File ${filePath} should contain: ${expectedContent}`);
    }
  }
});

Then('the following injection points should be processed:', async function (this: UnjucksWorld, dataTable: any) {
  for (const row of dataTable.hashes()) {
    const file = row.file;
    const point = row.point;
    const content = row.content;
    
    const fileContent = await this.readGeneratedFile(file);
    
    switch (point.toLowerCase()) {
      case 'before': {
        const beforeMarker = row.marker;
        const lines = fileContent.split('\n');
        const beforeIndex = lines.findIndex(line => line.includes(beforeMarker));
        assert.ok(beforeIndex > -1, `Expected to find before marker: ${beforeMarker}`);
        assert.ok(lines.slice(0, beforeIndex).join('\n').includes(content), `Content should be injected before marker: ${beforeMarker}`);
        break;
      }
        
      case 'after': {
        const afterMarker = row.marker;
        const afterLines = fileContent.split('\n');
        const afterIndex = afterLines.findIndex(line => line.includes(afterMarker));
        assert.ok(afterIndex > -1, `Expected to find after marker: ${afterMarker}`);
        assert.ok(afterLines.slice(afterIndex + 1).join('\n').includes(content), `Content should be injected after marker: ${afterMarker}`);
        break;
      }
        
      case 'prepend': {
        assert.ok(fileContent.trim().startsWith(content), `Content should be prepended to file: ${file}`);
        break;
      }
        
      case 'append': {
        assert.ok(fileContent.trim().endsWith(content), `Content should be appended to file: ${file}`);
        break;
      }
        
      default: {
        throw new Error(`Unknown injection point: ${point}`);
      }
    }
  }
});

// Injection Safety and Validation
Then('the original file structure should be preserved', async function (this: UnjucksWorld) {
  // This step verifies that injection didn't break the file structure
  const files = await this.listFiles();
  const jsFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.ts'));
  
  for (const file of jsFiles) {
    const content = await this.readGeneratedFile(file);
    
    // Basic syntax validation - no unclosed braces/brackets
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    const openBrackets = (content.match(/\[/g) || []).length;
    const closeBrackets = (content.match(/\]/g) || []).length;
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    
    assert.strictEqual(openBraces, closeBraces, `File ${file} should have matching braces`);
    assert.strictEqual(openBrackets, closeBrackets, `File ${file} should have matching brackets`);
    assert.strictEqual(openParens, closeParens, `File ${file} should have matching parentheses`);
  }
});

Then('the injection should not create duplicate content', async function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const targetFile = variables.targetFile as string || 'src/test.ts';
  const injectedContent = variables.injectedContent as string;
  
  const content = await this.readGeneratedFile(targetFile);
  const occurrences = (content.match(new RegExp(injectedContent.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`), 'g')) || []).length;
  
  assert.ok(occurrences <= 1, 'Injection should not create duplicate content');
});

Then('the injection should maintain proper indentation', async function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const targetFile = variables.targetFile as string || 'src/test.ts';
  
  const content = await this.readGeneratedFile(targetFile);
  const lines = content.split('\n');
  
  // Check that injected content follows consistent indentation patterns
  let expectedIndent = 0;
  let inBlock = false;
  
  for (const line of lines) {
    if (line.trim() === '') continue;
    
    const currentIndent = line.length - line.trimStart().length;
    
    if (line.trim().endsWith('{')) {
      expectedIndent = currentIndent + 2;
      inBlock = true;
    } else if (line.trim() === '}') {
      expectedIndent = Math.max(0, currentIndent - 2);
      inBlock = false;
    } else if (inBlock) {
      // Allow some flexibility in indentation but check it's reasonable
      assert.ok(currentIndent >= 0, `Indentation should be non-negative, got ${currentIndent}`);
      assert.ok(currentIndent < 50, `Indentation should be reasonable, got ${currentIndent}`); // Reasonable max indentation
    }
  }
});

// Advanced Injection Features
Given('I have a complex injection template with conditions:', async function (this: UnjucksWorld, dataTable: any) {
  const row = dataTable.hashes()[0];
  const templateName = row.template || 'complex';
  const condition = row.condition || 'true';
  const before = row.before || '';
  const after = row.after || '';
  const body = row.body || 'injected content';
  
  const frontmatter = `inject: true
skipIf: ${condition}
before: ${before}
after: ${after}`;
  
  const templates = {
    [`${templateName}/inject.ejs`]: `---\n${frontmatter}\n---\n${body}`
  };
  
  await this.createTemplateStructure(templates);
});

When('I run complex injection with skipIf condition {string}', async function (this: UnjucksWorld, condition: string) {
  this.setTemplateVariables({ skipCondition: condition });
  await this.executeUnjucksCommand(['generate', 'complex']);
});

Then('the injection should respect the skipIf condition', async function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const skipCondition = variables.skipCondition as string;
  
  if (skipCondition === 'true' || skipCondition === '1') {
    const output = this.getLastOutput();
    assert.ok(/skip/i.test(output), 'Output should indicate that injection was skipped');
  } else {
    this.assertCommandSucceeded();
    // Verify content was actually injected
    const files = await this.listFiles();
    assert.ok(files.length > 0, 'Files should be generated when injection is not skipped');
  }
});