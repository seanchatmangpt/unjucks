/**
 * CLI Integration for Deterministic Renderer
 * 
 * Integrates the kgen-templates package deterministic renderer
 * with the KGEN CLI, removing duplicate template processing
 */

export class DeterministicCLIIntegration {
  constructor(kgenEngine) {
    this.kgenEngine = kgenEngine;
    this.deterministicRenderer = null;
  }

  /**
   * Initialize the deterministic renderer from kgen-templates package
   */
  async initialize() {
    try {
      // Import the deterministic renderer (SINGLE ENTRY POINT)
      const { DeterministicRenderer } = await import('../../packages/kgen-templates/src/renderer/deterministic.js');
      
      const config = this.kgenEngine.config || {};
      
      this.deterministicRenderer = new DeterministicRenderer({
        staticBuildTime: config.generate?.staticBuildTime || '2024-01-01T00:00:00.000Z',
        enableCaching: config.generate?.enableCaching !== false,
        enableRDF: config.generate?.enableRDF === true,
        enableAttestation: config.generate?.attestByDefault !== false,
        strictMode: config.generate?.strictMode !== false,
        debug: this.kgenEngine.debug
      });

      return { success: true, renderer: 'deterministic' };
    } catch (error) {
      if (this.kgenEngine.debug) {
        console.warn('Failed to initialize deterministic renderer:', error.message);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Render template using the deterministic renderer (SINGLE ENTRY POINT)
   */
  async renderTemplate(templatePath, context = {}, options = {}) {
    if (!this.deterministicRenderer) {
      const initResult = await this.initialize();
      if (!initResult.success) {
        throw new Error(`Deterministic renderer initialization failed: ${initResult.error}`);
      }
    }

    return await this.deterministicRenderer.render(templatePath, context, options);
  }

  /**
   * Render template to file with frontmatter support
   */
  async renderToFile(templatePath, context = {}, options = {}) {
    if (!this.deterministicRenderer) {
      const initResult = await this.initialize();
      if (!initResult.success) {
        throw new Error(`Deterministic renderer initialization failed: ${initResult.error}`);
      }
    }

    return await this.deterministicRenderer.renderToFile(templatePath, context, options);
  }

  /**
   * Get renderer statistics
   */
  getStatistics() {
    return this.deterministicRenderer?.getStatistics() || {
      templatesRendered: 0,
      artifactsGenerated: 0,
      renderTime: 0,
      errors: 0
    };
  }

  /**
   * Health check for the deterministic renderer
   */
  async healthCheck() {
    if (!this.deterministicRenderer) {
      return { status: 'not_initialized' };
    }

    return await this.deterministicRenderer.healthCheck();
  }

  /**
   * Discover templates using the frontmatter parser
   */
  async discoverTemplates(templatesDir) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      if (!fs.existsSync(templatesDir)) {
        return [];
      }

      const templates = [];
      const entries = fs.readdirSync(templatesDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && this.isTemplateFile(entry.name)) {
          const templatePath = path.join(templatesDir, entry.name);
          const template = await this.analyzeTemplate(templatePath);
          templates.push(template);
        }
      }

      return templates.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      if (this.kgenEngine.debug) {
        console.error('Failed to discover templates:', error);
      }
      throw error;
    }
  }

  /**
   * Analyze a template using the frontmatter parser
   */
  async analyzeTemplate(templatePath) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const { FrontmatterParser } = await import('../../packages/kgen-templates/src/parser/frontmatter.js');

      const content = fs.readFileSync(templatePath, 'utf8');
      const parser = new FrontmatterParser({ debug: this.kgenEngine.debug });
      const { frontmatter, content: templateBody } = parser.parse(content);

      // Extract variables from both frontmatter and template body
      const variables = new Set();
      
      // Extract from frontmatter
      const frontmatterVars = parser.extractVariables(frontmatter);
      frontmatterVars.forEach(v => variables.add(v));
      
      // Extract from template body
      this.extractTemplateVariables(templateBody, variables);

      const stats = fs.statSync(templatePath);

      return {
        name: path.basename(templatePath, path.extname(templatePath)),
        path: templatePath,
        size: stats.size,
        modified: stats.mtime.toISOString(),
        frontmatter,
        variables: Array.from(variables),
        outputFormat: this.inferOutputFormat(frontmatter, templatePath),
        injection: {
          enabled: frontmatter.inject === true,
          mode: this.getInjectionMode(frontmatter),
          target: frontmatter.to
        }
      };
    } catch (error) {
      if (this.kgenEngine.debug) {
        console.error(`Failed to analyze template ${templatePath}:`, error);
      }
      throw error;
    }
  }

  /**
   * Check if file is a template
   */
  isTemplateFile(filename) {
    const templateExtensions = ['.njk', '.j2', '.html', '.txt', '.md', '.json', '.yaml', '.yml', '.xml'];
    const path = require('path');
    return templateExtensions.includes(path.extname(filename).toLowerCase());
  }

  /**
   * Extract template variables from content
   */
  extractTemplateVariables(content, variables) {
    // Match {{ variable }} patterns
    const varMatches = content.matchAll(/\\{\\{\\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\\.[a-zA-Z_][a-zA-Z0-9_]*)*)\\s*\\}\\}/g);
    for (const match of varMatches) {
      variables.add(match[1].split('.')[0]); // Get root variable
    }
    
    // Match {% for variable in ... %} patterns
    const forMatches = content.matchAll(/\\{%\\s*for\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s+in\\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\\.[a-zA-Z_][a-zA-Z0-9_]*)*)/g);
    for (const match of forMatches) {
      variables.add(match[2].split('.')[0]); // Get root variable being iterated
    }
    
    // Match {% if variable %} patterns
    const ifMatches = content.matchAll(/\\{%\\s*if\\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\\.[a-zA-Z_][a-zA-Z0-9_]*)*)/g);
    for (const match of ifMatches) {
      variables.add(match[1].split('.')[0]); // Get root variable
    }
  }

  /**
   * Infer output format from frontmatter and template path
   */
  inferOutputFormat(frontmatter, templatePath) {
    const path = require('path');
    
    if (frontmatter.to) {
      const ext = path.extname(frontmatter.to).toLowerCase();
      if (['.docx', '.pptx', '.xlsx'].includes(ext)) {
        return 'office';
      } else if (['.tex', '.latex'].includes(ext)) {
        return 'latex';
      } else {
        return 'text';
      }
    }
    
    const ext = path.extname(templatePath).toLowerCase();
    if (['.njk', '.j2', '.html'].includes(ext)) {
      return 'html';
    } else if (['.md'].includes(ext)) {
      return 'markdown';
    } else {
      return 'text';
    }
  }

  /**
   * Get injection mode from frontmatter
   */
  getInjectionMode(frontmatter) {
    if (frontmatter.before) return 'before';
    if (frontmatter.after) return 'after';
    if (frontmatter.append) return 'append';
    if (frontmatter.prepend) return 'prepend';
    if (frontmatter.lineAt !== undefined) return 'lineAt';
    return 'replace';
  }

  /**
   * Generate artifact using deterministic renderer
   */
  async generateArtifact(templatePath, context = {}, outputPath = null) {
    const options = outputPath ? { outputPath } : {};
    return await this.renderToFile(templatePath, context, options);
  }

  /**
   * Validate template for deterministic rendering
   */
  async validateTemplate(templatePath) {
    try {
      const fs = await import('fs');
      const { FrontmatterParser } = await import('../../packages/kgen-templates/src/parser/frontmatter.js');

      const content = fs.readFileSync(templatePath, 'utf8');
      const parser = new FrontmatterParser({ debug: this.kgenEngine.debug });
      const { frontmatter } = parser.parse(content);

      // Validate frontmatter
      const validation = parser.validate(frontmatter);

      // Test basic rendering
      let renderTest = { success: false };
      try {
        const testResult = await this.renderTemplate(templatePath, { test: 'value' });
        renderTest = { success: testResult.success };
      } catch (error) {
        renderTest = { success: false, error: error.message };
      }

      return {
        valid: validation.valid && renderTest.success,
        frontmatterValidation: validation,
        renderTest,
        deterministicScore: this.calculateDeterministicScore(content, frontmatter),
        recommendations: this.getTemplateRecommendations(content, frontmatter)
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate deterministic score for template
   */
  calculateDeterministicScore(content, frontmatter) {
    let score = 100;
    
    // Deduct points for non-deterministic patterns
    if (content.includes('Date.now()') || content.includes('new Date()')) {
      score -= 20;
    }
    
    if (content.includes('Math.random()')) {
      score -= 30;
    }
    
    if (content.includes('process.cwd()') || content.includes('__dirname')) {
      score -= 10;
    }
    
    // Add points for deterministic patterns
    if (frontmatter.inject && frontmatter.skipIf) {
      score += 5; // Good for idempotent operations
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get template recommendations
   */
  getTemplateRecommendations(content, frontmatter) {
    const recommendations = [];
    
    if (content.includes('Date.now()') || content.includes('new Date()')) {
      recommendations.push('Use {{ now() }} filter instead of Date.now() for deterministic timestamps');
    }
    
    if (content.includes('Math.random()')) {
      recommendations.push('Use {{ uuid(seed) }} filter instead of Math.random() for deterministic IDs');
    }
    
    if (frontmatter.inject && !frontmatter.skipIf) {
      recommendations.push('Consider adding skipIf condition to prevent duplicate injections');
    }
    
    if (!frontmatter.to && frontmatter.inject) {
      recommendations.push('Add "to" field to specify injection target file');
    }
    
    return recommendations;
  }
}

export default DeterministicCLIIntegration;