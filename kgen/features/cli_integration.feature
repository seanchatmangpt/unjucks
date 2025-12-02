@cli @integration @e2e
Feature: KGEN CLI Integration Testing
  As a KGEN user
  I want to interact with KGEN through command-line interface
  So that I can execute workflows and generate artifacts from terminal

  Background:
    Given I have the KGEN CLI available

  @cli @basic
  Scenario: Basic CLI functionality validation
    When I run the KGEN command "--version"
    Then the command should exit with code 0
    And the output should contain "kgen"
    And the command should complete within 5000ms

  @cli @help
  Scenario: CLI help and documentation
    When I run the KGEN command "--help"
    Then the command should exit with code 0
    And help output should contain usage information
    And command list should include "generate"
    And command list should include "list"
    And command list should include "help"

  @cli @discovery
  Scenario: Template discovery via CLI
    Given I have a template directory with 5 templates
    When I run the KGEN command "list"
    Then the command should exit with code 0
    And the output should contain "template-1"
    And the output should contain "template-5"
    And the command should complete within 3000ms

  @cli @generation
  Scenario: File generation through CLI
    Given I have a template directory with 3 templates
    When I run KGEN command "generate" with args:
      | --template | template-1 |
      | --name     | TestProject |
      | --output   | generated   |
    Then the command should exit with code 0
    And files should be generated in the output directory
    And file "output-TestProject-1.txt" should exist with content matching "Template 1: TestProject"
    And CAS storage should be utilized

  @cli @workflow
  Scenario: Complete CLI workflow execution
    Given I have a template directory with 4 templates
    When I execute the KGEN workflow:
      | step      | command  | args                        | expectedExitCode |
      | list      | list     |                             | 0                |
      | help      | help     | generate                    | 0                |
      | generate  | generate | template-2 --name MyApp    | 0                |
      | validate  | validate | generated/output-MyApp-2.txt | 0                |
    Then all workflow steps should complete successfully
    And the workflow should complete in under 15000ms total
    And files should be generated in the output directory

  @cli @performance
  Scenario: CLI performance benchmarking
    Given I have a template directory with 10 templates
    When I run the KGEN command "generate template-1 --name PerfTest"
    Then the command should exit with code 0
    And the command should complete within 2000ms
    And command execution should use less than 100MB memory

  @cli @error-handling
  Scenario: CLI error handling and graceful failure
    Given I have an invalid template with syntax error
    When I run the command expecting failure
    Then the command should fail gracefully
    And stderr should contain "error"
    And the output should not contain "undefined"

  @cli @config
  Scenario: CLI configuration handling
    Given the config file is missing
    When I run the KGEN command "list"
    Then the command should exit with code 0
    And the output should contain "No templates found" or "templates"

  @cli @permissions
  Scenario: CLI permission handling
    Given the output directory is read-only
    When I run KGEN command "generate" with args:
      | --template | template-1 |
      | --name     | PermTest   |
      | --output   | generated  |
    Then the command should fail gracefully
    And stderr should contain "permission" or "EACCES"

  @cli @timeout
  Scenario: CLI timeout handling
    Given I have a template directory with 1 templates
    When I run KGEN with timeout 1000ms
    Then the command should complete within 1500ms

  @cli @concurrent
  Scenario: Multiple CLI processes
    Given I have a template directory with 8 templates
    When I execute the KGEN workflow:
      | step       | command  | args                           | expectedExitCode |
      | generate1  | generate | template-1 --name Concurrent1 | 0                |
      | generate2  | generate | template-2 --name Concurrent2 | 0                |
      | generate3  | generate | template-3 --name Concurrent3 | 0                |
      | list       | list     |                                | 0                |
    Then all workflow steps should complete successfully
    And files should be generated in the output directory
    And average command time should be under 3000ms

  @cli @output-formats
  Scenario: CLI output format support
    Given I have a template directory with 6 templates
    When I run KGEN command "generate" with args:
      | --template | template-1    |
      | --name     | FormatTest    |
      | --format   | json          |
      | --output   | generated     |
    Then the command should exit with code 0
    And the output should contain "json" or "generated"
    And files should be generated in the output directory

  @cli @verbose
  Scenario: CLI verbose output mode
    Given I have a template directory with 2 templates
    When I run KGEN command "generate" with args:
      | --template | template-1 |
      | --name     | VerboseTest |
      | --verbose  |             |
    Then the command should exit with code 0
    And the output should contain "Processing" or "Generating" or "template"
    And provenance information should be generated

  @cli @dry-run
  Scenario: CLI dry-run mode
    Given I have a template directory with 3 templates
    When I run KGEN command "generate" with args:
      | --template | template-1 |
      | --name     | DryRunTest |
      | --dry-run  |             |
    Then the command should exit with code 0
    And the output should contain "dry run" or "would generate"
    And stdout should contain "DryRunTest"

  @cli @validation
  Scenario: CLI input validation
    When I run KGEN command "generate" with args:
      | --template |  |
      | --name     |  |
    Then the command should fail gracefully
    And stderr should contain "required" or "missing" or "invalid"

  @cli @integration-engines
  Scenario: CLI integration with all KGEN engines
    Given I have a template directory with 5 templates
    When I execute the KGEN workflow:
      | step      | command  | args                              | expectedExitCode |
      | discover  | list     | --verbose                         | 0                |
      | generate  | generate | template-1 --name IntegrationApp | 0                |
      | analyze   | analyze  | generated                         | 0                |
    Then all workflow steps should complete successfully
    And CAS storage should be utilized
    And provenance information should be generated
    And files should be generated in the output directory
    And command execution should use less than 150MB memory

  @cli @recovery
  Scenario: CLI recovery from interruption
    Given I have a template directory with 4 templates
    When I run KGEN with timeout 500ms
    And I run the KGEN command "generate template-1 --name RecoveryTest"
    Then the command should exit with code 0
    And files should be generated in the output directory

  @cli @batch-operations
  Scenario: CLI batch operations
    Given I have a template directory with 12 templates
    When I execute the KGEN workflow:
      | step       | command  | args                         | expectedExitCode |
      | batch1     | generate | template-1 --name Batch1    | 0                |
      | batch2     | generate | template-2 --name Batch2    | 0                |
      | batch3     | generate | template-3 --name Batch3    | 0                |
      | batch4     | generate | template-4 --name Batch4    | 0                |
      | batch5     | generate | template-5 --name Batch5    | 0                |
    Then all workflow steps should complete successfully
    And the workflow should complete in under 25000ms total
    And average command time should be under 5000ms
    And files should be generated in the output directory