#!/usr/bin/env node
/**
 * Unjucks CLI Entry Point
 * Connects all working commands from src/commands/
 */

import { defineCommand, runMain } from 'citty';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get package info
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packagePath = join(__dirname, '..', 'package.json');
const packageInfo = JSON.parse(readFileSync(packagePath, 'utf-8'));

// Import commands
import { generateCommand } from './commands/generate.js';
import { listCommand } from './commands/list.js';
import { helpCommand } from './commands/help.js';
import { initCommand } from './commands/init.js';

/**
 * Main CLI command
 */
const main = defineCommand({
  meta: {
    name: 'unjucks',
    version: packageInfo.version,
    description: 'Nunjucks-based code generation with intelligent scaffolding'
  },
  subCommands: {
    generate: generateCommand,
    list: listCommand,
    help: helpCommand,
    init: initCommand
  },
  async run({ args }) {
    // If no subcommand, show help
    console.log(`Unjucks v${packageInfo.version} - Template-based code generation`);
    console.log('\nUsage:');
    console.log('  unjucks generate <generator> <template> [name] [options]');
    console.log('  unjucks list [generator]');
    console.log('  unjucks help [generator] [template]');
    console.log('  unjucks init [options]');
    console.log('\nExamples:');
    console.log('  unjucks list');
    console.log('  unjucks list component');
    console.log('  unjucks generate component react Button');
    console.log('  unjucks generate component react Card --dry');
    console.log('\nOptions:');
    console.log('  --help, -h     Show help');
    console.log('  --version, -v  Show version');
    console.log('  --dry          Preview without creating files');
    console.log('  --force        Overwrite existing files');
    console.log('  --verbose      Show detailed output');
  }
});

// Run the CLI
runMain(main);
