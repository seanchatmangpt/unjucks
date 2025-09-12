Feature: Semantic Drift Detection
  As a KGEN user
  I want to detect semantic drift in generated artifacts
  So that I can maintain consistency and quality in my codebase

  Background:
    Given KGEN is properly configured
    And I have a baseline artifact state
    And the drift detection system is initialized

  @core @drift-detection
  Scenario: Detect semantic drift in generated code
    Given I have a baseline artifact "user-service.ts"
    And the baseline contains function "getUserById"
    When I regenerate the artifact with the same template
    And the function signature changes from "getUserById(id: string)" to "getUserById(id: number)"
    Then KGEN should detect semantic drift
    And exit with code 3
    And report "Function signature change detected in getUserById"
    And the signal-to-noise ratio should be >= 90%

  @core @drift-detection
  Scenario: Ignore cosmetic changes (whitespace, comments)
    Given I have a baseline artifact "user-service.ts"
    When I regenerate the artifact
    And only whitespace formatting changes occur
    And comments are added or modified
    And variable names remain the same
    Then KGEN should not detect semantic drift
    And exit with code 0
    And report "No semantic changes detected"

  @core @drift-detection
  Scenario: Detect API breaking changes
    Given I have a baseline API artifact "api-routes.ts"
    And the baseline exports interface "UserRequest"
    When I regenerate the artifact
    And a required field is removed from "UserRequest"
    Then KGEN should detect semantic drift
    And exit with code 3
    And report "Breaking change: Required field removed from UserRequest"
    And categorize as "HIGH" severity drift

  @drift-detection @baseline
  Scenario: Compare against multiple baselines
    Given I have baseline artifacts from version "1.0.0"
    And I have baseline artifacts from version "1.1.0"
    When I regenerate artifacts for version "1.2.0"
    And semantic changes exist compared to "1.1.0"
    But no changes compared to "1.0.0"
    Then KGEN should detect drift against "1.1.0"
    And exit with code 3
    And report baseline comparison results
    And show drift timeline from "1.0.0" to "1.2.0"

  @drift-detection @performance
  Scenario: Achieve 90% signal-to-noise ratio
    Given I have 100 test artifacts with known drift patterns
    And 10 contain actual semantic changes
    And 90 contain only cosmetic changes
    When I run drift detection on all artifacts
    Then KGEN should identify exactly 10 semantic drifts
    And report 0 false positives from cosmetic changes
    And achieve signal-to-noise ratio of >= 90%
    And complete analysis within 30 seconds

  @drift-detection @ast-analysis
  Scenario: Detect structural changes in AST
    Given I have a baseline TypeScript artifact
    And the AST contains class "UserManager"
    When I regenerate the artifact
    And a public method is removed from "UserManager"
    Then KGEN should detect semantic drift
    And exit with code 3
    And report "Method removal in UserManager class"
    And provide AST diff visualization

  @drift-detection @dependency-changes
  Scenario: Detect dependency semantic changes
    Given I have a baseline artifact with imports
    And imports include "lodash/get" and "lodash/set"
    When I regenerate the artifact
    And imports change to "lodash" (full library)
    Then KGEN should detect semantic drift
    And exit with code 3
    And report "Dependency scope change: specific to full lodash"
    And calculate bundle size impact

  @drift-detection @false-positive-prevention
  Scenario: Prevent false positives from code reordering
    Given I have a baseline artifact with multiple functions
    When I regenerate the artifact
    And functions are reordered but signatures unchanged
    And function implementations remain identical
    Then KGEN should not detect semantic drift
    And exit with code 0
    And report "Structural reordering detected, no semantic impact"

  @drift-detection @batch-analysis
  Scenario: Batch drift analysis across multiple artifacts
    Given I have 50 baseline artifacts in "src/" directory
    When I regenerate all artifacts using KGEN
    And 5 artifacts contain semantic changes
    And 45 artifacts have only formatting changes
    Then KGEN should detect drift in exactly 5 artifacts
    And exit with code 3
    And generate drift summary report
    And list affected files with change categories

  @drift-detection @threshold-configuration
  Scenario: Configure drift detection sensitivity
    Given KGEN drift detection threshold is set to "medium"
    And I have an artifact with minor type changes
    When I regenerate the artifact
    And property type changes from "string | null" to "string | undefined"
    Then KGEN should detect semantic drift
    And exit with code 3
    When I set threshold to "low"
    And regenerate the same artifact
    Then KGEN should not detect semantic drift
    And exit with code 0

  @drift-detection @incremental
  Scenario: Incremental drift detection
    Given I have processed 100 artifacts previously
    And baseline checksums are cached
    When I regenerate only 10 modified artifacts
    Then KGEN should only analyze the 10 modified files
    And skip unchanged artifacts based on checksums
    And complete analysis within 5 seconds
    And maintain 90% signal-to-noise ratio