Feature: Cryptographic Attestation Generation
  As a KGEN user
  I want cryptographic attestations for all artifacts
  So that I can verify provenance and integrity

  Background:
    Given a git repository with KGEN configured
    And I have a valid signing key
    And attestation generation is enabled

  Scenario: Generate .attest.json sidecar for artifact
    Given I generate an artifact "component.tsx"
    When the generation completes
    Then an ".attest.json" file should be created
    And the attestation should contain the artifact hash
    And the attestation should be in JOSE/JWS format
    And the attestation should include generation timestamp

  Scenario: Create JOSE/JWS signature
    Given an artifact with hash "abc123def456"
    When I create an attestation
    Then the attestation should have a valid JWS header
    And the payload should contain artifact metadata
    And the signature should be verifiable with my public key
    And the JWS should follow RFC 7515 specification

  Scenario: Include complete provenance chain
    Given an artifact generated from template "base.njk"
    When I create the attestation
    Then it should include the template hash
    And it should include all input variable values
    And it should include the generation command
    And it should include the KGEN version used
    And it should include the git commit context

  Scenario: Sign with multiple keys
    Given I have multiple signing keys configured
    When I generate an attestation
    Then the JWS should contain signatures from all keys
    And each signature should be independently verifiable
    And the attestation should remain valid if one key is compromised

  Scenario: Verify JWS signature with external tools
    Given an attestation file "artifact.attest.json"
    When I use jose-util to verify the signature
    Then the signature should be valid
    And the payload should match the artifact
    And the verification should succeed with correct public key
    And verification should fail with wrong public key

  Scenario: Store attestation in git notes
    Given an attestation for artifact blob "def789"
    When I store the attestation
    Then it should be saved as a git note
    And the note should reference the artifact blob
    And I can query attestations using git notes
    And the note should be included in git push/pull

  Scenario: Query attestations by artifact hash
    Given multiple artifacts with attestations
    When I query attestations for hash "abc123"
    Then I should receive all attestations for that artifact
    And each attestation should be cryptographically valid
    And I should see the complete attestation chain

  Scenario: Validate attestation timestamp
    Given an attestation with timestamp "2023-12-01T10:00:00Z"
    When I verify the attestation
    Then the timestamp should be within acceptable bounds
    And the timestamp should match git commit time
    And chronological ordering should be preserved

  Scenario: Handle attestation for modified artifacts
    Given an artifact with existing attestation
    When I modify and regenerate the artifact
    Then a new attestation should be created
    And the new attestation should reference the previous one
    And the chain of modifications should be trackable

  Scenario: Export attestation bundle
    Given multiple related artifacts with attestations
    When I export the attestation bundle
    Then all attestations should be in a single file
    And the bundle should be cryptographically verifiable
    And the bundle should include the complete provenance tree

  Scenario: Resolve attest:// URI scheme
    Given an attestation with hash "attestabc123"
    When I reference it using "attest://attestabc123"
    Then the URI should resolve to the attestation content
    And the content should be in valid JWS format
    And I can verify the signature directly

  Scenario: Generate attestation for template chain
    Given a template "child.njk" that extends "parent.njk"
    When I generate an artifact from the child template
    Then the attestation should include both template hashes
    And the template dependency chain should be recorded
    And I can verify the complete template provenance

  Scenario: Validate attestation schema
    Given an attestation file
    When I validate against the KGEN attestation schema
    Then all required fields should be present
    And field types should match the schema
    And the schema version should be compatible
    And custom fields should be preserved