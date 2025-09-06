Feature: MCP Edge Cases and Error Scenarios
  As a robust development tool
  I want the MCP server to handle edge cases gracefully
  So that it remains reliable in all scenarios

  Background:
    Given I have a clean test environment
    And the MCP server is running

  Scenario: Empty template directory
    Given I have no templates available
    When I call the "unjucks_list" MCP tool
    Then the response should return an empty generators list
    And should not return an error
    And should include a helpful message about no generators found

  Scenario: Malformed template frontmatter
    Given I have a template with invalid frontmatter:
      """
      ---
      to: "unclosed string
      invalid: yaml: structure
      ---
      Template content
      """
    When I call "unjucks_help" for this template
    Then the response should indicate a parsing error
    And should provide specific details about the YAML issue
    And should suggest how to fix the frontmatter

  Scenario: Template with circular dependencies
    Given I have templates that reference each other:
      | template_a | includes: template_b |
      | template_b | includes: template_a |
    When I generate using these templates
    Then the system should detect the circular dependency
    And should prevent infinite loops
    And should provide a clear error message

  Scenario: Very long file paths
    Given I have a template that generates files with paths longer than 255 characters
    When I call "unjucks_generate" with a very long destination path
    Then the system should handle the long path appropriately
    And should either generate the file or provide a clear path length error
    And should not crash or become unstable

  Scenario: Unicode and special characters in variables
    Given I have a template with variables
    When I provide variables with special characters:
      | variable | value                    |
      | name     | 测试Component             |
      | emoji    | 🚀                       |
      | special  | <script>alert('xss')</script> |
    Then the variables should be properly encoded/escaped
    And the generated files should contain safe content
    And no security issues should arise

  Scenario: Extremely large variable values
    Given I have a template expecting a "content" variable
    When I provide a 10MB string as the content variable
    Then the system should handle the large content appropriately
    And should either process it or reject with a size limit error
    And should not exhaust system memory

  Scenario: Template with syntax errors
    Given I have a template with Nunjucks syntax errors:
      """
      ---
      to: "output.js"
      ---
      {{ unclosed.variable
      {% if missingEndif %}
      content
      {{ undefined | nonexistentFilter }}
      """
    When I call "unjucks_generate" with this template
    Then the response should indicate syntax errors
    And should specify the exact error locations
    And should provide suggestions for fixing the syntax

  Scenario: Missing required template files
    Given I have a generator directory structure without template files
    When I call "unjucks_help" for this generator
    Then the system should indicate missing template files
    And should specify which files are expected
    And should provide guidance on proper template structure

  Scenario: File system permissions issues
    Given I have read-only directories in the output path
    When I attempt to generate files in the read-only location
    Then the system should detect the permission issue
    And should provide a clear permission error message
    And should suggest alternative output locations

  Scenario: Template variables with null/undefined values
    Given I have a template requiring variables
    When I provide null or undefined values:
      | variable | value     |
      | name     | null      |
      | type     | undefined |
      | config   |           |
    Then the system should handle null/undefined gracefully
    And should either use defaults or prompt for values
    And should not crash or generate malformed content

  Scenario: Concurrent modifications during generation
    Given I am generating files from a template
    When the template files are modified during generation
    Then the system should either complete with the original template
    Or detect the change and handle it gracefully
    And should not generate corrupted output

  Scenario: Disk space exhaustion
    Given I have limited disk space available
    When I attempt to generate a large number of files
    Then the system should monitor disk space usage
    And should fail gracefully if disk space is exhausted
    And should clean up any partially created files

  Scenario: Network connectivity issues (for remote templates)
    Given I have templates that reference remote resources
    When network connectivity is unavailable
    Then the system should handle network errors gracefully
    And should provide appropriate offline functionality
    And should cache templates when possible

  Scenario: Template with infinite loops
    Given I have a template with a potentially infinite loop:
      """
      ---
      to: "output.js"
      ---
      {% for item in infiniteGenerator %}
        {{ item }}
      {% endfor %}
      """
    When I generate using this template
    Then the system should detect and prevent infinite loops
    And should timeout after a reasonable duration
    And should provide an error about loop termination

  Scenario: Memory pressure scenarios
    Given the system is under memory pressure
    When I perform template operations
    Then the system should gracefully handle low memory conditions
    And should prioritize essential operations
    And should provide appropriate error messages for rejected operations

  Scenario: Invalid tool parameter combinations
    When I call MCP tools with invalid parameter combinations:
      | tool           | invalid_params                    |
      | unjucks_generate| generator: "test", template: "other"|
      | unjucks_inject | target: "", content: "something"   |
      | unjucks_help   | generator: 123                     |
    Then the system should validate parameter combinations
    And should provide specific validation errors
    And should suggest correct parameter usage

  Scenario: Template with extremely deep nesting
    Given I have a template with 1000 levels of nested conditionals
    When I attempt to render this template
    Then the system should handle deep nesting appropriately
    And should either render successfully or fail with stack overflow protection
    And should not crash the entire system