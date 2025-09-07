#!/usr/bin/env node

/**
 * Unjucks CLI - JavaScript version
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the main CLI module (assume it exists in src/cli)
async function main() {
  try {
    const { runMain } = await import(join(__dirname, '..', 'src', 'cli', 'index.js'));
    await runMain();
  } catch (error) {
    console.error('Failed to start Unjucks CLI:', error.message);
    console.error('Try: npm install or check file permissions');
    process.exit(1);
  }
}

main();
