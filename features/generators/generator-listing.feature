@generator @listing @cli
Feature: Generator Listing
  As a developer
  I want to list available generators with various output formats and filters
  So that I can quickly find and understand the generators available to me

  Background:
    Given the unjucks system is initialized
    And the following generators exist in "_templates":
      | name              | description                    | variables           |
      | react-component   | React functional component     | name, withProps     |
      | vue-component     | Vue.js component template      | name, withScript    |
      | express-route     | Express.js route handler       | path, method        |
      | nest-controller   | NestJS controller              | name, withService   |
      | typescript-model  | TypeScript data model          | name, withValidation|

  @default-listing
  Scenario: Default generator listing
    When I run "unjucks list"
    Then I should see a formatted list of generators:
      | Generator Name    |
      | express-route     |
      | nest-controller   |
      | react-component   |
      | typescript-model  |
      | vue-component     |
    And the generators should be sorted alphabetically
    And the exit code should be 0

  @detailed-listing
  Scenario: Detailed generator listing with descriptions
    When I run "unjucks list --detailed"
    Then I should see detailed information for each generator:
      | Name            | Description                    |
      | react-component | React functional component     |
      | vue-component   | Vue.js component template      |
      | express-route   | Express.js route handler       |
    And each entry should show available variables

  @table-format
  Scenario: Table format listing
    When I run "unjucks list --format table"
    Then the output should be formatted as a table with headers:
      | Name              | Description                    | Variables           |
      | react-component   | React functional component     | name, withProps     |
      | vue-component     | Vue.js component template      | name, withScript    |
      | express-route     | Express.js route handler       | path, method        |

  @json-format
  Scenario: JSON format listing
    When I run "unjucks list --format json"
    Then the output should be valid JSON
    And the JSON should contain an array of generators
    And each generator should have the properties:
      | name        |
      | description |
      | variables   |
      | path        |
      | templates   |

  @yaml-format
  Scenario: YAML format listing
    When I run "unjucks list --format yaml"
    Then the output should be valid YAML
    And the YAML should contain all generator information
    And the structure should be easily readable

  @minimal-listing
  Scenario: Minimal listing (names only)
    When I run "unjucks list --minimal"
    Then I should see only generator names:
      | express-route     |
      | nest-controller   |
      | react-component   |
      | typescript-model  |
      | vue-component     |
    And there should be no additional information displayed

  @category-filtering
  Scenario Outline: Filter generators by category
    Given generators are tagged with categories:
      | name              | category    |
      | react-component   | frontend    |
      | vue-component     | frontend    |
      | express-route     | backend     |
      | nest-controller   | backend     |
      | typescript-model  | shared      |
    When I run "unjucks list --category <category>"
    Then I should see only generators from category "<category>":
      | <expected_generators> |

    Examples:
      | category | expected_generators                   |
      | frontend | react-component, vue-component        |
      | backend  | express-route, nest-controller        |
      | shared   | typescript-model                      |

  @tag-filtering
  Scenario: Filter generators by tags
    Given generators have the following tags:
      | name              | tags                    |
      | react-component   | react, frontend, ui     |
      | vue-component     | vue, frontend, ui       |
      | express-route     | express, backend, api   |
      | nest-controller   | nestjs, backend, api    |
    When I run "unjucks list --tag frontend"
    Then I should see generators tagged with "frontend":
      | react-component |
      | vue-component   |
    And I should not see backend generators

  @search-functionality
  Scenario Outline: Search generators by name or description
    When I run "unjucks list --search <search_term>"
    Then I should see generators matching "<search_term>":
      | <expected_results> |

    Examples:
      | search_term | expected_results                    |
      | component   | react-component, vue-component      |
      | route       | express-route                       |
      | controller  | nest-controller                     |
      | typescript  | typescript-model                    |
      | express     | express-route                       |

  @sort-options
  Scenario Outline: Sort generators by different criteria
    When I run "unjucks list --sort <sort_by>"
    Then the generators should be sorted by "<sort_by>":
      | <expected_order> |

    Examples:
      | sort_by     | expected_order                                              |
      | name        | express-route, nest-controller, react-component, typescript-model, vue-component |
      | name-desc   | vue-component, typescript-model, react-component, nest-controller, express-route |
      | category    | express-route, nest-controller, react-component, vue-component, typescript-model |

  @pagination
  Scenario: Paginate large generator lists
    Given 50 generators exist in "_templates"
    When I run "unjucks list --limit 10"
    Then I should see exactly 10 generators
    And I should see pagination information:
      | Showing 1-10 of 50 generators |
    When I run "unjucks list --limit 10 --offset 10"
    Then I should see generators 11-20
    And I should see pagination information:
      | Showing 11-20 of 50 generators |

  @color-output
  Scenario: Colored output for better readability
    When I run "unjucks list --color"
    Then generator names should be displayed in color
    And descriptions should be displayed in a different color
    And the output should be more visually appealing

  @no-color-output
  Scenario: Disable colored output
    When I run "unjucks list --no-color"
    Then the output should not contain ANSI color codes
    And the output should be plain text

  @empty-state
  Scenario: Handle empty generator list gracefully
    Given no generators exist in "_templates"
    When I run "unjucks list"
    Then I should see "No generators found"
    And I should see suggestions for creating generators
    And the exit code should be 0

  @custom-templates-directory
  Scenario: List generators from custom templates directory
    Given generators exist in "custom-templates" directory:
      | name      |
      | custom-a  |
      | custom-b  |
    When I run "unjucks list --templates-dir custom-templates"
    Then I should see generators from the custom directory:
      | custom-a |
      | custom-b |

  @multiple-templates-directories
  Scenario: List generators from multiple templates directories
    Given generators exist in "_templates":
      | name      |
      | default-a |
    And generators exist in "shared-templates":
      | name      |
      | shared-a  |
    When I run "unjucks list --templates-dir _templates,shared-templates"
    Then I should see generators from both directories:
      | default-a |
      | shared-a  |
    And duplicate names should be handled appropriately

  @performance-listing
  Scenario: Performance with large number of generators
    Given 1000 generators exist in "_templates"
    When I run "unjucks list"
    Then the command should complete within 3 seconds
    And memory usage should remain reasonable
    And the output should be properly formatted