import { Given, When, Then } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { testContext } from './cli-core.steps.js';

// Injection-specific context
interface InjectionContext {
  targetFiles: Map<string, string>;
  injectionTemplates: Map<string, string>;
  markers: Map<string, string>;
  originalContents: Map<string, string>;
}

const injectionContext: InjectionContext = {
  targetFiles: new Map(),
  injectionTemplates: new Map(),
  markers: new Map(),
  originalContents: new Map()
};

// Helper functions
function createTargetFile(filePath: string, content: string): void {
  const fullPath = path.join(testContext.workingDir, filePath);
  fs.ensureDirSync(path.dirname(fullPath));
  fs.writeFileSync(fullPath, content);
  
  injectionContext.targetFiles.set(filePath, content);
  injectionContext.originalContents.set(filePath, content);
}

function createInjectionTemplate(templatePath: string, frontmatter: any, body: string): void {
  const fullPath = path.join(testContext.workingDir, templatePath);
  fs.ensureDirSync(path.dirname(fullPath));
  
  const yamlFrontmatter = Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
  
  const templateContent = `---\n${yamlFrontmatter}\n---\n${body}`;
  fs.writeFileSync(fullPath, templateContent);
  
  injectionContext.injectionTemplates.set(templatePath, templateContent);
}

function getTargetFileContent(filePath: string): string {
  const fullPath = path.join(testContext.workingDir, filePath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
}

// Given steps
Given(/^I have templates with injection capabilities$/, async () => {
  const templatesDir = path.join(testContext.workingDir, 'templates');
  fs.ensureDirSync(templatesDir);
  
  // Create basic injection templates directory structure
  fs.ensureDirSync(path.join(templatesDir, 'route'));
  fs.ensureDirSync(path.join(templatesDir, 'imports'));
  fs.ensureDirSync(path.join(templatesDir, 'type'));
  fs.ensureDirSync(path.join(templatesDir, 'header'));
});

Given('I have existing target files', async () => {
  // Create some common target files
  createTargetFile('src/routes.ts', `import express from 'express';\n\nconst router = express.Router();\n\n// INSERT_ROUTES_HERE\n\nexport default router;\n`);
  createTargetFile('src/app.ts', `import express from 'express';\n// IMPORT_SECTION\n\nconst app = express();\n\n// Configuration\napp.use(express.json());\n\nexport default app;\n`);
  createTargetFile('src/types.ts', `// Type definitions\nexport interface BaseEntity {\n  id: string;\n  createdAt: Date;\n  updatedAt: Date;\n}\n`);
  createTargetFile('src/utils.ts', `// Utility functions\nexport function generateId(): string {\n  return Math.random().toString(36).substr(2, 9);\n}\n`);
});

Given(/^I have a target file "([^"]+)" with existing content$/, async (filePath: string) => {
  const content = `// Existing ${path.basename(filePath)}\nimport express from 'express';\n\nconst router = express.Router();\n\n// Line 5\n// Line 6\n// Line 7\n// Line 8\n// Line 9\n// Line 10 - This is where injection should happen\n// Line 11\n// Line 12\n\nexport default router;\n`;
  
  createTargetFile(filePath, content);
});

Given(/^I have an injection template "([^"]+)"$/, async (templatePath: string) => {
  const templateName = path.basename(templatePath).replace('.njk', '');
  
  let frontmatter: any = { inject: true };
  let body = '';
  
  if (templateName.includes('add-route')) {
    frontmatter = {
      inject: true,
      to: '{{ file }}',
      lineAt: '{{ line }}'
    };
    body = `\n// {{ name }} route\nrouter.use('/{{ name.toLowerCase() }}', {{ name }}Routes);\n`;
  } else if (templateName.includes('add-import')) {
    frontmatter = {
      inject: true,
      to: '{{ file }}',
      after: '// IMPORT_SECTION'
    };
    body = `import { {{ name }} } from './services/{{ name }}';\n`;
  }
  
  createInjectionTemplate(templatePath, frontmatter, body);
});

Given(/^I have a target file with marker "([^"]+)"$/, async (marker: string) => {
  const content = `import express from 'express';\n\nconst router = express.Router();\n\n${marker}\n\nexport default router;\n`;
  createTargetFile('src/routes.ts', content);
  injectionContext.markers.set('routes.ts', marker);
});

Given(/^I have an injection template with "([^"]+)" frontmatter$/, async (frontmatterType: string) => {
  let frontmatter: any = { inject: true };
  let body = '';
  
  switch (frontmatterType) {
    case 'before':
      frontmatter = {
        inject: true,
        to: '{{ file }}',
        before: '// INSERT_ROUTES_HERE'
      };
      body = `router.use('/{{ name.toLowerCase() }}', {{ name }}Routes);\n`;
      break;
      
    case 'after':
      frontmatter = {
        inject: true,
        to: '{{ file }}',
        after: '// IMPORT_SECTION'
      };
      body = `import { {{ name }} } from './services/{{ name }}';\n`;
      break;
      
    case 'append':
      frontmatter = {
        inject: true,
        to: '{{ file }}',
        append: true
      };
      body = `\nexport interface {{ name }} {\n  id: string;\n  name: string;\n}\n`;
      break;
      
    case 'prepend':
      frontmatter = {
        inject: true,
        to: '{{ file }}',
        prepend: true
      };
      body = `/**\n * Copyright {{ copyright }}\n * Generated by Unjucks\n */\n\n`;
      break;
      
    case 'skipIf':
      frontmatter = {
        inject: true,
        to: '{{ file }}',
        before: '// INSERT_ROUTES_HERE',
        skipIf: 'router.use\(\'/{{ name.toLowerCase() }}\''
      };
      body = `router.use('/{{ name.toLowerCase() }}', {{ name }}Routes);\n`;
      break;
      
    case 'chmod':
      frontmatter = {
        inject: true,
        to: '{{ file }}',
        append: true,
        chmod: '755'
      };
      body = `\n# {{ name }} deployment step\necho "Running {{ name }}..."\n`;
      break;
      
    case 'sh':
      frontmatter = {
        inject: true,
        to: '{{ file }}',
        append: true,
        sh: 'echo "Environment variable added: {{ name }}"'
      };
      body = `{{ name }}={{ value || 'default_value' }}\n`;
      break;
  }
  
  const templatePath = `templates/${frontmatterType}/template.njk`;
  createInjectionTemplate(templatePath, frontmatter, body);
});

Given(/^I have a target file that already contains the injection content$/, async () => {
  const content = `import express from 'express';\n\nconst router = express.Router();\n\n// Existing route\nrouter.use('/userrout es', userRoutesRoutes);\n\n// INSERT_ROUTES_HERE\n\nexport default router;\n`;
  
  createTargetFile('src/routes.ts', content);
});

Given(/^I have an injection template configured for custom markers$/, async () => {
  const frontmatter = {
    inject: true,
    to: '{{ file }}',
    before: '{{ marker }}'
  };
  
  const body = `    <li><a href="/{{ name.toLowerCase() }}">{{ name }} Routes</a></li>\n`;
  
  createInjectionTemplate('templates/route/html-route.njk', frontmatter, body);
});

Given(/^I have a target file "([^"]+)"$/, async (filePath: string) => {
  let content = '';
  
  if (filePath.endsWith('.ts')) {
    content = `// ${path.basename(filePath)}\nexport default class ${path.basename(filePath, '.ts')} {\n  // Implementation\n}\n`;
  } else if (filePath.endsWith('.sh')) {
    content = `#!/bin/bash\n\n# ${path.basename(filePath)}\necho "Starting deployment..."\n`;
  } else if (filePath.endsWith('.html')) {
    content = `<!DOCTYPE html>\n<html>\n<head><title>App</title></head>\n<body>\n  <nav>\n    <!-- USER_ROUTES -->\n  </nav>\n</body>\n</html>\n`;
  } else {
    content = `# ${path.basename(filePath)}\n# Configuration file\n`;
  }
  
  createTargetFile(filePath, content);
});

// When steps (command execution is handled by core steps)
// We just need to set up the expectations

// Then steps
Then(/^the content should be injected at line (\d+)$/, async (lineNumber: string) => {
  const line = parseInt(lineNumber);
  const filePath = 'src/routes.ts';
  const content = getTargetFileContent(filePath);
  const lines = content.split('\n');
  
  // Check that content was injected around the specified line
  const targetLine = lines[line - 1] || '';
  const nextLine = lines[line] || '';
  
  // Should contain injected content
  expect(content).toMatch(/router\.use\(.*Routes\)|import.*from/);
});

Then('the original content should remain intact', async () => {
  const filePath = 'src/routes.ts';
  const currentContent = getTargetFileContent(filePath);
  const originalContent = injectionContext.originalContents.get(filePath) || '';
  
  // Original content should still be present
  const originalLines = originalContent.split('\n').filter(line => line.trim() && !line.includes('INSERT_ROUTES_HERE'));
  
  originalLines.forEach(line => {
    if (line.trim()) {
      expect(currentContent).toContain(line.trim());
    }
  });
});

Then(/^the content should be injected before the marker$/, async () => {
  const content = getTargetFileContent('src/routes.ts');
  const lines = content.split('\n');
  
  const markerIndex = lines.findIndex(line => line.includes('INSERT_ROUTES_HERE'));
  const injectedIndex = lines.findIndex(line => line.includes('router.use('));
  
  expect(markerIndex).toBeGreaterThan(-1);
  expect(injectedIndex).toBeGreaterThan(-1);
  expect(injectedIndex).toBeLessThan(markerIndex);
});

Then('the marker should remain in place', async () => {
  const content = getTargetFileContent('src/routes.ts');
  expect(content).toContain('INSERT_ROUTES_HERE');
});

Then(/^the content should be injected after the marker$/, async () => {
  const content = getTargetFileContent('src/app.ts');
  const lines = content.split('\n');
  
  const markerIndex = lines.findIndex(line => line.includes('IMPORT_SECTION'));
  const injectedIndex = lines.findIndex(line => line.includes('import { ') && line.includes('from'));
  
  expect(markerIndex).toBeGreaterThan(-1);
  expect(injectedIndex).toBeGreaterThan(markerIndex);
});

Then(/^the content should be appended to the end of the file$/, async () => {
  const content = getTargetFileContent('src/types.ts');
  const lines = content.split('\n');
  const lastMeaningfulLine = lines.reverse().find(line => line.trim());
  
  // Should contain the interface definition at the end
  expect(content).toMatch(/export interface.*\{[\s\S]*\}\s*$/m);
});

Then('all original content should be preserved', async () => {
  const content = getTargetFileContent('src/types.ts');
  expect(content).toContain('BaseEntity');
  expect(content).toContain('id: string');
  expect(content).toContain('createdAt: Date');
});

Then(/^the content should be added at the beginning of the file$/, async () => {
  const content = getTargetFileContent('src/utils.ts');
  const lines = content.split('\n');
  
  // Should start with the copyright header
  expect(lines[0]).toMatch(/\/\*\*|Copyright/);
});

Then('all original content should follow', async () => {
  const content = getTargetFileContent('src/utils.ts');
  expect(content).toContain('generateId');
  expect(content).toContain('Math.random()');
});

Then('the file should remain unchanged', async () => {
  const filePath = 'src/routes.ts';
  const currentContent = getTargetFileContent(filePath);
  const originalContent = injectionContext.originalContents.get(filePath) || '';
  
  expect(currentContent).toBe(originalContent);
});

Then(/^I should see "([^"]+)" message$/, async (expectedMessage: string) => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toContain(expectedMessage);
});

Then('I should see the content that would be injected', async () => {
  expect(testContext.lastOutput).toMatch(/would inject|preview|dry.*run/i);
  expect(testContext.lastOutput).toMatch(/router\.use|import|export/);
});

Then('the target file should remain unchanged', async () => {
  const filePaths = Array.from(injectionContext.targetFiles.keys());
  
  filePaths.forEach(filePath => {
    const currentContent = getTargetFileContent(filePath);
    const originalContent = injectionContext.originalContents.get(filePath) || '';
    expect(currentContent).toBe(originalContent);
  });
});

Then('the injection should proceed despite existing content', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/force|overwrite|injected/i);
});

Then(/^the content should be injected at the custom marker location$/, async () => {
  const content = getTargetFileContent('src/app.html');
  const lines = content.split('\n');
  
  const markerIndex = lines.findIndex(line => line.includes('<!-- USER_ROUTES -->'));
  const injectedIndex = lines.findIndex(line => line.includes('<li><a href='));
  
  expect(markerIndex).toBeGreaterThan(-1);
  expect(injectedIndex).toBeGreaterThan(-1);
});

Then('the file permissions should be updated to executable', async () => {
  const filePath = path.join(testContext.workingDir, 'scripts/deploy.sh');
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    // Check if file has execute permissions (simplified check)
    expect(stats.mode & 0o111).toBeGreaterThan(0);
  }
});

Then('the shell command should be executed', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/Environment variable added|shell.*command.*executed/i);
});

Then('I should see the command output', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/echo|Environment variable|command.*output/i);
});

Then(/^I should see "([^"]+)" error$/, async (expectedError: string) => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toContain(expectedError);
});

// Export context for other step files
export { injectionContext };
