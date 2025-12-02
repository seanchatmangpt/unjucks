#!/usr/bin/env node

/**
 * KGEN CLI Entry Point - JavaScript
 * Command-line interface for knowledge graph compilation
 */

import { KGenCore } from '../../kgen-core/src/core.js';

const config = {
  outputDir: './dist',
  strict: true,
  targetFormat: 'esm'
};

const core = new KGenCore(config);

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--version')) {
    console.log(`KGEN CLI v${core.getVersion()}`);
    process.exit(0);
  }

  if (args.includes('--help')) {
    console.log('KGEN - Knowledge Graph Engine');
    console.log('Usage: kgen [options]');
    console.log('Options:');
    console.log('  --version  Show version');
    console.log('  --help     Show help');
    process.exit(0);
  }

  const result = await core.processGraph('example-graph');
  console.log(result);
}

main().catch(console.error);