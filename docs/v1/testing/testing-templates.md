# Testing Templates

Practical guide to testing generators, templates, and file operations in Unjucks.

## Template Testing Essentials

### Basic Template Test Structure

```gherkin
Feature: Component Generator
  As a developer
  I want to generate React components  
  So that I can scaffold consistent UI elements

  Background:
    Given I have a clean workspace
    And I have the component generator available

  Scenario: Generate basic component
    When I run "unjucks generate component react --componentName Button --dest ./src"
    Then the command should succeed
    And file "./src/Button.tsx" should be created
    And file "./src/Button.tsx" should contain "export const Button"
```

### Test Implementation Pattern

```typescript
// tests/step-definitions/generator-steps.ts
import { Given, When, Then } from '@cucumber/cucumber';
import { UnjucksWorld } from '../support/world.js';

Given('I have the component generator available', async function (this: UnjucksWorld) {
  await this.createTemplateStructure({
    'component/react/{{ componentName | pascalCase }}.tsx': `
import React from 'react';

export const {{ componentName | pascalCase }}: React.FC = () => {
  return <div>{{ componentName | titleCase }}</div>;
};`
  });
});

When('I run {string}', async function (this: UnjucksWorld, command: string) {
  await this.executeUnjucksCommand(command.split(' ').slice(1)); // Remove 'unjucks'
});

Then('file {string} should contain {string}', async function (this: UnjucksWorld, filePath: string, expectedContent: string) {
  const content = await this.readGeneratedFile(filePath);
  expect(content).toContain(expectedContent);
});
```

## Common Testing Patterns

### 1. Variable Testing

```gherkin
Scenario Outline: Generate with different variables
  When I run "unjucks generate component react --componentName <name> --withProps <props> --dest ./src"
  Then file "./src/<name>.tsx" should contain "<expected>"
  
  Examples:
    | name     | props | expected        |
    | Button   | true  | ButtonProps     |
    | Input    | false | React.FC        |
    | Card     | true  | CardProps       |
```

### 2. Filter Testing

```gherkin
Scenario: Test string filters
  Given I have a template with "{{ name | kebabCase }}-component.tsx"
  When I generate with name "MyAwesomeButton"
  Then file "my-awesome-button-component.tsx" should be created
```

### 3. Conditional Logic Testing

```gherkin  
Scenario: Conditional template sections
  Given I have a template with conditional exports
  When I generate with withTests set to true
  Then the generated file should include test exports
  When I generate with withTests set to false  
  Then the generated file should not include test exports
```

### 4. Injection Testing

```gherkin
Scenario: Inject into existing file
  Given I have an existing file "src/index.ts" with content:
    """
    export * from './utils';
    """
  When I inject "export * from './components';" after line containing "utils"
  Then file "src/index.ts" should contain both exports
  And the injection should be idempotent
```

## Quality Validation Patterns

### File System Validation

```typescript
// Verify atomic operations
Then('the operation should be atomic', async function (this: UnjucksWorld) {
  // Check no partial files exist
  const tempFiles = await this.listFiles('.tmp.*');
  expect(tempFiles).toHaveLength(0);
  
  // Verify target file is complete
  const content = await this.readGeneratedFile(this.lastGeneratedFile);
  expect(content).not.toContain('undefined');
  expect(content).not.toContain('{{');
});

// Test idempotency
Then('the operation should be idempotent', async function (this: UnjucksWorld) {
  const contentBefore = await this.readGeneratedFile(this.targetFile);
  
  // Run same operation again
  await this.executeUnjucksCommand(this.lastCommand);
  
  const contentAfter = await this.readGeneratedFile(this.targetFile);
  expect(contentAfter).toEqual(contentBefore);
});
```

### Error Handling Validation

```gherkin
Scenario: Handle missing required variables
  Given I have a component template requiring "componentName"
  When I run "unjucks generate component react --dest ./src"
  Then the command should fail
  And the error should mention "componentName is required"

Scenario: Handle invalid destination
  When I run "unjucks generate component react --dest /root/restricted"
  Then the command should fail  
  And the error should mention "permission denied"
```

### Performance Validation

```gherkin
@performance
Scenario: Generate multiple components efficiently
  When I generate 50 components with different names
  Then the total time should be less than 5 seconds
  And memory usage should remain stable
```

## Template Test Utilities

### Custom World Methods

```typescript
// tests/support/world.ts
export class UnjucksWorld extends World {
  
  // Template creation
  async createTemplateStructure(templates: Record<string, string>) {
    for (const [path, content] of Object.entries(templates)) {
      const fullPath = join(this.templatesDir, path);
      await ensureDir(dirname(fullPath));
      await writeFile(fullPath, content, 'utf8');
    }
  }
  
  // Generator testing
  async testGeneratorOutput(generator: string, template: string, variables: Record<string, any>) {
    const result = await this.executeCommand([
      'generate', generator, template,
      ...Object.entries(variables).flatMap(([k, v]) => [`--${k}`, String(v)])
    ]);
    
    this.assertCommandSucceeded();
    return result;
  }
  
  // File validation
  async validateGeneratedFile(filePath: string, expectations: {
    exists?: boolean;
    contains?: string[];
    notContains?: string[];
    matchesPattern?: RegExp;
  }) {
    if (expectations.exists !== false) {
      expect(await this.fileExists(filePath)).toBe(true);
    }
    
    if (expectations.exists === false) {
      expect(await this.fileExists(filePath)).toBe(false);
      return;
    }
    
    const content = await this.readGeneratedFile(filePath);
    
    expectations.contains?.forEach(text => {
      expect(content).toContain(text);
    });
    
    expectations.notContains?.forEach(text => {
      expect(content).not.toContain(text);
    });
    
    if (expectations.matchesPattern) {
      expect(content).toMatch(expectations.matchesPattern);
    }
  }
}
```

### Fixture Management

```typescript
// tests/fixtures/common/component-templates.ts
export const REACT_COMPONENT_TEMPLATE = `
import React from 'react';

{% if withProps %}
interface {{ componentName | pascalCase }}Props {
  className?: string;
  children?: React.ReactNode;
}

export const {{ componentName | pascalCase }}: React.FC<{{ componentName | pascalCase }}Props> = ({ 
  className,
  children
}) => {
{% else %}
export const {{ componentName | pascalCase }}: React.FC = () => {
{% endif %}
  return (
    <div className={\`{{ componentName | kebabCase }}\${className ? \` \${className}\` : ''}\`}>
      {% if withProps %}
        {children}
      {% else %}
        <h1>{{ componentName | titleCase }}</h1>
      {% endif %}
    </div>
  );
};
`;

export const TEST_SCENARIOS = [
  { componentName: 'Button', withProps: true, expectedClass: 'button' },
  { componentName: 'Modal', withProps: false, expectedClass: 'modal' },
  { componentName: 'InputField', withProps: true, expectedClass: 'input-field' }
];
```

## Best Practices

### Test Organization
- **One feature per .feature file**: Keep features focused
- **Realistic scenarios**: Test actual use cases, not edge cases only
- **Clear descriptions**: Use business language in Given/When/Then
- **Background setup**: Use Background for common test setup

### Template Design
- **Variable validation**: Always test required vs optional variables
- **Filter testing**: Verify string transformations work correctly  
- **Conditional logic**: Test all branches of if/else statements
- **File naming**: Test dynamic file naming with variables

### Quality Focus
- **Atomic operations**: Verify files are created completely or not at all
- **Idempotency**: Ensure repeated operations don't cause issues
- **Error handling**: Test failure scenarios and error messages
- **Performance**: Validate generation speed and memory usage

---

*Focus on practical template testing for reliable generator functionality.*