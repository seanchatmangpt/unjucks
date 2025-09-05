@smoke
Feature: Basic CLI Functionality
  As a developer using Unjucks
  I want to verify the CLI works correctly
  So that I can trust the basic functionality

  Background:
    Given I have Unjucks installed

  @smoke
  Scenario: CLI shows version information
    When I run "unjucks --version"
    Then the command should succeed
    And the output should contain version information

  @smoke
  Scenario: CLI shows help information
    When I run "unjucks --help"
    Then the command should succeed
    And the output should contain "Usage"
    And the output should contain command descriptions

  @smoke
  Scenario: CLI can list available generators
    When I run "unjucks list"
    Then the command should complete
    And the output should show available generators or indicate none found

  @smoke
  Scenario: CLI handles invalid commands gracefully
    When I run "unjucks invalid-command"
    Then the command should fail gracefully
    And the output should contain helpful error information