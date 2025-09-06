@cli @positional @hygen-parity
Feature: Positional Parameter Implementation
  As a developer migrating from Hygen
  I want to use positional parameters in CLI commands
  So that I can maintain familiar command syntax

  Background:
    Given I set up a temporary test environment
    And I create a basic component generator with template:
      """
      ---
      to: "src/components/{{ name | pascalCase }}.ts"
      ---
      export interface {{ name | pascalCase }}Props {
        id?: string;
        className?: string;
        {% if withTests %}testId?: string;{% endif %}
      }

      export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({
        id,
        className,
        {% if withTests %}testId,{% endif %}
      }) => {
        return (
          <div 
            id={id}
            className={className}
            {% if withTests %}data-testid={testId}{% endif %}
          >
            {{ name | pascalCase }} Component
          </div>
        );
      };
      """

  @critical @positional-basic
  Scenario: Basic positional parameter syntax works like Hygen
    When I run "unjucks generate component new MyComponent"
    Then the result should be successful
    And the file "src/components/MyComponent.ts" should exist
    And the file content should contain "export interface MyComponentProps"
    And the file content should contain "export const MyComponent"

  @positional-with-flags
  Scenario: Positional parameters combined with flags
    When I run "unjucks generate component new UserProfile --withTests"
    Then the result should be successful
    And the file "src/components/UserProfile.ts" should exist
    And the file content should contain "testId?: string"
    And the file content should contain "data-testid={testId}"

  @positional-multiple
  Scenario: Multiple positional parameters with smart type inference
    Given I create a generator "api/endpoint" with template:
      """
      ---
      to: "src/api/{{ entityName | kebabCase }}.ts"
      ---
      export const {{ entityName | camelCase }}Api = {
        baseUrl: '{{ baseUrl }}',
        version: {{ apiVersion }},
        authenticated: {{ requireAuth }},
      };
      """
    When I run "unjucks generate api endpoint User https://api.example.com 2 true"
    Then the result should be successful
    And the file "src/api/user.ts" should exist
    And the file content should contain "baseUrl: 'https://api.example.com'"
    And the file content should contain "version: 2"
    And the file content should contain "authenticated: true"

  @backward-compatibility
  Scenario: Backward compatibility with flag-based syntax
    When I run "unjucks generate component new --name MyComponent --withTests true"
    Then the result should be successful
    And the file "src/components/MyComponent.ts" should exist
    And the file content should contain "testId?: string"

  @mixed-syntax
  Scenario: Mixed positional and flag syntax
    When I run "unjucks generate component new Dashboard --withTests --className dashboard-main"
    Then the result should be successful
    And the file "src/components/Dashboard.ts" should exist
    And the file content should contain "testId?: string"

  @error-handling
  Scenario: Error handling for insufficient positional arguments
    When I run "unjucks generate component"
    Then the result should fail
    And the output should contain "Missing required generator name"

  @error-handling
  Scenario: Error handling for invalid generator/template combination
    When I run "unjucks generate nonexistent template ComponentName"
    Then the result should fail
    And the output should contain "Generator 'nonexistent' not found"

  @interactive-fallback
  Scenario: Interactive prompts for missing required variables
    Given I create a generator "model/entity" with template requiring "tableName":
      """
      ---
      to: "src/models/{{ name | pascalCase }}.ts"
      ---
      export class {{ name | pascalCase }} {
        static tableName = '{{ tableName }}';
      }
      """
    When I run "unjucks generate model entity User" with interactive input:
      | prompt            | response     |
      | Table name:       | users        |
    Then the result should be successful
    And the file "src/models/User.ts" should exist
    And the file content should contain "static tableName = 'users'"

  @performance @benchmark
  Scenario: Positional parameter parsing performance
    Given I have 20 template variables defined
    When I run "unjucks generate complex template Component arg1 arg2 arg3 arg4 arg5 arg6 arg7 arg8 arg9 arg10"
    Then the command should complete in less than 500 milliseconds
    And the result should be successful

  @hygen-migration
  Scenario: Direct Hygen command translation
    # Original Hygen: hygen component new MyButton
    # Unjucks equivalent: unjucks generate component new MyButton
    When I run "unjucks generate component new MyButton"
    Then the result should be successful
    And I run "unjucks generate component new AnotherButton --withTests"
    Then the result should be successful
    And I should see 2 files created

  @validation @type-inference
  Scenario: Smart type inference for positional arguments
    Given I create a generator "config/settings" with template:
      """
      ---
      to: "config/{{ environment }}.json"
      ---
      {
        "port": {{ port }},
        "debug": {{ debugMode }},
        "apiKey": "{{ apiKey }}"
      }
      """
    When I run "unjucks generate config settings development 3000 true abc123"
    Then the result should be successful
    And the file "config/development.json" should exist
    And the file content should contain '"port": 3000'
    And the file content should contain '"debug": true'
    And the file content should contain '"apiKey": "abc123"'

  @edge-cases
  Scenario: Edge case - empty positional arguments
    When I run "unjucks generate component new \"\""
    Then the result should fail
    And the output should contain "Component name cannot be empty"

  @edge-cases  
  Scenario: Edge case - special characters in positional arguments
    When I run "unjucks generate component new My-Super_Component$123"
    Then the result should be successful
    And the file should be created with safe filename

  @dry-run
  Scenario: Dry run with positional parameters
    When I run "unjucks generate component new PreviewComponent --dry"
    Then the result should be successful
    And the output should contain "Dry run - no files were created"
    And the output should contain "src/components/PreviewComponent.ts"
    And the file "src/components/PreviewComponent.ts" should not exist