Feature: MCP Tools Validation
  As a Claude Code user
  I want to validate all MCP tools work correctly
  So that AI assistants can generate code reliably

  Background:
    Given I have a clean test environment with templates
    And the MCP server is running
    And I have test templates available

  Scenario: unjucks_list Tool Validation
    When I call the "unjucks_list" MCP tool
    Then it should return available generators
    And each generator should have metadata
    And the response should include template counts
    And execution should complete in under 100ms

  Scenario: unjucks_help Tool Validation  
    Given I have a "component/react" template
    When I call "unjucks_help" with generator="component" and template="react"
    Then it should return variable documentation
    And it should include usage examples
    And it should show required vs optional variables
    And it should include type information

  Scenario: unjucks_generate Tool Real Operation
    Given I have a "component/react" template
    When I call "unjucks_generate" with:
      | generator | template | componentName | withTests |
      | component | react    | UserProfile  | true      |
    Then it should create real files
    And the files should contain rendered content
    And variables should be properly substituted
    And file permissions should be correct

  Scenario: unjucks_dry_run Tool Validation
    Given I have a "component/react" template  
    When I call "unjucks_dry_run" with componentName="TestComponent"
    Then it should show preview of changes
    And it should not create any actual files
    And it should detect potential conflicts
    And it should show impact analysis

  Scenario: unjucks_inject Tool Real Operation
    Given I have an existing file "src/index.js"
    When I call "unjucks_inject" to add an import
    Then it should modify the file correctly
    And the injection should be idempotent
    And a backup should be created
    And the content should be at the correct position

  Scenario: MCP Tool Error Handling
    When I call "unjucks_generate" with invalid parameters
    Then it should return a proper MCP error
    And the error message should be descriptive
    And the error code should be appropriate
    And no partial files should be created

  Scenario: MCP Tool Performance Under Load
    When I make 10 concurrent calls to "unjucks_list"
    Then all calls should complete successfully
    And average response time should be under 50ms
    And memory usage should remain stable
    And no resource leaks should occur