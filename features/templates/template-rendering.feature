Feature: Nunjucks Template Rendering
  As a developer using Unjucks templates
  I want templates to be rendered with Nunjucks engine correctly
  So that I can generate dynamic content from my templates

  Background:
    Given the Nunjucks template system is initialized
    And template variables are available

  Scenario: Render simple variable substitution
    Given a template with content "Hello {{ name }}!"
    And variables {"name": "World"}
    When I render the template
    Then the output should be "Hello World!"

  Scenario: Render nested object properties
    Given a template with content "{{ user.profile.firstName }} {{ user.profile.lastName }}"
    And variables:
      """
      {
        "user": {
          "profile": {
            "firstName": "John",
            "lastName": "Doe"
          }
        }
      }
      """
    When I render the template
    Then the output should be "John Doe"

  Scenario: Render arrays with iteration
    Given a template with content:
      """
      {% for item in items %}
      - {{ item.name }}: {{ item.value }}
      {% endfor %}
      """
    And variables:
      """
      {
        "items": [
          {"name": "config1", "value": "value1"},
          {"name": "config2", "value": "value2"}
        ]
      }
      """
    When I render the template
    Then the output should contain:
      """
      - config1: value1
      - config2: value2
      """

  Scenario: Handle conditional rendering
    Given a template with content:
      """
      {% if withAuth %}
      import { auth } from './auth';
      {% endif %}
      
      {% if withDatabase %}
      import { db } from './database';
      {% else %}
      // No database configured
      {% endif %}
      """
    And variables {"withAuth": true, "withDatabase": false}
    When I render the template
    Then the output should contain "import { auth } from './auth';"
    And the output should contain "// No database configured"
    And the output should not contain "import { db } from './database';"

  Scenario: Render with filter application
    Given a template with content "export class {{ className | upperFirst }}Component"
    And variables {"className": "userProfile"}
    When I render the template
    Then the output should be "export class UserProfileComponent"

  Scenario: Handle undefined variables gracefully
    Given a template with content "{{ definedVar }} and {{ undefinedVar }}"
    And variables {"definedVar": "exists"}
    When I render the template
    Then the output should contain "exists"
    And undefined variables should render as empty strings
    And no errors should be thrown

  Scenario: Render complex nested loops
    Given a template with content:
      """
      {% for module in modules %}
      export class {{ module.name }}:
        {% for method in module.methods %}
        {{ method.name }}(): {{ method.returnType }} {
          {% if method.implementation %}
          {{ method.implementation }}
          {% else %}
          throw new Error('Not implemented');
          {% endif %}
        }
        {% endfor %}
      {% endfor %}
      """
    And variables:
      """
      {
        "modules": [
          {
            "name": "UserService",
            "methods": [
              {"name": "getUser", "returnType": "User", "implementation": "return this.db.findUser();"},
              {"name": "deleteUser", "returnType": "void"}
            ]
          }
        ]
      }
      """
    When I render the template
    Then the output should contain properly nested structure
    And method implementations should be rendered correctly

  Scenario: Handle template inheritance with blocks
    Given a base template "base.njk":
      """
      export class {{ className }} {
        {% block methods %}
        // Default methods
        {% endblock %}
      }
      """
    And a child template extending base:
      """
      {% extends "base.njk" %}
      {% block methods %}
      customMethod(): void {}
      {% endblock %}
      """
    When I render the child template with variables {"className": "TestClass"}
    Then the output should contain "export class TestClass"
    And the output should contain "customMethod(): void {}"

  Scenario: Include partial templates
    Given a partial template "header.njk":
      """
      /**
       * {{ description }}
       * @author {{ author }}
       */
      """
    And a main template:
      """
      {{ include 'header.njk' }}
      
      export class {{ className }} {}
      """
    And variables:
      """
      {
        "description": "User service class",
        "author": "John Doe",
        "className": "UserService"
      }
      """
    When I render the main template
    Then the output should contain the header comment
    And the output should contain "export class UserService {}"

  Scenario: Handle macro definitions and calls
    Given a template with macros:
      """
      {% macro renderMethod(name, returnType, params) %}
      {{ name }}({{ params | join(', ') }}): {{ returnType }} {}
      {% endmacro %}
      
      export class {{ className }} {
        {{ renderMethod('getUser', 'User', ['id: string']) }}
        {{ renderMethod('deleteUser', 'void', ['id: string']) }}
      }
      """
    And variables {"className": "UserService"}
    When I render the template
    Then the output should contain properly formatted methods
    And macro calls should be expanded correctly

  Scenario: Render with global context variables
    Given global context variables:
      """
      {
        "project": {
          "name": "MyApp",
          "version": "1.0.0"
        },
        "generator": {
          "name": "component",
          "version": "2.1.0"
        }
      }
      """
    And a template with content:
      """
      /**
       * Generated by {{ generator.name }} v{{ generator.version }}
       * For project: {{ project.name }} v{{ project.version }}
       */
      export class {{ componentName }} {}
      """
    And user variables {"componentName": "Button"}
    When I render the template
    Then the output should contain project and generator information
    And user variables should also be available

  Scenario: Handle rendering errors gracefully
    Given a template with invalid syntax:
      """
      {{ user.profile.name
      {% if unclosed
      {{ undefined.property.chain }}
      """
    When I attempt to render the template
    Then specific syntax errors should be reported
    And error messages should include line numbers
    And rendering should fail with clear error descriptions

  Scenario: Render dynamic file paths in frontmatter
    Given a template with frontmatter:
      """
      ---
      to: "{{ baseDir }}/{{ moduleType | kebabCase }}/{{ componentName | kebabCase }}.component.ts"
      ---
      export class {{ componentName }}Component {}
      """
    And variables:
      """
      {
        "baseDir": "src/features",
        "moduleType": "UserManagement", 
        "componentName": "UserProfile"
      }
      """
    When I render the template including frontmatter
    Then the 'to' path should be "src/features/user-management/user-profile.component.ts"
    And the content should be "export class UserProfileComponent {}"

  Scenario: Preserve whitespace and indentation
    Given a template with specific indentation:
      """
      export class {{ className }} {
          {% if withConstructor %}
          constructor(
              private service: {{ serviceType }}
          ) {}
          {% endif %}
      
          {% for method in methods %}
          {{ method.name }}(): {{ method.returnType }} {
              return {{ method.defaultReturn }};
          }
          {% endfor %}
      }
      """
    When I render the template
    Then original indentation should be preserved
    And generated code should maintain proper formatting
    And conditional blocks should not introduce extra whitespace

  Scenario: Handle special characters in variables
    Given a template with content "{{ message }}"
    And variables containing special characters:
      """
      {
        "message": "Hello \"World\" & <Universe> with 'quotes'"
      }
      """
    When I render the template
    Then special characters should be preserved
    And no HTML escaping should occur by default
    And output should contain original special characters

  Scenario: Render with custom Nunjucks environment settings
    Given custom Nunjucks environment with:
      | Setting           | Value |
      | autoescape        | false |
      | trimBlocks        | true  |
      | lstripBlocks      | true  |
      | throwOnUndefined  | false |
    And a template with HTML content and undefined variables
    When I render the template
    Then HTML should not be escaped
    And block whitespace should be trimmed
    And undefined variables should not throw errors