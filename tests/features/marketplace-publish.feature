@marketplace @publish @tar @v1
Feature: Marketplace Publishing with Deterministic TAR Creation
  As a KGEN template author
  I want to publish templates to marketplace with deterministic TAR archives
  So that my templates can be distributed reliably and verifiably

  Background:
    Given I have a clean workspace
    And marketplace publishing is configured
    And I have a complete template ready for publishing

  @publish @deterministic @critical
  Scenario: Create deterministic TAR archive for template
    Given I have a template "user-auth" with structure:
      | path                    | content                |
      | template.yaml          | template metadata      |
      | src/controller.njk     | controller template    |
      | src/model.njk          | model template         |
      | tests/controller.test.njk | test template       |
      | README.md              | template documentation |
    When I create a TAR archive for marketplace publishing
    Then the TAR archive should be deterministic
    And file order in TAR should be consistent (sorted)
    And file timestamps should use SOURCE_DATE_EPOCH
    And TAR should be reproducible across systems
    And archive checksum should be identical on regeneration

  @publish @metadata @critical
  Scenario: Include comprehensive metadata in published package
    Given I have a template with complete metadata
    When I publish to marketplace
    Then the package should include metadata file with:
      | field           | description                           |
      | name            | template unique name                  |
      | version         | semantic version                      |
      | author          | author information                    |
      | description     | detailed template description         |
      | keywords        | searchable tags                       |
      | license         | license information                   |
      | dependencies    | required dependencies                 |
      | kgen_version    | minimum required KGEN version         |
      | created_at      | publication timestamp                 |
      | checksum        | package integrity checksum            |
    And metadata should be JSON Schema validated
    And metadata should be signed by author

  @publish @validation @critical
  Scenario: Validate template before publishing
    Given I attempt to publish a template
    When validation runs before publishing
    Then template structure should be validated
    And all template files should be syntactically correct
    And required metadata fields should be present
    And template should generate successfully with sample data
    And no security vulnerabilities should be detected
    And validation errors should prevent publishing

  @publish @versioning
  Scenario: Template versioning and updates
    Given I have a published template version 1.0.0
    When I publish an updated version 1.1.0
    Then both versions should be available in marketplace
    And version history should be maintained
    And upgrade path should be documented
    And breaking changes should be clearly marked
    And semantic versioning should be enforced

  @publish @dependencies
  Scenario: Handle template dependencies in publication
    Given I have a template that depends on other templates:
      | dependency      | version     | required |
      | base-layout     | ^2.0.0     | true     |
      | auth-helpers    | ~1.5.0     | true     |
      | ui-components   | *          | false    |
    When I publish the template
    Then dependency information should be included in package
    And dependency resolution should be validated
    And circular dependencies should be detected and rejected
    And dependency compatibility should be verified

  @publish @security
  Scenario: Security scanning of published templates
    Given I publish a template to marketplace
    When security scanning is performed
    Then template content should be scanned for malicious code
    And external URLs should be validated
    And script execution should be sandboxed
    And potential security issues should be flagged
    And security scan results should be stored with package

  @publish @integrity
  Scenario: Package integrity and signing
    Given I publish a template package
    When the package is created
    Then package should be cryptographically signed
    And signature should cover entire TAR content
    And public key should be associated with author
    And package tampering should be detectable
    And signature verification should be required for installation

  @publish @size-optimization
  Scenario: Optimize package size for distribution
    Given I have a large template with many assets
    When I create the publication package
    Then unnecessary files should be excluded (.git, node_modules, etc.)
    And binary files should be validated for necessity
    And package size should be optimized without losing functionality
    And compression should be applied efficiently
    And size limits should be enforced

  @publish @documentation
  Scenario: Include comprehensive documentation in package
    Given I publish a template
    When documentation is processed
    Then README should be included and rendered properly
    And usage examples should be provided
    And parameter documentation should be complete
    And generated sample outputs should be included
    And documentation should be validated for completeness

  @publish @licensing
  Scenario: Handle licensing and legal requirements
    Given I publish a template with specific license
    When legal validation occurs
    Then license compatibility should be verified
    And license text should be included in package
    And copyright information should be preserved
    And license compliance should be validated
    And incompatible licenses should be rejected

  @publish @automation
  Scenario: Automated publishing pipeline
    Given I have a template in version control
    When I trigger automated publishing
    Then CI/CD pipeline should build package automatically
    And tests should run before publishing
    And package should be validated automatically
    And publishing should only succeed if all checks pass
    And publication should be atomic (all-or-nothing)

  @publish @rollback
  Scenario: Handle publishing failures and rollback
    Given I attempt to publish a template
    When publishing fails partway through
    Then partial publication should be rolled back completely
    And marketplace state should remain consistent
    And error information should be clearly reported
    And retry mechanism should be available
    And no corrupted packages should remain

  @publish @marketplace-integration
  Scenario: Integration with marketplace infrastructure
    Given I publish to the KGEN marketplace
    When publication completes
    Then template should be searchable immediately
    And download statistics should begin tracking
    And template should be available for installation
    And marketplace API should reflect new publication
    And CDN distribution should be initiated

  @publish @performance
  Scenario: Publishing performance and scalability
    Given I publish a large template package
    When publication processing occurs
    Then package creation should complete within reasonable time
    And upload should handle network interruptions gracefully
    And large packages should be supported efficiently
    And concurrent publishing should not cause conflicts
    And system resources should be used efficiently

  @publish @notification
  Scenario: Publication notifications and feedback
    Given I complete template publication
    When publication is successful
    Then author should receive confirmation notification
    And publication details should be provided
    And marketplace URL should be shared
    And publication status should be trackable
    And any issues should be reported clearly

  @publish @analytics
  Scenario: Publication analytics and metrics
    Given I have published templates
    When analytics are generated
    Then download statistics should be tracked
    And usage patterns should be recorded
    And version adoption should be monitored
    And performance metrics should be available
    And author dashboard should provide insights