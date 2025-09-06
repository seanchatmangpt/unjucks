Feature: MCP Tool Integration
  As an external client
  I want to use MCP tools to interact with unjucks
  So that I can generate and manage code templates programmatically

  Background:
    Given I have a clean test environment
    And I have sample templates available
    And the MCP server is running

  Scenario: List available generators via MCP
    When I call the "unjucks_list" MCP tool
    Then the response should include available generators
    And each generator should have metadata
    And the response should be properly formatted JSON

  Scenario: Get help for specific generator via MCP
    Given I have a "component" generator with variables
    When I call the "unjucks_help" MCP tool with generator "component"
    Then the response should include:
      | field        | content                |
      | description  | Component generator    |
      | variables    | name, withTests        |
      | examples     | Usage examples         |
      | flags        | Auto-generated flags   |

  Scenario: Generate files via MCP tool
    Given I have a "component" generator
    When I call the "unjucks_generate" MCP tool with:
      | parameter | value          |
      | generator | component      |
      | name      | UserProfile    |
      | withTests | true          |
      | dest      | ./tests/output |
    Then files should be generated successfully
    And the generated files should contain expected content
    And the response should include file paths created

  Scenario: Preview generation with dry run
    Given I have a "api-route" generator
    When I call the "unjucks_dry_run" MCP tool with:
      | parameter | value      |
      | generator | api-route  |
      | name      | users      |
      | method    | POST       |
    Then I should see a preview of files to be generated
    And no actual files should be created
    And the preview should show file paths and content snippets

  Scenario: Inject content into existing files
    Given I have an existing file "src/routes.ts"
    And I have a "route-injection" template
    When I call the "unjucks_inject" MCP tool with:
      | parameter | value           |
      | template  | route-injection |
      | target    | src/routes.ts   |
      | name      | products        |
      | after     | "// Routes"     |
    Then the content should be injected successfully
    And the original file structure should be preserved
    And the injection should be idempotent

  Scenario: Handle template variables correctly
    Given I have a template with complex variables:
      """
      ---
      to: "src/models/{{ name | pascalCase }}.ts"
      ---
      export interface {{ name | pascalCase }} {
        id: {{ idType | default('string') }};
        {{ #if withTimestamps }}
        createdAt: Date;
        updatedAt: Date;
        {{ /if }}
      }
      """
    When I call "unjucks_generate" with variables:
      | name           | User    |
      | idType         | number  |
      | withTimestamps | true    |
    Then the generated file should have correct variable substitution
    And filters should be applied properly
    And conditional blocks should render correctly

  Scenario: Error handling for invalid generators
    When I call the "unjucks_generate" MCP tool with generator "nonexistent"
    Then the response should indicate an error
    And the error message should be descriptive
    And the error should include available generators

  Scenario: Error handling for missing required variables
    Given I have a template requiring "name" and "type" variables
    When I call "unjucks_generate" without providing required variables
    Then the response should indicate missing variables
    And list all required variables
    And provide examples of correct usage

  Scenario: Handle complex template structures
    Given I have a multi-file template structure:
      """
      _templates/
        fullstack/
          new/
            package.json.njk
            src/
              index.ts.njk
              routes/
                {{ name }}.ts.njk
            tests/
              {{ name }}.test.ts.njk
      """
    When I generate with the "fullstack/new" generator
    Then all template files should be processed
    And directory structure should be created correctly
    And variables should be substituted in all files

  Scenario: Performance under load
    Given I have 10 different generators available
    When I make 20 concurrent MCP tool calls
    Then all calls should complete within 5 seconds
    And no tool calls should fail
    And memory usage should remain stable
    And response times should be consistent

  Scenario: File system safety
    When I call MCP tools with path traversal attempts:
      | parameter | malicious_value    |
      | dest      | ../../../etc/passwd|
      | template  | ../../system       |
    Then the requests should be rejected
    And no files should be created outside the project
    And security errors should be logged