Feature: Advanced File Operations
  As a developer using Unjucks
  I want atomic file operations with safety features
  So that I can confidently generate and modify files without data loss

  Background:
    Given I have a project with templates directory
    And I am in the project root directory

  @critical @file-ops @atomic
  Scenario: Atomic file writes with backup creation
    Given I have an existing file "src/important.ts" with content:
      """
      // Critical data that must not be lost
      export const CRITICAL_CONFIG = 'original';
      """
    And I have a template that overwrites the file:
      """
      ---
      to: "src/important.ts"
      ---
      // Updated file
      export const CRITICAL_CONFIG = '{{ config }}';
      """
    When I run "unjucks generate test atomic --config=updated"
    Then I should see "src/important.ts.backup" file created
    And the backup file should contain "original"
    And the main file should contain "updated"
    And the operation should be atomic (no partial writes)

  @critical @file-ops @safety
  Scenario: Dry run mode previews all changes
    Given I have a template:
      """
      ---
      to: "src/{{ name }}.ts"
      ---
      export class {{ name | pascalCase }} {}
      """
    When I run "unjucks generate test preview --name=user --dry"
    Then I should not see "src/user.ts" file generated
    And the output should contain "DRY RUN: Would create src/user.ts"
    And the output should show the file content preview
    And no files should be modified

  @critical @file-ops @safety
  Scenario: Force mode bypasses safety checks
    Given I have an existing file "src/protected.ts" with content:
      """
      // Protected content
      """
    And I have a template that overwrites the file:
      """
      ---
      to: "src/protected.ts"
      ---
      // New content for {{ name }}
      """
    When I run "unjucks generate test force --name=user" without force flag
    Then I should see a confirmation prompt
    When I run "unjucks generate test force --name=user --force"
    Then the file should be overwritten without prompts
    And the file should contain "New content for user"

  @critical @file-ops @injection @idempotent
  Scenario: Idempotent injection prevents duplicate content
    Given I have an existing file "src/routes.ts" with content:
      """
      import { Router } from 'express';
      // Routes
      router.get('/users', usersHandler);
      """
    And I have a template for route injection:
      """
      ---
      to: "src/routes.ts"
      inject: true
      after: "// Routes"
      ---
      router.get('/{{ resource }}', {{ resource }}Handler);
      """
    When I run "unjucks generate test route --resource=users"
    Then the file should contain only one occurrence of "router.get('/users'"
    When I run "unjucks generate test route --resource=users" again
    Then the file should still contain only one occurrence of "router.get('/users'"
    And no duplicate routes should be added

  @critical @file-ops @injection @multiple-modes
  Scenario: Multiple injection modes in single operation
    Given I have an existing file "src/app.ts" with content:
      """
      import express from 'express';
      // Middleware imports
      
      const app = express();
      // Middleware setup
      
      // Routes
      
      export default app;
      """
    And I have templates for different injection points:
      """
      ---
      to: "src/app.ts"
      inject: true
      after: "// Middleware imports"
      ---
      import {{ name }}Middleware from './middleware/{{ name }}';
      """
    And another template:
      """
      ---
      to: "src/app.ts"
      inject: true
      after: "// Middleware setup"
      ---
      app.use({{ name }}Middleware);
      """
    And another template:
      """
      ---
      to: "src/app.ts"
      inject: true
      after: "// Routes"
      ---
      app.use('/{{ name }}', {{ name }}Router);
      """
    When I run "unjucks generate test middleware --name=auth"
    And I run "unjucks generate test middleware-setup --name=auth"
    And I run "unjucks generate test route-setup --name=auth"
    Then the file should contain all three injections in correct locations
    And the imports should be at the top
    And the middleware setup should be in the middle
    And the routes should be at the bottom

  @critical @file-ops @validation
  Scenario: Comprehensive file validation before operations
    Given I have a template that creates a file:
      """
      ---
      to: "{{ invalidPath }}/{{ name }}.ts"
      ---
      export class {{ name }} {}
      """
    When I run "unjucks generate test validation --name=user --invalidPath=../../../etc"
    Then I should see an error message
    And the error should contain "Invalid file path"
    And the error should contain "Path traversal detected"
    And no files should be created outside the project

  @regression @file-ops @error-handling
  Scenario: Graceful error handling with rollback
    Given I have limited disk space or permissions
    And I have a template that creates multiple files:
      """
      ---
      to: "src/{{ name }}/index.ts"
      sh: ["mkdir -p src/{{ name }}", "touch src/{{ name }}/README.md"]
      ---
      export * from './{{ name }}';
      """
    When the file creation operation fails midway
    Then any partially created files should be cleaned up
    And the project should be left in a consistent state
    And a clear error message should be displayed

  @performance @file-ops
  Scenario: Efficient file operations with caching
    Given I have 100 templates that generate files
    When I run batch generation for all templates
    Then file system operations should be optimized
    And redundant reads should be cached
    And the total operation should complete in under 5 seconds

  @critical @file-ops @permissions
  Scenario: File permissions are preserved and set correctly
    Given I have an existing file "src/script.sh" with permissions "755"
    And I have a template that modifies the file:
      """
      ---
      to: "src/script.sh"
      inject: true
      append: true
      ---
      echo "Added by {{ name }}"
      """
    When I run "unjucks generate test permissions --name=unjucks"
    Then the file permissions should remain "755"
    And the file should contain the new content
    
  @critical @file-ops @concurrent
  Scenario: Thread-safe concurrent file operations
    Given I have multiple templates that operate on the same file
    When I run concurrent generation operations
    Then all operations should complete successfully
    And the final file should contain all expected content
    And no data should be lost due to race conditions
    And proper file locking should be used

  @regression @file-ops @encoding
  Scenario: Proper handling of different file encodings
    Given I have an existing file with UTF-8 content including emojis: "🚀 Unicode content"
    And I have a template that injects content:
      """
      ---
      to: "src/unicode.ts"
      inject: true
      append: true
      ---
      // Added {{ emoji }} content
      """
    When I run "unjucks generate test encoding --emoji=✨"
    Then the file should properly preserve UTF-8 encoding
    And both original and new emoji content should be intact