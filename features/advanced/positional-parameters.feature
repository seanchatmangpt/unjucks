@positional @hygen @cli
Feature: Hygen-style Positional Parameters
  As a developer using unjucks
  I want to use Hygen-style positional parameter syntax
  So that I can have CLI parity with Hygen and streamlined command usage

  Background:
    Given I have a clean test workspace
    And I have a generator with positional parameter support

  @smoke @critical
  Scenario: Basic Hygen-style positional syntax
    When I run "unjucks component react UserProfile"
    Then the command should succeed
    And it should generate a file at "src/components/UserProfile.tsx"
    And the file should contain "UserProfile Component"
    And the positional parameter "name" should be parsed correctly

  @compatibility @backward-compatibility
  Scenario: Positional and flag styles should be equivalent
    Given I have a generator with positional parameter support
    When I run the Hygen-style command "unjucks component react MyComponent"
    And I run the traditional command "unjucks generate component react --name=MyComponent"
    Then both commands should produce identical results
    And both flag and positional styles should be supported

  @integration
  Scenario: Mixed positional and flag arguments
    When I run "unjucks component react Button --withProps --withTests"
    Then the command should succeed
    And the parameter "name" should have value "Button"
    And it should generate a file at "src/components/Button.tsx"

  @edge-cases
  Scenario: Special Hygen patterns with 'new' keyword
    When I run "unjucks component new ProfileCard"
    Then the command should succeed
    And it should generate a file at "src/components/ProfileCard.tsx"

  @validation
  Scenario Outline: Various positional parameter patterns
    When I run "unjucks <generator> <template> <name>"
    Then the command should succeed
    And the parameter "name" should have value "<name>"

    Examples:
      | generator | template | name          |
      | component | react    | UserForm      |
      | component | new      | ProductList   |
      | api       | endpoint | UserEndpoint  |

  @advanced
  Scenario: Multiple positional parameters with type inference
    Given I have a generator that accepts multiple positional parameters
    When I run "unjucks component advanced UserCard true 42 --extra=value"
    Then the command should succeed
    And the parameter "name" should have value "UserCard"
    And the boolean parameter should be parsed as true
    And the numeric parameter should be parsed as 42

  @error-handling
  Scenario: Invalid positional parameter usage
    When I run "unjucks --invalid-flag component react"
    Then the command should succeed
    # Should fall back to traditional parsing

  @help
  Scenario: Help shows positional parameter usage
    When I run "unjucks help component react"
    Then the command should succeed
    And the output should show positional parameter examples

  @backward-compatibility
  Scenario: Traditional generate command still works
    When I run "unjucks generate component react --name=TestComponent"
    Then the command should succeed
    And it should work identically to "unjucks component react TestComponent"

  @performance
  Scenario: Positional parameter parsing performance
    When I run "unjucks component react SpeedTest" within 2 seconds
    Then the command should succeed
    And the parsing should complete quickly