/**
 * SLI/SLO Tracking System
 * Service Level Indicators and Objectives monitoring for production environments
 */

import { EventEmitter } from 'events';
import logger from '../lib/observability/logger.js';
import { metricsCollector } from './metrics-collector.js';

/**
 * SLI types for different measurement categories
 */
export const SLIType = {
  AVAILABILITY: 'availability',       // Service uptime
  LATENCY: 'latency',                 // Response time
  THROUGHPUT: 'throughput',           // Requests per second
  ERROR_RATE: 'error_rate',           // Error percentage
  QUALITY: 'quality',                 // Business logic success rate
  FRESHNESS: 'freshness',             // Data recency
  COVERAGE: 'coverage',               // Feature coverage
  CORRECTNESS: 'correctness',         // Accuracy of results
  DURABILITY: 'durability'            // Data persistence reliability
};

/**
 * SLO compliance statuses
 */
export const ComplianceStatus = {
  COMPLIANT: 'compliant',             // Meeting SLO
  AT_RISK: 'at_risk',                // Close to SLO violation
  VIOLATED: 'violated',               // SLO violated
  NO_DATA: 'no_data'                 // Insufficient data
};

/**
 * Time windows for SLO evaluation
 */
export const TimeWindow = {
  MINUTE_1: '1m',
  MINUTE_5: '5m',
  MINUTE_15: '15m',
  HOUR_1: '1h',
  HOUR_4: '4h',
  DAY_1: '1d',
  WEEK_1: '7d',
  MONTH_1: '30d'
};

/**
 * Service Level Indicator definition and tracking
 */
class ServiceLevelIndicator {
  constructor(name, type, description, measurementFn, options = {}) {
    this.name = name;
    this.type = type;
    this.description = description;
    this.measurementFn = measurementFn;
    
    // Configuration
    this.enabled = options.enabled !== false;
    this.measurementInterval = options.measurementInterval || 60000; // 1 minute
    this.retentionPeriod = options.retentionPeriod || 30 * 24 * 60 * 60 * 1000; // 30 days
    this.tags = options.tags || {};
    
    // Data storage
    this.measurements = [];
    this.lastMeasurement = null;
    this.lastMeasurementTime = null;
    
    // Statistics
    this.totalMeasurements = 0;
    this.successfulMeasurements = 0;
    this.failedMeasurements = 0;
  }
  
  /**
   * Take a measurement
   */
  async measure() {
    if (!this.enabled) return null;
    
    const measurementTime = Date.now();
    
    try {
      const result = await this.measurementFn();
      const measurement = {
        timestamp: measurementTime,
        value: result.value,
        success: result.success !== false,
        metadata: result.metadata || {},
        duration: result.duration || 0
      };
      
      this.addMeasurement(measurement);
      this.lastMeasurement = measurement;
      this.lastMeasurementTime = measurementTime;
      
      return measurement;
      
    } catch (error) {
      const errorMeasurement = {
        timestamp: measurementTime,
        value: null,
        success: false,
        error: error.message,
        metadata: {}
      };
      
      this.addMeasurement(errorMeasurement);
      this.lastMeasurement = errorMeasurement;
      this.lastMeasurementTime = measurementTime;
      
      logger.error(`SLI measurement failed for ${this.name}`, error);
      return errorMeasurement;
    }
  }
  
  /**
   * Add measurement to storage with retention policy
   */
  addMeasurement(measurement) {
    this.measurements.push(measurement);
    this.totalMeasurements++;
    
    if (measurement.success) {
      this.successfulMeasurements++;
    } else {
      this.failedMeasurements++;
    }
    
    // Clean up old measurements
    const cutoff = Date.now() - this.retentionPeriod;
    this.measurements = this.measurements.filter(m => m.timestamp > cutoff);
  }
  
  /**
   * Calculate SLI value for a time window
   */
  calculateSLI(timeWindow, endTime = Date.now()) {
    const windowMs = this.parseTimeWindow(timeWindow);
    const startTime = endTime - windowMs;
    
    const windowMeasurements = this.measurements.filter(
      m => m.timestamp >= startTime && m.timestamp <= endTime
    );
    
    if (windowMeasurements.length === 0) {
      return {
        value: null,
        status: ComplianceStatus.NO_DATA,
        sampleCount: 0,
        timeWindow,
        startTime,
        endTime
      };
    }
    
    let sliValue;
    
    switch (this.type) {
      case SLIType.AVAILABILITY:
        sliValue = this.calculateAvailability(windowMeasurements);
        break;
      case SLIType.LATENCY:
        sliValue = this.calculateLatencyPercentile(windowMeasurements, 0.95);
        break;
      case SLIType.ERROR_RATE:
        sliValue = this.calculateErrorRate(windowMeasurements);
        break;
      case SLIType.THROUGHPUT:
        sliValue = this.calculateThroughput(windowMeasurements, windowMs);
        break;
      default:
        sliValue = this.calculateGenericSLI(windowMeasurements);
    }
    
    return {
      value: sliValue,
      sampleCount: windowMeasurements.length,
      timeWindow,
      startTime,
      endTime,
      measurements: windowMeasurements
    };
  }
  
  /**
   * Calculate availability (uptime percentage)
   */
  calculateAvailability(measurements) {
    const successCount = measurements.filter(m => m.success).length;
    return (successCount / measurements.length) * 100;
  }
  
  /**
   * Calculate latency percentile
   */
  calculateLatencyPercentile(measurements, percentile) {
    const latencies = measurements
      .filter(m => m.success && m.duration > 0)
      .map(m => m.duration)
      .sort((a, b) => a - b);
    
    if (latencies.length === 0) return 0;
    
    const index = Math.ceil(latencies.length * percentile) - 1;
    return latencies[Math.max(0, index)];
  }
  
  /**
   * Calculate error rate percentage
   */
  calculateErrorRate(measurements) {
    const errorCount = measurements.filter(m => !m.success).length;
    return (errorCount / measurements.length) * 100;
  }
  
  /**
   * Calculate throughput (requests per second)
   */
  calculateThroughput(measurements, windowMs) {
    const successCount = measurements.filter(m => m.success).length;
    return (successCount / windowMs) * 1000; // Convert to per second
  }
  
  /**
   * Calculate generic SLI (average of successful measurements)
   */
  calculateGenericSLI(measurements) {
    const successfulMeasurements = measurements.filter(m => m.success && m.value !== null);
    if (successfulMeasurements.length === 0) return 0;
    
    const sum = successfulMeasurements.reduce((acc, m) => acc + m.value, 0);
    return sum / successfulMeasurements.length;
  }
  
  /**
   * Parse time window string to milliseconds
   */
  parseTimeWindow(timeWindow) {
    const match = timeWindow.match(/^(\d+)([mhd])$/);
    if (!match) throw new Error(`Invalid time window: ${timeWindow}`);
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: throw new Error(`Unknown time unit: ${unit}`);
    }
  }
  
  /**
   * Get SLI statistics
   */
  getStats() {
    return {
      name: this.name,
      type: this.type,
      enabled: this.enabled,
      totalMeasurements: this.totalMeasurements,
      successfulMeasurements: this.successfulMeasurements,
      failedMeasurements: this.failedMeasurements,
      successRate: this.totalMeasurements > 0 
        ? (this.successfulMeasurements / this.totalMeasurements) * 100 
        : 0,
      lastMeasurement: this.lastMeasurement,
      lastMeasurementTime: this.lastMeasurementTime,
      measurementInterval: this.measurementInterval,
      retentionPeriod: this.retentionPeriod
    };
  }
}

/**
 * Service Level Objective definition and compliance tracking
 */
class ServiceLevelObjective {
  constructor(name, sliName, target, timeWindow, description, options = {}) {
    this.name = name;
    this.sliName = sliName;
    this.target = target; // Target value (e.g., 99.9 for 99.9% availability)
    this.timeWindow = timeWindow;
    this.description = description;
    
    // Configuration
    this.enabled = options.enabled !== false;
    this.alertThresholds = {
      warning: options.warningThreshold || target * 0.95, // 5% below target
      critical: options.criticalThreshold || target * 0.90  // 10% below target
    };
    
    // Compliance tracking
    this.complianceHistory = [];
    this.currentStatus = ComplianceStatus.NO_DATA;
    this.lastViolation = null;
    this.totalViolations = 0;
    this.burnRate = 0; // Error budget consumption rate
    
    // Error budget (how much we can fail and still meet SLO)
    this.errorBudgetPercentage = 100 - target; // e.g., 0.1% for 99.9% target
    this.remainingErrorBudget = 100; // Percentage of budget remaining
  }
  
  /**
   * Evaluate SLO compliance
   */
  evaluateCompliance(sliValue) {
    if (sliValue.value === null) {
      this.currentStatus = ComplianceStatus.NO_DATA;
      return this.createComplianceResult(sliValue);
    }
    
    let status;
    let remainingBudget;
    
    // Determine compliance status based on SLI type
    if (this.sliName.includes('error_rate')) {
      // For error rates, lower is better
      status = sliValue.value <= (100 - this.target) 
        ? ComplianceStatus.COMPLIANT 
        : ComplianceStatus.VIOLATED;
      remainingBudget = Math.max(0, (100 - this.target) - sliValue.value);
    } else {
      // For availability, latency, etc., higher is better
      if (sliValue.value >= this.target) {
        status = ComplianceStatus.COMPLIANT;
      } else if (sliValue.value >= this.alertThresholds.warning) {
        status = ComplianceStatus.AT_RISK;
      } else {
        status = ComplianceStatus.VIOLATED;
      }
      
      remainingBudget = Math.max(0, sliValue.value - (100 - this.target));
    }
    
    // Calculate error budget consumption
    this.remainingErrorBudget = (remainingBudget / this.errorBudgetPercentage) * 100;
    this.burnRate = this.calculateBurnRate();
    
    // Track violations
    if (status === ComplianceStatus.VIOLATED) {
      this.totalViolations++;
      this.lastViolation = Date.now();
    }
    
    this.currentStatus = status;
    
    const complianceResult = this.createComplianceResult(sliValue, status);
    this.addComplianceRecord(complianceResult);
    
    return complianceResult;
  }
  
  /**
   * Create compliance result object
   */
  createComplianceResult(sliValue, status = null) {
    return {
      sloName: this.name,
      sliName: this.sliName,
      target: this.target,
      actual: sliValue.value,
      status: status || this.currentStatus,
      timeWindow: this.timeWindow,
      timestamp: Date.now(),
      errorBudgetRemaining: this.remainingErrorBudget,
      burnRate: this.burnRate,
      sampleCount: sliValue.sampleCount,
      alertLevel: this.determineAlertLevel(sliValue.value)
    };
  }
  
  /**
   * Calculate error budget burn rate
   */
  calculateBurnRate() {
    if (this.complianceHistory.length < 2) return 0;
    
    const recent = this.complianceHistory.slice(-10); // Last 10 measurements
    const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
    
    if (timeSpan === 0) return 0;
    
    const budgetChange = recent[0].errorBudgetRemaining - recent[recent.length - 1].errorBudgetRemaining;
    const ratePerMs = budgetChange / timeSpan;
    
    // Convert to percentage per hour
    return ratePerMs * 60 * 60 * 1000;
  }
  
  /**
   * Determine alert level based on value
   */
  determineAlertLevel(value) {
    if (value === null) return null;
    
    if (this.sliName.includes('error_rate')) {
      // For error rates, higher is worse
      if (value > (100 - this.alertThresholds.critical)) return 'critical';
      if (value > (100 - this.alertThresholds.warning)) return 'warning';
    } else {
      // For other metrics, lower is worse
      if (value < this.alertThresholds.critical) return 'critical';
      if (value < this.alertThresholds.warning) return 'warning';
    }
    
    return null;
  }
  
  /**
   * Add compliance record to history
   */
  addComplianceRecord(result) {
    this.complianceHistory.push(result);
    
    // Maintain history size (keep last 1000 records)
    if (this.complianceHistory.length > 1000) {
      this.complianceHistory.shift();
    }
  }
  
  /**
   * Get SLO statistics and compliance summary
   */
  getStats() {
    const totalRecords = this.complianceHistory.length;
    const compliantRecords = this.complianceHistory.filter(r => r.status === ComplianceStatus.COMPLIANT).length;
    const violatedRecords = this.complianceHistory.filter(r => r.status === ComplianceStatus.VIOLATED).length;
    
    return {
      name: this.name,
      sliName: this.sliName,
      target: this.target,
      timeWindow: this.timeWindow,
      enabled: this.enabled,
      currentStatus: this.currentStatus,
      totalRecords,
      complianceRate: totalRecords > 0 ? (compliantRecords / totalRecords) * 100 : 0,
      violationRate: totalRecords > 0 ? (violatedRecords / totalRecords) * 100 : 0,
      totalViolations: this.totalViolations,
      lastViolation: this.lastViolation,
      errorBudgetRemaining: this.remainingErrorBudget,
      burnRate: this.burnRate,
      alertThresholds: this.alertThresholds
    };
  }
}

/**
 * Main SLI/SLO tracking orchestrator
 */
class SLISLOTracker extends EventEmitter {
  constructor() {
    super();
    
    this.slis = new Map();
    this.slos = new Map();
    this.isRunning = false;
    this.measurementInterval = null;
    
    this.initializeDefaultSLIs();
    this.initializeDefaultSLOs();
  }
  
  /**
   * Initialize default SLIs for the service
   */
  initializeDefaultSLIs() {
    // Service Availability SLI
    this.registerSLI('service_availability', SLIType.AVAILABILITY, 
      'Service uptime and availability',
      async () => {
        // Check if service is responding
        try {
          const start = Date.now();
          // Simple health check - can be enhanced with actual service ping
          await new Promise(resolve => setTimeout(resolve, 10));
          return {
            value: 100, // Available
            success: true,
            duration: Date.now() - start
          };
        } catch (error) {
          return {
            value: 0, // Unavailable
            success: false,
            duration: 0
          };
        }
      }
    );
    
    // Template Generation Latency SLI
    this.registerSLI('template_generation_latency', SLIType.LATENCY,
      'Template generation response time',
      async () => {
        // This would be called during actual template generation
        // For now, return last known latency from metrics
        const summary = metricsCollector.getMetricsSummary();
        const templateMetrics = summary.performanceMetrics['template_generation_duration_seconds'];
        
        if (templateMetrics) {
          return {
            value: templateMetrics.p95 * 1000, // Convert to milliseconds
            success: true,
            duration: templateMetrics.average
          };
        }
        
        return {
          value: 0,
          success: false
        };
      }
    );
    
    // Error Rate SLI
    this.registerSLI('error_rate', SLIType.ERROR_RATE,
      'Application error rate percentage',
      async () => {
        try {
          // Calculate error rate from recent metrics
          // This is a simplified calculation - in production, you'd use actual metrics
          const totalRequests = 100; // This would come from actual metrics
          const errorRequests = 2;   // This would come from actual metrics
          
          const errorRate = (errorRequests / totalRequests) * 100;
          
          return {
            value: errorRate,
            success: true,
            metadata: { totalRequests, errorRequests }
          };
        } catch (error) {
          return {
            value: 100, // Assume 100% error rate if we can't measure
            success: false
          };
        }
      }
    );
    
    // RDF Processing Quality SLI
    this.registerSLI('rdf_processing_quality', SLIType.QUALITY,
      'RDF processing success rate',
      async () => {
        try {
          // Mock RDF processing quality check
          const processingSuccessRate = 98.5; // This would come from actual metrics
          
          return {
            value: processingSuccessRate,
            success: true
          };
        } catch (error) {
          return {
            value: 0,
            success: false
          };
        }
      }
    );
    
    logger.info('Initialized default SLIs', {
      count: this.slis.size,
      types: Array.from(new Set(Array.from(this.slis.values()).map(sli => sli.type)))
    });
  }
  
  /**
   * Initialize default SLOs for the service
   */
  initializeDefaultSLOs() {
    // Service Availability SLO: 99.9% uptime over 30 days
    this.registerSLO('service_availability_slo', 'service_availability', 
      99.9, TimeWindow.MONTH_1, 
      '99.9% service availability over 30 days');
    
    // Template Generation Latency SLO: 95th percentile < 2 seconds
    this.registerSLO('template_latency_slo', 'template_generation_latency',
      2000, TimeWindow.DAY_1,
      'Template generation 95th percentile latency under 2 seconds');
    
    // Error Rate SLO: < 1% error rate over 1 day
    this.registerSLO('error_rate_slo', 'error_rate',
      1.0, TimeWindow.DAY_1,
      'Error rate below 1% over 24 hours');
    
    // RDF Processing Quality SLO: > 99% success rate
    this.registerSLO('rdf_quality_slo', 'rdf_processing_quality',
      99.0, TimeWindow.WEEK_1,
      'RDF processing success rate above 99% over 7 days');
    
    logger.info('Initialized default SLOs', {
      count: this.slos.size,
      timeWindows: Array.from(new Set(Array.from(this.slos.values()).map(slo => slo.timeWindow)))
    });
  }
  
  /**
   * Register a new SLI
   */
  registerSLI(name, type, description, measurementFn, options = {}) {
    const sli = new ServiceLevelIndicator(name, type, description, measurementFn, options);
    this.slis.set(name, sli);
    
    logger.debug(`Registered SLI: ${name}`, {
      type,
      interval: sli.measurementInterval
    });
    
    return sli;
  }
  
  /**
   * Register a new SLO
   */
  registerSLO(name, sliName, target, timeWindow, description, options = {}) {
    if (!this.slis.has(sliName)) {
      throw new Error(`SLI '${sliName}' not found for SLO '${name}'`);
    }
    
    const slo = new ServiceLevelObjective(name, sliName, target, timeWindow, description, options);
    this.slos.set(name, slo);
    
    logger.debug(`Registered SLO: ${name}`, {
      sliName,
      target,
      timeWindow
    });
    
    return slo;
  }
  
  /**
   * Start SLI/SLO tracking
   */
  start() {
    if (this.isRunning) {
      logger.warn('SLI/SLO tracking already running');
      return;
    }
    
    this.isRunning = true;
    
    // Start periodic measurements
    this.measurementInterval = setInterval(async () => {
      await this.measureAllSLIs();
      await this.evaluateAllSLOs();
    }, 60000); // Every minute
    
    logger.info('Started SLI/SLO tracking');
  }
  
  /**
   * Measure all enabled SLIs
   */
  async measureAllSLIs() {
    const results = await Promise.allSettled(
      Array.from(this.slis.values())
        .filter(sli => sli.enabled)
        .map(sli => sli.measure())
    );
    
    results.forEach((result, index) => {
      const sliName = Array.from(this.slis.keys())[index];
      
      if (result.status === 'fulfilled') {
        this.emit('sli-measured', {
          sliName,
          measurement: result.value
        });
      } else {
        logger.error(`Failed to measure SLI ${sliName}`, result.reason);
      }
    });
  }
  
  /**
   * Evaluate all enabled SLOs
   */
  async evaluateAllSLOs() {
    for (const [sloName, slo] of this.slos.entries()) {
      if (!slo.enabled) continue;
      
      const sli = this.slis.get(slo.sliName);
      if (!sli) continue;
      
      try {
        const sliValue = sli.calculateSLI(slo.timeWindow);
        const compliance = slo.evaluateCompliance(sliValue);
        
        this.emit('slo-evaluated', compliance);
        
        // Emit alerts for violations
        if (compliance.status === ComplianceStatus.VIOLATED) {
          this.emit('slo-violated', compliance);
          logger.error(`SLO violated: ${sloName}`, compliance);
        } else if (compliance.status === ComplianceStatus.AT_RISK) {
          this.emit('slo-at-risk', compliance);
          logger.warn(`SLO at risk: ${sloName}`, compliance);
        }
        
      } catch (error) {
        logger.error(`Failed to evaluate SLO ${sloName}`, error);
      }
    }
  }
  
  /**
   * Get current SLI/SLO dashboard data
   */
  getDashboardData() {
    const sliStats = {};
    const sloStats = {};
    
    // Collect SLI statistics
    for (const [name, sli] of this.slis.entries()) {
      sliStats[name] = {
        ...sli.getStats(),
        currentValue: sli.lastMeasurement ? sli.lastMeasurement.value : null
      };
    }
    
    // Collect SLO statistics
    for (const [name, slo] of this.slos.entries()) {
      const stats = slo.getStats();
      const sli = this.slis.get(slo.sliName);
      
      sloStats[name] = {
        ...stats,
        currentSliValue: sli && sli.lastMeasurement ? sli.lastMeasurement.value : null
      };
    }
    
    // Overall compliance summary
    const totalSlos = this.slos.size;
    const compliantSlos = Array.from(this.slos.values())
      .filter(slo => slo.currentStatus === ComplianceStatus.COMPLIANT).length;
    const violatedSlos = Array.from(this.slos.values())
      .filter(slo => slo.currentStatus === ComplianceStatus.VIOLATED).length;
    
    return {
      summary: {
        totalSLIs: this.slis.size,
        totalSLOs: totalSlos,
        compliantSLOs: compliantSlos,
        violatedSLOs: violatedSlos,
        overallComplianceRate: totalSlos > 0 ? (compliantSlos / totalSlos) * 100 : 100
      },
      slis: sliStats,
      slos: sloStats,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Get error budget status for all SLOs
   */
  getErrorBudgetStatus() {
    const budgets = {};
    
    for (const [name, slo] of this.slos.entries()) {
      budgets[name] = {
        name: slo.name,
        target: slo.target,
        remainingBudget: slo.remainingErrorBudget,
        burnRate: slo.burnRate,
        timeToExhaustion: slo.burnRate > 0 ? slo.remainingErrorBudget / slo.burnRate : Infinity,
        status: slo.currentStatus
      };
    }
    
    return budgets;
  }
  
  /**
   * Stop SLI/SLO tracking
   */
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.measurementInterval) {
      clearInterval(this.measurementInterval);
      this.measurementInterval = null;
    }
    
    logger.info('Stopped SLI/SLO tracking');
  }
  
  /**
   * Export SLI/SLO data for analysis
   */
  exportData(format = 'json') {
    const data = {
      exportTime: new Date().toISOString(),
      slis: {},
      slos: {}
    };
    
    // Export SLI data
    for (const [name, sli] of this.slis.entries()) {
      data.slis[name] = {
        definition: sli.getStats(),
        measurements: sli.measurements
      };
    }
    
    // Export SLO data
    for (const [name, slo] of this.slos.entries()) {
      data.slos[name] = {
        definition: slo.getStats(),
        complianceHistory: slo.complianceHistory
      };
    }
    
    if (format === 'csv') {
      return this.convertToCSV(data);
    }
    
    return JSON.stringify(data, null, 2);
  }
  
  /**
   * Convert data to CSV format
   */
  convertToCSV(data) {
    let csv = 'Type,Name,Timestamp,Value,Status,Target,Success\n';
    
    // Add SLI measurements
    for (const [name, sliData] of Object.entries(data.slis)) {
      sliData.measurements.forEach(measurement => {
        csv += `SLI,${name},${new Date(measurement.timestamp).toISOString()},${measurement.value || ''},${measurement.success},,${measurement.success}\n`;
      });
    }
    
    // Add SLO compliance records
    for (const [name, sloData] of Object.entries(data.slos)) {
      sloData.complianceHistory.forEach(record => {
        csv += `SLO,${name},${new Date(record.timestamp).toISOString()},${record.actual || ''},${record.status},${record.target},${record.status === ComplianceStatus.COMPLIANT}\n`;
      });
    }
    
    return csv;
  }
  
  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('[SLI/SLO] Shutting down SLI/SLO tracker...');
    
    this.stop();
    this.removeAllListeners();
    
    logger.info('[SLI/SLO] Shutdown complete');
  }
}

// Export singleton instance
export const sliSloTracker = new SLISLOTracker();
export { SLISLOTracker, ServiceLevelIndicator, ServiceLevelObjective };
export default sliSloTracker;
