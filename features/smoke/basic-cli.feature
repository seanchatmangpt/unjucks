@smoke @basic
Feature: Basic CLI Functionality
  As a developer
  I want to test basic CLI commands
  So that I can verify the BDD infrastructure works

  Scenario: CLI version command works
    When I run "node dist/cli.mjs --version"
    Then the command should exit with code 0
    And the output should contain version information

  Scenario: CLI help command works  
    When I run "node dist/cli.mjs --help"
    Then the command should exit with code 0
    And the output should contain "COMMANDS"

  Scenario: CLI list command works
    When I run "node dist/cli.mjs list"
    Then the command should exit with code 0
    And the output should contain "Available generators"