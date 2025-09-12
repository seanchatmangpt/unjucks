/**
 * KGEN Drift Detection Integration Example
 * 
 * This example demonstrates how to integrate the drift detection system into
 * a development workflow, CI/CD pipeline, and testing process.
 */

import DriftDetector, { DriftExitCodes } from './detector.js';
import { KGenValidationEngine } from '../validation/index.js';
import fs from 'fs-extra';
import path from 'path';
import consola from 'consola';

/**
 * Example 1: Basic Drift Detection
 * Check if generated files match expected output
 */
async function basicDriftDetection() {
  consola.info('🔍 Example 1: Basic Drift Detection');
  
  const detector = new DriftDetector({
    tolerance: 0.95,
    algorithm: 'semantic-hash',
    storage: {
      baselinePath: './.kgen/baselines',
      reportsPath: './.kgen/drift-reports'
    }
  });

  try {
    await detector.initialize();

    // Detect drift in a specific directory
    const results = await detector.detectArtifactDrift({
      targetPath: './src/generated',
      format: 'both'
    });

    if (results.driftDetected) {
      consola.warn(`⚠️  Drift detected in ${results.summary.filesWithDrift} files`);
      
      // Show first few differences
      results.artifacts
        .filter(a => a.driftDetected)
        .slice(0, 3)
        .forEach(artifact => {
          consola.info(`📄 ${artifact.path}:`);
          artifact.differences.forEach(diff => {
            consola.info(`   - ${diff.type}: ${diff.description}`);
          });
        });

      return results.exitCode; // Return exit code for CI/CD
    } else {
      consola.success('✅ No drift detected - all files match expected state');
      return DriftExitCodes.SUCCESS;
    }

  } finally {
    await detector.shutdown();
  }
}

/**
 * Example 2: CI/CD Pipeline Integration
 * Fail build if generated artifacts don't match expected state
 */
async function cicdIntegration() {
  consola.info('🚀 Example 2: CI/CD Pipeline Integration');
  
  const detector = new DriftDetector({
    tolerance: 0.98, // Strict tolerance for CI/CD
    exitCodes: {
      success: 0,
      drift: 3,  // Non-zero exit code fails the build
      error: 1
    },
    drift: {
      includePatterns: ['*.js', '*.ts', '*.json', '*.ttl', '*.md'],
      ignorePaths: ['node_modules', '.git', 'dist', 'coverage']
    }
  });

  try {
    await detector.initialize();

    // Load expected artifacts from a reference directory
    const expectedData = await loadExpectedArtifacts('./expected-output');

    const results = await detector.detectArtifactDrift({
      targetPath: './output',
      expectedData
    });

    // Generate CI/CD friendly report
    const ciReport = {
      passed: !results.driftDetected,
      exitCode: results.exitCode,
      summary: results.summary,
      reportUrl: results.reportPath,
      recommendations: results.recommendations?.slice(0, 5) // Limit recommendations
    };

    // Save CI/CD report
    await fs.writeJson('./ci-drift-report.json', ciReport, { spaces: 2 });

    if (results.driftDetected) {
      consola.error('🚨 CI/CD Build Failed - Artifact drift detected');
      consola.error(`Exit code: ${results.exitCode}`);
      
      // Print summary for CI logs
      consola.error(`Files with drift: ${results.summary.filesWithDrift}`);
      consola.error(`New files: ${results.summary.newFiles}`);
      consola.error(`Modified files: ${results.summary.modifiedFiles}`);
      consola.error(`Deleted files: ${results.summary.deletedFiles}`);
      
      // Return non-zero exit code to fail CI/CD
      process.exit(results.exitCode);
    }

    consola.success('✅ CI/CD Build Passed - No drift detected');
    return results;

  } finally {
    await detector.shutdown();
  }
}

/**
 * Example 3: Development Workflow Integration
 * Auto-update baselines and provide developer feedback
 */
async function developmentWorkflow() {
  consola.info('👩‍💻 Example 3: Development Workflow Integration');
  
  const detector = new DriftDetector({
    tolerance: 0.90, // More relaxed for development
    drift: {
      autoUpdate: true, // Auto-create baselines for new files
      enableBaseline: true
    },
    storage: {
      baselinePath: './dev-baselines',
      reportsPath: './dev-reports'
    }
  });

  try {
    await detector.initialize();

    const results = await detector.detectArtifactDrift({
      targetPath: './src'
    });

    if (results.driftDetected) {
      consola.warn('⚠️  Changes detected in source files:');
      
      // Group by drift type
      const driftTypes = {
        new: results.artifacts.filter(a => a.status === 'new'),
        modified: results.artifacts.filter(a => a.status === 'modified'),
        deleted: results.artifacts.filter(a => a.status === 'deleted')
      };

      if (driftTypes.new.length > 0) {
        consola.info(`📄 New files (${driftTypes.new.length}):`);
        driftTypes.new.slice(0, 5).forEach(a => consola.info(`   + ${a.path}`));
      }

      if (driftTypes.modified.length > 0) {
        consola.info(`📝 Modified files (${driftTypes.modified.length}):`);
        driftTypes.modified.slice(0, 5).forEach(a => {
          const similarity = (a.similarity * 100).toFixed(1);
          consola.info(`   ~ ${a.path} (${similarity}% similarity)`);
        });
      }

      if (driftTypes.deleted.length > 0) {
        consola.warn(`🗑️  Deleted files (${driftTypes.deleted.length}):`);
        driftTypes.deleted.slice(0, 5).forEach(a => consola.warn(`   - ${a.path}`));
      }

      // Ask developer if they want to update baselines
      if (process.env.NODE_ENV !== 'ci') {
        consola.info('\n💡 Recommendations:');
        results.recommendations.forEach(rec => {
          consola.info(`   ${rec.priority.toUpperCase()}: ${rec.message}`);
          if (rec.action) {
            consola.info(`   Action: ${rec.action}`);
          }
        });

        // In a real scenario, you might prompt the user here
        consola.info('\nRun "kgen drift baseline update ./src" to update baselines');
      }
    } else {
      consola.success('✅ No changes detected - files match baselines');
    }

    return results;

  } finally {
    await detector.shutdown();
  }
}

/**
 * Example 4: Semantic RDF/Ontology Drift Detection
 * Specialized for ontology and knowledge graph files
 */
async function semanticDriftDetection() {
  consola.info('🧠 Example 4: Semantic RDF/Ontology Drift Detection');
  
  const detector = new DriftDetector({
    algorithm: 'semantic-hash',
    tolerance: 0.95,
    drift: {
      includePatterns: ['*.ttl', '*.rdf', '*.owl', '*.n3'],
      ignorePaths: ['.git', 'node_modules']
    }
  });

  try {
    await detector.initialize();

    // Focus on ontology files
    const results = await detector.detectArtifactDrift({
      targetPath: './ontologies'
    });

    if (results.driftDetected) {
      consola.warn('🔄 Ontology drift detected:');

      for (const artifact of results.artifacts.filter(a => a.driftDetected)) {
        consola.info(`\n📋 ${artifact.path}:`);
        consola.info(`   Status: ${artifact.status}`);
        consola.info(`   Semantic similarity: ${(artifact.similarity * 100).toFixed(1)}%`);
        
        // Show semantic-specific differences
        artifact.differences.forEach(diff => {
          if (diff.type === 'semantic-change') {
            consola.warn(`   ⚠️  Semantic change detected: ${diff.description}`);
          } else if (diff.type === 'missing-quad' || diff.type === 'unexpected-quad') {
            consola.info(`   📝 RDF difference: ${diff.type} - ${diff.quad}`);
          }
        });
      }

      // Additional semantic validation using SHACL
      const validationEngine = new KGenValidationEngine();
      await validationEngine.initialize();

      for (const artifact of results.artifacts.filter(a => a.type === 'rdf' && a.driftDetected)) {
        try {
          const rdfContent = await fs.readFile(artifact.path, 'utf8');
          const shapesContent = await loadSHACLShapes(artifact.path);
          
          if (shapesContent) {
            const validation = await validationEngine.validateSHACL(rdfContent, shapesContent);
            
            if (!validation.conforms) {
              consola.warn(`   🚫 SHACL validation failed for ${artifact.path}:`);
              validation.results.slice(0, 3).forEach(violation => {
                consola.warn(`      - ${violation.message.join(', ')}`);
              });
            }
          }
        } catch (error) {
          consola.warn(`   ⚠️  Could not validate ${artifact.path}: ${error.message}`);
        }
      }

      await validationEngine.shutdown();
    } else {
      consola.success('✅ No ontology drift detected');
    }

    return results;

  } finally {
    await detector.shutdown();
  }
}

/**
 * Example 5: Automated Testing Integration
 * Use drift detection in test suites
 */
async function testingIntegration() {
  consola.info('🧪 Example 5: Testing Integration');
  
  const detector = new DriftDetector({
    tolerance: 0.99, // Very strict for tests
    storage: {
      baselinePath: './test-baselines',
      reportsPath: './test-reports'
    }
  });

  try {
    await detector.initialize();

    // Test generated test fixtures
    const results = await detector.detectArtifactDrift({
      targetPath: './tests/fixtures/generated'
    });

    if (results.driftDetected) {
      const errorMessage = `Test fixtures have drifted from expected state:\n` +
        `- Files with drift: ${results.summary.filesWithDrift}\n` +
        `- New files: ${results.summary.newFiles}\n` +
        `- Modified files: ${results.summary.modifiedFiles}\n` +
        `- Deleted files: ${results.summary.deletedFiles}`;

      // In a test environment, you might throw an error
      throw new Error(errorMessage);
    }

    consola.success('✅ All test fixtures match expected state');
    return true;

  } finally {
    await detector.shutdown();
  }
}

/**
 * Example 6: Performance Monitoring
 * Track drift detection performance over time
 */
async function performanceMonitoring() {
  consola.info('📊 Example 6: Performance Monitoring');
  
  const detector = new DriftDetector({
    performance: {
      maxConcurrency: 8, // Higher concurrency
      chunkSize: 50,     // Larger chunks
      cacheSize: 2000    // Larger cache
    }
  });

  try {
    await detector.initialize();

    const startTime = this.getDeterministicTimestamp();
    
    const results = await detector.detectArtifactDrift({
      targetPath: './large-project'
    });

    const totalTime = this.getDeterministicTimestamp() - startTime;
    const stats = detector.getStats();

    const performanceReport = {
      timestamp: this.getDeterministicDate().toISOString(),
      totalProcessingTime: totalTime,
      filesProcessed: stats.filesProcessed,
      averageTimePerFile: stats.averageProcessingTime,
      cacheEfficiency: stats.cacheEfficiency,
      driftDetected: results.driftDetected,
      summary: results.summary
    };

    // Save performance metrics
    const metricsPath = './performance-metrics.json';
    let metrics = [];
    
    if (await fs.pathExists(metricsPath)) {
      metrics = await fs.readJson(metricsPath);
    }
    
    metrics.push(performanceReport);
    await fs.writeJson(metricsPath, metrics, { spaces: 2 });

    consola.info(`📈 Performance Report:`);
    consola.info(`   Total time: ${totalTime}ms`);
    consola.info(`   Files processed: ${stats.filesProcessed}`);
    consola.info(`   Average time per file: ${stats.averageProcessingTime.toFixed(2)}ms`);
    consola.info(`   Cache efficiency: ${stats.cacheEfficiency.toFixed(1)}%`);

    return performanceReport;

  } finally {
    await detector.shutdown();
  }
}

/**
 * Helper Functions
 */

async function loadExpectedArtifacts(expectedDir) {
  if (!await fs.pathExists(expectedDir)) {
    consola.warn(`Expected directory does not exist: ${expectedDir}`);
    return {};
  }

  const expectedData = {};
  const files = await fs.readdir(expectedDir, { recursive: true });
  
  for (const file of files) {
    const filePath = path.join(expectedDir, file);
    const stats = await fs.stat(filePath);
    
    if (stats.isFile()) {
      expectedData[file] = await fs.readFile(filePath, 'utf8');
    }
  }

  return expectedData;
}

async function loadSHACLShapes(ontologyPath) {
  // Look for corresponding SHACL shapes file
  const baseName = path.basename(ontologyPath, path.extname(ontologyPath));
  const shapesPath = path.join(path.dirname(ontologyPath), `${baseName}-shapes.ttl`);
  
  if (await fs.pathExists(shapesPath)) {
    return await fs.readFile(shapesPath, 'utf8');
  }
  
  // Look in a shapes directory
  const shapesDir = path.join(path.dirname(ontologyPath), 'shapes');
  const shapesDirPath = path.join(shapesDir, `${baseName}.ttl`);
  
  if (await fs.pathExists(shapesDirPath)) {
    return await fs.readFile(shapesDirPath, 'utf8');
  }
  
  return null;
}

/**
 * Main Example Runner
 */
async function runExamples() {
  consola.info('🚀 KGEN Drift Detection Integration Examples');
  consola.info('='.repeat(50));

  try {
    // Run all examples
    await basicDriftDetection();
    console.log();

    await cicdIntegration();
    console.log();

    await developmentWorkflow();
    console.log();

    await semanticDriftDetection();
    console.log();

    await testingIntegration();
    console.log();

    await performanceMonitoring();
    console.log();

    consola.success('✅ All examples completed successfully');

  } catch (error) {
    consola.error('❌ Example failed:', error.message);
    process.exit(1);
  }
}

// Export examples for individual use
export {
  basicDriftDetection,
  cicdIntegration,
  developmentWorkflow,
  semanticDriftDetection,
  testingIntegration,
  performanceMonitoring
};

// Run examples if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples();
}