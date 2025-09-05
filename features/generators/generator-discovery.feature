@generator @discovery @core
Feature: Generator Discovery
  As a developer
  I want to discover available generators in my templates directory
  So that I can scaffold code efficiently and understand what generators are available

  Background:
    Given the unjucks system is initialized
    And a templates directory exists at "_templates"

  @happy-path
  Scenario: Discover single generator in _templates
    Given a generator "component" exists in "_templates/component"
    When I run "unjucks list"
    Then I should see "component" in the output
    And the exit code should be 0

  @multiple-generators
  Scenario: Discover multiple generators
    Given the following generators exist:
      | name      | path                    |
      | component | _templates/component    |
      | service   | _templates/service      |
      | model     | _templates/model        |
    When I run "unjucks list"
    Then I should see all generators in the output:
      | component |
      | service   |
      | model     |
    And the generators should be listed alphabetically

  @nested-generators
  Scenario: Discover nested generators
    Given a generator "api/controller" exists in "_templates/api/controller"
    And a generator "ui/component" exists in "_templates/ui/component"
    When I run "unjucks list"
    Then I should see "api/controller" in the output
    And I should see "ui/component" in the output

  @empty-directory
  Scenario: Handle empty templates directory
    Given the "_templates" directory is empty
    When I run "unjucks list"
    Then I should see "No generators found" in the output
    And the exit code should be 0

  @missing-directory
  Scenario: Handle missing templates directory
    Given no "_templates" directory exists
    When I run "unjucks list"
    Then I should see an error message about missing templates directory
    And the exit code should be 1

  @invalid-generator
  Scenario: Skip invalid generator directories
    Given a directory "_templates/broken" exists without template files
    And a valid generator "component" exists in "_templates/component"
    When I run "unjucks list"
    Then I should see "component" in the output
    And I should not see "broken" in the output
    And I should see a warning about "broken" being skipped

  @custom-templates-path
  Scenario: Discover generators in custom templates directory
    Given a generator "service" exists in "custom-templates/service"
    When I run "unjucks list --templates-dir custom-templates"
    Then I should see "service" in the output

  @verbose-discovery
  Scenario: Verbose discovery output
    Given a generator "component" exists in "_templates/component"
    When I run "unjucks list --verbose"
    Then I should see detailed information about "component":
      | Template files |
      | Variables      |
      | Description    |

  @json-output
  Scenario: JSON format discovery output
    Given the following generators exist:
      | name      | description              |
      | component | React component template |
      | service   | Service layer template   |
    When I run "unjucks list --format json"
    Then the output should be valid JSON
    And the JSON should contain generator information:
      | name        | description                |
      | component   | React component template   |
      | service     | Service layer template     |

  @filter-generators
  Scenario Outline: Filter generators by pattern
    Given the following generators exist:
      | name           |
      | react-component|
      | vue-component  |
      | angular-service|
      | react-service  |
    When I run "unjucks list --filter <pattern>"
    Then I should see the following generators:
      | <expected> |
    
    Examples:
      | pattern   | expected                          |
      | react     | react-component, react-service    |
      | component | react-component, vue-component    |
      | service   | angular-service, react-service    |

  @performance
  Scenario: Discovery performance with many generators
    Given 100 generators exist in "_templates"
    When I run "unjucks list"
    Then the command should complete within 5 seconds
    And all 100 generators should be listed

  @hidden-files
  Scenario: Ignore hidden files and directories during discovery
    Given a generator "component" exists in "_templates/component"
    And a hidden directory "_templates/.hidden" exists
    And a hidden file "_templates/.gitignore" exists
    When I run "unjucks list"
    Then I should see "component" in the output
    And I should not see ".hidden" in the output
    And I should not see ".gitignore" in the output