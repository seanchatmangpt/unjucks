Feature: Service Scaffolding from Templates
  As a full-stack developer
  I want to scaffold complete service architectures from templates
  So that I can rapidly create consistent, production-ready services with best practices

  Background:
    Given I have a clean test environment
    And I have built the CLI
    And I have a workspace directory

  Scenario: Scaffold complete Node.js service
    Given I have a Node.js service template
    And I specify service configuration
    When I scaffold the Node.js service
    Then I should get a complete project structure
    And I should get dependency management files
    And I should get development scripts
    And I should get production deployment files

  Scenario: Scaffold microservice with Docker
    Given I have a microservice template with containerization
    And I specify Docker configuration
    When I scaffold the containerized microservice
    Then Dockerfile should be generated
    And docker-compose files should be created
    And container health checks should be included
    And environment configuration should be set up

  Scenario: Scaffold service with database layers
    Given I have a service template with database integration
    And I specify database type and schema
    When I scaffold the database-integrated service
    Then database connection modules should be created
    And ORM/ODM configurations should be generated
    And migration scripts should be included
    And database seeding files should be created

  Scenario: Scaffold service with authentication system
    Given I have a service template with authentication
    And I specify authentication strategy
    When I scaffold the authenticated service
    Then authentication middleware should be generated
    And user management endpoints should be created
    And JWT token handling should be implemented
    And password security should be configured

  Scenario: Scaffold service with API documentation
    Given I have a service template with documentation
    And I specify documentation requirements
    When I scaffold the documented service
    Then API documentation should be generated
    And interactive API explorer should be set up
    And documentation build scripts should be included
    And README files should be created

  Scenario: Scaffold service with testing framework
    Given I have a service template with comprehensive testing
    And I specify testing requirements
    When I scaffold the tested service
    Then unit test scaffolds should be created
    And integration test setups should be generated
    And test configuration files should be included
    And CI testing scripts should be created

  Scenario: Scaffold service with monitoring and logging
    Given I have a service template with observability
    And I specify monitoring requirements
    When I scaffold the observable service
    Then logging configuration should be generated
    And metrics collection should be set up
    And health check endpoints should be created
    And error tracking should be configured

  Scenario: Scaffold service with caching strategy
    Given I have a service template with caching
    And I specify caching requirements
    When I scaffold the cached service
    Then caching layers should be implemented
    And cache invalidation strategies should be set up
    And cache configuration should be generated
    And cache monitoring should be included

  Scenario: Scaffold service with event-driven architecture
    Given I have a service template with event handling
    And I specify event requirements
    When I scaffold the event-driven service
    Then event publishers should be generated
    And event subscribers should be created
    And event schema definitions should be included
    And event bus configuration should be set up

  Scenario: Scaffold service with security hardening
    Given I have a service template with security features
    And I specify security requirements
    When I scaffold the secured service
    Then security middleware should be implemented
    And input sanitization should be configured
    And rate limiting should be set up
    And security headers should be configured

  Scenario: Inject service modules into existing codebase
    Given I have an existing service codebase
    And I have modular service templates
    When I inject new service modules
    Then new modules should be integrated seamlessly
    And existing functionality should remain intact
    And dependencies should be properly managed
    And configuration should be updated appropriately

  Scenario: Scaffold service with GraphQL API
    Given I have a GraphQL service template
    And I specify GraphQL schema requirements
    When I scaffold the GraphQL service
    Then GraphQL schema definitions should be created
    And resolvers should be generated
    And GraphQL middleware should be set up
    And GraphQL playground should be configured

  Scenario: Scaffold service with real-time features
    Given I have a service template with WebSocket support
    And I specify real-time requirements
    When I scaffold the real-time service
    Then WebSocket server configuration should be generated
    And real-time event handlers should be created
    And connection management should be implemented
    And real-time authentication should be set up

  Scenario: Scaffold service with background job processing
    Given I have a service template with job queues
    And I specify job processing requirements
    When I scaffold the job-enabled service
    Then job queue configuration should be generated
    And job processors should be created
    And job scheduling should be set up
    And job monitoring should be implemented

  Scenario: Dry run service scaffolding
    Given I have a complete service template
    When I run scaffolding in dry-run mode
    Then I should see all files that would be generated
    And I should see the complete directory structure
    And I should see all variable substitutions
    But no actual files should be created

  Scenario: Scaffold multi-language service
    Given I have service templates for multiple languages
    And I specify language preferences
    When I scaffold the polyglot service
    Then services in specified languages should be generated
    And inter-service communication should be configured
    And shared schemas should be created
    And deployment orchestration should be set up