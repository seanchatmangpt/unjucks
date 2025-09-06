Feature: Core 80/20 Implementation - Real Operations Testing
  As a developer using unjucks
  I want the core 80/20 functionality to work reliably with real file operations
  So that I can trust the tool in production scenarios

  Background:
    Given I have a real project with templates directory
    And I have built the CLI application
    And I am working in a clean temporary directory

  @critical @e2e
  Scenario: End-to-end template generation with real file operations
    Given I have a real template with Nunjucks syntax and frontmatter
    When I run the CLI command with real arguments
    Then the file should be generated with correct content and location
    And the Nunjucks filters should be correctly applied

  @critical @cli
  Scenario: CLI commands work without mocks using positional parameters
    Given I have generators configured with real templates
    When I use Hygen-style positional syntax
    Then the command should parse positional parameters correctly
    And the CLI list command should work without mocks

  @critical @frontmatter
  Scenario: Frontmatter processing with real YAML parsing
    Given I have templates with complex frontmatter configuration
    When I process templates with YAML frontmatter
    Then the YAML frontmatter should be correctly parsed and applied
    And skipIf conditions should be properly evaluated

  @critical @injection
  Scenario: File injection operations with actual file I/O
    Given I have existing files and injection templates
    When I perform different injection operations
    Then the file should contain all injected content in correct positions
    And injection operations should be idempotent

  @critical @permissions
  Scenario: File permissions and shell commands execute correctly
    Given I have templates with chmod and shell commands
    When I generate files with chmod and shell directives
    Then the files should have correct permissions
    And shell commands should execute during generation

  @critical @workflow
  Scenario: Critical 20% user workflows with real data
    Given I have the most commonly used template patterns
    When I execute the most common workflow: component generation
    Then multiple related files should be generated correctly
    And the workflow should complete in under 2 seconds

  @safety @dry-run
  Scenario: Dry run mode works correctly without file modification
    Given I want to preview changes before applying them
    When I run commands with --dry flag
    Then no files should be created
    And the output should show what would be generated

  @error-handling @robustness
  Scenario: Error handling works correctly with real scenarios
    Given I have scenarios that should produce errors
    When I try to generate from non-existent generator
    Then I should get a helpful error message
    When I try to inject into a non-existent file
    Then injection should fail gracefully with clear error