/**
 * KGEN Drift Detection System
 * 
 * A comprehensive drift detection system that transforms SHACL validation
 * capabilities into file artifact comparison with CI/CD integration.
 * 
 * Features:
 * - File artifact vs expected output comparison
 * - Baseline artifact storage and comparison
 * - Non-zero exit codes for CI/CD integration
 * - Drift reporting with detailed changes
 * - Fast fingerprinting and comparison algorithms
 * - Semantic hashing for RDF/JSON/Code files
 * - Reuse of existing SHACL validation infrastructure
 */

// Core drift detection functionality
export { default as DriftDetector, DriftExitCodes } from './detector.js';

// CLI interface for command-line usage
export { 
  main as driftCLI, 
  driftCommand, 
  baselineCommand, 
  reportCommand 
} from './cli.js';

// Integration examples and utilities
export {
  basicDriftDetection,
  cicdIntegration,
  developmentWorkflow,
  semanticDriftDetection,
  testingIntegration,
  performanceMonitoring
} from './integration-example.js';

// Convenience factory function
export function createDriftDetector(config = {}) {
  return new DriftDetector(config);
}

// Preset configurations for common use cases
export const DriftConfigurations = {
  // Strict configuration for CI/CD pipelines
  cicd: {
    tolerance: 0.98,
    algorithm: 'semantic-hash',
    exitCodes: {
      success: 0,
      drift: 3,  // Fail CI/CD builds
      error: 1
    },
    drift: {
      enableBaseline: true,
      autoUpdate: false,
      includePatterns: ['*.js', '*.ts', '*.json', '*.ttl', '*.md'],
      ignorePaths: ['node_modules', '.git', 'dist', 'build', 'coverage', '.cache']
    },
    performance: {
      maxConcurrency: 4,
      chunkSize: 100
    }
  },

  // Relaxed configuration for development
  development: {
    tolerance: 0.90,
    algorithm: 'semantic-hash',
    exitCodes: {
      success: 0,
      drift: 0,  // Don't fail in development
      error: 1
    },
    drift: {
      enableBaseline: true,
      autoUpdate: true,  // Auto-create baselines
      includePatterns: ['*.js', '*.ts', '*.json', '*.ttl', '*.md'],
      ignorePaths: ['node_modules', '.git', 'dist', 'build']
    },
    performance: {
      maxConcurrency: 2,
      chunkSize: 50
    }
  },

  // Configuration optimized for RDF/semantic files
  semantic: {
    tolerance: 0.95,
    algorithm: 'semantic-hash',
    exitCodes: {
      success: 0,
      drift: 3,
      error: 1
    },
    drift: {
      enableBaseline: true,
      includePatterns: ['*.ttl', '*.rdf', '*.owl', '*.n3', '*.jsonld'],
      ignorePaths: ['.git', 'node_modules']
    },
    performance: {
      maxConcurrency: 3,
      chunkSize: 25  // Smaller chunks for complex RDF processing
    }
  },

  // High-performance configuration for large projects
  performance: {
    tolerance: 0.95,
    algorithm: 'semantic-hash',
    exitCodes: {
      success: 0,
      drift: 3,
      error: 1
    },
    drift: {
      enableBaseline: true,
      includePatterns: ['*.js', '*.ts', '*.json', '*.ttl'],
      ignorePaths: ['node_modules', '.git', 'dist', 'build', 'coverage']
    },
    performance: {
      maxConcurrency: 8,
      chunkSize: 200,
      cacheSize: 5000
    }
  },

  // Minimal configuration for testing
  testing: {
    tolerance: 0.99,
    algorithm: 'semantic-hash',
    exitCodes: {
      success: 0,
      drift: 1,  // Fail tests on drift
      error: 1
    },
    drift: {
      enableBaseline: true,
      autoUpdate: false,
      includePatterns: ['*'],  // Include all files for testing
      ignorePaths: []
    },
    performance: {
      maxConcurrency: 1,  // Sequential for predictable test results
      chunkSize: 10
    }
  }
};

// Utility functions for common operations
export async function detectDrift(targetPath, options = {}) {
  const config = { ...DriftConfigurations.development, ...options };
  const detector = new DriftDetector(config);
  
  try {
    await detector.initialize();
    return await detector.detectArtifactDrift({ targetPath, ...options });
  } finally {
    await detector.shutdown();
  }
}

export async function createBaseline(targetPath, options = {}) {
  const config = { ...DriftConfigurations.development, ...options };
  const detector = new DriftDetector(config);
  
  try {
    await detector.initialize();
    
    const artifacts = await detector.discoverArtifacts(targetPath);
    let created = 0;
    
    for (const artifactPath of artifacts) {
      const fingerprint = await detector.generateArtifactFingerprint(artifactPath);
      if (fingerprint) {
        await detector.updateBaseline(artifactPath, fingerprint);
        created++;
      }
    }
    
    return { created, total: artifacts.length };
  } finally {
    await detector.shutdown();
  }
}

export async function validateWithDrift(dataGraph, shapesGraph, targetPath, options = {}) {
  // Combine SHACL validation with drift detection
  const { KGenValidationEngine } = await import('../validation/index.js');
  
  const validationEngine = new KGenValidationEngine();
  const driftDetector = new DriftDetector(options);
  
  try {
    await validationEngine.initialize();
    await driftDetector.initialize();
    
    // Run SHACL validation
    const validationResults = await validationEngine.validateSHACL(dataGraph, shapesGraph);
    
    // Run drift detection
    const driftResults = await driftDetector.detectArtifactDrift({ targetPath });
    
    // Combine results
    return {
      validation: validationResults,
      drift: driftResults,
      passed: validationResults.conforms && !driftResults.driftDetected,
      exitCode: validationResults.conforms ? 
        (driftResults.driftDetected ? DriftExitCodes.DRIFT_DETECTED : DriftExitCodes.SUCCESS) :
        DriftExitCodes.ERROR
    };
    
  } finally {
    await validationEngine.shutdown();
    await driftDetector.shutdown();
  }
}

// Default export for convenience
export default DriftDetector;