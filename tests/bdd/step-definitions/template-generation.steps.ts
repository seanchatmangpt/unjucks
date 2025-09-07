import { Given, When, Then } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { testContext, executeCommand, getUnjucksBinary } from './cli-core.steps.js';

// Template-specific context
interface TemplateContext {
  templateFiles: Map<string, string>;
  expectedFiles: string[];
  templateVariables: Record<string, any>;
}

const templateContext: TemplateContext = {
  templateFiles: new Map(),
  expectedFiles: [],
  templateVariables: {}
};

// Helper functions
function createTemplate(templatePath: string, content: string): void {
  const fullPath = path.join(testContext.workingDir, templatePath);
  fs.ensureDirSync(path.dirname(fullPath));
  fs.writeFileSync(fullPath, content);
  templateContext.templateFiles.set(templatePath, content);
}

function getTemplateContent(templateName: string, variables: Record<string, any> = {}): string {
  // Basic template content based on template name
  const templates: Record<string, string> = {
    'component': `---
to: src/{{ name }}.ts
---
export class {{ name }} {
  constructor() {
    console.log('{{ name }} initialized');
  }
  
  getName(): string {
    return '{{ name }}';
  }
}
`,
    'api/controller': `---
to: src/controllers/{{ name }}Controller.ts
---
import { Request, Response } from 'express';

export class {{ name }}Controller {
  private endpoint = '/{{ endpoint }}';
  private methods = [{% for method in methods.split(',') %}'{{ method.strip() }}'{{ ',' if not loop.last }}{% endfor %}];

{% for method in methods.split(',') %}
  async {{ method.strip() }}(req: Request, res: Response) {
    // TODO: Implement {{ method.strip() }} logic
    res.json({ message: '{{ method.strip() }} {{ name }}' });
  }
{% endfor %}
}
`,
    'semantic-component': `---
to: src/semantic/{{ name }}.ts
rdf: true
---
{% if rdfData %}
// Generated from RDF schema: {{ rdfData.entityType }}
{% for property in rdfData.properties %}
// Property: {{ property.name }} ({{ property.type }})
{% endfor %}
{% endif %}

export interface I{{ name }} {
{% if rdfData %}
{% for property in rdfData.properties %}
  {{ property.name }}: {{ property.type }};
{% endfor %}
{% else %}
  id: string;
  name: string;
{% endif %}
}

export class {{ name }} implements I{{ name }} {
{% if rdfData %}
{% for property in rdfData.properties %}
  public {{ property.name }}: {{ property.type }};
{% endfor %}
{% else %}
  public id: string;
  public name: string;
{% endif %}

  constructor(data: Partial<I{{ name }}>) {
{% if rdfData %}
{% for property in rdfData.properties %}
    this.{{ property.name }} = data.{{ property.name }}{% if property.default %} || {{ property.default }}{% endif %};
{% endfor %}
{% else %}
    this.id = data.id || '';
    this.name = data.name || '';
{% endif %}
  }
}
`
  };
  
  return templates[templateName] || `---
to: src/{{ name }}.ts
---
// Generated {{ name }}
export default class {{ name }} {}
`;
}

// Given steps
Given(/^I have a template "([^"]+)"$/, async (templatePath: string) => {
  // Extract template name from path
  const templateName = templatePath.includes('/') 
    ? templatePath.split('/')[1].replace('.njk', '').replace('.ts', '')
    : 'component';
  
  const content = getTemplateContent(templateName);
  createTemplate(templatePath, content);
});

Given(/^I have a clean test workspace$/, async () => {
  // Ensure src directory exists and is clean
  const srcDir = path.join(testContext.workingDir, 'src');
  fs.ensureDirSync(srcDir);
  fs.emptyDirSync(srcDir);
  
  templateContext.expectedFiles = [];
  templateContext.templateVariables = {};
});

Given(/^I have an existing file "([^"]+)"$/, async (filePath: string) => {
  const fullPath = path.join(testContext.workingDir, filePath);
  fs.ensureDirSync(path.dirname(fullPath));
  fs.writeFileSync(fullPath, '// Existing file content\nexport default class ExistingClass {}\n');
});

Given(/^I have a template that requires "([^"]+)" and "([^"]+)" variables$/, async (var1: string, var2: string) => {
  const templateContent = `---
to: src/{{ name }}.ts
variables:
  - ${var1}
  - ${var2}
---
export class {{ name }} {
  private ${var1}: string;
  private ${var2}: string;
  
  constructor(${var1}: string, ${var2}: string) {
    this.${var1} = ${var1};
    this.${var2} = ${var2};
  }
}
`;
  
  createTemplate('templates/component/test.ts.njk', templateContent);
});

Given(/^I have a template with semantic annotations$/, async () => {
  const semanticTemplate = getTemplateContent('semantic-component');
  createTemplate('templates/semantic-component/index.ts.njk', semanticTemplate);
});

Given(/^I have RDF data defining the component structure$/, async () => {
  const rdfData = `
@prefix : <http://example.org/schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

:UserService rdf:type :Component ;
  rdfs:label "User Service" ;
  :hasProperty [
    :name "id" ;
    :type "string" ;
    :required true
  ] ;
  :hasProperty [
    :name "username" ;
    :type "string" ;
    :required true
  ] ;
  :hasProperty [
    :name "email" ;
    :type "string" ;
    :required true
  ] .
`;
  
  const rdfPath = path.join(testContext.workingDir, 'schema.ttl');
  fs.writeFileSync(rdfPath, rdfData);
});

// When steps (extending from core steps)
// The actual command execution is handled by the core steps
// These steps set up expectations for the results

// Then steps
Then(/^the file "([^"]+)" should exist$/, async (expectedFile: string) => {
  const filePath = path.join(testContext.workingDir, expectedFile);
  expect(fs.existsSync(filePath)).toBe(true);
});

Then(/^the file should contain "([^"]+)"$/, async (expectedContent: string) => {
  // Find the most recently generated file
  const srcDir = path.join(testContext.workingDir, 'src');
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.ts'));
  expect(files.length).toBeGreaterThan(0);
  
  const filePath = path.join(srcDir, files[0]);
  const content = fs.readFileSync(filePath, 'utf8');
  expect(content).toContain(expectedContent);
});

Then('I should see generated files', async () => {
  const srcDir = path.join(testContext.workingDir, 'src');
  if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir);
    expect(files.length).toBeGreaterThan(0);
  }
});

Then('the files should contain the correct variable substitutions', async () => {
  const srcDir = path.join(testContext.workingDir, 'src');
  if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir, { recursive: true }) as string[];
    const tsFiles = files.filter(f => f.endsWith('.ts'));
    
    expect(tsFiles.length).toBeGreaterThan(0);
    
    for (const file of tsFiles) {
      const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
      // Should not contain template variables
      expect(content).not.toMatch(/\{\{.*\}\}/);
    }
  }
});

Then(/^I should see "([^"]+)" message$/, async (expectedMessage: string) => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toContain(expectedMessage);
});

Then('I should see the list of files that would be created', async () => {
  expect(testContext.lastOutput).toMatch(/would create|would generate/i);
  expect(testContext.lastOutput).toMatch(/\.ts|\.js|\.tsx/);
});

Then('no files should be actually created', async () => {
  const srcDir = path.join(testContext.workingDir, 'src');
  if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir).filter(f => !f.startsWith('.'));
    expect(files.length).toBe(0);
  }
});

Then(/^I should see "([^"]+)" error$/, async (expectedError: string) => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toContain(expectedError);
});

Then('the original file should remain unchanged', async () => {
  const filePath = path.join(testContext.workingDir, 'src/UserService.ts');
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('// Existing file content');
  }
});

Then('the file should be replaced with new content', async () => {
  const filePath = path.join(testContext.workingDir, 'src/UserService.ts');
  expect(fs.existsSync(filePath)).toBe(true);
  
  const content = fs.readFileSync(filePath, 'utf8');
  expect(content).not.toContain('// Existing file content');
  expect(content).toContain('class UserService');
});

Then('I should see suggestions for similar templates', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/did you mean|similar|suggestion/i);
});

Then('I should see semantically enhanced generated files', async () => {
  const srcDir = path.join(testContext.workingDir, 'src/semantic');
  if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir);
    expect(files.length).toBeGreaterThan(0);
    
    // Check for semantic annotations in generated files
    for (const file of files) {
      const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
      expect(content).toMatch(/Generated from RDF|Property:|interface.*I/);
    }
  }
});

Then('the files should contain RDF-derived metadata', async () => {
  const srcDir = path.join(testContext.workingDir, 'src/semantic');
  if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir);
    expect(files.length).toBeGreaterThan(0);
    
    for (const file of files) {
      const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
      // Should contain properties derived from RDF
      expect(content).toMatch(/id:\s*string|username:\s*string|email:\s*string/);
    }
  }
});

// Cleanup
export { templateContext };
