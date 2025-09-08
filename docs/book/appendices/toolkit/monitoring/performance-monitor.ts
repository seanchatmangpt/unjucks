// Real-time Performance Monitoring for AI Swarms
import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  timestamp: number;
  agentId: string;
  contextUsage: number;
  responseTime: number;
  tokenEfficiency: number;
  memoryUsage: number;
  taskThroughput: number;
  errorRate: number;
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private alerts: Array<{ timestamp: number; message: string; severity: 'low' | 'medium' | 'high' }> = [];
  private thresholds = {
    contextUsage: 0.85,      // 85% context usage
    responseTime: 30000,     // 30 seconds
    tokenEfficiency: 0.60,   // 60% token efficiency
    memoryUsage: 0.80,       // 80% memory usage
    errorRate: 0.05          // 5% error rate
  };

  recordMetrics(agentId: string, metrics: Partial<PerformanceMetrics>): void {
    const fullMetrics: PerformanceMetrics = {
      timestamp: Date.now(),
      agentId,
      contextUsage: 0,
      responseTime: 0,
      tokenEfficiency: 0,
      memoryUsage: 0,
      taskThroughput: 0,
      errorRate: 0,
      ...metrics
    };

    if (!this.metrics.has(agentId)) {
      this.metrics.set(agentId, []);
    }

    this.metrics.get(agentId)!.push(fullMetrics);

    // Keep only last 1000 metrics per agent
    const agentMetrics = this.metrics.get(agentId)!;
    if (agentMetrics.length > 1000) {
      agentMetrics.splice(0, agentMetrics.length - 1000);
    }

    this.checkThresholds(fullMetrics);
    this.emit('metrics', fullMetrics);
  }

  private checkThresholds(metrics: PerformanceMetrics): void {
    const alerts: Array<{ message: string; severity: 'low' | 'medium' | 'high' }> = [];

    if (metrics.contextUsage > this.thresholds.contextUsage) {
      alerts.push({
        message: `High context usage: ${metrics.agentId} at ${(metrics.contextUsage * 100).toFixed(1)}%`,
        severity: 'high'
      });
    }

    if (metrics.responseTime > this.thresholds.responseTime) {
      alerts.push({
        message: `Slow response: ${metrics.agentId} took ${(metrics.responseTime / 1000).toFixed(1)}s`,
        severity: 'medium'
      });
    }

    if (metrics.tokenEfficiency < this.thresholds.tokenEfficiency) {
      alerts.push({
        message: `Low token efficiency: ${metrics.agentId} at ${(metrics.tokenEfficiency * 100).toFixed(1)}%`,
        severity: 'medium'
      });
    }

    if (metrics.errorRate > this.thresholds.errorRate) {
      alerts.push({
        message: `High error rate: ${metrics.agentId} at ${(metrics.errorRate * 100).toFixed(1)}%`,
        severity: 'high'
      });
    }

    alerts.forEach(alert => {
      this.alerts.push({
        timestamp: Date.now(),
        ...alert
      });
      this.emit('alert', alert);
    });

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.splice(0, this.alerts.length - 100);
    }
  }

  generateDashboard(): string {
    const activeAgents = this.metrics.size;
    const totalMetrics = Array.from(this.metrics.values()).reduce((sum, arr) => sum + arr.length, 0);
    const recentAlerts = this.alerts.filter(a => Date.now() - a.timestamp < 300000); // Last 5 minutes

    // Calculate averages
    const allRecentMetrics = Array.from(this.metrics.values())
      .flat()
      .filter(m => Date.now() - m.timestamp < 300000);

    const avgContextUsage = allRecentMetrics.length > 0 
      ? allRecentMetrics.reduce((sum, m) => sum + m.contextUsage, 0) / allRecentMetrics.length
      : 0;

    const avgResponseTime = allRecentMetrics.length > 0
      ? allRecentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / allRecentMetrics.length
      : 0;

    const avgTokenEfficiency = allRecentMetrics.length > 0
      ? allRecentMetrics.reduce((sum, m) => sum + m.tokenEfficiency, 0) / allRecentMetrics.length
      : 0;

    return `
┌─ AI Swarm Performance Dashboard ─────────────────────────┐
│                                                          │
│ 🤖 Active Agents: ${activeAgents.toString().padStart(8)}                             │
│ 📊 Total Metrics: ${totalMetrics.toString().padStart(8)}                            │  
│ ⚠️  Recent Alerts: ${recentAlerts.length.toString().padStart(7)}                             │
│                                                          │
│ ── Performance Averages (Last 5min) ──                  │
│ 🧠 Context Usage: ${(avgContextUsage * 100).toFixed(1).padStart(8)}%                       │
│ ⏱️  Response Time: ${(avgResponseTime / 1000).toFixed(1).padStart(7)}s                       │
│ 🎯 Token Efficiency: ${(avgTokenEfficiency * 100).toFixed(1).padStart(5)}%                  │
│                                                          │
│ ── Agent Status ──                                       │
${this.generateAgentStatusTable()}
│                                                          │
│ ── Recent Alerts ──                                      │
${this.generateAlertsTable(recentAlerts.slice(-5))}
│                                                          │
│ Last Updated: ${new Date().toLocaleTimeString()}                           │
└──────────────────────────────────────────────────────────┘

Performance Trends:
${this.generateTrendAnalysis()}

Recommendations:
${this.generateRecommendations()}
    `.trim();
  }

  private generateAgentStatusTable(): string {
    const agents = Array.from(this.metrics.entries())
      .map(([agentId, metrics]) => {
        const recent = metrics.slice(-1)[0];
        return {
          id: agentId.substring(0, 12) + (agentId.length > 12 ? '...' : ''),
          context: (recent?.contextUsage * 100 || 0).toFixed(0) + '%',
          response: (recent?.responseTime / 1000 || 0).toFixed(1) + 's',
          efficiency: (recent?.tokenEfficiency * 100 || 0).toFixed(0) + '%'
        };
      })
      .slice(0, 5); // Show top 5 agents

    if (agents.length === 0) {
      return '│ No active agents                                         │';
    }

    return agents.map(agent => 
      `│ ${agent.id.padEnd(15)} ${agent.context.padStart(5)} ${agent.response.padStart(6)} ${agent.efficiency.padStart(5)} │`
    ).join('\n');
  }

  private generateAlertsTable(alerts: typeof this.alerts): string {
    if (alerts.length === 0) {
      return '│ No recent alerts ✅                                      │';
    }

    return alerts.map(alert => {
      const time = new Date(alert.timestamp).toLocaleTimeString();
      const severity = alert.severity === 'high' ? '🔴' : alert.severity === 'medium' ? '🟡' : '🟢';
      const message = alert.message.substring(0, 40) + (alert.message.length > 40 ? '...' : '');
      return `│ ${severity} ${time} ${message.padEnd(40)} │`;
    }).join('\n');
  }

  private generateTrendAnalysis(): string {
    const trends: string[] = [];
    
    // Calculate trend over last hour vs previous hour
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const twoHoursAgo = now - 7200000;

    const recentMetrics = Array.from(this.metrics.values()).flat()
      .filter(m => m.timestamp > oneHourAgo);
    
    const previousMetrics = Array.from(this.metrics.values()).flat()
      .filter(m => m.timestamp > twoHoursAgo && m.timestamp <= oneHourAgo);

    if (recentMetrics.length > 0 && previousMetrics.length > 0) {
      const recentAvgContext = recentMetrics.reduce((s, m) => s + m.contextUsage, 0) / recentMetrics.length;
      const previousAvgContext = previousMetrics.reduce((s, m) => s + m.contextUsage, 0) / previousMetrics.length;
      const contextTrend = ((recentAvgContext - previousAvgContext) / previousAvgContext) * 100;

      trends.push(`📈 Context Usage: ${contextTrend > 0 ? '+' : ''}${contextTrend.toFixed(1)}%`);
    }

    return trends.length > 0 ? trends.join('\n') : 'Insufficient data for trend analysis';
  }

  private generateRecommendations(): string {
    const recommendations: string[] = [];
    const allRecentMetrics = Array.from(this.metrics.values())
      .flat()
      .filter(m => Date.now() - m.timestamp < 300000);

    if (allRecentMetrics.length === 0) {
      return 'No recent activity to analyze';
    }

    const avgContextUsage = allRecentMetrics.reduce((sum, m) => sum + m.contextUsage, 0) / allRecentMetrics.length;
    const avgTokenEfficiency = allRecentMetrics.reduce((sum, m) => sum + m.tokenEfficiency, 0) / allRecentMetrics.length;
    const avgResponseTime = allRecentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / allRecentMetrics.length;

    if (avgContextUsage > 0.8) {
      recommendations.push('🧠 Consider context pruning or agent consolidation');
    }

    if (avgTokenEfficiency < 0.6) {
      recommendations.push('🎯 Optimize prompts and reduce token waste');
    }

    if (avgResponseTime > 20000) {
      recommendations.push('⚡ Investigate performance bottlenecks');
    }

    const highErrorAgents = Array.from(this.metrics.entries())
      .filter(([, metrics]) => {
        const recent = metrics.slice(-5);
        const avgErrorRate = recent.reduce((s, m) => s + m.errorRate, 0) / recent.length;
        return avgErrorRate > 0.1;
      });

    if (highErrorAgents.length > 0) {
      recommendations.push(`🚨 ${highErrorAgents.length} agents have high error rates`);
    }

    return recommendations.length > 0 ? recommendations.join('\n') : '✅ Performance is optimal';
  }

  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    const allMetrics = Array.from(this.metrics.entries())
      .flatMap(([agentId, metrics]) => 
        metrics.map(m => ({ ...m, agentId }))
      );

    if (format === 'csv') {
      const headers = ['timestamp', 'agentId', 'contextUsage', 'responseTime', 'tokenEfficiency', 'memoryUsage', 'taskThroughput', 'errorRate'];
      const csv = [
        headers.join(','),
        ...allMetrics.map(m => headers.map(h => m[h as keyof PerformanceMetrics]).join(','))
      ].join('\n');
      return csv;
    }

    return JSON.stringify({
      exportTime: new Date().toISOString(),
      totalMetrics: allMetrics.length,
      metrics: allMetrics,
      alerts: this.alerts
    }, null, 2);
  }
}