/**
 * Deterministic Status Command
 * 
 * Checks deterministic system status and capabilities ensuring byte-for-byte reproducibility.
 * Integrates with the deterministic engine for autonomous agent systems.
 */

import { defineCommand } from 'citty';
import { createHash } from 'crypto';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { arch, platform, version as nodeVersion, cpus } from 'os';

export default defineCommand({
  meta: {
    name: 'status',
    description: 'Check deterministic system status and capabilities'
  },
  args: {
    'check-environment': {
      type: 'boolean',
      description: 'Check environment for deterministic compatibility',
      default: true
    },
    'check-dependencies': {
      type: 'boolean',
      description: 'Verify required dependencies are available',
      default: true
    },
    'check-templates': {
      type: 'boolean',
      description: 'Scan and validate available templates',
      default: true
    },
    'check-config': {
      type: 'boolean',
      description: 'Validate system configuration',
      default: true
    },
    'benchmark': {
      type: 'boolean',
      description: 'Run deterministic performance benchmarks',
      default: false
    },
    'output-format': {
      type: 'string',
      description: 'Output format (json|table|detailed)',
      default: 'json'
    },
    'include-system-info': {
      type: 'boolean',
      description: 'Include detailed system information',
      default: true
    }
  },
  async run({ args }) {
    try {
      const startTime = this.getDeterministicTimestamp();
      
      // System information
      const systemInfo = args['include-system-info'] ? await getSystemInfo() : null;
      
      // Environment checks
      const environmentStatus = args['check-environment'] ? await checkEnvironment() : null;
      
      // Dependency checks
      const dependencyStatus = args['check-dependencies'] ? await checkDependencies() : null;
      
      // Template checks
      const templateStatus = args['check-templates'] ? await checkTemplates() : null;
      
      // Configuration checks
      const configStatus = args['check-config'] ? await checkConfiguration() : null;
      
      // Benchmarks
      const benchmarkResults = args.benchmark ? await runBenchmarks() : null;
      
      // Overall status assessment
      const overallStatus = assessOverallStatus({
        environment: environmentStatus,
        dependencies: dependencyStatus,
        templates: templateStatus,
        config: configStatus
      });
      
      const result = {
        success: overallStatus.healthy,
        data: {
          status: {
            healthy: overallStatus.healthy,
            ready: overallStatus.ready,
            issues: overallStatus.issues,
            warnings: overallStatus.warnings
          },
          system: systemInfo,
          environment: environmentStatus,
          dependencies: dependencyStatus,
          templates: templateStatus,
          configuration: configStatus,
          benchmarks: benchmarkResults,
          checkDuration: this.getDeterministicTimestamp() - startTime
        },
        timestamp: this.getDeterministicDate().toISOString()
      };
      
      // Output based on format
      if (args['output-format'] === 'table') {
        outputTableFormat(result);
      } else if (args['output-format'] === 'detailed') {
        outputDetailedFormat(result);
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
      
      return result;
      
    } catch (error) {
      const result = {
        success: false,
        error: {
          message: error.message,
          code: 'STATUS_CHECK_ERROR',
          timestamp: this.getDeterministicDate().toISOString()
        }
      };
      
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }
  }
});

/**
 * Get system information
 */
async function getSystemInfo() {
  try {
    const packageInfo = getPackageInfo();
    
    return {
      node: {
        version: nodeVersion,
        arch: arch(),
        platform: platform()
      },
      hardware: {
        cpus: cpus().length,
        memory: Math.round(require('os').totalmem() / 1024 / 1024 / 1024) + 'GB'
      },
      kgen: {
        version: packageInfo.version,
        location: packageInfo.location
      },
      environment: {
        pwd: process.cwd(),
        user: process.env.USER || process.env.USERNAME || 'unknown',
        shell: process.env.SHELL || 'unknown'
      }
    };
  } catch (error) {
    return {
      error: error.message,
      available: false
    };
  }
}

/**
 * Get package information
 */
function getPackageInfo() {
  try {
    const packagePath = join(process.cwd(), 'package.json');
    if (existsSync(packagePath)) {
      const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
      return {
        version: pkg.version || 'unknown',
        location: packagePath
      };
    }
    
    return {
      version: 'unknown',
      location: 'not found'
    };
  } catch (error) {
    return {
      version: 'error',
      location: error.message
    };
  }
}

/**
 * Check environment for deterministic compatibility
 */
async function checkEnvironment() {
  const checks = [];
  
  // Node.js version check
  const nodeVersionCheck = checkNodeVersion();
  checks.push(nodeVersionCheck);
  
  // Timezone check
  const timezoneCheck = checkTimezone();
  checks.push(timezoneCheck);
  
  // Locale check
  const localeCheck = checkLocale();
  checks.push(localeCheck);
  
  // File system check
  const filesystemCheck = await checkFilesystem();
  checks.push(filesystemCheck);
  
  // Randomness source check
  const randomnessCheck = checkRandomnessSources();
  checks.push(randomnessCheck);
  
  const issues = checks.filter(c => c.status === 'error').length;
  const warnings = checks.filter(c => c.status === 'warning').length;
  
  return {
    overall: issues === 0 ? (warnings === 0 ? 'optimal' : 'acceptable') : 'problematic',
    checks,
    issues,
    warnings
  };
}

/**
 * Check Node.js version compatibility
 */
function checkNodeVersion() {
  const currentVersion = process.version;
  const majorVersion = parseInt(currentVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 14) {
    return {
      name: 'node-version',
      status: 'error',
      message: `Node.js ${currentVersion} is too old. Minimum version: 14.x`,
      current: currentVersion,
      required: '>=14.0.0'
    };
  } else if (majorVersion < 16) {
    return {
      name: 'node-version',
      status: 'warning',
      message: `Node.js ${currentVersion} works but v16+ recommended`,
      current: currentVersion,
      recommended: '>=16.0.0'
    };
  }
  
  return {
    name: 'node-version',
    status: 'ok',
    message: `Node.js ${currentVersion} is compatible`,
    current: currentVersion
  };
}

/**
 * Check timezone settings
 */
function checkTimezone() {
  const timezone = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // For deterministic output, UTC is preferred
  if (timezone !== 'UTC' && process.env.TZ !== 'UTC') {
    return {
      name: 'timezone',
      status: 'warning',
      message: `Timezone is ${timezone}. UTC recommended for deterministic output`,
      current: timezone,
      recommended: 'UTC'
    };
  }
  
  return {
    name: 'timezone',
    status: 'ok',
    message: 'Timezone configuration is optimal for deterministic output',
    current: timezone
  };
}

/**
 * Check locale settings
 */
function checkLocale() {
  const locale = process.env.LANG || process.env.LANGUAGE || 'unknown';
  
  return {
    name: 'locale',
    status: 'info',
    message: `System locale: ${locale}`,
    current: locale,
    note: 'Ensure consistent locale across environments'
  };
}

/**
 * Check filesystem properties
 */
async function checkFilesystem() {
  try {
    const testFile = join(process.cwd(), '.kgen-fs-test');
    const testContent = 'deterministic test content';
    
    // Write test file
    require('fs').writeFileSync(testFile, testContent);
    
    // Read back and verify
    const readContent = require('fs').readFileSync(testFile, 'utf8');
    const hash1 = createHash('sha256').update(readContent).digest('hex');
    
    // Write again with same content
    require('fs').writeFileSync(testFile, testContent);
    const readContent2 = require('fs').readFileSync(testFile, 'utf8');
    const hash2 = createHash('sha256').update(readContent2).digest('hex');
    
    // Cleanup
    require('fs').unlinkSync(testFile);
    
    if (hash1 === hash2) {
      return {
        name: 'filesystem',
        status: 'ok',
        message: 'Filesystem operations are deterministic',
        test: { hash1, hash2, match: true }
      };
    } else {
      return {
        name: 'filesystem',
        status: 'error',
        message: 'Filesystem operations are not deterministic',
        test: { hash1, hash2, match: false }
      };
    }
    
  } catch (error) {
    return {
      name: 'filesystem',
      status: 'error',
      message: `Filesystem test failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Check randomness sources
 */
function checkRandomnessSources() {
  const sources = [];
  
  // Check Math.random consistency (it shouldn't be consistent, but we test it)
  const random1 = Math.random();
  const random2 = Math.random();
  
  sources.push({
    source: 'Math.random',
    consistent: random1 === random2,
    note: 'Should be non-deterministic (values should differ)'
  });
  
  // Check if crypto.randomBytes is available
  try {
    const crypto = require('crypto');
    crypto.randomBytes(16);
    sources.push({
      source: 'crypto.randomBytes',
      available: true,
      note: 'Available for secure randomness when needed'
    });
  } catch (error) {
    sources.push({
      source: 'crypto.randomBytes',
      available: false,
      error: error.message
    });
  }
  
  return {
    name: 'randomness',
    status: 'info',
    message: 'Randomness sources checked',
    sources
  };
}

/**
 * Check dependencies
 */
async function checkDependencies() {
  const dependencies = [
    { name: 'citty', required: true },
    { name: 'glob', required: false },
    { name: 'nunjucks', required: false },
    { name: 'marked', required: false }
  ];
  
  const results = [];
  
  for (const dep of dependencies) {
    try {
      const result = require.resolve(dep.name);
      results.push({
        name: dep.name,
        status: 'available',
        path: result,
        required: dep.required
      });
    } catch (error) {
      results.push({
        name: dep.name,
        status: dep.required ? 'missing' : 'optional-missing',
        error: error.message,
        required: dep.required
      });
    }
  }
  
  const missing = results.filter(r => r.status === 'missing').length;
  const optionalMissing = results.filter(r => r.status === 'optional-missing').length;
  
  return {
    overall: missing === 0 ? 'complete' : 'incomplete',
    results,
    missing,
    optionalMissing
  };
}

/**
 * Check templates
 */
async function checkTemplates() {
  const templateDirs = [
    'templates',
    '_templates',
    'packages/kgen-cli/templates'
  ];
  
  const templateInfo = {
    directories: [],
    totalTemplates: 0,
    byType: {}
  };
  
  for (const dir of templateDirs) {
    if (existsSync(dir)) {
      const templates = await scanTemplateDirectory(dir);
      templateInfo.directories.push({
        path: dir,
        templates: templates.length,
        items: templates
      });
      templateInfo.totalTemplates += templates.length;
    }
  }
  
  return {
    available: templateInfo.totalTemplates > 0,
    info: templateInfo,
    status: templateInfo.totalTemplates > 0 ? 'available' : 'none-found'
  };
}

/**
 * Scan template directory
 */
async function scanTemplateDirectory(dir) {
  try {
    const glob = require('glob');
    const patterns = ['**/*.ejs', '**/*.njk', '**/*.hbs', '**/*.mustache'];
    const templates = [];
    
    for (const pattern of patterns) {
      const files = await glob.glob(pattern, { cwd: dir });
      templates.push(...files.map(f => ({ file: f, type: getTemplateType(f) })));
    }
    
    return templates;
  } catch (error) {
    return [];
  }
}

/**
 * Get template type from file extension
 */
function getTemplateType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const types = {
    'ejs': 'EJS',
    'njk': 'Nunjucks',
    'hbs': 'Handlebars',
    'mustache': 'Mustache'
  };
  
  return types[ext] || 'Unknown';
}

/**
 * Check configuration
 */
async function checkConfiguration() {
  const configFiles = [
    'kgen.config.js',
    'kgen.config.json',
    '.kgenrc',
    'package.json'
  ];
  
  const found = [];
  const missing = [];
  
  for (const configFile of configFiles) {
    if (existsSync(configFile)) {
      try {
        const stat = statSync(configFile);
        found.push({
          file: configFile,
          size: stat.size,
          modified: stat.mtime.toISOString()
        });
      } catch (error) {
        found.push({
          file: configFile,
          error: error.message
        });
      }
    } else {
      missing.push(configFile);
    }
  }
  
  return {
    status: found.length > 0 ? 'configured' : 'default',
    found,
    missing,
    recommendation: found.length === 0 ? 'Consider creating kgen.config.js for project-specific settings' : null
  };
}

/**
 * Run deterministic benchmarks
 */
async function runBenchmarks() {
  const benchmarks = [];
  
  // Hash performance benchmark
  const hashBench = await benchmarkHashing();
  benchmarks.push(hashBench);
  
  // Template rendering benchmark (mock)
  const templateBench = await benchmarkTemplateRendering();
  benchmarks.push(templateBench);
  
  // File I/O benchmark
  const ioBench = await benchmarkFileIO();
  benchmarks.push(ioBench);
  
  return {
    benchmarks,
    totalTime: benchmarks.reduce((sum, b) => sum + b.duration, 0)
  };
}

/**
 * Benchmark hashing performance
 */
async function benchmarkHashing() {
  const startTime = this.getDeterministicTimestamp();
  const iterations = 1000;
  const testData = 'deterministic test data for hashing benchmark';
  
  for (let i = 0; i < iterations; i++) {
    createHash('sha256').update(testData + i).digest('hex');
  }
  
  const duration = this.getDeterministicTimestamp() - startTime;
  
  return {
    name: 'hashing',
    iterations,
    duration,
    rate: Math.round(iterations / (duration / 1000)),
    unit: 'hashes/second'
  };
}

/**
 * Benchmark template rendering (mock)
 */
async function benchmarkTemplateRendering() {
  const startTime = this.getDeterministicTimestamp();
  const iterations = 100;
  
  for (let i = 0; i < iterations; i++) {
    // Mock template rendering
    const template = `Template ${i} with {{ variable }}`;
    const rendered = template.replace('{{ variable }}', `value_${i}`);
    createHash('sha256').update(rendered).digest('hex');
  }
  
  const duration = this.getDeterministicTimestamp() - startTime;
  
  return {
    name: 'template-rendering',
    iterations,
    duration,
    rate: Math.round(iterations / (duration / 1000)),
    unit: 'renders/second'
  };
}

/**
 * Benchmark file I/O
 */
async function benchmarkFileIO() {
  const startTime = this.getDeterministicTimestamp();
  const iterations = 50;
  const testFile = join(process.cwd(), '.kgen-io-bench');
  const testContent = 'benchmark test content';
  
  try {
    for (let i = 0; i < iterations; i++) {
      require('fs').writeFileSync(testFile, testContent + i);
      require('fs').readFileSync(testFile, 'utf8');
    }
    
    const duration = this.getDeterministicTimestamp() - startTime;
    
    // Cleanup
    if (existsSync(testFile)) {
      require('fs').unlinkSync(testFile);
    }
    
    return {
      name: 'file-io',
      iterations: iterations * 2, // read + write
      duration,
      rate: Math.round((iterations * 2) / (duration / 1000)),
      unit: 'operations/second'
    };
    
  } catch (error) {
    return {
      name: 'file-io',
      iterations: 0,
      duration: this.getDeterministicTimestamp() - startTime,
      error: error.message
    };
  }
}

/**
 * Assess overall system status
 */
function assessOverallStatus(checks) {
  let issues = 0;
  let warnings = 0;
  
  Object.values(checks).forEach(check => {
    if (check && check.issues) issues += check.issues;
    if (check && check.warnings) warnings += check.warnings;
  });
  
  const healthy = issues === 0;
  const ready = healthy && warnings < 3;
  
  return {
    healthy,
    ready,
    issues,
    warnings,
    message: healthy 
      ? (ready ? 'System is optimal for deterministic generation' : 'System is healthy with minor warnings')
      : 'System has issues that may affect deterministic generation'
  };
}

/**
 * Output results in table format
 */
function outputTableFormat(result) {
  console.log('\n=== Deterministic System Status ===');
  console.log(`Overall Status: ${result.data.status.healthy ? '✅ HEALTHY' : '❌ ISSUES'}`);
  console.log(`Ready for Use: ${result.data.status.ready ? '✅ YES' : '⚠️  WITH WARNINGS'}`);
  console.log(`Issues: ${result.data.status.issues}`);
  console.log(`Warnings: ${result.data.status.warnings}`);
  
  if (result.data.system) {
    console.log('\n=== System Information ===');
    console.log(`Node.js: ${result.data.system.node.version} (${result.data.system.node.platform}/${result.data.system.node.arch})`);
    console.log(`Hardware: ${result.data.system.hardware.cpus} CPUs, ${result.data.system.hardware.memory}`);
    console.log(`KGen: ${result.data.system.kgen.version}`);
  }
  
  if (result.data.environment) {
    console.log('\n=== Environment Checks ===');
    result.data.environment.checks.forEach(check => {
      const icon = check.status === 'ok' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
      console.log(`${icon} ${check.name}: ${check.message}`);
    });
  }
  
  if (result.data.dependencies) {
    console.log('\n=== Dependencies ===');
    console.log(`Status: ${result.data.dependencies.overall.toUpperCase()}`);
    if (result.data.dependencies.missing > 0) {
      console.log(`Missing required: ${result.data.dependencies.missing}`);
    }
    if (result.data.dependencies.optionalMissing > 0) {
      console.log(`Missing optional: ${result.data.dependencies.optionalMissing}`);
    }
  }
  
  if (result.data.templates) {
    console.log('\n=== Templates ===');
    console.log(`Status: ${result.data.templates.status.toUpperCase()}`);
    console.log(`Total templates: ${result.data.templates.info.totalTemplates}`);
  }
  
  if (result.data.benchmarks) {
    console.log('\n=== Performance Benchmarks ===');
    result.data.benchmarks.benchmarks.forEach(bench => {
      console.log(`${bench.name}: ${bench.rate} ${bench.unit} (${bench.duration}ms)`);
    });
  }
}

/**
 * Output detailed format
 */
function outputDetailedFormat(result) {
  outputTableFormat(result);
  console.log('\n=== Full JSON Results ===');
  console.log(JSON.stringify(result, null, 2));
}