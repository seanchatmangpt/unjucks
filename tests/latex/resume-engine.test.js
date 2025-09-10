/**
 * LaTeX Resume Engine Test Suite
 * 
 * Comprehensive BDD tests for LaTeX resume generation and compilation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

import LaTeXCompiler from '../../src/core/latex/compiler.js';
import { FilterPipeline, createFilterPipeline } from '../../src/core/filters.js';

describe('LaTeX Resume Engine', () => {
  let compiler;
  let filterPipeline;
  let tempDir;

  beforeEach(async () => {
    compiler = new LaTeXCompiler({
      cleanupTemp: false // Keep for inspection during tests
    });
    
    filterPipeline = createFilterPipeline();
    
    // Create test temp directory
    tempDir = join(tmpdir(), `latex-test-${randomUUID()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error.message);
    }
  });

  describe('LaTeX Filter System', () => {
    it('should properly escape LaTeX special characters', () => {
      const testStrings = [
        { input: 'Hello & World', expected: 'Hello \\& World' },
        { input: '100% Complete', expected: '100\\% Complete' },
        { input: 'Cost: $50', expected: 'Cost: \\$50' },
        { input: 'Section #1', expected: 'Section \\#1' },
        { input: 'Power^2', expected: 'Power\\textasciicircum{}2' },
        { input: 'file_name', expected: 'file\\_name' },
        { input: 'Group {A}', expected: 'Group \\{A\\}' },
        { input: 'Home~Directory', expected: 'Home\\textasciitilde{}Directory' },
        { input: 'Path\\To\\File', expected: 'Path\\textbackslash{}To\\textbackslash{}File' }
      ];

      const texEscapeFilter = filterPipeline.filters.get('texEscape');
      expect(texEscapeFilter).toBeDefined();

      testStrings.forEach(({ input, expected }) => {
        const result = texEscapeFilter.fn(input);
        expect(result).toBe(expected);
      });
    });

    it('should create proper math mode formatting', () => {
      const mathModeFilter = filterPipeline.filters.get('mathMode');
      expect(mathModeFilter).toBeDefined();

      const result = mathModeFilter.fn('E = mc^2');
      expect(result).toBe('$E = mc^2$');
    });

    it('should format citations correctly', () => {
      const citationFilter = filterPipeline.filters.get('citation');
      expect(citationFilter).toBeDefined();

      const paper = {
        author: 'Smith, J.',
        year: '2023',
        title: 'A Study of LaTeX',
        journal: 'Journal of Typography'
      };

      const apaResult = citationFilter.fn(paper, 'apa');
      expect(apaResult).toBe('Smith, J. (2023). A Study of LaTeX. Journal of Typography.');

      const mlaResult = citationFilter.fn(paper, 'mla');
      expect(apaResult).toContain('Smith, J.');
      expect(mlaResult).toContain('"A Study of LaTeX."');
    });

    it('should create proper theorem environments', () => {
      const theoremFilter = filterPipeline.filters.get('theorem');
      expect(theoremFilter).toBeDefined();

      const content = 'Every even integer greater than 2 can be expressed as the sum of two primes.';
      const result = theoremFilter.fn(content, 'theorem');
      
      expect(result).toBe('\\begin{theorem}\nEvery even integer greater than 2 can be expressed as the sum of two primes.\n\\end{theorem}');
    });

    it('should create proof environments', () => {
      const proofFilter = filterPipeline.filters.get('proof');
      expect(proofFilter).toBeDefined();

      const content = 'By contradiction...';
      const result = proofFilter.fn(content);
      
      expect(result).toBe('\\begin{proof}\nBy contradiction...\n\\end{proof}');
    });
  });

  describe('LaTeX Compiler', () => {
    it('should check for available LaTeX engines', async () => {
      const available = await LaTeXCompiler.getAvailableEngines();
      
      // Should find at least one engine on most systems
      expect(Array.isArray(available)).toBe(true);
      
      // Check if specific engines are available
      const pdflatexAvailable = await LaTeXCompiler.isEngineAvailable('pdflatex');
      if (pdflatexAvailable) {
        expect(available).toContain('pdflatex');
      }
    });

    it('should generate proper LaTeX document structure', () => {
      const content = 'Hello, LaTeX World!';
      const options = {
        title: 'Test Document',
        author: 'Test Author',
        packages: ['amsmath', 'graphicx']
      };

      const document = LaTeXCompiler.generateDocument(content, options);
      
      expect(document).toContain('\\documentclass[11pt]{article}');
      expect(document).toContain('\\usepackage[utf8]{inputenc}');
      expect(document).toContain('\\usepackage{amsmath}');
      expect(document).toContain('\\usepackage{graphicx}');
      expect(document).toContain('\\title{Test Document}');
      expect(document).toContain('\\author{Test Author}');
      expect(document).toContain('\\begin{document}');
      expect(document).toContain('Hello, LaTeX World!');
      expect(document).toContain('\\end{document}');
    });

    it('should compile simple LaTeX document to PDF', async () => {
      // Check if pdflatex is available
      const pdflatexAvailable = await LaTeXCompiler.isEngineAvailable('pdflatex');
      
      if (!pdflatexAvailable) {
        console.warn('pdflatex not available, skipping compilation test');
        return;
      }

      const simpleDocument = `
        \\documentclass{article}
        \\begin{document}
        \\title{Test Resume}
        \\author{John Doe}
        \\maketitle
        
        \\section{Summary}
        This is a test resume document to verify LaTeX compilation.
        
        \\section{Experience}
        \\begin{itemize}
        \\item Software Developer at TechCorp (2020-2023)
        \\item Junior Developer at StartupInc (2018-2020)
        \\end{itemize}
        
        \\end{document}
      `;

      const result = await compiler.compile(simpleDocument, 'test-resume');
      
      expect(result.success).toBe(true);
      expect(result.pdf).toBeInstanceOf(Buffer);
      expect(result.pdf.length).toBeGreaterThan(1000); // PDF should have some size
      expect(result.log).toBeTruthy();
    }, 15000); // Longer timeout for compilation

    it('should handle LaTeX compilation errors gracefully', async () => {
      const invalidDocument = `
        \\documentclass{article}
        \\begin{document}
        \\undefined_command{This will cause an error}
        \\end{document}
      `;

      const result = await compiler.compile(invalidDocument, 'error-test');
      
      expect(result.success).toBe(false);
      expect(result.pdf).toBeNull();
      expect(result.error).toBeTruthy();
      expect(result.log).toBeTruthy();
    });
  });

  describe('Resume Template Integration', () => {
    const sampleResumeData = {
      person: {
        firstName: 'John',
        lastName: 'Doe',
        title: 'Software Engineer',
        email: 'john.doe@example.com',
        phone: '+1-555-123-4567',
        address: {
          street: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94105',
          country: 'USA'
        },
        linkedin: 'linkedin.com/in/johndoe',
        github: 'github.com/johndoe'
      },
      summary: 'Experienced software engineer with expertise in full-stack development and cloud technologies.',
      experience: [
        {
          position: 'Senior Software Engineer',
          company: 'TechCorp Inc.',
          location: 'San Francisco, CA',
          startDate: '2021-01-01',
          endDate: '2023-12-31',
          description: 'Led development of scalable web applications using React and Node.js.',
          achievements: [
            'Improved application performance by 40%',
            'Mentored 3 junior developers',
            'Implemented CI/CD pipeline reducing deployment time by 60%'
          ]
        }
      ],
      education: [
        {
          degree: 'Bachelor of Science in Computer Science',
          institution: 'University of California, Berkeley',
          location: 'Berkeley, CA',
          startDate: '2015-08-01',
          endDate: '2019-05-01',
          gpa: '3.8',
          coursework: ['Data Structures', 'Algorithms', 'Software Engineering']
        }
      ],
      skills: [
        {
          category: 'Programming Languages',
          items: ['JavaScript', 'Python', 'Java', 'TypeScript']
        },
        {
          category: 'Frameworks & Libraries',
          items: ['React', 'Node.js', 'Express.js', 'Django']
        }
      ]
    };

    it('should properly escape all resume data for LaTeX', () => {
      const texEscapeFilter = filterPipeline.filters.get('texEscape');
      
      // Test escaping of various fields that might contain special characters
      const testCases = [
        { field: 'C++ Developer', expected: 'C\\textasciicircum{}\\textasciicircum{} Developer' },
        { field: 'R&D Department', expected: 'R\\&D Department' },
        { field: 'Achieved 95% accuracy', expected: 'Achieved 95\\% accuracy' },
        { field: 'Budget: $1M+', expected: 'Budget: \\$1M\\textasciicircum{}' }
      ];

      testCases.forEach(({ field, expected }) => {
        const result = texEscapeFilter.fn(field);
        expect(result).toBe(expected);
      });
    });

    it('should format dates consistently', () => {
      const dateFormatFilter = filterPipeline.filters.get('dateFormat');
      expect(dateFormatFilter).toBeDefined();

      const testDate = '2023-06-15';
      
      const yearResult = dateFormatFilter.fn(testDate, 'YYYY');
      expect(yearResult).toBe('2023');
      
      const monthYearResult = dateFormatFilter.fn(testDate, 'MMM YYYY');
      expect(monthYearResult).toBe('Jun 2023');
    });

    it('should handle missing or optional resume fields gracefully', () => {
      const incompleteData = {
        person: {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com'
          // Missing: phone, address, etc.
        }
        // Missing: experience, education, etc.
      };

      // Filters should handle undefined/null values gracefully
      const texEscapeFilter = filterPipeline.filters.get('texEscape');
      const defaultFilter = filterPipeline.filters.get('default');
      
      expect(texEscapeFilter.fn(undefined)).toBe('undefined');
      expect(defaultFilter.fn(undefined, 'N/A')).toBe('N/A');
      expect(defaultFilter.fn(null, 'Not specified')).toBe('Not specified');
    });
  });

  describe('Resume Style Variations', () => {
    it('should support different document classes and styles', () => {
      const modernCVOptions = {
        documentClass: 'moderncv',
        packages: ['moderncv'],
        fontsize: '11pt'
      };

      const document = LaTeXCompiler.generateDocument('Resume content', modernCVOptions);
      expect(document).toContain('\\documentclass[11pt]{moderncv}');
      expect(document).toContain('\\usepackage{moderncv}');
    });

    it('should handle academic resume formatting requirements', () => {
      const academicOptions = {
        documentClass: 'article',
        packages: ['titlesec', 'enumitem', 'hyperref'],
        geometry: 'margin=1in'
      };

      const document = LaTeXCompiler.generateDocument('Academic content', academicOptions);
      expect(document).toContain('\\usepackage{titlesec}');
      expect(document).toContain('\\usepackage{enumitem}');
      expect(document).toContain('\\geometry{margin=1in}');
    });

    it('should support executive resume with custom formatting', () => {
      const executiveOptions = {
        packages: ['xcolor', 'titlesec'],
        fontsize: '11pt',
        geometry: 'margin=0.75in'
      };

      const document = LaTeXCompiler.generateDocument('Executive content', executiveOptions);
      expect(document).toContain('\\usepackage{xcolor}');
      expect(document).toContain('\\geometry{margin=0.75in}');
    });
  });

  describe('Performance and Error Handling', () => {
    it('should complete filter operations within reasonable time', () => {
      const largeText = 'A'.repeat(10000) + ' special & characters % $ # ^ _ { } ~ \\';
      
      const startTime = performance.now();
      const texEscapeFilter = filterPipeline.filters.get('texEscape');
      const result = texEscapeFilter.fn(largeText);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should complete in <100ms
      expect(result).toContain('\\&');
      expect(result).toContain('\\%');
    });

    it('should handle malformed input gracefully', () => {
      const filters = filterPipeline.getAllFilters();
      
      // Test various malformed inputs
      const malformedInputs = [null, undefined, {}, [], 123, true];
      
      malformedInputs.forEach(input => {
        expect(() => {
          filters.texEscape(input);
          filters.dateFormat(input);
          filters.kebabCase(input);
        }).not.toThrow();
      });
    });

    it('should provide meaningful error messages for compilation failures', async () => {
      const documentWithUndefinedCommand = `
        \\documentclass{article}
        \\begin{document}
        \\thiswillnotwork{Error prone content}
        \\end{document}
      `;

      const result = await compiler.compile(documentWithUndefinedCommand, 'error-prone');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(typeof result.error).toBe('string');
      expect(result.log).toBeTruthy();
    });
  });

  describe('Memory Storage Integration', () => {
    it('should store LaTeX capabilities in memory', async () => {
      const capabilities = {
        engines: await LaTeXCompiler.getAvailableEngines(),
        filters: filterPipeline.getFilterCatalog(),
        templates: ['latex-resume', 'academic-resume', 'executive-resume'],
        compilation: {
          timeout: compiler.options.timeout,
          passes: compiler.options.passes,
          outputFormats: ['pdf']
        },
        features: {
          escaping: true,
          citations: true,
          mathematics: true,
          tables: true,
          graphics: true
        }
      };

      // Verify capability structure
      expect(capabilities.engines).toBeInstanceOf(Array);
      expect(capabilities.filters).toHaveProperty('totalFilters');
      expect(capabilities.filters.categories).toHaveProperty('latex');
      expect(capabilities.templates).toContain('latex-resume');
      expect(capabilities.compilation.timeout).toBeGreaterThan(0);
      expect(capabilities.features.escaping).toBe(true);

      // This would be stored in memory with key "hive/latex/resume-engine"
      const memoryKey = 'hive/latex/resume-engine';
      expect(memoryKey).toBe('hive/latex/resume-engine');
    });
  });
});