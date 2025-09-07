Feature: Frontmatter Processing with Filters
  As a developer using Unjucks templates
  I want frontmatter to support filter expressions in YAML metadata
  So that I can generate dynamic file paths, inject content intelligently, and control template behavior

  Background:
    Given Unjucks template system is initialized
    And frontmatter parser supports YAML with filter expressions
    And template discovery system is ready
    And file injection system is available

  Scenario: Dynamic file path generation with filters
    Given I have a template file with frontmatter:
      """
      ---
      to: src/components/{{ componentName | pascalCase }}.jsx
      inject: false
      ---
      import React from 'react';
      
      export const {{ componentName | pascalCase }} = () => {
        return (
          <div className="{{ componentName | kebabCase }}">
            {{ componentName | humanize }}
          </div>
        );
      };
      """
    And the variable "componentName" has value "user_profile_card"
    When I process the template
    Then the file should be written to "src/components/UserProfileCard.jsx"
    And the content should contain "export const UserProfileCard"
    And the content should contain 'className="user-profile-card"'
    And the content should contain "User profile card"

  Scenario: Conditional file injection with skipIf
    Given I have a template file with frontmatter:
      """
      ---
      to: src/models/{{ modelName | pascalCase }}.ts
      inject: true
      skipIf: "export class {{ modelName | pascalCase }}"
      ---
      export class {{ modelName | pascalCase }} extends Model {
        static tableName = '{{ modelName | tableize }}';
        
        // Generated on {{ formatDate() }}
      }
      """
    And the variable "modelName" has value "user"
    And the file "src/models/User.ts" already contains "export class User"
    When I process the template
    Then the file should not be modified
    And the skipIf condition should prevent injection

  Scenario: Multiple file generation with array iteration
    Given I have a template file with frontmatter:
      """
      ---
      to: src/types/{{ entityName | pascalCase }}Types.ts
      inject: false
      ---
      export interface {{ entityName | pascalCase }} {
        id: string;
        {{ entityName | camelCase }}Name: string;
        createdAt: Date;
        updatedAt: Date;
      }
      
      export type {{ entityName | pascalCase }}Create = Omit<{{ entityName | pascalCase }}, 'id' | 'createdAt' | 'updatedAt'>;
      export type {{ entityName | pascalCase }}Update = Partial<{{ entityName | pascalCase }}Create>;
      """
    And the variable "entityName" has value "blog_post"
    When I process the template
    Then the file should be written to "src/types/BlogPostTypes.ts"
    And the content should contain "export interface BlogPost"
    And the content should contain "blogPostName: string"
    And the content should contain "export type BlogPostCreate"
    And the content should contain "export type BlogPostUpdate"

  Scenario: File injection at specific line with lineAt
    Given I have a template file with frontmatter:
      """
      ---
      to: src/routes/index.ts
      inject: true
      lineAt: 10
      ---
      router.get('/{{ resourceName | kebabCase }}', {{ resourceName | camelCase }}Controller.index);
      router.post('/{{ resourceName | kebabCase }}', {{ resourceName | camelCase }}Controller.create);
      """
    And the variable "resourceName" has value "user_profiles"
    And the file "src/routes/index.ts" exists with 15 lines
    When I process the template
    Then the content should be injected at line 10
    And the file should contain "router.get('/user-profiles'"
    And the file should contain "userProfilesController.index"

  Scenario: Append content to existing file
    Given I have a template file with frontmatter:
      """
      ---
      to: src/database/seeds/{{ timestamp() }}_{{ seedName | snakeCase }}.js
      inject: false
      append: true
      ---
      
      exports.seed = function(knex) {
        return knex('{{ tableName | tableize }}').del()
          .then(function () {
            return knex('{{ tableName | tableize }}').insert([
              { name: '{{ faker.person.fullName() }}', email: '{{ faker.internet.email() }}' }
            ]);
          });
      };
      """
    And the variable "seedName" has value "admin-users"
    And the variable "tableName" has value "User"
    When I process the template
    Then the file should be created with a timestamped name
    And the filename should contain "_admin_users.js"
    And the content should contain "knex('users')"

  Scenario: Prepend import statements to existing file
    Given I have a template file with frontmatter:
      """
      ---
      to: src/components/{{ componentName | pascalCase }}/index.ts
      inject: true
      prepend: true
      skipIf: "export { {{ componentName | pascalCase }} }"
      ---
      export { {{ componentName | pascalCase }} } from './{{ componentName | pascalCase }}';
      """
    And the variable "componentName" has value "user_card"
    And the file "src/components/UserCard/index.ts" exists
    When I process the template
    Then the export statement should be prepended to the file
    And the content should contain "export { UserCard } from './UserCard'"

  Scenario: Complex frontmatter with multiple operations
    Given I have a template file with frontmatter:
      """
      ---
      to: src/api/{{ serviceName | kebabCase }}/{{ version }}/{{ resourceName | kebabCase }}.ts
      inject: false
      chmod: 755
      before: "// END OF IMPORTS"
      after: "// START OF ROUTES"
      ---
      import { Router } from 'express';
      import { {{ resourceName | pascalCase }}Service } from '../services/{{ resourceName | pascalCase }}Service';
      
      const router = Router();
      const {{ resourceName | camelCase }}Service = new {{ resourceName | pascalCase }}Service();
      
      // {{ resourceName | humanize }} endpoints
      router.get('/', async (req, res) => {
        const {{ resourceName | pluralize | camelCase }} = await {{ resourceName | camelCase }}Service.findAll();
        res.json({{ resourceName | pluralize | camelCase }});
      });
      
      export { router as {{ resourceName | camelCase }}Router };
      """
    And the variable "serviceName" has value "user-management"
    And the variable "version" has value "v1"
    And the variable "resourceName" has value "user_profile"
    When I process the template
    Then the file should be created at "src/api/user-management/v1/user-profile.ts"
    And the file permissions should be set to 755
    And the content should contain "UserProfileService"
    And the content should contain "// User profile endpoints"
    And the content should contain "const userProfiles"

  Scenario: Database migration with timestamp and filters
    Given I have a template file with frontmatter:
      """
      ---
      to: migrations/{{ timestamp() }}_create_{{ tableName | tableize }}.js
      inject: false
      ---
      exports.up = function(knex) {
        return knex.schema.createTable('{{ tableName | tableize }}', function(table) {
          table.increments('id');
          table.string('{{ tableName | singular | snakeCase }}_name').notNullable();
          table.string('email').unique();
          table.timestamp('created_at').defaultTo(knex.fn.now());
          table.timestamp('updated_at').defaultTo(knex.fn.now());
        });
      };
      
      exports.down = function(knex) {
        return knex.schema.dropTable('{{ tableName | tableize }}');
      };
      """
    And the variable "tableName" has value "AdminUser"
    When I process the template
    Then the file should be created with a timestamp prefix
    And the filename should end with "_create_admin_users.js"
    And the content should contain "createTable('admin_users'"
    And the content should contain "admin_user_name"

  Scenario: Test file generation with nested directory structure
    Given I have a template file with frontmatter:
      """
      ---
      to: tests/{{ testType }}/{{ moduleName | kebabCase }}/{{ testName | kebabCase }}.test.ts
      inject: false
      ---
      import { {{ moduleName | pascalCase }} } from '../../../src/{{ moduleName | kebabCase }}';
      
      describe('{{ moduleName | humanize }}', () => {
        describe('{{ testName | humanize }}', () => {
          it('should {{ behavior | lowerCase }}', () => {
            const {{ moduleName | camelCase }} = new {{ moduleName | pascalCase }}();
            // Test implementation
            expect({{ moduleName | camelCase }}).toBeDefined();
          });
        });
      });
      """
    And the variable "testType" has value "unit"
    And the variable "moduleName" has value "userService"
    And the variable "testName" has value "user_creation"
    And the variable "behavior" has value "Create New User Successfully"
    When I process the template
    Then the file should be created at "tests/unit/user-service/user-creation.test.ts"
    And the content should contain "import { UserService }"
    And the content should contain "describe('User service'"
    And the content should contain "describe('User creation'"
    And the content should contain "should create new user successfully"

  Scenario: Configuration file with environment-specific paths
    Given I have a template file with frontmatter:
      """
      ---
      to: config/{{ environment }}/{{ serviceName | kebabCase }}.json
      inject: false
      ---
      {
        "service": {
          "name": "{{ serviceName | humanize }}",
          "version": "1.0.0",
          "environment": "{{ environment }}",
          "database": {
            "host": "{{ environment }}.{{ serviceName | kebabCase }}.db.local",
            "database": "{{ serviceName | snakeCase }}_{{ environment }}"
          },
          "cache": {
            "prefix": "{{ serviceName | constantCase }}_{{ environment | upper }}_",
            "ttl": 3600
          },
          "logging": {
            "level": "{{ environment === 'production' ? 'warn' : 'debug' }}",
            "file": "logs/{{ serviceName | kebabCase }}-{{ environment }}.log"
          }
        }
      }
      """
    And the variable "serviceName" has value "user-auth"
    And the variable "environment" has value "staging"
    When I process the template
    Then the file should be created at "config/staging/user-auth.json"
    And the content should contain '"name": "User auth"'
    And the content should contain '"database": "user_auth_staging"'
    And the content should contain '"prefix": "USER_AUTH_STAGING_"'

  Scenario: Docker configuration with filtered values
    Given I have a template file with frontmatter:
      """
      ---
      to: docker/{{ serviceName | kebabCase }}/Dockerfile
      inject: false
      ---
      FROM node:18-alpine
      
      WORKDIR /app
      
      # Install dependencies
      COPY package*.json ./
      RUN npm ci --only=production
      
      # Copy source code
      COPY . .
      
      # Create non-root user
      RUN addgroup -g 1001 -S {{ serviceName | kebabCase }} && \
          adduser -S {{ serviceName | kebabCase }} -u 1001
      
      USER {{ serviceName | kebabCase }}
      
      EXPOSE {{ port || 3000 }}
      
      CMD ["node", "src/{{ entryPoint | kebabCase }}.js"]
      """
    And the variable "serviceName" has value "API_Gateway"
    And the variable "port" has value 8080
    And the variable "entryPoint" has value "serverMain"
    When I process the template
    Then the file should be created at "docker/api-gateway/Dockerfile"
    And the content should contain "addgroup -g 1001 -S api-gateway"
    And the content should contain "USER api-gateway"
    And the content should contain "EXPOSE 8080"
    And the content should contain 'CMD ["node", "src/server-main.js"]'