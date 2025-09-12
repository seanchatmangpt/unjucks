#!/usr/bin/env node
/**
 * Comprehensive Health Check for unjucks Docker containers
 * Container Specialist #3 - Advanced monitoring and validation
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class HealthChecker {
    constructor() {
        this.checks = [];
        this.results = {
            passed: 0,
            failed: 0,
            warnings: 0,
            details: []
        };
        this.isProduction = process.env.NODE_ENV === 'production';
        this.isTesting = process.env.NODE_ENV === 'test';
    }

    addCheck(name, checkFn, critical = true) {
        this.checks.push({ name, checkFn, critical });
    }

    async runCheck(check) {
        const start = this.getDeterministicTimestamp();
        try {
            const result = await check.checkFn();
            const duration = this.getDeterministicTimestamp() - start;
            
            if (result.success) {
                this.results.passed++;
                this.results.details.push({
                    name: check.name,
                    status: 'PASS',
                    duration,
                    message: result.message || 'OK',
                    critical: check.critical
                });
                return true;
            } else {
                if (check.critical) {
                    this.results.failed++;
                } else {
                    this.results.warnings++;
                }
                this.results.details.push({
                    name: check.name,
                    status: check.critical ? 'FAIL' : 'WARN',
                    duration,
                    message: result.message || 'Check failed',
                    error: result.error,
                    critical: check.critical
                });
                return false;
            }
        } catch (error) {
            const duration = this.getDeterministicTimestamp() - start;
            if (check.critical) {
                this.results.failed++;
            } else {
                this.results.warnings++;
            }
            this.results.details.push({
                name: check.name,
                status: check.critical ? 'FAIL' : 'WARN',
                duration,
                message: 'Check threw exception',
                error: error.message,
                critical: check.critical
            });
            return false;
        }
    }

    async executeCommand(command, args = [], timeout = 5000) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: timeout
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                resolve({
                    code,
                    stdout: stdout.trim(),
                    stderr: stderr.trim()
                });
            });

            child.on('error', (error) => {
                reject(error);
            });

            // Timeout handling
            setTimeout(() => {
                child.kill('SIGTERM');
                reject(new Error(`Command timeout after ${timeout}ms`));
            }, timeout);
        });
    }

    async setupChecks() {
        // 1. Node.js environment check
        this.addCheck('Node.js Runtime', async () => {
            try {
                const version = process.version;
                const major = parseInt(version.slice(1).split('.')[0]);
                
                if (major >= 18) {
                    return {
                        success: true,
                        message: `Node.js ${version} - Compatible`
                    };
                } else {
                    return {
                        success: false,
                        message: `Node.js ${version} - Requires v18+`
                    };
                }
            } catch (error) {
                return {
                    success: false,
                    message: 'Node.js version check failed',
                    error: error.message
                };
            }
        });

        // 2. Application files check
        this.addCheck('Application Files', async () => {
            const requiredFiles = [
                '/app/package.json',
                '/app/bin/unjucks.cjs'
            ];

            if (!this.isProduction) {
                requiredFiles.push(
                    '/app/src/cli/index.js',
                    '/app/tests'
                );
            }

            for (const file of requiredFiles) {
                if (!fs.existsSync(file)) {
                    return {
                        success: false,
                        message: `Required file missing: ${file}`
                    };
                }
            }

            return {
                success: true,
                message: `All ${requiredFiles.length} required files present`
            };
        });

        // 3. CLI functionality check
        this.addCheck('CLI Functionality', async () => {
            try {
                const result = await this.executeCommand('node', ['/app/bin/unjucks.cjs', '--version']);
                
                if (result.code === 0 && result.stdout) {
                    return {
                        success: true,
                        message: `CLI working - ${result.stdout}`
                    };
                } else {
                    return {
                        success: false,
                        message: 'CLI version command failed',
                        error: result.stderr
                    };
                }
            } catch (error) {
                return {
                    success: false,
                    message: 'CLI execution failed',
                    error: error.message
                };
            }
        });

        // 4. Memory usage check
        this.addCheck('Memory Usage', async () => {
            const usage = process.memoryUsage();
            const heapUsed = Math.round(usage.heapUsed / 1024 / 1024);
            const heapTotal = Math.round(usage.heapTotal / 1024 / 1024);
            const external = Math.round(usage.external / 1024 / 1024);
            
            // Warn if heap usage > 500MB, fail if > 1GB
            if (heapUsed > 1024) {
                return {
                    success: false,
                    message: `High memory usage: ${heapUsed}MB heap, ${external}MB external`
                };
            } else if (heapUsed > 500) {
                return {
                    success: true,
                    message: `Moderate memory usage: ${heapUsed}MB heap, ${external}MB external`
                };
            } else {
                return {
                    success: true,
                    message: `Normal memory usage: ${heapUsed}MB heap, ${external}MB external`
                };
            }
        }, false); // Non-critical

        // 5. File system permissions check
        this.addCheck('File Permissions', async () => {
            try {
                // Check if we can write to temp directory
                const tempFile = '/tmp/health-check-test';
                fs.writeFileSync(tempFile, 'test');
                fs.unlinkSync(tempFile);

                // Check if binary is executable
                const stats = fs.statSync('/app/bin/unjucks.cjs');
                const isExecutable = !!(stats.mode & parseInt('111', 8));

                if (isExecutable) {
                    return {
                        success: true,
                        message: 'File permissions correct'
                    };
                } else {
                    return {
                        success: false,
                        message: 'Binary not executable'
                    };
                }
            } catch (error) {
                return {
                    success: false,
                    message: 'Permission check failed',
                    error: error.message
                };
            }
        });

        // 6. Dependencies check (production only)
        if (this.isProduction) {
            this.addCheck('Production Dependencies', async () => {
                try {
                    const packageJson = JSON.parse(fs.readFileSync('/app/package.json', 'utf8'));
                    const deps = Object.keys(packageJson.dependencies || {});
                    
                    // Check if node_modules exists and has expected structure
                    if (!fs.existsSync('/app/node_modules')) {
                        return {
                            success: false,
                            message: 'node_modules directory missing'
                        };
                    }

                    // Sample a few critical dependencies
                    const criticalDeps = ['nunjucks', 'citty', 'consola'];
                    const missing = [];
                    
                    for (const dep of criticalDeps) {
                        if (!fs.existsSync(`/app/node_modules/${dep}`)) {
                            missing.push(dep);
                        }
                    }

                    if (missing.length > 0) {
                        return {
                            success: false,
                            message: `Critical dependencies missing: ${missing.join(', ')}`
                        };
                    }

                    return {
                        success: true,
                        message: `Dependencies OK (${deps.length} total)`
                    };
                } catch (error) {
                    return {
                        success: false,
                        message: 'Dependency check failed',
                        error: error.message
                    };
                }
            });
        }

        // 7. Template system check
        this.addCheck('Template System', async () => {
            try {
                const result = await this.executeCommand('node', ['/app/bin/unjucks.cjs', 'list'], 3000);
                
                if (result.code === 0) {
                    return {
                        success: true,
                        message: 'Template system functional'
                    };
                } else {
                    return {
                        success: false,
                        message: 'Template list command failed',
                        error: result.stderr
                    };
                }
            } catch (error) {
                return {
                    success: false,
                    message: 'Template system check failed',
                    error: error.message
                };
            }
        }, false); // Non-critical for basic health

        // 8. Test environment specific checks
        if (this.isTesting) {
            this.addCheck('Test Environment', async () => {
                const testDirs = ['/app/tests', '/app/features'];
                const missingDirs = testDirs.filter(dir => !fs.existsSync(dir));
                
                if (missingDirs.length > 0) {
                    return {
                        success: false,
                        message: `Test directories missing: ${missingDirs.join(', ')}`
                    };
                }

                return {
                    success: true,
                    message: 'Test environment ready'
                };
            });
        }

        // 9. Security check - ensure running as non-root
        this.addCheck('Security Check', async () => {
            const uid = process.getuid ? process.getuid() : null;
            const gid = process.getgid ? process.getgid() : null;
            
            if (uid === 0) {
                return {
                    success: false,
                    message: 'Running as root user - security risk'
                };
            } else if (uid === 1001) {
                return {
                    success: true,
                    message: `Running as user ${uid}:${gid} (unjucks user)`
                };
            } else {
                return {
                    success: true,
                    message: `Running as non-root user ${uid}:${gid}`
                };
            }
        });
    }

    async run() {
        console.log('🏥 unjucks Health Check Starting...');
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`Platform: ${process.platform}`);
        console.log(`Node.js: ${process.version}`);
        console.log('─'.repeat(50));

        await this.setupChecks();

        const startTime = this.getDeterministicTimestamp();
        
        for (const check of this.checks) {
            await this.runCheck(check);
        }

        const totalTime = this.getDeterministicTimestamp() - startTime;
        
        // Print results
        console.log('\n📊 Health Check Results:');
        console.log('─'.repeat(50));
        
        this.results.details.forEach(detail => {
            const icon = detail.status === 'PASS' ? '✅' : 
                        detail.status === 'WARN' ? '⚠️' : '❌';
            const duration = `${detail.duration}ms`.padEnd(6);
            console.log(`${icon} [${duration}] ${detail.name}: ${detail.message}`);
            if (detail.error) {
                console.log(`   Error: ${detail.error}`);
            }
        });

        console.log('─'.repeat(50));
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`⚠️  Warnings: ${this.results.warnings}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`⏱️  Total time: ${totalTime}ms`);

        // Write detailed results to file if in test environment
        if (this.isTesting && fs.existsSync('/app/test-results')) {
            const reportPath = '/app/test-results/health-check.json';
            fs.writeFileSync(reportPath, JSON.stringify({
                timestamp: this.getDeterministicDate().toISOString(),
                environment: process.env.NODE_ENV,
                duration: totalTime,
                summary: {
                    passed: this.results.passed,
                    warnings: this.results.warnings,
                    failed: this.results.failed,
                    total: this.checks.length
                },
                details: this.results.details
            }, null, 2));
            console.log(`📄 Detailed report: ${reportPath}`);
        }

        // Exit with appropriate code
        if (this.results.failed > 0) {
            console.log('\n❌ Health check FAILED');
            process.exit(1);
        } else if (this.results.warnings > 0) {
            console.log('\n⚠️  Health check passed with WARNINGS');
            process.exit(0);
        } else {
            console.log('\n✅ Health check PASSED');
            process.exit(0);
        }
    }
}

// Run health check if called directly
if (require.main === module) {
    const checker = new HealthChecker();
    checker.run().catch(error => {
        console.error('❌ Health check crashed:', error);
        process.exit(1);
    });
}

module.exports = HealthChecker;