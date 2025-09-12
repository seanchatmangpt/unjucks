@workflows @integration @multi-component
Feature: Multi-Component Integration Workflows
  As a KGEN system architect
  I want seamless integration between all KGEN components
  So that complex workflows operate cohesively with full traceability

  Background:
    Given KGEN multi-component system is initialized
    And component integration monitoring is enabled
    And the following integration KPIs are configured:
      | component_pair           | sync_time | error_rate | throughput |
      | RDF_Parser→Template      | ≤10ms     | ≤0.1%      | ≥1000/s    |
      | Template→Renderer        | ≤20ms     | ≤0.05%     | ≥500/s     |
      | Renderer→Attestation     | ≤30ms     | ≤0.01%     | ≥200/s     |
      | Provenance→Validation    | ≤15ms     | ≤0.1%      | ≥800/s     |
    And distributed tracing spans all components

  @component-orchestration @pipeline
  Scenario: Full Component Pipeline Integration
    Given the KGEN pipeline has components:
      | component           | responsibility              | input_type      | output_type     |
      | RDF Parser          | Parse knowledge graphs      | RDF/TTL         | JSON-LD         |
      | Template Engine     | Process Nunjucks templates  | JSON-LD+Template| Rendered AST    |
      | Validation Engine   | Validate generated content  | Rendered AST    | Validated AST   |
      | Attestation Service | Create cryptographic proofs | Validated AST   | Signed Artifact |
      | Provenance Tracker  | Record generation lineage   | All stages      | Provenance Graph|
    And each component has health checks and metrics exposed
    When I initiate a complex multi-stage workflow:
      """
      kgen pipeline-execute --graph complex-system.ttl \
                           --template-set enterprise/ \
                           --validation-rules strict \
                           --attestation-level full \
                           --provenance-depth complete \
                           --trace-all-components
      """
    Then all components should execute in proper sequence
    And each component handoff should complete within SLA times
    And no component should experience errors during handoff
    And the complete pipeline should maintain data integrity
    And distributed tracing should show complete component flow
    And component health metrics should remain within normal ranges

  @cross-component-validation @consistency
  Scenario: Cross-Component Data Consistency Validation
    Given data flows through multiple KGEN components
    And consistency validation checkpoints are configured
    When data transitions between components:
      | from_component    | to_component      | data_format | validation_rules    |
      | RDF_Parser        | Template_Engine   | JSON-LD     | schema_compliance   |
      | Template_Engine   | Validator         | AST         | semantic_integrity  |
      | Validator         | Attestation       | Clean_AST   | completeness_check  |
      | Attestation       | Provenance        | Signed_Data | signature_validity  |
    Then data integrity should be maintained across all transitions
    And validation checkpoints should pass at each handoff
    And any data corruption should be detected immediately
    And component-specific schemas should be enforced
    And rollback mechanisms should be triggered on validation failures
    And complete audit trail should track all validation points

  @parallel-component-execution @optimization
  Scenario: Parallel Component Execution with Synchronization
    Given a workflow that can benefit from parallel execution
    And components support concurrent operation
    And synchronization points are defined
    When I execute parallel component workflows:
      """
      # Parallel execution configuration
      RDF_Parser (input1.ttl) → Template_Engine_A (template-set-1/) 
                              → Validator_A → Attestation_A
      RDF_Parser (input2.ttl) → Template_Engine_B (template-set-2/) 
                              → Validator_B → Attestation_B
      
      # Synchronization point
      [Attestation_A, Attestation_B] → Provenance_Merger → Final_Output
      """
    Then parallel pipelines should execute concurrently
    And synchronization should occur at defined merge points
    And no race conditions should occur during parallel execution
    And resource contention should be minimized
    And final output should integrate all parallel results correctly
    And performance should show significant improvement over sequential execution
    And component isolation should prevent cross-contamination

  @component-failure-handling @resilience
  Scenario: Component Failure Detection and Recovery
    Given a multi-component workflow is executing
    And fault injection capabilities are enabled
    When a critical component fails during execution:
      | failure_type      | affected_component | failure_point    | recovery_strategy |
      | memory_exhaustion | Template_Engine    | render_phase     | auto_restart      |
      | network_timeout   | Attestation_Service| signature_request| retry_backoff     |
      | data_corruption   | Validator          | schema_check     | rollback_repair   |
      | disk_full         | Provenance_Tracker | write_operation  | cleanup_retry     |
    Then component failure should be detected within 100ms
    And recovery mechanisms should be triggered automatically
    And downstream components should be notified appropriately
    And workflow state should be preserved during recovery
    And recovered components should resume from last known good state
    And failure metrics should be recorded for analysis
    And system should maintain overall workflow integrity

  @inter-component-communication @messaging
  Scenario: Component Communication and Event Processing
    Given components communicate via event-driven messaging
    And message queues are configured for reliability
    And event schemas are defined for all inter-component messages
    When components exchange complex data structures:
      """
      Component Events Flow:
      RDF_Parser → [RDF_PARSED] → Template_Engine
      Template_Engine → [TEMPLATE_RENDERED] → Validator
      Validator → [VALIDATION_COMPLETE] → Attestation_Service
      Attestation_Service → [ATTESTATION_CREATED] → Provenance_Tracker
      
      Cross-cutting Events:
      * → [ERROR_OCCURRED] → Error_Handler
      * → [PERFORMANCE_METRIC] → Metrics_Collector
      * → [AUDIT_EVENT] → Audit_Logger
      """
    Then all event messages should conform to defined schemas
    And message delivery should be guaranteed (at-least-once)
    And event processing should be idempotent
    And event ordering should be maintained where required
    And failed message processing should trigger retry mechanisms
    And event metrics should be collected for system monitoring
    And dead letter queues should handle unprocessable messages

  @component-scaling @load-balancing
  Scenario: Dynamic Component Scaling and Load Distribution
    Given KGEN components support horizontal scaling
    And load balancing is configured for high-throughput components
    And auto-scaling policies are defined
    When system experiences increased load:
      | component         | current_instances | max_instances | scale_trigger | scale_metric |
      | Template_Engine   | 2                | 10            | >80% CPU      | cpu_usage    |
      | Validator         | 1                | 5             | >queue_size   | queue_depth  |
      | Attestation       | 1                | 3             | >response_time| avg_latency  |
    Then components should scale automatically based on load
    And new instances should be provisioned within 30 seconds
    And load should be distributed evenly across instances
    And scaling should not disrupt ongoing workflows
    And scaled-down instances should complete current work before termination
    And component discovery should work with dynamic instance counts

  @data-lineage-integration @traceability
  Scenario: Complete Data Lineage Across Component Boundaries
    Given data lineage tracking is enabled for all components
    And lineage metadata includes component-specific information
    When a complex artifact is generated through multiple components:
      """
      Data Lineage Flow:
      input.ttl (v1.2.3) 
        → RDF_Parser (parsed_at: T1, parser_version: 2.1.0)
        → Template_Engine (template: enterprise-v1.5.2, rendered_at: T2)
        → Validator (rules: strict-v3.0.1, validated_at: T3)
        → Attestation (signed_at: T4, key_id: prod-key-001)
        → output.ts (final_hash: abc123..., completed_at: T5)
      """
    Then complete lineage should be recorded across all component boundaries
    And each component should contribute detailed metadata to lineage
    And lineage should include component versions and configurations
    And temporal relationships should be accurately recorded
    And lineage should be queryable via SPARQL queries
    And lineage integrity should be cryptographically verifiable
    And component-specific provenance should be aggregatable

  @component-compatibility @versioning
  Scenario: Component Version Compatibility and Migration
    Given KGEN components have independent versioning
    And compatibility matrices are defined
    And migration paths are documented
    When component versions are updated:
      | component         | from_version | to_version | compatibility | migration_required |
      | RDF_Parser        | 2.0.1       | 2.1.0      | backward      | no                |
      | Template_Engine   | 1.5.0       | 2.0.0      | breaking      | yes               |
      | Validator         | 3.0.0       | 3.0.1      | patch         | no                |
      | Attestation       | 1.0.0       | 1.1.0      | forward       | optional          |
    Then component compatibility should be validated before deployment
    And breaking changes should trigger migration workflows
    And backward compatibility should be maintained where possible
    And version conflicts should be detected and resolved
    And component API contracts should be enforced
    And migration should preserve existing workflow functionality

  @security-integration @authentication
  Scenario: Integrated Security Across Component Boundaries
    Given security policies are enforced at component boundaries
    And authentication/authorization is centrally managed
    And security audit trails span all components
    When secure workflows execute across multiple components:
      """
      Security Flow:
      User → Auth_Service (JWT issued)
      User + JWT → RDF_Parser (authorized for read)
      RDF_Parser + Context → Template_Engine (authorized for template access)
      Template_Engine + Context → Validator (authorized for validation rules)
      Validator + Context → Attestation (authorized for signing keys)
      """
    Then authentication should be propagated across all components
    And authorization should be enforced at each component boundary
    And security context should be maintained throughout workflow
    And sensitive data should be encrypted during inter-component transit
    And security audit events should be logged comprehensively
    And component access should be role-based and principle-of-least-privilege

  @performance-integration @end-to-end-metrics
  Scenario: Integrated Performance Monitoring and Optimization
    Given performance monitoring spans all components
    And end-to-end performance metrics are collected
    And performance bottlenecks can be identified across component boundaries
    When a performance-critical workflow executes:
      """
      Performance Monitoring Points:
      - RDF parsing time and memory usage
      - Template rendering throughput and latency
      - Validation rule execution time
      - Attestation cryptographic operation duration
      - Inter-component communication overhead
      - End-to-end workflow completion time
      """
    Then performance metrics should be collected at all monitoring points
    And bottlenecks should be automatically identified
    And performance should meet all defined SLAs
    And optimization recommendations should be generated
    And performance trends should be tracked over time
    And alerts should be triggered for performance degradation
    And component-specific performance tuning should be coordinated

  @disaster-recovery @business-continuity
  Scenario: Component Disaster Recovery and Business Continuity
    Given disaster recovery procedures are defined for all components
    And backup/restore capabilities exist for component state
    And failover mechanisms are implemented
    When a catastrophic component failure occurs:
      | disaster_type     | affected_components    | recovery_time_objective | recovery_point_objective |
      | data_center_loss  | all_components        | 4 hours                | 15 minutes               |
      | component_corruption| Template_Engine     | 30 minutes             | 5 minutes                |
      | network_partition | Attestation_Service   | 15 minutes             | 1 minute                 |
    Then disaster recovery should be initiated automatically
    And component state should be restored to last consistent checkpoint
    And workflow integrity should be maintained during recovery
    And data loss should be minimized according to RPO requirements
    And recovery time should meet defined RTO requirements
    And business continuity should be maintained throughout recovery
    And post-recovery validation should confirm system integrity