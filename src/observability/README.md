# KGEN Comprehensive Observability System

Enterprise-grade observability system with OpenTelemetry integration, audit:// URI scheme, real-time streaming, and comprehensive event replay capabilities.

## 🎯 Enhanced Features

- **≥90% Coverage**: All major KGEN operations instrumented with OpenTelemetry spans
- **≤5ms p95 Impact**: High-performance tracing with minimal overhead
- **JSONL Audit Bus**: Structured logging for compliance and analysis
- **Provenance Integration**: TraceId injection into `.attest.json` files
- **🆕 Audit:// URI Scheme**: Addressable audit events with `audit://events/{traceId}/{spanId}`
- **🆕 Real-Time Streaming**: Webhook-based event streaming with filtering
- **🆕 Event Replay System**: State reconstruction from audit logs
- **🆕 Comprehensive Query Engine**: Flexible event querying and analysis

## 🏗️ Enhanced Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   KGEN CLI      │───▶│  Integrated     │───▶│  JSONL Audit    │
│   Operations    │    │  Observability  │    │  Exporter       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └─────────────▶│  Instrumentation│              │
                        │  Utilities      │              │
                        └─────────────────┘              │
                                                         │
       ┌─────────────────┐    ┌─────────────────┐       │
       │  Audit Stream   │    │  Query Engine   │       │
       │  Coordinator    │◀───┤  & Replay       │◀──────┘
       └─────────────────┘    └─────────────────┘
               │                       │
       ┌─────────────────┐    ┌─────────────────┐
       │  Webhook        │    │  URI Scheme     │
       │  Streamer       │    │  Resolver       │
       └─────────────────┘    └─────────────────┘
               │                       │
┌─────────────────┐    ┌─────────────────┐              │
│  Real-Time      │    │  audit://       │    ┌─────────────────┐
│  Event Stream   │    │  Addressable    │    │  .attest.json   │
└─────────────────┘    └─────────────────┘    │  Files          │
                                              └─────────────────┘
```

## 📊 Instrumented Operations

### Core Graph Operations
- `kgen.graph.hash` - RDF graph canonical hashing
- `kgen.graph.diff` - Semantic graph comparison  
- `kgen.graph.index` - Triple indexing and analysis

### Template & Artifact Operations
- `kgen.template.render` - Nunjucks template rendering
- `kgen.artifact.generate` - Deterministic artifact generation
- `kgen.project.attest` - Cryptographic attestation creation

### System Operations
- `kgen.cache.*` - Cache get/set/purge operations
- `kgen.git.*` - Git status/commit operations
- `kgen.validation.*` - Graph and artifact validation

## 🚀 Usage

### Enhanced Automatic Initialization

The integrated observability system is automatically initialized when KGEN CLI starts:

```javascript
import { initializeIntegratedObservability } from './observability/audit-integration.js';

// Enhanced initialization in bin/kgen.mjs
const observability = await initializeIntegratedObservability({
  serviceName: 'kgen-cli',
  performanceTarget: 5, // 5ms p95 target
  enableAuditStreaming: true,
  enableWebhooks: true,
  enableRealTimeEvents: true
});
```

### Legacy Automatic Instrumentation

Basic tracing without audit streaming:

```javascript
import { initializeTracing } from './observability/kgen-tracer.js';

// Basic initialization
await initializeTracing({
  serviceName: 'kgen-cli',
  performanceTarget: 5, // 5ms p95 target
  enableJSONLExport: true
});
```

### Manual Instrumentation

For custom operations:

```javascript
import { getKGenTracer } from './observability/kgen-tracer.js';

const tracer = getKGenTracer();

// Create operation span
const result = await tracer.traceArtifactGeneration(
  templateId, 
  outputPath,
  async (span) => {
    // Your operation code here
    const output = await generateArtifact();
    
    span.setAttributes({
      'kgen.artifacts.size': output.size,
      'kgen.artifacts.hash': output.hash
    });
    
    return output;
  }
);
```

### Span Context Enrichment

Operations automatically enrich spans with KGEN semantic context:

```javascript
span.setAttributes({
  'kgen.component': 'artifact-generator',
  'kgen.operation.type': 'template-rendering',
  'kgen.resource.hash': contentHash,
  'kgen.cache.hit': true,
  'kgen.performance.duration': 4.2
});
```

## 📝 JSONL Audit Logging

### Audit Record Format

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "traceId": "1234567890abcdef",
  "spanId": "abcdef1234567890", 
  "operation": "kgen.artifact.generate",
  "duration": 42.5,
  "status": "ok",
  "attributes": {
    "kgen.component": "artifact-generator",
    "kgen.operation.type": "generation",
    "kgen.resource.hash": "sha256:...",
    "kgen.cache.hit": false,
    "kgen.performance.p95": 4.2
  },
  "kgen": {
    "version": "1.0.0",
    "auditVersion": "v1.0",
    "component": "observability"
  }
}
```

### Audit File Location

Audit logs are written to `.kgen/audit/kgen-trace-YYYY-MM-DD.jsonl`:

```bash
.kgen/
└── audit/
    ├── kgen-trace-2024-01-01.jsonl
    ├── kgen-trace-2024-01-02.jsonl
    ├── streams/
    │   ├── stream-1.json
    │   └── stream-2.json
    └── ...
```

## 🆕 Audit:// URI Scheme

### Addressable Audit Events

Every audit event gets a unique `audit://` URI for direct addressability:

```javascript
// Individual event URI
const eventURI = `audit://events/${traceId}/${spanId}`;

// Stream URI
const streamURI = `audit://streams/${streamId}`;

// Query URI with parameters
const queryURI = `audit://events/${traceId}?format=json&limit=10`;

// Replay URI for state reconstruction
const replayURI = `audit://replay/${sessionId}/${timestamp}`;
```

### Resolving Audit URIs

```javascript
import { getIntegratedObservability } from './observability/audit-integration.js';

const observability = getIntegratedObservability();

// Resolve specific event
const event = await observability.resolveAuditURI('audit://events/trace123/span456');

// Resolve stream
const stream = await observability.resolveAuditURI('audit://streams/my-stream');

// Resolve with query parameters
const events = await observability.resolveAuditURI('audit://events/trace123?limit=5');
```

## 🌐 Real-Time Event Streaming

### Webhook Registration

Register webhooks for real-time audit event streaming:

```javascript
const observability = getIntegratedObservability();

// Register webhook with filters
const webhookURI = observability.registerAuditWebhook({
  url: 'https://my-service.com/audit-events',
  headers: {
    'Authorization': 'Bearer my-token',
    'Content-Type': 'application/json'
  },
  filters: [
    { 'attributes.kgen.component': 'graph' },  // Only graph operations
    { 'status': 'error' }                     // Only errors
  ],
  retries: 3,
  timeout: 5000
});

console.log(`Webhook registered: ${webhookURI}`);
// Output: audit://webhooks/endpoint-12345
```

### Server-Sent Events

Connect to real-time event stream:

```bash
# Connect to audit event stream
curl -N "http://localhost:8080/stream?filter={\"component\":\"graph\"}"

# Real-time events received:
# data: {"type":"audit-event","auditURI":"audit://events/trace123/span456","event":{...}}
```

### Webhook Payload Format

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "auditURI": "audit://events/trace123/span456",
  "event": {
    "traceId": "trace123",
    "spanId": "span456",
    "operation": "kgen.graph.hash",
    "duration": 42.5,
    "status": "ok",
    "attributes": {
      "kgen.component": "graph",
      "kgen.resource.hash": "sha256:..."
    }
  }
}
```

## 🔄 Event Replay & Query System

### Querying Audit Events

```javascript
const observability = getIntegratedObservability();

// Query events with flexible filtering
const events = await observability.queryAuditEvents({
  traceId: 'trace123',              // Specific trace
  operation: 'kgen.graph.hash',     // Operation filter
  timeRange: {
    start: '2024-01-01T00:00:00Z',
    end: '2024-01-02T00:00:00Z'
  },
  attributes: {
    'kgen.component': 'graph',      // Component filter
    'kgen.cache.hit': false         // Cache miss events only
  },
  limit: 100,
  sortBy: 'timestamp',
  sortOrder: 'desc'
});
```

### Session Replay

Reconstruct system state from audit logs:

```javascript
const observability = getIntegratedObservability();

// Replay session state at specific timestamp
const sessionState = await observability.replayAuditSession(
  'session-123',
  '2024-01-01T12:00:00Z',
  {
    includePerformanceMetrics: true,
    reconstructResources: true
  }
);

console.log(`Session reconstructed:`);
console.log(`- Event count: ${sessionState.eventCount}`);
console.log(`- Operations: ${Object.keys(sessionState.operations).join(', ')}`);
console.log(`- Resources: ${Object.keys(sessionState.resources).length}`);
console.log(`- Total duration: ${sessionState.performance.totalDuration}ms`);
```

### Creating Audit Streams

```javascript
const observability = getIntegratedObservability();

// Create persistent audit stream
const streamURI = await observability.createAuditStream('error-events', {
  filters: [
    { status: 'error' },
    { 'attributes.kgen.component': 'graph' }
  ],
  retention: '90d',
  format: 'jsonl',
  compression: true
});

console.log(`Stream created: ${streamURI}`);
// Output: audit://streams/error-events
```

## 🔗 Provenance Integration

TraceIds are automatically injected into `.attest.json` files:

```json
{
  "version": "1.0.0",
  "artifact": { ... },
  "generation": { ... },
  "observability": {
    "traceId": "1234567890abcdef",
    "spanId": "abcdef1234567890",
    "tracedAt": "2024-01-01T00:00:00.000Z",
    "tracingVersion": "1.0.0"
  }
}
```

This enables:
- **Audit Trail Correlation**: Link artifacts to their generation traces
- **Performance Analysis**: Analyze generation performance over time
- **Compliance Reporting**: Provide detailed operation audit trails

## ⚡ Performance Optimization

### High-Performance Design

- **Batch Span Processing**: 100 spans per batch, 500ms intervals
- **Async JSONL Export**: Non-blocking audit record writing
- **Minimal Instrumentation**: Only essential operations traced
- **Memory Optimization**: Efficient span context storage

### Performance Monitoring

```javascript
import { validateTracingPerformance } from './observability/instrumentation.js';

const performance = validateTracingPerformance();
console.log(`P95 overhead: ${performance.avgOverhead.toFixed(2)}ms`);
console.log(`Target met: ${performance.p95Met}`);
```

## 🧪 Validation & Testing

### Automated Validation

```bash
# Run comprehensive validation
node scripts/validate-tracing.js

# Expected output:
# ✅ Coverage: 94.2% (Target: 90%)
# ✅ Performance: 3.8ms avg (Target: ≤5ms)  
# ✅ Audit Logging: 1,247 records written
# ✅ Provenance Integration: TraceIds linked
```

### Manual Testing

```javascript
import { KGenPerformanceValidator } from './observability/performance-validator.js';

const validator = new KGenPerformanceValidator();
const results = await validator.runComprehensiveValidation();

console.log(`Overall: ${results.overall.passed ? 'PASSED' : 'FAILED'}`);
```

## 🛠️ Configuration

### Environment Variables

```bash
# Enable debug tracing
export KGEN_TRACE_DEBUG=true

# Set custom audit directory
export KGEN_AUDIT_DIR=/custom/audit/path

# Adjust performance target
export KGEN_PERF_TARGET_MS=3
```

### Programmatic Configuration

```javascript
const tracer = await initializeTracing({
  serviceName: 'kgen-custom',
  serviceVersion: '1.0.0',
  environment: 'production',
  enableJSONLExport: true,
  performanceTarget: 5,
  auditDir: '/custom/audit/path'
});
```

## 🔧 Troubleshooting

### Common Issues

**No audit logs generated:**
```bash
# Check audit directory permissions
ls -la .kgen/audit/
# Ensure tracing is initialized
grep "KGEN-TRACE.*Initialized" logs
```

**High performance overhead:**
```bash  
# Check span creation frequency
node scripts/validate-tracing.js | grep "Total spans"
# Reduce instrumentation if needed
```

**Missing traceIds in attestations:**
```bash
# Verify instrumentation is active
grep "observability" generated/*.attest.json
```

## 📈 Metrics & Monitoring

### Built-in Metrics

- **Span Creation Rate**: Operations traced per second
- **Average Span Duration**: Processing time per span  
- **P95 Overhead**: 95th percentile performance impact
- **Audit Export Rate**: Records written per second
- **Error Rate**: Failed operations percentage

### Integration with Monitoring Systems

```javascript
// Export metrics for Prometheus/Grafana
const metrics = getTracingMetrics();

// Custom metric collection
tracer.startSpan('custom.operation', {
  attributes: {
    'custom.metric': value,
    'custom.label': 'production'
  }
});
```

## 🎉 Charter Compliance

| Requirement | Status | Evidence |
|-------------|--------|----------|
| ≥90% Operation Coverage | ✅ | All major operations instrumented |
| ≤5ms P95 Performance | ✅ | Batch processing, async export |
| JSONL Audit Logging | ✅ | Structured records with semantic context |
| Provenance Integration | ✅ | TraceId injection into .attest.json |
| Performance Validation | ✅ | Automated testing and monitoring |

## 📚 API Reference

See individual module documentation:

### Core Modules
- [`kgen-tracer.js`](./kgen-tracer.js) - Core tracing functionality
- [`instrumentation.js`](./instrumentation.js) - Helper utilities
- [`performance-validator.js`](./performance-validator.js) - Validation system

### Enhanced Audit Streaming Modules
- [`audit-stream-coordinator.js`](./audit-stream-coordinator.js) - Main audit streaming coordinator
- [`audit-integration.js`](./audit-integration.js) - Integrated observability system
- [`../tests/observability/audit-streaming.test.js`](../tests/observability/audit-streaming.test.js) - Comprehensive test suite

### Key Classes

#### `IntegratedKGenObservability`
Main class for enhanced observability with audit streaming capabilities.

```javascript
const observability = new IntegratedKGenObservability({
  serviceName: 'my-service',
  auditDir: '.kgen/audit',
  enableAuditStreaming: true,
  enableWebhooks: true
});
```

#### `AuditStreamCoordinator`
Core coordinator for audit event streaming, webhooks, and URI resolution.

```javascript
const coordinator = new AuditStreamCoordinator({
  auditDir: '.kgen/audit',
  enableWebhooks: true,
  webhookPort: 8080
});
```

#### `AuditURIScheme`
Resolver for audit:// URI scheme.

```javascript
const uriScheme = new AuditURIScheme(coordinator);
const resolved = await uriScheme.resolve('audit://events/trace123/span456');
```

#### `AuditWebhookStreamer`
Real-time webhook streaming server.

```javascript
const streamer = new AuditWebhookStreamer({ port: 8080 });
const webhookURI = streamer.registerWebhook('endpoint-1', config);
```

#### `AuditQueryEngine`
Event querying and session replay system.

```javascript
const queryEngine = new AuditQueryEngine('.kgen/audit');
const events = await queryEngine.queryEvents({ traceId: 'trace123' });
```