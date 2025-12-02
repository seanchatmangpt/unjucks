#!/usr/bin/env node
/**
 * KGEN CLI Entry Point
 * Simple standalone CLI without complex dependencies for unbuild compatibility
 */

export function main() {
  console.log('@kgen/cli ready');
  console.log('Version: 1.0.0');
  return 0;
}

// For compatibility
export default main;

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}