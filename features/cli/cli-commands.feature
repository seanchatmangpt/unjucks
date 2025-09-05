Feature: CLI Commands
  As a developer using Unjucks
  I want to use main CLI commands
  So that I can discover, understand, and generate code from templates

  Background:
    Given I have a project with unjucks installed
    And I have templates in the "_templates" directory

  Scenario: List available generators
    When I run "unjucks list"
    Then I should see a list of available generators
    And each generator should show its name and description
    And the output should be formatted as a table

  Scenario: List generators with no templates available
    Given there are no templates in the "_templates" directory
    When I run "unjucks list"
    Then I should see "No generators found"
    And the exit code should be 0

  Scenario: Get help for a specific generator
    Given a generator "api" exists in "_templates/api"
    When I run "unjucks help api"
    Then I should see the generator description
    And I should see all available template files
    And I should see required variables
    And I should see optional variables with defaults
    And I should see usage examples

  Scenario: Get help for non-existent generator
    When I run "unjucks help nonexistent"
    Then I should see "Generator 'nonexistent' not found"
    And the exit code should be 1
    And I should see available generators as suggestions

  Scenario: Generate code from a simple generator
    Given a generator "component" exists with template "index.ts.njk"
    When I run "unjucks generate component --name Button"
    Then the file "Button/index.ts" should be created
    And the file should contain the rendered template content
    And I should see "Generated 1 file successfully"

  Scenario: Generate code with nested directory structure
    Given a generator "feature" exists with templates:
      | Template              | Destination         |
      | component.ts.njk      | {{name}}/index.ts   |
      | component.test.ts.njk | {{name}}/test.ts    |
    When I run "unjucks generate feature --name UserProfile"
    Then the file "UserProfile/index.ts" should be created
    And the file "UserProfile/test.ts" should be created
    And I should see "Generated 2 files successfully"

  Scenario: Generate code with custom destination
    Given a generator "util" exists with template "helper.ts.njk"
    When I run "unjucks generate util --name StringHelper --dest ./src/utils"
    Then the file "src/utils/StringHelper.ts" should be created
    And I should see "Generated 1 file successfully"

  Scenario: Show version information
    When I run "unjucks --version"
    Then I should see the current version number
    And the exit code should be 0

  Scenario: Show general help
    When I run "unjucks --help"
    Then I should see available commands
    And I should see global options
    And I should see usage examples
    And the exit code should be 0

  Scenario: Handle invalid command
    When I run "unjucks invalid-command"
    Then I should see "Unknown command 'invalid-command'"
    And I should see available commands as suggestions
    And the exit code should be 1

  Scenario: Generate with missing required variables
    Given a generator "api" exists requiring variables "name" and "endpoint"
    When I run "unjucks generate api --name UserAPI"
    Then I should see "Missing required variable: endpoint"
    And the exit code should be 1
    And no files should be created

  Scenario: Generate with all required variables provided
    Given a generator "api" exists requiring variables "name" and "endpoint"
    When I run "unjucks generate api --name UserAPI --endpoint /users"
    Then the generation should complete successfully
    And all template variables should be properly substituted