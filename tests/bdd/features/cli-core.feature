Feature: Core CLI Commands
  As a developer using Unjucks
  I want to use fundamental CLI commands
  So that I can scaffold and manage my project templates

  Background:
    Given I have a working Unjucks installation
    And I have a clean test environment

  Scenario: Display version information
    When I run "unjucks --version"
    Then I should see the current version number
    And the exit code should be 0

  Scenario: Display help information
    When I run "unjucks --help"
    Then I should see usage information
    And I should see available commands listed
    And the exit code should be 0

  Scenario: List available generators
    Given I have templates in "templates" directory
    When I run "unjucks list"
    Then I should see a list of available generators
    And each generator should show its description
    And the exit code should be 0

  Scenario: List generators with no templates
    Given I have an empty "templates" directory
    When I run "unjucks list"
    Then I should see "No generators found" message
    And the exit code should be 0

  Scenario: Invalid command
    When I run "unjucks invalidcommand"
    Then I should see an error message
    And I should see suggested similar commands
    And the exit code should be 1

  Scenario: Missing required arguments
    When I run "unjucks generate"
    Then I should see "Missing required arguments" error
    And I should see usage help
    And the exit code should be 1