/**
 * MCP Template Orchestrator - Enterprise Template Discovery & Rendering Pipeline
 * 
 * This orchestrator manages template operations via MCP integration:
 * - Template discovery across /templates and /_templates directories
 * - Registry with MCP-accessible metadata and semantic querying
 * - Rendering pipeline with MCPBridge integration
 * - Caching layer for performance optimization
 * 
 * Designed for Fortune 500 enterprise template management with RDF/Turtle
 * metadata support for semantic querying and JTBD workflow integration.
 */

import { EventEmitter } from 'node:events';
import path from 'node:path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { glob } from 'glob';
import matter from 'gray-matter';
import { createHash } from 'node:crypto';
import { MCPBridge, type SwarmTask, type JTBDWorkflow } from './mcp-integration.js';
import { Generator } from './generator.js';
import { RDFDataLoader } from './rdf-data-loader.js';
import type { 
  RDFDataSource, 
  RDFTemplateContext, 
  TurtleData 
} from './types/turtle-types.js';

/**
 * Template registry entry with enterprise metadata
 */
export interface TemplateRegistryEntry {
  id: string;
  name: string;
  path: string;
  category: 'microservice' | 'api-gateway' | 'data-pipeline' | 'compliance' | 'monitoring' | 'custom';
  description: string;
  jtbdJob: string; // Jobs-to-be-Done description
  variables: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
    defaultValue?: any;
  }>;
  injectionPoints: Array<{
    name: string;
    description: string;
    pattern: string;
    type: 'before' | 'after' | 'replace' | 'append' | 'prepend';
  }>;
  rdfMetadata?: {
    namespace: string;
    ontology: string;
    semanticTags: string[];
    relationships: Array<{
      subject: string;
      predicate: string;
      object: string;
    }>;
  };
  compliance?: {
    standards: string[];
    certifications: string[];
    auditTrail: boolean;
  };
  performance?: {
    renderTimeMs: number;
    cacheHit: boolean;
    lastUsed: string;
    usageCount: number;
  };
  frontmatter: Record<string, any>;
  files: string[];
  hash: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Template cache entry for performance optimization
 */
interface TemplateCacheEntry {
  template: TemplateRegistryEntry;
  renderedContent?: Map<string, string>; // variable hash -> rendered content
  lastAccess: number;
  hitCount: number;
  size: number;
}

/**
 * Enterprise template discovery configuration
 */
export interface TemplateOrchestratorConfig {
  templateDirs: string[];
  cacheEnabled: boolean;
  cacheMaxSize: number; // MB
  cacheTtl: number; // minutes
  mcpNamespace: string;
  rdfEnabled: boolean;
  complianceChecking: boolean;
  performanceTracking: boolean;
  debugMode: boolean;
}

/**
 * Template query interface for semantic search
 */
export interface TemplateQuery {
  category?: string;
  jtbdJob?: string;
  semanticTags?: string[];
  compliance?: string[];
  variables?: string[];
  text?: string; // full-text search
  rdfQuery?: string; // SPARQL query
}

/**
 * Template rendering context with enterprise features
 */
export interface EnterpriseRenderingContext {
  variables: Record<string, any>;
  rdfData?: RDFTemplateContext;
  complianceMode?: 'soc2' | 'hipaa' | 'gdpr' | 'none';
  auditTrail?: boolean;
  injectionMode?: 'safe' | 'force' | 'dry-run';
  targetEnvironment?: 'development' | 'staging' | 'production';
}

/**
 * MCP Template Orchestrator - Main Class
 */
export class MCPTemplateOrchestrator extends EventEmitter {
  private bridge: MCPBridge;
  private generator: Generator;
  private rdfLoader: RDFDataLoader;
  private registry: Map<string, TemplateRegistryEntry> = new Map();
  private cache: Map<string, TemplateCacheEntry> = new Map();
  private config: TemplateOrchestratorConfig;
  private isInitialized: boolean = false;
  private discoveryInProgress: boolean = false;

  constructor(bridge: MCPBridge, config: Partial<TemplateOrchestratorConfig> = {}) {
    super();
    
    this.bridge = bridge;
    this.generator = new Generator();
    this.rdfLoader = new RDFDataLoader();
    
    this.config = {
      templateDirs: [
        path.join(process.cwd(), 'templates'),
        path.join(process.cwd(), '_templates'),
        path.join(process.cwd(), 'templates', '_templates')
      ],
      cacheEnabled: true,
      cacheMaxSize: 100, // 100MB
      cacheTtl: 60, // 60 minutes
      mcpNamespace: 'hive/templates',
      rdfEnabled: true,
      complianceChecking: true,
      performanceTracking: true,
      debugMode: process.env.DEBUG_UNJUCKS === 'true',
      ...config
    };
  }

  /**
   * Initialize the orchestrator and discover all templates
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.log('Initializing MCP Template Orchestrator...');
      
      // Ensure template directories exist
      await this.ensureTemplateDirectories();
      
      // Discover and index all templates
      await this.discoverTemplates();
      
      // Setup MCP integration hooks
      await this.setupMCPHooks();
      
      // Initialize caching system
      this.setupCaching();
      
      // Store registry in MCP memory
      await this.storeRegistryInMCP();
      
      this.isInitialized = true;
      this.emit('initialized', this.registry.size);
      
      this.log(`Template Orchestrator initialized with ${this.registry.size} templates`);
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize Template Orchestrator: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Discover all templates in configured directories
   */
  async discoverTemplates(): Promise<TemplateRegistryEntry[]> {
    if (this.discoveryInProgress) {
      this.log('Discovery already in progress, waiting...');
      return Array.from(this.registry.values());
    }

    this.discoveryInProgress = true;
    const discoveries: TemplateRegistryEntry[] = [];

    try {
      this.log('Starting template discovery...');
      
      for (const templateDir of this.config.templateDirs) {
        if (await fs.pathExists(templateDir)) {
          const templates = await this.discoverInDirectory(templateDir);
          discoveries.push(...templates);
        }
      }

      this.log(`Discovered ${discoveries.length} templates total`);
      
      // Update registry
      for (const template of discoveries) {
        this.registry.set(template.id, template);
      }
      
      this.emit('templates-discovered', discoveries);
      return discoveries;
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Template discovery failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.discoveryInProgress = false;
    }
  }

  /**
   * Query templates using semantic search
   */
  async queryTemplates(query: TemplateQuery): Promise<TemplateRegistryEntry[]> {
    const results: TemplateRegistryEntry[] = [];
    
    try {
      for (const template of this.registry.values()) {
        let matches = true;

        // Category filter
        if (query.category && template.category !== query.category) {
          matches = false;
        }

        // JTBD job filter
        if (query.jtbdJob && !template.jtbdJob.toLowerCase().includes(query.jtbdJob.toLowerCase())) {
          matches = false;
        }

        // Semantic tags filter
        if (query.semanticTags && template.rdfMetadata) {
          const hasAllTags = query.semanticTags.every(tag => 
            template.rdfMetadata!.semanticTags.includes(tag)
          );
          if (!hasAllTags) matches = false;
        }

        // Compliance filter
        if (query.compliance && template.compliance) {
          const hasCompliance = query.compliance.some(standard => 
            template.compliance!.standards.includes(standard)
          );
          if (!hasCompliance) matches = false;
        }

        // Variable filter
        if (query.variables) {
          const hasVariables = query.variables.every(varName => 
            template.variables.some(v => v.name === varName)
          );
          if (!hasVariables) matches = false;
        }

        // Full-text search
        if (query.text) {
          const searchText = query.text.toLowerCase();
          const templateText = `${template.name} ${template.description} ${template.jtbdJob}`.toLowerCase();
          if (!templateText.includes(searchText)) {
            matches = false;
          }
        }

        if (matches) {
          results.push(template);
        }
      }

      // Sort by relevance and performance
      results.sort((a, b) => {
        // Prioritize frequently used templates
        const aUsage = a.performance?.usageCount || 0;
        const bUsage = b.performance?.usageCount || 0;
        
        return bUsage - aUsage;
      });

      this.log(`Query returned ${results.length} templates`);
      return results;

    } catch (error) {
      this.emit('error', error);
      throw new Error(`Template query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Render template with enterprise context
   */
  async renderTemplate(
    templateId: string,
    context: EnterpriseRenderingContext
  ): Promise<{
    success: boolean;
    files: Array<{ path: string; content: string; }>;
    metadata: any;
    auditTrail?: any;
  }> {
    const startTime = Date.now();
    
    try {
      const template = this.registry.get(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      this.log(`Rendering template: ${template.name}`);

      // Check cache first
      const cacheKey = this.generateCacheKey(templateId, context.variables);
      const cached = this.getCachedRender(cacheKey);
      if (cached) {
        this.log(`Cache hit for template: ${templateId}`);
        await this.updateTemplatePerformance(templateId, Date.now() - startTime, true);
        return cached;
      }

      // Validate compliance requirements
      if (this.config.complianceChecking && context.complianceMode) {
        await this.validateCompliance(template, context.complianceMode);
      }

      // Merge RDF data if available
      let mergedVariables = { ...context.variables };
      if (this.config.rdfEnabled && context.rdfData) {
        const rdfVariables = await this.extractRDFVariables(context.rdfData);
        mergedVariables = { ...mergedVariables, ...rdfVariables };
      }

      // Render template files
      const renderedFiles: Array<{ path: string; content: string; }> = [];
      
      for (const filePath of template.files) {
        const fullPath = path.join(template.path, filePath);
        if (await fs.pathExists(fullPath)) {
          const content = await this.renderTemplateFile(fullPath, mergedVariables);
          renderedFiles.push({
            path: filePath,
            content
          });
        }
      }

      const result = {
        success: true,
        files: renderedFiles,
        metadata: {
          templateId,
          templateName: template.name,
          renderTime: Date.now() - startTime,
          variableCount: Object.keys(mergedVariables).length,
          fileCount: renderedFiles.length
        },
        auditTrail: context.auditTrail ? this.generateAuditTrail(template, context) : undefined
      };

      // Cache result if caching is enabled
      if (this.config.cacheEnabled) {
        this.cacheRender(cacheKey, result);
      }

      // Update performance metrics
      await this.updateTemplatePerformance(templateId, Date.now() - startTime, false);

      this.log(`Template rendered successfully: ${template.name} (${Date.now() - startTime}ms)`);
      this.emit('template-rendered', { templateId, renderTime: Date.now() - startTime });
      
      return result;

    } catch (error) {
      this.emit('error', error);
      throw new Error(`Template rendering failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Inject template into existing codebase
   */
  async injectTemplate(
    templateId: string,
    targetFile: string,
    context: EnterpriseRenderingContext
  ): Promise<{
    success: boolean;
    changes: Array<{ line: number; type: string; content: string; }>;
    backup?: string;
  }> {
    try {
      const template = this.registry.get(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      this.log(`Injecting template: ${template.name} into ${targetFile}`);

      // Check if target file exists
      if (!await fs.pathExists(targetFile)) {
        throw new Error(`Target file not found: ${targetFile}`);
      }

      // Create backup if not in dry-run mode
      let backup: string | undefined;
      if (context.injectionMode !== 'dry-run') {
        backup = `${targetFile}.backup.${Date.now()}`;
        await fs.copy(targetFile, backup);
      }

      // Find suitable injection points
      const injectionPoints = await this.findInjectionPoints(template, targetFile);
      if (injectionPoints.length === 0) {
        throw new Error(`No suitable injection points found in ${targetFile}`);
      }

      const changes: Array<{ line: number; type: string; content: string; }> = [];
      
      // Apply injection points
      for (const injectionPoint of injectionPoints) {
        const renderedContent = await this.renderInjectionPoint(
          template, 
          injectionPoint, 
          context.variables
        );
        
        if (context.injectionMode !== 'dry-run') {
          await this.applyInjection(targetFile, injectionPoint, renderedContent);
        }
        
        changes.push({
          line: injectionPoint.line,
          type: injectionPoint.type,
          content: renderedContent
        });
      }

      this.log(`Template injection completed: ${changes.length} changes`);
      this.emit('template-injected', { templateId, targetFile, changes: changes.length });

      return {
        success: true,
        changes,
        backup
      };

    } catch (error) {
      this.emit('error', error);
      throw new Error(`Template injection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get template registry as MCP-accessible format
   */
  getRegistryForMCP(): Record<string, any> {
    const mcpRegistry: Record<string, any> = {};

    for (const [id, template] of this.registry.entries()) {
      mcpRegistry[id] = {
        id: template.id,
        name: template.name,
        category: template.category,
        description: template.description,
        jtbdJob: template.jtbdJob,
        variables: template.variables.map(v => ({
          name: v.name,
          type: v.type,
          required: v.required,
          description: v.description
        })),
        compliance: template.compliance,
        rdfMetadata: template.rdfMetadata,
        performance: template.performance,
        hash: template.hash,
        updatedAt: template.updatedAt
      };
    }

    return {
      templates: mcpRegistry,
      stats: {
        total: this.registry.size,
        categories: this.getCategoryStats(),
        lastDiscovery: new Date().toISOString()
      },
      caching: {
        enabled: this.config.cacheEnabled,
        hitRate: this.getCacheHitRate(),
        size: this.getCacheSize()
      }
    };
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async ensureTemplateDirectories(): Promise<void> {
    for (const dir of this.config.templateDirs) {
      await fs.ensureDir(dir);
    }
  }

  private async discoverInDirectory(templateDir: string): Promise<TemplateRegistryEntry[]> {
    const templates: TemplateRegistryEntry[] = [];
    
    try {
      // Find all template.ejs files and frontmatter files
      const templateFiles = await glob('**/template.ejs', { cwd: templateDir });
      const frontmatterFiles = await glob('**/*.md', { cwd: templateDir });
      
      // Group by directory (generator/template structure)
      const templateGroups = new Map<string, string[]>();
      
      for (const file of templateFiles) {
        const dir = path.dirname(file);
        if (!templateGroups.has(dir)) {
          templateGroups.set(dir, []);
        }
        templateGroups.get(dir)!.push(file);
      }

      // Process each template group
      for (const [dir, files] of templateGroups.entries()) {
        const fullPath = path.join(templateDir, dir);
        const template = await this.processTemplate(fullPath, files);
        if (template) {
          templates.push(template);
        }
      }

      this.log(`Discovered ${templates.length} templates in ${templateDir}`);
      return templates;

    } catch (error) {
      this.log(`Error discovering templates in ${templateDir}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private async processTemplate(templatePath: string, files: string[]): Promise<TemplateRegistryEntry | null> {
    try {
      // Check for frontmatter configuration
      const frontmatterFile = path.join(templatePath, 'index.md');
      let frontmatter: Record<string, any> = {};
      
      if (await fs.pathExists(frontmatterFile)) {
        const content = await fs.readFile(frontmatterFile, 'utf8');
        const parsed = matter(content);
        frontmatter = parsed.data;
      }

      // Extract template metadata
      const templateName = path.basename(templatePath);
      const category = this.inferCategory(templatePath, frontmatter);
      const id = `${category}/${templateName}`;

      // Scan for variables in template files
      const variables = await this.extractVariables(templatePath, files);
      
      // Extract injection points
      const injectionPoints = await this.extractInjectionPoints(templatePath, frontmatter);
      
      // Generate RDF metadata if enabled
      let rdfMetadata;
      if (this.config.rdfEnabled) {
        rdfMetadata = await this.generateRDFMetadata(templatePath, frontmatter);
      }

      // Calculate file hash for caching
      const hash = await this.calculateTemplateHash(templatePath, files);

      const template: TemplateRegistryEntry = {
        id,
        name: frontmatter.name || templateName,
        path: templatePath,
        category,
        description: frontmatter.description || `Template for ${templateName}`,
        jtbdJob: frontmatter.jtbd || frontmatter.job || `Generate ${templateName} scaffolding`,
        variables,
        injectionPoints,
        rdfMetadata,
        compliance: frontmatter.compliance,
        performance: {
          renderTimeMs: 0,
          cacheHit: false,
          lastUsed: new Date().toISOString(),
          usageCount: 0
        },
        frontmatter,
        files,
        hash,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      return template;

    } catch (error) {
      this.log(`Error processing template at ${templatePath}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private inferCategory(templatePath: string, frontmatter: Record<string, any>): TemplateRegistryEntry['category'] {
    if (frontmatter.category) {
      return frontmatter.category;
    }

    const pathLower = templatePath.toLowerCase();
    
    if (pathLower.includes('microservice')) return 'microservice';
    if (pathLower.includes('api-gateway')) return 'api-gateway';
    if (pathLower.includes('data-pipeline') || pathLower.includes('etl')) return 'data-pipeline';
    if (pathLower.includes('compliance') || pathLower.includes('soc2') || pathLower.includes('hipaa')) return 'compliance';
    if (pathLower.includes('monitoring') || pathLower.includes('observability')) return 'monitoring';
    
    return 'custom';
  }

  private async extractVariables(templatePath: string, files: string[]): Promise<TemplateRegistryEntry['variables']> {
    const variables: TemplateRegistryEntry['variables'] = [];
    const variableMap = new Map<string, any>();

    try {
      for (const file of files) {
        const fullPath = path.join(templatePath, file);
        if (await fs.pathExists(fullPath)) {
          const content = await fs.readFile(fullPath, 'utf8');
          
          // Extract Nunjucks variables {{ variable }}
          const matches = content.match(/\{\{\s*([^}]+)\s*\}\}/g) || [];
          
          for (const match of matches) {
            const varName = match.replace(/[{}]/g, '').trim();
            const cleanName = varName.split(/[.\[|\s]/)[0]; // Get base variable name
            
            if (!variableMap.has(cleanName)) {
              variableMap.set(cleanName, {
                name: cleanName,
                type: this.inferVariableType(cleanName),
                description: this.generateVariableDescription(cleanName),
                required: true // Default to required
              });
            }
          }
        }
      }

      return Array.from(variableMap.values());

    } catch (error) {
      this.log(`Error extracting variables from ${templatePath}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private inferVariableType(varName: string): string {
    const nameLower = varName.toLowerCase();
    
    if (nameLower.includes('name')) return 'string';
    if (nameLower.includes('port') || nameLower.includes('count') || nameLower.includes('size')) return 'number';
    if (nameLower.includes('enable') || nameLower.includes('disable') || nameLower.includes('is')) return 'boolean';
    if (nameLower.includes('list') || nameLower.includes('array')) return 'array';
    if (nameLower.includes('config') || nameLower.includes('options')) return 'object';
    
    return 'string';
  }

  private generateVariableDescription(varName: string): string {
    const nameLower = varName.toLowerCase();
    
    // Generate meaningful descriptions based on common patterns
    const descriptions: Record<string, string> = {
      'name': 'The name of the component or service',
      'servicename': 'Name of the microservice',
      'port': 'Port number for the service',
      'database': 'Database connection details',
      'auth': 'Authentication configuration',
      'monitoring': 'Monitoring and observability settings',
      'compliance': 'Compliance and security settings'
    };

    for (const [key, desc] of Object.entries(descriptions)) {
      if (nameLower.includes(key)) {
        return desc;
      }
    }

    return `Configuration value for ${varName}`;
  }

  private async extractInjectionPoints(templatePath: string, frontmatter: Record<string, any>): Promise<TemplateRegistryEntry['injectionPoints']> {
    const injectionPoints: TemplateRegistryEntry['injectionPoints'] = [];

    if (frontmatter.inject) {
      for (const inject of frontmatter.inject) {
        injectionPoints.push({
          name: inject.name || 'default',
          description: inject.description || 'Injection point',
          pattern: inject.pattern || inject.at || '// INJECT HERE',
          type: inject.type || 'after'
        });
      }
    }

    return injectionPoints;
  }

  private async generateRDFMetadata(templatePath: string, frontmatter: Record<string, any>): Promise<TemplateRegistryEntry['rdfMetadata']> {
    const templateName = path.basename(templatePath);
    
    return {
      namespace: `http://unjucks.dev/templates/${templateName}`,
      ontology: 'http://unjucks.dev/ontology/template',
      semanticTags: frontmatter.tags || [],
      relationships: [
        {
          subject: `template:${templateName}`,
          predicate: 'rdf:type',
          object: 'unjucks:Template'
        },
        {
          subject: `template:${templateName}`,
          predicate: 'unjucks:category',
          object: frontmatter.category || 'custom'
        }
      ]
    };
  }

  private async calculateTemplateHash(templatePath: string, files: string[]): Promise<string> {
    const hash = createHash('sha256');
    
    // Include template path and files in hash
    hash.update(templatePath);
    
    for (const file of files.sort()) {
      const fullPath = path.join(templatePath, file);
      if (await fs.pathExists(fullPath)) {
        const content = await fs.readFile(fullPath, 'utf8');
        hash.update(file);
        hash.update(content);
      }
    }
    
    return hash.digest('hex').substring(0, 16);
  }

  private async setupMCPHooks(): Promise<void> {
    // Hook into MCP Bridge events
    this.bridge.on('pre-task', async (task: SwarmTask) => {
      if (task.type === 'generate' && task.parameters.templateId) {
        await this.warmupCache(task.parameters.templateId);
      }
    });

    this.bridge.on('template-variables-updated', async (variables: Record<string, any>) => {
      // Clear relevant cache entries when variables change
      await this.invalidateCache(variables);
    });
  }

  private setupCaching(): void {
    if (!this.config.cacheEnabled) return;

    // Setup periodic cache cleanup
    setInterval(() => {
      this.cleanupCache();
    }, this.config.cacheTtl * 60 * 1000); // Convert minutes to ms
  }

  private async storeRegistryInMCP(): Promise<void> {
    try {
      const registryData = this.getRegistryForMCP();
      
      // Store in MCP memory using hooks
      await this.bridge.coordinateWithSwarm(
        `Template registry updated with ${this.registry.size} templates`,
        registryData
      );

      // Store specifically for memory retrieval
      await this.executeHook('post-edit', {
        memoryKey: `${this.config.mcpNamespace}/registry`,
        data: registryData
      });

    } catch (error) {
      this.log(`Failed to store registry in MCP: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private generateCacheKey(templateId: string, variables: Record<string, any>): string {
    const variableHash = createHash('md5')
      .update(JSON.stringify(variables))
      .digest('hex')
      .substring(0, 8);
    
    return `${templateId}:${variableHash}`;
  }

  private getCachedRender(cacheKey: string): any | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;

    // Check TTL
    const now = Date.now();
    const ttlMs = this.config.cacheTtl * 60 * 1000;
    
    if (now - entry.lastAccess > ttlMs) {
      this.cache.delete(cacheKey);
      return null;
    }

    // Update access time and hit count
    entry.lastAccess = now;
    entry.hitCount++;

    return entry.renderedContent;
  }

  private cacheRender(cacheKey: string, result: any): void {
    if (!this.config.cacheEnabled) return;

    // Check cache size limits
    if (this.getCacheSize() > this.config.cacheMaxSize * 1024 * 1024) {
      this.evictCacheEntries();
    }

    const entry: TemplateCacheEntry = {
      template: this.registry.values().next().value, // Placeholder
      renderedContent: new Map([['default', result]]),
      lastAccess: Date.now(),
      hitCount: 1,
      size: JSON.stringify(result).length
    };

    this.cache.set(cacheKey, entry);
  }

  private async renderTemplateFile(filePath: string, variables: Record<string, any>): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Use generator's rendering capabilities
      return await this.generator.renderString(content, variables);

    } catch (error) {
      throw new Error(`Failed to render template file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async validateCompliance(template: TemplateRegistryEntry, mode: string): Promise<void> {
    if (!template.compliance) return;

    const requiredStandards: Record<string, string[]> = {
      'soc2': ['SOC2', 'ISO27001'],
      'hipaa': ['HIPAA', 'SOC2'],
      'gdpr': ['GDPR', 'ISO27001']
    };

    const required = requiredStandards[mode] || [];
    const templateStandards = template.compliance.standards || [];

    for (const standard of required) {
      if (!templateStandards.includes(standard)) {
        throw new Error(`Template ${template.id} does not meet ${mode.toUpperCase()} compliance requirements (missing ${standard})`);
      }
    }
  }

  private async extractRDFVariables(rdfData: RDFTemplateContext): Promise<Record<string, any>> {
    // Delegate to RDFDataLoader for processing
    return await this.rdfLoader.extractVariables(rdfData);
  }

  private generateAuditTrail(template: TemplateRegistryEntry, context: EnterpriseRenderingContext): any {
    return {
      templateId: template.id,
      templateName: template.name,
      renderTimestamp: new Date().toISOString(),
      variables: Object.keys(context.variables),
      complianceMode: context.complianceMode,
      targetEnvironment: context.targetEnvironment,
      userAgent: 'MCP-Template-Orchestrator/1.0'
    };
  }

  private async findInjectionPoints(template: TemplateRegistryEntry, targetFile: string): Promise<any[]> {
    const content = await fs.readFile(targetFile, 'utf8');
    const lines = content.split('\n');
    const injectionPoints: any[] = [];

    for (const point of template.injectionPoints) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(point.pattern)) {
          injectionPoints.push({
            ...point,
            line: i,
            originalContent: lines[i]
          });
        }
      }
    }

    return injectionPoints;
  }

  private async renderInjectionPoint(template: TemplateRegistryEntry, injectionPoint: any, variables: Record<string, any>): Promise<string> {
    // Render injection-specific content
    const templateContent = `// Injected by ${template.name}\n{{ injectionContent || 'Generated content' }}`;
    return await this.generator.renderString(templateContent, variables);
  }

  private async applyInjection(targetFile: string, injectionPoint: any, content: string): Promise<void> {
    const fileContent = await fs.readFile(targetFile, 'utf8');
    const lines = fileContent.split('\n');

    switch (injectionPoint.type) {
      case 'before':
        lines.splice(injectionPoint.line, 0, content);
        break;
      case 'after':
        lines.splice(injectionPoint.line + 1, 0, content);
        break;
      case 'replace':
        lines[injectionPoint.line] = content;
        break;
      case 'append':
        lines.push(content);
        break;
      case 'prepend':
        lines.unshift(content);
        break;
    }

    await fs.writeFile(targetFile, lines.join('\n'), 'utf8');
  }

  private async updateTemplatePerformance(templateId: string, renderTime: number, cacheHit: boolean): Promise<void> {
    const template = this.registry.get(templateId);
    if (template && template.performance) {
      template.performance.renderTimeMs = renderTime;
      template.performance.cacheHit = cacheHit;
      template.performance.lastUsed = new Date().toISOString();
      template.performance.usageCount++;
    }
  }

  private getCategoryStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const template of this.registry.values()) {
      stats[template.category] = (stats[template.category] || 0) + 1;
    }
    
    return stats;
  }

  private getCacheHitRate(): number {
    let totalHits = 0;
    let totalAccess = 0;
    
    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
      totalAccess++;
    }
    
    return totalAccess > 0 ? totalHits / totalAccess : 0;
  }

  private getCacheSize(): number {
    let totalSize = 0;
    
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    
    return totalSize;
  }

  private async warmupCache(templateId: string): Promise<void> {
    // Pre-load frequently accessed templates
    const template = this.registry.get(templateId);
    if (template && !this.cache.has(templateId)) {
      this.log(`Warming up cache for template: ${template.name}`);
      // Pre-render with empty context for basic caching
      await this.renderTemplate(templateId, { variables: {} });
    }
  }

  private async invalidateCache(variables: Record<string, any>): Promise<void> {
    const variableNames = Object.keys(variables);
    const keysToDelete: string[] = [];
    
    for (const [key] of this.cache.entries()) {
      // If cache key might be affected by variable changes
      if (variableNames.some(varName => key.includes(varName))) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    this.log(`Invalidated ${keysToDelete.length} cache entries`);
  }

  private cleanupCache(): void {
    const now = Date.now();
    const ttlMs = this.config.cacheTtl * 60 * 1000;
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.lastAccess > ttlMs) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.log(`Cleaned up ${cleaned} expired cache entries`);
    }
  }

  private evictCacheEntries(): void {
    // LRU eviction - remove least recently used entries
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
    
    // Remove oldest 25% of entries
    const toRemove = Math.floor(entries.length * 0.25);
    
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
    
    this.log(`Evicted ${toRemove} cache entries to free memory`);
  }

  private async executeHook(hookType: string, params: any): Promise<void> {
    try {
      await this.bridge.coordinateWithSwarm(`Hook: ${hookType}`, params);
    } catch (error) {
      this.log(`Hook execution failed: ${hookType} - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private log(message: string): void {
    if (this.config.debugMode) {
      console.log(chalk.blue(`[MCP Template Orchestrator] ${message}`));
    }
  }

  /**
   * Get orchestrator statistics
   */
  getStatistics(): {
    templates: number;
    categories: Record<string, number>;
    cache: { size: number; hitRate: number; enabled: boolean };
    performance: { totalRenders: number; averageRenderTime: number };
  } {
    const totalRenders = Array.from(this.registry.values())
      .reduce((sum, t) => sum + (t.performance?.usageCount || 0), 0);
    
    const averageRenderTime = Array.from(this.registry.values())
      .filter(t => t.performance?.renderTimeMs)
      .reduce((sum, t) => sum + (t.performance!.renderTimeMs), 0) / this.registry.size;

    return {
      templates: this.registry.size,
      categories: this.getCategoryStats(),
      cache: {
        size: this.cache.size,
        hitRate: this.getCacheHitRate(),
        enabled: this.config.cacheEnabled
      },
      performance: {
        totalRenders,
        averageRenderTime: averageRenderTime || 0
      }
    };
  }

  /**
   * Export template registry for backup/migration
   */
  async exportRegistry(): Promise<string> {
    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      templates: Array.from(this.registry.values()),
      config: this.config
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Cleanup and destroy orchestrator
   */
  async destroy(): Promise<void> {
    this.cache.clear();
    this.registry.clear();
    this.removeAllListeners();
    this.isInitialized = false;
    
    this.log('Template Orchestrator destroyed');
  }
}

/**
 * Factory function to create MCP Template Orchestrator
 */
export async function createMCPTemplateOrchestrator(
  bridge: MCPBridge,
  config?: Partial<TemplateOrchestratorConfig>
): Promise<MCPTemplateOrchestrator> {
  const orchestrator = new MCPTemplateOrchestrator(bridge, config);
  await orchestrator.initialize();
  return orchestrator;
}

/**
 * Export types for external use
 */
export type {
  TemplateRegistryEntry,
  TemplateOrchestratorConfig,
  TemplateQuery,
  EnterpriseRenderingContext
};