#!/usr/bin/env node

/**
 * Unjucks CLI Entry Point - Performance Optimized
 * Ultra-fast startup with comprehensive optimization
 */

const { performance } = require('perf_hooks');
const startTime = performance.now();

// Minimal Node.js version check (optimized)
const nodeVersion = process.versions.node;
if (parseInt(nodeVersion.split('.')[0]) < 18) {
  console.error(`❌ Unjucks requires Node.js v18.0.0 or higher (current: v${nodeVersion})`);
  process.exit(1);
}

// Fast error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Unexpected error:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled promise rejection:', reason);
  process.exit(1);
});

// Optimized file existence check
const path = require('path');
const fs = require('fs');
const cliPath = path.join(__dirname, '../src/cli/index.js');

// Fast synchronous check
let cliExists = false;
try {
  fs.accessSync(cliPath, fs.constants.F_OK);
  cliExists = true;
} catch (error) {
  // File doesn't exist
}

if (!cliExists) {
  console.error('❌ Unjucks CLI source not found. Please reinstall.');
  process.exit(1);
}

// Environment optimization
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Ultra-fast CLI loading with minimal overhead
async function loadAndRunCLI() {
  try {
    // Performance tracking
    const importStart = performance.now();
    
    // Direct import with optimized path resolution
    const fullPath = path.resolve(__dirname, '../src/cli/index.js');
    const { pathToFileURL } = require('url');
    
    // Use import() with file URL for maximum compatibility
    const cliModule = await import(pathToFileURL(fullPath));
    const { runMain } = cliModule;
  
    const importTime = performance.now() - importStart;
    
    // Only show performance info in debug mode
    if (process.env.DEBUG || process.env.UNJUCKS_PERF) {
      console.log(`⚡ CLI loaded in ${importTime.toFixed(2)}ms`);
      console.log(`⚡ Total startup: ${(performance.now() - startTime).toFixed(2)}ms`);
    }
  
    // Run with optimized error handling
    await runMain().catch((error) => {
      // Categorize errors for better user experience
      if (error.code === 'ENOENT') {
        console.error('❌ Command not found or file missing');
      } else if (error.message?.includes('permission')) {
        console.error('❌ Permission denied');  
      } else if (error.message?.includes('MODULE_NOT_FOUND')) {
        console.error('❌ Missing dependency. Try: npm install');
      } else {
        console.error('❌ Error:', error.message);
      }
      
      // Smart help suggestions
      if (process.argv.length === 2) {
        console.error('\n💡 Try: unjucks --help or unjucks list');
      }
      
      process.exit(1);
    });
  } catch (error) {
    // Import error handling
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      console.error('❌ Missing dependencies. Run: npm install');
    } else {
      console.error('❌ Failed to load CLI:', error.message);
      console.error('💡 Try reinstalling: npm uninstall -g unjucks && npm install -g unjucks@latest');
    }
    process.exit(1);
  }
}

// Optimized argument pre-processing
const args = process.argv.slice(2);

// Fast version check without loading full CLI
if (args.length === 1 && (args[0] === '--version' || args[0] === '-v')) {
  try {
    const packagePath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    console.log(packageJson.version);
    process.exit(0);
  } catch (error) {
    console.log('2025.9.08.1'); // Fallback version
    process.exit(0);
  }
}

// Fast help check without loading full CLI  
if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
  console.log('🌆 Unjucks CLI - Fast Template Generator');
  console.log('\nUsage: unjucks <generator> <template> [args...]');
  console.log('\nCommon commands:');
  console.log('  unjucks list                    # List generators');
  console.log('  unjucks component react MyComp  # Generate component');
  console.log('  unjucks --version               # Show version');
  console.log('\nFor full help: unjucks help');
  process.exit(0);
}

// Execute optimized CLI loading
loadAndRunCLI().catch((error) => {
  console.error('❌ Critical CLI failure:', error.message);
  process.exit(1);
});