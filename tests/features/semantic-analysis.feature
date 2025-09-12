Feature: Semantic Analysis for Meaningful Change Detection
  As a KGEN developer
  I want to identify meaningful semantic changes
  So that I can distinguish between significant and trivial modifications

  Background:
    Given the semantic analysis engine is initialized
    And AST parsing is enabled
    And type system analysis is configured

  @semantic-analysis @type-changes
  Scenario: Detect meaningful type system changes
    Given I have a TypeScript interface "UserProfile"
    And it contains property "age: number"
    When the property changes to "age: string"
    Then semantic analysis should detect "TYPE_CHANGE"
    And classify as "HIGH" impact
    And report "Breaking type change: number to string"
    And suggest migration path

  @semantic-analysis @function-signature
  Scenario: Analyze function signature modifications
    Given I have a function "calculateDiscount(price: number, rate: number): number"
    When the signature changes to "calculateDiscount(price: number, rate: number, taxRate?: number): number"
    Then semantic analysis should detect "SIGNATURE_EXTENSION"
    And classify as "LOW" impact
    And report "Backward-compatible parameter addition"
    When the signature changes to "calculateDiscount(price: number): number"
    Then semantic analysis should detect "SIGNATURE_BREAKING"
    And classify as "HIGH" impact
    And report "Breaking change: required parameter removed"

  @semantic-analysis @api-contract
  Scenario: Detect API contract violations
    Given I have an API endpoint interface "POST /users"
    And it expects request body with "email: string, password: string"
    When the interface changes to require "email: string, password: string, terms: boolean"
    Then semantic analysis should detect "API_CONTRACT_CHANGE"
    And classify as "MEDIUM" impact
    And report "New required field breaks existing clients"
    And generate client migration guide

  @semantic-analysis @inheritance-hierarchy
  Scenario: Analyze inheritance and composition changes
    Given I have a class hierarchy "Animal -> Dog -> GermanShepherd"
    When "Dog" class is removed from the hierarchy
    And "GermanShepherd" now extends "Animal" directly
    Then semantic analysis should detect "INHERITANCE_RESTRUCTURE"
    And classify as "HIGH" impact
    And report "Class hierarchy modification affects polymorphism"
    And identify affected method signatures

  @semantic-analysis @data-flow
  Scenario: Track data flow semantic changes
    Given I have a data pipeline "input -> validate -> transform -> output"
    When the "transform" step changes algorithm
    And input/output schemas remain the same
    But transformation logic differs significantly
    Then semantic analysis should detect "LOGIC_CHANGE"
    And classify as "MEDIUM" impact
    And report "Data transformation algorithm modified"
    And flag for behavioral testing

  @semantic-analysis @export-interface
  Scenario: Detect public interface modifications
    Given I have a module exporting "getUserData, saveUserData, deleteUser"
    When "deleteUser" function is removed from exports
    And internal implementation still exists
    Then semantic analysis should detect "PUBLIC_API_CHANGE"
    And classify as "HIGH" impact
    And report "Public function removed from module exports"
    And list dependent modules

  @semantic-analysis @constant-changes
  Scenario: Analyze constant and configuration changes
    Given I have constants "MAX_RETRY_ATTEMPTS = 3, TIMEOUT_MS = 5000"
    When values change to "MAX_RETRY_ATTEMPTS = 5, TIMEOUT_MS = 10000"
    Then semantic analysis should detect "CONFIGURATION_CHANGE"
    And classify as "LOW" impact
    And report "Non-breaking configuration update"
    When "MAX_RETRY_ATTEMPTS" is removed entirely
    Then classify as "HIGH" impact
    And report "Configuration constant removed"

  @semantic-analysis @generic-constraints
  Scenario: Detect generic type constraint changes
    Given I have a generic function "process<T extends Serializable>(data: T): T"
    When constraint changes to "process<T extends Serializable & Validatable>(data: T): T"
    Then semantic analysis should detect "CONSTRAINT_TIGHTENING"
    And classify as "HIGH" impact
    And report "Generic constraint became more restrictive"
    And list types that no longer satisfy constraint

  @semantic-analysis @async-patterns
  Scenario: Analyze asynchronous pattern changes
    Given I have a function returning "Promise<User>"
    When the function changes to return "Observable<User>"
    Then semantic analysis should detect "ASYNC_PATTERN_CHANGE"
    And classify as "HIGH" impact
    And report "Async pattern changed from Promise to Observable"
    And suggest refactoring patterns

  @semantic-analysis @error-handling
  Scenario: Detect error handling semantic changes
    Given I have a function that throws "UserNotFoundError"
    When the function changes to return "null" instead of throwing
    Then semantic analysis should detect "ERROR_HANDLING_CHANGE"
    And classify as "HIGH" impact
    And report "Error handling changed from exception to null return"
    And identify call sites requiring updates

  @semantic-analysis @performance-implications
  Scenario: Identify performance-impacting changes
    Given I have a function with O(1) time complexity using HashMap
    When implementation changes to O(n) using linear search
    Then semantic analysis should detect "PERFORMANCE_REGRESSION"
    And classify as "MEDIUM" impact
    And report "Algorithm complexity changed from O(1) to O(n)"
    And estimate performance impact

  @semantic-analysis @dependency-injection
  Scenario: Analyze dependency injection changes
    Given I have a constructor "UserService(userRepo: UserRepository)"
    When constructor changes to "UserService(userRepo: UserRepository, logger: Logger)"
    Then semantic analysis should detect "DEPENDENCY_ADDITION"
    And classify as "MEDIUM" impact
    And report "New required dependency: Logger"
    And check DI container configuration

  @semantic-analysis @feature-flags
  Scenario: Detect feature flag semantic impact
    Given I have code with feature flag "ENABLE_NEW_ALGORITHM"
    When the flag is removed and new algorithm becomes default
    Then semantic analysis should detect "FEATURE_FLAG_REMOVAL"
    And classify as "MEDIUM" impact
    And report "Feature flag removed, behavior now permanent"
    And verify backward compatibility

  @semantic-analysis @database-schema
  Scenario: Analyze database schema changes in ORM models
    Given I have a model "User" with property "email: string"
    When property changes to "email: string & { unique: true }"
    Then semantic analysis should detect "SCHEMA_CONSTRAINT_ADDITION"
    And classify as "HIGH" impact
    And report "Database constraint added to email field"
    And generate migration script

  @semantic-analysis @impact-scoring
  Scenario: Calculate semantic change impact scores
    Given I have analyzed 10 semantic changes
    And changes include: 2 HIGH impact, 3 MEDIUM impact, 5 LOW impact
    When I request overall impact score
    Then semantic analysis should calculate weighted score
    And return impact rating of "MEDIUM" overall
    And provide breakdown by category
    And suggest deployment risk level