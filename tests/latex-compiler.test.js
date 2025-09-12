/**
 * LaTeX Compiler Test Suite
 * Comprehensive tests for LaTeX compilation system
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import LaTeXCompiler from '../src/lib/latex/compiler.js';
import LaTeXConfig from '../src/lib/latex/config.js';
import LaTeXBuildIntegration from '../src/lib/latex/build-integration.js';
import DockerLaTeXSupport from '../src/lib/latex/docker-support.js';

describe('LaTeX Compiler', () => {
  let compiler;
  let testDir;
  
  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'test-temp', this.getDeterministicTimestamp().toString());
    await fs.mkdir(testDir, { recursive: true });
    
    compiler = new LaTeXCompiler({
      outputDir: path.join(testDir, 'dist'),
      tempDir: path.join(testDir, 'temp'),
      verbose: false,
      docker: { enabled: false }
    });
  });

  afterEach(async () => {
    if (compiler) {
      await compiler.cleanup();
    }
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with default config', async () => {
      const result = await compiler.initialize();
      expect(result).toBe(true);
    });

    it('should create necessary directories', async () => {
      await compiler.initialize();
      
      const outputExists = await fs.access(compiler.config.outputDir).then(() => true).catch(() => false);
      const tempExists = await fs.access(compiler.config.tempDir).then(() => true).catch(() => false);
      
      expect(outputExists).toBe(true);
      expect(tempExists).toBe(true);
    });
  });

  describe('Compilation', () => {
    beforeEach(async () => {
      await compiler.initialize();
    });

    it('should validate input file correctly', async () => {
      // Test with non-existent file
      const result = await compiler.compile('non-existent.tex');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid input file');
    });

    it('should handle invalid file extensions', async () => {
      const invalidFile = path.join(testDir, 'test.txt');
      await fs.writeFile(invalidFile, 'not a tex file');
      
      const result = await compiler.compile(invalidFile);
      expect(result.success).toBe(false);
      expect(result.error).toContain('must have .tex extension');
    });

    it('should prepare working directory with related files', async () => {
      const texContent = `
\\documentclass{article}
\\begin{document}
Hello World!
\\end{document}
      `;
      
      const texFile = path.join(testDir, 'test.tex');
      const bibFile = path.join(testDir, 'refs.bib');
      
      await fs.writeFile(texFile, texContent);
      await fs.writeFile(bibFile, '@article{test,title={Test},author={Author},year={2023}}');
      
      const workingDir = await compiler.prepareWorkingDirectory(texFile, compiler.config);
      
      const texExists = await fs.access(path.join(workingDir, 'test.tex')).then(() => true).catch(() => false);
      const bibExists = await fs.access(path.join(workingDir, 'refs.bib')).then(() => true).catch(() => false);
      
      expect(texExists).toBe(true);
      expect(bibExists).toBe(true);
    });
  });

  describe('Engine Support', () => {
    it('should support pdflatex engine', () => {
      const engineConfig = compiler.config.engines.pdflatex;
      expect(engineConfig).toBeDefined();
      expect(engineConfig.command).toBe('pdflatex');
    });

    it('should support xelatex engine', () => {
      const engineConfig = compiler.config.engines.xelatex;
      expect(engineConfig).toBeDefined();
      expect(engineConfig.command).toBe('xelatex');
    });

    it('should support lualatex engine', () => {
      const engineConfig = compiler.config.engines.lualatex;
      expect(engineConfig).toBeDefined();
      expect(engineConfig.command).toBe('lualatex');
    });

    it('should reject unsupported engines', async () => {
      const invalidCompiler = new LaTeXCompiler({
        engine: 'invalid-engine',
        outputDir: path.join(testDir, 'dist'),
        tempDir: path.join(testDir, 'temp')
      });
      
      await expect(invalidCompiler.initialize()).rejects.toThrow('Unsupported LaTeX engine');
    });
  });

  describe('Bibliography Detection', () => {
    beforeEach(async () => {
      await compiler.initialize();
    });

    it('should detect bibliography requirements', async () => {
      const auxContent = `
\\relax
\\bibdata{references}
\\citation{test2023}
      `;
      
      const workingDir = path.join(testDir, 'working');
      await fs.mkdir(workingDir, { recursive: true });
      await fs.writeFile(path.join(workingDir, 'test.aux'), auxContent);
      
      const requiresBib = await compiler.requiresBibliography(workingDir, 'test');
      expect(requiresBib).toBe(true);
    });

    it('should detect biber references', async () => {
      const auxContent = `
\\relax
\\abx@aux@read@bbl@mdfivesum{nobblfile}
\\refsection{0}
      `;
      
      const workingDir = path.join(testDir, 'working');
      await fs.mkdir(workingDir, { recursive: true });
      await fs.writeFile(path.join(workingDir, 'test.aux'), auxContent);
      
      const hasBiber = await compiler.hasBiberReferences(workingDir, 'test');
      expect(hasBiber).toBe(true);
    });
  });

  describe('Watch Mode', () => {
    beforeEach(async () => {
      await compiler.initialize();
    });

    it('should start watch mode successfully', async () => {
      const texContent = `
\\documentclass{article}
\\begin{document}
Test document
\\end{document}
      `;
      
      const texFile = path.join(testDir, 'watch-test.tex');
      await fs.writeFile(texFile, texContent);
      
      // Mock the compilation to avoid actual LaTeX execution
      const originalCompile = compiler.compile;
      compiler.compile = vi.fn().mockResolvedValue({ success: true, duration: 100 });
      
      await compiler.startWatchMode(texFile);
      expect(compiler.isWatching).toBe(true);
      
      await compiler.stopWatchMode();
      expect(compiler.isWatching).toBe(false);
      
      compiler.compile = originalCompile;
    });
  });

  describe('Metrics', () => {
    it('should track compilation metrics', () => {
      const metrics = compiler.getMetrics();
      expect(metrics).toHaveProperty('compilations');
      expect(metrics).toHaveProperty('errors');
      expect(metrics).toHaveProperty('warnings');
      expect(metrics).toHaveProperty('totalTime');
      expect(metrics).toHaveProperty('averageTime');
    });

    it('should reset metrics correctly', () => {
      compiler.metrics.compilations = 5;
      compiler.metrics.errors = 2;
      
      compiler.resetMetrics();
      
      const metrics = compiler.getMetrics();
      expect(metrics.compilations).toBe(0);
      expect(metrics.errors).toBe(0);
    });
  });
});

describe('LaTeX Config', () => {
  let config;

  beforeEach(() => {
    config = new LaTeXConfig();
  });

  describe('Configuration Loading', () => {
    it('should provide default configuration', async () => {
      const defaultConfig = await config.load();
      expect(defaultConfig).toHaveProperty('engine');
      expect(defaultConfig).toHaveProperty('outputDir');
      expect(defaultConfig).toHaveProperty('tempDir');
      expect(defaultConfig.engine).toBe('pdflatex');
    });

    it('should validate configuration correctly', () => {
      const validConfig = {
        engine: 'pdflatex',
        outputDir: './dist',
        tempDir: './temp',
        timeout: 30000
      };
      
      const validated = config.validateConfig(validConfig);
      expect(validated.engine).toBe('pdflatex');
      expect(validated.timeout).toBe(30000);
    });

    it('should reject invalid engines', () => {
      const invalidConfig = {
        engine: 'invalid-engine',
        outputDir: './dist',
        tempDir: './temp'
      };
      
      expect(() => config.validateConfig(invalidConfig)).toThrow('Unsupported LaTeX engine');
    });
  });

  describe('Engine Management', () => {
    it('should list available engines', () => {
      const engines = config.listEngines();
      expect(engines).toBeInstanceOf(Array);
      expect(engines.length).toBeGreaterThan(0);
      
      const engineNames = engines.map(e => e.name);
      expect(engineNames).toContain('pdflatex');
      expect(engineNames).toContain('xelatex');
      expect(engineNames).toContain('lualatex');
    });

    it('should provide engine information', () => {
      const engineInfo = config.getEngineInfo('pdflatex');
      expect(engineInfo).toHaveProperty('command');
      expect(engineInfo).toHaveProperty('description');
      expect(engineInfo.command).toBe('pdflatex');
    });
  });

  describe('Docker Presets', () => {
    it('should provide Docker presets', () => {
      const presets = config.getDockerPresets();
      expect(presets).toHaveProperty('minimal');
      expect(presets).toHaveProperty('basic');
      expect(presets).toHaveProperty('full');
      expect(presets.full.image).toBe('texlive/texlive:latest');
    });
  });
});

describe('LaTeX Build Integration', () => {
  let integration;
  let testDir;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'test-temp-integration', this.getDeterministicTimestamp().toString());
    await fs.mkdir(testDir, { recursive: true });
    
    integration = new LaTeXBuildIntegration({
      outputDir: path.join(testDir, 'dist'),
      configPath: null
    });
  });

  afterEach(async () => {
    if (integration) {
      await integration.cleanup();
    }
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Document Discovery', () => {
    it('should find LaTeX documents', async () => {
      const texContent = `
\\documentclass{article}
\\begin{document}
Test
\\end{document}
      `;
      
      // Create test documents
      await fs.mkdir(path.join(testDir, 'docs'), { recursive: true });
      await fs.writeFile(path.join(testDir, 'docs', 'main.tex'), texContent);
      await fs.writeFile(path.join(testDir, 'docs', 'include.tex'), '% include file'); // Should be filtered out
      
      // Change to test directory for glob to work
      const originalCwd = process.cwd();
      process.chdir(testDir);
      
      try {
        const documents = await integration.findLatexDocuments();
        expect(documents.length).toBe(1);
        expect(documents[0]).toContain('main.tex');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Build System Integration', () => {
    it('should create build system hook', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);
      
      try {
        await fs.mkdir('scripts', { recursive: true });
        await integration.createBuildSystemHook();
        
        const hookExists = await fs.access(path.join(testDir, 'scripts', 'latex-build-hook.js'))
          .then(() => true).catch(() => false);
        
        expect(hookExists).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});

describe('Docker LaTeX Support', () => {
  let dockerSupport;

  beforeEach(() => {
    dockerSupport = new DockerLaTeXSupport({
      image: 'texlive/texlive:latest',
      pullPolicy: 'never' // Don't actually pull during tests
    });
  });

  describe('Container Configuration', () => {
    it('should build container arguments correctly', () => {
      const args = dockerSupport.buildContainerArgs('/workspace', {
        enableNetwork: false,
        extraArgs: ['--read-only']
      });
      
      expect(args).toContain('--rm');
      expect(args).toContain('--user');
      expect(args).toContain('--network');
      expect(args).toContain('none');
      expect(args).toContain('--read-only');
    });

    it('should handle volume mounts', () => {
      dockerSupport.config.volumes = {
        './src': '/workspace/src',
        './assets': '/workspace/assets'
      };
      
      const args = dockerSupport.buildContainerArgs('/workspace');
      
      const volumeArgs = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-v') {
          volumeArgs.push(args[i + 1]);
        }
      }
      
      expect(volumeArgs.some(v => v.includes('/workspace/src'))).toBe(true);
      expect(volumeArgs.some(v => v.includes('/workspace/assets'))).toBe(true);
    });
  });

  describe('Dockerfile Generation', () => {
    it('should generate valid Dockerfile', async () => {
      const testDir = path.join(process.cwd(), 'test-temp-docker', this.getDeterministicTimestamp().toString());
      await fs.mkdir(testDir, { recursive: true });
      
      try {
        const dockerfilePath = path.join(testDir, 'Dockerfile');
        await dockerSupport.generateDockerfile(dockerfilePath, {
          baseImage: 'texlive/texlive:basic',
          packages: ['curl', 'wget'],
          latexPackages: ['amsmath', 'graphicx']
        });
        
        const content = await fs.readFile(dockerfilePath, 'utf8');
        expect(content).toContain('FROM texlive/texlive:basic');
        expect(content).toContain('curl wget');
        expect(content).toContain('tlmgr install');
        expect(content).toContain('amsmath');
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
  });

  describe('Docker Compose Generation', () => {
    it('should generate docker-compose.yml', async () => {
      const testDir = path.join(process.cwd(), 'test-temp-compose', this.getDeterministicTimestamp().toString());
      await fs.mkdir(testDir, { recursive: true });
      
      try {
        const composePath = path.join(testDir, 'docker-compose.yml');
        await dockerSupport.generateDockerCompose(composePath, {
          command: 'sleep infinity'
        });
        
        const content = await fs.readFile(composePath, 'utf8');
        expect(content).toContain('version:');
        expect(content).toContain('services:');
        expect(content).toContain('latex:');
        expect(content).toContain('sleep infinity');
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
  });
});

describe('Integration Tests', () => {
  describe('End-to-End LaTeX Compilation', () => {
    it('should handle complete compilation workflow', async () => {
      const testDir = path.join(process.cwd(), 'test-temp-e2e', this.getDeterministicTimestamp().toString());
      await fs.mkdir(testDir, { recursive: true });
      
      try {
        // Create a simple LaTeX document
        const texContent = `
\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\title{Test Document}
\\author{Test Author}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Introduction}
This is a test document for the LaTeX compiler system.

\\section{Features}
\\begin{itemize}
\\item Multi-engine support
\\item Bibliography compilation
\\item Watch mode
\\item Docker integration
\\end{itemize}

\\end{document}
        `;
        
        const texFile = path.join(testDir, 'test.tex');
        await fs.writeFile(texFile, texContent);
        
        // Mock compiler to avoid actual LaTeX execution
        const compiler = new LaTeXCompiler({
          outputDir: path.join(testDir, 'dist'),
          tempDir: path.join(testDir, 'temp'),
          docker: { enabled: false }
        });
        
        // Mock the actual compilation process
        const originalRunLatexEngine = compiler.runLatexEngine;
        compiler.runLatexEngine = vi.fn().mockResolvedValue({
          success: true,
          logs: [],
          warnings: []
        });
        
        const originalCopyOutput = compiler.copyOutput;
        compiler.copyOutput = vi.fn().mockResolvedValue();
        
        await compiler.initialize();
        const result = await compiler.compile(texFile);
        
        expect(result.success).toBe(true);
        expect(result).toHaveProperty('duration');
        expect(result).toHaveProperty('compilationId');
        
        // Restore original methods
        compiler.runLatexEngine = originalRunLatexEngine;
        compiler.copyOutput = originalCopyOutput;
        
        await compiler.cleanup();
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
  });
});