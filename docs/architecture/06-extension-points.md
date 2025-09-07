# Extension Points Architecture

## Overview

Unjucks is designed with extensibility as a core principle, providing multiple extension points for customizing behavior, adding new capabilities, and integrating with external systems. This document outlines the various extension mechanisms available for developers and organizations.

## Extension Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          Extension Points Architecture                         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  MCP Server Extensions            Plugin System              Custom Filters  │
│  ┌───────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │ Protocol Implementation│  │ Dynamic Loading     │  │ Nunjucks Extensions │  │
│  │ • Custom Tools        │  │ • Lifecycle Hooks  │  │ • Template Filters  │  │
│  │ • Data Sources       │  │ • Event System     │  │ • Global Functions  │  │
│  │ • Workflows          │  │ • Config Providers │  │ • Context Enhancers │  │
│  └───────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
│                                                                            │
│  Validation Rules                Template Marketplace       Data Connectors  │
│  ┌───────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │ Semantic Validators   │  │ Template Sharing    │  │ Database Adapters   │  │
│  │ • Custom Rules       │  │ • Version Control   │  │ • API Integrations  │  │
│  │ • Compliance Checks │  │ • Dependency Mgmt   │  │ • Streaming Sources │  │
│  │ • Quality Gates     │  │ • Rating System     │  │ • Cache Strategies  │  │
│  └───────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
│                                                                            │
│                              Core Extension Registry                        │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ • Extension Discovery & Registration                           │  │
│  │ • Dependency Management & Conflict Resolution                 │  │
│  │ • Security Sandboxing & Isolation                           │  │
│  │ • Performance Monitoring & Resource Management               │  │
│  │ • Version Compatibility & Migration Support                 │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## 1. MCP Server Extensions

### Custom MCP Server Implementation

Creating a custom MCP server to extend Unjucks functionality:

```typescript
// custom-mcp-server.ts
import { MCPServer, Tool, MCPRequest, MCPResponse } from '@unjucks/mcp';

class CustomUnjucksMCPServer extends MCPServer {
  private tools: Map<string, Tool> = new Map();
  
  constructor() {
    super('custom-unjucks-server', '1.0.0');
    this.registerTools();
  }
  
  private registerTools(): void {
    // Custom template generation tool
    this.tools.set('generate-enterprise-template', {
      name: 'generate-enterprise-template',
      description: 'Generate enterprise-grade templates with compliance validation',
      inputSchema: {
        type: 'object',
        properties: {
          templateType: { type: 'string', enum: ['microservice', 'api', 'ui', 'data'] },
          complianceFrameworks: {
            type: 'array',
            items: { type: 'string', enum: ['SOX', 'HIPAA', 'GDPR', 'PCI'] }
          },
          businessDomain: { type: 'string' },
          scalabilityRequirements: {
            type: 'object',
            properties: {
              expectedLoad: { type: 'string' },
              availabilityTarget: { type: 'string' },
              performanceTarget: { type: 'string' }
            }
          }
        },
        required: ['templateType', 'businessDomain']
      },
      handler: this.handleEnterpriseTemplateGeneration.bind(this)
    });
    
    // Custom data integration tool
    this.tools.set('integrate-external-data', {
      name: 'integrate-external-data',
      description: 'Integrate data from external enterprise systems',
      inputSchema: {
        type: 'object',
        properties: {
          dataSource: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['rest-api', 'graphql', 'database', 'file'] },
              endpoint: { type: 'string' },
              authentication: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['oauth2', 'api-key', 'basic', 'cert'] },
                  credentials: { type: 'object' }
                }
              },
              mapping: { type: 'object' }
            }
          }
        },
        required: ['dataSource']
      },
      handler: this.handleExternalDataIntegration.bind(this)
    });
  }
  
  async handleEnterpriseTemplateGeneration(params: any): Promise<MCPResponse> {
    try {
      const { templateType, complianceFrameworks, businessDomain, scalabilityRequirements } = params;
      
      // Generate enterprise template with compliance considerations
      const template = await this.generateEnterpriseTemplate({
        type: templateType,
        compliance: complianceFrameworks || [],
        domain: businessDomain,
        scalability: scalabilityRequirements
      });
      
      return {
        success: true,
        data: {
          template,
          complianceReport: await this.generateComplianceReport(template, complianceFrameworks),
          securityRecommendations: await this.generateSecurityRecommendations(template),
          performanceGuidelines: await this.generatePerformanceGuidelines(scalabilityRequirements)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'TEMPLATE_GENERATION_FAILED',
          message: error.message,
          details: error
        }
      };
    }
  }
  
  async handleExternalDataIntegration(params: any): Promise<MCPResponse> {
    // Implementation for external data integration
    const { dataSource } = params;
    
    try {
      const connector = await this.createDataConnector(dataSource);
      const data = await connector.fetchData();
      const mappedData = await this.applyDataMapping(data, dataSource.mapping);
      
      return {
        success: true,
        data: {
          sourceData: data,
          mappedData,
          schema: connector.getSchema(),
          statistics: this.generateDataStatistics(mappedData)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DATA_INTEGRATION_FAILED',
          message: error.message,
          details: error
        }
      };
    }
  }
}

// Server registration
export function createCustomMCPServer(): CustomUnjucksMCPServer {
  return new CustomUnjucksMCPServer();
}
```

### MCP Server Discovery and Registration

```typescript
// mcp-registry.ts
export class MCPServerRegistry {
  private servers: Map<string, MCPServerDefinition> = new Map();
  
  registerServer(definition: MCPServerDefinition): void {
    this.validateServerDefinition(definition);
    this.servers.set(definition.name, definition);
  }
  
  discoverServers(searchPaths: string[]): Promise<MCPServerDefinition[]> {
    // Auto-discovery of MCP servers in specified paths
    const discovered: MCPServerDefinition[] = [];
    
    for (const path of searchPaths) {
      const packageJson = this.loadPackageJson(path);
      if (this.isMCPServer(packageJson)) {
        discovered.push(this.createServerDefinition(packageJson, path));
      }
    }
    
    return Promise.resolve(discovered);
  }
  
  private isMCPServer(packageJson: any): boolean {
    return packageJson.keywords?.includes('mcp-server') ||
           packageJson.unjucks?.mcpServer === true;
  }
}
```

## 2. Plugin System

### Plugin Architecture

```typescript
// plugin-system.ts
export interface UnjucksPlugin {
  name: string;
  version: string;
  description: string;
  dependencies?: PluginDependency[];
  
  // Lifecycle hooks
  onInstall?(): Promise<void>;
  onActivate?(context: PluginContext): Promise<void>;
  onDeactivate?(): Promise<void>;
  onUninstall?(): Promise<void>;
  
  // Extension points
  filters?: CustomFilterMap;
  validators?: ValidatorMap;
  dataConnectors?: DataConnectorMap;
  templates?: TemplateContribution[];
  commands?: CommandContribution[];
}

export interface PluginContext {
  // Core services
  templateEngine: TemplateEngine;
  semanticLayer: SemanticLayer;
  fileSystem: FileSystemService;
  logger: Logger;
  
  // Configuration and settings
  config: PluginConfig;
  workspaceRoot: string;
  
  // Event system
  events: EventEmitter;
  
  // Extension registration
  registerFilter(name: string, filter: CustomFilter): void;
  registerValidator(name: string, validator: CustomValidator): void;
  registerDataConnector(type: string, connector: DataConnector): void;
  registerCommand(command: CommandDefinition): void;
}

// Example plugin implementation
export class DatabaseIntegrationPlugin implements UnjucksPlugin {
  name = 'database-integration';
  version = '1.0.0';
  description = 'Provides database schema generation and ORM template support';
  
  async onActivate(context: PluginContext): Promise<void> {
    // Register custom filters
    context.registerFilter('toDatabaseType', this.toDatabaseTypeFilter.bind(this));
    context.registerFilter('toMigration', this.toMigrationFilter.bind(this));
    
    // Register data connectors
    context.registerDataConnector('postgresql', new PostgreSQLConnector());
    context.registerDataConnector('mysql', new MySQLConnector());
    context.registerDataConnector('mongodb', new MongoDBConnector());
    
    // Register custom commands
    context.registerCommand({
      name: 'generate-schema',
      description: 'Generate database schema from entity definitions',
      handler: this.handleSchemaGeneration.bind(this)
    });
    
    // Listen to events
    context.events.on('template.beforeRender', this.onBeforeRender.bind(this));
    context.events.on('template.afterRender', this.onAfterRender.bind(this));
  }
  
  private toDatabaseTypeFilter(value: any, databaseType: string): string {
    const typeMap = this.getTypeMapping(databaseType);
    return typeMap[typeof value] || 'TEXT';
  }
  
  private toMigrationFilter(schema: any): string {
    return this.generateMigrationScript(schema);
  }
}
```

### Plugin Manager

```typescript
// plugin-manager.ts
export class PluginManager {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private pluginContext: PluginContext;
  
  constructor(context: PluginContext) {
    this.pluginContext = context;
  }
  
  async installPlugin(pluginPath: string): Promise<void> {
    const pluginModule = await import(pluginPath);
    const plugin: UnjucksPlugin = pluginModule.default || pluginModule;
    
    // Validate plugin
    this.validatePlugin(plugin);
    
    // Check dependencies
    await this.resolveDependencies(plugin.dependencies);
    
    // Install plugin
    if (plugin.onInstall) {
      await plugin.onInstall();
    }
    
    // Store plugin
    this.plugins.set(plugin.name, {
      plugin,
      path: pluginPath,
      status: 'installed'
    });
  }
  
  async activatePlugin(pluginName: string): Promise<void> {
    const loadedPlugin = this.plugins.get(pluginName);
    if (!loadedPlugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }
    
    if (loadedPlugin.status === 'active') {
      return; // Already active
    }
    
    // Create isolated context for plugin
    const isolatedContext = this.createIsolatedContext(loadedPlugin.plugin);
    
    // Activate plugin
    if (loadedPlugin.plugin.onActivate) {
      await loadedPlugin.plugin.onActivate(isolatedContext);
    }
    
    loadedPlugin.status = 'active';
    loadedPlugin.context = isolatedContext;
  }
  
  private createIsolatedContext(plugin: UnjucksPlugin): PluginContext {
    return {
      ...this.pluginContext,
      // Override with plugin-specific implementations that include security restrictions
      registerFilter: (name: string, filter: CustomFilter) => {
        this.registerFilterWithSandbox(plugin.name, name, filter);
      },
      registerValidator: (name: string, validator: CustomValidator) => {
        this.registerValidatorWithSandbox(plugin.name, name, validator);
      },
      // ... other sandboxed methods
    };
  }
}
```

## 3. Custom Filters and Functions

### Template Filter Extensions

```typescript
// custom-filters.ts
export interface CustomFilter {
  name: string;
  description: string;
  async: boolean;
  parameters: FilterParameter[];
  handler: FilterHandler;
}

export type FilterHandler = (value: any, ...args: any[]) => any | Promise<any>;

// Example: Database-specific filters
export class DatabaseFilters {
  static registerFilters(registry: FilterRegistry): void {
    registry.register({
      name: 'sqlEscape',
      description: 'Escape SQL special characters',
      async: false,
      parameters: [],
      handler: (value: string) => {
        return value.replace(/'/g, "''")
                   .replace(/\\/g, '\\\\')
                   .replace(/\0/g, '\\0');
      }
    });
    
    registry.register({
      name: 'toMigration',
      description: 'Generate database migration from schema',
      async: true,
      parameters: [
        { name: 'databaseType', type: 'string', required: true },
        { name: 'operation', type: 'string', default: 'create' }
      ],
      handler: async (schema: any, databaseType: string, operation: string) => {
        const migrationGenerator = MigrationGeneratorFactory.create(databaseType);
        return await migrationGenerator.generate(schema, operation);
      }
    });
    
    registry.register({
      name: 'optimizeQuery',
      description: 'Optimize SQL query based on database type and schema',
      async: true,
      parameters: [
        { name: 'databaseType', type: 'string', required: true },
        { name: 'schema', type: 'object' }
      ],
      handler: async (query: string, databaseType: string, schema?: any) => {
        const optimizer = QueryOptimizerFactory.create(databaseType);
        return await optimizer.optimize(query, schema);
      }
    });
  }
}

// Advanced semantic filters
export class SemanticFilters {
  static registerFilters(registry: FilterRegistry): void {
    registry.register({
      name: 'inferType',
      description: 'Infer data type from RDF semantic context',
      async: true,
      parameters: [
        { name: 'ontology', type: 'string' },
        { name: 'property', type: 'string' }
      ],
      handler: async (value: any, ontology: string, property: string) => {
        const typeInferrer = new SemanticTypeInferrer();
        return await typeInferrer.inferType(value, ontology, property);
      }
    });
    
    registry.register({
      name: 'validateCompliance',
      description: 'Validate data against compliance framework',
      async: true,
      parameters: [
        { name: 'framework', type: 'string', required: true },
        { name: 'strictMode', type: 'boolean', default: false }
      ],
      handler: async (data: any, framework: string, strictMode: boolean) => {
        const validator = ComplianceValidatorFactory.create(framework);
        const result = await validator.validate(data, { strictMode });
        
        if (strictMode && !result.compliant) {
          throw new ComplianceViolationError(
            `Data does not comply with ${framework}`,
            result.violations
          );
        }
        
        return result;
      }
    });
  }
}
```

### Global Function Extensions

```typescript
// global-functions.ts
export class GlobalFunctions {
  static registerFunctions(engine: TemplateEngine): void {
    // Utility functions
    engine.addGlobal('generateId', (prefix = 'id') => {
      return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    });
    
    engine.addGlobal('currentTimestamp', (format = 'iso') => {
      const now = new Date();
      switch (format) {
        case 'iso':
          return now.toISOString();
        case 'unix':
          return Math.floor(now.getTime() / 1000);
        case 'human':
          return now.toLocaleString();
        default:
          return now.toString();
      }
    });
    
    // Async functions for external data
    engine.addGlobal('fetchExternalData', async (url: string, options: any = {}) => {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Unjucks-Template-Engine',
          ...options.headers
        },
        ...options
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data from ${url}: ${response.statusText}`);
      }
      
      return response.json();
    });
    
    // Environment and configuration access
    engine.addGlobal('env', (key: string, defaultValue?: any) => {
      return process.env[key] ?? defaultValue;
    });
    
    engine.addGlobal('config', (key: string, defaultValue?: any) => {
      const config = ConfigManager.getInstance();
      return config.get(key, defaultValue);
    });
  }
}
```

## 4. Validation Rule Extensions

### Custom Semantic Validators

```typescript
// custom-validators.ts
export interface ValidationRule {
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
  validator: ValidationFunction;
}

export type ValidationFunction = (data: any, context: ValidationContext) => Promise<ValidationResult>;

export class CustomValidatorRegistry {
  private validators: Map<string, ValidationRule> = new Map();
  
  register(rule: ValidationRule): void {
    this.validators.set(rule.name, rule);
  }
  
  async validate(data: any, ruleNames: string[], context: ValidationContext): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    for (const ruleName of ruleNames) {
      const rule = this.validators.get(ruleName);
      if (rule) {
        try {
          const result = await rule.validator(data, context);
          results.push(result);
        } catch (error) {
          results.push({
            ruleName,
            valid: false,
            severity: rule.severity,
            message: `Validation rule '${ruleName}' failed: ${error.message}`,
            errors: [error.message]
          });
        }
      }
    }
    
    return results;
  }
}

// Example: Healthcare data validation
export class HealthcareValidators {
  static registerValidators(registry: CustomValidatorRegistry): void {
    registry.register({
      name: 'fhir-resource-validation',
      description: 'Validate FHIR resource structure and constraints',
      severity: 'error',
      category: 'compliance',
      validator: async (data: any, context: ValidationContext) => {
        const fhirValidator = new FHIRResourceValidator();
        return await fhirValidator.validate(data);
      }
    });
    
    registry.register({
      name: 'phi-detection',
      description: 'Detect potential PHI (Protected Health Information)',
      severity: 'warning',
      category: 'privacy',
      validator: async (data: any, context: ValidationContext) => {
        const phiDetector = new PHIDetector();
        const detections = phiDetector.scan(data);
        
        return {
          ruleName: 'phi-detection',
          valid: detections.length === 0,
          severity: 'warning',
          message: detections.length > 0 
            ? `Potential PHI detected in ${detections.length} locations`
            : 'No PHI detected',
          details: detections
        };
      }
    });
    
    registry.register({
      name: 'medical-terminology-validation',
      description: 'Validate medical terminology against standard vocabularies',
      severity: 'info',
      category: 'terminology',
      validator: async (data: any, context: ValidationContext) => {
        const terminologyValidator = new MedicalTerminologyValidator();
        return await terminologyValidator.validateTerminology(data, {
          vocabularies: ['SNOMED-CT', 'ICD-10', 'LOINC'],
          strictMode: false
        });
      }
    });
  }
}
```

## 5. Data Source Connectors

### External Data Integration

```typescript
// data-connectors.ts
export interface DataConnector {
  type: string;
  name: string;
  description: string;
  
  connect(config: ConnectionConfig): Promise<DataConnection>;
  test(config: ConnectionConfig): Promise<ConnectionTestResult>;
  getSchema(connection: DataConnection): Promise<DataSchema>;
}

export abstract class BaseDataConnector implements DataConnector {
  abstract type: string;
  abstract name: string;
  abstract description: string;
  
  abstract connect(config: ConnectionConfig): Promise<DataConnection>;
  
  async test(config: ConnectionConfig): Promise<ConnectionTestResult> {
    try {
      const connection = await this.connect(config);
      await this.validateConnection(connection);
      await this.closeConnection(connection);
      
      return {
        success: true,
        message: 'Connection successful',
        latency: 0 // Implementation should measure actual latency
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        error
      };
    }
  }
  
  protected abstract validateConnection(connection: DataConnection): Promise<void>;
  protected abstract closeConnection(connection: DataConnection): Promise<void>;
}

// Example: Salesforce connector
export class SalesforceConnector extends BaseDataConnector {
  type = 'salesforce';
  name = 'Salesforce CRM';
  description = 'Connect to Salesforce CRM data via REST API';
  
  async connect(config: SalesforceConnectionConfig): Promise<SalesforceConnection> {
    const oauth = new SalesforceOAuth({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri
    });
    
    const token = await oauth.authenticate(config.username, config.password);
    
    return new SalesforceConnection({
      instanceUrl: config.instanceUrl,
      accessToken: token.access_token,
      apiVersion: config.apiVersion || '52.0'
    });
  }
  
  async getSchema(connection: SalesforceConnection): Promise<DataSchema> {
    const describe = await connection.describe();
    
    return {
      objects: describe.sobjects.map(sobject => ({
        name: sobject.name,
        label: sobject.label,
        fields: sobject.fields?.map(field => ({
          name: field.name,
          type: this.mapSalesforceType(field.type),
          required: !field.nillable,
          description: field.label
        })) || []
      }))
    };
  }
  
  protected async validateConnection(connection: SalesforceConnection): Promise<void> {
    await connection.query('SELECT Id FROM User LIMIT 1');
  }
  
  protected async closeConnection(connection: SalesforceConnection): Promise<void> {
    // Salesforce REST API doesn't require explicit connection closing
  }
}

// Example: GraphQL connector
export class GraphQLConnector extends BaseDataConnector {
  type = 'graphql';
  name = 'GraphQL API';
  description = 'Connect to GraphQL endpoints';
  
  async connect(config: GraphQLConnectionConfig): Promise<GraphQLConnection> {
    return new GraphQLConnection({
      endpoint: config.endpoint,
      headers: config.headers,
      authentication: config.authentication
    });
  }
  
  async getSchema(connection: GraphQLConnection): Promise<DataSchema> {
    const introspectionQuery = getIntrospectionQuery();
    const result = await connection.query(introspectionQuery);
    
    return this.parseGraphQLSchema(result.data.__schema);
  }
  
  protected async validateConnection(connection: GraphQLConnection): Promise<void> {
    await connection.query('{ __typename }');
  }
  
  protected async closeConnection(connection: GraphQLConnection): Promise<void> {
    // HTTP connections don't require explicit closing
  }
}
```

## 6. Template Marketplace Integration

### Template Contribution System

```typescript
// template-marketplace.ts
export interface TemplateContribution {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  tags: string[];
  
  // Template metadata
  framework?: string;
  language?: string;
  platform?: string;
  
  // Files and structure
  templates: TemplateFile[];
  dependencies: TemplateDependency[];
  
  // Marketplace info
  rating?: number;
  downloads?: number;
  license: string;
  repository?: string;
  documentation?: string;
}

export interface TemplateFile {
  path: string;
  content: string;
  frontmatter?: FrontmatterConfig;
}

export class TemplateMarketplace {
  private registry: TemplateRegistry;
  private storage: TemplateStorage;
  
  constructor(registry: TemplateRegistry, storage: TemplateStorage) {
    this.registry = registry;
    this.storage = storage;
  }
  
  async publishTemplate(contribution: TemplateContribution): Promise<PublishResult> {
    // Validate template structure
    const validation = await this.validateTemplate(contribution);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }
    
    // Security scan
    const securityScan = await this.performSecurityScan(contribution);
    if (securityScan.hasVulnerabilities) {
      return {
        success: false,
        errors: ['Template contains security vulnerabilities'],
        details: securityScan.vulnerabilities
      };
    }
    
    // Store template
    const templateId = await this.storage.store(contribution);
    
    // Register in marketplace
    await this.registry.register({
      ...contribution,
      id: templateId,
      publishedAt: new Date(),
      status: 'published'
    });
    
    return {
      success: true,
      templateId,
      message: 'Template published successfully'
    };
  }
  
  async searchTemplates(query: TemplateSearchQuery): Promise<TemplateSearchResult[]> {
    return await this.registry.search(query);
  }
  
  async installTemplate(templateId: string, targetPath: string): Promise<InstallResult> {
    const template = await this.registry.getTemplate(templateId);
    if (!template) {
      return {
        success: false,
        message: 'Template not found'
      };
    }
    
    // Download template
    const templateData = await this.storage.retrieve(templateId);
    
    // Install dependencies
    await this.installDependencies(template.dependencies);
    
    // Extract template files
    await this.extractTemplateFiles(templateData, targetPath);
    
    // Update usage statistics
    await this.registry.incrementDownloadCount(templateId);
    
    return {
      success: true,
      message: 'Template installed successfully',
      installedFiles: templateData.templates.map(t => t.path)
    };
  }
  
  private async validateTemplate(contribution: TemplateContribution): Promise<ValidationResult> {
    const errors: string[] = [];
    
    // Check required fields
    if (!contribution.name || !contribution.description || !contribution.version) {
      errors.push('Missing required fields: name, description, or version');
    }
    
    // Validate template files
    for (const templateFile of contribution.templates) {
      if (!templateFile.path || !templateFile.content) {
        errors.push(`Invalid template file: ${templateFile.path}`);
      }
      
      // Parse and validate frontmatter
      if (templateFile.frontmatter) {
        const parser = new FrontmatterParser();
        const validation = parser.validate(templateFile.frontmatter);
        if (!validation.valid) {
          errors.push(...validation.errors.map(e => `${templateFile.path}: ${e}`));
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  private async performSecurityScan(contribution: TemplateContribution): Promise<SecurityScanResult> {
    const scanner = new TemplateSecurityScanner();
    return await scanner.scan(contribution);
  }
}
```

## 7. Event-Driven Extensions

### Event System for Extensions

```typescript
// event-system.ts
export interface ExtensionEvent {
  type: string;
  data: any;
  timestamp: Date;
  source: string;
}

export class ExtensionEventSystem {
  private listeners: Map<string, EventListener[]> = new Map();
  
  on(eventType: string, listener: EventListener): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);
  }
  
  off(eventType: string, listener: EventListener): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }
  
  async emit(event: ExtensionEvent): Promise<void> {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      const promises = listeners.map(listener => {
        try {
          return listener(event);
        } catch (error) {
          console.error(`Event listener error for ${event.type}:`, error);
          return Promise.resolve();
        }
      });
      
      await Promise.all(promises);
    }
  }
  
  // Predefined event types
  static readonly EVENTS = {
    TEMPLATE_DISCOVERED: 'template.discovered',
    TEMPLATE_BEFORE_RENDER: 'template.beforeRender',
    TEMPLATE_AFTER_RENDER: 'template.afterRender',
    TEMPLATE_ERROR: 'template.error',
    
    RDF_LOADED: 'rdf.loaded',
    RDF_VALIDATED: 'rdf.validated',
    
    VALIDATION_STARTED: 'validation.started',
    VALIDATION_COMPLETED: 'validation.completed',
    
    FILE_CREATED: 'file.created',
    FILE_MODIFIED: 'file.modified',
    FILE_DELETED: 'file.deleted',
    
    PLUGIN_INSTALLED: 'plugin.installed',
    PLUGIN_ACTIVATED: 'plugin.activated',
    PLUGIN_DEACTIVATED: 'plugin.deactivated'
  };
}
```

This extension architecture enables developers to build powerful customizations while maintaining system stability and security through proper isolation and validation mechanisms. Extensions can be developed independently and distributed through the marketplace, creating a rich ecosystem around Unjucks.