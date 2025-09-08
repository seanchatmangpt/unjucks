# Build and Deployment Guide

## Table of Contents
1. [Overview](#overview)
2. [Build System](#build-system)
3. [Development Workflow](#development-workflow)
4. [Testing Pipeline](#testing-pipeline)
5. [Deployment Process](#deployment-process)
6. [CI/CD Configuration](#cicd-configuration)
7. [Environment Management](#environment-management)
8. [Monitoring and Alerting](#monitoring-and-alerting)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

## Overview

This guide covers the complete build and deployment process for Unjucks, from local development to production deployment. The system uses modern DevOps practices with automated testing, deployment, and monitoring.

### Build Architecture
- **Multi-stage Build**: Development, testing, and production stages
- **Cross-platform Support**: macOS, Linux, Windows compatibility
- **Module Formats**: ESM and CommonJS support
- **Quality Gates**: Automated testing and validation
- **Security Scanning**: Dependency and code security checks

## Build System

### Build Configuration
The build system is configured through multiple scripts and configuration files:

#### Package.json Scripts
```json
{
  "scripts": {
    "build": "chmod +x bin/unjucks.cjs && chmod +x src/cli/index.js && node scripts/build-system.js",
    "build:validate": "node scripts/build-system.js",
    "build:version": "node scripts/build-with-version.js",
    "build:publish": "node scripts/build-with-version.js --publish",
    "build:dry": "node scripts/build-with-version.js --dry-run",
    "prepublishOnly": "node scripts/pre-publish.js"
  }
}
```

#### Build System Architecture
```
scripts/
├── build-system.js           # Main build orchestrator
├── build-system-minimal.js   # Minimal build for quick iteration
├── build-with-version.js     # Version-aware builds
├── pre-publish.js            # Pre-publish validation
├── smoke-tests.js            # Post-build validation
└── production-test-runner.js # Production readiness tests
```

### Build Process Stages

#### Stage 1: Pre-build Validation
```javascript
// Performed by build-system.js
1. Environment validation
2. Dependency checks
3. Security audit
4. File permissions setup
5. Directory structure validation
```

#### Stage 2: Main Build
```javascript
// Core build operations
1. ESM/CommonJS compatibility setup
2. Binary preparation (bin/unjucks.cjs)
3. CLI module setup (src/cli/index.js)
4. Template processing
5. Asset compilation
```

#### Stage 3: Post-build Validation
```javascript
// Smoke tests and validation
1. CLI functionality tests
2. Template generation tests
3. Cross-platform compatibility
4. Performance benchmarks
5. Integration tests
```

### Build Commands

#### Standard Build
```bash
# Full build with validation
npm run build

# Quick minimal build (development)
npm run build:validate

# Build with version tagging
npm run build:version

# Dry-run build (no side effects)
npm run build:dry
```

#### Advanced Build Options
```bash
# Build with specific version
VERSION=1.2.3 npm run build:version

# Build for specific platform
PLATFORM=linux npm run build

# Build with debug information
DEBUG=1 npm run build

# Build for production deployment
NODE_ENV=production npm run build:publish
```

### Build System Implementation

#### Main Build Script (`scripts/build-system.js`)
```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class BuildSystem {
  constructor(options = {}) {
    this.options = {
      verbose: false,
      skipTests: false,
      production: process.env.NODE_ENV === 'production',
      ...options
    };
    
    this.results = {
      success: false,
      steps: [],
      errors: [],
      warnings: []
    };
  }
  
  async build() {
    console.log('🔨 Starting Unjucks build process...');
    
    try {
      await this.validateEnvironment();
      await this.setupPermissions();
      await this.validateDependencies();
      await this.runSecurityAudit();
      await this.buildCore();
      await this.runTests();
      await this.generateReport();
      
      this.results.success = true;
      console.log('✅ Build completed successfully');
    } catch (error) {
      this.results.errors.push(error.message);
      console.error('❌ Build failed:', error.message);
      process.exit(1);
    }
  }
  
  async validateEnvironment() {
    console.log('🔍 Validating environment...');
    
    // Node.js version check
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 18) {
      throw new Error(`Node.js >=18.0.0 required, found ${nodeVersion}`);
    }
    
    // Required directories
    const requiredDirs = ['src', 'bin', '_templates', 'scripts'];
    for (const dir of requiredDirs) {
      if (!fs.existsSync(dir)) {
        throw new Error(`Required directory missing: ${dir}`);
      }
    }
    
    this.results.steps.push('Environment validation');
  }
  
  async setupPermissions() {
    console.log('🔧 Setting up file permissions...');
    
    try {
      // Make binaries executable
      execSync('chmod +x bin/unjucks.cjs');
      execSync('chmod +x src/cli/index.js');
      
      this.results.steps.push('File permissions setup');
    } catch (error) {
      throw new Error(`Permission setup failed: ${error.message}`);
    }
  }
  
  async validateDependencies() {
    console.log('📦 Validating dependencies...');
    
    try {
      // Check package.json integrity
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      if (!packageJson.dependencies || !packageJson.devDependencies) {
        throw new Error('Invalid package.json structure');
      }
      
      // Verify critical dependencies
      const critical = ['nunjucks', 'n3', 'citty', 'chalk'];
      for (const dep of critical) {
        if (!packageJson.dependencies[dep]) {
          throw new Error(`Critical dependency missing: ${dep}`);
        }
      }
      
      this.results.steps.push('Dependency validation');
    } catch (error) {
      throw new Error(`Dependency validation failed: ${error.message}`);
    }
  }
  
  async runSecurityAudit() {
    if (this.options.skipSecurity) return;
    
    console.log('🔒 Running security audit...');
    
    try {
      execSync('npm audit --audit-level moderate', { stdio: 'pipe' });
      this.results.steps.push('Security audit');
    } catch (error) {
      this.results.warnings.push('Security audit found issues');
    }
  }
  
  async buildCore() {
    console.log('🏗️ Building core modules...');
    
    try {
      // Validate CLI entry points
      this.validateCliEntry('bin/unjucks.cjs');
      this.validateCliEntry('src/cli/index.js');
      
      // Process templates
      this.processTemplates();
      
      this.results.steps.push('Core build');
    } catch (error) {
      throw new Error(`Core build failed: ${error.message}`);
    }
  }
  
  validateCliEntry(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`CLI entry point missing: ${filePath}`);
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (filePath.endsWith('.cjs') && !content.includes('#!/usr/bin/env node')) {
      throw new Error(`Missing shebang in ${filePath}`);
    }
    
    if (filePath.includes('cli/index.js') && !content.includes('defineCommand')) {
      throw new Error(`Invalid CLI structure in ${filePath}`);
    }
  }
  
  processTemplates() {
    const templatesDir = '_templates';
    if (!fs.existsSync(templatesDir)) {
      throw new Error('Templates directory not found');
    }
    
    // Validate template structure
    const generators = fs.readdirSync(templatesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    if (generators.length === 0) {
      this.results.warnings.push('No templates found');
      return;
    }
    
    console.log(`📋 Found ${generators.length} template generators`);
  }
  
  async runTests() {
    if (this.options.skipTests) return;
    
    console.log('🧪 Running tests...');
    
    try {
      // Run smoke tests
      execSync('node scripts/smoke-tests.js', { stdio: 'inherit' });
      this.results.steps.push('Test execution');
    } catch (error) {
      throw new Error(`Tests failed: ${error.message}`);
    }
  }
  
  generateReport() {
    console.log('📊 Generating build report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      success: this.results.success,
      steps: this.results.steps,
      errors: this.results.errors,
      warnings: this.results.warnings,
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
    
    fs.writeFileSync('build-report.json', JSON.stringify(report, null, 2));
    
    console.log(`✅ Build completed ${this.results.steps.length} steps`);
    if (this.results.warnings.length > 0) {
      console.log(`⚠️  ${this.results.warnings.length} warnings`);
    }
  }
}

// Execute if called directly
if (require.main === module) {
  const buildSystem = new BuildSystem({
    verbose: process.argv.includes('--verbose'),
    skipTests: process.argv.includes('--skip-tests'),
    skipSecurity: process.argv.includes('--skip-security')
  });
  
  buildSystem.build().catch(console.error);
}

module.exports = BuildSystem;
```

## Development Workflow

### Local Development Setup
```bash
# Clone repository
git clone https://github.com/unjucks/unjucks.git
cd unjucks

# Install dependencies
npm install

# Link for global development use
npm link

# Run development build
npm run build

# Verify installation
unjucks --version
```

### Development Commands
```bash
# Development server with file watching
npm run dev

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run typecheck
```

### Hot Reload Development
```bash
# Watch CLI changes
node --watch src/cli/index.js

# Watch template changes with auto-rebuild
chokidar "_templates/**/*" -c "npm run build:validate"
```

## Testing Pipeline

### Test Categories
1. **Unit Tests**: Individual component testing
2. **Integration Tests**: Component interaction testing
3. **CLI Tests**: Command-line interface testing
4. **Template Tests**: Template generation testing
5. **Performance Tests**: Benchmark and stress testing

### Test Configuration
```javascript
// vitest.config.js
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    setupFiles: ['./tests/setup.js'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      threshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
});
```

### Test Execution
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:cli           # CLI tests
npm run test:cucumber      # BDD tests
npm run test:performance   # Performance tests
npm run test:production    # Production tests

# Run tests with coverage
npm run test -- --coverage

# Run tests in CI mode
CI=true npm test
```

### Automated Testing Pipeline
```yaml
# .github/workflows/test.yml
name: Test Pipeline

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    
    steps:
    - uses: actions/checkout@v4
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run tests
      run: npm test
    
    - name: Run build
      run: npm run build
    
    - name: Run smoke tests
      run: npm run test:smoke
```

## Deployment Process

### Deployment Stages
1. **Development**: Local development and testing
2. **Staging**: Pre-production validation
3. **Production**: Live deployment

### Version Management
```bash
# Automatic version bumping
npm run version:patch      # 1.0.0 -> 1.0.1
npm run version:minor      # 1.0.0 -> 1.1.0
npm run version:major      # 1.0.0 -> 2.0.0

# Custom version
npm version 1.2.3

# Version with automated build
npm run build:version
```

### Publishing Process
```bash
# Pre-publish validation
npm run prepublishOnly

# Safe publish with validation
npm run publish:safe

# Publish specific version
npm publish --tag beta
npm publish --tag latest
```

### Deployment Script
```javascript
// scripts/deploy.js
const { execSync } = require('child_process');
const fs = require('fs');

class Deployment {
  constructor(environment = 'production') {
    this.env = environment;
    this.config = this.loadConfig();
  }
  
  loadConfig() {
    const configPath = `config/deploy.${this.env}.json`;
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    throw new Error(`Deployment config not found: ${configPath}`);
  }
  
  async deploy() {
    console.log(`🚀 Deploying to ${this.env}...`);
    
    try {
      await this.validatePreDeploy();
      await this.runBuild();
      await this.runTests();
      await this.publish();
      await this.postDeploy();
      
      console.log('✅ Deployment successful');
    } catch (error) {
      console.error('❌ Deployment failed:', error.message);
      await this.rollback();
      process.exit(1);
    }
  }
  
  async validatePreDeploy() {
    // Version validation
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (!packageJson.version) {
      throw new Error('Version not specified in package.json');
    }
    
    // Git validation
    try {
      execSync('git diff --exit-code', { stdio: 'pipe' });
    } catch {
      throw new Error('Uncommitted changes detected');
    }
    
    // Branch validation
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    if (this.env === 'production' && currentBranch !== 'main') {
      throw new Error('Production deployments must be from main branch');
    }
  }
  
  async runBuild() {
    console.log('🔨 Running build...');
    execSync('npm run build', { stdio: 'inherit' });
  }
  
  async runTests() {
    console.log('🧪 Running tests...');
    execSync('npm run test:production', { stdio: 'inherit' });
  }
  
  async publish() {
    console.log('📦 Publishing package...');
    
    if (this.env === 'production') {
      execSync('npm publish', { stdio: 'inherit' });
    } else {
      execSync(`npm publish --tag ${this.env}`, { stdio: 'inherit' });
    }
  }
  
  async postDeploy() {
    // Update documentation
    if (this.config.updateDocs) {
      execSync('npm run docs:update', { stdio: 'inherit' });
    }
    
    // Notify services
    if (this.config.notifications) {
      await this.sendNotifications();
    }
    
    // Create GitHub release
    if (this.env === 'production' && this.config.createRelease) {
      await this.createGitHubRelease();
    }
  }
  
  async rollback() {
    console.log('🔄 Rolling back deployment...');
    // Implement rollback logic
  }
  
  async sendNotifications() {
    // Send deployment notifications
    console.log('📢 Sending deployment notifications...');
  }
  
  async createGitHubRelease() {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const version = packageJson.version;
    
    execSync(`gh release create v${version} --generate-notes`, { stdio: 'inherit' });
  }
}

// Execute deployment
if (require.main === module) {
  const env = process.argv[2] || 'production';
  const deployment = new Deployment(env);
  deployment.deploy().catch(console.error);
}
```

## CI/CD Configuration

### GitHub Actions Workflow
```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
    tags: ['v*']
  pull_request:
    branches: [main]

env:
  NODE_VERSION: 18

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run tests
      run: npm test
    
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: test-results
        path: |
          coverage/
          test-results.xml

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build project
      run: npm run build
    
    - name: Run smoke tests
      run: npm run test:smoke
    
    - name: Upload build artifacts
      uses: actions/upload-artifact@v3
      with:
        name: build-artifacts
        path: |
          bin/
          src/
          _templates/

  deploy:
    if: startsWith(github.ref, 'refs/tags/v')
    needs: [test, build]
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
        registry-url: 'https://registry.npmjs.org'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build for production
      run: NODE_ENV=production npm run build
    
    - name: Run production tests
      run: npm run test:production
    
    - name: Publish to NPM
      run: npm publish
      env:
        NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
    
    - name: Create GitHub Release
      uses: actions/create-release@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        tag_name: ${{ github.ref }}
        release_name: Release ${{ github.ref }}
        draft: false
        prerelease: false

  security:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Run security audit
      run: npm audit --audit-level high
    
    - name: Run CodeQL analysis
      uses: github/codeql-action/init@v2
      with:
        languages: javascript
    
    - name: Perform CodeQL analysis
      uses: github/codeql-action/analyze@v2
```

### Docker Configuration
```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS runtime

RUN addgroup -g 1001 -S nodejs
RUN adduser -S unjucks -u 1001

WORKDIR /app
COPY --from=builder --chown=unjucks:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=unjucks:nodejs /app/bin ./bin
COPY --from=builder --chown=unjucks:nodejs /app/src ./src
COPY --from=builder --chown=unjucks:nodejs /app/_templates ./_templates
COPY --from=builder --chown=unjucks:nodejs /app/package.json ./

USER unjucks

EXPOSE 3000

CMD ["node", "bin/unjucks.cjs"]
```

## Environment Management

### Configuration Files
```javascript
// config/environments.js
module.exports = {
  development: {
    debug: true,
    verbose: true,
    templatesPath: '_templates',
    outputPath: './dev-output'
  },
  
  staging: {
    debug: false,
    verbose: true,
    templatesPath: '_templates',
    outputPath: './staging-output',
    monitoring: {
      enabled: true,
      level: 'info'
    }
  },
  
  production: {
    debug: false,
    verbose: false,
    templatesPath: '_templates',
    outputPath: './output',
    monitoring: {
      enabled: true,
      level: 'error'
    },
    security: {
      auditLevel: 'high',
      requireHttps: true
    }
  }
};
```

### Environment Variables
```bash
# .env.example
NODE_ENV=development
DEBUG=unjucks:*

# Template configuration
UNJUCKS_TEMPLATE_PATH=_templates
UNJUCKS_OUTPUT_PATH=./output
UNJUCKS_AUTHOR=Your Name

# Build configuration
BUILD_VERSION=auto
BUILD_TARGET=production
BUILD_SKIP_TESTS=false

# Deployment configuration
DEPLOY_ENVIRONMENT=production
DEPLOY_DRY_RUN=false
DEPLOY_NOTIFICATIONS=true

# Security
NPM_TOKEN=your-npm-token
GITHUB_TOKEN=your-github-token
```

## Monitoring and Alerting

### Health Checks
```javascript
// scripts/health-check.js
const { execSync } = require('child_process');

class HealthChecker {
  async checkHealth() {
    const checks = [
      this.checkCliAccess,
      this.checkTemplates,
      this.checkDependencies,
      this.checkPerformance
    ];
    
    const results = [];
    
    for (const check of checks) {
      try {
        const result = await check.call(this);
        results.push({ name: check.name, status: 'healthy', ...result });
      } catch (error) {
        results.push({ 
          name: check.name, 
          status: 'unhealthy', 
          error: error.message 
        });
      }
    }
    
    return {
      overall: results.every(r => r.status === 'healthy') ? 'healthy' : 'unhealthy',
      checks: results,
      timestamp: new Date().toISOString()
    };
  }
  
  async checkCliAccess() {
    execSync('unjucks --version', { stdio: 'pipe' });
    return { message: 'CLI accessible' };
  }
  
  async checkTemplates() {
    const output = execSync('unjucks list', { encoding: 'utf8' });
    const templateCount = (output.match(/├─/g) || []).length;
    return { message: `${templateCount} templates available` };
  }
  
  async checkDependencies() {
    execSync('npm audit --audit-level high', { stdio: 'pipe' });
    return { message: 'No high-severity vulnerabilities' };
  }
  
  async checkPerformance() {
    const start = Date.now();
    execSync('unjucks preview component react TestComponent', { stdio: 'pipe' });
    const duration = Date.now() - start;
    
    if (duration > 5000) {
      throw new Error(`Performance degraded: ${duration}ms`);
    }
    
    return { message: `Template preview: ${duration}ms` };
  }
}
```

### Performance Monitoring
```javascript
// scripts/performance-monitor.js
const fs = require('fs');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      buildTime: [],
      testTime: [],
      templateGeneration: [],
      cliStartup: []
    };
  }
  
  async measureBuildTime() {
    const start = Date.now();
    await this.runCommand('npm run build');
    const duration = Date.now() - start;
    
    this.metrics.buildTime.push({
      timestamp: new Date().toISOString(),
      duration
    });
    
    return duration;
  }
  
  async measureTestTime() {
    const start = Date.now();
    await this.runCommand('npm test');
    const duration = Date.now() - start;
    
    this.metrics.testTime.push({
      timestamp: new Date().toISOString(),
      duration
    });
    
    return duration;
  }
  
  async measureTemplateGeneration() {
    const templates = ['component react', 'api endpoint', 'database model'];
    const measurements = [];
    
    for (const template of templates) {
      const start = Date.now();
      await this.runCommand(`unjucks preview ${template} Test`);
      const duration = Date.now() - start;
      
      measurements.push({ template, duration });
    }
    
    this.metrics.templateGeneration.push({
      timestamp: new Date().toISOString(),
      measurements
    });
    
    return measurements;
  }
  
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        avgBuildTime: this.average(this.metrics.buildTime.map(m => m.duration)),
        avgTestTime: this.average(this.metrics.testTime.map(m => m.duration)),
        avgTemplateGeneration: this.averageTemplateGeneration()
      },
      metrics: this.metrics
    };
    
    fs.writeFileSync('performance-report.json', JSON.stringify(report, null, 2));
    return report;
  }
  
  average(numbers) {
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }
  
  averageTemplateGeneration() {
    const allMeasurements = this.metrics.templateGeneration
      .flatMap(entry => entry.measurements)
      .map(m => m.duration);
    
    return this.average(allMeasurements);
  }
}
```

## Troubleshooting

### Common Build Issues

#### Node.js Version Problems
```bash
# Check current Node.js version
node --version

# Update Node.js using nvm
nvm install node
nvm use node

# Or using Homebrew (macOS)
brew upgrade node
```

#### Permission Issues
```bash
# Fix npm permissions (Unix-like systems)
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Alternative: use npm prefix
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

#### Dependency Issues
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for duplicate dependencies
npm ls --depth=0
```

#### Build Failures
```bash
# Enable debug mode
DEBUG=* npm run build

# Skip tests during build
npm run build -- --skip-tests

# Run minimal build
npm run build:validate

# Check build system logs
cat build-report.json
```

### Deployment Issues

#### Publishing Problems
```bash
# Check npm authentication
npm whoami

# Re-authenticate
npm login

# Check package configuration
npm pack --dry-run

# Publish with verbose logging
npm publish --verbose
```

#### Version Conflicts
```bash
# Check current version
npm version

# Reset version
git tag -d v1.0.0
npm version 1.0.1

# Force publish
npm publish --force
```

## Best Practices

### Build Optimization
1. **Caching**: Use build caching for faster builds
2. **Parallel Processing**: Run tests and builds in parallel when possible
3. **Incremental Builds**: Only rebuild changed components
4. **Resource Limits**: Set appropriate memory and CPU limits
5. **Artifact Management**: Clean up old build artifacts

### Security Best Practices
1. **Dependency Scanning**: Regular security audits
2. **Secret Management**: Use environment variables for secrets
3. **Access Control**: Limit deployment permissions
4. **Code Signing**: Sign packages and releases
5. **Vulnerability Monitoring**: Automated vulnerability scanning

### Deployment Best Practices
1. **Blue-Green Deployment**: Zero-downtime deployments
2. **Rollback Strategy**: Quick rollback capabilities
3. **Health Checks**: Comprehensive health monitoring
4. **Gradual Rollout**: Staged deployment releases
5. **Monitoring**: Real-time deployment monitoring

### Performance Optimization
1. **Build Speed**: Optimize build pipeline performance
2. **Test Efficiency**: Parallelize and optimize tests
3. **Resource Usage**: Monitor and optimize resource consumption
4. **Caching Strategy**: Implement effective caching
5. **Bundle Size**: Minimize package size

---

This comprehensive build and deployment guide covers all aspects of the Unjucks development lifecycle. For additional support, refer to the [User Guide](USER_GUIDE.md) and [API Documentation](API_DOCUMENTATION.md).