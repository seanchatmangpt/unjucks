Feature: Template Integration - End-to-End Rendering
  As a developer using Unjucks templates
  I want complete template processing with filters, frontmatter, and file operations
  So that I can generate entire project structures with proper file organization

  Background:
    Given Unjucks is initialized with all filter libraries
    And template discovery system is active
    And file injection system is configured
    And dry run mode is available for testing

  Scenario: Complete React component generation workflow
    Given I run the command "unjucks generate component react-functional --componentName UserProfile --withStyles --withTests --dest ./src"
    When the template system processes the request
    Then the following files should be generated:
      | File Path | Content Check |
      | src/components/UserProfile/UserProfile.jsx | export const UserProfile |
      | src/components/UserProfile/UserProfile.module.css | .user-profile { |
      | src/components/UserProfile/index.js | export { UserProfile } from './UserProfile' |
      | tests/components/UserProfile.test.js | describe('UserProfile', () => |
    And each file should contain properly filtered content
    And all import statements should use correct casing

  Scenario: REST API resource generation with database integration
    Given I run the command "unjucks generate api resource --resourceName BlogPost --withModel --withController --withRoutes --withTests --dest ./src"
    When the template system processes the request
    Then the following files should be generated:
      | File Path | Content Check |
      | src/models/BlogPost.js | class BlogPost extends Model |
      | src/controllers/BlogPostController.js | class BlogPostController |
      | src/routes/blogPosts.js | router.get('/blog-posts' |
      | src/middleware/blogPostValidation.js | validateBlogPost |
      | tests/integration/blogPosts.test.js | describe('Blog Posts API' |
      | database/migrations/create_blog_posts.js | createTable('blog_posts' |
    And the model should use "blog_posts" as table name
    And the routes should use "/blog-posts" paths
    And the controller should use "blogPosts" variable names

  Scenario: Database schema generation with relationships
    Given I run the command "unjucks generate database schema --entities User,BlogPost,Comment --withRelations --withSeeds --dest ./database"
    When the template system processes the request
    Then migration files should be created with timestamps
    And the User migration should contain:
      """
      table.increments('id');
      table.string('user_name').notNullable();
      table.string('email').unique();
      table.timestamps();
      """
    And the BlogPost migration should contain:
      """
      table.integer('user_id').unsigned().references('id').inTable('users');
      """
    And seed files should contain realistic fake data
    And all table names should be plural and snake_case

  Scenario: Full-stack application scaffolding
    Given I run the command "unjucks generate app fullstack --appName TaskManager --withAuth --withAPI --withUI --dest ./project"
    When the template system processes the request
    Then the project structure should include:
      | Directory | Purpose |
      | project/backend/src/models | Database models |
      | project/backend/src/controllers | API controllers |
      | project/backend/src/routes | API routes |
      | project/backend/src/middleware | Auth and validation |
      | project/frontend/src/components | React components |
      | project/frontend/src/pages | Application pages |
      | project/frontend/src/services | API client services |
      | project/database/migrations | Database migrations |
      | project/tests/unit | Unit tests |
      | project/tests/integration | Integration tests |
    And the backend should use "task-manager" as service name
    And the frontend should use "TaskManager" as app component name
    And all API endpoints should follow RESTful conventions

  Scenario: Microservice generation with Docker support
    Given I run the command "unjucks generate service microservice --serviceName UserAuth --withDocker --withK8s --withTests --dest ./services"
    When the template system processes the request
    Then the following files should be generated:
      | File Path | Content Check |
      | services/user-auth/package.json | "name": "user-auth" |
      | services/user-auth/src/server.js | const express = require('express') |
      | services/user-auth/Dockerfile | USER user-auth |
      | services/user-auth/docker-compose.yml | service: user-auth |
      | services/user-auth/k8s/deployment.yaml | name: user-auth-deployment |
      | services/user-auth/k8s/service.yaml | name: user-auth-service |
      | services/user-auth/.env.example | USER_AUTH_PORT=3000 |
    And the Docker image should use the kebab-case service name
    And the Kubernetes resources should use consistent naming

  Scenario: CLI tool generation with multiple commands
    Given I run the command "unjucks generate cli tool --toolName ProjectGen --commands init,create,deploy --dest ./cli"
    When the template system processes the request
    Then the CLI structure should include:
      | File Path | Content Check |
      | cli/bin/project-gen.js | #!/usr/bin/env node |
      | cli/lib/commands/init.js | exports.init = function |
      | cli/lib/commands/create.js | exports.create = function |
      | cli/lib/commands/deploy.js | exports.deploy = function |
      | cli/package.json | "bin": { "project-gen": "./bin/project-gen.js" } |
    And each command should be properly exported
    And the package.json should define the correct binary name

  Scenario: Testing framework setup with multiple test types
    Given I run the command "unjucks generate testing setup --framework jest --types unit,integration,e2e --withCoverage --dest ./tests"
    When the template system processes the request
    Then the test configuration should include:
      | File Path | Content Check |
      | tests/jest.config.js | testEnvironment: 'node' |
      | tests/setup/unit.setup.js | global setup for unit tests |
      | tests/setup/integration.setup.js | database setup and teardown |
      | tests/setup/e2e.setup.js | browser setup and teardown |
      | tests/utils/testHelpers.js | createMockUser function |
      | tests/fixtures/userData.js | realistic test data |
    And coverage thresholds should be properly configured
    And test patterns should match the project structure

  Scenario: Configuration generation for multiple environments
    Given I run the command "unjucks generate config multi-env --environments dev,staging,prod --withSecrets --dest ./config"
    When the template system processes the request
    Then environment-specific configs should be created:
      | File Path | Content Check |
      | config/dev/database.json | "database": "myapp_dev" |
      | config/staging/database.json | "database": "myapp_staging" |
      | config/prod/database.json | "database": "myapp_prod" |
      | config/dev/.env.example | DATABASE_URL=postgres://localhost/myapp_dev |
    And each environment should have appropriate settings
    And production config should have security-focused defaults

  Scenario: Library package generation with proper exports
    Given I run the command "unjucks generate lib package --libName DataUtils --withTypes --withDocs --withTests --dest ./packages"
    When the template system processes the request
    Then the package structure should include:
      | File Path | Content Check |
      | packages/data-utils/package.json | "name": "@myorg/data-utils" |
      | packages/data-utils/src/index.js | main library exports |
      | packages/data-utils/types/index.d.ts | TypeScript definitions |
      | packages/data-utils/README.md | # Data Utils |
      | packages/data-utils/tests/index.test.js | library functionality tests |
    And the package name should follow npm conventions
    And TypeScript definitions should match the exports

  Scenario: Workspace setup with multiple packages
    Given I run the command "unjucks generate workspace monorepo --packages api,web,shared --withLerna --dest ./workspace"
    When the template system processes the request
    Then the workspace should include:
      | File Path | Content Check |
      | workspace/package.json | "workspaces": ["packages/*"] |
      | workspace/lerna.json | "packages": ["packages/*"] |
      | workspace/packages/api/package.json | "name": "@workspace/api" |
      | workspace/packages/web/package.json | "name": "@workspace/web" |
      | workspace/packages/shared/package.json | "name": "@workspace/shared" |
    And package names should follow workspace conventions
    And cross-package dependencies should be properly configured

  Scenario: Template dry run validation
    Given I run the command "unjucks generate component react-class --componentName TestComponent --dry"
    When the template system processes the request in dry run mode
    Then no files should be created on disk
    But the output should show:
      """
      [DRY RUN] Would create: src/components/TestComponent.jsx
      [DRY RUN] Would create: src/components/TestComponent.css
      [DRY RUN] Would create: tests/TestComponent.test.js
      """
    And the preview should show filtered content
    And any errors should be reported without file creation

  Scenario: Template force overwrite existing files
    Given I run the command "unjucks generate model user --modelName User --dest ./src"
    And the file "src/models/User.js" already exists
    When I run the command "unjucks generate model user --modelName User --dest ./src --force"
    Then the existing file should be overwritten
    And the new content should contain updated model definition
    And a backup should be created with timestamp

  Scenario: Template with custom variable injection
    Given I run the command "unjucks generate service api --serviceName PaymentProcessor --customVar baseUrl=https://api.payments.com --customVar version=v2"
    When the template system processes the request
    Then the generated service should contain:
      """
      const BASE_URL = 'https://api.payments.com';
      const API_VERSION = 'v2';
      """
    And custom variables should be properly filtered
    And standard variables should still work correctly

  Scenario: Template error handling and validation
    Given I run the command "unjucks generate component invalid-template --componentName Test"
    When the template system encounters missing template files
    Then it should display a helpful error message:
      """
      Error: Template 'invalid-template' not found.
      Available templates:
        - react-functional
        - react-class
        - vue-component
      """
    And no partial files should be created
    And the exit code should indicate failure

  Scenario: Large scale project generation performance
    Given I run the command "unjucks generate project enterprise --modules user,auth,payment,notification,analytics --withTests --withDocs --dest ./enterprise"
    When the template system processes the large request
    Then all 50+ files should be generated successfully
    And the process should complete within reasonable time
    And memory usage should remain stable
    And all file references should be consistent across modules