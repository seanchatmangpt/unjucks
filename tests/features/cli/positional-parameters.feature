Feature: Positional Parameters Support
  As a CLI user
  I want to use positional parameters instead of flags
  So that I can generate templates with a Hygen-style interface

  Background:
    Given I have initialized a project with templates
    And the command generator exists with citty template
    And the template has variables: commandName, withTests, withSubcommands

  Scenario: Generate with positional parameters
    When I run "unjucks generate command citty MyCommand"
    Then the generation should succeed
    And the file "MyCommand.ts" should be created
    And the file should contain "MyCommandCommand"

  Scenario: Generate with positional and flag parameters mixed
    When I run "unjucks generate command citty MyCommand --withTests=false"
    Then the generation should succeed
    And the file "MyCommand.ts" should be created
    And the test file should not be created

  Scenario: Generate with all positional parameters
    When I run "unjucks generate command citty MyComponent true false"
    Then the generation should succeed
    And the file "MyComponent.ts" should be created
    And the test file "MyComponent.test.ts" should be created

  Scenario: Show positional parameter validation error
    When I run "unjucks generate command citty" without required parameters
    Then the command should fail with validation error
    And usage examples should be displayed

  Scenario: Display help for positional parameters
    When I run "unjucks help command citty"
    Then positional parameters should be shown
    And usage examples should be displayed
    And flag parameters should be shown

  Scenario: Backward compatibility with flag-only parameters
    When I run "unjucks generate command citty --commandName=MyCommand"
    Then the generation should succeed
    And the result should be identical to positional usage

  Scenario: Positional parameters take precedence over flags
    When I run "unjucks generate command citty PositionalName --commandName=FlagName"
    Then the generation should succeed
    And the file should use "PositionalName" not "FlagName"

  Scenario: Interactive prompts for missing positional parameters
    When I run "unjucks generate command citty" interactively
    And I provide "InteractiveCommand" when prompted for commandName
    Then the generation should succeed
    And the file "InteractiveCommand.ts" should be created

  Scenario: Dry run with positional parameters
    When I run "unjucks generate command citty TestCommand --dry"
    Then the command should show what would be generated
    And no files should be created
    And the output should show "TestCommand.ts"

  Scenario: Help shows positional parameter tips
    When I run "unjucks generate command citty --help"
    Then positional parameter tips should be displayed
    And examples should be shown