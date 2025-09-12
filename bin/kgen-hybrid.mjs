#!/usr/bin/env node

/**
 * KGEN Hybrid CLI - Best of Both Worlds
 * 
 * Provides both machine-first JSON output and human-friendly formatting
 * with automatic detection and manual override options.
 * 
 * Charter v1 Agent 8: JSON Schema CLI Engineer + Human Compatibility
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
// Dynamic import for human formatter
let humanFormatter = null;

// Initialize human formatter with fallback
async function initializeFormatter() {
  try {
    const module = await import('../src/lib/human-formatter.js');
    humanFormatter = module.humanFormatter;
  } catch (error) {
    console.warn('[KGEN-HYBRID] Human formatter not available, using simple fallback');
    humanFormatter = {
      formatResponse: (jsonResponse) => {
        if (jsonResponse.success) {
          return `✅ ${jsonResponse.operation} completed successfully`;
        } else {
          return `❌ ${jsonResponse.operation} failed: ${jsonResponse.error}`;
        }
      }
    };
  }
}

// Initialize on module load
await initializeFormatter();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Hybrid CLI Wrapper
 * 
 * Detects execution environment and user preferences to determine
 * whether to output machine-first JSON or human-friendly format.
 */
class KGenHybridCLI {
  constructor() {
    this.isTerminal = process.stdout.isTTY;
    this.jsonCLIPath = path.resolve(__dirname, 'kgen-json.mjs');
  }

  /**
   * Determine output format based on environment and arguments
   */
  detectOutputFormat(args) {
    // Explicit format override
    if (args.includes('--json') || args.includes('-j')) {
      return 'json';
    }
    
    if (args.includes('--human') || args.includes('-h')) {
      return 'human';
    }
    
    // Environment-based detection
    if (!this.isTerminal) {
      // Piped or redirected output -> machine-first JSON
      return 'json';
    }
    
    // CI environment detection
    if (process.env.CI || 
        process.env.GITHUB_ACTIONS || 
        process.env.GITLAB_CI || 
        process.env.JENKINS_URL ||
        process.env.BUILDKITE) {
      return 'json';
    }
    
    // Interactive terminal -> human-friendly
    return 'human';
  }

  /**
   * Execute JSON CLI and capture output
   */
  async executeJSONCLI(args) {
    return new Promise((resolve, reject) => {
      // Filter out format flags before passing to JSON CLI
      const filteredArgs = args.filter(arg => 
        !['--json', '-j', '--human', '-h'].includes(arg)
      );
      
      const child = spawn('node', [this.jsonCLIPath, ...filteredArgs], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          code,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Parse JSON response safely
   */
  parseJSONResponse(output) {
    try {
      return JSON.parse(output);
    } catch (error) {
      // Handle malformed JSON
      return {
        success: false,
        operation: 'system:parse-error',
        error: 'Failed to parse CLI output as JSON',
        errorCode: 'JSON_PARSE_ERROR',
        rawOutput: output,
        parseError: error.message,
        timestamp: this.getDeterministicDate().toISOString()
      };
    }
  }

  /**
   * Format output based on detected/specified format
   */
  async formatOutput(jsonResponse, format, options = {}) {
    if (format === 'json') {
      // Machine-first JSON output
      return JSON.stringify(jsonResponse, null, 2);
    } else {
      // Human-friendly format (with fallback)
      if (humanFormatter && humanFormatter.formatResponse) {
        return humanFormatter.formatResponse(jsonResponse, options);
      } else {
        // Simple fallback formatting
        const status = jsonResponse.success ? '✅' : '❌';
        const summary = jsonResponse.success 
          ? `${jsonResponse.operation} completed successfully`
          : `${jsonResponse.operation} failed: ${jsonResponse.error}`;
        return `${status} ${summary}\n\nDetails: ${JSON.stringify(jsonResponse, null, 2)}`;
      }
    }
  }

  /**
   * Main execution logic
   */
  async run() {
    try {
      const args = process.argv.slice(2);
      
      // Handle special cases
      if (args.length === 0 || args.includes('--help')) {
        this.showHelp();
        return;
      }

      if (args.includes('--version')) {
        console.log('KGEN Hybrid CLI v1.0.0');
        console.log('Machine-first JSON with human-friendly compatibility');
        return;
      }

      // Detect output format
      const format = this.detectOutputFormat(args);
      
      // Parse formatting options
      const verbose = args.includes('--verbose') || args.includes('-v');
      const compact = args.includes('--compact') || args.includes('-c');
      const noColor = args.includes('--no-color') || process.env.NO_COLOR;

      // Execute JSON CLI
      const result = await this.executeJSONCLI(args);
      
      // Handle execution errors
      if (result.code !== 0 && result.stderr) {
        console.error(result.stderr);
        process.exit(result.code || 1);
      }

      // Parse JSON response
      const jsonResponse = this.parseJSONResponse(result.stdout || result.stderr);

      // Format and output response
      const formattedOutput = await this.formatOutput(jsonResponse, format, {
        verbose,
        compact,
        noColor
      });

      console.log(formattedOutput);

      // Set exit code based on response
      if (jsonResponse.exitCode !== undefined) {
        process.exit(jsonResponse.exitCode);
      } else if (!jsonResponse.success) {
        process.exit(1);
      }

    } catch (error) {
      // Emergency fallback error handling
      const errorResponse = {
        success: false,
        operation: 'system:hybrid-cli-error',
        error: `Hybrid CLI execution failed: ${error.message}`,
        errorCode: 'HYBRID_CLI_ERROR',
        timestamp: this.getDeterministicDate().toISOString()
      };

      const format = this.detectOutputFormat(process.argv.slice(2));
      const output = await this.formatOutput(errorResponse, format);
      
      console.error(output);
      process.exit(1);
    }
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log(`
KGEN Hybrid CLI v1.0.0 - Machine-First with Human Compatibility

USAGE:
  kgen <command> <subcommand> [options]

OUTPUT FORMATS:
  --json, -j          Force machine-first JSON output
  --human             Force human-friendly output
  (auto-detected based on environment if not specified)

COMMANDS:
  graph               Graph operations (hash, diff, index)
  artifact            Artifact generation and management
  schema              JSON schema information
  health              System health check

OPTIONS:
  --verbose, -v       Show detailed information
  --compact, -c       Compact table formatting
  --no-color          Disable colored output
  --debug, -d         Enable debug mode
  --help              Show this help
  --version           Show version information

EXAMPLES:
  # Human-friendly output (auto-detected in terminal)
  kgen graph hash ./example.ttl
  
  # Machine-first JSON (auto-detected in CI or when piped)
  kgen graph hash ./example.ttl | jq .hash
  
  # Force JSON output
  kgen --json artifact generate --template api --graph ./data.ttl
  
  # Force human-friendly output
  kgen --human artifact drift ./src

AUTO-DETECTION:
  • Terminal + Interactive    → Human-friendly format
  • Piped/Redirected output   → Machine-first JSON
  • CI Environment            → Machine-first JSON
  • Explicit flag             → Specified format

SCHEMA VALIDATION:
  All outputs validate against formal JSON schemas for machine consumption.
  Use 'kgen schema list' to see available schemas.

TRACING:
  OpenTelemetry trace IDs included in all responses for operation tracking.
`);
  }

  /**
   * Check if JSON CLI exists
   */
  checkDependencies() {
    if (!fs.existsSync(this.jsonCLIPath)) {
      throw new Error(`JSON CLI not found at: ${this.jsonCLIPath}`);
    }
  }
}

// Check dependencies and run
try {
  const cli = new KGenHybridCLI();
  cli.checkDependencies();
  cli.run().catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
} catch (error) {
  console.error('Initialization error:', error.message);
  process.exit(1);
}