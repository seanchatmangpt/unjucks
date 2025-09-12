/**
 * Deterministic Verify Command
 * 
 * Verifies reproducibility by multiple generation runs ensuring byte-for-byte reproducibility.
 * Integrates with the deterministic engine for autonomous agent systems.
 */

import { defineCommand } from 'citty';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join, resolve, basename } from 'path';
import { spawn } from 'child_process';
import { tmpdir } from 'os';

export default defineCommand({
  meta: {
    name: 'verify',
    description: 'Verify reproducibility by multiple generation runs'
  },
  args: {
    graph: {
      type: 'string',
      description: 'Path to knowledge graph file for generation',
      required: true
    },
    template: {
      type: 'string',
      description: 'Template name or path for generation',
      required: true
    },
    seed: {
      type: 'string',
      description: 'Deterministic seed for reproducible generation',
      default: '0'
    },
    runs: {
      type: 'number',
      description: 'Number of generation runs to compare',
      default: 3
    },
    'parallel-runs': {
      type: 'boolean',
      description: 'Run generations in parallel for speed',
      default: false
    },
    'keep-artifacts': {
      type: 'boolean',
      description: 'Keep generated artifacts after verification',
      default: false
    },
    'output-dir': {
      type: 'string',
      description: 'Base directory for verification runs',
      required: false
    },
    'compare-mode': {
      type: 'string',
      description: 'Comparison mode (hash|content|both)',
      default: 'hash'
    },
    'tolerance': {
      type: 'number',
      description: 'Tolerance for timestamp variations (ms)',
      default: 0
    },
    'verbose': {
      type: 'boolean',
      description: 'Verbose output with detailed comparison',
      default: false
    }
  },
  async run({ args }) {
    try {
      const startTime = this.getDeterministicTimestamp();
      
      // Validate inputs
      const graphPath = resolve(args.graph);
      if (!existsSync(graphPath)) {
        throw new Error(`Knowledge graph file not found: ${graphPath}`);
      }
      
      // Setup output directories
      const baseDir = args['output-dir'] || join(tmpdir(), `kgen-verify-${this.getDeterministicTimestamp()}`);
      mkdirSync(baseDir, { recursive: true });
      
      const runDirs = [];
      for (let i = 0; i < args.runs; i++) {
        const runDir = join(baseDir, `run_${i + 1}`);
        mkdirSync(runDir, { recursive: true });
        runDirs.push(runDir);
      }
      
      // Execute generation runs
      console.log(`Starting ${args.runs} verification runs...`);
      const generationResults = args['parallel-runs'] 
        ? await runGenerationsParallel(runDirs, args)
        : await runGenerationsSequential(runDirs, args);
      
      // Collect artifacts from each run
      const artifactSets = await collectArtifactSets(runDirs);
      
      // Compare all runs for reproducibility
      const comparisonResults = compareArtifactSets(artifactSets, args);
      
      // Calculate verification metrics
      const metrics = calculateVerificationMetrics(generationResults, comparisonResults, startTime);
      
      // Prepare result
      const result = {
        success: comparisonResults.reproducible,
        data: {
          verification: {
            reproducible: comparisonResults.reproducible,
            runs: args.runs,
            parallelExecution: args['parallel-runs'],
            seed: args.seed,
            template: args.template,
            graph: graphPath
          },
          comparison: comparisonResults,
          generations: generationResults.map(r => ({
            run: r.run,
            success: r.success,
            duration: r.duration,
            artifacts: r.artifactCount,
            errors: r.errors
          })),
          metrics,
          directories: {
            base: baseDir,
            runs: runDirs,
            keepArtifacts: args['keep-artifacts']
          }
        },
        timestamp: this.getDeterministicDate().toISOString()
      };
      
      // Output results
      if (args.verbose) {
        outputVerboseResults(result);
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
      
      // Cleanup if not keeping artifacts
      if (!args['keep-artifacts']) {
        try {
          rmSync(baseDir, { recursive: true, force: true });
        } catch (error) {
          console.warn(`Warning: Could not cleanup ${baseDir}: ${error.message}`);
        }
      }
      
      // Exit with error if not reproducible
      if (!comparisonResults.reproducible) {
        process.exit(1);
      }
      
      return result;
      
    } catch (error) {
      const result = {
        success: false,
        error: {
          message: error.message,
          code: 'VERIFICATION_ERROR',
          graph: args.graph,
          template: args.template,
          timestamp: this.getDeterministicDate().toISOString()
        }
      };
      
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }
  }
});

/**
 * Run generations sequentially
 */
async function runGenerationsSequential(runDirs, args) {
  const results = [];
  
  for (let i = 0; i < runDirs.length; i++) {
    const runDir = runDirs[i];
    console.log(`Running generation ${i + 1}/${runDirs.length}...`);
    
    const result = await runSingleGeneration(runDir, args, i + 1);
    results.push(result);
    
    if (!result.success) {
      console.warn(`Warning: Run ${i + 1} failed: ${result.error}`);
    }
  }
  
  return results;
}

/**
 * Run generations in parallel
 */
async function runGenerationsParallel(runDirs, args) {
  console.log(`Running ${runDirs.length} generations in parallel...`);
  
  const promises = runDirs.map((runDir, i) => 
    runSingleGeneration(runDir, args, i + 1)
  );
  
  const results = await Promise.all(promises);
  
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.warn(`Warning: ${failures.length} runs failed`);
  }
  
  return results;
}

/**
 * Run single generation
 */
async function runSingleGeneration(outputDir, args, runNumber) {
  const startTime = this.getDeterministicTimestamp();
  
  try {
    // Use the generate command to create artifacts
    const generateArgs = [
      'deterministic', 'generate',
      '--graph', args.graph,
      '--template', args.template,
      '--output', outputDir,
      '--seed', args.seed,
      '--include-manifest', 'true'
    ];
    
    const result = await executeCommand('kgen', generateArgs);
    
    // Count generated artifacts
    const manifestPath = join(outputDir, 'generation-manifest.json');
    let artifactCount = 0;
    
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      artifactCount = manifest.artifacts?.length || 0;
    }
    
    return {
      run: runNumber,
      success: result.success,
      duration: this.getDeterministicTimestamp() - startTime,
      artifactCount,
      output: result.output,
      errors: result.success ? [] : [result.error]
    };
    
  } catch (error) {
    return {
      run: runNumber,
      success: false,
      duration: this.getDeterministicTimestamp() - startTime,
      artifactCount: 0,
      output: '',
      errors: [error.message]
    };
  }
}

/**
 * Execute command and return result
 */
function executeCommand(command, args) {
  return new Promise((resolve) => {
    const process = spawn(command, args, { stdio: 'pipe' });
    
    let output = '';
    let errorOutput = '';
    
    process.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    process.on('close', (code) => {
      resolve({
        success: code === 0,
        output: output,
        error: errorOutput,
        exitCode: code
      });
    });
  });
}

/**
 * Collect artifact sets from run directories
 */
async function collectArtifactSets(runDirs) {
  const artifactSets = [];
  
  for (let i = 0; i < runDirs.length; i++) {
    const runDir = runDirs[i];
    const manifestPath = join(runDir, 'generation-manifest.json');
    
    if (!existsSync(manifestPath)) {
      console.warn(`Warning: No manifest found for run ${i + 1}`);
      artifactSets.push({
        run: i + 1,
        artifacts: [],
        manifest: null
      });
      continue;
    }
    
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const artifacts = [];
    
    for (const artifactInfo of manifest.artifacts || []) {
      const artifactPath = join(runDir, artifactInfo.path);
      
      if (existsSync(artifactPath)) {
        const content = readFileSync(artifactPath, 'utf8');
        const actualHash = createHash('sha256').update(content).digest('hex');
        
        artifacts.push({
          path: artifactInfo.path,
          content,
          hash: actualHash,
          expectedHash: artifactInfo.hash,
          size: content.length
        });
      } else {
        console.warn(`Warning: Artifact ${artifactInfo.path} not found in run ${i + 1}`);
      }
    }
    
    artifactSets.push({
      run: i + 1,
      artifacts,
      manifest
    });
  }
  
  return artifactSets;
}

/**
 * Compare artifact sets for reproducibility
 */
function compareArtifactSets(artifactSets, args) {
  if (artifactSets.length < 2) {
    return {
      reproducible: true,
      message: 'Only one run available - cannot verify reproducibility',
      differences: []
    };
  }
  
  const reference = artifactSets[0];
  const differences = [];
  let reproducible = true;
  
  for (let i = 1; i < artifactSets.length; i++) {
    const current = artifactSets[i];
    
    // Compare artifact counts
    if (reference.artifacts.length !== current.artifacts.length) {
      reproducible = false;
      differences.push({
        type: 'artifact-count-mismatch',
        reference: { run: reference.run, count: reference.artifacts.length },
        current: { run: current.run, count: current.artifacts.length }
      });
      continue;
    }
    
    // Compare individual artifacts
    for (let j = 0; j < reference.artifacts.length; j++) {
      const refArtifact = reference.artifacts[j];
      const curArtifact = current.artifacts.find(a => a.path === refArtifact.path);
      
      if (!curArtifact) {
        reproducible = false;
        differences.push({
          type: 'missing-artifact',
          artifact: refArtifact.path,
          reference: reference.run,
          current: current.run
        });
        continue;
      }
      
      // Compare based on mode
      if (args['compare-mode'] === 'hash' || args['compare-mode'] === 'both') {
        if (refArtifact.hash !== curArtifact.hash) {
          reproducible = false;
          differences.push({
            type: 'hash-mismatch',
            artifact: refArtifact.path,
            reference: { run: reference.run, hash: refArtifact.hash },
            current: { run: current.run, hash: curArtifact.hash }
          });
        }
      }
      
      if (args['compare-mode'] === 'content' || args['compare-mode'] === 'both') {
        if (refArtifact.content !== curArtifact.content) {
          reproducible = false;
          
          // Find content differences
          const contentDiff = findContentDifferences(refArtifact.content, curArtifact.content);
          
          differences.push({
            type: 'content-mismatch',
            artifact: refArtifact.path,
            reference: reference.run,
            current: current.run,
            differences: contentDiff
          });
        }
      }
    }
  }
  
  return {
    reproducible,
    runs: artifactSets.length,
    artifactsPerRun: artifactSets.map(set => set.artifacts.length),
    differences,
    message: reproducible 
      ? `All ${artifactSets.length} runs produced identical artifacts` 
      : `Found ${differences.length} differences between runs`
  };
}

/**
 * Find content differences between two strings
 */
function findContentDifferences(content1, content2) {
  const lines1 = content1.split('\n');
  const lines2 = content2.split('\n');
  
  const differences = [];
  const maxLines = Math.max(lines1.length, lines2.length);
  
  for (let i = 0; i < maxLines && differences.length < 10; i++) {
    const line1 = lines1[i] || '';
    const line2 = lines2[i] || '';
    
    if (line1 !== line2) {
      differences.push({
        line: i + 1,
        reference: line1,
        current: line2
      });
    }
  }
  
  return differences;
}

/**
 * Calculate verification metrics
 */
function calculateVerificationMetrics(generationResults, comparisonResults, startTime) {
  const successfulRuns = generationResults.filter(r => r.success).length;
  const failedRuns = generationResults.length - successfulRuns;
  const totalDuration = this.getDeterministicTimestamp() - startTime;
  const avgGenerationTime = generationResults.reduce((sum, r) => sum + r.duration, 0) / generationResults.length;
  
  return {
    totalVerificationTime: totalDuration,
    averageGenerationTime: Math.round(avgGenerationTime),
    successfulRuns,
    failedRuns,
    reproducibilityScore: comparisonResults.reproducible ? 1.0 : 0.0,
    differences: comparisonResults.differences.length,
    artifactConsistency: comparisonResults.reproducible ? 100 : 0
  };
}

/**
 * Output verbose results
 */
function outputVerboseResults(result) {
  console.log('\n=== Deterministic Verification Results ===');
  console.log(`Reproducible: ${result.data.verification.reproducible ? 'YES' : 'NO'}`);
  console.log(`Runs: ${result.data.verification.runs}`);
  console.log(`Seed: ${result.data.verification.seed}`);
  console.log(`Template: ${result.data.verification.template}`);
  
  console.log('\n=== Generation Results ===');
  result.data.generations.forEach(gen => {
    console.log(`Run ${gen.run}: ${gen.success ? 'SUCCESS' : 'FAILED'} (${gen.duration}ms, ${gen.artifacts} artifacts)`);
    if (gen.errors.length > 0) {
      gen.errors.forEach(error => console.log(`  Error: ${error}`));
    }
  });
  
  console.log('\n=== Metrics ===');
  console.log(`Total Time: ${result.data.metrics.totalVerificationTime}ms`);
  console.log(`Avg Generation Time: ${result.data.metrics.averageGenerationTime}ms`);
  console.log(`Reproducibility Score: ${result.data.metrics.reproducibilityScore}`);
  
  if (result.data.comparison.differences.length > 0) {
    console.log('\n=== Differences Found ===');
    result.data.comparison.differences.forEach((diff, i) => {
      console.log(`${i + 1}. ${diff.type}: ${diff.artifact || 'N/A'}`);
      if (diff.reference && diff.current) {
        console.log(`   Reference (Run ${diff.reference.run}): ${JSON.stringify(diff.reference)}`);
        console.log(`   Current (Run ${diff.current.run}): ${JSON.stringify(diff.current)}`);
      }
    });
  }
  
  console.log('\n=== Full JSON Results ===');
  console.log(JSON.stringify(result, null, 2));
}