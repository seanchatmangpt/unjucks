const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { trace, metrics, context, SpanStatusCode, SpanKind } = require('@opentelemetry/api');

class DistributedTracer {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'unjucks-service';
    this.serviceVersion = options.serviceVersion || '1.0.0';
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.jaegerEndpoint = options.jaegerEndpoint || 'http://localhost:14268/api/traces';
    
    this.sdk = null;
    this.tracer = null;
    this.meter = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    // Configure resource
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: this.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: this.serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.environment,
    });

    // Configure Jaeger exporter
    const jaegerExporter = new JaegerExporter({
      endpoint: this.jaegerEndpoint,
    });

    // Configure Prometheus exporter
    const prometheusExporter = new PrometheusExporter({
      port: 9090,
      endpoint: '/metrics',
    });

    // Initialize SDK
    this.sdk = new NodeSDK({
      resource,
      traceExporter: jaegerExporter,
      metricReader: new PeriodicExportingMetricReader({
        exporter: prometheusExporter,
        exportIntervalMillis: 1000,
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': {
            requestHook: (span, request) => {
              span.setAttributes({
                'http.request.body.size': request.headers['content-length'] || 0,
                'user.id': request.headers['x-user-id'] || 'anonymous',
                'correlation.id': request.headers['x-correlation-id'] || 'no-correlation-id'
              });
            },
            responseHook: (span, response) => {
              span.setAttributes({
                'http.response.body.size': response.headers['content-length'] || 0
              });
            }
          },
          '@opentelemetry/instrumentation-express': {
            enabled: true
          },
          '@opentelemetry/instrumentation-fs': {
            enabled: true
          }
        })
      ]
    });

    // Start the SDK
    await this.sdk.start();

    // Get tracer and meter instances
    this.tracer = trace.getTracer(this.serviceName, this.serviceVersion);
    this.meter = metrics.getMeter(this.serviceName, this.serviceVersion);

    // Create custom metrics
    this.setupCustomMetrics();

    this.initialized = true;
    console.log(`Distributed tracing initialized for ${this.serviceName}`);
  }

  setupCustomMetrics() {
    // Counter for total requests
    this.requestCounter = this.meter.createCounter('http_requests_total', {
      description: 'Total number of HTTP requests',
    });

    // Histogram for request duration
    this.requestDuration = this.meter.createHistogram('http_request_duration_seconds', {
      description: 'HTTP request duration in seconds',
      boundaries: [0.1, 0.5, 1, 2, 5, 10, 30],
    });

    // Gauge for active connections
    this.activeConnections = this.meter.createUpDownCounter('http_active_connections', {
      description: 'Number of active HTTP connections',
    });

    // Counter for errors
    this.errorCounter = this.meter.createCounter('application_errors_total', {
      description: 'Total number of application errors',
    });

    // Counter for business events
    this.businessEventCounter = this.meter.createCounter('business_events_total', {
      description: 'Total number of business events',
    });

    // Histogram for operation duration
    this.operationDuration = this.meter.createHistogram('operation_duration_seconds', {
      description: 'Operation duration in seconds',
      boundaries: [0.01, 0.1, 0.5, 1, 2, 5, 10],
    });
  }

  // Create a new span
  startSpan(name, options = {}) {
    const span = this.tracer.startSpan(name, {
      kind: options.kind || SpanKind.INTERNAL,
      attributes: options.attributes || {}
    });

    // Add correlation ID if available
    const correlationId = options.correlationId || context.active()?.getValue('correlationId');
    if (correlationId) {
      span.setAttributes({ 'correlation.id': correlationId });
    }

    return span;
  }

  // Execute function within a span
  async withSpan(name, fn, options = {}) {
    const span = this.startSpan(name, options);
    const startTime = this.getDeterministicTimestamp();

    try {
      const result = await context.with(trace.setSpan(context.active(), span), fn);
      
      span.setStatus({ code: SpanStatusCode.OK });
      
      // Record operation duration
      const duration = (this.getDeterministicTimestamp() - startTime) / 1000;
      this.operationDuration.record(duration, {
        operation: name,
        status: 'success'
      });

      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ 
        code: SpanStatusCode.ERROR, 
        message: error.message 
      });

      // Record error metric
      this.errorCounter.add(1, {
        operation: name,
        error_type: error.constructor.name
      });

      // Record operation duration for failed operations
      const duration = (this.getDeterministicTimestamp() - startTime) / 1000;
      this.operationDuration.record(duration, {
        operation: name,
        status: 'error'
      });

      throw error;
    } finally {
      span.end();
    }
  }

  // Add custom attributes to current span
  addSpanAttributes(attributes) {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  }

  // Record a business event
  recordBusinessEvent(eventType, attributes = {}) {
    this.businessEventCounter.add(1, {
      event_type: eventType,
      ...attributes
    });

    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent('business_event', {
        event_type: eventType,
        ...attributes
      });
    }
  }

  // Express middleware for automatic tracing
  middleware() {
    return (req, res, next) => {
      const startTime = this.getDeterministicTimestamp();
      
      // Increment active connections
      this.activeConnections.add(1);

      // Create span for the request
      const span = this.startSpan(`${req.method} ${req.route?.path || req.path}`, {
        kind: SpanKind.SERVER,
        attributes: {
          'http.method': req.method,
          'http.url': req.url,
          'http.scheme': req.protocol,
          'http.host': req.get('host'),
          'http.user_agent': req.get('user-agent'),
          'user.id': req.headers['x-user-id'] || 'anonymous',
          'correlation.id': req.headers['x-correlation-id'] || 'no-correlation-id'
        }
      });

      // Store span in request for later use
      req.span = span;

      res.on('finish', () => {
        const duration = (this.getDeterministicTimestamp() - startTime) / 1000;
        
        // Update span attributes
        span.setAttributes({
          'http.status_code': res.statusCode,
          'http.response.size': res.get('content-length') || 0
        });

        // Set span status based on HTTP status
        if (res.statusCode >= 400) {
          span.setStatus({ 
            code: SpanStatusCode.ERROR, 
            message: `HTTP ${res.statusCode}` 
          });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        // Record metrics
        this.requestCounter.add(1, {
          method: req.method,
          status_code: res.statusCode.toString(),
          route: req.route?.path || 'unknown'
        });

        this.requestDuration.record(duration, {
          method: req.method,
          status_code: res.statusCode.toString(),
          route: req.route?.path || 'unknown'
        });

        // Decrement active connections
        this.activeConnections.add(-1);

        // End span
        span.end();
      });

      // Continue with request in span context
      context.with(trace.setSpan(context.active(), span), next);
    };
  }

  // Create a child tracer with additional context
  createChildTracer(name, version) {
    return trace.getTracer(name, version);
  }

  // Get current trace ID
  getCurrentTraceId() {
    const span = trace.getActiveSpan();
    return span?.spanContext().traceId || 'no-trace-id';
  }

  // Get current span ID
  getCurrentSpanId() {
    const span = trace.getActiveSpan();
    return span?.spanContext().spanId || 'no-span-id';
  }

  // Graceful shutdown
  async shutdown() {
    if (this.sdk) {
      await this.sdk.shutdown();
      console.log('Distributed tracing shutdown complete');
    }
  }
}

module.exports = DistributedTracer;