/**
 * LaTeX Production Readiness Test Suite
 * Comprehensive testing for LaTeX command functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { latexCommand } from '../src/commands/latex.js';

// Mock dependencies
vi.mock('consola');
vi.mock('../src/lib/latex/compiler.js');
vi.mock('../src/lib/latex/config.js');
vi.mock('../src/lib/latex/build-integration.js');
vi.mock('../src/lib/latex/docker-support.js');
vi.mock('../src/lib/latex/template-generator.js');

describe('LaTeX Command Production Readiness', () => {
  let testDir;
  let originalCwd;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = path.join(process.cwd(), 'test-latex-temp');
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('Command Structure', () => {
    it('should have correct command metadata', () => {
      expect(latexCommand.meta.name).toBe('latex');
      expect(latexCommand.meta.description).toContain('LaTeX document generation');
      expect(latexCommand.subCommands).toBeDefined();
    });

    it('should have all required subcommands', () => {
      const expectedSubcommands = [
        'compile', 'build', 'watch', 'generate', 
        'init', 'docker', 'config', 'clean', 'metrics'
      ];
      
      for (const subcmd of expectedSubcommands) {
        expect(latexCommand.subCommands[subcmd]).toBeDefined();
      }
    });
  });

  describe('Compile Command', () => {
    const compileCmd = latexCommand.subCommands.compile;

    it('should have correct argument definitions', () => {
      expect(compileCmd.args.input.required).toBe(true);
      expect(compileCmd.args.engine.default).toBe('pdflatex');
      expect(compileCmd.args.output.default).toBe('./dist/latex');
      expect(compileCmd.args.watch.type).toBe('boolean');
      expect(compileCmd.args.docker.type).toBe('boolean');
    });

    it('should validate required input argument', async () => {
      const result = await compileCmd.run({ args: {} });
      expect(result.success).toBe(false);
      expect(result.error).toContain('input');
    });

    it('should handle valid compilation request', async () => {
      const mockCompiler = {
        initialize: vi.fn().mockResolvedValue(undefined),
        compile: vi.fn().mockResolvedValue({
          success: true,
          outputPath: '/test/output.pdf',
          duration: 1500
        })
      };

      const { LaTeXCompiler } = await import('../src/lib/latex/compiler.js');
      LaTeXCompiler.mockImplementation(() => mockCompiler);

      const result = await compileCmd.run({
        args: { input: 'test.tex', engine: 'xelatex' }
      });

      expect(result.success).toBe(true);
      expect(result.outputPath).toBe('/test/output.pdf');
    });

    it('should handle compilation errors gracefully', async () => {
      const mockCompiler = {
        initialize: vi.fn().mockResolvedValue(undefined),
        compile: vi.fn().mockResolvedValue({
          success: false,
          error: 'LaTeX Error: File not found'
        })
      };

      const { LaTeXCompiler } = await import('../src/lib/latex/compiler.js');
      LaTeXCompiler.mockImplementation(() => mockCompiler);

      const result = await compileCmd.run({
        args: { input: 'nonexistent.tex' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('should support watch mode', async () => {
      const mockCompiler = {
        initialize: vi.fn().mockResolvedValue(undefined),
        startWatchMode: vi.fn().mockResolvedValue(undefined),
        stopWatchMode: vi.fn().mockResolvedValue(undefined)
      };

      const { LaTeXCompiler } = await import('../src/lib/latex/compiler.js');
      LaTeXCompiler.mockImplementation(() => mockCompiler);

      // Mock process.on to prevent hanging
      const originalOn = process.on;
      process.on = vi.fn();

      const result = await compileCmd.run({
        args: { input: 'test.tex', watch: true }
      });

      expect(mockCompiler.startWatchMode).toHaveBeenCalledWith('test.tex');
      process.on = originalOn;
    });
  });

  describe('Generate Command', () => {
    const generateCmd = latexCommand.subCommands.generate;

    it('should require template argument', () => {
      expect(generateCmd.args.template.required).toBe(true);
    });

    it('should have proper argument defaults', () => {
      expect(generateCmd.args.output.default).toBe('document.tex');
      expect(generateCmd.args.bibliography.default).toBe(false);
      expect(generateCmd.args.interactive.default).toBe(false);
    });

    it('should generate template with basic parameters', async () => {
      const mockGenerator = {
        generateTemplate: vi.fn().mockReturnValue('\\documentclass{article}\\begin{document}Test\\end{document}'),
        generateBibliography: vi.fn().mockReturnValue('@article{test,title={Test}}')
      };

      vi.doMock('../src/lib/latex/template-generator.js', () => ({
        LaTeXTemplateGenerator: vi.fn(() => mockGenerator)
      }));

      const result = await generateCmd.run({
        args: {
          template: 'article',
          title: 'Test Document',
          author: 'Test Author',
          output: 'test.tex'
        }
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('test.tex');
    });

    it('should handle bibliography generation', async () => {
      const mockGenerator = {
        generateTemplate: vi.fn().mockReturnValue('\\documentclass{article}'),
        generateBibliography: vi.fn().mockReturnValue('@article{test,title={Test}}')
      };

      vi.doMock('../src/lib/latex/template-generator.js', () => ({
        LaTeXTemplateGenerator: vi.fn(() => mockGenerator)
      }));

      const result = await generateCmd.run({
        args: {
          template: 'article',
          bibliography: true,
          output: 'test.tex'
        }
      });

      expect(mockGenerator.generateBibliography).toHaveBeenCalled();
    });

    it('should parse packages correctly', async () => {
      const mockGenerator = {
        generateTemplate: vi.fn().mockReturnValue('\\documentclass{article}')
      };

      vi.doMock('../src/lib/latex/template-generator.js', () => ({
        LaTeXTemplateGenerator: vi.fn(() => mockGenerator)
      }));

      await generateCmd.run({
        args: {
          template: 'article',
          packages: 'graphicx,amsmath,hyperref',
          output: 'test.tex'
        }
      });

      expect(mockGenerator.generateTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          packages: ['graphicx', 'amsmath', 'hyperref']
        })
      );
    });
  });

  describe('Build Command', () => {
    const buildCmd = latexCommand.subCommands.build;

    it('should have proper defaults', () => {
      expect(buildCmd.args.output.default).toBe('./dist/latex');
      expect(buildCmd.args.engine.default).toBe('pdflatex');
      expect(buildCmd.args.concurrency.default).toBe(2);
      expect(buildCmd.args.docker.default).toBe(false);
    });

    it('should handle successful build', async () => {
      const mockIntegration = {
        initialize: vi.fn().mockResolvedValue(undefined),
        buildAllDocuments: vi.fn().mockResolvedValue({
          success: true,
          successful: 3,
          failed: 0,
          total: 3
        })
      };

      const { default: LaTeXBuildIntegration } = await import('../src/lib/latex/build-integration.js');
      LaTeXBuildIntegration.mockImplementation(() => mockIntegration);

      const result = await buildCmd.run({
        args: { concurrency: 4, engine: 'xelatex' }
      });

      expect(result.success).toBe(true);
      expect(result.successful).toBe(3);
    });

    it('should handle build failures', async () => {
      const mockIntegration = {
        initialize: vi.fn().mockResolvedValue(undefined),
        buildAllDocuments: vi.fn().mockResolvedValue({
          success: false,
          successful: 1,
          failed: 2,
          total: 3
        })
      };

      const { default: LaTeXBuildIntegration } = await import('../src/lib/latex/build-integration.js');
      LaTeXBuildIntegration.mockImplementation(() => mockIntegration);

      const result = await buildCmd.run({ args: {} });

      expect(result.success).toBe(false);
      expect(result.failed).toBe(2);
      expect(result.total).toBe(3);
    });
  });

  describe('Init Command', () => {
    const initCmd = latexCommand.subCommands.init;

    it('should have proper argument defaults', () => {
      expect(initCmd.args.docker.default).toBe(false);
      expect(initCmd.args.config.default).toBe(true);
      expect(initCmd.args.scripts.default).toBe(true);
    });

    it('should initialize project successfully', async () => {
      const mockIntegration = {
        generateBuildConfig: vi.fn().mockResolvedValue(undefined),
        addPackageScripts: vi.fn().mockResolvedValue(undefined),
        integrateWithBuildSystem: vi.fn().mockResolvedValue(undefined)
      };

      const { default: LaTeXBuildIntegration } = await import('../src/lib/latex/build-integration.js');
      LaTeXBuildIntegration.mockImplementation(() => mockIntegration);

      const result = await initCmd.run({
        args: { config: true, scripts: true, docker: false }
      });

      expect(result.success).toBe(true);
      expect(mockIntegration.generateBuildConfig).toHaveBeenCalled();
      expect(mockIntegration.addPackageScripts).toHaveBeenCalled();
    });

    it('should setup Docker when requested', async () => {
      const mockIntegration = {
        generateBuildConfig: vi.fn().mockResolvedValue(undefined),
        addPackageScripts: vi.fn().mockResolvedValue(undefined),
        integrateWithBuildSystem: vi.fn().mockResolvedValue(undefined)
      };

      const mockDockerSupport = {
        generateDockerfile: vi.fn().mockResolvedValue(undefined),
        generateDockerCompose: vi.fn().mockResolvedValue(undefined)
      };

      const { default: LaTeXBuildIntegration } = await import('../src/lib/latex/build-integration.js');
      const { DockerLaTeXSupport } = await import('../src/lib/latex/docker-support.js');
      
      LaTeXBuildIntegration.mockImplementation(() => mockIntegration);
      DockerLaTeXSupport.mockImplementation(() => mockDockerSupport);

      const result = await initCmd.run({
        args: { docker: true }
      });

      expect(result.success).toBe(true);
      expect(mockDockerSupport.generateDockerfile).toHaveBeenCalled();
      expect(mockDockerSupport.generateDockerCompose).toHaveBeenCalled();
    });

    it('should create required directories', async () => {
      const mockIntegration = {
        generateBuildConfig: vi.fn().mockResolvedValue(undefined),
        addPackageScripts: vi.fn().mockResolvedValue(undefined),
        integrateWithBuildSystem: vi.fn().mockResolvedValue(undefined)
      };

      const { default: LaTeXBuildIntegration } = await import('../src/lib/latex/build-integration.js');
      LaTeXBuildIntegration.mockImplementation(() => mockIntegration);

      await initCmd.run({ args: {} });

      // Check directories were created
      expect(await fs.access('./dist/latex')).resolves.toBeUndefined();
      expect(await fs.access('./temp/latex')).resolves.toBeUndefined();
    });
  });

  describe('Configuration Management', () => {
    const configCmd = latexCommand.subCommands.config;

    it('should have create and engines subcommands', () => {
      expect(configCmd.subCommands.create).toBeDefined();
      expect(configCmd.subCommands.engines).toBeDefined();
    });

    it('should create configuration template', async () => {
      const mockConfig = {
        createTemplate: vi.fn().mockResolvedValue(undefined)
      };

      const { LaTeXConfig } = await import('../src/lib/latex/config.js');
      LaTeXConfig.mockImplementation(() => mockConfig);

      const result = await configCmd.subCommands.create.run({
        args: { output: './test-config.js' }
      });

      expect(result.success).toBe(true);
      expect(mockConfig.createTemplate).toHaveBeenCalledWith('./test-config.js');
    });

    it('should list available engines', async () => {
      const mockEngines = [
        { name: 'pdflatex', description: 'Default LaTeX engine', command: 'pdflatex' },
        { name: 'xelatex', description: 'XeLaTeX engine', command: 'xelatex' },
        { name: 'lualatex', description: 'LuaLaTeX engine', command: 'lualatex' }
      ];

      const mockConfig = {
        listEngines: vi.fn().mockReturnValue(mockEngines)
      };

      const { LaTeXConfig } = await import('../src/lib/latex/config.js');
      LaTeXConfig.mockImplementation(() => mockConfig);

      const result = await configCmd.subCommands.engines.run();

      expect(result.success).toBe(true);
      expect(result.engines).toEqual(mockEngines);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing dependencies gracefully', async () => {
      // Mock import failure
      vi.doMock('../src/lib/latex/compiler.js', () => {
        throw new Error('Module not found');
      });

      const result = await latexCommand.subCommands.compile.run({
        args: { input: 'test.tex' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle file system errors', async () => {
      const mockCompiler = {
        initialize: vi.fn().mockRejectedValue(new Error('Permission denied')),
      };

      const { LaTeXCompiler } = await import('../src/lib/latex/compiler.js');
      LaTeXCompiler.mockImplementation(() => mockCompiler);

      const result = await latexCommand.subCommands.compile.run({
        args: { input: 'test.tex' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });
  });

  describe('Docker Integration', () => {
    const dockerCmd = latexCommand.subCommands.docker;

    it('should have setup and build subcommands', () => {
      expect(dockerCmd.subCommands.setup).toBeDefined();
      expect(dockerCmd.subCommands.build).toBeDefined();
    });

    it('should setup Docker environment', async () => {
      const mockDockerSupport = {
        setup: vi.fn().mockResolvedValue(undefined)
      };

      const { DockerLaTeXSupport } = await import('../src/lib/latex/docker-support.js');
      DockerLaTeXSupport.mockImplementation(() => mockDockerSupport);

      const result = await dockerCmd.subCommands.setup.run({
        args: { image: 'texlive/texlive:latest', pull: true }
      });

      expect(result.success).toBe(true);
      expect(result.image).toBe('texlive/texlive:latest');
    });

    it('should build custom Docker image', async () => {
      const mockDockerSupport = {
        buildImage: vi.fn().mockResolvedValue('custom-latex:latest')
      };

      const { DockerLaTeXSupport } = await import('../src/lib/latex/docker-support.js');
      DockerLaTeXSupport.mockImplementation(() => mockDockerSupport);

      const result = await dockerCmd.subCommands.build.run({
        args: { name: 'custom-latex', dockerfile: './Dockerfile.custom' }
      });

      expect(result.success).toBe(true);
      expect(result.image).toBe('custom-latex:latest');
    });
  });

  describe('Clean Command', () => {
    const cleanCmd = latexCommand.subCommands.clean;

    it('should clean temporary files by default', async () => {
      const mockIntegration = {
        cleanup: vi.fn().mockResolvedValue(undefined)
      };

      const { default: LaTeXBuildIntegration } = await import('../src/lib/latex/build-integration.js');
      LaTeXBuildIntegration.mockImplementation(() => mockIntegration);

      const result = await cleanCmd.run({
        args: { all: false }
      });

      expect(result.success).toBe(true);
      expect(result.cleaned).toBe('temp');
    });

    it('should clean all artifacts when requested', async () => {
      const mockIntegration = {
        cleanup: vi.fn().mockResolvedValue(undefined)
      };

      const { default: LaTeXBuildIntegration } = await import('../src/lib/latex/build-integration.js');
      LaTeXBuildIntegration.mockImplementation(() => mockIntegration);

      const result = await cleanCmd.run({
        args: { all: true }
      });

      expect(result.success).toBe(true);
      expect(result.cleaned).toBe('all');
    });
  });

  describe('Metrics Command', () => {
    const metricsCmd = latexCommand.subCommands.metrics;

    it('should return compilation metrics', async () => {
      const mockMetrics = {
        compiler: {
          compilations: 15,
          errors: 2,
          warnings: 8,
          averageTime: 1250,
          totalTime: 18750
        }
      };

      const mockIntegration = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getMetrics: vi.fn().mockReturnValue(mockMetrics)
      };

      const { default: LaTeXBuildIntegration } = await import('../src/lib/latex/build-integration.js');
      LaTeXBuildIntegration.mockImplementation(() => mockIntegration);

      const result = await metricsCmd.run();

      expect(result.success).toBe(true);
      expect(result.metrics).toEqual(mockMetrics);
    });
  });
});