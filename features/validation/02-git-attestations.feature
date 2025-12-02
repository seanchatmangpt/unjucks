Feature: Git Attestation and Provenance Tracking
  As a KGEN developer
  I want comprehensive git-integrated attestation tracking
  So that I can verify provenance chains and cryptographic integrity across git history

  Background:
    Given a git repository with KGEN configured at "/tmp/kgen-test-repo"
    And I have valid Ed25519 and RSA signing keys configured
    And the ProvenanceEngine is initialized with git integration
    And attestation generation is enabled with JOSE/JWS format

  Scenario: Generate .attest.json with git context
    Given I have a template file "component.njk" in git
    And I generate an artifact "button.tsx" from the template
    When the generation completes successfully
    Then an ".attest.json" file should be created alongside "button.tsx"
    And the attestation should contain:
      | field                | type      | required |
      | artifact_hash        | string    | true     |
      | git_commit_sha       | string    | true     |
      | git_branch          | string    | true     |
      | template_git_hash   | string    | true     |
      | generation_timestamp| string    | true     |
      | kgen_version        | string    | true     |
      | jose_header         | object    | true     |
      | signature           | string    | true     |

  Scenario: Create JOSE/JWS signature with Ed25519
    Given an artifact "component.tsx" with SHA256 hash "abc123def456"
    And I have a valid Ed25519 private key loaded
    When I create a cryptographic attestation
    Then the attestation should have a JWS header with:
      | property | value     |
      | alg      | Ed25519   |
      | typ      | JWT       |
      | kid      | key_id_123|
    And the JWS payload should be base64url encoded
    And the signature should verify with the corresponding Ed25519 public key
    And the attestation should validate against RFC 7515 specification

  Scenario: Create JOSE/JWS signature with RSA-SHA256
    Given an artifact "service.ts" with SHA256 hash "def456abc789"
    And I have a valid RSA-2048 private key loaded
    When I create a cryptographic attestation with RSA algorithm
    Then the attestation should have a JWS header with:
      | property | value         |
      | alg      | RS256         |
      | typ      | JWT           |
      | kid      | rsa_key_456   |
    And the RSA signature should be 256 bytes in length
    And the signature should verify with the corresponding RSA public key

  Scenario: Track complete provenance chain in git
    Given a template hierarchy:
      | template    | extends   | git_hash   |
      | base.njk    | null      | hash_base  |
      | layout.njk  | base.njk  | hash_layout|
      | page.njk    | layout.njk| hash_page  |
    And I generate artifact "homepage.tsx" from "page.njk"
    When the attestation is created
    Then it should include template dependency chain:
      | template    | hash        | relationship |
      | page.njk    | hash_page   | direct       |
      | layout.njk  | hash_layout | inherited    |
      | base.njk    | hash_base   | inherited    |
    And the provenance graph should be queryable via SPARQL
    And each template hash should be verifiable against git objects

  Scenario: Store attestation in git notes
    Given an artifact "component.tsx" with attestation
    When I store the attestation with git integration
    Then it should be saved as a git note on the artifact blob
    And the note namespace should be "refs/notes/kgen-attestations"
    And I can retrieve the attestation using: git notes --ref=kgen-attestations show <blob_hash>
    And the attestation should persist through git push/pull operations

  Scenario: Query attestations by git commit
    Given multiple artifacts generated in git commit "abc123"
    And each artifact has a cryptographic attestation
    When I query attestations for commit "abc123"
    Then I should receive all attestations linked to that commit
    And each attestation should be cryptographically verifiable
    And the complete generation context should be reconstructible

  Scenario: Validate attestation integrity after git operations
    Given an artifact with valid attestation in commit "commit1"
    When I perform git operations:
      | operation    | details                    |
      | git rebase   | interactive rebase         |
      | git merge    | merge from another branch  |
      | git cherry-pick | pick commit to new branch |
    Then all attestations should remain valid
    And attestation git note references should update correctly
    And provenance chains should remain unbroken

  Scenario: Handle attestation for modified artifacts
    Given an artifact "component.tsx" with existing attestation "attest1"
    And the attestation is stored in git notes
    When I modify the template and regenerate the artifact
    Then a new attestation "attest2" should be created
    And "attest2" should reference previous attestation "attest1"
    And the modification chain should be traceable:
      | attestation | previous   | change_type    |
      | attest2     | attest1    | regeneration   |
      | attest1     | null       | initial        |

  Scenario: Multi-key signature validation
    Given I have multiple signing keys configured:
      | key_type | key_id      | algorithm |
      | Ed25519  | ed25519_001 | Ed25519   |
      | RSA      | rsa_002     | RS256     |
    When I generate an attestation requiring multiple signatures
    Then the JWS should contain signatures from all configured keys
    And each signature should be independently verifiable
    And the attestation should remain valid if any one key is compromised

  Scenario: Cross-repository attestation resolution
    Given artifacts in repository "repo-a" reference templates in "repo-b"
    And both repositories have attestation tracking enabled  
    When I generate an artifact in "repo-a" using templates from "repo-b"
    Then the attestation should include cross-repo template hashes
    And I should be able to verify template integrity across repositories
    And the provenance chain should span both repositories

  Scenario: Attestation bundle export with git integration
    Given multiple related artifacts across several git commits
    And each artifact has cryptographic attestations
    When I export an attestation bundle for the project
    Then the bundle should include:
      | component           | format      |
      | all_attestations   | JWS array   |
      | git_commit_graph   | object      |
      | template_hierarchy | RDF/TTL     |
      | signing_keys       | JWK set     |
    And the bundle should be self-verifiable
    And I should be able to recreate the complete provenance offline

  Scenario: Resolve attest:// URI with git backend
    Given an attestation with hash "sha256:abcd1234" stored in git notes
    When I resolve URI "attest://sha256:abcd1234"
    Then it should return the complete attestation in JWS format
    And the attestation content should be cryptographically verified
    And git note metadata should be included in the response

  Scenario: Performance validation for large repositories
    Given a git repository with 1000+ files and attestations
    When I query attestations across the entire repository
    Then the query should complete in under 5 seconds
    And memory usage should remain below 100MB
    And git note operations should be batched efficiently

  Scenario: Attestation schema validation with git context
    Given an attestation file with git integration fields
    When I validate against the KGEN git attestation schema
    Then all git-specific fields should be present:
      | field               | required | type   |
      | git_commit_sha      | true     | string |
      | git_branch          | false    | string |
      | git_repository_url  | false    | string |
      | git_author          | false    | object |
      | git_committer       | false    | object |
    And the schema validation should pass
    And git field formats should comply with git standards

  Scenario: Error handling for corrupted attestations
    Given an attestation file with corrupted signature
    When I attempt to verify the attestation
    Then the verification should fail gracefully
    And the error should specify "signature_verification_failed"
    And I should receive details about which key failed validation
    And the system should log the security event

  Scenario: Attestation cleanup on git garbage collection
    Given old attestations in git notes that reference non-existent objects
    When git garbage collection runs
    Then orphaned attestation notes should be identified
    And a cleanup report should be generated
    And I should have the option to remove orphaned attestations

  Scenario: Integration with git hooks for automatic attestation
    Given a git repository with KGEN pre-commit hooks
    And attestation generation is configured for automatic mode
    When I commit files generated by KGEN
    Then attestations should be automatically generated and added
    And git notes should be created for all generated artifacts
    And the commit should include attestation metadata

  Scenario: Attestation verification with external tools
    Given an attestation file "component.tsx.attest.json" 
    When I verify the signature using external JOSE tools:
      | tool        | command                                     |
      | jose-util   | jose verify --key public.pem attestation   |
      | node-jose   | JOSE.JWS.createVerify(keystore)            |
    Then the signature should validate successfully
    And the payload should decode to readable JSON
    And all cryptographic operations should be standard-compliant