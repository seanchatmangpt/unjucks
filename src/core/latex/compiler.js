/**
 * LaTeX Compilation Pipeline for Unjucks
 * 
 * Provides LaTeX document compilation with pdflatex, xelatex support
 * Handles temporary file management, error reporting, and PDF generation
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

export class LaTeXCompiler {
  constructor(options = {}) {
    this.options = {
      engine: 'pdflatex', // pdflatex, xelatex, lualatex
      outputDir: options.outputDir || tmpdir(),
      cleanupTemp: true,
      timeout: 30000, // 30 seconds
      passes: 2, // Number of compilation passes
      additionalPackages: [],
      ...options
    };

    this.tempFiles = new Set();
  }

  /**
   * Compile LaTeX content to PDF
   * @param {string} latexContent - LaTeX source content
   * @param {string} filename - Output filename (without extension)
   * @returns {Promise<{pdf: Buffer, log: string, success: boolean}>}
   */
  async compile(latexContent, filename = 'document') {
    const compilationId = randomUUID();
    const tempDir = join(this.options.outputDir, `latex-${compilationId}`);
    
    try {
      // Create temporary directory
      await fs.mkdir(tempDir, { recursive: true });
      this.tempFiles.add(tempDir);

      // Write LaTeX file
      const texFile = join(tempDir, `${filename}.tex`);
      await fs.writeFile(texFile, latexContent, 'utf8');

      // Compile with specified engine
      const result = await this.runCompilation(texFile, tempDir);
      
      if (result.success) {
        // Read PDF output
        const pdfFile = join(tempDir, `${filename}.pdf`);
        const pdfBuffer = await fs.readFile(pdfFile);
        
        return {
          pdf: pdfBuffer,
          log: result.log,
          success: true,
          tempDir: tempDir
        };
      }

      return {
        pdf: null,
        log: result.log,
        success: false,
        error: result.error,
        tempDir: tempDir
      };

    } catch (error) {
      return {
        pdf: null,
        log: '',
        success: false,
        error: error.message,
        tempDir: tempDir
      };
    } finally {
      if (this.options.cleanupTemp) {
        await this.cleanup();
      }
    }
  }

  /**
   * Run LaTeX compilation process
   * @param {string} texFile - Path to .tex file
   * @param {string} workingDir - Working directory
   * @returns {Promise<{success: boolean, log: string, error?: string}>}
   */
  async runCompilation(texFile, workingDir) {
    const filename = basename(texFile, '.tex');
    let log = '';
    let success = false;

    try {
      // Run compilation passes
      for (let pass = 1; pass <= this.options.passes; pass++) {
        const passResult = await this.runLatexPass(texFile, workingDir, pass);
        log += `\n=== Pass ${pass} ===\n${passResult.output}`;
        
        if (passResult.exitCode !== 0) {
          return {
            success: false,
            log: log,
            error: `Compilation failed at pass ${pass} with exit code ${passResult.exitCode}`
          };
        }
      }

      // Check if PDF was generated
      const pdfFile = join(workingDir, `${filename}.pdf`);
      try {
        await fs.access(pdfFile);
        success = true;
      } catch {
        return {
          success: false,
          log: log,
          error: 'PDF file was not generated'
        };
      }

      return { success: true, log: log };

    } catch (error) {
      return {
        success: false,
        log: log,
        error: error.message
      };
    }
  }

  /**
   * Run single LaTeX compilation pass
   * @param {string} texFile - Path to .tex file
   * @param {string} workingDir - Working directory
   * @param {number} passNumber - Pass number for logging
   * @returns {Promise<{exitCode: number, output: string}>}
   */
  runLatexPass(texFile, workingDir, passNumber) {
    return new Promise((resolve, reject) => {
      const filename = basename(texFile);
      const args = [
        '-interaction=nonstopmode',
        '-file-line-error',
        '-halt-on-error',
        '-output-directory', workingDir,
        filename
      ];

      const process = spawn(this.options.engine, args, {
        cwd: workingDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let error = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      // Set timeout
      const timeout = setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error(`LaTeX compilation timed out after ${this.options.timeout}ms`));
      }, this.options.timeout);

      process.on('close', (exitCode) => {
        clearTimeout(timeout);
        resolve({
          exitCode: exitCode || 0,
          output: output + (error ? `\nSTDERR:\n${error}` : '')
        });
      });

      process.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start ${this.options.engine}: ${err.message}`));
      });
    });
  }

  /**
   * Check if LaTeX engine is available
   * @param {string} engine - LaTeX engine name
   * @returns {Promise<boolean>}
   */
  static async isEngineAvailable(engine = 'pdflatex') {
    return new Promise((resolve) => {
      const process = spawn(engine, ['--version'], {
        stdio: 'ignore'
      });

      process.on('close', (exitCode) => {
        resolve(exitCode === 0);
      });

      process.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Get available LaTeX engines
   * @returns {Promise<string[]>}
   */
  static async getAvailableEngines() {
    const engines = ['pdflatex', 'xelatex', 'lualatex'];
    const available = [];

    for (const engine of engines) {
      if (await LaTeXCompiler.isEngineAvailable(engine)) {
        available.push(engine);
      }
    }

    return available;
  }

  /**
   * Generate LaTeX document with proper structure
   * @param {Object} options - Document options
   * @returns {string} - Complete LaTeX document
   */
  static generateDocument(content, options = {}) {
    const {
      documentClass = 'article',
      geometry = 'margin=1in',
      fontsize = '11pt',
      packages = [],
      title = '',
      author = '',
      date = '\\today'
    } = options;

    const standardPackages = [
      'inputenc[utf8]',
      'fontenc[T1]',
      'lmodern',
      'geometry',
      'hyperref',
      'graphicx',
      'amsmath',
      'amsfonts',
      'amssymb'
    ];

    const allPackages = [...standardPackages, ...packages];
    const packageCommands = allPackages.map(pkg => {
      const [name, opts] = pkg.includes('[') ? 
        [pkg.split('[')[0], `[${pkg.split('[')[1]}`] : 
        [pkg, ''];
      return `\\usepackage${opts}{${name}}`;
    }).join('\n');

    return `\\documentclass[${fontsize}]{${documentClass}}

${packageCommands}

\\geometry{${geometry}}

${title ? `\\title{${title}}` : ''}
${author ? `\\author{${author}}` : ''}
${date ? `\\date{${date}}` : ''}

\\begin{document}

${title ? '\\maketitle\n' : ''}

${content}

\\end{document}`;
  }

  /**
   * Clean up temporary files
   * @returns {Promise<void>}
   */
  async cleanup() {
    for (const tempPath of this.tempFiles) {
      try {
        await fs.rm(tempPath, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to clean up ${tempPath}:`, error.message);
      }
    }
    this.tempFiles.clear();
  }
}

export default LaTeXCompiler;