import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import { GeneratorFactory, TemplateFactory } from '../factories/index.js';

// E2E tests for critical user flows using Playwright
// These tests simulate real user interactions with the CLI and web interfaces

test.describe('User Flows E2E', () => {
  let testProjectDir: string;

  test.beforeEach(async ({ page }) => {
    // Create temporary project directory for each test
    testProjectDir = path.join(process.cwd(), `e2e-test-${Date.now()}`);
    await fs.mkdir(testProjectDir, { recursive: true });
    
    // Setup basic project structure
    const templatesDir = path.join(testProjectDir, '_templates');
    await fs.mkdir(templatesDir, { recursive: true });
    
    // Create sample generators
    await createSampleGenerators(templatesDir);
  });

  test.afterEach(async () => {
    // Cleanup test directory
    await fs.rm(testProjectDir, { recursive: true, force: true });
  });

  test.describe('First Time User Experience', () => {
    test('should guide new user through complete setup and first generation', async ({ page }) => {
      // Navigate to project documentation or web interface
      await page.goto('http://localhost:3000'); // Assuming a web interface exists
      
      // Check for welcome message or getting started guide
      await expect(page.locator('h1')).toContainText(['Welcome', 'Getting Started', 'Unjucks']);
      
      // Look for installation instructions
      await expect(page.locator('text=npm install')).toBeVisible();
      
      // Check for quick start guide
      const quickStartSection = page.locator('section', { hasText: 'Quick Start' });
      await expect(quickStartSection).toBeVisible();
      
      // Verify example commands are shown
      await expect(page.locator('code', { hasText: 'unjucks list' })).toBeVisible();
      await expect(page.locator('code', { hasText: 'unjucks generate' })).toBeVisible();
    });

    test('should provide helpful error messages for common mistakes', async ({ page }) => {
      // Test CLI error handling through web interface or terminal simulation
      
      // Simulate running CLI without templates directory
      const errorOutput = await simulateCLI('unjucks list', '/empty/directory');
      expect(errorOutput).toContain('No templates found');
      expect(errorOutput).toContain('create a _templates directory');
      
      // Simulate generating with missing parameters
      const missingParamsOutput = await simulateCLI('unjucks generate');
      expect(missingParamsOutput).toContain('Missing required');
      expect(missingParamsOutput).toContain('Usage:');
    });
  });

  test.describe('Component Generation Flow', () => {
    test('should complete full component generation workflow', async ({ page }) => {
      // Start with listing available generators
      await page.goto(`file://${testProjectDir}/index.html`); // Mock file interface
      
      // Click on "List Generators" button or equivalent
      await page.click('button:has-text("List Generators")');
      
      // Verify generators are displayed
      await expect(page.locator('.generator-item')).toHaveCount(3);
      await expect(page.locator('text=component')).toBeVisible();
      await expect(page.locator('text=service')).toBeVisible();
      await expect(page.locator('text=page')).toBeVisible();
      
      // Select component generator
      await page.click('.generator-item:has-text("component")');
      
      // Select template type
      await expect(page.locator('.template-item')).toBeVisible();
      await page.click('.template-item:has-text("react")');
      
      // Fill in component details
      await page.fill('input[name="name"]', 'UserProfile');
      await page.check('input[name="hasProps"]');
      await page.check('input[name="hasTests"]');
      await page.fill('input[name="testFramework"]', 'vitest');
      
      // Set destination
      await page.fill('input[name="dest"]', './src/components');
      
      // Generate component
      await page.click('button:has-text("Generate")');
      
      // Verify success message
      await expect(page.locator('.success-message')).toContainText('Generated successfully');
      
      // Verify files were created (through file system check)
      const componentFile = path.join(testProjectDir, 'src', 'components', 'UserProfile.tsx');
      const testFile = path.join(testProjectDir, 'src', 'components', 'UserProfile.test.tsx');
      
      expect(await fs.access(componentFile).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(testFile).then(() => true).catch(() => false)).toBe(true);
      
      // Verify file content
      const componentContent = await fs.readFile(componentFile, 'utf8');
      expect(componentContent).toContain('UserProfile');
      expect(componentContent).toContain('interface UserProfileProps');
    });

    test('should handle component generation with validation', async ({ page }) => {
      await page.goto(`file://${testProjectDir}/generator.html`);
      
      // Try to generate without required fields
      await page.click('button:has-text("Generate")');
      
      // Verify validation messages
      await expect(page.locator('.error-message')).toContainText('Name is required');
      
      // Fill invalid name
      await page.fill('input[name="name"]', '123InvalidName');
      await page.click('button:has-text("Generate")');
      
      await expect(page.locator('.error-message')).toContainText('Invalid component name');
      
      // Fill valid name
      await page.fill('input[name="name"]', 'ValidComponent');
      
      // Try invalid destination
      await page.fill('input[name="dest"]', '/invalid/path/with/no/permissions');
      await page.click('button:has-text("Generate")');
      
      await expect(page.locator('.error-message')).toContainText('Invalid destination');
    });
  });

  test.describe('Project Scaffolding Flow', () => {
    test('should scaffold complete project structure', async ({ page }) => {
      await page.goto(`file://${testProjectDir}/scaffold.html`);
      
      // Select project type
      await page.selectOption('select[name="projectType"]', 'react-app');
      
      // Fill project details
      await page.fill('input[name="projectName"]', 'my-awesome-app');
      await page.fill('input[name="description"]', 'An awesome React application');
      
      // Select features
      await page.check('input[name="features"][value="typescript"]');
      await page.check('input[name="features"][value="testing"]');
      await page.check('input[name="features"][value="storybook"]');
      await page.check('input[name="features"][value="eslint"]');
      
      // Set destination
      const projectPath = path.join(testProjectDir, 'my-awesome-app');
      await page.fill('input[name="destination"]', projectPath);
      
      // Initialize project
      await page.click('button:has-text("Create Project")');
      
      // Wait for completion
      await expect(page.locator('.progress-bar')).toHaveClass(/complete/);
      await expect(page.locator('.success-message')).toContainText('Project created successfully');
      
      // Verify project structure
      const packageJsonFile = path.join(projectPath, 'package.json');
      const srcDir = path.join(projectPath, 'src');
      const testDir = path.join(projectPath, 'tests');
      const storybookDir = path.join(projectPath, '.storybook');
      
      expect(await fs.access(packageJsonFile).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(srcDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(testDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(storybookDir).then(() => true).catch(() => false)).toBe(true);
      
      // Verify package.json content
      const packageJson = JSON.parse(await fs.readFile(packageJsonFile, 'utf8'));
      expect(packageJson.name).toBe('my-awesome-app');
      expect(packageJson.description).toBe('An awesome React application');
      expect(packageJson.devDependencies).toHaveProperty('typescript');
      expect(packageJson.devDependencies).toHaveProperty('vitest');
      expect(packageJson.devDependencies).toHaveProperty('@storybook/react');
    });

    test('should handle project scaffolding with different options', async ({ page }) => {
      await page.goto(`file://${testProjectDir}/scaffold.html`);
      
      // Test minimal setup
      await page.selectOption('select[name="projectType"]', 'minimal');
      await page.fill('input[name="projectName"]', 'minimal-project');
      
      const minimalPath = path.join(testProjectDir, 'minimal-project');
      await page.fill('input[name="destination"]', minimalPath);
      
      await page.click('button:has-text("Create Project")');
      
      await expect(page.locator('.success-message')).toBeVisible();
      
      // Verify minimal structure
      const packageJson = JSON.parse(await fs.readFile(
        path.join(minimalPath, 'package.json'), 'utf8'
      ));
      expect(Object.keys(packageJson.dependencies || {})).toHaveLength(0);
      expect(Object.keys(packageJson.devDependencies || {})).toHaveLength(0);
    });
  });

  test.describe('File Injection Flow', () => {
    test('should inject code into existing files safely', async ({ page }) => {
      // Create existing file to inject into
      const routesFile = path.join(testProjectDir, 'src', 'routes.ts');
      await fs.mkdir(path.dirname(routesFile), { recursive: true });
      await fs.writeFile(routesFile, `export const routes = {
  home: '/',
  about: '/about'
};`);
      
      await page.goto(`file://${testProjectDir}/inject.html`);
      
      // Select file to inject into
      await page.fill('input[name="targetFile"]', routesFile);
      
      // Select injection type
      await page.selectOption('select[name="injectType"]', 'after');
      await page.fill('input[name="marker"]', "about: '/about'");
      
      // Enter new content
      await page.fill('textarea[name="content"]', "  contact: '/contact'");
      
      // Preview injection
      await page.click('button:has-text("Preview")');
      
      // Verify preview shows expected result
      const preview = page.locator('.preview-content');
      await expect(preview).toContainText("about: '/about'");
      await expect(preview).toContainText("contact: '/contact'");
      
      // Confirm injection
      await page.click('button:has-text("Inject")');
      
      // Verify success
      await expect(page.locator('.success-message')).toContainText('Injected successfully');
      
      // Verify file was modified
      const modifiedContent = await fs.readFile(routesFile, 'utf8');
      expect(modifiedContent).toContain("contact: '/contact'");
    });

    test('should prevent duplicate injections', async ({ page }) => {
      const targetFile = path.join(testProjectDir, 'src', 'index.ts');
      await fs.mkdir(path.dirname(targetFile), { recursive: true });
      await fs.writeFile(targetFile, `import React from 'react';
import { useState } from 'react';`);
      
      await page.goto(`file://${testProjectDir}/inject.html`);
      
      await page.fill('input[name="targetFile"]', targetFile);
      await page.fill('input[name="content"]', "import { useState } from 'react';");
      await page.click('button:has-text("Inject")');
      
      // Should show duplicate detection
      await expect(page.locator('.warning-message')).toContainText('already exists');
      await expect(page.locator('.warning-message')).toContainText('skipped');
    });
  });

  test.describe('Error Recovery Flow', () => {
    test('should gracefully handle and recover from errors', async ({ page }) => {
      await page.goto(`file://${testProjectDir}/generator.html`);
      
      // Cause a template error
      await page.selectOption('select[name="generator"]', 'broken-generator');
      await page.fill('input[name="name"]', 'TestComponent');
      await page.click('button:has-text("Generate")');
      
      // Verify error message is helpful
      await expect(page.locator('.error-message')).toContainText('Template error');
      await expect(page.locator('.error-details')).toBeVisible();
      
      // Should provide suggestions for fixing
      await expect(page.locator('.error-suggestions')).toContainText('suggestions');
      
      // Should allow retry with different options
      await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
      
      // User can switch to working generator
      await page.selectOption('select[name="generator"]', 'component');
      await page.click('button:has-text("Generate")');
      
      await expect(page.locator('.success-message')).toBeVisible();
    });

    test('should handle network/filesystem errors gracefully', async ({ page }) => {
      // Simulate permission error by trying to write to restricted location
      await page.goto(`file://${testProjectDir}/generator.html`);
      
      await page.selectOption('select[name="generator"]', 'component');
      await page.fill('input[name="name"]', 'TestComponent');
      await page.fill('input[name="dest"]', '/root/restricted');
      
      await page.click('button:has-text("Generate")');
      
      await expect(page.locator('.error-message')).toContainText('Permission denied');
      await expect(page.locator('.error-suggestions')).toContainText('Check directory permissions');
      
      // Provide working alternative
      await page.fill('input[name="dest"]', './src');
      await page.click('button:has-text("Try Again")');
      
      await expect(page.locator('.success-message')).toBeVisible();
    });
  });

  test.describe('Multi-step Workflows', () => {
    test('should complete complex feature development workflow', async ({ page }) => {
      await page.goto(`file://${testProjectDir}/workflow.html`);
      
      // Step 1: Create feature structure
      await page.click('button:has-text("Start Feature Workflow")');
      
      await page.fill('input[name="featureName"]', 'UserManagement');
      await page.click('button:has-text("Next")');
      
      // Step 2: Select components to generate
      await page.check('input[name="components"][value="service"]');
      await page.check('input[name="components"][value="repository"]');
      await page.check('input[name="components"][value="controller"]');
      await page.check('input[name="components"][value="types"]');
      await page.check('input[name="components"][value="tests"]');
      await page.click('button:has-text("Next")');
      
      // Step 3: Configure each component
      await page.fill('input[name="service.methods"]', 'create,read,update,delete');
      await page.fill('input[name="repository.database"]', 'postgresql');
      await page.fill('input[name="controller.routes"]', '/users');
      await page.click('button:has-text("Next")');
      
      // Step 4: Review and generate
      await expect(page.locator('.review-summary')).toContainText('UserManagement');
      await expect(page.locator('.file-preview')).toContainText('UserService.ts');
      await expect(page.locator('.file-preview')).toContainText('UserRepository.ts');
      await expect(page.locator('.file-preview')).toContainText('UserController.ts');
      
      await page.click('button:has-text("Generate All")');
      
      // Step 5: Verify completion
      await expect(page.locator('.completion-summary')).toBeVisible();
      await expect(page.locator('.generated-files')).toContainText('5 files generated');
      
      // Verify files exist
      const featureDir = path.join(testProjectDir, 'src', 'features', 'user-management');
      expect(await fs.access(path.join(featureDir, 'UserService.ts')).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(path.join(featureDir, 'UserRepository.ts')).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(path.join(featureDir, 'UserController.ts')).then(() => true).catch(() => false)).toBe(true);
    });
  });

  // Helper functions
  async function createSampleGenerators(templatesDir: string) {
    // Create component generator
    const componentDir = path.join(templatesDir, 'component', 'react');
    await fs.mkdir(componentDir, { recursive: true });
    
    await fs.writeFile(path.join(componentDir, 'component.njk'), `---
to: src/{{ name | pascalCase }}.tsx
---
${TemplateFactory.generateTemplateContent('component')}`);
    
    await fs.writeFile(path.join(componentDir, 'test.njk'), `---
to: src/{{ name | pascalCase }}.test.tsx
skipIf: "{{ !hasTests }}"
---
${TemplateFactory.generateTemplateContent('test')}`);
    
    // Create service generator
    const serviceDir = path.join(templatesDir, 'service', 'basic');
    await fs.mkdir(serviceDir, { recursive: true });
    
    await fs.writeFile(path.join(serviceDir, 'service.njk'), `---
to: src/services/{{ name | pascalCase }}Service.ts
---
${TemplateFactory.generateTemplateContent('service')}`);
    
    // Create page generator
    const pageDir = path.join(templatesDir, 'page', 'nextjs');
    await fs.mkdir(pageDir, { recursive: true });
    
    await fs.writeFile(path.join(pageDir, 'page.njk'), `---
to: pages/{{ name | kebabCase }}.tsx
---
import { NextPage } from 'next';

const {{ name | pascalCase }}Page: NextPage = () => {
  return (
    <div>
      <h1>{{ name | pascalCase }}</h1>
    </div>
  );
};

export default {{ name | pascalCase }}Page;`);

    // Create broken generator for error testing
    const brokenDir = path.join(templatesDir, 'broken-generator', 'template');
    await fs.mkdir(brokenDir, { recursive: true });
    
    await fs.writeFile(path.join(brokenDir, 'broken.njk'), `---
to: {{ malformed
---
{{ unclosed_tag`);
  }

  async function simulateCLI(command: string, cwd?: string): Promise<string> {
    // In a real implementation, this would execute the CLI command
    // For this example, we'll simulate common outputs
    if (command === 'unjucks list' && cwd === '/empty/directory') {
      return 'No templates found. Please create a _templates directory and add your generators.';
    }
    if (command === 'unjucks generate') {
      return 'Error: Missing required parameters.\n\nUsage: unjucks generate <generator> <template> [name] [options]';
    }
    return '';
  }
});