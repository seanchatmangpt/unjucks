#!/usr/bin/env node

/**
 * KGEN CLI - Knowledge Graph to Artifact Compilation Tool
 * 
 * A deterministic, stateless CLI designed for autonomous agents.
 * Outputs JSON for machine parsing. No interactive prompts.
 * 
 * @author Cognitive Swarm Unit 734 (CSU-734)
 * @version 1.0.0
 */

import { runMain } from 'citty';
import { main } from '../src/index.js';

// Run the CLI with error handling for autonomous agents
runMain(main).catch((error) => {
  // Output structured error for machine parsing
  console.error(JSON.stringify({
    success: false,
    error: {
      name: error.name,
      message: error.message,
      stack: process.env.KGEN_DEBUG ? error.stack : undefined,
      code: error.code || 'UNKNOWN_ERROR'
    },
    timestamp: new Date().toISOString(),
    command: process.argv.slice(2).join(' ')
  }, null, 2));
  
  process.exit(error.exitCode || 1);
});