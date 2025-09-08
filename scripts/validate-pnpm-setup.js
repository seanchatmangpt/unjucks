#!/usr/bin/env node

/**
 * PNPM Enterprise Setup Validation Script
 * ========================================
 * Validates enterprise pnpm configuration and workspace setup
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';

console.log(chalk.blue.bold('🔍 PNPM Enterprise Setup Validation'));
console.log(chalk.blue('=====================================\n'));

const checks = [];

// Check pnpm installation and version
try {
  const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8' }).trim();
  checks.push({
    name: 'PNPM Installation',
    status: 'PASS',
    message: `pnpm ${pnpmVersion} installed`
  });
} catch (error) {
  checks.push({
    name: 'PNPM Installation',
    status: 'FAIL',
    message: 'pnpm not installed or not in PATH'
  });
}

// Check .npmrc configuration
if (existsSync('.npmrc')) {
  const npmrcContent = readFileSync('.npmrc', 'utf8');
  const requiredSettings = [
    'auto-install-peers=true',
    'hoist=true',
    'store-dir=/Users/sac/.pnpm-store',
    'cache-dir=/Users/sac/.pnpm-cache',
    'network-concurrency=16'
  ];
  
  const missingSettings = requiredSettings.filter(setting => 
    !npmrcContent.includes(setting)
  );
  
  if (missingSettings.length === 0) {
    checks.push({
      name: '.npmrc Configuration',
      status: 'PASS',
      message: 'All enterprise settings configured'
    });
  } else {
    checks.push({
      name: '.npmrc Configuration',
      status: 'WARN',
      message: `Missing settings: ${missingSettings.join(', ')}`
    });
  }
} else {
  checks.push({
    name: '.npmrc Configuration',
    status: 'FAIL',
    message: '.npmrc file not found'
  });
}

// Check pnpm-workspace.yaml
if (existsSync('pnpm-workspace.yaml')) {
  const workspaceContent = readFileSync('pnpm-workspace.yaml', 'utf8');
  
  if (workspaceContent.includes('packages:') && workspaceContent.includes("- '.'")) {
    checks.push({
      name: 'Workspace Configuration',
      status: 'PASS',
      message: 'pnpm-workspace.yaml properly configured'
    });
  } else {
    checks.push({
      name: 'Workspace Configuration',
      status: 'WARN',
      message: 'pnpm-workspace.yaml missing required packages'
    });
  }
} else {
  checks.push({
    name: 'Workspace Configuration',
    status: 'FAIL',
    message: 'pnpm-workspace.yaml not found'
  });
}

// Check CI configuration
if (existsSync('.npmrc.ci')) {
  checks.push({
    name: 'CI Configuration',
    status: 'PASS',
    message: 'CI-specific .npmrc.ci created'
  });
} else {
  checks.push({
    name: 'CI Configuration',
    status: 'WARN',
    message: 'CI configuration file not found'
  });
}

// Check package.json packageManager field
try {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  if (packageJson.packageManager && packageJson.packageManager.startsWith('pnpm@')) {
    checks.push({
      name: 'Package Manager Field',
      status: 'PASS',
      message: `packageManager: ${packageJson.packageManager}`
    });
  } else {
    checks.push({
      name: 'Package Manager Field',
      status: 'WARN',
      message: 'packageManager field not set in package.json'
    });
  }
} catch (error) {
  checks.push({
    name: 'Package Manager Field',
    status: 'FAIL',
    message: 'Could not read package.json'
  });
}

// Check pnpm scripts
try {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const pnpmScripts = Object.keys(packageJson.scripts || {}).filter(script => 
    script.startsWith('pnpm:') || script.startsWith('workspace:')
  );
  
  if (pnpmScripts.length >= 5) {
    checks.push({
      name: 'PNPM Scripts',
      status: 'PASS',
      message: `${pnpmScripts.length} pnpm scripts configured`
    });
  } else {
    checks.push({
      name: 'PNPM Scripts',
      status: 'WARN',
      message: 'Minimal pnpm scripts configured'
    });
  }
} catch (error) {
  checks.push({
    name: 'PNPM Scripts',
    status: 'FAIL',
    message: 'Could not verify pnpm scripts'
  });
}

// Check workspace functionality
try {
  execSync('pnpm list --depth=0', { stdio: 'pipe' });
  checks.push({
    name: 'Workspace Functionality',
    status: 'PASS',
    message: 'pnpm workspace commands working'
  });
} catch (error) {
  checks.push({
    name: 'Workspace Functionality',
    status: 'FAIL',
    message: 'Workspace commands failing'
  });
}

// Check package registry access
try {
  execSync('npm view @seanchatmangpt/unjucks@2025.9.71605 version', { stdio: 'pipe' });
  checks.push({
    name: 'Registry Package Access',
    status: 'PASS',
    message: '@seanchatmangpt/unjucks@2025.9.71605 accessible'
  });
} catch (error) {
  checks.push({
    name: 'Registry Package Access',
    status: 'FAIL',
    message: 'Cannot access target package from registry'
  });
}

// Display results
console.log(chalk.white.bold('Validation Results:'));
console.log(chalk.white('===================\n'));

let passCount = 0;
let warnCount = 0;
let failCount = 0;

checks.forEach(check => {
  const icon = check.status === 'PASS' ? '✅' : check.status === 'WARN' ? '⚠️' : '❌';
  const color = check.status === 'PASS' ? 'green' : check.status === 'WARN' ? 'yellow' : 'red';
  
  console.log(`${icon} ${chalk[color](check.name)}: ${check.message}`);
  
  if (check.status === 'PASS') passCount++;
  else if (check.status === 'WARN') warnCount++;
  else failCount++;
});

console.log(`\n${chalk.blue.bold('Summary:')}`);
console.log(`${chalk.green('✅ Pass:')} ${passCount}`);
console.log(`${chalk.yellow('⚠️  Warnings:')} ${warnCount}`);
console.log(`${chalk.red('❌ Failures:')} ${failCount}`);

if (failCount === 0) {
  console.log(`\n${chalk.green.bold('🎉 PNPM enterprise setup is ready for production!')}`);
  console.log(chalk.green('All critical checks passed. Warnings can be addressed as needed.'));
} else {
  console.log(`\n${chalk.red.bold('🚨 Setup requires attention before production use.')}`);
  console.log(chalk.red('Please address failed checks above.'));
}

console.log(`\n${chalk.blue.bold('Next Steps:')}`);
console.log('• Run: pnpm install --frozen-lockfile');
console.log('• Run: pnpm audit');
console.log('• Commit .npmrc and pnpm-workspace.yaml');
console.log('• Update CI/CD to use pnpm with --frozen-lockfile');
console.log('• Test workspace commands: pnpm run build');