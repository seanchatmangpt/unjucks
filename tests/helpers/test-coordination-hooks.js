/**
 * Test coordination hooks for Claude Flow integration
 * Provides hooks for swarm coordination and test execution synchronization
 */

import { spawn } from 'node:child_process';
import { EventEmitter } from 'events';

export class TestCoordinationHooks extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableHooks: options.enableHooks !== false,
      claudeFlowPath: options.claudeFlowPath || 'npx claude-flow@alpha',
      timeout: options.timeout || 10000,
      retryAttempts: options.retryAttempts || 2,
      sessionId: options.sessionId || `test-session-${this.getDeterministicTimestamp()}`,
      ...options
    };
    
    this.hookHistory = [];
    this.activeHooks = new Set();
    this.stats = {
      totalHooks: 0,
      successfulHooks: 0,
      failedHooks: 0,
      timeoutHooks: 0
    };
  }

  /**
   * Execute pre-task hook
   */
  async preTask(description, metadata = {}) {
    if (!this.options.enableHooks) {
      return { success: true, skipped: true };
    }

    const hookData = {
      type: 'pre-task',
      description,
      metadata,
      timestamp: this.getDeterministicTimestamp(),
      sessionId: this.options.sessionId
    };

    return this.executeHook('hooks', ['pre-task', '--description', description], hookData);
  }

  /**
   * Execute post-task hook
   */
  async postTask(taskId, results = {}) {
    if (!this.options.enableHooks) {
      return { success: true, skipped: true };
    }

    const hookData = {
      type: 'post-task',
      taskId,
      results,
      timestamp: this.getDeterministicTimestamp(),
      sessionId: this.options.sessionId
    };

    return this.executeHook('hooks', ['post-task', '--task-id', taskId], hookData);
  }

  /**
   * Execute post-edit hook for file changes
   */
  async postEdit(filePath, memoryKey = null) {
    if (!this.options.enableHooks) {
      return { success: true, skipped: true };
    }

    const hookData = {
      type: 'post-edit',
      filePath,
      memoryKey,
      timestamp: this.getDeterministicTimestamp(),
      sessionId: this.options.sessionId
    };

    const args = ['post-edit', '--file', filePath];
    if (memoryKey) {
      args.push('--memory-key', memoryKey);
    }

    return this.executeHook('hooks', args, hookData);
  }

  /**
   * Execute notification hook
   */
  async notify(message, level = 'info') {
    if (!this.options.enableHooks) {
      return { success: true, skipped: true };
    }

    const hookData = {
      type: 'notify',
      message,
      level,
      timestamp: this.getDeterministicTimestamp(),
      sessionId: this.options.sessionId
    };

    return this.executeHook('hooks', ['notify', '--message', message, '--level', level], hookData);
  }

  /**
   * Execute session restore hook
   */
  async sessionRestore(sessionId = this.options.sessionId) {
    if (!this.options.enableHooks) {
      return { success: true, skipped: true };
    }

    const hookData = {
      type: 'session-restore',
      sessionId,
      timestamp: this.getDeterministicTimestamp()
    };

    return this.executeHook('hooks', ['session-restore', '--session-id', sessionId], hookData);
  }

  /**
   * Execute session end hook
   */
  async sessionEnd(exportMetrics = true) {
    if (!this.options.enableHooks) {
      return { success: true, skipped: true };
    }

    const hookData = {
      type: 'session-end',
      exportMetrics,
      timestamp: this.getDeterministicTimestamp(),
      sessionId: this.options.sessionId
    };

    const args = ['session-end'];
    if (exportMetrics) {
      args.push('--export-metrics', 'true');
    }

    return this.executeHook('hooks', args, hookData);
  }

  /**
   * Execute memory store hook
   */
  async memoryStore(key, value, namespace = 'test') {
    if (!this.options.enableHooks) {
      return { success: true, skipped: true };
    }

    const hookData = {
      type: 'memory-store',
      key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
      namespace,
      timestamp: this.getDeterministicTimestamp(),
      sessionId: this.options.sessionId
    };

    return this.executeHook('memory_usage', [
      '--action', 'store',
      '--key', key,
      '--value', hookData.value,
      '--namespace', namespace
    ], hookData);
  }

  /**
   * Execute memory retrieve hook
   */
  async memoryRetrieve(key, namespace = 'test') {
    if (!this.options.enableHooks) {
      return { success: true, skipped: true, data: null };
    }

    const hookData = {
      type: 'memory-retrieve',
      key,
      namespace,
      timestamp: this.getDeterministicTimestamp(),
      sessionId: this.options.sessionId
    };

    const result = await this.executeHook('memory_usage', [
      '--action', 'retrieve',
      '--key', key,
      '--namespace', namespace
    ], hookData);

    // Parse retrieved data if available
    if (result.success && result.stdout) {
      try {
        const parsed = JSON.parse(result.stdout);
        result.data = parsed;
      } catch (error) {
        result.data = result.stdout;
      }
    }

    return result;
  }

  /**
   * Execute swarm coordination hook
   */
  async swarmCoordination(action, data = {}) {
    if (!this.options.enableHooks) {
      return { success: true, skipped: true };
    }

    const hookData = {
      type: 'swarm-coordination',
      action,
      data,
      timestamp: this.getDeterministicTimestamp(),
      sessionId: this.options.sessionId
    };

    const args = ['swarm_status'];
    if (data.swarmId) {
      args.push('--swarmId', data.swarmId);
    }

    return this.executeHook('swarm_status', args, hookData);
  }

  /**
   * Execute performance tracking hook
   */
  async trackPerformance(operation, duration, metadata = {}) {
    if (!this.options.enableHooks) {
      return { success: true, skipped: true };
    }

    const hookData = {
      type: 'performance-tracking',
      operation,
      duration,
      metadata,
      timestamp: this.getDeterministicTimestamp(),
      sessionId: this.options.sessionId
    };

    // Store performance data in memory for aggregation
    const performanceData = {
      operation,
      duration,
      timestamp: hookData.timestamp,
      ...metadata
    };

    return this.memoryStore(
      `performance:${operation}:${hookData.timestamp}`,
      performanceData,
      'performance'
    );
  }

  /**
   * Execute generic hook command
   */
  async executeHook(command, args = [], hookData = {}) {
    const hookId = `hook-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substring(2)}`;
    this.activeHooks.add(hookId);
    this.stats.totalHooks++;

    const commandParts = this.options.claudeFlowPath.split(' ');
    const executable = commandParts[0];
    const baseArgs = commandParts.slice(1);
    const fullArgs = [...baseArgs, command, ...args];

    const hookInfo = {
      id: hookId,
      command,
      args,
      data: hookData,
      startTime: this.getDeterministicTimestamp(),
      success: false,
      output: null,
      error: null
    };

    try {
      const result = await this.runCommand(executable, fullArgs, this.options.timeout);
      
      hookInfo.success = result.success;
      hookInfo.output = result.stdout;
      hookInfo.error = result.stderr;
      hookInfo.duration = this.getDeterministicTimestamp() - hookInfo.startTime;

      if (result.success) {
        this.stats.successfulHooks++;
      } else {
        this.stats.failedHooks++;
      }

      this.emit('hookExecuted', hookInfo);
      
      return {
        success: result.success,
        stdout: result.stdout,
        stderr: result.stderr,
        duration: hookInfo.duration,
        hookId
      };

    } catch (error) {
      hookInfo.error = error.message;
      hookInfo.duration = this.getDeterministicTimestamp() - hookInfo.startTime;
      
      if (error.message.includes('timeout')) {
        this.stats.timeoutHooks++;
      } else {
        this.stats.failedHooks++;
      }

      this.emit('hookFailed', hookInfo);
      
      return {
        success: false,
        error: error.message,
        duration: hookInfo.duration,
        hookId
      };

    } finally {
      this.activeHooks.delete(hookId);
      this.hookHistory.push(hookInfo);
      
      // Limit history size
      if (this.hookHistory.length > 1000) {
        this.hookHistory = this.hookHistory.slice(-500);
      }
    }
  }

  /**
   * Run command with timeout
   */
  async runCommand(executable, args, timeout) {
    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        reject(new Error(`Hook command timed out after ${timeout}ms`));
      }, timeout);

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (!timedOut) {
          clearTimeout(timeoutHandle);
          resolve({
            success: code === 0,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: code
          });
        }
      });

      child.on('error', (error) => {
        if (!timedOut) {
          clearTimeout(timeoutHandle);
          reject(error);
        }
      });
    });
  }

  /**
   * Create test lifecycle manager
   */
  createTestLifecycle(testName) {
    return {
      start: async () => {
        await this.preTask(`Starting test: ${testName}`, { testName });
        await this.sessionRestore();
      },
      
      fileChanged: async (filePath) => {
        await this.postEdit(filePath, `test/${testName}/files`);
      },
      
      progress: async (message) => {
        await this.notify(`${testName}: ${message}`, 'info');
      },
      
      error: async (error) => {
        await this.notify(`${testName} error: ${error.message}`, 'error');
      },
      
      end: async (results) => {
        await this.postTask(`test-${testName}`, results);
        await this.trackPerformance(testName, results.duration || 0, {
          success: results.success,
          testCount: results.testCount || 1
        });
        await this.sessionEnd(true);
      }
    };
  }

  /**
   * Batch multiple hooks for efficiency
   */
  async batchHooks(hooks) {
    const startTime = this.getDeterministicTimestamp();
    const results = [];

    for (const hook of hooks) {
      try {
        const result = await this.executeHook(hook.command, hook.args, hook.data);
        results.push({ ...result, hookType: hook.type });
      } catch (error) {
        results.push({ 
          success: false, 
          error: error.message, 
          hookType: hook.type 
        });
      }
    }

    const duration = this.getDeterministicTimestamp() - startTime;
    
    await this.trackPerformance('batch-hooks', duration, {
      hookCount: hooks.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length
    });

    return {
      results,
      duration,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length
    };
  }

  /**
   * Get hook execution statistics
   */
  getStats() {
    const recentHooks = this.hookHistory.filter(h => 
      this.getDeterministicTimestamp() - h.startTime < 300000 // Last 5 minutes
    );

    return {
      ...this.stats,
      activeHooks: this.activeHooks.size,
      recentHooksCount: recentHooks.length,
      averageDuration: recentHooks.length > 0 ? 
        recentHooks.reduce((sum, h) => sum + (h.duration || 0), 0) / recentHooks.length : 0,
      successRate: this.stats.totalHooks > 0 ? 
        (this.stats.successfulHooks / this.stats.totalHooks) * 100 : 0,
      lastHook: this.hookHistory[this.hookHistory.length - 1]
    };
  }

  /**
   * Get hook history for debugging
   */
  getHistory(limit = 10) {
    return this.hookHistory.slice(-limit);
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalHooks: 0,
      successfulHooks: 0,
      failedHooks: 0,
      timeoutHooks: 0
    };
    this.hookHistory = [];
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    // Cancel any active hooks
    for (const hookId of this.activeHooks) {
      this.activeHooks.delete(hookId);
    }

    await this.sessionEnd(true);
    this.removeAllListeners();
  }
}

/**
 * Global coordination hooks instance
 */
export const globalHooks = new TestCoordinationHooks();

/**
 * Convenience functions for common hook operations
 */
export async function executePreTaskHook(description, metadata) {
  return globalHooks.preTask(description, metadata);
}

export async function executePostTaskHook(taskId, results) {
  return globalHooks.postTask(taskId, results);
}

export async function executeFileChangeHook(filePath, memoryKey) {
  return globalHooks.postEdit(filePath, memoryKey);
}

export async function executeNotificationHook(message, level) {
  return globalHooks.notify(message, level);
}

export async function storeInMemory(key, value, namespace) {
  return globalHooks.memoryStore(key, value, namespace);
}

export async function retrieveFromMemory(key, namespace) {
  return globalHooks.memoryRetrieve(key, namespace);
}

export async function trackPerformance(operation, duration, metadata) {
  return globalHooks.trackPerformance(operation, duration, metadata);
}

/**
 * Test lifecycle decorator
 */
export function withCoordinationHooks(testName) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      const lifecycle = globalHooks.createTestLifecycle(testName || propertyKey);
      
      try {
        await lifecycle.start();
        const result = await originalMethod.apply(this, args);
        await lifecycle.end({ success: true, duration: this.getDeterministicTimestamp() });
        return result;
      } catch (error) {
        await lifecycle.error(error);
        await lifecycle.end({ success: false, error: error.message, duration: this.getDeterministicTimestamp() });
        throw error;
      }
    };
    
    return descriptor;
  };
}

export default TestCoordinationHooks;