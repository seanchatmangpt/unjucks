Feature: MCP Protocol Validation
  As a Claude Code user
  I want to validate MCP server protocol compliance
  So that AI assistants can reliably integrate with unjucks

  Background:
    Given I have a clean test environment
    And the MCP server is available

  Scenario: MCP Server Initialization
    When I start the MCP server
    Then the server should be ready for connections
    And it should support JSON-RPC 2.0 protocol

  Scenario: Tool Discovery via MCP Protocol  
    Given the MCP server is running
    When I send a "tools/list" request
    Then I should receive a valid JSON-RPC response
    And the response should contain 5 unjucks tools
    And each tool should have proper schema definitions

  Scenario: Tool Execution via MCP Protocol
    Given the MCP server is running
    When I send a "tools/call" request for "unjucks_list"
    Then I should receive a successful JSON-RPC response
    And the response should contain generator data
    And the data should include templates and variables

  Scenario: Error Handling in MCP Protocol
    Given the MCP server is running
    When I send an invalid JSON-RPC request
    Then I should receive a proper error response
    And the error should follow MCP error code conventions

  Scenario: MCP Server Capabilities
    Given the MCP server is running  
    When I send an "initialize" request
    Then the server should respond with its capabilities
    And it should declare support for tools
    And it should include proper protocol version

  Scenario: Concurrent MCP Requests
    Given the MCP server is running
    When I send 5 concurrent "tools/call" requests
    Then all requests should complete successfully
    And response times should be under 200ms
    And no race conditions should occur