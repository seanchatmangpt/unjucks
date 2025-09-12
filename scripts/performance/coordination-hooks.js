#!/usr/bin/env node

/**
 * Performance Monitoring Coordination Hooks
 * Integrates with Claude Flow coordination system for performance validation
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

class PerformanceCoordinationHooks {
  constructor(options = {}) {
    this.options = {
      sessionId: 'performance-ci',
      memoryKey: 'performance/metrics',
      enableNotifications: true,
      ...options
    };

    this.hookResults = {
      timestamp: this.getDeterministicDate().toISOString(),
      sessionId: this.options.sessionId,
      hooks: {
        preTask: [],
        postEdit: [],
        postTask: [],
        notifications: []
      },
      metrics: {},
      coordination: {
        status: 'initialized',
        agents: [],
        memory: {}
      }
    };
  }

  async executeHook(hookType, params = {}) {
    console.log(`Executing ${hookType} hook with coordination...`);
    
    const hookResult = {
      type: hookType,
      timestamp: this.getDeterministicDate().toISOString(),
      params,
      success: false,
      output: null,
      error: null
    };

    try {
      switch (hookType) {
        case 'pre-task':
          hookResult.output = await this.executePreTaskHook(params);
          break;
        case 'post-edit':
          hookResult.output = await this.executePostEditHook(params);
          break;
        case 'post-task':
          hookResult.output = await this.executePostTaskHook(params);
          break;
        case 'session-restore':
          hookResult.output = await this.executeSessionRestoreHook(params);
          break;
        case 'session-end':
          hookResult.output = await this.executeSessionEndHook(params);
          break;
        case 'notify':
          hookResult.output = await this.executeNotifyHook(params);
          break;
        default:
          throw new Error(`Unknown hook type: ${hookType}`);
      }
      
      hookResult.success = true;
      this.hookResults.hooks[this.normalizeHookType(hookType)].push(hookResult);
      
    } catch (error) {
      hookResult.error = error.message;
      console.error(`Hook ${hookType} failed:`, error.message);
    }

    return hookResult;
  }

  normalizeHookType(hookType) {
    const typeMap = {
      'pre-task': 'preTask',
      'post-edit': 'postEdit', 
      'post-task': 'postTask',
      'session-restore': 'preTask',
      'session-end': 'postTask',
      'notify': 'notifications'
    };
    
    return typeMap[hookType] || 'unknown';
  }

  async executePreTaskHook(params) {
    const { description, taskId } = params;
    
    console.log(`🚀 Starting performance validation task: ${description}`);
    
    // Initialize coordination session
    const sessionResult = await this.initializeCoordinationSession();
    
    // Store task metadata in coordination memory
    const memoryResult = await this.storeCoordinationMemory('task/metadata', {
      taskId: taskId || this.generateTaskId(),
      description,
      startTime: this.getDeterministicDate().toISOString(),
      status: 'started',
      type: 'performance-validation'
    });

    // Check for existing performance baseline
    const baselineExists = await this.checkPerformanceBaseline();
    
    return {
      session: sessionResult,
      memory: memoryResult,
      baseline: baselineExists,
      taskInitialized: true
    };
  }

  async executePostEditHook(params) {
    const { file, memoryKey } = params;
    
    console.log(`📝 Processing performance data file: ${file}`);
    
    // Analyze the file type and extract relevant metrics
    const fileAnalysis = await this.analyzePerformanceFile(file);
    
    // Store metrics in coordination memory
    const memoryKey_final = memoryKey || `${this.options.memoryKey}/${fileAnalysis.type}`;
    const memoryResult = await this.storeCoordinationMemory(memoryKey_final, fileAnalysis.metrics);
    
    // Update coordination status
    await this.updateCoordinationStatus('file-processed', {
      file,
      type: fileAnalysis.type,
      metrics: fileAnalysis.summary
    });

    return {
      fileType: fileAnalysis.type,
      metrics: fileAnalysis.summary,
      memory: memoryResult,
      coordination: 'updated'
    };
  }

  async executePostTaskHook(params) {
    const { taskId } = params;
    
    console.log(`✅ Completing performance validation task: ${taskId}`);
    
    // Retrieve task metadata from coordination memory
    const taskMetadata = await this.retrieveCoordinationMemory('task/metadata');
    
    // Collect all performance metrics from memory
    const allMetrics = await this.collectAllMetrics();
    
    // Generate performance summary
    const summary = await this.generatePerformanceSummary(allMetrics);
    
    // Store final results
    await this.storeCoordinationMemory('task/results', {
      taskId,
      completion: this.getDeterministicDate().toISOString(),
      status: 'completed',
      summary,
      metrics: allMetrics
    });

    // Update coordination status
    await this.updateCoordinationStatus('task-completed', {
      taskId,
      summary,
      success: summary.overallStatus === 'passed'
    });

    return {
      taskCompleted: true,
      summary,
      metrics: allMetrics,
      coordination: 'finalized'
    };
  }

  async executeSessionRestoreHook(params) {
    const { sessionId } = params;
    
    console.log(`🔄 Restoring coordination session: ${sessionId}`);
    
    // Try to restore previous session data
    const sessionData = await this.restoreCoordinationSession(sessionId);
    
    // Initialize or restore coordination memory
    const memoryStatus = await this.initializeCoordinationMemory();
    
    return {
      sessionRestored: true,
      sessionData,
      memory: memoryStatus
    };
  }

  async executeSessionEndHook(params) {
    const { exportMetrics } = params;
    
    console.log(`🏁 Ending coordination session with metrics export: ${exportMetrics}`);
    
    // Export session metrics if requested
    let exportResult = null;
    if (exportMetrics) {
      exportResult = await this.exportSessionMetrics();
    }
    
    // Clean up coordination resources
    const cleanupResult = await this.cleanupCoordinationSession();
    
    return {
      sessionEnded: true,
      export: exportResult,
      cleanup: cleanupResult
    };
  }

  async executeNotifyHook(params) {
    const { message } = params;
    
    console.log(`📢 Coordination notification: ${message}`);
    
    // Send notification to coordination system
    const notificationResult = await this.sendCoordinationNotification(message);
    
    return {
      notificationSent: true,
      message,
      result: notificationResult
    };
  }

  generateTaskId() {
    return `perf-task-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async initializeCoordinationSession() {
    try {
      // Try to use Claude Flow coordination if available
      const result = this.executeClaudeFlowCommand('hooks session-init', {
        sessionId: this.options.sessionId,
        type: 'performance-validation'
      });
      
      return {
        method: 'claude-flow',
        sessionId: this.options.sessionId,
        status: 'initialized',
        result
      };
    } catch (error) {
      // Fallback to local coordination
      console.warn('Claude Flow not available, using local coordination');
      
      return {
        method: 'local',
        sessionId: this.options.sessionId,
        status: 'initialized',
        fallback: true
      };
    }
  }

  async storeCoordinationMemory(key, data) {
    try {
      // Try Claude Flow memory first
      const result = this.executeClaudeFlowCommand('memory store', {
        key: `${this.options.sessionId}/${key}`,
        data: JSON.stringify(data)
      });
      
      return {
        method: 'claude-flow',
        key,
        stored: true,
        result
      };
    } catch (error) {
      // Fallback to local storage
      const memoryDir = path.join(process.cwd(), '.coordination-memory');
      await fs.mkdir(memoryDir, { recursive: true });
      
      const filePath = path.join(memoryDir, `${key.replace(/\//g, '_')}.json`);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      
      return {
        method: 'local-file',
        key,
        stored: true,
        file: filePath
      };
    }
  }

  async retrieveCoordinationMemory(key) {
    try {
      // Try Claude Flow memory first
      const result = this.executeClaudeFlowCommand('memory retrieve', {
        key: `${this.options.sessionId}/${key}`
      });
      
      return JSON.parse(result);
    } catch (error) {
      // Fallback to local storage
      const memoryDir = path.join(process.cwd(), '.coordination-memory');
      const filePath = path.join(memoryDir, `${key.replace(/\//g, '_')}.json`);
      
      try {
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
      } catch (fileError) {
        return null;
      }
    }
  }

  async updateCoordinationStatus(status, data) {
    return await this.storeCoordinationMemory('status', {
      status,
      timestamp: this.getDeterministicDate().toISOString(),
      data
    });
  }

  async checkPerformanceBaseline() {
    const baselinePath = path.join(process.cwd(), '.github', 'performance-baseline.json');
    
    try {
      await fs.access(baselinePath);
      const baseline = JSON.parse(await fs.readFile(baselinePath, 'utf8'));
      return {
        exists: true,
        baseline,
        path: baselinePath
      };
    } catch (error) {
      return {
        exists: false,
        path: baselinePath
      };
    }
  }

  async analyzePerformanceFile(filePath) {
    const fileExtension = path.extname(filePath);
    const fileName = path.basename(filePath);
    
    let fileType = 'unknown';
    let metrics = {};
    let summary = {};
    
    if (fileExtension === '.json') {
      try {
        const content = JSON.parse(await fs.readFile(filePath, 'utf8'));
        
        // Detect file type based on content structure
        if (content.metrics?.performance) {
          fileType = 'template-benchmark';
          metrics = content.metrics;
          summary = {
            throughput: content.metrics.performance.throughputPerSecond,
            latency: content.metrics.performance.averageTime,
            successRate: content.metrics.performance.successRate
          };
        } else if (content.analysis?.memory) {
          fileType = 'memory-analysis';
          metrics = content.analysis;
          summary = {
            heapGrowth: content.analysis.memory.growth,
            suspectedLeaks: content.analysis.indicators?.suspectedLeak || false
          };
        } else if (content.metrics?.latency) {
          fileType = 'load-test';
          metrics = content.metrics;
          summary = {
            averageLatency: content.metrics.latency.average,
            throughput: content.metrics.throughput.requestsPerSecond,
            successRate: content.metrics.requests.successRate
          };
        } else if (content.validation) {
          fileType = 'cache-validation';
          metrics = content.validation;
          summary = {
            cacheHitRatio: content.validation.summary?.cacheHitRatio,
            passed: content.validation.passed
          };
        }
      } catch (error) {
        console.warn(`Failed to analyze performance file ${filePath}:`, error.message);
      }
    }
    
    return {
      type: fileType,
      metrics,
      summary,
      file: filePath,
      analyzedAt: this.getDeterministicDate().toISOString()
    };
  }

  async collectAllMetrics() {
    const metrics = {};
    
    // Try to collect from coordination memory
    const memoryKeys = [
      'performance/template-benchmark',
      'performance/memory-analysis', 
      'performance/load-test',
      'performance/cache-validation'
    ];
    
    for (const key of memoryKeys) {
      const data = await this.retrieveCoordinationMemory(key);
      if (data) {
        metrics[key] = data;
      }
    }
    
    return metrics;
  }

  async generatePerformanceSummary(allMetrics) {
    const summary = {
      timestamp: this.getDeterministicDate().toISOString(),
      overallStatus: 'unknown',
      components: {},
      issues: [],
      recommendations: []
    };
    
    let passedComponents = 0;
    let totalComponents = 0;
    
    // Analyze each component
    Object.entries(allMetrics).forEach(([key, data]) => {
      totalComponents++;
      const componentName = key.split('/').pop();
      
      let componentStatus = 'unknown';
      let componentIssues = [];
      
      // Component-specific analysis
      if (componentName === 'template-benchmark') {
        const perf = data.metrics?.performance;
        if (perf) {
          componentStatus = perf.successRate > 95 && perf.throughputPerSecond > 100 ? 'passed' : 'warning';
          if (perf.successRate <= 95) componentIssues.push('Low success rate');
          if (perf.throughputPerSecond <= 100) componentIssues.push('Low throughput');
        }
      } else if (componentName === 'memory-analysis') {
        const indicators = data.metrics?.indicators;
        if (indicators) {
          const issues = Object.entries(indicators).filter(([_, value]) => value === true);
          componentStatus = issues.length === 0 ? 'passed' : 'warning';
          componentIssues = issues.map(([key]) => `Memory issue: ${key}`);
        }
      } else if (componentName === 'load-test') {
        const metrics = data.metrics;
        if (metrics?.requests) {
          componentStatus = metrics.requests.successRate > 95 ? 'passed' : 'warning';
          if (metrics.requests.successRate <= 95) componentIssues.push('Load test failures');
        }
      } else if (componentName === 'cache-validation') {
        const validation = data.metrics;
        if (validation) {
          componentStatus = validation.passed ? 'passed' : 'warning';
          if (!validation.passed) componentIssues.push('Cache validation failed');
        }
      }
      
      summary.components[componentName] = {
        status: componentStatus,
        issues: componentIssues
      };
      
      if (componentStatus === 'passed') {
        passedComponents++;
      }
      
      summary.issues.push(...componentIssues);
    });
    
    // Determine overall status
    if (totalComponents === 0) {
      summary.overallStatus = 'no-data';
    } else if (passedComponents === totalComponents) {
      summary.overallStatus = 'passed';
    } else if (passedComponents > totalComponents / 2) {
      summary.overallStatus = 'warning';
    } else {
      summary.overallStatus = 'failed';
    }
    
    // Generate recommendations
    if (summary.issues.length > 0) {
      summary.recommendations.push('Review performance metrics and address identified issues');
      summary.recommendations.push('Check recent code changes for performance impact');
    }
    
    return summary;
  }

  executeClaudeFlowCommand(command, params = {}) {
    try {
      const cmd = `npx claude-flow@alpha ${command}`;
      const paramString = Object.entries(params)
        .map(([key, value]) => `--${key} "${value}"`)
        .join(' ');
      
      const fullCommand = `${cmd} ${paramString}`;
      const result = execSync(fullCommand, { 
        encoding: 'utf8',
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      return result.trim();
    } catch (error) {
      throw new Error(`Claude Flow command failed: ${error.message}`);
    }
  }

  async restoreCoordinationSession(sessionId) {
    // Try to restore session from coordination memory
    const sessionData = await this.retrieveCoordinationMemory('session');
    
    if (sessionData) {
      this.hookResults.coordination = {
        ...this.hookResults.coordination,
        ...sessionData
      };
    }
    
    return sessionData;
  }

  async initializeCoordinationMemory() {
    const memoryStatus = {
      initialized: true,
      timestamp: this.getDeterministicDate().toISOString(),
      sessionId: this.options.sessionId
    };
    
    await this.storeCoordinationMemory('session', memoryStatus);
    
    return memoryStatus;
  }

  async exportSessionMetrics() {
    const allMetrics = await this.collectAllMetrics();
    const sessionData = await this.retrieveCoordinationMemory('session');
    
    const exportData = {
      sessionId: this.options.sessionId,
      exportTimestamp: this.getDeterministicDate().toISOString(),
      session: sessionData,
      metrics: allMetrics,
      hooks: this.hookResults.hooks
    };
    
    const exportPath = path.join(process.cwd(), '.coordination-memory', `export-${this.options.sessionId}.json`);
    await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));
    
    return {
      exported: true,
      path: exportPath,
      dataSize: Object.keys(allMetrics).length
    };
  }

  async cleanupCoordinationSession() {
    try {
      // Clean up local coordination files
      const memoryDir = path.join(process.cwd(), '.coordination-memory');
      const files = await fs.readdir(memoryDir);
      
      for (const file of files) {
        if (file.startsWith(this.options.sessionId) || file.includes('task') || file.includes('status')) {
          await fs.unlink(path.join(memoryDir, file));
        }
      }
      
      return {
        cleaned: true,
        method: 'local-cleanup'
      };
    } catch (error) {
      return {
        cleaned: false,
        error: error.message
      };
    }
  }

  async sendCoordinationNotification(message) {
    // Store notification in coordination memory
    const notification = {
      message,
      timestamp: this.getDeterministicDate().toISOString(),
      sessionId: this.options.sessionId
    };
    
    await this.storeCoordinationMemory(`notifications/${this.getDeterministicTimestamp()}`, notification);
    
    return {
      sent: true,
      notification
    };
  }

  async saveHookResults(outputFile) {
    if (outputFile) {
      await fs.writeFile(outputFile, JSON.stringify(this.hookResults, null, 2));
      console.log(`Hook results saved to: ${outputFile}`);
    }
  }

  printHookSummary() {
    console.log('\n=== Performance Coordination Hooks Summary ===');
    console.log(`Session ID: ${this.options.sessionId}`);
    
    Object.entries(this.hookResults.hooks).forEach(([hookType, hooks]) => {
      if (hooks.length > 0) {
        const successCount = hooks.filter(h => h.success).length;
        console.log(`${hookType}: ${successCount}/${hooks.length} successful`);
      }
    });
    
    console.log(`Coordination Status: ${this.hookResults.coordination.status}`);
  }
}

// CLI Interface
async function main() {
  const argv = yargs(hideBin(process.argv))
    .command('pre-task', 'Execute pre-task coordination hook', {
      description: {
        alias: 'd',
        type: 'string',
        required: true,
        describe: 'Task description'
      },
      'task-id': {
        type: 'string',
        describe: 'Task identifier'
      }
    })
    .command('post-edit', 'Execute post-edit coordination hook', {
      file: {
        alias: 'f',
        type: 'string',
        required: true,
        describe: 'File that was edited'
      },
      'memory-key': {
        alias: 'k',
        type: 'string',
        describe: 'Memory key for storing data'
      }
    })
    .command('post-task', 'Execute post-task coordination hook', {
      'task-id': {
        type: 'string',
        required: true,
        describe: 'Task identifier'
      }
    })
    .command('session-restore', 'Restore coordination session', {
      'session-id': {
        type: 'string',
        required: true,
        describe: 'Session identifier'
      }
    })
    .command('session-end', 'End coordination session', {
      'export-metrics': {
        type: 'boolean',
        default: false,
        describe: 'Export session metrics'
      }
    })
    .command('notify', 'Send coordination notification', {
      message: {
        alias: 'm',
        type: 'string',
        required: true,
        describe: 'Notification message'
      }
    })
    .option('session-id', {
      alias: 's',
      type: 'string',
      default: 'performance-ci',
      describe: 'Coordination session ID'
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      describe: 'Output file for hook results'
    })
    .help()
    .argv;

  try {
    const hooks = new PerformanceCoordinationHooks({
      sessionId: argv.sessionId
    });

    const command = argv._[0];
    const params = {
      description: argv.description,
      taskId: argv.taskId,
      file: argv.file,
      memoryKey: argv.memoryKey,
      sessionId: argv.sessionId,
      exportMetrics: argv.exportMetrics,
      message: argv.message
    };

    const result = await hooks.executeHook(command, params);
    await hooks.saveHookResults(argv.output);
    hooks.printHookSummary();

    console.log(`\nHook ${command} completed:`, result.success ? 'SUCCESS' : 'FAILED');
    if (result.output) {
      console.log('Output:', JSON.stringify(result.output, null, 2));
    }

  } catch (error) {
    console.error('Coordination hook failed:', error);
    process.exit(1);
  }
}

// Auto-run when this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}

export { PerformanceCoordinationHooks };