Feature: Injection Targets
  As a developer using Unjucks
  I want to find and modify specific target files for injection
  So that I can update the correct files with precise control

  Background:
    Given I have a project with unjucks installed
    And I have multiple files in my project structure:
      """
      src/
        components/
          Button.tsx
          Input.tsx
          index.ts
        services/
          UserService.ts
          ProductService.ts
          index.ts
        utils/
          helpers.ts
          constants.ts
        app.ts
        routes.ts
      """

  Scenario: Target specific file by absolute path
    Given I have a generator "route" with template:
      """
      ---
      to: src/routes.ts
      inject: true
      before: "export default"
      ---
      router.{{method}}('{{path}}', {{handler}});
      """
    When I run "unjucks generate route --method get --path /users --handler getUsers"
    Then the file "src/routes.ts" should be targeted
    And the injection should be successful
    And other files should remain unchanged

  Scenario: Target files using glob patterns
    Given I have a generator "export" with template:
      """
      ---
      to: "src/*/index.ts"
      inject: true
      append: true
      ---
      export { {{name}} } from './{{name}}';
      """
    When I run "unjucks generate export --name NewComponent"
    Then all index.ts files matching the glob should be targeted
    And each file should receive the injection
    And I should see "Injected into 2 files"

  Scenario: Target files based on content matching
    Given I have a generator "import" with template:
      """
      ---
      to: "src/**/*.ts"
      inject: true
      prepend: true
      targetIf: "class.*Service"
      ---
      import { Logger } from '../utils/logger';
      """
    When I run "unjucks generate import"
    Then only files containing service classes should be targeted
    And the import should be added to matching files
    And files without service classes should be ignored

  Scenario: Target creation when file doesn't exist
    Given I have a generator "model" with template:
      """
      ---
      to: src/models/{{name}}.ts
      inject: true
      createIfMissing: true
      ---
      export interface {{name}} {
        id: string;
      }
      """
    When I run "unjucks generate model --name User"
    Then the file "src/models/User.ts" should be created
    And the directory "src/models" should be created if missing
    And the content should be injected into the new file

  Scenario: Target validation before injection
    Given I have a generator targeting a specific file type
    When the target file is not the expected type (e.g., binary file)
    Then I should see "Target file is not suitable for text injection"
    And the injection should be aborted
    And the file should remain unchanged

  Scenario: Target backup before modification
    Given I have a generator with injection enabled
    And backup is configured
    When I run the injection command
    Then a backup of the target file should be created
    And the backup should have a timestamp suffix
    And the original file should be modified

  Scenario: Target multiple files with different injection points
    Given I have a generator "feature" with multiple templates:
      """
      templates/
        route.ts.njk:
          ---
          to: src/routes.ts
          inject: true
          before: "export default"
          ---
          router.{{method}}('{{path}}', {{handler}});
        
        service.ts.njk:
          ---
          to: src/services/{{name}}Service.ts
          inject: true
          createIfMissing: true
          ---
          export class {{name}}Service {
            async {{method}}() {}
          }
      """
    When I run "unjucks generate feature --name User --method get --path /users --handler getUsers"
    Then both target files should be processed
    And each should receive their respective injections
    And I should see "Injected into 2 files"

  Scenario: Target exclusion patterns
    Given I have a generator with template:
      """
      ---
      to: "src/**/*.ts"
      inject: true
      exclude: 
        - "**/*.test.ts"
        - "**/*.spec.ts"
      append: true
      ---
      // Auto-generated comment
      """
    When I run the generation command
    Then test files should be excluded from targeting
    And only non-test TypeScript files should be modified

  Scenario: Target with conditional logic
    Given I have a generator with template:
      """
      ---
      to: src/{{type}}/{{name}}.ts
      inject: true
      targetIf: "{{type}} === 'services' ? 'class' : 'interface'"
      ---
      // Injected based on type
      """
    When I run with different type parameters
    Then only files matching the conditional logic should be targeted
    And the logic should be evaluated per file

  Scenario: Target resolution with variable substitution
    Given I have a generator with template:
      """
      ---
      to: src/{{category}}/{{name}}/index.ts
      inject: true
      createPath: true
      ---
      export * from './{{name}}';
      """
    When I run "unjucks generate module --category services --name UserManager"
    Then the path should be resolved to "src/services/UserManager/index.ts"
    And the directory structure should be created as needed
    And the injection should succeed

  Scenario: Target file encoding detection and preservation
    Given I have files with different encodings (UTF-8, UTF-16)
    When I inject content into these files
    Then the original encoding should be detected
    And the encoding should be preserved after injection
    And the content should be properly handled

  Scenario: Target file with read-only permissions
    Given I have a read-only target file
    When I attempt to inject content
    Then I should see "Cannot modify read-only file"
    And I should see suggestions for resolving the issue
    And the operation should fail gracefully

  Scenario: Target file locked by another process
    Given a target file is locked by another process
    When I attempt injection
    Then I should see "File is locked by another process"
    And I should be offered retry options
    And the operation should handle the lock gracefully

  Scenario: Target directory traversal protection
    Given I have a generator with a potentially dangerous path
    When I try to target files outside the project directory
    Then the operation should be blocked for security
    And I should see "Path traversal detected - operation blocked"
    And no files outside the project should be modified

  Scenario: Target file size limits
    Given I have configured maximum file size for injection targets
    When I attempt to inject into a file exceeding the limit
    Then I should see "Target file exceeds size limit"
    And the injection should be skipped
    And I should see the file size and limit

  Scenario: Target with symlink resolution
    Given I have symlinks in my project structure
    When targeting files through symlinks
    Then the symlinks should be resolved safely
    And the actual target files should be modified
    And symlink integrity should be preserved

  Scenario: Target pattern matching with case sensitivity
    Given I have files with different case patterns
    And I have a generator with case-sensitive targeting
    When I run targeting with specific case patterns
    Then only files matching the exact case should be targeted
    And case mismatches should be ignored

  Scenario: Target rollback on partial failure
    Given I have multiple target files for injection
    When injection fails on one of the targets
    Then all previously successful injections should be rolled back
    And I should see "Rolling back changes due to failure"
    And the project should be in its original state

  Scenario: Target validation with custom rules
    Given I have custom target validation rules configured
    When targeting files for injection
    Then the custom validation should be applied
    And only files passing validation should be targeted
    And validation failures should be reported clearly