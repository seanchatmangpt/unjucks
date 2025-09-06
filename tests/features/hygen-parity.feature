Feature: Complete Hygen Parity and Compatibility
  As a developer migrating from Hygen
  I want Unjucks to support all Hygen features and command syntax
  So that I can migrate seamlessly without changing my workflows

  Background:
    Given I have a project with templates directory
    And I am in the project root directory

  @critical @hygen-parity @positional
  Scenario: Positional parameter syntax compatibility (Critical Gap)
    Given I have a "component" generator with "new" template:
      """
      ---
      to: "src/components/{{ name | pascalCase }}.jsx"
      ---
      import React from 'react';
      
      export const {{ name | pascalCase }} = () => {
        return <div>{{ name | pascalCase }} Component</div>;
      };
      
      export default {{ name | pascalCase }};
      """
    When I run "unjucks component new UserProfile"
    Then I should see "src/components/UserProfile.jsx" file generated
    And the file should contain "UserProfile Component"
    And the positional argument "UserProfile" should be mapped to the name variable

  @critical @hygen-parity @positional @multiple-args
  Scenario: Multiple positional arguments with type inference
    Given I have a template that expects multiple variables:
      """
      ---
      to: "src/{{ type }}/{{ name | pascalCase }}.ts"
      ---
      export class {{ name | pascalCase }} {
        type: '{{ type }}';
        enabled: {{ enabled }};
        count: {{ count }};
      }
      """
    When I run "unjucks component advanced UserService service true 42"
    Then the positional arguments should be mapped correctly:
      | Position | Value | Variable | Inferred Type |
      | 0 | UserService | name | string |
      | 1 | service | type | string |
      | 2 | true | enabled | boolean |
      | 3 | 42 | count | number |
    And I should see "src/service/UserService.ts" file generated
    And the file should contain all correctly typed values

  @critical @hygen-parity @cli-commands
  Scenario: Complete Hygen CLI command compatibility
    Given I have the standard Hygen directory structure:
      """
      _templates/
        component/
          new/
            component.jsx.t
          with-tests/
            component.jsx.t
            test.js.t
        generator/
          new/
            hello.js.t
      """
    When I run each Hygen-equivalent command:
      | Hygen Command | Unjucks Command | Expected Behavior |
      | hygen component new MyComp | unjucks component new MyComp | Generate component |
      | hygen component with-tests TestComp | unjucks component with-tests TestComp | Generate with tests |
      | hygen generator new myGen | unjucks generator new myGen | Generate generator |
      | hygen --help | unjucks --help | Show help |
      | hygen component --help | unjucks help component | Show generator help |
    Then all commands should work identically to Hygen
    And output format should match Hygen's style

  @critical @hygen-parity @frontmatter @all-options
  Scenario: Complete frontmatter compatibility (6 base + 4 Unjucks options)
    Given I have templates with all frontmatter options:
      """
      Hygen Standard Options (all 6):
      ---
      to: "src/{{ name }}.ts"
      inject: true
      after: "// Insert here"
      before: "// End marker"
      skip_if: "<%= name === 'skip' %>"
      sh: "echo 'Generated {{ name }}'"
      ---
      
      Unjucks Enhanced Options (additional 4):
      ---
      to: "src/{{ name }}.ts"
      append: true
      prepend: false
      lineAt: 10
      chmod: "755"
      ---
      """
    When I test each frontmatter option individually and in combination
    Then all 6 standard Hygen options should work identically:
      | Option | Hygen Syntax | Unjucks Syntax | Compatibility |
      | to | to: path/<%= name %>.js | to: "path/{{ name }}.ts" | ✅ Enhanced |
      | inject | inject: true | inject: true | ✅ Identical |
      | after | after: "marker" | after: "marker" | ✅ Identical |
      | before | before: "marker" | before: "marker" | ✅ Identical |
      | skip_if | skip_if: <%= condition %> | skipIf: "condition" | ✅ Enhanced |
      | sh | sh: "command" | sh: ["command"] | ✅ Enhanced |
    And all 4 Unjucks-unique options should work:
      | Option | Syntax | Behavior |
      | append | append: true | Append to file end |
      | prepend | prepend: true | Prepend to file start |
      | lineAt | lineAt: 10 | Insert at specific line |
      | chmod | chmod: "755" | Set file permissions |

  @critical @hygen-parity @template-syntax
  Scenario: Template syntax migration and compatibility
    Given I have Hygen templates with EJS syntax:
      """
      Hygen EJS Template:
      ---
      to: app/components/<%= name %>.js
      ---
      import React from 'react';
      
      <% if (withProps) { %>
      const propTypes = {
        <% props.forEach(function(prop) { %>
        <%= prop.name %>: <%= prop.type %>,
        <% }); %>
      };
      <% } %>
      
      export const <%= h.changeCase.pascalCase(name) %> = ({ 
        <% if (withProps) { %>
        <% props.forEach(function(prop, index) { %>
        <%= prop.name %><% if (index < props.length - 1) { %>, <% } %>
        <% }); %>
        <% } %>
      }) => {
        return (
          <div className="<%= h.changeCase.kebabCase(name) %>">
            <%= h.changeCase.titleCase(name) %> Component
          </div>
        );
      };
      """
    When I migrate this to Unjucks syntax:
      """
      Unjucks Nunjucks Template:
      ---
      to: "app/components/{{ name }}.js"
      ---
      import React from 'react';
      
      {% if withProps %}
      const propTypes = {
        {% for prop in props %}
        {{ prop.name }}: {{ prop.type }},
        {% endfor %}
      };
      {% endif %}
      
      export const {{ name | pascalCase }} = ({ 
        {% if withProps %}
        {% for prop in props %}
        {{ prop.name }}{% if not loop.last %}, {% endif %}
        {% endfor %}
        {% endif %}
      }) => {
        return (
          <div className="{{ name | kebabCase }}">
            {{ name | titleCase }} Component
          </div>
        );
      };
      """
    Then both templates should generate identical output
    And the migration should be straightforward with clear patterns

  @critical @hygen-parity @helpers
  Scenario: Hygen helper functions compatibility
    Given Hygen templates use helper functions:
      """
      Hygen helpers:
      - h.changeCase.pascalCase(str)
      - h.changeCase.camelCase(str)
      - h.changeCase.kebabCase(str)
      - h.changeCase.titleCase(str)
      - h.inflection.pluralize(str)
      - h.inflection.singularize(str)
      """
    And I have Unjucks equivalents:
      """
      Unjucks filters:
      - {{ str | pascalCase }}
      - {{ str | camelCase }}
      - {{ str | kebabCase }}
      - {{ str | titleCase }}
      - {{ str | pluralize }}
      - {{ str | singularize }}
      """
    When I test helper function equivalency:
      | Input | Hygen Helper | Unjucks Filter | Expected Output |
      | user_profile | h.changeCase.pascalCase | pascalCase | UserProfile |
      | UserProfile | h.changeCase.camelCase | camelCase | userProfile |
      | UserProfile | h.changeCase.kebabCase | kebabCase | user-profile |
      | user-profile | h.changeCase.titleCase | titleCase | User Profile |
      | user | h.inflection.pluralize | pluralize | users |
      | users | h.inflection.singularize | singularize | user |
    Then all outputs should be identical
    And Unjucks filters should provide the same functionality

  @critical @hygen-parity @configuration
  Scenario: Hygen configuration file compatibility
    Given I have a Hygen .hygen.js configuration:
      """
      module.exports = {
        templates: `${__dirname}/_templates`,
        helpers: {
          myHelper: (str) => str.toUpperCase(),
          anotherHelper: require('./my-helpers')
        }
      }
      """
    When I create an equivalent unjucks.config.ts:
      """
      export default {
        templates: "_templates",
        filters: {
          myFilter: (str: string) => str.toUpperCase(),
          anotherFilter: (str: string) => require('./my-helpers')(str)
        }
      }
      """
    Then both configurations should provide equivalent functionality
    And template resolution should work the same way
    And custom helpers/filters should work identically

  @critical @hygen-parity @workflow
  Scenario: Complete Hygen workflow compatibility
    Given I am migrating a complete Hygen project
    When I follow the migration workflow:
      """
      1. Install Unjucks: npm install -g unjucks
      2. Rename templates: .ejs.t → (remove extension, add frontmatter)
      3. Update syntax: EJS → Nunjucks
      4. Convert config: .hygen.js → unjucks.config.ts  
      5. Update commands: hygen → unjucks
      """
    Then all existing Hygen workflows should work with Unjucks
    And 95% of templates should migrate with minimal changes
    And enhanced Unjucks features should be immediately available

  @regression @hygen-parity @edge-cases
  Scenario: Hygen edge cases and compatibility issues
    Given I test various Hygen edge cases:
      | Edge Case | Hygen Behavior | Unjucks Behavior | Status |
      | Empty template variables | Renders as empty | Renders as empty | ✅ Compatible |
      | Undefined variables | Throws error | Throws error | ✅ Compatible |
      | Complex template paths | Supports | Enhanced support | ✅ Superior |
      | Binary file handling | Basic | Enhanced | ✅ Superior |
      | Large template files | Works | Optimized | ✅ Superior |
      | Concurrent generation | Not supported | Supported | ✅ Superior |
      | Error recovery | Basic | Advanced | ✅ Superior |
    Then Unjucks should handle all edge cases at least as well as Hygen
    And most cases should be handled better

  @performance @hygen-parity
  Scenario: Performance comparison with Hygen
    Given I have identical template operations in both systems
    When I run performance benchmarks:
      | Operation | Hygen Time | Unjucks Time | Improvement |
      | Cold start | 200ms | 150ms | 25% faster |
      | Template discovery | 100ms | 50ms | 50% faster |
      | Single file generation | 50ms | 30ms | 40% faster |
      | Multiple file generation | 500ms | 200ms | 60% faster |
      | Large template processing | 2s | 1.2s | 40% faster |
    Then Unjucks should outperform Hygen in all categories
    And memory usage should be lower
    And error handling should be faster

  @integration @hygen-parity @ecosystem
  Scenario: Hygen ecosystem and tooling compatibility
    Given the Hygen ecosystem includes:
      """
      - VS Code extensions
      - Template marketplaces  
      - CI/CD integrations
      - Build tool plugins
      """
    When I evaluate Unjucks compatibility:
      | Tool Type | Hygen Support | Unjucks Support | Notes |
      | VS Code extension | Available | Planned | Template syntax highlighting |
      | Template sharing | Limited | Enhanced | Built-in template discovery |
      | CI/CD integration | Manual | Automated | Better pipeline integration |
      | Build tools | Basic | Advanced | Webpack/Vite plugins |
    Then Unjucks should provide equal or better ecosystem support
    And migration paths should be clearly documented
    And existing Hygen tooling should work with minimal adaptation