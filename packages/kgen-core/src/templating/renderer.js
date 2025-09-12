/**
 * KGEN Template Renderer - Simplified Nunjucks-based rendering
 * 
 * Direct graph→template→file pipeline with deterministic output
 * Removes legacy complexity and focuses on core functionality
 */

import nunjucks from 'nunjucks';
import { promises as fs } from 'fs';
import { join, dirname, resolve } from 'path';
import { existsSync } from 'fs';
import { FrontmatterParser } from './frontmatter.js';
import { TemplateContext } from './context.js';

export class TemplateRenderer {
  constructor(options = {}) {
    this.options = {
      templatesDir: options.templatesDir || '_templates',
      outputDir: options.outputDir || 'src',
      autoescape: options.autoescape !== false,
      throwOnUndefined: options.throwOnUndefined || false,
      trimBlocks: options.trimBlocks !== false,
      lstripBlocks: options.lstripBlocks !== false,
      enableCache: options.enableCache !== false,
      dryRun: options.dryRun || false,
      force: options.force || false,
      debug: options.debug || false,
      ...options
    };

    this.frontmatterParser = new FrontmatterParser();
    this.contextBuilder = new TemplateContext();
    this.env = this.createNunjucksEnvironment();
    
    // Rendering statistics for deterministic behavior tracking
    this.stats = {
      renders: 0,
      errors: 0,
      files: new Map(), // file -> hash for change detection
      variables: new Set(),
      templates: new Set()
    };
  }

  /**
   * Create Nunjucks environment with minimal configuration
   */
  createNunjucksEnvironment() {
    const loader = new nunjucks.FileSystemLoader(this.options.templatesDir, {
      watch: false,
      noCache: !this.options.enableCache
    });

    const env = new nunjucks.Environment(loader, {
      autoescape: this.options.autoescape,
      throwOnUndefined: this.options.throwOnUndefined,
      trimBlocks: this.options.trimBlocks,
      lstripBlocks: this.options.lstripBlocks
    });

    // Add core filters for KGEN
    this.addCoreFilters(env);
    
    return env;
  }

  /**
   * Add essential filters for template rendering
   */
  addCoreFilters(env) {
    // String manipulation
    env.addFilter('pascalCase', (str) => {
      if (!str) return '';
      return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => 
        word.toUpperCase()).replace(/\s+/g, '');
    });

    env.addFilter('camelCase', (str) => {
      if (!str) return '';
      const pascal = env.getFilter('pascalCase')(str);
      return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    });

    env.addFilter('kebabCase', (str) => {
      if (!str) return '';
      return str.replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/\s+/g, '-')
                .toLowerCase();
    });

    env.addFilter('snakeCase', (str) => {
      if (!str) return '';
      return str.replace(/([a-z])([A-Z])/g, '$1_$2')
                .replace(/\s+/g, '_')
                .toLowerCase();
    });

    // RDF/URI utilities
    env.addFilter('localName', (uri) => {
      if (!uri) return '';
      const lastSlash = uri.lastIndexOf('/');
      const lastHash = uri.lastIndexOf('#');
      const separator = Math.max(lastSlash, lastHash);
      return separator > 0 ? uri.substring(separator + 1) : uri;
    });

    env.addFilter('namespace', (uri) => {
      if (!uri) return '';
      const lastSlash = uri.lastIndexOf('/');
      const lastHash = uri.lastIndexOf('#');
      const separator = Math.max(lastSlash, lastHash);
      return separator > 0 ? uri.substring(0, separator + 1) : uri;
    });

    // KGEN-specific filters
    env.addFilter('kgenId', (str) => {
      // Simple deterministic ID without crypto dependency
      let hash = 0;
      const s = str || '';
      for (let i = 0; i < s.length; i++) {
        const char = s.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return `kgen_${Math.abs(hash).toString(16).substring(0, 12)}`;
    });

    // Path utilities
    env.addFilter('dirname', (path) => dirname(path));
    env.addFilter('basename', (path) => path.split('/').pop());
    env.addFilter('extension', (path) => path.split('.').pop());

    // Array utilities
    env.addFilter('unique', (arr) => [...new Set(arr)]);
    env.addFilter('sortBy', (arr, key) => 
      arr.sort((a, b) => (a[key] > b[key] ? 1 : -1)));

    // Date utilities
    env.addFilter('now', () => this.getDeterministicDate().toISOString());
    env.addFilter('timestamp', () => this.getDeterministicTimestamp());

    // Conditional rendering
    env.addGlobal('when', (condition, value) => condition ? value : '');
    env.addGlobal('unless', (condition, value) => !condition ? value : '');

    // RDF term type checking
    env.addFilter('isURI', (term) => term && term.termType === 'NamedNode');
    env.addFilter('isLiteral', (term) => term && term.termType === 'Literal');
    env.addFilter('isBlankNode', (term) => term && term.termType === 'BlankNode');
    env.addFilter('value', (literal) => {
      if (typeof literal === 'object' && literal.value !== undefined) {
        return literal.value;
      }
      return literal;
    });
  }

  /**
   * Render a template with given context and RDF graph data
   */
  async render(templatePath, context = {}, rdfData = null) {
    const startTime = performance.now();
    this.stats.renders++;

    try {
      // Read template file
      const fullTemplatePath = resolve(this.options.templatesDir, templatePath);
      if (!existsSync(fullTemplatePath)) {
        throw new Error(`Template not found: ${templatePath}`);
      }

      const templateContent = await fs.readFile(fullTemplatePath, 'utf-8');
      
      // Parse frontmatter
      const parsed = await this.frontmatterParser.parse(templateContent);
      const { frontmatter, content } = parsed;

      // Build enhanced context with RDF data
      const enhancedContext = await this.contextBuilder.buildContext({
        variables: context,
        rdfData,
        frontmatter,
        templatePath
      });

      // Check skipIf condition
      if (this.frontmatterParser.shouldSkip(frontmatter, enhancedContext)) {
        if (this.options.debug) {
          console.log(`⏭️ Skipping ${templatePath} due to skipIf condition`);
        }
        return { skipped: true, reason: frontmatter.skipIf };
      }

      // Render template content
      const rendered = this.env.renderString(content, enhancedContext);
      
      // Process dynamic 'to' path if present
      let outputPath = frontmatter.to;
      if (outputPath && outputPath.includes('{{')) {
        outputPath = this.env.renderString(outputPath, enhancedContext);
      }

      const renderTime = performance.now() - startTime;
      
      // Track variables used
      Object.keys(enhancedContext).forEach(key => this.stats.variables.add(key));
      this.stats.templates.add(templatePath);

      const result = {
        content: rendered,
        frontmatter,
        outputPath: outputPath ? resolve(this.options.outputDir, outputPath) : null,
        renderTime,
        context: enhancedContext
      };

      if (this.options.debug) {
        console.log(`✅ Rendered ${templatePath} in ${renderTime.toFixed(2)}ms`);
      }

      return result;

    } catch (error) {
      this.stats.errors++;
      const renderTime = performance.now() - startTime;
      
      console.error(`❌ Template rendering failed: ${templatePath}`, {
        error: error.message,
        renderTime: `${renderTime.toFixed(2)}ms`
      });

      throw error;
    }
  }

  /**
   * Write rendered content to file with injection support
   */
  async writeOutput(renderResult) {
    if (renderResult.skipped) {
      return { action: 'skipped', reason: renderResult.reason };
    }

    const { content, frontmatter, outputPath } = renderResult;
    
    if (!outputPath) {
      throw new Error('No output path specified in frontmatter or options');
    }

    // Ensure output directory exists
    await fs.mkdir(dirname(outputPath), { recursive: true });

    const operationMode = this.frontmatterParser.getOperationMode(frontmatter);

    if (this.options.dryRun) {
      return {
        action: 'dry-run',
        operation: operationMode.mode,
        path: outputPath,
        content: content
      };
    }

    try {
      switch (operationMode.mode) {
        case 'write':
          await this.writeFile(outputPath, content, frontmatter);
          return { action: 'write', path: outputPath };

        case 'append':
          await this.appendToFile(outputPath, content);
          return { action: 'append', path: outputPath };

        case 'prepend':
          await this.prependToFile(outputPath, content);
          return { action: 'prepend', path: outputPath };

        case 'lineAt':
          await this.insertAtLine(outputPath, content, operationMode.lineNumber);
          return { action: 'lineAt', path: outputPath, line: operationMode.lineNumber };

        case 'inject':
          const injected = await this.injectContent(
            outputPath, 
            content, 
            frontmatter.before, 
            frontmatter.after
          );
          return { action: 'inject', path: outputPath, injected };

        default:
          throw new Error(`Unknown operation mode: ${operationMode.mode}`);
      }
    } catch (error) {
      console.error(`❌ Failed to write ${outputPath}:`, error.message);
      throw error;
    }
  }

  /**
   * Write content to file with chmod support
   */
  async writeFile(filePath, content, frontmatter) {
    const fileExists = existsSync(filePath);
    
    if (fileExists && !this.options.force) {
      const existing = await fs.readFile(filePath, 'utf-8');
      if (existing === content) {
        return { unchanged: true };
      }
    }

    await fs.writeFile(filePath, content, 'utf-8');

    // Apply chmod if specified
    if (frontmatter.chmod) {
      const mode = this.frontmatterParser.normalizeChmod(frontmatter.chmod);
      await fs.chmod(filePath, mode);
    }

    // Execute shell command if specified
    if (frontmatter.sh && !this.options.dryRun) {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      try {
        await execAsync(frontmatter.sh, { cwd: dirname(filePath) });
      } catch (error) {
        console.warn(`⚠️ Shell command failed: ${frontmatter.sh}`, error.message);
      }
    }
  }

  /**
   * Append content to existing file
   */
  async appendToFile(filePath, content) {
    if (existsSync(filePath)) {
      const existing = await fs.readFile(filePath, 'utf-8');
      const newContent = existing + (existing.endsWith('\n') ? '' : '\n') + content;
      await fs.writeFile(filePath, newContent, 'utf-8');
    } else {
      await fs.writeFile(filePath, content, 'utf-8');
    }
  }

  /**
   * Prepend content to existing file
   */
  async prependToFile(filePath, content) {
    if (existsSync(filePath)) {
      const existing = await fs.readFile(filePath, 'utf-8');
      const newContent = content + '\n' + existing;
      await fs.writeFile(filePath, newContent, 'utf-8');
    } else {
      await fs.writeFile(filePath, content, 'utf-8');
    }
  }

  /**
   * Insert content at specific line
   */
  async insertAtLine(filePath, content, lineNumber) {
    if (!existsSync(filePath)) {
      throw new Error(`Cannot insert at line ${lineNumber}: file does not exist`);
    }

    const existing = await fs.readFile(filePath, 'utf-8');
    const lines = existing.split('\n');
    
    // Convert to 0-based index
    const insertIndex = Math.max(0, Math.min(lineNumber - 1, lines.length));
    lines.splice(insertIndex, 0, content);
    
    await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
  }

  /**
   * Inject content before/after markers
   */
  async injectContent(filePath, content, beforeMarker, afterMarker) {
    if (!existsSync(filePath)) {
      throw new Error(`Cannot inject into non-existent file: ${filePath}`);
    }

    let existing = await fs.readFile(filePath, 'utf-8');
    let injected = false;

    if (beforeMarker) {
      const beforeIndex = existing.indexOf(beforeMarker);
      if (beforeIndex !== -1) {
        existing = existing.slice(0, beforeIndex) + content + '\n' + existing.slice(beforeIndex);
        injected = true;
      }
    }

    if (afterMarker) {
      const afterIndex = existing.indexOf(afterMarker);
      if (afterIndex !== -1) {
        const insertPoint = existing.indexOf('\n', afterIndex) + 1;
        existing = existing.slice(0, insertPoint) + content + '\n' + existing.slice(insertPoint);
        injected = true;
      }
    }

    if (!injected) {
      throw new Error(`Injection markers not found in ${filePath}`);
    }

    await fs.writeFile(filePath, existing, 'utf-8');
    return injected;
  }

  /**
   * Render and write in one operation
   */
  async generate(templatePath, context = {}, rdfData = null) {
    const renderResult = await this.render(templatePath, context, rdfData);
    
    if (renderResult.skipped) {
      return renderResult;
    }

    const writeResult = await this.writeOutput(renderResult);
    
    return {
      ...renderResult,
      writeResult
    };
  }

  /**
   * Get rendering statistics
   */
  getStats() {
    return {
      renders: this.stats.renders,
      errors: this.stats.errors,
      errorRate: this.stats.errors / Math.max(this.stats.renders, 1),
      uniqueVariables: this.stats.variables.size,
      uniqueTemplates: this.stats.templates.size,
      variables: Array.from(this.stats.variables),
      templates: Array.from(this.stats.templates)
    };
  }

  /**
   * Clear caches and reset stats
   */
  reset() {
    this.stats = {
      renders: 0,
      errors: 0,
      files: new Map(),
      variables: new Set(),
      templates: new Set()
    };

    // Clear Nunjucks cache
    if (this.env.loaders) {
      this.env.loaders.forEach(loader => {
        if (loader.cache) {
          loader.cache = {};
        }
      });
    }
  }

  /**
   * Check if template exists
   */
  templateExists(templatePath) {
    const fullPath = resolve(this.options.templatesDir, templatePath);
    return existsSync(fullPath);
  }

  /**
   * List available templates
   */
  async listTemplates() {
    const templates = [];
    
    const scanDir = async (dir, prefix = '') => {
      const entries = await fs.readdir(resolve(this.options.templatesDir, dir), 
        { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await scanDir(join(dir, entry.name), prefix + entry.name + '/');
        } else if (entry.name.endsWith('.njk') || entry.name.endsWith('.j2')) {
          templates.push(prefix + entry.name);
        }
      }
    };

    try {
      await scanDir('');
    } catch (error) {
      console.warn(`Could not scan templates directory: ${error.message}`);
    }

    return templates;
  }
}

/**
 * Factory function for template renderer
 */
export function createRenderer(options = {}) {
  return new TemplateRenderer(options);
}

export default TemplateRenderer;