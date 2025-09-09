#!/usr/bin/env node

/**
 * Mutation Testing Framework
 * Validates test quality by introducing mutations and checking if tests catch them
 */

import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

class MutationTester {
  constructor() {
    this.mutations = [];
    this.reportsDir = path.join(projectRoot, 'tests/reports');
    this.mutators = {
      // Arithmetic operators
      arithmetic: [
        { from: '+', to: '-', description: 'Addition to subtraction' },
        { from: '-', to: '+', description: 'Subtraction to addition' },
        { from: '*', to: '/', description: 'Multiplication to division' },
        { from: '/', to: '*', description: 'Division to multiplication' },
        { from: '%', to: '*', description: 'Modulo to multiplication' }
      ],
      
      // Comparison operators
      comparison: [
        { from: '===', to: '!==', description: 'Strict equality to strict inequality' },
        { from: '!==', to: '===', description: 'Strict inequality to strict equality' },
        { from: '==', to: '!=', description: 'Equality to inequality' },
        { from: '!=', to: '==', description: 'Inequality to equality' },
        { from: '<', to: '>', description: 'Less than to greater than' },
        { from: '>', to: '<', description: 'Greater than to less than' },
        { from: '<=', to: '>=', description: 'Less than or equal to greater than or equal' },
        { from: '>=', to: '<=', description: 'Greater than or equal to less than or equal' }
      ],
      
      // Logical operators
      logical: [
        { from: '&&', to: '||', description: 'Logical AND to logical OR' },
        { from: '||', to: '&&', description: 'Logical OR to logical AND' },
        { from: '!', to: '', description: 'Logical NOT removal' }
      ],
      
      // Assignment operators
      assignment: [
        { from: '+=', to: '-=', description: 'Addition assignment to subtraction assignment' },
        { from: '-=', to: '+=', description: 'Subtraction assignment to addition assignment' },
        { from: '*=', to: '/=', description: 'Multiplication assignment to division assignment' },
        { from: '/=', to: '*=', description: 'Division assignment to multiplication assignment' }
      ],
      
      // Literals
      literals: [
        { from: 'true', to: 'false', description: 'Boolean true to false' },
        { from: 'false', to: 'true', description: 'Boolean false to true' },
        { from: '0', to: '1', description: 'Zero to one' },
        { from: '1', to: '0', description: 'One to zero' },
        { from: '""', to: '"mutated"', description: 'Empty string to non-empty string' },
        { from: "''", to: "'mutated'", description: 'Empty string to non-empty string' }
      ],
      
      // Method calls
      methods: [
        { from: '.push(', to: '.pop(', description: 'Array push to pop' },
        { from: '.pop()', to: '.push()', description: 'Array pop to push' },
        { from: '.shift()', to: '.pop()', description: 'Array shift to pop' },
        { from: '.unshift(', to: '.push(', description: 'Array unshift to push' },
        { from: '.slice(', to: '.splice(', description: 'Array slice to splice' },
        { from: '.includes(', to: '.excludes(', description: 'String/Array includes to excludes' }
      ]
    };
  }

  async runMutationTesting() {
    console.log('🧬 Starting Mutation Testing...');
    
    await fs.ensureDir(this.reportsDir);
    
    const sourceFiles = await this.findSourceFiles();
    const testFiles = await this.findTestFiles();
    
    if (testFiles.length === 0) {
      console.log('⚠️  No test files found - mutation testing requires tests');
      return {
        error: 'No test files found',
        mutations: [],
        score: 0
      };
    }
    
    console.log(`📋 Found ${sourceFiles.length} source files and ${testFiles.length} test files`);
    
    const results = {
      timestamp: new Date().toISOString(),
      sourceFiles: sourceFiles.length,
      testFiles: testFiles.length,
      mutations: [],
      summary: {
        total: 0,
        killed: 0,
        survived: 0,
        timeout: 0,
        error: 0
      },
      score: 0
    };
    
    // Generate mutations for each source file
    for (const sourceFile of sourceFiles.slice(0, 5)) { // Limit to 5 files for demo
      console.log(`\n🔬 Mutating: ${sourceFile.replace(projectRoot, '')}`);
      
      const mutations = await this.generateMutations(sourceFile);
      
      for (const mutation of mutations.slice(0, 10)) { // Limit mutations per file
        const mutationResult = await this.testMutation(mutation, testFiles);
        results.mutations.push(mutationResult);
        results.summary.total++;
        results.summary[mutationResult.status]++;
        
        // Show progress
        process.stdout.write(`\r   Mutations tested: ${results.summary.total}`);
      }
    }
    
    console.log(''); // New line
    
    // Calculate mutation score
    results.score = results.summary.total > 0 
      ? Math.round((results.summary.killed / results.summary.total) * 100)
      : 0;
    
    await this.saveMutationReport(results);
    this.displayResults(results);
    
    return results;
  }

  async findSourceFiles() {
    const { glob } = await import('glob');
    const patterns = [
      'src/**/*.js',
      'bin/**/*.js'
    ];
    
    const files = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, { cwd: projectRoot });
      files.push(...matches.map(f => path.join(projectRoot, f)));
    }
    
    // Filter out test files and node_modules
    return files.filter(file => 
      !file.includes('node_modules') && 
      !file.includes('.test.') && 
      !file.includes('.spec.')
    );
  }

  async findTestFiles() {
    const { glob } = await import('glob');
    const patterns = [
      'tests/**/*.js',
      'src/**/*.test.js',
      'src/**/*.spec.js'
    ];
    
    const files = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, { cwd: projectRoot });
      files.push(...matches.map(f => path.join(projectRoot, f)));
    }
    
    return files;
  }

  async generateMutations(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const mutations = [];
    
    // Generate mutations for each mutator type
    Object.entries(this.mutators).forEach(([type, mutatorList]) => {
      mutatorList.forEach(mutator => {
        const mutatedContent = this.applyMutation(content, mutator);
        
        if (mutatedContent !== content) {
          mutations.push({
            id: `${path.basename(filePath)}-${type}-${mutations.length}`,
            file: filePath,
            type,
            mutator: mutator.description,
            original: content,
            mutated: mutatedContent,
            from: mutator.from,
            to: mutator.to
          });
        }
      });
    });
    
    return mutations;
  }

  applyMutation(content, mutator) {
    // Simple string replacement - could be enhanced with AST manipulation
    const regex = new RegExp(this.escapeRegExp(mutator.from), 'g');
    return content.replace(regex, mutator.to);
  }

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async testMutation(mutation, testFiles) {
    const tempFile = `${mutation.file}.mutated`;
    
    try {
      // Write mutated file
      await fs.writeFile(tempFile, mutation.mutated);
      
      // Backup original file
      const originalContent = mutation.original;
      await fs.writeFile(mutation.file, mutation.mutated);
      
      // Run tests
      const testResult = await this.runTests(testFiles);
      
      // Restore original file
      await fs.writeFile(mutation.file, originalContent);
      
      // Determine mutation status
      let status;
      if (testResult.timeout) {
        status = 'timeout';
      } else if (testResult.error) {
        status = 'error';
      } else if (testResult.failed > 0) {
        status = 'killed'; // Test caught the mutation
      } else {
        status = 'survived'; // Mutation survived - weak test
      }
      
      return {
        ...mutation,
        status,
        testResult,
        duration: testResult.duration
      };
      
    } catch (error) {
      // Restore original file in case of error
      try {
        await fs.writeFile(mutation.file, mutation.original);
      } catch (restoreError) {
        // Ignore restore errors
      }
      
      return {
        ...mutation,
        status: 'error',
        error: error.message,
        duration: 0
      };
    } finally {
      // Cleanup temp file
      try {
        await fs.remove(tempFile);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
  }

  async runTests(testFiles) {
    const startTime = Date.now();
    
    try {
      // Run the native test runner (lightweight)
      const result = await this.executeCommand('npm test', 10000); // 10 second timeout
      
      const duration = Date.now() - startTime;
      
      // Parse test output to determine if tests failed
      const output = result.stdout + result.stderr;
      const failed = result.code !== 0 || output.includes('FAILED') || output.includes('Error:');
      
      return {
        code: result.code,
        duration,
        failed: failed ? 1 : 0,
        passed: failed ? 0 : 1,
        timeout: false,
        error: false,
        output
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error.message.includes('timeout')) {
        return {
          code: -1,
          duration,
          failed: 0,
          passed: 0,
          timeout: true,
          error: false,
          output: 'Test execution timed out'
        };
      }
      
      return {
        code: -1,
        duration,
        failed: 0,
        passed: 0,
        timeout: false,
        error: true,
        output: error.message
      };
    }
  }

  async executeCommand(command, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const process = spawn(cmd, args, {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      let timeoutId;
      
      if (timeout) {
        timeoutId = setTimeout(() => {
          process.kill('SIGKILL');
          reject(new Error('Command timeout'));
        }, timeout);
      }
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve({ code, stdout, stderr });
      });
      
      process.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  async saveMutationReport(results) {
    await fs.writeJSON(
      path.join(this.reportsDir, 'mutation-testing.json'),
      results,
      { spaces: 2 }
    );
    
    // Generate summary report
    const summary = this.generateSummaryReport(results);
    await fs.writeFile(
      path.join(this.reportsDir, 'mutation-testing-summary.txt'),
      summary
    );
  }

  generateSummaryReport(results) {
    let report = 'MUTATION TESTING REPORT\n';
    report += '='.repeat(50) + '\n\n';
    report += `Test Date: ${new Date(results.timestamp).toLocaleString()}\n`;
    report += `Mutation Score: ${results.score}%\n\n`;
    
    report += 'SUMMARY:\n';
    report += `  Total Mutations: ${results.summary.total}\n`;
    report += `  Killed: ${results.summary.killed} (${results.summary.total > 0 ? Math.round((results.summary.killed / results.summary.total) * 100) : 0}%)\n`;
    report += `  Survived: ${results.summary.survived} (${results.summary.total > 0 ? Math.round((results.summary.survived / results.summary.total) * 100) : 0}%)\n`;
    report += `  Timeout: ${results.summary.timeout}\n`;
    report += `  Error: ${results.summary.error}\n\n`;
    
    // List survived mutations (test quality issues)
    const survived = results.mutations.filter(m => m.status === 'survived');
    if (survived.length > 0) {
      report += 'SURVIVED MUTATIONS (Test Quality Issues):\n';
      survived.forEach((mutation, index) => {
        report += `\n${index + 1}. ${mutation.file.replace(projectRoot, '')}\n`;
        report += `   Type: ${mutation.type}\n`;
        report += `   Mutation: ${mutation.mutator}\n`;
        report += `   Changed: ${mutation.from} -> ${mutation.to}\n`;
      });
      report += '\n';
    }
    
    // Quality assessment
    report += 'QUALITY ASSESSMENT:\n';
    if (results.score >= 90) {
      report += '  Excellent: Your tests are very effective at catching bugs\n';
    } else if (results.score >= 80) {
      report += '  Good: Your tests catch most bugs but could be improved\n';
    } else if (results.score >= 70) {
      report += '  Fair: Your tests have moderate effectiveness\n';
    } else if (results.score >= 60) {
      report += '  Poor: Your tests miss many potential bugs\n';
    } else {
      report += '  Very Poor: Your tests are not effective at catching bugs\n';
    }
    
    return report;
  }

  displayResults(results) {
    console.log('\n🧬 Mutation Testing Results:');
    console.log('=' * 40);
    console.log(`🏆 Mutation Score: ${results.score}%`);
    
    console.log('\n📊 Summary:');
    console.log(`  Total Mutations: ${results.summary.total}`);
    console.log(`  ☠️  Killed: ${results.summary.killed}`);
    console.log(`  🟢 Survived: ${results.summary.survived}`);
    
    if (results.summary.timeout > 0) {
      console.log(`  ⏰ Timeout: ${results.summary.timeout}`);
    }
    
    if (results.summary.error > 0) {
      console.log(`  ❌ Error: ${results.summary.error}`);
    }
    
    // Show quality assessment
    if (results.score >= 80) {
      console.log('\n🎉 Excellent test quality!');
    } else if (results.score >= 60) {
      console.log('\n🟡 Good test quality, but room for improvement');
    } else {
      console.log('\n🟠 Test quality needs improvement - consider adding more assertions');
    }
    
    // Show survived mutations (areas to improve)
    const survived = results.mutations.filter(m => m.status === 'survived');
    if (survived.length > 0 && survived.length <= 5) {
      console.log('\n🟢 Survived Mutations (improve these tests):');
      survived.forEach((mutation, index) => {
        console.log(`  ${index + 1}. ${mutation.file.replace(projectRoot, '')} - ${mutation.mutator}`);
      });
    }
    
    console.log(`\n📋 Report saved to: ${this.reportsDir}`);
    
    if (results.score < 60) {
      console.log('\n⚠️  Mutation score below 60% - consider improving test coverage and assertions');
    }
  }
}

// Execute if run directly
if (import.meta.url === `file://${__filename}`) {
  const tester = new MutationTester();
  
  tester.runMutationTesting().then(results => {
    if (results.error) {
      console.error(`Mutation testing failed: ${results.error}`);
      process.exit(1);
    }
    
    if (results.score < 60) {
      console.log('\n🚨 Mutation score below acceptable threshold (60%)');
      process.exit(1);
    } else {
      console.log('\n🎉 Mutation testing completed successfully!');
      process.exit(0);
    }
  }).catch(error => {
    console.error('Mutation testing failed:', error);
    process.exit(1);
  });
}

export { MutationTester };
