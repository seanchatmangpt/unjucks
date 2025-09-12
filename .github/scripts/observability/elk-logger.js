#!/usr/bin/env node

/**
 * ELK Stack Integration for Centralized Structured Logging
 * Handles log aggregation, processing, and shipping to Elasticsearch
 */

import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import fs from 'fs-extra';
import path from 'path';
import consola from 'consola';
import { createHash } from 'crypto';

class ELKLogger {
  constructor(options = {}) {
    this.sessionId = options.sessionId;
    this.traceId = options.traceId;
    this.logLevel = options.logLevel || 'info';
    this.includeSystemMetrics = options.includeSystemMetrics || false;
    
    this.elasticConfig = {
      cloudId: process.env.ELASTIC_CLOUD_ID,
      cloudAuth: process.env.ELASTIC_CLOUD_AUTH,
      node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
      index: `github-actions-${this.getDeterministicDate().getFullYear()}.${String(this.getDeterministicDate().getMonth() + 1).padStart(2, '0')}`
    };
    
    this.logstashEndpoint = process.env.LOGSTASH_ENDPOINT;
    
    this.setupLogger();
  }

  setupLogger() {
    const transports = [];
    
    // Console transport for local development
    transports.push(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
        })
      )
    }));

    // File transport for local storage
    transports.push(new winston.transports.File({
      filename: '.github/observability-data/logs/structured/application.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }));

    // Elasticsearch transport (if configured)
    if (this.elasticConfig.cloudId || this.elasticConfig.node) {
      try {
        const elasticTransport = new ElasticsearchTransport({
          clientOpts: {
            cloud: this.elasticConfig.cloudId ? {
              id: this.elasticConfig.cloudId,
              auth: this.elasticConfig.cloudAuth
            } : undefined,
            node: this.elasticConfig.cloudId ? undefined : this.elasticConfig.node
          },
          index: this.elasticConfig.index,
          transformer: (logData) => this.transformLogForElastic(logData)
        });
        
        transports.push(elasticTransport);
        consola.success('Elasticsearch transport configured');
      } catch (error) {
        consola.warn('Could not setup Elasticsearch transport:', error.message);
      }
    }

    // Custom Logstash transport (if configured)
    if (this.logstashEndpoint) {
      try {
        transports.push(new winston.transports.Http({
          host: new URL(this.logstashEndpoint).hostname,
          port: new URL(this.logstashEndpoint).port,
          path: new URL(this.logstashEndpoint).pathname,
          format: winston.format.json()
        }));
        consola.success('Logstash transport configured');
      } catch (error) {
        consola.warn('Could not setup Logstash transport:', error.message);
      }
    }

    this.logger = winston.createLogger({
      level: this.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
      ),
      defaultMeta: this.getDefaultMeta(),
      transports
    });
  }

  getDefaultMeta() {
    return {
      service: 'unjucks-ci-pipeline',
      environment: 'ci',
      session_id: this.sessionId,
      trace_id: this.traceId,
      repository: process.env.GITHUB_REPOSITORY,
      workflow: process.env.GITHUB_WORKFLOW,
      job: process.env.GITHUB_JOB,
      run_id: process.env.GITHUB_RUN_ID,
      run_number: process.env.GITHUB_RUN_NUMBER,
      actor: process.env.GITHUB_ACTOR,
      ref: process.env.GITHUB_REF,
      sha: process.env.GITHUB_SHA,
      event_name: process.env.GITHUB_EVENT_NAME
    };
  }

  transformLogForElastic(logData) {
    const transformed = {
      '@timestamp': new Date(logData.timestamp).toISOString(),
      message: logData.message,
      level: logData.level,
      service: logData.metadata?.service || 'unjucks-ci-pipeline',
      environment: logData.metadata?.environment || 'ci',
      
      // GitHub Actions context
      github: {
        repository: logData.metadata?.repository,
        workflow: logData.metadata?.workflow,
        job: logData.metadata?.job,
        run_id: logData.metadata?.run_id,
        run_number: logData.metadata?.run_number,
        actor: logData.metadata?.actor,
        ref: logData.metadata?.ref,
        sha: logData.metadata?.sha,
        event_name: logData.metadata?.event_name
      },
      
      // Observability context
      observability: {
        session_id: logData.metadata?.session_id,
        trace_id: logData.metadata?.trace_id
      },
      
      // Additional metadata
      ...logData.metadata
    };

    // Remove undefined values
    return JSON.parse(JSON.stringify(transformed));
  }

  async logWorkflowStart(workflowName, metadata = {}) {
    this.logger.info('Workflow started', {
      event_type: 'workflow_start',
      workflow_name: workflowName,
      ...metadata
    });
  }

  async logWorkflowEnd(workflowName, status, metadata = {}) {
    this.logger.info('Workflow completed', {
      event_type: 'workflow_end',
      workflow_name: workflowName,
      status,
      ...metadata
    });
  }

  async logJobStart(jobName, metadata = {}) {
    this.logger.info('Job started', {
      event_type: 'job_start',
      job_name: jobName,
      ...metadata
    });
  }

  async logJobEnd(jobName, status, duration, metadata = {}) {
    this.logger.info('Job completed', {
      event_type: 'job_end',
      job_name: jobName,
      status,
      duration_ms: duration,
      ...metadata
    });
  }

  async logStepStart(stepName, metadata = {}) {
    this.logger.debug('Step started', {
      event_type: 'step_start',
      step_name: stepName,
      ...metadata
    });
  }

  async logStepEnd(stepName, status, duration, metadata = {}) {
    this.logger.debug('Step completed', {
      event_type: 'step_end',
      step_name: stepName,
      status,
      duration_ms: duration,
      ...metadata
    });
  }

  async logMetric(metricName, value, unit = '', metadata = {}) {
    this.logger.info('Metric recorded', {
      event_type: 'metric',
      metric_name: metricName,
      metric_value: value,
      metric_unit: unit,
      ...metadata
    });
  }

  async logError(error, context = {}) {
    this.logger.error('Error occurred', {
      event_type: 'error',
      error_message: error.message,
      error_stack: error.stack,
      error_name: error.name,
      ...context
    });
  }

  async logSystemMetrics() {
    if (!this.includeSystemMetrics) return;

    try {
      const systemInfo = {
        memory_usage: process.memoryUsage(),
        cpu_usage: process.cpuUsage(),
        uptime: process.uptime(),
        platform: process.platform,
        arch: process.arch,
        node_version: process.version
      };

      this.logger.info('System metrics', {
        event_type: 'system_metrics',
        ...systemInfo
      });

    } catch (error) {
      this.logger.warn('Could not collect system metrics', { error: error.message });
    }
  }

  async processExistingLogs() {
    consola.info('Processing existing workflow logs');

    try {
      // Process GitHub Actions logs if available
      const logsPath = '.github/observability-data/logs/raw';
      if (await fs.pathExists(logsPath)) {
        const logFiles = await fs.readdir(logsPath);
        
        for (const logFile of logFiles) {
          if (logFile.endsWith('.log') || logFile.endsWith('.txt')) {
            await this.processLogFile(path.join(logsPath, logFile));
          }
        }
      }

      // Process workflow run logs from GitHub API
      await this.fetchGitHubLogs();

    } catch (error) {
      this.logger.error('Failed to process existing logs', { error: error.message });
    }
  }

  async processLogFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const parsedLog = this.parseLogLine(line, path.basename(filePath));
        if (parsedLog) {
          this.logger.info('Processed log entry', {
            event_type: 'processed_log',
            original_file: path.basename(filePath),
            ...parsedLog
          });
        }
      }

    } catch (error) {
      this.logger.warn('Could not process log file', { 
        file: filePath, 
        error: error.message 
      });
    }
  }

  parseLogLine(line, source) {
    // Try to parse different log formats
    try {
      // JSON format
      if (line.startsWith('{')) {
        return { ...JSON.parse(line), log_source: source };
      }

      // GitHub Actions format: "2024-01-01T12:00:00.000Z [INFO] message"
      const githubMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z)\s+\[(\w+)\]\s+(.*)$/);
      if (githubMatch) {
        return {
          timestamp: githubMatch[1],
          level: githubMatch[2].toLowerCase(),
          message: githubMatch[3],
          log_source: source
        };
      }

      // Generic timestamp format
      const genericMatch = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(.*)$/);
      if (genericMatch) {
        return {
          timestamp: genericMatch[1],
          message: genericMatch[2],
          log_source: source
        };
      }

      // Plain message
      return {
        message: line,
        log_source: source,
        parsed: false
      };

    } catch (error) {
      return {
        message: line,
        log_source: source,
        parse_error: error.message
      };
    }
  }

  async fetchGitHubLogs() {
    // This would require GitHub API integration to fetch workflow logs
    // For now, we'll create sample log entries based on GitHub context
    
    if (process.env.GITHUB_RUN_ID) {
      this.logger.info('GitHub workflow context', {
        event_type: 'github_context',
        run_id: process.env.GITHUB_RUN_ID,
        run_number: process.env.GITHUB_RUN_NUMBER,
        workflow: process.env.GITHUB_WORKFLOW,
        job: process.env.GITHUB_JOB,
        action: process.env.GITHUB_ACTION,
        step: process.env.GITHUB_STEP_SUMMARY
      });
    }
  }

  async createLogAggregationSummary() {
    const summary = {
      session_id: this.sessionId,
      trace_id: this.traceId,
      timestamp: this.getDeterministicDate().toISOString(),
      log_sources: [],
      metrics: {
        total_logs: 0,
        errors: 0,
        warnings: 0,
        info: 0,
        debug: 0
      },
      configuration: {
        elasticsearch_configured: !!(this.elasticConfig.cloudId || this.elasticConfig.node),
        logstash_configured: !!this.logstashEndpoint,
        log_level: this.logLevel,
        system_metrics_enabled: this.includeSystemMetrics
      }
    };

    // Count log entries by level (approximate)
    try {
      const structuredLogsPath = '.github/observability-data/logs/structured';
      if (await fs.pathExists(structuredLogsPath)) {
        const files = await fs.readdir(structuredLogsPath);
        
        for (const file of files) {
          if (file.endsWith('.log')) {
            const content = await fs.readFile(path.join(structuredLogsPath, file), 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            
            summary.log_sources.push({
              file: file,
              lines: lines.length
            });
            
            for (const line of lines) {
              try {
                const logEntry = JSON.parse(line);
                summary.metrics.total_logs++;
                
                switch (logEntry.level) {
                  case 'error': summary.metrics.errors++; break;
                  case 'warn': summary.metrics.warnings++; break;
                  case 'info': summary.metrics.info++; break;
                  case 'debug': summary.metrics.debug++; break;
                }
              } catch (e) {
                // Skip invalid JSON lines
              }
            }
          }
        }
      }
    } catch (error) {
      this.logger.warn('Could not create aggregation summary', { error: error.message });
    }

    // Save summary
    await fs.ensureDir('.github/observability-data/logs');
    await fs.writeJson(
      '.github/observability-data/logs/aggregation-summary.json',
      summary,
      { spaces: 2 }
    );

    this.logger.info('Log aggregation summary created', summary);
    return summary;
  }

  async shutdown() {
    if (this.logger) {
      this.logger.end();
      // Wait for all transports to finish
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    
    if (key === 'include-system-metrics') {
      options[key.replace(/-([a-z])/g, (g) => g[1].toUpperCase())] = value === 'true';
    } else {
      options[key.replace(/-([a-z])/g, (g) => g[1].toUpperCase())] = value;
    }
  }

  const elkLogger = new ELKLogger(options);

  try {
    consola.info('🚀 Starting ELK logging integration');

    // Log system startup
    await elkLogger.logWorkflowStart('observability-monitoring', {
      observability_mode: 'elk-logging',
      session_id: options.sessionId
    });

    // Process existing logs
    await elkLogger.processExistingLogs();

    // Log system metrics
    if (elkLogger.includeSystemMetrics) {
      await elkLogger.logSystemMetrics();
    }

    // Create aggregation summary
    const summary = await elkLogger.createLogAggregationSummary();

    // Set GitHub Actions outputs
    if (process.env.GITHUB_OUTPUT) {
      const outputs = [
        'success=true',
        `errors=${summary.metrics.errors}`,
        `warnings=${summary.metrics.warnings}`,
        `total_logs=${summary.metrics.total_logs}`
      ];
      
      await fs.appendFile(process.env.GITHUB_OUTPUT, outputs.join('\n') + '\n');
    }

    consola.success('🎉 ELK logging integration completed successfully');

  } catch (error) {
    consola.error('💥 ELK logging failed:', error);
    
    if (process.env.GITHUB_OUTPUT) {
      await fs.appendFile(process.env.GITHUB_OUTPUT, 'success=false\n');
    }
    
    process.exit(1);
    
  } finally {
    await elkLogger.shutdown();
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  consola.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  consola.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { ELKLogger };