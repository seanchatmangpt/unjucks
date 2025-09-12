Feature: KGEN Template Rendering with Nunjucks Engine
  As a developer using KGEN for code generation
  I want templates to be rendered with deterministic Nunjucks processing
  So that I can generate consistent, reliable code from my templates

  Background:
    Given KGEN template engine is initialized with deterministic settings
    And custom filters are registered and available
    And template caching is enabled for performance

  Scenario: Render template with basic variable substitution
    Given a template file with content:
      """
      export class {{ className }}Service {
        constructor(private {{ entityName | camelCase }}Repository: Repository<{{ className }}>) {}
      }
      """
    And template variables:
      """
      {
        "className": "User",
        "entityName": "user-profile"
      }
      """
    When I render the template using KGEN engine
    Then the output should be:
      """
      export class UserService {
        constructor(private userProfileRepository: Repository<User>) {}
      }
      """
    And rendering should complete without errors
    And deterministic hash should be generated for caching

  Scenario: Process template with YAML frontmatter
    Given a template file with frontmatter:
      """
      ---
      to: "{{ baseDir }}/{{ moduleName | kebabCase }}/{{ className | kebabCase }}.service.ts"
      inject: false
      skipIf: "{{ !withService }}"
      ---
      import { Injectable } from '@nestjs/common';

      @Injectable()
      export class {{ className }}Service {
        // Generated service implementation
      }
      """
    And template variables:
      """
      {
        "baseDir": "src/modules",
        "moduleName": "UserManagement",
        "className": "UserProfile",
        "withService": true
      }
      """
    When I parse and render the template
    Then the frontmatter should be extracted as:
      | Field  | Value                                                  |
      | to     | src/modules/user-management/user-profile.service.ts   |
      | inject | false                                                  |
      | skipIf | false                                                  |
    And the content should contain:
      """
      @Injectable()
      export class UserProfileService {
        // Generated service implementation
      }
      """

  Scenario: Apply multiple custom string transformation filters
    Given a template with content:
      """
      // {{ description | upperFirst }}
      export const {{ configName | constantCase }} = '{{ apiEndpoint }}';
      export class {{ className | pascalCase }} {
        get{{ propertyName | pascalCase }}(): {{ returnType }} {
          return this.{{ propertyName | camelCase }};
        }
      }
      """
    And template variables:
      """
      {
        "description": "user configuration constants",
        "configName": "api-base-url",
        "apiEndpoint": "https://api.example.com/v1",
        "className": "user-profile-manager",
        "propertyName": "user-data",
        "returnType": "UserData"
      }
      """
    When I render the template
    Then the output should be:
      """
      // User configuration constants
      export const API_BASE_URL = 'https://api.example.com/v1';
      export class UserProfileManager {
        getUserData(): UserData {
          return this.userData;
        }
      }
      """
    And all custom filters should be applied correctly
    And filter usage should be tracked in engine stats

  Scenario: Render complex template with loops and conditionals
    Given a template with content:
      """
      export interface {{ interfaceName }} {
      {% for field in fields %}
        {% if field.required %}
        {{ field.name }}: {{ field.type }};
        {% else %}
        {{ field.name }}?: {{ field.type }};
        {% endif %}
      {% endfor %}
      }

      {% if withValidation %}
      export const {{ interfaceName | camelCase }}Schema = {
        {% for field in fields %}
        {% if field.validation %}
        {{ field.name }}: {{ field.validation }},
        {% endif %}
        {% endfor %}
      };
      {% endif %}
      """
    And template variables:
      """
      {
        "interfaceName": "CreateUserRequest",
        "withValidation": true,
        "fields": [
          {
            "name": "email",
            "type": "string",
            "required": true,
            "validation": "{ required: true, email: true }"
          },
          {
            "name": "age",
            "type": "number",
            "required": false,
            "validation": "{ min: 0, max: 120 }"
          }
        ]
      }
      """
    When I render the template
    Then the output should contain proper interface definition
    And required fields should not have optional markers
    And optional fields should have optional markers
    And validation schema should be included
    And nested loops should process correctly

  Scenario: Extract and validate template variables
    Given a template with content:
      """
      export class {{ className }}Controller {
        {% if withAuth %}
        @UseGuards({{ authGuard | pascalCase }})
        {% endif %}
        async create(@Body() {{ dtoName | camelCase }}: {{ dtoName }}): Promise<{{ returnType }}> {
          return this.{{ serviceName | camelCase }}.create({{ dtoName | camelCase }});
        }
      }
      """
    When I extract variables from the template
    Then the extracted variables should include:
      | Variable    | Type      |
      | className   | required  |
      | withAuth    | optional  |
      | authGuard   | optional  |
      | dtoName     | required  |
      | returnType  | required  |
      | serviceName | required  |
    And variable extraction should be complete and accurate

  Scenario: Handle template inheritance and includes
    Given a base template "base.controller.njk":
      """
      import { Controller, {{ httpMethods | join(', ') }} } from '@nestjs/common';

      @Controller('{{ routePath }}')
      export class {{ className }}Controller {
        {% block methods %}
        // Default methods
        {% endblock %}
      }
      """
    And a child template extending base:
      """
      {% extends "base.controller.njk" %}
      {% block methods %}
      @Get()
      findAll(): Promise<{{ entityType }}[]> {
        return this.service.findAll();
      }

      @Post()
      create(@Body() dto: Create{{ entityType }}Dto): Promise<{{ entityType }}> {
        return this.service.create(dto);
      }
      {% endblock %}
      """
    And template variables:
      """
      {
        "httpMethods": ["Get", "Post", "Put", "Delete"],
        "routePath": "users",
        "className": "User",
        "entityType": "User"
      }
      """
    When I render the child template
    Then the output should contain combined base and child content
    And template inheritance should work correctly
    And block replacement should be applied

  Scenario: Process template with deterministic content-addressing
    Given a template with content "export const CONFIG = {{ config | json }};"
    And template variables:
      """
      {
        "config": {
          "apiUrl": "https://api.example.com",
          "timeout": 5000,
          "retries": 3
        }
      }
      """
    When I render the template with content-addressing enabled
    Then a deterministic hash should be generated for the template
    And the hash should be consistent across multiple renders
    And template cache should use content-addressing
    And rendered output should be deterministic

  Scenario: Validate template syntax and structure
    Given a template with potential syntax errors:
      """
      export class {{ className }} {
        {% if withMethods
        method(): void {}
        {% endif %}
        
        {% for item in items %}
        process{{ item.name }}(): {{ item.returnType } {
          // Missing closing brace
        {% endfor %}
      }
      """
    When I attempt to render the template
    Then syntax errors should be detected and reported
    And error messages should include line numbers
    And specific syntax issues should be identified:
      | Error Type          | Line | Description                |
      | Unclosed block      | 2    | Missing closing %}         |
      | Invalid syntax      | 5    | Malformed variable output  |
      | Unclosed brace      | 6    | Missing closing brace      |

  Scenario: Handle template with RDF integration
    Given RDF triples are loaded:
      """
      @prefix ex: <http://example.org/> .
      ex:User a ex:Entity ;
            ex:hasProperty ex:email, ex:name ;
            ex:tableName "users" .
      ex:email a ex:Property ;
              ex:type "string" ;
              ex:required true .
      """
    And a template with RDF queries:
      """
      export interface {{ entityName | pascalCase }} {
      {% for property in rdf.getProperties(entityName) %}
        {{ property.name }}{{ "?" if not property.required }}: {{ property.type }};
      {% endfor %}
      }
      """
    And template variables:
      """
      {
        "entityName": "User"
      }
      """
    When I render the template with RDF filters enabled
    Then RDF data should be accessible in template
    And properties should be extracted from RDF store
    And generated interface should match RDF schema

  Scenario: Generate multiple file types from single template
    Given a multi-file template with frontmatter:
      """
      ---
      files:
        - to: "{{ baseDir }}/{{ entityName | kebabCase }}.entity.ts"
          template: "entity"
        - to: "{{ baseDir }}/{{ entityName | kebabCase }}.dto.ts"
          template: "dto"
        - to: "{{ baseDir }}/{{ entityName | kebabCase }}.service.ts"
          template: "service"
      ---
      {%- if template == 'entity' -%}
      export class {{ entityName | pascalCase }} {
        id: number;
        {{ propertyName }}: {{ propertyType }};
      }
      {%- elif template == 'dto' -%}
      export class Create{{ entityName | pascalCase }}Dto {
        {{ propertyName }}: {{ propertyType }};
      }
      {%- elif template == 'service' -%}
      @Injectable()
      export class {{ entityName | pascalCase }}Service {
        create(dto: Create{{ entityName | pascalCase }}Dto): Promise<{{ entityName | pascalCase }}> {
          // Implementation
        }
      }
      {%- endif -%}
      """
    And template variables:
      """
      {
        "baseDir": "src/entities",
        "entityName": "User",
        "propertyName": "email",
        "propertyType": "string"
      }
      """
    When I render the multi-file template
    Then three separate files should be generated
    And each file should have correct content for its type
    And file paths should be correctly calculated

  Scenario: Performance validation with template caching
    Given a template "performance-test.njk"
    And template variables for performance testing
    When I render the template 1000 times
    Then first render should populate the cache
    And subsequent renders should use cached results
    And cache hit rate should be > 99%
    And total render time should be optimized
    And rendering statistics should be tracked

  Scenario: Custom filter registration and usage
    Given I register a custom filter "formatCurrency":
      """
      function formatCurrency(value, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency
        }).format(value);
      }
      """
    And a template with content:
      """
      export const PRICING = {
        basic: '{{ prices.basic | formatCurrency }}',
        premium: '{{ prices.premium | formatCurrency('EUR') }}'
      };
      """
    And template variables:
      """
      {
        "prices": {
          "basic": 9.99,
          "premium": 29.99
        }
      }
      """
    When I render the template
    Then custom filter should be applied correctly
    And currency formatting should work as expected
    And filter should be tracked in usage statistics

  Scenario: Error handling and recovery
    Given a template with undefined variable references
    And strict mode is disabled
    When I render the template
    Then undefined variables should render as empty strings
    And rendering should complete without throwing errors
    And warnings should be logged for undefined variables
    And template should still generate valid output

  Scenario: Context sorting for deterministic output
    Given a template accessing object properties in random order
    And template variables with unsorted object keys
    When I render the template with deterministic sorting enabled
    Then object keys should be processed in sorted order
    And output should be deterministic regardless of input order
    And generated code should be consistent across renders