@cli @validation @comprehensive
Feature: HYGEN-DELTA CLI Validation
  As a developer using Unjucks
  I want to validate all CLI claims in HYGEN-DELTA.md
  So that I can verify complete Hygen parity plus enhancements

  Background:
    Given I have a clean test workspace
    And the Unjucks CLI is available
    And I have sample generators available

  @critical-gap @validation
  Scenario: Positional parameters support (Critical Gap)
    Given I have a "component" generator with "new" template
    When I run "unjucks component new MyComponent" 
    Then the positional parameters should be parsed correctly
    And "MyComponent" should be mapped to the name variable
    And the file should be generated with the correct name
    But this currently fails as noted in HYGEN-DELTA Gap Analysis

  @dynamic-cli @validation
  Scenario: Dynamic CLI generation from template variables  
    Given I have a template with variables "{{ name }}", "{{ withTests }}", "{{ port }}"
    When I run "unjucks help generate component new"
    Then the CLI should show auto-generated flags:
      | Flag        | Type    | Required |
      | --name      | string  | true     |
      | --withTests | boolean | false    |
      | --port      | number  | false    |
    And interactive prompts should be available for missing variables

  @enhanced-commands @validation
  Scenario: Enhanced CLI commands work correctly
    When I run each CLI command:
      | Command                | Expected Behavior                           |
      | unjucks list          | Lists all available generators              |
      | unjucks help          | Shows global help with all commands        |
      | unjucks version       | Shows version information                   |
      | unjucks init          | Creates example generators                  |
      | unjucks generate      | Shows generator selection or runs generator |
    Then each command should work correctly
    And provide helpful output and error messages

  @variable-discovery @validation
  Scenario: Automatic variable discovery and type inference
    Given I have a template containing:
      """
      const port = {{ port | default(3000) }};
      const isEnabled = {{ enabled | default(false) }};
      const name = "{{ name }}";
      {% if withTests %}
      // Test files
      {% endif %}
      """
    When the CLI analyzes the template
    Then it should auto-detect variables:
      | Variable   | Type    | Default | Required |
      | port       | number  | 3000    | false    |
      | enabled    | boolean | false   | false    |
      | name       | string  | none    | true     |
      | withTests  | boolean | none    | false    |
    And generate appropriate CLI flags

  @safety-features @validation
  Scenario: Advanced safety features work
    Given I have existing files that would be modified
    When I run generation with safety options:
      | Option   | Expected Behavior                      |
      | --dry    | Preview changes without modification   |
      | --force  | Override safety checks                 |
      | default  | Create backups before modification     |
    Then the safety features should work as expected
    And backup files should be created when needed

  @config-loading @validation
  Scenario: Modern configuration loading works
    Given I have an "unjucks.config.ts" file:
      """
      export default {
        templatesDir: '_templates',
        outputDir: 'src',
        defaultVariables: {
          author: 'Test Author'
        }
      }
      """
    When I run unjucks commands
    Then the configuration should be loaded correctly
    And default variables should be applied
    And TypeScript configuration should be supported

  @error-handling @validation
  Scenario: Enhanced error messages and validation
    When I run commands with various error conditions:
      | Error Condition        | Expected Error Message                    |
      | Missing generator      | "Generator 'xyz' not found. Available: ..." |
      | Invalid variable       | "Variable 'name' is required"            |
      | Template syntax error  | "Template syntax error at line 5"        |
      | File write permission  | "Permission denied writing to file"      |
    Then I should receive detailed, helpful error messages
    And suggestions for fixing the errors should be provided

  @interactive-prompts @validation  
  Scenario: Interactive prompts for missing variables
    Given I have a template requiring variables "name" and "withTests"
    When I run "unjucks generate component new" without providing variables
    Then I should be prompted for missing values:
      """
      ? Enter name (required): 
      ? Include tests? (withTests) [y/N]: 
      """
    And the prompts should respect variable types and defaults

  @hygen-compatibility @validation
  Scenario: CLI maintains Hygen workflow compatibility
    Given I have Hygen-style generators  
    When I convert them to Unjucks
    Then the CLI workflows should be equivalent:
      | Hygen Command           | Unjucks Equivalent              |
      | hygen component new     | unjucks component new (when fixed) |
      | hygen init self         | unjucks init                    |
      | hygen --help            | unjucks help                    |
    And all functionality should be preserved or enhanced

  @performance @validation
  Scenario: CLI performance meets benchmarks  
    Given I have a complex project with many generators
    When I run CLI commands:
      | Command     | Performance Target |
      | list        | < 100ms           |
      | help        | < 50ms            |
      | generate    | < 200ms           |
    Then the commands should meet performance targets
    And cold start should be under 150ms as claimed

  @typescript-integration @validation
  Scenario: TypeScript-first CLI experience
    Given I have TypeScript templates and configuration
    When I use the CLI
    Then TypeScript features should work correctly:
      | Feature              | Expected Behavior              |
      | Type-safe config     | Configuration validated        |
      | Template typing      | Variables type-checked         |
      | Generated code       | Proper TypeScript output       |
      | Error messages       | TypeScript-aware errors        |