@advanced @performance
Feature: Performance Optimizations
  As a developer working with large codebases
  I want Unjucks to perform efficiently at scale
  So that code generation doesn't become a bottleneck in development

  Background:
    Given an Unjucks project with performance monitoring enabled
    And the following performance thresholds are configured:
      | metric                 | threshold |
      | template_parse_time    | 100ms     |
      | file_generation_time   | 500ms     |
      | memory_usage           | 256MB     |
      | concurrent_operations  | 50        |

  @template-caching
  Scenario: Template parsing and compilation caching
    Given 100 template files in various generators
    When I run the same generator multiple times
    Then templates should be parsed once and cached in memory
    And subsequent runs should use compiled template cache
    And cache hit rate should be > 95%
    And total parsing time should be reduced by > 80%

  @cache-invalidation
  Scenario: Intelligent cache invalidation
    Given templates are cached in memory
    When I modify a template file
    Then only the affected template cache should be invalidated
    And dependent templates should be marked for recompilation
    And unrelated cached templates should remain valid
    And cache invalidation should complete in < 10ms

  @parallel-generation
  Scenario: Parallel file generation
    Given a generator that produces 50 output files
    When I run generation with parallel processing enabled
    Then files should be generated concurrently
    And CPU utilization should be > 80% on multi-core systems
    And total generation time should be reduced by > 60%
    And file write operations should not conflict

  @memory-efficient-streaming
  Scenario: Large file handling with streaming
    Given a template that generates a 10MB output file
    When I generate the large file
    Then memory usage should remain under 50MB
    And file should be written using streaming I/O
    And generation should complete without memory errors
    And intermediate buffering should be minimized

  @incremental-generation
  Scenario: Incremental file generation
    Given 100 files generated from templates
    When I modify template variables and regenerate
    Then only files affected by changed variables should be regenerated
    And unchanged files should be skipped
    And incremental generation should be 10x faster than full regeneration
    And file modification timestamps should be preserved for unchanged files

  @watch-mode-efficiency
  Scenario: Efficient watch mode operations
    Given Unjucks is running in watch mode
    When I modify a single template file
    Then file system watching should detect the change in < 50ms
    And only affected generators should be triggered for regeneration
    And watch mode should use < 20MB of memory
    And CPU usage should be < 2% when idle

  @concurrent-safety
  Scenario: Thread-safe concurrent operations
    Given multiple generators running simultaneously
    When 10 different templates are generated concurrently
    Then no file corruption should occur
    And shared resources should be properly locked
    And race conditions should be prevented
    And all operations should complete successfully

  @memory-pressure-handling
  Scenario: Memory pressure and garbage collection
    Given a system with limited memory (512MB)
    When I generate 1000 files from complex templates
    Then garbage collection should be triggered appropriately
    And memory usage should not exceed system limits
    And generation should not fail due to out-of-memory errors
    And performance should degrade gracefully under memory pressure

  @template-complexity-optimization
  Scenario Outline: Performance across template complexity
    Given a template with "<complexity>" complexity
    When I generate 100 files from this template
    Then generation time should be within acceptable limits
    And memory usage should scale linearly with complexity
    And performance should meet specified thresholds

    Examples:
      | complexity | expected_time | expected_memory |
      | simple     | < 1s          | < 10MB          |
      | medium     | < 5s          | < 50MB          |
      | complex    | < 15s         | < 100MB         |
      | very_complex | < 30s       | < 200MB         |

  @io-optimization
  Scenario: File I/O optimization
    Given a generator creating 500 small files (< 1KB each)
    When I run generation with I/O optimization enabled
    Then file operations should be batched efficiently
    And disk I/O should be minimized through buffering
    And file system sync operations should be optimized
    And total I/O time should be < 2 seconds

  @network-template-caching
  Scenario: Remote template caching
    Given templates loaded from remote URLs
    When I generate files using remote templates
    Then remote templates should be cached locally
    And HTTP requests should include appropriate cache headers
    And cached templates should be used for subsequent generations
    And network requests should be minimized

  @performance-profiling
  Scenario: Built-in performance profiling
    Given performance profiling is enabled
    When I run a complex generation workflow
    Then detailed timing information should be collected:
      | phase              | metric           |
      | template_parsing   | parse_time_ms    |
      | variable_resolution| resolve_time_ms  |
      | rendering          | render_time_ms   |
      | file_writing       | write_time_ms    |
    And profiling data should be available in structured format
    And performance bottlenecks should be identified

  @resource-pooling
  Scenario: Resource pooling for efficiency
    Given heavy template processing operations
    When multiple generators are executed sequentially
    Then template engines should be pooled and reused
    And file handles should be managed efficiently
    And resource allocation overhead should be minimized
    And cleanup should be handled automatically

  @lazy-evaluation
  Scenario: Lazy evaluation of template expressions
    Given templates with conditional blocks and complex expressions
    When I generate files with specific variable configurations
    Then unused template branches should not be evaluated
    And expensive computations should be deferred until needed
    And overall processing time should be reduced by > 40%
    And memory usage should be optimized through lazy evaluation

  @batch-operations
  Scenario: Batch file operations
    Given 200 files to be generated in the same directory
    When I run batch generation
    Then directory operations should be batched
    And file system metadata operations should be minimized
    And bulk file creation should be optimized
    And overall operation time should be reduced significantly

  @compression-optimization
  Scenario: Template and asset compression
    Given large template files and static assets
    When templates are loaded and processed
    Then templates should be compressed in memory when appropriate
    And large assets should be streamed rather than loaded entirely
    And compression should reduce memory footprint by > 50%
    And decompression overhead should be acceptable (< 10ms)

  @performance-regression-detection
  Scenario: Performance regression detection
    Given performance baselines are established
    When I run generation workflows
    Then current performance should be compared against baselines
    And performance regressions should be detected automatically
    And detailed performance reports should be generated
    And alerts should be raised for significant performance degradation

  @scaling-stress-test
  Scenario: Scaling and stress testing
    Given a high-load scenario with 1000 concurrent operations
    When I stress test the generation system
    Then system should handle the load without crashes
    And response times should degrade gracefully under load
    And memory usage should remain bounded
    And error rates should remain below 1%

  @performance-configuration
  Scenario: Configurable performance tuning
    Given performance configuration options:
      | option                | value |
      | max_concurrent_files  | 25    |
      | template_cache_size   | 100   |
      | memory_limit_mb       | 512   |
      | io_buffer_size_kb     | 64    |
    When I adjust performance settings
    Then system should respect the configured limits
    And performance characteristics should change accordingly
    And configuration should be validated for feasibility