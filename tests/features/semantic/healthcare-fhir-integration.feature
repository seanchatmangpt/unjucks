Feature: Healthcare FHIR Integration with HIPAA Compliance
  As a healthcare application developer
  I want to process FHIR R4 patient data through semantic templates
  So that I can maintain HIPAA compliance while generating reports

  Background:
    Given I have a semantic template system configured for FHIR
    And I have real FHIR R4 patient data loaded
    And HIPAA compliance validation is enabled

  Scenario: Process FHIR Patient Bundle with PHI Protection
    Given I have a FHIR Patient Bundle with 50 patients
    And the bundle contains PHI elements like names, addresses, and SSNs
    When I process the bundle through the healthcare template
    Then all PHI should be properly masked or encrypted
    And the output should validate against FHIR R4 schema
    And audit logs should record all PHI access
    And no PHI should appear in plain text in the output

  Scenario: Generate Clinical Summary Report from FHIR Data
    Given I have FHIR Observation and Condition resources
    And the data includes vital signs and diagnoses
    When I generate a clinical summary using semantic templates
    Then the output should include structured medical terminology
    And SNOMED CT codes should be properly resolved
    And the report should maintain referential integrity
    And performance should be under 2 seconds for 100 resources

  Scenario: Cross-Reference FHIR with Medical Ontologies
    Given I have FHIR data with ICD-10 and SNOMED codes
    And medical ontology data is loaded (UMLS, RxNorm)
    When I enrich the FHIR data through semantic processing
    Then medical codes should be properly mapped across ontologies
    And hierarchical relationships should be preserved
    And the enriched data should validate against HL7 FHIR profiles

  Scenario: HIPAA Audit Trail Generation
    Given I have processed multiple FHIR resources
    And PHI access has occurred during processing
    When I generate HIPAA audit reports
    Then all PHI access events should be logged with timestamps
    And user identification should be recorded for each access
    And the audit trail should be tamper-evident
    And retention policies should be automatically applied

  Scenario: Large Dataset FHIR Processing Performance
    Given I have a FHIR dataset with 10,000+ patient records
    And each patient has multiple observations and conditions
    When I process the entire dataset through semantic templates
    Then processing should complete within 30 seconds
    And memory usage should not exceed 512MB
    And all HIPAA compliance checks should remain active
    And data integrity should be maintained throughout

  Scenario: FHIR Data Validation and Error Handling
    Given I have FHIR data with intentional schema violations
    And some resources contain invalid PHI patterns
    When I process the malformed data
    Then schema validation errors should be properly reported
    And PHI violations should be flagged and blocked
    And partial processing should continue for valid resources
    And detailed error reports should be generated