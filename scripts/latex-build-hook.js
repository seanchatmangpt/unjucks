#!/usr/bin/env node
/**
 * LaTeX Build Hook - Standalone LaTeX compilation
 */
import { LaTeXBuildSystem } from './build-system-latex.js';

async function main() {
  const buildSystem = new LaTeXBuildSystem();
  
  try {
    const initialized = await buildSystem.initialize();
    if (!initialized) {
      console.warn('LaTeX build system initialization failed, exiting gracefully');
      process.exit(0);
    }

    const result = await buildSystem.build();
    
    if (result.success || result.skipped) {
      process.exit(0);
    } else {
      console.error('LaTeX build failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('LaTeX build hook failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
