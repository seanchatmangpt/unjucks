@migration @hygen-compatibility @regression
Feature: Hygen Migration Compatibility
  As a developer migrating from Hygen
  I want seamless compatibility with existing Hygen workflows
  So that migration is effortless and maintains productivity

  Background:
    Given I set up a temporary test environment
    And I create a complete Hygen-style generator structure:
      """
      _templates/
      ├── component/
      │   ├── new/
      │   │   ├── component.ejs.t
      │   │   └── test.ejs.t
      ├── reducer/
      │   └── add/
      │       └── reducer.ejs.t
      └── generator/
          └── help/
              └── index.ejs.t
      """

  @migration-syntax
  Scenario: Hygen command syntax compatibility matrix
    Given I have these Hygen commands that should work in Unjucks:
      | hygen_command                    | unjucks_equivalent                         |
      | hygen component new MyComponent  | unjucks generate component new MyComponent |
      | hygen reducer add MyReducer      | unjucks generate reducer add MyReducer     |
      | hygen generator help MyGen       | unjucks generate generator help MyGen      |
    When I test each command conversion
    Then all conversions should succeed
    And generated files should match expected structure

  @template-conversion  
  Scenario: EJS to Nunjucks template conversion
    Given I have a Hygen EJS template:
      """
      ---
      to: src/components/<%= name %>.jsx
      ---
      import React from 'react';
      
      const <%= name %> = () => {
        return <div><%= name %> Component</div>;
      };
      
      export default <%= name %>;
      """
    When I convert it to Unjucks syntax:
      """
      ---
      to: "src/components/{{ name }}.jsx"
      ---
      import React from 'react';
      
      const {{ name }} = () => {
        return <div>{{ name }} Component</div>;
      };
      
      export default {{ name }};
      """
    And I run "unjucks generate component new TestComponent"
    Then the result should be successful
    And the generated file should match Hygen output

  @frontmatter-compatibility
  Scenario: Complete frontmatter compatibility with Hygen
    Given I create a template with all Hygen frontmatter features:
      """
      ---
      to: "src/components/{{ name | pascalCase }}.ts"
      inject: true
      after: "// Components"
      skip_if: "name === 'Base'"
      sh: "echo 'Generated {{ name }}'"
      ---
      export const {{ name | pascalCase }} = () => {
        return <div>{{ name }}</div>;
      };
      """
    When I run "unjucks generate component new UserProfile"
    Then the result should be successful
    And the shell command should execute
    And injection should work correctly

  @enhanced-frontmatter
  Scenario: Unjucks enhanced frontmatter beyond Hygen
    Given I create a template with Unjucks-exclusive frontmatter:
      """
      ---
      to: "src/utils/{{ name | kebabCase }}.ts"
      append: true
      prepend: false
      lineAt: 10
      chmod: "755"
      skipIf: "name == 'test'"
      sh: ["npm run format", "echo 'Done'"]
      ---
      export const {{ name | camelCase }}Util = {
        name: '{{ name }}',
        version: '1.0.0'
      };
      """
    When I run "unjucks generate util new HelperUtil"
    Then the result should be successful
    And the file permissions should be set to 755
    And both shell commands should execute
    And content should be appended correctly

  @performance-comparison
  Scenario: Performance comparison with Hygen benchmarks
    Given I have identical templates in both Hygen and Unjucks format
    When I benchmark "unjucks generate component new PerfTest"
    Then the cold start should be under 150ms (25% faster than Hygen's 200ms)
    And template processing should be under 30ms (40% faster than Hygen's 50ms)
    And file operations should be under 15ms (25% faster than Hygen's 20ms)
    And memory usage should be under 20MB (20% less than Hygen's 25MB)

  @migration-tooling
  Scenario: Migration helper command
    Given I have existing Hygen templates in "_templates" directory
    When I run "unjucks migrate --from hygen --dry"
    Then I should see a migration plan
    And it should identify EJS syntax to convert
    And it should show compatibility warnings
    When I run "unjucks migrate --from hygen"
    Then templates should be converted automatically
    And original templates should be backed up

  @workflow-compatibility
  Scenario: Hygen workflow patterns work in Unjucks
    Given I have a complex Hygen workflow:
      """
      # Create component with test and story
      hygen component new Button
      hygen component test Button  
      hygen component story Button
      """
    When I convert to Unjucks workflow:
      """
      unjucks generate component new Button
      unjucks generate component test Button
      unjucks generate component story Button
      """
    Then all commands should execute successfully
    And generated files should maintain relationships
    And file structure should match Hygen output

  @error-compatibility
  Scenario: Error handling matches Hygen behavior
    When I run invalid commands in both systems:
      | command                           | expected_behavior           |
      | unjucks generate nonexistent new | Same error as Hygen         |
      | unjucks generate component       | Same error as Hygen         |
      | unjucks generate                 | Same error as Hygen         |
    Then error messages should be equivalent or better
    And exit codes should match

  @variable-compatibility
  Scenario: Variable handling compatibility
    Given I create a template with complex variable usage:
      """
      ---
      to: "src/{{ name | kebabCase }}/{{ name | pascalCase }}.ts"
      ---
      export class {{ name | pascalCase }} {
        constructor(
          {% if withOptions %}
          public options: {{ name | pascalCase }}Options
          {% endif %}
        ) {}
        
        {% if withMethods %}
        public method(): string {
          return '{{ name | lowercase }}';
        }
        {% endif %}
      }
      """
    When I run "unjucks generate class new UserService --withOptions --withMethods"
    Then variable interpolation should work correctly
    And conditional blocks should render properly
    And filters should apply correctly

  @config-compatibility
  Scenario: Configuration file compatibility
    Given I have a Hygen .hygen.js config:
      """
      module.exports = {
        templates: '_templates',
        helpers: {
          customHelper: (str) => str.toUpperCase()
        }
      }
      """
    When I convert to unjucks.config.ts:
      """
      export default {
        templatesDir: '_templates',
        filters: {
          customHelper: (str) => str.toUpperCase()
        }
      }
      """
    Then configuration should work equivalently
    And custom helpers/filters should function identically

  @regression-prevention
  Scenario: Migration regression testing
    Given I have a comprehensive Hygen project
    When I migrate to Unjucks
    Then I run the full migration test suite
    And all existing functionality should work
    And no regressions should be introduced
    And performance should improve as claimed