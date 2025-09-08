#!/usr/bin/env node

/**
 * Convert Unjucks date-time versioning to NPM-compatible semver
 * Transforms YYYY.MM.DD.HH.MM to YYYY.M.DDHHM format
 * Example: 2025.09.07.16.05 → 2025.9.71605
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

function convertToSemver(datetimeVersion) {
  const parts = datetimeVersion.split('.');
  
  if (parts.length !== 5) {
    throw new Error(`Invalid datetime version format: ${datetimeVersion}. Expected YYYY.MM.DD.HH.MM`);
  }
  
  const [year, month, day, hour, minute] = parts;
  
  // Convert to semver: YEAR.MONTH.DAYHOURMINUTE
  const semverMajor = year;
  const semverMinor = parseInt(month, 10).toString(); // Remove leading zero
  const semverPatch = day + hour + minute; // Concatenate day, hour, minute
  
  return `${semverMajor}.${semverMinor}.${semverPatch}`;
}

function convertPackageJsonToSemver() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  try {
    console.log('🔄 Converting datetime version to NPM-compatible semver...');
    
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version;
    
    console.log(`📅 Current datetime version: ${currentVersion}`);
    
    const semverVersion = convertToSemver(currentVersion);
    
    console.log(`📦 NPM-compatible semver: ${semverVersion}`);
    
    // Update package.json with semver version
    packageJson.version = semverVersion;
    
    // Write updated package.json
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    
    console.log('✅ Package.json updated with semver-compatible version');
    console.log('');
    console.log('🔄 Next steps:');
    console.log('   npm publish       # Publish to npm');
    console.log('   git add package.json && git commit -m "chore: convert to semver for npm"');
    
    return { originalVersion: currentVersion, semverVersion };
  } catch (error) {
    console.error('❌ Failed to convert version:', error.message);
    process.exit(1);
  }
}

function revertToDatetime(originalVersion) {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  try {
    console.log('🔄 Reverting to datetime version...');
    
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    packageJson.version = originalVersion;
    
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    
    console.log(`✅ Reverted to datetime version: ${originalVersion}`);
  } catch (error) {
    console.error('❌ Failed to revert version:', error.message);
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.includes('--revert') && args.includes('--original')) {
    const originalIndex = args.indexOf('--original');
    const originalVersion = args[originalIndex + 1];
    revertToDatetime(originalVersion);
  } else if (args.includes('--dry-run')) {
    // Dry run - just show what would be done
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version;
    const semverVersion = convertToSemver(currentVersion);
    
    console.log('🔍 Dry run - version conversion preview:');
    console.log(`   Current: ${currentVersion}`);
    console.log(`   Semver:  ${semverVersion}`);
  } else {
    convertPackageJsonToSemver();
  }
}

export { convertToSemver, convertPackageJsonToSemver, revertToDatetime };