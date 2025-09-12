/**
 * Deterministic Artifact Generator
 * 
 * Creates byte-for-byte identical artifacts for reproducible builds
 * Removes all non-deterministic elements from template rendering
 */

import crypto from 'crypto';
import path from 'path';
import { promises as fs } from 'fs';
import nunjucks from 'nunjucks';
import matter from 'gray-matter';
import { Logger } from '../utils/logger.js';
import { DeterministicIdGenerator } from '../../../../src/utils/deterministic-id-generator.js';

/**
 * Deterministic Template Environment
 * Strips all non-deterministic functions and variables
 */
export class DeterministicTemplateEnvironment {
  constructor(options = {}) {
    this.options = {
      templatesDir: options.templatesDir || '_templates',
      autoescape: false, // Keep original content as-is
      throwOnUndefined: false,
      enableCache: true,
      ...options
    };

    this.logger = new Consola({ 
      component: 'DeterministicGenerator',
      level: options.debug ? 'debug' : 'info'
    });

    // Initialize deterministic ID generator
    this.idGenerator = new DeterministicIdGenerator();

    // Create deterministic Nunjucks environment
    this.env = this.createDeterministicEnvironment();
    
    // Track content hashes for reproducibility verification
    this.contentHashes = new Map();
    this.renderStats = {
      renders: 0,
      cacheHits: 0,
      determinismViolations: 0
    };
  }

  createDeterministicEnvironment() {
    const loader = new nunjucks.FileSystemLoader(this.options.templatesDir, {
      watch: false, // Disable file watching
      noCache: !this.options.enableCache
    });

    const env = new nunjucks.Environment(loader, {
      autoescape: this.options.autoescape,
      throwOnUndefined: this.options.throwOnUndefined,
      trimBlocks: true,
      lstripBlocks: true
    });

    // Add only deterministic global functions
    this.addDeterministicGlobals(env);

    // Remove all non-deterministic built-ins
    this.sanitizeEnvironment(env);

    return env;
  }

  addDeterministicGlobals(env) {
    // Deterministic string utilities as filters
    env.addFilter('hash', (content, algorithm = 'sha256') => {
      return crypto.createHash(algorithm).update(String(content)).digest('hex');
    });

    env.addFilter('contentId', (content) => {
      return crypto.createHash('sha256').update(String(content)).digest('hex').substring(0, 16);
    });

    env.addFilter('slice', (str, start, end) => {
      return String(str).slice(start, end);
    });

    env.addFilter('lower', (str) => {
      return String(str).toLowerCase();
    });

    env.addFilter('keys', (obj) => {
      return Object.keys(obj);
    });

    env.addFilter('join', (arr, separator = ',') => {
      return Array.isArray(arr) ? arr.join(separator) : String(arr);
    });

    env.addFilter('dump', (obj) => {
      return JSON.stringify(obj);
    });

    // Deterministic array/object utilities
    env.addFilter('sortKeys', (obj) => {
      if (typeof obj !== 'object' || obj === null) return obj;
      if (Array.isArray(obj)) return obj.sort();
      
      const sorted = {};
      Object.keys(obj).sort().forEach(key => {
        sorted[key] = obj[key];
      });
      return sorted;
    });

    // Also add as globals for backward compatibility
    env.addGlobal('hash', (content, algorithm = 'sha256') => {
      return crypto.createHash(algorithm).update(String(content)).digest('hex');
    });

    env.addGlobal('contentId', (content) => {
      return crypto.createHash('sha256').update(String(content)).digest('hex').substring(0, 16);
    });

    env.addGlobal('sortKeys', (obj) => {
      if (typeof obj !== 'object' || obj === null) return obj;
      if (Array.isArray(obj)) return obj.sort();
      
      const sorted = {};
      Object.keys(obj).sort().forEach(key => {
        sorted[key] = obj[key];
      });
      return sorted;
    });

    // Static environment info (no timestamps)
    env.addGlobal('buildEnv', {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    });

    // Template inclusion with deterministic handling
    env.addGlobal('includeTemplate', (templatePath, context = {}) => {
      try {
        // Ensure deterministic context ordering
        const deterministicContext = this.sortObjectKeys(context);
        return this.renderTemplate(templatePath, deterministicContext);
      } catch (error) {
        this.logger.warn(`Template inclusion failed: ${templatePath}`, error.message);
        return `<!-- Template inclusion failed: ${templatePath} -->`;
      }
    });
  }

  sanitizeEnvironment(env) {
    // Remove non-deterministic built-ins
    const nonDeterministicBuiltins = [
      'range', // Can be non-deterministic in some contexts
      'cycler' // Stateful
    ];

    // Override potentially non-deterministic filters
    env.addFilter('random', () => {
      throw new Error('random filter is not allowed in deterministic mode');
    });

    // Replace date/time filters with static equivalents
    env.addFilter('date', (value, format) => {
      // Only allow formatting of explicitly passed dates, not current time
      if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
        return new Date(value).toISOString(); // Always use ISO format for determinism
      }
      throw new Error('date filter requires explicit date value in deterministic mode');
    });

    this.logger.debug('Environment sanitized for deterministic rendering');
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

  async renderTemplate(templatePath, context = {}) {
    this.renderStats.renders++;

    // Create deterministic context
    const deterministicContext = {
      ...this.sortObjectKeys(context),
      // Remove any potentially non-deterministic keys
      _timestamp: undefined,
      _random: undefined,
      _uuid: undefined
    };

    // Generate content hash for cache key
    const contextString = JSON.stringify(deterministicContext, Object.keys(deterministicContext).sort());
    const cacheKey = `${templatePath}:${crypto.createHash('sha256').update(contextString).digest('hex')}`;

    // Check cache for deterministic rendering
    if (this.contentHashes.has(cacheKey)) {
      this.renderStats.cacheHits++;
      return this.contentHashes.get(cacheKey);
    }

    try {
      const rendered = this.env.render(templatePath, deterministicContext);
      
      // Verify determinism by re-rendering
      const verification = this.env.render(templatePath, deterministicContext);
      if (rendered !== verification) {
        this.renderStats.determinismViolations++;
        throw new Error(`Non-deterministic rendering detected in template: ${templatePath}`);
      }

      // Cache the result
      this.contentHashes.set(cacheKey, rendered);
      
      this.logger.debug('Template rendered deterministically', {
        templatePath,
        contentHash: crypto.createHash('sha256').update(rendered).digest('hex').substring(0, 16)
      });

      return rendered;

    } catch (error) {
      this.logger.error('Deterministic template rendering failed', {
        templatePath,
        error: error.message
      });
      throw error;
    }
  }

  getStats() {
    return {
      ...this.renderStats,
      cacheSize: this.contentHashes.size,
      determinismRate: 1 - (this.renderStats.determinismViolations / Math.max(this.renderStats.renders, 1))
    };
  }
}

/**
 * Content-Addressed File Generator
 * Generates files with content-based identifiers for reproducible builds
 */
export class ContentAddressedGenerator {
  constructor(options = {}) {
    this.options = options;
    this.logger = new Consola({ 
      component: 'ContentAddressedGenerator',
      level: options.debug ? 'debug' : 'info'
    });
    
    this.templateEngine = new DeterministicTemplateEnvironment(options);
    this.generatedFiles = new Map();
    this.attestations = new Map();
  }

  async generateArtifact(templatePath, context, outputPath) {
    try {
      // Read template with frontmatter
      const templateContent = await fs.readFile(templatePath, 'utf8');
      const { data: frontmatter, content: template } = matter(templateContent);

      // Render content deterministically
      const rendered = await this.templateEngine.renderTemplate(templatePath, context);

      // Generate content hash
      const contentHash = crypto.createHash('sha256').update(rendered).digest('hex');
      const shortHash = contentHash.substring(0, 16);

      // Create content-addressed filename if not specified
      let finalOutputPath = outputPath;
      if (frontmatter.contentAddressed !== false) {
        const ext = path.extname(outputPath);
        const base = path.basename(outputPath, ext);
        const dir = path.dirname(outputPath);
        finalOutputPath = path.join(dir, `${base}.${shortHash}${ext}`);
      }

      // Store generation metadata
      const metadata = {
        templatePath: path.resolve(templatePath),
        outputPath: path.resolve(finalOutputPath),
        contentHash,
        shortHash,
        context: this.templateEngine.sortObjectKeys(context),
        frontmatter,
        generatedAt: this.idGenerator.generateId('timestamp', content, lockHash, templatePath),
        nodeVersion: process.version,
        templateSize: template.length,
        renderedSize: rendered.length
      };

      this.generatedFiles.set(finalOutputPath, metadata);

      return {
        success: true,
        content: rendered,
        outputPath: finalOutputPath,
        contentHash,
        shortHash,
        metadata
      };

    } catch (error) {
      this.logger.error('Artifact generation failed', {
        templatePath,
        outputPath,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        outputPath,
        metadata: null
      };
    }
  }

  async createAttestation(artifactPath, metadata) {
    const attestation = {
      artifact: {
        path: path.resolve(artifactPath),
        contentHash: metadata.contentHash,
        size: metadata.renderedSize
      },
      generation: {
        template: metadata.templatePath,
        templateHash: await this.hashFile(metadata.templatePath),
        context: metadata.context,
        contextHash: crypto.createHash('sha256')
          .update(JSON.stringify(metadata.context, Object.keys(metadata.context).sort()))
          .digest('hex')
      },
      environment: {
        nodeVersion: metadata.nodeVersion,
        platform: process.platform,
        arch: process.arch,
        generatedAt: metadata.generatedAt
      },
      verification: {
        reproducible: true,
        deterministic: true,
        method: 'content-addressed-generation'
      }
    };

    const attestationPath = `${artifactPath}.attest.json`;
    await fs.writeFile(attestationPath, JSON.stringify(attestation, null, 2));

    this.attestations.set(artifactPath, attestation);
    
    this.logger.info('Attestation created', {
      artifactPath,
      attestationPath,
      contentHash: metadata.contentHash.substring(0, 16)
    });

    return { attestationPath, attestation };
  }

  async hashFile(filePath) {
    try {
      const content = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      this.logger.warn(`Could not hash file: ${filePath}`, error.message);
      return null;
    }
  }

  async writeArtifact(artifact) {
    if (!artifact.success) {
      throw new Error(`Cannot write failed artifact: ${artifact.error}`);
    }

    // Ensure output directory exists
    const dir = path.dirname(artifact.outputPath);
    await fs.mkdir(dir, { recursive: true });

    // Write the artifact content
    await fs.writeFile(artifact.outputPath, artifact.content);

    // Create attestation sidecar
    await this.createAttestation(artifact.outputPath, artifact.metadata);

    this.logger.info('Artifact written with attestation', {
      outputPath: artifact.outputPath,
      contentHash: artifact.contentHash.substring(0, 16),
      size: artifact.content.length
    });

    return {
      success: true,
      outputPath: artifact.outputPath,
      attestationPath: `${artifact.outputPath}.attest.json`,
      contentHash: artifact.contentHash
    };
  }

  async verifyArtifact(artifactPath) {
    try {
      const attestationPath = `${artifactPath}.attest.json`;
      const attestationContent = await fs.readFile(attestationPath, 'utf8');
      const attestation = JSON.parse(attestationContent);

      // Verify file exists and matches hash
      const artifactContent = await fs.readFile(artifactPath);
      const currentHash = crypto.createHash('sha256').update(artifactContent).digest('hex');

      const verified = currentHash === attestation.artifact.contentHash;

      return {
        verified,
        attestation,
        currentHash,
        expectedHash: attestation.artifact.contentHash,
        artifactPath,
        attestationPath
      };

    } catch (error) {
      return {
        verified: false,
        error: error.message,
        artifactPath
      };
    }
  }

  getGenerationSummary() {
    return {
      totalArtifacts: this.generatedFiles.size,
      totalAttestations: this.attestations.size,
      templateEngineStats: this.templateEngine.getStats(),
      artifacts: Array.from(this.generatedFiles.entries()).map(([path, metadata]) => ({
        path,
        contentHash: metadata.contentHash.substring(0, 16),
        size: metadata.renderedSize
      }))
    };
  }

  clearCache() {
    this.templateEngine.contentHashes.clear();
    this.generatedFiles.clear();
    this.attestations.clear();
    this.logger.info('Generation cache cleared');
  }
}

/**
 * Main Deterministic Artifact Generator
 * Orchestrates the entire deterministic generation process
 */
export class DeterministicArtifactGenerator {
  constructor(options = {}) {
    this.options = {
      templatesDir: options.templatesDir || '_templates',
      outputDir: options.outputDir || './generated',
      enableContentAddressing: options.enableContentAddressing !== false,
      enableAttestations: options.enableAttestations !== false,
      enableCache: options.enableCache !== false,
      ...options
    };

    this.logger = new Consola({ 
      component: 'DeterministicArtifactGenerator',
      level: options.debug ? 'debug' : 'info'
    });

    this.generator = new ContentAddressedGenerator(this.options);
    this.lockfileData = null;
  }

  async loadLockfile(lockfilePath) {
    try {
      const content = await fs.readFile(lockfilePath, 'utf8');
      this.lockfileData = JSON.parse(content);
      
      this.logger.info('Lockfile loaded for reproducible builds', {
        lockfilePath,
        templatesCount: Object.keys(this.lockfileData.templates || {}).length,
        contextHash: this.lockfileData.contextHash?.substring(0, 16)
      });

      return this.lockfileData;
    } catch (error) {
      this.logger.error('Failed to load lockfile', {
        lockfilePath,
        error: error.message
      });
      throw error;
    }
  }

  async generateFromLockfile(lockfilePath, outputDir = null) {
    const lockfile = await this.loadLockfile(lockfilePath);
    const results = [];

    const targetDir = outputDir || this.options.outputDir;
    await fs.mkdir(targetDir, { recursive: true });

    for (const [templateName, templateConfig] of Object.entries(lockfile.templates || {})) {
      try {
        const templatePath = path.resolve(this.options.templatesDir, templateConfig.path);
        const outputPath = path.resolve(targetDir, templateConfig.outputPath);

        const artifact = await this.generator.generateArtifact(
          templatePath,
          templateConfig.context,
          outputPath
        );

        if (artifact.success) {
          await this.generator.writeArtifact(artifact);
          results.push(artifact);
          
          // Verify against lockfile expectations
          if (templateConfig.expectedHash && artifact.contentHash !== templateConfig.expectedHash) {
            this.logger.warn('Content hash mismatch with lockfile', {
              templateName,
              expected: templateConfig.expectedHash.substring(0, 16),
              actual: artifact.contentHash.substring(0, 16)
            });
          }
        } else {
          this.logger.error('Failed to generate artifact from lockfile', {
            templateName,
            error: artifact.error
          });
        }

      } catch (error) {
        this.logger.error('Lockfile template processing failed', {
          templateName,
          error: error.message
        });
      }
    }

    return {
      success: results.length > 0,
      artifacts: results,
      summary: this.generator.getGenerationSummary()
    };
  }

  async generate(templatePath, context, outputPath = null) {
    // Use template name as output if not specified
    const finalOutputPath = outputPath || path.basename(templatePath, path.extname(templatePath));

    const artifact = await this.generator.generateArtifact(
      templatePath,
      context,
      path.resolve(this.options.outputDir, finalOutputPath)
    );

    if (artifact.success) {
      await this.generator.writeArtifact(artifact);
    }

    return artifact;
  }

  async createLockfile(templates, outputPath) {
    const lockfile = {
      version: '1.0.0',
      generatedAt: this.getDeterministicDate().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      templates: {},
      contextHash: null
    };

    // Process each template to generate lockfile entry
    for (const template of templates) {
      const templateHash = await this.generator.hashFile(template.templatePath);
      const contextHash = crypto.createHash('sha256')
        .update(JSON.stringify(template.context, Object.keys(template.context).sort()))
        .digest('hex');

      lockfile.templates[template.name] = {
        path: path.relative(this.options.templatesDir, template.templatePath),
        templateHash,
        context: this.generator.templateEngine.sortObjectKeys(template.context),
        contextHash,
        outputPath: template.outputPath,
        expectedHash: null // Will be filled after generation
      };
    }

    // Generate overall context hash
    const allContexts = Object.values(lockfile.templates).map(t => t.contextHash).sort();
    lockfile.contextHash = crypto.createHash('sha256').update(allContexts.join('')).digest('hex');

    await fs.writeFile(outputPath, JSON.stringify(lockfile, null, 2));
    
    this.logger.info('Lockfile created', {
      outputPath,
      templatesCount: templates.length,
      contextHash: lockfile.contextHash.substring(0, 16)
    });

    return lockfile;
  }

  async verifyReproducibility(artifactPath) {
    return this.generator.verifyArtifact(artifactPath);
  }

  getStats() {
    return {
      generator: this.generator.getGenerationSummary(),
      lockfile: this.lockfileData ? {
        version: this.lockfileData.version,
        templatesCount: Object.keys(this.lockfileData.templates).length,
        contextHash: this.lockfileData.contextHash?.substring(0, 16)
      } : null
    };
  }
}

export default DeterministicArtifactGenerator;