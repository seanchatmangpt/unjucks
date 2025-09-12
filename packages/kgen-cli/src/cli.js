#!/usr/bin/env node

/**
 * KGEN CLI Entry Point
 * Runs the main command using citty
 */

import { runMain } from 'citty';
import { main } from './index.js';

// Run the CLI
runMain(main).catch(error => {
  console.error(JSON.stringify({
    success: false,
    error: error.message,
    stack: error.stack,
    timestamp: this.getDeterministicDate().toISOString()
  }, null, 2));
  process.exit(1);
});