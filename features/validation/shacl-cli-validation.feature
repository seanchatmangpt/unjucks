Feature: SHACL CLI Validation Commands
  As a KGEN user
  I want to validate RDF graphs and artifacts through CLI commands
  So that I can integrate validation into my development and CI/CD workflows

  Background:
    Given KGEN CLI is available with SHACL validation commands
    And the CLI supports both interactive and batch processing
    And validation results are output in JSON format by default
    And CLI commands follow standard exit code conventions

  @cli @basic-validation
  Scenario: Validate RDF file against SHACL shapes via CLI
    Given I have an RDF file "person.ttl":
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .

      ex:john a schema:Person ;
        schema:name "John Doe" ;
        schema:email "john@example.com" .
      """
    And I have SHACL shapes file "person-shapes.ttl":
      """
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix schema: <http://schema.org/> .

      PersonShape a sh:NodeShape ;
        sh:targetClass schema:Person ;
        sh:property [
          sh:path schema:name ;
          sh:minCount 1 ;
          sh:message "Person must have a name"
        ] .
      """
    When I run the command:
      """
      kgen validate artifacts person.ttl --shapes-file person-shapes.ttl
      """
    Then the command should succeed with exit code 0
    And the output should be valid JSON
    And the output should include '"conforms": true'
    And validation metrics should be included in the output

  @cli @violation-detection
  Scenario: CLI detects and reports SHACL violations
    Given I have an RDF file "invalid-person.ttl" with violations:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .

      ex:john a schema:Person .
      """
    And I have SHACL shapes requiring a name property
    When I run the command:
      """
      kgen validate artifacts invalid-person.ttl --shapes-file person-shapes.ttl
      """
    Then the command should exit with code 3 (SHACL violations)
    And the output should include '"conforms": false'
    And violations should be detailed in the output:
      | field         | value                        |
      | focusNode     | http://example.org/john      |
      | message       | Person must have a name      |
      | severity      | Violation                    |

  @cli @batch-validation
  Scenario: Validate multiple files in batch through CLI
    Given I have multiple RDF files to validate:
      | file            | status |
      | person1.ttl     | valid  |
      | person2.ttl     | valid  |
      | invalid.ttl     | invalid |
    When I run the command:
      """
      kgen validate artifacts . --shapes-file shapes/ --recursive
      """
    Then all files should be processed
    And the output should include results for each file
    And overall statistics should be provided:
      | metric              | value |
      | total_files         | 3     |
      | valid_files         | 2     |
      | invalid_files       | 1     |
    And the exit code should reflect the worst result (3 for violations)

  @cli @output-formats
  Scenario: CLI supports multiple output formats
    Given I have validation results to display
    When I run validation commands with different format options:
      | format | flag           | expected_output       |
      | json   | --format json  | Valid JSON structure  |
      | table  | --format table | ASCII table format    |
      | csv    | --format csv   | Comma-separated values |
      | junit  | --format junit | JUnit XML format      |
    Then each format should contain the same core information
    And format-specific optimizations should be applied
    And all outputs should be well-formed

  @cli @verbose-output
  Scenario: CLI provides verbose validation output
    Given I have validation results with detailed information available
    When I run the command with verbose flag:
      """
      kgen validate artifacts data.ttl --shapes-file shapes.ttl --verbose
      """
    Then the output should include detailed information:
      | detail_type           | description                        |
      | performance_metrics   | Timing and resource usage         |
      | shape_execution_stats | Per-shape validation statistics   |
      | constraint_details    | Individual constraint results     |
      | graph_statistics      | RDF graph size and structure info |
    And verbose output should remain structured and parseable

  @cli @shapes-validation
  Scenario: Validate SHACL shapes themselves via CLI
    Given I have SHACL shapes file "shapes.ttl"
    When I run the command:
      """
      kgen validate graph shapes.ttl --shacl
      """
    Then the shapes should be validated for correctness
    And shape syntax should be checked
    And shape semantic consistency should be verified
    And any shape errors should be clearly reported

  @cli @configuration-files
  Scenario: Use configuration files for CLI validation
    Given I have a KGEN configuration file "kgen.config.js":
      """
      export default {
        validation: {
          shapesDir: "./shapes",
          timeout: 30000,
          maxTriples: 50000,
          exitOnFirstViolation: false
        }
      }
      """
    When I run validation commands without explicit parameters:
      """
      kgen validate artifacts data.ttl
      """
    Then configuration should be loaded automatically
    And validation should use configured parameters
    And configuration values should override defaults

  @cli @directory-validation
  Scenario: Validate entire directories recursively
    Given I have a directory structure with RDF files:
      """
      data/
      ├── people/
      │   ├── person1.ttl
      │   └── person2.ttl
      ├── organizations/
      │   └── org1.ttl
      └── events/
          └── event1.ttl
      """
    When I run the command:
      """
      kgen validate artifacts data/ --recursive --shapes-file shapes/
      """
    Then all RDF files should be discovered recursively
    And each file should be validated against appropriate shapes
    And directory-level statistics should be provided
    And file paths should be relative to the input directory

  @cli @filter-options
  Scenario: Filter validation results using CLI options
    Given I have validation results with mixed severity violations
    When I run commands with different filter options:
      | filter_option          | command_flag              | expected_result              |
      | violations_only        | --severity violations     | Only violation-level issues |
      | warnings_and_above     | --severity warnings       | Warnings and violations     |
      | specific_shape         | --shape PersonShape       | Only PersonShape violations |
      | specific_constraint    | --constraint minCount     | Only minCount violations    |
    Then filtered results should contain only matching items
    And filter statistics should be provided
    And filtering should not affect performance significantly

  @cli @integration-modes
  Scenario: CLI validation for CI/CD integration
    Given I need to integrate validation into CI/CD pipelines
    When I run validation in CI mode:
      """
      kgen validate artifacts . --ci-mode --no-color --quiet
      """
    Then output should be optimized for machine consumption
    And no interactive prompts should be displayed
    And progress indicators should be minimal
    And exit codes should follow CI/CD conventions:
      | exit_code | meaning                    |
      | 0         | Success (possibly warnings) |
      | 1         | System/runtime errors      |
      | 2         | Critical validation errors |
      | 3         | SHACL violations found     |

  @cli @watch-mode
  Scenario: Continuous validation with watch mode
    Given I have RDF files that may change during development
    When I run validation in watch mode:
      """
      kgen validate artifacts . --watch --shapes-file shapes/
      """
    Then the CLI should monitor files for changes
    And validation should run automatically on file changes
    And incremental results should be displayed
    And watch mode should be efficiently implemented
    And the process should be interruptible with Ctrl+C

  @cli @dry-run-mode
  Scenario: Validate configuration and setup without processing
    Given I want to verify my validation setup before running
    When I run validation in dry-run mode:
      """
      kgen validate artifacts data/ --dry-run
      """
    Then configuration should be loaded and validated
    And input files should be discovered and listed
    And shapes should be parsed and validated
    And no actual validation should be performed
    And a summary of what would be validated should be displayed

  @cli @parallel-processing
  Scenario: Enable parallel validation processing
    Given I have a large number of RDF files to validate
    When I run validation with parallel processing:
      """
      kgen validate artifacts data/ --parallel --workers 4
      """
    Then validation should use multiple worker processes
    And processing should be significantly faster than sequential
    And results should be properly aggregated across workers
    And resource usage should be controlled by worker count

  @cli @cache-management
  Scenario: Manage validation result caching through CLI
    Given I have validation caching enabled
    When I use cache-related CLI options:
      | command                                    | expected_behavior              |
      | kgen validate artifacts data/ --no-cache  | Skip cache, force full validation |
      | kgen validate artifacts data/ --clear-cache | Clear cache before validation    |
      | kgen cache status                          | Show cache statistics           |
      | kgen cache clear                           | Clear all cached results        |
    Then cache operations should be performed correctly
    And cache performance benefits should be measurable
    And cache status should be clearly reported

  @cli @export-results
  Scenario: Export validation results to files
    Given I have validation results to export
    When I run validation with export options:
      """
      kgen validate artifacts data/ --export results.json --export-format detailed
      """
    Then validation results should be written to the specified file
    And export format should be respected
    And exported files should be well-formed
    And export should not interfere with console output

  @cli @template-validation
  Scenario: Validate template files and configurations
    Given I have template files with frontmatter configuration:
      """
      ---
      to: "{{name}}.component.ts"
      inject: true
      skipIf: "{{skipExisting}}"
      ---
      export class {{name}}Component {
        constructor() {}
      }
      """
    When I run template validation:
      """
      kgen validate artifacts template.njk --template-mode
      """
    Then template syntax should be validated
    And frontmatter configuration should be checked
    And variable usage should be analyzed
    And security issues should be detected (code injection, path traversal)

  @cli @artifact-validation
  Scenario: Validate generated artifacts and their attestations
    Given I have generated artifacts with attestation files:
      | artifact            | attestation                |
      | output.js           | output.js.attest.json      |
      | component.ts        | component.ts.attest.json   |
    When I run artifact validation:
      """
      kgen validate artifacts generated/ --check-attestations
      """
    Then artifacts should be validated against their attestations
    And cryptographic integrity should be verified
    And provenance information should be checked
    And any tampering should be detected and reported

  @cli @policy-compliance
  Scenario: Validate against organizational policies
    Given I have organizational validation policies defined
    When I run policy compliance validation:
      """
      kgen validate artifacts data/ --policy-check --policy-file policies/data-governance.ttl
      """
    Then data should be validated against policy constraints
    And compliance violations should be clearly categorized
    And policy-specific reporting should be provided
    And compliance scores should be calculated

  @cli @performance-monitoring
  Scenario: Monitor validation performance through CLI
    Given I want to monitor validation performance over time
    When I run validation with performance monitoring:
      """
      kgen validate artifacts data/ --monitor-performance --benchmark
      """
    Then performance metrics should be collected and displayed:
      | metric                  | description                        |
      | validation_time_per_file | Time spent validating each file   |
      | memory_usage_peak       | Maximum memory usage during validation |
      | constraint_performance  | Time spent on each type of constraint |
      | throughput_metrics      | Files/triples processed per second |
    And performance should be compared to targets
    And performance regression warnings should be displayed

  @cli @error-recovery
  Scenario: Graceful error handling and recovery in CLI
    Given I have files with various types of errors
    When I run validation with error recovery options:
      """
      kgen validate artifacts data/ --continue-on-error --error-limit 10
      """
    Then processing should continue after recoverable errors
    And error summaries should be collected and reported
    And processing should stop if error limits are exceeded
    And partial results should be available even with errors

  @cli @help-documentation
  Scenario: Comprehensive help and documentation in CLI
    Given I need help with CLI validation commands
    When I request help information:
      | command                              | expected_content                    |
      | kgen validate --help                 | General validation help             |
      | kgen validate artifacts --help       | Artifact validation specific help   |
      | kgen validate graph --help          | Graph validation specific help      |
      | kgen --help                         | Complete KGEN CLI help              |
    Then help should be comprehensive and well-organized
    And examples should be provided for common use cases
    And all options should be documented with descriptions
    And help text should be up-to-date with implementation