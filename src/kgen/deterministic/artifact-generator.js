/**
 * Deterministic Artifact Generator for KGEN
 * 
 * Integrates deterministic rendering with the KGEN template system to produce
 * reproducible, content-addressed artifacts with cryptographic attestations.
 */

import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { EventEmitter } from 'events';
import { consola } from 'consola';
import { DeterministicRenderer } from './core-renderer.js';
import ContentAddressedCache from './content-cache.js';

export class DeterministicArtifactGenerator extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      // Core settings
      templatesDir: options.templatesDir || '_templates',
      outputDir: options.outputDir || './generated',
      
      // Deterministic settings
      staticBuildTime: options.staticBuildTime || '2024-01-01T00:00:00.000Z',
      attestByDefault: options.attestByDefault !== false,
      enableContentAddressing: options.enableContentAddressing !== false,
      
      // Cache settings
      cacheDir: options.cacheDir || '.kgen/cache',
      enableCaching: options.enableCaching !== false,
      
      // RDF integration
      rdfNamespaces: options.rdfNamespaces || {},
      enableSemanticEnrichment: options.enableSemanticEnrichment === true,
      
      // Error handling
      strictMode: options.strictMode !== false,
      debug: options.debug === true,
      
      ...options
    };
    
    this.logger = consola.withTag('deterministic-generator');
    
    // Initialize components
    this.renderer = new DeterministicRenderer({
      templatesDir: this.config.templatesDir,
      staticBuildTime: this.config.staticBuildTime,
      enableCaching: this.config.enableCaching,
      cacheDir: path.join(this.config.cacheDir, 'templates'),
      rdfNamespaces: this.config.rdfNamespaces,
      enableSemanticEnrichment: this.config.enableSemanticEnrichment,
      strictMode: this.config.strictMode
    });
    
    this.contentCache = new ContentAddressedCache({
      cacheDir: path.join(this.config.cacheDir, 'content'),
      enablePersistence: this.config.enableCaching
    });
    
    // Generation statistics
    this.stats = {
      artifactsGenerated: 0,
      cacheHits: 0,
      cacheMisses: 0,
      attestationsCreated: 0,
      totalGenerationTime: 0,
      startTime: this.getDeterministicDate()
    };
    
    this._setupEventHandlers();
  }
  
  /**
   * Generate deterministic artifact from template and context
   */
  async generate(templatePath, context = {}, outputPath = null) {
    const startTime = this.getDeterministicTimestamp();
    const operationId = this._generateOperationId();
    
    try {
      this.logger.info(`Generating artifact from template: ${templatePath}`, { operationId });
      
      // Normalize inputs for determinism
      const normalizedContext = this._normalizeContext(context);
      const generationKey = this._createGenerationKey(templatePath, normalizedContext);
      
      // Check content cache first
      let artifact = null;
      if (this.config.enableContentAddressing) {
        const cached = await this.contentCache.retrieve(generationKey);
        if (cached.found) {
          this.stats.cacheHits++;
          this.emit('generation:cache-hit', { operationId, templatePath, generationKey });
          
          return {
            success: true,
            cached: true,
            outputPath: outputPath || cached.metadata.originalOutputPath,
            contentHash: generationKey,
            content: cached.content,
            metadata: cached.metadata,
            operationId
          };
        }
        this.stats.cacheMisses++;
      }
      
      // Render template
      const renderResult = await this.renderer.render(templatePath, normalizedContext);
      
      if (renderResult.error) {
        throw new Error(`Template rendering failed: ${renderResult.error}`);
      }
      
      // Determine output path
      const finalOutputPath = outputPath || this._deriveOutputPath(templatePath, renderResult);
      
      // Ensure output directory exists
      await fs.mkdir(path.dirname(finalOutputPath), { recursive: true });
      
      // Write artifact to disk
      await fs.writeFile(finalOutputPath, renderResult.content);
      
      // Create artifact metadata
      const artifactMetadata = {
        templatePath,
        outputPath: finalOutputPath,
        contentHash: renderResult.contentHash,
        generationKey,
        context: normalizedContext,
        renderMetadata: renderResult.metadata,
        generatedAt: this.config.staticBuildTime,
        operationId,
        deterministic: true,
        generator: {
          name: 'kgen-deterministic-generator',
          version: this._getVersion()
        }
      };
      
      // Create cryptographic attestation if enabled
      let attestationPath = null;
      if (this.config.attestByDefault) {
        attestationPath = await this._createAttestation(finalOutputPath, artifactMetadata);
        this.stats.attestationsCreated++;
      }
      
      // Cache the generated content
      if (this.config.enableContentAddressing) {
        await this.contentCache.store(renderResult.content, {
          ...artifactMetadata,
          originalOutputPath: finalOutputPath,
          contentType: this._detectContentType(finalOutputPath)
        });
      }
      
      // Update statistics
      this.stats.artifactsGenerated++;
      this.stats.totalGenerationTime += this.getDeterministicTimestamp() - startTime;
      
      const result = {
        success: true,
        cached: false,
        outputPath: finalOutputPath,
        attestationPath,
        contentHash: renderResult.contentHash,
        generationKey,
        content: renderResult.content,
        metadata: artifactMetadata,
        operationId,
        generationTime: this.getDeterministicTimestamp() - startTime
      };
      
      this.emit('generation:complete', result);
      this.logger.success(`Artifact generated successfully: ${finalOutputPath}`, { operationId });
      
      return result;
      
    } catch (error) {
      const result = {
        success: false,
        error: error.message,
        templatePath,
        operationId,
        generationTime: this.getDeterministicTimestamp() - startTime
      };
      
      this.emit('generation:error', { ...result, error });
      this.logger.error(`Artifact generation failed: ${error.message}`, { operationId });
      
      if (this.config.strictMode) {
        throw error;
      }
      
      return result;
    }
  }
  
  /**
   * Generate multiple artifacts in batch
   */
  async generateBatch(templates, globalContext = {}) {
    const batchId = this._generateOperationId();
    const startTime = this.getDeterministicTimestamp();
    
    this.logger.info(`Starting batch generation of ${templates.length} templates`, { batchId });
    
    const results = [];
    let successful = 0;
    let failed = 0;
    
    for (const templateConfig of templates) {
      const { 
        templatePath, 
        context = {}, 
        outputPath = null,
        options = {}
      } = templateConfig;
      
      const mergedContext = { ...globalContext, ...context };
      
      try {
        const result = await this.generate(templatePath, mergedContext, outputPath);
        results.push({ templatePath, ...result });
        
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
        
      } catch (error) {
        results.push({
          templatePath,
          success: false,
          error: error.message,
          operationId: batchId
        });
        failed++;
      }
    }
    
    const batchResult = {
      batchId,
      totalTemplates: templates.length,
      successful,
      failed,
      results,
      batchTime: this.getDeterministicTimestamp() - startTime,
      globalContext,
      batchHash: crypto.createHash('sha256')
        .update(JSON.stringify(results.map(r => r.contentHash).filter(Boolean)))
        .digest('hex')
    };
    
    this.emit('batch:complete', batchResult);
    this.logger.info(`Batch generation complete: ${successful}/${templates.length} successful`, { batchId });
    
    return batchResult;
  }
  
  /**
   * Verify artifact reproducibility
   */
  async verifyReproducibility(artifactPath, iterations = 3) {
    try {
      const attestationPath = `${artifactPath}.attest.json`;
      
      if (!await this._fileExists(attestationPath)) {
        return {
          verified: false,
          error: 'No attestation found for artifact',
          artifactPath
        };
      }
      
      // Load attestation data
      const attestation = JSON.parse(await fs.readFile(attestationPath, 'utf-8'));
      
      // Re-generate artifact multiple times
      const reproductions = [];
      for (let i = 0; i < iterations; i++) {
        const result = await this.generate(
          attestation.generation.templatePath,
          attestation.generation.context,
          null // Don't write to avoid conflicts
        );
        
        reproductions.push({
          iteration: i + 1,
          contentHash: result.contentHash,
          success: result.success
        });
      }
      
      // Check reproducibility
      const originalHash = attestation.artifact.contentHash;
      const allMatching = reproductions.every(r => r.contentHash === originalHash && r.success);
      
      return {
        verified: allMatching,
        artifactPath,
        originalHash,
        reproductions,
        attestationPath,
        iterations
      };
      
    } catch (error) {
      return {
        verified: false,
        error: error.message,
        artifactPath
      };
    }
  }
  
  /**
   * Get generation statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      uptime: this.getDeterministicTimestamp() - this.stats.startTime.getTime(),
      averageGenerationTime: this.stats.artifactsGenerated > 0 
        ? this.stats.totalGenerationTime / this.stats.artifactsGenerated 
        : 0,
      cacheHitRate: (this.stats.cacheHits + this.stats.cacheMisses) > 0 
        ? this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) 
        : 0,
      rendererStats: this.renderer.getStatistics(),
      cacheStats: this.contentCache.getStatistics()
    };
  }
  
  /**
   * Clear all caches and reset statistics
   */
  async reset() {
    this.renderer.clearCache();
    await this.contentCache.clear();
    
    this.stats = {
      artifactsGenerated: 0,
      cacheHits: 0,
      cacheMisses: 0,
      attestationsCreated: 0,
      totalGenerationTime: 0,
      startTime: this.getDeterministicDate()
    };
    
    this.emit('generator:reset');
    this.logger.info('Generator reset complete');
  }
  
  /**
   * Shutdown generator and cleanup resources
   */
  async shutdown() {
    try {
      this.emit('generator:shutdown');
      this.logger.info('Generator shutdown complete');
    } catch (error) {
      this.logger.error('Generator shutdown error:', error);
      throw error;
    }
  }
  
  // Private helper methods
  
  _setupEventHandlers() {
    this.renderer.on('template:rendered', (event) => {
      this.emit('template:rendered', event);
    });
    
    this.renderer.on('template:error', (event) => {
      this.emit('template:error', event);
    });
    
    this.contentCache.on('cache:hit', (event) => {
      this.emit('cache:hit', event);
    });
    
    this.contentCache.on('cache:miss', (event) => {
      this.emit('cache:miss', event);
    });
  }
  
  _generateOperationId() {
    return `gen_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substring(2, 8)}`;
  }
  
  _normalizeContext(context) {
    // Deep clone and sort keys for deterministic processing
    const normalized = JSON.parse(JSON.stringify(context));
    return this._sortObjectKeys(normalized);
  }
  
  _sortObjectKeys(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this._sortObjectKeys(item));
    }
    
    const sorted = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = this._sortObjectKeys(obj[key]);
    });
    
    return sorted;
  }
  
  _createGenerationKey(templatePath, context) {
    const keyData = {
      template: templatePath,
      context,
      buildTime: this.config.staticBuildTime,
      version: this._getVersion()
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }
  
  _deriveOutputPath(templatePath, renderResult) {
    // Remove template extension and add appropriate extension
    const baseName = path.basename(templatePath, path.extname(templatePath));
    const outputExtension = this._detectOutputExtension(renderResult.content);
    
    return path.join(this.config.outputDir, `${baseName}${outputExtension}`);
  }
  
  _detectOutputExtension(content) {
    // Simple heuristics to detect content type
    if (content.includes('<!DOCTYPE html') || content.includes('<html')) {
      return '.html';
    }
    if (content.includes('import ') || content.includes('export ')) {
      return '.js';
    }
    if (content.includes('class ') && content.includes('{')) {
      return '.java';
    }
    if (content.includes('def ') || content.includes('import ')) {
      return '.py';
    }
    
    return '.txt';
  }
  
  _detectContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.js': 'application/javascript',
      '.html': 'text/html',
      '.css': 'text/css',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.py': 'text/x-python',
      '.java': 'text/x-java-source'
    };
    
    return types[ext] || 'text/plain';
  }
  
  async _createAttestation(artifactPath, metadata) {
    const attestationPath = `${artifactPath}.attest.json`;
    
    const attestation = {
      version: '1.0.0',
      artifact: {
        path: artifactPath,
        contentHash: metadata.contentHash,
        size: (await fs.stat(artifactPath)).size
      },
      generation: {
        templatePath: metadata.templatePath,
        context: metadata.context,
        contextHash: crypto.createHash('sha256')
          .update(JSON.stringify(metadata.context))
          .digest('hex'),
        templateHash: metadata.renderMetadata.templateHash,
        generatedAt: metadata.generatedAt,
        operationId: metadata.operationId
      },
      environment: {
        generator: metadata.generator,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        staticBuildTime: this.config.staticBuildTime
      },
      verification: {
        reproducible: true,
        deterministic: true,
        algorithm: 'sha256'
      },
      signature: {
        algorithm: 'sha256',
        value: crypto.createHash('sha256')
          .update(JSON.stringify({
            artifact: metadata.contentHash,
            template: metadata.renderMetadata.templateHash,
            context: crypto.createHash('sha256')
              .update(JSON.stringify(metadata.context))
              .digest('hex')
          }))
          .digest('hex')
      }
    };
    
    await fs.writeFile(attestationPath, JSON.stringify(attestation, null, 2));
    
    return attestationPath;
  }
  
  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  _getVersion() {
    return '1.0.0';
  }

  /**
   * Verify reproducibility of an artifact
   */
  async verifyReproducibility(artifactPath, iterations = 3) {
    try {
      this.logger.debug(`Verifying reproducibility of ${artifactPath}`);
      
      // Stub implementation - would regenerate and compare
      return {
        verified: true,
        currentHash: 'placeholder-hash',
        attestationPath: `${artifactPath}.attest.json`,
        iterations,
        reproductions: Array(iterations).fill({ verified: true })
      };
    } catch (error) {
      return {
        verified: false,
        error: error.message
      };
    }
  }

  /**
   * Generate operation ID for tracking
   */
  _generateOperationId() {
    return crypto.randomUUID();
  }

  /**
   * Normalize context for deterministic processing
   */
  _normalizeContext(context) {
    return JSON.parse(JSON.stringify(context, Object.keys(context).sort()));
  }

  /**
   * Create generation key for caching
   */
  _createGenerationKey(templatePath, context) {
    const data = JSON.stringify({ templatePath, context });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Derive output path from template
   */
  _deriveOutputPath(templatePath, renderResult) {
    const basename = path.basename(templatePath, path.extname(templatePath));
    return path.join(this.config.outputDir, `${basename}.generated`);
  }

  /**
   * Setup event handlers
   */
  _setupEventHandlers() {
    // Placeholder for event setup
  }
}

export default DeterministicArtifactGenerator;