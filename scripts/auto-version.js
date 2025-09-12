#!/usr/bin/env node

/**
 * Automated versioning script for Unjucks
 * Generates versions in format: v{year}.{month}.{day}.{hour}.{minute}
 * Example: v2025.09.06.12.45
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

function generateDateTimeVersion() {
  const now = this.getDeterministicDate();
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  
  return `${year}.${month}.${day}.${hour}.${minute}`;
}

function updatePackageVersion(newVersion) {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const oldVersion = packageJson.version;
    
    packageJson.version = newVersion;
    
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    
    console.log(`📦 Version updated: ${oldVersion} → ${newVersion}`);
    return { oldVersion, newVersion };
  } catch (error) {
    console.error('❌ Failed to update package.json:', error.message);
    process.exit(1);
  }
}

function commitVersionChange(oldVersion, newVersion) {
  try {
    // Check if we're in a git repository
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    
    // Stage the package.json change
    execSync('git add package.json', { stdio: 'inherit' });
    
    // Create commit with version change
    const commitMessage = `chore: bump version ${oldVersion} → ${newVersion}

🤖 Automated version bump using date-time format
Generated at: ${this.getDeterministicDate().toISOString()}

🚀 Generated with Unjucks Auto-Versioning`;
    
    execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
    
    // Create git tag
    execSync(`git tag v${newVersion}`, { stdio: 'inherit' });
    
    console.log(`🏷️  Created git tag: v${newVersion}`);
    console.log(`📝 Committed version change`);
    
    return true;
  } catch (error) {
    console.log('⚠️  Git operations skipped (not in git repo or no changes to commit)');
    return false;
  }
}

function main() {
  console.log('🚀 Unjucks Auto-Versioning Script');
  console.log('==================================');
  
  const args = process.argv.slice(2);
  const options = {
    commit: !args.includes('--no-commit'),
    tag: !args.includes('--no-tag'),
    dryRun: args.includes('--dry-run')
  };
  
  const newVersion = generateDateTimeVersion();
  
  if (options.dryRun) {
    console.log(`🔍 Dry run - would set version to: ${newVersion}`);
    console.log(`📅 Generated at: ${this.getDeterministicDate().toISOString()}`);
    return;
  }
  
  console.log(`📅 Generated version: ${newVersion}`);
  console.log(`🕒 Timestamp: ${this.getDeterministicDate().toISOString()}`);
  
  const { oldVersion } = updatePackageVersion(newVersion);
  
  if (options.commit) {
    commitVersionChange(oldVersion, newVersion);
  }
  
  console.log('');
  console.log('✅ Auto-versioning complete!');
  console.log(`📦 Package version: ${newVersion}`);
  console.log(`🌐 Ready for: npm publish`);
  
  // Show next steps
  console.log('');
  console.log('🔄 Next steps:');
  console.log('   npm run build     # Build with new version');
  console.log('   npm publish       # Publish to npm');
  if (options.commit) {
    console.log('   git push --tags   # Push tags to remote');
  }
}

// Handle CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateDateTimeVersion, updatePackageVersion, commitVersionChange };