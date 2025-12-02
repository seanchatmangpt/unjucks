#!/usr/bin/env node

/**
 * Basic Usage Example: Git-First Config and Lock Management
 * 
 * Demonstrates the complete workflow for using the git-first config
 * and lock management system.
 */

import { join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import {
  ConfigManager,
  loadConfig,
  generateLockFile,
  detectDrift,
  getGitStatus
} from '../../src/config/git-first/index.js';

// Example project setup
const projectRoot = process.cwd();
const exampleDir = join(projectRoot, 'example-project');

async function demonstrateGitFirstConfig() {
  console.log('🚀 Git-First Config and Lock Management Demo\n');
  
  try {
    // 1. Create example project structure
    console.log('1. Setting up example project...');
    
    mkdirSync(exampleDir, { recursive: true });
    mkdirSync(join(exampleDir, 'templates'), { recursive: true });
    mkdirSync(join(exampleDir, 'rules'), { recursive: true });
    
    // Create configuration file
    const config = {
      directories: {
        out: './dist',
        state: './.kgen/state',
        cache: './.kgen/cache',
        templates: './templates',
        rules: './rules'
      },
      generate: {
        defaultTemplate: 'api-service',
        globalVars: {
          author: 'KGEN Demo',
          timestamp: '{{ timestamp }}'
        },
        attestByDefault: true
      },
      drift: {
        onDrift: 'warn',
        autoFix: false
      },
      environments: {
        development: {
          dev: { debug: true, verbose: true },
          cache: { enabled: false }
        },
        production: {
          generate: { parallel: true, maxConcurrency: 8 },
          cache: { enabled: true, maxSize: '1GB' },
          security: { sandbox: true }
        }
      }
    };
    
    writeFileSync(
      join(exampleDir, 'kgen.config.js'),
      `export default ${JSON.stringify(config, null, 2)};`
    );
    
    // Create some template and rule files
    writeFileSync(
      join(exampleDir, 'templates', 'api-service.njk'),
      `/**
 * {{ name }} API Service
 * Generated on {{ timestamp }}
 * Author: {{ author }}
 */

class {{ name }}Service {
  constructor() {
    this.name = '{{ name }}';
  }
  
  async getData() {
    return { message: 'Hello from {{ name }}' };
  }
}

export default {{ name }}Service;
`
    );
    
    writeFileSync(
      join(exampleDir, 'rules', 'validation.n3'),
      `@prefix ex: <http://example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

# Basic validation rules
ex:Service a rdfs:Class ;
  rdfs:label "API Service" ;
  rdfs:comment "Base class for API services" .

ex:hasName a rdf:Property ;
  rdfs:domain ex:Service ;
  rdfs:range xsd:string .
`
    );
    
    writeFileSync(
      join(exampleDir, 'data.ttl'),
      `@prefix ex: <http://example.org/> .

ex:UserService a ex:Service ;
  ex:hasName "User Service" ;
  ex:hasEndpoint "/api/users" .
`
    );
    
    console.log('✅ Project structure created\n');
    
    // 2. Initialize configuration manager
    console.log('2. Initializing configuration manager...');
    
    const manager = new ConfigManager({
      projectRoot: exampleDir,
      env: 'development'
    });
    
    // 3. Load configuration
    console.log('3. Loading configuration...');
    
    const loadedConfig = await manager.loadConfig();
    console.log(`✅ Loaded config from: ${loadedConfig._meta.configPath}`);
    console.log(`   Environment: ${loadedConfig._meta.environment}`);
    console.log(`   Config hash: ${loadedConfig._meta.hash.substring(0, 8)}...\n`);
    
    // 4. Generate lock file
    console.log('4. Generating lock file...');
    
    const lockFile = await manager.updateLock();
    console.log(`✅ Lock file generated (v${lockFile.version})`);
    console.log(`   Templates: ${Object.keys(lockFile.templates).length}`);
    console.log(`   Rules: ${Object.keys(lockFile.rules).length}`);
    console.log(`   Graphs: ${Object.keys(lockFile.graphs).length}`);
    console.log(`   Integrity: ${lockFile.integrity.combined.substring(0, 8)}...\n`);
    
    // 5. Check drift (should be clean initially)
    console.log('5. Checking for drift...');
    
    const drift = await manager.checkDrift();
    console.log(`✅ Drift status: ${drift.status}`);
    console.log(`   Severity: ${drift.severity}`);
    console.log(`   Changes: ${drift.drift?.length || 0}\n`);
    
    // 6. Simulate file modification
    console.log('6. Simulating template modification...');
    
    writeFileSync(
      join(exampleDir, 'templates', 'api-service.njk'),
      `/**
 * {{ name }} API Service - MODIFIED
 * Generated on {{ timestamp }}
 * Author: {{ author }}
 * Version: 2.0
 */

class {{ name }}Service {
  constructor() {
    this.name = '{{ name }}';
    this.version = '2.0';
  }
  
  async getData() {
    return { 
      message: 'Hello from {{ name }}', 
      version: this.version 
    };
  }
}

export default {{ name }}Service;
`
    );
    
    console.log('✅ Template modified\n');
    
    // 7. Check drift again (should detect changes)
    console.log('7. Checking drift after modification...');
    
    const driftAfter = await manager.checkDrift({ details: true });
    console.log(`📊 Drift status: ${driftAfter.status}`);
    console.log(`   Severity: ${driftAfter.severity}`);
    console.log(`   Changes detected: ${driftAfter.drift?.length || 0}`);
    
    if (driftAfter.drift && driftAfter.drift.length > 0) {
      console.log('\n   Change details:');
      for (const change of driftAfter.drift) {
        console.log(`   - ${change.type}: ${change.file}`);
        console.log(`     ${change.description}`);
        if (change.impact && change.impact.length > 0) {
          console.log(`     Impact: ${change.impact.join(', ')}`);
        }
      }
    }
    
    console.log('\n   Recommendations:');
    for (const rec of driftAfter.recommendations || []) {
      console.log(`   - ${rec}`);
    }
    
    console.log();
    
    // 8. Get comprehensive project status
    console.log('8. Getting comprehensive project status...');
    
    const status = await manager.getStatus();
    console.log('📈 Project Status:');
    console.log(`   Config: ${status.config.valid ? '✅' : '❌'} (${status.config.environment})`);
    console.log(`   Lock: ${status.lock ? '✅' : '❌'} ${status.lock ? `(${status.lock.version})` : ''}`);
    console.log(`   Git: ${status.git.isRepo ? '✅' : '❌'} ${status.git.branch || 'N/A'}`);
    console.log(`   Drift: ${status.drift.status} (${status.drift.changes} changes)\n`);
    
    // 9. Validate project
    console.log('9. Validating project configuration...');
    
    const validation = await manager.validate();
    console.log(`🔍 Validation: ${validation.valid ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (validation.errors.length > 0) {
      console.log('   Errors:');
      for (const error of validation.errors) {
        console.log(`   - [${error.type}] ${error.message}`);
      }
    }
    
    if (validation.warnings.length > 0) {
      console.log('   Warnings:');
      for (const warning of validation.warnings) {
        console.log(`   - [${warning.type}] ${warning.message}`);
      }
    }
    
    console.log();
    
    // 10. Demonstrate convenience functions
    console.log('10. Testing convenience functions...');
    
    const quickConfig = await loadConfig({ cwd: exampleDir });
    console.log(`✅ Quick config load: ${quickConfig._meta.environment}`);
    
    const quickDrift = await detectDrift({ projectRoot: exampleDir });
    console.log(`✅ Quick drift check: ${quickDrift.status}`);
    
    const gitStatus = await getGitStatus({ projectRoot: exampleDir });
    console.log(`✅ Git status: ${gitStatus.isRepo ? 'Repository' : 'Not a repository'}\n`);
    
    // 11. Generate final report
    console.log('11. Generating drift report...');
    
    const report = manager.driftDetector.generateReport(driftAfter, {
      format: 'json',
      verbose: true
    });
    
    console.log('📋 Drift Report Generated:');
    console.log(`   Title: ${report.title}`);
    console.log(`   Status: ${report.status}`);
    console.log(`   Total Changes: ${report.summary.totalChanges}`);
    console.log(`   Recommendations: ${report.recommendations.length}`);
    
    if (report.breakdown) {
      console.log('   Breakdown by type:');
      for (const [type, count] of Object.entries(report.breakdown.byType)) {
        console.log(`     ${type}: ${count}`);
      }
    }
    
    console.log('\n🎉 Demo completed successfully!');
    console.log('\n📚 Key takeaways:');
    console.log('   • Configuration loaded from project root only (no cascading)');
    console.log('   • Lock file provides deterministic baseline for drift detection');
    console.log('   • Changes are automatically detected and analyzed');
    console.log('   • Semantic analysis provides impact assessment');
    console.log('   • Git integration enables version control workflow');
    console.log('   • Environment-aware configuration supports different deployment contexts');
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateGitFirstConfig();
}

export { demonstrateGitFirstConfig };
