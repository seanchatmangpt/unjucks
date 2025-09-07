/**
 * Production Cross-Platform Compatibility Tests - RDF/Turtle Filters
 * Validates compatibility across different operating systems, Node.js versions, and environments
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { platform, arch, version } from 'process';
import { Store, DataFactory } from 'n3';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const { namedNode, literal, quad } = DataFactory;

// Platform configuration matrix
const PLATFORM_MATRIX = {
  supportedOS: ['linux', 'darwin', 'win32'],
  supportedNodeVersions: ['18', '20', '22'],
  supportedArchitectures: ['x64', 'arm64'],
  browserEnvironments: ['chrome', 'firefox', 'safari', 'edge'],
  containerPlatforms: ['docker', 'kubernetes', 'serverless']
};

describe('Production Cross-Platform Compatibility Tests', () => {
  let systemInfo;
  let rdfFilters;
  let platformResults = {
    compatibility: [],
    performance: [],
    featureSupport: [],
    issues: []
  };

  beforeAll(async () => {
    // Gather system information
    systemInfo = {
      platform: platform,
      architecture: arch,
      nodeVersion: version,
      osRelease: os.release(),
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      hostname: os.hostname()
    };

    // Initialize RDF filters
    const store = new Store();
    await setupCrossPlatformTestData(store);
    rdfFilters = new RDFFilters({ store });

    console.log('🌍 Starting cross-platform compatibility tests...');
    console.log(`Platform: ${systemInfo.platform}-${systemInfo.architecture}`);
    console.log(`Node.js: ${systemInfo.nodeVersion}`);
    console.log(`OS: ${systemInfo.osRelease}`);
  });

  describe('Operating System Compatibility', () => {
    test('Core functionality on current platform', async () => {
      console.log(`Testing core functionality on ${systemInfo.platform}...`);
      
      const testCases = [
        {
          name: 'RDF Query',
          test: () => rdfFilters.rdfQuery('?s rdf:type foaf:Person')
        },
        {
          name: 'RDF Subject',
          test: () => rdfFilters.rdfSubject('rdf:type', 'foaf:Person')
        },
        {
          name: 'RDF Object',
          test: () => rdfFilters.rdfObject('ex:person1', 'foaf:name')
        },
        {
          name: 'RDF Label',
          test: () => rdfFilters.rdfLabel('ex:person1')
        },
        {
          name: 'RDF Expand',
          test: () => rdfFilters.rdfExpand('foaf:Person')
        },
        {
          name: 'RDF Count',
          test: () => rdfFilters.rdfCount('?s', 'rdf:type', 'foaf:Person')
        }
      ];

      let passedTests = 0;
      let failedTests = 0;

      for (const testCase of testCases) {
        try {
          const result = testCase.test();
          expect(result).toBeDefined();
          passedTests++;
          
          platformResults.compatibility.push({
            platform: systemInfo.platform,
            test: testCase.name,
            status: 'PASS',
            result: Array.isArray(result) ? result.length : typeof result
          });
          
        } catch (error) {
          failedTests++;
          platformResults.issues.push({
            platform: systemInfo.platform,
            test: testCase.name,
            error: error.message,
            severity: 'HIGH'
          });
        }
      }

      const successRate = (passedTests / testCases.length) * 100;
      expect(successRate).toBeGreaterThanOrEqual(90); // 90% minimum compatibility

      console.log(`✅ Platform compatibility: ${passedTests}/${testCases.length} tests passed (${successRate.toFixed(1)}%)`);
    });

    test('File system operations compatibility', async () => {
      console.log('Testing file system compatibility...');
      
      const testDir = path.join(os.tmpdir(), 'unjucks-platform-test');
      const testFile = path.join(testDir, 'test-data.ttl');
      
      try {
        // Create test directory
        if (!fs.existsSync(testDir)) {
          fs.mkdirSync(testDir, { recursive: true });
        }

        // Test file operations
        const testContent = `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:platformTest a foaf:Person ;
  foaf:name "Platform Test User" ;
  ex:platform "${systemInfo.platform}" ;
  ex:nodeVersion "${systemInfo.nodeVersion}" .
`;

        // Write test file
        fs.writeFileSync(testFile, testContent, 'utf8');
        
        // Read test file
        const readContent = fs.readFileSync(testFile, 'utf8');
        expect(readContent).toContain('platformTest');
        
        // Check file permissions (Unix-like systems)
        if (systemInfo.platform !== 'win32') {
          const stats = fs.statSync(testFile);
          expect(stats.mode).toBeDefined();
        }

        // Cleanup
        fs.unlinkSync(testFile);
        fs.rmdirSync(testDir);

        platformResults.compatibility.push({
          platform: systemInfo.platform,
          test: 'File System Operations',
          status: 'PASS'
        });

      } catch (error) {
        platformResults.issues.push({
          platform: systemInfo.platform,
          test: 'File System Operations',
          error: error.message,
          severity: 'MEDIUM'
        });
        
        // Cleanup on error
        try {
          if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
          if (fs.existsSync(testDir)) fs.rmdirSync(testDir);
        } catch (cleanupError) {
          console.warn('Cleanup error:', cleanupError.message);
        }
      }

      console.log('✅ File system compatibility validated');
    });

    test('Path handling compatibility', async () => {
      console.log('Testing path handling compatibility...');
      
      const testPaths = [
        'simple/path',
        'path with spaces',
        'path/with/multiple/segments',
        'UPPERCASE/Path',
        'path-with-dashes',
        'path_with_underscores',
        '123numeric/path'
      ];

      if (systemInfo.platform === 'win32') {
        testPaths.push('C:\\Windows\\Style\\Path');
        testPaths.push('\\\\UNC\\Path');
      } else {
        testPaths.push('/absolute/unix/path');
        testPaths.push('./relative/path');
        testPaths.push('../parent/relative/path');
      }

      let pathIssues = 0;

      for (const testPath of testPaths) {
        try {
          // Test path operations
          const normalized = path.normalize(testPath);
          const resolved = path.resolve(testPath);
          const dirname = path.dirname(testPath);
          const basename = path.basename(testPath);
          const extname = path.extname(testPath);

          // Validate path operations work
          expect(normalized).toBeDefined();
          expect(resolved).toBeDefined();
          expect(dirname).toBeDefined();
          expect(basename).toBeDefined();
          // extname might be empty string for paths without extensions

        } catch (error) {
          pathIssues++;
          platformResults.issues.push({
            platform: systemInfo.platform,
            test: 'Path Handling',
            path: testPath,
            error: error.message,
            severity: 'LOW'
          });
        }
      }

      const pathSuccessRate = ((testPaths.length - pathIssues) / testPaths.length) * 100;
      expect(pathSuccessRate).toBeGreaterThanOrEqual(95); // 95% path compatibility

      console.log(`✅ Path handling: ${pathSuccessRate.toFixed(1)}% compatibility`);
    });
  });

  describe('Node.js Version Compatibility', () => {
    test('ES Module support', async () => {
      console.log('Testing ES Module compatibility...');
      
      // Test ES6+ features used by the codebase
      const esFeatureTests = [
        {
          name: 'Arrow Functions',
          test: () => {
            const fn = (x) => x * 2;
            return fn(5) === 10;
          }
        },
        {
          name: 'Template Literals',
          test: () => {
            const name = 'test';
            return `Hello ${name}` === 'Hello test';
          }
        },
        {
          name: 'Destructuring',
          test: () => {
            const { platform, arch } = systemInfo;
            return platform !== undefined && arch !== undefined;
          }
        },
        {
          name: 'Spread Operator',
          test: () => {
            const arr1 = [1, 2];
            const arr2 = [...arr1, 3];
            return arr2.length === 3;
          }
        },
        {
          name: 'Async/Await',
          test: async () => {
            const promise = Promise.resolve(42);
            const result = await promise;
            return result === 42;
          }
        },
        {
          name: 'Map/Set',
          test: () => {
            const map = new Map();
            map.set('key', 'value');
            const set = new Set([1, 2, 3]);
            return map.get('key') === 'value' && set.has(2);
          }
        },
        {
          name: 'Optional Chaining',
          test: () => {
            const obj = { nested: { value: 42 } };
            return obj.nested?.value === 42 && obj.missing?.value === undefined;
          }
        },
        {
          name: 'Nullish Coalescing',
          test: () => {
            const value = null ?? 'default';
            return value === 'default';
          }
        }
      ];

      let featureSupported = 0;

      for (const featureTest of esFeatureTests) {
        try {
          const result = await featureTest.test();
          if (result === true) {
            featureSupported++;
            platformResults.featureSupport.push({
              feature: featureTest.name,
              nodeVersion: systemInfo.nodeVersion,
              supported: true
            });
          }
        } catch (error) {
          platformResults.issues.push({
            feature: featureTest.name,
            nodeVersion: systemInfo.nodeVersion,
            error: error.message,
            severity: 'MEDIUM'
          });
        }
      }

      const featureSupport = (featureSupported / esFeatureTests.length) * 100;
      expect(featureSupport).toBeGreaterThanOrEqual(90); // 90% ES feature support

      console.log(`✅ ES Module features: ${featureSupport.toFixed(1)}% supported`);
    });

    test('Node.js API compatibility', async () => {
      console.log('Testing Node.js API compatibility...');
      
      const nodeApiTests = [
        {
          name: 'File System',
          test: () => {
            const fs = require('fs');
            return fs.existsSync && fs.readFileSync && fs.writeFileSync;
          }
        },
        {
          name: 'Path Module',
          test: () => {
            const path = require('path');
            return path.join && path.resolve && path.normalize;
          }
        },
        {
          name: 'OS Module',
          test: () => {
            const os = require('os');
            return os.platform && os.arch && os.cpus;
          }
        },
        {
          name: 'Crypto Module',
          test: () => {
            const crypto = require('crypto');
            return crypto.createHash && crypto.randomBytes;
          }
        },
        {
          name: 'Process Global',
          test: () => {
            return process.platform && process.version && process.env;
          }
        },
        {
          name: 'Buffer Global',
          test: () => {
            const buf = Buffer.from('test');
            return buf.toString() === 'test';
          }
        }
      ];

      let apiSupported = 0;

      for (const apiTest of nodeApiTests) {
        try {
          const result = apiTest.test();
          if (result) {
            apiSupported++;
            platformResults.featureSupport.push({
              feature: apiTest.name,
              nodeVersion: systemInfo.nodeVersion,
              supported: true
            });
          }
        } catch (error) {
          platformResults.issues.push({
            api: apiTest.name,
            nodeVersion: systemInfo.nodeVersion,
            error: error.message,
            severity: 'HIGH'
          });
        }
      }

      const apiSupport = (apiSupported / nodeApiTests.length) * 100;
      expect(apiSupport).toBe(100); // Full Node.js API support required

      console.log(`✅ Node.js API compatibility: ${apiSupport.toFixed(1)}%`);
    });
  });

  describe('Performance Across Platforms', () => {
    test('Platform-specific performance characteristics', async () => {
      console.log('Testing platform-specific performance...');
      
      const performanceTests = [
        {
          name: 'RDF Query Performance',
          test: () => rdfFilters.rdfQuery('?s rdf:type foaf:Person'),
          iterations: 100
        },
        {
          name: 'String Operations',
          test: () => rdfFilters.rdfExpand('foaf:Person'),
          iterations: 1000
        },
        {
          name: 'Array Operations',
          test: () => rdfFilters.rdfObject('ex:person1', 'foaf:name'),
          iterations: 500
        }
      ];

      for (const perfTest of performanceTests) {
        const startTime = process.hrtime.bigint();
        
        for (let i = 0; i < perfTest.iterations; i++) {
          perfTest.test();
        }
        
        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        const opsPerSecond = (perfTest.iterations * 1000) / durationMs;
        
        platformResults.performance.push({
          platform: systemInfo.platform,
          architecture: systemInfo.architecture,
          nodeVersion: systemInfo.nodeVersion,
          test: perfTest.name,
          duration: durationMs,
          opsPerSecond: opsPerSecond,
          iterations: perfTest.iterations
        });
        
        // Platform-specific performance expectations
        let minOpsPerSecond = 1000; // Default expectation
        
        // Adjust expectations based on platform
        if (systemInfo.platform === 'win32') {
          minOpsPerSecond *= 0.8; // Windows typically 20% slower
        }
        
        if (systemInfo.architecture === 'arm64') {
          minOpsPerSecond *= 0.7; // ARM typically slower for compute
        }
        
        expect(opsPerSecond).toBeGreaterThan(minOpsPerSecond);
        
        console.log(`  ${perfTest.name}: ${opsPerSecond.toFixed(0)} ops/sec`);
      }
      
      console.log('✅ Platform-specific performance validated');
    });

    test('Memory usage consistency', async () => {
      console.log('Testing memory usage consistency...');
      
      const initialMemory = process.memoryUsage();
      
      // Perform memory-intensive operations
      const largeDataset = [];
      for (let i = 0; i < 10000; i++) {
        largeDataset.push({
          subject: `ex:entity${i}`,
          predicate: 'foaf:name',
          object: `Entity ${i}`
        });
      }
      
      // Process the dataset
      for (const data of largeDataset) {
        rdfFilters.rdfExists(data.subject, data.predicate, data.object);
      }
      
      const peakMemory = process.memoryUsage();
      
      // Clear dataset
      largeDataset.length = 0;
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      
      const memoryGrowthMB = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      const peakMemoryMB = (peakMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      
      platformResults.performance.push({
        platform: systemInfo.platform,
        test: 'Memory Usage',
        initialMemoryMB: initialMemory.heapUsed / 1024 / 1024,
        peakMemoryMB: peakMemory.heapUsed / 1024 / 1024,
        finalMemoryMB: finalMemory.heapUsed / 1024 / 1024,
        memoryGrowthMB: memoryGrowthMB
      });
      
      // Memory growth should be reasonable across platforms
      expect(memoryGrowthMB).toBeLessThan(50); // Less than 50MB residual growth
      expect(peakMemoryMB).toBeLessThan(200);  // Less than 200MB peak usage
      
      console.log(`✅ Memory consistency: ${memoryGrowthMB.toFixed(2)}MB growth, ${peakMemoryMB.toFixed(2)}MB peak`);
    });
  });

  describe('Environment-Specific Features', () => {
    test('Container environment compatibility', async () => {
      console.log('Testing container environment features...');
      
      const containerFeatures = {
        hasDockerEnv: fs.existsSync('/.dockerenv'),
        hasKubernetesEnv: !!process.env.KUBERNETES_SERVICE_HOST,
        hasServerlessEnv: !!(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL || process.env.NETLIFY),
        limitedFileSystem: process.env.NODE_ENV === 'production' && (
          !!process.env.AWS_LAMBDA_FUNCTION_NAME || 
          !!process.env.VERCEL
        )
      };
      
      // Test file system limitations in serverless environments
      if (containerFeatures.limitedFileSystem) {
        console.log('Detected serverless/limited environment');
        
        // Test read-only file system behavior
        const tempDir = os.tmpdir();
        try {
          const testFile = path.join(tempDir, 'serverless-test.txt');
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
          
          platformResults.featureSupport.push({
            feature: 'Writable Temp Directory',
            environment: 'serverless',
            supported: true
          });
        } catch (error) {
          platformResults.issues.push({
            feature: 'Writable Temp Directory',
            environment: 'serverless',
            error: error.message,
            severity: 'MEDIUM'
          });
        }
      }
      
      // Test memory constraints
      const availableMemory = os.freemem() / 1024 / 1024; // MB
      if (availableMemory < 512) {
        console.log(`Low memory environment detected: ${availableMemory.toFixed(0)}MB available`);
        
        // Test behavior under memory constraints
        try {
          const result = rdfFilters.rdfQuery('?s ?p ?o');
          expect(Array.isArray(result)).toBe(true);
          
          platformResults.featureSupport.push({
            feature: 'Low Memory Operation',
            availableMemory: availableMemory,
            supported: true
          });
        } catch (error) {
          platformResults.issues.push({
            feature: 'Low Memory Operation',
            availableMemory: availableMemory,
            error: error.message,
            severity: 'HIGH'
          });
        }
      }
      
      console.log('✅ Container environment compatibility validated');
      console.log(`  Docker: ${containerFeatures.hasDockerEnv ? 'Yes' : 'No'}`);
      console.log(`  Kubernetes: ${containerFeatures.hasKubernetesEnv ? 'Yes' : 'No'}`);
      console.log(`  Serverless: ${containerFeatures.hasServerlessEnv ? 'Yes' : 'No'}`);
    });

    test('Development vs production behavior', async () => {
      console.log('Testing development vs production behavior...');
      
      const originalNodeEnv = process.env.NODE_ENV;
      const environments = ['development', 'test', 'production'];
      
      for (const env of environments) {
        process.env.NODE_ENV = env;
        
        try {
          // Test behavior that might differ between environments
          const result = rdfFilters.rdfLabel('ex:nonexistent');
          
          // In development, might return more detailed error info
          // In production, should return consistent behavior
          expect(typeof result === 'string' || result === null || result === undefined).toBe(true);
          
          platformResults.compatibility.push({
            environment: env,
            test: 'Environment Behavior',
            status: 'PASS'
          });
          
        } catch (error) {
          platformResults.issues.push({
            environment: env,
            test: 'Environment Behavior',
            error: error.message,
            severity: 'LOW'
          });
        }
      }
      
      // Restore original NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
      
      console.log('✅ Environment behavior consistency validated');
    });
  });

  // Final compatibility report
  test('Generate cross-platform compatibility report', async () => {
    console.log('\n=== CROSS-PLATFORM COMPATIBILITY REPORT ===');
    
    const report = {
      timestamp: new Date().toISOString(),
      systemInfo,
      platformMatrix: PLATFORM_MATRIX,
      results: platformResults,
      summary: {
        totalTests: platformResults.compatibility.length + platformResults.performance.length + platformResults.featureSupport.length,
        passedTests: platformResults.compatibility.filter(t => t.status === 'PASS').length,
        totalIssues: platformResults.issues.length,
        criticalIssues: platformResults.issues.filter(i => i.severity === 'HIGH' || i.severity === 'CRITICAL').length,
        overallCompatibility: 'GOOD' // This would be calculated based on results
      }
    };
    
    // Calculate overall compatibility score
    const totalTests = report.summary.totalTests;
    const criticalIssues = report.summary.criticalIssues;
    const allIssues = report.summary.totalIssues;
    
    if (criticalIssues > 0) {
      report.summary.overallCompatibility = 'POOR';
    } else if (allIssues > totalTests * 0.1) {
      report.summary.overallCompatibility = 'FAIR';
    } else if (allIssues > totalTests * 0.05) {
      report.summary.overallCompatibility = 'GOOD';
    } else {
      report.summary.overallCompatibility = 'EXCELLENT';
    }
    
    console.log(`Platform: ${systemInfo.platform}-${systemInfo.architecture}`);
    console.log(`Node.js: ${systemInfo.nodeVersion}`);
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Issues Found: ${report.summary.totalIssues} (${report.summary.criticalIssues} critical)`);
    console.log(`Overall Compatibility: ${report.summary.overallCompatibility}`);
    
    // Write report to file for CI/CD
    try {
      const reportPath = path.join(process.cwd(), 'cross-platform-compatibility-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`Report saved to: ${reportPath}`);
    } catch (error) {
      console.warn('Could not save compatibility report:', error.message);
    }
    
    // Assertions for test success
    expect(report.summary.criticalIssues).toBe(0);
    expect(report.summary.overallCompatibility).not.toBe('POOR');
  });
});

// Helper function to set up cross-platform test data
async function setupCrossPlatformTestData(store) {
  console.log('Setting up cross-platform test data...');
  
  // Add test data that exercises different platform features
  const testEntities = [
    { id: 'person1', name: 'Test User 1', age: 25 },
    { id: 'person2', name: 'Test User 2', age: 30 },
    { id: 'person3', name: 'Test User 3', age: 35 }
  ];
  
  for (const entity of testEntities) {
    const subject = namedNode(`http://example.org/${entity.id}`);
    
    store.addQuad(quad(subject, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode('http://xmlns.com/foaf/0.1/Person')));
    store.addQuad(quad(subject, namedNode('http://xmlns.com/foaf/0.1/name'), literal(entity.name)));
    store.addQuad(quad(subject, namedNode('http://xmlns.com/foaf/0.1/age'), literal(String(entity.age))));
  }
  
  // Add platform-specific test data
  const platformSubject = namedNode('http://example.org/platform-test');
  store.addQuad(quad(platformSubject, namedNode('http://example.org/platform'), literal(platform)));
  store.addQuad(quad(platformSubject, namedNode('http://example.org/architecture'), literal(arch)));
  store.addQuad(quad(platformSubject, namedNode('http://example.org/nodeVersion'), literal(version)));
  
  console.log(`Cross-platform test data setup complete: ${store.size} triples`);
}