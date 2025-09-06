Feature: MCP Server Integration
  As a development tool
  I want the MCP server to provide reliable code generation capabilities
  So that external tools can integrate with unjucks functionality

  Background:
    Given I have a clean test environment

  Scenario: MCP server starts successfully
    When the MCP server is initialized
    Then the server should be running
    And all MCP tools should be registered
    And the server should respond to capability requests

  Scenario: MCP server handles tool discovery
    Given the MCP server is running
    When a client requests available tools
    Then the response should include:
      | tool_name      | description                    |
      | unjucks_list   | List available generators      |
      | unjucks_help   | Get help for specific generator|
      | unjucks_generate| Generate files from templates  |
      | unjucks_dry_run| Preview generation without writing|
      | unjucks_inject | Inject content into files      |

  Scenario: MCP server provides tool schemas
    Given the MCP server is running
    When a client requests tool schema for "unjucks_generate"
    Then the schema should define required parameters
    And the schema should include parameter types
    And the schema should provide parameter descriptions

  Scenario: MCP server handles invalid requests gracefully
    Given the MCP server is running
    When a client sends an invalid tool request
    Then the server should return an error response
    And the error should include helpful details
    And the server should remain operational

  Scenario: MCP server handles concurrent requests
    Given the MCP server is running
    And I have multiple templates available
    When multiple clients request different tools simultaneously
    Then all requests should be processed successfully
    And responses should be returned within acceptable time limits
    And no memory leaks should occur

  Scenario: MCP server validates input parameters
    Given the MCP server is running
    When a client provides invalid parameters to "unjucks_generate"
    Then the server should reject the request
    And provide clear validation error messages
    And suggest correct parameter formats

  Scenario: MCP server maintains session state
    Given the MCP server is running
    When a client performs multiple operations
    Then the server should maintain consistency
    And temporary files should be properly cleaned up
    And resource usage should remain stable