Feature: Template Variable Extraction and Processing
  As a developer using Unjucks templates
  I want variables to be automatically detected and processed
  So that I can generate dynamic content with user input

  Background:
    Given the Unjucks template system is initialized

  Scenario: Extract simple variables from template content
    Given a template with content "export class {{ className }} extends {{ baseClass }}"
    When I parse the template variables
    Then I should detect variables ["className", "baseClass"]
    And CLI should prompt for these variables

  Scenario: Extract variables from template filenames
    Given a template file named "{{ componentName }}.component.ts"
    When I parse the template filename
    Then I should detect variables ["componentName"]
    And the output filename should use the variable value

  Scenario: Extract variables from nested paths
    Given a template path "src/{{ moduleName }}/{{ componentType }}/{{ fileName }}.ts"
    When I parse the template path
    Then I should detect variables ["moduleName", "componentType", "fileName"]
    And the output path should be dynamically generated

  Scenario: Handle duplicate variables across files
    Given multiple templates with variable "{{ projectName }}"
    When I parse all templates in a generator
    Then I should detect "projectName" only once
    And CLI should prompt for it only once

  Scenario: Extract variables with different delimiters
    Given a template with content "class {{ className }} { /* ${comment} */ }"
    When I parse the template variables
    Then I should detect only variables with Nunjucks delimiters ["className"]
    And I should ignore non-Nunjucks syntax like "${comment}"

  Scenario: Handle complex variable expressions
    Given a template with content "{{ user.name | upperFirst }} in {{ app.config.name }}"
    When I parse the template variables
    Then I should detect root variables ["user", "app"]
    And I should preserve the full expressions for rendering

  Scenario: Extract variables from conditional blocks
    Given a template with content:
      """
      {% if withAuth %}
      export const auth = {{ authConfig }};
      {% endif %}
      """
    When I parse the template variables
    Then I should detect variables ["withAuth", "authConfig"]
    And boolean variables should have appropriate CLI types

  Scenario: Handle array iteration variables
    Given a template with content:
      """
      {% for item in items %}
      - {{ item.name }}: {{ item.value }}
      {% endfor %}
      """
    When I parse the template variables
    Then I should detect variables ["items"]
    And array variables should be handled appropriately

  Scenario: Variable type inference
    Given a template with variables:
      | Variable       | Usage                    | Inferred Type |
      | isEnabled      | {% if isEnabled %}       | boolean       |
      | count          | repeat {{ count }} times | number        |
      | items          | {% for item in items %}  | array         |
      | config         | {{ config.name }}        | object        |
      | title          | <h1>{{ title }}</h1>     | string        |
    When I parse the template variables
    Then variables should be inferred with correct types
    And CLI prompts should use appropriate input types

  Scenario: Handle malformed variable syntax
    Given a template with content "{{ unclosedVariable and {{ duplicateStart }} }}"
    When I parse the template variables
    Then I should detect valid variables only
    And malformed syntax should be reported as warnings

  Scenario: Variable name validation
    Given a template with variables:
      | Variable          | Valid |
      | validName         | true  |
      | valid-kebab       | true  |
      | valid_underscore  | true  |
      | 123invalid        | false |
      | invalid spaces    | false |
      | invalid.dot       | false |
    When I validate variable names
    Then invalid variable names should be rejected
    And appropriate error messages should be shown

  Scenario: Deep object variable extraction
    Given a template with content "{{ config.database.host }}:{{ config.database.port }}"
    When I parse the template variables
    Then I should detect root variable ["config"]
    And nested paths should be preserved for rendering

  Scenario: Variable default values
    Given a template with content "{{ name | default('DefaultName') }}"
    When I parse the template variables
    Then I should detect variables ["name"]
    And default values should be extracted for CLI prompts

  Scenario: Environment variable integration
    Given a template with content "{{ process.env.NODE_ENV | default('development') }}"
    When I parse the template variables
    Then environment variables should be handled specially
    And should not require CLI prompts if available

  Scenario: Variable scoping in includes
    Given a main template that includes "{{ include 'partial.njk' }}"
    And the partial template has variables "{{ partialVar }}"
    When I parse all template variables
    Then variables from included templates should be detected
    And variable scope should be properly maintained