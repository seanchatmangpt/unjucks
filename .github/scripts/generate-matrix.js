#!/usr/bin/env node

/**
 * Intelligent Matrix Generation Script
 * 
 * This script dynamically generates CI/CD test matrices based on:
 * - Branch type and name
 * - Changed files and their patterns
 * - Historical failure data
 * - Resource constraints
 * 
 * Usage:
 *   node .github/scripts/generate-matrix.js
 *   
 * Environment Variables:
 *   GITHUB_REF - Current branch reference
 *   GITHUB_EVENT_NAME - Event that triggered the workflow
 *   CHANGED_FILES - JSON array of changed file paths
 *   FORCE_MATRIX - Override matrix type (minimal|standard|full|release)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

class IntelligentMatrixGenerator {
  constructor() {
    this.matrices = this.loadMatrixDefinitions();
    this.filePatterns = this.loadFilePatterns();
    this.exclusions = this.loadExclusionRules();
    this.historicalData = this.loadHistoricalData();
  }

  /**
   * Load matrix definitions for different scenarios
   */
  loadMatrixDefinitions() {
    return {
      minimal: {
        description: "Minimal matrix for fast feedback on feature branches",
        os: ["ubuntu-latest"],
        node: ["20"],
        testStrategy: ["smoke"],
        estimatedDuration: 5, // minutes
        resourceCost: "low"
      },
      standard: {
        description: "Standard matrix for develop branch and moderate changes",
        os: ["ubuntu-latest", "windows-latest"],
        node: ["18", "20", "22"],
        testStrategy: ["smoke", "integration"],
        estimatedDuration: 25, // minutes
        resourceCost: "medium"
      },
      full: {
        description: "Full matrix for main branch and critical changes",
        os: ["ubuntu-latest", "windows-latest", "macos-latest"],
        node: ["18", "20", "22"],
        testStrategy: ["smoke", "integration", "e2e"],
        estimatedDuration: 45, // minutes
        resourceCost: "high"
      },
      release: {
        description: "Complete matrix for release validation",
        os: ["ubuntu-latest", "windows-latest", "macos-latest"],
        node: ["16", "18", "20", "22"],
        testStrategy: ["smoke", "integration", "e2e", "compatibility"],
        estimatedDuration: 90, // minutes
        resourceCost: "very-high"
      }
    };
  }

  /**
   * Load file pattern rules for matrix adjustments
   */
  loadFilePatterns() {
    return {
      core: {
        patterns: ["src/**", "bin/**", "lib/**"],
        forceMatrix: "full",
        reason: "Core changes require comprehensive testing"
      },
      security: {
        patterns: ["src/security/**", "package*.json", ".github/**", "scripts/**"],
        forceMatrix: "full",
        additionalTests: ["security", "audit"],
        reason: "Security changes require full validation"
      },
      performance: {
        patterns: ["src/performance/**", "benchmarks/**", "src/core/**"],
        forceMatrix: "full",
        additionalTests: ["performance", "benchmarks"],
        reason: "Performance changes require benchmarking"
      },
      dependencies: {
        patterns: ["package*.json", "yarn.lock", "pnpm-lock.yaml"],
        forceMatrix: "standard",
        additionalTests: ["compatibility"],
        reason: "Dependency changes need compatibility testing"
      },
      config: {
        patterns: ["*.config.*", ".eslintrc*", ".prettierrc*", "tsconfig.json"],
        matrix: "standard",
        focusTests: ["lint", "format", "typecheck"],
        reason: "Config changes need validation but not full testing"
      },
      docs: {
        patterns: ["docs/**", "*.md", "README.*", "CHANGELOG.*"],
        forceMatrix: "minimal",
        skipTests: ["integration", "performance", "e2e"],
        reason: "Documentation changes don't affect functionality"
      },
      tests: {
        patterns: ["tests/**", "test/**", "**/*.test.*", "**/*.spec.*"],
        matrix: "standard",
        focusTests: ["unit", "integration"],
        reason: "Test changes need moderate validation"
      },
      ci: {
        patterns: [".github/**", "scripts/ci/**", "Dockerfile*"],
        forceMatrix: "full",
        additionalTests: ["build", "deploy"],
        reason: "CI changes need comprehensive validation"
      }
    };
  }

  /**
   * Load exclusion rules for known incompatibilities
   */
  loadExclusionRules() {
    return {
      // Node.js version exclusions
      nodeCompatibility: {
        "16": {
          reason: "Node 16 deprecated, security vulnerabilities",
          excludeFrom: ["main", "develop"],
          onlyFor: ["release"]
        }
      },
      
      // OS-specific exclusions  
      osOptimizations: {
        windows: {
          skipNode18: {
            unless: ["security", "core", "performance"],
            reason: "Performance issues with certain dependencies"
          },
          skipForPatterns: ["docs", "config"],
          reason: "Windows testing not critical for non-code changes"
        },
        macos: {
          skipNode18: {
            unless: ["core", "security"],
            reason: "Optional dependency compilation issues"
          },
          skipForPatterns: ["docs", "config", "tests"],
          reason: "macOS testing expensive, use for critical changes only"
        }
      },

      // Performance-based exclusions
      performanceOptimizations: {
        skipRedundant: {
          // Skip Node 18 on Windows and macOS for non-critical changes
          combinations: [
            { os: "windows-latest", node: "18", unless: ["core", "security"] },
            { os: "macos-latest", node: "18", unless: ["core", "security"] },
            { os: "macos-latest", node: "22", unless: ["core", "performance"] }
          ]
        }
      }
    };
  }

  /**
   * Load historical failure data for learning
   */
  loadHistoricalData() {
    const historyFile = join(__dirname, '../data/matrix-history.json');
    
    if (existsSync(historyFile)) {
      try {
        return JSON.parse(readFileSync(historyFile, 'utf8'));
      } catch (error) {
        console.warn('Failed to load historical data:', error.message);
      }
    }

    // Default historical patterns
    return {
      failurePatterns: {
        'windows-latest-18': 0.15,  // 15% failure rate
        'macos-latest-22': 0.08,    // 8% failure rate
        'ubuntu-latest-20': 0.02    // 2% failure rate
      },
      successPatterns: {
        'ubuntu-latest-20': 0.98,
        'windows-latest-20': 0.92,
        'macos-latest-20': 0.94
      },
      avgDurations: {
        'ubuntu-latest': 8,     // minutes
        'windows-latest': 12,   // minutes
        'macos-latest': 15      // minutes
      }
    };
  }

  /**
   * Analyze changed files to determine patterns
   */
  analyzeChangedFiles(changedFiles) {
    const patterns = new Set();
    const analysis = {
      patterns: [],
      riskLevel: 'low',
      recommendedMatrix: 'minimal',
      reasons: []
    };

    if (!changedFiles || changedFiles.length === 0) {
      return analysis;
    }

    // Check each file against known patterns
    for (const [patternName, config] of Object.entries(this.filePatterns)) {
      const matches = changedFiles.some(file =>
        config.patterns.some(pattern =>
          this.matchPattern(file, pattern)
        )
      );

      if (matches) {
        patterns.add(patternName);
        analysis.patterns.push(patternName);
        analysis.reasons.push(config.reason);

        // Update risk level and matrix recommendation
        if (config.forceMatrix) {
          const matrixPriority = this.getMatrixPriority(config.forceMatrix);
          const currentPriority = this.getMatrixPriority(analysis.recommendedMatrix);
          
          if (matrixPriority > currentPriority) {
            analysis.recommendedMatrix = config.forceMatrix;
            analysis.riskLevel = this.getRiskLevel(config.forceMatrix);
          }
        }
      }
    }

    return analysis;
  }

  /**
   * Match file path against glob pattern
   */
  matchPattern(filePath, pattern) {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')  // ** matches any path
      .replace(/\*/g, '[^/]*') // * matches within directory
      .replace(/\?/g, '.')     // ? matches single character
      .replace(/\./g, '\\.');  // Escape dots

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  /**
   * Get matrix priority for comparison
   */
  getMatrixPriority(matrixType) {
    const priorities = { minimal: 1, standard: 2, full: 3, release: 4 };
    return priorities[matrixType] || 1;
  }

  /**
   * Get risk level for matrix type
   */
  getRiskLevel(matrixType) {
    const riskLevels = { minimal: 'low', standard: 'medium', full: 'high', release: 'critical' };
    return riskLevels[matrixType] || 'low';
  }

  /**
   * Determine base matrix from branch and event context
   */
  determineBaseMatrix(context) {
    const { ref, refType, eventName } = context;

    // Force override from environment
    if (process.env.FORCE_MATRIX) {
      return process.env.FORCE_MATRIX;
    }

    // Release tags get complete matrix
    if (refType === 'tag') {
      return 'release';
    }

    // Branch-based selection
    if (ref === 'refs/heads/main') {
      return 'full';
    } else if (ref === 'refs/heads/develop') {
      return 'standard';
    } else if (ref.startsWith('refs/heads/hotfix/')) {
      return 'full';  // Hotfixes need full validation
    } else {
      return 'minimal';  // Feature branches, PRs, etc.
    }
  }

  /**
   * Apply smart exclusions to matrix
   */
  applyExclusions(matrix, context, fileAnalysis) {
    const excluded = [];
    const { patterns } = fileAnalysis;

    // Apply Node version exclusions
    if (matrix.node.includes('16') && context.ref !== 'refs/tags/*') {
      matrix.node = matrix.node.filter(v => v !== '16');
      excluded.push({ node: '16', reason: 'Node 16 deprecated for non-release builds' });
    }

    // Apply OS-specific exclusions based on file patterns
    const hasDocsOnly = patterns.includes('docs') && patterns.length === 1;
    const hasConfigOnly = patterns.includes('config') && patterns.length === 1;
    const hasCriticalChanges = patterns.some(p => ['core', 'security', 'performance'].includes(p));

    if (!hasCriticalChanges && (hasDocsOnly || hasConfigOnly)) {
      // Skip Windows and macOS for non-critical changes
      matrix.os = matrix.os.filter(os => os === 'ubuntu-latest');
      excluded.push({ 
        os: ['windows-latest', 'macos-latest'], 
        reason: 'Non-critical changes don\'t require cross-platform testing' 
      });
    } else if (!hasCriticalChanges) {
      // Skip Node 18 on non-Ubuntu for non-critical changes
      const newCombinations = [];
      
      matrix.os.forEach(os => {
        matrix.node.forEach(node => {
          if (os !== 'ubuntu-latest' && node === '18') {
            excluded.push({ 
              os, 
              node, 
              reason: 'Node 18 on non-Ubuntu skipped for non-critical changes' 
            });
          } else {
            newCombinations.push({ os, node });
          }
        });
      });

      // Rebuild matrix from valid combinations
      const validOs = [...new Set(newCombinations.map(c => c.os))];
      const validNodes = [...new Set(newCombinations.map(c => c.node))];
      
      matrix.os = validOs;
      matrix.node = validNodes;
    }

    return { matrix, excluded };
  }

  /**
   * Generate the final matrix configuration
   */
  generateMatrix(context, changedFiles) {
    console.log('🎯 Generating intelligent matrix configuration...');
    console.log(`Context: ${JSON.stringify(context, null, 2)}`);
    
    // Analyze changed files
    const fileAnalysis = this.analyzeChangedFiles(changedFiles);
    console.log(`File analysis: ${JSON.stringify(fileAnalysis, null, 2)}`);

    // Determine base matrix
    const baseMatrixType = this.determineBaseMatrix(context);
    console.log(`Base matrix type: ${baseMatrixType}`);

    // Apply file-based overrides
    const finalMatrixType = fileAnalysis.recommendedMatrix !== 'minimal' ? 
      fileAnalysis.recommendedMatrix : baseMatrixType;
    console.log(`Final matrix type: ${finalMatrixType}`);

    // Get matrix configuration
    let matrix = { ...this.matrices[finalMatrixType] };
    
    // Apply smart exclusions
    const { matrix: optimizedMatrix, excluded } = this.applyExclusions(matrix, context, fileAnalysis);
    
    // Generate test strategy
    const testStrategy = this.generateTestStrategy(finalMatrixType, fileAnalysis);

    // Calculate estimated metrics
    const metrics = this.calculateMetrics(optimizedMatrix, testStrategy);

    const result = {
      matrixType: finalMatrixType,
      matrix: optimizedMatrix,
      testStrategy,
      fileAnalysis,
      excluded,
      metrics,
      metadata: {
        generatedAt: new Date().toISOString(),
        generator: 'intelligent-matrix-v1.0.0',
        context,
        reasoning: [
          `Base matrix: ${baseMatrixType} (from branch: ${context.ref})`,
          ...fileAnalysis.reasons,
          `Final matrix: ${finalMatrixType}`,
          `Excluded combinations: ${excluded.length}`
        ]
      }
    };

    console.log('✅ Matrix generation completed');
    console.log(`Estimated duration: ${metrics.estimatedDuration} minutes`);
    console.log(`Resource cost: ${metrics.resourceCost}`);
    console.log(`Job count: ${metrics.jobCount}`);

    return result;
  }

  /**
   * Generate test strategy based on matrix and file changes
   */
  generateTestStrategy(matrixType, fileAnalysis) {
    const baseStrategy = this.matrices[matrixType].testStrategy;
    const additionalTests = new Set(baseStrategy);

    // Add pattern-specific tests
    fileAnalysis.patterns.forEach(pattern => {
      const config = this.filePatterns[pattern];
      if (config.additionalTests) {
        config.additionalTests.forEach(test => additionalTests.add(test));
      }
      if (config.focusTests) {
        config.focusTests.forEach(test => additionalTests.add(test));
      }
    });

    // Remove skipped tests
    fileAnalysis.patterns.forEach(pattern => {
      const config = this.filePatterns[pattern];
      if (config.skipTests) {
        config.skipTests.forEach(test => additionalTests.delete(test));
      }
    });

    return Array.from(additionalTests);
  }

  /**
   * Calculate estimated metrics for the matrix
   */
  calculateMetrics(matrix, testStrategy) {
    const jobCount = matrix.os.length * matrix.node.length;
    const avgDuration = matrix.os.reduce((sum, os) => 
      sum + (this.historicalData.avgDurations[os] || 10), 0) / matrix.os.length;
    
    const testMultiplier = testStrategy.length * 0.3; // Each additional test adds 30% time
    const estimatedDuration = Math.ceil(avgDuration * (1 + testMultiplier));

    const resourceCost = jobCount * estimatedDuration > 100 ? 'high' : 
                        jobCount * estimatedDuration > 50 ? 'medium' : 'low';

    return {
      jobCount,
      estimatedDuration,
      resourceCost,
      testCount: testStrategy.length,
      parallelism: Math.min(jobCount, 10) // GitHub Actions parallel limit
    };
  }

  /**
   * Save matrix configuration for GitHub Actions
   */
  saveGitHubOutputs(matrixConfig) {
    const outputs = {
      matrix: JSON.stringify({
        include: this.generateMatrixInclude(matrixConfig.matrix)
      }),
      'test-strategy': matrixConfig.testStrategy.join(','),
      'matrix-type': matrixConfig.matrixType,
      'job-count': matrixConfig.metrics.jobCount.toString(),
      'estimated-duration': matrixConfig.metrics.estimatedDuration.toString(),
      'resource-cost': matrixConfig.metrics.resourceCost
    };

    // Write to GitHub Actions outputs
    if (process.env.GITHUB_OUTPUT) {
      const outputLines = Object.entries(outputs)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      
      writeFileSync(process.env.GITHUB_OUTPUT, outputLines + '\n', { flag: 'a' });
      console.log('📤 Saved outputs to GITHUB_OUTPUT');
    }

    // Also output to console for debugging
    console.log('Matrix Configuration:');
    console.log(JSON.stringify(outputs, null, 2));

    return outputs;
  }

  /**
   * Generate matrix include array for GitHub Actions
   */
  generateMatrixInclude(matrix) {
    const includes = [];
    
    matrix.os.forEach(os => {
      matrix.node.forEach(node => {
        includes.push({
          os,
          node,
          'node-version': node
        });
      });
    });

    return includes;
  }

  /**
   * Save historical data for learning
   */
  saveHistoricalData(matrixConfig, results) {
    // This would typically be called after workflow completion
    // to record success/failure patterns for future optimization
    const historyFile = join(__dirname, '../data/matrix-history.json');
    
    // Update failure patterns, success rates, duration data
    // Implementation would depend on how results are collected
    console.log('📊 Historical data would be updated here');
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    const generator = new IntelligentMatrixGenerator();

    // Get context from environment variables
    const context = {
      ref: process.env.GITHUB_REF || 'refs/heads/feature/test',
      refType: process.env.GITHUB_REF_TYPE || 'branch',
      eventName: process.env.GITHUB_EVENT_NAME || 'push'
    };

    // Get changed files
    let changedFiles = [];
    if (process.env.CHANGED_FILES) {
      try {
        changedFiles = JSON.parse(process.env.CHANGED_FILES);
      } catch (error) {
        console.warn('Failed to parse CHANGED_FILES:', error.message);
      }
    }

    // Generate matrix configuration
    const matrixConfig = generator.generateMatrix(context, changedFiles);

    // Save outputs for GitHub Actions
    generator.saveGitHubOutputs(matrixConfig);

    // Save full configuration for debugging
    const configFile = join(__dirname, '../data/last-matrix-config.json');
    writeFileSync(configFile, JSON.stringify(matrixConfig, null, 2));
    console.log(`📁 Full configuration saved to ${configFile}`);

  } catch (error) {
    console.error('❌ Matrix generation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default IntelligentMatrixGenerator;