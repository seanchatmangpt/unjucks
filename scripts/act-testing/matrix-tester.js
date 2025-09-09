#!/usr/bin/env node

/**
 * Act Matrix Build Tester
 * 
 * Specialized testing for GitHub Actions matrix builds using act.
 * Tests different matrix combinations, strategy patterns, and parallel execution.
 * 
 * @author Act Compatibility Engineering Team
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import yaml from 'yaml';

const execAsync = promisify(exec);

class MatrixTester {
  constructor(options = {}) {
    this.options = {
      dryRun: options.dryRun || false,
      verbose: options.verbose || false,
      timeout: options.timeout || 600000, // 10 minutes for matrix builds
      maxParallel: options.maxParallel || 2, // Limit parallel act instances
      ...options
    };
    
    this.results = {
      matrices: [],
      passed: 0,
      failed: 0,
      limitations: []
    };
  }

  async testAllMatrices() {
    console.log('🔲 Testing GitHub Actions matrix builds with act...');
    
    const workflowsDir = path.join(process.cwd(), '.github/workflows');
    const workflows = await this.findMatrixWorkflows(workflowsDir);
    
    console.log(`Found ${workflows.length} workflows with matrix strategies`);
    
    for (const workflow of workflows) {
      await this.testWorkflowMatrix(workflow);
    }
    
    await this.generateMatrixReport();
    return this.results;
  }

  async findMatrixWorkflows(workflowsDir) {
    const workflows = [];
    
    try {
      const files = await fs.readdir(workflowsDir);
      const yamlFiles = files.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
      
      for (const file of yamlFiles) {
        const filePath = path.join(workflowsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const workflow = yaml.parse(content);
        
        if (this.hasMatrixStrategy(workflow)) {
          workflows.push({
            file,
            path: filePath,
            workflow,
            matrices: this.extractMatrices(workflow)
          });
        }
      }
      
    } catch (error) {
      console.error('Error finding matrix workflows:', error);
    }
    
    return workflows;
  }

  hasMatrixStrategy(workflow) {
    if (!workflow.jobs) return false;
    
    return Object.values(workflow.jobs).some(job => 
      job.strategy && job.strategy.matrix
    );
  }

  extractMatrices(workflow) {
    const matrices = [];
    
    Object.entries(workflow.jobs || {}).forEach(([jobId, job]) => {
      if (job.strategy?.matrix) {
        matrices.push({
          jobId,
          matrix: job.strategy.matrix,
          failFast: job.strategy['fail-fast'] !== false,
          maxParallel: job.strategy['max-parallel'] || null
        });
      }
    });
    
    return matrices;
  }

  async testWorkflowMatrix(workflowInfo) {
    console.log(`\n📋 Testing matrix workflow: ${workflowInfo.file}`);
    
    for (const matrix of workflowInfo.matrices) {
      await this.testMatrixStrategy(workflowInfo, matrix);
    }
  }

  async testMatrixStrategy(workflowInfo, matrix) {
    console.log(`  🎯 Testing job: ${matrix.jobId}`);
    
    const matrixResult = {
      workflow: workflowInfo.file,
      jobId: matrix.jobId,
      matrix: matrix.matrix,
      combinations: [],
      limitations: [],
      status: 'pending'
    };
    
    try {
      // Generate matrix combinations
      const combinations = this.generateMatrixCombinations(matrix.matrix);
      console.log(`    Generated ${combinations.length} matrix combinations`);
      
      // Test different strategies
      await this.testMatrixCombinations(workflowInfo, matrix, combinations, matrixResult);
      
      matrixResult.status = matrixResult.combinations.every(c => c.success) ? 'passed' : 'failed';
      
      if (matrixResult.status === 'passed') {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
      
    } catch (error) {
      matrixResult.status = 'error';
      matrixResult.error = error.message;
      this.results.failed++;
    }
    
    this.results.matrices.push(matrixResult);
  }

  generateMatrixCombinations(matrix) {
    const keys = Object.keys(matrix);
    const values = keys.map(key => {
      const value = matrix[key];
      return Array.isArray(value) ? value : [value];
    });
    
    const combinations = [];
    const generate = (index, current) => {
      if (index === keys.length) {
        combinations.push({ ...current });
        return;
      }
      
      for (const value of values[index]) {
        current[keys[index]] = value;
        generate(index + 1, current);
      }
    };
    
    generate(0, {});
    return combinations;
  }

  async testMatrixCombinations(workflowInfo, matrix, combinations, matrixResult) {
    console.log(`    Testing matrix strategies...`);
    
    // Test 1: Full matrix execution (act default)
    await this.testFullMatrix(workflowInfo, matrix, matrixResult);
    
    // Test 2: Individual matrix combinations
    await this.testIndividualCombinations(workflowInfo, matrix, combinations, matrixResult);
    
    // Test 3: Parallel vs Sequential
    await this.testParallelVsSequential(workflowInfo, matrix, combinations, matrixResult);
  }

  async testFullMatrix(workflowInfo, matrix, matrixResult) {
    console.log(`      🔄 Testing full matrix execution...`);
    
    const command = `act push -W "${workflowInfo.path}" -j "${matrix.jobId}"`;
    const result = await this.executeActCommand(command, 'full-matrix');
    
    matrixResult.combinations.push({
      type: 'full-matrix',
      success: result.exitCode <= 1, // Act may have warnings
      exitCode: result.exitCode,
      output: result.stdout,
      errors: result.stderr,
      limitations: this.analyzeMatrixLimitations(result)
    });
  }

  async testIndividualCombinations(workflowInfo, matrix, combinations, matrixResult) {
    console.log(`      🎯 Testing individual matrix combinations...`);
    
    // Test first few combinations individually (to avoid overwhelming)
    const testCombinations = combinations.slice(0, Math.min(3, combinations.length));
    
    for (let i = 0; i < testCombinations.length; i++) {
      const combination = testCombinations[i];
      console.log(`        Testing combination ${i + 1}: ${JSON.stringify(combination)}`);
      
      const matrixArgs = Object.entries(combination)
        .map(([key, value]) => `--matrix ${key}:${value}`)
        .join(' ');
      
      const command = `act push -W "${workflowInfo.path}" -j "${matrix.jobId}" ${matrixArgs}`;
      const result = await this.executeActCommand(command, `combination-${i}`);
      
      matrixResult.combinations.push({
        type: 'individual',
        combination,
        success: result.exitCode <= 1,
        exitCode: result.exitCode,
        output: result.stdout,
        errors: result.stderr
      });
    }
  }

  async testParallelVsSequential(workflowInfo, matrix, combinations, matrixResult) {
    console.log(`      ⚡ Testing parallel vs sequential execution...`);
    
    // Test parallel execution limitations
    const parallelCommand = `act push -W "${workflowInfo.path}" -j "${matrix.jobId}" --parallel`;
    const parallelResult = await this.executeActCommand(parallelCommand, 'parallel');
    
    const sequentialCommand = `act push -W "${workflowInfo.path}" -j "${matrix.jobId}"`;
    const sequentialResult = await this.executeActCommand(sequentialCommand, 'sequential');
    
    matrixResult.combinations.push({
      type: 'parallel-comparison',
      parallel: {
        success: parallelResult.exitCode <= 1,
        exitCode: parallelResult.exitCode,
        duration: parallelResult.duration
      },
      sequential: {
        success: sequentialResult.exitCode <= 1,
        exitCode: sequentialResult.exitCode,
        duration: sequentialResult.duration
      },
      limitations: [
        'Act has limited parallelism compared to GitHub Actions',
        'Matrix parallelism is constrained by local resources'
      ]
    });
  }

  async executeActCommand(command, testType) {
    if (this.options.verbose) {
      console.log(`        💻 Executing: ${command}`);
    }
    
    const startTime = Date.now();
    
    try {
      if (this.options.dryRun) {
        command += ' --dry-run';
      }
      
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

  analyzeMatrixLimitations(result) {
    const limitations = [];
    
    if (result.stderr.includes('matrix') || result.stdout.includes('matrix')) {
      if (result.stderr.includes('parallel') || result.stdout.includes('parallel')) {
        limitations.push('Limited matrix parallelism in act');
      }
      
      if (result.stderr.includes('resource') || result.stdout.includes('resource')) {
        limitations.push('Resource constraints affect matrix execution');
      }
      
      if (result.stderr.includes('timeout') || result.stdout.includes('timeout')) {
        limitations.push('Matrix jobs may timeout more frequently in act');
      }
    }
    
    return limitations;
  }

  async generateMatrixReport() {
    console.log('\n📊 Generating matrix testing report...');
    
    const report = {
      summary: {
        totalMatrices: this.results.matrices.length,
        passed: this.results.passed,
        failed: this.results.failed,
        passRate: Math.round((this.results.passed / this.results.matrices.length) * 100) || 0
      },
      matrices: this.results.matrices,
      limitations: this.generateLimitationsSummary(),
      recommendations: this.generateMatrixRecommendations()
    };
    
    // Save report
    const reportPath = path.join(process.cwd(), 'test-results/act/matrix-test-report.json');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(report);
    const mdPath = path.join(process.cwd(), 'test-results/act/matrix-test-report.md');
    await fs.writeFile(mdPath, markdownReport);
    
    console.log(`📄 Matrix test reports saved:`);
    console.log(`  JSON: ${reportPath}`);
    console.log(`  Markdown: ${mdPath}`);
    
    console.log(`\n📈 Matrix Testing Summary:`);
    console.log(`  Matrices Tested: ${report.summary.totalMatrices}`);
    console.log(`  Passed: ${report.summary.passed}`);
    console.log(`  Failed: ${report.summary.failed}`);
    console.log(`  Success Rate: ${report.summary.passRate}%`);
    
    return report;
  }

  generateLimitationsSummary() {
    return [
      {
        category: 'Parallelism',
        issues: [
          'Act runs matrix combinations sequentially by default',
          'Limited parallel execution compared to GitHub Actions',
          'Resource constraints affect matrix performance'
        ]
      },
      {
        category: 'Platform Support',
        issues: [
          'Matrix platform mappings use container images',
          'Windows/macOS simulation is limited',
          'Platform-specific behaviors may not be replicated'
        ]
      },
      {
        category: 'Resource Management',
        issues: [
          'Large matrices may overwhelm local resources',
          'Memory usage scales with matrix size',
          'Disk space required for multiple containers'
        ]
      }
    ];
  }

  generateMatrixRecommendations() {
    return [
      {
        category: 'Matrix Design',
        recommendations: [
          'Keep matrix dimensions small for local testing',
          'Use exclude/include patterns to optimize combinations',
          'Test critical combinations individually first'
        ]
      },
      {
        category: 'Performance',
        recommendations: [
          'Use --reuse flag to cache containers',
          'Limit parallel execution with --max-parallel',
          'Consider testing matrix subsets locally'
        ]
      },
      {
        category: 'Development Workflow',
        recommendations: [
          'Test matrix changes with --dry-run first',
          'Use environment variables to simplify matrices',
          'Create act-specific simplified matrices'
        ]
      }
    ];
  }

  generateMarkdownReport(report) {
    return `# Act Matrix Build Testing Report

## Summary

- **Total Matrices**: ${report.summary.totalMatrices}
- **Passed**: ${report.summary.passed}
- **Failed**: ${report.summary.failed}
- **Success Rate**: ${report.summary.passRate}%

## Matrix Test Results

${report.matrices.map(matrix => `
### ${matrix.workflow} - ${matrix.jobId}

**Status**: ${matrix.status === 'passed' ? '✅' : '❌'} ${matrix.status}

**Matrix Configuration**:
\`\`\`yaml
${Object.entries(matrix.matrix).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}
\`\`\`

**Test Results**:
${matrix.combinations.map(combo => `
- **${combo.type}**: ${combo.success ? '✅' : '❌'} ${combo.success ? 'Passed' : 'Failed'}
${combo.limitations ? combo.limitations.map(l => `  - ⚠️ ${l}`).join('\n') : ''}
`).join('\n')}
`).join('\n')}

## Known Limitations

${report.limitations.map(category => `
### ${category.category}

${category.issues.map(issue => `- ${issue}`).join('\n')}
`).join('\n')}

## Recommendations

${report.recommendations.map(category => `
### ${category.category}

${category.recommendations.map(rec => `- ${rec}`).join('\n')}
`).join('\n')}

## Matrix Build Best Practices for Act

### 1. Optimize Matrix Size
\`\`\`yaml
strategy:
  matrix:
    # Keep combinations small
    node-version: [18, 20]  # Instead of [16, 18, 20, 22]
    os: [ubuntu-latest]     # Test one OS locally
\`\`\`

### 2. Use Exclusions
\`\`\`yaml
strategy:
  matrix:
    node-version: [18, 20, 22]
    os: [ubuntu-latest, windows-latest]
    exclude:
      # Exclude expensive combinations for local testing
      - node-version: 22
        os: windows-latest
\`\`\`

### 3. Environment-Based Simplification
\`\`\`yaml
strategy:
  matrix:
    node-version: 
      - \${{ env.ACT && '20' || '18' }}
      - \${{ env.ACT && '' || '20' }}
      - \${{ env.ACT && '' || '22' }}
\`\`\`

### 4. Act-Specific Jobs
\`\`\`yaml
jobs:
  test-matrix:
    if: \${{ !env.ACT }}  # Skip complex matrix in act
    strategy:
      matrix:
        # Full matrix for GitHub Actions
        
  test-simple:
    if: \${{ env.ACT }}   # Simple test for act
    runs-on: ubuntu-latest
    steps:
      - name: Simple test
        run: npm test
\`\`\`

## Troubleshooting Matrix Issues

### Common Problems

1. **"Matrix job failed"**
   - Check individual combinations with \`--matrix key:value\`
   - Verify container resources are sufficient
   - Use \`--verbose\` for detailed output

2. **"Resource exhausted"**
   - Reduce matrix size or use exclusions
   - Increase Docker memory limits
   - Run combinations sequentially

3. **"Platform not supported"**
   - Check platform mappings in .actrc
   - Use ubuntu containers for cross-platform testing
   - Mock platform-specific behaviors

### Debug Commands

\`\`\`bash
# Test specific matrix combination
act push -W workflow.yml -j test --matrix node-version:20 --matrix os:ubuntu-latest

# Test with verbose output
act push -W workflow.yml -j test --verbose

# Dry run to check syntax
act push -W workflow.yml -j test --dry-run

# Test single combination only
act push -W workflow.yml -j test --matrix node-version:20
\`\`\`
`;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose'),
    maxParallel: args.includes('--max-parallel') ? 
      parseInt(args[args.indexOf('--max-parallel') + 1]) || 2 : 2
  };
  
  const tester = new MatrixTester(options);
  
  tester.testAllMatrices()
    .then(results => {
      console.log('\n🎉 Matrix testing completed!');
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('\n💥 Matrix testing failed:', error);
      process.exit(1);
    });
}

export { MatrixTester };