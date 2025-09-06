/**
 * Semantic Validation Dashboard
 * Real-time semantic validation metrics and compliance tracking
 * Enterprise performance monitoring and quality trend analysis
 */

import { EventEmitter } from 'events';
import { ValidationResult, ValidationContext, ComplianceStatus, PerformanceMetrics } from './semantic-validator';
import { BenchmarkResult } from './quality-gates/performance-benchmark-gate';
import { QualityGateResult } from './quality-gates/ontology-completeness-gate';

interface DashboardMetrics {
  validationSummary: ValidationSummaryMetrics;
  complianceOverview: ComplianceOverviewMetrics;
  performanceTrends: PerformanceTrendMetrics;
  qualityMetrics: QualityMetricsOverview;
  realTimeAlerts: ValidationAlert[];
  systemHealth: SystemHealthMetrics;
}

interface ValidationSummaryMetrics {
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  averageValidationTime: number;
  validationsPerHour: number;
  currentSuccessRate: number;
  trendsLast24h: ValidationTrend[];
}

interface ComplianceOverviewMetrics {
  frameworkCompliance: FrameworkComplianceStatus[];
  criticalViolations: number;
  totalViolations: number;
  complianceScore: number;
  industryBenchmark: number;
  complianceTrends: ComplianceTrend[];
  riskAssessment: ComplianceRiskLevel;
}

interface PerformanceTrendMetrics {
  responseTimeP95: number;
  responseTimeP99: number;
  throughputTrend: number[];
  memoryUsageTrend: number[];
  errorRateTrend: number[];
  scalabilityMetrics: ScalabilityTrendData;
}

interface QualityMetricsOverview {
  overallQualityScore: number;
  ontologyCompleteness: number;
  semanticConsistency: number;
  dataQuality: number;
  documentationCoverage: number;
  qualityTrends: QualityTrend[];
}

interface ValidationAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'validation_failure' | 'compliance_violation' | 'performance_degradation' | 'system_error';
  message: string;
  timestamp: Date;
  context: string;
  actionRequired: string;
  acknowledged: boolean;
}

interface SystemHealthMetrics {
  cpuUtilization: number;
  memoryUtilization: number;
  diskUsage: number;
  networkLatency: number;
  systemLoad: number;
  uptime: number;
  healthScore: number;
  lastHealthCheck: Date;
}

interface ValidationTrend {
  timestamp: Date;
  validationCount: number;
  successRate: number;
  averageScore: number;
}

interface ComplianceTrend {
  timestamp: Date;
  framework: string;
  complianceScore: number;
  violationCount: number;
}

interface QualityTrend {
  timestamp: Date;
  qualityScore: number;
  completenessScore: number;
  consistencyScore: number;
}

interface FrameworkComplianceStatus {
  framework: string;
  status: 'compliant' | 'non-compliant' | 'partial' | 'unknown';
  score: number;
  violations: number;
  lastChecked: Date;
  trend: 'improving' | 'stable' | 'declining';
}

interface ScalabilityTrendData {
  datasetSizeGrowth: number[];
  performanceImpact: number[];
  recommendedCapacity: number;
  scalingAlerts: string[];
}

type ComplianceRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export class SemanticDashboard extends EventEmitter {
  private metrics: DashboardMetrics;
  private validationHistory: ValidationResult[];
  private complianceHistory: ComplianceStatus[];
  private performanceHistory: BenchmarkResult[];
  private qualityHistory: QualityGateResult[];
  private alerts: ValidationAlert[];
  private updateInterval: NodeJS.Timeout | null;
  private metricsRetentionDays: number;

  constructor(metricsRetentionDays: number = 30) {
    super();
    this.metricsRetentionDays = metricsRetentionDays;
    this.validationHistory = [];
    this.complianceHistory = [];
    this.performanceHistory = [];
    this.qualityHistory = [];
    this.alerts = [];
    this.updateInterval = null;
    
    this.metrics = this.initializeMetrics();
    this.startRealTimeUpdates();
  }

  /**
   * Get current dashboard metrics
   */
  getDashboardMetrics(): DashboardMetrics {
    return { ...this.metrics };
  }

  /**
   * Record validation result and update metrics
   */
  recordValidationResult(result: ValidationResult, context: ValidationContext): void {
    this.validationHistory.push(result);
    this.cleanupHistory();
    
    // Update validation summary metrics
    this.updateValidationSummary();
    
    // Update compliance metrics
    this.updateComplianceMetrics(result);
    
    // Generate alerts if needed
    this.checkForAlerts(result, context);
    
    // Update quality metrics
    this.updateQualityMetrics(result);
    
    // Emit real-time update event
    this.emit('metricsUpdated', {
      type: 'validation',
      result,
      metrics: this.metrics
    });
  }

  /**
   * Record compliance status and update metrics
   */
  recordComplianceStatus(status: ComplianceStatus, framework: string): void {
    this.complianceHistory.push(status);
    this.cleanupHistory();
    
    // Update compliance overview
    this.updateComplianceOverview(status, framework);
    
    // Check for compliance alerts
    this.checkComplianceAlerts(status, framework);
    
    this.emit('complianceUpdated', {
      framework,
      status,
      metrics: this.metrics.complianceOverview
    });
  }

  /**
   * Record performance benchmark and update metrics
   */
  recordPerformanceBenchmark(benchmark: BenchmarkResult): void {
    this.performanceHistory.push(benchmark);
    this.cleanupHistory();
    
    // Update performance trends
    this.updatePerformanceTrends(benchmark);
    
    // Check for performance alerts
    this.checkPerformanceAlerts(benchmark);
    
    this.emit('performanceUpdated', {
      benchmark,
      trends: this.metrics.performanceTrends
    });
  }

  /**
   * Record quality gate result and update metrics
   */
  recordQualityGateResult(result: QualityGateResult): void {
    this.qualityHistory.push(result);
    this.cleanupHistory();
    
    // Update quality metrics
    this.updateQualityOverview(result);
    
    this.emit('qualityUpdated', {
      result,
      metrics: this.metrics.qualityMetrics
    });
  }

  /**
   * Get validation trends for specified time period
   */
  getValidationTrends(hours: number = 24): ValidationTrend[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentValidations = this.validationHistory.filter(v => v.timestamp >= cutoff);
    
    // Group by hour and calculate trends
    const hourlyTrends = new Map<string, ValidationTrend>();
    
    for (const validation of recentValidations) {
      const hourKey = new Date(validation.timestamp.getFullYear(), 
                              validation.timestamp.getMonth(),
                              validation.timestamp.getDate(),
                              validation.timestamp.getHours()).toISOString();
      
      if (!hourlyTrends.has(hourKey)) {
        hourlyTrends.set(hourKey, {
          timestamp: new Date(hourKey),
          validationCount: 0,
          successRate: 0,
          averageScore: 0
        });
      }
      
      const trend = hourlyTrends.get(hourKey)!;
      trend.validationCount++;
      trend.averageScore += validation.qualityScore;
      
      if (validation.isValid) {
        trend.successRate++;
      }
    }
    
    // Calculate final averages
    for (const trend of hourlyTrends.values()) {
      trend.successRate = (trend.successRate / trend.validationCount) * 100;
      trend.averageScore = trend.averageScore / trend.validationCount;
    }
    
    return Array.from(hourlyTrends.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get compliance risk assessment
   */
  getComplianceRiskAssessment(): ComplianceRiskLevel {
    const criticalViolations = this.metrics.complianceOverview.criticalViolations;
    const totalViolations = this.metrics.complianceOverview.totalViolations;
    const complianceScore = this.metrics.complianceOverview.complianceScore;
    
    if (criticalViolations > 0 || complianceScore < 60) {
      return 'critical';
    } else if (totalViolations > 10 || complianceScore < 75) {
      return 'high';
    } else if (totalViolations > 5 || complianceScore < 85) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): ValidationAlert[] {
    return this.alerts.filter(alert => !alert.acknowledged);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alertAcknowledged', alert);
    }
  }

  /**
   * Generate validation report
   */
  generateValidationReport(timeframe: 'daily' | 'weekly' | 'monthly' = 'daily'): ValidationReport {
    const hours = timeframe === 'daily' ? 24 : timeframe === 'weekly' ? 168 : 720;
    const trends = this.getValidationTrends(hours);
    
    return {
      timeframe,
      generatedAt: new Date(),
      summary: this.metrics.validationSummary,
      compliance: this.metrics.complianceOverview,
      performance: this.metrics.performanceTrends,
      quality: this.metrics.qualityMetrics,
      trends,
      recommendations: this.generateRecommendations(),
      riskAssessment: this.getComplianceRiskAssessment()
    };
  }

  /**
   * Start real-time metrics updates
   */
  private startRealTimeUpdates(): void {
    this.updateInterval = setInterval(() => {
      this.updateSystemHealth();
      this.updateRealTimeMetrics();
      this.cleanupExpiredAlerts();
      
      this.emit('realTimeUpdate', this.metrics);
    }, 30000); // Update every 30 seconds
  }

  /**
   * Stop real-time updates
   */
  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.removeAllListeners();
  }

  /**
   * Initialize default metrics
   */
  private initializeMetrics(): DashboardMetrics {
    return {
      validationSummary: {
        totalValidations: 0,
        successfulValidations: 0,
        failedValidations: 0,
        averageValidationTime: 0,
        validationsPerHour: 0,
        currentSuccessRate: 100,
        trendsLast24h: []
      },
      complianceOverview: {
        frameworkCompliance: [],
        criticalViolations: 0,
        totalViolations: 0,
        complianceScore: 100,
        industryBenchmark: 85,
        complianceTrends: [],
        riskAssessment: 'low'
      },
      performanceTrends: {
        responseTimeP95: 0,
        responseTimeP99: 0,
        throughputTrend: [],
        memoryUsageTrend: [],
        errorRateTrend: [],
        scalabilityMetrics: {
          datasetSizeGrowth: [],
          performanceImpact: [],
          recommendedCapacity: 1000000,
          scalingAlerts: []
        }
      },
      qualityMetrics: {
        overallQualityScore: 100,
        ontologyCompleteness: 100,
        semanticConsistency: 100,
        dataQuality: 100,
        documentationCoverage: 100,
        qualityTrends: []
      },
      realTimeAlerts: [],
      systemHealth: {
        cpuUtilization: 0,
        memoryUtilization: 0,
        diskUsage: 0,
        networkLatency: 0,
        systemLoad: 0,
        uptime: process.uptime(),
        healthScore: 100,
        lastHealthCheck: new Date()
      }
    };
  }

  /**
   * Update validation summary metrics
   */
  private updateValidationSummary(): void {
    const summary = this.metrics.validationSummary;
    const recent24h = this.validationHistory.filter(v => 
      v.timestamp >= new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    
    summary.totalValidations = this.validationHistory.length;
    summary.successfulValidations = this.validationHistory.filter(v => v.isValid).length;
    summary.failedValidations = summary.totalValidations - summary.successfulValidations;
    summary.averageValidationTime = this.calculateAverageValidationTime();
    summary.validationsPerHour = recent24h.length / 24;
    summary.currentSuccessRate = summary.totalValidations > 0 
      ? (summary.successfulValidations / summary.totalValidations) * 100 
      : 100;
    summary.trendsLast24h = this.getValidationTrends(24);
  }

  /**
   * Update compliance metrics
   */
  private updateComplianceMetrics(result: ValidationResult): void {
    const overview = this.metrics.complianceOverview;
    
    // Count violations
    const criticalErrors = result.errors.filter(e => e.severity === 'critical');
    overview.criticalViolations += criticalErrors.length;
    overview.totalViolations += result.errors.length;
    
    // Update compliance score (weighted average)
    const currentWeight = this.validationHistory.length - 1;
    const newWeight = 1;
    overview.complianceScore = (overview.complianceScore * currentWeight + result.qualityScore * newWeight) / 
                              (currentWeight + newWeight);
    
    // Update risk assessment
    overview.riskAssessment = this.getComplianceRiskAssessment();
  }

  /**
   * Update performance trends
   */
  private updatePerformanceTrends(benchmark: BenchmarkResult): void {
    const trends = this.metrics.performanceTrends;
    
    // Update response time percentiles (simplified)
    trends.responseTimeP95 = benchmark.benchmarks.queryResponseTime.averageResponseTime * 1.2;
    trends.responseTimeP99 = benchmark.benchmarks.queryResponseTime.averageResponseTime * 1.5;
    
    // Update trend arrays (keep last 24 data points)
    trends.throughputTrend.push(benchmark.benchmarks.throughput.queryExecutionsPerSec);
    trends.memoryUsageTrend.push(benchmark.benchmarks.memoryEfficiency.memoryUsageMB);
    trends.errorRateTrend.push(benchmark.passed ? 0 : 1);
    
    // Keep only recent data points
    if (trends.throughputTrend.length > 24) trends.throughputTrend.shift();
    if (trends.memoryUsageTrend.length > 24) trends.memoryUsageTrend.shift();
    if (trends.errorRateTrend.length > 24) trends.errorRateTrend.shift();
  }

  /**
   * Update quality metrics
   */
  private updateQualityMetrics(result: ValidationResult): void {
    const quality = this.metrics.qualityMetrics;
    
    // Update overall quality score (running average)
    const count = this.validationHistory.length;
    quality.overallQualityScore = ((quality.overallQualityScore * (count - 1)) + result.qualityScore) / count;
    
    // Update trend data
    quality.qualityTrends.push({
      timestamp: result.timestamp,
      qualityScore: result.qualityScore,
      completenessScore: result.qualityScore, // Simplified
      consistencyScore: result.errors.length === 0 ? 100 : Math.max(0, 100 - result.errors.length * 10)
    });
    
    // Keep only recent trends
    if (quality.qualityTrends.length > 100) {
      quality.qualityTrends.shift();
    }
  }

  /**
   * Check for validation alerts
   */
  private checkForAlerts(result: ValidationResult, context: ValidationContext): void {
    // Critical validation failure
    if (!result.isValid && result.errors.some(e => e.severity === 'critical')) {
      this.addAlert({
        severity: 'critical',
        type: 'validation_failure',
        message: `Critical validation failure in ${context.domain} domain`,
        context: context.ontologyIri,
        actionRequired: 'Immediate review and remediation required'
      });
    }
    
    // Compliance violations
    const criticalViolations = result.errors.filter(e => 
      e.severity === 'critical' && e.complianceFramework
    );
    
    if (criticalViolations.length > 0) {
      this.addAlert({
        severity: 'high',
        type: 'compliance_violation',
        message: `${criticalViolations.length} critical compliance violations detected`,
        context: criticalViolations.map(v => v.complianceFramework).join(', '),
        actionRequired: 'Review compliance violations and implement fixes'
      });
    }
    
    // Performance degradation
    if (result.performanceMetrics.validationDurationMs > context.performanceThresholds.maxValidationTimeMs) {
      this.addAlert({
        severity: 'medium',
        type: 'performance_degradation',
        message: 'Validation performance below acceptable thresholds',
        context: 'Performance monitoring',
        actionRequired: 'Investigate performance bottlenecks'
      });
    }
  }

  /**
   * Check for compliance alerts
   */
  private checkComplianceAlerts(status: ComplianceStatus, framework: string): void {
    if (status.status === 'non-compliant' && status.criticalViolations.length > 0) {
      this.addAlert({
        severity: 'critical',
        type: 'compliance_violation',
        message: `${framework} compliance failure with ${status.criticalViolations.length} critical violations`,
        context: framework,
        actionRequired: 'Immediate compliance remediation required'
      });
    }
  }

  /**
   * Check for performance alerts
   */
  private checkPerformanceAlerts(benchmark: BenchmarkResult): void {
    if (!benchmark.passed) {
      this.addAlert({
        severity: 'high',
        type: 'performance_degradation',
        message: `Performance benchmark failure (score: ${benchmark.score.toFixed(1)})`,
        context: 'Performance benchmarking',
        actionRequired: 'Review performance recommendations and optimize system'
      });
    }
  }

  /**
   * Add new alert
   */
  private addAlert(alertData: Omit<ValidationAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    const alert: ValidationAlert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      acknowledged: false,
      ...alertData
    };
    
    this.alerts.push(alert);
    this.metrics.realTimeAlerts = this.getActiveAlerts();
    
    this.emit('newAlert', alert);
  }

  /**
   * Update system health metrics
   */
  private updateSystemHealth(): void {
    const health = this.metrics.systemHealth;
    const memoryUsage = process.memoryUsage();
    
    health.cpuUtilization = process.cpuUsage().user / 1000000; // Convert to seconds
    health.memoryUtilization = memoryUsage.heapUsed / memoryUsage.heapTotal;
    health.uptime = process.uptime();
    health.lastHealthCheck = new Date();
    
    // Calculate health score based on utilization
    let healthScore = 100;
    if (health.cpuUtilization > 0.8) healthScore -= 20;
    if (health.memoryUtilization > 0.9) healthScore -= 30;
    if (health.diskUsage > 0.9) healthScore -= 25;
    
    health.healthScore = Math.max(0, healthScore);
  }

  /**
   * Update real-time metrics
   */
  private updateRealTimeMetrics(): void {
    // Update active alerts
    this.metrics.realTimeAlerts = this.getActiveAlerts();
  }

  /**
   * Clean up old history data
   */
  private cleanupHistory(): void {
    const cutoff = new Date(Date.now() - this.metricsRetentionDays * 24 * 60 * 60 * 1000);
    
    this.validationHistory = this.validationHistory.filter(v => v.timestamp >= cutoff);
    this.performanceHistory = this.performanceHistory.filter(p => 
      new Date(Date.now()) >= cutoff // Simplified - would use actual timestamp
    );
  }

  /**
   * Clean up expired alerts
   */
  private cleanupExpiredAlerts(): void {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    this.alerts = this.alerts.filter(alert => alert.timestamp >= cutoff);
  }

  /**
   * Calculate average validation time
   */
  private calculateAverageValidationTime(): number {
    if (this.validationHistory.length === 0) return 0;
    
    const totalTime = this.validationHistory.reduce((sum, v) => 
      sum + v.performanceMetrics.validationDurationMs, 0
    );
    
    return totalTime / this.validationHistory.length;
  }

  /**
   * Update compliance overview
   */
  private updateComplianceOverview(status: ComplianceStatus, framework: string): void {
    const overview = this.metrics.complianceOverview;
    
    // Update or add framework compliance status
    const existingIndex = overview.frameworkCompliance.findIndex(f => f.framework === framework);
    
    const frameworkStatus: FrameworkComplianceStatus = {
      framework,
      status: status.status,
      score: this.calculateComplianceScore(status),
      violations: status.violationCount,
      lastChecked: new Date(),
      trend: this.calculateComplianceTrend(framework)
    };
    
    if (existingIndex >= 0) {
      overview.frameworkCompliance[existingIndex] = frameworkStatus;
    } else {
      overview.frameworkCompliance.push(frameworkStatus);
    }
    
    // Update compliance trends
    overview.complianceTrends.push({
      timestamp: new Date(),
      framework,
      complianceScore: frameworkStatus.score,
      violationCount: status.violationCount
    });
    
    // Keep only recent trends
    if (overview.complianceTrends.length > 100) {
      overview.complianceTrends.shift();
    }
  }

  /**
   * Update quality overview
   */
  private updateQualityOverview(result: QualityGateResult): void {
    const quality = this.metrics.qualityMetrics;
    
    // Update quality scores (simplified)
    quality.ontologyCompleteness = result.score;
    quality.semanticConsistency = result.violations.length === 0 ? 100 : Math.max(0, 100 - result.violations.length * 10);
    quality.dataQuality = result.score; // Simplified
    
    // Update overall quality score
    quality.overallQualityScore = (
      quality.ontologyCompleteness + 
      quality.semanticConsistency + 
      quality.dataQuality + 
      quality.documentationCoverage
    ) / 4;
  }

  /**
   * Calculate compliance score
   */
  private calculateComplianceScore(status: ComplianceStatus): number {
    if (status.status === 'compliant') return 100;
    if (status.status === 'non-compliant') return Math.max(0, 50 - status.violationCount * 5);
    if (status.status === 'partial') return Math.max(50, 75 - status.violationCount * 2);
    return 0; // unknown
  }

  /**
   * Calculate compliance trend
   */
  private calculateComplianceTrend(framework: string): 'improving' | 'stable' | 'declining' {
    const recentTrends = this.metrics.complianceOverview.complianceTrends
      .filter(t => t.framework === framework)
      .slice(-5); // Last 5 data points
    
    if (recentTrends.length < 2) return 'stable';
    
    const firstScore = recentTrends[0].complianceScore;
    const lastScore = recentTrends[recentTrends.length - 1].complianceScore;
    
    if (lastScore > firstScore + 5) return 'improving';
    if (lastScore < firstScore - 5) return 'declining';
    return 'stable';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.metrics.validationSummary.currentSuccessRate < 90) {
      recommendations.push('Validation success rate is below 90% - review failed validations and improve data quality');
    }
    
    if (this.metrics.complianceOverview.criticalViolations > 0) {
      recommendations.push('Critical compliance violations detected - immediate remediation required');
    }
    
    if (this.metrics.systemHealth.healthScore < 80) {
      recommendations.push('System health is degraded - review resource utilization and optimize performance');
    }
    
    return recommendations;
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}

interface ValidationReport {
  timeframe: 'daily' | 'weekly' | 'monthly';
  generatedAt: Date;
  summary: ValidationSummaryMetrics;
  compliance: ComplianceOverviewMetrics;
  performance: PerformanceTrendMetrics;
  quality: QualityMetricsOverview;
  trends: ValidationTrend[];
  recommendations: string[];
  riskAssessment: ComplianceRiskLevel;
}