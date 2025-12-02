Feature: Unified Requirements Validation
  As a KGEN user
  I want comprehensive validation of all core requirements
  So that the system meets all specified criteria

  Background:
    Given KGEN is properly configured
    And all required dependencies are available
    And the test environment is clean

  @core @provenance @deterministic @critical
  Scenario: Complete workflow with provenance and determinism
    Given I have a template "test-component" with deterministic content
    And SOURCE_DATE_EPOCH is set to "1704067200"
    And attestation generation is enabled
    When I generate the artifact 3 times consecutively
    Then all generated artifacts must be byte-identical
    And SHA-256 checksums must match exactly
    And an ".attest.json" file should be created
    And the attestation should contain the artifact hash
    And the attestation should be in JOSE/JWS format

  @core @drift-detection @exit-codes
  Scenario: Semantic drift detection with proper exit codes
    Given I have a baseline artifact "user-service.ts"
    And the baseline contains function "getUserById"
    When I regenerate the artifact with the same template
    And the function signature changes from "getUserById(id: string)" to "getUserById(id: number)"
    Then KGEN should detect semantic drift
    And exit with code 3
    And report "Function signature change detected in getUserById"
    And the signal-to-noise ratio should be >= 90%

  @core @frontmatter @injection
  Scenario: Frontmatter-driven file injection
    Given I have a template with frontmatter configuration:
      """
      {
        "to": "src/components/<%= name %>.tsx",
        "inject": true,
        "append": false,
        "before": "// INSERT_BEFORE_MARKER"
      }
      """
    And I have an existing target file "src/components/Button.tsx" with content:
      """
      import React from 'react';
      
      // INSERT_BEFORE_MARKER
      export default function Button() {
        return <button>Click me</button>;
      }
      """
    When I process the template "test-template" with target "src/components/Button.tsx"
    Then injection should succeed
    And the target file should be updated
    And the original content should be preserved
    And the injected content should be present
    And the content should be injected before "// INSERT_BEFORE_MARKER"
    And a backup file should be created

  @core @multi-format @file-size
  Scenario: Multi-format export with size validation
    Given I have a template for "HTML" format generation
    And I have a template for "PDF" format generation
    And I have file size constraints for "HTML" format:
      | Property  | Value |
      | max_size  | 5MB   |
      | min_size  | 1KB   |
    And I have file size constraints for "PDF" format:
      | Property  | Value |
      | max_size  | 10MB  |
      | min_size  | 5KB   |
    When I generate a "HTML" document with content:
      """
      {
        "name": "test-document",
        "title": "Test Document",
        "content": "This is a test document with sufficient content for validation."
      }
      """
    And I generate a "PDF" document with content:
      """
      {
        "name": "test-document",
        "title": "Test Document", 
        "content": "This is a test document with sufficient content for validation."
      }
      """
    And I validate the generated file format
    And I check file sizes against constraints
    Then the generated "HTML" file should be valid
    And the generated "PDF" file should be valid
    And the file size should be within "HTML" constraints
    And the file size should be within "PDF" constraints

  @integration @comprehensive
  Scenario: End-to-end validation with all requirements
    Given I have a git repository with KGEN configured
    And I have a valid signing key
    And attestation generation is enabled
    And SOURCE_DATE_EPOCH is set to "1704067200"
    And I have a template with deterministic generation
    And I have file size constraints configured
    And I have quality thresholds configured
    When I generate multiple artifacts with the same inputs
    And I verify deterministic generation
    And I validate provenance attestations
    And I check for semantic drift
    And I validate multi-format exports
    And I analyze export quality metrics
    Then all generated artifacts must be byte-identical
    And all attestation files should be valid
    And no semantic drift should be detected
    And all format validations should pass
    And export quality should meet thresholds
    And all file sizes should be within constraints

  @performance @stress
  Scenario: Performance validation under load
    Given I have 100 templates configured
    And each template generates 5 different formats
    When I execute batch generation
    And I measure performance metrics
    Then generation should complete within 60 seconds
    And memory usage should remain under 1GB
    And all artifacts should pass validation
    And determinism should be maintained across all generations
    And attestation files should be created for all artifacts

  @error-handling @resilience
  Scenario: Error handling and recovery validation
    Given I have templates with various error conditions
    And I have invalid input data
    When I attempt generation with malformed templates
    Then appropriate error messages should be displayed
    And exit codes should be correct
    And no partial files should remain
    And the system should remain stable
    And recovery should be possible