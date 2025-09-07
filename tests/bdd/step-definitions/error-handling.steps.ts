import { Given, When, Then } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { testContext } from './cli-core.steps.js';

// Error handling context
interface ErrorContext {
  corruptedFiles: Map<string, string>;
  invalidTemplates: Map<string, string>;
  restrictedDirectories: string[];
  networkFailures: boolean;
  resourceLimits: {
    memory: number;
    disk: number;
    cpu: number;
  };
}

const errorContext: ErrorContext = {
  corruptedFiles: new Map(),
  invalidTemplates: new Map(),
  restrictedDirectories: [],
  networkFailures: false,
  resourceLimits: {
    memory: 500 * 1024 * 1024, // 500MB
    disk: 1024 * 1024 * 1024, // 1GB
    cpu: 80 // 80%
  }
};

// Helper functions
function createCorruptedTemplate(templatePath: string): void {
  const fullPath = path.join(testContext.workingDir, templatePath);
  fs.ensureDirSync(path.dirname(fullPath));
  
  // Create a template with corrupted/invalid content
  const corruptedContent = `---
to: src/{{ name }}.ts
---
<%- this will cause parsing errors %>
{{ unclosed template
function {{ name }}() {
  // Missing closing brace
`;
  
  fs.writeFileSync(fullPath, corruptedContent);
  errorContext.corruptedFiles.set(templatePath, corruptedContent);
}

function createInvalidYamlTemplate(): void {
  const templatePath = 'templates/invalid-yaml/test.ts.njk';
  const fullPath = path.join(testContext.workingDir, templatePath);
  fs.ensureDirSync(path.dirname(fullPath));
  
  // Create template with invalid YAML frontmatter
  const invalidYaml = `---
to: src/{{ name }}.ts
invalid_yaml_syntax:
  - item1
 - item2  # Invalid indentation
  nested:
    - value: incomplete
  unclosed_bracket: [
---
export class {{ name }} {}
`;
  
  fs.writeFileSync(fullPath, invalidYaml);
  errorContext.invalidTemplates.set(templatePath, invalidYaml);
}

function createReadOnlyDirectory(dirPath: string): void {
  const fullPath = path.join(testContext.workingDir, dirPath);
  fs.ensureDirSync(fullPath);
  
  try {
    // Make directory read-only (Linux/Mac)
    fs.chmodSync(fullPath, 0o444);
    errorContext.restrictedDirectories.push(dirPath);
  } catch (error) {
    // Windows or permission issues - simulate the error in tests
    console.warn('Could not set read-only permissions, will simulate in tests');
  }
}

// Given steps
Given('I have a test environment setup', async () => {
  // Initialize error testing environment
  const errorTestDir = path.join(testContext.workingDir, 'error-tests');
  fs.ensureDirSync(errorTestDir);
  
  // Set up mock error conditions
  errorContext.networkFailures = false;
  errorContext.corruptedFiles.clear();
  errorContext.invalidTemplates.clear();
  errorContext.restrictedDirectories = [];
});

Given(/^I have a corrupted template file "([^"]+)"$/, async (templatePath: string) => {
  createCorruptedTemplate(templatePath);
});

Given('I have a template with invalid YAML frontmatter', async () => {
  createInvalidYamlTemplate();
});

Given('I have a template requiring "name" and "type" variables', async () => {
  const templatePath = 'templates/component/strict.ts.njk';
  const fullPath = path.join(testContext.workingDir, templatePath);
  fs.ensureDirSync(path.dirname(fullPath));
  
  const strictTemplate = `---
to: src/{{ name }}.ts
variables:
  - name: name
    required: true
  - name: type
    required: true
    options: ["service", "component", "util"]
---
export {{ type }} {{ name }} {
  // Implementation for {{ type }} {{ name }}
}
`;
  
  fs.writeFileSync(fullPath, strictTemplate);
});

Given(/^I have a read-only target directory "([^"]+)"$/, async (dirPath: string) => {
  createReadOnlyDirectory(dirPath);
});

Given('I have limited disk space available', async () => {
  // Mock limited disk space
  errorContext.resourceLimits.disk = 50 * 1024 * 1024; // 50MB
});

Given('I have MCP integration enabled', async () => {
  // Mock MCP integration setup
  process.env.UNJUCKS_MCP_ENABLED = 'true';
});

Given('the network connection is unstable', async () => {
  errorContext.networkFailures = true;
});

Given('I have an RDF file with syntax errors', async () => {
  const rdfPath = path.join(testContext.workingDir, 'invalid.ttl');
  const invalidRDF = `
@prefix : <http://example.org/schema#>
# Missing dot after prefix - syntax error

:User rdf:type rdfs:Class
# Missing semicolon and dot
  rdfs:label "Unterminated string
  :hasProperty [
    :name "id
    # Missing quote and brackets
  ]
# Missing final dot and various syntax errors
`;
  
  fs.writeFileSync(rdfPath, invalidRDF);
});

Given('I have templates with circular dependencies', async () => {
  // Create templates that reference each other
  const templateA = `---
to: src/{{ name }}A.ts
includes:
  - templateB
---
import { {{ name }}B } from './{{ name }}B';
export class {{ name }}A extends {{ name }}B {}
`;
  
  const templateB = `---
to: src/{{ name }}B.ts
includes:
  - templateA
---
import { {{ name }}A } from './{{ name }}A';
export class {{ name }}B extends {{ name }}A {}
`;
  
  fs.ensureDirSync(path.join(testContext.workingDir, 'templates/circular'));
  fs.writeFileSync(path.join(testContext.workingDir, 'templates/circular/templateA.ts.njk'), templateA);
  fs.writeFileSync(path.join(testContext.workingDir, 'templates/circular/templateB.ts.njk'), templateB);
});

Given('I have a very large template or dataset', async () => {
  // Create a template that would consume excessive memory
  const massiveTemplate = `---
to: src/{{ name }}.ts
---
// This template generates a very large file
{% for i in range(1000000) %}
export const item{{ i }} = {
  id: {{ i }},
  name: "Item {{ i }}",
  data: "${'x'.repeat(1000)}"
};
{% endfor %}
`;
  
  const templatePath = path.join(testContext.workingDir, 'templates/massive-template/index.ts.njk');
  fs.ensureDirSync(path.dirname(templatePath));
  fs.writeFileSync(templatePath, massiveTemplate);
});

Given('multiple Unjucks processes are running', async () => {
  // Mock concurrent process scenario
  (global as any).mockConcurrentProcesses = true;
});

Given('I have templates with unsupported character encoding', async () => {
  // Create a file with unsupported encoding
  const templatePath = path.join(testContext.workingDir, 'templates/encoded-template/index.ts.njk');
  fs.ensureDirSync(path.dirname(templatePath));
  
  // Write some binary data that's not valid UTF-8
  const invalidUtf8 = Buffer.from([0xFF, 0xFE, 0x00, 0x48, 0x00, 0x65, 0x00, 0x6C, 0x00, 0x6C, 0x00, 0x6F]);
  fs.writeFileSync(templatePath, invalidUtf8);
});

Given('I have a complex template with infinite loops', async () => {
  const infiniteLoopTemplate = `---
to: src/{{ name }}.ts
---
{% set x = 1 %}
{% while true %}  {# This will never terminate #}
  {% set x = x + 1 %}
  const value{{ x }} = {{ x }};
{% endwhile %}
export class {{ name }} {}
`;
  
  const templatePath = path.join(testContext.workingDir, 'templates/infinite-loop/index.ts.njk');
  fs.ensureDirSync(path.dirname(templatePath));
  fs.writeFileSync(templatePath, infiniteLoopTemplate);
});

Given('MCP integration is configured but unavailable', async () => {
  process.env.UNJUCKS_MCP_ENABLED = 'true';
  process.env.UNJUCKS_MCP_ENDPOINT = 'http://unavailable:3000';
});

Given('a template generation partially fails', async () => {
  // Create a scenario where some files succeed and others fail
  const partialFailTemplate = `---
to: |
  {% for file in ['success.ts', 'fail.ts', 'success2.ts'] %}
    src/{{ name }}/{{ file }}
  {% endfor %}
---
{% if 'fail.ts' in to %}
  {{ undefined_variable_that_causes_error }}
{% else %}
  export class {{ name }}{{ file | replace('.ts', '') | capitalize }} {}
{% endif %}
`;
  
  const templatePath = path.join(testContext.workingDir, 'templates/multi-file/index.ts.njk');
  fs.ensureDirSync(path.dirname(templatePath));
  fs.writeFileSync(templatePath, partialFailTemplate);
});

Given('I have a template that generates invalid code', async () => {
  const invalidCodeTemplate = `---
to: src/{{ name }}.ts
validate: true
---
// This will generate invalid TypeScript
class {{ name }} {
  constructor(
    // Missing closing parenthesis
  
  method() {
    // Missing closing brace
  }
// Missing class closing brace
`;
  
  const templatePath = path.join(testContext.workingDir, 'templates/invalid-output/index.ts.njk');
  fs.ensureDirSync(path.dirname(templatePath));
  fs.writeFileSync(templatePath, invalidCodeTemplate);
});

Given('I have a multi-file template', async () => {
  const multiFileTemplate = `---
to: |
  src/{{ name }}/index.ts
  src/{{ name }}/types.ts
  src/{{ name }}/utils.ts
---
{% if to.endsWith('index.ts') %}
export * from './types';
export * from './utils';
{% elif to.endsWith('types.ts') %}
export interface {{ name }}Interface {
  id: string;
}
{% elif to.endsWith('utils.ts') %}
export function {{ name }}Helper() {
  return 'helper';
}
{% endif %}
`;
  
  const templatePath = path.join(testContext.workingDir, 'templates/multi-fail/index.ts.njk');
  fs.ensureDirSync(path.dirname(templatePath));
  fs.writeFileSync(templatePath, multiFileTemplate);
});

Given('generation fails partway through', async () => {
  // Mock a scenario where generation fails after some files are created
  (global as any).mockPartialFailure = true;
});

Given('I am a new user', async () => {
  // Set up environment for new user experience
  delete process.env.UNJUCKS_EXPERIENCED_USER;
  process.env.UNJUCKS_NEW_USER = 'true';
});

// Then steps for error handling
Then('I should see "Unknown command" error', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/unknown command|command not found|invalid command/i);
});

Then('I should see command suggestions', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/did you mean|suggestions|available commands/i);
});

Then('I should see "Missing required arguments" error', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/missing.*required.*arguments|required.*parameter/i);
});

Then('I should see usage information', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/usage|help|options/i);
});

Then('I should see "Template not found" error', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/template.*not found|template.*does not exist/i);
});

Then('I should see available templates', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/available templates|existing templates/i);
});

Then('I should see "Template parsing failed" error', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/template.*parsing.*failed|parse.*error|template.*error/i);
});

Then('I should see parsing error details', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/line.*\d+|syntax.*error|parsing.*details/i);
});

Then('I should see "YAML parsing error" message', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/yaml.*parsing.*error|yaml.*syntax.*error/i);
});

Then('I should see line number and column information', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/line.*\d+.*column.*\d+|at line \d+/i);
});

Then('I should see "Missing required variable: type" error', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/missing.*required.*variable.*type|variable.*type.*required/i);
});

Then('I should see available variable options', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/available.*options|valid.*values|service.*component.*util/i);
});

Then('I should see "Permission denied" error', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/permission denied|access denied|insufficient.*permissions/i);
});

Then('I should see suggested solutions', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/suggestion|try.*chmod|check.*permissions/i);
});

Then('I should see "Insufficient disk space" error', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/insufficient.*disk.*space|disk.*full|no.*space.*left/i);
});

Then('I should see cleanup suggestions', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/cleanup|free.*space|remove.*files/i);
});

Then('I should see "Network timeout" error', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/network.*timeout|connection.*timeout|request.*timeout/i);
});

Then('I should see retry suggestions', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/retry|try.*again|check.*connection/i);
});

Then('I should see "RDF parsing failed" error', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/rdf.*parsing.*failed|turtle.*syntax.*error|semantic.*parsing/i);
});

Then('I should see syntax error location', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/line.*\d+|position|syntax.*error.*at/i);
});

Then('I should see correction suggestions', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/suggestion|missing.*dot|unterminated|expected/i);
});

Then('I should see "Circular dependency detected" error', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/circular.*dependency|dependency.*cycle|circular.*reference/i);
});

Then('I should see dependency chain', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/dependency.*chain|templateA.*templateB|circular.*path/i);
});

Then('I should see "Memory limit exceeded" error', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/memory.*limit.*exceeded|out.*of.*memory|memory.*exhausted/i);
});

Then('I should see optimization suggestions', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/optimization|reduce.*template.*size|streaming.*mode/i);
});

Then('I should see "File access conflict" error', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/file.*access.*conflict|concurrent.*access|file.*locked/i);
});

Then('I should see retry options', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/retry|wait.*and.*try|automatic.*retry/i);
});

Then('I should see "Encoding error" message', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/encoding.*error|character.*encoding|invalid.*utf/i);
});

Then('I should see supported encodings list', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/supported.*encodings|utf-8|ascii/i);
});

Then('I should see "Template compilation timeout" error', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/template.*compilation.*timeout|compilation.*exceeded.*time/i);
});

Then('I should see debugging suggestions', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/debugging|infinite.*loop|check.*template.*logic/i);
});

Then('I should see "MCP unavailable, using fallback" warning', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/mcp.*unavailable|using.*fallback|fallback.*mode/i);
});

Then('the generation should complete successfully', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/generation.*complete|generated.*successfully/i);
});

Then('I should see "Resuming from last successful step" message', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/resuming|resume.*from|last.*successful.*step/i);
});

Then('only remaining files should be generated', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/remaining.*files|skipping.*completed|partial.*resume/i);
});

Then('I should see "Generated code validation failed" error', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/generated.*code.*validation.*failed|validation.*error|invalid.*generated/i);
});

Then('I should see specific validation errors', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/syntax.*error|missing.*closing|validation.*details/i);
});

Then('no files should be written', async () => {
  const srcDir = path.join(testContext.workingDir, 'src');
  if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir);
    expect(files.length).toBe(0);
  }
});

Then('I should see "Rolling back partial changes" message', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/rolling.*back|rollback|reverting.*changes/i);
});

Then('no partial files should remain', async () => {
  const srcDir = path.join(testContext.workingDir, 'src');
  if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir, { recursive: true }) as string[];
    const incompleteFiles = files.filter(f => f.includes('.tmp') || f.includes('.partial'));
    expect(incompleteFiles.length).toBe(0);
  }
});

Then('I should see "Did you mean \'generate\'?" suggestion', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/did you mean.*generate|similar.*generate/i);
});

Then('I should see "Getting started" help link', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/getting.*started|documentation|help.*guide|tutorial/i);
});

// Export for use in other step files
export { errorContext };
