Feature: Background Steps and Tags Usage
  As a developer using unjucks
  I want to see examples of background steps and tag organization
  So that I can structure my tests effectively

  Background:
    Given I have a clean test workspace
    And I have templates in "_templates" directory
    And I set up the CLI environment
    And I initialize git repository for tracking changes

  @smoke @critical
  Scenario: Basic smoke test for core functionality
    Given I have a minimal "hello" generator
    When I run "unjucks list"
    Then the command should exit successfully
    And I should see "hello" generator listed
    And the command should complete within 2 seconds

  @regression @cli @commands
  Scenario: CLI command validation
    When I run unjucks with no arguments
    Then the output should show usage information
    And the command should exit successfully

  @regression @cli @help
  Scenario: Help system validation
    When I run "unjucks help"
    Then the output should show available commands
    And the output should show command descriptions
    And each command should have proper formatting

  @integration @templates @discovery
  Scenario: Template discovery across different structures
    Given I have generators in different directory structures:
      | generator | structure     | location              |
      | component | flat          | _templates/component/ |
      | service   | nested        | _templates/backend/service/ |
      | model     | deep-nested   | _templates/data/models/entity/ |
    When I run "unjucks list"
    Then all generators should be discovered correctly
    And the output should show proper hierarchy

  @unit @validation @input
  Scenario: Input validation for generator variables
    Given I have a "user" generator with required variables:
      | variable  | type   | required |
      | name      | string | true     |
      | email     | string | true     |
      | age       | number | false    |
    When I run generation without required variables
    Then the command should fail with validation error
    And the error should specify missing variables

  @unit @validation @types
  Scenario: Type validation for variables
    Given I have a generator with typed variables
    When I provide variables with wrong types:
      | variable | provided | expected | should_fail |
      | count    | "abc"    | number   | true        |
      | enabled  | "maybe"  | boolean  | true        |
      | items    | "single" | array    | true        |
    Then type validation should catch all errors

  @integration @filesystem @safety
  Scenario: File system safety checks
    When I attempt to generate files outside the project directory
    Then the generation should be prevented
    And a security warning should be displayed
    And no files should be created outside the workspace

  @integration @templates @rendering
  Scenario: Template rendering with complex data
    Given I have a template with complex variable structures:
      """
      ---
      to: src/<%= module.name %>/<%= component.name %>.ts
      ---
      // Generated from template
      export class <%= component.name %> {
        <% component.methods.forEach(method => { %>
        <%= method.visibility %> <%= method.name %>(<%= method.params.join(', ') %>): <%= method.returnType %> {
          // TODO: Implement <%= method.name %>
        }
        <% }) %>
      }
      """
    When I provide nested object data:
      """
      {
        "module": { "name": "user" },
        "component": {
          "name": "UserService",
          "methods": [
            {
              "name": "getUser",
              "visibility": "public",
              "params": ["id: string"],
              "returnType": "Promise<User>"
            }
          ]
        }
      }
      """
    Then the template should render correctly with nested data

  @performance @stress @large-files
  Scenario: Performance with large template files
    Given I have a generator with a large template file (>100KB)
    When I generate using this template
    Then the generation should complete within reasonable time
    And memory usage should remain stable
    And the output file should be correct

  @performance @stress @many-files
  Scenario: Performance with many small files
    Given I have a generator that creates 100+ small files
    When I run the generation
    Then all files should be created successfully
    And the process should complete within 30 seconds
    And no files should be corrupted

  @security @injection @safety
  Scenario: Template injection prevention
    Given I have a template with user-controlled content
    When I provide potentially dangerous input:
      | input_type    | input_value                    | should_block |
      | script_tag    | <script>alert('xss')</script>| false        |
      | file_path     | ../../../etc/passwd           | true         |
      | command_injection | `rm -rf /`                 | true         |
    Then dangerous inputs should be properly sanitized or blocked

  @accessibility @output @formatting
  Scenario: Generated code accessibility and formatting
    Given I have generators for UI components
    When I generate accessible components
    Then the generated code should include ARIA attributes
    And the code should follow accessibility best practices
    And proper semantic HTML should be generated

  @docker @containers @environment
  Scenario: Generation within Docker containers
    Given I am running unjucks in a Docker container
    When I generate files with proper permissions
    Then the files should have correct ownership
    And the files should be accessible from the host
    And no permission errors should occur

  @ci-cd @automation @pipeline
  Scenario: Integration with CI/CD pipelines
    Given I have a CI/CD configuration
    When unjucks is used in the build pipeline
    Then the generation should work without interactive prompts
    And exit codes should properly indicate success/failure
    And generated files should be ready for further pipeline steps

  @configuration @customization @advanced
  Scenario: Advanced configuration options
    Given I have a custom unjucks configuration file:
      """
      {
        "templatesDir": "custom-templates",
        "outputDir": "generated",
        "defaultVariables": {
          "author": "Test User",
          "license": "MIT"
        },
        "hooks": {
          "pre-generate": "npm run lint-templates",
          "post-generate": "npm run format-generated"
        }
      }
      """
    When I run generation with custom configuration
    Then the custom settings should be applied
    And hooks should execute at appropriate times
    And default variables should be available in templates

  @backwards-compatibility @migration @legacy
  Scenario: Backwards compatibility with older templates
    Given I have legacy templates from previous versions
    When I run generation with current unjucks version
    Then legacy templates should continue to work
    And appropriate migration warnings should be shown
    And generated output should remain consistent

  @localization @i18n @global
  Scenario: Multi-language template generation
    Given I have templates with internationalization support
    When I generate for different locales:
      | locale | expected_greeting | expected_format |
      | en-US  | Hello            | MM/DD/YYYY      |
      | es-ES  | Hola             | DD/MM/YYYY      |
      | ja-JP  | こんにちは        | YYYY/MM/DD      |
    Then locale-specific content should be generated correctly

  @debugging @development @troubleshooting
  Scenario: Debugging and troubleshooting support
    Given I have a template with potential issues
    When I run generation with debug mode enabled
    Then detailed execution logs should be available
    And variable resolution steps should be shown
    And template parsing information should be displayed
    And helpful error messages should guide problem resolution

  @cleanup @maintenance @housekeeping
  Scenario: Clean up and maintenance operations
    When I run cleanup operations after testing
    Then temporary files should be removed
    And git status should show only intended changes
    And the workspace should be ready for next test
    And no background processes should remain running