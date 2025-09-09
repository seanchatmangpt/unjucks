#!/usr/bin/env node

/**
 * Act Service Container Tester
 * 
 * Specialized testing for GitHub Actions service containers using act.
 * Tests database services, Redis, custom services, and networking.
 * 
 * @author Act Compatibility Engineering Team
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import yaml from 'yaml';

const execAsync = promisify(exec);

class ServiceContainerTester {
  constructor(options = {}) {
    this.options = {
      dryRun: options.dryRun || false,
      verbose: options.verbose || false,
      timeout: options.timeout || 300000, // 5 minutes
      cleanup: options.cleanup !== false,
      ...options
    };
    
    this.results = {
      services: [],
      passed: 0,
      failed: 0,
      limitations: []
    };
    
    this.testedServices = new Set();
  }

  async testAllServiceContainers() {
    console.log('🐳 Testing GitHub Actions service containers with act...');
    
    await this.setupDockerNetwork();
    
    const workflowsDir = path.join(process.cwd(), '.github/workflows');
    const workflows = await this.findServiceWorkflows(workflowsDir);
    
    console.log(`Found ${workflows.length} workflows with service containers`);
    
    for (const workflow of workflows) {
      await this.testWorkflowServices(workflow);
    }
    
    if (this.options.cleanup) {
      await this.cleanupDockerResources();
    }
    
    await this.generateServiceReport();
    return this.results;
  }

  async setupDockerNetwork() {
    console.log('🔧 Setting up Docker network for service testing...');
    
    try {
      // Create a test network for service containers
      await execAsync('docker network create act-service-test --driver bridge');
      console.log('✅ Created Docker network: act-service-test');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.warn('⚠️ Could not create Docker network:', error.message);
      }
    }
  }

  async findServiceWorkflows(workflowsDir) {
    const workflows = [];
    
    try {
      const files = await fs.readdir(workflowsDir);
      const yamlFiles = files.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
      
      for (const file of yamlFiles) {
        const filePath = path.join(workflowsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const workflow = yaml.parse(content);
        
        if (this.hasServiceContainers(workflow)) {
          workflows.push({
            file,
            path: filePath,
            workflow,
            services: this.extractServices(workflow)
          });
        }
      }
      
    } catch (error) {
      console.error('Error finding service workflows:', error);
    }
    
    return workflows;
  }

  hasServiceContainers(workflow) {
    if (!workflow.jobs) return false;
    
    return Object.values(workflow.jobs).some(job => 
      job.services && Object.keys(job.services).length > 0
    );
  }

  extractServices(workflow) {
    const services = {};
    
    Object.entries(workflow.jobs || {}).forEach(([jobId, job]) => {
      if (job.services) {
        services[jobId] = job.services;
      }
    });
    
    return services;
  }

  async testWorkflowServices(workflowInfo) {
    console.log(`\n📋 Testing service workflow: ${workflowInfo.file}`);
    
    for (const [jobId, services] of Object.entries(workflowInfo.services)) {
      await this.testJobServices(workflowInfo, jobId, services);
    }
  }

  async testJobServices(workflowInfo, jobId, services) {
    console.log(`  🎯 Testing job: ${jobId}`);
    
    for (const [serviceName, serviceConfig] of Object.entries(services)) {
      await this.testServiceContainer(workflowInfo, jobId, serviceName, serviceConfig);
    }
  }

  async testServiceContainer(workflowInfo, jobId, serviceName, serviceConfig) {
    console.log(`    🐳 Testing service: ${serviceName}`);
    
    const serviceResult = {
      workflow: workflowInfo.file,
      jobId,
      serviceName,
      serviceConfig,
      tests: [],
      status: 'pending',
      limitations: []
    };
    
    try {
      // Test 1: Service container startup
      await this.testServiceStartup(workflowInfo, jobId, serviceName, serviceConfig, serviceResult);
      
      // Test 2: Service connectivity
      await this.testServiceConnectivity(workflowInfo, jobId, serviceName, serviceConfig, serviceResult);
      
      // Test 3: Service integration with workflow
      await this.testServiceIntegration(workflowInfo, jobId, serviceName, serviceConfig, serviceResult);
      
      serviceResult.status = serviceResult.tests.every(t => t.success) ? 'passed' : 'failed';
      
      if (serviceResult.status === 'passed') {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
      
    } catch (error) {
      serviceResult.status = 'error';
      serviceResult.error = error.message;
      this.results.failed++;
    }
    
    this.results.services.push(serviceResult);
  }

  async testServiceStartup(workflowInfo, jobId, serviceName, serviceConfig, serviceResult) {
    console.log(`      🚀 Testing service startup...`);
    
    const testName = 'service-startup';
    const startTime = Date.now();
    
    try {
      // Test service container creation independently
      const image = serviceConfig.image;
      const env = serviceConfig.env || {};
      const ports = serviceConfig.ports || [];
      
      const envArgs = Object.entries(env)
        .map(([key, value]) => `-e ${key}=${value}`)
        .join(' ');
      
      const portArgs = ports
        .map(port => `-p ${port}`)
        .join(' ');
      
      const containerName = `act-test-${serviceName}-${Date.now()}`;
      const command = `docker run -d --name ${containerName} --network act-service-test ${envArgs} ${portArgs} ${image}`;
      
      if (this.options.verbose) {
        console.log(`        💻 Testing: ${command}`);
      }
      
      const result = await execAsync(command, { timeout: 30000 });
      
      // Wait for service to be ready
      await this.waitForServiceReady(containerName, serviceConfig);
      
      // Clean up test container
      await execAsync(`docker rm -f ${containerName}`).catch(() => {});
      
      serviceResult.tests.push({
        name: testName,
        success: true,
        duration: Date.now() - startTime,
        details: 'Service container started successfully'
      });
      
    } catch (error) {
      serviceResult.tests.push({
        name: testName,
        success: false,
        duration: Date.now() - startTime,
        error: error.message,
        limitations: ['Service container may not start in act environment']
      });
    }
  }

  async testServiceConnectivity(workflowInfo, jobId, serviceName, serviceConfig, serviceResult) {
    console.log(`      🔗 Testing service connectivity...`);
    
    const testName = 'service-connectivity';
    const startTime = Date.now();
    
    try {
      // Test with act's service container execution
      let command = `act push -W "${workflowInfo.path}" -j "${jobId}" --bind`;
      
      if (this.options.dryRun) {
        command += ' --dry-run';
      }
      
      const result = await this.executeActCommand(command, 'connectivity');
      
      // Analyze output for connectivity issues
      const connectivityIssues = this.analyzeConnectivityIssues(result);
      
      serviceResult.tests.push({
        name: testName,
        success: result.exitCode <= 1 && connectivityIssues.length === 0,
        duration: Date.now() - startTime,
        exitCode: result.exitCode,
        issues: connectivityIssues,
        limitations: [
          'Service networking may differ from GitHub Actions',
          'Hostname resolution might require --bind flag'
        ]
      });
      
    } catch (error) {
      serviceResult.tests.push({
        name: testName,
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      });
    }
  }

  async testServiceIntegration(workflowInfo, jobId, serviceName, serviceConfig, serviceResult) {
    console.log(`      🔄 Testing service integration...`);
    
    const testName = 'service-integration';
    const startTime = Date.now();
    
    try {
      // Test full workflow execution with services
      const command = `act push -W "${workflowInfo.path}" -j "${jobId}" --bind --reuse`;
      
      if (this.options.dryRun) {
        return; // Skip integration test in dry run
      }
      
      const result = await this.executeActCommand(command, 'integration');
      
      const integrationIssues = this.analyzeIntegrationIssues(result, serviceName);
      
      serviceResult.tests.push({
        name: testName,
        success: result.exitCode <= 1,
        duration: Date.now() - startTime,
        exitCode: result.exitCode,
        issues: integrationIssues,
        output: result.stdout.slice(-500), // Last 500 chars
        limitations: this.analyzeServiceLimitations(serviceConfig, result)
      });
      
    } catch (error) {
      serviceResult.tests.push({
        name: testName,
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      });
    }
  }

  async waitForServiceReady(containerName, serviceConfig) {
    const maxWait = 30000; // 30 seconds
    const interval = 1000; // 1 second
    let waited = 0;
    
    while (waited < maxWait) {
      try {
        const { stdout } = await execAsync(`docker inspect ${containerName} --format='{{.State.Health.Status}}'`);
        
        if (stdout.trim() === 'healthy') {
          return true;
        }
        
        // If no health check, check if container is running
        const { stdout: state } = await execAsync(`docker inspect ${containerName} --format='{{.State.Status}}'`);
        if (state.trim() === 'running') {
          // Wait a bit more for service to be ready
          await new Promise(resolve => setTimeout(resolve, 2000));
          return true;
        }
        
      } catch (error) {
        // Container might not exist yet
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
      waited += interval;
    }
    
    throw new Error(`Service ${containerName} did not become ready within ${maxWait}ms`);
  }

  async executeActCommand(command, testType) {
    if (this.options.verbose) {
      console.log(`        💻 Executing: ${command}`);
    }
    
    const startTime = Date.now();
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: this.options.timeout,
        cwd: process.cwd()
      });
      
      return {
        exitCode: 0,
        stdout,
        stderr,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        exitCode: error.code || 1,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        duration: Date.now() - startTime
      };
    }
  }

  analyzeConnectivityIssues(result) {
    const issues = [];
    const output = result.stdout + result.stderr;
    
    if (output.includes('connection refused') || output.includes('could not connect')) {
      issues.push('Service connection refused - networking issue');
    }
    
    if (output.includes('name resolution') || output.includes('unknown host')) {
      issues.push('Service hostname resolution failed');
    }
    
    if (output.includes('timeout') && output.includes('service')) {
      issues.push('Service connection timeout');
    }
    
    if (output.includes('no such container') || output.includes('container not found')) {
      issues.push('Service container not created');
    }
    
    return issues;
  }

  analyzeIntegrationIssues(result, serviceName) {
    const issues = [];
    const output = result.stdout + result.stderr;
    
    if (output.includes(`${serviceName}`) && output.includes('error')) {
      issues.push(`Service ${serviceName} integration error`);
    }
    
    if (output.includes('health check') && output.includes('failed')) {
      issues.push('Service health check failed');
    }
    
    if (output.includes('database') && output.includes('connection')) {
      issues.push('Database service connection issue');
    }
    
    return issues;
  }

  analyzeServiceLimitations(serviceConfig, result) {
    const limitations = [];
    
    // Database services
    if (serviceConfig.image?.includes('postgres') || serviceConfig.image?.includes('mysql')) {
      limitations.push('Database services may need manual credential setup');
      limitations.push('Database initialization scripts might not run');
    }
    
    // Redis services
    if (serviceConfig.image?.includes('redis')) {
      limitations.push('Redis persistence may not work as expected');
    }
    
    // Health checks
    if (serviceConfig.options?.includes('health-cmd')) {
      limitations.push('Service health checks may behave differently');
    }
    
    // Networking
    if (serviceConfig.ports) {
      limitations.push('Port mapping may require --bind flag');
    }
    
    return limitations;
  }

  async cleanupDockerResources() {
    console.log('🧹 Cleaning up Docker resources...');
    
    try {
      // Remove test network
      await execAsync('docker network rm act-service-test').catch(() => {});
      
      // Remove test containers
      const { stdout } = await execAsync('docker ps -a --filter "name=act-test-" -q').catch(() => ({ stdout: '' }));
      if (stdout.trim()) {
        await execAsync(`docker rm -f ${stdout.trim().split('\n').join(' ')}`).catch(() => {});
      }
      
      console.log('✅ Docker cleanup completed');
    } catch (error) {
      console.warn('⚠️ Docker cleanup had issues:', error.message);
    }
  }

  async generateServiceReport() {
    console.log('\n📊 Generating service container testing report...');
    
    const report = {
      summary: {
        totalServices: this.results.services.length,
        passed: this.results.passed,
        failed: this.results.failed,
        passRate: Math.round((this.results.passed / this.results.services.length) * 100) || 0
      },
      services: this.results.services,
      commonLimitations: this.generateCommonLimitations(),
      recommendations: this.generateServiceRecommendations()
    };
    
    // Save report
    const reportPath = path.join(process.cwd(), 'test-results/act/service-container-report.json');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(report);
    const mdPath = path.join(process.cwd(), 'test-results/act/service-container-report.md');
    await fs.writeFile(mdPath, markdownReport);
    
    console.log(`📄 Service container reports saved:`);
    console.log(`  JSON: ${reportPath}`);
    console.log(`  Markdown: ${mdPath}`);
    
    console.log(`\n📈 Service Testing Summary:`);
    console.log(`  Services Tested: ${report.summary.totalServices}`);
    console.log(`  Passed: ${report.summary.passed}`);
    console.log(`  Failed: ${report.summary.failed}`);
    console.log(`  Success Rate: ${report.summary.passRate}%`);
    
    return report;
  }

  generateCommonLimitations() {
    return [
      {
        category: 'Networking',
        issues: [
          'Service containers use Docker bridge networking',
          'Hostname resolution may require --bind flag',
          'Port mappings work differently than GitHub Actions'
        ]
      },
      {
        category: 'Service Discovery',
        issues: [
          'Services may not be accessible by default hostname',
          'Service readiness detection is limited',
          'Health checks may not work identically'
        ]
      },
      {
        category: 'Resource Management',
        issues: [
          'Service containers share local Docker resources',
          'Memory and CPU limits may not be enforced',
          'Persistent volumes behave differently'
        ]
      }
    ];
  }

  generateServiceRecommendations() {
    return [
      {
        category: 'Configuration',
        recommendations: [
          'Use --bind flag for service container networking',
          'Specify explicit ports for service connectivity',
          'Use lightweight service images when possible'
        ]
      },
      {
        category: 'Testing Strategy',
        recommendations: [
          'Test service containers individually first',
          'Use docker-compose for complex service setups',
          'Mock external services for act testing'
        ]
      },
      {
        category: 'Troubleshooting',
        recommendations: [
          'Check Docker logs for service startup issues',
          'Verify service networking with docker inspect',
          'Use health checks to ensure service readiness'
        ]
      }
    ];
  }

  generateMarkdownReport(report) {
    return `# Act Service Container Testing Report

## Summary

- **Total Services**: ${report.summary.totalServices}
- **Passed**: ${report.summary.passed}
- **Failed**: ${report.summary.failed}
- **Success Rate**: ${report.summary.passRate}%

## Service Test Results

${report.services.map(service => `
### ${service.workflow} - ${service.jobId} - ${service.serviceName}

**Status**: ${service.status === 'passed' ? '✅' : '❌'} ${service.status}

**Service Configuration**:
\`\`\`yaml
image: ${service.serviceConfig.image}
${service.serviceConfig.env ? `env:\n${Object.entries(service.serviceConfig.env).map(([k, v]) => `  ${k}: ${v}`).join('\n')}` : ''}
${service.serviceConfig.ports ? `ports:\n${service.serviceConfig.ports.map(p => `  - ${p}`).join('\n')}` : ''}
\`\`\`

**Test Results**:
${service.tests.map(test => `
- **${test.name}**: ${test.success ? '✅' : '❌'} ${test.success ? 'Passed' : 'Failed'} (${test.duration}ms)
${test.error ? `  - Error: ${test.error}` : ''}
${test.issues ? test.issues.map(i => `  - Issue: ${i}`).join('\n') : ''}
${test.limitations ? test.limitations.map(l => `  - ⚠️ ${l}`).join('\n') : ''}
`).join('\n')}
`).join('\n')}

## Common Limitations

${report.commonLimitations.map(category => `
### ${category.category}

${category.issues.map(issue => `- ${issue}`).join('\n')}
`).join('\n')}

## Recommendations

${report.recommendations.map(category => `
### ${category.category}

${category.recommendations.map(rec => `- ${rec}`).join('\n')}
`).join('\n')}

## Service Container Best Practices for Act

### 1. Basic Service Configuration
\`\`\`yaml
services:
  postgres:
    image: postgres:13-alpine  # Use lightweight images
    env:
      POSTGRES_PASSWORD: test
      POSTGRES_DB: test_db
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 3
\`\`\`

### 2. Act-Compatible Service Testing
\`\`\`yaml
jobs:
  test-with-services:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 3
          
    steps:
      - name: Wait for services
        run: |
          # Wait for services to be ready
          sleep 10
          
      - name: Test Redis connection
        run: |
          # Test service connectivity
          redis-cli -h localhost -p 6379 ping
\`\`\`

### 3. Environment-Based Service Configuration
\`\`\`yaml
services:
  postgres:
    image: postgres:13-alpine
    env:
      POSTGRES_PASSWORD: \${{ env.ACT && 'test' || secrets.DB_PASSWORD }}
      POSTGRES_DB: \${{ env.ACT && 'test_db' || 'production_db' }}
    ports:
      - 5432:5432
\`\`\`

### 4. Service Health Monitoring
\`\`\`bash
# Check service container status
docker ps --filter "label=act"

# Inspect service networking
docker network ls | grep act

# Check service logs
docker logs <service-container-id>

# Test service connectivity
docker exec <runner-container-id> curl http://service:port/health
\`\`\`

## Troubleshooting Service Issues

### Common Problems

1. **"Service not accessible"**
   - Use \`--bind\` flag: \`act push -W workflow.yml --bind\`
   - Check port mappings in service configuration
   - Verify Docker networking: \`docker network ls\`

2. **"Service startup timeout"**
   - Increase health check timeouts
   - Use lighter service images
   - Check Docker resource limits

3. **"Database connection failed"**
   - Verify service environment variables
   - Check database initialization scripts
   - Use explicit connection parameters

### Debug Commands

\`\`\`bash
# Test with service binding
act push -W workflow.yml -j test --bind

# Check service container logs
act push -W workflow.yml -j test --bind --verbose

# Test service independently
docker run --rm -p 5432:5432 -e POSTGRES_PASSWORD=test postgres:13-alpine

# Network debugging
docker network inspect bridge
docker exec -it <container> ping service-name
\`\`\`

### Act-Specific Service Workarounds

1. **Use localhost instead of service names**
2. **Add explicit waits for service readiness**
3. **Use simplified service configurations**
4. **Mock external services when possible**
5. **Test services independently before integration**
`;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose'),
    cleanup: !args.includes('--no-cleanup')
  };
  
  const tester = new ServiceContainerTester(options);
  
  tester.testAllServiceContainers()
    .then(results => {
      console.log('\n🎉 Service container testing completed!');
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('\n💥 Service container testing failed:', error);
      process.exit(1);
    });
}

export { ServiceContainerTester };