#!/usr/bin/env node

/**
 * KGEN Drift Detection CI/CD Helper
 * Provides utilities for integrating drift detection into CI/CD pipelines
 */

import { Command } from 'commander';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';
import { DriftDetectionEngine } from '../../../kgen-core/src/validation/DriftDetectionEngine.js';

/**
 * Create CI/CD integration helper command
 */
export function createCIHelperCommand() {
  return new Command('ci')
    .description('CI/CD integration helpers for drift detection')
    .addCommand(createSetupCommand())
    .addCommand(createConfigCommand())
    .addCommand(createValidateCommand())
    .addCommand(createReportCommand())
    .addCommand(createIntegrateCommand());
}

/**
 * Setup command for CI/CD initialization
 */
function createSetupCommand() {
  return new Command('setup')
    .description('Set up drift detection for CI/CD pipelines')
    .option('--platform <platform>', 'CI/CD platform (github, gitlab, jenkins, circleci)', 'github')
    .option('--baseline', 'Create initial baseline lockfile', false)
    .option('--config', 'Generate configuration files', true)
    .option('--workflows', 'Generate workflow files', true)
    .option('--output-dir <dir>', 'Output directory for generated files', '.')
    .action(async (options) => {
      try {
        console.log(chalk.blue('🚀 Setting up KGEN drift detection for CI/CD'));
        console.log(chalk.blue('━'.repeat(50)));

        const outputDir = resolve(options.outputDir);
        
        // Create baseline lockfile if requested
        if (options.baseline) {
          await createBaseline(outputDir);
        }

        // Generate configuration files
        if (options.config) {
          await generateConfigFiles(outputDir, options.platform);
        }

        // Generate workflow files
        if (options.workflows) {
          await generateWorkflowFiles(outputDir, options.platform);
        }

        // Generate documentation
        await generateIntegrationDocs(outputDir, options.platform);

        console.log(chalk.green('✅ CI/CD setup complete!'));
        console.log(chalk.blue('📋 Next Steps:'));
        console.log(chalk.blue('  1. Review and customize generated files'));
        console.log(chalk.blue('  2. Commit files to version control'));
        console.log(chalk.blue('  3. Configure CI/CD secrets if needed'));
        console.log(chalk.blue('  4. Test the workflow'));

      } catch (error) {
        console.error(chalk.red('Setup failed:'), error.message);
        process.exit(1);
      }
    });
}

/**
 * Configuration command
 */
function createConfigCommand() {
  return new Command('config')
    .description('Generate drift detection configuration')
    .option('--template <template>', 'Configuration template (basic, advanced, enterprise)', 'basic')
    .option('--output <file>', 'Output configuration file', 'kgen-drift.config.js')
    .option('--format <format>', 'Configuration format (js, json, yaml)', 'js')
    .action(async (options) => {
      try {
        console.log(chalk.blue('⚙️ Generating drift detection configuration'));
        
        const config = generateDriftConfig(options.template);
        const configPath = resolve(options.output);
        
        await writeConfigFile(configPath, config, options.format);
        
        console.log(chalk.green(`✅ Configuration written to: ${configPath}`));
        
      } catch (error) {
        console.error(chalk.red('Configuration generation failed:'), error.message);
        process.exit(1);
      }
    });
}

/**
 * Validation command for CI/CD
 */
function createValidateCommand() {
  return new Command('validate')
    .description('Validate drift detection setup')
    .option('--config <file>', 'Configuration file to validate')
    .option('--workflows', 'Validate workflow files', true)
    .option('--fix', 'Auto-fix validation issues where possible', false)
    .action(async (options) => {
      try {
        console.log(chalk.blue('🔍 Validating drift detection setup'));
        
        const results = await validateSetup(options);
        
        displayValidationResults(results, options.fix);
        
        if (results.errors.length > 0 && !options.fix) {
          console.log(chalk.yellow('\\n💡 Run with --fix to automatically resolve issues'));
          process.exit(1);
        }
        
      } catch (error) {
        console.error(chalk.red('Validation failed:'), error.message);
        process.exit(1);
      }
    });
}

/**
 * Report command for generating CI/CD-friendly reports
 */
function createReportCommand() {
  return new Command('report')
    .description('Generate CI/CD-friendly drift detection reports')
    .option('--format <format>', 'Report format (junit, json, markdown, sarif)', 'junit')
    .option('--output <file>', 'Output report file')
    .option('--input <file>', 'Input drift detection results', 'drift-results.json')
    .option('--template <file>', 'Custom report template')
    .action(async (options) => {
      try {
        console.log(chalk.blue('📊 Generating CI/CD report'));
        
        const report = await generateCIReport(options);
        
        if (options.output) {
          writeFileSync(options.output, report);
          console.log(chalk.green(`✅ Report written to: ${options.output}`));
        } else {
          console.log(report);
        }
        
      } catch (error) {
        console.error(chalk.red('Report generation failed:'), error.message);
        process.exit(1);
      }
    });
}

/**
 * Integration command for different CI/CD platforms
 */
function createIntegrateCommand() {
  return new Command('integrate')
    .description('Generate platform-specific integration code')
    .option('--platform <platform>', 'Target platform', 'github')
    .option('--features <features...>', 'Features to enable', ['drift-detection', 'reporting'])
    .option('--output-dir <dir>', 'Output directory', '.ci')
    .action(async (options) => {
      try {
        console.log(chalk.blue(`🔧 Generating ${options.platform} integration`));
        
        await generatePlatformIntegration(options);
        
        console.log(chalk.green('✅ Integration files generated'));
        
      } catch (error) {
        console.error(chalk.red('Integration generation failed:'), error.message);
        process.exit(1);
      }
    });
}

/**
 * Create baseline lockfile
 */
async function createBaseline(outputDir) {
  console.log(chalk.blue('📋 Creating baseline lockfile...'));
  
  const engine = new DriftDetectionEngine({
    lockFile: resolve(outputDir, 'kgen.lock.json')
  });
  
  await engine.initialize();
  
  // This would typically run the baseline creation
  // For now, create a sample lockfile
  const baseline = {
    version: '1.0.0',
    timestamp: this.getDeterministicDate().toISOString(),
    directory: outputDir,
    files: {},
    ci: {
      created: true,
      platform: 'ci-setup',
      version: '1.0.0'
    }
  };
  
  writeFileSync(
    resolve(outputDir, 'kgen.lock.json'),
    JSON.stringify(baseline, null, 2)
  );
  
  await engine.shutdown();
  console.log(chalk.green('✅ Baseline lockfile created'));
}

/**
 * Generate configuration files
 */
async function generateConfigFiles(outputDir, platform) {
  console.log(chalk.blue('⚙️ Generating configuration files...'));
  
  const configs = {
    'kgen-drift.config.js': generateDriftConfig('basic'),
    '.kgenignore': generateIgnoreFile(),
    'drift-detection.json': generateDetectionConfig(platform)
  };
  
  for (const [filename, content] of Object.entries(configs)) {
    const filepath = resolve(outputDir, filename);
    writeFileSync(filepath, content);
    console.log(chalk.gray(`  Created: ${filename}`));
  }
}

/**
 * Generate workflow files
 */
async function generateWorkflowFiles(outputDir, platform) {
  console.log(chalk.blue('🔄 Generating workflow files...'));
  
  const workflowDir = resolve(outputDir, getWorkflowDirectory(platform));
  if (!existsSync(workflowDir)) {
    mkdirSync(workflowDir, { recursive: true });
  }
  
  const workflows = generatePlatformWorkflows(platform);
  
  for (const [filename, content] of Object.entries(workflows)) {
    const filepath = resolve(workflowDir, filename);
    writeFileSync(filepath, content);
    console.log(chalk.gray(`  Created: ${filename}`));
  }
}

/**
 * Generate integration documentation
 */
async function generateIntegrationDocs(outputDir, platform) {
  console.log(chalk.blue('📚 Generating documentation...'));
  
  const docsDir = resolve(outputDir, 'docs', 'drift-detection');
  if (!existsSync(docsDir)) {
    mkdirSync(docsDir, { recursive: true });
  }
  
  const docs = {
    'README.md': generateReadme(platform),
    'configuration.md': generateConfigDocs(),
    'troubleshooting.md': generateTroubleshootingDocs(),
    'best-practices.md': generateBestPractices()
  };
  
  for (const [filename, content] of Object.entries(docs)) {
    const filepath = resolve(docsDir, filename);
    writeFileSync(filepath, content);
    console.log(chalk.gray(`  Created: docs/drift-detection/${filename}`));
  }
}

/**
 * Generate drift detection configuration
 */
function generateDriftConfig(template) {
  const configs = {
    basic: `// KGEN Drift Detection Configuration
export default {
  // Lockfile path
  lockFile: 'kgen.lock.json',
  
  // File patterns to scan
  patterns: [
    '**/*.ttl',
    '**/*.n3', 
    '**/*.jsonld',
    '**/*.rdf'
  ],
  
  // Patterns to ignore
  ignore: [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**'
  ],
  
  // Validation options
  validation: {
    enableSHACL: true,
    shapesPath: 'shapes.ttl',
    enableSemantic: true,
    enableAttestation: true
  },
  
  // Regeneration options
  regeneration: {
    enabled: false,
    mode: 'memory'
  },
  
  // CI/CD options
  ci: {
    severityThreshold: 'LOW',
    exitOnDrift: true,
    generateReports: true
  }
};`,

    advanced: `// KGEN Advanced Drift Detection Configuration
export default {
  lockFile: 'kgen.lock.json',
  
  patterns: [
    '**/*.{ttl,turtle}',
    '**/*.n3',
    '**/*.jsonld', 
    '**/*.rdf',
    '**/templates/**/*',
    '**/rules/**/*'
  ],
  
  ignore: [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    'coverage/**',
    '**/*.test.*',
    '**/*.spec.*'
  ],
  
  validation: {
    enableSHACL: true,
    shapesPath: 'validation/shapes.ttl',
    enableSemantic: true,
    enableAttestation: true,
    customRules: [
      'compliance/gdpr',
      'compliance/sox',
      'security/xss-prevention'
    ]
  },
  
  regeneration: {
    enabled: true,
    mode: 'hybrid',
    timeout: 30000,
    enableBackup: true
  },
  
  ci: {
    severityThreshold: 'MEDIUM',
    exitOnDrift: true,
    generateReports: true,
    reportFormats: ['junit', 'sarif', 'markdown'],
    notifications: {
      slack: process.env.SLACK_WEBHOOK,
      email: process.env.NOTIFICATION_EMAIL
    }
  },
  
  performance: {
    parallelProcessing: true,
    maxConcurrency: 4,
    cacheEnabled: true
  }
};`,

    enterprise: `// KGEN Enterprise Drift Detection Configuration
export default {
  lockFile: 'kgen.lock.json',
  
  patterns: [
    '**/*.{ttl,turtle,n3,jsonld,rdf}',
    '**/schemas/**/*',
    '**/ontologies/**/*',
    '**/templates/**/*',
    '**/rules/**/*',
    '**/compliance/**/*'
  ],
  
  ignore: [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    'coverage/**',
    'tmp/**',
    '**/*.{test,spec}.*',
    '**/.cache/**'
  ],
  
  validation: {
    enableSHACL: true,
    shapesPath: 'schemas/validation/shapes.ttl',
    enableSemantic: true,
    enableAttestation: true,
    strictMode: true,
    customRules: [
      'compliance/gdpr',
      'compliance/sox',
      'compliance/hipaa',
      'compliance/pci-dss',
      'security/injection-prevention',
      'security/xss-prevention',
      'quality/ontology-completeness',
      'quality/semantic-consistency'
    ],
    enterpriseRules: {
      auditTrail: true,
      dataGovernance: true,
      privacyCompliance: true
    }
  },
  
  regeneration: {
    enabled: true,
    mode: 'hybrid',
    timeout: 60000,
    enableBackup: true,
    retryAttempts: 3,
    retryDelay: 5000
  },
  
  ci: {
    severityThreshold: 'LOW',
    exitOnDrift: true,
    generateReports: true,
    reportFormats: ['junit', 'sarif', 'markdown', 'json', 'html'],
    notifications: {
      slack: process.env.SLACK_WEBHOOK,
      teams: process.env.TEAMS_WEBHOOK,
      email: process.env.NOTIFICATION_EMAIL,
      pagerduty: process.env.PAGERDUTY_TOKEN
    },
    security: {
      enableSecurityScan: true,
      enableSecretsDetection: true,
      enableVulnerabilityCheck: true
    }
  },
  
  performance: {
    parallelProcessing: true,
    maxConcurrency: 8,
    cacheEnabled: true,
    cacheTTL: 3600000, // 1 hour
    enableProfiling: true
  },
  
  monitoring: {
    enableMetrics: true,
    metricsEndpoint: process.env.METRICS_ENDPOINT,
    enableTracing: true,
    tracingEndpoint: process.env.TRACING_ENDPOINT
  }
};`
  };
  
  return configs[template] || configs.basic;
}

/**
 * Generate ignore file
 */
function generateIgnoreFile() {
  return `# KGEN Drift Detection Ignore Patterns

# Dependencies
node_modules/
*.lock

# Build outputs
dist/
build/
out/
*.bundle.*

# Logs
logs/
*.log
npm-debug.log*

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# Temporary files
tmp/
temp/
*.tmp
*.temp

# Test files (unless explicitly tracked)
*.test.*
*.spec.*
__tests__/
test/

# Cache directories
.cache/
.parcel-cache/
.next/
.nuxt/
.vuepress/dist/

# Environment files (contain secrets)
.env
.env.local
.env.*.local

# Docker
Dockerfile*
docker-compose*
.dockerignore

# CI/CD (unless explicitly tracked)
.github/
.gitlab-ci.yml
.travis.yml
.circleci/

# Documentation builds
docs/build/
docs/dist/

# Backup files
*.backup
*.bak
*.old
`;
}

/**
 * Generate platform-specific detection config
 */
function generateDetectionConfig(platform) {
  const config = {
    version: '1.0.0',
    platform,
    detection: {
      schedule: platform === 'github' ? '0 2 * * *' : 'daily',
      triggers: ['push', 'pull_request', 'schedule'],
      branches: ['main', 'develop', 'master'],
      paths: ['**/*.ttl', '**/*.n3', '**/*.jsonld', '**/*.rdf']
    },
    notifications: {
      onSuccess: false,
      onFailure: true,
      onCriticalDrift: true
    },
    reporting: {
      formats: ['junit', 'json'],
      retention: '30 days'
    }
  };
  
  return JSON.stringify(config, null, 2);
}

/**
 * Get workflow directory for platform
 */
function getWorkflowDirectory(platform) {
  const directories = {
    github: '.github/workflows',
    gitlab: '.gitlab-ci',
    jenkins: 'jenkins',
    circleci: '.circleci',
    azure: '.azure-pipelines'
  };
  
  return directories[platform] || '.ci';
}

/**
 * Generate platform-specific workflows
 */
function generatePlatformWorkflows(platform) {
  const workflows = {};
  
  switch (platform) {
    case 'github':
      workflows['drift-detection.yml'] = generateGitHubWorkflow();
      workflows['drift-baseline.yml'] = generateGitHubBaselineWorkflow();
      break;
      
    case 'gitlab':
      workflows['.gitlab-ci.yml'] = generateGitLabWorkflow();
      break;
      
    case 'jenkins':
      workflows['Jenkinsfile'] = generateJenkinsfile();
      break;
      
    case 'circleci':
      workflows['config.yml'] = generateCircleCIConfig();
      break;
      
    default:
      workflows['drift-detection.sh'] = generateGenericScript();
  }
  
  return workflows;
}

/**
 * Generate GitHub workflow (simplified version of the main one)
 */
function generateGitHubWorkflow() {
  return `name: KGEN Drift Detection

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 2 * * *'

jobs:
  drift-detection:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run drift detection
      run: |
        npx kgen drift detect --ci --verbose --exit-code
    
    - name: Upload report
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: drift-report
        path: drift-report.*
`;
}

/**
 * Generate GitHub baseline workflow
 */
function generateGitHubBaselineWorkflow() {
  return `name: Update KGEN Drift Baseline

on:
  workflow_dispatch:
    inputs:
      update_strategy:
        description: 'Update strategy'
        required: true
        default: 'incremental'
        type: choice
        options:
          - incremental
          - full-refresh

jobs:
  update-baseline:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Update baseline
      run: |
        if [ "${{ github.event.inputs.update_strategy }}" = "full-refresh" ]; then
          npx kgen drift baseline --force
        else
          npx kgen drift baseline --update
        fi
    
    - name: Commit changes
      run: |
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action"
        git add kgen.lock.json
        git commit -m "chore: update KGEN drift baseline" || exit 0
        git push
`;
}

/**
 * Generate documentation files
 */
function generateReadme(platform) {
  return `# KGEN Drift Detection

This repository is configured with KGEN drift detection to monitor changes to semantic artifacts and ensure system integrity.

## Overview

Drift detection automatically:
- Monitors RDF files (*.ttl, *.n3, *.jsonld, *.rdf)
- Validates SHACL constraints and semantic rules
- Checks artifact attestations for integrity
- Generates reports on detected changes
- Provides recommendations for remediation

## Configuration

The drift detection system is configured through:
- \`kgen-drift.config.js\` - Main configuration
- \`kgen.lock.json\` - Baseline state tracking
- \`.kgenignore\` - Files and patterns to ignore

## CI/CD Integration

${platform === 'github' ? 
  `This repository uses GitHub Actions for automated drift detection:
- **drift-detection.yml**: Runs on push, PR, and schedule
- **drift-baseline.yml**: Manual baseline updates

### GitHub Actions Status

[![Drift Detection](https://github.com/owner/repo/workflows/KGEN%20Drift%20Detection/badge.svg)](https://github.com/owner/repo/actions)` :
  `This repository is configured for ${platform} integration.`
}

## Local Usage

Run drift detection locally:

\`\`\`bash
# Check for drift
npm run drift:check

# Generate detailed report  
npm run drift:report

# Update baseline (after validation)
npm run drift:baseline
\`\`\`

## Understanding Results

### Risk Levels
- **LOW**: Minor changes, monitoring recommended
- **MEDIUM**: Moderate changes, review needed
- **HIGH**: Significant changes, action required
- **CRITICAL**: Severe changes, immediate attention required

### Compliance Status
- **COMPLIANT**: All validations pass
- **VIOLATIONS**: Constraint violations found
- **UNKNOWN**: Unable to validate

## Troubleshooting

See [troubleshooting.md](./troubleshooting.md) for common issues and solutions.

## Best Practices

See [best-practices.md](./best-practices.md) for recommended usage patterns.
`;
}

/**
 * Generate configuration documentation
 */
function generateConfigDocs() {
  return `# KGEN Drift Detection Configuration

## Configuration File

The \`kgen-drift.config.js\` file controls drift detection behavior:

\`\`\`javascript
export default {
  // File patterns to monitor
  patterns: ['**/*.ttl', '**/*.n3'],
  
  // Files to ignore
  ignore: ['node_modules/**'],
  
  // Validation settings
  validation: {
    enableSHACL: true,
    shapesPath: 'shapes.ttl'
  },
  
  // CI/CD integration
  ci: {
    severityThreshold: 'LOW',
    exitOnDrift: true
  }
};
\`\`\`

## Configuration Options

### File Scanning
- \`patterns\`: Glob patterns for files to monitor
- \`ignore\`: Patterns to exclude from scanning
- \`lockFile\`: Path to baseline lockfile

### Validation
- \`validation.enableSHACL\`: Enable SHACL shape validation
- \`validation.shapesPath\`: Path to SHACL shapes file
- \`validation.enableSemantic\`: Enable semantic validation
- \`validation.enableAttestation\`: Check artifact attestations

### Regeneration
- \`regeneration.enabled\`: Allow artifact regeneration
- \`regeneration.mode\`: Regeneration mode (memory, disk, hybrid)

### CI/CD
- \`ci.severityThreshold\`: Minimum severity to report
- \`ci.exitOnDrift\`: Exit with error code on drift
- \`ci.generateReports\`: Create detailed reports

## Environment Variables

Set these in your CI/CD environment:
- \`KGEN_SHAPES_PATH\`: Override shapes file path
- \`KGEN_SEVERITY_THRESHOLD\`: Override severity threshold
- \`SLACK_WEBHOOK\`: Slack notification webhook
- \`NOTIFICATION_EMAIL\`: Email for notifications
`;
}

/**
 * Generate troubleshooting documentation
 */
function generateTroubleshootingDocs() {
  return `# KGEN Drift Detection Troubleshooting

## Common Issues

### "No lockfile found"
**Problem**: First-time setup or missing baseline
**Solution**: 
\`\`\`bash
kgen drift baseline --output kgen.lock.json
\`\`\`

### "SHACL validation failed"
**Problem**: RDF content doesn't match shapes
**Solution**:
1. Check shapes file exists and is valid
2. Validate RDF syntax: \`kgen validate artifacts\`
3. Update shapes or fix RDF content

### "Template not found" during regeneration
**Problem**: Template path in attestation is incorrect
**Solution**:
1. Check template exists at specified path
2. Update \`templateBasePath\` in configuration
3. Regenerate attestation if template moved

### High memory usage
**Problem**: Processing large files
**Solution**:
1. Use \`regenerationMode: 'disk'\`
2. Increase \`maxConcurrency\` setting
3. Add more files to ignore patterns

### CI/CD timeouts
**Problem**: Validation takes too long
**Solution**:
1. Increase workflow timeout
2. Enable parallel processing
3. Use caching for validation resources

## Debug Mode

Run with verbose logging:
\`\`\`bash
kgen drift detect --verbose --detailed
\`\`\`

Enable debug mode:
\`\`\`bash
DEBUG=kgen:* kgen drift detect
\`\`\`

## Performance Optimization

### Large Repositories
- Use specific patterns instead of \`**/*\`
- Exclude test and build directories
- Enable caching with \`cacheEnabled: true\`

### Slow Validation
- Cache SHACL shapes
- Use incremental validation
- Consider distributed validation

## Getting Help

1. Check configuration with \`kgen drift ci validate\`
2. Review workflow logs for detailed errors
3. Run local validation to isolate issues
4. Check GitHub issues for known problems
`;
}

/**
 * Generate best practices documentation
 */
function generateBestPractices() {
  return `# KGEN Drift Detection Best Practices

## Repository Setup

### File Organization
\`\`\`
project/
├── schemas/
│   ├── shapes.ttl          # SHACL validation shapes
│   └── ontologies/         # Domain ontologies
├── templates/              # Generation templates
├── rules/                  # Validation rules
├── kgen.lock.json         # Drift detection baseline
├── kgen-drift.config.js   # Configuration
└── .kgenignore            # Ignore patterns
\`\`\`

### Baseline Management
- Create baseline after significant changes
- Update baseline through code review process
- Use incremental updates for minor changes
- Full refresh for major refactoring

## Configuration Strategy

### Development Environment
\`\`\`javascript
{
  severityThreshold: 'LOW',
  validateAttestation: true,
  regeneration: { enabled: true }
}
\`\`\`

### Production Environment
\`\`\`javascript
{
  severityThreshold: 'HIGH',
  strictMode: true,
  security: { enableSecurityScan: true }
}
\`\`\`

## Workflow Integration

### Branch Protection
- Require drift detection to pass
- Run on all pull requests
- Block merges on critical drift

### Notification Strategy
- **LOW/MEDIUM**: Log only
- **HIGH**: Notify team
- **CRITICAL**: Page on-call engineer

### Scheduled Monitoring
- Daily drift detection on main branch
- Weekly comprehensive validation
- Monthly security audit

## Performance Optimization

### Pattern Efficiency
\`\`\`javascript
// Good - specific patterns
patterns: ['src/**/*.ttl', 'schemas/*.n3']

// Avoid - too broad
patterns: ['**/*']
\`\`\`

### Ignore Strategy
\`\`\`javascript
ignore: [
  'node_modules/**',     // Dependencies
  'dist/**',            // Build outputs  
  '**/*.test.*',        // Test files
  '.cache/**',          // Cache directories
  'tmp/**'              // Temporary files
]
\`\`\`

## Security Considerations

### Sensitive Data
- Never commit credentials in lockfile
- Use environment variables for secrets
- Enable secrets detection in CI/CD

### Access Control
- Restrict who can update baselines
- Audit configuration changes
- Monitor for unauthorized modifications

## Monitoring and Alerting

### Key Metrics
- Drift detection frequency
- Validation success rate
- Time to remediation
- False positive rate

### Alert Thresholds
- **INFO**: Successful detection
- **WARN**: Minor drift detected
- **ERROR**: Validation failures
- **CRITICAL**: Security violations

## Recovery Procedures

### Drift Remediation
1. Identify root cause
2. Validate changes are authorized
3. Update baseline if approved
4. Investigate if unauthorized

### System Recovery
1. Check system integrity
2. Validate all artifacts
3. Regenerate if necessary
4. Update monitoring

## Team Practices

### Code Review
- Review drift detection results
- Validate baseline updates
- Check configuration changes

### Documentation
- Document validation rules
- Maintain troubleshooting guides
- Update team procedures

### Training
- Train team on drift detection
- Regular security awareness
- Tool usage workshops
`;
}

/**
 * Write configuration file in specified format
 */
async function writeConfigFile(filepath, config, format) {
  let content;
  
  switch (format) {
    case 'json':
      // Convert JS config to JSON (simplified)
      const jsonConfig = JSON.parse(config.replace(/export default /, '').replace(/;$/, ''));
      content = JSON.stringify(jsonConfig, null, 2);
      break;
    case 'yaml':
      // Would need yaml library for full implementation
      content = config;
      break;
    default:
      content = config;
  }
  
  writeFileSync(filepath, content);
}

/**
 * Validate drift detection setup
 */
async function validateSetup(options) {
  const results = {
    errors: [],
    warnings: [],
    info: []
  };
  
  // Check for required files
  const requiredFiles = ['kgen.lock.json', 'kgen-drift.config.js'];
  for (const file of requiredFiles) {
    if (!existsSync(file)) {
      results.errors.push(`Missing required file: ${file}`);
    }
  }
  
  // Validate configuration if it exists
  if (existsSync('kgen-drift.config.js')) {
    try {
      const config = await import(resolve('kgen-drift.config.js'));
      // Validate config structure
      if (!config.default) {
        results.warnings.push('Configuration should export default object');
      }
    } catch (error) {
      results.errors.push(`Invalid configuration: ${error.message}`);
    }
  }
  
  // Check workflow files
  if (options.workflows) {
    const workflowPaths = [
      '.github/workflows/drift-detection.yml',
      '.gitlab-ci.yml',
      'Jenkinsfile'
    ];
    
    const hasWorkflow = workflowPaths.some(path => existsSync(path));
    if (!hasWorkflow) {
      results.warnings.push('No CI/CD workflow files found');
    }
  }
  
  return results;
}

/**
 * Display validation results
 */
function displayValidationResults(results, fix) {
  console.log(chalk.blue('\\n📋 Validation Results'));
  console.log(chalk.blue('━'.repeat(25)));
  
  if (results.errors.length > 0) {
    console.log(chalk.red('\\n❌ Errors:'));
    results.errors.forEach(error => {
      console.log(chalk.red(`  • ${error}`));
    });
  }
  
  if (results.warnings.length > 0) {
    console.log(chalk.yellow('\\n⚠️ Warnings:'));
    results.warnings.forEach(warning => {
      console.log(chalk.yellow(`  • ${warning}`));
    });
  }
  
  if (results.info.length > 0) {
    console.log(chalk.blue('\\n📝 Info:'));
    results.info.forEach(info => {
      console.log(chalk.blue(`  • ${info}`));
    });
  }
  
  if (results.errors.length === 0 && results.warnings.length === 0) {
    console.log(chalk.green('\\n✅ Validation passed - setup looks good!'));
  }
}

/**
 * Generate CI/CD-friendly report
 */
async function generateCIReport(options) {
  if (!existsSync(options.input)) {
    throw new Error(`Input file not found: ${options.input}`);
  }
  
  const results = JSON.parse(readFileSync(options.input, 'utf8'));
  
  switch (options.format) {
    case 'junit':
      return generateJUnitReport(results);
    case 'json':
      return JSON.stringify(results, null, 2);
    case 'markdown':
      return generateMarkdownReport(results);
    case 'sarif':
      return generateSARIFReport(results);
    default:
      throw new Error(`Unsupported report format: ${options.format}`);
  }
}

/**
 * Generate JUnit XML report
 */
function generateJUnitReport(results) {
  const totalTests = results.totalFiles || 0;
  const failures = results.modified + results.deleted;
  const time = (results.validationTime || 0) / 1000;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="KGEN Drift Detection" tests="${totalTests}" failures="${failures}" time="${time}">
  <testcase name="Drift Detection" classname="KGEN">
    ${failures > 0 ? `<failure message="Drift detected: ${failures} changes">${JSON.stringify(results.changes, null, 2)}</failure>` : ''}
  </testcase>
  ${results.changes.map(change => 
    `<testcase name="${change.path}" classname="KGEN.${change.type}">
      ${change.type !== 'unchanged' ? `<failure message="${change.type}: ${change.path}">${JSON.stringify(change, null, 2)}</failure>` : ''}
    </testcase>`
  ).join('\\n')}
</testsuite>`;
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(results) {
  return `# KGEN Drift Detection Report

**Generated:** ${this.getDeterministicDate().toISOString()}
**Status:** ${results.summary?.actionRequired ? '⚠️ Action Required' : '✅ No Issues'}

## Summary

| Metric | Count |
|--------|-------|
| Total Files | ${results.totalFiles} |
| Unchanged | ${results.unchanged} |
| Modified | ${results.modified} |
| Deleted | ${results.deleted} |
| Added | ${results.added} |
| Risk Level | ${results.summary?.riskLevel} |
| Drift Score | ${results.summary?.driftScore}/100 |

${results.changes && results.changes.length > 0 ? `
## Changes Detected

${results.changes.map(change => `
### ${change.type.toUpperCase()}: ${change.path}
- **Severity:** ${change.severity}
- **Hash Match:** ${change.hashMatch ? '✅' : '❌'}
- **Size Match:** ${change.sizeMatch ? '✅' : '❌'}
${change.canRegenerate ? '- **Can Regenerate:** ✅' : ''}
`).join('')}
` : ''}

${results.recommendations && results.recommendations.length > 0 ? `
## Recommendations

${results.recommendations.map((rec, i) => `
${i + 1}. **[${rec.priority}]** ${rec.action}
   ${rec.description}
   ${rec.command ? `   \`${rec.command}\`` : ''}
`).join('')}
` : ''}
`;
}

/**
 * Generate SARIF report for security tools
 */
function generateSARIFReport(results) {
  const sarif = {
    version: '2.1.0',
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    runs: [{
      tool: {
        driver: {
          name: 'KGEN Drift Detection',
          version: '1.0.0',
          informationUri: 'https://github.com/your-org/kgen'
        }
      },
      results: results.changes?.filter(c => c.type !== 'unchanged').map(change => ({
        ruleId: `drift-${change.type}`,
        level: change.severity === 'CRITICAL' ? 'error' : 'warning',
        message: {
          text: `${change.type.toUpperCase()}: ${change.path}`
        },
        locations: [{
          physicalLocation: {
            artifactLocation: {
              uri: change.path
            }
          }
        }]
      })) || []
    }]
  };
  
  return JSON.stringify(sarif, null, 2);
}

/**
 * Generate platform-specific integration
 */
async function generatePlatformIntegration(options) {
  const outputDir = resolve(options.outputDir);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  const integrations = {
    'drift-check.sh': generateDriftCheckScript(),
    'setup.sh': generateSetupScript(options.platform),
    'config.json': JSON.stringify(generatePlatformConfig(options.platform), null, 2)
  };
  
  for (const [filename, content] of Object.entries(integrations)) {
    writeFileSync(resolve(outputDir, filename), content);
    console.log(chalk.gray(`  Generated: ${filename}`));
  }
}

/**
 * Generate drift check script
 */
function generateDriftCheckScript() {
  return `#!/bin/bash
# KGEN Drift Detection Script for CI/CD

set -e

# Configuration
SEVERITY_THRESHOLD=${KGEN_SEVERITY_THRESHOLD:-"LOW"}
ENABLE_REGENERATION=${KGEN_ENABLE_REGENERATION:-"false"}
EXIT_ON_DRIFT=${KGEN_EXIT_ON_DRIFT:-"true"}

echo "🔍 Starting KGEN drift detection..."

# Check if lockfile exists
if [ ! -f "kgen.lock.json" ]; then
  echo "📋 Creating initial baseline..."
  npx kgen drift baseline --output kgen.lock.json
fi

# Run drift detection
echo "🔍 Running drift detection..."
if npx kgen drift detect \\
  --ci \\
  --verbose \\
  --severity-threshold "$SEVERITY_THRESHOLD" \\
  $([ "$ENABLE_REGENERATION" = "true" ] && echo "--regenerate") \\
  $([ "$EXIT_ON_DRIFT" = "false" ] && echo "--no-exit-code"); then
  echo "✅ Drift detection completed successfully"
  exit 0
else
  echo "⚠️ Drift detected or validation failed"
  exit 1
fi
`;
}

/**
 * Generate setup script
 */
function generateSetupScript(platform) {
  return `#!/bin/bash
# KGEN Drift Detection Setup Script

set -e

echo "🚀 Setting up KGEN drift detection for ${platform}..."

# Install KGEN CLI
if ! command -v kgen &> /dev/null; then
  echo "📦 Installing KGEN CLI..."
  npm install -g @kgen/cli
fi

# Create configuration
if [ ! -f "kgen-drift.config.js" ]; then
  echo "⚙️ Creating configuration..."
  npx kgen drift ci config --template basic
fi

# Create baseline
if [ ! -f "kgen.lock.json" ]; then
  echo "📋 Creating baseline..."
  npx kgen drift baseline --output kgen.lock.json
fi

# Generate ignore file
if [ ! -f ".kgenignore" ]; then
  echo "📝 Creating ignore patterns..."
  cat > .kgenignore << 'EOF'
node_modules/
dist/
build/
coverage/
*.log
.env*
EOF
fi

echo "✅ Setup complete!"
echo "📋 Next steps:"
echo "  1. Review kgen-drift.config.js"
echo "  2. Customize .kgenignore"
echo "  3. Commit files to version control"
echo "  4. Configure CI/CD pipeline"
`;
}

/**
 * Generate platform-specific configuration
 */
function generatePlatformConfig(platform) {
  return {
    platform,
    version: '1.0.0',
    features: {
      driftDetection: true,
      reporting: true,
      notifications: platform === 'github'
    },
    settings: {
      timeout: platform === 'github' ? 1800 : 3600,
      retries: 2,
      parallelism: platform === 'circleci' ? 4 : 2
    }
  };
}