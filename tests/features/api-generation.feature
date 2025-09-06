Feature: API Generation from Templates
  As a backend developer
  I want to generate REST API endpoints from templates
  So that I can quickly scaffold consistent API structures with proper routing, validation, and documentation

  Background:
    Given I have a clean test environment
    And I have built the CLI
    And I have a project directory with package.json

  Scenario: Generate basic REST API endpoints
    Given I have an API template with CRUD operations
    And I specify an entity name "User"
    When I generate the API endpoints
    Then I should get controller files with CRUD methods
    And I should get route definitions
    And I should get data validation schemas
    And I should get API documentation

  Scenario: Generate API with custom business logic
    Given I have an API template with custom actions
    And I provide business logic specifications
    When I generate the API with custom actions
    Then the generated endpoints should include custom methods
    And the routing should handle custom paths
    And the validation should support custom rules

  Scenario: Generate API with authentication middleware
    Given I have an API template with authentication
    And I specify authentication requirements
    When I generate the authenticated API
    Then the generated endpoints should include auth middleware
    And protected routes should require authentication
    And JWT token validation should be implemented

  Scenario: Generate API with database integration
    Given I have an API template with database operations
    And I have database configuration
    When I generate the database-integrated API
    Then the generated code should include database models
    And CRUD operations should use the database
    And database migrations should be created

  Scenario: Generate API with OpenAPI documentation
    Given I have an API template with OpenAPI specs
    And I provide API metadata
    When I generate the documented API
    Then OpenAPI specification files should be created
    And endpoint documentation should be generated
    And Swagger UI configuration should be included

  Scenario: Generate API with input validation
    Given I have an API template with validation schemas
    And I specify validation rules
    When I generate the validated API
    Then request validation middleware should be created
    And validation schemas should be defined
    And error handling should return proper validation errors

  Scenario: Generate API with rate limiting
    Given I have an API template with rate limiting
    And I specify rate limit configurations
    When I generate the rate-limited API
    Then rate limiting middleware should be included
    And rate limit configurations should be set
    And rate limit error responses should be defined

  Scenario: Generate API with testing setup
    Given I have an API template with test scaffolding
    And I specify test requirements
    When I generate the API with tests
    Then unit tests for controllers should be created
    And integration tests for endpoints should be created
    And test data fixtures should be generated

  Scenario: Inject API routes into existing application
    Given I have an existing Express application
    And I have API route templates
    When I inject the new API routes
    Then the routes should be added to existing route files
    And the main application should remain functional
    And no duplicate routes should be created

  Scenario: Generate API with error handling
    Given I have an API template with error handling
    And I specify error handling strategies
    When I generate the error-handled API
    Then global error handlers should be created
    And custom error classes should be defined
    And error responses should be standardized

  Scenario: Generate API with logging and monitoring
    Given I have an API template with logging
    And I specify monitoring requirements
    When I generate the monitored API
    Then request logging middleware should be included
    And performance metrics should be tracked
    And health check endpoints should be created

  Scenario: Generate API with caching layer
    Given I have an API template with caching
    And I specify caching strategies
    When I generate the cached API
    Then caching middleware should be implemented
    And cache invalidation logic should be included
    And cache configuration should be set up

  Scenario: Dry run API generation
    Given I have an API template configured
    When I run the API generation in dry-run mode
    Then I should see a preview of all files to be generated
    And I should see the file structure
    And no actual files should be created
    And I should see variable substitutions

  Scenario: Generate API with TypeScript support
    Given I have an API template with TypeScript
    And I specify TypeScript configuration
    When I generate the TypeScript API
    Then TypeScript interface definitions should be created
    And type-safe controllers should be generated
    And TypeScript configuration should be included

  Scenario: Generate API with microservice architecture
    Given I have microservice API templates
    And I specify service boundaries
    When I generate microservice APIs
    Then separate service modules should be created
    And inter-service communication should be configured
    And service discovery should be implemented