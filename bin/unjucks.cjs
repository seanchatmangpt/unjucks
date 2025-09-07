#!/usr/bin/env node

/**
 * Unjucks CLI Entry Point
 * Global binary for semantic scaffolding and code generation
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
  console.error('   Please report this issue: https://github.com/unjucks/unjucks/issues');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled promise rejection:', reason);
  console.error('   Please report this issue: https://github.com/unjucks/unjucks/issues');
  process.exit(1);
});

// Check if source CLI exists
const path = require('path');
const fs = require('fs');
const cliPath = path.join(__dirname, '../src/cli/index.js');

if (!fs.existsSync(cliPath)) {
  console.error('❌ Unjucks CLI source not found');
  console.error('   Missing CLI files. Please reinstall:');
  console.error('   npm uninstall -g unjucks && npm install -g unjucks@latest');
  process.exit(1);
}

// Import and run the CLI application directly from source
try {
  // Import using dynamic import to support ES modules
  (async () => {
    const { runMain } = await import('../src/cli/index.js');
  
    // Run with proper error handling
    runMain().catch((error) => {
      if (error.code === 'ENOENT') {
        console.error('❌ Command not found or file missing');
        console.error('   Check that all required files are present');
      } else if (error.message.includes('permission')) {
        console.error('❌ Permission denied');  
        console.error('   Try running with appropriate permissions');
      } else {
        console.error('❌ Error:', error.message);
      }
      
      // Show help information for common issues
      if (process.argv.length === 2) {
        console.error('\n💡 Try: unjucks --help');
        console.error('   Or: unjucks list');
      }
      
      process.exit(1);
    });
  })().catch((error) => {
    console.error('❌ Failed to import CLI module:', error.message);
    process.exit(1);
  });
  
} catch (error) {
  console.error('❌ Failed to load Unjucks CLI');
  console.error('   Error:', error.message);
  console.error('\n💡 This usually means the package is corrupted.');
  console.error('   Please reinstall: npm uninstall -g unjucks && npm install -g unjucks@latest');
  process.exit(1);
}