/**
 * Unjucks Integration Adapter
 * 
 * Integrates deterministic artifact generation with existing Unjucks infrastructure
 */

import path from 'path';
import { promises as fs } from 'fs';
import { DeterministicArtifactGenerator } from '../artifacts/generator.js';
import matter from 'gray-matter';

/**
 * Adapter that makes deterministic generation work with existing Unjucks templates
 */
export class UnjucksIntegrationAdapter {
  constructor(options = {}) {
    this.options = {
      templatesDir: options.templatesDir || '_templates',
      outputDir: options.outputDir || './generated',
      ...options
    };

    this.deterministicGenerator = new DeterministicArtifactGenerator(this.options);
    this.compatibilityMode = options.compatibilityMode !== false;
  }

  /**
   * Convert existing Unjucks template to deterministic mode
   */
  async convertTemplate(templatePath, options = {}) {
    const content = await fs.readFile(templatePath, 'utf8');
    const { data: frontmatter, content: template } = matter(content);

    // Add deterministic frontmatter if not present
    const deterministicFrontmatter = {
      ...frontmatter,
      deterministic: true,
      contentAddressed: frontmatter.contentAddressed !== false,
      attestations: frontmatter.attestations !== false,
      ...options.frontmatter
    };

    // Remove non-deterministic elements from template
    let deterministicTemplate = template;

    // Replace common non-deterministic patterns
    const replacements = [
      // Remove timestamp patterns
      [/\{\{\s*now\s*\|\s*date.*?\}\}/g, '<!-- timestamp removed for determinism -->'],
      [/\{\{\s*Date\.now\(\)\s*\}\}/g, '<!-- timestamp removed for determinism -->'],
      
      // Replace random with hash-based alternatives
      [/\{\{\s*random\(\)\s*\}\}/g, '{{ name | hash | slice(0, 8) }}'],
      [/\{\{\s*(\w+)\s*\|\s*random\s*\}\}/g, '{{ $1 | hash | slice(0, 8) }}'],
      
      // Ensure object sorting
      [/\{\{\s*(\w+)\s*\|\s*dump\s*\}\}/g, '{{ $1 | sortKeys | dump }}'],
    ];

    replacements.forEach(([pattern, replacement]) => {
      deterministicTemplate = deterministicTemplate.replace(pattern, replacement);
    });

    return {
      frontmatter: deterministicFrontmatter,
      template: deterministicTemplate,
      originalPath: templatePath
    };
  }

  /**
   * Generate artifacts using existing Unjucks generator with deterministic guarantees
   */
  async generateWithUnjucksCompatibility(generatorName, templateName, context, options = {}) {
    // Find template using Unjucks conventions
    const templatePaths = [
      path.resolve(this.options.templatesDir, generatorName, templateName),
      path.resolve(this.options.templatesDir, generatorName, templateName + '.njk'),
      path.resolve(this.options.templatesDir, generatorName, templateName + '.ejs'),
      path.resolve(this.options.templatesDir, generatorName, templateName + '.hbs')
    ];

    let templatePath = null;
    for (const tryPath of templatePaths) {
      try {
        await fs.access(tryPath);
        templatePath = tryPath;
        break;
      } catch (error) {
        // Continue searching
      }
    }

    if (!templatePath) {
      throw new Error(`Template not found: ${generatorName}/${templateName}`);
    }

    // Convert template if in compatibility mode
    let finalTemplatePath = templatePath;
    if (this.compatibilityMode) {
      const converted = await this.convertTemplate(templatePath);
      
      // Write temporary deterministic template
      const tempDir = path.join(this.options.outputDir, '.tmp');
      await fs.mkdir(tempDir, { recursive: true });
      
      finalTemplatePath = path.join(tempDir, `${templateName}.deterministic.njk`);
      const fullTemplate = `---\n${JSON.stringify(converted.frontmatter, null, 2)}\n---\n${converted.template}`;
      await fs.writeFile(finalTemplatePath, fullTemplate);
    }

    // Generate using deterministic generator
    const result = await this.deterministicGenerator.generate(
      finalTemplatePath,
      this.sanitizeContext(context),
      options.outputPath
    );

    // Clean up temporary file
    if (this.compatibilityMode && finalTemplatePath !== templatePath) {
      try {
        await fs.unlink(finalTemplatePath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    return result;
  }

  /**
   * Sanitize context to ensure deterministic rendering
   */
  sanitizeContext(context) {
    const sanitized = { ...context };
    
    // Remove non-deterministic keys
    delete sanitized._timestamp;
    delete sanitized._random;
    delete sanitized._uuid;
    delete sanitized._now;

    // Sort object keys recursively
    return this.sortObjectKeys(sanitized);
  }

  sortObjectKeys(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sortObjectKeys(item));
    
    const sorted = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = this.sortObjectKeys(obj[key]);
    });
    return sorted;
  }

  /**
   * Create lockfile from existing Unjucks generator structure
   */
  async createUnjucksLockfile(generatorName, outputPath = 'kgen.lock') {
    const generatorDir = path.resolve(this.options.templatesDir, generatorName);
    const templates = [];

    // Scan generator directory
    const items = await fs.readdir(generatorDir, { withFileTypes: true });
    
    for (const item of items) {
      if (item.isFile() && (item.name.endsWith('.njk') || item.name.endsWith('.ejs') || item.name.endsWith('.hbs'))) {
        const templatePath = path.join(generatorDir, item.name);
        const templateName = item.name.replace(/\.(njk|ejs|hbs)$/, '');
        
        // Extract default context from template
        const context = await this.extractDefaultContext(templatePath);
        
        templates.push({
          name: templateName,
          templatePath,
          context,
          outputPath: `${templateName}.generated`
        });
      }
    }

    return this.deterministicGenerator.createLockfile(templates, outputPath);
  }

  /**
   * Extract default context from template by analyzing variables
   */
  async extractDefaultContext(templatePath) {
    const content = await fs.readFile(templatePath, 'utf8');
    const { content: template } = matter(content);
    
    const context = {};
    
    // Simple regex to find {{ variable }} patterns
    const variableMatches = template.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g);
    
    if (variableMatches) {
      variableMatches.forEach(match => {
        const varName = match.replace(/[{}\s]/g, '');
        
        // Provide sensible defaults based on variable names
        if (varName.toLowerCase().includes('name')) {
          context[varName] = 'DefaultName';
        } else if (varName.toLowerCase().includes('type')) {
          context[varName] = 'DefaultType';
        } else if (varName.toLowerCase().includes('description')) {
          context[varName] = 'Default description';
        } else {
          context[varName] = `default_${varName}`;
        }
      });
    }

    return context;
  }

  /**
   * Migrate existing Unjucks templates to deterministic mode
   */
  async migrateTemplates(generatorName, options = {}) {
    const generatorDir = path.resolve(this.options.templatesDir, generatorName);
    const migrationResults = [];

    const items = await fs.readdir(generatorDir, { withFileTypes: true });
    
    for (const item of items) {
      if (item.isFile() && (item.name.endsWith('.njk') || item.name.endsWith('.ejs') || item.name.endsWith('.hbs'))) {
        const templatePath = path.join(generatorDir, item.name);
        
        try {
          const converted = await this.convertTemplate(templatePath, options);
          
          // Write migrated template
          const migratedPath = options.inPlace ? 
            templatePath : 
            path.join(generatorDir, `${item.name}.deterministic`);
          
          const fullTemplate = `---\n${JSON.stringify(converted.frontmatter, null, 2)}\n---\n${converted.template}`;
          await fs.writeFile(migratedPath, fullTemplate);
          
          migrationResults.push({
            original: templatePath,
            migrated: migratedPath,
            success: true
          });
          
        } catch (error) {
          migrationResults.push({
            original: templatePath,
            success: false,
            error: error.message
          });
        }
      }
    }

    return {
      total: migrationResults.length,
      successful: migrationResults.filter(r => r.success).length,
      failed: migrationResults.filter(r => !r.success).length,
      results: migrationResults
    };
  }

  /**
   * Get integration statistics
   */
  getStats() {
    return {
      compatibilityMode: this.compatibilityMode,
      deterministicGenerator: this.deterministicGenerator.getStats(),
      options: this.options
    };
  }
}

/**
 * Factory function to create integration adapter
 */
export function createUnjucksAdapter(options = {}) {
  return new UnjucksIntegrationAdapter(options);
}

export default UnjucksIntegrationAdapter;