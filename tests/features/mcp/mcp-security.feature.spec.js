import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { cleanup } from '../step-definitions/mcp-security-steps.js';
import '../step-definitions/mcp-protocol-steps';
import '../step-definitions/mcp-security-steps';

const feature = loadFeature('./tests/features/mcp/mcp-security.feature');

describeFeature(feature, ({ Scenario }) => {
  // Cleanup after all tests
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  Scenario('Path Traversal Attack Prevention', ({ Given, When, Then }) => {
    Given('I have a clean test environment');
    Given('the MCP server is running');
    Given('I have test templates available');
    When('I call "unjucks_generate" with destination="../../../etc/passwd"');
    Then('the request should be rejected');
    Then('an appropriate security error should be returned');
    Then('no files should be created outside the project');
    Then('the error should be logged securely');
  });

  Scenario('Command Injection Prevention', ({ Given, When, Then }) => {
    Given('I have a clean test environment');
    Given('the MCP server is running');
    Given('I have test templates available');
    When('I call "unjucks_generate" with componentName="; rm -rf /"');
    Then('the variable should be safely sanitized');
    Then('no system commands should be executed');
    Then('the template should render with escaped content');
    Then('the operation should complete safely');
  });

  Scenario('File System Boundary Enforcement', ({ Given, When, Then }) => {
    Given('I have a clean test environment');
    Given('the MCP server is running');
    When('I call "unjucks_inject" targeting "/etc/hosts"');
    Then('the operation should be blocked');
    Then('a security error should be returned');
    Then('system files should remain untouched');
    Then('the attempt should be logged');
  });

  Scenario('Input Validation Against XSS', ({ Given, When, Then }) => {
    Given('I have a clean test environment');
    Given('the MCP server is running');
    When('I call "unjucks_help" with generator="alert(\'xss\')</script>"');
    Then('the input should be sanitized');
    Then('no script execution should occur');
    Then('the response should be safe');
    Then('the error should be handled gracefully');
  });

  Scenario('Resource Exhaustion Protection', ({ Given, When, Then }) => {
    Given('I have a clean test environment');
    Given('the MCP server is running');
    Given('I have test templates available');
    When('I call "unjucks_generate" with extremely large variables');
    Then('the request should be rate-limited');
    Then('memory usage should be controlled');
    Then('the operation should timeout appropriately');
    Then('system resources should be protected');
  });

  Scenario('Concurrent Request Limits', ({ Given, When, Then }) => {
    Given('I have a clean test environment');
    Given('the MCP server is running');
    When('I make 100 simultaneous MCP requests');
    Then('requests should be throttled appropriately');
    Then('server should remain responsive');
    Then('no denial of service should occur');
    Then('error responses should be proper');
  });
});