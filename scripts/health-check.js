#!/usr/bin/env node

/**
 * Health Check Script for Docker Containers
 * Provides comprehensive health checking for different validation scenarios
 */

import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

class HealthCheck {
    constructor() {
        this.checks = [];
        this.isPerformanceMode = process.argv.includes('--performance');
        this.isVerbose = process.argv.includes('--verbose');
        this.timeout = parseInt(process.argv.find(arg => arg.startsWith('--timeout='))?.split('=')[1]) || 5000;
    }

    async run() {
        const startTime = performance.now();
        
        try {
            await this.performChecks();
            const endTime = performance.now();
            const duration = Math.round(endTime - startTime);
            
            const result = {
                status: 'healthy',
                timestamp: this.getDeterministicDate().toISOString(),
                duration_ms: duration,
                checks: this.checks.filter(check => check.status !== 'healthy').length === 0 ? 'all_passed' : 'some_failed',
                details: this.isVerbose ? this.checks : undefined
            };
            
            if (this.isVerbose) {
                console.log(JSON.stringify(result, null, 2));
            } else {
                console.log(`Health: ${result.status} (${duration}ms)`);
            }
            
            // Exit with error if any critical checks failed
            const criticalFailures = this.checks.filter(check => check.status === 'critical');
            if (criticalFailures.length > 0) {
                process.exit(1);
            }
            
        } catch (error) {
            console.error(`Health check failed: ${error.message}`);
            process.exit(1);
        }
    }

    async performChecks() {
        // Basic system checks
        await this.checkNodejs();
        await this.checkMemory();
        await this.checkDisk();
        await this.checkEnvironment();
        
        // Application-specific checks
        await this.checkUnjucksInstallation();
        await this.checkTemplateDirectory();
        
        if (this.isPerformanceMode) {
            await this.checkPerformanceMetrics();
            await this.checkResourceConstraints();
        }
        
        // Docker-specific checks
        await this.checkContainerHealth();
    }

    async checkNodejs() {
        try {
            const version = process.version;
            const major = parseInt(version.slice(1).split('.')[0]);
            
            if (major >= 18) {
                this.addCheck('nodejs', 'healthy', `Node.js ${version} is supported`);
            } else {
                this.addCheck('nodejs', 'warning', `Node.js ${version} may not be fully supported`);
            }
        } catch (error) {
            this.addCheck('nodejs', 'critical', `Node.js check failed: ${error.message}`);
        }
    }

    async checkMemory() {
        try {
            const memUsage = process.memoryUsage();
            const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
            const rssMB = Math.round(memUsage.rss / 1024 / 1024);
            
            // Memory thresholds
            const criticalThreshold = 1024; // 1GB
            const warningThreshold = 512;   // 512MB
            
            if (rssMB > criticalThreshold) {
                this.addCheck('memory', 'critical', `High memory usage: ${rssMB}MB RSS`);
            } else if (rssMB > warningThreshold) {
                this.addCheck('memory', 'warning', `Elevated memory usage: ${rssMB}MB RSS`);
            } else {
                this.addCheck('memory', 'healthy', `Memory usage: ${heapUsedMB}/${heapTotalMB}MB heap, ${rssMB}MB RSS`);
            }
        } catch (error) {
            this.addCheck('memory', 'warning', `Memory check failed: ${error.message}`);
        }
    }

    async checkDisk() {
        try {
            // Check available disk space in current directory
            const stats = await fs.stat('.');
            const freeSpace = await this.getFreeDiskSpace();
            
            if (freeSpace !== null) {
                const freeSpaceGB = Math.round(freeSpace / 1024 / 1024 / 1024);
                
                if (freeSpaceGB < 1) {
                    this.addCheck('disk', 'critical', `Low disk space: ${freeSpaceGB}GB free`);
                } else if (freeSpaceGB < 5) {
                    this.addCheck('disk', 'warning', `Limited disk space: ${freeSpaceGB}GB free`);
                } else {
                    this.addCheck('disk', 'healthy', `Disk space: ${freeSpaceGB}GB free`);
                }
            } else {
                this.addCheck('disk', 'healthy', 'Disk space check completed');
            }
        } catch (error) {
            this.addCheck('disk', 'warning', `Disk check failed: ${error.message}`);
        }
    }

    async getFreeDiskSpace() {
        try {
            // Platform-specific disk space checking
            const { execSync } = await import('child_process');
            
            if (process.platform === 'linux' || process.platform === 'darwin') {
                const output = execSync('df . | tail -1', { encoding: 'utf8' });
                const parts = output.trim().split(/\s+/);
                return parseInt(parts[3]) * 1024; // Convert KB to bytes
            }
            
            return null; // Unsupported platform
        } catch (error) {
            return null;
        }
    }

    async checkEnvironment() {
        try {
            const requiredEnvVars = ['NODE_ENV'];
            const optionalEnvVars = ['PORT', 'UNJUCKS_LOG_LEVEL'];
            
            const missing = requiredEnvVars.filter(env => !process.env[env]);
            const present = optionalEnvVars.filter(env => process.env[env]);
            
            if (missing.length > 0) {
                this.addCheck('environment', 'warning', `Missing environment variables: ${missing.join(', ')}`);
            } else {
                this.addCheck('environment', 'healthy', `Environment configured (${present.length} optional vars set)`);
            }
        } catch (error) {
            this.addCheck('environment', 'warning', `Environment check failed: ${error.message}`);
        }
    }

    async checkUnjucksInstallation() {
        try {
            // Check if unjucks CLI is available
            const cliPaths = [
                './bin/unjucks.cjs',
                '/app/bin/unjucks.cjs',
                './src/cli/index.js'
            ];
            
            let cliFound = false;
            for (const cliPath of cliPaths) {
                try {
                    await fs.access(cliPath);
                    cliFound = true;
                    break;
                } catch {
                    continue;
                }
            }
            
            if (cliFound) {
                // Try to run unjucks --version
                try {
                    const { execSync } = await import('child_process');
                    const version = execSync('node bin/unjucks.cjs --version 2>/dev/null || node src/cli/index.js --version 2>/dev/null || echo "unknown"', { 
                        encoding: 'utf8', 
                        timeout: 3000 
                    }).trim();
                    
                    this.addCheck('unjucks', 'healthy', `Unjucks CLI available (${version})`);
                } catch {
                    this.addCheck('unjucks', 'healthy', 'Unjucks CLI executable found');
                }
            } else {
                this.addCheck('unjucks', 'warning', 'Unjucks CLI not found in expected locations');
            }
        } catch (error) {
            this.addCheck('unjucks', 'warning', `Unjucks check failed: ${error.message}`);
        }
    }

    async checkTemplateDirectory() {
        try {
            const templateDirs = ['_templates', 'templates', '/app/_templates'];
            let templateDirFound = false;
            
            for (const dir of templateDirs) {
                try {
                    const stats = await fs.stat(dir);
                    if (stats.isDirectory()) {
                        templateDirFound = true;
                        
                        // Count templates
                        const files = await fs.readdir(dir);
                        this.addCheck('templates', 'healthy', `Template directory found: ${dir} (${files.length} items)`);
                        break;
                    }
                } catch {
                    continue;
                }
            }
            
            if (!templateDirFound) {
                this.addCheck('templates', 'info', 'No template directory found (this is normal for some tests)');
            }
        } catch (error) {
            this.addCheck('templates', 'warning', `Template directory check failed: ${error.message}`);
        }
    }

    async checkPerformanceMetrics() {
        try {
            const startTime = performance.now();
            
            // CPU-intensive operation
            let sum = 0;
            for (let i = 0; i < 100000; i++) {
                sum += Math.sqrt(i);
            }
            
            const cpuTime = performance.now() - startTime;
            
            // Memory allocation test
            const memStart = process.memoryUsage().heapUsed;
            const testArray = new Array(10000).fill(0).map(() => Math.random());
            const memEnd = process.memoryUsage().heapUsed;
            const memDelta = memEnd - memStart;
            
            if (cpuTime > 1000) {
                this.addCheck('performance_cpu', 'warning', `Slow CPU performance: ${cpuTime.toFixed(2)}ms`);
            } else {
                this.addCheck('performance_cpu', 'healthy', `CPU performance: ${cpuTime.toFixed(2)}ms`);
            }
            
            if (memDelta > 10 * 1024 * 1024) { // 10MB
                this.addCheck('performance_memory', 'warning', `High memory allocation: ${Math.round(memDelta / 1024 / 1024)}MB`);
            } else {
                this.addCheck('performance_memory', 'healthy', `Memory allocation: ${Math.round(memDelta / 1024 / 1024)}MB`);
            }
            
            // Cleanup
            testArray.length = 0;
            
        } catch (error) {
            this.addCheck('performance', 'warning', `Performance check failed: ${error.message}`);
        }
    }

    async checkResourceConstraints() {
        try {
            // Check if running under resource constraints
            const memLimit = process.env.MEMORY_LIMIT;
            const cpuLimit = process.env.CPU_LIMIT;
            
            if (memLimit || cpuLimit) {
                this.addCheck('constraints', 'info', `Resource constraints: Memory=${memLimit || 'unlimited'}, CPU=${cpuLimit || 'unlimited'}`);
            }
            
            // Check current resource usage against limits
            const memUsage = process.memoryUsage();
            const rssMB = Math.round(memUsage.rss / 1024 / 1024);
            
            if (memLimit) {
                const limitMB = parseInt(memLimit.replace(/[^\d]/g, ''));
                const usagePercent = (rssMB / limitMB) * 100;
                
                if (usagePercent > 90) {
                    this.addCheck('memory_constraint', 'critical', `Memory usage ${usagePercent.toFixed(1)}% of limit`);
                } else if (usagePercent > 75) {
                    this.addCheck('memory_constraint', 'warning', `Memory usage ${usagePercent.toFixed(1)}% of limit`);
                } else {
                    this.addCheck('memory_constraint', 'healthy', `Memory usage ${usagePercent.toFixed(1)}% of limit`);
                }
            }
            
        } catch (error) {
            this.addCheck('constraints', 'warning', `Resource constraint check failed: ${error.message}`);
        }
    }

    async checkContainerHealth() {
        try {
            // Check if running in Docker
            const isDocker = await this.isRunningInDocker();
            
            if (isDocker) {
                this.addCheck('container', 'info', 'Running in Docker container');
                
                // Check container-specific health indicators
                await this.checkContainerSpecificHealth();
            } else {
                this.addCheck('container', 'info', 'Running outside Docker container');
            }
        } catch (error) {
            this.addCheck('container', 'warning', `Container check failed: ${error.message}`);
        }
    }

    async isRunningInDocker() {
        try {
            // Check for .dockerenv file
            await fs.access('/.dockerenv');
            return true;
        } catch {
            try {
                // Check /proc/1/cgroup for docker
                const cgroup = await fs.readFile('/proc/1/cgroup', 'utf8');
                return cgroup.includes('docker') || cgroup.includes('containerd');
            } catch {
                return false;
            }
        }
    }

    async checkContainerSpecificHealth() {
        try {
            // Check available entropy (important for crypto operations)
            try {
                const entropy = await fs.readFile('/proc/sys/kernel/random/entropy_avail', 'utf8');
                const entropyValue = parseInt(entropy.trim());
                
                if (entropyValue < 100) {
                    this.addCheck('entropy', 'warning', `Low entropy: ${entropyValue}`);
                } else {
                    this.addCheck('entropy', 'healthy', `Entropy: ${entropyValue}`);
                }
            } catch {
                // Entropy check not available
            }
            
            // Check if process is PID 1 (common in containers)
            if (process.pid === 1) {
                this.addCheck('pid', 'info', 'Running as PID 1 (container init process)');
            }
            
        } catch (error) {
            this.addCheck('container_specific', 'warning', `Container-specific check failed: ${error.message}`);
        }
    }

    addCheck(name, status, message) {
        this.checks.push({
            name,
            status,
            message,
            timestamp: this.getDeterministicDate().toISOString()
        });
        
        if (this.isVerbose) {
            const statusIcon = {
                'healthy': '✅',
                'warning': '⚠️',
                'critical': '❌',
                'info': 'ℹ️'
            }[status] || '?';
            
            console.log(`${statusIcon} ${name}: ${message}`);
        }
    }
}

// Main execution
async function main() {
    const healthCheck = new HealthCheck();
    await healthCheck.run();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Health check error:', error);
        process.exit(1);
    });
}

export default HealthCheck;