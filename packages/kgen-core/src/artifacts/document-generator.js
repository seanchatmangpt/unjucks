/**
 * KGEN Document Artifact Generator
 * 
 * Integrates Office and LaTeX document generation into KGEN's deterministic
 * artifact pipeline with content addressing and attestation support.
 * 
 * @module artifacts/document-generator
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import consola from 'consola';

import { OfficeTemplateProcessor } from '../office/index.js';
import { KGENLaTeXIntegration } from '../latex/index.js';
import { AttestationBundler } from '../project/attestation-bundler.js';

/**
 * Document types supported by KGEN document generation
 */
export const DOCUMENT_TYPES = {
  LATEX: 'latex',
  WORD: 'word', 
  EXCEL: 'excel',
  POWERPOINT: 'powerpoint',
  PDF: 'pdf'
};

/**
 * Document template categories for enterprise use cases
 */
export const DOCUMENT_CATEGORIES = {
  COMPLIANCE: 'compliance',
  TECHNICAL: 'technical',
  BUSINESS: 'business',
  ACADEMIC: 'academic',
  LEGAL: 'legal'
};

/**
 * Enterprise document templates and their metadata
 */
export const ENTERPRISE_TEMPLATES = {
  'compliance-report': {
    type: DOCUMENT_TYPES.LATEX,
    category: DOCUMENT_CATEGORIES.COMPLIANCE,
    template: 'compliance/audit-report.tex.njk',
    description: 'Compliance audit report with attestations',
    requiredData: ['auditScope', 'findings', 'recommendations', 'attestations']
  },
  'technical-specification': {
    type: DOCUMENT_TYPES.LATEX,
    category: DOCUMENT_CATEGORIES.TECHNICAL,
    template: 'technical/specification.tex.njk', 
    description: 'Technical specification document',
    requiredData: ['title', 'abstract', 'requirements', 'architecture']
  },
  'data-matrix': {
    type: DOCUMENT_TYPES.EXCEL,
    category: DOCUMENT_CATEGORIES.COMPLIANCE,
    template: 'compliance/data-matrix.xlsx.njk',
    description: 'Compliance data tracking matrix',
    requiredData: ['controls', 'evidence', 'status']
  },
  'presentation-deck': {
    type: DOCUMENT_TYPES.POWERPOINT,
    category: DOCUMENT_CATEGORIES.BUSINESS,
    template: 'business/presentation.pptx.njk',
    description: 'Business presentation template',
    requiredData: ['title', 'slides', 'branding']
  }
};

/**
 * KGEN Document Artifact Generator
 * 
 * Provides deterministic document generation with content addressing,
 * reproducible builds, and enterprise compliance features.
 */
export class DocumentArtifactGenerator extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      // Core settings
      templatesDir: options.templatesDir || './_templates/documents',
      outputDir: options.outputDir || './generated/documents',
      cacheDir: options.cacheDir || './.kgen/cache/documents',
      
      // Document processing options
      enableContentAddressing: options.enableContentAddressing !== false,
      enableAttestations: options.enableAttestations !== false,
      compilePdf: options.compilePdf !== false,
      validateDocuments: options.validateDocuments !== false,
      
      // Enterprise features
      complianceMode: options.complianceMode || false,
      auditTrail: options.auditTrail !== false,
      signDocuments: options.signDocuments || false,
      
      // Performance options
      enableCache: options.enableCache !== false,
      parallelGeneration: options.parallelGeneration || false,
      
      ...options
    };
    
    this.logger = consola.withTag('document-generator');
    this.initialized = false;
    this.stats = {
      documentsGenerated: 0,
      cacheHits: 0,
      attestationsCreated: 0,
      compilationErrors: 0,
      validationErrors: 0
    };
  }
  
  /**
   * Initialize document generator and all processors
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      this.logger.info('Initializing KGEN document generator...');
      
      // Ensure directories exist
      await this.ensureDirectories();
      
      // Initialize Office processor
      this.officeProcessor = new OfficeTemplateProcessor({
        templatesDir: this.config.templatesDir,
        outputDir: this.config.outputDir,
        validation: {
          enabled: this.config.validateDocuments,
          level: this.config.complianceMode ? 'strict' : 'moderate'
        },
        debug: this.config.debug
      });
      
      // Initialize LaTeX integration
      this.latexProcessor = new KGENLaTeXIntegration({
        templatesDir: this.config.templatesDir,
        outputDir: this.config.outputDir,
        autoCompile: this.config.compilePdf,
        securityMode: this.config.complianceMode ? 'strict' : 'normal',
        validateOutput: this.config.validateDocuments
      });
      
      await this.latexProcessor.initialize();
      
      // Initialize attestation bundler for compliance
      if (this.config.enableAttestations || this.config.complianceMode) {
        this.attestationBundler = new AttestationBundler({
          outputDir: this.config.outputDir,
          compliance: this.config.complianceMode
        });
      }
      
      // Load template index
      await this.loadTemplateIndex();
      
      this.initialized = true;
      this.logger.success('Document generator initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize document generator:', error);
      throw error;
    }
  }
  
  /**
   * Generate document artifact from template specification
   * 
   * @param {Object} specification - Document specification
   * @returns {Promise<Object>} Generation result with artifact metadata
   */
  async generateDocument(specification) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const {
      template,
      type, 
      data,
      outputPath,
      category,
      compliance = this.config.complianceMode
    } = specification;
    
    const startTime = Date.now();
    
    try {
      this.logger.info(`Generating document artifact: ${template}`);
      
      // Validate specification
      await this.validateSpecification(specification);
      
      // Calculate content hash for deterministic generation
      const contextHash = this.calculateContextHash(data);
      const templateHash = await this.calculateTemplateHash(template);
      const artifactHash = this.calculateArtifactHash(template, contextHash, templateHash);
      
      // Check cache if enabled
      if (this.config.enableCache) {
        const cachedResult = await this.getCachedResult(artifactHash);
        if (cachedResult) {
          this.stats.cacheHits++;
          this.logger.debug(`Cache hit for artifact: ${artifactHash.substring(0, 8)}`);
          return cachedResult;
        }
      }
      
      // Determine output path with content addressing
      const finalOutputPath = this.determineOutputPath(
        outputPath,
        template,
        type,
        artifactHash
      );
      
      // Generate document based on type
      let result;
      switch (type) {
        case DOCUMENT_TYPES.LATEX:
          result = await this.generateLatexDocument(template, data, finalOutputPath, specification);
          break;
        case DOCUMENT_TYPES.WORD:
        case DOCUMENT_TYPES.EXCEL:
        case DOCUMENT_TYPES.POWERPOINT:
          result = await this.generateOfficeDocument(template, data, finalOutputPath, type, specification);
          break;
        default:
          throw new Error(`Unsupported document type: ${type}`);
      }
      
      // Add artifact metadata
      const artifact = {
        ...result,
        artifactId: artifactHash,
        contentHash: artifactHash,
        templateHash,
        contextHash,
        specification,
        generatedAt: new Date().toISOString(),
        generationTime: Date.now() - startTime,
        kgenVersion: process.env.KGEN_VERSION || '1.0.0',
        compliance: compliance || false
      };
      
      // Generate attestation if enabled
      if (this.config.enableAttestations || compliance) {
        artifact.attestation = await this.generateAttestation(artifact);
      }
      
      // Cache result if successful
      if (this.config.enableCache && result.success) {
        await this.cacheResult(artifactHash, artifact);
      }
      
      // Update statistics
      this.stats.documentsGenerated++;
      if (artifact.attestation) {
        this.stats.attestationsCreated++;
      }
      
      this.emit('documentGenerated', artifact);
      
      this.logger.success(`Document artifact generated: ${finalOutputPath}`);
      
      return artifact;
      
    } catch (error) {
      this.stats.validationErrors++;
      this.logger.error(`Document generation failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        specification,
        generatedAt: new Date().toISOString(),
        generationTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * Generate LaTeX document using integrated LaTeX processor
   */
  async generateLatexDocument(template, data, outputPath, specification) {
    try {
      const latexSpec = {
        type: 'document',
        template,
        data,
        compile: this.config.compilePdf
      };
      
      const result = await this.latexProcessor.generateDocument(latexSpec, {
        outputPath,
        strictValidation: specification.compliance
      });
      
      if (!result.success) {
        throw new Error(`LaTeX generation failed: ${result.error}`);
      }
      
      return {
        success: true,
        outputPath: result.document.path,
        pdfPath: result.compilation?.outputPath,
        content: result.document.content,
        validation: result.validation,
        compilation: result.compilation,
        metadata: result.metadata
      };
      
    } catch (error) {
      this.logger.error(`LaTeX document generation error: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generate Office document using integrated Office processor
   */
  async generateOfficeDocument(template, data, outputPath, type, specification) {
    try {
      const templatePath = path.resolve(this.config.templatesDir, template);
      
      const result = await this.officeProcessor.process(
        templatePath,
        data,
        outputPath
      );
      
      if (!result.success) {
        throw new Error(`Office document generation failed`);
      }
      
      return {
        success: true,
        outputPath: result.outputPath,
        validation: result.validation,
        stats: result.stats
      };
      
    } catch (error) {
      this.logger.error(`Office document generation error: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Batch generate multiple documents with parallel processing
   */
  async batchGenerate(specifications) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    this.logger.info(`Batch generating ${specifications.length} documents`);
    
    const results = [];
    
    if (this.config.parallelGeneration) {
      // Process in parallel with concurrency limit
      const concurrency = 3;
      for (let i = 0; i < specifications.length; i += concurrency) {
        const batch = specifications.slice(i, i + concurrency);
        const batchPromises = batch.map(spec => this.generateDocument(spec));
        const batchResults = await Promise.allSettled(batchPromises);
        
        results.push(...batchResults.map(r => 
          r.status === 'fulfilled' ? r.value : { success: false, error: r.reason.message }
        ));
      }
    } else {
      // Process sequentially
      for (const spec of specifications) {
        const result = await this.generateDocument(spec);
        results.push(result);
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    
    this.logger.info(`Batch generation completed: ${successful} successful, ${failed} failed`);
    
    return {
      total: results.length,
      successful,
      failed,
      results
    };
  }
  
  /**
   * Generate attestation for document compliance
   */
  async generateAttestation(artifact) {
    if (!this.attestationBundler) {
      return null;
    }
    
    try {
      const attestationData = {
        artifactId: artifact.artifactId,
        outputPath: artifact.outputPath,
        contentHash: artifact.contentHash,
        templateHash: artifact.templateHash,
        contextHash: artifact.contextHash,
        generatedAt: artifact.generatedAt,
        specification: artifact.specification,
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          kgenVersion: artifact.kgenVersion
        },
        compliance: {
          enabled: artifact.compliance,
          framework: artifact.specification.complianceFramework || 'enterprise',
          standards: artifact.specification.standards || []
        }
      };
      
      // Write attestation sidecar
      const attestationPath = `${artifact.outputPath}.attest.json`;
      await fs.writeFile(attestationPath, JSON.stringify(attestationData, null, 2));
      
      this.logger.debug(`Attestation created: ${attestationPath}`);
      
      return {
        path: attestationPath,
        data: attestationData
      };
      
    } catch (error) {
      this.logger.warn(`Failed to generate attestation: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Validate document specification
   */
  async validateSpecification(specification) {
    const { template, type, data } = specification;
    
    if (!template) {
      throw new Error('Template is required');
    }
    
    if (!type) {
      throw new Error('Document type is required');
    }
    
    if (!Object.values(DOCUMENT_TYPES).includes(type)) {
      throw new Error(`Unsupported document type: ${type}`);
    }
    
    // Check if template exists
    const templatePath = path.resolve(this.config.templatesDir, template);
    try {
      await fs.access(templatePath);
    } catch {
      throw new Error(`Template not found: ${templatePath}`);
    }
    
    // Validate required data for enterprise templates
    const enterpriseTemplate = Object.values(ENTERPRISE_TEMPLATES)
      .find(t => t.template === template);
    
    if (enterpriseTemplate && enterpriseTemplate.requiredData) {
      for (const field of enterpriseTemplate.requiredData) {
        if (!data || !data[field]) {
          throw new Error(`Required data field missing: ${field}`);
        }
      }
    }
  }
  
  /**
   * Calculate deterministic hash for artifact identification
   */
  calculateArtifactHash(template, contextHash, templateHash) {
    const hash = crypto.createHash('sha256');
    hash.update(template);
    hash.update(contextHash);
    hash.update(templateHash);
    hash.update(JSON.stringify({
      kgenVersion: process.env.KGEN_VERSION || '1.0.0',
      nodeVersion: process.version
    }));
    return hash.digest('hex');
  }
  
  /**
   * Calculate context data hash
   */
  calculateContextHash(data) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data, Object.keys(data).sort()));
    return hash.digest('hex');
  }
  
  /**
   * Calculate template file hash
   */
  async calculateTemplateHash(template) {
    const templatePath = path.resolve(this.config.templatesDir, template);
    const content = await fs.readFile(templatePath, 'utf8');
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
  }
  
  /**
   * Determine output path with optional content addressing
   */
  determineOutputPath(outputPath, template, type, artifactHash) {
    if (outputPath) {
      return path.resolve(this.config.outputDir, outputPath);
    }
    
    const baseName = path.basename(template, path.extname(template));
    const extension = this.getOutputExtension(type);
    
    if (this.config.enableContentAddressing) {
      const shortHash = artifactHash.substring(0, 8);
      return path.resolve(this.config.outputDir, `${baseName}-${shortHash}${extension}`);
    } else {
      return path.resolve(this.config.outputDir, `${baseName}${extension}`);
    }
  }
  
  /**
   * Get appropriate file extension for document type
   */
  getOutputExtension(type) {
    const extensions = {
      [DOCUMENT_TYPES.LATEX]: '.tex',
      [DOCUMENT_TYPES.WORD]: '.docx',
      [DOCUMENT_TYPES.EXCEL]: '.xlsx',
      [DOCUMENT_TYPES.POWERPOINT]: '.pptx',
      [DOCUMENT_TYPES.PDF]: '.pdf'
    };
    
    return extensions[type] || '.txt';
  }
  
  /**
   * Load and index available document templates
   */
  async loadTemplateIndex() {
    try {
      const indexPath = path.join(this.config.cacheDir, 'template-index.json');
      
      // Try to load existing index
      try {
        const indexContent = await fs.readFile(indexPath, 'utf8');
        this.templateIndex = JSON.parse(indexContent);
        this.logger.debug('Loaded template index from cache');
        return;
      } catch {
        // Index doesn't exist, create it
      }
      
      // Discover templates
      this.templateIndex = await this.discoverTemplates();
      
      // Cache the index
      await fs.writeFile(indexPath, JSON.stringify(this.templateIndex, null, 2));
      this.logger.debug('Created and cached template index');
      
    } catch (error) {
      this.logger.warn(`Failed to load template index: ${error.message}`);
      this.templateIndex = { templates: [], categories: {} };
    }
  }
  
  /**
   * Discover document templates in templates directory
   */
  async discoverTemplates() {
    const templates = [];
    const categories = {};
    
    try {
      const discover = async (dir, relative = '') => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.join(relative, entry.name);
          
          if (entry.isDirectory()) {
            await discover(fullPath, relativePath);
          } else if (this.isTemplateFile(entry.name)) {
            const template = await this.analyzeTemplate(fullPath, relativePath);
            templates.push(template);
            
            // Group by category
            const category = template.category || 'uncategorized';
            if (!categories[category]) {
              categories[category] = [];
            }
            categories[category].push(template);
          }
        }
      };
      
      await discover(this.config.templatesDir);
      
    } catch (error) {
      this.logger.warn(`Template discovery failed: ${error.message}`);
    }
    
    return { templates, categories };
  }
  
  /**
   * Check if file is a document template
   */
  isTemplateFile(filename) {
    const templateExtensions = ['.njk', '.nunjucks', '.tex.njk', '.docx.njk', '.xlsx.njk', '.pptx.njk'];
    return templateExtensions.some(ext => filename.endsWith(ext));
  }
  
  /**
   * Analyze template file and extract metadata
   */
  async analyzeTemplate(fullPath, relativePath) {
    try {
      const content = await fs.readFile(fullPath, 'utf8');
      const stats = await fs.stat(fullPath);
      
      // Extract frontmatter if present
      const frontmatter = this.extractFrontmatter(content);
      
      // Determine type from filename or frontmatter
      const type = frontmatter.type || this.detectTypeFromPath(relativePath);
      const category = frontmatter.category || this.detectCategoryFromPath(relativePath);
      
      return {
        path: relativePath,
        fullPath,
        type,
        category,
        name: frontmatter.name || path.basename(relativePath, path.extname(relativePath)),
        description: frontmatter.description,
        requiredData: frontmatter.requiredData || [],
        size: stats.size,
        modified: stats.mtime,
        frontmatter
      };
      
    } catch (error) {
      this.logger.warn(`Failed to analyze template ${relativePath}: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Extract frontmatter from template content
   */
  extractFrontmatter(content) {
    // Look for YAML frontmatter between --- blocks
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (frontmatterMatch) {
      try {
        // Simple YAML parsing - in production use proper YAML library
        const yaml = frontmatterMatch[1];
        const result = {};
        
        for (const line of yaml.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const colonIndex = trimmed.indexOf(':');
            if (colonIndex > 0) {
              const key = trimmed.substring(0, colonIndex).trim();
              let value = trimmed.substring(colonIndex + 1).trim();
              
              // Handle quoted strings and arrays
              if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
              } else if (value.startsWith('[') && value.endsWith(']')) {
                value = value.slice(1, -1).split(',').map(v => v.trim());
              }
              
              result[key] = value;
            }
          }
        }
        
        return result;
      } catch (error) {
        this.logger.warn(`Failed to parse frontmatter: ${error.message}`);
      }
    }
    
    return {};
  }
  
  /**
   * Detect document type from file path
   */
  detectTypeFromPath(relativePath) {
    if (relativePath.includes('.tex.')) return DOCUMENT_TYPES.LATEX;
    if (relativePath.includes('.docx.')) return DOCUMENT_TYPES.WORD;
    if (relativePath.includes('.xlsx.')) return DOCUMENT_TYPES.EXCEL;
    if (relativePath.includes('.pptx.')) return DOCUMENT_TYPES.POWERPOINT;
    return DOCUMENT_TYPES.LATEX; // Default to LaTeX
  }
  
  /**
   * Detect document category from file path
   */
  detectCategoryFromPath(relativePath) {
    const pathLower = relativePath.toLowerCase();
    if (pathLower.includes('compliance')) return DOCUMENT_CATEGORIES.COMPLIANCE;
    if (pathLower.includes('technical')) return DOCUMENT_CATEGORIES.TECHNICAL;
    if (pathLower.includes('business')) return DOCUMENT_CATEGORIES.BUSINESS;
    if (pathLower.includes('academic')) return DOCUMENT_CATEGORIES.ACADEMIC;
    if (pathLower.includes('legal')) return DOCUMENT_CATEGORIES.LEGAL;
    return 'general';
  }
  
  /**
   * Ensure required directories exist
   */
  async ensureDirectories() {
    const dirs = [
      this.config.templatesDir,
      this.config.outputDir,
      this.config.cacheDir
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }
  
  /**
   * Cache generation result
   */
  async cacheResult(artifactHash, result) {
    try {
      const cachePath = path.join(this.config.cacheDir, `${artifactHash}.json`);
      await fs.writeFile(cachePath, JSON.stringify(result, null, 2));
    } catch (error) {
      this.logger.warn(`Failed to cache result: ${error.message}`);
    }
  }
  
  /**
   * Get cached generation result
   */
  async getCachedResult(artifactHash) {
    try {
      const cachePath = path.join(this.config.cacheDir, `${artifactHash}.json`);
      const content = await fs.readFile(cachePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  
  /**
   * Get generation statistics
   */
  getStats() {
    return {
      ...this.stats,
      templatesDiscovered: this.templateIndex?.templates?.length || 0,
      categoriesAvailable: Object.keys(this.templateIndex?.categories || {}).length,
      initialized: this.initialized
    };
  }
  
  /**
   * List available templates
   */
  getAvailableTemplates(category = null) {
    if (!this.templateIndex) {
      return [];
    }
    
    if (category) {
      return this.templateIndex.categories[category] || [];
    }
    
    return this.templateIndex.templates || [];
  }
  
  /**
   * Get enterprise templates
   */
  getEnterpriseTemplates() {
    return ENTERPRISE_TEMPLATES;
  }
  
  /**
   * Cleanup resources
   */
  async cleanup() {
    this.logger.info('Cleaning up document generator...');
    
    if (this.officeProcessor) {
      await this.officeProcessor.cleanup();
    }
    
    if (this.latexProcessor) {
      await this.latexProcessor.cleanup();
    }
    
    this.removeAllListeners();
    
    this.logger.info('Document generator cleanup completed');
  }
}

export default DocumentArtifactGenerator;