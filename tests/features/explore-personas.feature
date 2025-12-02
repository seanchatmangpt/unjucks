@explore @personas @json @views @v1
Feature: Explore Personas with JSON View Generation
  As a KGEN user
  I want to explore different personas through generated JSON views
  So that I can understand and interact with complex data perspectives

  Background:
    Given I have a clean workspace
    And persona exploration is enabled
    And JSON view generation is configured

  @personas @basic @critical
  Scenario: Generate JSON views for basic personas
    Given I have defined basic personas:
      | persona_name    | role           | perspective           |
      | developer       | coder          | technical             |
      | product_manager | planning       | business              |
      | end_user        | consumer       | functional            |
      | admin           | operations     | system                |
    When I generate JSON views for each persona
    Then each persona should have a unique JSON view structure
    And views should reflect persona-specific data perspectives
    And JSON should be valid and well-formed
    And views should be consistently formatted

  @personas @data-filtering @critical
  Scenario: Filter data based on persona permissions and needs
    Given I have complex data with multiple access levels:
      ```json
      {
        "user": {
          "id": "user123",
          "name": "John Doe",
          "email": "john@example.com",
          "ssn": "123-45-6789",
          "preferences": {...},
          "admin_notes": "Internal notes",
          "billing_info": {...}
        }
      }
      ```
    And persona access rules:
      | persona     | accessible_fields                    | filtered_fields        |
      | end_user    | id, name, email, preferences         | ssn, admin_notes, billing_info |
      | support     | id, name, email, admin_notes         | ssn, billing_info     |
      | admin       | all fields                           | none                  |
    When I generate persona-specific JSON views
    Then each view should contain only accessible fields
    And filtered fields should be completely removed
    And access control should be consistently applied
    And view structure should remain logical

  @personas @computed-fields
  Scenario: Add persona-specific computed fields to JSON views
    Given I have base data and persona computation rules:
      | persona       | computed_field    | computation_rule                 |
      | developer     | debug_info        | include technical debugging data |
      | manager       | summary_stats     | aggregate statistics             |
      | analyst       | trend_data        | historical trend calculations    |
    When JSON views are generated with computed fields
    Then computed fields should be included in relevant persona views
    And computations should be performed correctly
    And computed fields should not appear in other persona views
    And computation should be efficient and cached when appropriate

  @personas @hierarchical-views
  Scenario: Generate hierarchical JSON views for complex personas
    Given I have hierarchical persona definitions:
      ```yaml
      personas:
        organization:
          - executive:
              - ceo
              - cto
              - cfo
          - management:
              - product_manager
              - engineering_manager
          - individual_contributor:
              - developer
              - designer
              - qa_engineer
      ```
    When hierarchical JSON views are generated
    Then parent persona data should be inherited by children
    And child personas should be able to override parent data
    And view hierarchy should be reflected in JSON structure
    And inheritance should be applied consistently

  @personas @dynamic-personas
  Scenario: Support dynamic persona creation from templates
    Given I have persona templates:
      ```yaml
      persona_template:
        name: "{{ role }}_{{ department }}"
        access_pattern: "{{ role }}_access"
        view_fields: "{{ role }}_fields"
        computed_fields: "{{ role }}_computations"
      ```
    When I create dynamic personas:
      | role      | department  |
      | manager   | engineering |
      | analyst   | marketing   |
      | lead      | design      |
    Then personas should be created dynamically
    And JSON views should be generated for dynamic personas
    And template interpolation should work correctly
    And dynamic personas should behave like static ones

  @personas @conditional-logic
  Scenario: Apply conditional logic in persona JSON views
    Given I have conditional view rules:
      ```yaml
      conditions:
        - if: "user.role == 'admin'"
          then: "include_all_fields"
        - if: "user.department == 'security'"
          then: "include_security_fields"
        - if: "time_of_day == 'business_hours'"
          then: "include_realtime_data"
      ```
    When JSON views are generated with conditions
    Then conditional logic should be evaluated correctly
    And view content should vary based on conditions
    And conditions should be re-evaluated for each view generation
    And complex boolean logic should be supported

  @personas @view-composition
  Scenario: Compose JSON views from multiple data sources
    Given I have multiple data sources:
      | source        | type        | data_format   |
      | user_db       | database    | structured    |
      | activity_log  | file        | json_lines    |
      | preferences   | api         | rest_json     |
      | analytics     | service     | graphql       |
    When personas require data from multiple sources
    Then JSON views should compose data seamlessly
    And data source differences should be abstracted
    And composition should handle missing data gracefully
    And view generation should be efficient across sources

  @personas @caching-optimization
  Scenario: Optimize JSON view generation with caching
    Given I have expensive computations in persona views
    When multiple users request the same persona views
    Then computed data should be cached appropriately
    And cache should be invalidated when base data changes
    And cache should respect persona-specific access controls
    And cache hit ratio should improve performance significantly

  @personas @real-time-updates
  Scenario: Update JSON views in real-time as data changes
    Given I have live data feeding into persona views
    When underlying data changes
    Then affected JSON views should be updated automatically
    And users should receive updated views efficiently
    And update propagation should be selective based on changes
    And real-time updates should maintain consistency

  @personas @validation
  Scenario: Validate JSON views against persona schemas
    Given I have defined JSON schemas for each persona:
      ```json
      {
        "developer_schema": {
          "type": "object",
          "required": ["technical_data", "debug_info"],
          "properties": {...}
        },
        "manager_schema": {
          "type": "object", 
          "required": ["summary_stats", "team_data"],
          "properties": {...}
        }
      }
      ```
    When JSON views are generated
    Then each view should validate against its persona schema
    And validation errors should be clearly reported
    And invalid views should not be returned to users
    And schema compliance should be maintained consistently

  @personas @internationalization
  Scenario: Support internationalized persona views
    Given I have multi-language persona definitions
    When JSON views are requested with locale information:
      | locale | expected_language |
      | en-US  | English           |
      | es-ES  | Spanish           |
      | fr-FR  | French            |
    Then field labels should be translated appropriately
    And data formatting should follow locale conventions
    And cultural perspectives should be considered in view generation
    And fallback language should be handled gracefully

  @personas @audit-tracking
  Scenario: Track JSON view access and generation for auditing
    Given I have audit requirements for persona view access
    When JSON views are generated and accessed
    Then all view generation should be logged
    And user access patterns should be tracked
    And audit logs should include persona and data details
    And compliance reporting should be supported
    And audit data should be tamper-evident

  @personas @performance
  Scenario: Ensure JSON view generation performance at scale
    Given I have 10,000 users with diverse persona requirements
    When JSON views are generated concurrently
    Then view generation should complete within acceptable time (< 2 seconds)
    And concurrent generation should scale linearly
    And memory usage should remain bounded
    And database queries should be optimized
    And performance should degrade gracefully under load

  @personas @testing
  Scenario: Test persona JSON views comprehensively
    Given I have defined test cases for each persona
    When automated testing runs
    Then each persona view should be tested independently
    And cross-persona consistency should be validated
    And edge cases should be covered (empty data, invalid inputs)
    And performance regression should be detected
    And test coverage should be comprehensive

  @personas @documentation
  Scenario: Generate documentation for persona JSON views
    Given I have complex persona view definitions
    When documentation is generated
    Then each persona should have clear documentation
    And JSON view structure should be documented
    And access patterns should be explained
    And examples should be provided for each persona
    And documentation should be kept up-to-date automatically