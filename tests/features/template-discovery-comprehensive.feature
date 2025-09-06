Feature: Comprehensive Template Discovery
  As a developer using Unjucks
  I want reliable template discovery across all directory structures
  So that all my generators are properly detected and usable

  Background:
    Given I am in a test environment
    And the CLI is built and ready

  Scenario Outline: Discovery of nested template structures
    Given I have a template structure:
      """
      _templates/
      ├── <generator>/
      │   ├── <template>/
      │   │   ├── index.js
      │   │   ├── <file>.js.njk
      │   │   └── <subdir>/
      │   │       └── <nested>.ts.njk
      │   └── <template2>/
      │       └── simple.js.njk
      └── <generator2>/
          └── <template3>/
              └── component.tsx.njk
      """
    When I run "unjucks list"
    Then I should see generator "<generator>" with templates "<template>, <template2>"
    And I should see generator "<generator2>" with templates "<template3>"
    And the discovery should complete in under 100ms

    Examples:
      | generator | template | file     | subdir | nested | template2 | generator2 | template3 |
      | command   | citty    | command  | types  | defs   | simple    | component  | react     |
      | service   | api      | service  | models | schema | crud      | page       | next      |
      | model     | prisma   | model    | migrations | init | seed   | hook       | use       |

  Scenario: Discovery with mixed directory structures
    Given I have templates in mixed structures:
      | path                                    | type      |
      | _templates/command/citty/index.js      | file      |
      | _templates/command/citty/command.ts.njk| template  |
      | _templates/component/                   | directory |
      | _templates/component/react/            | directory |
      | _templates/component/react/comp.tsx.njk| template  |
      | _templates/service/api/service.js.njk  | template  |
      | _templates/docs/readme/README.md.njk   | template  |
    When I discover templates
    Then I should find 4 generators
    And generator "command" should have 1 template
    And generator "component" should have 1 template
    And generator "service" should have 1 template
    And generator "docs" should have 1 template

  Scenario: Performance validation for large template sets
    Given I have 50 generators with 200 templates total
    When I run template discovery
    Then discovery should complete in under 500ms
    And memory usage should not exceed 50MB
    And all templates should be discovered correctly
    And the results should be cached for subsequent calls

  Scenario: Template variable extraction accuracy
    Given I have a template with complex variables:
      """
      ---
      to: src/commands/<%= name %>.ts
      inject: <%= inject || false %>
      skipIf: <%= name === 'base' %>
      ---
      import { Command } from '<%= framework %>';
      
      export class <%= h.capitalize(name) %>Command extends Command {
        description = '<%= description || "Generated command" %>';
        
        <% if (withValidation) { %>
        validate() {
          // validation logic
        }
        <% } %>
      }
      """
    When I extract variables from this template
    Then I should find variables: "name", "inject", "framework", "description", "withValidation"
    And variable "name" should be required (used in frontmatter path)
    And variable "inject" should be optional with default false
    And variable "withValidation" should be boolean type

  Scenario: Error handling for malformed templates
    Given I have templates with various issues:
      | issue                    | file                  |
      | Missing frontmatter      | no-frontmatter.njk    |
      | Invalid YAML frontmatter | invalid-yaml.njk      |
      | Syntax errors in template| syntax-error.njk      |
      | Missing file extension   | no-extension          |
    When I discover templates
    Then discovery should not fail
    And I should get warnings for problematic templates
    And valid templates should still be discoverable
    And the error messages should be descriptive

  Scenario: Template caching and invalidation
    Given I have discovered templates
    When I modify a template file
    Then the cache should be invalidated
    And rediscovery should pick up the changes
    When I add new templates
    Then they should be discovered on next run
    When I delete templates
    Then they should not appear in discovery results