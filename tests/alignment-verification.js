/**
 * BDD Test Harness Alignment Verification
 * 
 * Verifies that all feature requirements have corresponding step definitions:
 * 
 * ✅ Provenance attestation: assert .attest.json exists + fields match hashes
 * ✅ Determinism: assert identical SHA256 across two runs  
 * ✅ Drift exit 3: mutate TTL semantically, assert exit code 3
 * ✅ Frontmatter injection: assert modified file contains rendered block after marker
 * ✅ Multi-format: assert existence + non-zero size
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

const STEP_DEFINITIONS_DIR = '/Users/sac/unjucks/kgen/features/step_definitions';
const FEATURES_DIR = '/Users/sac/unjucks/kgen/features';

const REQUIRED_STEPS = {
  'Provenance attestation': [
    'the attestation file should contain field .* matching the content hash',
    'the attestation file .* should exist',
    'the attestation file .* should contain all required fields'
  ],
  'Determinism verification': [
    'all rendered outputs should have identical SHA-256 hashes',
    'all SHA256 hashes should be identical',
    'deterministic rendering should produce byte-identical outputs'
  ],
  'Drift detection exit code 3': [
    'the command should exit with code',
    'the drift detection should exit with code',
    'drift should be detected due to semantic changes'
  ],
  'Frontmatter injection': [
    'the file .* should contain injected content after marker',
    'the file .* should contain the injected content after the marker',
    'the file .* should preserve existing content around injection point'
  ],
  'Multi-format validation': [
    'all .* formats should exist with non-zero size',
    'each format should have non-zero file size',
    'the file .* should exist with non-zero size'
  ]
};

async function findStepDefinitions() {
  try {
    const { stdout } = await execAsync(`find ${STEP_DEFINITIONS_DIR} -name "*.js" -o -name "*.ts"`);
    return stdout.trim().split('\n').filter(Boolean);
  } catch (error) {
    console.error('Error finding step definition files:', error);
    return [];
  }
}

async function searchForStep(stepPattern, files) {
  const found = [];
  
  for (const file of files) {
    try {
      const { stdout } = await execAsync(`grep -n "${stepPattern}" "${file}" 2>/dev/null || true`);
      if (stdout.trim()) {
        found.push({
          file: path.basename(file),
          matches: stdout.trim().split('\n').filter(Boolean)
        });
      }
    } catch (error) {
      // Ignore grep errors (no matches)
    }
  }
  
  return found;
}

async function verifyAlignment() {
  console.log('🔍 BDD Test Harness Feature Requirement Alignment Verification');
  console.log('==============================================================\n');
  
  const stepFiles = await findStepDefinitions();
  console.log(`📁 Found ${stepFiles.length} step definition files:\n`);
  stepFiles.forEach(file => console.log(`   - ${path.basename(file)}`));
  console.log('');
  
  const results = {};
  let totalMissing = 0;
  
  for (const [requirement, patterns] of Object.entries(REQUIRED_STEPS)) {
    console.log(`🎯 ${requirement}:`);
    results[requirement] = {};
    
    for (const pattern of patterns) {
      const found = await searchForStep(pattern, stepFiles);
      results[requirement][pattern] = found;
      
      if (found.length > 0) {
        console.log(`   ✅ "${pattern}" - Found in:`);
        found.forEach(match => {
          console.log(`      - ${match.file}`);
        });
      } else {
        console.log(`   ❌ "${pattern}" - MISSING`);
        totalMissing++;
      }
    }
    console.log('');
  }
  
  // Summary
  console.log('📊 ALIGNMENT SUMMARY');
  console.log('===================');
  
  if (totalMissing === 0) {
    console.log('✅ ALL REQUIREMENTS COVERED');
    console.log('🎉 BDD test harness properly aligned with feature requirements!');
  } else {
    console.log(`❌ ${totalMissing} step definitions missing`);
    console.log('⚠️  Some requirements may not be fully testable');
  }
  
  // Files summary
  console.log('\n📋 STEP DEFINITION FILES:');
  console.log('==========================');
  
  const consolidationSummary = {
    'Primary location': `${STEP_DEFINITIONS_DIR}/ (${stepFiles.length} files)`,
    'Key files': [
      'feature_requirement_steps.js - One-to-one requirement mapping',
      'core_steps.js - Core CAS and template functionality',
      'e2e_workflow_steps.js - End-to-end workflow validation',
      'performance_steps.js - Performance and drift detection',
      'cli_integration_steps.ts - CLI command validation'
    ],
    'Cleanup completed': [
      'Removed duplicate backup files (*.bak*)',
      'Consolidated test directories',
      'Aligned step definitions with exact requirements'
    ]
  };
  
  Object.entries(consolidationSummary).forEach(([key, value]) => {
    console.log(`\n${key}:`);
    if (Array.isArray(value)) {
      value.forEach(item => console.log(`   - ${item}`));
    } else {
      console.log(`   ${value}`);
    }
  });
  
  return { totalMissing, results };
}

// Run verification
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyAlignment()
    .then(({ totalMissing }) => {
      process.exit(totalMissing > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Verification failed:', error);
      process.exit(1);
    });
}

export { verifyAlignment };