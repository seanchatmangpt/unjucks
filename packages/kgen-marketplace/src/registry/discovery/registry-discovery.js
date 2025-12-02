/**
 * Registry discovery protocol implementation
 * Handles automatic discovery of registry endpoints, capability negotiation, and health monitoring
 */

import { EventEmitter } from 'events';
import { fetch } from 'undici';
import { createHash } from 'crypto';

export class RegistryDiscoveryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'RegistryDiscoveryError';
    this.code = code;
  }
}

export class RegistryDiscovery extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.timeout = options.timeout || 10000;
    this.userAgent = options.userAgent || 'kgen-marketplace/1.0.0';
    this.maxConcurrentChecks = options.maxConcurrentChecks || 10;
    this.retryAttempts = options.retryAttempts || 2;
    this.retryDelay = options.retryDelay || 1000;
    
    // Well-known registry endpoints and patterns
    this.wellKnownRegistries = [
      {
        name: 'npm',
        type: 'npm',
        patterns: [
          'https://registry.npmjs.org',
          'https://npm.pkg.github.com',
          'https://registry.yarnpkg.com'
        ],
        discoveryPaths: [
          '/',
          '/-/ping'
        ]
      },
      {
        name: 'docker',
        type: 'oci',
        patterns: [
          'https://registry-1.docker.io',
          'https://gcr.io',
          'https://quay.io',
          'https://*.azurecr.io',
          'https://*.amazonaws.com'
        ],
        discoveryPaths: [
          '/v2/',
          '/v2/_catalog'
        ]
      },
      {
        name: 'github',
        type: 'git',
        patterns: [
          'https://github.com',
          'https://gitlab.com',
          'https://bitbucket.org'
        ],
        discoveryPaths: [
          '/api/v3',
          '/api/v4'
        ]
      },
      {
        name: 'ipfs',
        type: 'ipfs',
        patterns: [
          'http://127.0.0.1:5001',
          'http://localhost:5001',
          'https://ipfs.infura.io:5001'
        ],
        discoveryPaths: [
          '/api/v0/version',
          '/api/v0/id'
        ]
      }
    ];
    
    // Discovery cache
    this.discoveryCache = new Map();
    this.healthCache = new Map();
    this.capabilityCache = new Map();
    
    this.cacheTimeout = options.cacheTimeout || 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Discover available registries from various sources
   * @param {Object} options - Discovery options
   * @returns {Promise<Array<Object>>} Discovered registries
   */
  async discoverRegistries(options = {}) {
    try {
      const sources = options.sources || ['wellknown', 'environment', 'network'];
      const discovered = new Map();
      
      // Discover from different sources
      if (sources.includes('wellknown')) {
        const wellKnown = await this.discoverWellKnownRegistries(options);
        wellKnown.forEach(registry => discovered.set(registry.id, registry));
      }
      
      if (sources.includes('environment')) {
        const envRegistries = await this.discoverFromEnvironment(options);
        envRegistries.forEach(registry => discovered.set(registry.id, registry));
      }
      
      if (sources.includes('network')) {
        const networkRegistries = await this.discoverFromNetwork(options);
        networkRegistries.forEach(registry => discovered.set(registry.id, registry));
      }
      
      if (sources.includes('dns')) {
        const dnsRegistries = await this.discoverFromDNS(options);
        dnsRegistries.forEach(registry => discovered.set(registry.id, registry));
      }
      
      const registries = Array.from(discovered.values());
      
      // Verify health and capabilities if requested
      if (options.verifyHealth) {
        await this.verifyRegistriesHealth(registries);
      }
      
      if (options.getCapabilities) {
        await this.getRegistriesCapabilities(registries);
      }
      
      this.emit('discovered', { 
        count: registries.length, 
        sources, 
        registries: registries.map(r => ({ name: r.name, type: r.type, url: r.baseUrl }))
      });
      
      return registries;
    } catch (error) {
      this.emit('error', { operation: 'discoverRegistries', error });
      throw new RegistryDiscoveryError(`Discovery failed: ${error.message}`, 'DISCOVERY_FAILED');
    }
  }

  /**
   * Discover well-known registry endpoints
   * @private
   */
  async discoverWellKnownRegistries(options = {}) {
    const discovered = [];
    const concurrent = Math.min(this.maxConcurrentChecks, this.wellKnownRegistries.length);
    
    // Process registries in batches
    for (let i = 0; i < this.wellKnownRegistries.length; i += concurrent) {
      const batch = this.wellKnownRegistries.slice(i, i + concurrent);
      
      const batchPromises = batch.map(async (registryType) => {
        const registries = [];
        
        for (const pattern of registryType.patterns) {
          try {
            // Expand pattern if it contains wildcards
            const urls = this.expandUrlPattern(pattern);
            
            for (const url of urls) {
              const registry = await this.probeRegistry(url, registryType);
              if (registry) {
                registries.push(registry);
              }
            }
          } catch (error) {
            // Skip failed probes
            continue;
          }
        }
        
        return registries;
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          discovered.push(...result.value);
        }
      });
    }
    
    return discovered;
  }

  /**
   * Discover registries from environment variables
   * @private
   */
  async discoverFromEnvironment(options = {}) {
    const discovered = [];
    const envVars = [
      'NPM_REGISTRY',
      'NPM_CONFIG_REGISTRY',
      'DOCKER_REGISTRY',
      'DOCKER_REGISTRY_URL',
      'GITHUB_REGISTRY',
      'IPFS_API_URL',
      'IPFS_GATEWAY_URL',
      'KGEN_REGISTRY_URL',
      'KGEN_REGISTRIES'
    ];
    
    for (const envVar of envVars) {
      const value = process.env[envVar];
      if (!value) continue;
      
      try {
        if (envVar === 'KGEN_REGISTRIES') {
          // Multiple registries in JSON format
          const registries = JSON.parse(value);
          for (const registry of registries) {
            const probed = await this.probeRegistry(registry.url, { 
              type: registry.type,
              name: registry.name || 'env-registry'
            });
            if (probed) {
              discovered.push(probed);
            }
          }
        } else {
          // Single registry URL
          const type = this.guessRegistryType(value, envVar);
          const probed = await this.probeRegistry(value, { 
            type,
            name: `env-${type}`
          });
          if (probed) {
            discovered.push(probed);
          }
        }
      } catch (error) {
        this.emit('warning', { 
          message: `Failed to parse environment variable ${envVar}`,
          error 
        });
      }
    }
    
    return discovered;
  }

  /**
   * Discover registries from network scanning
   * @private
   */
  async discoverFromNetwork(options = {}) {
    const discovered = [];
    
    // Only scan localhost and common development ports
    const hosts = options.hosts || ['localhost', '127.0.0.1'];
    const ports = options.ports || [5001, 8080, 3000, 4873, 8000]; // Common registry ports
    
    const probePromises = [];
    
    for (const host of hosts) {
      for (const port of ports) {
        for (const protocol of ['http', 'https']) {
          const url = `${protocol}://${host}:${port}`;
          
          probePromises.push(
            this.probeRegistryWithTimeout(url).catch(() => null)
          );
        }
      }
    }
    
    // Limit concurrent network probes
    const results = await this.limitConcurrency(probePromises, this.maxConcurrentChecks);
    
    for (const result of results) {
      if (result) {
        discovered.push(result);
      }
    }
    
    return discovered;
  }

  /**
   * Discover registries via DNS SRV records
   * @private
   */
  async discoverFromDNS(options = {}) {
    const discovered = [];
    
    // SRV record patterns for registry discovery
    const srvPatterns = [
      '_kgen-registry._tcp',
      '_npm-registry._tcp',
      '_docker-registry._tcp',
      '_git-registry._tcp'
    ];
    
    const domains = options.domains || ['localhost', 'local'];
    
    for (const domain of domains) {
      for (const pattern of srvPatterns) {
        try {
          const records = await this.resolveSRV(`${pattern}.${domain}`);
          
          for (const record of records) {
            const url = `https://${record.target}:${record.port}`;
            const registry = await this.probeRegistry(url);
            
            if (registry) {
              discovered.push(registry);
            }
          }
        } catch (error) {
          // DNS resolution failed, continue
        }
      }
    }
    
    return discovered;
  }

  /**
   * Probe a registry endpoint to determine its capabilities
   * @private
   */
  async probeRegistry(url, typeHint = null) {
    const cacheKey = this.generateCacheKey('probe', url);
    const cached = this.discoveryCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    try {
      // Try to determine registry type and capabilities
      const registry = await this.identifyRegistry(url, typeHint);
      
      if (registry) {
        this.discoveryCache.set(cacheKey, {
          data: registry,
          timestamp: Date.now()
        });
        
        return registry;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Probe registry with timeout
   * @private
   */
  async probeRegistryWithTimeout(url, timeout = this.timeout) {
    return Promise.race([
      this.probeRegistry(url),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeout)
      )
    ]);
  }

  /**
   * Identify registry type and get basic information
   * @private
   */
  async identifyRegistry(url, typeHint = null) {
    const strategies = [
      () => this.identifyNpmRegistry(url),
      () => this.identifyOciRegistry(url),
      () => this.identifyGitRegistry(url),
      () => this.identifyIpfsRegistry(url)
    ];
    
    // If we have a type hint, try that strategy first
    if (typeHint?.type) {
      const hintStrategy = this.getStrategyForType(typeHint.type);
      if (hintStrategy) {
        try {
          const result = await hintStrategy(url);
          if (result) {
            return {
              ...result,
              name: typeHint.name || result.name,
              discoveredAt: new Date().toISOString(),
              source: 'probe'
            };
          }
        } catch (error) {
          // Continue with other strategies
        }
      }
    }
    
    // Try all strategies
    for (const strategy of strategies) {
      try {
        const result = await strategy();
        if (result) {
          return {
            ...result,
            discoveredAt: new Date().toISOString(),
            source: 'probe'
          };
        }
      } catch (error) {
        continue;
      }
    }
    
    return null;
  }

  /**
   * Identify NPM registry
   * @private
   */
  async identifyNpmRegistry(url) {
    try {
      const response = await fetch(`${url}/`, {
        timeout: this.timeout,
        headers: { 'User-Agent': this.userAgent }
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      // NPM registry characteristics
      if (data.db_name || data.doc_count !== undefined || data.update_seq !== undefined) {
        return {
          id: this.generateRegistryId('npm', url),
          name: 'npm',
          type: 'npm',
          baseUrl: url,
          version: data.version,
          healthy: true,
          capabilities: await this.getNpmCapabilities(url),
          metadata: {
            dbName: data.db_name,
            docCount: data.doc_count,
            updateSeq: data.update_seq
          }
        };
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Identify OCI/Docker registry
   * @private
   */
  async identifyOciRegistry(url) {
    try {
      const response = await fetch(`${url}/v2/`, {
        timeout: this.timeout,
        headers: { 'User-Agent': this.userAgent }
      });
      
      // OCI registries typically return 200 or 401 for /v2/
      if (response.ok || response.status === 401) {
        const dockerContentDigest = response.headers.get('docker-content-digest');
        const dockerDistributionApi = response.headers.get('docker-distribution-api-version');
        
        if (dockerDistributionApi || dockerContentDigest || response.headers.get('www-authenticate')?.includes('Bearer')) {
          return {
            id: this.generateRegistryId('oci', url),
            name: 'oci',
            type: 'oci',
            baseUrl: url,
            version: dockerDistributionApi || '2.0',
            healthy: response.ok,
            capabilities: await this.getOciCapabilities(url),
            metadata: {
              apiVersion: dockerDistributionApi,
              requiresAuth: response.status === 401
            }
          };
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Identify Git registry (GitHub, GitLab, etc.)
   * @private
   */
  async identifyGitRegistry(url) {
    try {
      // Try GitHub API
      if (url.includes('github.com')) {
        const response = await fetch(`https://api.github.com/`, {
          timeout: this.timeout,
          headers: { 'User-Agent': this.userAgent }
        });
        
        if (response.ok) {
          const data = await response.json();
          
          return {
            id: this.generateRegistryId('git', url),
            name: 'github',
            type: 'git',
            baseUrl: url,
            healthy: true,
            capabilities: await this.getGitCapabilities(url),
            metadata: {
              apiUrl: 'https://api.github.com',
              platform: 'github',
              rateLimit: data.rate_limit_url
            }
          };
        }
      }
      
      // Try GitLab API
      if (url.includes('gitlab.com')) {
        const response = await fetch(`https://gitlab.com/api/v4/version`, {
          timeout: this.timeout,
          headers: { 'User-Agent': this.userAgent }
        });
        
        if (response.ok) {
          const data = await response.json();
          
          return {
            id: this.generateRegistryId('git', url),
            name: 'gitlab',
            type: 'git',
            baseUrl: url,
            version: data.version,
            healthy: true,
            capabilities: await this.getGitCapabilities(url),
            metadata: {
              apiUrl: 'https://gitlab.com/api/v4',
              platform: 'gitlab',
              version: data.version
            }
          };
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Identify IPFS registry
   * @private
   */
  async identifyIpfsRegistry(url) {
    try {
      const response = await fetch(`${url}/api/v0/version`, {
        method: 'POST',
        timeout: this.timeout,
        headers: { 'User-Agent': this.userAgent }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.Version && data.Commit) {
          return {
            id: this.generateRegistryId('ipfs', url),
            name: 'ipfs',
            type: 'ipfs',
            baseUrl: url,
            version: data.Version,
            healthy: true,
            capabilities: await this.getIpfsCapabilities(url),
            metadata: {
              version: data.Version,
              commit: data.Commit,
              repo: data.Repo,
              system: data.System,
              golang: data.Golang
            }
          };
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get NPM registry capabilities
   * @private
   */
  async getNpmCapabilities(url) {
    return {
      publish: true,
      search: true,
      download: true,
      versioning: true,
      authentication: true,
      scoped: true,
      integrity: true
    };
  }

  /**
   * Get OCI registry capabilities
   * @private
   */
  async getOciCapabilities(url) {
    return {
      publish: true,
      download: true,
      versioning: true,
      authentication: true,
      layers: true,
      manifests: true,
      contentAddressing: true
    };
  }

  /**
   * Get Git registry capabilities
   * @private
   */
  async getGitCapabilities(url) {
    return {
      publish: true,
      search: true,
      download: true,
      versioning: true,
      authentication: true,
      branches: true,
      tags: true,
      releases: true
    };
  }

  /**
   * Get IPFS registry capabilities
   * @private
   */
  async getIpfsCapabilities(url) {
    return {
      publish: true,
      search: false,
      download: true,
      versioning: false,
      authentication: false,
      decentralized: true,
      contentAddressing: true,
      pinning: true
    };
  }

  /**
   * Verify health of multiple registries
   * @private
   */
  async verifyRegistriesHealth(registries) {
    const healthPromises = registries.map(registry => 
      this.checkRegistryHealth(registry).catch(() => {
        registry.healthy = false;
        return registry;
      })
    );
    
    await Promise.allSettled(healthPromises);
  }

  /**
   * Get capabilities for multiple registries
   * @private
   */
  async getRegistriesCapabilities(registries) {
    const capabilityPromises = registries.map(registry => 
      this.getRegistryCapabilities(registry).catch(() => registry)
    );
    
    await Promise.allSettled(capabilityPromises);
  }

  /**
   * Check individual registry health
   * @param {Object} registry - Registry to check
   * @returns {Promise<Object>} Updated registry with health status
   */
  async checkRegistryHealth(registry) {
    const cacheKey = this.generateCacheKey('health', registry.baseUrl);
    const cached = this.healthCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      registry.healthy = cached.healthy;
      registry.responseTime = cached.responseTime;
      return registry;
    }
    
    const startTime = Date.now();
    
    try {
      const strategy = this.getStrategyForType(registry.type);
      if (strategy) {
        await strategy(registry.baseUrl);
        registry.healthy = true;
        registry.responseTime = Date.now() - startTime;
        
        this.healthCache.set(cacheKey, {
          healthy: true,
          responseTime: registry.responseTime,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      registry.healthy = false;
      registry.responseTime = Date.now() - startTime;
      registry.lastError = error.message;
      
      this.healthCache.set(cacheKey, {
        healthy: false,
        responseTime: registry.responseTime,
        timestamp: Date.now()
      });
    }
    
    return registry;
  }

  /**
   * Get detailed registry capabilities
   * @param {Object} registry - Registry to analyze
   * @returns {Promise<Object>} Registry with detailed capabilities
   */
  async getRegistryCapabilities(registry) {
    const cacheKey = this.generateCacheKey('capabilities', registry.baseUrl);
    const cached = this.capabilityCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      registry.capabilities = cached.capabilities;
      return registry;
    }
    
    try {
      const capabilityStrategy = this.getCapabilityStrategyForType(registry.type);
      if (capabilityStrategy) {
        const capabilities = await capabilityStrategy(registry.baseUrl);
        registry.capabilities = capabilities;
        
        this.capabilityCache.set(cacheKey, {
          capabilities,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      registry.capabilities = { error: error.message };
    }
    
    return registry;
  }

  /**
   * Utility methods
   */
  
  generateRegistryId(type, url) {
    return createHash('md5').update(`${type}:${url}`).digest('hex').substring(0, 12);
  }
  
  generateCacheKey(operation, url) {
    return `${operation}:${createHash('md5').update(url).digest('hex')}`;
  }
  
  expandUrlPattern(pattern) {
    // Simple pattern expansion - can be enhanced for complex patterns
    if (pattern.includes('*')) {
      // For now, just return the pattern as-is
      return [pattern.replace('*', '')];
    }
    return [pattern];
  }
  
  guessRegistryType(url, envVar) {
    if (envVar.includes('NPM')) return 'npm';
    if (envVar.includes('DOCKER')) return 'oci';
    if (envVar.includes('GITHUB') || envVar.includes('GIT')) return 'git';
    if (envVar.includes('IPFS')) return 'ipfs';
    
    if (url.includes('npmjs.org') || url.includes(':4873')) return 'npm';
    if (url.includes('docker.io') || url.includes('gcr.io')) return 'oci';
    if (url.includes('github.com') || url.includes('gitlab.com')) return 'git';
    if (url.includes(':5001')) return 'ipfs';
    
    return 'unknown';
  }
  
  getStrategyForType(type) {
    const strategies = {
      'npm': this.identifyNpmRegistry.bind(this),
      'oci': this.identifyOciRegistry.bind(this),
      'git': this.identifyGitRegistry.bind(this),
      'ipfs': this.identifyIpfsRegistry.bind(this)
    };
    
    return strategies[type];
  }
  
  getCapabilityStrategyForType(type) {
    const strategies = {
      'npm': this.getNpmCapabilities.bind(this),
      'oci': this.getOciCapabilities.bind(this),
      'git': this.getGitCapabilities.bind(this),
      'ipfs': this.getIpfsCapabilities.bind(this)
    };
    
    return strategies[type];
  }
  
  async limitConcurrency(promises, limit) {
    const results = [];
    const executing = [];
    
    for (const promise of promises) {
      const p = promise.then(result => {
        executing.splice(executing.indexOf(p), 1);
        return result;
      });
      
      results.push(p);
      
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
      
      executing.push(p);
    }
    
    return await Promise.allSettled(results);
  }
  
  async resolveSRV(hostname) {
    // Placeholder for DNS SRV resolution
    // In a real implementation, use a DNS library
    return [];
  }
  
  /**
   * Clear discovery caches
   */
  clearCache() {
    this.discoveryCache.clear();
    this.healthCache.clear();
    this.capabilityCache.clear();
    this.emit('cacheCleared');
  }
  
  /**
   * Get discovery statistics
   */
  getStats() {
    return {
      discoveryCache: this.discoveryCache.size,
      healthCache: this.healthCache.size,
      capabilityCache: this.capabilityCache.size,
      wellKnownRegistries: this.wellKnownRegistries.length
    };
  }
}

export default RegistryDiscovery;