@performance @validation @comprehensive
Feature: HYGEN-DELTA Performance Validation
  As a developer using Unjucks
  I want to validate all performance claims in HYGEN-DELTA.md
  So that I can verify performance improvements over Hygen

  Background:
    Given I have a clean test workspace
    And the Unjucks CLI is available
    And performance monitoring is enabled

  @cold-start-performance @validation
  Scenario: Cold start performance meets 25% improvement claim
    Given I measure Unjucks cold start time
    When I run "unjucks --version" from a fresh terminal
    Then the cold start should complete within 150ms
    And the performance should be 25% faster than Hygen's ~200ms
    And memory usage should remain under 20MB

  @template-processing-performance @validation
  Scenario: Template processing achieves 40% improvement claim
    Given I have a complex template with multiple variables and filters
    When I process the template multiple times
    Then template processing should average under 30ms per operation
    And the performance should be 40% faster than Hygen's ~50ms
    And template caching should improve subsequent runs

  @file-operations-performance @validation  
  Scenario: File operations achieve 25% improvement claim
    Given I have file operations to perform (create, modify, inject)
    When I execute the file operations
    Then file operations should complete within 15ms average
    And the performance should be 25% faster than Hygen's ~20ms
    And concurrent operations should scale efficiently

  @memory-usage-performance @validation
  Scenario: Memory usage achieves 20% reduction claim
    Given I monitor memory usage during operations
    When I perform various Unjucks operations
    Then memory usage should remain under 20MB average
    And the usage should be 20% less than Hygen's ~25MB
    And memory should be released properly after operations

  @concurrent-processing @validation
  Scenario: Concurrent template processing scales efficiently
    Given I have 10 templates to process simultaneously
    When I run them concurrently
    Then concurrent processing should complete within 200ms total
    And individual template time should not degrade significantly
    And memory usage should scale sub-linearly

  @large-project-performance @validation
  Scenario: Performance scales with project size
    Given I have projects of different sizes:
      | Project Size | Template Count | Expected Time |
      | Small        | 5 templates    | < 100ms       |
      | Medium       | 50 templates   | < 500ms       |
      | Large        | 200 templates  | < 2000ms      |
    When I run operations on each project size
    Then performance should scale predictably
    And large projects should remain responsive

  @template-caching-performance @validation
  Scenario: Template caching provides performance benefits
    Given I have templates that will be processed multiple times
    When I run the same template generation multiple times:
      | Run    | Expected Time | Cache Status |
      | First  | ~30ms        | Cache miss   |
      | Second | ~10ms        | Cache hit    |
      | Third  | ~10ms        | Cache hit    |
    Then subsequent runs should benefit from caching
    And cache hits should be significantly faster

  @cli-responsiveness @validation
  Scenario: CLI commands meet responsiveness targets
    When I run various CLI commands and measure response times:
      | Command           | Target Time | Actual Time |
      | unjucks list      | < 100ms     | TBD         |
      | unjucks help      | < 50ms      | TBD         |
      | unjucks version   | < 25ms      | TBD         |
      | unjucks init      | < 200ms     | TBD         |
    Then all commands should meet their response time targets
    And the CLI should feel responsive to users

  @benchmark-comparison @validation
  Scenario: Comprehensive performance benchmark against Hygen
    Given I have equivalent operations to test in both systems
    When I run performance benchmarks:
      | Metric                | Hygen Baseline | Unjucks Target | Improvement |
      | Cold Start            | 200ms          | 150ms          | 25%         |
      | Template Processing   | 50ms           | 30ms           | 40%         |
      | File Operations       | 20ms           | 15ms           | 25%         |
      | Memory Usage          | 25MB           | 20MB           | 20%         |
    Then Unjucks should meet or exceed all performance targets
    And improvements should be consistent across different workloads

  @error-recovery-performance @validation
  Scenario: Error handling doesn't impact performance significantly
    Given I have operations that will encounter various errors
    When I measure performance with error handling:
      | Scenario        | With Errors | Without Errors | Overhead |
      | Template parse  | 35ms        | 30ms           | < 20%    |
      | File operations | 18ms        | 15ms           | < 20%    |
      | Variable resolve| 15ms        | 12ms           | < 25%    |
    Then error handling overhead should be minimal
    And graceful error handling shouldn't significantly impact performance

  @memory-leak-validation @validation
  Scenario: No memory leaks during extended operations
    Given I run Unjucks operations continuously for extended periods
    When I monitor memory usage over time:
      | Duration  | Expected Memory | Allowed Growth |
      | 1 minute  | ~20MB          | < 5MB          |
      | 10 minutes| ~20MB          | < 10MB         |
      | 1 hour    | ~20MB          | < 20MB         |
    Then memory usage should remain stable
    And no significant memory leaks should be detected

  @resource-efficiency @validation
  Scenario: CPU and I/O efficiency meets standards
    Given I monitor system resource usage during operations
    When I run intensive Unjucks workloads
    Then CPU usage should be efficient:
      | Operation Type  | CPU Usage Target |
      | Template render | < 50% single core|
      | File I/O        | < 30% single core|
      | CLI commands    | < 25% single core|
    And I/O operations should be optimized
    And system resources should be used efficiently