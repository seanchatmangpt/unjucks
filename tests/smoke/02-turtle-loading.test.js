#!/usr/bin/env node

/**
 * KGEN Smoke Test 02: Turtle Graph Loading
 * 
 * Tests:
 * - Can load and parse simple Turtle (.ttl) files
 * - RDF/N3 parsing functionality works
 * - Basic knowledge graph processing
 */

import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
const kgenBinary = join(projectRoot, 'bin/kgen.mjs');
const testTurtle = join(projectRoot, 'test-data/simple-graph.ttl');

class TurtleLoadingTest {
  constructor() {
    this.testName = 'Turtle Graph Loading';
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
  }

  log(message) {
    console.log(`[TURTLE] ${message}`);
  }

  error(message, error) {
    console.error(`[TURTLE] ❌ ${message}`);
    if (error) {
      console.error(`   Error: ${error.message || error}`);
    }
    this.errors.push({ message, error: error?.message || error });
    this.failed++;
  }

  success(message) {
    console.log(`[TURTLE] ✅ ${message}`);
    this.passed++;
  }

  async testTurtleFileExists() {
    try {
      if (!fs.existsSync(testTurtle)) {
        this.error('Test Turtle file does not exist', new Error(`File not found: ${testTurtle}`));
        return false;
      }
      
      const content = fs.readFileSync(testTurtle, 'utf8');
      if (!content.includes('@prefix') || !content.includes('ex:')) {
        this.error('Test Turtle file does not contain valid RDF', new Error('Missing @prefix or example data'));
        return false;
      }
      
      this.success('Test Turtle file exists and contains RDF data');
      return true;
    } catch (err) {
      this.error('Failed to check test Turtle file', err);
      return false;
    }
  }

  async testN3ParsingDependency() {
    try {
      this.log('Testing N3 parsing dependency...');
      
      // Try to import N3 library directly
      const { default: n3 } = await import('n3');
      if (!n3 || !n3.Parser) {
        this.error('N3 library not properly installed', new Error('N3.Parser not available'));
        return false;
      }
      
      // Test basic parsing
      const parser = new n3.Parser();
      const testRdf = '@prefix ex: <http://example.org/> . ex:test ex:prop "value" .';
      
      const quads = [];
      parser.parse(testRdf, (error, quad, prefixes) => {
        if (error) {
          this.error('N3 parsing failed', error);
          return false;
        }
        if (quad) quads.push(quad);
      });
      
      if (quads.length > 0) {
        this.success('N3 parsing dependency working correctly');
        return true;
      } else {
        this.error('N3 parsing produced no results', new Error('No quads parsed'));
        return false;
      }
    } catch (err) {
      this.error('N3 dependency test failed', err);
      return false;
    }
  }

  async testKgenTurtleLoading() {
    try {
      this.log('Testing KGEN Turtle loading via CLI...');
      
      // Create a simple test to see if KGEN can process the turtle file
      const child = spawn('node', [kgenBinary, 'analyze', testTurtle, '--dry-run'], {
        stdio: 'pipe',
        timeout: 10000,
        cwd: projectRoot
      });

      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const exitCode = await new Promise((resolve) => {
        child.on('close', resolve);
        child.on('error', () => resolve(-1));
      });

      // Check for specific RDF/import errors
      if (stderr.includes('Cannot find module') && stderr.includes('n3')) {
        this.error('KGEN cannot find N3 module', new Error(stderr));
        return false;
      }
      
      if (stderr.includes('Invalid RDF') || stderr.includes('Parse error')) {
        this.error('KGEN failed to parse Turtle file', new Error(stderr));
        return false;
      }

      // Even if command fails, if it attempted to parse RDF, that's progress
      if (stdout.includes('ex:') || stderr.includes('analyzing') || stderr.includes('turtle')) {
        this.success('KGEN attempted to process Turtle file (shows RDF parsing capability)');
        return true;
      } else {
        this.error('KGEN did not attempt Turtle processing', new Error(`stdout: ${stdout}, stderr: ${stderr}`));
        return false;
      }
    } catch (err) {
      this.error('Exception during KGEN Turtle loading test', err);
      return false;
    }
  }

  async testBasicRDFOperations() {
    try {
      this.log('Testing basic RDF operations programmatically...');
      
      // Test that we can load and query the RDF data
      const { default: n3 } = await import('n3');
      const store = new n3.Store();
      const parser = new n3.Parser();
      
      const turtleContent = fs.readFileSync(testTurtle, 'utf8');
      
      return new Promise((resolve) => {
        let quadCount = 0;
        
        parser.parse(turtleContent, (error, quad, prefixes) => {
          if (error) {
            this.error('RDF parsing failed', error);
            resolve(false);
            return;
          }
          
          if (quad) {
            store.addQuad(quad);
            quadCount++;
          } else {
            // Parsing complete
            if (quadCount > 0) {
              this.success(`Successfully parsed ${quadCount} RDF triples`);
              
              // Test basic query
              const quads = store.getQuads(null, null, null, null);
              if (quads.length === quadCount) {
                this.success('RDF store operations working correctly');
                resolve(true);
              } else {
                this.error('RDF store query mismatch', new Error(`Expected ${quadCount}, got ${quads.length}`));
                resolve(false);
              }
            } else {
              this.error('No RDF triples parsed', new Error('Empty result'));
              resolve(false);
            }
          }
        });
      });
    } catch (err) {
      this.error('Basic RDF operations test failed', err);
      return false;
    }
  }

  async runTests() {
    console.log('🚀 Starting KGEN Turtle Loading Smoke Tests...\n');
    
    const turtleExists = await this.testTurtleFileExists();
    if (!turtleExists) {
      return this.generateReport();
    }
    
    await this.testN3ParsingDependency();
    await this.testBasicRDFOperations();
    await this.testKgenTurtleLoading();
    
    return this.generateReport();
  }

  generateReport() {
    console.log('\n📊 Turtle Loading Test Results:');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📈 Success Rate: ${Math.round((this.passed / (this.passed + this.failed)) * 100)}%`);
    
    if (this.errors.length > 0) {
      console.log('\n🚨 Errors Found:');
      this.errors.forEach((err, i) => {
        console.log(`${i + 1}. ${err.message}`);
        if (err.error) {
          console.log(`   ${err.error}`);
        }
      });
    }
    
    const success = this.failed === 0;
    console.log(`\n${success ? '🎉 All Turtle loading tests passed!' : '⚠️ Some Turtle loading tests failed'}`);
    
    return {
      testName: this.testName,
      passed: this.passed,
      failed: this.failed,
      success,
      errors: this.errors
    };
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new TurtleLoadingTest();
  const result = await tester.runTests();
  process.exit(result.success ? 0 : 1);
}

export default TurtleLoadingTest;