Feature: CLI Interactive Prompts
  As a developer using Unjucks
  I want to be prompted for missing variables
  So that I can generate code without remembering all required parameters

  Background:
    Given I have a project with unjucks installed
    And I have a generator "component" requiring variables "name", "type", and "withTests"

  Scenario: Interactive prompt for single missing variable
    When I run "unjucks generate component --type Button"
    Then I should be prompted for "name"
    And I should see the prompt "Enter name:"
    When I enter "LoginButton"
    Then the variable "name" should be set to "LoginButton"
    And the generation should complete successfully

  Scenario: Interactive prompts for multiple missing variables
    When I run "unjucks generate component"
    Then I should be prompted for "name"
    When I enter "SearchBox"
    Then I should be prompted for "type"
    When I enter "input"
    Then I should be prompted for "withTests"
    When I enter "yes"
    Then all variables should be collected
    And the generation should complete successfully

  Scenario: Skip interactive prompts in non-interactive mode
    Given the terminal is not interactive
    When I run "unjucks generate component"
    Then I should see "Missing required variable: name"
    And I should see "Use --name to provide this value"
    And the exit code should be 1
    And no files should be created

  Scenario: Interactive prompt with default values
    Given the generator "api" has variable "method" with default "GET"
    When I run "unjucks generate api --name UserAPI --endpoint /users"
    Then I should be prompted for "method" with default "GET"
    And I should see the prompt "Enter method (GET):"
    When I press Enter
    Then the variable "method" should be set to "GET"

  Scenario: Interactive prompt overriding default values
    Given the generator "api" has variable "method" with default "GET"
    When I run "unjucks generate api --name UserAPI --endpoint /users"
    Then I should be prompted for "method" with default "GET"
    When I enter "POST"
    Then the variable "method" should be set to "POST"

  Scenario: Boolean variable prompts with y/n
    Given the generator "component" has boolean variable "withTests"
    When I run "unjucks generate component --name Button --type component"
    Then I should be prompted for "withTests"
    And I should see the prompt "Include tests? (y/n):"
    When I enter "y"
    Then the variable "withTests" should be true

  Scenario: Boolean variable prompts with yes/no
    Given the generator "component" has boolean variable "withTests"
    When I run "unjucks generate component --name Button --type component"
    Then I should be prompted for "withTests"
    When I enter "yes"
    Then the variable "withTests" should be true

  Scenario: Boolean variable prompts with false response
    Given the generator "component" has boolean variable "withTests"
    When I run "unjucks generate component --name Button --type component"
    When I enter "n"
    Then the variable "withTests" should be false

  Scenario: Choice variable with predefined options
    Given the generator "component" has choice variable "style" with options ["default", "primary", "secondary"]
    When I run "unjucks generate component --name Button --type component --withTests no"
    Then I should be prompted to select from "style" options
    And I should see the options listed
    When I select "primary"
    Then the variable "style" should be set to "primary"

  Scenario: Invalid choice selection
    Given the generator "component" has choice variable "style" with options ["default", "primary", "secondary"]
    When I run "unjucks generate component --name Button --type component --withTests no"
    And I enter "invalid"
    Then I should see "Invalid choice. Please select from: default, primary, secondary"
    And I should be prompted again

  Scenario: Prompt validation for required format
    Given the generator "component" has variable "name" with pattern validation for PascalCase
    When I run "unjucks generate component --type component --withTests no"
    And I enter "invalid-name"
    Then I should see "Name must be in PascalCase format"
    And I should be prompted again
    When I enter "ValidName"
    Then the variable should be accepted

  Scenario: Prompt with custom validation message
    Given the generator "api" has variable "endpoint" with custom validation
    When I run "unjucks generate api --name UserAPI --method GET"
    And I enter "invalid-endpoint"
    Then I should see the custom validation message
    And I should be prompted again

  Scenario: Cancel generation with Ctrl+C
    When I run "unjucks generate component"
    And I press Ctrl+C during prompts
    Then I should see "Generation cancelled by user"
    And the exit code should be 130
    And no files should be created

  Scenario: Empty input for required variable
    When I run "unjucks generate component --type component --withTests no"
    And I press Enter without entering a name
    Then I should see "This value is required"
    And I should be prompted again

  Scenario: Prompt history and auto-completion
    Given I have previously used the value "LoginButton" for "name"
    When I run "unjucks generate component --type component --withTests no"
    And I press the up arrow key
    Then I should see "LoginButton" pre-filled
    When I press Enter
    Then the variable "name" should be set to "LoginButton"

  Scenario: Multi-line input prompt
    Given the generator "component" has variable "description" that accepts multi-line input
    When I run "unjucks generate component --name Button --type component --withTests no"
    Then I should see "Enter description (press Enter twice to finish):"
    When I enter multiple lines:
      """
      A reusable button component
      with customizable styling
      """
    Then the variable "description" should contain the multi-line text

  Scenario: Conditional prompts based on previous answers
    Given the generator "component" conditionally prompts for "testFramework" when "withTests" is true
    When I run "unjucks generate component --name Button --type component"
    And I enter "yes" for withTests
    Then I should be prompted for "testFramework"
    When I enter "jest"
    Then both variables should be set correctly