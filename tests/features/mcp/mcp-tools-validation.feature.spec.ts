import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { cleanup } from '../step-definitions/mcp-tools-steps';
import '../step-definitions/mcp-protocol-steps';
import '../step-definitions/mcp-tools-steps';

const feature = loadFeature('./tests/features/mcp/mcp-tools-validation.feature');

describeFeature(feature, ({ Scenario }) => {
  // Cleanup after all tests
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  Scenario('unjucks_list Tool Validation', ({ Given, When, Then }) => {
    Given('I have a clean test environment with templates');
    Given('the MCP server is running');
    Given('I have test templates available');
    When('I call the "unjucks_list" MCP tool');
    Then('it should return available generators');
    Then('each generator should have metadata');
    Then('the response should include template counts');
    Then('execution should complete in under 100ms');
  });

  Scenario('unjucks_help Tool Validation', ({ Given, When, Then }) => {
    Given('I have a clean test environment with templates');
    Given('the MCP server is running');
    Given('I have a "component/react" template');
    When('I call "unjucks_help" with generator="component" and template="react"');
    Then('it should return variable documentation');
    Then('it should include usage examples');
    Then('it should show required vs optional variables');
    Then('it should include type information');
  });

  Scenario('unjucks_generate Tool Real Operation', ({ Given, When, Then }) => {
    Given('I have a clean test environment with templates');
    Given('the MCP server is running');
    Given('I have a "component/react" template');
    When('I call "unjucks_generate" with:', [
      { generator: 'component', template: 'react', componentName: 'UserProfile', withTests: 'true' }
    ]);
    Then('it should create real files');
    Then('the files should contain rendered content');
    Then('variables should be properly substituted');
    Then('file permissions should be correct');
  });

  Scenario('unjucks_dry_run Tool Validation', ({ Given, When, Then }) => {
    Given('I have a clean test environment with templates');
    Given('the MCP server is running');
    Given('I have a "component/react" template');
    When('I call "unjucks_dry_run" with componentName="TestComponent"');
    Then('it should show preview of changes');
    Then('it should not create any actual files');
    Then('it should detect potential conflicts');
    Then('it should show impact analysis');
  });

  Scenario('unjucks_inject Tool Real Operation', ({ Given, When, Then }) => {
    Given('I have a clean test environment with templates');
    Given('the MCP server is running');
    Given('I have an existing file "src/index.js"');
    When('I call "unjucks_inject" to add an import');
    Then('it should modify the file correctly');
    Then('the injection should be idempotent');
    Then('a backup should be created');
    Then('the content should be at the correct position');
  });

  Scenario('MCP Tool Error Handling', ({ Given, When, Then }) => {
    Given('I have a clean test environment with templates');
    Given('the MCP server is running');
    When('I call "unjucks_generate" with invalid parameters');
    Then('it should return a proper MCP error');
    Then('the error message should be descriptive');
    Then('the error code should be appropriate');
    Then('no partial files should be created');
  });

  Scenario('MCP Tool Performance Under Load', ({ Given, When, Then }) => {
    Given('I have a clean test environment with templates');
    Given('the MCP server is running');
    When('I make 10 concurrent calls to "unjucks_list"');
    Then('all calls should complete successfully');
    Then('average response time should be under 50ms');
    Then('memory usage should remain stable');
    Then('no resource leaks should occur');
  });
});