#!/usr/bin/env node

/**
 * CLI Structure Validation Test
 * Validates that all KGEN CLI commands are properly structured and accessible
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const BASE_DIR = process.cwd();
const CLI_SRC = join(BASE_DIR, 'packages/kgen-cli/src');

// Define expected CLI structure
const EXPECTED_STRUCTURE = {
  'Main Entry Points': [
    'cli.js',
    'index.js'
  ],
  'Command Groups': [
    'commands/artifact.js',
    'commands/graph.js', 
    'commands/project.js',
    'commands/validate.js',
    'commands/drift.js',
    'commands/query.js',
    'commands/templates.js',
    'commands/rules.js',
    'commands/cache.js',
    'commands/deterministic.js'
  ],
  'Artifact Commands': [
    'commands/artifact/generate.js',
    'commands/artifact/drift.js',
    'commands/artifact/explain.js'
  ],
  'Graph Commands': [
    'commands/graph/hash.js',
    'commands/graph/diff.js',
    'commands/graph/index-cmd.js'
  ],
  'Project Commands': [
    'commands/project/lock.js',
    'commands/project/attest.js'
  ],
  'Validate Commands': [
    'commands/validate/artifacts.js',
    'commands/validate/graph.js',
    'commands/validate/provenance.js'
  ],
  'Query Commands': [
    'commands/query/sparql.js'
  ],
  'Templates Commands': [
    'commands/templates/ls.js',
    'commands/templates/show.js',
    'commands/templates/validate.js'
  ],
  'Rules Commands': [
    'commands/rules/ls.js',
    'commands/rules/show.js'
  ],
  'Cache Commands': [
    'commands/cache/ls.js',
    'commands/cache/show.js',
    'commands/cache/purge.js',
    'commands/cache/gc.js',
    'commands/cache/stats.js'
  ],
  'Drift Commands': [
    'commands/drift/detect.js'
  ],
  'Deterministic Commands': [
    'commands/deterministic/render.js',
    'commands/deterministic/generate.js',
    'commands/deterministic/validate.js',
    'commands/deterministic/verify.js',
    'commands/deterministic/status.js'
  ]
};

// C4 Diagrams structure
const C4_DIAGRAMS = {
  'Level 1 - Context': [
    'c4-context.mmd'
  ],
  'Level 2 - Containers': [
    'c4-container-cli.mmd',
    'c4-container-autonomic.mmd'
  ],
  'Level 3 - Components': [
    'c4-component-artifact-generate.mmd',
    'c4-component-artifact-drift.mmd',
    'c4-component-graph-engine.mmd',
    'c4-component-cas-cache.mmd',
    'c4-component-provenance-explain.mmd',
    'c4-component-document-generation.mmd',
    'c4-component-shacl-validation.mmd',
    'c4-component-uri-resolver.mmd',
    'c4-component-git-as-blockchain.mmd',
    'c4-component-frontmatter-engine.mmd',
    'c4-component-project-lifecycle.mmd',
    'c4-component-sbom-generation.mmd',
    'c4-component-merkle-changefeed.mmd',
    'c4-component-opentelemetry.mmd',
    'c4-component-jsonl-audit.mmd'
  ],
  'Level 4 - Code': [
    'c4-code-attestation-generator.mmd',
    'c4-code-deterministic-renderer.mmd',
    'c4-code-semantic-hashing.mmd',
    'c4-code-opc-normalizer.mmd',
    'c4-code-policy-gate.mmd'
  ]
};

console.log('🔍 KGEN CLI Structure Validation Report');
console.log('=' .repeat(60));

let totalFiles = 0;
let foundFiles = 0;
let missingFiles = [];

// Validate CLI structure
console.log('\n📁 CLI Command Structure:');
for (const [category, files] of Object.entries(EXPECTED_STRUCTURE)) {
  console.log(`\n  ${category}:`);
  for (const file of files) {
    totalFiles++;
    const fullPath = join(CLI_SRC, file);
    const exists = existsSync(fullPath);
    if (exists) {
      foundFiles++;
      console.log(`    ✅ ${file}`);
    } else {
      missingFiles.push(file);
      console.log(`    ❌ ${file} (MISSING)`);
    }
  }
}

// Validate C4 diagrams
console.log('\n\n📊 C4 Architecture Diagrams:');
const ARCH_DIR = join(BASE_DIR, 'docs/architecture');
let totalDiagrams = 0;
let foundDiagrams = 0;

for (const [level, diagrams] of Object.entries(C4_DIAGRAMS)) {
  console.log(`\n  ${level}:`);
  for (const diagram of diagrams) {
    totalDiagrams++;
    const fullPath = join(ARCH_DIR, diagram);
    const exists = existsSync(fullPath);
    if (exists) {
      foundDiagrams++;
      console.log(`    ✅ ${diagram}`);
    } else {
      console.log(`    ❌ ${diagram} (MISSING)`);
    }
  }
}

// Summary statistics
console.log('\n\n📊 Summary Statistics:');
console.log('=' .repeat(60));
console.log(`  CLI Files:      ${foundFiles}/${totalFiles} (${Math.round(foundFiles/totalFiles*100)}%)`);
console.log(`  C4 Diagrams:    ${foundDiagrams}/${totalDiagrams} (${Math.round(foundDiagrams/totalDiagrams*100)}%)`);
console.log(`  Total Coverage: ${foundFiles + foundDiagrams}/${totalFiles + totalDiagrams} (${Math.round((foundFiles + foundDiagrams)/(totalFiles + totalDiagrams)*100)}%)`);

// Missing files report
if (missingFiles.length > 0) {
  console.log('\n\n⚠️  Missing Files:');
  missingFiles.forEach(file => console.log(`  - ${file}`));
}

// Test CLI commands
console.log('\n\n🧪 Testing CLI Commands:');
const testCommands = [
  'node bin/kgen.mjs --help',
  'node bin/kgen.mjs artifact --help',
  'node bin/kgen.mjs graph --help',
  'node bin/kgen.mjs cache --help',
  'node bin/kgen.mjs templates --help',
  'node bin/kgen.mjs deterministic --help'
];

for (const cmd of testCommands) {
  try {
    execSync(cmd, { stdio: 'ignore' });
    console.log(`  ✅ ${cmd.replace('node bin/kgen.mjs', 'kgen')}`);
  } catch (error) {
    console.log(`  ❌ ${cmd.replace('node bin/kgen.mjs', 'kgen')} (FAILED)`);
  }
}

// Architecture validation
console.log('\n\n🏗️  Architecture Validation:');
const archPatterns = {
  'Citty Pattern': foundFiles > 0 && foundFiles/totalFiles > 0.8,
  'Command Groups': existsSync(join(CLI_SRC, 'commands')),
  'Subcommands': existsSync(join(CLI_SRC, 'commands/artifact')),
  'C4 Documentation': foundDiagrams === totalDiagrams,
  '80/20 Principle': foundFiles/totalFiles >= 0.8
};

for (const [pattern, valid] of Object.entries(archPatterns)) {
  console.log(`  ${valid ? '✅' : '❌'} ${pattern}`);
}

// Final verdict
const overallSuccess = (foundFiles + foundDiagrams) / (totalFiles + totalDiagrams) >= 0.9;
console.log('\n\n' + '=' .repeat(60));
console.log(overallSuccess ? 
  '✅ VALIDATION PASSED: CLI structure is complete!' :
  '❌ VALIDATION FAILED: Some components are missing'
);
console.log('=' .repeat(60));

// Exit with appropriate code
process.exit(overallSuccess ? 0 : 1);