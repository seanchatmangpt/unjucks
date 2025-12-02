/**
 * Registry Manager - Main orchestration class for multiple registry backends
 * Provides unified interface for package operations across different registry types
 */

import { EventEmitter } from 'events';
import RegistryConfig from './config/registry-config.js';
import RegistryAuth from './auth/registry-auth.js';
import RegistryCache from './cache/registry-cache.js';
import RegistryDiscovery from './discovery/registry-discovery.js';

// Registry backend implementations
import NpmRegistry from './backends/npm-registry.js';
import OciRegistry from './backends/oci-registry.js';
import GitRegistry from './backends/git-registry.js';
import IpfsRegistry from './backends/ipfs-registry.js';

import { RegistryError, RegistryNotFoundError, RegistryAuthError, RegistryNetworkError } from './registry-interface.js';

export class RegistryManagerError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'RegistryManagerError';
    this.code = code;
  }
}

export class RegistryManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Initialize components
    this.config = new RegistryConfig(options.config);
    this.auth = new RegistryAuth(options.auth);
    this.cache = new RegistryCache(options.cache);
    this.discovery = new RegistryDiscovery(options.discovery);
    
    // Registry instances
    this.registries = new Map();
    this.registryTypes = new Map([
      ['npm', NpmRegistry],
      ['oci', OciRegistry],
      ['git', GitRegistry],
      ['ipfs', IpfsRegistry]
    ]);
    
    this.initialized = false;
    this.stats = {
      operations: 0,
      successes: 0,
      failures: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Initialize the registry manager
   * @param {Object} options - Initialization options
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    try {
      // Load configuration
      await this.config.load();
      
      // Initialize authentication
      if (options.enableAuth !== false) {
        await this.auth.initialize(options.passphrase);
      }
      
      // Initialize cache
      if (this.config.getCacheConfig().enabled) {
        await this.cache.initialize();
      }
      
      // Initialize discovery
      await this.setupEventHandlers();
      
      // Create registry instances
      await this.createRegistryInstances();
      
      // Auto-discover additional registries if enabled
      if (options.autoDiscover) {
        await this.discoverAndAddRegistries(options.discoveryOptions);
      }
      
      this.initialized = true;
      this.emit('initialized', { 
        registries: Array.from(this.registries.keys()),
        config: this.config.getEnabledRegistries()
      });
      
    } catch (error) {
      this.emit('error', { operation: 'initialize', error });
      throw new RegistryManagerError(`Initialization failed: ${error.message}`, 'INIT_FAILED');
    }
  }

  /**
   * Publish a package to registries
   * @param {Object} packageInfo - Package information
   * @param {Object} options - Publishing options
   * @returns {Promise<Array<Object>>} Publishing results
   */
  async publish(packageInfo, options = {}) {
    this.ensureInitialized();
    this.stats.operations++;
    
    try {
      const strategy = this.config.getStrategy('publish');
      const results = [];
      
      // Primary registry
      const primaryRegistry = strategy?.primary || 'npm';
      const primaryResult = await this.publishToRegistry(primaryRegistry, packageInfo, options);
      
      if (primaryResult.success) {
        results.push(primaryResult);
        this.stats.successes++;
        
        // Fallback registries if primary fails or if specified
        if (options.publishToAll || !primaryResult.success) {
          const fallbacks = strategy?.fallbacks || [];
          
          for (const fallbackName of fallbacks) {
            if (fallbackName === primaryRegistry) continue;
            
            try {
              const fallbackResult = await this.publishToRegistry(fallbackName, packageInfo, options);
              results.push(fallbackResult);
              
              if (fallbackResult.success) {
                this.stats.successes++;
              }
            } catch (error) {
              results.push({
                success: false,
                registry: fallbackName,
                error: error.message
              });
            }
          }
        }
      } else {
        this.stats.failures++;
        throw new RegistryError(`Primary registry publish failed: ${primaryResult.error}`, 'PUBLISH_FAILED');
      }
      
      this.emit('published', { 
        package: `${packageInfo.name}@${packageInfo.version}`,
        results: results.length
      });
      
      return results;
    } catch (error) {
      this.stats.failures++;
      this.emit('error', { operation: 'publish', error });
      throw error;
    }
  }

  /**
   * Search for packages across registries
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array<Object>>} Search results
   */
  async search(query, options = {}) {
    this.ensureInitialized();
    this.stats.operations++;
    
    try {
      // Check cache first
      const cacheKey = `search:${query}:${JSON.stringify(options)}`;
      const cached = await this.getCachedResults('search', cacheKey);
      
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }
      
      this.stats.cacheMisses++;
      
      const strategy = this.config.getStrategy('search');
      const searchRegistries = strategy?.registries || ['npm'];
      const maxResults = options.limit || strategy?.maxResults || 20;
      
      let allResults = [];
      
      if (strategy?.aggregated) {
        // Search all registries and merge results
        const searchPromises = searchRegistries.map(registryName => 
          this.searchInRegistry(registryName, query, {
            ...options,
            limit: Math.ceil(maxResults / searchRegistries.length)
          }).catch(error => ({
            registry: registryName,
            error: error.message,
            results: []
          }))
        );
        
        const registryResults = await Promise.allSettled(searchPromises);
        
        for (const result of registryResults) {
          if (result.status === 'fulfilled' && result.value.results) {
            allResults.push(...result.value.results.map(pkg => ({
              ...pkg,
              registry: result.value.registry || 'unknown'
            })));
          }
        }
        
        // Merge and deduplicate results
        if (strategy?.mergeResults) {
          allResults = this.mergeSearchResults(allResults);
        }
        
        // Sort by relevance/score
        allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
        
        // Limit total results
        allResults = allResults.slice(0, maxResults);
        
      } else {
        // Search registries in priority order until we have enough results
        for (const registryName of searchRegistries) {
          try {
            const result = await this.searchInRegistry(registryName, query, {
              ...options,
              limit: maxResults - allResults.length
            });
            
            allResults.push(...result.results.map(pkg => ({
              ...pkg,
              registry: registryName
            })));
            
            if (allResults.length >= maxResults) break;
            
          } catch (error) {
            // Continue with next registry
            continue;
          }
        }
      }
      
      // Cache results
      await this.cacheResults('search', cacheKey, allResults);
      
      this.stats.successes++;
      this.emit('searched', { 
        query, 
        results: allResults.length,
        registries: searchRegistries
      });
      
      return allResults;
    } catch (error) {
      this.stats.failures++;
      this.emit('error', { operation: 'search', error });
      throw error;
    }
  }

  /**
   * Get package information
   * @param {string} name - Package name
   * @param {string} version - Package version
   * @param {Object} options - Options
   * @returns {Promise<Object>} Package information
   */
  async getPackageInfo(name, version = 'latest', options = {}) {
    this.ensureInitialized();
    this.stats.operations++;
    
    try {
      // Check cache first
      const cached = await this.cache.getPackageInfo(
        options.registry || 'any',
        name,
        version
      );
      
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }
      
      this.stats.cacheMisses++;
      
      const registryPriority = this.getRegistryPriority('download');
      let lastError = null;
      
      for (const registryName of registryPriority) {
        if (options.registry && options.registry !== registryName) {
          continue;
        }
        
        try {
          const registry = this.registries.get(registryName);
          if (!registry) continue;
          
          const packageInfo = await registry.getPackageInfo(name, version);
          
          // Cache the result
          await this.cache.setPackageInfo(registryName, name, version, packageInfo);
          
          this.stats.successes++;
          this.emit('packageInfoRetrieved', { 
            name, 
            version, 
            registry: registryName 
          });
          
          return {
            ...packageInfo,
            registry: registryName
          };
          
        } catch (error) {
          lastError = error;
          if (error instanceof RegistryNotFoundError) {
            continue; // Try next registry
          }
          // For other errors, continue but log
          this.emit('warning', {
            message: `Failed to get package info from ${registryName}`,
            error: error.message
          });
        }
      }
      
      this.stats.failures++;
      throw lastError || new RegistryNotFoundError(`${name}@${version}`, 'any');
      
    } catch (error) {
      this.stats.failures++;
      this.emit('error', { operation: 'getPackageInfo', error });
      throw error;
    }
  }

  /**
   * Download package content
   * @param {string} name - Package name
   * @param {string} version - Package version
   * @param {Object} options - Download options
   * @returns {Promise<Buffer>} Package content
   */
  async downloadPackage(name, version = 'latest', options = {}) {
    this.ensureInitialized();
    this.stats.operations++;
    
    try {
      // Check cache first
      const cached = await this.cache.getPackageContent(
        options.registry || 'any',
        name,
        version
      );
      
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }
      
      this.stats.cacheMisses++;
      
      const strategy = this.config.getStrategy('download');
      const registryPriority = strategy?.priority || this.getRegistryPriority('download');
      
      if (strategy?.parallel && !options.registry) {
        // Try downloading from multiple registries in parallel
        return await this.downloadPackageParallel(name, version, registryPriority, options);
      }
      
      // Sequential download
      let lastError = null;
      
      for (const registryName of registryPriority) {
        if (options.registry && options.registry !== registryName) {
          continue;
        }
        
        try {
          const registry = this.registries.get(registryName);
          if (!registry) continue;
          
          const content = await registry.downloadPackage(name, version, options);
          
          // Cache the content
          await this.cache.setPackageContent(registryName, name, version, content);
          
          this.stats.successes++;
          this.emit('packageDownloaded', { 
            name, 
            version, 
            registry: registryName,
            size: content.length
          });
          
          return content;
          
        } catch (error) {
          lastError = error;
          if (error instanceof RegistryNotFoundError) {
            continue; // Try next registry
          }
          // For other errors, continue but log
          this.emit('warning', {
            message: `Failed to download from ${registryName}`,
            error: error.message
          });
        }
      }
      
      this.stats.failures++;
      throw lastError || new RegistryNotFoundError(`${name}@${version}`, 'any');
      
    } catch (error) {
      this.stats.failures++;
      this.emit('error', { operation: 'downloadPackage', error });
      throw error;
    }
  }

  /**
   * List package versions
   * @param {string} name - Package name
   * @param {Object} options - Options
   * @returns {Promise<Array<string>>} List of versions
   */
  async listVersions(name, options = {}) {
    this.ensureInitialized();
    this.stats.operations++;
    
    try {
      const registryPriority = this.getRegistryPriority('download');
      let lastError = null;
      
      for (const registryName of registryPriority) {
        if (options.registry && options.registry !== registryName) {
          continue;
        }
        
        try {
          const registry = this.registries.get(registryName);
          if (!registry) continue;
          
          const versions = await registry.listVersions(name);
          
          this.stats.successes++;
          this.emit('versionsListed', { 
            name, 
            registry: registryName,
            count: versions.length
          });
          
          return versions;
          
        } catch (error) {
          lastError = error;
          if (error instanceof RegistryNotFoundError) {
            continue; // Try next registry
          }
        }
      }
      
      this.stats.failures++;
      throw lastError || new RegistryNotFoundError(name, 'any');
      
    } catch (error) {
      this.stats.failures++;
      this.emit('error', { operation: 'listVersions', error });
      throw error;
    }
  }

  /**
   * Add a new registry
   * @param {string} name - Registry name
   * @param {Object} config - Registry configuration
   * @returns {Promise<void>}
   */
  async addRegistry(name, config) {
    this.ensureInitialized();
    
    try {
      // Add to configuration
      this.config.setRegistry(name, config);
      
      // Create registry instance
      await this.createRegistryInstance(name, config);
      
      // Save configuration
      await this.config.save();
      
      this.emit('registryAdded', { name, type: config.type });
    } catch (error) {
      this.emit('error', { operation: 'addRegistry', error });
      throw new RegistryManagerError(`Failed to add registry: ${error.message}`, 'ADD_FAILED');
    }
  }

  /**
   * Remove a registry
   * @param {string} name - Registry name
   * @returns {Promise<void>}
   */
  async removeRegistry(name) {
    this.ensureInitialized();
    
    try {
      // Remove from configuration
      this.config.removeRegistry(name);
      
      // Clean up registry instance
      const registry = this.registries.get(name);
      if (registry) {
        await registry.cleanup();
        this.registries.delete(name);
      }
      
      // Remove authentication
      await this.auth.removeCredentials(name);
      
      // Save configuration
      await this.config.save();
      
      this.emit('registryRemoved', { name });
    } catch (error) {
      this.emit('error', { operation: 'removeRegistry', error });
      throw new RegistryManagerError(`Failed to remove registry: ${error.message}`, 'REMOVE_FAILED');
    }
  }

  /**
   * Get registry health status
   * @param {string} name - Registry name (optional)
   * @returns {Promise<Object>} Health status
   */
  async getRegistryHealth(name = null) {
    this.ensureInitialized();
    
    const registriesToCheck = name ? [name] : Array.from(this.registries.keys());
    const healthResults = {};
    
    const healthPromises = registriesToCheck.map(async (registryName) => {
      const registry = this.registries.get(registryName);
      if (!registry) {
        return { name: registryName, healthy: false, error: 'Registry not found' };
      }
      
      try {
        const startTime = Date.now();
        const healthy = await registry.isHealthy();
        const responseTime = Date.now() - startTime;
        
        return {
          name: registryName,
          healthy,
          responseTime,
          capabilities: await registry.getCapabilities()
        };
      } catch (error) {
        return {
          name: registryName,
          healthy: false,
          error: error.message
        };
      }
    });
    
    const results = await Promise.allSettled(healthPromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        healthResults[result.value.name] = result.value;
      }
    }
    
    return name ? healthResults[name] : healthResults;
  }

  /**
   * Get registry manager statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) || 0,
      successRate: this.stats.successes / this.stats.operations || 0,
      registries: Array.from(this.registries.keys()),
      initialized: this.initialized
    };
  }

  /**
   * Discover and add new registries
   * @param {Object} options - Discovery options
   * @returns {Promise<Array<Object>>} Discovered registries
   */
  async discoverAndAddRegistries(options = {}) {
    try {
      const discovered = await this.discovery.discoverRegistries(options);
      const added = [];
      
      for (const registry of discovered) {
        if (!this.registries.has(registry.name)) {
          try {
            await this.addRegistry(registry.name, {
              type: registry.type,
              name: registry.name,
              baseUrl: registry.baseUrl,
              enabled: false, // Don't enable automatically
              priority: 99, // Low priority for discovered registries
              ...registry.metadata
            });
            
            added.push(registry);
          } catch (error) {
            this.emit('warning', {
              message: `Failed to add discovered registry ${registry.name}`,
              error: error.message
            });
          }
        }
      }
      
      this.emit('registriesDiscovered', { 
        discovered: discovered.length,
        added: added.length
      });
      
      return added;
    } catch (error) {
      this.emit('error', { operation: 'discoverAndAddRegistries', error });
      throw error;
    }
  }

  /**
   * Clear all caches
   * @returns {Promise<void>}
   */
  async clearCache() {
    await this.cache.clear();
    this.discovery.clearCache();
    this.stats.cacheHits = 0;
    this.stats.cacheMisses = 0;
    this.emit('cacheCleared');
  }

  /**
   * Private helper methods
   */

  ensureInitialized() {
    if (!this.initialized) {
      throw new RegistryManagerError('Registry manager not initialized', 'NOT_INITIALIZED');
    }
  }

  async createRegistryInstances() {
    const enabledRegistries = this.config.getEnabledRegistries();
    
    for (const [name, config] of Object.entries(enabledRegistries)) {
      await this.createRegistryInstance(name, config);
    }
  }

  async createRegistryInstance(name, config) {
    const RegistryClass = this.registryTypes.get(config.type);
    
    if (!RegistryClass) {
      throw new RegistryManagerError(`Unknown registry type: ${config.type}`, 'UNKNOWN_TYPE');
    }
    
    const registry = new RegistryClass(config);
    
    try {
      await registry.initialize();
      
      // Authenticate if credentials are available
      try {
        await this.auth.authenticateRegistry(name, registry);
      } catch (error) {
        // Authentication is optional for many operations
        this.emit('warning', {
          message: `Authentication failed for ${name}`,
          error: error.message
        });
      }
      
      this.registries.set(name, registry);
      
    } catch (error) {
      throw new RegistryManagerError(
        `Failed to initialize registry ${name}: ${error.message}`,
        'REGISTRY_INIT_FAILED'
      );
    }
  }

  async publishToRegistry(registryName, packageInfo, options) {
    const registry = this.registries.get(registryName);
    
    if (!registry) {
      return {
        success: false,
        registry: registryName,
        error: 'Registry not found or not enabled'
      };
    }
    
    try {
      const result = await registry.publish(packageInfo, options);
      return {
        success: true,
        registry: registryName,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        registry: registryName,
        error: error.message
      };
    }
  }

  async searchInRegistry(registryName, query, options) {
    const registry = this.registries.get(registryName);
    
    if (!registry) {
      throw new RegistryManagerError(`Registry ${registryName} not found`, 'REGISTRY_NOT_FOUND');
    }
    
    const results = await registry.search(query, options);
    return {
      registry: registryName,
      results: results
    };
  }

  getRegistryPriority(operation) {
    const enabledRegistries = this.config.getRegistriesByPriority(true);
    return enabledRegistries
      .filter(registry => {
        const features = registry.features || [];
        return features.includes(operation) || features.includes('all');
      })
      .map(registry => registry.name);
  }

  mergeSearchResults(results) {
    const merged = new Map();
    
    for (const result of results) {
      const key = `${result.name}@${result.version || 'latest'}`;
      
      if (merged.has(key)) {
        const existing = merged.get(key);
        // Merge scores and metadata
        existing.score = Math.max(existing.score || 0, result.score || 0);
        existing.registries = existing.registries || [];
        existing.registries.push(result.registry);
      } else {
        merged.set(key, {
          ...result,
          registries: [result.registry]
        });
      }
    }
    
    return Array.from(merged.values());
  }

  async downloadPackageParallel(name, version, registries, options) {
    const downloadPromises = registries.map(async (registryName) => {
      const registry = this.registries.get(registryName);
      if (!registry) return null;
      
      try {
        const content = await registry.downloadPackage(name, version, options);
        return { registry: registryName, content };
      } catch (error) {
        return null;
      }
    });
    
    // Race to get the first successful download
    const results = await Promise.allSettled(downloadPromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value?.content) {
        const { registry: registryName, content } = result.value;
        
        // Cache the content
        await this.cache.setPackageContent(registryName, name, version, content);
        
        this.emit('packageDownloaded', { 
          name, 
          version, 
          registry: registryName,
          size: content.length,
          parallel: true
        });
        
        return content;
      }
    }
    
    throw new RegistryNotFoundError(`${name}@${version}`, 'any');
  }

  async getCachedResults(type, key) {
    switch (type) {
      case 'search':
        // For search, we use a simple key-based lookup
        return null; // TODO: Implement search result caching
      default:
        return null;
    }
  }

  async cacheResults(type, key, data) {
    switch (type) {
      case 'search':
        // TODO: Implement search result caching
        break;
    }
  }

  setupEventHandlers() {
    // Forward important events from components
    this.config.on('registryUpdated', (data) => this.emit('configUpdated', data));
    this.auth.on('credentialsStored', (data) => this.emit('authUpdated', data));
    this.cache.on('hit', () => this.stats.cacheHits++);
    this.cache.on('miss', () => this.stats.cacheMisses++);
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    // Cleanup registry instances
    for (const registry of this.registries.values()) {
      await registry.cleanup();
    }
    this.registries.clear();
    
    // Cleanup components
    await this.cache.destroy();
    this.auth.destroy();
    
    this.removeAllListeners();
  }
}

export default RegistryManager;