#!/usr/bin/env node
/**
 * Simple KGEN CLI Entry Point for unbuild compatibility
 */

export function version() {
  return "1.0.0";
}

export function help() {
  return `
KGEN Knowledge Graph Engine CLI

Commands:
  --version     Show version
  --help        Show this help

Build system: unbuild
Status: TypeScript dependencies removed
`;
}

export function main(args = process.argv.slice(2)) {
  if (args.includes('--version') || args.includes('-v')) {
    console.log(version());
    return 0;
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(help());
    return 0;
  }

  console.log('@kgen/cli ready');
  console.log('Use --help for commands');
  return 0;
}

export default main;

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}