#!/usr/bin/env node

/**
 * Unjucks v3.0 - CLI Entry Point
 * 
 * High-performance template scaffolding with semantic web capabilities
 * Built with JavaScript ES2023 native architecture for optimal performance
 */

import { performance } from 'perf_hooks';
import { createRequire } from 'module';
import { UnjucksApp } from '../src/core/app.js';
import { CONSTANTS } from '../src/utils/constants.js';

const require = createRequire(import.meta.url);

async function main() {
  const startTime = performance.now();
  
  try {
    // Initialize the core application
    const app = new UnjucksApp({
      name: CONSTANTS.APP_NAME,
      version: CONSTANTS.VERSION,
      description: CONSTANTS.DESCRIPTION
    });

    // Run the CLI with provided arguments
    await app.run(process.argv.slice(2));

  } catch (error) {
    console.error(`❌ Fatal error: ${error.message}`);
    process.exit(1);
  }

  const endTime = performance.now();
  if (process.env.DEBUG) {
    console.log(`\n⏱️  Execution time: ${(endTime - startTime).toFixed(2)}ms`);
  }
}

// Handle uncaught exceptions gracefully
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the main function
main().catch(error => {
  console.error('❌ Application failed to start:', error.message);
  process.exit(1);
});