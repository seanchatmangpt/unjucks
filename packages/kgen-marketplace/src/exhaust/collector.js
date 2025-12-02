/**
 * Data Exhaust Collector
 * Collects anonymized build metrics, drift reports, and usage patterns
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DifferentialPrivacy } from '../privacy/differential.js';
import { ConsentManager } from '../consent/manager.js';

export class DataExhaustCollector extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = {
      batchSize: 100,
      flushInterval: 300000, // 5 minutes
      storageDir: '.kgen/exhaust',
      ...options
    };
    
    this.privacy = new DifferentialPrivacy({
      epsilon: 1.0, // Privacy budget
      delta: 1e-5
    });
    
    this.consent = new ConsentManager();
    this.buffer = [];
    this.sessionId = this.generateSessionId();
    
    this.setupAutoFlush();
  }

  /**
   * Collect build metrics with anonymization
   */
  collectBuildMetrics(buildData) {
    if (!this.consent.hasConsent('build_metrics')) {
      return;
    }

    const anonymized = this.anonymizeBuildData(buildData);
    this.addToBuffer('build_metrics', anonymized);
  }

  /**
   * Collect drift reports
   */
  collectDriftReport(driftData) {
    if (!this.consent.hasConsent('drift_reports')) {
      return;
    }

    const anonymized = this.anonymizeDriftData(driftData);
    this.addToBuffer('drift_reports', anonymized);
  }

  /**
   * Collect usage patterns
   */
  collectUsagePattern(usageData) {
    if (!this.consent.hasConsent('usage_patterns')) {
      return;
    }

    const anonymized = this.anonymizeUsageData(usageData);
    this.addToBuffer('usage_patterns', anonymized);
  }

  /**
   * Anonymize build data
   */
  anonymizeBuildData(buildData) {
    const anonymized = {
      timestamp: this.roundTimestamp(buildData.timestamp),
      sessionId: this.sessionId,
      buildType: buildData.buildType,
      duration: this.addNoise(buildData.duration),
      success: buildData.success,
      errorType: buildData.error ? this.categorizeError(buildData.error) : null,
      templateCount: this.addNoise(buildData.templateCount || 0),
      fileCount: this.addNoise(buildData.fileCount || 0),
      packageSize: this.bucketSize(buildData.packageSize || 0),
      dependencies: this.anonymizeDependencies(buildData.dependencies || []),
      platform: this.generalizePlatform(buildData.platform),
      nodeVersion: this.generalizeVersion(buildData.nodeVersion)
    };

    // Apply differential privacy
    return this.privacy.addNoise(anonymized, ['duration', 'templateCount', 'fileCount']);
  }

  /**
   * Anonymize drift data
   */
  anonymizeDriftData(driftData) {
    return {
      timestamp: this.roundTimestamp(driftData.timestamp),
      sessionId: this.sessionId,
      driftType: driftData.type,
      severity: driftData.severity,
      category: driftData.category,
      resolution: driftData.resolution,
      timeToResolve: this.addNoise(driftData.timeToResolve || 0),
      affectedFiles: this.addNoise(driftData.affectedFiles || 0),
      templateComplexity: this.bucketComplexity(driftData.templateComplexity)
    };
  }

  /**
   * Anonymize usage data
   */
  anonymizeUsageData(usageData) {
    return {
      timestamp: this.roundTimestamp(usageData.timestamp),
      sessionId: this.sessionId,
      command: usageData.command,
      flags: this.anonymizeFlags(usageData.flags || []),
      executionTime: this.addNoise(usageData.executionTime),
      success: usageData.success,
      userFlow: this.anonymizeUserFlow(usageData.userFlow || []),
      templateUsage: this.anonymizeTemplateUsage(usageData.templateUsage || {}),
      featureUsage: this.anonymizeFeatureUsage(usageData.featureUsage || {})
    };
  }

  /**
   * Add data to collection buffer
   */
  addToBuffer(type, data) {
    this.buffer.push({
      type,
      data,
      collected: Date.now()
    });

    if (this.buffer.length >= this.config.batchSize) {
      this.flush();
    }

    this.emit('dataCollected', { type, data });
  }

  /**
   * Flush buffer to storage
   */
  flush() {
    if (this.buffer.length === 0) return;

    const batch = {
      id: this.generateBatchId(),
      sessionId: this.sessionId,
      timestamp: Date.now(),
      count: this.buffer.length,
      data: [...this.buffer]
    };

    this.saveBatch(batch);
    this.buffer = [];
    this.emit('batchFlushed', batch);
  }

  /**
   * Generate aggregated insights
   */
  generateInsights() {
    const batches = this.loadAllBatches();
    const insights = {
      buildPatterns: this.analyzeBuildPatterns(batches),
      driftTrends: this.analyzeDriftTrends(batches),
      usageStatistics: this.analyzeUsageStatistics(batches),
      performanceMetrics: this.analyzePerformanceMetrics(batches),
      templatePopularity: this.analyzeTemplatePopularity(batches)
    };

    return this.privacy.addNoiseToAggregates(insights);
  }

  /**
   * Helper methods for anonymization
   */
  generateSessionId() {
    const timestamp = Math.floor(Date.now() / (1000 * 60 * 60)); // Hour granularity
    const random = Math.random().toString(36).substring(2, 15);
    return createHash('sha256').update(`${timestamp}-${random}`).digest('hex').substring(0, 16);
  }

  generateBatchId() {
    return createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex').substring(0, 12);
  }

  roundTimestamp(timestamp, granularity = 300000) { // 5 min granularity
    return Math.floor(timestamp / granularity) * granularity;
  }

  addNoise(value, scale = 0.1) {
    if (typeof value !== 'number') return value;
    const noise = (Math.random() - 0.5) * 2 * scale * value;
    return Math.max(0, Math.round(value + noise));
  }

  bucketSize(size) {
    if (size < 1024) return 'small';
    if (size < 1024 * 1024) return 'medium';
    if (size < 10 * 1024 * 1024) return 'large';
    return 'xlarge';
  }

  bucketComplexity(complexity) {
    if (typeof complexity !== 'number') return 'unknown';
    if (complexity < 10) return 'simple';
    if (complexity < 50) return 'moderate';
    if (complexity < 100) return 'complex';
    return 'very_complex';
  }

  categorizeError(error) {
    if (error.includes('permission')) return 'permission_error';
    if (error.includes('network')) return 'network_error';
    if (error.includes('syntax')) return 'syntax_error';
    if (error.includes('dependency')) return 'dependency_error';
    return 'other_error';
  }

  generalizePlatform(platform) {
    if (!platform) return 'unknown';
    if (platform.includes('darwin')) return 'macos';
    if (platform.includes('win')) return 'windows';
    if (platform.includes('linux')) return 'linux';
    return 'other';
  }

  generalizeVersion(version) {
    if (!version) return 'unknown';
    const major = version.split('.')[0];
    return `${major}.x`;
  }

  anonymizeDependencies(deps) {
    return deps.map(dep => ({
      type: dep.type,
      category: this.categorizeDependency(dep.name),
      versionPattern: this.generalizeVersion(dep.version)
    }));
  }

  categorizeDependency(name) {
    if (name.includes('react')) return 'ui_framework';
    if (name.includes('express')) return 'web_framework';
    if (name.includes('test') || name.includes('jest')) return 'testing';
    if (name.includes('babel') || name.includes('webpack')) return 'build_tool';
    return 'other';
  }

  anonymizeFlags(flags) {
    return flags.filter(flag => !this.isSensitiveFlag(flag))
                .map(flag => this.generalizeFlag(flag));
  }

  isSensitiveFlag(flag) {
    const sensitive = ['--token', '--key', '--secret', '--password', '--auth'];
    return sensitive.some(s => flag.toLowerCase().includes(s));
  }

  generalizeFlag(flag) {
    if (flag.startsWith('--')) return flag.split('=')[0];
    return flag;
  }

  anonymizeUserFlow(flow) {
    return flow.map(step => ({
      action: step.action,
      duration: this.addNoise(step.duration),
      success: step.success
    }));
  }

  anonymizeTemplateUsage(usage) {
    const anonymized = {};
    Object.keys(usage).forEach(template => {
      const category = this.categorizeTemplate(template);
      anonymized[category] = (anonymized[category] || 0) + usage[template];
    });
    return anonymized;
  }

  categorizeTemplate(template) {
    if (template.includes('react')) return 'react_component';
    if (template.includes('api')) return 'api_endpoint';
    if (template.includes('test')) return 'test_file';
    if (template.includes('config')) return 'configuration';
    return 'other';
  }

  anonymizeFeatureUsage(usage) {
    const features = ['generation', 'injection', 'validation', 'packaging'];
    const anonymized = {};
    features.forEach(feature => {
      if (usage[feature]) {
        anonymized[feature] = this.addNoise(usage[feature]);
      }
    });
    return anonymized;
  }

  /**
   * Analysis methods for insights
   */
  analyzeBuildPatterns(batches) {
    const builds = batches.flatMap(b => b.data.filter(d => d.type === 'build_metrics'));
    
    return {
      totalBuilds: builds.length,
      successRate: builds.filter(b => b.data.success).length / builds.length,
      averageDuration: builds.reduce((sum, b) => sum + b.data.duration, 0) / builds.length,
      popularTemplates: this.getPopularTemplates(builds),
      errorDistribution: this.getErrorDistribution(builds),
      timePatterns: this.getTimePatterns(builds)
    };
  }

  analyzeDriftTrends(batches) {
    const drifts = batches.flatMap(b => b.data.filter(d => d.type === 'drift_reports'));
    
    return {
      totalDrifts: drifts.length,
      severityDistribution: this.getSeverityDistribution(drifts),
      resolutionTimes: this.getResolutionTimes(drifts),
      driftCategories: this.getDriftCategories(drifts),
      trendsOverTime: this.getDriftTrends(drifts)
    };
  }

  analyzeUsageStatistics(batches) {
    const usage = batches.flatMap(b => b.data.filter(d => d.type === 'usage_patterns'));
    
    return {
      totalCommands: usage.length,
      commandDistribution: this.getCommandDistribution(usage),
      featureAdoption: this.getFeatureAdoption(usage),
      userJourneys: this.getUserJourneys(usage),
      performanceMetrics: this.getUsagePerformance(usage)
    };
  }

  analyzePerformanceMetrics(batches) {
    const allData = batches.flatMap(b => b.data);
    
    return {
      averageResponseTime: this.getAverageResponseTime(allData),
      throughputMetrics: this.getThroughputMetrics(allData),
      resourceUtilization: this.getResourceUtilization(allData),
      bottleneckAnalysis: this.getBottleneckAnalysis(allData)
    };
  }

  analyzeTemplatePopularity(batches) {
    const templates = batches.flatMap(b => b.data)
                            .filter(d => d.data.templateUsage)
                            .flatMap(d => Object.entries(d.data.templateUsage));
    
    const popularity = {};
    templates.forEach(([template, count]) => {
      popularity[template] = (popularity[template] || 0) + count;
    });
    
    return Object.entries(popularity)
                 .sort((a, b) => b[1] - a[1])
                 .slice(0, 20); // Top 20
  }

  /**
   * Storage methods
   */
  saveBatch(batch) {
    const dir = this.config.storageDir;
    if (!existsSync(dir)) {
      require('fs').mkdirSync(dir, { recursive: true });
    }
    
    const filename = join(dir, `batch-${batch.id}.json`);
    writeFileSync(filename, JSON.stringify(batch, null, 2));
  }

  loadAllBatches() {
    const dir = this.config.storageDir;
    if (!existsSync(dir)) return [];
    
    const files = require('fs').readdirSync(dir)
                              .filter(f => f.startsWith('batch-') && f.endsWith('.json'));
    
    return files.map(f => {
      try {
        return JSON.parse(readFileSync(join(dir, f), 'utf8'));
      } catch (e) {
        console.warn(`Failed to load batch file ${f}:`, e.message);
        return null;
      }
    }).filter(Boolean);
  }

  setupAutoFlush() {
    setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  // Placeholder methods for detailed analysis
  getPopularTemplates(builds) { return {}; }
  getErrorDistribution(builds) { return {}; }
  getTimePatterns(builds) { return {}; }
  getSeverityDistribution(drifts) { return {}; }
  getResolutionTimes(drifts) { return {}; }
  getDriftCategories(drifts) { return {}; }
  getDriftTrends(drifts) { return {}; }
  getCommandDistribution(usage) { return {}; }
  getFeatureAdoption(usage) { return {}; }
  getUserJourneys(usage) { return {}; }
  getUsagePerformance(usage) { return {}; }
  getAverageResponseTime(data) { return 0; }
  getThroughputMetrics(data) { return {}; }
  getResourceUtilization(data) { return {}; }
  getBottleneckAnalysis(data) { return {}; }
}

export default DataExhaustCollector;