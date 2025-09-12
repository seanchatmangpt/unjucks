Feature: Complete Provenance Tracking (100% Coverage KPI)
  As a KGEN user
  I want 100% provenance coverage for all artifacts
  So that I can audit and reproduce any generation

  Background:
    Given KGEN is configured with provenance tracking enabled
    And I have a git repository initialized
    And provenance coverage target is set to 100%

  Scenario: Achieve 100% provenance coverage
    Given I generate 10 different artifacts
    When I check provenance coverage
    Then coverage should be exactly 100%
    And every artifact should have complete provenance
    And no artifacts should be missing attestations
    And the coverage report should show detailed metrics

  Scenario: Track template provenance
    Given a template "user.model.ts.njk"
    When I generate an artifact using this template
    Then the provenance should record the template hash
    And the template file path should be recorded
    And the template modification time should be captured
    And template dependencies should be tracked

  Scenario: Track input variable provenance
    Given I generate with variables --name="User" --fields="id,email"
    When I examine the provenance
    Then all input variables should be recorded
    And variable sources should be identified (CLI, file, env)
    And variable types and validation should be captured
    And default value usage should be tracked

  Scenario: Track execution environment provenance
    Given I run KGEN in a specific environment
    When generation completes
    Then the provenance should include OS information
    And Node.js version should be recorded
    And KGEN version and build should be captured
    And working directory should be recorded

  Scenario: Create end-to-end provenance chain
    Given a complex generation with multiple templates
    When I trace the complete provenance
    Then I should see the full dependency graph
    And each step should link to the next
    And the chain should be cryptographically verifiable
    And I can walk the entire generation process

  Scenario: Query provenance by artifact
    Given an artifact "models/User.ts"
    When I query its provenance
    Then I should see the complete generation history
    And all contributing factors should be listed
    And the query should complete in under 100ms
    And the result should include confidence score

  Scenario: Query provenance by template
    Given multiple artifacts generated from "base.model.ts.njk"
    When I query provenance by template
    Then I should see all artifacts created from this template
    And the relationships should be clearly shown
    And I can filter by time range or variables

  Scenario: Verify provenance integrity
    Given a set of artifacts with provenance data
    When I run provenance verification
    Then all cryptographic signatures should be valid
    And all hash references should match actual content
    And no gaps in the provenance chain should exist
    And verification should complete successfully

  Scenario: Reproduce generation from provenance
    Given provenance data for artifact "components/Button.tsx"
    When I attempt to reproduce the generation
    Then I should get an identical artifact
    And the hash should match exactly
    And all intermediate steps should be reproducible

  Scenario: Handle provenance for deleted artifacts
    Given an artifact that has been deleted
    When I query its provenance
    Then the provenance data should still be accessible
    And I should see when and why it was deleted
    And I can recover the artifact from provenance

  Scenario: Resolve content:// URI scheme
    Given provenance data referencing "content://sha256:abc123"
    When I resolve the URI
    Then I should get the content with that hash
    And the content should be cryptographically verified
    And the resolution should work across systems

  Scenario: Generate provenance report
    Given a project with multiple generations
    When I generate a provenance report
    Then it should show coverage statistics
    And it should highlight any gaps or issues
    And it should include recommendations
    And the report should be machine-readable

  Scenario: Export provenance for compliance
    Given legal requirements for code provenance
    When I export compliance data
    Then all artifacts should have complete lineage
    And the export should be in standard format
    And digital signatures should be preserved
    And the export should be legally admissible

  Scenario: Track collaborative provenance
    Given multiple developers generating artifacts
    When I examine cross-developer provenance
    Then I should see who generated what
    And when changes were made by whom
    And how artifacts influenced each other
    And team collaboration patterns

  Scenario: Validate provenance completeness
    Given a requirement for audit-ready provenance
    When I validate completeness
    Then every artifact should have full provenance
    And no circular dependencies should exist
    And all external references should be resolvable
    And the validation should produce a compliance certificate

  Scenario: Handle provenance for binary artifacts
    Given templates that generate binary files
    When I track their provenance
    Then binary content should be hashed and stored
    And the provenance should include binary metadata
    And I can verify binary integrity over time
    And binary dependencies should be tracked

  Scenario: Measure provenance performance impact
    Given provenance tracking is enabled
    When I measure generation performance
    Then provenance overhead should be under 5%
    And tracking should not significantly slow generation
    And memory usage should remain reasonable
    And the performance impact should be documented