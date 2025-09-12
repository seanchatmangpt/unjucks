# KGEN End-to-End Workflow Testing

This directory contains comprehensive Gherkin features for testing KGEN's complete end-to-end workflows, focusing on system integration and charter KPI validation.

## Overview

These features implement the 80/20 principle by focusing on the most critical workflows that validate KGEN's core promises:

- **Complete generation → validation → attestation workflows**
- **Multi-step artifact creation pipelines**
- **Cross-component integration testing**
- **Performance validation across entire system**
- **Real-world usage scenarios**

## Charter KPI Validation

All features validate the following KGEN charter KPIs:

| KPI | Requirement | Critical |
|-----|-------------|----------|
| Reproducibility Rate | ≥99.9% | ✅ |
| Provenance Coverage | 100% | ✅ |
| Cache Hit Rate | ≥80% | - |
| P95 Response Time | ≤150ms | - |
| Drift SNR | ≥90% | - |

## Feature Files

### 1. `end-to-end-generation.feature`
**Complete RDF-to-Artifact Generation Workflows**

- ✅ **Complete workflow validation** - RDF → Template → Output → Attestation
- ✅ **Multi-artifact generation** - Complex cross-referenced artifacts
- ✅ **Incremental generation** - Change detection and optimization
- ✅ **Failure recovery** - Self-healing and resilience testing
- ✅ **Concurrent workflows** - Multi-user stress testing
- ✅ **Attestation integrity** - Cryptographic verification
- ✅ **External integration** - Enterprise validation systems

**Key Scenarios:**
- Complete deterministic generation with 100% reproducibility
- Multi-artifact workflows with cross-references
- Incremental updates with >5x performance improvement
- Concurrent execution with 10 simultaneous users
- Full cryptographic attestation chain
- Enterprise compliance and security validation

### 2. `integration-workflows.feature`
**Multi-Component System Integration**

- ✅ **Component orchestration** - Full pipeline integration
- ✅ **Cross-component validation** - Data consistency across boundaries
- ✅ **Parallel execution** - Component synchronization
- ✅ **Failure handling** - Recovery and resilience
- ✅ **Inter-component communication** - Event-driven messaging
- ✅ **Dynamic scaling** - Load balancing and auto-scaling
- ✅ **Security integration** - Authentication across components

**Key Scenarios:**
- 5-component pipeline with <10ms handoff times
- Parallel component execution with synchronization
- Automatic failure detection and recovery <100ms
- Event-driven communication with guaranteed delivery
- Dynamic scaling based on load metrics
- End-to-end security context propagation

### 3. `performance-workflows.feature`
**System-Wide Performance Validation**

- ✅ **KPI validation** - All charter requirements under load
- ✅ **Reproducibility testing** - 1000 iterations, 100% identical output
- ✅ **Provenance coverage** - Complete lineage validation
- ✅ **Cache performance** - Hit rate optimization across patterns
- ✅ **Response time distribution** - P95 validation under varying load
- ✅ **Drift detection** - SNR measurement and accuracy
- ✅ **Comprehensive testing** - All KPIs simultaneously

**Key Scenarios:**
- 100% reproducibility across 1000 concurrent executions
- Complete provenance coverage with SPARQL queryability
- 80%+ cache hit rate across all access patterns
- P95 response time ≤150ms under 200 req/s load
- 90%+ drift detection SNR with <5% false positives
- 72-hour endurance testing with stable performance

## Usage Examples

### Running Complete Workflow Validation
```bash
# End-to-end generation validation
kgen generate --graph complex-system.ttl \
              --template enterprise-templates/ \
              --attest --trace --kpi-validation

# Multi-component integration testing
kgen pipeline-execute --graph system.ttl \
                     --template-set templates/ \
                     --validation-rules strict \
                     --trace-all-components

# Comprehensive performance testing
kgen performance-test comprehensive-kpis \
                     --enterprise-workload \
                     --validate-all-kpis \
                     --test-duration 1800s
```

### Workflow Validation Commands
```bash
# Reproducibility validation
kgen performance-test reproducibility \
  --iterations 1000 --concurrency 50 \
  --deterministic-mode strict

# Provenance coverage validation
kgen performance-test provenance-coverage \
  --workflow complex-enterprise \
  --track-all-stages --sparql-analysis

# Cache performance validation
kgen performance-test cache-efficiency \
  --workload-pattern realistic \
  --measure-hit-rates --duration 300s
```

## Test Infrastructure Requirements

### Prerequisites
- KGEN system with all components installed
- OpenTelemetry tracing configured
- Cryptographic attestation keys available
- Performance monitoring infrastructure
- Load testing capabilities

### Test Data
- Complex RDF knowledge graphs
- Enterprise template sets
- Multi-component system definitions
- Realistic workload patterns
- Baseline performance metrics

### Monitoring
- Component health checks
- Performance metrics collection
- Distributed tracing spans
- KPI compliance dashboards
- Alert systems for threshold violations

## Integration Points

### Component Boundaries
```
RDF Parser → Template Engine → Validator → Attestation Service → Provenance Tracker
     ↓            ↓              ↓              ↓                ↓
  JSON-LD    Rendered AST   Validated AST   Signed Artifact  Provenance Graph
```

### Performance Checkpoints
- **Parse Time**: RDF → JSON-LD conversion
- **Render Time**: Template processing and rendering
- **Validation Time**: Schema and semantic validation
- **Attestation Time**: Cryptographic signing
- **Provenance Time**: Lineage recording and storage

### KPI Measurement Points
- **Reproducibility**: Output hash comparison across runs
- **Provenance**: Graph completeness and SPARQL validation
- **Cache**: Hit rate metrics across access patterns
- **Response Time**: Latency distribution measurement
- **Drift**: Signal-to-noise ratio in detection algorithms

## Expected Outcomes

### Functional Validation
- ✅ All workflow scenarios pass end-to-end
- ✅ Component integration operates seamlessly
- ✅ Failure recovery maintains data integrity
- ✅ Security boundaries are properly enforced
- ✅ Attestations provide cryptographic proof

### Performance Validation
- ✅ All charter KPIs met under realistic load
- ✅ System scales gracefully with increased demand
- ✅ Performance remains stable over extended periods
- ✅ Resource utilization stays within bounds
- ✅ Optimization provides measurable improvements

### Production Readiness
- ✅ Enterprise compliance requirements satisfied
- ✅ Security and audit requirements fulfilled
- ✅ Disaster recovery procedures validated
- ✅ Monitoring and alerting systems operational
- ✅ Documentation and runbooks complete

## Continuous Integration

These workflow tests are designed for integration into CI/CD pipelines:

```yaml
# Example GitHub Actions integration
- name: KGEN Workflow Validation
  run: |
    # End-to-end workflow tests
    cucumber features/workflows/end-to-end-generation.feature
    
    # Integration workflow tests
    cucumber features/workflows/integration-workflows.feature
    
    # Performance workflow tests (subset)
    cucumber features/workflows/performance-workflows.feature \
      --tags "not @long-running"
```

## Contributing

When adding new workflow scenarios:

1. **Focus on end-to-end validation** - Test complete workflows, not individual components
2. **Validate charter KPIs** - Ensure all critical metrics are measured
3. **Use realistic data** - Test with enterprise-scale knowledge graphs
4. **Include failure scenarios** - Test error handling and recovery
5. **Measure performance** - Validate against all performance thresholds
6. **Document expectations** - Clearly specify expected outcomes

## Troubleshooting

### Common Issues
- **Timeout failures**: Adjust performance thresholds for test environment
- **Attestation errors**: Verify cryptographic key configuration
- **KPI violations**: Check system resources and configuration
- **Integration failures**: Validate component health and connectivity

### Debugging
- Enable detailed tracing with `--trace-all-components`
- Use `--verbose` mode for detailed output
- Check component health endpoints
- Review performance metrics dashboards
- Analyze failure logs for root cause