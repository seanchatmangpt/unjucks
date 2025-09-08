// Context Bundle System for State Transfer
import { createHash } from 'crypto';
import { gzip, ungzip } from 'zlib';
import { promisify } from 'util';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const gzipAsync = promisify(gzip);
const ungzipAsync = promisify(ungzip);

export interface ContextBundle {
  id: string;
  version: string;
  timestamp: string;
  phase: string;
  agents: AgentState[];
  memory: Record<string, any>;
  metrics: ContextMetrics;
  checksum: string;
  compressed: boolean;
}

export interface AgentState {
  id: string;
  type: string;
  status: 'active' | 'idle' | 'completed' | 'error';
  context: string;
  memory: Record<string, any>;
  metrics: {
    tokensUsed: number;
    executionTime: number;
    tasksCompleted: number;
  };
}

interface ContextMetrics {
  totalTokens: number;
  usedTokens: number;
  efficiency: number;
  fragmentationRatio: number;
  agentDistribution: Record<string, number>;
  timestamp: string;
}

export class ContextBundleGenerator {
  private bundles: Map<string, ContextBundle> = new Map();

  async createBundle(
    phase: string,
    agents: AgentState[],
    memory: Record<string, any>,
    options: { compress?: boolean } = {}
  ): Promise<string> {
    const bundleId = this.generateBundleId(phase);
    
    const bundle: ContextBundle = {
      id: bundleId,
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      phase,
      agents,
      memory,
      metrics: await this.calculateMetrics(agents),
      checksum: '',
      compressed: options.compress || false
    };

    // Generate checksum
    const bundleData = JSON.stringify({ ...bundle, checksum: '' });
    bundle.checksum = createHash('sha256').update(bundleData).digest('hex');

    // Compress if requested
    if (bundle.compressed) {
      const compressed = await gzipAsync(Buffer.from(JSON.stringify(bundle)));
      await this.saveBundle(bundleId, compressed);
    } else {
      await this.saveBundle(bundleId, Buffer.from(JSON.stringify(bundle, null, 2)));
    }

    this.bundles.set(bundleId, bundle);
    return bundleId;
  }

  async loadBundle(bundleId: string): Promise<ContextBundle> {
    const cached = this.bundles.get(bundleId);
    if (cached) return cached;

    try {
      const bundleData = await this.loadBundleData(bundleId);
      let bundle: ContextBundle;

      // Try to decompress first
      try {
        const decompressed = await ungzipAsync(bundleData);
        bundle = JSON.parse(decompressed.toString());
      } catch {
        // Not compressed, parse directly
        bundle = JSON.parse(bundleData.toString());
      }

      // Verify checksum
      const bundleForChecksum = JSON.stringify({ ...bundle, checksum: '' });
      const expectedChecksum = createHash('sha256').update(bundleForChecksum).digest('hex');
      
      if (bundle.checksum !== expectedChecksum) {
        throw new Error(`Bundle checksum mismatch for ${bundleId}`);
      }

      this.bundles.set(bundleId, bundle);
      return bundle;
    } catch (error) {
      throw new Error(`Failed to load bundle ${bundleId}: ${error}`);
    }
  }

  async transferState(fromBundleId: string, toBundleId: string, selective: string[] = []): Promise<void> {
    const sourceBundle = await this.loadBundle(fromBundleId);
    const targetBundle = await this.loadBundle(toBundleId);

    // Transfer memory selectively or completely
    if (selective.length > 0) {
      for (const key of selective) {
        if (sourceBundle.memory[key]) {
          targetBundle.memory[key] = sourceBundle.memory[key];
        }
      }
    } else {
      targetBundle.memory = { ...targetBundle.memory, ...sourceBundle.memory };
    }

    // Update metrics
    targetBundle.metrics = await this.calculateMetrics(targetBundle.agents);
    
    // Save updated bundle
    await this.createBundle(
      targetBundle.phase,
      targetBundle.agents,
      targetBundle.memory,
      { compress: targetBundle.compressed }
    );
  }

  async createSnapshotBundle(currentAgents: AgentState[], phase: string): Promise<string> {
    const memory = await this.collectAgentMemory(currentAgents);
    
    return this.createBundle(phase, currentAgents, memory, { compress: true });
  }

  private generateBundleId(phase: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `bundle-${phase}-${timestamp}-${random}`;
  }

  private async calculateMetrics(agents: AgentState[]): Promise<ContextMetrics> {
    const totalTokens = agents.reduce((sum, agent) => sum + agent.metrics.tokensUsed, 0);
    const totalTasks = agents.reduce((sum, agent) => sum + agent.metrics.tasksCompleted, 0);
    const avgExecutionTime = agents.reduce((sum, agent) => sum + agent.metrics.executionTime, 0) / agents.length;

    return {
      totalTokens: 200000, // Claude's limit
      usedTokens: totalTokens,
      efficiency: (totalTokens / 200000) * 100,
      fragmentationRatio: this.calculateFragmentation(agents),
      agentDistribution: this.getAgentDistribution(agents),
      timestamp: new Date().toISOString()
    };
  }

  private calculateFragmentation(agents: AgentState[]): number {
    const contexts = agents.map(a => a.context);
    const totalLength = contexts.join('').length;
    const avgLength = totalLength / contexts.length;
    const idealLength = 5000; // Optimal context size per agent
    
    return Math.abs(avgLength - idealLength) / idealLength;
  }

  private getAgentDistribution(agents: AgentState[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const agent of agents) {
      distribution[agent.type] = (distribution[agent.type] || 0) + 1;
    }
    
    return distribution;
  }

  private async collectAgentMemory(agents: AgentState[]): Promise<Record<string, any>> {
    const memory: Record<string, any> = {};
    
    for (const agent of agents) {
      memory[`agent-${agent.id}`] = agent.memory;
    }
    
    return memory;
  }

  private async saveBundle(bundleId: string, data: Buffer): Promise<void> {
    const bundlePath = join(process.cwd(), 'docs/book/appendices/toolkit/bundles', `${bundleId}.bundle`);
    await writeFile(bundlePath, data);
  }

  private async loadBundleData(bundleId: string): Promise<Buffer> {
    const bundlePath = join(process.cwd(), 'docs/book/appendices/toolkit/bundles', `${bundleId}.bundle`);
    return await readFile(bundlePath);
  }

  getBundleReport(): string {
    const bundles = Array.from(this.bundles.values());
    
    return `
Context Bundle Report  
====================
Total Bundles: ${bundles.length}
Storage Usage: ${this.calculateStorageUsage()} MB

Bundle Overview:
${bundles.map(bundle => `
  ID: ${bundle.id}
  Phase: ${bundle.phase}  
  Agents: ${bundle.agents.length}
  Efficiency: ${bundle.metrics.efficiency.toFixed(1)}%
  Size: ${bundle.compressed ? 'Compressed' : 'Uncompressed'}
  Created: ${new Date(bundle.timestamp).toLocaleDateString()}
`).join('')}

Recommendations:
${this.generateBundleRecommendations(bundles)}
    `.trim();
  }

  private calculateStorageUsage(): number {
    // Estimate storage usage
    return Array.from(this.bundles.values()).length * 0.5; // ~500KB per bundle estimate
  }

  private generateBundleRecommendations(bundles: ContextBundle[]): string {
    const recommendations: string[] = [];
    
    if (bundles.length > 20) {
      recommendations.push('📦 Consider archiving old bundles');
    }
    
    const uncompressed = bundles.filter(b => !b.compressed).length;
    if (uncompressed > 5) {
      recommendations.push('🗜️  Enable compression for storage efficiency');
    }
    
    const lowEfficiency = bundles.filter(b => b.metrics.efficiency < 50).length;
    if (lowEfficiency > 0) {
      recommendations.push(`⚡ ${lowEfficiency} bundles have low context efficiency`);
    }
    
    return recommendations.length > 0 ? recommendations.join('\n') : '✅ Bundle management is optimal';
  }
}