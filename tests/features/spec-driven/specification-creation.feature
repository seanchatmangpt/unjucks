Feature: Specification Creation and Validation
  As a developer
  I want to create and validate specifications
  So that I can ensure my requirements are properly documented and structured

  Background:
    Given I have a clean working environment
    And the Unjucks system is initialized

  Scenario: Creating a basic specification
    Given I have a new project requirement
    When I create a specification with:
      | field       | value                           |
      | name        | UserAuthentication              |
      | description | User login and logout system    |
      | type        | feature                         |
      | priority    | high                            |
    Then the specification should be created successfully
    And the specification should contain all required fields
    And the specification should be saved to the specifications directory

  Scenario: Validating specification structure
    Given I have a specification file
    When I validate the specification structure
    Then it should check for required fields:
      | field       | required |
      | name        | true     |
      | description | true     |
      | type        | true     |
      | acceptance  | false    |
      | priority    | false    |
    And it should validate field types and formats
    And it should return validation results

  Scenario: Specification with acceptance criteria
    Given I want to create a detailed specification
    When I create a specification with acceptance criteria:
      | criteria                                    |
      | User can login with valid credentials       |
      | User receives error for invalid credentials |
      | User can logout successfully                |
      | Session expires after inactivity            |
    Then the specification should include all acceptance criteria
    And each criterion should be testable
    And the specification should be marked as complete

  Scenario: Invalid specification handling
    Given I attempt to create an invalid specification
    When I create a specification with missing required fields:
      | field       | value |
      | description | Login |
    Then the specification creation should fail
    And I should receive a validation error
    And the error should specify which fields are missing
    And no specification file should be created

  Scenario: Specification versioning
    Given I have an existing specification
    When I update the specification with new requirements
    Then a new version should be created
    And the previous version should be preserved
    And the version history should be tracked
    And I can retrieve any previous version

  Scenario: Specification templates
    Given I want to use a specification template
    When I create a specification from template:
      | template | api-endpoint |
    Then the specification should inherit template structure
    And template fields should be pre-populated
    And I should be able to customize the inherited fields
    And the final specification should be valid

  Scenario: Cross-referencing specifications
    Given I have multiple related specifications
    When I create a specification that references others:
      | reference_type | reference_name     |
      | depends_on     | UserAuthentication |
      | relates_to     | UserProfile        |
    Then the references should be validated
    And dependency chains should be checked for cycles
    And the specification should link to referenced specs
    And navigation between specs should be possible

  Scenario: Specification export formats
    Given I have a valid specification
    When I export the specification
    Then I should be able to export to formats:
      | format | extension |
      | JSON   | .json     |
      | YAML   | .yaml     |
      | MD     | .md       |
    And each format should preserve all specification data
    And exported files should be valid in their respective formats

  Scenario: Bulk specification validation
    Given I have multiple specification files
    When I run bulk validation
    Then all specifications should be validated
    And validation results should be aggregated
    And I should receive a summary report
    And invalid specifications should be clearly identified
    And I should get suggestions for fixing issues