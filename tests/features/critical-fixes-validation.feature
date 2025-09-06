Feature: Critical Fixes Validation
  As a developer using Unjucks
  I want all critical fixes to work correctly
  So that the system is reliable and secure

  Background:
    Given I am in a test environment
    And the CLI is built and ready

  Scenario: Template discovery for all generator combinations
    Given I have template structures for generators:
      | generator | template | hasPrompts | hasIndex |
      | command   | citty    | true       | false    |
      | component | react    | true       | true     |
      | service   | api      | false      | false    |
      | model     | prisma   | true       | false    |
    When I run the list command
    Then I should see all generators listed
    And each generator should show its available templates
    And the output should include template paths

  Scenario: CLI to generator variable flow validation
    Given I have a generator "command" with template "citty"
    And the template uses variables "name", "withSubcommands", "description"
    When I run help for the generator
    Then I should see CLI flags for all variables
    And the help should show variable types and descriptions
    When I generate with variables "--name=UserService --withSubcommands=true --description='User management'"
    Then the variables should be passed correctly to the template
    And the generated file should contain the interpolated values

  Scenario: File injection safety and atomicity
    Given I have an existing target file "src/routes.ts"
    And I have an injection template that adds routes
    When I perform injection with skipIf condition
    Then the injection should be idempotent
    And the file should not be corrupted
    When I perform the same injection again
    Then the content should not be duplicated
    And the file should remain valid TypeScript

  Scenario: Concurrent file operations safety
    Given I have multiple templates that write to different files
    When I run generation for all templates simultaneously
    Then all files should be created successfully
    And no files should be corrupted
    And no race conditions should occur
    And all generated files should have valid content

  Scenario: Performance benchmarks meet targets
    Given I have a large set of templates
    When I run performance benchmarks
    Then template discovery should complete under 100ms
    And variable extraction should complete under 50ms
    And generation should complete under 200ms per template
    And memory usage should stay under 100MB
    And CPU usage should not exceed 80% during generation

  Scenario: Security vulnerability prevention
    Given I have templates with potential security risks
    When I attempt to use path traversal in template names
    Then the system should reject the operation
    And no files should be written outside the target directory
    When I attempt to use shell injection in variables
    Then the variables should be properly escaped
    And no shell commands should be executed

  Scenario: Error handling and recovery
    Given I have templates with syntax errors
    When I run generation
    Then I should get clear error messages
    And the system should not crash
    And partial files should not be left behind
    When I fix the templates and run again
    Then generation should succeed

  Scenario: Dry run functionality
    Given I have a generator with multiple files
    When I run generation with --dry flag
    Then I should see what would be generated
    But no actual files should be created
    And the output should show file paths and content previews

  Scenario: Template inheritance and composition
    Given I have base templates and extending templates
    When I generate using an extending template
    Then the base template content should be included
    And the extending template should override appropriately
    And variables from both templates should be available

  Scenario: Large scale template processing
    Given I have 100 templates across 10 generators
    When I run discovery and generation operations
    Then all templates should be processed correctly
    And memory usage should remain stable
    And performance should scale linearly
    And no templates should be missed or corrupted