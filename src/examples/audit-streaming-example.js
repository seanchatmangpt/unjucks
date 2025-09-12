/**
 * Comprehensive Audit Streaming Example
 * 
 * Demonstrates complete usage of the KGEN Audit Streaming system including:
 * - Initialization with all features enabled
 * - JSONL streaming with immutable trails
 * - OpenTelemetry span correlation
 * - Governance event processing
 * - Performance tracking
 * - Health monitoring
 * - Event querying and replay
 */

import { join } from 'path';
import { EnhancedIntegratedObservability } from '../observability/audit-integration.js';
import { withAuditSpan, addAuditMetadata } from '../observability/audit-integration.js';

async function demonstrateAuditStreaming() {
  console.log('🚀 Starting Comprehensive Audit Streaming Demo');
  console.log('==================================================');

  // Initialize enhanced observability with full audit streaming
  const observability = new EnhancedIntegratedObservability({
    serviceName: 'audit-streaming-demo',
    serviceVersion: '1.0.0',
    auditDir: join(process.cwd(), '.demo-audit'),
    enableAuditStreaming: true,
    enableWebhooks: false, // Disabled for demo
    enableRealTimeEvents: true,
    enableGovernanceIntegration: true,
    immutableTrails: true,
    openTelemetryCorrelation: true
  });

  try {
    // Step 1: Initialize the system
    console.log('\n1️⃣ Initializing Audit Streaming System');
    console.log('----------------------------------------');
    
    await observability.initialize();
    console.log('✅ Audit streaming system initialized');
    
    // Show initial health status
    const initialHealth = await observability.getComprehensiveHealth();
    console.log(`📊 Initial health status: ${initialHealth.status}`);
    console.log(`   - Audit streaming: ${initialHealth.auditStreaming.healthy ? '✅' : '❌'}`);
    console.log(`   - Health score: ${initialHealth.auditStreaming.summary.overallScore}`);

    // Step 2: Demonstrate different types of audit events
    console.log('\n2️⃣ Creating Various Audit Events');
    console.log('----------------------------------');

    // Regular operation event
    const operationEvent = await observability.emitAuditEvent('user.login', {
      'user.id': 'user123',
      'user.email': 'demo@example.com',
      'auth.method': 'password',
      'client.ip': '192.168.1.100'
    });
    console.log('✅ User login event:', operationEvent.operation);

    // Governance event (data access)
    const govEvent = await observability.emitAuditEvent('data.access', {
      'data.personal': true,
      'data.type': 'user_profile',
      'resource.id': 'profile-456',
      'access.reason': 'profile_update'
    });
    console.log('✅ Governance event:', govEvent.operation);

    // Performance event
    const perfEvent = await observability.emitAuditEvent('performance.operation', {
      'operation.duration': 250,
      'memory.used': 1024000,
      'cpu.utilization': 0.65,
      'database.queries': 3
    });
    console.log('✅ Performance event:', perfEvent.operation);

    // Security event (high risk)
    const secEvent = await observability.emitAuditEvent('security.suspicious_activity', {
      'security.violation': true,
      'threat.level': 'high',
      'attack.type': 'brute_force',
      'blocked': true
    }, 'error');
    console.log('✅ Security event:', secEvent.operation);

    // Step 3: Demonstrate audit-aware span operations
    console.log('\n3️⃣ Audit-Aware Span Operations');
    console.log('-------------------------------');

    await withAuditSpan('complex.business.operation', {
      'operation.type': 'financial_transaction',
      'transaction.amount': 1000.00,
      governance: {
        riskLevel: 'medium',
        dataType: 'financial',
        complianceFlags: ['sox', 'pci']
      },
      performance: {
        duration: 500,
        memory: { heap: 2048000 },
        cpu: { user: 150, system: 50 }
      }
    }, async (span, correlationId) => {
      console.log(`✅ Started audit span with correlation ID: ${correlationId}`);
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Add additional audit metadata during operation
      addAuditMetadata({
        'step': 'validation_complete',
        'validation.rules': 12,
        'validation.passed': true
      }, {
        governance: {
          riskLevel: 'low', // Risk reduced after validation
        }
      });
      
      console.log('✅ Added additional audit metadata during operation');
      
      return 'operation_completed';
    });

    // Step 4: Query audit events
    console.log('\n4️⃣ Querying Audit Events');
    console.log('-------------------------');

    // Query recent events
    const recentEvents = await observability.queryAuditEvents({
      limit: 10,
      sortBy: 'timestamp',
      sortOrder: 'desc'
    });
    console.log(`✅ Retrieved ${recentEvents.length} recent events`);

    // Query governance events
    const governanceEvents = await observability.queryAuditEvents({
      attributes: { 'data.personal': true },
      limit: 5
    });
    console.log(`✅ Retrieved ${governanceEvents.length} governance events`);

    // Query by operation pattern
    const userEvents = await observability.queryAuditEvents({
      operation: 'user.login',
      limit: 5
    });
    console.log(`✅ Retrieved ${userEvents.length} user login events`);

    // Step 5: Performance and health monitoring
    console.log('\n5️⃣ Performance and Health Monitoring');
    console.log('------------------------------------');

    // Get comprehensive metrics
    const metrics = observability.getObservabilityMetrics();
    console.log('📊 Audit Streaming Metrics:');
    console.log(`   - Events processed: ${metrics.integration.auditEventsGenerated}`);
    console.log(`   - Governance events: ${metrics.integration.governanceEventsProcessed}`);
    console.log(`   - Immutable events written: ${metrics.integration.immutableEventsWritten}`);
    console.log(`   - Correlations mapped: ${metrics.integration.correlationIdsMapped}`);
    
    // Check streaming health
    if (metrics.audit.streamingHealth) {
      console.log(`   - Streaming health: ${metrics.audit.streamingHealth.status}`);
      console.log(`   - Error rate: ${metrics.audit.streamingHealth.errorRate}`);
    }

    // Check correlation efficiency
    if (metrics.audit.correlationEfficiency) {
      console.log(`   - Correlation efficiency: ${metrics.audit.correlationEfficiency.status}`);
      console.log(`   - Correlation rate: ${metrics.audit.correlationEfficiency.correlationRate}`);
    }

    // Run health check
    const finalHealth = await observability.getComprehensiveHealth();
    console.log('\n🏥 Final Health Check:');
    console.log(`   - Overall status: ${finalHealth.status}`);
    console.log(`   - Audit streaming: ${finalHealth.auditStreaming.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`   - Health score: ${finalHealth.auditStreaming.summary.overallScore}`);
    
    if (finalHealth.auditStreaming.alerts.length > 0) {
      console.log('⚠️  Active alerts:');
      finalHealth.auditStreaming.alerts.forEach(alert => {
        console.log(`   - ${alert.component}: ${alert.message} (${alert.severity})`);
      });
    } else {
      console.log('✅ No alerts - system operating normally');
    }

    // Step 6: Demonstrate governance features
    console.log('\n6️⃣ Governance Features');
    console.log('----------------------');

    // Get governance events
    const govEvents = observability.auditCoordinator.getGovernanceEvents({
      riskLevel: 'high',
      limit: 10
    });
    console.log(`✅ Retrieved ${govEvents.length} high-risk governance events`);

    // Export governance report
    const govReport = await observability.auditCoordinator.exportGovernanceReport();
    console.log('📋 Governance Report:');
    console.log(`   - Total events processed: ${govReport.totalEvents}`);
    console.log('   - Risk distribution:', JSON.stringify(govReport.riskDistribution, null, 2));
    console.log('   - Compliance status:', JSON.stringify(govReport.complianceStatus, null, 2));

    // Step 7: Demonstrate audit URI resolution
    console.log('\n7️⃣ Audit URI Resolution');
    console.log('------------------------');

    if (recentEvents.length > 0) {
      const sampleEvent = recentEvents[0];
      const auditURI = `audit://events/${sampleEvent.traceId}/${sampleEvent.spanId}`;
      
      console.log(`✅ Sample audit URI: ${auditURI}`);
      
      // Resolve the audit URI
      const resolvedEvent = await observability.auditCoordinator.resolveAuditURI(auditURI);
      if (resolvedEvent && resolvedEvent.length > 0) {
        console.log(`✅ Successfully resolved audit URI to event: ${resolvedEvent[0].operation}`);
      }
    }

    // Step 8: Performance benchmarking
    console.log('\n8️⃣ Performance Benchmarking');
    console.log('---------------------------');

    const benchmarkStart = this.getDeterministicTimestamp();
    const benchmarkEvents = 100;
    
    console.log(`🏃 Running benchmark: ${benchmarkEvents} events...`);
    
    // Create many events concurrently
    const benchmarkPromises = Array.from({ length: benchmarkEvents }, (_, i) => 
      observability.emitAuditEvent('benchmark.operation', {
        'benchmark.run': true,
        'event.number': i,
        'batch.id': 'benchmark-001'
      })
    );

    await Promise.allSettled(benchmarkPromises);
    
    const benchmarkTime = this.getDeterministicTimestamp() - benchmarkStart;
    const throughput = benchmarkEvents / (benchmarkTime / 1000);
    
    console.log(`✅ Benchmark complete:`);
    console.log(`   - ${benchmarkEvents} events in ${benchmarkTime}ms`);
    console.log(`   - Throughput: ${throughput.toFixed(2)} events/second`);

    // Final metrics after benchmark
    const finalMetrics = observability.getObservabilityMetrics();
    console.log(`   - Total events processed: ${finalMetrics.integration.auditEventsGenerated}`);
    console.log(`   - System still healthy: ${finalHealth.status === 'healthy' ? '✅' : '❌'}`);

    console.log('\n🎉 Audit Streaming Demo Complete!');
    console.log('==================================');
    console.log('✅ All audit streaming features demonstrated:');
    console.log('   - ✅ JSONL streaming with immutable trails');
    console.log('   - ✅ OpenTelemetry span injection and correlation');
    console.log('   - ✅ Governance event processing and classification');
    console.log('   - ✅ Performance tracking and metrics collection');
    console.log('   - ✅ Health monitoring and alerting');
    console.log('   - ✅ Audit URI resolution');
    console.log('   - ✅ Event querying and filtering');
    console.log('   - ✅ Comprehensive reporting');
    console.log('   - ✅ High-throughput processing');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    // Clean shutdown
    console.log('\n🛑 Shutting down audit streaming system...');
    await observability.shutdown();
    console.log('✅ Shutdown complete');
  }
}

// Export for use in other examples
export { demonstrateAuditStreaming };

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateAuditStreaming()
    .then(() => {
      console.log('\n✅ Demo completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Demo failed:', error);
      process.exit(1);
    });
}