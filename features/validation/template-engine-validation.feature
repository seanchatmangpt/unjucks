@template-engine @validation @comprehensive
Feature: HYGEN-DELTA Template Engine Validation
  As a developer using Unjucks
  I want to validate all template engine claims in HYGEN-DELTA.md  
  So that I can verify Nunjucks superiority over EJS

  Background:
    Given I have a clean test workspace
    And the Unjucks CLI is available

  @nunjucks-vs-ejs @validation
  Scenario: Nunjucks provides superior features over EJS
    Given I have equivalent templates in both engines
    When I compare capabilities:
      | Feature              | EJS          | Nunjucks     | Advantage        |
      | Template inheritance | Not built-in | Built-in     | Better structure |
      | Macros              | Not built-in | Built-in     | Reusable code    |
      | Async support       | Limited      | Native       | Better performance|
      | Error handling      | Basic        | Advanced     | Better debugging |
      | Filter library      | Limited      | Rich         | More functionality|
    Then Nunjucks should demonstrate superior capabilities
    And all EJS functionality should be achievable in Nunjucks

  @template-inheritance @validation
  Scenario: Template inheritance works correctly
    Given I have a base template "base.njk":
      """
      <!DOCTYPE html>
      <html>
      <head>
        <title>{% block title %}Default Title{% endblock %}</title>
      </head>
      <body>
        {% block content %}{% endblock %}
      </body>
      </html>
      """
    And I have a child template extending the base:
      """
      {% extends "base.njk" %}
      {% block title %}{{ pageName }}{% endblock %}
      {% block content %}
        <h1>{{ heading }}</h1>
        <p>{{ content }}</p>
      {% endblock %}
      """
    When I render the child template
    Then template inheritance should work correctly
    And blocks should be overridden properly

  @macros-functionality @validation
  Scenario: Nunjucks macros provide code reusability
    Given I have a template with macros:
      """
      {% macro renderField(name, type, required=false) %}
        <div class="field">
          <label for="{{ name }}">{{ name | title }}</label>
          <input 
            type="{{ type }}" 
            name="{{ name }}"
            {% if required %}required{% endif %}
          />
        </div>
      {% endmacro %}

      <form>
        {{ renderField('email', 'email', true) }}
        {{ renderField('name', 'text', true) }}  
        {{ renderField('phone', 'tel') }}
      </form>
      """
    When I render the template
    Then macros should be executed correctly
    And parameters should be passed and defaulted properly
    And the output should contain the correct form fields

  @async-support @validation
  Scenario: Native async support works in templates
    Given I have a template with async operations:
      """
      {% asyncEach user in users %}
        <div class="user">
          <h3>{{ user.name }}</h3>
          <p>{{ await getUserDetails(user.id) }}</p>
        </div>
      {% endeach %}
      """
    When I render the template with async data
    Then async operations should execute correctly
    And the template should wait for async results
    And performance should be optimized with concurrent execution

  @rich-filter-library @validation
  Scenario: Built-in filters provide extensive functionality
    Given I have a template using various filters:
      """
      Name: {{ name | title }}
      Slug: {{ title | slugify }}  
      Date: {{ timestamp | dateFormat('YYYY-MM-DD') }}
      Excerpt: {{ content | truncate(100) }}
      Pascal: {{ componentName | pascalCase }}
      Kebab: {{ componentName | kebabCase }}
      Camel: {{ componentName | camelCase }}
      Default: {{ optionalValue | default('N/A') }}
      """
    When I render with appropriate variables
    Then all filters should work correctly:
      | Filter      | Input           | Expected Output    |
      | title       | 'john doe'      | 'John Doe'         |
      | slugify     | 'Hello World!'  | 'hello-world'      |
      | dateFormat  | timestamp       | '2025-01-27'       |
      | pascalCase  | 'user-profile'  | 'UserProfile'      |
      | kebabCase   | 'UserProfile'   | 'user-profile'     |
      | camelCase   | 'user-profile'  | 'userProfile'      |

  @error-handling @validation
  Scenario: Advanced error handling provides better debugging
    Given I have templates with various error conditions:
      | Error Type           | Template Code                    | Expected Error                |
      | Undefined variable   | {{ unknownVar }}                | Clear variable name and location |
      | Invalid filter       | {{ name | invalidFilter }}      | Available filters suggested   |
      | Syntax error         | {% if unclosed                  | Syntax error with line number |
      | Template not found   | {% include "missing.njk" %}    | Template path suggestions     |
    When I render templates with errors
    Then I should receive detailed error messages
    And error messages should include line numbers and suggestions
    And stack traces should be helpful for debugging

  @dynamic-filenames @validation
  Scenario: Variables in file paths work with filter support
    Given I have templates with dynamic filenames:
      """
      ---
      to: "{{ basePath }}/{{ moduleName | kebabCase }}/{{ componentName | pascalCase }}.{{ fileType }}"
      ---
      export const {{ componentName | pascalCase }} = {
        name: '{{ componentName }}'
      };
      """
    When I generate with variables:
      | Variable      | Value          |
      | basePath      | src/features   |
      | moduleName    | userManagement |
      | componentName | user_profile   |
      | fileType      | tsx            |
    Then the file should be created at "src/features/user-management/UserProfile.tsx"
    And all filters should be applied correctly in the path

  @performance-comparison @validation
  Scenario: Nunjucks performance meets or exceeds EJS
    Given I have equivalent complex templates in both engines
    When I benchmark rendering performance:
      | Template Complexity | EJS Time | Nunjucks Time | Requirement |
      | Simple              | 10ms     | TBD           | <= 10ms     |
      | Medium              | 25ms     | TBD           | <= 25ms     |
      | Complex             | 50ms     | TBD           | <= 40ms     |
    Then Nunjucks should meet or exceed EJS performance
    And complex templates should show performance improvement

  @migration-compatibility @validation
  Scenario: EJS templates can be migrated to Nunjucks
    Given I have Hygen-style EJS templates:
      """
      ---
      to: src/components/<%= name %>.js
      ---
      import React from 'react';

      const <%= name %> = () => {
        <% if (withProps) { %>
        const { className } = props;
        <% } %>
        return <div<% if (withProps) { %> className={className}<% } %>><%= name %></div>;
      };

      export default <%= name %>;
      """
    When I convert to Nunjucks syntax:
      """
      ---
      to: "src/components/{{ name }}.tsx"
      ---
      import React from 'react';

      const {{ name }} = () => {
        {% if withProps %}
        const { className } = props;
        {% endif %}
        return <div{% if withProps %} className={className}{% endif %}>{{ name }}</div>;
      };

      export default {{ name }};
      """
    Then the conversion should be straightforward
    And functionality should be preserved or enhanced

  @template-caching @validation
  Scenario: Template caching improves performance
    Given I have templates that will be rendered multiple times
    When I render the same template repeatedly:
      | Render | Expected Behavior        |
      | 1st    | Parse and cache template |
      | 2nd    | Use cached version       |
      | 3rd+   | Use cached version       |
    Then subsequent renders should be significantly faster
    And template caching should work correctly
    And cache invalidation should work when templates change