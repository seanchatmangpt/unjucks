Feature: Template Generation
  As a developer
  I want to generate code from templates
  So that I can quickly scaffold new components and files

  Background:
    Given I have a working Unjucks installation
    And I have templates in "templates/component" directory
    And I have a clean test workspace

  Scenario: Generate simple component
    Given I have a template "templates/component/index.ts.njk"
    When I run "unjucks generate component user --name UserService"
    Then I should see "Generated: UserService component" message
    And the file "src/UserService.ts" should exist
    And the file should contain "class UserService"
    And the exit code should be 0

  Scenario: Generate with multiple variables
    Given I have a template "templates/api/controller.ts.njk"
    When I run "unjucks generate api controller --name User --endpoint users --methods get,post,put,delete"
    Then I should see generated files
    And the files should contain the correct variable substitutions
    And the exit code should be 0

  Scenario: Generate to custom destination
    Given I have a template "templates/component/index.ts.njk"
    When I run "unjucks generate component index --name UserList --dest ./custom/path"
    Then the file "custom/path/UserList.ts" should exist
    And the exit code should be 0

  Scenario: Dry run generation
    Given I have a template "templates/component/index.ts.njk"
    When I run "unjucks generate component user --name UserService --dry"
    Then I should see "Would generate:" message
    And I should see the list of files that would be created
    And no files should be actually created
    And the exit code should be 0

  Scenario: Generate with existing file (no force)
    Given I have a template "templates/component/index.ts.njk"
    And I have an existing file "src/UserService.ts"
    When I run "unjucks generate component user --name UserService"
    Then I should see "File already exists" error
    And the original file should remain unchanged
    And the exit code should be 1

  Scenario: Generate with existing file (force)
    Given I have a template "templates/component/index.ts.njk"
    And I have an existing file "src/UserService.ts"
    When I run "unjucks generate component user --name UserService --force"
    Then I should see "Overwriting existing file" message
    And the file should be replaced with new content
    And the exit code should be 0

  Scenario: Generate with invalid template
    When I run "unjucks generate nonexistent template --name Test"
    Then I should see "Template not found" error
    And I should see suggestions for similar templates
    And the exit code should be 1

  Scenario: Generate with missing required variables
    Given I have a template that requires "name" and "type" variables
    When I run "unjucks generate component test --name TestComponent"
    Then I should see "Missing required variable: type" error
    And the exit code should be 1

  Scenario: Generate with semantic RDF data
    Given I have a template with semantic annotations
    And I have RDF data defining the component structure
    When I run "unjucks generate semantic-component user --name UserService --rdf ./schema.ttl"
    Then I should see semantically enhanced generated files
    And the files should contain RDF-derived metadata
    And the exit code should be 0