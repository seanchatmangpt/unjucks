#!/usr/bin/env node
/**
 * Advanced CLI Command Tests for @seanchatmangpt/unjucks
 * Deep testing of semantic, swarm, workflow, neural commands
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

class AdvancedCommandTester {
  constructor() {
    this.results = [];
    this.testDir = path.join(os.tmpdir(), 'unjucks-advanced-test-' + Date.now());
    this.originalDir = process.cwd();
  }

  setup() {
    fs.mkdirSync(this.testDir, { recursive: true });
    process.chdir(this.testDir);
    console.log(`🧪 Testing in: ${this.testDir}`);
  }

  cleanup() {
    process.chdir(this.originalDir);
    try {
      fs.rmSync(this.testDir, { recursive: true, force: true });
    } catch (e) {
      console.warn(`⚠️ Could not cleanup: ${e.message}`);
    }
  }

  runCommand(command, expectSuccess = true) {
    try {
      const result = execSync(command, { 
        encoding: 'utf8',
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return {
        success: true,
        stdout: result,
        stderr: '',
        exitCode: 0
      };
    } catch (error) {
      return {
        success: false,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.status || 1
      };
    }
  }

  testCommand(category, name, command, expectedPatterns = []) {
    console.log(`🧪 Testing ${category}: ${name}`);
    console.log(`   Command: ${command}`);
    
    const result = this.runCommand(command);
    const test = {
      category,
      name,
      command,
      result,
      expectedPatterns,
      passed: result.success,
      timestamp: new Date().toISOString()
    };

    // Check for expected patterns in output
    if (result.success && expectedPatterns.length > 0) {
      const output = (result.stdout + result.stderr).toLowerCase();
      const patternsFound = expectedPatterns.every(pattern => 
        output.includes(pattern.toLowerCase())
      );
      test.passed = patternsFound;
      test.patternCheck = patternsFound ? 'PASS' : 'FAIL';
    }

    if (test.passed) {
      console.log('   ✅ PASSED');
    } else {
      console.log('   ❌ FAILED');
      if (result.stderr) console.log(`      Error: ${result.stderr.slice(0, 200)}`);
    }

    this.results.push(test);
    console.log('');
    return test;
  }

  async testSemanticCommands() {
    console.log('🧠 Testing Semantic Web Commands...\n');

    this.testCommand('Semantic', 'Basic help', 'unjucks semantic --help', ['semantic', 'rdf']);
    
    this.testCommand('Semantic', 'Generate help', 'unjucks semantic generate --help', ['generate', 'ontology']);
    
    this.testCommand('Semantic', 'Validate help', 'unjucks semantic validate --help', ['validate']);
    
    this.testCommand('Semantic', 'Query help', 'unjucks semantic query --help', ['query', 'sparql']);
    
    // Test actual semantic generation (may require setup)
    fs.writeFileSync('test-ontology.ttl', `
@prefix ex: <http://example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Person a rdfs:Class .
ex:name a rdfs:Property .
    `);
    
    this.testCommand('Semantic', 'Generate from ontology', 
      'unjucks semantic generate --input test-ontology.ttl --output generated/ --format typescript',
      ['generated']);
  }

  async testSwarmCommands() {
    console.log('🤖 Testing Swarm Coordination Commands...\n');

    this.testCommand('Swarm', 'Basic help', 'unjucks swarm --help', ['swarm', 'agent']);
    
    this.testCommand('Swarm', 'Init help', 'unjucks swarm init --help', ['topology']);
    
    this.testCommand('Swarm', 'Status help', 'unjucks swarm status --help', ['status']);
    
    this.testCommand('Swarm', 'Agent help', 'unjucks swarm agent --help', ['agent']);
    
    // Test swarm initialization
    this.testCommand('Swarm', 'Initialize mesh topology', 
      'unjucks swarm init --topology mesh --agents 3',
      ['mesh', 'initialized']);
    
    this.testCommand('Swarm', 'Agent spawn', 
      'unjucks swarm agent spawn --type coder --name test-agent',
      ['agent', 'spawned']);
    
    this.testCommand('Swarm', 'Swarm status', 'unjucks swarm status', ['status']);
  }

  async testWorkflowCommands() {
    console.log('⚡ Testing Workflow Automation Commands...\n');

    this.testCommand('Workflow', 'Basic help', 'unjucks workflow --help', ['workflow']);
    
    this.testCommand('Workflow', 'Create help', 'unjucks workflow create --help', ['create']);
    
    this.testCommand('Workflow', 'List help', 'unjucks workflow list --help', ['list']);
    
    this.testCommand('Workflow', 'Run help', 'unjucks workflow run --help', ['run']);
    
    // Test workflow creation
    const workflowConfig = {
      name: 'test-workflow',
      steps: [
        { name: 'setup', command: 'npm install' },
        { name: 'test', command: 'npm test' },
        { name: 'build', command: 'npm run build' }
      ]
    };
    
    fs.writeFileSync('workflow.json', JSON.stringify(workflowConfig, null, 2));
    
    this.testCommand('Workflow', 'Create workflow', 
      'unjucks workflow create --config workflow.json',
      ['workflow', 'created']);
    
    this.testCommand('Workflow', 'List workflows', 'unjucks workflow list', ['workflow']);
  }

  async testPerfCommands() {
    console.log('⚡ Testing Performance Analysis Commands...\n');

    this.testCommand('Perf', 'Basic help', 'unjucks perf --help', ['performance']);
    
    this.testCommand('Perf', 'Benchmark help', 'unjucks perf benchmark --help', ['benchmark']);
    
    this.testCommand('Perf', 'Profile help', 'unjucks perf profile --help', ['profile']);
    
    this.testCommand('Perf', 'Analyze help', 'unjucks perf analyze --help', ['analyze']);
    
    // Test performance benchmarking
    this.testCommand('Perf', 'Run benchmarks', 
      'unjucks perf benchmark --suite template-generation --iterations 10',
      ['benchmark', 'completed']);
    
    this.testCommand('Perf', 'Memory analysis', 
      'unjucks perf analyze --type memory',
      ['memory']);
  }

  async testGithubCommands() {
    console.log('🐙 Testing GitHub Integration Commands...\n');

    this.testCommand('GitHub', 'Basic help', 'unjucks github --help', ['github']);
    
    this.testCommand('GitHub', 'Sync help', 'unjucks github sync --help', ['sync']);
    
    this.testCommand('GitHub', 'Clone help', 'unjucks github clone --help', ['clone']);
    
    this.testCommand('GitHub', 'PR help', 'unjucks github pr --help', ['pull request', 'pr']);
    
    this.testCommand('GitHub', 'Issue help', 'unjucks github issue --help', ['issue']);
    
    // Test GitHub operations (without actual API calls)
    this.testCommand('GitHub', 'Repository analysis', 
      'unjucks github analyze --repo seanchatmangpt/unjucks --dry-run',
      ['analysis']);
  }

  async testKnowledgeCommands() {
    console.log('🧠 Testing Knowledge Management Commands...\n');

    this.testCommand('Knowledge', 'Basic help', 'unjucks knowledge --help', ['knowledge']);
    
    this.testCommand('Knowledge', 'Import help', 'unjucks knowledge import --help', ['import']);
    
    this.testCommand('Knowledge', 'Query help', 'unjucks knowledge query --help', ['query']);
    
    this.testCommand('Knowledge', 'Export help', 'unjucks knowledge export --help', ['export']);
    
    // Test knowledge operations
    this.testCommand('Knowledge', 'Create knowledge base', 
      'unjucks knowledge create --name test-kb --type rdf',
      ['knowledge', 'created']);
  }

  async testNeuralCommands() {
    console.log('🤖 Testing Neural AI Commands...\n');

    this.testCommand('Neural', 'Basic help', 'unjucks neural --help', ['neural']);
    
    this.testCommand('Neural', 'Train help', 'unjucks neural train --help', ['train']);
    
    this.testCommand('Neural', 'Predict help', 'unjucks neural predict --help', ['predict']);
    
    this.testCommand('Neural', 'Model help', 'unjucks neural model --help', ['model']);
    
    // Test neural operations
    this.testCommand('Neural', 'Create model', 
      'unjucks neural model create --name test-model --type transformer',
      ['model', 'created']);
  }

  async testMigrateCommands() {
    console.log('🔄 Testing Migration Commands...\n');

    this.testCommand('Migrate', 'Basic help', 'unjucks migrate --help', ['migrate']);
    
    this.testCommand('Migrate', 'Database help', 'unjucks migrate database --help', ['database']);
    
    this.testCommand('Migrate', 'Project help', 'unjucks migrate project --help', ['project']);
    
    // Test migration operations
    this.testCommand('Migrate', 'Create migration', 
      'unjucks migrate create --name test-migration --type database',
      ['migration']);
  }

  generateReport() {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    const report = {
      summary: {
        total,
        passed,
        failed,
        success_rate: ((passed / total) * 100).toFixed(2)
      },
      timestamp: new Date().toISOString(),
      results: this.results,
      categories: {}
    };

    // Group by category
    this.results.forEach(result => {
      if (!report.categories[result.category]) {
        report.categories[result.category] = { tests: [], passed: 0, failed: 0 };
      }
      report.categories[result.category].tests.push(result);
      if (result.passed) {
        report.categories[result.category].passed++;
      } else {
        report.categories[result.category].failed++;
      }
    });

    fs.writeFileSync('advanced-cli-test-report.json', JSON.stringify(report, null, 2));
    
    console.log('📊 ADVANCED CLI TEST SUMMARY');
    console.log('==============================');
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${report.summary.success_rate}%`);
    
    console.log('\n📋 By Category:');
    Object.entries(report.categories).forEach(([category, stats]) => {
      console.log(`  ${category}: ${stats.passed}/${stats.tests.length} passed`);
    });
    
    console.log(`\nDetailed report saved to: advanced-cli-test-report.json`);

    return report;
  }

  async runAllTests() {
    try {
      this.setup();
      
      await this.testSemanticCommands();
      await this.testSwarmCommands();
      await this.testWorkflowCommands();
      await this.testPerfCommands();
      await this.testGithubCommands();
      await this.testKnowledgeCommands();
      await this.testNeuralCommands();
      await this.testMigrateCommands();

      const report = this.generateReport();
      
      this.cleanup();
      
      return report;
    } catch (error) {
      console.error('❌ Advanced test execution failed:', error);
      this.cleanup();
      throw error;
    }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new AdvancedCommandTester();
  tester.runAllTests()
    .then(report => {
      process.exit(report.summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default AdvancedCommandTester;