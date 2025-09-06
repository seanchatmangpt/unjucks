Feature: Template Generation
  As a developer
  I want to generate code templates using unjucks
  So that I can quickly scaffold new components and files

  Background:
    Given I have a project with templates directory
    And I am in the project root directory

  @smoke
  Scenario: Generate a simple command template
    Given I have a "command" generator with "citty" template
    When I run "unjucks generate command citty --commandName=UserProfile"
    Then I should see "UserProfile.ts" file generated
    And the file should contain "export const UserProfileCommand"
    And the file should contain "name: \"user-profile\""

  @regression
  Scenario: Generate template with custom filters
    Given I have a "command" generator with "citty" template
    When I run "unjucks generate command citty --commandName=UserProfile"
    Then the generated filename should be "UserProfile.ts"
    And the content should contain "User Profile Command"
    And the content should contain "user-profile"

  @integration
  Scenario: Handle missing template gracefully
    Given I have a "command" generator
    When I run "unjucks generate command nonexistent"
    Then I should see an error message
    And the error should contain "Template 'nonexistent' not found"

  @smoke
  Scenario: List available generators
    Given I have generators "command" and "cli"
    When I run "unjucks list"
    Then I should see "command" generator listed
    And I should see "cli" generator listed

  @regression
  Scenario: Initialize new project
    Given I am in an empty directory
    When I run "unjucks init --type=citty"
    Then I should see "_templates" directory created
    And I should see "unjucks.yml" file created
    And I should see example generators created


