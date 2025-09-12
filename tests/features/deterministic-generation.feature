Feature: Deterministic Generation Core
  As a developer using KGEN
  I want byte-identical artifact generation
  So that builds are reproducible and verifiable

  Background:
    Given KGEN is installed and configured
    And the system has a clean workspace
    And SOURCE_DATE_EPOCH is set to "1704067200" # 2024-01-01 00:00:00 UTC

  @critical @reproducibility
  Scenario: Generate identical artifacts with same inputs
    Given a template "basic-component" with fixed inputs
    When I generate the artifact 5 times consecutively
    Then all generated artifacts must be byte-identical
    And SHA-256 checksums must match exactly
    And file timestamps must be identical
    And generation metadata must be consistent

  @critical @kpi
  Scenario: Achieve 99.9% reproducibility KPI across 1000 generations
    Given a standardized test template set
    When I generate artifacts 1000 times with identical inputs
    Then at least 999 generations must produce byte-identical results
    And the reproducibility rate must be >= 99.9%
    And any failures must be logged with detailed diagnostics

  @deterministic @timestamps
  Scenario: Respect SOURCE_DATE_EPOCH for all file operations
    Given SOURCE_DATE_EPOCH is set to "1609459200" # 2021-01-01 00:00:00 UTC
    When I generate any artifact type
    Then all created files must have modification time "2021-01-01T00:00:00Z"
    And all embedded timestamps must use SOURCE_DATE_EPOCH
    And no current system time should be used in outputs

  @deterministic @ordering
  Scenario: Maintain consistent file ordering in multi-file generation
    Given a template that generates multiple files
    When I generate the artifact multiple times
    Then file creation order must be identical
    And directory traversal order must be deterministic
    And zip/archive file ordering must be consistent

  @validation @checksums
  Scenario: Validate byte-identical generation with cryptographic proof
    Given a complex template with multiple file types
    When I generate the artifact on the same system
    Then I can compute SHA-256 of entire output
    And regeneration produces identical SHA-256
    And individual file hashes remain unchanged
    And BLAKE3 checksums also match for verification

  @error-handling @deterministic
  Scenario: Block non-deterministic operations during generation
    Given KGEN is in deterministic mode
    When a template attempts to use current timestamp
    Or a template tries to generate random values
    Or a template accesses system-specific variables
    Then KGEN must reject the operation
    And provide clear error message about non-deterministic behavior
    And suggest deterministic alternatives

  @metadata @consistency
  Scenario: Generate consistent metadata across runs
    Given a template with metadata generation enabled
    When I generate the artifact multiple times
    Then .attest.json files must be byte-identical
    And provenance data must be deterministic
    And signature information must be consistent
    And build metadata timestamps must use SOURCE_DATE_EPOCH

  @content @normalization
  Scenario: Apply content normalization consistently
    Given templates with varied line endings and whitespace
    When I generate artifacts with normalization enabled
    Then line endings must be normalized to LF consistently
    And trailing whitespace must be handled identically
    And file encoding must be consistent (UTF-8)
    And BOM handling must be deterministic

  @templates @variables
  Scenario: Process template variables deterministically
    Given a template with complex variable interpolation
    And variables include arrays, objects, and computed values
    When I generate with identical variable inputs
    Then variable resolution order must be consistent
    And computed values must produce identical results
    And template loops must maintain deterministic iteration order

  @filesystem @paths
  Scenario: Generate consistent filesystem paths
    Given templates that create nested directory structures
    When I generate on the same filesystem type
    Then directory creation order must be deterministic
    And path separators must be normalized consistently
    And filename case handling must be predictable
    And symbolic links must be handled deterministically