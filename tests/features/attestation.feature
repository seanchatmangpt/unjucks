@attestation @provenance @v1
Feature: Attestation Generation for Every Command
  As a KGEN user
  I want attestation files generated for every command execution
  So that I have cryptographic proof of provenance and integrity

  Background:
    Given I have a clean workspace
    And KGEN attestation is enabled
    And cryptographic signing is configured

  @attestation @basic @critical
  Scenario: Generate attestation for basic command
    Given I run the command "kgen generate template-basic --name TestApp"
    When the command completes successfully
    Then an attestation file ".attest.json" should be created
    And the attestation should contain command metadata:
      | field           | value                                    |
      | command         | generate                                |
      | template        | template-basic                          |
      | timestamp       | 2024-01-01T00:00:00Z                   |
      | user            | current_user                            |
      | working_dir     | /current/working/directory             |
    And the attestation should be cryptographically signed
    And signature verification should pass

  @attestation @comprehensive @critical
  Scenario: Complete attestation metadata capture
    Given I run a complex generation command
    When attestation is generated
    Then the attestation should contain:
      | section          | required_fields                           |
      | command_info     | command, args, flags, working_directory   |
      | environment      | os, arch, node_version, kgen_version     |
      | inputs           | template_files, variables, config_files   |
      | outputs          | generated_files, checksums, file_sizes   |
      | provenance       | source_template_hash, input_data_hash    |
      | execution        | start_time, end_time, duration, exit_code |
      | signature        | algorithm, public_key, signature_data    |
    And all fields should be populated correctly
    And timestamps should use SOURCE_DATE_EPOCH when available

  @attestation @file-tracking @critical
  Scenario: Track all input and output files in attestation
    Given I have a template that uses multiple input files:
      | file_type    | file_path                  |
      | template     | templates/api/controller.njk |
      | config       | config/defaults.yaml        |
      | data         | data/sample.json           |
    When I generate using this template
    Then the attestation should list all input files with:
      | field        | description                  |
      | path         | relative path from workspace |
      | hash         | BLAKE3 hash of file content |
      | size         | file size in bytes          |
      | modified     | last modification timestamp |
    And all output files should be tracked with checksums
    And file dependencies should be recorded

  @attestation @cryptographic-signing
  Scenario: Cryptographic signing of attestations
    Given I have a private key configured for signing
    When an attestation is generated
    Then the attestation should be signed using Ed25519
    And the signature should cover all attestation content
    And the public key should be included in attestation
    And signature verification should succeed with public key
    And tampered attestations should fail verification

  @attestation @chain-of-custody
  Scenario: Maintain chain of custody in attestations
    Given I perform a sequence of operations:
      | step | command                                    |
      | 1    | kgen generate base --name Project         |
      | 2    | kgen generate api --name UserAPI --inject |
      | 3    | kgen generate docs --name APIDoc         |
    When each operation completes
    Then each step should generate its own attestation
    And later attestations should reference previous ones
    And the chain of custody should be cryptographically linked
    And the complete provenance chain should be verifiable

  @attestation @deterministic
  Scenario: Deterministic attestation generation
    Given I run the same command multiple times with identical inputs
    When attestations are generated
    Then all attestations should be identical except for:
      | varying_field    | reason                           |
      | execution_id     | unique per execution            |
      | process_id       | different process each time     |
    And all other fields should be deterministic
    And signatures should be identical for identical content

  @attestation @error-handling
  Scenario: Attestation generation for failed commands
    Given I run a command that will fail
    When the command exits with non-zero status
    Then an attestation should still be generated
    And the attestation should record the failure:
      | field        | content                    |
      | exit_code    | actual non-zero exit code |
      | error_output | stderr content            |
      | failure_mode | timeout/error/interrupt   |
    And partial outputs should be recorded if any
    And the attestation should be signed normally

  @attestation @performance
  Scenario: Attestation generation performance impact
    Given I run performance-critical operations
    When attestation generation is enabled
    Then command execution time should increase by < 5%
    And attestation file size should be reasonable (< 100KB)
    And attestation generation should not significantly impact memory
    And cryptographic operations should be optimized

  @attestation @storage-integration
  Scenario: Integration with CAS for attestation storage
    Given CAS is enabled alongside attestation
    When attestations are generated
    Then attestation files should be stored in CAS
    And attestations should be retrievable by hash
    And duplicate attestations should be deduplicated
    And CAS should maintain attestation integrity

  @attestation @validation
  Scenario: Attestation validation and verification
    Given I have an attestation file from a previous command
    When I validate the attestation
    Then signature verification should pass or fail appropriately
    And file hashes should be verified against actual files
    And timestamp validity should be checked
    And command reproducibility should be assessable
    And validation results should be clearly reported

  @attestation @template-integrity
  Scenario: Template integrity verification in attestations
    Given I use templates from various sources
    When attestations are generated
    Then template source integrity should be verified
    And template modification detection should be included
    And template provenance should be recorded:
      | field              | content                        |
      | template_source    | file path or URL              |
      | template_version   | git commit or version tag     |
      | template_hash      | BLAKE3 hash of template       |
      | template_signature | author signature if available |

  @attestation @compliance
  Scenario: Compliance-ready attestation format
    Given I need attestations for compliance auditing
    When attestations are generated
    Then attestation format should comply with SLSA provenance spec
    And attestation should include all required SLSA fields
    And attestation should be machine-readable and parseable
    And attestation should support compliance automation tools
    And attestation format should be versioned and stable

  @attestation @multi-user
  Scenario: Multi-user attestation handling
    Given multiple users generate content with KGEN
    When attestations are created by different users
    Then each attestation should identify the actual user
    And user identity should be cryptographically bound
    And attestation should record user permissions and context
    And user-specific signing keys should be used
    And attestations should support user accountability

  @attestation @export-import
  Scenario: Attestation export and import
    Given I have a collection of attestations
    When I export attestations for external use
    Then export should preserve all attestation data
    And cryptographic signatures should remain valid
    And export format should be interoperable
    And import should restore attestations completely
    And imported attestations should be verifiable

  @attestation @integration-testing
  Scenario: End-to-end attestation workflow
    Given I perform a complete KGEN workflow
    When I trace the entire process through attestations
    Then I should have complete provenance from start to finish
    And all intermediate steps should be attestable
    And the complete workflow should be reproducible from attestations
    And attestation chain should provide full audit trail
    And workflow integrity should be cryptographically verifiable