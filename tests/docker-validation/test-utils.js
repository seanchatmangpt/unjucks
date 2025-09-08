/**
 * Docker Validation Test Utilities
 * Comprehensive helper functions for all Docker test suites
 */

import { spawn, exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Global test state
let activeContainers = new Set();
let tempDirectories = new Set();
let performanceMetrics = new Map();

/**
 * DOCKER CONTAINER MANAGEMENT HELPERS
 */

/**
 * Check if Docker is available and running
 */
export async function checkDockerAvailability() {
  try {
    const { stdout } = await execAsync('docker --version');
    const { stdout: info } = await execAsync('docker info');
    return {
      available: true,
      version: stdout.trim(),
      running: !info.includes('Cannot connect to the Docker daemon')
    };
  } catch (error) {
    return {
      available: false,
      version: null,
      running: false,
      error: error.message
    };
  }
}

/**
 * Create a test Docker container with specified configuration
 */
export async function createTestContainer(config = {}) {
  const containerId = `unjucks-test-${crypto.randomUUID().slice(0, 8)}`;
  
  const defaultConfig = {
    image: 'node:18-alpine',
    name: containerId,
    workdir: '/app',
    volumes: [],
    environment: {},
    command: 'sleep 3600',
    removeOnStop: true,
    network: 'bridge'
  };

  const finalConfig = { ...defaultConfig, ...config };
  
  try {
    // Build docker run command
    const dockerArgs = ['run', '-d'];
    
    if (finalConfig.removeOnStop) {
      dockerArgs.push('--rm');
    }
    
    dockerArgs.push('--name', finalConfig.name);
    dockerArgs.push('--workdir', finalConfig.workdir);
    
    if (finalConfig.network) {
      dockerArgs.push('--network', finalConfig.network);
    }
    
    // Add volumes
    for (const volume of finalConfig.volumes) {
      dockerArgs.push('-v', volume);
    }
    
    // Add environment variables
    for (const [key, value] of Object.entries(finalConfig.environment)) {
      dockerArgs.push('-e', `${key}=${value}`);
    }
    
    dockerArgs.push(finalConfig.image);
    
    if (finalConfig.command) {
      dockerArgs.push(...finalConfig.command.split(' '));
    }
    
    const { stdout } = await execAsync(`docker ${dockerArgs.join(' ')}`);
    const actualContainerId = stdout.trim();
    
    activeContainers.add(actualContainerId);
    
    return {
      id: actualContainerId,
      name: finalConfig.name,
      config: finalConfig,
      created: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Failed to create container: ${error.message}`);
  }
}

/**
 * Execute command in a running container
 */
export async function execInContainer(containerId, command, options = {}) {
  const defaultOptions = {
    user: null,
    workdir: null,
    environment: {},
    timeout: 30000
  };
  
  const finalOptions = { ...defaultOptions, ...options };
  
  try {
    const dockerArgs = ['exec'];
    
    if (finalOptions.user) {
      dockerArgs.push('--user', finalOptions.user);
    }
    
    if (finalOptions.workdir) {
      dockerArgs.push('--workdir', finalOptions.workdir);
    }
    
    for (const [key, value] of Object.entries(finalOptions.environment)) {
      dockerArgs.push('-e', `${key}=${value}`);
    }
    
    dockerArgs.push(containerId);
    dockerArgs.push(...command.split(' '));
    
    const { stdout, stderr } = await execAsync(
      `docker ${dockerArgs.join(' ')}`,
      { timeout: finalOptions.timeout }
    );
    
    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      success: true
    };
  } catch (error) {
    return {
      stdout: '',
      stderr: error.message,
      success: false,
      error: error.message
    };
  }
}

/**
 * Copy files to/from container
 */
export async function copyToContainer(containerId, sourcePath, destPath) {
  try {
    await execAsync(`docker cp "${sourcePath}" ${containerId}:"${destPath}"`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function copyFromContainer(containerId, sourcePath, destPath) {
  try {
    await execAsync(`docker cp ${containerId}:"${sourcePath}" "${destPath}"`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get container logs
 */
export async function getContainerLogs(containerId, options = {}) {
  const defaultOptions = {
    tail: 100,
    timestamps: true,
    since: null
  };
  
  const finalOptions = { ...defaultOptions, ...options };
  
  try {
    const dockerArgs = ['logs'];
    
    if (finalOptions.tail) {
      dockerArgs.push('--tail', finalOptions.tail.toString());
    }
    
    if (finalOptions.timestamps) {
      dockerArgs.push('--timestamps');
    }
    
    if (finalOptions.since) {
      dockerArgs.push('--since', finalOptions.since);
    }
    
    dockerArgs.push(containerId);
    
    const { stdout, stderr } = await execAsync(`docker ${dockerArgs.join(' ')}`);
    
    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      success: true
    };
  } catch (error) {
    return {
      stdout: '',
      stderr: error.message,
      success: false
    };
  }
}

/**
 * Stop and remove container
 */
export async function cleanupContainer(containerId) {
  try {
    // Try to stop gracefully first
    await execAsync(`docker stop ${containerId}`);
    
    // Remove if not auto-removing
    try {
      await execAsync(`docker rm ${containerId}`);
    } catch (rmError) {
      // Container might have been auto-removed
    }
    
    activeContainers.delete(containerId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * FILE SYSTEM CLEANUP VALIDATORS
 */

/**
 * Create temporary directory for test isolation
 */
export async function createTempDirectory(prefix = 'unjucks-test') {
  const tempDir = path.join('/tmp', `${prefix}-${crypto.randomUUID().slice(0, 8)}`);
  
  try {
    await fs.mkdir(tempDir, { recursive: true });
    tempDirectories.add(tempDir);
    return tempDir;
  } catch (error) {
    throw new Error(`Failed to create temp directory: ${error.message}`);
  }
}

/**
 * Validate file system state after operations
 */
export async function validateFileSystemCleanup(basePath) {
  const issues = [];
  
  try {
    const stats = await fs.stat(basePath);
    
    if (!stats.isDirectory()) {
      issues.push(`Base path ${basePath} is not a directory`);
      return { clean: false, issues };
    }
    
    const entries = await fs.readdir(basePath, { withFileTypes: true });
    
    // Check for unexpected files
    const unexpectedFiles = entries.filter(entry => {
      const name = entry.name;
      return !name.startsWith('.') && 
             name !== 'node_modules' && 
             name !== 'package.json' &&
             name !== 'package-lock.json';
    });
    
    if (unexpectedFiles.length > 0) {
      issues.push(`Unexpected files found: ${unexpectedFiles.map(f => f.name).join(', ')}`);
    }
    
    // Check for temporary files
    const tempFiles = entries.filter(entry => 
      entry.name.includes('temp') || 
      entry.name.includes('tmp') ||
      entry.name.startsWith('~')
    );
    
    if (tempFiles.length > 0) {
      issues.push(`Temporary files not cleaned: ${tempFiles.map(f => f.name).join(', ')}`);
    }
    
    return {
      clean: issues.length === 0,
      issues,
      fileCount: entries.length
    };
    
  } catch (error) {
    return {
      clean: false,
      issues: [`Failed to validate cleanup: ${error.message}`],
      error: error.message
    };
  }
}

/**
 * Cleanup all temporary directories
 */
export async function cleanupTempDirectories() {
  const results = [];
  
  for (const tempDir of tempDirectories) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      results.push({ path: tempDir, success: true });
      tempDirectories.delete(tempDir);
    } catch (error) {
      results.push({ 
        path: tempDir, 
        success: false, 
        error: error.message 
      });
    }
  }
  
  return results;
}

/**
 * MEMORY USAGE MONITORS
 */

/**
 * Start monitoring memory usage
 */
export function startMemoryMonitoring(intervalMs = 1000) {
  const monitoring = {
    interval: null,
    snapshots: [],
    peak: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 },
    start: Date.now()
  };
  
  monitoring.interval = setInterval(() => {
    const usage = process.memoryUsage();
    const timestamp = Date.now();
    
    monitoring.snapshots.push({
      timestamp,
      ...usage
    });
    
    // Track peaks
    if (usage.heapUsed > monitoring.peak.heapUsed) {
      monitoring.peak.heapUsed = usage.heapUsed;
    }
    if (usage.heapTotal > monitoring.peak.heapTotal) {
      monitoring.peak.heapTotal = usage.heapTotal;
    }
    if (usage.external > monitoring.peak.external) {
      monitoring.peak.external = usage.external;
    }
    if (usage.rss > monitoring.peak.rss) {
      monitoring.peak.rss = usage.rss;
    }
  }, intervalMs);
  
  return monitoring;
}

/**
 * Stop memory monitoring and return analysis
 */
export function stopMemoryMonitoring(monitoring) {
  if (monitoring.interval) {
    clearInterval(monitoring.interval);
    monitoring.interval = null;
  }
  
  const duration = Date.now() - monitoring.start;
  const snapshots = monitoring.snapshots;
  
  if (snapshots.length === 0) {
    return {
      duration,
      snapshots: 0,
      peak: monitoring.peak,
      average: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 },
      growth: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 }
    };
  }
  
  // Calculate averages
  const totals = snapshots.reduce((acc, snapshot) => {
    acc.heapUsed += snapshot.heapUsed;
    acc.heapTotal += snapshot.heapTotal;
    acc.external += snapshot.external;
    acc.rss += snapshot.rss;
    return acc;
  }, { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 });
  
  const average = {
    heapUsed: totals.heapUsed / snapshots.length,
    heapTotal: totals.heapTotal / snapshots.length,
    external: totals.external / snapshots.length,
    rss: totals.rss / snapshots.length
  };
  
  // Calculate memory growth
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  
  const growth = {
    heapUsed: last.heapUsed - first.heapUsed,
    heapTotal: last.heapTotal - first.heapTotal,
    external: last.external - first.external,
    rss: last.rss - first.rss
  };
  
  return {
    duration,
    snapshots: snapshots.length,
    peak: monitoring.peak,
    average,
    growth,
    rawData: snapshots
  };
}

/**
 * PERFORMANCE MEASUREMENT TOOLS
 */

/**
 * High-resolution timer for performance measurements
 */
export class PerformanceTimer {
  constructor(name) {
    this.name = name;
    this.startTime = null;
    this.endTime = null;
    this.marks = new Map();
  }
  
  start() {
    this.startTime = process.hrtime.bigint();
    return this;
  }
  
  mark(label) {
    if (!this.startTime) {
      throw new Error('Timer not started');
    }
    this.marks.set(label, process.hrtime.bigint());
    return this;
  }
  
  stop() {
    this.endTime = process.hrtime.bigint();
    return this;
  }
  
  getDuration() {
    if (!this.startTime || !this.endTime) {
      throw new Error('Timer not properly started/stopped');
    }
    return Number(this.endTime - this.startTime) / 1000000; // Convert to milliseconds
  }
  
  getMarkDuration(label) {
    if (!this.startTime) {
      throw new Error('Timer not started');
    }
    const markTime = this.marks.get(label);
    if (!markTime) {
      throw new Error(`Mark '${label}' not found`);
    }
    return Number(markTime - this.startTime) / 1000000; // Convert to milliseconds
  }
  
  getReport() {
    const report = {
      name: this.name,
      totalDuration: this.getDuration(),
      marks: {}
    };
    
    for (const [label, time] of this.marks) {
      report.marks[label] = Number(time - this.startTime) / 1000000;
    }
    
    return report;
  }
}

/**
 * Measure async function performance
 */
export async function measurePerformance(name, fn, options = {}) {
  const timer = new PerformanceTimer(name);
  const memoryMonitoring = options.trackMemory ? startMemoryMonitoring() : null;
  
  let result, error;
  
  timer.start();
  
  try {
    result = await fn();
    timer.mark('completion');
  } catch (err) {
    error = err;
    timer.mark('error');
  } finally {
    timer.stop();
  }
  
  const memoryReport = memoryMonitoring ? stopMemoryMonitoring(memoryMonitoring) : null;
  
  const performanceReport = {
    name,
    duration: timer.getDuration(),
    success: !error,
    error: error?.message,
    memory: memoryReport,
    timestamp: new Date().toISOString()
  };
  
  performanceMetrics.set(name, performanceReport);
  
  if (error) {
    throw error;
  }
  
  return { result, performance: performanceReport };
}

/**
 * REPORT GENERATION FUNCTIONS
 */

/**
 * Generate comprehensive test report
 */
export async function generateTestReport(testName, results = {}) {
  const timestamp = new Date().toISOString();
  const reportId = crypto.randomUUID();
  
  const report = {
    id: reportId,
    name: testName,
    timestamp,
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    },
    docker: await checkDockerAvailability(),
    results,
    performance: Array.from(performanceMetrics.values()),
    summary: {
      totalTests: results.total || 0,
      passed: results.passed || 0,
      failed: results.failed || 0,
      skipped: results.skipped || 0,
      duration: results.duration || 0
    }
  };
  
  return report;
}

/**
 * Save report to file
 */
export async function saveReport(report, filename) {
  const reportsDir = path.join(__dirname, '../../reports');
  
  try {
    await fs.mkdir(reportsDir, { recursive: true });
    const reportPath = path.join(reportsDir, filename);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    return { success: true, path: reportPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate HTML report
 */
export function generateHTMLReport(report) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Report: ${report.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; }
        .success { color: green; }
        .failure { color: red; }
        .warning { color: orange; }
        .stats { display: flex; gap: 20px; }
        .stat-card { background: #f9f9f9; padding: 15px; border-radius: 5px; flex: 1; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Test Report: ${report.name}</h1>
        <p><strong>Generated:</strong> ${report.timestamp}</p>
        <p><strong>Report ID:</strong> ${report.id}</p>
    </div>
    
    <div class="section">
        <h2>Summary</h2>
        <div class="stats">
            <div class="stat-card">
                <h3>Total Tests</h3>
                <p>${report.summary.totalTests}</p>
            </div>
            <div class="stat-card">
                <h3 class="success">Passed</h3>
                <p>${report.summary.passed}</p>
            </div>
            <div class="stat-card">
                <h3 class="failure">Failed</h3>
                <p>${report.summary.failed}</p>
            </div>
            <div class="stat-card">
                <h3 class="warning">Skipped</h3>
                <p>${report.summary.skipped}</p>
            </div>
        </div>
    </div>
    
    <div class="section">
        <h2>Environment</h2>
        <pre>${JSON.stringify(report.environment, null, 2)}</pre>
    </div>
    
    <div class="section">
        <h2>Docker Status</h2>
        <p><strong>Available:</strong> <span class="${report.docker.available ? 'success' : 'failure'}">${report.docker.available}</span></p>
        <p><strong>Running:</strong> <span class="${report.docker.running ? 'success' : 'failure'}">${report.docker.running}</span></p>
        ${report.docker.version ? `<p><strong>Version:</strong> ${report.docker.version}</p>` : ''}
    </div>
    
    ${report.performance.length > 0 ? `
    <div class="section">
        <h2>Performance Metrics</h2>
        <table>
            <thead>
                <tr>
                    <th>Test</th>
                    <th>Duration (ms)</th>
                    <th>Success</th>
                    <th>Memory Peak (MB)</th>
                </tr>
            </thead>
            <tbody>
                ${report.performance.map(perf => `
                <tr>
                    <td>${perf.name}</td>
                    <td>${perf.duration.toFixed(2)}</td>
                    <td class="${perf.success ? 'success' : 'failure'}">${perf.success}</td>
                    <td>${perf.memory ? (perf.memory.peak.heapUsed / 1024 / 1024).toFixed(2) : 'N/A'}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}
    
    <div class="section">
        <h2>Raw Data</h2>
        <pre>${JSON.stringify(report, null, 2)}</pre>
    </div>
</body>
</html>
  `;
  
  return html;
}

/**
 * ASSERTION HELPERS FOR COMPLEX VALIDATIONS
 */

/**
 * Assert container is running and healthy
 */
export async function assertContainerHealthy(containerId) {
  const result = await execInContainer(containerId, 'echo "health-check"');
  
  if (!result.success) {
    throw new Error(`Container ${containerId} is not responsive: ${result.error}`);
  }
  
  if (result.stdout !== 'health-check') {
    throw new Error(`Container ${containerId} returned unexpected output: ${result.stdout}`);
  }
  
  return true;
}

/**
 * Assert files exist with expected content
 */
export async function assertFilesExist(containerId, files) {
  const results = [];
  
  for (const file of files) {
    const result = await execInContainer(containerId, `test -f "${file}" && echo "exists" || echo "missing"`);
    
    results.push({
      file,
      exists: result.stdout === 'exists',
      result
    });
  }
  
  const missing = results.filter(r => !r.exists);
  
  if (missing.length > 0) {
    throw new Error(`Missing files in container: ${missing.map(m => m.file).join(', ')}`);
  }
  
  return results;
}

/**
 * Assert no memory leaks detected
 */
export function assertNoMemoryLeaks(memoryReport, threshold = 50 * 1024 * 1024) { // 50MB default
  if (!memoryReport) {
    throw new Error('No memory report provided');
  }
  
  const { growth } = memoryReport;
  
  if (growth.heapUsed > threshold) {
    throw new Error(
      `Memory leak detected: Heap grew by ${(growth.heapUsed / 1024 / 1024).toFixed(2)}MB ` +
      `(threshold: ${(threshold / 1024 / 1024).toFixed(2)}MB)`
    );
  }
  
  if (growth.rss > threshold * 2) {
    throw new Error(
      `RSS memory leak detected: RSS grew by ${(growth.rss / 1024 / 1024).toFixed(2)}MB ` +
      `(threshold: ${(threshold * 2 / 1024 / 1024).toFixed(2)}MB)`
    );
  }
  
  return true;
}

/**
 * Assert performance within acceptable range
 */
export function assertPerformanceWithinRange(duration, maxDuration, operation = 'operation') {
  if (duration > maxDuration) {
    throw new Error(
      `Performance assertion failed: ${operation} took ${duration.toFixed(2)}ms ` +
      `(max allowed: ${maxDuration}ms)`
    );
  }
  
  return true;
}

/**
 * CLEANUP FUNCTIONS
 */

/**
 * Global cleanup function for all test resources
 */
export async function globalCleanup() {
  const results = {
    containers: [],
    tempDirs: [],
    errors: []
  };
  
  // Cleanup containers
  for (const containerId of activeContainers) {
    try {
      const result = await cleanupContainer(containerId);
      results.containers.push({ id: containerId, success: result.success });
    } catch (error) {
      results.errors.push(`Container cleanup failed for ${containerId}: ${error.message}`);
    }
  }
  
  // Cleanup temp directories
  const tempCleanup = await cleanupTempDirectories();
  results.tempDirs = tempCleanup;
  
  // Clear performance metrics
  performanceMetrics.clear();
  
  return results;
}

/**
 * Setup test environment
 */
export async function setupTestEnvironment() {
  // Check Docker availability
  const dockerStatus = await checkDockerAvailability();
  
  if (!dockerStatus.available) {
    throw new Error('Docker is not available. Please install Docker to run these tests.');
  }
  
  if (!dockerStatus.running) {
    throw new Error('Docker is not running. Please start Docker daemon.');
  }
  
  return {
    docker: dockerStatus,
    tempDir: await createTempDirectory(),
    timestamp: new Date().toISOString()
  };
}

// Export collections for external access
export const getActiveContainers = () => Array.from(activeContainers);
export const getTempDirectories = () => Array.from(tempDirectories);
export const getPerformanceMetrics = () => Array.from(performanceMetrics.entries());