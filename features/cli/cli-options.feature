Feature: CLI Options
  As a developer using Unjucks
  I want to use various command options
  So that I can control generation behavior and output

  Background:
    Given I have a project with unjucks installed
    And I have a generator "component" in "_templates/component"

  Scenario: Dry run mode shows what would be generated
    Given the generator "component" has template "index.ts.njk"
    When I run "unjucks generate component --name Button --dry"
    Then I should see "DRY RUN - No files will be created"
    And I should see the file path that would be created
    And I should see the rendered content preview
    And no actual files should be created
    And the exit code should be 0

  Scenario: Force mode overwrites existing files
    Given the file "Button/index.ts" already exists
    And the generator "component" has template "index.ts.njk"
    When I run "unjucks generate component --name Button --force"
    Then the existing file should be overwritten
    And I should see "Generated 1 file successfully (1 overwritten)"
    And the exit code should be 0

  Scenario: Generate without force mode when files exist
    Given the file "Button/index.ts" already exists
    And the generator "component" has template "index.ts.njk"
    When I run "unjucks generate component --name Button"
    Then I should see "File already exists: Button/index.ts"
    And I should see "Use --force to overwrite existing files"
    And the existing file should not be modified
    And the exit code should be 1

  Scenario: Custom destination directory
    Given the generator "component" has template "index.ts.njk"
    When I run "unjucks generate component --name Button --dest ./src/components"
    Then the file "src/components/Button/index.ts" should be created
    And I should see "Generated 1 file successfully"

  Scenario: Provide variables via command line
    Given the generator "api" requires variables "name", "method", and "endpoint"
    When I run "unjucks generate api --name UserAPI --method GET --endpoint /users"
    Then all variables should be properly substituted
    And the generation should complete successfully

  Scenario: Provide variables via data file
    Given I have a data file "user-api.json" with:
      """
      {
        "name": "UserAPI",
        "method": "POST",
        "endpoint": "/users",
        "withAuth": true
      }
      """
    When I run "unjucks generate api --data user-api.json"
    Then all variables should be loaded from the data file
    And the generation should complete successfully

  Scenario: Combine command line variables with data file
    Given I have a data file "base.json" with:
      """
      {
        "method": "GET",
        "withAuth": false
      }
      """
    When I run "unjucks generate api --data base.json --name UserAPI --endpoint /users --withAuth"
    Then command line variables should override data file values
    And "withAuth" should be true
    And "name" should be "UserAPI"
    And "method" should be "GET"

  Scenario: Verbose output mode
    Given the generator "component" has template "index.ts.njk"
    When I run "unjucks generate component --name Button --verbose"
    Then I should see detailed generation steps
    And I should see template processing information
    And I should see file writing operations
    And the generation should complete successfully

  Scenario: Quiet output mode
    Given the generator "component" has template "index.ts.njk"
    When I run "unjucks generate component --name Button --quiet"
    Then I should only see error messages if any occur
    And no success messages should be displayed
    And the generation should complete successfully

  Scenario: JSON output format
    Given the generator "component" has template "index.ts.njk"
    When I run "unjucks generate component --name Button --output json"
    Then the output should be valid JSON
    And it should contain file paths and status
    And it should contain generation statistics

  Scenario: Invalid data file format
    Given I have an invalid data file "bad.json" with:
      """
      { invalid json
      """
    When I run "unjucks generate api --data bad.json"
    Then I should see "Invalid JSON in data file: bad.json"
    And the exit code should be 1
    And no files should be created

  Scenario: Data file not found
    When I run "unjucks generate api --data nonexistent.json"
    Then I should see "Data file not found: nonexistent.json"
    And the exit code should be 1
    And no files should be created

  Scenario: Help for specific options
    When I run "unjucks generate --help"
    Then I should see all available options
    And I should see option descriptions
    And I should see default values where applicable
    And I should see usage examples

  Scenario: Multiple destinations with different variables
    Given the generator "component" supports multiple destinations
    When I run "unjucks generate component --name Button --dest ./src --dest ./stories --storybook"
    Then files should be generated in both destinations
    And the storybook template should only be used for the stories destination