Feature: Validation Performance Targets and Optimization
  As a KGEN developer
  I want validation to meet strict performance targets
  So that validation doesn't become a bottleneck in development workflows

  Background:
    Given KGEN validation system is optimized for performance
    And performance targets are defined as:
      | target_type           | threshold | description                    |
      | standard_validation   | ≤20ms     | Typical RDF graphs            |
      | large_graph_validation| ≤100ms    | Graphs with 10k+ triples      |
      | violation_reporting   | ≤5ms      | Generate violation reports    |
      | shapes_initialization | ≤50ms     | Load and parse SHACL shapes   |
    And performance monitoring is enabled
    And caching is available for optimization

  @performance @basic-targets
  Scenario: Meet performance targets for standard RDF graph validation
    Given I have a standard RDF graph with "1000" triples:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .
      
      # 1000 triples of person and organization data
      """
    And I have SHACL shapes with "5" constraints
    When I validate the graph against the shapes
    Then validation should complete within "20ms"
    And performance metrics should be recorded:
      | metric              | threshold  |
      | validation_time     | ≤20ms      |
      | memory_usage        | ≤50MB      |
      | cpu_utilization     | ≤80%       |
    And no performance warnings should be generated

  @performance @large-graphs
  Scenario: Meet performance targets for large RDF graphs
    Given I have a large RDF graph with "15000" triples
    And I have complex SHACL shapes with "20" constraints
    When I validate the large graph
    Then validation should complete within "100ms"
    And memory usage should remain within "200MB"
    And the system should remain responsive during validation
    And no timeout errors should occur

  @performance @reporting-speed
  Scenario: Meet performance targets for violation reporting
    Given I have validation results with "50" violations
    When I generate a comprehensive violation report
    Then report generation should complete within "5ms"
    And the report should include all required information:
      | report_section        | content                              |
      | summary               | Aggregated violation statistics      |
      | detailed_violations   | Individual violation details         |
      | performance_metrics   | Validation timing information        |
      | remediation_suggestions| Fix recommendations                |
    And report size should be optimized for transmission

  @performance @shapes-loading
  Scenario: Meet performance targets for SHACL shapes initialization
    Given I have SHACL shapes files totaling "10000" lines
    And shapes include complex constraints and SPARQL rules
    When I initialize the SHACL validation engine
    Then initialization should complete within "50ms"
    And shapes should be properly parsed and indexed
    And memory usage should be minimized through efficient storage
    And the engine should be ready for immediate validation

  @performance @caching-effectiveness
  Scenario: Achieve performance improvements through caching
    Given I have caching enabled for validation results
    And I validate the same RDF graph twice
    When I measure the performance difference
    Then the second validation should be at least "10x" faster
    And cache hit rate should be "100%" for identical inputs
    And cache should automatically invalidate when shapes change
    And cached results should be identical to fresh validation results

  @performance @memory-efficiency
  Scenario: Maintain memory efficiency under load
    Given I have validation workloads of varying sizes:
      | workload_size | graph_size | expected_memory |
      | small         | 100        | ≤10MB          |
      | medium        | 5000       | ≤100MB         |
      | large         | 25000      | ≤500MB         |
      | xlarge        | 50000      | ≤1GB           |
    When I run validation for each workload size
    Then memory usage should stay within expected limits
    And memory should be released promptly after validation
    And no memory leaks should be detected
    And garbage collection pressure should be minimal

  @performance @concurrent-validation
  Scenario: Maintain performance under concurrent validation requests
    Given I have multiple validation requests running concurrently
    When I process "10" concurrent validations of "1000" triples each
    Then each validation should complete within "30ms" (50% overhead allowed)
    And total system throughput should exceed "300" validations per second
    And resource contention should be minimized
    And system should remain stable under load

  @performance @batch-optimization
  Scenario: Optimize performance for batch validation
    Given I have "100" RDF files to validate in batch
    And each file contains approximately "500" triples
    When I run batch validation
    Then batch processing should be faster than individual validation
    And total time should be less than "500ms" for the entire batch
    And resource utilization should be optimized:
      | resource        | optimization                           |
      | shape_loading   | Load shapes once, reuse for all files |
      | memory_usage    | Efficient memory management across batch |
      | I/O_operations  | Minimize file system operations       |

  @performance @streaming-validation
  Scenario: Support streaming validation for very large graphs
    Given I have an RDF graph too large to fit in memory (>2GB)
    And streaming validation is enabled
    When I validate the graph using streaming mode
    Then validation should process the graph in chunks
    And memory usage should remain constant regardless of graph size
    And streaming overhead should be minimal (≤20% performance impact)
    And validation accuracy should be maintained

  @performance @incremental-validation
  Scenario: Optimize performance through incremental validation
    Given I have a large RDF graph that changes incrementally
    And I track changes between validation runs
    When I run incremental validation
    Then only changed portions should be re-validated
    And unchanged portions should use cached results
    And incremental validation should be significantly faster than full validation
    And validation completeness should be maintained

  @performance @constraint-optimization
  Scenario: Optimize performance for different constraint types
    Given I have SHACL shapes with various constraint types:
      | constraint_type    | complexity | target_time |
      | minCount/maxCount  | low        | ≤1ms        |
      | datatype          | low        | ≤2ms        |
      | pattern           | medium     | ≤5ms        |
      | SPARQL            | high       | ≤15ms       |
    When I validate data against each constraint type
    Then each constraint type should meet its performance target
    And constraint execution should be optimized based on complexity
    And expensive constraints should be cached more aggressively

  @performance @indexing-optimization
  Scenario: Optimize graph traversal through intelligent indexing
    Given I have RDF graphs with complex interconnected structures
    When validation requires extensive graph traversal
    Then graph indexing should minimize traversal time
    And frequently accessed paths should be pre-indexed
    And index memory overhead should be reasonable (≤20% of graph size)
    And index updates should be efficient for changing graphs

  @performance @parallelization
  Scenario: Achieve performance gains through parallelization
    Given I have multi-core processing available
    And I have validation workloads that can be parallelized
    When I enable parallel validation processing
    Then validation should utilize available CPU cores effectively
    And speedup should scale reasonably with core count
    And parallel processing overhead should be minimal
    And results should be identical to sequential processing

  @performance @performance-regression-detection
  Scenario: Detect performance regressions automatically
    Given I have baseline performance measurements
    And I run validation with performance monitoring enabled
    When current performance deviates from baseline by more than "20%"
    Then performance regression warnings should be generated
    And detailed performance comparison should be provided
    And performance trends should be tracked over time
    And recommendations for performance improvement should be given

  @performance @memory-pressure-handling
  Scenario: Handle memory pressure gracefully
    Given I have limited memory available for validation
    And I attempt to validate graphs approaching memory limits
    When memory pressure is detected
    Then validation should adapt by:
      | adaptation_strategy    | description                           |
      | reduce_cache_size      | Free up cached validation results     |
      | stream_processing      | Switch to streaming mode if possible  |
      | garbage_collection     | Trigger aggressive garbage collection |
      | graceful_degradation   | Reduce feature richness to save memory |
    And out-of-memory errors should be prevented
    And user should be informed of memory-saving measures taken

  @performance @cold-start-optimization
  Scenario: Minimize cold start performance impact
    Given the validation system is starting from a cold state
    When the first validation request is made
    Then cold start overhead should be minimized:
      | component              | cold_start_target |
      | engine_initialization  | ≤100ms            |
      | shapes_loading        | ≤50ms             |
      | cache_warming         | ≤20ms             |
      | first_validation      | ≤2x normal time   |
    And subsequent validations should meet normal performance targets
    And cold start optimizations should be transparent to users

  @performance @network-optimization
  Scenario: Optimize performance for remote validation scenarios
    Given I have validation scenarios involving remote resources
    When validation requires network operations for:
      | operation_type         | optimization_strategy                  |
      | shape_loading         | Cache remote shapes locally           |
      | URI_dereferencing     | Batch dereference operations          |
      | remote_graph_access   | Use efficient transfer protocols      |
      | validation_reporting  | Compress report transmission          |
    Then network latency should not significantly impact validation time
    And network operations should be minimized through caching
    And offline validation should be supported where possible

  @performance @profiling-and-monitoring
  Scenario: Support comprehensive performance profiling
    Given I need to analyze validation performance in detail
    When I enable detailed performance profiling
    Then profiling should provide insights into:
      | profiling_area         | metrics_provided                      |
      | time_distribution      | Time spent in each validation phase  |
      | memory_allocation      | Memory usage patterns and hotspots   |
      | constraint_performance | Per-constraint execution times        |
      | bottleneck_analysis    | Identification of performance bottlenecks |
    And profiling overhead should be minimal when disabled
    And profiling data should be exportable for analysis

  @performance @load-testing
  Scenario: Validate system performance under sustained load
    Given I have a load testing scenario with sustained validation requests
    When I run validation under high load for an extended period
    Then system should maintain performance targets:
      | load_characteristic    | performance_requirement               |
      | sustained_throughput   | ≥100 validations/second               |
      | response_time_p95      | ≤50ms for standard graphs            |
      | memory_stability       | No memory leaks over 24 hours        |
      | error_rate            | ≤0.1% under normal load               |
    And system should gracefully handle load spikes
    And resource usage should remain stable over time

  @performance @benchmark-comparison
  Scenario: Compare performance against baseline benchmarks
    Given I have established benchmark datasets and performance baselines
    When I run validation against benchmark datasets
    Then performance should meet or exceed baseline measurements:
      | benchmark_dataset      | baseline_time | current_target        |
      | small_graphs_100       | 15ms          | ≤15ms (maintain)      |
      | medium_graphs_5k       | 80ms          | ≤60ms (improve 25%)   |
      | large_graphs_50k       | 500ms         | ≤400ms (improve 20%)  |
      | complex_constraints    | 200ms         | ≤150ms (improve 25%)  |
    And performance improvements should be measurable and consistent
    And benchmarks should be updated to reflect new baselines

  @performance @resource-scaling
  Scenario: Validate performance scaling with available resources
    Given I have varying amounts of system resources available
    When I run validation with different resource allocations:
      | resource_config        | expected_performance_scaling          |
      | 2GB RAM, 2 cores      | Baseline performance                  |
      | 4GB RAM, 4 cores      | 1.5-2x performance improvement       |
      | 8GB RAM, 8 cores      | 2-3x performance improvement         |
      | 16GB RAM, 16 cores    | 3-4x performance improvement         |
    Then performance should scale reasonably with additional resources
    And resource utilization should be efficient
    And diminishing returns should be documented and expected