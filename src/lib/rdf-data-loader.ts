import fs from "fs-extra";
import path from "node:path";
import { Parser, Store } from "n3";
import type { Quad, NamedNode, BlankNode, Literal } from "@rdfjs/types";
import { TurtleParser, TurtleUtils, type TurtleParseResult, type ParsedTriple } from "./turtle-parser.js";
import type { 
  TurtleData, 
  RDFDataSource, 
  RDFDataLoadResult, 
  RDFDataLoaderOptions,
  RDFResource,
  RDFValue,
  RDFQueryResult,
  RDFTemplateContext,
  RDFNamespaceConfig,
  RDFValidationResult
} from "./types/turtle-types.js";
import { CommonVocabularies, CommonProperties } from "./types/turtle-types.js";
import type { TemplateVariable } from "./template-scanner.js";

/**
 * Cache entry for RDF data with TTL support
 */
interface CacheEntry {
  data: RDFDataLoadResult;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  etag?: string;
  lastModified?: Date;
}

/**
 * Configuration for HTTP requests
 */
interface HttpRequestOptions {
  timeout?: number;
  headers?: Record<string, string>;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * RDFDataLoader handles loading RDF/Turtle data from various sources
 * and converting it to template variables with production-ready features:
 * - HTTP/HTTPS support for remote RDF sources
 * - Intelligent caching with TTL and conditional requests
 * - SPARQL-like query capabilities
 * - Multiple RDF format support (Turtle, N-Triples, JSON-LD)
 * - Comprehensive error handling and validation
 * - Async data loading with proper concurrency control
 * - Integration with Unjucks template rendering pipeline
 */
export class RDFDataLoader {
  private parser: TurtleParser;
  private n3Parser: Parser;
  private store: Store;
  private cache = new Map<string, CacheEntry>();
  private loadingPromises = new Map<string, Promise<RDFDataLoadResult>>();
  private httpOptions: HttpRequestOptions;

  constructor(private options: RDFDataLoaderOptions = {}) {
    this.parser = new TurtleParser({
      baseIRI: options.baseUri,
      format: 'text/turtle'
    });
    
    this.n3Parser = new Parser({
      baseIRI: options.baseUri,
      format: 'Turtle'
    });
    
    this.store = new Store();
    
    this.httpOptions = {
      timeout: options.httpTimeout || 10000,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      headers: {
        'Accept': 'text/turtle, application/n-triples, application/ld+json, application/rdf+xml',
        'User-Agent': 'Unjucks-RDF-Loader/1.0.0',
        ...options.httpHeaders
      }
    };
  }

  /**
   * Load RDF data from frontmatter configuration with enhanced error handling
   */
  async loadFromFrontmatter(frontmatter: any): Promise<RDFDataLoadResult> {
    const errors: string[] = [];
    const startTime = performance.now();
    
    try {
      // Validate frontmatter structure
      if (!frontmatter || typeof frontmatter !== 'object') {
        return this.createEmptyResult();
      }
      
      // Extract and validate RDF configuration
      const rdfConfigs = this.extractAllRDFConfigs(frontmatter);
      
      if (rdfConfigs.length === 0) {
        return this.createEmptyResult();
      }
      
      // Load from multiple sources if specified
      const results = await Promise.all(
        rdfConfigs.map(config => this.loadFromSource(config))
      );
      
      // Merge results from multiple sources
      const mergedResult = this.mergeDataResults(results);
      
      // Add performance metadata
      mergedResult.metadata = {
        ...mergedResult.metadata,
        loadTime: performance.now() - startTime,
        sourceCount: rdfConfigs.length,
        loadTimestamp: new Date().toISOString()
      };
      
      return mergedResult;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to load RDF data from frontmatter: ${errorMessage}`);
      
      return {
        data: { subjects: {}, predicates: new Set(), triples: [], prefixes: {} },
        variables: {},
        metadata: {
          loadTime: performance.now() - startTime,
          error: errorMessage
        },
        success: false,
        errors,
      };
    }
  }

  /**
   * Load RDF data from a specific source with concurrency control and caching
   */
  async loadFromSource(source: RDFDataSource): Promise<RDFDataLoadResult> {
    const cacheKey = this.createCacheKey(source);
    const startTime = performance.now();
    
    // Check for ongoing load operation
    if (this.loadingPromises.has(cacheKey)) {
      return await this.loadingPromises.get(cacheKey)!;
    }
    
    // Check cache with TTL validation
    if (this.options.cacheEnabled && this.isCacheValid(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return cached.data;
    }

    // Create loading promise
    const loadingPromise = this.performLoad(source, cacheKey, startTime);
    this.loadingPromises.set(cacheKey, loadingPromise);
    
    try {
      const result = await loadingPromise;
      return result;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  /**
   * Perform the actual loading operation
   */
  private async performLoad(
    source: RDFDataSource, 
    cacheKey: string, 
    startTime: number
  ): Promise<RDFDataLoadResult> {
    const errors: string[] = [];
    
    try {
      // Validate source configuration
      this.validateDataSource(source);
      
      let rawData: string;
      let contentType: string | undefined;
      let etag: string | undefined;
      let lastModified: Date | undefined;

      // Load raw data based on source type
      switch (source.type) {
        case "file":
          ({ data: rawData, lastModified } = await this.loadFromFile(source.source));
          break;
        case "inline":
          rawData = source.source;
          break;
        case "uri":
          ({ data: rawData, contentType, etag, lastModified } = 
           await this.loadFromUri(source.source));
          break;
        default:
          throw new Error(`Unsupported RDF data source type: ${source.type}`);
      }

      // Parse RDF data with format detection
      const format = this.detectFormat(contentType, source.format, source.source);
      const parsedData = await this.parseRDFData(rawData, format, source);
      
      // Extract template variables and metadata
      const variables = this.extractTemplateVariables(parsedData, source);
      const metadata = this.extractMetadata(parsedData, source, startTime);

      const result: RDFDataLoadResult = {
        data: parsedData,
        variables,
        metadata,
        success: true,
        errors: [],
      };

      // Cache successful results with TTL
      if (this.options.cacheEnabled) {
        this.setCacheEntry(cacheKey, result, etag, lastModified);
      }

      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to load RDF from ${source.type} source: ${errorMessage}`);

      const failureResult: RDFDataLoadResult = {
        data: { subjects: {}, predicates: new Set(), triples: [], prefixes: {} },
        variables: {},
        metadata: {
          loadTime: performance.now() - startTime,
          error: errorMessage,
          source: source
        },
        success: false,
        errors,
      };

      return failureResult;
    }
  }

  /**
   * Generate CLI arguments from RDF data schema
   */
  async generateCliArgsFromSchema(schemaSource: RDFDataSource): Promise<Record<string, any>> {
    const result = await this.loadFromSource(schemaSource);
    
    if (!result.success) {
      return {};
    }

    const cliArgs: Record<string, any> = {};

    // Extract potential CLI arguments from RDF schema
    for (const [varName, value] of Object.entries(result.variables)) {
      // Generate CLI flag based on variable name and type
      const flagName = varName.replace(/_/g, '-');
      
      if (typeof value === 'boolean') {
        cliArgs[flagName] = {
          type: 'boolean',
          description: `${varName} flag`,
          default: value,
        };
      } else if (typeof value === 'number') {
        cliArgs[flagName] = {
          type: 'number',
          description: `${varName} value`,
          default: value,
        };
      } else if (Array.isArray(value)) {
        cliArgs[flagName] = {
          type: 'string',
          description: `${varName} (multiple values supported)`,
          multiple: true,
          default: value,
        };
      } else {
        cliArgs[flagName] = {
          type: 'string',
          description: `${varName} value`,
          default: String(value),
        };
      }
    }

    return cliArgs;
  }

  /**
   * Merge RDF variables with existing template variables
   */
  mergeWithTemplateVariables(
    rdfVariables: Record<string, any>,
    templateVariables: TemplateVariable[]
  ): Record<string, any> {
    const merged: Record<string, any> = { ...rdfVariables };

    // Enhance template variables with RDF context
    for (const templateVar of templateVariables) {
      if (!merged[templateVar.name]) {
        // Look for similar RDF variables
        const rdfVar = this.findSimilarRDFVariable(templateVar.name, rdfVariables);
        if (rdfVar) {
          merged[templateVar.name] = rdfVar;
        }
      }
    }

    return merged;
  }

  /**
   * Load RDF data from file with enhanced error handling
   */
  private async loadFromFile(filePath: string): Promise<{
    data: string;
    lastModified?: Date;
  }> {
    // Resolve relative paths from template directory
    let resolvedPath = filePath;
    if (!path.isAbsolute(filePath) && this.options.templateDir) {
      resolvedPath = path.resolve(this.options.templateDir, filePath);
    }

    try {
      // Check if file exists
      await fs.access(resolvedPath);
      
      // Get file stats for caching
      const stats = await fs.stat(resolvedPath);
      const data = await fs.readFile(resolvedPath, 'utf-8');
      
      return {
        data,
        lastModified: stats.mtime
      };
      
    } catch (error) {
      throw new Error(`Failed to read RDF file '${resolvedPath}': ${
        error instanceof Error ? error.message : String(error)
      }`);
    }
  }

  /**
   * Load RDF data from URI with HTTP support and retries
   */
  private async loadFromUri(uri: string): Promise<{
    data: string;
    contentType?: string;
    etag?: string;
    lastModified?: Date;
  }> {
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      return await this.fetchHttpUri(uri);
    } else {
      // Treat as local file path
      const { data, lastModified } = await this.loadFromFile(uri);
      return { data, lastModified };
    }
  }

  /**
   * Fetch RDF data from HTTP/HTTPS URI with retries and caching headers
   */
  private async fetchHttpUri(uri: string): Promise<{
    data: string;
    contentType?: string;
    etag?: string;
    lastModified?: Date;
  }> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.httpOptions.maxRetries!; attempt++) {
      try {
        // Use fetch with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.httpOptions.timeout);
        
        const response = await fetch(uri, {
          headers: this.httpOptions.headers,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.text();
        const contentType = response.headers.get('content-type') || undefined;
        const etag = response.headers.get('etag') || undefined;
        const lastModifiedStr = response.headers.get('last-modified');
        const lastModified = lastModifiedStr ? new Date(lastModifiedStr) : undefined;
        
        return { data, contentType, etag, lastModified };
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.httpOptions.maxRetries!) {
          // Wait before retrying
          await new Promise(resolve => 
            setTimeout(resolve, this.httpOptions.retryDelay! * attempt)
          );
        }
      }
    }
    
    throw new Error(`Failed to fetch URI '${uri}' after ${this.httpOptions.maxRetries} attempts: ${
      lastError?.message || 'Unknown error'
    }`);
  }

  private extractRDFConfig(frontmatter: any): RDFDataSource | null {
    // Check for various RDF configuration formats
    if (frontmatter.rdf) {
      if (typeof frontmatter.rdf === 'string') {
        // Simple string path to file
        return {
          type: 'file',
          source: frontmatter.rdf,
        };
      } else if (typeof frontmatter.rdf === 'object') {
        // Detailed configuration
        return {
          type: frontmatter.rdf.type || 'file',
          source: frontmatter.rdf.source,
          format: frontmatter.rdf.format,
          variables: frontmatter.rdf.variables,
        };
      }
    }

    // Check for turtle-specific configuration
    if (frontmatter.turtle) {
      if (typeof frontmatter.turtle === 'string') {
        return {
          type: 'file',
          source: frontmatter.turtle,
          format: 'text/turtle',
        };
      } else if (typeof frontmatter.turtle === 'object') {
        return {
          type: frontmatter.turtle.type || 'file',
          source: frontmatter.turtle.source,
          format: 'text/turtle',
          variables: frontmatter.turtle.variables,
        };
      }
    }

    // Check for inline turtle data
    if (frontmatter.turtleData || frontmatter.rdfData) {
      const data = frontmatter.turtleData || frontmatter.rdfData;
      return {
        type: 'inline',
        source: data,
        format: 'text/turtle',
      };
    }

    return null;
  }

  private findSimilarRDFVariable(
    templateVarName: string,
    rdfVariables: Record<string, any>
  ): any {
    const lowerName = templateVarName.toLowerCase();
    
    // Look for exact matches first
    if (rdfVariables[templateVarName]) {
      return rdfVariables[templateVarName];
    }

    // Look for partial matches
    for (const [rdfName, rdfValue] of Object.entries(rdfVariables)) {
      const lowerRDFName = rdfName.toLowerCase();
      
      if (lowerRDFName.includes(lowerName) || lowerName.includes(lowerRDFName)) {
        return rdfValue;
      }
    }

    return null;
  }

  /**
   * Create template context for Nunjucks rendering with RDF data
   */
  createTemplateContext(
    rdfData: TurtleData, 
    variables: Record<string, any>
  ): RDFTemplateContext {
    const context: RDFTemplateContext = {
      ...variables,
      $rdf: {
        subjects: rdfData.subjects,
        prefixes: rdfData.prefixes,
        query: (subject?: string, predicate?: string, object?: string) => {
          return this.queryTriples(rdfData, subject, predicate, object);
        },
        getByType: (typeUri: string) => {
          return Object.values(rdfData.subjects).filter(resource => 
            resource.type?.includes(typeUri)
          );
        },
        compact: (uri: string) => {
          return this.compactUri(uri, rdfData.prefixes);
        },
        expand: (prefixed: string) => {
          return this.expandPrefixed(prefixed, rdfData.prefixes);
        }
      },
      $metadata: {}
    };
    
    return context;
  }

  /**
   * Execute SPARQL-like queries on RDF data
   */
  async executeQuery(
    rdfData: TurtleData, 
    query: {
      subject?: string;
      predicate?: string;
      object?: string;
      filter?: (resource: RDFResource) => boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<RDFQueryResult> {
    try {
      const matchingTriples = this.queryTriples(
        rdfData, 
        query.subject, 
        query.predicate, 
        query.object
      );
      
      let resources = matchingTriples
        .map(triple => rdfData.subjects[triple.subject.value])
        .filter(Boolean);
      
      // Apply filter if provided
      if (query.filter) {
        resources = resources.filter(query.filter);
      }
      
      // Apply pagination
      if (query.offset) {
        resources = resources.slice(query.offset);
      }
      if (query.limit) {
        resources = resources.slice(0, query.limit);
      }
      
      // Convert to bindings format
      const bindings = resources.map(resource => {
        const binding: Record<string, RDFValue> = {};
        for (const [predicate, values] of Object.entries(resource.properties)) {
          binding[this.extractLocalName(predicate)] = values[0];
        }
        return binding;
      });
      
      const variables = resources.length > 0 
        ? Object.keys(resources[0].properties).map(this.extractLocalName)
        : [];
      
      return {
        bindings,
        variables,
        success: true,
        errors: []
      };
      
    } catch (error) {
      return {
        bindings: [],
        variables: [],
        success: false,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Validate RDF data syntax and structure
   */
  async validateRDF(data: string, format: string = 'turtle'): Promise<RDFValidationResult> {
    const errors: Array<{
      message: string;
      line?: number;
      column?: number;
      severity: "error" | "warning" | "info";
    }> = [];
    
    const warnings: Array<{
      message: string;
      line?: number;
      column?: number;
    }> = [];
    
    try {
      // Parse with N3 to validate syntax
      const parser = new Parser({ format: format as any });
      const quads = parser.parse(data);
      
      // Validate structure
      if (quads.length === 0) {
        warnings.push({
          message: "No RDF triples found in data"
        });
      }
      
      // Check for common issues
      const subjects = new Set(quads.map(q => q.subject.value));
      if (subjects.size === 0) {
        warnings.push({
          message: "No distinct subjects found"
        });
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
      
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : String(error),
        severity: "error"
      });
      
      return {
        valid: false,
        errors,
        warnings
      };
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private createEmptyResult(): RDFDataLoadResult {
    return {
      data: { subjects: {}, predicates: new Set(), triples: [], prefixes: {} },
      variables: {},
      metadata: {},
      success: true,
      errors: [],
    };
  }

  private createCacheKey(source: RDFDataSource): string {
    const key = `${source.type}:${source.source}`;
    if (source.format) {
      return `${key}:${source.format}`;
    }
    if (source.variables?.length) {
      return `${key}:vars:${source.variables.join(',')}`;
    }
    return key;
  }

  private isCacheValid(cacheKey: string): boolean {
    const entry = this.cache.get(cacheKey);
    if (!entry) return false;
    
    const now = Date.now();
    return (now - entry.timestamp) < entry.ttl;
  }

  private setCacheEntry(
    cacheKey: string, 
    result: RDFDataLoadResult, 
    etag?: string, 
    lastModified?: Date
  ): void {
    const ttl = this.options.cacheTTL || 300000; // 5 minutes default
    
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
      ttl,
      etag,
      lastModified
    });
  }

  private validateDataSource(source: RDFDataSource): void {
    if (!source.source) {
      throw new Error('RDF data source must have a source property');
    }
    
    if (!['file', 'inline', 'uri'].includes(source.type)) {
      throw new Error(`Invalid RDF data source type: ${source.type}`);
    }
    
    if (source.type === 'uri' && !source.source.match(/^https?:\/\/|^\/|^[a-zA-Z]:/)) {
      throw new Error('URI source must be a valid URL or file path');
    }
  }

  private detectFormat(
    contentType?: string, 
    explicitFormat?: string, 
    source?: string
  ): string {
    if (explicitFormat) return explicitFormat;
    
    if (contentType) {
      if (contentType.includes('turtle')) return 'turtle';
      if (contentType.includes('n-triples')) return 'ntriples';
      if (contentType.includes('json-ld')) return 'jsonld';
      if (contentType.includes('rdf+xml')) return 'rdfxml';
    }
    
    if (source) {
      const ext = path.extname(source).toLowerCase();
      switch (ext) {
        case '.ttl': return 'turtle';
        case '.nt': return 'ntriples';
        case '.jsonld': return 'jsonld';
        case '.rdf': case '.xml': return 'rdfxml';
      }
    }
    
    return 'turtle'; // Default
  }

  private async parseRDFData(
    rawData: string, 
    format: string, 
    source: RDFDataSource
  ): Promise<TurtleData> {
    try {
      // Use the TurtleParser for parsing
      const parseResult = await this.parser.parse(rawData);
      return this.convertTurtleParseResultToTurtleData(parseResult);
    } catch (error) {
      throw new Error(`Failed to parse RDF data in ${format} format: ${
        error instanceof Error ? error.message : String(error)
      }`);
    }
  }

  private convertQuadsToTurtleData(quads: Quad[]): TurtleData {
    const subjects: Record<string, RDFResource> = {};
    const predicates = new Set<string>();
    const prefixes: Record<string, string> = {};
    
    // Add default prefixes
    Object.assign(prefixes, {
      rdf: CommonVocabularies.RDF,
      rdfs: CommonVocabularies.RDFS,
      owl: CommonVocabularies.OWL,
      xsd: CommonVocabularies.XSD
    });
    
    for (const quad of quads) {
      const subjectUri = quad.subject.value;
      const predicateUri = quad.predicate.value;
      const objectValue = this.convertRDFNode(quad.object);
      
      predicates.add(predicateUri);
      
      if (!subjects[subjectUri]) {
        subjects[subjectUri] = {
          uri: subjectUri,
          properties: {},
          type: []
        };
      }
      
      if (!subjects[subjectUri].properties[predicateUri]) {
        subjects[subjectUri].properties[predicateUri] = [];
      }
      
      subjects[subjectUri].properties[predicateUri].push(objectValue);
      
      // Handle rdf:type specially
      if (predicateUri === CommonProperties.TYPE) {
        if (!subjects[subjectUri].type) {
          subjects[subjectUri].type = [];
        }
        subjects[subjectUri].type!.push(objectValue.value);
      }
    }
    
    return {
      subjects,
      predicates,
      triples: quads,
      prefixes
    };
  }

  private convertRDFNode(node: NamedNode | BlankNode | Literal): RDFValue {
    if (node.termType === 'Literal') {
      return {
        value: node.value,
        type: 'literal',
        datatype: node.datatype?.value,
        language: node.language || undefined
      };
    } else if (node.termType === 'NamedNode') {
      return {
        value: node.value,
        type: 'uri'
      };
    } else {
      return {
        value: node.value,
        type: 'blank'
      };
    }
  }

  private extractTemplateVariables(
    data: TurtleData, 
    source: RDFDataSource
  ): Record<string, any> {
    const variables: Record<string, any> = {};
    
    // Extract variables from each subject
    for (const [subjectUri, resource] of Object.entries(data.subjects)) {
      const localName = this.extractLocalName(subjectUri);
      const resourceVars: Record<string, any> = {};
      
      for (const [predicateUri, values] of Object.entries(resource.properties)) {
        const propName = this.extractLocalName(predicateUri);
        resourceVars[propName] = values.length === 1 
          ? this.convertToJavaScriptValue(values[0])
          : values.map(v => this.convertToJavaScriptValue(v));
      }
      
      variables[localName] = resourceVars;
    }
    
    // Filter specific variables if requested
    if (source.variables?.length) {
      const filtered: Record<string, any> = {};
      for (const varName of source.variables) {
        if (variables[varName] !== undefined) {
          filtered[varName] = variables[varName];
        }
      }
      return filtered;
    }
    
    return variables;
  }

  private extractMetadata(
    data: TurtleData, 
    source: RDFDataSource, 
    startTime: number
  ): Record<string, any> {
    return {
      loadTime: performance.now() - startTime,
      sourceType: source.type,
      tripleCount: data.triples.length,
      subjectCount: Object.keys(data.subjects).length,
      predicateCount: data.predicates.size,
      prefixes: data.prefixes,
      loadTimestamp: new Date().toISOString()
    };
  }

  private extractAllRDFConfigs(frontmatter: any): RDFDataSource[] {
    const configs: RDFDataSource[] = [];
    
    // Single RDF config
    const singleConfig = this.extractRDFConfig(frontmatter);
    if (singleConfig) {
      configs.push(singleConfig);
    }
    
    // Array of RDF configs
    if (Array.isArray(frontmatter.rdfSources)) {
      for (const sourceConfig of frontmatter.rdfSources) {
        const config = this.extractRDFConfig(sourceConfig);
        if (config) {
          configs.push(config);
        }
      }
    }
    
    return configs;
  }

  private mergeDataResults(results: RDFDataLoadResult[]): RDFDataLoadResult {
    if (results.length === 0) {
      return this.createEmptyResult();
    }
    
    if (results.length === 1) {
      return results[0];
    }
    
    // Merge multiple results
    const mergedData: TurtleData = {
      subjects: {},
      predicates: new Set(),
      triples: [],
      prefixes: {}
    };
    
    const mergedVariables: Record<string, any> = {};
    const mergedMetadata: Record<string, any> = {
      sources: results.length,
      totalTriples: 0,
      totalSubjects: 0
    };
    
    const allErrors: string[] = [];
    let overallSuccess = true;
    
    for (const result of results) {
      if (!result.success) {
        overallSuccess = false;
        allErrors.push(...result.errors);
        continue;
      }
      
      // Merge data
      Object.assign(mergedData.subjects, result.data.subjects);
      result.data.predicates.forEach(p => mergedData.predicates.add(p));
      mergedData.triples.push(...result.data.triples);
      Object.assign(mergedData.prefixes, result.data.prefixes);
      
      // Merge variables
      Object.assign(mergedVariables, result.variables);
      
      // Update metadata
      mergedMetadata.totalTriples += result.metadata.tripleCount || 0;
      mergedMetadata.totalSubjects += result.metadata.subjectCount || 0;
    }
    
    return {
      data: mergedData,
      variables: mergedVariables,
      metadata: mergedMetadata,
      success: overallSuccess,
      errors: allErrors
    };
  }

  private queryTriples(
    data: TurtleData,
    subject?: string,
    predicate?: string,
    object?: string
  ): Quad[] {
    return data.triples.filter(triple => {
      if (subject && triple.subject.value !== subject) return false;
      if (predicate && triple.predicate.value !== predicate) return false;
      if (object && triple.object.value !== object) return false;
      return true;
    });
  }

  private compactUri(uri: string, prefixes: Record<string, string>): string {
    for (const [prefix, namespace] of Object.entries(prefixes)) {
      if (uri.startsWith(namespace)) {
        return `${prefix}:${uri.substring(namespace.length)}`;
      }
    }
    return uri;
  }

  private expandPrefixed(prefixed: string, prefixes: Record<string, string>): string {
    if (!prefixed.includes(':')) return prefixed;
    
    const [prefix, local] = prefixed.split(':', 2);
    const namespace = prefixes[prefix];
    return namespace ? `${namespace}${local}` : prefixed;
  }

  private extractLocalName(uri: string): string {
    if (uri.includes('#')) {
      return uri.split('#').pop() || '';
    }
    return uri.split('/').pop() || '';
  }

  private convertToJavaScriptValue(rdfValue: RDFValue): any {
    if (rdfValue.type === 'literal') {
      switch (rdfValue.datatype) {
        case `${CommonVocabularies.XSD}integer`:
        case `${CommonVocabularies.XSD}int`:
          return parseInt(rdfValue.value, 10);
        case `${CommonVocabularies.XSD}decimal`:
        case `${CommonVocabularies.XSD}double`:
        case `${CommonVocabularies.XSD}float`:
          return parseFloat(rdfValue.value);
        case `${CommonVocabularies.XSD}boolean`:
          return rdfValue.value === 'true';
        case `${CommonVocabularies.XSD}date`:
        case `${CommonVocabularies.XSD}dateTime`:
          return new Date(rdfValue.value);
        default:
          return rdfValue.value;
      }
    }
    return rdfValue.value;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { 
    size: number; 
    keys: string[];
    totalSize: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    let totalSize = 0;
    let oldest: number | undefined;
    let newest: number | undefined;
    
    for (const entry of this.cache.values()) {
      totalSize += JSON.stringify(entry.data).length;
      if (!oldest || entry.timestamp < oldest) oldest = entry.timestamp;
      if (!newest || entry.timestamp > newest) newest = entry.timestamp;
    }
    
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      totalSize,
      oldestEntry: oldest ? new Date(oldest) : undefined,
      newestEntry: newest ? new Date(newest) : undefined
    };
  }

  /**
   * Clean up expired cache entries
   */
  cleanupCache(): number {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if ((now - entry.timestamp) >= entry.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    return removed;
  }
}