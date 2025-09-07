Feature: Developer Workflow with Template Generation
  As a software developer
  I want to quickly scaffold components and features
  So that I can focus on business logic instead of boilerplate

  Background:
    Given I have unjucks installed in my project
    And I have a clean workspace
    And the MCP server is running

  Scenario: Discovering available generators
    Given I am in a project directory
    When I run "unjucks list"
    Then I should see a list of available generators
    And each generator should show its description
    And the output should include generator categories

  Scenario: Getting help for a specific generator
    Given I know there is a "component" generator available
    When I run "unjucks help component"
    Then I should see the generator description
    And I should see all available options and their types
    And I should see usage examples
    And I should see required vs optional parameters

  Scenario: Generating a React component with TypeScript
    Given I have a React project structure
    When I run "unjucks generate component Button --type=typescript --withTests --withStorybook"
    Then a TypeScript component file should be created at "src/components/Button/Button.tsx"
    And a test file should be created at "src/components/Button/Button.test.tsx"
    And a Storybook file should be created at "src/components/Button/Button.stories.tsx"
    And the component should export a proper TypeScript interface
    And the test should include basic render and interaction tests

  Scenario: Generating a full-stack feature with database models
    Given I have a Node.js project with database setup
    When I run "unjucks generate feature user --withAuth --withCRUD --database=postgresql"
    Then a user model should be created with proper schema
    And CRUD API endpoints should be generated
    And authentication middleware should be included
    And database migration files should be created
    And API documentation should be generated

  Scenario: Dry run to preview changes
    Given I want to see what files will be created
    When I run "unjucks generate api users --dry-run"
    Then I should see a list of files that would be created
    And I should see the target paths for each file
    And no actual files should be created on disk
    And I should see a summary of planned operations

  Scenario: Force overwrite existing files
    Given I have existing component files
    When I run "unjucks generate component Button --force"
    Then the existing files should be overwritten
    And I should see a warning about overwriting existing files
    And a backup should be created of the original files

  Scenario: Injecting code into existing files
    Given I have an existing router file at "src/routes/index.ts"
    When I run "unjucks generate route user --inject"
    Then the new route should be added to the existing router
    And the import statements should be updated
    And the existing code should remain intact
    And the injection should be idempotent

  Scenario: Using custom variables in templates
    Given I have a generator that accepts custom variables
    When I run "unjucks generate model Product --tableName=products --withTimestamps --author='John Doe'"
    Then the generated model should use "products" as the table name
    And timestamps should be included in the schema
    And the author name should appear in the file header comments

  Scenario: Generating with conditional logic
    Given I have a generator with conditional templates
    When I run "unjucks generate controller api/users --version=v2 --withAuth"
    Then the controller should include v2-specific features
    And authentication decorators should be present
    But v1 deprecated methods should not be included

  Scenario: Multi-file generation with dependencies
    Given I need to generate a complete module
    When I run "unjucks generate module payment --withService --withController --withTests"
    Then a service class should be generated
    And a controller should be generated that imports the service
    And test files should be generated for both service and controller
    And proper dependency injection should be configured

  Scenario: Error handling for invalid generators
    Given I try to use a non-existent generator
    When I run "unjucks generate nonexistent myfile"
    Then I should see an error message
    And I should be shown available generators as suggestions
    And the command should exit with a non-zero status code

  Scenario: Error handling for missing required parameters
    Given I use a generator without required parameters
    When I run "unjucks generate component"
    Then I should see an error about missing required parameters
    And I should be shown the correct usage format
    And I should see which parameters are required