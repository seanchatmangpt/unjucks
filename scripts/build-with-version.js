#!/usr/bin/env node

/**
 * Build script with automated versioning for Unjucks
 * Combines auto-versioning + build process
 */

import { execSync } from 'child_process';
import { generateDateTimeVersion, updatePackageVersion, commitVersionChange } from './auto-version.js';

function runCommand(command, description) {
  try {
    console.log(`🔨 ${description}...`);
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} complete`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    return false;
  }
}

function main() {
  console.log('🚀 Unjucks Build with Auto-Versioning');
  console.log('=====================================');
  
  const args = process.argv.slice(2);
  const options = {
    skipVersion: args.includes('--skip-version'),
    skipBuild: args.includes('--skip-build'),
    skipCommit: args.includes('--skip-commit'),
    skipTests: args.includes('--skip-tests'),
    publish: args.includes('--publish'),
    dryRun: args.includes('--dry-run')
  };
  
  if (options.dryRun) {
    console.log('🔍 Dry run mode - showing what would be done:');
    console.log(`   1. Update version to: ${generateDateTimeVersion()}`);
    console.log('   2. Run build process');
    console.log('   3. Commit version change');
    if (options.publish) {
      console.log('   4. Publish to npm');
    }
    return;
  }
  
  let success = true;
  let versionInfo = null;
  
  // Step 1: Auto-version (unless skipped)
  if (!options.skipVersion) {
    console.log('\n📦 Step 1: Auto-versioning');
    try {
      const newVersion = generateDateTimeVersion();
      versionInfo = updatePackageVersion(newVersion);
      console.log(`✅ Version updated to: ${newVersion}`);
    } catch (error) {
      console.error('❌ Auto-versioning failed:', error.message);
      success = false;
    }
  }
  
  // Step 2: Run tests (unless skipped)
  if (!options.skipTests && success) {
    console.log('\n🧪 Step 2: Running tests');
    success = runCommand('npm run lint', 'Linting');
    // TypeScript checking is disabled for JavaScript build
    if (success) {
      console.log('✅ Type checking skipped (JavaScript mode)');
    }
  }
  
  // Step 3: Build (unless skipped)
  if (!options.skipBuild && success) {
    console.log('\n🔨 Step 3: Building');
    success = runCommand('npm run build', 'Building project');
  }
  
  // Step 4: Commit changes (unless skipped)
  if (!options.skipCommit && success && versionInfo) {
    console.log('\n📝 Step 4: Committing changes');
    try {
      commitVersionChange(versionInfo.oldVersion, versionInfo.newVersion);
    } catch (error) {
      console.log('⚠️  Git commit skipped:', error.message);
    }
  }
  
  // Step 5: Publish (if requested)
  if (options.publish && success) {
    console.log('\n🚀 Step 5: Publishing to npm');
    success = runCommand('npm publish --access=public', 'Publishing to npm');
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  if (success) {
    console.log('🎉 Build with auto-versioning SUCCESS!');
    if (versionInfo) {
      console.log(`📦 New version: ${versionInfo.newVersion}`);
      console.log(`🏷️  Git tag: v${versionInfo.newVersion}`);
    }
    console.log('');
    console.log('🔄 Next steps:');
    if (!options.publish) {
      console.log('   npm run build:publish  # Publish to npm');
    }
    if (!options.skipCommit) {
      console.log('   git push --tags        # Push tags to remote');
    }
  } else {
    console.log('❌ Build process failed');
    console.log('Check the errors above and try again');
    process.exit(1);
  }
}

// Handle CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}