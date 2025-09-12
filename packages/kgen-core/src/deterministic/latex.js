/**
 * KGEN Core Deterministic LaTeX Support
 * 
 * Provides SOURCE_DATE_EPOCH integration and deterministic LaTeX processing:
 * - SOURCE_DATE_EPOCH environment variable support for reproducible PDFs
 * - Deterministic timestamp injection for LaTeX documents
 * - Cross-platform LaTeX compilation consistency
 * - Reproducible bibliography and citation handling
 * - Static date/time replacements in LaTeX content
 */

import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getDeterministicTimestamp, setSourceDateEpoch, formatForLaTeX } from './time.js';

const execFileAsync = promisify(execFile);

/**
 * LaTeX processor with SOURCE_DATE_EPOCH support for reproducible builds
 */
export class LaTeXDeterministicProcessor {
  constructor(options = {}) {
    this.options = {
      // SOURCE_DATE_EPOCH configuration
      useSourceDateEpoch: options.useSourceDateEpoch !== false,
      staticTimestamp: options.staticTimestamp || getDeterministicTimestamp(),
      
      // LaTeX compilation settings
      engine: options.engine || 'pdflatex',
      maxPasses: options.maxPasses || 3,
      timeout: options.timeout || 60000,
      
      // Deterministic settings
      removeNonDeterministicCommands: options.removeNonDeterministicCommands !== false,
      normalizeWhitespace: options.normalizeWhitespace !== false,
      sortBibliography: options.sortBibliography !== false,
      
      // Working directory and output settings
      workingDir: options.workingDir || './',
      outputDir: options.outputDir || './output',
      keepIntermediateFiles: options.keepIntermediateFiles || false,
      
      ...options
    };
    
    // Initialize SOURCE_DATE_EPOCH if not set
    if (this.options.useSourceDateEpoch) {
      this._initializeSourceDateEpoch();
    }
    
    // Non-deterministic LaTeX commands to remove/replace
    this.nonDeterministicCommands = new Map([
      ['\\today', this._getStaticDateCommand()],
      ['\\now', this._getStaticTimeCommand()],
      ['\\currenttime', this._getStaticTimeCommand()],
      ['\\DTMnow', this._getStaticDateTimeCommand()],
      ['\\DTMtoday', this._getStaticDateCommand()]
    ]);
    
    this.stats = {
      documentsProcessed: 0,
      commandsReplaced: 0,
      compilationTime: 0,
      passes: 0
    };
  }
  
  /**
   * Process LaTeX document with deterministic settings
   */
  async processLaTeX(texFilePath, options = {}) {
    const startTime = Date.now();
    
    try {
      // Read and normalize LaTeX content
      const originalContent = await fs.readFile(texFilePath, 'utf-8');
      const normalizedContent = this._normalizeLaTeXContent(originalContent);
      
      // Write normalized content to temporary file if changed
      let workingTexPath = texFilePath;
      if (normalizedContent !== originalContent) {
        workingTexPath = path.join(path.dirname(texFilePath), `${path.basename(texFilePath, '.tex')}-normalized.tex`);
        await fs.writeFile(workingTexPath, normalizedContent, 'utf-8');
      }
      
      // Compile LaTeX with deterministic environment
      const compilationResult = await this._compileLaTeX(workingTexPath, options);
      
      // Clean up temporary file
      if (workingTexPath !== texFilePath && !this.options.keepIntermediateFiles) {
        try {
          await fs.unlink(workingTexPath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
      
      const processingTime = Date.now() - startTime;
      this.stats.documentsProcessed++;
      this.stats.compilationTime += processingTime;
      
      return {
        success: true,
        outputPath: compilationResult.outputPath,
        normalizedContent,
        commandsReplaced: this._countReplacedCommands(originalContent, normalizedContent),
        compilationLog: compilationResult.log,
        stats: {
          processingTime,
          passes: compilationResult.passes,
          sourceEpoch: process.env.SOURCE_DATE_EPOCH
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        success: false,
        error: error.message,
        stats: {
          processingTime,
          failed: true
        }
      };
    }
  }
  
  /**
   * Normalize LaTeX content for deterministic processing
   */
  _normalizeLaTeXContent(content) {
    let normalized = content;
    
    // Replace non-deterministic commands
    if (this.options.removeNonDeterministicCommands) {
      for (const [command, replacement] of this.nonDeterministicCommands) {
        const regex = new RegExp(command.replace(/\\/g, '\\\\'), 'g');
        normalized = normalized.replace(regex, replacement);
        
        if (content.includes(command)) {
          this.stats.commandsReplaced++;
        }
      }
    }
    
    // Normalize whitespace
    if (this.options.normalizeWhitespace) {
      normalized = this._normalizeWhitespace(normalized);
    }
    
    // Add SOURCE_DATE_EPOCH comment for debugging
    if (this.options.useSourceDateEpoch && process.env.SOURCE_DATE_EPOCH) {
      const epochComment = `% SOURCE_DATE_EPOCH: ${process.env.SOURCE_DATE_EPOCH} (${new Date(parseInt(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()})\n`;
      normalized = epochComment + normalized;
    }
    
    return normalized;
  }
  
  /**
   * Compile LaTeX with deterministic environment
   */
  async _compileLaTeX(texFilePath, options = {}) {
    const outputDir = options.outputDir || this.options.outputDir;
    const engine = options.engine || this.options.engine;
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    const baseFileName = path.basename(texFilePath, '.tex');
    const outputPath = path.join(outputDir, `${baseFileName}.pdf`);
    
    // Prepare LaTeX compilation environment
    const env = {
      ...process.env,
      // Ensure SOURCE_DATE_EPOCH is set for reproducible PDFs
      SOURCE_DATE_EPOCH: process.env.SOURCE_DATE_EPOCH || Math.floor(this.options.staticTimestamp / 1000).toString(),
      // Set LaTeX-specific environment variables for determinism
      TEXMFVAR: path.join(outputDir, 'texmf-var'),
      TEXMFCACHE: path.join(outputDir, 'texmf-cache'),
      // Disable interactive mode
      TEXINPUTS: `.:${path.dirname(texFilePath)}:`,
      // Force UTF-8 encoding
      LC_ALL: 'C.UTF-8'
    };
    
    // LaTeX compilation arguments for determinism
    const compileArgs = [
      '-interaction=nonstopmode',  // Non-interactive
      '-file-line-error',          // Better error messages
      '-halt-on-error',            // Stop on first error
      `-output-directory=${outputDir}`,
      texFilePath
    ];
    
    let log = '';
    let passes = 0;
    
    // Multiple passes for cross-references, bibliography, etc.
    for (let pass = 1; pass <= this.options.maxPasses; pass++) {
      passes = pass;
      
      try {
        const result = await execFileAsync(engine, compileArgs, {
          env,
          timeout: this.options.timeout,
          cwd: this.options.workingDir
        });
        
        log += `Pass ${pass}:\n${result.stdout}\n${result.stderr}\n\n`;
        
        // Check if additional pass is needed
        const needsAnotherPass = this._checkIfAnotherPassNeeded(result.stdout);
        if (!needsAnotherPass && pass > 1) {
          break;
        }
        
      } catch (error) {
        log += `Pass ${pass} failed:\n${error.stdout || ''}\n${error.stderr || ''}\n`;
        
        if (pass === 1) {
          // First pass failure is critical
          throw new Error(`LaTeX compilation failed: ${error.message}`);
        } else {
          // Later pass failures might be acceptable
          break;
        }
      }
    }
    
    this.stats.passes += passes;
    
    // Verify output file exists
    try {
      await fs.access(outputPath);
    } catch (error) {
      throw new Error(`LaTeX compilation did not produce expected output: ${outputPath}`);
    }
    
    return {
      outputPath,
      log,
      passes
    };
  }
  
  /**
   * Initialize SOURCE_DATE_EPOCH for reproducible builds
   */
  _initializeSourceDateEpoch() {
    if (!process.env.SOURCE_DATE_EPOCH) {
      setSourceDateEpoch(this.options.staticTimestamp);
    }
  }
  
  /**
   * Get static date command replacement
   */
  _getStaticDateCommand() {
    const formatted = formatForLaTeX(this.options.staticTimestamp);
    return formatted.latex.date;
  }
  
  /**
   * Get static time command replacement
   */
  _getStaticTimeCommand() {
    const formatted = formatForLaTeX(this.options.staticTimestamp);
    return formatted.latex.datetime;
  }
  
  /**
   * Get static datetime command replacement (for datetime2 package)
   */
  _getStaticDateTimeCommand() {
    const formatted = formatForLaTeX(this.options.staticTimestamp);
    return `\\DTMdate{${formatted.latex.year}-${formatted.latex.month}-${formatted.latex.day}}`;\n  }\n  \n  /**\n   * Normalize whitespace in LaTeX content\n   */\n  _normalizeWhitespace(content) {\n    return content\n      // Normalize line endings\n      .replace(/\\r\\n/g, '\\n')\n      .replace(/\\r/g, '\\n')\n      // Remove trailing whitespace from lines\n      .replace(/[ \\t]+$/gm, '')\n      // Normalize multiple consecutive blank lines\n      .replace(/\\n{3,}/g, '\\n\\n')\n      // Ensure single final newline\n      .replace(/\\n*$/, '\\n');\n  }\n  \n  /**\n   * Check if LaTeX needs another compilation pass\n   */\n  _checkIfAnotherPassNeeded(logOutput) {\n    const indicators = [\n      'Rerun to get cross-references right',\n      'There were undefined references',\n      'Label(s) may have changed',\n      'Rerun LaTeX',\n      'Please rerun LaTeX'\n    ];\n    \n    return indicators.some(indicator => logOutput.includes(indicator));\n  }\n  \n  /**\n   * Count replaced commands for statistics\n   */\n  _countReplacedCommands(original, normalized) {\n    let count = 0;\n    \n    for (const [command] of this.nonDeterministicCommands) {\n      const regex = new RegExp(command.replace(/\\\\/g, '\\\\\\\\'), 'g');\n      const originalMatches = (original.match(regex) || []).length;\n      const normalizedMatches = (normalized.match(regex) || []).length;\n      count += Math.max(0, originalMatches - normalizedMatches);\n    }\n    \n    return count;\n  }\n  \n  /**\n   * Create deterministic BibTeX processor\n   */\n  async processBibTeX(bibFilePath, options = {}) {\n    try {\n      const originalContent = await fs.readFile(bibFilePath, 'utf-8');\n      \n      let normalizedContent = originalContent;\n      \n      // Sort bibliography entries if enabled\n      if (this.options.sortBibliography) {\n        normalizedContent = this._sortBibliographyEntries(originalContent);\n      }\n      \n      // Remove/normalize dates in bibliography entries\n      normalizedContent = this._normalizeBibliographyDates(normalizedContent);\n      \n      // Write normalized bibliography if changed\n      if (normalizedContent !== originalContent) {\n        const normalizedPath = bibFilePath.replace(/\\.bib$/, '-normalized.bib');\n        await fs.writeFile(normalizedPath, normalizedContent, 'utf-8');\n        return { normalized: true, path: normalizedPath, content: normalizedContent };\n      }\n      \n      return { normalized: false, path: bibFilePath, content: originalContent };\n      \n    } catch (error) {\n      throw new Error(`BibTeX processing failed: ${error.message}`);\n    }\n  }\n  \n  /**\n   * Sort bibliography entries alphabetically by citation key\n   */\n  _sortBibliographyEntries(content) {\n    // Extract all bibliography entries\n    const entryRegex = /@(\\w+)\\s*\\{\\s*([^,]+)\\s*,([\\s\\S]*?)\\n\\}/g;\n    const entries = [];\n    let match;\n    \n    while ((match = entryRegex.exec(content)) !== null) {\n      entries.push({\n        type: match[1],\n        key: match[2].trim(),\n        content: match[3],\n        fullMatch: match[0],\n        index: match.index\n      });\n    }\n    \n    // Sort entries by citation key\n    entries.sort((a, b) => a.key.localeCompare(b.key));\n    \n    // Reconstruct content with sorted entries\n    let result = content;\n    \n    // Remove original entries (in reverse order to maintain indices)\n    entries.reverse().forEach(entry => {\n      result = result.substring(0, entry.index) + result.substring(entry.index + entry.fullMatch.length);\n    });\n    \n    // Add sorted entries at the end\n    entries.reverse(); // Back to sorted order\n    const sortedEntries = entries.map(entry => \n      `@${entry.type}{${entry.key},${entry.content}\\n}`\n    ).join('\\n\\n');\n    \n    return result.trim() + '\\n\\n' + sortedEntries + '\\n';\n  }\n  \n  /**\n   * Normalize dates in bibliography entries\n   */\n  _normalizeBibliographyDates(content) {\n    // Replace year fields with static year if they contain current year\n    const currentYear = new Date().getFullYear();\n    const staticYear = new Date(this.options.staticTimestamp).getFullYear();\n    \n    if (staticYear !== currentYear) {\n      const yearRegex = new RegExp(`year\\s*=\\s*\\{?${currentYear}\\}?`, 'g');\n      content = content.replace(yearRegex, `year={${staticYear}}`);\n    }\n    \n    return content;\n  }\n  \n  /**\n   * Validate LaTeX determinism by comparing multiple compilations\n   */\n  async validateDeterminism(texFilePath, iterations = 3) {\n    const results = [];\n    const hashes = new Set();\n    \n    for (let i = 0; i < iterations; i++) {\n      const result = await this.processLaTeX(texFilePath);\n      \n      if (result.success) {\n        // Calculate hash of output PDF\n        const pdfBuffer = await fs.readFile(result.outputPath);\n        const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');\n        \n        results.push({\n          iteration: i + 1,\n          hash,\n          outputSize: pdfBuffer.length,\n          processingTime: result.stats.processingTime\n        });\n        \n        hashes.add(hash);\n      } else {\n        results.push({\n          iteration: i + 1,\n          error: result.error\n        });\n      }\n    }\n    \n    const deterministic = hashes.size === 1;\n    \n    return {\n      deterministic,\n      iterations,\n      uniqueHashes: hashes.size,\n      results,\n      contentHash: deterministic ? Array.from(hashes)[0] : null,\n      message: deterministic \n        ? `✅ LaTeX compilation is deterministic: ${iterations} iterations produced identical PDFs`\n        : `❌ Non-deterministic LaTeX compilation: ${hashes.size} different outputs across ${iterations} iterations`\n    };\n  }\n  \n  /**\n   * Get processing statistics\n   */\n  getStats() {\n    return {\n      ...this.stats,\n      averageProcessingTime: this.stats.documentsProcessed > 0 \n        ? this.stats.compilationTime / this.stats.documentsProcessed \n        : 0,\n      averagePassesPerDocument: this.stats.documentsProcessed > 0 \n        ? this.stats.passes / this.stats.documentsProcessed \n        : 0,\n      sourceEpoch: process.env.SOURCE_DATE_EPOCH,\n      options: this.options\n    };\n  }\n  \n  /**\n   * Reset statistics\n   */\n  resetStats() {\n    this.stats = {\n      documentsProcessed: 0,\n      commandsReplaced: 0,\n      compilationTime: 0,\n      passes: 0\n    };\n  }\n}\n\n/**\n * Utility functions for LaTeX deterministic processing\n */\n\n/**\n * Extract LaTeX packages from document content\n */\nexport function extractLaTeXPackages(content) {\n  const packageRegex = /\\\\usepackage(?:\\[[^\\]]*\\])?\\{([^}]+)\\}/g;\n  const packages = [];\n  let match;\n  \n  while ((match = packageRegex.exec(content)) !== null) {\n    packages.push(match[1]);\n  }\n  \n  return packages.sort();\n}\n\n/**\n * Check if LaTeX document uses potentially non-deterministic packages\n */\nexport function checkNonDeterministicPackages(content) {\n  const problematicPackages = [\n    'datetime',     // Current date/time\n    'currfile',     // Current file info  \n    'fancyhdr',     // May include timestamps\n    'lastpage'      // May be non-deterministic\n  ];\n  \n  const usedPackages = extractLaTeXPackages(content);\n  const issues = problematicPackages.filter(pkg => usedPackages.includes(pkg));\n  \n  return {\n    hasIssues: issues.length > 0,\n    problematicPackages: issues,\n    allPackages: usedPackages,\n    recommendations: issues.map(pkg => `Consider alternatives to ${pkg} package for deterministic builds`)\n  };\n}\n\n/**\n * Factory function for creating LaTeX processor\n */\nexport function createLaTeXProcessor(options = {}) {\n  return new LaTeXDeterministicProcessor(options);\n}\n\n/**\n * Quick LaTeX processing function\n */\nexport async function processLaTeXDeterministic(texFilePath, options = {}) {\n  const processor = new LaTeXDeterministicProcessor(options);\n  return await processor.processLaTeX(texFilePath, options);\n}\n\n/**\n * Validate SOURCE_DATE_EPOCH setup for LaTeX\n */\nexport function validateSourceDateEpochSetup() {\n  const issues = [];\n  const info = {};\n  \n  // Check SOURCE_DATE_EPOCH\n  const sourceEpoch = process.env.SOURCE_DATE_EPOCH;\n  if (sourceEpoch) {\n    const timestamp = parseInt(sourceEpoch, 10);\n    if (isNaN(timestamp)) {\n      issues.push('SOURCE_DATE_EPOCH is not a valid Unix timestamp');\n    } else {\n      info.sourceEpoch = {\n        value: timestamp,\n        date: new Date(timestamp * 1000).toISOString(),\n        valid: true\n      };\n    }\n  } else {\n    issues.push('SOURCE_DATE_EPOCH not set - LaTeX PDFs may not be reproducible');\n  }\n  \n  // Check LaTeX availability\n  info.environment = {\n    hasLatex: !!process.env.PATH && process.env.PATH.includes('tex'),\n    locale: process.env.LC_ALL || process.env.LANG || 'not set',\n    texmfhome: process.env.TEXMFHOME || 'not set'\n  };\n  \n  return {\n    valid: issues.length === 0,\n    issues,\n    info,\n    recommendations: [\n      'Set SOURCE_DATE_EPOCH to Unix timestamp for reproducible PDFs',\n      'Use LC_ALL=C.UTF-8 for consistent text handling',\n      'Ensure TeX Live or MiKTeX is properly installed'\n    ]\n  };\n}\n\nexport default LaTeXDeterministicProcessor;"