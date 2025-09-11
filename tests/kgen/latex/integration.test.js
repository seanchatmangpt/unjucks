/**
 * KGEN LaTeX Integration Tests
 * Comprehensive test suite for LaTeX document generation system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LaTeXTemplateSelector } from '../../../packages/kgen-core/src/latex/selector.js';
import { LaTeXParser } from '../../../packages/kgen-core/src/latex/parser.js';
import { LaTeXCompiler } from '../../../packages/kgen-core/src/latex/compiler.js';
import { LaTeXSyntaxValidator } from '../../../packages/kgen-core/src/latex/validators/syntax.js';
import { LaTeXTemplateRenderer } from '../../../packages/kgen-core/src/latex/renderers/nunjucks.js';
import { AcademicPaperWorkflow } from '../../../packages/kgen-core/src/latex/workflows/academic.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('KGEN LaTeX Integration', () => {
  let tempDir;
  let templateSelector;
  let parser;
  let compiler;
  let validator;
  let renderer;
  let workflow;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = join(tmpdir(), `kgen-latex-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // Initialize components
    templateSelector = new LaTeXTemplateSelector();
    parser = new LaTeXParser('', { semanticAnalysis: true });
    compiler = new LaTeXCompiler({
      outputDir: join(tempDir, 'output'),
      tempDir: join(tempDir, 'temp'),
      cleanTemp: false // Keep for inspection during tests
    });
    validator = new LaTeXSyntaxValidator();
    renderer = new LaTeXTemplateRenderer({
      templatesDir: join(tempDir, 'templates'),
      validateOutput: true
    });
    workflow = new AcademicPaperWorkflow({
      outputDir: join(tempDir, 'academic'),
      templatesDir: join(tempDir, 'templates')
    });
  });

  afterEach(async () => {
    // Cleanup temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup temp directory: ${error.message}`);
    }
  });

  describe('LaTeX Template Selector', () => {
    it('should select appropriate template for academic paper', () => {
      const context = {
        type: 'paper',
        domain: 'academic',
        data: {
          title: 'Test Paper',
          author: 'John Doe'
        }
      };

      const selection = templateSelector.selectTemplate(context);
      expect(selection.templateId).toBe('article');
      expect(selection.template).toBeDefined();
      expect(selection.template.category).toBe('academic');
    });

    it('should select thesis template for long academic documents', () => {
      const context = {
        type: 'thesis',
        length: 100,
        data: {
          title: 'PhD Thesis',
          author: 'Jane Smith',
          university: 'Test University'
        }
      };

      const selection = templateSelector.selectTemplate(context);
      expect(selection.templateId).toBe('thesis');
    });

    it('should select resume template based on job context', () => {
      const context = {
        type: 'resume',
        job: {
          title: 'Software Engineer',
          company: { type: 'startup' }
        },
        person: {
          name: 'Alice Johnson'
        }
      };

      const selection = templateSelector.selectTemplate(context, {
        atsOptimized: true
      });
      expect(selection.templateId).toBe('modern-clean');
    });

    it('should validate template requirements', () => {
      const context = {
        title: 'Test',
        // Missing required author field
      };

      const selection = templateSelector.validateTemplateSelection('article', context);
      expect(selection.missingFields).toContain('author');
    });

    it('should list available templates by category', () => {
      const categories = templateSelector.getTemplatesByCategory();
      
      expect(categories.academic).toBeDefined();
      expect(categories.resume).toBeDefined();
      expect(categories.professional).toBeDefined();
      
      expect(categories.academic.length).toBeGreaterThan(0);
      expect(categories.resume.length).toBeGreaterThan(0);
    });

    it('should search templates by features', () => {
      const mathTemplates = templateSelector.searchTemplates('math');
      expect(mathTemplates.length).toBeGreaterThan(0);
      
      const academicTemplates = templateSelector.searchTemplates('academic');
      expect(academicTemplates.length).toBeGreaterThan(0);
    });
  });

  describe('LaTeX Parser', () => {
    it('should parse simple LaTeX document', () => {
      const latex = `
        \\documentclass{article}
        \\title{Test Document}
        \\author{John Doe}
        \\begin{document}
        \\maketitle
        Hello, world!
        \\end{document}
      `;

      const parser = new LaTeXParser(latex, { semanticAnalysis: true });
      const result = parser.parse();

      expect(result.type).toBe('document');
      expect(result.errors.length).toBe(0);
      expect(result.metadata.title).toBe('Test Document');
      expect(result.metadata.author).toBe('John Doe');
    });

    it('should detect document structure', () => {
      const latex = `
        \\documentclass{article}
        \\usepackage{amsmath}
        \\title{Math Paper}
        \\begin{document}
        \\section{Introduction}
        \\subsection{Background}
        \\end{document}
      `;

      const parser = new LaTeXParser(latex, { semanticAnalysis: true });
      const result = parser.parse();

      expect(result.documentStructure.preamble.length).toBeGreaterThan(0);
      expect(result.documentStructure.metadata.sectionCount).toBe(2);
      expect(result.documentStructure.metadata.maxSectionLevel).toBe(3);
    });

    it('should handle math environments', () => {
      const latex = `
        \\begin{equation}
        E = mc^2
        \\end{equation}
        $x = y + z$
      `;

      const parser = new LaTeXParser(latex);
      const result = parser.parse();

      const mathNodes = result.ast.children.filter(child => 
        child.type === 'environment' && child.semantic?.category === 'math'
      );
      
      expect(mathNodes.length).toBeGreaterThan(0);
      expect(result.documentStructure.metadata.mathElementCount).toBeGreaterThan(0);
    });

    it('should validate citations and bibliography', () => {
      const latex = `
        \\cite{knuth1984}
        \\bibliography{references}
      `;

      const parser = new LaTeXParser(latex, { semanticAnalysis: true });
      const result = parser.parse();

      expect(result.documentStructure.metadata.citationCount).toBe(1);
      expect(result.warnings.length).toBe(0); // Should not warn about missing bibliography
    });

    it('should provide parsing statistics', () => {
      const latex = `\\documentclass{article}\\begin{document}Hello\\end{document}`;
      
      const parser = new LaTeXParser(latex);
      const result = parser.parse();
      const stats = parser.getStats();

      expect(stats.tokenCount).toBeGreaterThan(0);
      expect(stats.errorCount).toBe(0);
      expect(typeof stats.processingTime).toBe('number');
    });
  });

  describe('LaTeX Syntax Validator', () => {
    it('should validate correct LaTeX document', async () => {
      const latex = `
        \\documentclass{article}
        \\title{Valid Document}
        \\author{John Doe}
        \\begin{document}
        \\maketitle
        \\section{Introduction}
        This is a valid document.
        \\end{document}
      `;

      const result = await validator.validate(latex);
      
      expect(result.valid).toBe(true);
      expect(result.summary.errors).toBe(0);
      expect(result.summary.score).toBeGreaterThan(80);
    });

    it('should detect missing documentclass', async () => {
      const latex = `
        \\begin{document}
        Hello world
        \\end{document}
      `;

      const result = await validator.validate(latex);
      
      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => 
        issue.type === 'missing_documentclass'
      )).toBe(true);
    });

    it('should detect unmatched environments', async () => {
      const latex = `
        \\documentclass{article}
        \\begin{document}
        \\begin{itemize}
        \\item Test
        \\end{enumerate}
        \\end{document}
      `;

      const result = await validator.validate(latex);
      
      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => 
        issue.type === 'mismatched_environment'
      )).toBe(true);
    });

    it('should detect unbalanced braces', async () => {
      const latex = `
        \\documentclass{article}
        \\begin{document}
        \\textbf{bold text
        \\end{document}
      `;

      const result = await validator.validate(latex);
      
      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => 
        issue.type === 'unclosed_brace'
      )).toBe(true);
    });

    it('should provide validation summary', async () => {
      const latex = `
        \\documentclass{article}
        \\begin{document}
        \\cite{missing-ref}
        \\end{document}
      `;

      const result = await validator.validate(latex);
      
      expect(result.summary).toBeDefined();
      expect(result.summary.totalIssues).toBeGreaterThan(0);
      expect(result.summary.quality).toBeDefined();
      expect(typeof result.summary.score).toBe('number');
    });

    it('should allow custom validation rules', async () => {
      const customValidator = new LaTeXSyntaxValidator({
        customRules: [{
          id: 'custom_test',
          name: 'Custom Test Rule',
          severity: 'warning',
          validator: (parseResult) => {
            return [{
              type: 'custom_issue',
              severity: 'warning',
              message: 'Custom validation issue',
              line: 1,
              column: 1
            }];
          }
        }]
      });

      const result = await customValidator.validate('\\documentclass{article}');
      
      expect(result.issues.some(issue => 
        issue.type === 'custom_issue'
      )).toBe(true);
    });
  });

  describe('LaTeX Template Renderer', () => {
    beforeEach(async () => {
      // Create test template
      const templateDir = join(tempDir, 'templates');
      await fs.mkdir(templateDir, { recursive: true });
      
      const testTemplate = `
        \\documentclass[{{ fontSize | default('12pt') }}]{{{ documentClass | default('article') }}}
        {% if mathSupport %}
        \\usepackage{amsmath}
        {% endif %}
        \\title{{{ title | latex_escape }}}
        \\author{{{ author | latex_escape }}}
        \\begin{document}
        \\maketitle
        {% if abstract %}
        \\begin{abstract}
        {{ abstract | latex_escape }}
        \\end{abstract}
        {% endif %}
        {% for section in sections %}
        \\section{{{ section.title | latex_escape }}}
        {{ section.content | latex_escape }}
        {% endfor %}
        \\end{document}
      `;
      
      await fs.writeFile(join(templateDir, 'test.tex'), testTemplate);
    });

    it('should render template with context', async () => {
      await renderer.initialize();
      
      const context = {
        title: 'Test Document',
        author: 'John Doe',
        documentClass: 'article',
        fontSize: '12pt',
        mathSupport: true,
        abstract: 'This is a test abstract.',
        sections: [
          {
            title: 'Introduction',
            content: 'This is the introduction section.'
          },
          {
            title: 'Methods',
            content: 'This is the methods section.'
          }
        ]
      };

      const result = await renderer.render('test.tex', context);
      
      expect(result.content).toContain('\\title{Test Document}');
      expect(result.content).toContain('\\author{John Doe}');
      expect(result.content).toContain('\\usepackage{amsmath}');
      expect(result.content).toContain('\\section{Introduction}');
      expect(result.validation?.valid).toBe(true);
    });

    it('should handle LaTeX escaping', async () => {
      await renderer.initialize();
      
      const context = {
        title: 'Test & Special $ Characters # ^ _ { } ~ \\',
        author: 'John Doe',
        sections: []
      };

      const result = await renderer.render('test.tex', context);
      
      expect(result.content).toContain('\\&');
      expect(result.content).toContain('\\$');
      expect(result.content).toContain('\\#');
      expect(result.content).notToContain('Test & Special');
    });

    it('should validate rendered output', async () => {
      await renderer.initialize();
      
      const context = {
        title: 'Test Document',
        author: 'John Doe',
        sections: []
      };

      const result = await renderer.render('test.tex', context, {
        validateOutput: true
      });
      
      expect(result.validation).toBeDefined();
      expect(result.validation.valid).toBe(true);
      expect(result.validation.summary).toBeDefined();
    });

    it('should render string templates', async () => {
      await renderer.initialize();
      
      const templateString = `
        \\section{{{ title | latex_escape }}}
        {{ content | latex_escape }}
      `;
      
      const context = {
        title: 'Dynamic Section',
        content: 'This is dynamic content.'
      };

      const result = await renderer.renderString(templateString, context);
      
      expect(result.content).toContain('\\section{Dynamic Section}');
      expect(result.content).toContain('This is dynamic content.');
    });

    it('should handle batch rendering', async () => {
      await renderer.initialize();
      
      const templates = [
        {
          name: 'test.tex',
          context: { title: 'Document 1', author: 'Author 1', sections: [] },
          output: join(tempDir, 'doc1.tex')
        },
        {
          name: 'test.tex',
          context: { title: 'Document 2', author: 'Author 2', sections: [] },
          output: join(tempDir, 'doc2.tex')
        }
      ];

      const result = await renderer.batchRender(templates);
      
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results.length).toBe(2);
      
      // Check files were created
      expect(await fs.access(join(tempDir, 'doc1.tex')).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(join(tempDir, 'doc2.tex')).then(() => true).catch(() => false)).toBe(true);
    });
  });

  describe('Academic Paper Workflow', () => {
    it('should generate research paper', async () => {
      // Create test templates
      const templateDir = join(tempDir, 'templates');
      await fs.mkdir(templateDir, { recursive: true });
      
      const articleTemplate = `
        \\documentclass{article}
        \\title{{{ title }}}
        \\author{{{ author }}}
        \\begin{document}
        \\maketitle
        \\begin{abstract}
        {{ abstract }}
        \\end{abstract}
        {% for section in sections %}
        \\section{{{ section.title }}}
        {{ section.content }}
        {% endfor %}
        \\end{document}
      `;
      
      await fs.writeFile(join(templateDir, 'article.tex'), articleTemplate);
      
      const paperConfig = {
        type: 'research-paper',
        data: {
          title: 'A Novel Approach to Test Generation',
          author: 'Dr. Jane Smith',
          abstract: 'This paper presents a novel approach to automated test generation.',
          keywords: ['testing', 'automation', 'software engineering'],
          introduction: 'Software testing is crucial for quality assurance.',
          methodology: 'We propose a new algorithm based on machine learning.',
          results: 'Our experiments show significant improvements.',
          conclusion: 'The proposed approach outperforms existing methods.',
          bibliography: [
            {
              key: 'smith2023',
              type: 'article',
              title: 'Previous Work',
              author: 'Smith et al.',
              year: '2023',
              journal: 'Journal of Testing'
            }
          ]
        }
      };

      await workflow.initialize();
      const result = await workflow.generatePaper(paperConfig, {
        autoCompile: false // Skip compilation in tests
      });
      
      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();
      expect(result.document.path).toBeDefined();
      expect(result.validation.valid).toBe(true);
      expect(result.auxiliaryFiles.length).toBeGreaterThan(0);
      
      // Check content
      const content = await fs.readFile(result.document.path, 'utf8');
      expect(content).toContain('A Novel Approach to Test Generation');
      expect(content).toContain('Dr. Jane Smith');
    });

    it('should validate paper configuration', async () => {
      const invalidConfig = {
        type: 'research-paper',
        data: {
          title: 'Test Paper'
          // Missing required author and abstract
        }
      };

      await workflow.initialize();
      
      await expect(workflow.generatePaper(invalidConfig)).rejects.toThrow('Missing required fields');
    });

    it('should generate document outline', async () => {
      const outline = await workflow.generateOutline('research-paper');
      
      expect(outline.type).toBe('research-paper');
      expect(outline.sections).toBeDefined();
      expect(outline.sections.length).toBeGreaterThan(0);
      expect(outline.requiredFields).toContain('title');
      expect(outline.requiredFields).toContain('author');
      expect(outline.features.mathSupport).toBe(true);
    });

    it('should list available document types', () => {
      const types = workflow.getDocumentTypes();
      
      expect(types.length).toBeGreaterThan(0);
      expect(types.some(type => type.id === 'research-paper')).toBe(true);
      expect(types.some(type => type.id === 'thesis')).toBe(true);
      expect(types.some(type => type.id === 'conference-paper')).toBe(true);
    });
  });

  describe('End-to-End Integration', () => {
    it('should complete full document generation workflow', async () => {
      // Setup test environment
      const templateDir = join(tempDir, 'templates');
      await fs.mkdir(templateDir, { recursive: true });
      
      const template = `
        \\documentclass{article}
        \\title{{{ title | latex_escape }}}
        \\author{{{ author | latex_escape }}}
        \\begin{document}
        \\maketitle
        \\section{Introduction}
        {{ introduction | latex_escape }}
        \\end{document}
      `;
      
      await fs.writeFile(join(templateDir, 'article.tex'), template);
      
      // Initialize all components
      await renderer.initialize();
      await compiler.initialize();
      
      // Select template
      const context = {
        type: 'paper',
        domain: 'academic',
        data: {
          title: 'Integration Test Paper',
          author: 'Test Author'
        }
      };
      
      const selection = templateSelector.selectTemplate(context);
      expect(selection.templateId).toBe('article');
      
      // Render document
      const renderContext = {
        title: 'Integration Test Paper',
        author: 'Test Author',
        introduction: 'This is an integration test document.'
      };
      
      const renderResult = await renderer.render('article.tex', renderContext);
      expect(renderResult.validation.valid).toBe(true);
      
      // Validate syntax
      const validationResult = await validator.validate(renderResult.content);
      expect(validationResult.valid).toBe(true);
      
      // Save document
      const outputPath = join(tempDir, 'output', 'integration-test.tex');
      await fs.mkdir(dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, renderResult.content);
      
      // Verify file was created
      const stats = await fs.stat(outputPath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should handle error cases gracefully', async () => {
      // Test with invalid template
      await renderer.initialize();
      
      await expect(renderer.render('nonexistent.tex', {})).rejects.toThrow();
      
      // Test with invalid LaTeX
      const invalidLatex = '\\invalid{command\\missing{brace';
      const validationResult = await validator.validate(invalidLatex);
      
      expect(validationResult.valid).toBe(false);
      expect(validationResult.issues.length).toBeGreaterThan(0);
    });
  });
});

// Performance and stress tests
describe('KGEN LaTeX Performance', () => {
  it('should handle large documents efficiently', async () => {
    const largeContent = 'This is a test paragraph. '.repeat(1000);
    const largeLatex = `
      \\documentclass{article}
      \\begin{document}
      ${largeContent}
      \\end{document}
    `;

    const startTime = Date.now();
    const parser = new LaTeXParser(largeLatex);
    const result = parser.parse();
    const endTime = Date.now();

    expect(result.type).toBe('document');
    expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
  });

  it('should handle concurrent operations', async () => {
    const validator = new LaTeXSyntaxValidator();
    const testCases = Array.from({ length: 10 }, (_, i) => `
      \\documentclass{article}
      \\title{Document ${i}}
      \\begin{document}
      Content ${i}
      \\end{document}
    `);

    const startTime = Date.now();
    const results = await Promise.all(
      testCases.map(latex => validator.validate(latex))
    );
    const endTime = Date.now();

    expect(results.length).toBe(10);
    expect(results.every(result => result.valid)).toBe(true);
    expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
  });
});
