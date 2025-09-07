Feature: Error Handling and Edge Cases
  As a developer using Unjucks
  I want robust error handling for edge cases
  So that I can understand and recover from failures gracefully

  Background:
    Given I have a working Unjucks installation
    And I have a test environment setup

  Scenario: Invalid command handling
    When I run "unjucks invalidcommand"
    Then I should see "Unknown command" error
    And I should see command suggestions
    And the exit code should be 1

  Scenario: Missing required arguments
    When I run "unjucks generate"
    Then I should see "Missing required arguments" error
    And I should see usage information
    And the exit code should be 1

  Scenario: Invalid template path
    When I run "unjucks generate nonexistent/template test --name Test"
    Then I should see "Template not found" error
    And I should see available templates
    And the exit code should be 1

  Scenario: Corrupted template file
    Given I have a corrupted template file "templates/broken/index.ts.njk"
    When I run "unjucks generate broken index --name Test"
    Then I should see "Template parsing failed" error
    And I should see parsing error details
    And the exit code should be 1

  Scenario: Invalid frontmatter syntax
    Given I have a template with invalid YAML frontmatter
    When I run "unjucks generate invalid-yaml test --name Test"
    Then I should see "YAML parsing error" message
    And I should see line number and column information
    And the exit code should be 1

  Scenario: Missing template variables
    Given I have a template requiring "name" and "type" variables
    When I run "unjucks generate component test --name TestOnly"
    Then I should see "Missing required variable: type" error
    And I should see available variable options
    And the exit code should be 1

  Scenario: Permission denied on target directory
    Given I have a read-only target directory "readonly"
    When I run "unjucks generate component test --name Test --dest readonly"
    Then I should see "Permission denied" error
    And I should see suggested solutions
    And the exit code should be 1

  Scenario: Disk space insufficient
    Given I have limited disk space available
    When I run "unjucks generate large-template test --name Test"
    Then I should see "Insufficient disk space" error
    And I should see cleanup suggestions
    And the exit code should be 1

  Scenario: Network timeout during MCP operations
    Given I have MCP integration enabled
    And the network connection is unstable
    When I run "unjucks swarm init --topology mesh"
    Then I should see "Network timeout" error
    And I should see retry suggestions
    And the exit code should be 1

  Scenario: Invalid RDF/Turtle syntax
    Given I have an RDF file with syntax errors
    When I run "unjucks semantic validate --schema invalid.ttl"
    Then I should see "RDF parsing failed" error
    And I should see syntax error location
    And I should see correction suggestions
    And the exit code should be 1

  Scenario: Circular dependency in templates
    Given I have templates with circular dependencies
    When I run "unjucks generate circular test --name Test"
    Then I should see "Circular dependency detected" error
    And I should see dependency chain
    And the exit code should be 1

  Scenario: Memory limit exceeded
    Given I have a very large template or dataset
    When I run "unjucks generate massive-template test --name Test"
    Then I should see "Memory limit exceeded" error
    And I should see optimization suggestions
    And the exit code should be 1

  Scenario: Concurrent file access conflict
    Given multiple Unjucks processes are running
    When I run "unjucks generate component test --name Test"
    And another process is writing to the same file
    Then I should see "File access conflict" error
    And I should see retry options
    And the exit code should be 1

  Scenario: Invalid file encoding
    Given I have templates with unsupported character encoding
    When I run "unjucks generate encoded-template test --name Test"
    Then I should see "Encoding error" message
    And I should see supported encodings list
    And the exit code should be 1

  Scenario: Template compilation timeout
    Given I have a complex template with infinite loops
    When I run "unjucks generate infinite-loop test --name Test"
    Then I should see "Template compilation timeout" error
    And I should see debugging suggestions
    And the exit code should be 1

  Scenario: Graceful degradation when MCP unavailable
    Given MCP integration is configured but unavailable
    When I run "unjucks generate component test --name Test"
    Then I should see "MCP unavailable, using fallback" warning
    And the generation should complete successfully
    And the exit code should be 0

  Scenario: Recovery from partial failures
    Given a template generation partially fails
    When I run "unjucks generate multi-file test --name Test --resume"
    Then I should see "Resuming from last successful step" message
    And only remaining files should be generated
    And the exit code should be 0

  Scenario: Validation of output before writing
    Given I have a template that generates invalid code
    When I run "unjucks generate invalid-output test --name Test --validate"
    Then I should see "Generated code validation failed" error
    And I should see specific validation errors
    And no files should be written
    And the exit code should be 1

  Scenario: Rollback on generation failure
    Given I have a multi-file template
    And generation fails partway through
    When I run "unjucks generate multi-fail test --name Test"
    Then I should see "Rolling back partial changes" message
    And no partial files should remain
    And the exit code should be 1

  Scenario: Helpful error messages for beginners
    Given I am a new user
    When I run "unjucks generat component test --name Test"
    Then I should see "Did you mean 'generate'?" suggestion
    And I should see "Getting started" help link
    And the exit code should be 1