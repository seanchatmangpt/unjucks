Feature: CLI Input Validation and Error Handling
  As a developer using Unjucks
  I want proper validation and error handling
  So that I can understand and fix issues quickly

  Background:
    Given I have a project with unjucks installed

  Scenario: Validate generator exists before processing variables
    When I run "unjucks generate nonexistent --name Test"
    Then I should see "Generator 'nonexistent' not found"
    And I should see a list of available generators
    And the exit code should be 1
    And no files should be created

  Scenario: Validate required variables are provided
    Given a generator "api" requires variables "name", "endpoint", and "method"
    When I run "unjucks generate api --name UserAPI"
    Then I should see "Missing required variables: endpoint, method"
    And I should see usage help for the generator
    And the exit code should be 1

  Scenario: Validate variable types and formats
    Given a generator "component" has variable "port" of type number
    When I run "unjucks generate component --name Test --port invalid"
    Then I should see "Invalid value for 'port': must be a number"
    And the exit code should be 1

  Scenario: Validate boolean variable values
    Given a generator "component" has boolean variable "withTests"
    When I run "unjucks generate component --name Test --withTests maybe"
    Then I should see "Invalid boolean value for 'withTests': use true/false, yes/no, y/n, or 1/0"
    And the exit code should be 1

  Scenario: Validate choice variable values
    Given a generator "component" has choice variable "type" with options ["button", "input", "select"]
    When I run "unjucks generate component --name Test --type invalid"
    Then I should see "Invalid value for 'type': must be one of button, input, select"
    And the exit code should be 1

  Scenario: Validate file path patterns
    Given a generator "component" has variable "name" with pattern validation for valid file names
    When I run "unjucks generate component --name 'Test/Invalid*Name' --type button"
    Then I should see "Invalid characters in 'name': cannot contain /, *, or other invalid filename characters"
    And the exit code should be 1

  Scenario: Validate destination path exists or can be created
    When I run "unjucks generate component --name Test --dest /root/forbidden"
    Then I should see "Cannot write to destination: /root/forbidden (permission denied)"
    And the exit code should be 1

  Scenario: Validate data file format
    Given I have a malformed JSON file "invalid.json":
      """
      { "name": "Test", "missing": quote }
      """
    When I run "unjucks generate component --data invalid.json"
    Then I should see "Invalid JSON in data file: invalid.json"
    And I should see the JSON parsing error details
    And the exit code should be 1

  Scenario: Validate data file contains expected structure
    Given I have a data file "wrong-structure.json":
      """
      ["not", "an", "object"]
      """
    When I run "unjucks generate component --data wrong-structure.json"
    Then I should see "Data file must contain a JSON object, not an array"
    And the exit code should be 1

  Scenario: Handle template parsing errors gracefully
    Given a generator "broken" has a template with invalid Nunjucks syntax
    When I run "unjucks generate broken --name Test"
    Then I should see "Template parsing error in broken/template.njk"
    And I should see the specific syntax error
    And the exit code should be 1
    And no partial files should be created

  Scenario: Handle file system permission errors
    Given the destination directory is read-only
    When I run "unjucks generate component --name Test --dest ./readonly"
    Then I should see "Permission denied: cannot write to ./readonly"
    And I should see suggestions for fixing the issue
    And the exit code should be 1

  Scenario: Handle disk space errors
    Given there is insufficient disk space
    When I run "unjucks generate large-component --name Test"
    Then I should see "Insufficient disk space to complete generation"
    And any partially written files should be cleaned up
    And the exit code should be 1

  Scenario: Validate template variable references
    Given a generator "component" uses undefined variable "{{missingVar}}" in template
    When I run "unjucks generate component --name Test --type button"
    Then I should see "Undefined variable 'missingVar' in template component/index.ts.njk"
    And I should see the line number where the error occurs
    And the exit code should be 1

  Scenario: Handle circular template dependencies
    Given templates have circular includes
    When I run "unjucks generate circular --name Test"
    Then I should see "Circular template dependency detected"
    And I should see the dependency chain
    And the exit code should be 1

  Scenario: Validate custom validation rules
    Given a generator "api" has custom validation requiring "endpoint" to start with "/"
    When I run "unjucks generate api --name Test --endpoint users"
    Then I should see "Validation failed for 'endpoint': must start with '/'"
    And the exit code should be 1

  Scenario: Handle network timeouts for remote templates
    Given a generator references a remote template that times out
    When I run "unjucks generate remote --name Test"
    Then I should see "Timeout fetching remote template"
    And I should see retry suggestions
    And the exit code should be 1

  Scenario: Provide helpful suggestions for common mistakes
    When I run "unjucks generat component --name Test"
    Then I should see "Unknown command 'generat'. Did you mean 'generate'?"
    And the exit code should be 1

  Scenario: Handle interrupted generation gracefully
    Given a long-running generation process
    When I interrupt the process with Ctrl+C
    Then I should see "Generation interrupted by user"
    And any partially created files should be cleaned up
    And the exit code should be 130

  Scenario: Validate template frontmatter format
    Given a template has invalid YAML frontmatter
    When I run "unjucks generate invalid-frontmatter --name Test"
    Then I should see "Invalid YAML frontmatter in template"
    And I should see the YAML parsing error
    And the exit code should be 1

  Scenario: Handle conflicting command line options
    When I run "unjucks generate component --name Test --quiet --verbose"
    Then I should see "Conflicting options: cannot use both --quiet and --verbose"
    And the exit code should be 1

  Scenario: Validate minimum and maximum values for numeric variables
    Given a generator "server" has variable "port" with min 1024 and max 65535
    When I run "unjucks generate server --name Test --port 80"
    Then I should see "Value for 'port' must be between 1024 and 65535"
    And the exit code should be 1

  Scenario: Handle missing template files referenced in frontmatter
    Given a template references non-existent included templates
    When I run "unjucks generate missing-includes --name Test"
    Then I should see "Referenced template not found: missing-template.njk"
    And the exit code should be 1

  Scenario: Provide detailed error context for debugging
    Given verbose error reporting is enabled
    When any error occurs during generation
    Then I should see the full error stack trace
    And I should see the current working directory
    And I should see the command that was executed
    And I should see environment information that might be relevant