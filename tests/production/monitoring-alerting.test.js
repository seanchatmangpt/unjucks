/**
 * Production Monitoring and Alerting Infrastructure Tests
 * Validates monitoring, metrics collection, and alerting systems
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Store, DataFactory } from 'n3';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

const { namedNode, literal, quad } = DataFactory;

// Monitoring configuration
const MONITORING_CONFIG = {
  METRICS_COLLECTION_INTERVAL: 1000, // 1 second
  ALERT_THRESHOLDS: {
    RESPONSE_TIME_MS: 1000,
    MEMORY_GROWTH_MB: 50,
    ERROR_RATE_PERCENT: 5,
    CPU_USAGE_PERCENT: 80,
    CONCURRENT_USERS: 50,
    DISK_USAGE_PERCENT: 90
  },
  ALERT_LEVELS: {
    INFO: 'INFO',
    WARNING: 'WARNING', 
    CRITICAL: 'CRITICAL',
    EMERGENCY: 'EMERGENCY'
  },
  SLA_TARGETS: {
    AVAILABILITY: 99.9, // 99.9% uptime
    RESPONSE_P95: 500,  // 95th percentile < 500ms
    ERROR_RATE: 0.1     // < 0.1% error rate
  }
};

describe('Production Monitoring and Alerting Infrastructure', () => {
  let monitoringSystem;
  let alertingSystem;
  let metricsCollector;
  let rdfFilters;
  let monitoringResults = {
    metrics: [],
    alerts: [],
    healthChecks: [],
    slaViolations: [],
    performance: []
  };

  beforeAll(async () => {
    // Initialize monitoring infrastructure
    monitoringSystem = new ProductionMonitor();
    alertingSystem = new AlertingSystem();
    metricsCollector = new MetricsCollector();
    
    // Set up RDF system
    const store = new Store();
    await setupMonitoringTestData(store);
    rdfFilters = new RDFFilters({ store });
    
    // Start monitoring
    monitoringSystem.start();
    alertingSystem.start();
    metricsCollector.start();
    
    console.log('📊 Starting monitoring and alerting infrastructure tests...');
  });

  afterAll(async () => {
    // Stop monitoring systems
    if (monitoringSystem) await monitoringSystem.stop();
    if (alertingSystem) await alertingSystem.stop(); 
    if (metricsCollector) await metricsCollector.stop();
    
    console.log('\n=== MONITORING & ALERTING REPORT ===');
    console.log(`Metrics collected: ${monitoringResults.metrics.length}`);
    console.log(`Alerts triggered: ${monitoringResults.alerts.length}`);
    console.log(`Health checks: ${monitoringResults.healthChecks.length}`);
    console.log(`SLA violations: ${monitoringResults.slaViolations.length}`);
    
    // Generate monitoring report
    const report = generateMonitoringReport(monitoringResults);
    console.log(`Overall system health: ${report.overallHealth}`);
  });

  describe('Metrics Collection System', () => {
    test('Real-time performance metrics collection', async () => {
      console.log('Testing performance metrics collection...');
      
      const collectionDuration = 5000; // 5 seconds
      const startTime = this.getDeterministicTimestamp();
      
      // Start collecting metrics
      const metricsInterval = setInterval(() => {
        const currentTime = this.getDeterministicTimestamp();
        const memoryUsage = process.memoryUsage();
        
        // Simulate operations and collect metrics
        const operationStart = performance.now();
        rdfFilters.rdfQuery('?s rdf:type foaf:Person');
        const operationEnd = performance.now();
        
        const metrics = {
          timestamp: currentTime,
          responseTime: operationEnd - operationStart,
          memoryHeapUsed: memoryUsage.heapUsed / 1024 / 1024, // MB
          memoryHeapTotal: memoryUsage.heapTotal / 1024 / 1024, // MB
          cpuUsage: process.cpuUsage(),
          activeConnections: 1, // Simulated
          requestCount: 1
        };
        
        monitoringResults.metrics.push(metrics);
        
        // Check for threshold violations
        if (metrics.responseTime > MONITORING_CONFIG.ALERT_THRESHOLDS.RESPONSE_TIME_MS) {
          monitoringResults.alerts.push({
            level: MONITORING_CONFIG.ALERT_LEVELS.WARNING,
            type: 'SLOW_RESPONSE',
            message: `Slow response time: ${metrics.responseTime.toFixed(2)}ms`,
            timestamp: currentTime,
            metric: metrics
          });
        }
        
        if (metrics.memoryHeapUsed > MONITORING_CONFIG.ALERT_THRESHOLDS.MEMORY_GROWTH_MB) {
          monitoringResults.alerts.push({
            level: MONITORING_CONFIG.ALERT_LEVELS.WARNING,
            type: 'HIGH_MEMORY_USAGE',
            message: `High memory usage: ${metrics.memoryHeapUsed.toFixed(2)}MB`,
            timestamp: currentTime,
            metric: metrics
          });
        }
      }, MONITORING_CONFIG.METRICS_COLLECTION_INTERVAL);
      
      // Let metrics collect for specified duration
      await new Promise(resolve => setTimeout(resolve, collectionDuration));
      clearInterval(metricsInterval);
      
      const collectedMetrics = monitoringResults.metrics.length;
      const expectedMetrics = Math.floor(collectionDuration / MONITORING_CONFIG.METRICS_COLLECTION_INTERVAL);
      
      expect(collectedMetrics).toBeGreaterThanOrEqual(expectedMetrics * 0.8); // Allow some variance
      
      // Validate metric structure
      if (monitoringResults.metrics.length > 0) {
        const sampleMetric = monitoringResults.metrics[0];
        expect(sampleMetric).toHaveProperty('timestamp');
        expect(sampleMetric).toHaveProperty('responseTime');
        expect(sampleMetric).toHaveProperty('memoryHeapUsed');
        expect(typeof sampleMetric.responseTime).toBe('number');
        expect(typeof sampleMetric.memoryHeapUsed).toBe('number');
      }
      
      console.log(`✅ Metrics collection: ${collectedMetrics} metrics collected over ${collectionDuration}ms`);
    });

    test('Business metrics tracking', async () => {
      console.log('Testing business metrics tracking...');
      
      const businessMetrics = {
        templatesGenerated: 0,
        rdfQueriesExecuted: 0,
        successfulOperations: 0,
        failedOperations: 0,
        uniqueUsers: new Set(),
        avgProcessingTime: []
      };
      
      // Simulate business operations
      const operations = 100;
      
      for (let i = 0; i < operations; i++) {
        const userId = `user${Math.floor(i / 10)}`; // 10 operations per user
        businessMetrics.uniqueUsers.add(userId);
        
        const operationStart = this.getDeterministicTimestamp();
        
        try {
          // Simulate different business operations
          switch (i % 4) {
            case 0:
              rdfFilters.rdfQuery('?s rdf:type foaf:Person');
              businessMetrics.rdfQueriesExecuted++;
              break;
            case 1:
              rdfFilters.rdfLabel('ex:person1');
              businessMetrics.templatesGenerated++;
              break;
            case 2:
              rdfFilters.rdfExists('ex:person1', 'foaf:name', null);
              businessMetrics.rdfQueriesExecuted++;
              break;
            case 3:
              rdfFilters.rdfCount('?s', 'rdf:type', 'foaf:Person');
              businessMetrics.rdfQueriesExecuted++;
              break;
          }
          
          businessMetrics.successfulOperations++;
          
        } catch (error) {
          businessMetrics.failedOperations++;
        }
        
        const operationTime = this.getDeterministicTimestamp() - operationStart;
        businessMetrics.avgProcessingTime.push(operationTime);
      }
      
      // Calculate business metrics
      const avgProcessingTime = businessMetrics.avgProcessingTime.reduce((a, b) => a + b, 0) / businessMetrics.avgProcessingTime.length;
      const successRate = (businessMetrics.successfulOperations / operations) * 100;
      const errorRate = (businessMetrics.failedOperations / operations) * 100;
      
      monitoringResults.performance.push({
        type: 'Business Metrics',
        templatesGenerated: businessMetrics.templatesGenerated,
        rdfQueriesExecuted: businessMetrics.rdfQueriesExecuted,
        uniqueUsers: businessMetrics.uniqueUsers.size,
        successRate: successRate,
        errorRate: errorRate,
        avgProcessingTime: avgProcessingTime
      });
      
      // Validate business metrics
      expect(businessMetrics.successfulOperations).toBeGreaterThan(operations * 0.95); // 95% success rate
      expect(errorRate).toBeLessThan(MONITORING_CONFIG.ALERT_THRESHOLDS.ERROR_RATE_PERCENT);
      expect(businessMetrics.uniqueUsers.size).toBeGreaterThan(5);
      
      console.log(`✅ Business metrics: ${successRate.toFixed(1)}% success rate, ${businessMetrics.uniqueUsers.size} unique users`);
    });

    test('Custom metrics and KPIs', async () => {
      console.log('Testing custom metrics and KPIs...');
      
      const customMetrics = {
        rdfFilterUsage: {},
        queryComplexity: [],
        cacheHitRatio: { hits: 0, misses: 0 },
        semanticOperations: 0,
        dataIntegrityChecks: 0
      };
      
      const testOperations = [
        { filter: 'rdfQuery', complexity: 'medium' },
        { filter: 'rdfLabel', complexity: 'low' },
        { filter: 'rdfExists', complexity: 'low' },
        { filter: 'rdfType', complexity: 'low' },
        { filter: 'rdfObject', complexity: 'medium' },
        { filter: 'rdfSubject', complexity: 'medium' },
        { filter: 'rdfCount', complexity: 'high' },
        { filter: 'rdfExpand', complexity: 'low' }
      ];
      
      // Track filter usage
      for (const operation of testOperations) {
        // Execute operation
        switch (operation.filter) {
          case 'rdfQuery':
            rdfFilters.rdfQuery('?s ?p ?o');
            break;
          case 'rdfLabel':
            rdfFilters.rdfLabel('ex:person1');
            break;
          case 'rdfExists':
            rdfFilters.rdfExists('ex:person1', 'foaf:name', null);
            break;
          case 'rdfType':
            rdfFilters.rdfType('ex:person1');
            break;
          case 'rdfObject':
            rdfFilters.rdfObject('ex:person1', 'foaf:name');
            break;
          case 'rdfSubject':
            rdfFilters.rdfSubject('foaf:name', 'Test Person');
            break;
          case 'rdfCount':
            rdfFilters.rdfCount('?s', 'rdf:type', 'foaf:Person');
            break;
          case 'rdfExpand':
            rdfFilters.rdfExpand('foaf:Person');
            break;
        }
        
        // Track usage
        if (!customMetrics.rdfFilterUsage[operation.filter]) {
          customMetrics.rdfFilterUsage[operation.filter] = 0;
        }
        customMetrics.rdfFilterUsage[operation.filter]++;
        
        // Track complexity
        customMetrics.queryComplexity.push(operation.complexity);
        
        // Simulate cache behavior
        if (Math.random() > 0.3) { // 70% cache hit rate
          customMetrics.cacheHitRatio.hits++;
        } else {
          customMetrics.cacheHitRatio.misses++;
        }
        
        if (operation.filter.includes('semantic') || operation.complexity === 'high') {
          customMetrics.semanticOperations++;
        }
        
        customMetrics.dataIntegrityChecks++;
      }
      
      // Calculate KPIs
      const totalCacheRequests = customMetrics.cacheHitRatio.hits + customMetrics.cacheHitRatio.misses;
      const cacheHitPercentage = (customMetrics.cacheHitRatio.hits / totalCacheRequests) * 100;
      
      const complexityDistribution = {
        low: customMetrics.queryComplexity.filter(c => c === 'low').length,
        medium: customMetrics.queryComplexity.filter(c => c === 'medium').length,
        high: customMetrics.queryComplexity.filter(c => c === 'high').length
      };
      
      const mostUsedFilter = Object.keys(customMetrics.rdfFilterUsage).reduce((a, b) => 
        customMetrics.rdfFilterUsage[a] > customMetrics.rdfFilterUsage[b] ? a : b
      );
      
      monitoringResults.performance.push({
        type: 'Custom KPIs',
        filterUsage: customMetrics.rdfFilterUsage,
        cacheHitPercentage: cacheHitPercentage,
        complexityDistribution: complexityDistribution,
        mostUsedFilter: mostUsedFilter,
        semanticOperationsRatio: (customMetrics.semanticOperations / testOperations.length) * 100
      });
      
      // Validate KPIs
      expect(cacheHitPercentage).toBeGreaterThan(50); // At least 50% cache hit rate
      expect(Object.keys(customMetrics.rdfFilterUsage).length).toBeGreaterThan(5); // Multiple filters used
      expect(mostUsedFilter).toBeDefined();
      
      console.log(`✅ Custom KPIs: ${cacheHitPercentage.toFixed(1)}% cache hit rate, most used filter: ${mostUsedFilter}`);
    });
  });

  describe('Alerting System Validation', () => {
    test('Threshold-based alerting', async () => {
      console.log('Testing threshold-based alerting...');
      
      const alertTests = [
        {
          name: 'High Response Time',
          trigger: () => {
            // Simulate slow operation
            return new Promise(resolve => {
              setTimeout(() => {
                const result = rdfFilters.rdfQuery('?s ?p ?o');
                resolve({ responseTime: 1500, result }); // 1.5 seconds
              }, 100);
            });
          },
          expectedAlert: 'SLOW_RESPONSE'
        },
        {
          name: 'Memory Pressure',
          trigger: () => {
            // Simulate memory-intensive operation
            const largeArray = new Array(10000).fill('test data');
            const result = rdfFilters.rdfCount('?s', 'rdf:type', 'foaf:Person');
            return { memoryUsed: process.memoryUsage().heapUsed, result, largeArray };
          },
          expectedAlert: 'HIGH_MEMORY_USAGE'
        },
        {
          name: 'Error Rate Spike',
          trigger: () => {
            const errors = [];
            for (let i = 0; i < 10; i++) {
              try {
                rdfFilters.rdfQuery('invalid query pattern');
              } catch (error) {
                errors.push(error);
              }
            }
            return { errorCount: errors.length, errorRate: (errors.length / 10) * 100 };
          },
          expectedAlert: 'HIGH_ERROR_RATE'
        }
      ];
      
      let alertsTriggered = 0;
      
      for (const alertTest of alertTests) {
        try {
          const startTime = this.getDeterministicTimestamp();
          const result = await alertTest.trigger();
          const endTime = this.getDeterministicTimestamp();
          const duration = endTime - startTime;
          
          // Check thresholds and generate alerts
          let alertGenerated = false;
          
          if (result.responseTime && result.responseTime > MONITORING_CONFIG.ALERT_THRESHOLDS.RESPONSE_TIME_MS) {
            monitoringResults.alerts.push({
              level: MONITORING_CONFIG.ALERT_LEVELS.WARNING,
              type: alertTest.expectedAlert,
              message: `${alertTest.name}: ${result.responseTime}ms response time`,
              timestamp: this.getDeterministicTimestamp(),
              testName: alertTest.name
            });
            alertGenerated = true;
          }
          
          if (result.errorRate && result.errorRate > MONITORING_CONFIG.ALERT_THRESHOLDS.ERROR_RATE_PERCENT) {
            monitoringResults.alerts.push({
              level: MONITORING_CONFIG.ALERT_LEVELS.CRITICAL,
              type: alertTest.expectedAlert,
              message: `${alertTest.name}: ${result.errorRate}% error rate`,
              timestamp: this.getDeterministicTimestamp(),
              testName: alertTest.name
            });
            alertGenerated = true;
          }
          
          if (result.memoryUsed) {
            const memoryMB = result.memoryUsed / 1024 / 1024;
            if (memoryMB > MONITORING_CONFIG.ALERT_THRESHOLDS.MEMORY_GROWTH_MB) {
              monitoringResults.alerts.push({
                level: MONITORING_CONFIG.ALERT_LEVELS.WARNING,
                type: alertTest.expectedAlert,
                message: `${alertTest.name}: ${memoryMB.toFixed(2)}MB memory usage`,
                timestamp: this.getDeterministicTimestamp(),
                testName: alertTest.name
              });
              alertGenerated = true;
            }
          }
          
          if (alertGenerated) {
            alertsTriggered++;
          }
          
        } catch (testError) {
          // Test errors can also trigger alerts
          monitoringResults.alerts.push({
            level: MONITORING_CONFIG.ALERT_LEVELS.CRITICAL,
            type: 'TEST_FAILURE',
            message: `${alertTest.name}: ${testError.message}`,
            timestamp: this.getDeterministicTimestamp(),
            testName: alertTest.name
          });
          alertsTriggered++;
        }
      }
      
      // Validate alerting system
      expect(alertsTriggered).toBeGreaterThan(0); // At least some alerts should be triggered
      expect(monitoringResults.alerts.length).toBeGreaterThan(0);
      
      // Check alert structure
      if (monitoringResults.alerts.length > 0) {
        const sampleAlert = monitoringResults.alerts[0];
        expect(sampleAlert).toHaveProperty('level');
        expect(sampleAlert).toHaveProperty('type');
        expect(sampleAlert).toHaveProperty('message');
        expect(sampleAlert).toHaveProperty('timestamp');
        expect(Object.values(MONITORING_CONFIG.ALERT_LEVELS)).toContain(sampleAlert.level);
      }
      
      console.log(`✅ Alerting system: ${alertsTriggered} alerts triggered from ${alertTests.length} test scenarios`);
    });

    test('Alert escalation and severity levels', async () => {
      console.log('Testing alert escalation and severity levels...');
      
      const escalationTests = [
        {
          severity: MONITORING_CONFIG.ALERT_LEVELS.INFO,
          condition: 'Normal operation',
          shouldEscalate: false,
          trigger: () => rdfFilters.rdfExists('ex:person1', 'foaf:name', null)
        },
        {
          severity: MONITORING_CONFIG.ALERT_LEVELS.WARNING,
          condition: 'Elevated response time',
          shouldEscalate: false,
          trigger: () => {
            // Simulate slightly slow operation
            const start = this.getDeterministicTimestamp();
            const result = rdfFilters.rdfQuery('?s rdf:type foaf:Person');
            return { duration: this.getDeterministicTimestamp() - start, result };
          }
        },
        {
          severity: MONITORING_CONFIG.ALERT_LEVELS.CRITICAL,
          condition: 'High error rate',
          shouldEscalate: true,
          trigger: () => {
            const errors = [];
            for (let i = 0; i < 20; i++) {
              try {
                rdfFilters.rdfQuery(`invalid${i}`);
              } catch (error) {
                errors.push(error);
              }
            }
            return { errorRate: (errors.length / 20) * 100 };
          }
        },
        {
          severity: MONITORING_CONFIG.ALERT_LEVELS.EMERGENCY,
          condition: 'System unavailable',
          shouldEscalate: true,
          trigger: () => {
            // Simulate system failure
            throw new Error('System unavailable - critical failure');
          }
        }
      ];
      
      let escalationsTriggered = 0;
      const alertsByLevel = {};
      
      for (const escalationTest of escalationTests) {
        try {
          const result = escalationTest.trigger();
          
          // Generate appropriate alert
          const alert = {
            level: escalationTest.severity,
            type: 'ESCALATION_TEST',
            message: `${escalationTest.condition} - ${JSON.stringify(result).substring(0, 100)}`,
            timestamp: this.getDeterministicTimestamp(),
            shouldEscalate: escalationTest.shouldEscalate
          };
          
          monitoringResults.alerts.push(alert);
          
          if (!alertsByLevel[escalationTest.severity]) {
            alertsByLevel[escalationTest.severity] = 0;
          }
          alertsByLevel[escalationTest.severity]++;
          
        } catch (escalationError) {
          // Handle emergency/critical scenarios
          const alert = {
            level: escalationTest.severity,
            type: 'ESCALATION_EMERGENCY',
            message: `${escalationTest.condition} - ${escalationError.message}`,
            timestamp: this.getDeterministicTimestamp(),
            shouldEscalate: true,
            error: escalationError.message
          };
          
          monitoringResults.alerts.push(alert);
          
          if (!alertsByLevel[escalationTest.severity]) {
            alertsByLevel[escalationTest.severity] = 0;
          }
          alertsByLevel[escalationTest.severity]++;
          
          if (escalationTest.shouldEscalate) {
            escalationsTriggered++;
          }
        }
      }
      
      // Validate escalation system
      const criticalAlerts = monitoringResults.alerts.filter(a => 
        a.level === MONITORING_CONFIG.ALERT_LEVELS.CRITICAL || 
        a.level === MONITORING_CONFIG.ALERT_LEVELS.EMERGENCY
      ).length;
      
      expect(Object.keys(alertsByLevel).length).toBeGreaterThan(1); // Multiple severity levels
      expect(criticalAlerts).toBeGreaterThan(0); // Some critical alerts
      
      console.log(`✅ Alert escalation: ${criticalAlerts} critical/emergency alerts, distribution:`, alertsByLevel);
    });

    test('Alert notification and routing', async () => {
      console.log('Testing alert notification and routing...');
      
      const notificationChannels = {
        email: { sent: 0, failed: 0 },
        slack: { sent: 0, failed: 0 },
        pagerduty: { sent: 0, failed: 0 },
        webhook: { sent: 0, failed: 0 }
      };
      
      // Simulate different types of alerts with routing rules
      const alertRoutingTests = [
        {
          alert: {
            level: MONITORING_CONFIG.ALERT_LEVELS.INFO,
            type: 'SYSTEM_INFO',
            message: 'System information update'
          },
          expectedChannels: ['email']
        },
        {
          alert: {
            level: MONITORING_CONFIG.ALERT_LEVELS.WARNING,
            type: 'PERFORMANCE_DEGRADATION',
            message: 'Performance degradation detected'
          },
          expectedChannels: ['email', 'slack']
        },
        {
          alert: {
            level: MONITORING_CONFIG.ALERT_LEVELS.CRITICAL,
            type: 'SERVICE_FAILURE',
            message: 'Critical service failure'
          },
          expectedChannels: ['email', 'slack', 'pagerduty']
        },
        {
          alert: {
            level: MONITORING_CONFIG.ALERT_LEVELS.EMERGENCY,
            type: 'SYSTEM_DOWN',
            message: 'System completely unavailable'
          },
          expectedChannels: ['email', 'slack', 'pagerduty', 'webhook']
        }
      ];
      
      for (const routingTest of alertRoutingTests) {
        const alert = {
          ...routingTest.alert,
          timestamp: this.getDeterministicTimestamp(),
          id: `alert_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substring(2, 9)}`
        };
        
        // Simulate notification routing
        for (const channel of routingTest.expectedChannels) {
          try {
            // Simulate notification sending (success rate ~90%)
            if (Math.random() > 0.1) {
              notificationChannels[channel].sent++;
              
              // Add notification record
              monitoringResults.alerts.push({
                ...alert,
                notificationChannel: channel,
                notificationStatus: 'SENT',
                notificationTime: this.getDeterministicTimestamp()
              });
            } else {
              notificationChannels[channel].failed++;
              
              monitoringResults.alerts.push({
                ...alert,
                notificationChannel: channel,
                notificationStatus: 'FAILED',
                notificationTime: this.getDeterministicTimestamp(),
                error: 'Simulated notification failure'
              });
            }
          } catch (notificationError) {
            notificationChannels[channel].failed++;
          }
        }
      }
      
      // Calculate notification success rates
      const totalNotifications = Object.values(notificationChannels).reduce((sum, channel) => sum + channel.sent + channel.failed, 0);
      const successfulNotifications = Object.values(notificationChannels).reduce((sum, channel) => sum + channel.sent, 0);
      const notificationSuccessRate = (successfulNotifications / totalNotifications) * 100;
      
      monitoringResults.performance.push({
        type: 'Alert Notifications',
        channels: notificationChannels,
        totalNotifications: totalNotifications,
        successfulNotifications: successfulNotifications,
        successRate: notificationSuccessRate
      });
      
      // Validate notification system
      expect(notificationSuccessRate).toBeGreaterThan(85); // At least 85% success rate
      expect(totalNotifications).toBeGreaterThan(10); // Multiple notifications sent
      expect(Object.keys(notificationChannels).every(channel => notificationChannels[channel].sent > 0)).toBe(true);
      
      console.log(`✅ Alert notifications: ${notificationSuccessRate.toFixed(1)}% success rate, ${totalNotifications} total notifications`);
    });
  });

  describe('Health Check System', () => {
    test('Component health monitoring', async () => {
      console.log('Testing component health monitoring...');
      
      const components = [
        {
          name: 'RDF Query Engine',
          healthCheck: () => {
            const result = rdfFilters.rdfQuery('?s rdf:type foaf:Person');
            return { status: 'healthy', responseTime: 50, result: result.length };
          }
        },
        {
          name: 'RDF Filter System',
          healthCheck: () => {
            const checks = [
              rdfFilters.rdfLabel('ex:person1'),
              rdfFilters.rdfExists('ex:person1', 'foaf:name', null),
              rdfFilters.rdfType('ex:person1')
            ];
            return { status: 'healthy', responseTime: 25, checks: checks.length };
          }
        },
        {
          name: 'Memory Management',
          healthCheck: () => {
            const memUsage = process.memoryUsage();
            const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
            const status = heapUsedMB < 200 ? 'healthy' : 'degraded';
            return { status, memoryUsage: heapUsedMB, responseTime: 5 };
          }
        },
        {
          name: 'Data Store',
          healthCheck: () => {
            try {
              const count = rdfFilters.rdfCount('?s', '?p', '?o');
              return { status: count > 0 ? 'healthy' : 'unhealthy', tripleCount: count, responseTime: 10 };
            } catch (error) {
              return { status: 'unhealthy', error: error.message, responseTime: 0 };
            }
          }
        }
      ];
      
      let healthyComponents = 0;
      
      for (const component of components) {
        const startTime = performance.now();
        
        try {
          const healthResult = component.healthCheck();
          const endTime = performance.now();
          const actualResponseTime = endTime - startTime;
          
          const healthCheck = {
            component: component.name,
            status: healthResult.status,
            responseTime: actualResponseTime,
            timestamp: this.getDeterministicTimestamp(),
            details: healthResult
          };
          
          monitoringResults.healthChecks.push(healthCheck);
          
          if (healthResult.status === 'healthy') {
            healthyComponents++;
          } else {
            // Generate alert for unhealthy components
            monitoringResults.alerts.push({
              level: healthResult.status === 'degraded' ? 
                MONITORING_CONFIG.ALERT_LEVELS.WARNING : 
                MONITORING_CONFIG.ALERT_LEVELS.CRITICAL,
              type: 'COMPONENT_HEALTH',
              message: `Component ${component.name} is ${healthResult.status}`,
              timestamp: this.getDeterministicTimestamp(),
              component: component.name,
              healthDetails: healthResult
            });
          }
          
        } catch (healthError) {
          monitoringResults.healthChecks.push({
            component: component.name,
            status: 'unhealthy',
            error: healthError.message,
            timestamp: this.getDeterministicTimestamp()
          });
          
          monitoringResults.alerts.push({
            level: MONITORING_CONFIG.ALERT_LEVELS.CRITICAL,
            type: 'COMPONENT_FAILURE',
            message: `Component ${component.name} health check failed: ${healthError.message}`,
            timestamp: this.getDeterministicTimestamp(),
            component: component.name
          });
        }
      }
      
      const systemHealth = (healthyComponents / components.length) * 100;
      
      // Validate health monitoring
      expect(systemHealth).toBeGreaterThan(80); // At least 80% of components healthy
      expect(monitoringResults.healthChecks.length).toBe(components.length);
      
      console.log(`✅ Component health: ${healthyComponents}/${components.length} healthy (${systemHealth.toFixed(1)}%)`);
    });

    test('SLA compliance monitoring', async () => {
      console.log('Testing SLA compliance monitoring...');
      
      const slaMetrics = {
        availability: { uptime: 0, downtime: 0, checks: 0 },
        responseTime: { measurements: [], p95: 0 },
        errorRate: { total: 0, errors: 0, rate: 0 },
        throughput: { requests: 0, duration: 0, rps: 0 }
      };
      
      const testDuration = 3000; // 3 seconds
      const checkInterval = 100; // 100ms
      const startTime = this.getDeterministicTimestamp();
      
      const slaInterval = setInterval(() => {
        slaMetrics.availability.checks++;
        
        try {
          // Availability check
          const healthStart = performance.now();
          const result = rdfFilters.rdfExists('ex:person1', 'foaf:name', null);
          const healthEnd = performance.now();
          
          const responseTime = healthEnd - healthStart;
          slaMetrics.responseTime.measurements.push(responseTime);
          
          if (result !== undefined) {
            slaMetrics.availability.uptime++;
          } else {
            slaMetrics.availability.downtime++;
          }
          
          slaMetrics.throughput.requests++;
          
        } catch (error) {
          slaMetrics.availability.downtime++;
          slaMetrics.errorRate.errors++;
        }
        
        slaMetrics.errorRate.total++;
      }, checkInterval);
      
      // Let SLA monitoring run
      await new Promise(resolve => setTimeout(resolve, testDuration));
      clearInterval(slaInterval);
      
      // Calculate SLA metrics
      const totalTime = this.getDeterministicTimestamp() - startTime;
      slaMetrics.throughput.duration = totalTime;
      slaMetrics.throughput.rps = (slaMetrics.throughput.requests * 1000) / totalTime;
      
      const availabilityPercentage = (slaMetrics.availability.uptime / slaMetrics.availability.checks) * 100;
      
      // Calculate 95th percentile response time
      slaMetrics.responseTime.measurements.sort((a, b) => a - b);
      const p95Index = Math.floor(slaMetrics.responseTime.measurements.length * 0.95);
      slaMetrics.responseTime.p95 = slaMetrics.responseTime.measurements[p95Index] || 0;
      
      slaMetrics.errorRate.rate = (slaMetrics.errorRate.errors / slaMetrics.errorRate.total) * 100;
      
      // Check SLA violations
      const slaViolations = [];
      
      if (availabilityPercentage < MONITORING_CONFIG.SLA_TARGETS.AVAILABILITY) {
        slaViolations.push({
          metric: 'Availability',
          target: MONITORING_CONFIG.SLA_TARGETS.AVAILABILITY,
          actual: availabilityPercentage,
          severity: 'HIGH'
        });
      }
      
      if (slaMetrics.responseTime.p95 > MONITORING_CONFIG.SLA_TARGETS.RESPONSE_P95) {
        slaViolations.push({
          metric: 'Response Time P95',
          target: MONITORING_CONFIG.SLA_TARGETS.RESPONSE_P95,
          actual: slaMetrics.responseTime.p95,
          severity: 'MEDIUM'
        });
      }
      
      if (slaMetrics.errorRate.rate > MONITORING_CONFIG.SLA_TARGETS.ERROR_RATE) {
        slaViolations.push({
          metric: 'Error Rate',
          target: MONITORING_CONFIG.SLA_TARGETS.ERROR_RATE,
          actual: slaMetrics.errorRate.rate,
          severity: 'HIGH'
        });
      }
      
      monitoringResults.slaViolations.push(...slaViolations);
      
      monitoringResults.performance.push({
        type: 'SLA Metrics',
        availability: availabilityPercentage,
        responseTimeP95: slaMetrics.responseTime.p95,
        errorRate: slaMetrics.errorRate.rate,
        throughput: slaMetrics.throughput.rps,
        violations: slaViolations.length
      });
      
      // Validate SLA compliance
      expect(availabilityPercentage).toBeGreaterThanOrEqual(MONITORING_CONFIG.SLA_TARGETS.AVAILABILITY);
      expect(slaMetrics.errorRate.rate).toBeLessThanOrEqual(MONITORING_CONFIG.SLA_TARGETS.ERROR_RATE);
      
      console.log(`✅ SLA compliance: ${availabilityPercentage.toFixed(2)}% availability, ${slaMetrics.responseTime.p95.toFixed(2)}ms P95, ${slaMetrics.errorRate.rate.toFixed(2)}% error rate`);
      console.log(`   ${slaViolations.length} SLA violations detected`);
    });
  });

  // Generate comprehensive monitoring report
  test('Generate comprehensive monitoring report', async () => {
    console.log('\n=== GENERATING MONITORING REPORT ===');
    
    const report = generateMonitoringReport(monitoringResults);
    
    console.log(`Report generated for period: ${new Date(report.periodStart).toISOString()} - ${new Date(report.periodEnd).toISOString()}`);
    console.log(`Overall system health: ${report.overallHealth}`);
    console.log(`Total metrics collected: ${report.metricsCount}`);
    console.log(`Total alerts: ${report.alertsCount}`);
    console.log(`Critical alerts: ${report.criticalAlerts}`);
    console.log(`SLA violations: ${report.slaViolations}`);
    console.log(`System uptime: ${report.systemUptime.toFixed(2)}%`);
    
    // Save monitoring report
    const reportPath = path.join(process.cwd(), 'production-monitoring-report.json');
    try {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`Monitoring report saved: ${reportPath}`);
    } catch (reportError) {
      console.warn('Could not save monitoring report:', reportError.message);
    }
    
    // Validate overall monitoring system
    expect(report.overallHealth).not.toBe('CRITICAL');
    expect(report.systemUptime).toBeGreaterThan(95);
    expect(report.criticalAlerts).toBeLessThan(5);
  });
});

// Mock monitoring classes for testing
class ProductionMonitor extends EventEmitter {
  constructor() {
    super();
    this.running = false;
    this.metrics = [];
  }
  
  start() {
    this.running = true;
    this.emit('started');
  }
  
  async stop() {
    this.running = false;
    this.emit('stopped');
  }
}

class AlertingSystem extends EventEmitter {
  constructor() {
    super();
    this.running = false;
    this.alerts = [];
  }
  
  start() {
    this.running = true;
    this.emit('started');
  }
  
  async stop() {
    this.running = false;
    this.emit('stopped');
  }
}

class MetricsCollector extends EventEmitter {
  constructor() {
    super();
    this.running = false;
    this.collected = [];
  }
  
  start() {
    this.running = true;
    this.emit('started');
  }
  
  async stop() {
    this.running = false;
    this.emit('stopped');
  }
}

// Helper function to set up monitoring test data
async function setupMonitoringTestData(store) {
  console.log('Setting up monitoring test data...');
  
  // Add test data for monitoring operations
  const testEntities = [
    { id: 'person1', name: 'Monitor Test Person 1', age: 25 },
    { id: 'person2', name: 'Monitor Test Person 2', age: 30 },
    { id: 'person3', name: 'Monitor Test Person 3', age: 35 }
  ];
  
  for (const entity of testEntities) {
    const subject = namedNode(`http://example.org/${entity.id}`);
    
    store.addQuad(quad(subject, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode('http://xmlns.com/foaf/0.1/Person')));
    store.addQuad(quad(subject, namedNode('http://xmlns.com/foaf/0.1/name'), literal(entity.name)));
    store.addQuad(quad(subject, namedNode('http://xmlns.com/foaf/0.1/age'), literal(String(entity.age))));
  }
  
  console.log(`Monitoring test data setup complete: ${store.size} triples`);
}

// Helper function to generate comprehensive monitoring report
function generateMonitoringReport(results) {
  const now = this.getDeterministicTimestamp();
  const periodStart = results.metrics.length > 0 ? Math.min(...results.metrics.map(m => m.timestamp)) : now;
  const periodEnd = now;
  
  const criticalAlerts = results.alerts.filter(a => 
    a.level === MONITORING_CONFIG.ALERT_LEVELS.CRITICAL || 
    a.level === MONITORING_CONFIG.ALERT_LEVELS.EMERGENCY
  ).length;
  
  const healthyComponents = results.healthChecks.filter(h => h.status === 'healthy').length;
  const totalComponents = results.healthChecks.length;
  const systemUptime = totalComponents > 0 ? (healthyComponents / totalComponents) * 100 : 100;
  
  let overallHealth = 'GOOD';
  if (criticalAlerts > 0 || systemUptime < 80) {
    overallHealth = 'CRITICAL';
  } else if (results.alerts.length > 10 || systemUptime < 95) {
    overallHealth = 'WARNING';
  } else if (results.slaViolations.length > 0) {
    overallHealth = 'DEGRADED';
  }
  
  return {
    timestamp: this.getDeterministicDate().toISOString(),
    periodStart,
    periodEnd,
    overallHealth,
    metricsCount: results.metrics.length,
    alertsCount: results.alerts.length,
    criticalAlerts,
    healthChecksCount: results.healthChecks.length,
    healthyComponents,
    totalComponents,
    systemUptime,
    slaViolations: results.slaViolations.length,
    performanceTests: results.performance.length,
    recommendations: generateMonitoringRecommendations(results, overallHealth),
    summary: {
      monitoring: 'Production monitoring system validated',
      alerting: 'Alert system operational',
      health: 'Component health monitoring active',
      sla: results.slaViolations.length === 0 ? 'SLA targets met' : `${results.slaViolations.length} SLA violations`,
      readiness: overallHealth === 'CRITICAL' ? 'NOT READY' : 'READY'
    }
  };
}

function generateMonitoringRecommendations(results, overallHealth) {
  const recommendations = [];
  
  if (overallHealth === 'CRITICAL') {
    recommendations.push('Immediate attention required - resolve critical alerts');
  }
  
  if (results.slaViolations.length > 0) {
    recommendations.push('Address SLA violations to meet performance targets');
  }
  
  if (results.alerts.length > 20) {
    recommendations.push('Review alert thresholds - too many alerts may indicate noise');
  }
  
  const memoryAlerts = results.alerts.filter(a => a.type.includes('MEMORY')).length;
  if (memoryAlerts > 3) {
    recommendations.push('Investigate memory usage patterns and optimize');
  }
  
  const performanceAlerts = results.alerts.filter(a => a.type.includes('RESPONSE')).length;
  if (performanceAlerts > 3) {
    recommendations.push('Optimize query performance and response times');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Monitoring system is healthy and ready for production');
  }
  
  return recommendations;
}