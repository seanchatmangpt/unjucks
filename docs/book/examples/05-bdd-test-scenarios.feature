# BDD Test Scenarios for Unjucks v2
# Comprehensive Behavior-Driven Development scenarios covering all major functionality

Feature: Template Discovery and Listing
  As a developer using Unjucks
  I want to discover available templates
  So that I can understand what generators are available for use

  Background:
    Given I have a project with Unjucks v2 installed
    And I have templates in the "_templates" directory

  Scenario: List all available generators
    Given the following template structure exists:
      """
      _templates/
      ├── service/
      │   └── new/
      │       ├── service.ts.njk
      │       └── service.test.ts.njk
      ├── component/
      │   └── new/
      │       ├── component.tsx.njk
      │       └── component.stories.tsx.njk
      └── api/
          └── rest/
              ├── controller.ts.njk
              └── routes.ts.njk
      """
    When I run "unjucks list"
    Then I should see the following generators listed:
      | Generator      | Description                    | Files |
      | service/new    | Generate TypeScript service   | 2     |
      | component/new  | Generate React component      | 2     |
      | api/rest       | Generate REST API endpoints   | 2     |
    And the output should include template paths
    And the output should show the number of template files for each generator

  Scenario: List generators with filtering
    Given I have generators for "service", "component", and "database" categories
    When I run "unjucks list --filter=service"
    Then I should only see service-related generators
    And component generators should not be shown
    And database generators should not be shown

  Scenario: Show detailed generator information
    Given I have a generator at "_templates/service/new"
    When I run "unjucks info service new"
    Then I should see detailed information including:
      | Property          | Value                         |
      | Name              | service/new                   |
      | Template Files    | service.ts.njk, service.test.ts.njk |
      | Variables         | className, databaseType       |
      | Output Directory  | ./src/services               |
    And I should see variable descriptions and types

Feature: Template Variable Extraction and Validation
  As a developer
  I want to understand what variables a template requires
  So that I can provide the correct inputs for generation

  Scenario: Extract variables from template frontmatter
    Given I have a template file "service.ts.njk" with frontmatter:
      """
      ---
      to: src/services/<%= className %>.ts
      variables:
        className:
          type: string
          required: true
          pattern: "^[A-Z][a-zA-Z0-9]*$"
          description: "Service class name in PascalCase"
        databaseType:
          type: enum
          values: ["postgresql", "mysql", "mongodb"]
          default: "postgresql"
          description: "Database type for the service"
        enableAuth:
          type: boolean
          default: false
          description: "Enable authentication middleware"
      ---
      """
    When I run "unjucks help service new"
    Then I should see the following variable information:
      """
      Variables for service/new:
      
      className (required)
        Type: string
        Pattern: ^[A-Z][a-zA-Z0-9]*$
        Description: Service class name in PascalCase
      
      databaseType (optional)
        Type: enum [postgresql, mysql, mongodb]
        Default: postgresql
        Description: Database type for the service
      
      enableAuth (optional)
        Type: boolean
        Default: false
        Description: Enable authentication middleware
      """

  Scenario: Generate CLI flags from template variables
    Given I have a template with variables "className", "databaseType", and "enableAuth"
    When I run "unjucks help service new"
    Then I should see the available CLI flags:
      """
      Usage: unjucks generate service new [options]
      
      Options:
        --className <string>           Service class name in PascalCase (required)
        --databaseType <postgresql|mysql|mongodb>  Database type (default: postgresql)
        --enableAuth                   Enable authentication middleware
        --no-enableAuth               Disable authentication middleware
        --output <path>               Output directory (default: ./src/services)
        --dry-run                     Show what would be generated without creating files
        --force                       Overwrite existing files
      """

  Scenario: Validate required variables
    Given I have a template that requires "className" variable
    When I run "unjucks generate service new --databaseType=postgresql"
    Then I should see an error: "Missing required variable: className"
    And no files should be generated
    And the exit code should be 1

  Scenario: Validate variable patterns
    Given I have a template with className pattern "^[A-Z][a-zA-Z0-9]*$"
    When I run "unjucks generate service new --className=invalidName"
    Then I should see an error: "Variable 'className' does not match required pattern"
    And the error should suggest valid examples
    And no files should be generated

Feature: Code Generation and File Creation
  As a developer
  I want to generate code from templates
  So that I can quickly scaffold new components and services

  Scenario: Generate simple service with all variables provided
    Given I have a service template at "_templates/service/new"
    And the template requires variables: className, databaseType
    When I run "unjucks generate service new --className=UserService --databaseType=postgresql --output=./src/services"
    Then the following files should be created:
      | File                              | Content Includes                    |
      | src/services/UserService.ts       | class UserService                   |
      | src/services/UserService.test.ts  | describe('UserService')             |
    And the files should contain the correct variable substitutions
    And the output directory should be created if it doesn't exist

  Scenario: Generate with default variables
    Given I have a template with default values:
      | Variable     | Default    |
      | databaseType | postgresql |
      | enableAuth   | false      |
    When I run "unjucks generate service new --className=UserService"
    Then the generated code should use the default values
    And the service should be configured for postgresql
    And authentication should be disabled

  Scenario: Generate with complex template structure
    Given I have a template structure:
      """
      _templates/api/rest/
      ├── controller.ts.njk
      ├── routes.ts.njk
      ├── dto/
      │   ├── create-dto.ts.njk
      │   └── update-dto.ts.njk
      └── tests/
          ├── controller.test.ts.njk
          └── integration.test.ts.njk
      """
    When I run "unjucks generate api rest --entityName=User --includeValidation=true"
    Then the following directory structure should be created:
      """
      src/api/user/
      ├── user.controller.ts
      ├── user.routes.ts
      ├── dto/
      │   ├── create-user.dto.ts
      │   └── update-user.dto.ts
      └── tests/
          ├── user.controller.test.ts
          └── user.integration.test.ts
      """

  Scenario: Generate with conditional file inclusion
    Given I have a template with conditional files based on "includeTests" variable
    When I run "unjucks generate service new --className=UserService --includeTests=false"
    Then test files should not be generated
    And only the main service file should be created

  Scenario: Generate with dynamic file naming
    Given I have a template with dynamic file paths:
      """
      ---
      to: src/<%= category %>/<%= name.toLowerCase() %>/<%= name %>.ts
      ---
      """
    When I run "unjucks generate component new --name=UserProfile --category=components"
    Then the file should be created at "src/components/userprofile/UserProfile.ts"

Feature: Dry Run and Preview Functionality
  As a developer
  I want to preview what will be generated
  So that I can verify the output before actually creating files

  Scenario: Dry run shows planned file operations
    Given I have a service template
    When I run "unjucks generate service new --className=UserService --dry-run"
    Then I should see output like:
      """
      Dry run - no files will be created:
      
      Would create:
      ✓ src/services/UserService.ts (1.2 KB)
      ✓ src/services/UserService.test.ts (0.8 KB)
      
      Variables:
      - className: UserService
      - databaseType: postgresql (default)
      - enableAuth: false (default)
      
      Total files: 2
      Total size: ~2.0 KB
      """
    And no actual files should be created

  Scenario: Dry run shows variable validation errors
    Given I have a template requiring "className" variable
    When I run "unjucks generate service new --dry-run"
    Then I should see validation errors in the dry run output
    And the dry run should fail with error messages
    And no file creation should be planned

  Scenario: Dry run shows file conflicts
    Given I have existing files that would be overwritten
    When I run "unjucks generate service new --className=ExistingService --dry-run"
    Then I should see warnings about file conflicts:
      """
      Dry run - no files will be created:
      
      Conflicts detected:
      ⚠ src/services/ExistingService.ts already exists
      ⚠ src/services/ExistingService.test.ts already exists
      
      Use --force to overwrite existing files
      """

Feature: File Injection and Modification
  As a developer
  I want to inject code into existing files
  So that I can add new functionality without rewriting entire files

  Background:
    Given I have an existing Express app file:
      """
      import express from 'express';
      
      const app = express();
      
      // Routes will be injected here
      
      export default app;
      """

  Scenario: Inject route into existing Express app
    Given I have a route injection template:
      """
      ---
      inject: true
      to: src/app.ts
      before: "export default app;"
      skipIf: "router.<%= routeName %>"
      ---
      app.use('/api/<%= routeName %>', <%= routeName %>Router);
      """
    When I run "unjucks generate route user --routeName=users"
    Then the app.ts file should contain:
      """
      import express from 'express';
      
      const app = express();
      
      // Routes will be injected here
      app.use('/api/users', usersRouter);
      
      export default app;
      """
    And running the same command again should not duplicate the injection

  Scenario: Inject import statements
    Given I have an import injection template:
      """
      ---
      inject: true
      to: src/app.ts
      after: "import express from 'express';"
      skipIf: "import.*<%= routeName %>Router"
      ---
      import { <%= routeName %>Router } from './routes/<%= routeName %>';
      """
    When I run "unjucks generate route user --routeName=users"
    Then the import should be added after the express import
    And duplicate imports should be prevented by skipIf

  Scenario: Inject code at specific line number
    Given I have a line-specific injection template:
      """
      ---
      inject: true
      to: src/app.ts
      lineAt: 5
      ---
      // Middleware configuration
      app.use(express.json());
      """
    When I run the injection
    Then the code should be inserted at line 5
    And existing lines should be shifted down

  Scenario: Conditional injection based on file content
    Given I have a conditional injection template:
      """
      ---
      inject: true
      to: src/app.ts
      before: "export default app;"
      skipIf: "cors"
      condition: "!includesCors"
      ---
      import cors from 'cors';
      app.use(cors());
      """
    When I run the injection on a file that already includes cors
    Then the injection should be skipped
    And no duplicate cors configuration should be added

Feature: Force Overwrite and Conflict Resolution
  As a developer
  I want to handle file conflicts gracefully
  So that I can update existing code or prevent accidental overwrites

  Scenario: Prevent accidental file overwrite by default
    Given I have an existing file "src/services/UserService.ts"
    When I run "unjucks generate service new --className=UserService"
    Then I should see an error: "File already exists: src/services/UserService.ts"
    And the error should suggest using "--force" to overwrite
    And the existing file should remain unchanged

  Scenario: Force overwrite existing files
    Given I have an existing file "src/services/UserService.ts" with content:
      """
      export class UserService {
        // old implementation
      }
      """
    When I run "unjucks generate service new --className=UserService --force"
    Then the file should be overwritten with new content
    And the old implementation should be replaced
    And I should see a warning about the overwrite

  Scenario: Interactive conflict resolution
    Given I have existing files that conflict with generation
    And I run "unjucks generate service new --className=UserService --interactive"
    Then I should be prompted for each conflicting file:
      """
      File exists: src/services/UserService.ts
      
      Options:
      1. Skip this file
      2. Overwrite
      3. Rename new file
      4. View diff
      
      Choose an option [1-4]:
      """
    And I can choose different actions for each file

  Scenario: Backup files before overwriting
    Given I have existing files
    When I run "unjucks generate service new --className=UserService --force --backup"
    Then backup files should be created with ".bak" extension
    And the original files should be overwritten
    And I should see confirmation of backup creation

Feature: Template Frontmatter Processing
  As a template author
  I want to use frontmatter to control file generation
  So that I can create flexible and powerful templates

  Scenario: Basic frontmatter processing
    Given I have a template with frontmatter:
      """
      ---
      to: src/<%= category %>/<%= className %>.ts
      ---
      export class <%= className %> {
        constructor() {}
      }
      """
    When I generate with variables "className=UserService" and "category=services"
    Then the file should be created at "src/services/UserService.ts"
    And the class name should be "UserService"

  Scenario: Conditional file generation with frontmatter
    Given I have a template with conditional frontmatter:
      """
      ---
      to: src/services/<%= className %>.test.ts
      condition: <%= includeTests %>
      ---
      import { <%= className %> } from './<%= className %>';
      
      describe('<%= className %>', () => {
        it('should be defined', () => {
          expect(<%= className %>).toBeDefined();
        });
      });
      """
    When I generate with "includeTests=false"
    Then the test file should not be created
    When I generate with "includeTests=true"
    Then the test file should be created

  Scenario: File permissions in frontmatter
    Given I have a template with chmod directive:
      """
      ---
      to: scripts/<%= scriptName %>.sh
      chmod: 755
      ---
      #!/bin/bash
      echo "Running <%= scriptName %> script"
      """
    When I generate the script
    Then the generated file should have execute permissions
    And the file mode should be 755

  Scenario: Post-generation shell commands
    Given I have a template with shell execution:
      """
      ---
      to: src/services/<%= className %>.ts
      sh: "npm run lint:fix <%= to %>"
      ---
      export class <%= className %> {}
      """
    When I generate the service
    Then the file should be created
    And the lint command should be executed on the generated file

Feature: Advanced Template Features
  As a template author
  I want to use advanced template features
  So that I can create sophisticated code generation templates

  Scenario: Loop-based file generation
    Given I have a template that generates multiple files:
      """
      ---
      forEach: entities
      to: src/models/<%= entity.name %>.ts
      ---
      export interface <%= entity.name %> {
        <% entity.fields.forEach(field => { %>
        <%= field.name %>: <%= field.type %>;
        <% }) %>
      }
      """
    And I provide variables:
      """
      {
        "entities": [
          {
            "name": "User",
            "fields": [{"name": "id", "type": "string"}, {"name": "email", "type": "string"}]
          },
          {
            "name": "Post", 
            "fields": [{"name": "id", "type": "string"}, {"name": "title", "type": "string"}]
          }
        ]
      }
      """
    When I run the generation
    Then files should be created for each entity:
      | File              | Content                           |
      | src/models/User.ts | interface User with id and email  |
      | src/models/Post.ts | interface Post with id and title  |

  Scenario: Template inheritance and extension
    Given I have a base template "base-service.ts.njk":
      """
      ---
      base: true
      ---
      export abstract class BaseService {
        protected abstract getName(): string;
      }
      """
    And a template that extends it:
      """
      ---
      extends: base-service
      to: src/services/<%= className %>.ts
      ---
      import { BaseService } from './BaseService';
      
      export class <%= className %> extends BaseService {
        protected getName(): string {
          return '<%= className %>';
        }
      }
      """
    When I generate the extended service
    Then the base service should be generated first
    And the extended service should import and extend the base

  Scenario: Template partials and includes
    Given I have a partial template "_validation.njk":
      """
      if (!this.<%= field %>) {
        throw new Error('<%= field %> is required');
      }
      """
    And a template that includes it:
      """
      ---
      to: src/services/<%= className %>.ts
      ---
      export class <%= className %> {
        validate(): void {
          <% requiredFields.forEach(field => { %>
          <%- include('_validation', { field: field }) %>
          <% }) %>
        }
      }
      """
    When I generate with required fields ["name", "email"]
    Then the generated service should include validation for each field

Feature: Error Handling and Debugging
  As a developer using Unjucks
  I want clear error messages and debugging information
  So that I can troubleshoot issues with templates and generation

  Scenario: Template syntax error handling
    Given I have a template with invalid Nunjucks syntax:
      """
      ---
      to: src/<%= className %>.ts
      ---
      export class <%= className %> {
        {% invalid syntax here %}
      }
      """
    When I run "unjucks generate service new --className=UserService"
    Then I should see a clear syntax error message:
      """
      Template Syntax Error in service/new/service.ts.njk:
      Line 5: unexpected token: invalid
      
      {% invalid syntax here %}
         ^^^^^
      
      Fix the template syntax and try again.
      """
    And the error should include line numbers and context

  Scenario: Variable reference error
    Given I have a template that references an undefined variable:
      """
      export class <%= className %> {
        private type = '<%= undefinedVariable %>';
      }
      """
    When I run the generation
    Then I should see a variable error:
      """
      Template Error: Undefined variable 'undefinedVariable' in template
      
      Available variables:
      - className: UserService
      - databaseType: postgresql
      
      Check your template for typos or provide the missing variable.
      """

  Scenario: File system permission errors
    Given I try to generate files in a read-only directory
    When I run the generation
    Then I should see a clear file system error:
      """
      File System Error: Permission denied
      Cannot write to: /read-only-dir/service.ts
      
      Check directory permissions or choose a different output path.
      """

  Scenario: Verbose debugging mode
    Given I want to debug template processing
    When I run "unjucks generate service new --className=UserService --verbose"
    Then I should see detailed processing information:
      """
      [DEBUG] Loading template: _templates/service/new/service.ts.njk
      [DEBUG] Parsing frontmatter...
      [DEBUG] Variables: {"className": "UserService", "databaseType": "postgresql"}
      [DEBUG] Resolving output path: src/services/UserService.ts
      [DEBUG] Rendering template...
      [DEBUG] Template rendered successfully (1.2KB)
      [DEBUG] Writing file: src/services/UserService.ts
      [INFO] Generated: src/services/UserService.ts
      """

Feature: Performance and Optimization
  As a developer
  I want Unjucks to perform well with large templates and projects
  So that code generation doesn't slow down my development workflow

  Scenario: Large template processing
    Given I have a template that generates 50+ files
    When I run the generation
    Then it should complete within 5 seconds
    And memory usage should remain reasonable
    And I should see progress indicators:
      """
      Generating files... 23/52 (44%)
      ✓ Generated UserService.ts
      ✓ Generated UserController.ts
      ...
      """

  Scenario: Template caching
    Given I generate from the same template multiple times
    When I run generation commands repeatedly
    Then subsequent runs should be faster due to template caching
    And the cache should be invalidated when templates change

  Scenario: Parallel file generation
    Given I have templates that generate independent files
    When I run generation with multiple templates
    Then files should be generated in parallel when possible
    And the total time should be less than sequential generation

  Scenario: Memory efficient template processing
    Given I have templates with large variable datasets
    When I process templates with streaming
    Then memory usage should remain constant regardless of data size
    And large templates should not cause memory exhaustion

Feature: Configuration and Customization
  As a developer
  I want to customize Unjucks behavior for my project
  So that it works optimally with my specific requirements

  Scenario: Project configuration file
    Given I have an "unjucks.config.js" file:
      """
      export default {
        templateDirectory: './my-templates',
        outputDirectory: './generated',
        defaultVariables: {
          author: 'My Company',
          license: 'MIT'
        },
        plugins: ['typescript-plugin', 'prettier-plugin']
      }
      """
    When I run any generation command
    Then it should use the custom template directory
    And default variables should be automatically included
    And specified plugins should be loaded

  Scenario: Environment-specific configuration
    Given I have environment-specific settings:
      """
      export default {
        development: {
          outputDirectory: './src',
          verbose: true
        },
        production: {
          outputDirectory: './dist',
          optimize: true,
          minify: true
        }
      }
      """
    When I run "NODE_ENV=production unjucks generate"
    Then production settings should be applied
    And files should be generated in the dist directory

  Scenario: Global vs project configuration
    Given I have both global and project configurations
    And the project config overrides some global settings
    When I run generation
    Then project-specific settings should take precedence
    And global settings should be used for unspecified options

Feature: Plugin Integration and Extension
  As a developer
  I want to extend Unjucks with plugins
  So that I can add custom functionality and integrations

  Scenario: Auto-formatting plugin integration
    Given I have a Prettier plugin configured
    When I generate code files
    Then they should be automatically formatted according to project settings
    And the formatting should happen after generation

  Scenario: Linting plugin integration  
    Given I have an ESLint plugin configured
    When I generate TypeScript files
    Then they should pass linting rules
    And any linting issues should be reported

  Scenario: Git integration plugin
    Given I have a Git plugin that auto-commits generated files
    When I run generation with "--commit" flag
    Then generated files should be automatically committed
    And the commit message should describe what was generated

  Scenario: Custom template filters
    Given I have registered a custom filter "kebabCase"
    And I use it in a template: "<%= className | kebabCase %>"
    When I generate with "className=UserService"
    Then the output should contain "user-service"
    And the custom filter should be applied correctly