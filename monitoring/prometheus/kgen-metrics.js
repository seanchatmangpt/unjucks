/**
 * KGEN Prometheus Metrics Collection System
 * Comprehensive metrics for monitoring KGEN operations
 */

class KGenMetricsCollector {
  constructor() {
    // Note: In production, this would use prom-client library
    // For now, creating a simplified metrics collector
    this.metrics = new Map();
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    
    this.initializeMetrics();
    this.startSystemMetricsCollection();
  }
  
  initializeMetrics() {
    // Initialize counter metrics
    this.counters.set('kgen_generations_total', {
      value: 0,
      labels: ['template', 'status', 'engine'],
      help: 'Total number of artifacts generated'
    });
    
    this.counters.set('kgen_errors_total', {
      value: 0,
      labels: ['error_type', 'severity', 'component'],
      help: 'Total errors by type and severity'
    });
    
    this.counters.set('kgen_security_events_total', {
      value: 0,
      labels: ['event_type', 'severity', 'source_ip'],
      help: 'Security events detected'
    });
    
    // Initialize gauge metrics
    this.gauges.set('kgen_cache_hit_rate', {
      value: 0,
      labels: ['cache_type'],
      help: 'Cache hit rate percentage'
    });
    
    this.gauges.set('kgen_memory_usage_bytes', {
      value: 0,
      labels: ['process', 'type'],
      help: 'Memory usage in bytes'
    });
    
    // Initialize histogram metrics
    this.histograms.set('kgen_generation_duration_seconds', {
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      values: new Map(),
      labels: ['template', 'operation', 'success'],
      help: 'Time taken for artifact generation'
    });
  }
  
  /**
   * Record artifact generation metrics
   */
  recordGeneration(template, duration, success, metadata = {}) {
    // Increment generation counter
    const counter = this.counters.get('kgen_generations_total');
    counter.value++;
    
    // Record duration in histogram
    const histogram = this.histograms.get('kgen_generation_duration_seconds');
    const bucketKey = `${template}_${metadata.operation || 'generate'}_${success}`;
    
    if (!histogram.values.has(bucketKey)) {
      histogram.values.set(bucketKey, []);
    }
    histogram.values.get(bucketKey).push(duration / 1000);
    
    console.log(`[METRICS] Generation recorded: ${template}, duration: ${duration}ms, success: ${success}`);
  }
  
  /**
   * Record cache metrics
   */
  recordCacheMetrics(hitRate, type = 'template') {
    const gauge = this.gauges.get('kgen_cache_hit_rate');
    gauge.value = hitRate;
    
    console.log(`[METRICS] Cache hit rate: ${hitRate}% for type: ${type}`);
  }
  
  /**
   * Record error metrics
   */
  recordError(errorType, severity, component, metadata = {}) {
    const counter = this.counters.get('kgen_errors_total');
    counter.value++;
    
    console.log(`[METRICS] Error recorded: ${errorType}, severity: ${severity}, component: ${component}`);
    
    // Emit for alerting system
    if (severity === 'critical' || severity === 'high') {
      console.log(`[ALERT] High severity error: ${errorType} in ${component}`);
    }
  }
  
  /**
   * Record security event
   */
  recordSecurityEvent(eventType, severity, sourceIp = 'unknown', metadata = {}) {
    const counter = this.counters.get('kgen_security_events_total');
    counter.value++;
    
    console.log(`[SECURITY] Event: ${eventType}, severity: ${severity}, source: ${sourceIp}`);
    
    // Immediate alerting on high-severity events
    if (severity === 'critical' || severity === 'high') {
      console.log(`[SECURITY ALERT] Critical security event: ${eventType} from ${sourceIp}`);
    }
  }
  
  /**
   * Update memory metrics
   */
  updateMemoryMetrics() {
    const usage = process.memoryUsage();
    const gauge = this.gauges.get('kgen_memory_usage_bytes');
    
    // Store different memory types
    gauge.rss = usage.rss;
    gauge.heapUsed = usage.heapUsed;
    gauge.heapTotal = usage.heapTotal;
    gauge.external = usage.external;
  }
  
  /**
   * Get metrics in Prometheus format (simplified)
   */
  getMetrics() {
    let output = '# KGEN Metrics\n';
    
    // Export counters
    this.counters.forEach((metric, name) => {
      output += `# HELP ${name} ${metric.help}\n`;
      output += `# TYPE ${name} counter\n`;
      output += `${name} ${metric.value}\n`;
    });
    
    // Export gauges
    this.gauges.forEach((metric, name) => {
      output += `# HELP ${name} ${metric.help}\n`;
      output += `# TYPE ${name} gauge\n`;
      output += `${name} ${metric.value}\n`;
    });
    
    return output;
  }
  
  /**
   * Start collecting system metrics
   */
  startSystemMetricsCollection() {
    setInterval(() => {
      this.updateMemoryMetrics();
    }, 5000); // Collect every 5 seconds
  }
  
  /**
   * Get current metrics summary
   */
  getSummary() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([key, value]) => [
          key,
          {
            ...value,
            values: Object.fromEntries(value.values)
          }
        ])
      )
    };
  }
  
  /**
   * Reset all metrics (for testing)
   */
  reset() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.initializeMetrics();
  }
}

export default KGenMetricsCollector;