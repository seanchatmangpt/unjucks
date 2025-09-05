Feature: Template Conditional Logic
  As a developer using Unjucks templates
  I want to use conditional logic in my templates
  So that I can generate different content based on variables and conditions

  Background:
    Given the Nunjucks template system is initialized
    And template variables are available

  Scenario: Simple if condition
    Given a template with content:
      """
      {% if withAuth %}
      import { authenticate } from './auth';
      {% endif %}
      
      export class UserService {}
      """
    When I render with variables {"withAuth": true}
    Then the output should contain "import { authenticate } from './auth';"
    When I render with variables {"withAuth": false}
    Then the output should not contain the import statement

  Scenario: If-else condition
    Given a template with content:
      """
      {% if useTypeScript %}
      export interface {{ interfaceName }} {
        id: string;
      }
      {% else %}
      export const {{ interfaceName }} = {
        id: ''
      };
      {% endif %}
      """
    When I render with variables {"useTypeScript": true, "interfaceName": "User"}
    Then the output should contain "export interface User"
    When I render with variables {"useTypeScript": false, "interfaceName": "User"}
    Then the output should contain "export const User"

  Scenario: Multiple elif conditions
    Given a template with content:
      """
      {% if framework === 'react' %}
      import React from 'react';
      {% elif framework === 'vue' %}
      import Vue from 'vue';
      {% elif framework === 'angular' %}
      import { Component } from '@angular/core';
      {% else %}
      // No framework specified
      {% endif %}
      """
    When I render with variables:
      | Framework | Expected Import                        |
      | react     | import React from 'react';             |
      | vue       | import Vue from 'vue';                 |
      | angular   | import { Component } from '@angular/core'; |
      | svelte    | // No framework specified               |
    Then the correct import should be generated for each framework

  Scenario: Nested conditions
    Given a template with content:
      """
      {% if withDatabase %}
        {% if databaseType === 'postgres' %}
        import { Pool } from 'pg';
        const db = new Pool({{ dbConfig | json }});
        {% elif databaseType === 'mysql' %}
        import mysql from 'mysql2';
        const db = mysql.createConnection({{ dbConfig | json }});
        {% endif %}
        
        {% if withMigrations %}
        import { runMigrations } from './migrations';
        {% endif %}
      {% endif %}
      """
    When I render with variables:
      """
      {
        "withDatabase": true,
        "databaseType": "postgres",
        "withMigrations": true,
        "dbConfig": {"host": "localhost"}
      }
      """
    Then the output should contain PostgreSQL imports
    And the output should contain migration imports
    When I render with variables {"withDatabase": false}
    Then the output should not contain any database-related code

  Scenario: Conditions with comparison operators
    Given a template with content:
      """
      {% if port > 1000 and port < 10000 %}
      const server = app.listen({{ port }});
      {% elif port >= 10000 %}
      // High port number
      const server = app.listen({{ port }});
      {% else %}
      // Using default port
      const server = app.listen(3000);
      {% endif %}
      """
    When I render with variables:
      | Port | Expected Result                |
      | 3000 | app.listen(3000)              |
      | 15000| // High port number            |
      | 500  | // Using default port         |
    Then the correct port logic should be applied

  Scenario: Conditions with logical operators
    Given a template with content:
      """
      {% if (withAuth and withDatabase) or isDevelopment %}
      const config = {
        auth: {{ withAuth }},
        database: {{ withDatabase }},
        development: {{ isDevelopment }}
      };
      {% endif %}
      """
    When I render with variables:
      | WithAuth | WithDatabase | IsDevelopment | Should Generate Config |
      | true     | true         | false         | true                   |
      | false    | false        | true          | true                   |
      | true     | false        | false         | false                  |
      | false    | true         | false         | false                  |
    Then config should be generated based on logical conditions

  Scenario: Conditions with array and object checks
    Given a template with content:
      """
      {% if features and features.length > 0 %}
      const enabledFeatures = [
        {% for feature in features %}
        '{{ feature }}'{% if not loop.last %},{% endif %}
        {% endfor %}
      ];
      {% endif %}
      
      {% if user and user.permissions %}
      const userPermissions = {{ user.permissions | json }};
      {% endif %}
      """
    When I render with variables:
      """
      {
        "features": ["auth", "api", "admin"],
        "user": {
          "permissions": ["read", "write"]
        }
      }
      """
    Then features array should be generated
    And user permissions should be included
    When I render with variables {"features": [], "user": null}
    Then neither block should be generated

  Scenario: Conditions with string operations
    Given a template with content:
      """
      {% if fileName.endswith('.ts') %}
      // TypeScript file
      import type { {{ typeName }} } from './types';
      {% elif fileName.startswith('test-') %}
      // Test file
      import { describe, it, expect } from 'vitest';
      {% endif %}
      
      {% if 'test' in fileName %}
      // File contains 'test'
      console.log('This is a test file');
      {% endif %}
      """
    When I render with variables:
      | FileName        | Expected Content                    |
      | component.ts    | // TypeScript file                  |
      | test-utils.js   | // Test file                        |
      | user-test.ts    | Both TypeScript and test content    |
    Then appropriate content should be generated based on string conditions

  Scenario: Conditions with custom tests
    Given a template with content:
      """
      {% if value is defined %}
      const definedValue = {{ value }};
      {% endif %}
      
      {% if items is iterable %}
      {% for item in items %}
      - {{ item }}
      {% endfor %}
      {% endif %}
      
      {% if config is mapping %}
      const configKeys = {{ config.keys() | list | json }};
      {% endif %}
      """
    When I render with appropriate variable types
    Then custom tests should correctly identify variable types
    And content should be conditionally generated

  Scenario: Conditions in loops
    Given a template with content:
      """
      {% for user in users %}
      {% if user.active %}
      const {{ user.name | camelCase }} = {
        id: {{ user.id }},
        {% if user.isAdmin %}
        role: 'admin',
        {% else %}
        role: 'user',
        {% endif %}
      };
      {% endif %}
      {% endfor %}
      """
    When I render with variables:
      """
      {
        "users": [
          {"name": "John Doe", "id": 1, "active": true, "isAdmin": true},
          {"name": "Jane Smith", "id": 2, "active": false, "isAdmin": false},
          {"name": "Bob Wilson", "id": 3, "active": true, "isAdmin": false}
        ]
      }
      """
    Then only active users should be processed
    And admin roles should be set correctly

  Scenario: Complex conditional expressions
    Given a template with content:
      """
      {% set shouldUseAdvancedConfig = (environment === 'production' and features.includes('advanced')) or forceAdvanced %}
      
      {% if shouldUseAdvancedConfig %}
      const config = {
        advanced: true,
        {% if cacheEnabled and (environment !== 'development') %}
        cache: {
          ttl: {{ cacheTtl | default(3600) }},
          provider: '{{ cacheProvider | default("redis") }}'
        },
        {% endif %}
        logging: {
          level: '{{ logLevel | default("info") }}'
        }
      };
      {% else %}
      const config = {
        basic: true,
        logging: { level: 'warn' }
      };
      {% endif %}
      """
    When I render with complex variable combinations
    Then conditional logic should be properly evaluated
    And nested conditions should work within complex expressions

  Scenario: Conditions affecting file generation
    Given a template with frontmatter:
      """
      ---
      to: src/{{ componentName }}.{% if withTypeScript %}ts{% else %}js{% endif %}
      skipIf: "{{ !generateComponent }}"
      ---
      {% if withTypeScript %}
      interface {{ componentName }}Props {}
      {% endif %}
      
      export {% if withTypeScript %}const{% else %}function{% endif %} {{ componentName }} {}
      """
    When I render with variables:
      | ComponentName | WithTypeScript | GenerateComponent | Expected File | Expected Content |
      | Button        | true          | true              | Button.ts     | interface ButtonProps |
      | Button        | false         | true              | Button.js     | export function      |
      | Button        | true          | false             | (skipped)     | (no file)            |
    Then file extension and content should match conditions
    And file generation should respect skipIf condition

  Scenario: Error handling in conditions
    Given a template with potentially undefined variables:
      """
      {% if user.profile.name is defined %}
      const userName = '{{ user.profile.name }}';
      {% endif %}
      
      {% if items and items.length %}
      const itemCount = {{ items.length }};
      {% endif %}
      """
    When I render with incomplete data
    Then undefined property access should be handled gracefully
    And no errors should be thrown for safe conditional checks
    When I render with complete data
    Then all conditions should evaluate correctly

  Scenario: Conditions with macro definitions
    Given a template with conditional macros:
      """
      {% if withHelpers %}
      {% macro renderField(name, type, required) %}
      {{ name }}{% if required %}!{% endif %}: {{ type }};
      {% endmacro %}
      {% endif %}
      
      interface {{ interfaceName }} {
        {% if withHelpers %}
        {{ renderField('id', 'string', true) }}
        {{ renderField('name', 'string', false) }}
        {% else %}
        id: string;
        name?: string;
        {% endif %}
      }
      """
    When I render with variables {"interfaceName": "User", "withHelpers": true}
    Then macro should be defined and used
    When I render with variables {"interfaceName": "User", "withHelpers": false}
    Then fallback field definitions should be used