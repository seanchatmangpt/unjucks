@generator @selection @cli @interactive
Feature: Generator Selection
  As a developer
  I want to select generators via CLI commands and interactive prompts
  So that I can easily choose the right generator for my needs

  Background:
    Given the unjucks system is initialized
    And the following generators exist in "_templates":
      | name              | description                    | variables           | category  |
      | react-component   | React functional component     | name, withProps     | frontend  |
      | vue-component     | Vue.js component template      | name, withScript    | frontend  |
      | express-route     | Express.js route handler       | path, method        | backend   |
      | nest-controller   | NestJS controller              | name, withService   | backend   |
      | typescript-model  | TypeScript data model          | name, withValidation| shared    |

  @direct-selection
  Scenario: Select generator by exact name
    When I run "unjucks generate react-component"
    Then the "react-component" generator should be selected
    And I should be prompted for the required variables:
      | name      |
      | withProps |
    And the exit code should be 0

  @case-insensitive-selection
  Scenario: Select generator with case-insensitive matching
    When I run "unjucks generate REACT-COMPONENT"
    Then the "react-component" generator should be selected
    And the generation process should continue normally

  @partial-name-selection
  Scenario: Select generator by partial name match
    When I run "unjucks generate react"
    Then the "react-component" generator should be selected
    And I should be prompted for variables

  @ambiguous-partial-selection
  Scenario: Handle ambiguous partial name matches
    Given generators with similar names exist:
      | name                |
      | react-component     |
      | react-hook          |
      | react-context       |
    When I run "unjucks generate react"
    Then I should see a disambiguation menu:
      | 1. react-component  |
      | 2. react-hook       |
      | 3. react-context    |
    And I should be prompted to select a number
    When I select "1"
    Then the "react-component" generator should be selected

  @interactive-selection
  Scenario: Interactive generator selection menu
    When I run "unjucks generate"
    Then I should see an interactive menu of all generators:
      | ❯ express-route     - Express.js route handler       |
      |   nest-controller   - NestJS controller              |
      |   react-component   - React functional component     |
      |   typescript-model  - TypeScript data model          |
      |   vue-component     - Vue.js component template      |
    When I navigate to "react-component" and select it
    Then the "react-component" generator should be selected

  @category-selection
  Scenario: Select generator by category
    When I run "unjucks generate --category frontend"
    Then I should see only frontend generators in the selection menu:
      | ❯ react-component   - React functional component     |
      |   vue-component     - Vue.js component template      |
    When I select "react-component"
    Then the "react-component" generator should be selected

  @fuzzy-search-selection
  Scenario: Fuzzy search in interactive selection
    When I run "unjucks generate"
    And I type "rcmp" in the interactive search
    Then I should see filtered results:
      | ❯ react-component   |
    And I can select the filtered result

  @search-filtering
  Scenario: Filter generators during interactive selection
    When I run "unjucks generate"
    And I press "/" to enter search mode
    And I type "component"
    Then I should see only component generators:
      | ❯ react-component   |
      |   vue-component     |
    When I clear the search
    Then I should see all generators again

  @generator-preview
  Scenario: Preview generator information during selection
    When I run "unjucks generate"
    And I highlight "react-component"
    Then I should see a preview panel showing:
      | Description: React functional component |
      | Variables: name, withProps             |
      | Templates: 2 files                     |
      | Path: _templates/react-component       |

  @keyboard-navigation
  Scenario: Navigate selection menu with keyboard
    When I run "unjucks generate"
    Then I can navigate the menu using:
      | Key         | Action                |
      | ↑ / k       | Move up               |
      | ↓ / j       | Move down             |
      | Enter       | Select generator      |
      | Esc / q     | Exit selection        |
      | /           | Enter search mode     |
      | ?           | Show help             |

  @invalid-generator-selection
  Scenario: Handle invalid generator name
    When I run "unjucks generate non-existent-generator"
    Then I should see an error message "Generator 'non-existent-generator' not found"
    And I should see suggestions for similar generators:
      | Did you mean: |
      | - react-component |
      | - vue-component   |
    And the exit code should be 1

  @recent-selections
  Scenario: Show recently used generators first
    Given I have previously used generators:
      | name              | last_used  |
      | typescript-model  | 1 hour ago |
      | react-component   | 1 day ago  |
    When I run "unjucks generate"
    Then recently used generators should appear at the top:
      | ❯ typescript-model  ⭐ (Recent)          |
      |   react-component   ⭐ (Recent)          |
      |   express-route                          |
      |   nest-controller                        |
      |   vue-component                          |

  @favorite-generators
  Scenario: Mark and display favorite generators
    Given I have marked "react-component" as favorite
    When I run "unjucks generate"
    Then favorite generators should be highlighted:
      | ❯ react-component   ❤️ (Favorite)       |
      |   express-route                          |
      |   nest-controller                        |
    When I run "unjucks generate --favorites-only"
    Then I should see only favorite generators

  @generator-statistics
  Scenario: Display usage statistics for generators
    Given generators have usage statistics:
      | name              | usage_count |
      | react-component   | 25          |
      | typescript-model  | 12          |
      | express-route     | 8           |
    When I run "unjucks generate --show-stats"
    Then I should see usage statistics in the selection menu:
      | ❯ react-component   (used 25 times)     |
      |   typescript-model  (used 12 times)     |
      |   express-route     (used 8 times)      |

  @multi-select-mode
  Scenario: Select multiple generators for batch generation
    When I run "unjucks generate --multi-select"
    Then I should see a multi-selection interface:
      | ☐ express-route                          |
      | ☐ nest-controller                        |
      | ☑ react-component   (selected)          |
      | ☐ typescript-model                       |
      | ☑ vue-component     (selected)          |
    When I confirm the selection
    Then both "react-component" and "vue-component" should be queued for generation

  @generator-dependencies
  Scenario: Handle generators with dependencies
    Given "react-component" depends on "typescript-model"
    When I run "unjucks generate react-component"
    Then I should see a dependency notification:
      | This generator depends on: typescript-model |
      | Generate dependencies first? (Y/n)          |
    When I confirm with "Y"
    Then both generators should be selected for generation

  @selection-history
  Scenario: Navigate selection history
    Given I have a selection history:
      | react-component   |
      | typescript-model  |
      | express-route     |
    When I run "unjucks generate --history"
    Then I should see my selection history:
      | 1. react-component   (2 hours ago)      |
      | 2. typescript-model  (1 day ago)        |
      | 3. express-route     (3 days ago)       |
    When I select "1"
    Then "react-component" should be selected

  @context-aware-selection
  Scenario: Context-aware generator suggestions
    Given I am in a React project (package.json contains "react")
    When I run "unjucks generate"
    Then React-related generators should be prioritized:
      | ❯ react-component   🎯 (Recommended)     |
      |   vue-component                          |
      |   typescript-model                       |
      |   express-route                          |

  @workspace-filtering
  Scenario: Filter generators based on workspace type
    Given the current workspace is detected as "Node.js/Express"
    When I run "unjucks generate --workspace-relevant"
    Then I should see only relevant generators:
      | ❯ express-route                          |
      |   nest-controller                        |
      |   typescript-model                       |
    And frontend-only generators should be hidden

  @selection-with-presets
  Scenario: Select generator with predefined variable presets
    Given "react-component" has presets:
      | name          | variables                    |
      | basic         | withProps=false              |
      | with-props    | withProps=true               |
      | full-featured | withProps=true, withTests=true|
    When I run "unjucks generate react-component --preset with-props"
    Then the generator should be selected with preset variables applied
    And I should not be prompted for "withProps"