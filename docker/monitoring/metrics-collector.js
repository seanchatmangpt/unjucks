#!/usr/bin/env node
/**
 * Docker Container Metrics Collector
 * Container Specialist #3 - Real-time monitoring and alerting
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

class MetricsCollector {
    constructor(options = {}) {
        this.interval = options.interval || 10000; // 10 seconds
        this.outputPath = options.outputPath || '/monitor/metrics.json';
        this.maxEntries = options.maxEntries || 1000;
        this.metrics = [];
        this.isRunning = false;
        this.alertThresholds = {
            memory: {
                warning: 0.8,   // 80%
                critical: 0.95  // 95%
            },
            cpu: {
                warning: 0.7,   // 70%
                critical: 0.9   // 90%
            },
            disk: {
                warning: 0.8,   // 80%
                critical: 0.95  // 95%
            }
        };
    }

    async collectSystemMetrics() {
        const timestamp = this.getDeterministicTimestamp();
        
        // Memory metrics
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memoryUsage = usedMem / totalMem;

        // CPU metrics
        const cpus = os.cpus();
        const loadAvg = os.loadavg();
        
        // Process memory
        const processMemory = process.memoryUsage();

        // Disk usage (approximate from /tmp if available)
        let diskUsage = null;
        try {
            const stats = fs.statSync('/tmp');
            if (stats.isDirectory()) {
                diskUsage = await this.getDiskUsage('/tmp');
            }
        } catch (error) {
            // Ignore disk usage errors
        }

        return {
            timestamp,
            system: {
                memory: {
                    total: totalMem,
                    free: freeMem,
                    used: usedMem,
                    usage: memoryUsage,
                    percentage: Math.round(memoryUsage * 100)
                },
                cpu: {
                    count: cpus.length,
                    loadAvg: loadAvg,
                    usage: loadAvg[0] / cpus.length, // Approximate CPU usage
                    percentage: Math.round((loadAvg[0] / cpus.length) * 100)
                },
                uptime: os.uptime(),
                platform: os.platform()
            },
            process: {
                pid: process.pid,
                memory: {
                    heapUsed: processMemory.heapUsed,
                    heapTotal: processMemory.heapTotal,
                    external: processMemory.external,
                    rss: processMemory.rss
                },
                uptime: process.uptime(),
                version: process.version
            },
            disk: diskUsage,
            containerInfo: this.getContainerInfo()
        };
    }

    async getDiskUsage(path) {
        try {
            const stats = await fs.promises.stat(path);
            // This is a simplified disk usage - in a real container,
            // you'd want to check the actual filesystem usage
            return {
                path,
                available: 'unknown',
                used: 'unknown',
                total: 'unknown',
                usage: 0
            };
        } catch (error) {
            return null;
        }
    }

    getContainerInfo() {
        // Try to detect if we're in a container and get info
        const info = {
            isContainer: false,
            containerId: null,
            image: null
        };

        try {
            // Check for Docker container
            if (fs.existsSync('/.dockerenv')) {
                info.isContainer = true;
            }

            // Try to get container ID from cgroup
            if (fs.existsSync('/proc/self/cgroup')) {
                const cgroup = fs.readFileSync('/proc/self/cgroup', 'utf8');
                const dockerMatch = cgroup.match(/docker\/([a-f0-9]{64})/);
                if (dockerMatch) {
                    info.containerId = dockerMatch[1].substring(0, 12);
                }
            }

            // Get hostname (often the short container ID)
            info.hostname = os.hostname();

        } catch (error) {
            // Ignore errors in container detection
        }

        return info;
    }

    analyzeMetrics(metrics) {
        const alerts = [];
        
        // Memory alerts
        if (metrics.system.memory.usage >= this.alertThresholds.memory.critical) {
            alerts.push({
                type: 'CRITICAL',
                category: 'memory',
                message: `Critical memory usage: ${metrics.system.memory.percentage}%`,
                value: metrics.system.memory.usage,
                threshold: this.alertThresholds.memory.critical
            });
        } else if (metrics.system.memory.usage >= this.alertThresholds.memory.warning) {
            alerts.push({
                type: 'WARNING',
                category: 'memory',
                message: `High memory usage: ${metrics.system.memory.percentage}%`,
                value: metrics.system.memory.usage,
                threshold: this.alertThresholds.memory.warning
            });
        }

        // CPU alerts
        if (metrics.system.cpu.usage >= this.alertThresholds.cpu.critical) {
            alerts.push({
                type: 'CRITICAL',
                category: 'cpu',
                message: `Critical CPU usage: ${metrics.system.cpu.percentage}%`,
                value: metrics.system.cpu.usage,
                threshold: this.alertThresholds.cpu.critical
            });
        } else if (metrics.system.cpu.usage >= this.alertThresholds.cpu.warning) {
            alerts.push({
                type: 'WARNING',
                category: 'cpu',
                message: `High CPU usage: ${metrics.system.cpu.percentage}%`,
                value: metrics.system.cpu.usage,
                threshold: this.alertThresholds.cpu.warning
            });
        }

        return alerts;
    }

    async saveMetrics(metrics) {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Add to metrics array
            this.metrics.push(metrics);

            // Trim to max entries
            if (this.metrics.length > this.maxEntries) {
                this.metrics = this.metrics.slice(-this.maxEntries);
            }

            // Write to file
            await fs.promises.writeFile(
                this.outputPath,
                JSON.stringify(this.metrics, null, 2)
            );

            // Also write latest metrics to separate file
            const latestPath = this.outputPath.replace('.json', '-latest.json');
            await fs.promises.writeFile(
                latestPath,
                JSON.stringify(metrics, null, 2)
            );

        } catch (error) {
            console.error('Failed to save metrics:', error);
        }
    }

    async logMetrics(metrics, alerts) {
        const timestamp = new Date(metrics.timestamp).toISOString();
        const memPct = metrics.system.memory.percentage;
        const cpuPct = metrics.system.cpu.percentage;
        const heapMB = Math.round(metrics.process.memory.heapUsed / 1024 / 1024);

        console.log(`[${timestamp}] MEM: ${memPct}% | CPU: ${cpuPct}% | HEAP: ${heapMB}MB`);

        // Log alerts
        alerts.forEach(alert => {
            const icon = alert.type === 'CRITICAL' ? '🚨' : '⚠️';
            console.log(`${icon} ${alert.type}: ${alert.message}`);
        });

        // Log container info on first run
        if (this.metrics.length === 1 && metrics.containerInfo.isContainer) {
            console.log(`📦 Container: ${metrics.containerInfo.containerId || 'unknown'} (${metrics.containerInfo.hostname})`);
        }
    }

    async start() {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        console.log('📊 Metrics Collector Starting...');
        console.log(`Interval: ${this.interval}ms`);
        console.log(`Output: ${this.outputPath}`);
        console.log(`Max entries: ${this.maxEntries}`);
        console.log('─'.repeat(60));

        while (this.isRunning) {
            try {
                const metrics = await this.collectSystemMetrics();
                const alerts = this.analyzeMetrics(metrics);
                
                await this.saveMetrics(metrics);
                await this.logMetrics(metrics, alerts);

                // Handle critical alerts
                if (alerts.some(alert => alert.type === 'CRITICAL')) {
                    console.log('🚨 CRITICAL ALERT: System resources critically low');
                    
                    // In a real system, you might want to trigger external alerts here
                    // For now, we'll just log it
                }

            } catch (error) {
                console.error('Error collecting metrics:', error);
            }

            // Wait for next interval
            await new Promise(resolve => setTimeout(resolve, this.interval));
        }
    }

    stop() {
        this.isRunning = false;
        console.log('📊 Metrics Collector Stopped');
    }

    async generateReport() {
        if (this.metrics.length === 0) {
            return null;
        }

        const latest = this.metrics[this.metrics.length - 1];
        const oldest = this.metrics[0];
        const duration = latest.timestamp - oldest.timestamp;

        // Calculate averages
        const avgMemory = this.metrics.reduce((sum, m) => sum + m.system.memory.usage, 0) / this.metrics.length;
        const avgCpu = this.metrics.reduce((sum, m) => sum + m.system.cpu.usage, 0) / this.metrics.length;
        
        // Find peaks
        const peakMemory = Math.max(...this.metrics.map(m => m.system.memory.usage));
        const peakCpu = Math.max(...this.metrics.map(m => m.system.cpu.usage));

        return {
            summary: {
                duration: duration,
                samples: this.metrics.length,
                startTime: new Date(oldest.timestamp).toISOString(),
                endTime: new Date(latest.timestamp).toISOString()
            },
            memory: {
                current: latest.system.memory.percentage,
                average: Math.round(avgMemory * 100),
                peak: Math.round(peakMemory * 100),
                total: latest.system.memory.total
            },
            cpu: {
                current: latest.system.cpu.percentage,
                average: Math.round(avgCpu * 100),
                peak: Math.round(peakCpu * 100),
                cores: latest.system.cpu.count
            },
            process: {
                heapUsed: Math.round(latest.process.memory.heapUsed / 1024 / 1024),
                heapTotal: Math.round(latest.process.memory.heapTotal / 1024 / 1024),
                uptime: Math.round(latest.process.uptime)
            },
            container: latest.containerInfo
        };
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};

    // Parse command line arguments
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i];
        const value = args[i + 1];
        
        switch (key) {
            case '--interval':
                options.interval = parseInt(value) * 1000;
                break;
            case '--output':
                options.outputPath = value;
                break;
            case '--max-entries':
                options.maxEntries = parseInt(value);
                break;
        }
    }

    const collector = new MetricsCollector(options);

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
        console.log('Received SIGTERM, shutting down gracefully...');
        collector.stop();
        process.exit(0);
    });

    process.on('SIGINT', () => {
        console.log('Received SIGINT, shutting down gracefully...');
        collector.stop();
        process.exit(0);
    });

    collector.start().catch(error => {
        console.error('Metrics collector crashed:', error);
        process.exit(1);
    });
}

module.exports = MetricsCollector;