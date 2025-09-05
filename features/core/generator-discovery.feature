@core @generator @discovery @smoke
Feature: Generator Discovery and Listing
  As a developer using Unjucks
  I want to discover and list available generators
  So that I can understand what code generation options are available

  Background:
    Given I have a clean test workspace
    And the following generators exist in "_templates":
      | name              | path                        | description                    |
      | react-component   | react-component/new.tsx.njk | React functional component     |
      | vue-component     | vue-component/new.vue.njk   | Vue.js single file component  |
      | express-route     | express-route/new.js.njk    | Express.js route handler       |
      | nest-controller   | nest-controller/new.ts.njk  | NestJS controller              |
      | typescript-model  | typescript-model/new.ts.njk | TypeScript data model          |

  @smoke @basic-listing
  Scenario: List all available generators
    When I run "unjucks list"
    Then I should see a list of generators:
      | express-route     |
      | nest-controller   |
      | react-component   |
      | typescript-model  |
      | vue-component     |
    And the generators should be sorted alphabetically
    And the exit code should be 0

  @detailed-listing
  Scenario: List generators with detailed information
    When I run "unjucks list --detailed"
    Then I should see detailed generator information:
      | Name              | Description                   |
      | react-component   | React functional component    |
      | vue-component     | Vue.js single file component |
      | express-route     | Express.js route handler      |
      | nest-controller   | NestJS controller             |
      | typescript-model  | TypeScript data model         |

  @json-format
  Scenario: Export generator list as JSON
    When I run "unjucks list --format json"
    Then the output should be valid JSON
    And the JSON should contain generator objects with properties:
      | name        |
      | description |
      | path        |
      | templates   |

  @empty-templates
  Scenario: Handle empty templates directory gracefully
    Given no generators exist in "_templates"
    When I run "unjucks list"
    Then I should see "No generators found in _templates directory"
    And I should see a suggestion to create generators
    And the exit code should be 0

  @discovery-performance
  Scenario: Discover generators efficiently with large template sets
    Given I have 50 generators in "_templates"
    When I run "unjucks list"
    Then the command should complete within 2 seconds
    And all 50 generators should be listed
    And memory usage should remain reasonable

  @custom-templates-directory
  Scenario: Discover generators from custom directory
    Given generators exist in "custom-templates" directory:
      | name      | path                 |
      | custom-a  | custom-a/new.ts.njk  |
      | custom-b  | custom-b/new.js.njk  |
    When I run "unjucks list --templates-dir custom-templates"
    Then I should see generators from the custom directory:
      | custom-a |
      | custom-b |

  @template-validation
  Scenario: Validate generator templates during discovery
    Given I have an invalid generator "broken-generator" with malformed template
    When I run "unjucks list"
    Then I should see a warning about the invalid generator
    And valid generators should still be listed
    And the exit code should be 0

  @nested-discovery
  Scenario: Discover generators in nested directories
    Given I have generators in nested structure:
      | components/react/component/new.tsx.njk |
      | components/vue/component/new.vue.njk   |
      | api/routes/route/new.js.njk            |
    When I run "unjucks list"
    Then I should see nested generators:
      | components-react-component |
      | components-vue-component   |
      | api-routes-route           |

  @generator-metadata
  Scenario: Display generator metadata from frontmatter
    Given I have a generator "with-metadata" with frontmatter:
      """
      ---
      name: "Advanced React Component"
      description: "React component with TypeScript and tests"
      author: "Development Team"
      version: "1.0.0"
      tags: ["react", "typescript", "testing"]
      ---
      // Template content here
      """
    When I run "unjucks list --detailed"
    Then I should see the metadata for "with-metadata":
      | Name        | Advanced React Component              |
      | Description | React component with TypeScript and tests |
      | Author      | Development Team                      |
      | Version     | 1.0.0                                |
      | Tags        | react, typescript, testing           |