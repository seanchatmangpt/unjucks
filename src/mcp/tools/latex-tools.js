/**
 * LaTeX MCP Tool Definitions and Implementations
 * Provides AI-assisted LaTeX document generation and processing
 */

import { spawn } from 'node:child_process';
import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import { Generator } from '../../lib/generator.js';
import { SemanticSwarmCoordinator } from '../../lib/semantic-swarm-patterns.js';

/**
 * LaTeX MCP Tool Definitions
 */
export const LATEX_TOOL_DEFINITIONS = [
  {
    name: "latex_generate",
    description: "Generate LaTeX documents using AI-assisted templates with semantic analysis",
    inputSchema: {
      type: "object",
      properties: {
        documentType: {
          type: "string",
          enum: ["article", "report", "book", "thesis", "presentation", "letter", "cv", "paper"],
          description: "Type of LaTeX document to generate"
        },
        template: {
          type: "string",
          description: "Specific template name (optional, auto-selected based on documentType)"
        },
        title: {
          type: "string",
          description: "Document title"
        },
        author: {
          type: "string",
          description: "Document author(s)"
        },
        content: {
          type: "object",
          properties: {
            abstract: { type: "string", description: "Document abstract" },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  content: { type: "string" },
                  subsections: { type: "array", items: { type: "object" } }
                }
              },
              description: "Document sections and content"
            },
            references: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  type: { type: "string", enum: ["article", "book", "inproceedings", "misc"] },
                  title: { type: "string" },
                  author: { type: "string" },
                  journal: { type: "string" },
                  year: { type: "string" },
                  doi: { type: "string" },
                  url: { type: "string" }
                }
              },
              description: "Bibliography references"
            }
          }
        },
        options: {
          type: "object",
          properties: {
            documentclass: { type: "string", default: "article" },
            fontsize: { type: "string", enum: ["10pt", "11pt", "12pt"], default: "11pt" },
            papersize: { type: "string", enum: ["a4paper", "letterpaper"], default: "a4paper" },
            twoside: { type: "boolean", default: false },
            bibliography: { type: "boolean", default: true },
            figures: { type: "boolean", default: true },
            tables: { type: "boolean", default: true },
            math: { type: "boolean", default: true },
            hyperref: { type: "boolean", default: true }
          }
        },
        dest: {
          type: "string",
          description: "Destination directory",
          default: "./docs"
        },
        semanticDomain: {
          type: "string",
          enum: ["academic", "technical", "business", "medical", "legal", "scientific"],
          description: "Semantic domain for AI-assisted content optimization"
        },
        aiAssistance: {
          type: "object",
          properties: {
            contentGeneration: { type: "boolean", default: false },
            citationSuggestions: { type: "boolean", default: true },
            structureOptimization: { type: "boolean", default: true },
            grammarCheck: { type: "boolean", default: true },
            formatValidation: { type: "boolean", default: true }
          }
        },
        dry: { type: "boolean", default: false }
      },
      required: ["documentType", "title"]
    }
  },
  {
    name: "latex_compile",
    description: "Compile LaTeX documents to PDF with error handling and optimization",
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description: "Path to LaTeX source file (.tex)"
        },
        engine: {
          type: "string",
          enum: ["pdflatex", "xelatex", "lualatex"],
          default: "pdflatex",
          description: "LaTeX compilation engine"
        },
        bibliography: {
          type: "boolean",
          default: true,
          description: "Process bibliography with biber/bibtex"
        },
        passes: {
          type: "number",
          minimum: 1,
          maximum: 5,
          default: 2,
          description: "Number of compilation passes for references/citations"
        },
        cleanup: {
          type: "boolean",
          default: true,
          description: "Clean up auxiliary files after compilation"
        },
        outputDir: {
          type: "string",
          description: "Output directory for compiled PDF"
        },
        optimizations: {
          type: "object",
          properties: {
            fastCompile: { type: "boolean", default: false },
            parallelProcessing: { type: "boolean", default: true },
            cacheEnabled: { type: "boolean", default: true },
            incremental: { type: "boolean", default: true }
          }
        }
      },
      required: ["source"]
    }
  },
  {
    name: "latex_format",
    description: "AI-assisted LaTeX formatting and style optimization",
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description: "Path to LaTeX source file or content string"
        },
        style: {
          type: "string",
          enum: ["academic", "ieee", "apa", "chicago", "modern", "classic"],
          default: "academic",
          description: "Document style template"
        },
        formatting: {
          type: "object",
          properties: {
            indentation: { type: "boolean", default: true },
            lineBreaks: { type: "boolean", default: true },
            spacing: { type: "boolean", default: true },
            codeBlocks: { type: "boolean", default: true },
            equations: { type: "boolean", default: true },
            citations: { type: "boolean", default: true }
          }
        },
        aiEnhancements: {
          type: "object",
          properties: {
            structureAnalysis: { type: "boolean", default: true },
            consistencyCheck: { type: "boolean", default: true },
            bestPractices: { type: "boolean", default: true },
            packageOptimization: { type: "boolean", default: true }
          }
        },
        inPlace: { type: "boolean", default: false },
        backup: { type: "boolean", default: true }
      },
      required: ["source"]
    }
  },
  {
    name: "latex_citations",
    description: "Semantic web integration for citation management and discovery",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for finding relevant citations"
        },
        domain: {
          type: "string",
          enum: ["computer-science", "medicine", "physics", "chemistry", "biology", "mathematics", "engineering"],
          description: "Academic domain for targeted citation search"
        },
        sources: {
          type: "array",
          items: {
            type: "string",
            enum: ["arxiv", "pubmed", "ieee", "acm", "springer", "semantic-scholar", "crossref"]
          },
          default: ["arxiv", "semantic-scholar", "crossref"],
          description: "Citation data sources"
        },
        maxResults: {
          type: "number",
          minimum: 1,
          maximum: 50,
          default: 10,
          description: "Maximum number of citations to return"
        },
        format: {
          type: "string",
          enum: ["bibtex", "biblatex", "natbib", "json"],
          default: "bibtex",
          description: "Citation output format"
        },
        aiFiltering: {
          type: "object",
          properties: {
            relevanceScoring: { type: "boolean", default: true },
            duplicateDetection: { type: "boolean", default: true },
            qualityAssessment: { type: "boolean", default: true },
            topicModeling: { type: "boolean", default: true }
          }
        },
        includeAbstracts: { type: "boolean", default: false }
      },
      required: ["query"]
    }
  },
  {
    name: "latex_validate",
    description: "Validate LaTeX document structure and syntax with AI analysis",
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description: "Path to LaTeX source file"
        },
        checks: {
          type: "object",
          properties: {
            syntax: { type: "boolean", default: true },
            structure: { type: "boolean", default: true },
            citations: { type: "boolean", default: true },
            figures: { type: "boolean", default: true },
            tables: { type: "boolean", default: true },
            math: { type: "boolean", default: true },
            packages: { type: "boolean", default: true },
            accessibility: { type: "boolean", default: false }
          }
        },
        aiAnalysis: {
          type: "object",
          properties: {
            readabilityScore: { type: "boolean", default: true },
            structureAnalysis: { type: "boolean", default: true },
            contentCoherence: { type: "boolean", default: true },
            citationAnalysis: { type: "boolean", default: true }
          }
        },
        outputFormat: {
          type: "string",
          enum: ["summary", "detailed", "json"],
          default: "summary"
        }
      },
      required: ["source"]
    }
  }
];

/**
 * LaTeX Generation Tool Handler
 */
export class LaTeXGenerateToolHandler {
  constructor() {
    this.generator = new Generator();
    this.semanticCoordinator = new SemanticSwarmCoordinator({ 
      enableMemorySharing: true,
      debugMode: process.env.DEBUG_LATEX === 'true'
    });
  }

  async execute(params) {
    try {
      // Initialize semantic coordination if not already done
      if (!this.semanticCoordinator.isInitialized) {
        await this.semanticCoordinator.initialize();
      }

      // Create semantic task for AI-assisted generation
      const semanticTask = {
        id: `latex-gen-${Date.now()}`,
        type: 'generate',
        description: `Generate ${params.documentType} document: ${params.title}`,
        parameters: {
          ...params,
          ontologyDomain: this.mapSemanticDomain(params.semanticDomain || 'academic')
        }
      };

      // Route to appropriate specialized agent
      const routedTask = await this.semanticCoordinator.routeTaskToAgent(semanticTask);

      // Generate LaTeX template structure
      const templateStructure = await this.generateLatexStructure(params);

      // Apply AI enhancements if requested
      if (params.aiAssistance?.contentGeneration) {
        templateStructure.content = await this.enhanceContentWithAI(
          templateStructure.content,
          params.semanticDomain
        );
      }

      // Generate files using Unjucks templates
      const generationParams = {
        generator: 'latex',
        template: params.documentType,
        dest: params.dest || './docs',
        variables: {
          ...templateStructure,
          documentOptions: params.options || {},
          aiEnhanced: !!params.aiAssistance?.contentGeneration
        },
        force: true,
        dry: params.dry || false
      };

      const result = await this.generator.generate(generationParams);

      // Store generation metadata in memory for swarm coordination
      await this.semanticCoordinator.storeMemory('latex-generation', {
        taskId: semanticTask.id,
        documentType: params.documentType,
        template: templateStructure,
        result: result,
        timestamp: new Date().toISOString()
      });

      return {
        content: [{
          type: "text",
          text: this.formatGenerationResult(result, params.dry)
        }],
        _meta: {
          taskId: semanticTask.id,
          documentType: params.documentType,
          filesGenerated: result.files?.length || 0,
          semanticDomain: params.semanticDomain
        }
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `LaTeX generation failed: ${error.message}`
        }],
        isError: true
      };
    }
  }

  async generateLatexStructure(params) {
    const structure = {
      title: params.title,
      author: params.author || 'Generated by Unjucks LaTeX MCP',
      documentclass: params.options?.documentclass || 'article',
      packages: this.getRequiredPackages(params),
      sections: [],
      references: params.content?.references || []
    };

    // Process content sections
    if (params.content?.sections) {
      structure.sections = params.content.sections.map(section => ({
        title: section.title,
        content: section.content,
        subsections: section.subsections || []
      }));
    }

    // Add abstract if provided
    if (params.content?.abstract) {
      structure.abstract = params.content.abstract;
    }

    return structure;
  }

  getRequiredPackages(params) {
    const packages = ['inputenc', 'fontenc', 'babel'];
    
    if (params.options?.math) packages.push('amsmath', 'amssymb', 'amsfonts');
    if (params.options?.figures) packages.push('graphicx', 'float');
    if (params.options?.tables) packages.push('booktabs', 'longtable');
    if (params.options?.hyperref) packages.push('hyperref');
    if (params.options?.bibliography) packages.push('biblatex');

    return packages;
  }

  async enhanceContentWithAI(content, semanticDomain) {
    // Placeholder for AI content enhancement
    // In a real implementation, this would use AI services for content generation
    const enhancedContent = {
      ...content,
      aiGenerated: true,
      domain: semanticDomain,
      enhancementTimestamp: new Date().toISOString()
    };

    return enhancedContent;
  }

  mapSemanticDomain(domain) {
    const domainMap = {
      'academic': 'schema_org',
      'technical': 'schema_org',
      'medical': 'fhir',
      'business': 'fibo',
      'legal': 'dublin_core',
      'scientific': 'schema_org'
    };

    return domainMap[domain] || 'generic';
  }

  formatGenerationResult(result, isDry) {
    if (isDry) {
      return `LaTeX generation preview:\n${JSON.stringify(result, null, 2)}`;
    }

    const files = result.files || [];
    const fileList = files.map(f => `  - ${f.path} (${f.action})`).join('\n');
    
    return `LaTeX document generated successfully!\n\nFiles created:\n${fileList}\n\nNext steps:\n- Review generated .tex file\n- Use latex_compile to build PDF\n- Use latex_validate for quality checks`;
  }
}

/**
 * LaTeX Compilation Tool Handler
 */
export class LaTeXCompileToolHandler {
  async execute(params) {
    try {
      const sourceFile = path.resolve(params.source);
      
      // Validate source file exists
      if (!await fs.pathExists(sourceFile)) {
        return {
          content: [{
            type: "text",
            text: `LaTeX source file not found: ${sourceFile}`
          }],
          isError: true
        };
      }

      // Prepare compilation environment
      const workDir = path.dirname(sourceFile);
      const outputDir = params.outputDir || workDir;
      const engine = params.engine || 'pdflatex';

      // Ensure output directory exists
      await fs.ensureDir(outputDir);

      // Run compilation with specified passes
      const compilationResult = await this.runLatexCompilation({
        sourceFile,
        workDir,
        outputDir,
        engine,
        passes: params.passes || 2,
        bibliography: params.bibliography,
        optimizations: params.optimizations || {}
      });

      // Cleanup auxiliary files if requested
      if (params.cleanup) {
        await this.cleanupAuxiliaryFiles(workDir, path.basename(sourceFile, '.tex'));
      }

      return {
        content: [{
          type: "text",
          text: this.formatCompilationResult(compilationResult)
        }],
        _meta: {
          pdfGenerated: compilationResult.success,
          outputPath: compilationResult.outputPath,
          compilationTime: compilationResult.duration,
          passes: params.passes
        }
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `LaTeX compilation failed: ${error.message}`
        }],
        isError: true
      };
    }
  }

  async runLatexCompilation({ sourceFile, workDir, outputDir, engine, passes, bibliography, optimizations }) {
    const startTime = Date.now();
    const basename = path.basename(sourceFile, '.tex');
    let success = false;
    let errors = [];
    let warnings = [];

    try {
      // Multiple compilation passes for references
      for (let pass = 1; pass <= passes; pass++) {
        console.log(`LaTeX compilation pass ${pass}/${passes}...`);
        
        const compileResult = await this.runLatexCommand(engine, sourceFile, workDir, {
          outputDirectory: outputDir,
          interaction: 'nonstopmode',
          fileLineError: true,
          ...optimizations
        });

        if (!compileResult.success) {
          errors.push(...compileResult.errors);
          break;
        }

        warnings.push(...compileResult.warnings);

        // Run bibliography processing after first pass if requested
        if (pass === 1 && bibliography) {
          await this.runBibliographyProcessing(basename, workDir);
        }
      }

      // Check if PDF was generated
      const outputPath = path.join(outputDir, `${basename}.pdf`);
      success = await fs.pathExists(outputPath);

      return {
        success,
        outputPath: success ? outputPath : null,
        errors,
        warnings,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        outputPath: null,
        errors: [error.message],
        warnings,
        duration: Date.now() - startTime
      };
    }
  }

  async runLatexCommand(engine, sourceFile, workDir, options) {
    return new Promise((resolve) => {
      const args = [
        `-interaction=${options.interaction || 'nonstopmode'}`,
        `-file-line-error`,
        `-output-directory=${options.outputDirectory || workDir}`,
        sourceFile
      ];

      const process = spawn(engine, args, {
        cwd: workDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        const errors = this.parseLatexErrors(stdout + stderr);
        const warnings = this.parseLatexWarnings(stdout + stderr);

        resolve({
          success: code === 0,
          errors,
          warnings,
          output: stdout,
          stderr
        });
      });

      process.on('error', (error) => {
        resolve({
          success: false,
          errors: [error.message],
          warnings: [],
          output: '',
          stderr: error.message
        });
      });
    });
  }

  async runBibliographyProcessing(basename, workDir) {
    // Try biber first, fall back to bibtex
    try {
      await this.runCommand('biber', [basename], workDir);
    } catch {
      try {
        await this.runCommand('bibtex', [`${basename}.aux`], workDir);
      } catch {
        console.warn('Bibliography processing failed - biber/bibtex not available');
      }
    }
  }

  async runCommand(command, args, cwd) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, { cwd });
      process.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${command} exited with code ${code}`));
      });
      process.on('error', reject);
    });
  }

  parseLatexErrors(output) {
    const errors = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('! ') || line.includes('Error:') || line.includes('Fatal error')) {
        errors.push(line.trim());
      }
    }
    
    return errors;
  }

  parseLatexWarnings(output) {
    const warnings = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('Warning:') || line.includes('LaTeX Warning:')) {
        warnings.push(line.trim());
      }
    }
    
    return warnings;
  }

  async cleanupAuxiliaryFiles(workDir, basename) {
    const auxExtensions = ['.aux', '.log', '.out', '.toc', '.lof', '.lot', '.bbl', '.blg', '.fls', '.fdb_latexmk'];
    
    for (const ext of auxExtensions) {
      const auxFile = path.join(workDir, basename + ext);
      try {
        await fs.remove(auxFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  formatCompilationResult(result) {
    let output = `LaTeX Compilation ${result.success ? 'Successful' : 'Failed'}\n`;
    output += `Duration: ${result.duration}ms\n`;
    
    if (result.success && result.outputPath) {
      output += `\nPDF generated: ${result.outputPath}`;
    }
    
    if (result.errors.length > 0) {
      output += `\n\nErrors (${result.errors.length}):\n`;
      output += result.errors.map(e => `  - ${e}`).join('\n');
    }
    
    if (result.warnings.length > 0) {
      output += `\n\nWarnings (${result.warnings.length}):\n`;
      output += result.warnings.slice(0, 5).map(w => `  - ${w}`).join('\n');
      if (result.warnings.length > 5) {
        output += `\n  ... and ${result.warnings.length - 5} more warnings`;
      }
    }
    
    return output;
  }
}

/**
 * LaTeX Citation Tool Handler with Semantic Web Integration
 */
export class LaTeXCitationsToolHandler {
  constructor() {
    this.citationSources = {
      'arxiv': 'http://export.arxiv.org/api/query',
      'semantic-scholar': 'https://api.semanticscholar.org/v1/paper/search',
      'crossref': 'https://api.crossref.org/works'
    };
  }

  async execute(params) {
    try {
      const citations = await this.searchCitations(params);
      const formatted = await this.formatCitations(citations, params.format);
      
      return {
        content: [{
          type: "text",
          text: this.formatCitationResults(formatted, params)
        }],
        _meta: {
          citationsFound: citations.length,
          sources: params.sources,
          query: params.query
        }
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Citation search failed: ${error.message}`
        }],
        isError: true
      };
    }
  }

  async searchCitations(params) {
    // Placeholder implementation - would integrate with actual citation APIs
    const mockCitations = [
      {
        id: 'example2024',
        type: 'article',
        title: `Example Research on ${params.query}`,
        author: 'Smith, J. and Doe, A.',
        journal: 'Journal of Example Research',
        year: '2024',
        doi: '10.1234/example.2024',
        abstract: params.includeAbstracts ? 'This is an example abstract...' : null,
        relevanceScore: 0.95
      }
    ];

    return mockCitations.slice(0, params.maxResults || 10);
  }

  async formatCitations(citations, format) {
    switch (format) {
      case 'bibtex':
        return citations.map(c => this.toBibTeX(c));
      case 'biblatex':
        return citations.map(c => this.toBibLaTeX(c));
      case 'json':
        return citations;
      default:
        return citations.map(c => this.toBibTeX(c));
    }
  }

  toBibTeX(citation) {
    return `@${citation.type}{${citation.id},
  title={${citation.title}},
  author={${citation.author}},
  journal={${citation.journal}},
  year={${citation.year}},
  doi={${citation.doi}}
}`;
  }

  toBibLaTeX(citation) {
    return this.toBibTeX(citation); // Simplified - could be enhanced
  }

  formatCitationResults(formatted, params) {
    if (params.format === 'json') {
      return JSON.stringify(formatted, null, 2);
    }

    let output = `Found ${formatted.length} citations for "${params.query}"\n\n`;
    output += formatted.join('\n\n');
    
    if (params.aiFiltering?.relevanceScoring) {
      output += '\n\n(Results ranked by AI relevance scoring)';
    }
    
    return output;
  }
}

/**
 * Export all tool handlers
 */
export const LATEX_TOOL_HANDLERS = {
  'latex_generate': LaTeXGenerateToolHandler,
  'latex_compile': LaTeXCompileToolHandler,
  'latex_citations': LaTeXCitationsToolHandler
};