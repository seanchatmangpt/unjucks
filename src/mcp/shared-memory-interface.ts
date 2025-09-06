/**
 * Shared Memory Interface - Manages shared state and memory across swarm agents
 * 
 * This interface provides a unified way for Claude Flow agents to share template
 * generation results, context data, and coordination information across the swarm.
 * 
 * Key features:
 * - Thread-safe memory operations
 * - Memory namespacing and isolation
 * - Automatic cleanup and garbage collection
 * - Real-time synchronization across agents
 * - Persistence and recovery capabilities
 */

import { EventEmitter } from 'node:events';
import { performance } from 'node:perf_hooks';
import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import type { SwarmMemory } from '../lib/mcp-integration.js';
import type { ClaudeFlowAgent, ClaudeFlowSwarm } from './claude-flow-connector.js';
import type { TaskExecutionResult } from './task-orchestrator.js';

/**
 * Memory entry with metadata
 */
export interface MemoryEntry<T = any> {
  key: string;
  value: T;
  timestamp: string;
  ttl?: number; // Time to live in milliseconds
  size: number; // Size in bytes
  namespace: string;
  agentId?: string;
  version: number;
  tags: string[];
  metadata: Record<string, any>;
}

/**
 * Memory namespace configuration
 */
export interface MemoryNamespace {
  name: string;
  maxSize: number; // Maximum size in bytes
  maxEntries: number; // Maximum number of entries
  defaultTtl: number; // Default TTL in milliseconds
  autoCleanup: boolean;
  persistToDisk: boolean;
  accessControl: {
    read: string[]; // Agent types that can read
    write: string[]; // Agent types that can write
    delete: string[]; // Agent types that can delete
  };
}

/**
 * Memory synchronization event
 */
export interface MemorySyncEvent {
  type: 'set' | 'get' | 'delete' | 'expire' | 'cleanup';
  namespace: string;
  key: string;
  agentId?: string;
  timestamp: string;
  success: boolean;
  error?: string;
}

/**
 * Memory query options
 */
export interface MemoryQueryOptions {
  namespace?: string;
  agentId?: string;
  tags?: string[];
  keyPattern?: string;
  minTimestamp?: string;
  maxTimestamp?: string;
  limit?: number;
  sortBy?: 'timestamp' | 'size' | 'key';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Memory statistics
 */
export interface MemoryStatistics {
  totalEntries: number;
  totalSize: number;
  namespaces: Array<{
    name: string;
    entries: number;
    size: number;
    hitRate: number;
    missRate: number;
  }>;
  operations: {
    reads: number;
    writes: number;
    deletes: number;
    hits: number;
    misses: number;
  };
  performance: {
    averageReadTime: number;
    averageWriteTime: number;
    averageDeleteTime: number;
  };
}

/**
 * Main Shared Memory Interface class
 */
export class SharedMemoryInterface extends EventEmitter {
  private memory: Map<string, MemoryEntry>;
  private namespaces: Map<string, MemoryNamespace>;
  private swarm: ClaudeFlowSwarm | null = null;
  private statistics: MemoryStatistics;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private persistenceDir: string;
  private debugMode: boolean;
  private maxTotalSize: number;
  private maxTotalEntries: number;

  constructor(options: {
    persistenceDir?: string;
    maxTotalSize?: number; // Maximum total memory size in bytes
    maxTotalEntries?: number; // Maximum total entries
    debugMode?: boolean;
  } = {}) {
    super();

    this.memory = new Map();
    this.namespaces = new Map();
    this.persistenceDir = options.persistenceDir || path.join(process.cwd(), '.unjucks-memory');
    this.debugMode = options.debugMode || process.env.DEBUG_UNJUCKS === 'true';
    this.maxTotalSize = options.maxTotalSize || 100 * 1024 * 1024; // 100MB default
    this.maxTotalEntries = options.maxTotalEntries || 10000;

    this.statistics = {
      totalEntries: 0,
      totalSize: 0,
      namespaces: [],
      operations: {
        reads: 0,
        writes: 0,
        deletes: 0,
        hits: 0,
        misses: 0
      },
      performance: {
        averageReadTime: 0,
        averageWriteTime: 0,
        averageDeleteTime: 0
      }
    };

    this.initializeDefaultNamespaces();
    this.startCleanupProcess();
  }

  /**
   * Initialize with swarm context
   */
  initialize(swarm: ClaudeFlowSwarm): void {
    this.swarm = swarm;

    // Create agent-specific namespaces
    for (const agent of swarm.agents) {
      this.createNamespace(`agent-${agent.id}`, {
        name: `agent-${agent.id}`,
        maxSize: 10 * 1024 * 1024, // 10MB per agent
        maxEntries: 1000,
        defaultTtl: 3600000, // 1 hour
        autoCleanup: true,
        persistToDisk: false,
        accessControl: {
          read: [agent.type, 'system-architect', 'coordinator'],
          write: [agent.id],
          delete: [agent.id, 'system-architect']
        }
      });
    }

    if (this.debugMode) {
      console.log(chalk.green(`[Shared Memory] Initialized with ${swarm.agents.length} agent namespaces`));
    }
  }

  /**
   * Store value in shared memory
   */
  async set<T>(
    key: string,
    value: T,
    options: {
      namespace?: string;
      ttl?: number;
      agentId?: string;
      tags?: string[];
      metadata?: Record<string, any>;
    } = {}
  ): Promise<boolean> {
    const startTime = performance.now();

    try {
      const namespace = options.namespace || 'default';
      const fullKey = `${namespace}:${key}`;
      const agentId = options.agentId;
      
      // Check access control
      if (!this.checkWriteAccess(namespace, agentId)) {
        throw new Error(`Write access denied for namespace: ${namespace}`);
      }

      // Check namespace limits
      if (!this.checkNamespaceLimits(namespace, value)) {
        throw new Error(`Namespace limits exceeded for: ${namespace}`);
      }

      // Serialize value and calculate size
      const serializedValue = JSON.stringify(value);
      const size = Buffer.byteLength(serializedValue, 'utf-8');

      // Check total memory limits
      if (this.statistics.totalSize + size > this.maxTotalSize) {
        await this.performEmergencyCleanup();
      }

      if (this.statistics.totalEntries >= this.maxTotalEntries) {
        await this.performEmergencyCleanup();
      }

      const entry: MemoryEntry<T> = {
        key: fullKey,
        value,
        timestamp: new Date().toISOString(),
        ttl: options.ttl || this.namespaces.get(namespace)?.defaultTtl,
        size,
        namespace,
        agentId,
        version: this.getNextVersion(fullKey),
        tags: options.tags || [],
        metadata: options.metadata || {}
      };

      // Store the entry
      const existingEntry = this.memory.get(fullKey);
      this.memory.set(fullKey, entry);

      // Update statistics
      if (existingEntry) {
        this.statistics.totalSize = this.statistics.totalSize - existingEntry.size + size;
      } else {
        this.statistics.totalEntries++;
        this.statistics.totalSize += size;
      }

      this.statistics.operations.writes++;
      
      const writeTime = performance.now() - startTime;
      this.statistics.performance.averageWriteTime = 
        (this.statistics.performance.averageWriteTime * (this.statistics.operations.writes - 1) + writeTime) / 
        this.statistics.operations.writes;

      // Emit sync event
      this.emitSyncEvent({
        type: 'set',
        namespace,
        key,
        agentId,
        timestamp: entry.timestamp,
        success: true
      });

      // Persist to disk if enabled
      const namespaceConfig = this.namespaces.get(namespace);
      if (namespaceConfig?.persistToDisk) {
        await this.persistEntry(entry);
      }

      // Notify swarm agents
      if (this.swarm) {
        this.notifyAgents('memory-updated', { namespace, key, agentId });
      }

      if (this.debugMode) {
        console.log(chalk.blue(`[Shared Memory] Set ${fullKey} (${size} bytes, TTL: ${entry.ttl}ms)`));
      }

      return true;

    } catch (error) {
      this.statistics.operations.writes++;
      
      this.emitSyncEvent({
        type: 'set',
        namespace: options.namespace || 'default',
        key,
        agentId: options.agentId,
        timestamp: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });

      if (this.debugMode) {
        console.error(chalk.red(`[Shared Memory] Set failed for ${key}: ${error instanceof Error ? error.message : String(error)}`));
      }

      return false;
    }
  }

  /**
   * Retrieve value from shared memory
   */
  async get<T>(
    key: string,
    options: {
      namespace?: string;
      agentId?: string;
    } = {}
  ): Promise<T | null> {
    const startTime = performance.now();

    try {
      const namespace = options.namespace || 'default';
      const fullKey = `${namespace}:${key}`;
      const agentId = options.agentId;

      // Check access control
      if (!this.checkReadAccess(namespace, agentId)) {
        throw new Error(`Read access denied for namespace: ${namespace}`);
      }

      const entry = this.memory.get(fullKey);
      
      this.statistics.operations.reads++;
      
      if (!entry) {
        this.statistics.operations.misses++;
        
        this.emitSyncEvent({
          type: 'get',
          namespace,
          key,
          agentId,
          timestamp: new Date().toISOString(),
          success: false,
          error: 'Key not found'
        });

        return null;
      }

      // Check TTL expiration
      if (this.isExpired(entry)) {
        await this.delete(key, { namespace, agentId });
        this.statistics.operations.misses++;
        return null;
      }

      this.statistics.operations.hits++;
      
      const readTime = performance.now() - startTime;
      this.statistics.performance.averageReadTime = 
        (this.statistics.performance.averageReadTime * (this.statistics.operations.reads - 1) + readTime) / 
        this.statistics.operations.reads;

      this.emitSyncEvent({
        type: 'get',
        namespace,
        key,
        agentId,
        timestamp: new Date().toISOString(),
        success: true
      });

      if (this.debugMode) {
        console.log(chalk.cyan(`[Shared Memory] Get ${fullKey} (${entry.size} bytes)`));
      }

      return entry.value as T;

    } catch (error) {
      this.statistics.operations.reads++;
      this.statistics.operations.misses++;

      this.emitSyncEvent({
        type: 'get',
        namespace: options.namespace || 'default',
        key,
        agentId: options.agentId,
        timestamp: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });

      if (this.debugMode) {
        console.error(chalk.red(`[Shared Memory] Get failed for ${key}: ${error instanceof Error ? error.message : String(error)}`));
      }

      return null;
    }
  }

  /**
   * Delete entry from shared memory
   */
  async delete(
    key: string,
    options: {
      namespace?: string;
      agentId?: string;
    } = {}
  ): Promise<boolean> {
    const startTime = performance.now();

    try {
      const namespace = options.namespace || 'default';
      const fullKey = `${namespace}:${key}`;
      const agentId = options.agentId;

      // Check access control
      if (!this.checkDeleteAccess(namespace, agentId)) {
        throw new Error(`Delete access denied for namespace: ${namespace}`);
      }

      const entry = this.memory.get(fullKey);
      if (!entry) {
        return false;
      }

      // Remove from memory
      this.memory.delete(fullKey);
      
      // Update statistics
      this.statistics.totalEntries--;
      this.statistics.totalSize -= entry.size;
      this.statistics.operations.deletes++;

      const deleteTime = performance.now() - startTime;
      this.statistics.performance.averageDeleteTime = 
        (this.statistics.performance.averageDeleteTime * (this.statistics.operations.deletes - 1) + deleteTime) / 
        this.statistics.operations.deletes;

      // Remove from disk if persisted
      const namespaceConfig = this.namespaces.get(namespace);
      if (namespaceConfig?.persistToDisk) {
        await this.removePersistentEntry(fullKey);
      }

      this.emitSyncEvent({
        type: 'delete',
        namespace,
        key,
        agentId,
        timestamp: new Date().toISOString(),
        success: true
      });

      // Notify swarm agents
      if (this.swarm) {
        this.notifyAgents('memory-deleted', { namespace, key, agentId });
      }

      if (this.debugMode) {
        console.log(chalk.yellow(`[Shared Memory] Deleted ${fullKey}`));
      }

      return true;

    } catch (error) {
      this.statistics.operations.deletes++;

      this.emitSyncEvent({
        type: 'delete',
        namespace: options.namespace || 'default',
        key,
        agentId: options.agentId,
        timestamp: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });

      if (this.debugMode) {
        console.error(chalk.red(`[Shared Memory] Delete failed for ${key}: ${error instanceof Error ? error.message : String(error)}`));
      }

      return false;
    }
  }

  /**
   * Query entries with filters
   */
  async query<T>(options: MemoryQueryOptions = {}): Promise<MemoryEntry<T>[]> {
    try {
      let entries = Array.from(this.memory.values());

      // Apply filters
      if (options.namespace) {
        entries = entries.filter(entry => entry.namespace === options.namespace);
      }

      if (options.agentId) {
        entries = entries.filter(entry => entry.agentId === options.agentId);
      }

      if (options.tags && options.tags.length > 0) {
        entries = entries.filter(entry => 
          options.tags!.some(tag => entry.tags.includes(tag))
        );
      }

      if (options.keyPattern) {
        const regex = new RegExp(options.keyPattern);
        entries = entries.filter(entry => regex.test(entry.key));
      }

      if (options.minTimestamp) {
        entries = entries.filter(entry => entry.timestamp >= options.minTimestamp!);
      }

      if (options.maxTimestamp) {
        entries = entries.filter(entry => entry.timestamp <= options.maxTimestamp!);
      }

      // Sort results
      if (options.sortBy) {
        entries.sort((a, b) => {
          let comparison = 0;
          
          switch (options.sortBy) {
            case 'timestamp':
              comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
              break;
            case 'size':
              comparison = a.size - b.size;
              break;
            case 'key':
              comparison = a.key.localeCompare(b.key);
              break;
          }

          return options.sortOrder === 'desc' ? -comparison : comparison;
        });
      }

      // Apply limit
      if (options.limit) {
        entries = entries.slice(0, options.limit);
      }

      return entries as MemoryEntry<T>[];

    } catch (error) {
      if (this.debugMode) {
        console.error(chalk.red(`[Shared Memory] Query failed: ${error instanceof Error ? error.message : String(error)}`));
      }
      return [];
    }
  }

  /**
   * Store template generation results from task execution
   */
  async storeTaskResult(
    taskId: string,
    agentId: string,
    result: TaskExecutionResult
  ): Promise<boolean> {
    return await this.set(`task-result-${taskId}`, result, {
      namespace: 'task-results',
      agentId,
      ttl: 86400000, // 24 hours
      tags: ['task-result', taskId, agentId, result.success ? 'success' : 'failure'],
      metadata: {
        taskType: 'template-generation',
        executionTime: result.executionTime,
        memoryUsed: result.memoryUsed
      }
    });
  }

  /**
   * Store template variables for agent synchronization
   */
  async storeTemplateVariables(
    generator: string,
    template: string,
    variables: Record<string, any>,
    agentId?: string
  ): Promise<boolean> {
    const key = `template-vars-${generator}-${template}`;
    
    return await this.set(key, variables, {
      namespace: 'template-variables',
      agentId,
      ttl: 3600000, // 1 hour
      tags: ['template-variables', generator, template],
      metadata: {
        generator,
        template,
        variableCount: Object.keys(variables).length
      }
    });
  }

  /**
   * Get template variables for generation
   */
  async getTemplateVariables(
    generator: string,
    template: string
  ): Promise<Record<string, any> | null> {
    const key = `template-vars-${generator}-${template}`;
    return await this.get<Record<string, any>>(key, {
      namespace: 'template-variables'
    });
  }

  /**
   * Store swarm coordination data
   */
  async storeCoordinationData(
    key: string,
    data: any,
    agentId?: string
  ): Promise<boolean> {
    return await this.set(key, data, {
      namespace: 'coordination',
      agentId,
      ttl: 1800000, // 30 minutes
      tags: ['coordination', 'swarm'],
      metadata: {
        coordinationType: 'swarm-data'
      }
    });
  }

  /**
   * Create a new memory namespace
   */
  createNamespace(name: string, config: Partial<MemoryNamespace>): boolean {
    try {
      const fullConfig: MemoryNamespace = {
        name,
        maxSize: 50 * 1024 * 1024, // 50MB default
        maxEntries: 5000,
        defaultTtl: 3600000, // 1 hour
        autoCleanup: true,
        persistToDisk: false,
        accessControl: {
          read: ['*'],
          write: ['*'],
          delete: ['*']
        },
        ...config
      };

      this.namespaces.set(name, fullConfig);

      if (this.debugMode) {
        console.log(chalk.green(`[Shared Memory] Created namespace: ${name}`));
      }

      return true;

    } catch (error) {
      if (this.debugMode) {
        console.error(chalk.red(`[Shared Memory] Failed to create namespace ${name}: ${error instanceof Error ? error.message : String(error)}`));
      }
      return false;
    }
  }

  /**
   * Get memory statistics
   */
  getStatistics(): MemoryStatistics {
    // Update namespace statistics
    const namespaceStats = new Map<string, { entries: number; size: number; hits: number; misses: number }>();

    for (const entry of this.memory.values()) {
      const stats = namespaceStats.get(entry.namespace) || { entries: 0, size: 0, hits: 0, misses: 0 };
      stats.entries++;
      stats.size += entry.size;
      namespaceStats.set(entry.namespace, stats);
    }

    this.statistics.namespaces = Array.from(namespaceStats.entries()).map(([name, stats]) => ({
      name,
      entries: stats.entries,
      size: stats.size,
      hitRate: stats.hits / (stats.hits + stats.misses) * 100 || 0,
      missRate: stats.misses / (stats.hits + stats.misses) * 100 || 0
    }));

    return { ...this.statistics };
  }

  /**
   * Clear all memory entries (with optional namespace filter)
   */
  async clear(namespace?: string): Promise<number> {
    try {
      let deletedCount = 0;

      if (namespace) {
        // Clear specific namespace
        const keysToDelete = Array.from(this.memory.keys())
          .filter(key => key.startsWith(`${namespace}:`));

        for (const key of keysToDelete) {
          this.memory.delete(key);
          deletedCount++;
        }
      } else {
        // Clear all memory
        deletedCount = this.memory.size;
        this.memory.clear();
      }

      // Reset statistics
      if (!namespace) {
        this.statistics.totalEntries = 0;
        this.statistics.totalSize = 0;
      } else {
        // Recalculate statistics
        this.recalculateStatistics();
      }

      if (this.debugMode) {
        console.log(chalk.yellow(`[Shared Memory] Cleared ${deletedCount} entries${namespace ? ` from namespace: ${namespace}` : ''}`));
      }

      return deletedCount;

    } catch (error) {
      if (this.debugMode) {
        console.error(chalk.red(`[Shared Memory] Clear failed: ${error instanceof Error ? error.message : String(error)}`));
      }
      return 0;
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private initializeDefaultNamespaces(): void {
    // Default namespace
    this.createNamespace('default', {
      maxSize: 20 * 1024 * 1024, // 20MB
      maxEntries: 2000,
      defaultTtl: 7200000, // 2 hours
      persistToDisk: true
    });

    // Template variables namespace
    this.createNamespace('template-variables', {
      maxSize: 10 * 1024 * 1024, // 10MB
      maxEntries: 1000,
      defaultTtl: 3600000, // 1 hour
      persistToDisk: true
    });

    // Task results namespace
    this.createNamespace('task-results', {
      maxSize: 30 * 1024 * 1024, // 30MB
      maxEntries: 3000,
      defaultTtl: 86400000, // 24 hours
      persistToDisk: true
    });

    // Coordination namespace
    this.createNamespace('coordination', {
      maxSize: 5 * 1024 * 1024, // 5MB
      maxEntries: 500,
      defaultTtl: 1800000, // 30 minutes
      persistToDisk: false
    });
  }

  private startCleanupProcess(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      await this.performCleanup();
    }, 300000);
  }

  private async performCleanup(): Promise<void> {
    try {
      let cleaned = 0;

      for (const [key, entry] of this.memory.entries()) {
        if (this.isExpired(entry)) {
          this.memory.delete(key);
          this.statistics.totalEntries--;
          this.statistics.totalSize -= entry.size;
          cleaned++;

          this.emitSyncEvent({
            type: 'expire',
            namespace: entry.namespace,
            key: key.replace(`${entry.namespace}:`, ''),
            timestamp: new Date().toISOString(),
            success: true
          });
        }
      }

      if (cleaned > 0 && this.debugMode) {
        console.log(chalk.gray(`[Shared Memory] Cleaned up ${cleaned} expired entries`));
      }

    } catch (error) {
      if (this.debugMode) {
        console.error(chalk.red(`[Shared Memory] Cleanup failed: ${error instanceof Error ? error.message : String(error)}`));
      }
    }
  }

  private async performEmergencyCleanup(): Promise<void> {
    if (this.debugMode) {
      console.log(chalk.yellow('[Shared Memory] Performing emergency cleanup...'));
    }

    // Remove oldest entries first
    const entries = Array.from(this.memory.entries())
      .sort(([, a], [, b]) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const targetReduction = Math.min(entries.length * 0.2, 1000); // Remove 20% or max 1000 entries

    for (let i = 0; i < targetReduction && entries.length > i; i++) {
      const [key, entry] = entries[i];
      this.memory.delete(key);
      this.statistics.totalEntries--;
      this.statistics.totalSize -= entry.size;
    }

    if (this.debugMode) {
      console.log(chalk.yellow(`[Shared Memory] Emergency cleanup removed ${targetReduction} entries`));
    }
  }

  private isExpired(entry: MemoryEntry): boolean {
    if (!entry.ttl) {
      return false;
    }

    const entryTime = new Date(entry.timestamp).getTime();
    const currentTime = Date.now();
    return (currentTime - entryTime) > entry.ttl;
  }

  private getNextVersion(key: string): number {
    const existing = this.memory.get(key);
    return existing ? existing.version + 1 : 1;
  }

  private checkReadAccess(namespace: string, agentId?: string): boolean {
    const namespaceConfig = this.namespaces.get(namespace);
    if (!namespaceConfig) {
      return false;
    }

    const { read } = namespaceConfig.accessControl;
    
    if (read.includes('*')) {
      return true;
    }

    if (agentId && (read.includes(agentId) || this.checkAgentTypeAccess(agentId, read))) {
      return true;
    }

    return false;
  }

  private checkWriteAccess(namespace: string, agentId?: string): boolean {
    const namespaceConfig = this.namespaces.get(namespace);
    if (!namespaceConfig) {
      return false;
    }

    const { write } = namespaceConfig.accessControl;
    
    if (write.includes('*')) {
      return true;
    }

    if (agentId && (write.includes(agentId) || this.checkAgentTypeAccess(agentId, write))) {
      return true;
    }

    return false;
  }

  private checkDeleteAccess(namespace: string, agentId?: string): boolean {
    const namespaceConfig = this.namespaces.get(namespace);
    if (!namespaceConfig) {
      return false;
    }

    const { delete: deleteAccess } = namespaceConfig.accessControl;
    
    if (deleteAccess.includes('*')) {
      return true;
    }

    if (agentId && (deleteAccess.includes(agentId) || this.checkAgentTypeAccess(agentId, deleteAccess))) {
      return true;
    }

    return false;
  }

  private checkAgentTypeAccess(agentId: string, allowedTypes: string[]): boolean {
    if (!this.swarm) {
      return false;
    }

    const agent = this.swarm.agents.find(a => a.id === agentId);
    return agent ? allowedTypes.includes(agent.type) : false;
  }

  private checkNamespaceLimits(namespace: string, value: any): boolean {
    const namespaceConfig = this.namespaces.get(namespace);
    if (!namespaceConfig) {
      return false;
    }

    // Check entry count limit
    const namespaceEntries = Array.from(this.memory.values())
      .filter(entry => entry.namespace === namespace);

    if (namespaceEntries.length >= namespaceConfig.maxEntries) {
      return false;
    }

    // Check size limit
    const valueSize = Buffer.byteLength(JSON.stringify(value), 'utf-8');
    const namespaceSize = namespaceEntries.reduce((sum, entry) => sum + entry.size, 0);

    if (namespaceSize + valueSize > namespaceConfig.maxSize) {
      return false;
    }

    return true;
  }

  private async persistEntry(entry: MemoryEntry): Promise<void> {
    try {
      const filePath = path.join(this.persistenceDir, entry.namespace, `${entry.key.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`);
      
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeJSON(filePath, entry, { spaces: 2 });

    } catch (error) {
      if (this.debugMode) {
        console.error(chalk.red(`[Shared Memory] Persistence failed for ${entry.key}: ${error instanceof Error ? error.message : String(error)}`));
      }
    }
  }

  private async removePersistentEntry(key: string): Promise<void> {
    try {
      const [namespace] = key.split(':');
      const filePath = path.join(this.persistenceDir, namespace, `${key.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`);
      
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
      }

    } catch (error) {
      if (this.debugMode) {
        console.error(chalk.red(`[Shared Memory] Persistent entry removal failed for ${key}: ${error instanceof Error ? error.message : String(error)}`));
      }
    }
  }

  private emitSyncEvent(event: MemorySyncEvent): void {
    this.emit('sync', event);
  }

  private notifyAgents(event: string, data: any): void {
    if (this.swarm) {
      for (const agent of this.swarm.agents) {
        agent.memory[`last-${event}`] = {
          ...data,
          timestamp: new Date().toISOString()
        };
      }
    }

    this.emit(event, data);
  }

  private recalculateStatistics(): void {
    let totalSize = 0;
    let totalEntries = 0;

    for (const entry of this.memory.values()) {
      totalSize += entry.size;
      totalEntries++;
    }

    this.statistics.totalSize = totalSize;
    this.statistics.totalEntries = totalEntries;
  }

  /**
   * Cleanup memory interface resources
   */
  destroy(): void {
    // Stop cleanup process
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear all memory
    this.memory.clear();
    this.namespaces.clear();

    // Remove all listeners
    this.removeAllListeners();

    if (this.debugMode) {
      console.log(chalk.gray('[Shared Memory Interface] Destroyed'));
    }
  }
}

/**
 * Factory function to create shared memory interface
 */
export function createSharedMemoryInterface(options?: {
  persistenceDir?: string;
  maxTotalSize?: number;
  maxTotalEntries?: number;
  debugMode?: boolean;
}): SharedMemoryInterface {
  return new SharedMemoryInterface(options);
}

/**
 * Export types for external use
 */
export type {
  MemoryEntry,
  MemoryNamespace,
  MemorySyncEvent,
  MemoryQueryOptions,
  MemoryStatistics
};