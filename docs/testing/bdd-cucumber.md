# BDD/Cucumber Testing with vitest-cucumber

## Overview

Behavior-Driven Development (BDD) testing using vitest-cucumber allows us to write tests in natural language that stakeholders can understand, while maintaining the technical rigor of automated testing.

## Setup and Configuration

### Dependencies

```json
{
  "devDependencies": {
    "@cucumber/cucumber": "^10.0.0",
    "vitest-cucumber": "^0.12.0",
    "vitest": "^1.0.0",
    "@vitest/ui": "^1.0.0"
  }
}
```

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Include feature files
    include: ['tests/**/*.feature.spec.ts'],
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/bdd-setup.ts']
  }
})
```

### BDD Setup File

```typescript
// tests/setup/bdd-setup.ts
import { beforeAll, afterAll } from 'vitest'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'

// Global test environment setup
beforeAll(() => {
  // Create temporary directories for testing
  const testDirs = [
    'tests/temp',
    'tests/temp/templates',
    'tests/temp/output'
  ]
  
  testDirs.forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  })
})

afterAll(() => {
  // Cleanup temporary files
  if (existsSync('tests/temp')) {
    rmSync('tests/temp', { recursive: true, force: true })
  }
})
```

## Feature File Structure

### Template Generation Feature

```gherkin
# tests/features/template-generation.feature
Feature: Template Generation
  As a developer
  I want to generate code from templates
  So that I can quickly scaffold new projects

  Background:
    Given the Unjucks CLI is available
    And I have a clean working directory

  Scenario: List available templates
    When I run "unjucks list"
    Then I should see a list of available templates
    And the output should include "command" template
    And the output should include "api" template

  Scenario: Generate a simple command template
    Given I have the "command" template available
    When I run "unjucks generate command citty --commandName UserManager --dest ./output"
    Then the command should succeed
    And a file "output/user-manager.ts" should be created
    And the file should contain "export class UserManagerCommand"
    And the file should contain proper TypeScript syntax

  Scenario: Generate with custom variables
    Given I have the "api" template available  
    When I run "unjucks generate api fastify --projectName MyAPI --withAuth true --dest ./output"
    Then the command should succeed
    And a file "output/my-api/server.ts" should be created
    And the file should contain authentication middleware
    And a file "output/my-api/routes/index.ts" should be created

  Scenario: Dry run mode
    Given I have the "command" template available
    When I run "unjucks generate command citty --commandName TestCmd --dest ./output --dry"
    Then the command should succeed
    And no files should be created in "./output"
    And the output should show what would be generated
    And the output should include "Would create: test-cmd.ts"

  Scenario: Template with missing required variables
    Given I have the "command" template available
    When I run "unjucks generate command citty --dest ./output"
    Then the command should fail
    And the error should mention "commandName is required"
    And no files should be created
```

### File Injection Feature

```gherkin
# tests/features/file-injection.feature
Feature: File Injection
  As a developer
  I want to inject code into existing files
  So that I can extend functionality without overwriting

  Background:
    Given I have an existing TypeScript file "src/index.ts" with:
      """
      export class Application {
        // Existing code
      }
      """

  Scenario: Inject method into existing class
    Given I have an injection template "method/add-method"
    When I run "unjucks inject method add-method --targetFile src/index.ts --methodName getUserById --methodType async"
    Then the command should succeed
    And the file "src/index.ts" should contain the original content
    And the file should contain the new method "async getUserById"
    And the injection should be properly formatted

  Scenario: Inject with skipIf condition
    Given the file "src/index.ts" already contains "getUserById"
    And I have an injection template with skipIf condition
    When I run "unjucks inject method add-method --targetFile src/index.ts --methodName getUserById"
    Then the command should succeed
    And the file should not be modified
    And the output should indicate "Skipped: method already exists"

  Scenario: Inject at specific line
    Given I have an injection template "import/add-import"
    When I run "unjucks inject import add-import --targetFile src/index.ts --lineAt 1 --importName fastify"
    Then the command should succeed
    And the import should be added at line 1
    And existing imports should be preserved
    And the file should have valid TypeScript syntax

  Scenario: Inject with before/after markers
    Given the file contains marker comments "// INJECT:METHODS:START" and "// INJECT:METHODS:END"
    When I run "unjucks inject method add-method --targetFile src/index.ts --before 'INJECT:METHODS:END'"
    Then the new method should be inserted before the end marker
    And the markers should remain in place
```

### Error Handling Feature  

```gherkin
# tests/features/error-handling.feature
Feature: Error Handling
  As a developer
  I want meaningful error messages when things go wrong
  So that I can quickly resolve issues

  Scenario: Template not found
    When I run "unjucks generate nonexistent generator --dest ./output"
    Then the command should fail with exit code 1
    And the error should contain "Template 'nonexistent' not found"
    And the error should suggest available templates

  Scenario: Invalid template syntax
    Given I have a template with invalid Nunjucks syntax
    When I run "unjucks generate broken template --dest ./output"
    Then the command should fail with exit code 1
    And the error should contain "Template syntax error"
    And the error should include line number and position

  Scenario: Permission denied
    Given I don't have write permissions to the output directory
    When I run "unjucks generate command citty --dest /root/readonly --commandName Test"
    Then the command should fail
    And the error should contain "Permission denied"
    And the error should suggest checking directory permissions

  Scenario: Disk space insufficient
    Given the output directory has insufficient disk space
    When I run "unjucks generate large-project template --dest ./output"
    Then the command should fail
    And the error should contain "Insufficient disk space"
    And partial files should be cleaned up
```

## Step Definitions

### Basic Steps

```typescript
// tests/features/template-generation.feature.spec.ts
import { describe, it, beforeEach, afterEach } from 'vitest'
import { Given, When, Then, Before, After } from 'vitest-cucumber'
import { execSync } from 'child_process'
import { existsSync, readFileSync, rmSync, mkdirSync } from 'fs'
import { join } from 'path'

// Test context to share state between steps
interface TestContext {
  lastCommand?: string
  lastOutput?: string
  lastError?: string
  lastExitCode?: number
  workingDir: string
}

const testContext: TestContext = {
  workingDir: join(process.cwd(), 'tests/temp')
}

Before(() => {
  // Clean up before each scenario
  if (existsSync(testContext.workingDir)) {
    rmSync(testContext.workingDir, { recursive: true })
  }
  mkdirSync(testContext.workingDir, { recursive: true })
  process.chdir(testContext.workingDir)
})

After(() => {
  // Return to original directory
  process.chdir(join(__dirname, '../..'))
})

Given('the Unjucks CLI is available', () => {
  // Verify CLI can be executed
  try {
    execSync('npx unjucks --version', { stdio: 'pipe' })
  } catch (error) {
    throw new Error('Unjucks CLI not available')
  }
})

Given('I have a clean working directory', () => {
  // Already handled in Before hook
  expect(existsSync(testContext.workingDir)).toBe(true)
})

When('I run {string}', (command: string) => {
  testContext.lastCommand = command
  
  try {
    testContext.lastOutput = execSync(command, {
      encoding: 'utf8',
      cwd: testContext.workingDir,
      stdio: 'pipe'
    })
    testContext.lastExitCode = 0
    testContext.lastError = undefined
  } catch (error: any) {
    testContext.lastExitCode = error.status || 1
    testContext.lastError = error.stderr || error.message
    testContext.lastOutput = error.stdout || ''
  }
})

Then('the command should succeed', () => {
  expect(testContext.lastExitCode).toBe(0)
  if (testContext.lastError) {
    console.error('Unexpected error:', testContext.lastError)
  }
})

Then('the command should fail', () => {
  expect(testContext.lastExitCode).not.toBe(0)
})

Then('I should see a list of available templates', () => {
  expect(testContext.lastOutput).toMatch(/available templates/i)
  expect(testContext.lastOutput).toBeDefined()
  expect(testContext.lastOutput!.length).toBeGreaterThan(0)
})

Then('the output should include {string} template', (templateName: string) => {
  expect(testContext.lastOutput).toContain(templateName)
})

Then('a file {string} should be created', (filePath: string) => {
  const fullPath = join(testContext.workingDir, filePath)
  expect(existsSync(fullPath)).toBe(true)
})

Then('the file should contain {string}', (content: string) => {
  // Find the most recently mentioned file
  const fileMatches = testContext.lastOutput?.match(/created?: (.+\.ts)/i)
  if (!fileMatches) {
    throw new Error('No file path found in output')
  }
  
  const filePath = join(testContext.workingDir, fileMatches[1])
  const fileContent = readFileSync(filePath, 'utf8')
  expect(fileContent).toContain(content)
})
```

### Advanced Step Definitions

```typescript
// Complex step definitions for file injection
Given('I have an existing TypeScript file {string} with:', 
  (filePath: string, fileContent: string) => {
    const fullPath = join(testContext.workingDir, filePath)
    const dir = dirname(fullPath)
    
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    
    writeFileSync(fullPath, fileContent.trim())
    expect(existsSync(fullPath)).toBe(true)
  }
)

Given('the file {string} already contains {string}', 
  (filePath: string, content: string) => {
    const fullPath = join(testContext.workingDir, filePath)
    const currentContent = readFileSync(fullPath, 'utf8')
    
    if (!currentContent.includes(content)) {
      // Add the content so the skipIf test works
      const updatedContent = currentContent + `\n  ${content}() {}\n`
      writeFileSync(fullPath, updatedContent)
    }
  }
)

Then('the file should not be modified', () => {
  // Compare with original content stored in context
  const originalContent = testContext.originalFileContent
  const currentContent = readFileSync(
    join(testContext.workingDir, 'src/index.ts'), 
    'utf8'
  )
  
  expect(currentContent).toBe(originalContent)
})

Then('the output should indicate {string}', (message: string) => {
  expect(testContext.lastOutput).toContain(message)
})

Then('the injection should be properly formatted', () => {
  const filePath = join(testContext.workingDir, 'src/index.ts')
  const content = readFileSync(filePath, 'utf8')
  
  // Verify TypeScript syntax is valid
  expect(content).toMatch(/^\s*async\s+\w+\([^)]*\)\s*{/m)
  
  // Verify proper indentation
  const lines = content.split('\n')
  const methodLines = lines.filter(line => line.includes('async'))
  
  methodLines.forEach(line => {
    expect(line).toMatch(/^\s{2,}/) // At least 2 spaces indentation
  })
})
```

### Error Handling Steps

```typescript
// Error scenario step definitions
Then('the command should fail with exit code {int}', (exitCode: number) => {
  expect(testContext.lastExitCode).toBe(exitCode)
})

Then('the error should contain {string}', (errorMessage: string) => {
  const allOutput = (testContext.lastError || '') + (testContext.lastOutput || '')
  expect(allOutput).toContain(errorMessage)
})

Then('the error should suggest available templates', () => {
  const errorOutput = testContext.lastError || testContext.lastOutput || ''
  expect(errorOutput).toMatch(/available templates?:/i)
  expect(errorOutput).toMatch(/command|api|component/i)
})

Then('the error should include line number and position', () => {
  const errorOutput = testContext.lastError || testContext.lastOutput || ''
  expect(errorOutput).toMatch(/line\s+\d+/i)
  expect(errorOutput).toMatch(/position\s+\d+|column\s+\d+/i)
})
```

## Custom Step Definitions

### Template Validation Steps

```typescript
// Custom steps for template-specific testing
Given('I have the {string} template available', (templateName: string) => {
  // Verify template exists in the template directory
  const templatePath = join(process.cwd(), 'templates', templateName)
  expect(existsSync(templatePath)).toBe(true)
})

Given('I have an injection template {string}', (templateName: string) => {
  // Verify injection template exists
  const templatePath = join(process.cwd(), 'templates', templateName)
  expect(existsSync(templatePath)).toBe(true)
  
  // Verify it has injection frontmatter
  const templateFiles = readdirSync(templatePath, { recursive: true })
  const hasInjectionTemplate = templateFiles.some(file => {
    if (!file.endsWith('.njk')) return false
    
    const content = readFileSync(join(templatePath, file), 'utf8')
    return content.includes('inject:') || content.includes('before:') || content.includes('after:')
  })
  
  expect(hasInjectionTemplate).toBe(true)
})

Then('the file should have valid TypeScript syntax', () => {
  // Use TypeScript compiler to validate syntax
  const filePath = join(testContext.workingDir, 'src/index.ts')
  
  try {
    execSync(`npx tsc --noEmit --strict ${filePath}`, { 
      stdio: 'pipe',
      cwd: process.cwd()
    })
  } catch (error: any) {
    throw new Error(`TypeScript compilation failed: ${error.stderr}`)
  }
})
```

### Performance Steps

```typescript
// Performance-related steps
Then('the command should complete in under {int} seconds', (seconds: number) => {
  // This would require tracking execution time in the When step
  expect(testContext.executionTime).toBeLessThan(seconds * 1000)
})

Then('memory usage should remain under {int} MB', (maxMemoryMB: number) => {
  // This would require memory monitoring during execution
  expect(testContext.peakMemoryUsage).toBeLessThan(maxMemoryMB * 1024 * 1024)
})
```

## Running BDD Tests

### Test Commands

```bash
# Run all BDD tests
npm run test:bdd

# Run specific feature
npm run test:bdd -- --grep "Template Generation"

# Run with verbose output
npm run test:bdd -- --reporter=verbose

# Run in watch mode for development
npm run test:bdd:watch
```

### Package.json Scripts

```json
{
  "scripts": {
    "test:bdd": "vitest run --config vitest.config.bdd.ts",
    "test:bdd:watch": "vitest --config vitest.config.bdd.ts",
    "test:bdd:ui": "vitest --ui --config vitest.config.bdd.ts",
    "test:bdd:coverage": "vitest run --coverage --config vitest.config.bdd.ts"
  }
}
```

### BDD-specific Vitest Configuration

```typescript
// vitest.config.bdd.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/features/**/*.feature.spec.ts'],
    exclude: ['tests/unit/**', 'tests/integration/**'],
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/bdd-setup.ts'],
    timeout: 30000, // BDD tests may take longer
    testTimeout: 30000,
    hookTimeout: 30000
  }
})
```

## Best Practices

### Feature File Organization

1. **Single Feature per File**: Each feature file should focus on one main functionality
2. **Background Sections**: Use Background for common setup steps
3. **Scenario Outlines**: Use for data-driven tests with multiple inputs
4. **Clear Scenarios**: Each scenario should test one specific behavior
5. **Meaningful Names**: Use descriptive scenario names that explain the value

### Step Definition Guidelines

1. **Reusable Steps**: Create generic steps that can be reused across features
2. **State Management**: Use test context to share state between steps
3. **Cleanup**: Ensure proper cleanup in Before/After hooks
4. **Error Handling**: Include both success and failure scenarios
5. **Assertions**: Make assertions specific and meaningful

### Data Management

```typescript
// Use scenario outlines for data-driven tests
Scenario Outline: Generate different template types
  Given I have the "<template>" template available
  When I run "unjucks generate <template> <generator> --dest ./output <flags>"
  Then the command should succeed
  And the output should contain "<expected>"

  Examples:
    | template | generator | flags                    | expected              |
    | command  | citty     | --commandName Test       | TestCommand           |
    | api      | fastify   | --projectName MyAPI      | MyAPI                 |
    | react    | vite      | --componentName Button   | ButtonComponent       |
```

### Performance Considerations

1. **Parallel Execution**: Run independent scenarios in parallel
2. **Shared Setup**: Use Background for common expensive setup
3. **Test Isolation**: Ensure tests don't interfere with each other
4. **Resource Cleanup**: Clean up files and processes after tests
5. **Timeout Management**: Set appropriate timeouts for different operations

### Integration with CI/CD

```yaml
# GitHub Actions integration
- name: Run BDD Tests
  run: |
    npm run test:bdd
    npm run test:bdd:coverage
    
- name: Upload BDD Results
  uses: actions/upload-artifact@v3
  with:
    name: bdd-results
    path: |
      test-results/
      coverage/
```

This BDD approach ensures that Unjucks behavior is validated from a user perspective while maintaining technical precision and comprehensive coverage.