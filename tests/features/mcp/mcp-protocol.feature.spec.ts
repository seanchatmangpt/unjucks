import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { cleanup } from '../step-definitions/mcp-protocol-steps';
import '../step-definitions/mcp-protocol-steps';

const feature = loadFeature('./tests/features/mcp/mcp-protocol.feature');

describeFeature(feature, ({ Scenario }) => {
  // Cleanup after all tests
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  Scenario('MCP Server Initialization', ({ Given, When, Then }) => {
    Given('I have a clean test environment');
    Given('the MCP server is available');
    When('I start the MCP server');
    Then('the server should be ready for connections');
    Then('it should support JSON-RPC 2.0 protocol');
  });

  Scenario('Tool Discovery via MCP Protocol', ({ Given, When, Then }) => {
    Given('the MCP server is running');
    When('I send a "tools/list" request');
    Then('I should receive a valid JSON-RPC response');
    Then('the response should contain 5 unjucks tools');
    Then('each tool should have proper schema definitions');
  });

  Scenario('Tool Execution via MCP Protocol', ({ Given, When, Then }) => {
    Given('the MCP server is running');
    When('I send a "tools/call" request for "unjucks_list"');
    Then('I should receive a successful JSON-RPC response');
    Then('the response should contain generator data');
    Then('the data should include templates and variables');
  });

  Scenario('Error Handling in MCP Protocol', ({ Given, When, Then }) => {
    Given('the MCP server is running');
    When('I send an invalid JSON-RPC request');
    Then('I should receive a proper error response');
    Then('the error should follow MCP error code conventions');
  });

  Scenario('MCP Server Capabilities', ({ Given, When, Then }) => {
    Given('the MCP server is running');
    When('I send an "initialize" request');
    Then('the server should respond with its capabilities');
    Then('it should declare support for tools');
    Then('it should include proper protocol version');
  });

  Scenario('Concurrent MCP Requests', ({ Given, When, Then }) => {
    Given('the MCP server is running');
    When('I send 5 concurrent "tools/call" requests');
    Then('all requests should complete successfully');
    Then('response times should be under 200ms');
    Then('no race conditions should occur');
  });
});