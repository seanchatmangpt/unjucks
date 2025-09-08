// Context Analysis and Monitoring Utilities
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

interface ContextMetrics {
  totalTokens: number;
  usedTokens: number;
  efficiency: number;
  fragmentationRatio: number;
  agentDistribution: Record<string, number>;
  timestamp: string;
}

export class ContextAnalyzer {
  private readonly maxTokens: number = 200000; // Claude's context limit
  private metrics: ContextMetrics[] = [];

  async analyzeContext(conversationLog: string): Promise<ContextMetrics> {
    const tokens = this.estimateTokens(conversationLog);
    const agentDistribution = this.analyzeAgentDistribution(conversationLog);
    const fragmentation = this.calculateFragmentation(conversationLog);
    
    const metrics: ContextMetrics = {
      totalTokens: this.maxTokens,
      usedTokens: tokens,
      efficiency: (tokens / this.maxTokens) * 100,
      fragmentationRatio: fragmentation,
      agentDistribution,
      timestamp: new Date().toISOString()
    };

    this.metrics.push(metrics);
    await this.saveMetrics();
    
    return metrics;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private analyzeAgentDistribution(log: string): Record<string, number> {
    const agentPattern = /Task\("([^"]+)"/g;
    const distribution: Record<string, number> = {};
    let match;

    while ((match = agentPattern.exec(log)) !== null) {
      const agentType = match[1];
      distribution[agentType] = (distribution[agentType] || 0) + 1;
    }

    return distribution;
  }

  private calculateFragmentation(log: string): number {
    const messages = log.split('\n\n').length;
    const avgMessageLength = log.length / messages;
    const idealMessageLength = 1000; // Optimal message size
    
    return Math.abs(avgMessageLength - idealMessageLength) / idealMessageLength;
  }

  async saveMetrics(): Promise<void> {
    const metricsPath = join(process.cwd(), 'docs/book/appendices/toolkit/monitoring/context-metrics.json');
    await writeFile(metricsPath, JSON.stringify(this.metrics, null, 2));
  }

  getEfficiencyReport(): string {
    if (this.metrics.length === 0) return 'No metrics available';

    const latest = this.metrics[this.metrics.length - 1];
    const trend = this.calculateTrend();

    return `
Context Efficiency Report
========================
Current Usage: ${latest.usedTokens.toLocaleString()} / ${latest.totalTokens.toLocaleString()} tokens
Efficiency: ${latest.efficiency.toFixed(2)}%
Fragmentation: ${(latest.fragmentationRatio * 100).toFixed(2)}%
Trend: ${trend > 0 ? '📈' : '📉'} ${Math.abs(trend).toFixed(2)}%

Agent Distribution:
${Object.entries(latest.agentDistribution)
  .map(([agent, count]) => `  ${agent}: ${count} tasks`)
  .join('\n')}

Recommendations:
${this.generateRecommendations(latest)}
    `.trim();
  }

  private calculateTrend(): number {
    if (this.metrics.length < 2) return 0;
    
    const current = this.metrics[this.metrics.length - 1].efficiency;
    const previous = this.metrics[this.metrics.length - 2].efficiency;
    
    return current - previous;
  }

  private generateRecommendations(metrics: ContextMetrics): string {
    const recommendations: string[] = [];

    if (metrics.efficiency > 85) {
      recommendations.push('⚠️  High context usage - consider context pruning');
    }

    if (metrics.fragmentationRatio > 0.5) {
      recommendations.push('🔧 High fragmentation - batch related operations');
    }

    const totalAgents = Object.values(metrics.agentDistribution).reduce((a, b) => a + b, 0);
    if (totalAgents > 10) {
      recommendations.push('👥 Too many agents - consider agent consolidation');
    }

    return recommendations.length > 0 ? recommendations.join('\n') : '✅ Context usage is optimal';
  }
}

// CLI Usage
export async function runContextAnalysis(logFile?: string): Promise<void> {
  const analyzer = new ContextAnalyzer();
  
  if (logFile) {
    const log = await readFile(logFile, 'utf-8');
    const metrics = await analyzer.analyzeContext(log);
    console.log(analyzer.getEfficiencyReport());
  } else {
    console.log('Usage: npx tsx scripts/context-analyzer.ts <log-file>');
  }
}

if (require.main === module) {
  runContextAnalysis(process.argv[2]);
}