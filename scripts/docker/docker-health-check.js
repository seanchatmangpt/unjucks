#!/usr/bin/env node

/**
 * Docker Health Check Script
 * Comprehensive health monitoring for Docker testing environment
 */

import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

class DockerHealthChecker {
    constructor() {
        this.config = {
            checkInterval: 30000, // 30 seconds
            maxRetries: 3,
            timeout: 10000, // 10 seconds
            healthChecks: [
                'docker-daemon',
                'container-status',
                'network-connectivity',
                'volume-mounts',
                'resource-usage',
                'test-execution'
            ]
        };
        
        this.healthResults = {
            timestamp: new Date().toISOString(),
            overall: 'unknown',
            checks: {},
            recommendations: []
        };
    }

    async claudeFlowHooks(action, data = {}) {
        try {
            console.log(`🔗 Claude Flow Hook: ${action}`, data);
        } catch (error) {
            console.warn('Claude Flow hook failed:', error.message);
        }
    }

    async execCommand(command, timeout = this.config.timeout) {
        return new Promise((resolve, reject) => {
            const child = exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Command failed: ${error.message}`));
                } else {
                    resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
                }
            });
            
            setTimeout(() => {
                child.kill();
                reject(new Error(`Command timeout: ${command}`));
            }, timeout);
        });
    }

    async checkDockerDaemon() {
        try {
            await this.execCommand('docker info');
            return { status: 'healthy', message: 'Docker daemon is running' };
        } catch (error) {
            return { status: 'unhealthy', message: `Docker daemon issue: ${error.message}` };
        }
    }

    async checkContainerStatus() {
        try {
            const { stdout } = await this.execCommand('docker-compose -f docker/docker-compose.testing.yml ps --services');
            const services = stdout.split('\n').filter(s => s.trim());
            
            const statuses = [];
            for (const service of services) {
                try {
                    const { stdout: status } = await this.execCommand(
                        `docker-compose -f docker/docker-compose.testing.yml ps ${service}`
                    );
                    statuses.push({ service, status: status.includes('Up') ? 'running' : 'stopped' });
                } catch (error) {
                    statuses.push({ service, status: 'error', error: error.message });
                }
            }
            
            const unhealthy = statuses.filter(s => s.status !== 'running');
            if (unhealthy.length === 0) {
                return { status: 'healthy', message: 'All containers are running', details: statuses };
            } else {
                return { 
                    status: 'unhealthy', 
                    message: `${unhealthy.length} containers not running`,
                    details: statuses 
                };
            }
        } catch (error) {
            return { status: 'error', message: `Container check failed: ${error.message}` };
        }
    }

    async checkNetworkConnectivity() {
        try {
            // Check if test network exists
            await this.execCommand('docker network inspect unjucks-test-network');
            
            // Test network connectivity between containers
            const { stdout } = await this.execCommand(
                'docker-compose -f docker/docker-compose.testing.yml exec -T unjucks-test ping -c 1 test-db || echo "ping-failed"'
            );
            
            if (stdout.includes('ping-failed')) {
                return { status: 'degraded', message: 'Network connectivity issues detected' };
            }
            
            return { status: 'healthy', message: 'Network connectivity is good' };
        } catch (error) {
            return { status: 'unhealthy', message: `Network check failed: ${error.message}` };
        }
    }

    async checkVolumeMounts() {
        try {
            // Check if volume mounts are working
            const testFile = `/tmp/docker-mount-test-${Date.now()}.txt`;
            const containerPath = '/app/test-results/mount-test.txt';
            
            // Create test file
            await fs.writeFile(testFile, 'Docker volume mount test');
            
            // Copy to container and verify
            await this.execCommand(`docker cp ${testFile} unjucks-test-main:${containerPath}`);
            const { stdout } = await this.execCommand(`docker exec unjucks-test-main cat ${containerPath}`);
            
            // Cleanup
            await fs.unlink(testFile);
            await this.execCommand(`docker exec unjucks-test-main rm ${containerPath}`);
            
            if (stdout.includes('Docker volume mount test')) {
                return { status: 'healthy', message: 'Volume mounts are working' };
            } else {
                return { status: 'unhealthy', message: 'Volume mount verification failed' };
            }
        } catch (error) {
            return { status: 'error', message: `Volume mount check failed: ${error.message}` };
        }
    }

    async checkResourceUsage() {
        try {
            const { stdout } = await this.execCommand('docker stats --no-stream --format "table {{.Container}}\\t{{.CPUPerc}}\\t{{.MemUsage}}"');
            const lines = stdout.split('\n').slice(1); // Skip header
            
            const resourceData = lines.map(line => {
                const [container, cpu, memory] = line.split('\t');
                return {
                    container: container?.trim(),
                    cpu: cpu?.trim(),
                    memory: memory?.trim()
                };
            }).filter(data => data.container && data.container.includes('unjucks'));
            
            // Check for high resource usage
            const highUsage = resourceData.filter(data => {
                const cpuPercent = parseFloat(data.cpu?.replace('%', '') || '0');
                return cpuPercent > 80; // Alert if CPU > 80%
            });
            
            if (highUsage.length > 0) {
                return { 
                    status: 'warning', 
                    message: 'High resource usage detected',
                    details: resourceData 
                };
            }
            
            return { 
                status: 'healthy', 
                message: 'Resource usage is normal',
                details: resourceData 
            };
        } catch (error) {
            return { status: 'error', message: `Resource check failed: ${error.message}` };
        }
    }

    async checkTestExecution() {
        try {
            // Run a quick smoke test
            const { stdout } = await this.execCommand(
                'docker-compose -f docker/docker-compose.testing.yml exec -T unjucks-test npm run test:smoke',
                30000 // 30 second timeout for test execution
            );
            
            if (stdout.includes('passed') || stdout.includes('✓')) {
                return { status: 'healthy', message: 'Test execution is working' };
            } else {
                return { status: 'warning', message: 'Test execution may have issues', details: stdout };
            }
        } catch (error) {
            return { status: 'unhealthy', message: `Test execution failed: ${error.message}` };
        }
    }

    async runHealthCheck(checkName) {
        console.log(`🔍 Running health check: ${checkName}`);
        
        try {
            let result;
            switch (checkName) {
                case 'docker-daemon':
                    result = await this.checkDockerDaemon();
                    break;
                case 'container-status':
                    result = await this.checkContainerStatus();
                    break;
                case 'network-connectivity':
                    result = await this.checkNetworkConnectivity();
                    break;
                case 'volume-mounts':
                    result = await this.checkVolumeMounts();
                    break;
                case 'resource-usage':
                    result = await this.checkResourceUsage();
                    break;
                case 'test-execution':
                    result = await this.checkTestExecution();
                    break;
                default:
                    result = { status: 'error', message: `Unknown health check: ${checkName}` };
            }
            
            this.healthResults.checks[checkName] = {
                ...result,
                timestamp: new Date().toISOString()
            };
            
            const emoji = result.status === 'healthy' ? '✅' : 
                         result.status === 'warning' ? '⚠️' : 
                         result.status === 'degraded' ? '🔶' : '❌';
            
            console.log(`${emoji} ${checkName}: ${result.message}`);
            
            return result;
        } catch (error) {
            const result = { status: 'error', message: error.message };
            this.healthResults.checks[checkName] = {
                ...result,
                timestamp: new Date().toISOString()
            };
            console.log(`❌ ${checkName}: ${error.message}`);
            return result;
        }
    }

    async runAllHealthChecks() {
        console.log('🏥 Starting comprehensive Docker health check...');
        await this.claudeFlowHooks('pre-task', { description: 'Docker health check execution' });
        
        const results = await Promise.all(
            this.config.healthChecks.map(check => this.runHealthCheck(check))
        );
        
        // Determine overall health
        const statuses = results.map(r => r.status);
        if (statuses.every(s => s === 'healthy')) {
            this.healthResults.overall = 'healthy';
        } else if (statuses.some(s => s === 'unhealthy' || s === 'error')) {
            this.healthResults.overall = 'unhealthy';
        } else {
            this.healthResults.overall = 'degraded';
        }
        
        // Generate recommendations
        this.generateRecommendations();
        
        return this.healthResults;
    }

    generateRecommendations() {
        const recommendations = [];
        
        for (const [checkName, result] of Object.entries(this.healthResults.checks)) {
            if (result.status === 'unhealthy' || result.status === 'error') {
                switch (checkName) {
                    case 'docker-daemon':
                        recommendations.push('Restart Docker daemon or check Docker installation');
                        break;
                    case 'container-status':
                        recommendations.push('Restart containers with: docker-compose up --force-recreate');
                        break;
                    case 'network-connectivity':
                        recommendations.push('Check Docker network configuration and restart containers');
                        break;
                    case 'volume-mounts':
                        recommendations.push('Verify volume mount paths and permissions');
                        break;
                    case 'resource-usage':
                        recommendations.push('Consider scaling down containers or allocating more resources');
                        break;
                    case 'test-execution':
                        recommendations.push('Check test configuration and dependencies');
                        break;
                }
            }
        }
        
        if (recommendations.length === 0) {
            recommendations.push('All systems healthy - no action required');
        }
        
        this.healthResults.recommendations = recommendations;
    }

    async saveHealthReport() {
        try {
            const reportPath = path.join(process.cwd(), 'reports', 'docker-health-report.json');
            await fs.mkdir(path.dirname(reportPath), { recursive: true });
            await fs.writeFile(reportPath, JSON.stringify(this.healthResults, null, 2));
            console.log(`📊 Health report saved: ${reportPath}`);
        } catch (error) {
            console.warn(`Failed to save health report: ${error.message}`);
        }
    }

    displaySummary() {
        console.log('\n' + '='.repeat(60));
        console.log('🏥 DOCKER HEALTH CHECK SUMMARY');
        console.log('='.repeat(60));
        
        const emoji = this.healthResults.overall === 'healthy' ? '✅' : 
                     this.healthResults.overall === 'degraded' ? '⚠️' : '❌';
        
        console.log(`Overall Status: ${emoji} ${this.healthResults.overall.toUpperCase()}`);
        console.log(`Timestamp: ${this.healthResults.timestamp}`);
        console.log();
        
        console.log('Individual Checks:');
        for (const [checkName, result] of Object.entries(this.healthResults.checks)) {
            const checkEmoji = result.status === 'healthy' ? '✅' : 
                              result.status === 'warning' ? '⚠️' : 
                              result.status === 'degraded' ? '🔶' : '❌';
            console.log(`  ${checkEmoji} ${checkName}: ${result.message}`);
        }
        
        if (this.healthResults.recommendations.length > 0) {
            console.log('\nRecommendations:');
            this.healthResults.recommendations.forEach((rec, index) => {
                console.log(`  ${index + 1}. ${rec}`);
            });
        }
        
        console.log('='.repeat(60));
    }

    async run() {
        try {
            const results = await this.runAllHealthChecks();
            await this.saveHealthReport();
            this.displaySummary();
            
            await this.claudeFlowHooks('post-task', { 
                'task-id': 'docker-health-check',
                results: this.healthResults.overall
            });
            
            // Exit with error code if unhealthy
            if (this.healthResults.overall === 'unhealthy') {
                process.exit(1);
            } else if (this.healthResults.overall === 'degraded') {
                process.exit(2);
            }
            
            console.log('🎉 Docker health check completed successfully!');
            
        } catch (error) {
            console.error('❌ Docker health check failed:', error);
            await this.claudeFlowHooks('error', { error: error.message });
            process.exit(1);
        }
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const healthChecker = new DockerHealthChecker();
    healthChecker.run();
}

export default DockerHealthChecker;