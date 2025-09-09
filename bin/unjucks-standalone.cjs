#!/usr/bin/env node

/**
 * Unjucks CLI Entry Point - Standalone Version
 * Minimal binary with no external dependencies
 */

// Check Node.js version compatibility  
const nodeVersion = process.versions.node;
const majorVersion = parseInt(nodeVersion.split('.')[0]);

if (majorVersion < 18) {
  console.error('❌ Unjucks requires Node.js v18.0.0 or higher');
  console.error(`   Current version: v${nodeVersion}`);
  console.error('   Please upgrade Node.js: https://nodejs.org/');
  process.exit(1);
}

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error('❌ Unexpected error:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled promise rejection:', reason);
  process.exit(1);
});

// Check if source CLI exists
const path = require('path');
const fs = require('fs');
const cliPath = path.join(__dirname, '../src/cli/index-standalone.js');

if (!fs.existsSync(cliPath)) {
  console.error('❌ Unjucks CLI source not found');
  console.error('   Missing CLI files. Please reinstall unjucks');
  process.exit(1);
}

// Import and run the CLI application
async function loadAndRunCLI() {
  try {
    const fullPath = path.resolve(__dirname, '../src/cli/index-standalone.js');
    const { pathToFileURL } = require('url');
    const cliModule = await import(pathToFileURL(fullPath));
    const { runMain } = cliModule;
  
    const result = await runMain();
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('❌ Failed to run CLI:', error.message);
    
    // Show help for common issues
    if (process.argv.length === 2) {
      console.error('\n💡 Try: unjucks --help');
      console.error('   Or: unjucks list');
    }
    
    process.exit(1);
  }
}

// Run the CLI
loadAndRunCLI();