Feature: Template Engine Superiority (Nunjucks vs EJS)
  As a developer using Unjucks
  I want to leverage Nunjucks' advanced features over EJS
  So that I can create more powerful and maintainable templates

  Background:
    Given I have a project with templates directory
    And I am in the project root directory

  @critical @template-engine @inheritance
  Scenario: Template inheritance with extends and blocks
    Given I have a base template "base.njk":
      """
      ---
      to: "src/{{ name }}/{{ name }}.ts"
      ---
      /**
       * {% block header %}
       * Base component class
       * {% endblock %}
       */
      export class {{ name | pascalCase }} {
        {% block properties %}
        name = '{{ name }}';
        {% endblock %}
        
        {% block methods %}
        getName() {
          return this.name;
        }
        {% endblock %}
        
        {% block lifecycle %}
        // Lifecycle methods
        {% endblock %}
      }
      """
    And I have an extended template that inherits from base:
      """
      ---
      to: "src/{{ name }}/Advanced{{ name | pascalCase }}.ts"
      ---
      {% extends "base.njk" %}
      
      {% block header %}
      Advanced {{ name }} component with enhanced features
      {% endblock %}
      
      {% block properties %}
      {{ super() }}
      advanced = true;
      version = {{ version || '1.0' }};
      {% endblock %}
      
      {% block methods %}
      {{ super() }}
      
      getVersion() {
        return this.version;
      }
      
      isAdvanced() {
        return this.advanced;
      }
      {% endblock %}
      
      {% block lifecycle %}
      initialize() {
        console.log(`Initializing advanced ${this.name}`);
      }
      
      destroy() {
        console.log(`Destroying advanced ${this.name}`);
      }
      {% endblock %}
      """
    When I run "unjucks generate test advanced --name=user --version=2.0"
    Then I should see "src/user/AdvancedUser.ts" file generated
    And the file should contain:
      """
      /**
       * Advanced user component with enhanced features
       */
      export class User {
        name = 'user';
        advanced = true;
        version = 2.0;
        
        getName() {
          return this.name;
        }
        
        getVersion() {
          return this.version;
        }
        
        isAdvanced() {
          return this.advanced;
        }
        
        initialize() {
          console.log(`Initializing advanced ${this.name}`);
        }
        
        destroy() {
          console.log(`Destroying advanced ${this.name}`);
        }
      }
      """

  @critical @template-engine @macros
  Scenario: Reusable macros for complex template logic
    Given I have a macro definition template:
      """
      {# macros.njk #}
      {% macro renderProperty(name, type, defaultValue, required=false, description="") %}
      {% if description %}/** {{ description }} */{% endif %}
      {% if required %}
      private _{{ name }}: {{ type }};
      public get {{ name }}(): {{ type }} {
        return this._{{ name }};
      }
      public set {{ name }}(value: {{ type }}) {
        if (value === undefined || value === null) {
          throw new Error('{{ name }} is required');
        }
        this._{{ name }} = value;
      }
      {% else %}
      public {{ name }}: {{ type }} = {{ defaultValue }};
      {% endif %}
      {% endmacro %}
      
      {% macro renderMethod(name, params=[], returnType="void", async=false, description="") %}
      {% if description %}
      /**
       * {{ description }}
       {% for param in params %}
       * @param {{ param.name }} {{ param.description or param.name }}
       {% endfor %}
       */
      {% endif %}
      {% if async %}async {% endif %}{{ name }}(
      {%- for param in params -%}
        {{ param.name }}{{ ": " + param.type if param.type }}
        {%- if not loop.last %}, {% endif -%}
      {%- endfor -%}
      ): {% if async %}Promise<{{ returnType }}>{% else %}{{ returnType }}{% endif %} {
        // Implementation here
      }
      {% endmacro %}
      """
    And I have a template that uses macros:
      """
      ---
      to: "src/{{ name }}.ts"
      ---
      {% from "macros.njk" import renderProperty, renderMethod %}
      
      export class {{ name | pascalCase }} {
        {{ renderProperty("id", "string", '""', required=true, description="Unique identifier") }}
        
        {{ renderProperty("name", "string", '""', required=true, description="Display name") }}
        
        {{ renderProperty("email", "string", '""', description="Email address") }}
        
        {{ renderProperty("isActive", "boolean", "true", description="Whether the user is active") }}
        
        constructor(id: string, name: string) {
          this.id = id;
          this.name = name;
        }
        
        {{ renderMethod("validate", [
          {"name": "data", "type": "Partial<" + name | pascalCase + ">", "description": "Data to validate"}
        ], "boolean", description="Validates the provided data") }}
        
        {{ renderMethod("save", [], name | pascalCase, async=true, description="Saves the current instance") }}
      }
      """
    When I run "unjucks generate test macro --name=user"
    Then the generated file should contain properly expanded macros
    And required properties should have getters/setters with validation
    And methods should have proper TypeScript signatures and JSDoc

  @critical @template-engine @filters
  Scenario: Rich filter library with chainable transformations
    Given I have a template that uses multiple filters:
      """
      ---
      to: "src/{{ name | kebabCase }}/{{ name | pascalCase }}.ts"
      ---
      import { {{ dependencies | join(', ') }} } from '{{ packageName | kebabCase }}';
      
      /**
       * {{ description | capitalize | wordwrap(80) }}
       * 
       * @version {{ version | default('1.0.0') }}
       * @author {{ author | default('Unknown') | title }}
       * @created {{ createdDate | date('YYYY-MM-DD') | default('2025-01-27') }}
       */
      export class {{ name | pascalCase }}{{ suffix | pascalCase | default('') }} {
        static readonly TYPE = '{{ name | upper | snake_case }}';
        
        private readonly config = {
          name: '{{ name | kebabCase }}',
          displayName: '{{ name | title }}',
          slug: '{{ name | slugify }}',
          namespace: '{{ namespace | camelCase | default('global') }}',
          tags: [{{ tags | map('quote') | join(', ') }}],
          metadata: {
            isPublic: {{ isPublic | default(false) | lower }},
            priority: {{ priority | int | default(0) }},
            categories: {{ categories | tojson | safe }}
          }
        };
        
        {% if methods %}
        // Generated methods
        {% for method in methods %}
        {{ method.visibility | default('public') }} {{ method.name | camelCase }}(
        {%- for param in method.params -%}
          {{ param.name }}: {{ param.type | default('any') }}
          {%- if not loop.last %}, {% endif -%}
        {%- endfor -%}
        ): {{ method.returnType | default('void') }} {
          {{ method.body | indent(4) | safe }}
        }
        {% endfor %}
        {% endif %}
      }
      
      // Export with alias
      export { {{ name | pascalCase }}{{ suffix | pascalCase | default('') }} as {{ name | pascalCase | abbr }} };
      """
    When I run "unjucks generate test filters" with complex data:
      """
      --name=advancedUserService
      --description="This is a comprehensive user management service that handles authentication, authorization, and user profile management"
      --author="john doe"
      --dependencies=["Injectable", "Repository", "Logger"]
      --packageName="@myapp/core"
      --tags=["user", "authentication", "service"]
      --categories='["business", "authentication"]'
      --namespace="user_management"
      --isPublic=true
      --priority=5
      --methods='[{"name":"authenticate","params":[{"name":"credentials","type":"LoginCredentials"}],"returnType":"Promise<User>","body":"return this.authService.login(credentials);"}]'
      """
    Then the generated file should demonstrate all filter capabilities:
      | Filter | Input | Expected Output |
      | kebabCase | advancedUserService | advanced-user-service |
      | pascalCase | advancedUserService | AdvancedUserService |
      | title | john doe | John Doe |
      | upper + snake_case | advancedUserService | ADVANCED_USER_SERVICE |
      | wordwrap(80) | long description | properly wrapped text |
      | tojson | array/object | valid JSON string |

  @critical @template-engine @async
  Scenario: Async template processing with real data fetching
    Given I have an async template:
      """
      ---
      to: "src/generated/{{ name }}.ts"
      ---
      {% asyncEach item in asyncDataSource %}
      import { {{ item.name | pascalCase }} } from '{{ item.module }}';
      {% endasyncEach %}
      
      {% set userCount = asyncFunction('getUserCount') %}
      {% set permissions = asyncFunction('getPermissions', userId) %}
      
      /**
       * Auto-generated file based on live data
       * Total users: {{ userCount }}
       * Generated at: {{ asyncFunction('getCurrentTime') | date('YYYY-MM-DD HH:mm:ss') }}
       */
      export class {{ name | pascalCase }} {
        static readonly TOTAL_USERS = {{ userCount }};
        
        {% for permission in permissions %}
        {% if permission.enabled %}
        has{{ permission.name | pascalCase }}Permission(): boolean {
          return {{ permission.value | lower }};
        }
        {% endif %}
        {% endfor %}
        
        {% asyncEach endpoint in asyncFunction('getApiEndpoints') %}
        async {{ endpoint.method | lower }}{{ endpoint.path | pascalCase | replace('/', '') }}(
        {%- if endpoint.params -%}
          {%- for param in endpoint.params -%}
            {{ param.name }}: {{ param.type }}
            {%- if not loop.last %}, {% endif -%}
          {%- endfor -%}
        {%- endif -%}
        ) {
          return fetch('{{ endpoint.fullUrl }}', {
            method: '{{ endpoint.method }}',
            {% if endpoint.requiresAuth %}
            headers: { 'Authorization': `Bearer ${this.token}` }
            {% endif %}
          });
        }
        {% endasyncEach %}
      }
      """
    When I run "unjucks generate test async --name=apiClient --userId=123" with async data providers
    Then the template should resolve all async operations
    And live data should be fetched and rendered
    And the generated file should contain current, real-time information

  @critical @template-engine @error-handling
  Scenario: Superior error handling with detailed debugging
    Given I have a template with intentional errors:
      """
      ---
      to: "src/{{ name }}.ts"
      ---
      export class {{ name | pascalCase }} {
        {% if nonexistentVariable %}
        // This should cause an error
        {% endif %}
        
        {{ undefinedFilter | nonExistentFilter }}
        
        {% for item in invalidLoop %}
        // Another error
        {% endfor %}
        
        {% include "non-existent-template.njk" %}
      }
      """
    When I run "unjucks generate test errors --name=broken"
    Then I should see detailed error messages:
      """
      🚨 Template Processing Errors
      
      File: _templates/test/errors/template.njk
      
      Line 4: ReferenceError: 'nonexistentVariable' is undefined
        {% if nonexistentVariable %}
               ^^^^^^^^^^^^^^^^^^^
        
      Line 7: FilterError: Unknown filter 'nonExistentFilter'
        {{ undefinedFilter | nonExistentFilter }}
                            ^^^^^^^^^^^^^^^^^^^
        
      Line 10: ReferenceError: 'invalidLoop' is undefined  
        {% for item in invalidLoop %}
                       ^^^^^^^^^^^
        
      Line 14: TemplateError: Template 'non-existent-template.njk' not found
        {% include "non-existent-template.njk" %}
                   ^^^^^^^^^^^^^^^^^^^^^^^^^
      
      🔧 Suggestions:
      - Define 'nonexistentVariable' in your template variables
      - Check available filters: kebabCase, pascalCase, title, etc.
      - Ensure 'invalidLoop' is passed as an array variable  
      - Create the missing template or check the include path
      """
    And the error should include line numbers and context
    And helpful suggestions should be provided

  @performance @template-engine
  Scenario: Template performance comparison with EJS equivalent
    Given I have equivalent templates in both Nunjucks and EJS formats
    When I run performance benchmarks on both template engines
    Then Nunjucks templates should show:
      | Metric | Improvement vs EJS |
      | Cold start | 25% faster |
      | Template compilation | 40% faster |
      | Rendering speed | 30% faster |
      | Memory usage | 20% less |
      | Error recovery | 5x better |
    And Nunjucks should handle larger templates more efficiently
    And Complex template inheritance should be significantly faster

  @integration @template-engine @backward-compatibility
  Scenario: Migration helper for EJS to Nunjucks conversion
    Given I have existing EJS templates:
      """
      EJS Template:
      export class <%= name.charAt(0).toUpperCase() + name.slice(1) %> {
        <% if (withTests) { %>
        // Tests included
        <% } %>
        
        <% items.forEach(function(item) { %>
        <%= item.name %>: <%= item.type %>,
        <% }); %>
      }
      """
    When I run "unjucks migrate-from-ejs template.ejs.t"
    Then I should get an equivalent Nunjucks template:
      """
      Nunjucks Template:
      export class {{ name | pascalCase }} {
        {% if withTests %}
        // Tests included  
        {% endif %}
        
        {% for item in items %}
        {{ item.name }}: {{ item.type }},
        {% endfor %}
      }
      """
    And a migration report should show:
      """
      🔄 EJS to Nunjucks Migration Report
      
      Converted:
        ✅ <%= var %> → {{ var }}
        ✅ <% if %> → {% if %}
        ✅ <% } %> → {% endif %}
        ✅ forEach loop → {% for %}
        ✅ String methods → Nunjucks filters
      
      Improvements available:
        💡 Use {{ name | pascalCase }} instead of manual capitalization
        💡 Consider template inheritance for shared patterns
        💡 Add error handling with try/catch blocks
      
      Manual review needed:
        ⚠️  Complex JavaScript expressions may need refactoring
        ⚠️  Custom EJS helpers should be converted to Nunjucks filters
      """