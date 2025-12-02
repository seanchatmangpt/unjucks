/**
 * @fileoverview Registry abstraction layer for multiple backend support
 * @version 1.0.0
 * @description Provides unified interface for NPM, OCI, and Git registry backends
 */

import { EventEmitter } from 'events';
import { KPackManifest, ContentAddress, ArtifactReference } from '../types/kpack.js';

// ==============================================================================
// Core Registry Interfaces
// ==============================================================================

/**
 * Registry configuration options
 */
export interface RegistryConfig {
  type: 'npm' | 'oci' | 'git';
  url: string;
  namespace?: string;
  credentials?: {
    username?: string;
    password?: string;
    token?: string;
    keyPath?: string;
  };
  options?: Record<string, any>;
}

/**
 * Package metadata for registry operations
 */
export interface PackageMetadata {
  name: string;
  version: string;
  description?: string;
  tags?: string[];
  publishedAt: Date;
  size: number;
  checksum: string;
  manifest: KPackManifest;
}

/**
 * Registry operation result
 */
export interface RegistryResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    duration: number;
    registry: string;
    operation: string;
  };
}

/**
 * Package search criteria
 */
export interface SearchCriteria {
  query?: string;
  domain?: string[];
  artifactType?: string[];
  compliance?: string[];
  maturity?: string;
  license?: string;
  publisher?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'downloads' | 'updated' | 'created' | 'name';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Package search result
 */
export interface SearchResult {
  packages: PackageMetadata[];
  total: number;
  offset: number;
  limit: number;
  facets?: Record<string, Record<string, number>>;
}

/**
 * Package download info
 */
export interface DownloadInfo {
  url: string;
  headers?: Record<string, string>;
  expires?: Date;
  method?: 'GET' | 'POST';
  authentication?: {
    type: 'bearer' | 'basic' | 'api-key';
    value: string;
  };
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalPackages: number;
  totalDownloads: number;
  totalSize: number;
  averageRating?: number;
  topDomains: Array<{ domain: string; count: number }>;
  topPublishers: Array<{ publisher: string; count: number }>;
  recentActivity: Array<{
    type: 'publish' | 'download' | 'update';
    package: string;
    timestamp: Date;
  }>;
}

// ==============================================================================
// Abstract Registry Base Class
// ==============================================================================

/**
 * Abstract base class for all registry implementations
 */
export abstract class RegistryAdapter extends EventEmitter {
  protected config: RegistryConfig;
  protected connected: boolean = false;

  constructor(config: RegistryConfig) {
    super();
    this.config = config;
  }

  /**
   * Connect to the registry
   */
  abstract connect(): Promise<RegistryResult<void>>;

  /**
   * Disconnect from the registry
   */
  abstract disconnect(): Promise<RegistryResult<void>>;

  /**
   * Test registry connectivity and authentication
   */
  abstract healthCheck(): Promise<RegistryResult<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    features: string[];
  }>>;

  /**
   * Publish a KPack to the registry
   */
  abstract publish(
    kpack: KPackManifest,
    artifacts: Map<string, Buffer>
  ): Promise<RegistryResult<{ url: string; version: string }>>;

  /**
   * Get package metadata by name and version
   */
  abstract getPackage(
    name: string,
    version?: string
  ): Promise<RegistryResult<PackageMetadata>>;

  /**
   * List all versions of a package
   */
  abstract getVersions(name: string): Promise<RegistryResult<string[]>>;

  /**
   * Get download URL for a package
   */
  abstract getDownloadUrl(
    name: string,
    version: string
  ): Promise<RegistryResult<DownloadInfo>>;

  /**
   * Download package artifacts
   */
  abstract download(
    name: string,
    version: string
  ): Promise<RegistryResult<Map<string, Buffer>>>;

  /**
   * Search for packages
   */
  abstract search(criteria: SearchCriteria): Promise<RegistryResult<SearchResult>>;

  /**
   * Delete a package version
   */
  abstract unpublish(
    name: string,
    version: string
  ): Promise<RegistryResult<void>>;

  /**
   * Update package metadata (tags, description, etc.)
   */
  abstract updateMetadata(
    name: string,
    version: string,
    metadata: Partial<PackageMetadata>
  ): Promise<RegistryResult<void>>;

  /**
   * Get registry statistics
   */
  abstract getStats(): Promise<RegistryResult<RegistryStats>>;

  /**
   * Verify package integrity
   */
  abstract verify(
    name: string,
    version: string
  ): Promise<RegistryResult<{
    valid: boolean;
    issues?: string[];
    checksums: Record<string, string>;
  }>>;

  // Utility methods
  
  /**
   * Check if connected to registry
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get registry configuration
   */
  getConfig(): Readonly<RegistryConfig> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Update registry configuration
   */
  updateConfig(updates: Partial<RegistryConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config-updated', this.config);
  }

  /**
   * Generate a package URL for the registry
   */
  protected abstract generatePackageUrl(name: string, version?: string): string;

  /**
   * Validate package name according to registry rules
   */
  protected abstract validatePackageName(name: string): boolean;

  /**
   * Transform KPack manifest for registry-specific format
   */
  protected abstract transformManifest(manifest: KPackManifest): any;

  /**
   * Parse registry-specific manifest back to KPack format
   */
  protected abstract parseManifest(registryManifest: any): KPackManifest;
}

// ==============================================================================
// Registry Factory
// ==============================================================================

/**
 * Registry factory for creating appropriate registry adapters
 */
export class RegistryFactory {
  private static adapters = new Map<string, typeof RegistryAdapter>();

  /**
   * Register a registry adapter
   */
  static register(type: string, adapter: typeof RegistryAdapter): void {
    this.adapters.set(type, adapter);
  }

  /**
   * Create a registry adapter instance
   */
  static create(config: RegistryConfig): RegistryAdapter {
    const AdapterClass = this.adapters.get(config.type);
    if (!AdapterClass) {
      throw new Error(`Unknown registry type: ${config.type}`);
    }
    return new AdapterClass(config);
  }

  /**
   * Get list of supported registry types
   */
  static getSupportedTypes(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if a registry type is supported
   */
  static isSupported(type: string): boolean {
    return this.adapters.has(type);
  }
}

// ==============================================================================
// Registry Manager
// ==============================================================================

/**
 * Multi-registry manager for handling multiple registries
 */
export class RegistryManager extends EventEmitter {
  private registries = new Map<string, RegistryAdapter>();
  private defaultRegistry?: string;

  /**
   * Add a registry
   */
  async addRegistry(
    name: string,
    config: RegistryConfig,
    setAsDefault: boolean = false
  ): Promise<void> {
    const registry = RegistryFactory.create(config);
    
    // Set up event forwarding
    registry.on('error', (error) => {
      this.emit('registry-error', name, error);
    });
    
    registry.on('connected', () => {
      this.emit('registry-connected', name);
    });
    
    registry.on('disconnected', () => {
      this.emit('registry-disconnected', name);
    });

    // Connect to the registry
    const result = await registry.connect();
    if (!result.success) {
      throw new Error(`Failed to connect to registry ${name}: ${result.error}`);
    }

    this.registries.set(name, registry);
    
    if (setAsDefault || !this.defaultRegistry) {
      this.defaultRegistry = name;
    }

    this.emit('registry-added', name);
  }

  /**
   * Remove a registry
   */
  async removeRegistry(name: string): Promise<void> {
    const registry = this.registries.get(name);
    if (!registry) {
      throw new Error(`Registry ${name} not found`);
    }

    await registry.disconnect();
    this.registries.delete(name);

    if (this.defaultRegistry === name) {
      this.defaultRegistry = this.registries.keys().next().value;
    }

    this.emit('registry-removed', name);
  }

  /**
   * Get a registry by name
   */
  getRegistry(name?: string): RegistryAdapter {
    const registryName = name || this.defaultRegistry;
    if (!registryName) {
      throw new Error('No registry specified and no default registry set');
    }

    const registry = this.registries.get(registryName);
    if (!registry) {
      throw new Error(`Registry ${registryName} not found`);
    }

    return registry;
  }

  /**
   * List all registered registries
   */
  listRegistries(): Array<{ name: string; type: string; url: string; default: boolean }> {
    return Array.from(this.registries.entries()).map(([name, registry]) => ({
      name,
      type: registry.getConfig().type,
      url: registry.getConfig().url,
      default: name === this.defaultRegistry
    }));
  }

  /**
   * Set default registry
   */
  setDefaultRegistry(name: string): void {
    if (!this.registries.has(name)) {
      throw new Error(`Registry ${name} not found`);
    }
    this.defaultRegistry = name;
    this.emit('default-registry-changed', name);
  }

  /**
   * Publish to multiple registries
   */
  async publishToAll(
    kpack: KPackManifest,
    artifacts: Map<string, Buffer>,
    registries?: string[]
  ): Promise<Map<string, RegistryResult<{ url: string; version: string }>>> {
    const targetRegistries = registries || Array.from(this.registries.keys());
    const results = new Map<string, RegistryResult<{ url: string; version: string }>>();

    await Promise.all(
      targetRegistries.map(async (name) => {
        try {
          const registry = this.getRegistry(name);
          const result = await registry.publish(kpack, artifacts);
          results.set(name, result);
        } catch (error) {
          results.set(name, {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      })
    );

    return results;
  }

  /**
   * Search across multiple registries
   */
  async searchAll(
    criteria: SearchCriteria,
    registries?: string[]
  ): Promise<Map<string, RegistryResult<SearchResult>>> {
    const targetRegistries = registries || Array.from(this.registries.keys());
    const results = new Map<string, RegistryResult<SearchResult>>();

    await Promise.all(
      targetRegistries.map(async (name) => {
        try {
          const registry = this.getRegistry(name);
          const result = await registry.search(criteria);
          results.set(name, result);
        } catch (error) {
          results.set(name, {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      })
    );

    return results;
  }

  /**
   * Get health status of all registries
   */
  async getHealthStatus(): Promise<Map<string, RegistryResult<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    features: string[];
  }>>> {
    const results = new Map();

    await Promise.all(
      Array.from(this.registries.entries()).map(async ([name, registry]) => {
        try {
          const result = await registry.healthCheck();
          results.set(name, result);
        } catch (error) {
          results.set(name, {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      })
    );

    return results;
  }

  /**
   * Disconnect from all registries
   */
  async disconnect(): Promise<void> {
    await Promise.all(
      Array.from(this.registries.values()).map(registry => registry.disconnect())
    );
    this.registries.clear();
    this.defaultRegistry = undefined;
    this.emit('all-disconnected');
  }
}

// ==============================================================================
// Utility Functions
// ==============================================================================

/**
 * Validate registry configuration
 */
export function validateRegistryConfig(config: RegistryConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.type) {
    errors.push('Registry type is required');
  } else if (!['npm', 'oci', 'git'].includes(config.type)) {
    errors.push('Registry type must be npm, oci, or git');
  }

  if (!config.url) {
    errors.push('Registry URL is required');
  } else {
    try {
      new URL(config.url);
    } catch {
      errors.push('Registry URL must be valid');
    }
  }

  if (config.namespace && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(config.namespace)) {
    errors.push('Registry namespace must be lowercase alphanumeric with hyphens');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate a registry URL with proper path handling
 */
export function buildRegistryUrl(baseUrl: string, ...parts: string[]): string {
  const url = new URL(baseUrl);
  const path = [url.pathname.replace(/\/$/, ''), ...parts]
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/');
  
  url.pathname = path;
  return url.toString();
}

/**
 * Parse registry URL to extract components
 */
export function parseRegistryUrl(url: string): {
  protocol: string;
  host: string;
  port?: number;
  path: string;
  namespace?: string;
} {
  const parsed = new URL(url);
  const pathParts = parsed.pathname.split('/').filter(Boolean);
  
  return {
    protocol: parsed.protocol,
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port) : undefined,
    path: parsed.pathname,
    namespace: pathParts[0] || undefined
  };
}

/**
 * Create a registry configuration from environment variables
 */
export function createConfigFromEnv(prefix: string = 'KGEN_REGISTRY'): RegistryConfig | null {
  const type = process.env[`${prefix}_TYPE`] as RegistryConfig['type'];
  const url = process.env[`${prefix}_URL`];
  
  if (!type || !url) {
    return null;
  }

  return {
    type,
    url,
    namespace: process.env[`${prefix}_NAMESPACE`],
    credentials: {
      username: process.env[`${prefix}_USERNAME`],
      password: process.env[`${prefix}_PASSWORD`],
      token: process.env[`${prefix}_TOKEN`],
      keyPath: process.env[`${prefix}_KEY_PATH`]
    }
  };
}