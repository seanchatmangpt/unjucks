/**
 * KGEN Rules Package - Main Entry Point
 * Exports single validator function for direct CLI usage
 */

export { 
  validateGraph,
  validateMultipleGraphs,
  validateGraphWithCustomConstraints,
  createSummaryReport
} from './src/engine/validator.js';

// Export default validator function for CLI
export { validateGraph as default } from './src/engine/validator.js';