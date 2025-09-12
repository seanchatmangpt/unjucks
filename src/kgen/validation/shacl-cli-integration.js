/**
 * KGEN SHACL CLI Integration
 * 
 * Integrates SHACL validation engine with CLI commands for build gates and validation reporting.
 * Provides command-line interface for SHACL validation with proper exit codes and JSON reporting.
 */

import { SHACLValidationEngine, SHACLValidationCodes } from './shacl-validation-engine.js';
import { SHACLGates, SHACLGateConfig } from './shacl-gates.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import consola from 'consola';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * CLI configuration for SHACL validation commands
 */
export const CLIConfig = {
  defaultShapesPath: path.join(__dirname, 'shapes'),
  defaultOutputPath: './shacl-reports',
  defaultTimeout: 30000,
  maxGraphSize: 50000,
  
  commands: {
    validate: {
      description: 'Validate RDF data against SHACL shapes',
      usage: 'kgen shacl validate <data-file> [options]'
    },
    gates: {
      description: 'Run SHACL validation gates for build pipeline',
      usage: 'kgen shacl gates <gate-name> <data-file> [options]'
    },
    report: {
      description: 'Generate validation report',
      usage: 'kgen shacl report <validation-result> [options]'
    },
    'check-shapes': {
      description: 'Validate SHACL shapes themselves',
      usage: 'kgen shacl check-shapes <shapes-file> [options]'
    }
  }
};

/**
 * SHACL CLI integration class
 */
export class SHACLCLIIntegration {
  constructor(options = {}) {
    this.options = {
      logger: options.logger || consola,
      shapesPath: options.shapesPath || CLIConfig.defaultShapesPath,
      outputPath: options.outputPath || CLIConfig.defaultOutputPath,
      timeout: options.timeout || CLIConfig.defaultTimeout,
      verbose: options.verbose || false,
      ...options
    };
    
    this.validationEngine = null;
    this.gates = null;
  }

  /**
   * Initialize SHACL validation for CLI usage
   * @param {Object} cliOptions - CLI-specific options
   */
  async initialize(cliOptions = {}) {
    try {
      const shapesPath = cliOptions.shapesPath || this.options.shapesPath;
      
      // Initialize validation engine
      this.validationEngine = new SHACLValidationEngine({
        timeout: this.options.timeout,
        logger: this.options.logger,
        includeTrace: this.options.verbose
      });
      
      // Load SHACL shapes
      await this.validationEngine.loadShapes(shapesPath);
      
      // Initialize gates if needed
      this.gates = new SHACLGates({
        logger: this.options.logger,
        reportPath: this.options.outputPath,
        shapesPath: shapesPath,
        exitOnFailure: cliOptions.exitOnFailure !== false
      });
      
      await this.gates.initialize();
      
      this.options.logger.success(`SHACL CLI integration initialized with shapes from ${shapesPath}`);
      
    } catch (error) {
      this.options.logger.error(`Failed to initialize SHACL CLI: ${error.message}`);
      process.exit(SHACLValidationCodes.ERRORS);
    }
  }

  /**
   * Execute validation command
   * @param {Array} args - Command arguments
   * @param {Object} options - Command options
   */
  async executeValidateCommand(args, options = {}) {
    if (args.length < 1) {
      this.options.logger.error('Usage: kgen shacl validate <data-file> [options]');
      process.exit(SHACLValidationCodes.ERRORS);
    }

    const dataFile = args[0];
    const startTime = this.getDeterministicTimestamp();

    try {
      // Check if data file exists
      if (!(await fs.pathExists(dataFile))) {
        this.options.logger.error(`Data file not found: ${dataFile}`);
        process.exit(SHACLValidationCodes.ERRORS);
      }

      // Read data file
      const dataContent = await fs.readFile(dataFile, 'utf8');
      
      this.options.logger.info(`🔍 Validating ${dataFile} against SHACL shapes`);
      
      // Run validation
      const report = await this.validationEngine.validate(dataContent, {
        includeDetails: options.details || false,
        includeTrace: options.trace || false
      });

      const duration = this.getDeterministicTimestamp() - startTime;
      
      // Output report
      await this._outputValidationReport(report, {
        dataFile,
        duration,
        format: options.format || 'json',
        output: options.output
      });

      // Log results
      this._logValidationResults(report, duration);

      // Exit with appropriate code
      const exitCode = this.validationEngine.getExitCode(report);
      process.exit(exitCode);

    } catch (error) {
      this.options.logger.error(`Validation failed: ${error.message}`);
      if (this.options.verbose) {
        console.error(error);
      }
      process.exit(SHACLValidationCodes.ERRORS);
    }
  }

  /**
   * Execute gates command  
   * @param {Array} args - Command arguments
   * @param {Object} options - Command options
   */
  async executeGatesCommand(args, options = {}) {
    if (args.length < 2) {
      this.options.logger.error('Usage: kgen shacl gates <gate-name> <data-file> [options]');
      this.options.logger.info('Available gates: pre-build, artifact-generation, post-build, release');
      process.exit(SHACLValidationCodes.ERRORS);
    }

    const [gateName, dataFile] = args;
    
    // Validate gate name
    const validGates = ['pre-build', 'artifact-generation', 'post-build', 'release'];
    if (!validGates.includes(gateName)) {
      this.options.logger.error(`Invalid gate name: ${gateName}`);
      this.options.logger.info(`Valid gates: ${validGates.join(', ')}`);
      process.exit(SHACLValidationCodes.ERRORS);
    }

    try {
      // Check if data file exists
      if (!(await fs.pathExists(dataFile))) {
        this.options.logger.error(`Data file not found: ${dataFile}`);
        process.exit(SHACLValidationCodes.ERRORS);
      }

      // Read data file
      const dataContent = await fs.readFile(dataFile, 'utf8');
      
      // Configure gate options
      const gateOptions = {
        blockOnViolations: options.blockViolations !== false,
        blockOnWarnings: options.blockWarnings || false,
        timeout: options.timeout || this.options.timeout,
        exitOnFailure: options.exitOnFailure !== false
      };

      this.options.logger.info(`🚪 Running SHACL gate: ${gateName}`);
      
      // Run gate
      const gateResult = await this.gates.runGate(gateName, dataContent, gateOptions);
      
      // Output gate report
      await this._outputGateReport(gateResult, {
        gateName,
        dataFile,
        format: options.format || 'json',
        output: options.output
      });

      // The gate will handle exit codes internally based on configuration

    } catch (error) {
      this.options.logger.error(`Gate execution failed: ${error.message}`);
      if (this.options.verbose) {
        console.error(error);
      }
      process.exit(SHACLValidationCodes.ERRORS);
    }
  }

  /**
   * Execute check-shapes command
   * @param {Array} args - Command arguments
   * @param {Object} options - Command options
   */
  async executeCheckShapesCommand(args, options = {}) {
    if (args.length < 1) {
      this.options.logger.error('Usage: kgen shacl check-shapes <shapes-file> [options]');
      process.exit(SHACLValidationCodes.ERRORS);
    }

    const shapesFile = args[0];

    try {
      // Check if shapes file exists
      if (!(await fs.pathExists(shapesFile))) {
        this.options.logger.error(`Shapes file not found: ${shapesFile}`);
        process.exit(SHACLValidationCodes.ERRORS);
      }

      this.options.logger.info(`🔍 Validating SHACL shapes: ${shapesFile}`);
      
      // Read shapes content
      const shapesContent = await fs.readFile(shapesFile, 'utf8');
      
      // Create temporary validation engine for shapes validation
      const shapesValidator = new SHACLValidationEngine({
        timeout: this.options.timeout,
        logger: this.options.logger
      });
      
      // Load meta-shapes for SHACL validation (simplified - would use SHACL-SHACL in practice)
      const metaShapes = this._getMetaSHACLShapes();
      await shapesValidator.initialize(metaShapes);
      
      // Validate the shapes
      const report = await shapesValidator.validate(shapesContent);
      
      // Output results
      if (report.conforms) {
        this.options.logger.success(`✅ SHACL shapes are valid: ${shapesFile}`);
        this._logShapesStats(shapesContent);
      } else {
        this.options.logger.error(`❌ SHACL shapes validation failed: ${shapesFile}`);
        this.options.logger.error(`Found ${report.violations.length} violations`);
        
        if (options.details) {
          for (const violation of report.violations.slice(0, 10)) {
            this.options.logger.error(`  - ${violation.message} (${violation.focusNode})`);
          }
        }
      }

      const exitCode = shapesValidator.getExitCode(report);
      process.exit(exitCode);

    } catch (error) {
      this.options.logger.error(`Shapes validation failed: ${error.message}`);
      if (this.options.verbose) {
        console.error(error);
      }
      process.exit(SHACLValidationCodes.ERRORS);
    }
  }

  /**
   * Execute all-gates command for comprehensive validation
   * @param {Array} args - Command arguments  
   * @param {Object} options - Command options
   */
  async executeAllGatesCommand(args, options = {}) {
    if (args.length < 1) {
      this.options.logger.error('Usage: kgen shacl all-gates <data-directory> [options]');
      process.exit(SHACLValidationCodes.ERRORS);
    }

    const dataDirectory = args[0];

    try {
      // Check if directory exists
      if (!(await fs.pathExists(dataDirectory))) {
        this.options.logger.error(`Data directory not found: ${dataDirectory}`);
        process.exit(SHACLValidationCodes.ERRORS);
      }

      // Discover data files for each gate
      const gateData = await this._discoverGateData(dataDirectory);
      
      this.options.logger.info(`🚪 Running all SHACL gates for directory: ${dataDirectory}`);
      
      // Run all gates
      const overallResult = await this.gates.runAllGates(gateData, {
        exitOnFailure: false // Handle exit after all gates
      });
      
      // Output comprehensive report
      await this._outputOverallGatesReport(overallResult, {
        dataDirectory,
        format: options.format || 'json',
        output: options.output
      });

      // Exit with overall result code
      process.exit(overallResult.exitCode);

    } catch (error) {
      this.options.logger.error(`All gates execution failed: ${error.message}`);
      if (this.options.verbose) {
        console.error(error);
      }
      process.exit(SHACLValidationCodes.ERRORS);
    }
  }

  /**
   * Output validation report in specified format
   * @private
   */
  async _outputValidationReport(report, context) {
    const outputData = {
      ...report,
      metadata: {
        dataFile: context.dataFile,
        duration: `${context.duration}ms`,
        timestamp: this.getDeterministicDate().toISOString(),
        engine: 'KGEN-SHACL-Engine'
      }
    };

    if (context.format === 'json') {
      const output = context.output || 
        path.join(this.options.outputPath, `validation-${this.getDeterministicTimestamp()}.json`);
      
      await fs.ensureDir(path.dirname(output));
      await fs.writeJson(output, outputData, { spaces: 2 });
      
      this.options.logger.info(`📄 Validation report saved: ${output}`);
    } else if (context.format === 'console') {
      console.log(JSON.stringify(outputData, null, 2));
    }
  }

  /**
   * Output gate report
   * @private
   */
  async _outputGateReport(gateResult, context) {
    const outputData = {
      gate: gateResult,
      metadata: {
        gateName: context.gateName,
        dataFile: context.dataFile,
        timestamp: this.getDeterministicDate().toISOString()
      }
    };

    if (context.format === 'json') {
      const output = context.output || 
        path.join(this.options.outputPath, `gate-${context.gateName}-${this.getDeterministicTimestamp()}.json`);
      
      await fs.ensureDir(path.dirname(output));
      await fs.writeJson(output, outputData, { spaces: 2 });
      
      this.options.logger.info(`📄 Gate report saved: ${output}`);
    } else if (context.format === 'console') {
      console.log(JSON.stringify(outputData, null, 2));
    }
  }

  /**
   * Output overall gates report
   * @private
   */
  async _outputOverallGatesReport(overallResult, context) {
    const outputData = {
      ...overallResult,
      metadata: {
        dataDirectory: context.dataDirectory,
        timestamp: this.getDeterministicDate().toISOString()
      }
    };

    if (context.format === 'json') {
      const output = context.output || 
        path.join(this.options.outputPath, `all-gates-${this.getDeterministicTimestamp()}.json`);
      
      await fs.ensureDir(path.dirname(output));
      await fs.writeJson(output, outputData, { spaces: 2 });
      
      this.options.logger.info(`📄 Overall gates report saved: ${output}`);
    } else if (context.format === 'console') {
      console.log(JSON.stringify(outputData, null, 2));
    }
  }

  /**
   * Log validation results
   * @private
   */
  _logValidationResults(report, duration) {
    const symbol = report.conforms ? '✅' : '❌';
    const status = report.conforms ? 'VALID' : 'INVALID';
    
    this.options.logger.info(
      `${symbol} Validation ${status} (${duration}ms, ${report.violations.length} violations)`
    );

    if (report.violations.length > 0) {
      const { violationsBySeverity } = report.summary;
      this.options.logger.info(
        `   Violations: ${violationsBySeverity.Violation || 0}, ` +
        `Warnings: ${violationsBySeverity.Warning || 0}, ` +
        `Info: ${violationsBySeverity.Info || 0}`
      );

      // Show first few violations
      if (this.options.verbose) {
        for (const violation of report.violations.slice(0, 5)) {
          this.options.logger.error(`   - ${violation.message}`);
          if (violation.focusNode) {
            this.options.logger.error(`     Focus: ${violation.focusNode}`);
          }
        }
        
        if (report.violations.length > 5) {
          this.options.logger.info(`   ... and ${report.violations.length - 5} more violations`);
        }
      }
    }
  }

  /**
   * Log shapes statistics
   * @private
   */
  _logShapesStats(shapesContent) {
    const nodeShapes = (shapesContent.match(/a sh:NodeShape/g) || []).length;
    const propertyShapes = (shapesContent.match(/a sh:PropertyShape/g) || []).length;
    const sparqlConstraints = (shapesContent.match(/sh:sparql \[/g) || []).length;
    
    this.options.logger.info(
      `   Statistics: ${nodeShapes} node shapes, ${propertyShapes} property shapes, ${sparqlConstraints} SPARQL constraints`
    );
  }

  /**
   * Discover gate data files from directory
   * @private
   */
  async _discoverGateData(directory) {
    const gateData = {};
    
    // Look for gate-specific files
    const gateNames = ['pre-build', 'artifact-generation', 'post-build', 'release'];
    
    for (const gate of gateNames) {
      const possibleFiles = [
        path.join(directory, `${gate}.ttl`),
        path.join(directory, `${gate}.n3`),
        path.join(directory, `${gate}-data.ttl`),
        path.join(directory, 'default.ttl')
      ];
      
      for (const file of possibleFiles) {
        if (await fs.pathExists(file)) {
          gateData[gate] = await fs.readFile(file, 'utf8');
          break;
        }
      }
    }
    
    return gateData;
  }

  /**
   * Get meta-SHACL shapes for validating SHACL shapes themselves
   * @private
   */
  _getMetaSHACLShapes() {
    // Simplified meta-SHACL shapes - in practice would use official SHACL-SHACL
    return `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      
      [] a sh:NodeShape ;
         sh:targetClass sh:NodeShape ;
         sh:property [
           sh:path sh:targetClass ;
           sh:maxCount 1 ;
         ] .
    `;
  }
}

export default SHACLCLIIntegration;