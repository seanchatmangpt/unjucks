#!/usr/bin/env node

/**
 * Enhanced Drift Detection Command
 * Integrates with the DriftDetectionEngine for comprehensive drift validation
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { DriftDetectionEngine } from '../../../kgen-core/src/validation/DriftDetectionEngine.js';

/**
 * Create enhanced drift detection command with comprehensive validation and attestation support
 * @returns {Command} The configured drift detect command
 */
export function createEnhancedDriftDetectCommand() {
  return new Command('detect')
    .alias('check')
    .description('Detect drift between current artifacts and lockfile state with comprehensive validation')
    .option('-l, --lock-file <path>', 'Path to kgen.lock.json file', 'kgen.lock.json')
    .option('-v, --verbose', 'Show detailed change information')
    .option('-d, --detailed', 'Show detailed diff analysis')
    .option('-j, --json', 'Output results in JSON format')
    .option('-s, --scan-new', 'Scan for new files not in lockfile', true)
    .option('-p, --patterns <patterns...>', 'File patterns to scan for new files')
    .option('-i, --ignore <patterns...>', 'Patterns to ignore when scanning')
    .option('--shacl', 'Enable SHACL validation', true)
    .option('--shapes-path <path>', 'Path to SHACL shapes file')
    .option('--semantic', 'Enable semantic constraint validation', true)
    .option('--attestation', 'Validate artifact attestations', true)
    .option('--regenerate', 'Attempt artifact regeneration where possible', false)
    .option('--regeneration-mode <mode>', 'Regeneration mode: memory, disk, hybrid', 'memory')
    .option('--compliance-rules <rules...>', 'Specific compliance rules to check')
    .option('--severity-threshold <level>', 'Minimum severity to report: LOW, MEDIUM, HIGH, CRITICAL', 'LOW')
    .option('--exit-code', 'Exit with non-zero code if drift detected', false)
    .option('--ci', 'CI-friendly output with machine-readable format', false)
    .option('--recommendations', 'Show actionable recommendations', true)
    .option('--stats', 'Show detection statistics', false)
    .option('--parallel', 'Enable parallel validation processing', false)
    .option('--timeout <seconds>', 'Maximum time to wait for detection', 300)
    .action(async (options) => {
      let engine = null;
      
      try {
        console.log(chalk.blue('🔍 KGEN Enhanced Drift Detection'));
        console.log(chalk.blue('━'.repeat(40)));
        
        // Initialize enhanced drift detection engine
        engine = new DriftDetectionEngine({
          lockFile: options.lockFile,
          scanNew: options.scanNew,
          patterns: options.patterns || ['**/*.ttl', '**/*.n3', '**/*.jsonld', '**/*.rdf'],
          ignore: options.ignore || ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
          validateSHACL: options.shacl,
          shapesPath: options.shapesPath,
          validateSemantic: options.semantic,
          attestationValidation: options.attestation,
          enableRegeneration: options.regenerate,
          regenerationMode: options.regenerationMode,
          complianceRules: options.complianceRules,
          severityThreshold: options.severityThreshold?.toUpperCase() || 'LOW',
          parallelProcessing: options.parallel,
          timeout: (options.timeout || 300) * 1000
        });
        
        console.log(chalk.gray('Initializing validation engine...'));
        await engine.initialize();
        
        // Set up event listeners for progress tracking
        if (options.verbose) {
          engine.on('file-processed', (data) => {
            console.log(chalk.gray(`  Processing: ${data.path}`));
          });
          
          engine.on('validation-complete', (data) => {
            const status = data.passed ? chalk.green('✓') : chalk.red('✗');
            console.log(chalk.gray(`  ${status} Validated: ${data.path}`));
          });
          
          engine.on('attestation-validated', (data) => {
            const status = data.valid ? chalk.green('✓') : chalk.yellow('⚠');
            console.log(chalk.gray(`  ${status} Attestation: ${data.path}`));
          });
          
          engine.on('regeneration-attempted', (data) => {
            const status = data.success ? chalk.blue('🔄') : chalk.yellow('⚠');
            console.log(chalk.gray(`  ${status} Regeneration: ${data.path}`));
          });
        }
        
        // Run enhanced drift detection with timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Detection timeout')), options.timeout * 1000)
        );
        
        const detectionPromise = engine.detectDrift();
        const results = await Promise.race([detectionPromise, timeoutPromise]);
        
        if (options.ci) {
          // Enhanced CI-friendly output
          outputCIResults(results);
          
          if (options.exitCode && results.summary.actionRequired) {
            process.exit(1);
          }
        } else {
          // Enhanced console output
          formatEnhancedResults(results, options);
          
          if (options.exitCode && results.summary.actionRequired) {
            process.exit(1);
          }
        }
        
        // Show statistics if requested
        if (options.stats) {
          const stats = engine.getStats();
          displayStatistics(stats);
        }
        
      } catch (error) {
        console.error(chalk.red('Enhanced drift detection failed:'), error.message);
        if (options.verbose) {
          console.error(chalk.gray(error.stack));
        }
        process.exit(1);
      } finally {
        if (engine) {
          await engine.shutdown();
        }
      }
    });
}

/**
 * Output CI-friendly results
 */
function outputCIResults(results) {
  const hasDrift = results.summary.actionRequired;
  console.log(`DRIFT_DETECTED=${hasDrift}`);
  console.log(`TOTAL_FILES=${results.totalFiles}`);
  console.log(`UNCHANGED=${results.unchanged}`);
  console.log(`MODIFIED=${results.modified}`);
  console.log(`DELETED=${results.deleted}`);
  console.log(`ADDED=${results.added}`);
  console.log(`REGENERATED=${results.regenerated}`);
  console.log(`DRIFT_SCORE=${results.summary.driftScore}`);
  console.log(`RISK_LEVEL=${results.summary.riskLevel}`);
  console.log(`COMPLIANCE_STATUS=${results.summary.complianceStatus}`);
  console.log(`ACTION_REQUIRED=${results.summary.actionRequired}`);
  console.log(`VALIDATION_TIME=${results.validationTime}`);
  
  if (results.attestationResults) {
    console.log(`VALID_ATTESTATIONS=${results.attestationResults.validAttestations}`);
    console.log(`INVALID_ATTESTATIONS=${results.attestationResults.invalidAttestations}`);
    console.log(`MISSING_ATTESTATIONS=${results.attestationResults.missingAttestations}`);
  }
  
  // Output high-priority recommendations for CI
  const criticalRecs = results.recommendations.filter(r => r.priority === 'CRITICAL' || r.priority === 'HIGH');
  if (criticalRecs.length > 0) {
    console.log(`CRITICAL_RECOMMENDATIONS=${criticalRecs.length}`);
    criticalRecs.forEach((rec, index) => {
      console.log(`REC_${index + 1}_PRIORITY=${rec.priority}`);
      console.log(`REC_${index + 1}_ACTION=${rec.action.replace(/[^a-zA-Z0-9_]/g, '_')}`);
      if (rec.command) {
        console.log(`REC_${index + 1}_COMMAND=${rec.command}`);
      }
    });
  }
}

/**
 * Format enhanced drift detection results for display
 */
function formatEnhancedResults(results, options) {
  if (!results.success) {
    console.error(chalk.red('Enhanced drift detection failed'));
    return;
  }

  const { unchanged, modified, deleted, added, regenerated, totalFiles } = results;
  const hasDrift = results.summary.actionRequired;

  // Header with executive summary
  console.log(chalk.blue('🔍 Enhanced Drift Detection Results'));
  console.log(chalk.blue('━'.repeat(50)));
  
  // File summary
  console.log(chalk.bold('📊 File Analysis Summary:'));
  console.log(`  Total tracked files: ${totalFiles}`);
  console.log(`  ${chalk.green('✓')} Unchanged: ${unchanged} (${Math.round((unchanged/totalFiles)*100)}%)`);
  console.log(`  ${chalk.yellow('⚠')} Modified: ${modified} (${Math.round((modified/totalFiles)*100)}%)`);
  console.log(`  ${chalk.red('✗')} Deleted: ${deleted} (${Math.round((deleted/totalFiles)*100)}%)`);
  console.log(`  ${chalk.cyan('+')} Added: ${added}`);
  
  if (regenerated > 0) {
    console.log(`  ${chalk.blue('🔄')} Regenerated: ${regenerated}`);
  }
  
  // Risk assessment with visual indicators
  console.log(chalk.bold('\n📈 Risk Assessment:'));
  const riskColor = {
    'LOW': chalk.green,
    'MEDIUM': chalk.yellow,
    'HIGH': chalk.red,
    'CRITICAL': chalk.red.bold
  }[results.summary.riskLevel];
  
  const driftScore = results.summary.driftScore;
  const scoreBar = '█'.repeat(Math.floor(driftScore / 5)) + '░'.repeat(20 - Math.floor(driftScore / 5));
  console.log(`  Drift Score: ${driftScore}/100 [${scoreBar}]`);
  console.log(`  Risk Level: ${riskColor(results.summary.riskLevel)}`);
  
  const complianceColor = results.summary.complianceStatus === 'COMPLIANT' ? chalk.green : chalk.red;
  console.log(`  Compliance: ${complianceColor(results.summary.complianceStatus)}`);
  console.log(`  Validation Time: ${results.validationTime}ms`);
  
  // Attestation results
  if (results.attestationResults) {
    console.log(chalk.bold('\n🔏 Attestation Validation:'));
    const total = results.attestationResults.validAttestations + 
                 results.attestationResults.invalidAttestations + 
                 results.attestationResults.missingAttestations;
    console.log(`  Valid: ${chalk.green(results.attestationResults.validAttestations)}/${total}`);
    console.log(`  Invalid: ${chalk.red(results.attestationResults.invalidAttestations)}/${total}`);
    console.log(`  Missing: ${chalk.yellow(results.attestationResults.missingAttestations)}/${total}`);
    
    if (total > 0) {
      const validPercent = Math.round((results.attestationResults.validAttestations / total) * 100);
      const attestBar = '█'.repeat(Math.floor(validPercent / 5)) + '░'.repeat(20 - Math.floor(validPercent / 5));
      console.log(`  Integrity: ${validPercent}% [${attestBar}]`);
    }
  }
  
  if (!hasDrift) {
    console.log(chalk.green('\n🎉 No significant drift detected - system state is compliant'));
    if (results.summary.driftScore === 0) {
      console.log(chalk.green('   Perfect integrity maintained across all tracked artifacts'));
    }
    return;
  }

  console.log(chalk.yellow(`\n⚠️  Drift detected - ${results.summary.actionRequired ? 'Action required' : 'Monitoring recommended'}`));

  // Detailed changes with enhanced visualization
  if (options.verbose || options.detailed) {
    console.log(chalk.blue('\n📋 Detailed Change Analysis:'));
    console.log(chalk.blue('━'.repeat(40)));

    // Group changes by severity for better organization
    const changesBySeverity = {
      'CRITICAL': [],
      'HIGH': [],
      'MEDIUM': [],
      'LOW': []
    };
    
    results.changes.forEach(change => {
      changesBySeverity[change.severity || 'LOW'].push(change);
    });

    // Display in severity order
    ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].forEach(severity => {
      const changes = changesBySeverity[severity];
      if (changes.length === 0) return;
      
      const severityColor = {
        'CRITICAL': chalk.red.bold,
        'HIGH': chalk.red,
        'MEDIUM': chalk.yellow,
        'LOW': chalk.green
      }[severity];
      
      console.log(severityColor(`\n${severity} Severity (${changes.length} files):`));
      
      changes.forEach((change, index) => {
        displayDetailedChange(change, options);
      });
    });
  } else {
    // Summary view
    const criticalChanges = results.changes.filter(c => c.severity === 'CRITICAL');
    const highChanges = results.changes.filter(c => c.severity === 'HIGH');
    
    if (criticalChanges.length > 0) {
      console.log(chalk.red.bold(`\n🚨 ${criticalChanges.length} Critical Issues:`));
      criticalChanges.slice(0, 3).forEach(change => {
        console.log(chalk.red(`  • ${change.type.toUpperCase()}: ${change.path}`));
      });
      if (criticalChanges.length > 3) {
        console.log(chalk.gray(`  ... and ${criticalChanges.length - 3} more`));
      }
    }
    
    if (highChanges.length > 0) {
      console.log(chalk.red(`\n⚠️  ${highChanges.length} High Priority Issues:`));
      highChanges.slice(0, 3).forEach(change => {
        console.log(chalk.red(`  • ${change.type.toUpperCase()}: ${change.path}`));
      });
      if (highChanges.length > 3) {
        console.log(chalk.gray(`  ... and ${highChanges.length - 3} more`));
      }
    }
  }

  // Show recommendations with prioritization
  if (options.recommendations && results.recommendations.length > 0) {
    console.log(chalk.blue('\n💡 Actionable Recommendations:'));
    console.log(chalk.blue('━'.repeat(30)));
    
    // Group recommendations by priority
    const recsByPriority = {
      'CRITICAL': [],
      'HIGH': [],
      'MEDIUM': [],
      'LOW': []
    };
    
    results.recommendations.forEach(rec => {
      recsByPriority[rec.priority].push(rec);
    });
    
    let recIndex = 1;
    ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].forEach(priority => {
      const recs = recsByPriority[priority];
      if (recs.length === 0) return;
      
      const priorityColor = {
        'CRITICAL': chalk.red.bold,
        'HIGH': chalk.red,
        'MEDIUM': chalk.yellow,
        'LOW': chalk.green
      }[priority];
      
      recs.forEach(rec => {
        console.log(`${recIndex}. ${priorityColor(`[${rec.priority}]`)} ${rec.action}`);
        console.log(chalk.gray(`   ${rec.description}`));
        if (rec.command) {
          console.log(chalk.cyan(`   💻 ${rec.command}`));
        }
        if (rec.affectedFiles && rec.affectedFiles.length > 0) {
          const fileList = rec.affectedFiles.length > 3 
            ? `${rec.affectedFiles.slice(0, 3).join(', ')} (+${rec.affectedFiles.length - 3} more)`
            : rec.affectedFiles.join(', ');
          console.log(chalk.gray(`   📁 ${fileList}`));
        }
        console.log('');
        recIndex++;
      });
    });
  }

  // Show next steps
  if (results.summary.actionRequired) {
    console.log(chalk.blue('\n🎯 Next Steps:'));
    console.log(chalk.blue('━'.repeat(15)));
    
    if (results.deleted > 0) {
      console.log(chalk.red('1. 🚨 URGENT: Investigate deleted files immediately'));
      console.log(chalk.gray('   Run: kgen drift detect --verbose --detailed'));
    }
    
    if (results.modified > 0) {
      console.log(`${results.deleted > 0 ? '2' : '1'}. 📋 Review and validate modified files`);
      console.log(chalk.gray('   Run: kgen validate artifacts --recursive --strict'));
    }
    
    const nextStep = (results.deleted > 0 ? 2 : 1) + (results.modified > 0 ? 1 : 0) + 1;
    console.log(`${nextStep}. 🔄 Update baseline after validation`);
    console.log(chalk.gray('   Run: kgen drift baseline --update'));
  }

  if (options.json) {
    console.log(chalk.blue('\n📄 Complete JSON Results:'));
    console.log(JSON.stringify(results, null, 2));
  }
}

/**
 * Display detailed change information
 */
function displayDetailedChange(change, options) {
  const severityColor = {
    'LOW': chalk.green,
    'MEDIUM': chalk.yellow,
    'HIGH': chalk.red,
    'CRITICAL': chalk.red.bold
  }[change.severity];
  
  const icon = {
    'modified': chalk.yellow('⚠ '),
    'deleted': chalk.red('✗ '),
    'added': chalk.cyan('+ '),
    'regenerated': chalk.blue('🔄 '),
    'unchanged': chalk.green('✓ ')
  }[change.type];

  console.log(`\n${icon}${severityColor(change.type.toUpperCase())}: ${change.path}`);
  
  if (change.type === 'modified') {
    if (change.expected && change.current) {
      console.log(chalk.gray(`  Hash: ${change.expected.hash.substring(0, 12)}... → ${change.current.hash.substring(0, 12)}...`));
      
      const sizeChange = change.current.size - change.expected.size;
      const sizeChangeStr = sizeChange > 0 ? `+${sizeChange}` : sizeChange.toString();
      const sizeColor = Math.abs(sizeChange) > 1000 ? chalk.red : Math.abs(sizeChange) > 100 ? chalk.yellow : chalk.green;
      console.log(`  Size: ${change.expected.size} → ${sizeColor(`${change.current.size} (${sizeChangeStr})`)} bytes`);
      
      if (change.modifiedTimeChanged) {
        console.log(`  Modified: ${new Date(change.expected.modified).toLocaleString()} → ${new Date(change.current.modified).toLocaleString()}`);
      }
    }
    
    // Show validation results with details
    if (change.validation) {
      if (change.validation.shacl) {
        const shaclStatus = change.validation.shacl.conforms ? chalk.green('PASS') : chalk.red('FAIL');
        const violationText = change.validation.shacl.violations > 0 ? 
          ` (${change.validation.shacl.violations} violations)` : '';
        console.log(`  🔍 SHACL: ${shaclStatus}${violationText}`);
      }
      if (change.validation.semantic) {
        const semanticStatus = change.validation.semantic.passed ? chalk.green('PASS') : chalk.red('FAIL');
        const details = [];
        if (change.validation.semantic.violations > 0) details.push(`${change.validation.semantic.violations} violations`);
        if (change.validation.semantic.warnings > 0) details.push(`${change.validation.semantic.warnings} warnings`);
        const detailText = details.length > 0 ? ` (${details.join(', ')})` : '';
        console.log(`  🧠 Semantic: ${semanticStatus}${detailText}`);
      }
    }
    
    // Show regeneration info
    if (change.canRegenerate) {
      console.log(chalk.blue('  🔄 Regeneration available'));
      if (change.regenerationRequirements && options.verbose) {
        console.log(chalk.gray(`    Requirements: ${change.regenerationRequirements.join(', ')}`));
      }
    }
    
  } else if (change.type === 'deleted' && change.expected) {
    console.log(chalk.gray(`  Lost: ${change.expected.hash.substring(0, 12)}... (${change.expected.size} bytes)`));
    console.log(chalk.gray(`  Last modified: ${new Date(change.expected.modified).toLocaleString()}`));
  } else if (change.type === 'added' && change.current) {
    console.log(chalk.gray(`  New: ${change.current.hash.substring(0, 12)}... (${change.current.size} bytes)`));
    console.log(chalk.gray(`  Created: ${new Date(change.current.modified).toLocaleString()}`));
  } else if (change.type === 'regenerated') {
    console.log(chalk.green('  ✅ Successfully regenerated from attestation'));
    console.log(chalk.gray(`  Integrity restored and validated`));
  }
  
  // Show attestation info
  if (change.attestation && options.verbose) {
    console.log(chalk.blue(`  📋 Attestation: ${change.attestation.id.substring(0, 12)}...`));
    if (change.attestation.provenance.templatePath) {
      console.log(chalk.gray(`    Template: ${change.attestation.provenance.templatePath}`));
    }
    if (change.attestation.provenance.generationAgent) {
      console.log(chalk.gray(`    Agent: ${change.attestation.provenance.generationAgent}`));
    }
  }
}

/**
 * Display detection statistics
 */
function displayStatistics(stats) {
  console.log(chalk.blue('\n📊 Detection Engine Statistics:'));
  console.log(chalk.blue('━'.repeat(35)));
  console.log(`Detections run: ${stats.detectionsRun}`);
  console.log(`Average detection time: ${Math.round(stats.averageDetectionTime)}ms`);
  console.log(`Total drift instances found: ${stats.totalDriftFound}`);
  console.log(`Last detection time: ${stats.lastDetectionTime}ms`);
  
  if (stats.validationEngine) {
    console.log(chalk.blue('\n🔧 Validation Engine:'));
    console.log(`Validations performed: ${stats.validationEngine.validationsPerformed}`);
    console.log(`Success rate: ${Math.round(stats.validationEngine.successRate)}%`);
    console.log(`Cached validators: ${stats.validationEngine.cachedValidators}`);
    console.log(`Custom rules: ${stats.validationEngine.customRules}`);
  }
}

export { createEnhancedDriftDetectCommand as createDriftDetectCommand };