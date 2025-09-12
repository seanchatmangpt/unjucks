Feature: Cross-Platform Reproducibility
  As a distributed development team
  I want identical artifacts across all platforms
  So that builds are consistent regardless of developer environment

  Background:
    Given KGEN is installed on multiple platforms
    And all systems use the same KGEN version
    And SOURCE_DATE_EPOCH is synchronized across environments

  @cross-platform @critical
  Scenario Outline: Generate identical artifacts across operating systems
    Given KGEN running on <platform>
    And identical template and input files
    And same SOURCE_DATE_EPOCH value "1704067200"
    When I generate the same artifact
    Then the output must be byte-identical to other platforms
    And SHA-256 checksums must match across all platforms
    And file structure must be identical

    Examples:
      | platform    |
      | Ubuntu 22.04|
      | macOS 13    |
      | Windows 11  |
      | Alpine Linux|

  @filesystem @consistency
  Scenario: Handle filesystem differences transparently
    Given different filesystem types (ext4, APFS, NTFS)
    When I generate artifacts with identical inputs
    Then outputs must be byte-identical despite filesystem differences
    And path normalization must be consistent
    And case sensitivity must be handled uniformly
    And file permissions must be normalized appropriately

  @encoding @localization
  Scenario: Maintain consistency across locale settings
    Given systems with different locale configurations
    And various default character encodings
    When I generate text-based artifacts
    Then all outputs must use UTF-8 encoding consistently
    And locale-specific formatting must be avoided
    And number/date formatting must be culture-invariant
    And sort order must be deterministic regardless of locale

  @docker @containerization
  Scenario: Verify reproducibility in containerized environments
    Given identical Docker containers on different host systems
    When I generate artifacts inside containers
    Then container outputs must be byte-identical
    And host system differences must not affect generation
    And container filesystem must not introduce variations

  @ci-cd @automation
  Scenario: Ensure CI/CD pipeline reproducibility
    Given the same commit across different CI runners
    And identical CI environment configurations
    When CI pipelines generate artifacts
    Then all CI-generated artifacts must be byte-identical
    And build logs must show consistent generation times (SOURCE_DATE_EPOCH)
    And artifact checksums must match across all CI runs

  @performance @consistency
  Scenario: Maintain reproducibility under different system loads
    Given systems with varying CPU and memory usage
    When I generate artifacts under different load conditions
    Then generation results must remain byte-identical
    And system performance must not affect output consistency
    And concurrent generations must not interfere with each other

  @network @offline
  Scenario: Generate consistently with and without network access
    Given templates that might reference external resources
    When I generate artifacts offline vs online
    Then outputs must be identical (no network dependencies)
    And any external references must be resolved deterministically
    And network timeouts must not affect generation results

  @versioning @compatibility
  Scenario: Maintain reproducibility across KGEN patch versions
    Given the same template and inputs
    When I use different KGEN patch versions (same major.minor)
    Then generated artifacts should remain byte-identical
    And breaking changes must be clearly documented
    And migration paths must preserve reproducibility

  @validation @verification
  Scenario: Cross-platform validation workflow
    Given artifacts generated on one platform
    When I verify checksums on different platforms
    Then verification must succeed without platform-specific tools
    And checksum algorithms must be consistently available
    And validation reports must be platform-independent

  @edge-cases @robustness
  Scenario: Handle edge cases consistently across platforms
    Given templates with edge cases (empty files, special characters, long paths)
    When I generate on different platforms
    Then edge case handling must be identical
    And error messages must be consistent
    And failure modes must be reproducible
    And recovery mechanisms must work identically