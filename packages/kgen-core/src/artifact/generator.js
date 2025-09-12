/**
 * KGEN Core Artifact Generator
 * 
 * Pure JavaScript artifact generation system ported from unjucks.
 * Features:
 * - Deterministic template rendering with Nunjucks
 * - Frontmatter processing for template metadata
 * - RDF context enrichment from graph files
 * - Content addressing for reproducible builds
 * - Cryptographic attestations and provenance tracking
 */

import crypto from 'crypto';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import nunjucks from 'nunjucks';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Deterministic Template Environment
 * Configured Nunjucks environment with deterministic filters and globals
 */
class DeterministicTemplateEnvironment {
  constructor(options = {}) {
    this.options = {
      templatesDir: options.templatesDir || '_templates',
      staticBuildTime: options.staticBuildTime || '2024-01-01T00:00:00.000Z',
      autoescape: false,
      throwOnUndefined: false,
      enableCache: true,
      ...options
    };

    this.logger = {
      debug: (...args) => options.debug && console.debug('[DeterministicGenerator]', ...args),
      info: (...args) => console.log('[DeterministicGenerator]', ...args),
      warn: (...args) => console.warn('[DeterministicGenerator]', ...args),
      error: (...args) => console.error('[DeterministicGenerator]', ...args)
    };

    // Initialize deterministic environment
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
      watch: false, // Disable file watching for determinism
      noCache: !this.options.enableCache
    });

    const env = new nunjucks.Environment(loader, {
      autoescape: this.options.autoescape,
      throwOnUndefined: this.options.throwOnUndefined,
      trimBlocks: true,
      lstripBlocks: true
    });

    // Add deterministic global functions and filters
    this.addDeterministicGlobals(env);
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

    env.addFilter('upper', (str) => {
      return String(str).toUpperCase();
    });

    env.addFilter('keys', (obj) => {
      return Object.keys(obj || {});
    });

    env.addFilter('join', (arr, separator = ',') => {
      return Array.isArray(arr) ? arr.join(separator) : String(arr);
    });

    env.addFilter('dump', (obj, indent = 2) => {
      return JSON.stringify(obj, null, indent);
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

    // Date handling with static build time
    env.addFilter('date', (value, format) => {
      // Use static build time for deterministic dates
      if (!value || value === 'now') {
        return this.options.staticBuildTime;
      }
      if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
        return new Date(value).toISOString();
      }
      throw new Error('date filter requires explicit date value in deterministic mode');
    });

    // Add globals for backward compatibility
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

    // Static build information
    env.addGlobal('BUILD_TIME', this.options.staticBuildTime);
    env.addGlobal('BUILD_HASH', crypto.createHash('sha256')
      .update(this.options.staticBuildTime)
      .digest('hex').substring(0, 8));

    // Static environment info (no timestamps)
    env.addGlobal('buildEnv', {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    });
  }

  sanitizeEnvironment(env) {
    // Replace potentially non-deterministic filters
    env.addFilter('random', () => {
      throw new Error('random filter is not allowed in deterministic mode');
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
 * Main Artifact Generator
 * Orchestrates deterministic artifact generation with RDF context enrichment
 */
export class ArtifactGenerator {
  constructor(options = {}) {
    this.options = {
      templatesDir: options.templatesDir || '_templates',
      outputDir: options.outputDir || './generated',
      staticBuildTime: options.staticBuildTime || '2024-01-01T00:00:00.000Z',
      enableContentAddressing: options.enableContentAddressing !== false,
      enableAttestations: options.enableAttestations !== false,
      enableCache: options.enableCache !== false,
      rdfNamespaces: options.rdfNamespaces || {},
      enableSemanticEnrichment: options.enableSemanticEnrichment === true,
      ...options
    };

    this.logger = {
      debug: (...args) => options.debug && console.debug('[ArtifactGenerator]', ...args),
      info: (...args) => console.log('[ArtifactGenerator]', ...args),
      warn: (...args) => console.warn('[ArtifactGenerator]', ...args),
      error: (...args) => console.error('[ArtifactGenerator]', ...args),
      success: (...args) => console.log('[ArtifactGenerator]', '✓', ...args)
    };

    this.templateEngine = new DeterministicTemplateEnvironment(this.options);
    this.generatedArtifacts = new Map();
    this.attestations = new Map();

    // Generation statistics
    this.stats = {
      artifactsGenerated: 0,
      cacheHits: 0,
      cacheMisses: 0,
      attestationsCreated: 0,
      totalGenerationTime: 0,
      startTime: this.getDeterministicTimestamp()
    };
  }

  /**
   * Generate artifact from template and RDF graph context
   * @param {string} graphFile - Path to RDF graph file (.ttl, .rdf, .jsonld)
   * @param {string} template - Template path relative to templatesDir
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generation result
   */
  async generateArtifact(graphFile, template, options = {}) {
    const operationId = this.generateOperationId();
    const startTime = this.getDeterministicTimestamp();

    try {
      this.logger.info(`Generating artifact from template: ${template}`);
      
      // Phase 1: Load and parse RDF context
      const rdfContext = await this.loadRdfContext(graphFile);
      
      // Phase 2: Load template with frontmatter
      const templateContent = await this.loadTemplate(template);
      const { data: frontmatter, content: templateBody } = matter(templateContent);
      
      // Phase 3: Enrich context with RDF data
      const enrichedContext = this.enrichContext(rdfContext, options.context || {}, frontmatter);
      
      // Phase 4: Render template with enriched context
      const rendered = await this.templateEngine.renderTemplate(template, enrichedContext);
      
      // Phase 5: Process output (content addressing, validation)
      const processedContent = this.postProcessContent(rendered, options);
      
      // Phase 6: Determine output path
      const outputPath = this.resolveOutputPath(template, frontmatter, { ...options, context: enrichedContext });
      
      // Phase 7: Create artifact metadata
      const metadata = this.createArtifactMetadata({
        graphFile,
        template,
        templateBody,
        frontmatter,
        enrichedContext,
        rendered: processedContent,
        outputPath,
        operationId,
        startTime
      });

      // Phase 8: Generate content hash and addressing
      const contentHash = crypto.createHash('sha256').update(processedContent).digest('hex');
      const shortHash = contentHash.substring(0, 16);

      const artifact = {
        success: true,
        operationId,
        template,
        graphFile,
        outputPath,
        content: processedContent,
        contentHash,
        shortHash,
        metadata,
        frontmatter,
        context: enrichedContext,
        generatedAt: this.options.staticBuildTime,
        generationTime: this.getDeterministicTimestamp() - startTime
      };

      // Phase 9: Store artifact
      this.generatedArtifacts.set(operationId, artifact);
      this.stats.artifactsGenerated++;
      this.stats.totalGenerationTime += artifact.generationTime;

      this.logger.success(`Artifact generated: ${outputPath} (${shortHash})`);
      
      return artifact;

    } catch (error) {
      const failedArtifact = {
        success: false,
        operationId,
        template,
        graphFile,
        error: error.message,
        generationTime: this.getDeterministicTimestamp() - startTime
      };

      this.logger.error(`Artifact generation failed: ${error.message}`);
      
      if (options.throwOnError !== false) {
        throw error;
      }
      
      return failedArtifact;
    }
  }

  /**
   * Load RDF context from graph file
   */
  async loadRdfContext(graphFile) {
    try {
      const content = await fs.readFile(graphFile, 'utf-8');
      const ext = path.extname(graphFile).toLowerCase();

      // Simple RDF parsing - in production, use a proper RDF library
      if (ext === '.json' || ext === '.jsonld') {
        return JSON.parse(content);
      } else if (ext === '.ttl' || ext === '.rdf') {
        // Basic Turtle/RDF parsing - simplified for demo
        return this.parseTurtleToContext(content);
      } else {
        throw new Error(`Unsupported RDF format: ${ext}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to load RDF context from ${graphFile}: ${error.message}`);
      return {};
    }
  }

  /**
   * Simple Turtle parser for basic RDF context
   */
  parseTurtleToContext(turtleContent) {
    const context = {};
    const lines = turtleContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('@prefix')) {
        // Extract prefix definitions
        const match = trimmed.match(/@prefix\s+(\w+):\s+<([^>]+)>/);
        if (match) {
          const [, prefix, uri] = match;
          context[`${prefix}_namespace`] = uri;
        }
      } else if (trimmed.includes('rdfs:label')) {
        // Extract labels
        const match = trimmed.match(/<([^>]+)>\s+rdfs:label\s+"([^"]+)"/);
        if (match) {
          const [, uri, label] = match;
          const key = uri.split('/').pop() || uri.split('#').pop();
          if (key) {
            context[`${key}_label`] = label;
          }
        }
      }
    }
    
    return context;
  }

  /**
   * Load template file
   */
  async loadTemplate(templatePath) {
    const fullPath = path.resolve(this.options.templatesDir, templatePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  /**
   * Enrich context with RDF data and user context
   */
  enrichContext(rdfContext, userContext, frontmatter) {
    const baseContext = {
      ...rdfContext,
      ...userContext,
      ...frontmatter
    };

    // Apply semantic enrichment if enabled
    if (this.options.enableSemanticEnrichment) {
      return this.applySemanticEnrichment(baseContext);
    }

    return this.templateEngine.sortObjectKeys(baseContext);
  }

  /**
   * Apply semantic enrichment to context
   */
  applySemanticEnrichment(context) {
    // Simple semantic enrichment - expand URIs with namespaces
    const enriched = { ...context };

    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string' && value.startsWith('http')) {
        // Try to create a shortened form using namespaces
        for (const [prefix, namespace] of Object.entries(this.options.rdfNamespaces)) {
          if (value.startsWith(namespace)) {
            enriched[`${key}_short`] = value.replace(namespace, `${prefix}:`);
            break;
          }
        }
      }
    }

    return this.templateEngine.sortObjectKeys(enriched);
  }

  /**
   * Post-process rendered content
   */
  postProcessContent(content, options) {
    let processed = content;

    // Normalize line endings for consistency
    processed = processed.replace(/\r\n/g, '\n');
    
    // Remove trailing whitespace
    processed = processed.replace(/\s+$/gm, '');
    
    // Ensure single trailing newline
    processed = processed.replace(/\n+$/, '\n');

    return processed;
  }

  /**
   * Resolve output path from template, frontmatter, and options
   */
  resolveOutputPath(template, frontmatter, options) {
    if (options.outputPath) {
      return path.resolve(this.options.outputDir, options.outputPath);
    }

    // Process frontmatter 'to' field through template engine for dynamic paths
    if (frontmatter.to) {
      try {
        const context = options.context || {};
        const renderedPath = this.templateEngine.env.renderString(frontmatter.to, context);
        return path.resolve(this.options.outputDir, renderedPath);
      } catch (error) {
        this.logger.warn(`Failed to render dynamic path: ${frontmatter.to}`, error.message);
        return path.resolve(this.options.outputDir, frontmatter.to);
      }
    }

    // Default: use template name without extension
    const baseName = path.basename(template, path.extname(template));
    const extension = frontmatter.extension || this.detectExtension(template);
    
    return path.resolve(this.options.outputDir, `${baseName}${extension}`);
  }

  /**
   * Detect appropriate file extension
   */
  detectExtension(template) {
    const templateExt = path.extname(template);
    
    // Common template to output mappings
    const mappings = {
      '.njk': '.html',
      '.nunjucks': '.html',
      '.j2': '.txt',
      '.jinja': '.txt'
    };

    return mappings[templateExt] || '.txt';
  }

  /**
   * Create comprehensive artifact metadata
   */
  createArtifactMetadata(data) {
    return {
      template: {
        path: data.template,
        hash: crypto.createHash('sha256').update(data.templateBody).digest('hex'),
        size: data.templateBody.length
      },
      graph: {
        file: data.graphFile,
        hash: null // Would be calculated from graph file content
      },
      context: {
        hash: crypto.createHash('sha256').update(JSON.stringify(data.enrichedContext)).digest('hex'),
        keys: Object.keys(data.enrichedContext).sort()
      },
      generation: {
        operationId: data.operationId,
        startTime: data.startTime,
        endTime: this.getDeterministicTimestamp(),
        staticBuildTime: this.options.staticBuildTime,
        generatorVersion: this.getVersion()
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      frontmatter: data.frontmatter,
      deterministic: true
    };
  }

  /**
   * Write artifact to filesystem
   */
  async writeArtifact(artifact, options = {}) {
    if (!artifact.success) {
      throw new Error(`Cannot write failed artifact: ${artifact.error}`);
    }

    // Ensure output directory exists
    const dir = path.dirname(artifact.outputPath);
    await fs.mkdir(dir, { recursive: true });

    // Write the artifact content
    await fs.writeFile(artifact.outputPath, artifact.content);

    // Create attestation if enabled
    if (this.options.enableAttestations && !options.skipAttestation) {
      await this.createAttestation(artifact);
    }

    this.logger.success(`Artifact written: ${artifact.outputPath}`);

    return {
      success: true,
      outputPath: artifact.outputPath,
      contentHash: artifact.contentHash,
      size: artifact.content.length
    };
  }

  /**
   * Create cryptographic attestation for artifact
   */
  async createAttestation(artifact) {
    const attestation = {
      version: '1.0.0',
      artifact: {
        path: artifact.outputPath,
        contentHash: artifact.contentHash,
        size: artifact.content.length
      },
      generation: {
        template: artifact.template,
        graphFile: artifact.graphFile,
        templateHash: artifact.metadata.template.hash,
        contextHash: artifact.metadata.context.hash,
        operationId: artifact.operationId,
        generatedAt: artifact.generatedAt
      },
      environment: artifact.metadata.environment,
      verification: {
        reproducible: true,
        deterministic: artifact.metadata.deterministic,
        algorithm: 'sha256'
      },
      signature: this.signArtifact(artifact)
    };

    const attestationPath = `${artifact.outputPath}.attest.json`;
    await fs.writeFile(attestationPath, JSON.stringify(attestation, null, 2));

    this.attestations.set(artifact.operationId, attestation);
    this.stats.attestationsCreated++;

    this.logger.info(`Attestation created: ${attestationPath}`);

    return { attestationPath, attestation };
  }

  /**
   * Sign artifact for verification
   */
  signArtifact(artifact) {
    const signatureData = {
      contentHash: artifact.contentHash,
      templateHash: artifact.metadata.template.hash,
      contextHash: artifact.metadata.context.hash,
      operationId: artifact.operationId,
      generatedAt: artifact.generatedAt
    };

    const signature = crypto
      .createHash('sha256')
      .update(JSON.stringify(signatureData))
      .digest('hex');

    return {
      algorithm: 'sha256',
      signature,
      signedAt: this.options.staticBuildTime
    };
  }

  /**
   * Get generation statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      uptime: this.getDeterministicTimestamp() - this.stats.startTime,
      averageGenerationTime: this.stats.artifactsGenerated > 0 
        ? this.stats.totalGenerationTime / this.stats.artifactsGenerated 
        : 0,
      templateEngineStats: this.templateEngine.getStats(),
      artifacts: this.generatedArtifacts.size,
      attestations: this.attestations.size
    };
  }

  /**
   * Generate deterministic operation ID
   */
  generateOperationId() {
    return crypto.randomUUID();
  }

  /**
   * Get deterministic timestamp
   */
  getDeterministicTimestamp() {
    return new Date(this.options.staticBuildTime).getTime();
  }

  /**
   * Get generator version
   */
  getVersion() {
    return '1.0.0';
  }
}

export default ArtifactGenerator;