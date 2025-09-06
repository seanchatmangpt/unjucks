Feature: Turtle Data Support
  As a developer using Unjucks
  I want to use Turtle/RDF data files as template variables
  So that I can generate code from semantic data sources

  Background:
    Given I have a clean test environment
    And I have built the CLI

  Scenario: Parse basic Turtle data file
    Given I have a Turtle file with person data
    When I parse the Turtle file
    Then the parsing should succeed
    And I should get structured data with person information
    And I should get a list of available template variables

  Scenario: Generate template using Turtle data variables
    Given I have a Turtle file with project information
    And I have a template that uses Turtle variables
    When I generate the template with Turtle data
    Then the generated files should contain the Turtle data values
    And the template variables should be correctly substituted

  Scenario: Handle invalid Turtle syntax
    Given I have a Turtle file with syntax errors
    When I try to parse the Turtle file
    Then the parsing should fail gracefully
    And I should get clear error messages about the syntax issues
    And the system should not crash

  Scenario: Support complex Turtle data structures
    Given I have a Turtle file with nested relationships
    And I have a template that accesses nested Turtle data
    When I generate the template with complex Turtle data
    Then the nested data should be correctly accessible in templates
    And arrays should be handled properly for multiple values

  Scenario: CLI command with Turtle data source
    Given I have a Turtle data file "project.ttl"
    And I have a template generator for projects
    When I run "unjucks generate project readme --data-turtle project.ttl"
    Then the command should succeed
    And the generated README should contain data from the Turtle file

  Scenario: Validate Turtle file before processing
    Given I have various Turtle files with different validity states
    When I validate each Turtle file
    Then valid files should pass validation
    And invalid files should be rejected with specific error messages

  Scenario: Performance with large Turtle datasets
    Given I have a large Turtle file with 1000+ entities
    When I parse the large Turtle file
    Then the parsing should complete within reasonable time
    And memory usage should remain within acceptable limits

  Scenario: Turtle data with CLI dry-run
    Given I have a Turtle data file
    And I have a template that uses the Turtle data
    When I run the generator in dry-run mode with Turtle data
    Then I should see what files would be generated
    And I should see the Turtle data variables being used
    But no actual files should be created

  Scenario: Error handling for missing Turtle files
    Given I specify a non-existent Turtle data file
    When I try to generate a template with the missing file
    Then I should get a clear error message about the missing file
    And the command should exit with non-zero status

  Scenario: Turtle data variable extraction
    Given I have a Turtle file with various data types
    When I extract template variables from the Turtle data
    Then I should get all available variable names
    And variables should include nested paths for complex data
    And the variable list should be sorted and deduplicated