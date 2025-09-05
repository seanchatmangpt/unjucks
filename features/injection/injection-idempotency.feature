Feature: Injection Idempotency
  As a developer using Unjucks
  I want idempotent injection operations using skipIf conditions
  So that I can run generators multiple times without duplicate content

  Background:
    Given I have a project with unjucks installed
    And I have an existing file "src/config.ts" with content:
      """
      export const config = {
        port: 3000,
        host: 'localhost'
      };
      """

  Scenario: Skip injection when content already exists
    Given I have a generator "config" with template "config-item.ts.njk":
      """
      ---
      to: src/config.ts
      inject: true
      before: "};"
      skipIf: "database:"
      ---
        database: '{{dbUrl}}'
      """
    When I run "unjucks generate config --dbUrl mongodb://localhost:27017"
    Then the file should contain the database configuration
    When I run the same command again
    Then the database configuration should not be duplicated
    And I should see "Skipped injection: content already exists"

  Scenario: Skip injection with regex pattern matching
    Given I have a generator "import" with template "import.ts.njk":
      """
      ---
      to: src/app.ts
      inject: true
      prepend: true
      skipIf: "/import.*{{package}}/"
      ---
      import {{name}} from '{{package}}';
      """
    And I have an existing file "src/app.ts" with:
      """
      import express from 'express';
      import cors from 'cors';
      """
    When I run "unjucks generate import --name helmet --package helmet"
    Then the import should be added
    When I run "unjucks generate import --name cors --package cors"
    Then the cors import should be skipped
    And I should see "Skipped injection: pattern already exists"

  Scenario: Skip injection with multiple skipIf conditions
    Given I have a generator "route" with template "route.ts.njk":
      """
      ---
      to: src/routes.ts
      inject: true
      before: "export default"
      skipIf: 
        - "{{path}}"
        - "{{handler}}"
      ---
      router.{{method}}('{{path}}', {{handler}});
      """
    And the file already contains a route with the same path or handler
    When I run "unjucks generate route --method get --path /users --handler getUsers"
    Then the injection should be skipped
    And I should see which condition caused the skip

  Scenario: Force injection overriding skipIf conditions
    Given I have a generator with skipIf conditions
    And the skipIf condition would normally prevent injection
    When I run "unjucks generate route --method get --path /users --handler getUsers --force"
    Then the skipIf conditions should be ignored
    And the injection should proceed
    And I should see "Force mode: ignoring skipIf conditions"

  Scenario: SkipIf with complex boolean logic
    Given I have a generator with template:
      """
      ---
      to: src/middleware.ts
      inject: true
      before: "export"
      skipIf: "{{name}} && (development || production)"
      ---
      export const {{name}} = {{implementation}};
      """
    When the file contains matching patterns for the complex condition
    Then the injection should be skipped appropriately
    And the boolean logic should be evaluated correctly

  Scenario: SkipIf with file existence check
    Given I have a generator with template:
      """
      ---
      to: src/types/{{name}}.ts
      inject: true
      skipIf: "file_exists"
      ---
      export interface {{name}} {
        id: string;
      }
      """
    When the target file already exists
    Then the injection should be skipped
    And I should see "Skipped: target file already exists"

  Scenario: SkipIf with content length check
    Given I have a generator with template:
      """
      ---
      to: src/utils.ts
      inject: true
      append: true
      skipIf: "file_size > 1000"
      ---
      export const {{utilName}} = {{implementation}};
      """
    When the target file is larger than the specified size
    Then the injection should be skipped
    And I should see "Skipped: file size exceeds limit"

  Scenario: SkipIf with line count check
    Given I have a generator with template:
      """
      ---
      to: src/constants.ts
      inject: true
      before: "export"
      skipIf: "line_count > 50"
      ---
      export const {{constantName}} = '{{value}}';
      """
    When the target file has more lines than specified
    Then the injection should be skipped
    And I should see "Skipped: file has too many lines"

  Scenario: SkipIf with custom function evaluation
    Given I have a generator with template:
      """
      ---
      to: src/services.ts
      inject: true
      before: "}"
      skipIf: "customCheck('{{serviceName}}')"
      ---
        {{serviceName}}: new {{serviceClass}}()
      """
    And I have a custom skipIf function defined
    When the custom function returns true
    Then the injection should be skipped
    And I should see the custom skip message

  Scenario: Conditional injection based on existing imports
    Given I have a generator "component" with template:
      """
      ---
      to: src/components/index.ts
      inject: true
      before: "export"
      skipIf: "export.*{{componentName}}"
      ---
      export { {{componentName}} } from './{{componentName}}';
      """
    When the component is already exported
    Then the injection should be skipped
    When a different component is generated
    Then the injection should proceed

  Scenario: SkipIf with environment-based conditions
    Given I have a generator with template:
      """
      ---
      to: src/config.ts
      inject: true
      before: "};"
      skipIf: "NODE_ENV === 'production' && development"
      ---
        development: {{devSettings}}
      """
    When running in production environment
    And the content contains development settings
    Then the injection should be skipped appropriately

  Scenario: SkipIf dry run shows what would be skipped
    Given I have a generator with skipIf conditions
    When I run with --dry flag
    Then I should see which injections would be skipped
    And I should see which would proceed
    And I should see the reason for each skip decision

  Scenario: SkipIf with JSON structure validation
    Given I have a generator injecting into a JSON configuration file
    And the skipIf condition checks for existing JSON keys
    When the key already exists in the JSON structure
    Then the injection should be skipped
    And the JSON structure should remain valid

  Scenario: Multiple skipIf conditions with OR logic
    Given I have a generator with template:
      """
      ---
      to: src/handlers.ts
      inject: true
      before: "export"
      skipIf: 
        - "{{handlerName}}"
        - "{{route}}"
      skipIfLogic: "OR"
      ---
      export const {{handlerName}} = {{implementation}};
      """
    When either condition matches
    Then the injection should be skipped

  Scenario: Multiple skipIf conditions with AND logic
    Given I have a generator with template:
      """
      ---
      to: src/middleware.ts
      inject: true
      before: "export"
      skipIf: 
        - "{{middlewareName}}"
        - "{{version}}"
      skipIfLogic: "AND"
      ---
      export const {{middlewareName}} = {{implementation}};
      """
    When both conditions must match for skip
    Then the injection should only be skipped when both are true

  Scenario: SkipIf with template variable interpolation
    Given I have a generator where skipIf uses template variables
    When the variables are substituted in the skipIf condition
    Then the condition should be evaluated with the actual values
    And the skip decision should be based on rendered content

  Scenario: SkipIf reporting and logging
    Given I have multiple generators with various skipIf conditions
    When I run generation with verbose output
    Then I should see detailed skipIf evaluation logs
    And I should see which patterns were checked
    And I should see the final skip decisions with reasons