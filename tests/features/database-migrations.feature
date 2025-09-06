Feature: Database Migration Generation from Templates
  As a database administrator or backend developer
  I want to generate database migrations from templates and schema definitions
  So that I can maintain consistent database schemas across environments with proper version control

  Background:
    Given I have a clean test environment
    And I have built the CLI
    And I have a database project directory

  Scenario: Generate SQL migration files
    Given I have a database migration template
    And I specify table schema changes
    When I generate SQL migrations
    Then migration files should be created with timestamps
    And up migration scripts should be generated
    And down migration scripts should be included
    And migration metadata should be recorded

  Scenario: Generate migrations from Turtle schema definitions
    Given I have a Turtle file with database schema
    And I have migration templates for different databases
    When I generate migrations from Turtle schema
    Then migrations should be created for each specified database
    And table definitions should match the Turtle schema
    And relationships should be properly represented
    And constraints should be correctly applied

  Scenario: Generate incremental schema changes
    Given I have existing database schema
    And I have updated schema requirements
    When I generate incremental migrations
    Then only changed components should be migrated
    And existing data should be preserved
    And migration order should be determined automatically
    And rollback instructions should be provided

  Scenario: Generate migrations with data seeding
    Given I have migration templates with seed data
    And I specify initial data requirements
    When I generate migrations with seeding
    Then schema migration files should be created
    And data seeding scripts should be generated
    And seed data should respect foreign key constraints
    And seeding should be idempotent

  Scenario: Generate multi-database migrations
    Given I have schema templates for multiple database engines
    And I specify target database types
    When I generate cross-database migrations
    Then migrations should be created for each database type
    And SQL syntax should be database-specific
    And data types should be properly converted
    And constraints should be database-appropriate

  Scenario: Generate migrations with index optimization
    Given I have schema templates with index definitions
    And I specify performance requirements
    When I generate optimized migrations
    Then appropriate indexes should be created
    And index strategies should match query patterns
    And composite indexes should be properly ordered
    And unique constraints should be enforced

  Scenario: Generate migrations with foreign key relationships
    Given I have schema templates with relationships
    And I specify referential integrity requirements
    When I generate relational migrations
    Then foreign key constraints should be created
    And referential actions should be defined
    And relationship indexes should be included
    And constraint naming should be consistent

  Scenario: Generate migrations with stored procedures
    Given I have migration templates with stored procedures
    And I specify business logic requirements
    When I generate procedural migrations
    Then stored procedure definitions should be created
    And procedure parameters should be properly typed
    And error handling should be included
    And procedure permissions should be set

  Scenario: Generate migrations with views and triggers
    Given I have schema templates with views and triggers
    And I specify data access patterns
    When I generate view and trigger migrations
    Then view definitions should be created
    And trigger logic should be implemented
    And trigger timing should be specified
    And view security should be configured

  Scenario: Inject migration into existing migration system
    Given I have an existing migration framework
    And I have new migration templates
    When I inject migrations into the existing system
    Then migrations should follow existing naming conventions
    And version numbers should be sequential
    And migration metadata should be compatible
    And existing migrations should remain functional

  Scenario: Generate rollback-safe migrations
    Given I have migration templates with rollback logic
    And I specify rollback requirements
    When I generate rollback-safe migrations
    Then down migrations should safely reverse changes
    And data loss should be prevented
    And constraint dependencies should be handled
    And rollback validation should be included

  Scenario: Generate migrations with environment-specific configurations
    Given I have migration templates with environment variables
    And I specify environment-specific requirements
    When I generate environment-aware migrations
    Then development migrations should include test data
    And production migrations should be optimized
    And staging migrations should match production
    And environment detection should be automated

  Scenario: Generate migrations with performance considerations
    Given I have schema templates with performance annotations
    And I specify performance requirements
    When I generate performance-optimized migrations
    Then large table migrations should be chunked
    And index creation should be non-blocking
    And migration timing should be estimated
    And performance impact should be documented

  Scenario: Dry run migration generation
    Given I have complete migration templates
    When I run migration generation in dry-run mode
    Then I should see all migration files that would be created
    And I should see the migration execution order
    And I should see SQL preview for each migration
    But no actual migration files should be created

  Scenario: Generate migrations with data transformation
    Given I have migration templates with data transformation logic
    And I specify data mapping requirements
    When I generate transformational migrations
    Then data transformation scripts should be created
    And data validation should be included
    And transformation progress should be trackable
    And transformation rollback should be possible

  Scenario: Generate migrations with audit trail support
    Given I have schema templates with audit requirements
    And I specify audit trail needs
    When I generate auditable migrations
    Then audit table definitions should be created
    And audit triggers should be implemented
    And audit data retention should be configured
    And audit query helpers should be generated