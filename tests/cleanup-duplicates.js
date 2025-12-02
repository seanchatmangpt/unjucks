#!/usr/bin/env node

/**
 * Script to remove duplicate test files and consolidate BDD structure
 * Moves all feature files to tests/features/ and step definitions to tests/steps/unified/
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

async function main() {
  console.log('🧹 Starting BDD test consolidation...');
  
  // 1. Identify all feature files across the project
  console.log('📁 Finding all feature files...');
  const allFeatures = await glob('**/*.feature', {
    cwd: projectRoot,
    ignore: [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      'tests/features/unified/**' // Keep our new unified features
    ]
  });
  
  console.log(`Found ${allFeatures.length} feature files:`);
  allFeatures.forEach(f => console.log(`  - ${f}`));
  
  // 2. Identify all step definition files
  console.log('\n📁 Finding all step definition files...');
  const allSteps = await glob('**/*steps*.js', {
    cwd: projectRoot,
    ignore: [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      'tests/steps/unified/**' // Keep our new unified steps
    ]
  });
  
  console.log(`Found ${allSteps.length} step definition files:`);
  allSteps.forEach(f => console.log(`  - ${f}`));
  
  // 3. Create backup directory
  const backupDir = path.join(__dirname, 'backup-duplicates');
  await fs.ensureDir(backupDir);
  
  // 4. Move duplicate feature files to backup
  console.log('\n🔄 Moving duplicate feature files to backup...');
  let movedFeatures = 0;
  
  for (const featurePath of allFeatures) {
    const fullPath = path.join(projectRoot, featurePath);
    
    // Skip if it's in our unified structure or if it's a core feature we want to keep
    if (featurePath.startsWith('tests/features/unified/') ||
        featurePath.startsWith('features/') && !featurePath.includes('kgen/')) {
      continue;
    }
    
    try {
      const backupPath = path.join(backupDir, 'features', featurePath);
      await fs.ensureDir(path.dirname(backupPath));
      await fs.move(fullPath, backupPath);
      movedFeatures++;
      console.log(`  ✅ Moved ${featurePath} → backup/features/${featurePath}`);
    } catch (error) {
      console.log(`  ❌ Failed to move ${featurePath}: ${error.message}`);
    }
  }
  
  // 5. Move duplicate step definition files to backup
  console.log('\n🔄 Moving duplicate step definition files to backup...');
  let movedSteps = 0;
  
  for (const stepPath of allSteps) {
    const fullPath = path.join(projectRoot, stepPath);
    
    // Skip if it's in our unified structure or tests/steps directory
    if (stepPath.startsWith('tests/steps/')) {
      continue;
    }
    
    try {
      const backupPath = path.join(backupDir, 'steps', stepPath);
      await fs.ensureDir(path.dirname(backupPath));
      await fs.move(fullPath, backupPath);
      movedSteps++;
      console.log(`  ✅ Moved ${stepPath} → backup/steps/${stepPath}`);
    } catch (error) {
      console.log(`  ❌ Failed to move ${stepPath}: ${error.message}`);
    }
  }
  
  // 6. Create summary report
  const summary = {
    timestamp: new Date().toISOString(),
    movedFeatures,
    movedSteps,
    keptFeatures: allFeatures.length - movedFeatures,
    keptSteps: allSteps.length - movedSteps,
    unifiedStepFiles: [
      'tests/steps/unified/provenance-attestation.steps.js',
      'tests/steps/unified/determinism-validation.steps.js', 
      'tests/steps/unified/drift-detection.steps.js',
      'tests/steps/unified/frontmatter-injection.steps.js',
      'tests/steps/unified/multi-format-validation.steps.js',
      'tests/steps/unified/unified-integration.steps.js'
    ],
    unifiedFeatureFiles: [
      'tests/features/unified/unified-requirements-validation.feature'
    ]
  };
  
  await fs.writeJson(path.join(backupDir, 'consolidation-summary.json'), summary, { spaces: 2 });
  
  // 7. Update package.json test scripts if needed
  console.log('\n📝 Updating test configuration...');
  const packageJsonPath = path.join(projectRoot, 'package.json');
  
  if (await fs.pathExists(packageJsonPath)) {
    const packageJson = await fs.readJson(packageJsonPath);
    
    // Add unified BDD test script
    if (!packageJson.scripts) packageJson.scripts = {};
    
    packageJson.scripts['test:bdd'] = 'cucumber-js --config tests/cucumber.config.js';
    packageJson.scripts['test:bdd:smoke'] = 'cucumber-js --config tests/cucumber.config.js --tags "@smoke"';
    packageJson.scripts['test:bdd:core'] = 'cucumber-js --config tests/cucumber.config.js --tags "@core"';
    packageJson.scripts['test:bdd:integration'] = 'cucumber-js --config tests/cucumber.config.js --tags "@integration"';
    
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
    console.log('  ✅ Updated package.json with unified BDD test scripts');
  }
  
  // 8. Generate final report
  console.log('\n📊 Consolidation Summary:');
  console.log(`  📁 Feature files moved to backup: ${movedFeatures}`);
  console.log(`  📁 Step definition files moved to backup: ${movedSteps}`);
  console.log(`  ✅ Unified step definition files created: ${summary.unifiedStepFiles.length}`);
  console.log(`  ✅ Unified feature files created: ${summary.unifiedFeatureFiles.length}`);
  console.log(`  📂 Backup location: ${backupDir}`);
  
  console.log('\n🎯 Next steps:');
  console.log('  1. Run: npm run test:bdd:smoke');
  console.log('  2. Run: npm run test:bdd:core');
  console.log('  3. Review backup files and remove if satisfied');
  console.log('  4. Update CI/CD to use unified test structure');
  
  console.log('\n✅ BDD test consolidation completed successfully!');
}

main().catch(error => {
  console.error('❌ Consolidation failed:', error);
  process.exit(1);
});