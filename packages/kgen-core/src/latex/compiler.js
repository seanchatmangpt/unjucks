/**
 * KGEN LaTeX Compilation Pipeline
 * Advanced LaTeX document compilation with security, validation, and optimization
 * Integrates with KGEN's template system and provides enterprise-grade compilation
 */

import { exec, spawn } from 'child_process';
import { promises as fs, existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, basename, extname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import chokidar from 'chokidar';
import { LaTeXParser } from './parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * LaTeX Engine Configuration
 */
export const LATEX_ENGINES = {
  pdflatex: {
    name: 'pdfLaTeX',
    command: 'pdflatex',
    description: 'Traditional LaTeX compiler with PDF output',
    extensions: ['.tex'],
    outputFormat: 'pdf',
    features: ['pdf', 'graphics', 'hyperlinks']
  },
  xelatex: {
    name: 'XeLaTeX',
    command: 'xelatex', 
    description: 'Unicode-aware LaTeX with system fonts support',
    extensions: ['.tex'],
    outputFormat: 'pdf',
    features: ['unicode', 'system-fonts', 'pdf']
  },
  lualatex: {
    name: 'LuaLaTeX',
    command: 'lualatex',
    description: 'Modern LaTeX with Lua scripting capabilities',
    extensions: ['.tex'],
    outputFormat: 'pdf',
    features: ['lua-scripting', 'unicode', 'pdf']
  },
  latex: {
    name: 'LaTeX',
    command: 'latex',
    description: 'Traditional LaTeX compiler (DVI output)',
    extensions: ['.tex'],
    outputFormat: 'dvi',
    features: ['dvi', 'traditional']
  }
};

/**
 * Security validator for LaTeX content
 */
class LaTeXSecurityValidator {
  constructor() {
    this.dangerousCommands = [
      '\\input{.*\\.\\.}',           // Path traversal
      '\\immediate\\write18',         // Shell execution
      '\\write18',                   // Shell execution alternative
      '\\openout',                   // File writing
      '\\openin',                    // File reading
      '\\read',                      // File reading
      '\\csname.*endcsname',         // Dynamic command construction
      '\\expandafter.*\\csname',     // Dynamic command expansion
    ];
    
    this.suspiciousPatterns = [
      /\\def\s*\\[a-zA-Z]*\s*\{.*\\input/,  // Redefinition with input
      /\\let\s*\\[a-zA-Z]*\s*=.*\\input/,  // Let with input
      /\\catcode.*=.*11/,                    // Category code manipulation
      /\\uppercase\s*\{.*\\input/,          // Uppercase tricks
      /\\lowercase\s*\{.*\\input/,          // Lowercase tricks
    ];
  }
  
  /**
   * Validate LaTeX content for security issues
   */
  validate(content) {
    const violations = [];
    
    // Check for dangerous commands
    for (const pattern of this.dangerousCommands) {
      const regex = new RegExp(pattern, 'gi');
      const matches = content.match(regex);
      if (matches) {
        violations.push({
          type: 'dangerous_command',
          pattern,
          matches: matches.length,
          severity: 'critical',
          message: `Potentially dangerous LaTeX command detected: ${pattern}`
        });
      }
    }
    
    // Check for suspicious patterns
    for (const pattern of this.suspiciousPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        violations.push({
          type: 'suspicious_pattern',
          pattern: pattern.toString(),
          matches: matches.length,
          severity: 'high',
          message: `Suspicious LaTeX pattern detected: ${pattern}`
        });
      }
    }
    
    // Check for file path traversal attempts
    const pathTraversalPattern = /\\(?:input|include)\{.*(?:\.\.\/)/gi;
    const pathMatches = content.match(pathTraversalPattern);
    if (pathMatches) {
      violations.push({
        type: 'path_traversal',
        matches: pathMatches.length,
        severity: 'critical',
        message: 'Path traversal attempt detected in \\input or \\include commands'
      });
    }
    
    return {
      isSafe: violations.filter(v => v.severity === 'critical').length === 0,
      violations,
      riskLevel: this.calculateRiskLevel(violations)
    };
  }
  
  calculateRiskLevel(violations) {
    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    const highCount = violations.filter(v => v.severity === 'high').length;
    
    if (criticalCount > 0) return 'critical';
    if (highCount > 2) return 'high';
    if (highCount > 0) return 'medium';
    return 'low';
  }
}

/**
 * LaTeX Compiler with advanced features
 */
export class LaTeXCompiler extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      engine: 'pdflatex',
      outputDir: './dist/latex',
      tempDir: './temp/latex',
      maxCompilationTime: 30000, // 30 seconds
      maxRetries: 2,
      cleanTemp: true,
      enableShellEscape: false,
      enableSyncTeX: true,
      enableBibtex: true,
      enableBiber: false,
      enableMakeIndex: false,
      verbose: false,
      docker: {
        enabled: false,
        image: 'texlive/texlive:latest',
        volumes: []
      },
      security: {
        enabled: true,
        strictMode: true,
        allowedInputPaths: ['./tex/', './templates/']
      },
      ...options
    };
    
    this.validator = new LaTeXSecurityValidator();
    this.isInitialized = false;
    this.watchMode = false;
    this.watcher = null;
    this.compilationQueue = [];
    this.isCompiling = false;
    this.statistics = {
      compilations: 0,
      errors: 0,
      warnings: 0,
      totalTime: 0,
      averageTime: 0
    };
  }
  
  /**
   * Initialize the compiler
   */
  async initialize() {
    if (this.isInitialized) return;
    
    // Create directories
    await fs.mkdir(this.config.outputDir, { recursive: true });
    await fs.mkdir(this.config.tempDir, { recursive: true });
    
    // Verify LaTeX installation
    await this.verifyLaTeXInstallation();
    
    // Initialize Docker if enabled
    if (this.config.docker.enabled) {
      await this.initializeDocker();
    }
    
    this.isInitialized = true;
    this.emit('initialized');
  }
  
  /**
   * Verify LaTeX installation
   */
  async verifyLaTeXInstallation() {
    const engine = LATEX_ENGINES[this.config.engine];
    if (!engine) {
      throw new Error(`Unsupported LaTeX engine: ${this.config.engine}`);
    }
    
    return new Promise((resolve, reject) => {
      exec(`${engine.command} --version`, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`LaTeX engine '${engine.name}' not found. Please install ${engine.name}.`));
        } else {
          const version = stdout.split('\n')[0];
          this.emit('engine-verified', { engine: engine.name, version });
          resolve({ engine: engine.name, version });
        }
      });
    });
  }
  
  /**
   * Initialize Docker support
   */
  async initializeDocker() {
    return new Promise((resolve, reject) => {
      exec('docker --version', (error, stdout) => {
        if (error) {
          reject(new Error('Docker not found. Please install Docker for containerized compilation.'));
        } else {
          this.emit('docker-verified', { version: stdout.trim() });
          resolve();
        }
      });
    });
  }
  
  /**
   * Compile a LaTeX document
   */
  async compile(inputPath, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const startTime = Date.now();
    const compileOptions = { ...this.config, ...options };
    
    try {
      // Validate input file
      await this.validateInputFile(inputPath);
      
      // Security validation
      if (this.config.security.enabled) {
        await this.performSecurityValidation(inputPath);
      }
      
      // Parse LaTeX for analysis
      const parseResult = await this.parseLatexDocument(inputPath);
      
      // Prepare compilation environment
      const compilationContext = await this.prepareCompilation(inputPath, compileOptions);
      
      // Execute compilation
      const result = await this.executeCompilation(compilationContext);
      
      // Post-process results
      const finalResult = await this.postProcessCompilation(result, compilationContext);
      
      // Update statistics
      this.updateStatistics(finalResult, startTime);
      
      this.emit('compilation-complete', finalResult);
      return finalResult;
      
    } catch (error) {
      const errorResult = {
        success: false,
        error: error.message,
        inputPath,
        duration: Date.now() - startTime
      };
      
      this.statistics.errors++;
      this.emit('compilation-error', errorResult);
      return errorResult;
    }
  }
  
  /**
   * Validate input file
   */
  async validateInputFile(inputPath) {
    const resolvedPath = resolve(inputPath);
    
    if (!existsSync(resolvedPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }
    
    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      throw new Error(`Input path is not a file: ${inputPath}`);
    }
    
    const ext = extname(resolvedPath).toLowerCase();
    const engine = LATEX_ENGINES[this.config.engine];
    
    if (!engine.extensions.includes(ext)) {
      throw new Error(`File extension '${ext}' not supported by ${engine.name}`);
    }
  }
  
  /**
   * Perform security validation
   */
  async performSecurityValidation(inputPath) {
    const content = await fs.readFile(inputPath, 'utf8');
    const validation = this.validator.validate(content);
    
    if (!validation.isSafe) {
      const criticalViolations = validation.violations.filter(v => v.severity === 'critical');
      if (criticalViolations.length > 0) {
        throw new Error(`Security validation failed: ${criticalViolations[0].message}`);
      }
    }
    
    if (validation.riskLevel === 'high' && this.config.security.strictMode) {
      throw new Error('High-risk LaTeX content detected in strict security mode');
    }
    
    // Emit security warning for medium/high risk
    if (validation.riskLevel !== 'low') {
      this.emit('security-warning', {
        riskLevel: validation.riskLevel,
        violations: validation.violations
      });
    }
    
    return validation;
  }
  
  /**
   * Parse LaTeX document for analysis
   */
  async parseLatexDocument(inputPath) {
    const content = await fs.readFile(inputPath, 'utf8');
    const parser = new LaTeXParser(content, {
      semanticAnalysis: true
    });
    
    const parseResult = parser.parse();
    
    if (parseResult.errors.length > 0) {
      this.emit('parse-warnings', {
        inputPath,
        errors: parseResult.errors,
        warnings: parseResult.warnings
      });
    }
    
    return parseResult;
  }
  
  /**
   * Prepare compilation environment
   */
  async prepareCompilation(inputPath, options) {
    const inputFile = basename(inputPath);
    const inputDir = dirname(resolve(inputPath));
    const nameWithoutExt = basename(inputPath, extname(inputPath));
    
    const tempDir = join(this.config.tempDir, `compile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempInputPath = join(tempDir, inputFile);
    
    // Copy input file to temp directory
    await fs.copyFile(resolve(inputPath), tempInputPath);
    
    // Copy any auxiliary files (images, includes, etc.)
    await this.copyAuxiliaryFiles(inputDir, tempDir);
    
    return {
      inputPath: resolve(inputPath),
      tempDir,
      tempInputPath,
      inputFile,
      nameWithoutExt,
      outputPath: join(this.config.outputDir, `${nameWithoutExt}.pdf`),
      engine: LATEX_ENGINES[options.engine || this.config.engine],
      options
    };
  }
  
  /**
   * Copy auxiliary files that might be needed for compilation
   */
  async copyAuxiliaryFiles(sourceDir, tempDir) {
    const auxiliaryExtensions = ['.bib', '.cls', '.sty', '.bst', '.png', '.jpg', '.jpeg', '.pdf', '.eps'];
    
    try {
      const files = await fs.readdir(sourceDir);
      
      for (const file of files) {
        const ext = extname(file).toLowerCase();
        if (auxiliaryExtensions.includes(ext)) {
          const sourcePath = join(sourceDir, file);
          const targetPath = join(tempDir, file);
          
          const stats = await fs.stat(sourcePath);
          if (stats.isFile()) {
            await fs.copyFile(sourcePath, targetPath);
          }
        }
      }
    } catch (error) {
      // Non-critical error - continue compilation
      this.emit('auxiliary-copy-warning', {
        sourceDir,
        error: error.message
      });
    }
  }
  
  /**
   * Execute the actual compilation
   */
  async executeCompilation(context) {
    if (this.config.docker.enabled) {
      return this.executeDockerCompilation(context);
    } else {
      return this.executeNativeCompilation(context);
    }
  }
  
  /**
   * Execute native LaTeX compilation
   */
  async executeNativeCompilation(context) {
    const { tempDir, tempInputPath, inputFile, engine, options } = context;
    
    const compileArgs = this.buildCompilationArgs(engine, inputFile, options);
    
    return new Promise((resolve, reject) => {
      const process = spawn(engine.command, compileArgs, {
        cwd: tempDir,
        timeout: this.config.maxCompilationTime
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
        if (this.config.verbose) {
          this.emit('compilation-output', data.toString());
        }
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
        if (this.config.verbose) {
          this.emit('compilation-error-output', data.toString());
        }
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            stdout,
            stderr,
            exitCode: code
          });
        } else {
          reject(new Error(`Compilation failed with exit code ${code}\nStderr: ${stderr}`));
        }
      });
      
      process.on('error', (error) => {
        reject(new Error(`Compilation process error: ${error.message}`));
      });
    });
  }
  
  /**
   * Execute Docker-based compilation
   */
  async executeDockerCompilation(context) {
    const { tempDir, inputFile, engine } = context;
    
    const dockerArgs = [
      'run',
      '--rm',
      '-v', `${tempDir}:/workspace`,
      '-w', '/workspace',
      this.config.docker.image,
      engine.command,
      ...this.buildCompilationArgs(engine, inputFile, context.options)
    ];
    
    return new Promise((resolve, reject) => {
      const process = spawn('docker', dockerArgs, {
        timeout: this.config.maxCompilationTime
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
        if (this.config.verbose) {
          this.emit('compilation-output', data.toString());
        }
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            stdout,
            stderr,
            exitCode: code
          });
        } else {
          reject(new Error(`Docker compilation failed with exit code ${code}\nStderr: ${stderr}`));
        }
      });
      
      process.on('error', (error) => {
        reject(new Error(`Docker process error: ${error.message}`));
      });
    });
  }
  
  /**
   * Build compilation arguments
   */
  buildCompilationArgs(engine, inputFile, options) {
    const args = [];
    
    // Basic options
    args.push('-interaction=nonstopmode');
    
    if (this.config.enableSyncTeX) {
      args.push('-synctex=1');
    }
    
    if (this.config.enableShellEscape && !this.config.security.strictMode) {
      args.push('-shell-escape');
    }
    
    // Output directory
    args.push('-output-directory=.');
    
    // Input file
    args.push(inputFile);
    
    return args;
  }
  
  /**
   * Post-process compilation results
   */
  async postProcessCompilation(result, context) {
    const { tempDir, nameWithoutExt, outputPath, options } = context;
    
    // Find generated PDF
    const tempPdfPath = join(tempDir, `${nameWithoutExt}.pdf`);
    
    if (existsSync(tempPdfPath)) {
      // Copy PDF to output directory
      await fs.copyFile(tempPdfPath, outputPath);
      
      // Run BibTeX/Biber if needed
      if (this.config.enableBibtex || this.config.enableBiber) {
        await this.processBibliography(context);
      }
      
      // Run makeindex if needed
      if (this.config.enableMakeIndex) {
        await this.processIndex(context);
      }
      
      // Clean temporary files if configured
      if (this.config.cleanTemp) {
        await this.cleanTempDirectory(tempDir);
      }
      
      return {
        success: true,
        outputPath,
        tempDir: this.config.cleanTemp ? null : tempDir,
        stdout: result.stdout,
        stderr: result.stderr
      };
    } else {
      throw new Error('PDF output file not generated');
    }
  }
  
  /**
   * Process bibliography (BibTeX/Biber)
   */
  async processBibliography(context) {
    const { tempDir, nameWithoutExt } = context;
    const auxPath = join(tempDir, `${nameWithoutExt}.aux`);
    
    if (existsSync(auxPath)) {
      const auxContent = await fs.readFile(auxPath, 'utf8');
      
      // Check if bibliography is needed
      if (auxContent.includes('\\bibdata') || auxContent.includes('\\citation')) {
        const bibTool = this.config.enableBiber ? 'biber' : 'bibtex';
        const bibTarget = this.config.enableBiber ? nameWithoutExt : `${nameWithoutExt}.aux`;
        
        try {
          await this.executeCommand(bibTool, [bibTarget], tempDir);
          // Re-run LaTeX after bibliography processing
          await this.executeNativeCompilation(context);
        } catch (error) {
          this.emit('bibliography-warning', {
            tool: bibTool,
            error: error.message
          });
        }
      }
    }
  }
  
  /**
   * Process index (makeindex)
   */
  async processIndex(context) {
    const { tempDir, nameWithoutExt } = context;
    const idxPath = join(tempDir, `${nameWithoutExt}.idx`);
    
    if (existsSync(idxPath)) {
      try {
        await this.executeCommand('makeindex', [`${nameWithoutExt}.idx`], tempDir);
        // Re-run LaTeX after index processing
        await this.executeNativeCompilation(context);
      } catch (error) {
        this.emit('index-warning', {
          error: error.message
        });
      }
    }
  }
  
  /**
   * Execute a command in a directory
   */
  async executeCommand(command, args, cwd) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, { cwd });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command '${command}' failed with exit code ${code}: ${stderr}`));
        }
      });
      
      process.on('error', (error) => {
        reject(error);
      });
    });
  }
  
  /**
   * Clean temporary directory
   */
  async cleanTempDirectory(tempDir) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      this.emit('cleanup-warning', {
        tempDir,
        error: error.message
      });
    }
  }
  
  /**
   * Update compilation statistics
   */
  updateStatistics(result, startTime) {
    const duration = Date.now() - startTime;
    
    this.statistics.compilations++;
    this.statistics.totalTime += duration;
    this.statistics.averageTime = this.statistics.totalTime / this.statistics.compilations;
    
    if (!result.success) {
      this.statistics.errors++;
    }
  }
  
  /**
   * Start watch mode for automatic compilation
   */
  async startWatchMode(pattern = '**/*.tex', options = {}) {
    if (this.watchMode) {
      throw new Error('Watch mode already active');
    }
    
    const watchOptions = {
      ignoreInitial: true,
      persistent: true,
      ...options
    };
    
    this.watcher = chokidar.watch(pattern, watchOptions);
    this.watchMode = true;
    
    this.watcher.on('change', async (path) => {
      this.emit('file-changed', { path });
      
      try {
        const result = await this.compile(path);
        this.emit('watch-compilation-complete', { path, result });
      } catch (error) {
        this.emit('watch-compilation-error', { path, error: error.message });
      }
    });
    
    this.watcher.on('error', (error) => {
      this.emit('watch-error', { error: error.message });
    });
    
    this.emit('watch-started', { pattern });
  }
  
  /**
   * Stop watch mode
   */
  async stopWatchMode() {
    if (!this.watchMode || !this.watcher) {
      return;
    }
    
    await this.watcher.close();
    this.watcher = null;
    this.watchMode = false;
    
    this.emit('watch-stopped');
  }
  
  /**
   * Get compilation statistics
   */
  getStatistics() {
    return { ...this.statistics };
  }
  
  /**
   * Reset compilation statistics
   */
  resetStatistics() {
    this.statistics = {
      compilations: 0,
      errors: 0,
      warnings: 0,
      totalTime: 0,
      averageTime: 0
    };
  }
  
  /**
   * Get supported engines
   */
  static getSupportedEngines() {
    return Object.entries(LATEX_ENGINES).map(([key, engine]) => ({
      id: key,
      ...engine
    }));
  }
  
  /**
   * Check if an engine is available
   */
  static async isEngineAvailable(engineId) {
    const engine = LATEX_ENGINES[engineId];
    if (!engine) return false;
    
    return new Promise((resolve) => {
      exec(`${engine.command} --version`, (error) => {
        resolve(!error);
      });
    });
  }
}

export default LaTeXCompiler;