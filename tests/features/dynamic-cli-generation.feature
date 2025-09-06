Feature: Dynamic CLI Generation and Type Inference
  As a developer using Unjucks
  I want the CLI to automatically generate flags from template variables
  So that I get type-safe, discoverable command interfaces

  Background:
    Given I have a project with templates directory
    And I am in the project root directory

  @critical @cli @dynamic
  Scenario: Automatic flag generation from template variables
    Given I have a template with variables:
      """
      ---
      to: "src/{{ name }}.ts"
      ---
      export class {{ name | pascalCase }} {
        private {{ type }}: {{ dataType }} = {{ defaultValue }};
        public {{ isEnabled }}: boolean = {{ withTests }};
        public {{ category }}: string = '{{ category }}';
      }
      """
    When I run "unjucks help test variable-scan"
    Then the help output should show automatically generated flags:
      | Flag | Type | Description |
      | --name | string | Name for the component |
      | --type | string | Type of the component |
      | --dataType | string | Data type to use |
      | --defaultValue | string | Default value |
      | --isEnabled | boolean | Enable flag |
      | --withTests | boolean | Include tests |
      | --category | string | Category classification |

  @critical @cli @type-inference
  Scenario: Type inference from variable usage patterns
    Given I have a template with typed variables:
      """
      ---
      to: "src/{{ name }}.ts"
      ---
      export const config = {
        name: '{{ name }}',
        count: {{ count || 0 }},
        enabled: {{ enabled || false }},
        tags: [{{ tags | join(', ') }}],
        version: {{ version | int }}
      };
      """
    When I run "unjucks help test type-inference"
    Then the CLI should infer types:
      | Variable | Inferred Type | Reason |
      | name | string | String literal usage |
      | count | number | Numeric default (0) |
      | enabled | boolean | Boolean default (false) |
      | tags | array | Array join filter |
      | version | number | int filter usage |

  @critical @cli @interactive
  Scenario: Interactive prompts for missing required variables
    Given I have a template with required variables:
      """
      ---
      to: "src/{{ name }}.ts"
      ---
      export class {{ name | pascalCase }} {
        category: '{{ category }}' = '{{ category }}';
        {% if withDatabase %}
        database: '{{ databaseType }}';
        {% endif %}
      }
      """
    When I run "unjucks generate test interactive" without providing variables
    Then I should be prompted for "name" (required)
    And I should be prompted for "category" (required)
    And I should be asked "Include database support?" (boolean prompt for withDatabase)
    When I answer "yes" to database support
    Then I should be prompted for "databaseType"
    And the final command should be constructed correctly

  @critical @cli @validation
  Scenario: Smart validation based on variable patterns
    Given I have a template with constrained variables:
      """
      ---
      to: "src/{{ name }}.ts"
      ---
      export class {{ name | pascalCase }} {
        type: '{{ type }}', // Must be: 'component' | 'service' | 'util'
        port: {{ port }}, // Must be number between 1000-9999
        email: '{{ email }}' // Must be valid email format
      }
      """
    When I run "unjucks generate test validation --name=test --type=invalid --port=99 --email=notanemail"
    Then I should see validation errors:
      | Field | Error |
      | type | Must be one of: component, service, util |
      | port | Must be between 1000 and 9999 |
      | email | Must be a valid email address |
    When I run "unjucks generate test validation --name=test --type=component --port=3000 --email=test@example.com"
    Then the validation should pass
    And the file should be generated successfully

  @critical @cli @advanced-help
  Scenario: Enhanced help system with examples and variable descriptions
    Given I have a well-documented template:
      """
      ---
      to: "src/{{ name }}.ts"
      # Variable descriptions for help generation
      # name: The component name (PascalCase will be applied)
      # withTests: Generate accompanying test files
      # category: Component category (ui|business|data)
      ---
      export class {{ name | pascalCase }} {}
      {% if withTests %}
      // Tests will be generated
      {% endif %}
      """
    When I run "unjucks help test documented"
    Then the help output should include:
      """
      Generate test/documented template

      Options:
        --name <string>      The component name (PascalCase will be applied)
        --withTests          Generate accompanying test files (default: false)
        --category <string>  Component category (ui|business|data)

      Examples:
        unjucks generate test documented --name=UserProfile --withTests --category=ui
        unjucks generate test documented --name=ApiService --category=business
      """

  @critical @cli @subcommands
  Scenario: Dynamic subcommand discovery from template structure
    Given I have a template structure:
      """
      _templates/
        component/
          basic/
          advanced/
          with-tests/
        service/
          api/
          database/
        util/
          helper/
      """
    When I run "unjucks list"
    Then I should see hierarchical command structure:
      """
      Available generators:
      
      component
        ├── basic        - Generate basic component
        ├── advanced     - Generate advanced component
        └── with-tests   - Generate component with tests
      
      service  
        ├── api         - Generate API service
        └── database    - Generate database service
        
      util
        └── helper      - Generate utility helper
      """

  @critical @cli @config-integration
  Scenario: CLI generation respects configuration file
    Given I have an unjucks.config.ts file:
      """
      export default {
        templates: {
          defaultValues: {
            author: 'John Doe',
            license: 'MIT'
          },
          validation: {
            name: /^[A-Za-z][A-Za-z0-9]*$/,
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          }
        }
      }
      """
    And I have a template:
      """
      ---
      to: "src/{{ name }}.ts"
      ---
      /**
       * @author {{ author }}
       * @license {{ license }}
       */
      export class {{ name | pascalCase }} {}
      """
    When I run "unjucks help test config"
    Then the help should show default values from config
    And validation rules should be applied from config
    When I run "unjucks generate test config --name=validName"
    Then the author and license should be auto-filled from config

  @performance @cli
  Scenario: Fast CLI parsing and help generation
    Given I have 50 different templates with complex variable patterns
    When I run "unjucks help" to show all available commands
    Then the help generation should complete in under 100ms
    And variable scanning should be cached
    And subsequent help calls should be even faster

  @regression @cli @error-handling
  Scenario: Graceful handling of malformed templates during CLI generation
    Given I have a template with syntax errors:
      """
      ---
      to: "src/{{ name }}.ts"
      ---
      export class {{ unclosedVariable {
        // Broken template
      }
      """
    When I run "unjucks help test malformed"
    Then I should see a clear error message
    And the error should indicate the template file and issue
    And other valid templates should still be usable

  @integration @cli @git-integration
  Scenario: CLI integration with git hooks and CI/CD
    Given I have templates that integrate with git
    When I run generation commands
    Then git status should be checked before operations
    And generated files should be properly staged if requested
    And commit messages should be auto-generated based on templates used