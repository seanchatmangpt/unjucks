/**
 * Working CLI Commands - BDD Compliant Implementation
 */

import { defineCommand } from 'citty';
import EnhancedCLIEngine from './cli-enhancements.js';
import SimpleValidationEngine from './simple-validation.js';
import { getDeterministicISOString } from './utils/deterministic-time.js';

const enhancedCLI = new EnhancedCLIEngine();
const simpleValidator = new SimpleValidationEngine();

export const enhancedArtifactGenerate = defineCommand({
  meta: {
    name: 'generate',
    description: 'Generate deterministic artifacts from knowledge graphs with attestation'
  },
  args: {
    graph: {
      type: 'string',
      description: 'Path to RDF/Turtle graph file',
      alias: 'g'
    },
    template: {
      type: 'string',
      description: 'Template to use for generation (required)',
      alias: 't',
      required: true
    },
    output: {
      type: 'string',
      description: 'Output file path',
      alias: 'o'
    },
    attest: {
      type: 'boolean',
      description: 'Generate attestation file',
      default: true
    }
  },
  async run({ args }) {
    try {
      await enhancedCLI.initialize({ debug: args.debug });
      
      const result = await enhancedCLI.generateArtifact({
        graph: args.graph,
        template: args.template,
        output: args.output,
        attest: args.attest
      });
      
      if (result.success) {
        console.log(result.outputPath);
        return result;
      } else {
        console.error(result.error);
        process.exitCode = 1;
        return result;
      }
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
      return { success: false, error: error.message };
    }
  }
});

export const enhancedArtifactDrift = defineCommand({
  meta: {
    name: 'drift',
    description: 'Detect drift between expected and actual artifacts'
  },
  args: {
    directory: {
      type: 'positional',
      description: 'Directory to check for drift',
      required: true
    },
    'exit-code': {
      type: 'boolean',
      description: 'Exit with code 3 when drift is detected',
      default: true
    }
  },
  async run({ args }) {
    try {
      await enhancedCLI.initialize({ debug: args.debug });
      
      const result = await enhancedCLI.detectDrift(args.directory, {
        exitCode: args['exit-code']
      });
      
      if (result.success) {
        const output = {
          success: true,
          operation: 'artifact:drift',
          directory: args.directory,
          driftDetected: result.driftDetected,
          exitCode: result.exitCode,
          summary: result.summary,
          report: result.report,
          timestamp: getDeterministicISOString()
        };
        
        console.log(JSON.stringify(output, null, 2));
        
        if (result.driftDetected && args['exit-code'] !== false) {
          process.exitCode = 3;
        }
        
        return output;
      } else {
        const errorOutput = {
          success: false,
          operation: 'artifact:drift',
          error: result.error,
          exitCode: result.exitCode || 1,
          timestamp: getDeterministicISOString()
        };
        
        console.log(JSON.stringify(errorOutput, null, 2));
        process.exitCode = result.exitCode || 1;
        return errorOutput;
      }
    } catch (error) {
      const errorOutput = {
        success: false,
        operation: 'artifact:drift',
        error: error.message,
        exitCode: 1,
        timestamp: getDeterministicISOString()
      };
      
      console.log(JSON.stringify(errorOutput, null, 2));
      process.exitCode = 1;
      return errorOutput;
    }
  }
});

export const enhancedValidateGraph = defineCommand({
  meta: {
    name: 'graph',
    description: 'Validate RDF graphs with optional SHACL validation'
  },
  args: {
    file: {
      type: 'positional',
      description: 'Path to RDF file to validate',
      required: true
    },
    shacl: {
      type: 'boolean',
      description: 'Enable SHACL validation'
    },
    'shapes-file': {
      type: 'string',
      description: 'Path to SHACL shapes file',
      alias: 's'
    }
  },
  async run({ args }) {
    try {
      await simpleValidator.initialize({ debug: args.debug });
      
      const options = {};
      if (args.shacl || args['shapes-file']) {
        options.shacl = args['shapes-file'] || true;
      }
      
      const result = await simpleValidator.validateGraph(args.file, options);
      
      const output = {
        success: result.success,
        operation: 'validate:graph',
        file: args.file,
        conforms: result.conforms,
        violations: result.violations || [],
        timestamp: getDeterministicISOString()
      };
      
      if (!result.success) {
        output.error = result.error;
      }
      
      console.log(JSON.stringify(output, null, 2));
      
      if (result.exitCode > 0) {
        process.exitCode = result.exitCode;
      }
      
      return output;
      
    } catch (error) {
      const errorOutput = {
        success: false,
        operation: 'validate:graph',
        file: args.file,
        error: error.message,
        timestamp: getDeterministicISOString()
      };
      
      console.log(JSON.stringify(errorOutput, null, 2));
      process.exitCode = 1;
      return errorOutput;
    }
  }
});

export { enhancedCLI, simpleValidator };