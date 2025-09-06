Feature: Advanced Safety Features and Validation
  As a developer using Unjucks
  I want comprehensive safety features and validation
  So that I can generate code with confidence and prevent data loss

  Background:
    Given I have a project with templates directory
    And I am in the project root directory

  @critical @safety @dry-run
  Scenario: Comprehensive dry-run mode with detailed preview
    Given I have a template that creates multiple files:
      """
      ---
      to: "src/{{ name }}/index.ts"
      ---
      export * from './{{ name }}';
      """
    And another template file:
      """
      ---
      to: "src/{{ name }}/{{ name }}.ts"
      ---
      export class {{ name | pascalCase }} {
        name = '{{ name }}';
      }
      """
    When I run "unjucks generate test multi --name=user --dry"
    Then I should see the dry-run preview:
      """
      🔍 DRY RUN: Preview of changes

      Files to be created:
        + src/user/index.ts (32 bytes)
        + src/user/user.ts (67 bytes)

      File contents preview:
      
      📄 src/user/index.ts:
      ┌─────────────────────────────
      │ export * from './user';
      └─────────────────────────────
      
      📄 src/user/user.ts:
      ┌─────────────────────────────
      │ export class User {
      │   name = 'user';
      │ }
      └─────────────────────────────

      Summary: 2 files would be created, 0 modified
      """
    And no actual files should be created
    And the process should exit with code 0

  @critical @safety @force-mode
  Scenario: Force mode with explicit confirmations
    Given I have an existing file "src/critical.ts" with content:
      """
      // CRITICAL: Do not overwrite
      export const IMPORTANT_DATA = 'preserve_this';
      """
    And I have a template that would overwrite it:
      """
      ---
      to: "src/critical.ts"
      ---
      // Generated content
      export const NEW_DATA = '{{ value }}';
      """
    When I run "unjucks generate test overwrite --value=test" without force flag
    Then I should see a confirmation prompt:
      """
      ⚠️  File 'src/critical.ts' already exists and will be overwritten.
      
      Current content (first 3 lines):
      // CRITICAL: Do not overwrite
      export const IMPORTANT_DATA = 'preserve_this';
      
      Proceed? [y/N]:
      """
    When I answer "N" to the prompt
    Then the operation should be cancelled
    And the original file should remain unchanged
    When I run "unjucks generate test overwrite --value=test --force"
    Then the file should be overwritten without prompts
    And a backup should be created at "src/critical.ts.backup"

  @critical @safety @validation
  Scenario: Comprehensive input validation and sanitization
    Given I have a template:
      """
      ---
      to: "src/{{ name | sanitize }}.ts"
      ---
      export class {{ name | pascalCase | sanitize }} {}
      """
    When I run with dangerous inputs:
      | Input | Expected Behavior |
      | --name="../../../etc/passwd" | Error: Path traversal detected |
      | --name="<script>alert('xss')</script>" | Sanitized to safe string |
      | --name="name;rm -rf /" | Sanitized to safe string |
      | --name="" | Error: Name cannot be empty |
      | --name="123invalid" | Error: Name must start with letter |
    Then each dangerous input should be handled safely
    And appropriate error messages should be shown
    And no unsafe operations should be performed

  @critical @safety @backup
  Scenario: Automatic backup creation for file modifications
    Given I have an existing project structure:
      """
      src/
        components/
          User.ts (important existing component)
        index.ts (main export file)
      """
    And I have a template that injects into existing files:
      """
      ---
      to: "src/index.ts"
      inject: true
      after: "// Components"
      ---
      export * from './components/{{ name }}';
      """
    When I run "unjucks generate test inject --name=Profile"
    Then backup files should be created:
      """
      src/
        index.ts.backup.20250127-143055 (timestamped backup)
      """
    And the backup should contain the original content
    And the modified file should contain both old and new content
    When the operation fails midway
    Then the backup should be used to restore the original state

  @critical @safety @atomic-operations
  Scenario: Atomic multi-file operations with rollback
    Given I have a template that creates multiple related files:
      """
      Template 1:
      ---
      to: "src/{{ name }}/index.ts"
      ---
      export * from './{{ name }}';
      
      Template 2:
      ---
      to: "src/{{ name }}/{{ name }}.ts"
      ---
      export class {{ name | pascalCase }} {}
      
      Template 3:
      ---
      to: "src/{{ name }}/{{ name }}.test.ts"
      ---
      import { {{ name | pascalCase }} } from './{{ name }}';
      describe('{{ name | pascalCase }}', () => {});
      """
    When I simulate a failure during the third file creation
    Then all previously created files should be rolled back
    And the project should be left in its original state
    And a clear error message should explain what happened:
      """
      ❌ Operation failed during file creation
      
      Rollback completed:
        - Removed: src/user/index.ts
        - Removed: src/user/user.ts
        - Cleaned up: src/user/ directory
      
      Error: Disk space insufficient for src/user/user.test.ts
      """

  @critical @safety @path-validation
  Scenario: Strict path validation and sandboxing
    Given I have templates with various path patterns:
      """
      Valid paths:
      - src/{{ name }}.ts
      - components/{{ category }}/{{ name }}.tsx
      - tests/unit/{{ name }}.test.ts
      
      Invalid paths:
      - ../../../etc/{{ name }}
      - ~/{{ name }}.ts
      - /absolute/{{ name }}.ts
      - {{ name }}/../../../dangerous.ts
      """
    When I run generation with each path pattern
    Then valid paths should be allowed within project boundaries
    And invalid paths should be rejected with specific errors:
      | Path Pattern | Error Message |
      | ../../../etc/{{ name }} | Path traversal outside project detected |
      | ~/{{ name }}.ts | Absolute paths not allowed |
      | /absolute/{{ name }}.ts | System paths not allowed |
      | {{ name }}/../../../dangerous.ts | Dynamic path traversal detected |

  @critical @safety @template-validation
  Scenario: Template syntax and security validation
    Given I have templates with various security issues:
      """
      Template 1 (Code injection):
      ---
      to: "src/{{ name }}.ts"
      sh: "{{ userCommand }}"
      ---
      
      Template 2 (Unsafe eval):
      ---
      to: "src/{{ name }}.ts"
      ---
      {{ userCode | safe }}
      
      Template 3 (File inclusion):
      ---
      to: "src/{{ name }}.ts"
      ---
      {% include userTemplate %}
      """
    When I try to use these templates
    Then I should see security warnings:
      """
      🛡️  Security Warning: Template contains potentially unsafe operations
      
      Issues found:
        ❌ Shell command uses user input: sh: "{{ userCommand }}"
        ❌ Unsafe filter usage: {{ userCode | safe }}
        ❌ Dynamic include: {% include userTemplate %}
      
      These operations can execute arbitrary code. Continue? [y/N]:
      """
    And unsafe operations should require explicit confirmation
    When I run with --disable-security-checks flag
    Then a warning should still be shown
    But the operations should proceed

  @performance @safety
  Scenario: Performance impact of safety features should be minimal
    Given I have 100 templates with various safety features enabled
    When I run batch generation with all safety features
    Then the performance overhead should be less than 10%
    And dry-run mode should be at least 10x faster than actual generation
    And validation checks should complete in under 50ms per template

  @regression @safety @recovery
  Scenario: Graceful recovery from system failures
    Given I have a long-running template generation process
    When the system experiences failures:
      | Failure Type | Expected Behavior |
      | Disk full | Graceful cleanup and clear error |
      | Permission denied | Skip file with warning, continue others |
      | Network timeout | Retry with exponential backoff |
      | Memory exhaustion | Release resources, show memory usage |
      | Process killed | Resume from checkpoint if possible |
    Then the system should handle each failure appropriately
    And no partial or corrupted files should remain
    And the user should receive actionable error messages

  @integration @safety @git-aware
  Scenario: Git-aware safety features
    Given I have a git repository with uncommitted changes
    When I run file generation that would modify tracked files
    Then I should see a git status warning:
      """
      ⚠️  Git Status Warning
      
      You have uncommitted changes:
        M src/existing-file.ts
        ?? new-file.ts
      
      Generated files may conflict with your changes.
      Consider committing or stashing changes first.
      
      Continue? [y/N]:
      """
    And I should have options to:
      | Option | Behavior |
      | --git-check-skip | Skip git status checking |
      | --git-auto-commit | Auto-commit generated files |
      | --git-create-branch | Create new branch for generation |