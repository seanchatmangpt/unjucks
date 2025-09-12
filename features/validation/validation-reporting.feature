Feature: Validation Error Reporting and Remediation
  As a KGEN developer
  I want comprehensive validation error reports with actionable fixes
  So that I can quickly identify and resolve data quality issues

  Background:
    Given KGEN validation reporting system is available
    And validation reports support JSON format by default
    And error reporting includes detailed diagnostics
    And performance target for report generation is "≤5ms"

  @reporting @basic
  Scenario: Generate basic validation violation report
    Given I have validation results with violations
    When I generate a validation report
    Then the report should include:
      | field                    | type    | description                     |
      | conforms                 | boolean | Overall validation success      |
      | timestamp               | string  | ISO 8601 validation timestamp   |
      | violations              | array   | List of violation objects       |
      | summary                 | object  | Aggregated validation summary   |
    And the report should be valid JSON
    And report generation should complete within "5ms"

  @reporting @detailed-violations
  Scenario: Report detailed violation information
    Given I have SHACL validation violations from constraint checking
    When I generate a detailed violation report
    Then each violation should include:
      | field                      | description                                |
      | focusNode                  | The RDF node that failed validation       |
      | resultPath                 | The property path that caused the violation|
      | sourceConstraintComponent  | The SHACL constraint that was violated    |
      | sourceShape                | The SHACL shape containing the constraint |
      | severity                   | Violation severity (Violation/Warning/Info)|
      | message                    | Human-readable error message              |
      | value                      | The actual value that caused the violation |
    And violations should be sorted by severity and focus node
    And violation messages should be actionable

  @reporting @aggregated-summary
  Scenario: Provide aggregated validation summary
    Given I have validation results with multiple violations
    When I generate a validation summary
    Then the summary should include:
      | field                       | description                         |
      | totalViolations            | Total count of all violations      |
      | violationsBySeverity       | Count grouped by severity level    |
      | violationsByShape          | Count grouped by SHACL shape       |
      | violationsByConstraint     | Count grouped by constraint type   |
      | performance.validationTime | Time spent on validation           |
      | performance.reportingTime  | Time spent generating report       |
      | performance.graphSize      | Number of triples in input graph   |
    And severity grouping should include counts for Violation, Warning, Info
    And performance metrics should be included

  @reporting @multi-format
  Scenario: Generate reports in multiple formats
    Given I have validation results to report
    When I request reports in different formats:
      | format | description                    |
      | json   | Structured JSON report         |
      | table  | Human-readable table format   |
      | csv    | Comma-separated values         |
      | html   | Web-friendly HTML report       |
    Then each format should contain the same core information
    And format-specific optimizations should be applied
    And all formats should be well-formed according to their specifications

  @reporting @severity-filtering
  Scenario: Filter violations by severity level
    Given I have validation results with mixed severity violations:
      | severity  | count |
      | Violation | 5     |
      | Warning   | 8     |
      | Info      | 12    |
    When I generate reports filtered by severity:
      | filter        | expected_count |
      | violations    | 5              |
      | warnings      | 8              |
      | info          | 12             |
      | non-info      | 13             |
    Then filtered reports should contain only matching violations
    And summary statistics should reflect the filter
    And filtering should not affect performance significantly

  @reporting @shape-based-grouping
  Scenario: Group violations by SHACL shape
    Given I have violations from multiple SHACL shapes:
      """
      PersonShape: 3 violations
      OrganizationShape: 2 violations  
      EventShape: 1 violation
      """
    When I generate a shape-grouped report
    Then violations should be organized by source shape
    And each shape group should include:
      | field              | description                        |
      | shapeName          | SHACL shape identifier            |
      | violationCount     | Number of violations for shape    |
      | violations         | Array of violations for shape     |
      | constraintsChecked | Number of constraints evaluated   |
    And shapes with no violations should be listed separately
    And shape-level statistics should be provided

  @reporting @constraint-analysis
  Scenario: Analyze violations by constraint type
    Given I have violations from different constraint types:
      | constraint_type   | count | description                  |
      | minCount          | 4     | Missing required properties  |
      | datatype          | 3     | Incorrect data types         |
      | pattern           | 2     | Regex pattern failures       |
      | maxInclusive      | 1     | Numeric range violations     |
    When I generate a constraint analysis report
    Then violations should be grouped by constraint component
    And each constraint group should show:
      | field               | description                           |
      | constraintType      | Type of SHACL constraint             |
      | violationCount      | Number of violations for constraint  |
      | affectedNodes       | List of focus nodes with violations  |
      | commonPatterns      | Frequently occurring violation patterns |
    And constraint-specific remediation suggestions should be provided

  @reporting @remediation-suggestions
  Scenario: Provide actionable remediation suggestions
    Given I have validation violations requiring fixes
    When I generate a remediation report
    Then each violation should include fix suggestions:
      | violation_type    | suggested_fix                              |
      | missing_property  | "Add required property with valid value"   |
      | invalid_datatype  | "Convert value to expected datatype"       |
      | pattern_mismatch  | "Update value to match expected pattern"   |
      | range_violation   | "Adjust value to be within valid range"    |
    And suggestions should include example correct values
    And automated fix scripts should be provided where possible
    And manual fix instructions should be clear and specific

  @reporting @progressive-disclosure
  Scenario: Support progressive disclosure of violation details
    Given I have complex validation results with nested details
    When I generate a layered report
    Then the report should support multiple detail levels:
      | level    | content                                    |
      | summary  | High-level overview with counts           |
      | grouped  | Violations organized by shape/constraint  |
      | detailed | Full violation details with context       |
      | debug    | Internal validation engine details        |
    And users should be able to drill down from summary to details
    And performance should remain good at all detail levels

  @reporting @contextual-information
  Scenario: Include contextual information in violation reports
    Given I have validation violations in a complex RDF graph
    When I generate a contextual report
    Then each violation should include context:
      | context_type       | description                               |
      | surrounding_triples| RDF triples near the violating statement |
      | related_entities   | Other entities connected to focus node    |
      | property_usage     | How the violating property is used elsewhere |
      | shape_intent       | Description of what the shape validates   |
    And context should help users understand why violations occurred
    And context should be limited to prevent information overload

  @reporting @trend-analysis
  Scenario: Track validation trends over time
    Given I have validation results from multiple time periods
    When I generate a trend analysis report
    Then the report should show:
      | trend_metric           | description                          |
      | violation_count_trend  | How total violations change over time |
      | new_violation_types    | Recently introduced violation types  |
      | resolved_violations    | Violations that were fixed           |
      | quality_score_trend    | Overall quality improvement trend    |
    And trends should be visualizable with charts
    And regression indicators should be highlighted
    And improvement recommendations should be trend-aware

  @reporting @performance-impact
  Scenario: Report validation performance impact
    Given I have validation results with performance metrics
    When I generate a performance impact report
    Then the report should include:
      | metric                  | description                           |
      | validation_time         | Time spent validating each shape     |
      | bottleneck_analysis     | Slowest constraints and shapes       |
      | resource_usage          | Memory and CPU utilization           |
      | scalability_indicators  | Performance vs. graph size metrics   |
    And performance recommendations should be provided
    And optimization opportunities should be identified

  @reporting @batch-processing
  Scenario: Generate reports for batch validation results
    Given I have validation results from processing multiple graphs in batch
    When I generate a batch validation report
    Then the report should aggregate results across all graphs:
      | aggregate_metric      | description                          |
      | overall_success_rate  | Percentage of graphs that validated  |
      | common_violations     | Most frequently occurring violations |
      | graph_quality_distribution | Quality score distribution       |
      | processing_statistics | Timing and throughput metrics       |
    And individual graph results should be accessible
    And batch-level recommendations should be provided

  @reporting @export-integration
  Scenario: Export reports for external tools and workflows
    Given I have validation reports to integrate with external systems
    When I export reports for external consumption
    Then export formats should include:
      | format     | use_case                                  |
      | junit_xml  | CI/CD test result integration            |
      | sarif      | Static analysis results interchange     |
      | csv        | Spreadsheet analysis and tracking       |
      | json_ld    | Semantic web tool integration           |
    And exports should maintain full fidelity of violation information
    And external tool integration should be well-documented

  @reporting @real-time-feedback
  Scenario: Provide real-time validation feedback during development
    Given I have a development environment with live validation
    When validation errors occur during development
    Then feedback should be immediate and contextual:
      | feedback_type    | timing        | content                          |
      | inline_errors    | <100ms       | Violations shown in editor       |
      | quick_fixes      | immediate    | Automated fix suggestions         |
      | live_statistics  | continuous   | Running quality metrics           |
      | change_impact    | on_save      | How changes affect validation     |
    And feedback should not interrupt development workflow
    And performance impact on editing should be minimal

  @reporting @compliance-reporting
  Scenario: Generate compliance reports for governance requirements
    Given I have validation results that need governance review
    When I generate compliance reports
    Then reports should address governance requirements:
      | requirement_type     | report_content                           |
      | data_quality_sla     | Quality metrics vs. agreed thresholds   |
      | schema_compliance    | Adherence to organizational schemas      |
      | privacy_compliance   | PII detection and handling verification  |
      | audit_trail         | Complete validation history and changes  |
    And compliance status should be clearly indicated
    And non-compliance issues should be prioritized by risk
    And remediation timelines should be suggested

  @reporting @customization
  Scenario: Support customizable reporting templates and formats
    Given I have specific organizational reporting requirements
    When I configure custom report templates
    Then I should be able to:
      | customization_type   | description                              |
      | field_selection     | Choose which fields to include in reports |
      | layout_templates    | Define custom report layouts              |
      | branding            | Add organizational branding to reports   |
      | threshold_config    | Set custom severity thresholds           |
    And custom templates should be reusable across validations
    And template configuration should be version-controlled
    And custom reports should maintain performance standards

  @reporting @accessibility
  Scenario: Ensure validation reports are accessible and inclusive
    Given I have validation reports that need to be accessible to all users
    When I generate accessible reports
    Then reports should meet accessibility standards:
      | accessibility_feature | description                              |
      | screen_reader_support | Proper semantic markup for screen readers |
      | color_blind_friendly  | Color schemes accessible to color blind users |
      | keyboard_navigation   | Full keyboard navigation support         |
      | text_scaling         | Support for text scaling and zoom       |
    And accessibility should not compromise report functionality
    And accessibility features should be tested and verified