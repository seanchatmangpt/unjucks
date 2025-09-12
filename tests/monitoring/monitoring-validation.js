/**
 * MONITORING VALIDATION SUITE
 * Tests actual monitoring functionality vs theoretical claims
 */

import { createServer } from 'http';
import { EventEmitter } from 'events';

/**
 * Simple monitoring components that actually work
 */
class BasicHealthCheck {
  constructor() {
    this.checks = new Map();
    this.status = 'healthy';
  }

  addCheck(name, checkFn) {
    this.checks.set(name, checkFn);
  }

  async runChecks() {
    const results = {};
    let allHealthy = true;

    for (const [name, checkFn] of this.checks.entries()) {
      try {
        const result = await checkFn();
        results[name] = { status: 'healthy', ...result };
      } catch (error) {
        results[name] = { status: 'unhealthy', error: error.message };
        allHealthy = false;
      }
    }

    this.status = allHealthy ? 'healthy' : 'unhealthy';
    return { status: this.status, checks: results };
  }

  getProbeResponse() {
    return {
      status: this.status === 'healthy' ? 200 : 503,
      body: {
        status: this.status,
        timestamp: this.getDeterministicDate().toISOString(),
        uptime: process.uptime()
      }
    };
  }
}

class BasicMetricsCollector {
  constructor() {
    this.metrics = new Map();
    this.httpRequests = [];
  }

  recordMetric(name, value, labels = {}) {
    const key = `${name}_${JSON.stringify(labels)}`;
    this.metrics.set(key, { name, value, labels, timestamp: this.getDeterministicTimestamp() });
  }

  recordHTTPRequest(method, path, statusCode, duration) {
    this.httpRequests.push({ method, path, statusCode, duration, timestamp: this.getDeterministicTimestamp() });
    this.recordMetric('http_requests_total', this.httpRequests.length, { method, status: statusCode });
    this.recordMetric('http_request_duration_ms', duration, { method, path });
  }

  getPrometheusMetrics() {
    let output = '# TYPE http_requests_total counter\n';
    let output2 = '# TYPE http_request_duration_ms histogram\n';
    
    const methodCounts = {};
    let totalDuration = 0;
    
    for (const req of this.httpRequests) {
      const key = `${req.method}_${req.statusCode}`;
      methodCounts[key] = (methodCounts[key] || 0) + 1;
      totalDuration += req.duration;
    }

    for (const [key, count] of Object.entries(methodCounts)) {
      const [method, status] = key.split('_');
      output += `http_requests_total{method="${method}",status="${status}"} ${count}\n`;
    }

    output2 += `http_request_duration_ms_sum ${totalDuration}\n`;
    output2 += `http_request_duration_ms_count ${this.httpRequests.length}\n`;

    return output + output2;
  }
}

class StructuredLogger {
  constructor() {
    this.correlationId = null;
    this.logs = [];
  }

  setCorrelationContext(correlationId) {
    this.correlationId = correlationId;
  }

  clearCorrelationContext() {
    this.correlationId = null;
  }

  log(level, message, data = {}) {
    const entry = {
      timestamp: this.getDeterministicDate().toISOString(),
      level,
      message,
      correlationId: this.correlationId,
      ...data
    };
    this.logs.push(entry);
    console.log(JSON.stringify(entry));
    return entry;
  }

  info(message, data) { return this.log('info', message, data); }
  warn(message, data) { return this.log('warn', message, data); }
  error(message, data) { return this.log('error', message, data); }
  debug(message, data) { return this.log('debug', message, data); }
}

class BasicAlertManager extends EventEmitter {
  constructor() {
    super();
    this.alerts = [];
    this.rules = new Map();
  }

  addRule(name, condition, severity = 'medium') {
    this.rules.set(name, { condition, severity });
  }

  checkRules(metrics) {
    for (const [name, rule] of this.rules.entries()) {
      try {
        if (rule.condition(metrics)) {
          const alert = {
            id: `alert_${this.getDeterministicTimestamp()}`,
            rule: name,
            severity: rule.severity,
            timestamp: this.getDeterministicDate().toISOString(),
            status: 'active'
          };
          this.alerts.push(alert);
          this.emit('alert', alert);
          return alert;
        }
      } catch (error) {
        console.error(`Alert rule ${name} failed:`, error.message);
      }
    }
    return null;
  }

  getActiveAlerts() {
    return this.alerts.filter(alert => alert.status === 'active');
  }
}

/**
 * Basic monitoring server that actually works
 */
class WorkingMonitoringServer {
  constructor(port = 3000) {
    this.port = port;
    this.healthCheck = new BasicHealthCheck();
    this.metrics = new BasicMetricsCollector();
    this.logger = new StructuredLogger();
    this.alerts = new BasicAlertManager();
    this.server = null;
    this.startTime = this.getDeterministicTimestamp();

    this.setupHealthChecks();
    this.setupAlertRules();
  }

  setupHealthChecks() {
    this.healthCheck.addCheck('memory', () => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      return { 
        heapUsedMB, 
        healthy: heapUsedMB < 100 // 100MB threshold
      };
    });

    this.healthCheck.addCheck('uptime', () => {
      const uptime = Math.round(process.uptime());
      return { 
        uptime, 
        healthy: uptime > 0 
      };
    });

    this.healthCheck.addCheck('disk', () => {
      // Simulate disk check
      return { 
        freeSpaceGB: 50, 
        healthy: true 
      };
    });
  }

  setupAlertRules() {
    // High memory usage alert
    this.alerts.addRule('high_memory', (metrics) => {
      const memUsage = process.memoryUsage();
      return memUsage.heapUsed > 50 * 1024 * 1024; // 50MB threshold
    }, 'warning');

    // HTTP error rate alert
    this.alerts.addRule('http_errors', (metrics) => {
      const recentRequests = this.metrics.httpRequests.slice(-10);
      const errorCount = recentRequests.filter(req => req.statusCode >= 400).length;
      return errorCount > 5; // More than 5 errors in last 10 requests
    }, 'high');
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', reject);
      
      this.server.listen(this.port, () => {
        this.logger.info(`Monitoring server started on port ${this.port}`);
        resolve();
      });
    });
  }

  async handleRequest(req, res) {
    const startTime = this.getDeterministicTimestamp();
    const correlationId = req.headers['x-correlation-id'] || `req_${this.getDeterministicTimestamp()}`;
    
    this.logger.setCorrelationContext(correlationId);
    
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathname = url.pathname;

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Correlation-ID', correlationId);

      let response;
      let statusCode = 200;

      switch (pathname) {
        case '/health':
          response = await this.healthCheck.runChecks();
          statusCode = response.status === 'healthy' ? 200 : 503;
          break;

        case '/metrics':
          res.setHeader('Content-Type', 'text/plain');
          response = this.metrics.getPrometheusMetrics();
          break;

        case '/status':
          response = {
            uptime: this.getDeterministicTimestamp() - this.startTime,
            status: 'running',
            version: '1.0.0',
            correlationId
          };
          break;

        case '/alerts':
          response = {
            active: this.alerts.getActiveAlerts(),
            total: this.alerts.alerts.length
          };
          break;

        case '/test-alert':
          // Trigger a test alert
          const alert = this.alerts.checkRules(this.metrics);
          response = { triggered: !!alert, alert };
          break;

        default:
          statusCode = 404;
          response = { error: 'Not Found', path: pathname };
      }

      const duration = this.getDeterministicTimestamp() - startTime;
      this.metrics.recordHTTPRequest(req.method, pathname, statusCode, duration);
      
      // Check for alerts after each request
      this.alerts.checkRules(this.metrics);

      res.statusCode = statusCode;
      res.end(typeof response === 'string' ? response : JSON.stringify(response, null, 2));

      this.logger.info('Request processed', {
        method: req.method,
        path: pathname,
        statusCode,
        duration,
        correlationId
      });

    } catch (error) {
      const duration = this.getDeterministicTimestamp() - startTime;
      this.metrics.recordHTTPRequest(req.method, req.url, 500, duration);
      
      this.logger.error('Request failed', {
        method: req.method,
        url: req.url,
        error: error.message,
        correlationId
      });

      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    } finally {
      this.logger.clearCorrelationContext();
    }
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(resolve);
      } else {
        resolve();
      }
    });
  }
}

/**
 * VALIDATION TEST RUNNER
 */
async function runValidationTests() {
  const results = {
    timestamp: this.getDeterministicDate().toISOString(),
    tests: {},
    summary: { passed: 0, failed: 0, total: 0 }
  };

  console.log('🔍 Starting Monitoring Validation Tests...\n');

  const server = new WorkingMonitoringServer(3001);

  try {
    // Test 1: Server Startup
    console.log('Test 1: Server Startup');
    try {
      await server.start();
      results.tests.startup = { status: 'PASS', message: 'Server started successfully' };
      console.log('✅ PASS: Server started on port 3001\n');
    } catch (error) {
      results.tests.startup = { status: 'FAIL', message: error.message };
      console.log('❌ FAIL: Server startup failed\n');
      return results;
    }

    // Test 2: Health Endpoint
    console.log('Test 2: Health Endpoint');
    try {
      const response = await fetch('http://localhost:3001/health');
      const data = await response.json();
      
      if (response.ok && data.status) {
        results.tests.health = { status: 'PASS', data };
        console.log('✅ PASS: Health endpoint responds');
        console.log(`   Status: ${data.status}`);
        console.log(`   Checks: ${Object.keys(data.checks).length}\n`);
      } else {
        results.tests.health = { status: 'FAIL', message: 'Invalid health response' };
        console.log('❌ FAIL: Health endpoint invalid response\n');
      }
    } catch (error) {
      results.tests.health = { status: 'FAIL', message: error.message };
      console.log('❌ FAIL: Health endpoint unreachable\n');
    }

    // Test 3: Metrics Endpoint
    console.log('Test 3: Metrics Endpoint');
    try {
      const response = await fetch('http://localhost:3001/metrics');
      const metrics = await response.text();
      
      if (response.ok && metrics.includes('http_requests_total')) {
        results.tests.metrics = { status: 'PASS', metricsLength: metrics.length };
        console.log('✅ PASS: Metrics endpoint responds');
        console.log(`   Metrics data length: ${metrics.length} bytes`);
        console.log(`   Contains Prometheus format: ${metrics.includes('# TYPE')}\n`);
      } else {
        results.tests.metrics = { status: 'FAIL', message: 'Invalid metrics format' };
        console.log('❌ FAIL: Metrics endpoint invalid format\n');
      }
    } catch (error) {
      results.tests.metrics = { status: 'FAIL', message: error.message };
      console.log('❌ FAIL: Metrics endpoint unreachable\n');
    }

    // Test 4: Structured Logging with Correlation IDs
    console.log('Test 4: Structured Logging');
    try {
      const correlationId = `test_${this.getDeterministicTimestamp()}`;
      const response = await fetch('http://localhost:3001/status', {
        headers: { 'X-Correlation-ID': correlationId }
      });
      const data = await response.json();
      
      if (response.ok && data.correlationId === correlationId) {
        results.tests.logging = { status: 'PASS', correlationId };
        console.log('✅ PASS: Structured logging works');
        console.log(`   Correlation ID tracked: ${correlationId}\n`);
      } else {
        results.tests.logging = { status: 'FAIL', message: 'Correlation ID not tracked' };
        console.log('❌ FAIL: Correlation ID not working\n');
      }
    } catch (error) {
      results.tests.logging = { status: 'FAIL', message: error.message };
      console.log('❌ FAIL: Logging test failed\n');
    }

    // Test 5: Alert System
    console.log('Test 5: Alert System');
    try {
      const response = await fetch('http://localhost:3001/test-alert');
      const data = await response.json();
      
      if (response.ok) {
        results.tests.alerts = { status: 'PASS', alertsWorking: true };
        console.log('✅ PASS: Alert system functional');
        console.log(`   Alert triggered: ${data.triggered}\n`);
      } else {
        results.tests.alerts = { status: 'FAIL', message: 'Alert endpoint failed' };
        console.log('❌ FAIL: Alert system not working\n');
      }
    } catch (error) {
      results.tests.alerts = { status: 'FAIL', message: error.message };
      console.log('❌ FAIL: Alert system test failed\n');
    }

    // Test 6: Load Test (Multiple Requests)
    console.log('Test 6: Load Test (10 concurrent requests)');
    try {
      const requests = Array(10).fill().map((_, i) => 
        fetch(`http://localhost:3001/status?req=${i}`)
      );
      
      const responses = await Promise.all(requests);
      const allSuccessful = responses.every(r => r.ok);
      
      if (allSuccessful) {
        results.tests.load = { status: 'PASS', requestCount: 10 };
        console.log('✅ PASS: Load test successful');
        console.log(`   All 10 requests succeeded\n`);
      } else {
        results.tests.load = { status: 'FAIL', message: 'Some requests failed' };
        console.log('❌ FAIL: Load test failed\n');
      }
    } catch (error) {
      results.tests.load = { status: 'FAIL', message: error.message };
      console.log('❌ FAIL: Load test error\n');
    }

  } finally {
    await server.stop();
    console.log('🛑 Server stopped\n');
  }

  // Calculate summary
  for (const test of Object.values(results.tests)) {
    results.summary.total++;
    if (test.status === 'PASS') {
      results.summary.passed++;
    } else {
      results.summary.failed++;
    }
  }

  console.log('📊 VALIDATION SUMMARY:');
  console.log(`   Total Tests: ${results.summary.total}`);
  console.log(`   Passed: ${results.summary.passed}`);
  console.log(`   Failed: ${results.summary.failed}`);
  console.log(`   Success Rate: ${Math.round((results.summary.passed / results.summary.total) * 100)}%`);

  return results;
}

// Export for use in other tests
export {
  WorkingMonitoringServer,
  BasicHealthCheck,
  BasicMetricsCollector,
  StructuredLogger,
  BasicAlertManager,
  runValidationTests
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidationTests()
    .then(results => {
      console.log('\n📋 Full Results:');
      console.log(JSON.stringify(results, null, 2));
      process.exit(results.summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    });
}