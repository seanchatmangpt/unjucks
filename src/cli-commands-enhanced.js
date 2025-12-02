/**
 * Enhanced CLI Commands - BDD Compliant Implementation
 * 
 * This module provides CLI command definitions that exactly match the BDD acceptance criteria
 */

import { defineCommand } from 'citty';
import EnhancedCLIEngine from './cli-enhancements.js';
import { getDeterministicISOString } from './utils/deterministic-time.js';

// Initialize enhanced CLI engine
const enhancedCLI = new EnhancedCLIEngine();

/**
 * Enhanced artifact generate command
 * BDD: Support --graph, --template, --attest flags
 * BDD: Output path to generated file (stdout only)
 */
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
      description: 'Generate attestation file with {generation.graphHash, artifact.hash}',
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
        // BDD requirement: Output path to generated file (stdout only)
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

/**
 * Enhanced drift detection command
 * BDD: Exit codes: 0 (no drift), 3 (drift detected)
 */
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
        // Output drift report as JSON
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
        
        // BDD requirement: Exit with code 3 if drift detected
        if (result.driftDetected && args['exit-code'] !== false) {
          process.exitCode = 3;
        }
        
        return output;\n      } else {\n        const errorOutput = {\n          success: false,\n          operation: 'artifact:drift',\n          error: result.error,\n          exitCode: result.exitCode || 1,\n          timestamp: getDeterministicISOString()\n        };\n        \n        console.log(JSON.stringify(errorOutput, null, 2));\n        process.exitCode = result.exitCode || 1;\n        return errorOutput;\n      }\n    } catch (error) {\n      const errorOutput = {\n        success: false,\n        operation: 'artifact:drift',\n        error: error.message,\n        exitCode: 1,\n        timestamp: getDeterministicISOString()\n      };\n      \n      console.log(JSON.stringify(errorOutput, null, 2));\n      process.exitCode = 1;\n      return errorOutput;\n    }\n  }\n});\n\n/**\n * Enhanced graph validation command\n * BDD: On failure: non-zero exit, JSON to stdout with SHACL errors\n */\nexport const enhancedValidateGraph = defineCommand({\n  meta: {\n    name: 'graph',\n    description: 'Validate RDF graphs with optional SHACL validation'\n  },\n  args: {\n    file: {\n      type: 'positional',\n      description: 'Path to RDF file to validate',\n      required: true\n    },\n    shacl: {\n      type: 'boolean',\n      description: 'Enable SHACL validation'\n    },\n    'shapes-file': {\n      type: 'string',\n      description: 'Path to SHACL shapes file',\n      alias: 's'\n    }\n  },\n  async run({ args }) {\n    try {\n      await enhancedCLI.initialize({ debug: args.debug });\n      \n      const options = {};\n      if (args.shacl || args['shapes-file']) {\n        options.shacl = args['shapes-file'] || true;\n      }\n      \n      const result = await enhancedCLI.validateGraph(args.file, options);\n      \n      const output = {\n        success: result.success,\n        operation: 'validate:graph',\n        file: args.file,\n        conforms: result.conforms,\n        violations: result.violations || [],\n        timestamp: getDeterministicISOString()\n      };\n      \n      if (!result.success) {\n        output.error = result.error;\n      }\n      \n      console.log(JSON.stringify(output, null, 2));\n      \n      // BDD requirement: Non-zero exit on validation failure\n      if (result.exitCode > 0) {\n        process.exitCode = result.exitCode;\n      }\n      \n      return output;\n      \n    } catch (error) {\n      const errorOutput = {\n        success: false,\n        operation: 'validate:graph',\n        file: args.file,\n        error: error.message,\n        timestamp: getDeterministicISOString()\n      };\n      \n      console.log(JSON.stringify(errorOutput, null, 2));\n      process.exitCode = 1;\n      return errorOutput;\n    }\n  }\n});\n\n/**\n * Template resolution command for multi-format support\n * BDD: Template resolution: \"office/report\" -> _templates/office/report.docx.njk\n */\nexport const enhancedTemplateResolve = defineCommand({\n  meta: {\n    name: 'resolve',\n    description: 'Resolve template paths with multi-format support'\n  },\n  args: {\n    template: {\n      type: 'positional',\n      description: 'Template name or path to resolve',\n      required: true\n    }\n  },\n  async run({ args }) {\n    try {\n      await enhancedCLI.initialize({ debug: args.debug });\n      \n      const templatePath = await enhancedCLI.resolveTemplate(args.template);\n      \n      const output = {\n        success: true,\n        operation: 'template:resolve',\n        template: args.template,\n        resolvedPath: templatePath,\n        timestamp: getDeterministicISOString()\n      };\n      \n      console.log(JSON.stringify(output, null, 2));\n      return output;\n      \n    } catch (error) {\n      const errorOutput = {\n        success: false,\n        operation: 'template:resolve',\n        template: args.template,\n        error: error.message,\n        timestamp: getDeterministicISOString()\n      };\n      \n      console.log(JSON.stringify(errorOutput, null, 2));\n      process.exitCode = 1;\n      return errorOutput;\n    }\n  }\n});\n\nexport { enhancedCLI };