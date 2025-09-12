@workflows @end-to-end @critical
Feature: End-to-End Generation Workflows
  As a KGEN system user
  I want complete artifact generation workflows from RDF to attestation
  So that I can trust the entire pipeline meets charter KPIs

  Background:
    Given KGEN is initialized with performance monitoring
    And the following KPI thresholds are configured:
      | metric                 | threshold  | critical |
      | reproducibility_rate   | ≥99.9%     | yes      |
      | provenance_coverage    | 100%       | yes      |
      | cache_hit_rate         | ≥80%       | no       |
      | p95_response_time      | ≤150ms     | no       |
      | drift_snr             | ≥90%       | no       |
    And OpenTelemetry tracing is enabled
    And attestation cryptographic keys are configured

  @complete-workflow @deterministic
  Scenario: Complete RDF to Artifact Generation with Attestation
    Given an RDF knowledge graph "product-catalog.ttl" containing:
      """
      @prefix : <http://example.org/catalog/> .
      @prefix schema: <http://schema.org/> .
      
      :Product001 a schema:Product ;
        schema:name "Enterprise Widget" ;
        schema:price "299.99" ;
        schema:category "Electronics" ;
        schema:inStock true .
      
      :Product002 a schema:Product ;
        schema:name "Professional Tool" ;
        schema:price "149.50" ;
        schema:category "Tools" ;
        schema:inStock false .
      """
    And a KGEN template "product-api.njk" with deterministic generation:
      """
      // Generated at: {{ _kgen.timestamp }}
      // Artifact ID: {{ _kgen.artifact_id }}
      // Source RDF: {{ _kgen.source_hash }}
      
      export interface Product {
        id: string;
        name: string;
        price: number;
        category: string;
        inStock: boolean;
      }
      
      export const products: Product[] = [
      {% for product in products %}
        {
          id: "{{ product.id }}",
          name: "{{ product.name }}",
          price: {{ product.price }},
          category: "{{ product.category }}",
          inStock: {{ product.inStock }}
        }{% if not loop.last %},{% endif %}
      {% endfor %}
      ];
      
      // KGEN Metadata
      export const metadata = {
        generatedAt: "{{ _kgen.timestamp }}",
        sourceGraph: "{{ _kgen.source_graph }}",
        templateVersion: "{{ _kgen.template_version }}",
        reproducibilityHash: "{{ _kgen.reproducibility_hash }}"
      };
      """
    When I execute the complete generation workflow:
      """
      kgen generate --graph product-catalog.ttl \
                   --template product-api.njk \
                   --output src/generated/products.ts \
                   --attest \
                   --trace \
                   --kpi-validation
      """
    Then the workflow should complete successfully within 150ms (p95)
    And the generated artifact "src/generated/products.ts" should exist
    And the artifact should contain valid TypeScript with product data
    And the artifact should include KGEN metadata with:
      | field                 | validation           |
      | generatedAt          | ISO8601 timestamp    |
      | sourceGraph          | SHA256 hash          |
      | templateVersion      | semantic version     |
      | reproducibilityHash  | deterministic hash   |
    And an attestation file "src/generated/products.ts.attest.json" should be created
    And the attestation should contain cryptographic signatures
    And provenance data should be 100% complete with full lineage
    And the workflow should achieve ≥99.9% reproducibility when re-executed
    And all KPI thresholds should be met:
      | metric                | actual    | threshold  | status |
      | reproducibility_rate  | 100%      | ≥99.9%     | PASS   |
      | provenance_coverage   | 100%      | 100%       | PASS   |
      | p95_response_time     | <150ms    | ≤150ms     | PASS   |

  @multi-artifact @complex-workflow
  Scenario: Multi-Artifact Generation with Cross-References
    Given an RDF knowledge graph "enterprise-system.ttl" with complex relationships:
      """
      @prefix : <http://example.org/system/> .
      @prefix schema: <http://schema.org/> .
      
      :UserService a :MicroService ;
        :name "UserService" ;
        :port 8080 ;
        :dependsOn :DatabaseService ;
        :exposes :UserAPI .
      
      :DatabaseService a :MicroService ;
        :name "DatabaseService" ;
        :port 5432 ;
        :type "PostgreSQL" .
      
      :UserAPI a :APIEndpoint ;
        :path "/api/users" ;
        :methods "GET,POST,PUT,DELETE" ;
        :authentication :JWTAuth .
      """
    And multiple KGEN templates for different artifacts:
      | template                | output                           | type       |
      | service-config.njk      | config/services.yaml            | config     |
      | api-types.njk          | src/types/api.ts                | typescript |
      | docker-compose.njk     | docker-compose.yml              | compose    |
      | openapi-spec.njk       | docs/api.yaml                   | openapi    |
    When I execute multi-artifact generation:
      """
      kgen generate-all --graph enterprise-system.ttl \
                       --templates templates/ \
                       --output-base generated/ \
                       --cross-reference \
                       --validate-refs \
                       --attest-all \
                       --parallel
      """
    Then all 4 artifacts should be generated successfully
    And cross-references between artifacts should be validated
    And each artifact should have its own attestation file
    And the generation should complete in parallel within 200ms
    And provenance should track inter-artifact dependencies
    And reproducibility should be maintained across all artifacts (≥99.9%)
    And the workflow should handle complex cross-references correctly

  @incremental-generation @optimization
  Scenario: Incremental Generation with Change Detection
    Given a previously generated artifact set from "system-v1.ttl"
    And baseline performance metrics are recorded
    When I update the RDF graph with new data "system-v2.ttl":
      """
      # Added new service
      :NotificationService a :MicroService ;
        :name "NotificationService" ;
        :port 8081 ;
        :dependsOn :UserService .
      """
    And I run incremental generation:
      """
      kgen generate --graph system-v2.ttl \
                   --templates templates/ \
                   --output-base generated/ \
                   --incremental \
                   --detect-changes \
                   --optimize
      """
    Then only affected artifacts should be regenerated
    And unchanged artifacts should be preserved with original timestamps
    And cache hit rate should be ≥80%
    And incremental generation should be >5x faster than full generation
    And change detection should identify specific modifications
    And provenance should track incremental changes with full lineage
    And drift detection should validate consistency (SNR ≥90%)

  @failure-recovery @resilience
  Scenario: Workflow Failure Recovery and Self-Healing
    Given a complex generation workflow in progress
    And fault injection is configured for testing
    When a template rendering fails due to malformed RDF data:
      """
      # Intentionally malformed RDF
      :BrokenService a :MicroService
        :name "Incomplete" # Missing semicolon
        :port "not-a-number" .
      """
    Then the workflow should detect the RDF syntax error
    And auto-recovery mechanisms should attempt healing
    And partial results should be preserved
    And detailed error provenance should be recorded
    And the workflow should provide actionable repair suggestions
    And retry mechanisms should be triggered with exponential backoff
    And the system should maintain integrity of successfully generated artifacts
    And error metrics should be tracked for system improvement

  @concurrent-workflows @stress-test
  Scenario: Concurrent Multi-User Workflows
    Given 10 simultaneous generation workflows are initiated
    And each workflow uses different RDF graphs and templates
    And system resource monitoring is active
    When all workflows execute concurrently:
      | user_id | graph_file      | template_set | expected_artifacts |
      | user_1  | catalog-1.ttl   | ecommerce    | 5                 |
      | user_2  | services-1.ttl  | microservice | 8                 |
      | user_3  | data-model.ttl  | database     | 12                |
      | user_4  | api-spec.ttl    | openapi      | 6                 |
      | user_5  | config-1.ttl    | kubernetes   | 15                |
      | user_6  | schema-1.ttl    | graphql      | 4                 |
      | user_7  | workflow-1.ttl  | github       | 7                 |
      | user_8  | deploy-1.ttl    | terraform    | 10                |
      | user_9  | monitor-1.ttl   | observability| 9                 |
      | user_10 | security-1.ttl  | compliance   | 11                |
    Then all workflows should complete within 500ms (p95)
    And no resource conflicts should occur
    And each workflow should maintain independent provenance chains
    And attestations should be generated for all artifacts
    And system should handle concurrent access to shared resources safely
    And memory usage should remain bounded below system limits
    And cache efficiency should be maintained across concurrent operations
    And all KPI thresholds should be met under concurrent load

  @performance-validation @kpi-compliance
  Scenario Outline: Performance Validation Across Workflow Complexity
    Given a "<complexity>" workflow with "<artifacts>" artifacts
    And performance monitoring is active
    And KPI baselines are established
    When I execute the generation workflow
    Then response time should meet p95 threshold of ≤150ms
    And reproducibility should be ≥99.9%
    And provenance coverage should be 100%
    And cache efficiency should be optimized for workflow complexity
    And resource utilization should be within acceptable bounds

    Examples:
      | complexity | artifacts | expected_time | max_memory | cache_target |
      | simple     | 1-5       | <50ms         | <50MB      | ≥90%         |
      | moderate   | 6-15      | <100ms        | <100MB     | ≥85%         |
      | complex    | 16-30     | <150ms        | <200MB     | ≥80%         |
      | enterprise | 31-50     | <200ms        | <300MB     | ≥75%         |

  @attestation-integrity @security
  Scenario: Complete Attestation and Cryptographic Verification
    Given KGEN cryptographic attestation is configured with:
      | component        | algorithm | key_size |
      | signing          | Ed25519   | 256-bit  |
      | hashing          | SHA-256   | 256-bit  |
      | timestamping     | RFC3161   | standard |
    And a workflow generates multiple interconnected artifacts
    When attestation is performed on all generated artifacts:
      """
      kgen attest --artifacts generated/*.* \
                  --cross-verify \
                  --timestamp-server https://timestamp.digicert.com \
                  --chain-validation
      """
    Then each artifact should have a valid .attest.json file
    And attestations should contain:
      | field              | requirement                    |
      | artifact_hash      | SHA-256 of generated file     |
      | generation_time    | RFC3161 timestamp             |
      | template_hash      | SHA-256 of source template    |
      | rdf_graph_hash     | SHA-256 of input RDF          |
      | signature          | Ed25519 digital signature     |
      | provenance_chain   | Complete lineage tracking     |
    And cross-verification between related attestations should pass
    And cryptographic signatures should be verifiable
    And timestamp integrity should be maintained
    And the complete attestation chain should be immutable

  @end-to-end-validation @integration
  Scenario: Full System Integration with External Validation
    Given KGEN is integrated with external validation systems
    And compliance requirements are configured
    When a complete workflow executes with external validation:
      """
      kgen workflow-complete --graph enterprise-data.ttl \
                           --templates certified-templates/ \
                           --validate-external \
                           --compliance-check \
                           --full-attestation \
                           --audit-trail
      """
    Then the workflow should integrate with external systems successfully
    And compliance validation should pass all configured checks
    And audit trail should be complete and exportable
    And external validation APIs should confirm artifact integrity
    And the workflow should meet all enterprise security requirements
    And performance should remain within SLA bounds despite external calls
    And full end-to-end traceability should be maintained