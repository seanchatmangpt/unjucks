/**
 * Comprehensive test suite for Registry Manager
 * Tests all registry operations, caching, authentication, and error handling
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { RegistryManager } from '../../src/registry/registry-manager.js';
import { RegistryError, RegistryNotFoundError } from '../../src/registry/registry-interface.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { rm, mkdir } from 'fs/promises';

// Mock implementations for testing
class MockNpmRegistry {
  constructor(config) {
    this.config = config;
    this.type = 'npm';
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
  }

  async isHealthy() {
    return this.initialized;
  }

  async publish(packageInfo, options) {
    if (packageInfo.name === 'fail-publish') {
      throw new RegistryError('Publish failed', 'PUBLISH_FAILED');
    }
    
    return {
      success: true,
      name: packageInfo.name,
      version: packageInfo.version,
      location: `https://registry.npmjs.org/${packageInfo.name}/-/${packageInfo.name}-${packageInfo.version}.tgz`
    };
  }

  async search(query, options) {
    if (query === 'no-results') {
      return [];
    }
    
    return [
      {
        name: `${query}-package`,
        version: '1.0.0',
        description: `Test package for ${query}`,
        author: 'test-author',
        score: 0.8
      }
    ];
  }

  async getPackageInfo(name, version) {
    if (name === 'not-found') {
      throw new RegistryNotFoundError(name, 'npm');
    }
    
    return {
      name,
      version: version === 'latest' ? '1.0.0' : version,
      description: 'Test package',
      author: 'test-author',
      license: 'MIT'
    };
  }

  async downloadPackage(name, version, options) {
    if (name === 'not-found') {
      throw new RegistryNotFoundError(name, 'npm');
    }
    
    return Buffer.from(`Package content for ${name}@${version}`);
  }

  async listVersions(name) {
    if (name === 'not-found') {
      throw new RegistryNotFoundError(name, 'npm');
    }
    
    return ['1.0.0', '1.1.0', '2.0.0'];
  }

  async authenticate(credentials) {
    return {
      success: true,
      username: 'test-user'
    };
  }

  async getCapabilities() {
    return {
      name: this.config.name,
      type: this.type,
      supports: {
        publish: true,
        search: true,
        download: true
      }
    };
  }

  async cleanup() {
    this.initialized = false;
  }
}

class MockGitRegistry extends MockNpmRegistry {
  constructor(config) {
    super(config);
    this.type = 'git';
  }

  async search(query, options) {
    return [
      {
        name: `git-${query}`,
        version: '1.0.0',
        description: `Git package for ${query}`,
        author: 'git-author',
        score: 0.6
      }
    ];
  }
}

describe('RegistryManager', () => {
  let registryManager;
  let testDir;

  beforeEach(async () => {
    testDir = join(tmpdir(), `registry-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    registryManager = new RegistryManager({
      config: {
        configPath: join(testDir, 'registry-config.json')
      },
      auth: {
        credentialsPath: join(testDir, 'credentials.json'),
        keyPath: join(testDir, '.key')
      },
      cache: {
        directory: join(testDir, 'cache'),
        enabled: true
      }
    });

    // Mock registry implementations
    registryManager.registryTypes.set('npm', MockNpmRegistry);
    registryManager.registryTypes.set('git', MockGitRegistry);

    // Set up test configuration
    await registryManager.config.load();
    registryManager.config.setRegistry('npm', {
      type: 'npm',
      name: 'npm',
      baseUrl: 'https://registry.npmjs.org',
      enabled: true,
      priority: 1,
      features: ['publish', 'search', 'download']
    });

    registryManager.config.setRegistry('git', {
      type: 'git',
      name: 'git',
      baseUrl: 'https://github.com',
      enabled: true,
      priority: 2,
      features: ['publish', 'search', 'download']
    });
  });

  afterEach(async () => {
    if (registryManager) {
      await registryManager.destroy();
    }
    await rm(testDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    test('should initialize successfully with default config', async () => {
      await registryManager.initialize();
      
      expect(registryManager.initialized).toBe(true);
      expect(registryManager.registries.size).toBeGreaterThan(0);
    });

    test('should emit initialized event', async () => {
      const initSpy = vi.fn();
      registryManager.on('initialized', initSpy);
      
      await registryManager.initialize();
      
      expect(initSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          registries: expect.any(Array)
        })
      );
    });

    test('should initialize with auto-discovery disabled by default', async () => {
      await registryManager.initialize();
      
      // Should only have configured registries, not discovered ones
      expect(Array.from(registryManager.registries.keys())).toEqual(['npm', 'git']);
    });
  });

  describe('package publishing', () => {
    beforeEach(async () => {
      await registryManager.initialize();
    });

    test('should publish package to primary registry', async () => {
      const packageInfo = {
        name: 'test-package',
        version: '1.0.0',
        description: 'Test package',
        content: 'package content'
      };

      const results = await registryManager.publish(packageInfo);
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].name).toBe('test-package');
    });

    test('should handle publish failures gracefully', async () => {
      const packageInfo = {
        name: 'fail-publish',
        version: '1.0.0',
        description: 'Failing package',
        content: 'package content'
      };

      await expect(registryManager.publish(packageInfo)).rejects.toThrow('Primary registry publish failed');
    });

    test('should publish to fallback registries when requested', async () => {
      registryManager.config.setStrategy('publish', {
        primary: 'npm',
        fallbacks: ['git'],
        requireConfirmation: false
      });

      const packageInfo = {
        name: 'test-package',
        version: '1.0.0',
        description: 'Test package',
        content: 'package content'
      };

      const results = await registryManager.publish(packageInfo, { publishToAll: true });
      
      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });

    test('should emit published event', async () => {
      const publishSpy = vi.fn();
      registryManager.on('published', publishSpy);

      const packageInfo = {
        name: 'test-package',
        version: '1.0.0',
        description: 'Test package',
        content: 'package content'
      };

      await registryManager.publish(packageInfo);
      
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          package: 'test-package@1.0.0'
        })
      );
    });
  });

  describe('package searching', () => {
    beforeEach(async () => {
      await registryManager.initialize();
    });

    test('should search packages across registries', async () => {
      registryManager.config.setStrategy('search', {
        aggregated: true,
        registries: ['npm', 'git'],
        mergeResults: true
      });

      const results = await registryManager.search('test');
      
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('test-package');
      expect(results[1].name).toBe('git-test');
    });

    test('should handle empty search results', async () => {
      const results = await registryManager.search('no-results');
      
      expect(results).toEqual([]);
    });

    test('should limit search results', async () => {
      const results = await registryManager.search('test', { limit: 1 });
      
      expect(results).toHaveLength(1);
    });

    test('should cache search results', async () => {
      const cacheSpy = vi.spyOn(registryManager.cache, 'getSearchResults').mockResolvedValue(null);
      const setCacheSpy = vi.spyOn(registryManager.cache, 'setSearchResults').mockResolvedValue();

      await registryManager.search('test');
      
      expect(cacheSpy).toHaveBeenCalled();
      expect(setCacheSpy).toHaveBeenCalled();
    });

    test('should merge duplicate results from multiple registries', async () => {
      registryManager.config.setStrategy('search', {
        aggregated: true,
        registries: ['npm', 'git'],
        mergeResults: true
      });

      // Mock both registries to return same package
      const npmRegistry = registryManager.registries.get('npm');
      vi.spyOn(npmRegistry, 'search').mockResolvedValue([
        { name: 'same-package', version: '1.0.0', score: 0.8 }
      ]);

      const gitRegistry = registryManager.registries.get('git');
      vi.spyOn(gitRegistry, 'search').mockResolvedValue([
        { name: 'same-package', version: '1.0.0', score: 0.6 }
      ]);

      const results = await registryManager.search('test');
      
      expect(results).toHaveLength(1);
      expect(results[0].score).toBe(0.8); // Should use higher score
      expect(results[0].registries).toEqual(['npm', 'git']);
    });
  });

  describe('package information retrieval', () => {
    beforeEach(async () => {
      await registryManager.initialize();
    });

    test('should get package information', async () => {
      const packageInfo = await registryManager.getPackageInfo('test-package', '1.0.0');
      
      expect(packageInfo.name).toBe('test-package');
      expect(packageInfo.version).toBe('1.0.0');
      expect(packageInfo.registry).toBe('npm');
    });

    test('should get latest version by default', async () => {
      const packageInfo = await registryManager.getPackageInfo('test-package');
      
      expect(packageInfo.version).toBe('1.0.0');
    });

    test('should try multiple registries for package info', async () => {
      // Mock npm registry to fail
      const npmRegistry = registryManager.registries.get('npm');
      vi.spyOn(npmRegistry, 'getPackageInfo').mockRejectedValue(
        new RegistryNotFoundError('test-package', 'npm')
      );

      const packageInfo = await registryManager.getPackageInfo('test-package');
      
      expect(packageInfo.registry).toBe('git');
    });

    test('should throw error when package not found in any registry', async () => {
      await expect(registryManager.getPackageInfo('not-found')).rejects.toThrow(RegistryNotFoundError);
    });

    test('should cache package information', async () => {
      const cacheSpy = vi.spyOn(registryManager.cache, 'getPackageInfo').mockResolvedValue(null);
      const setCacheSpy = vi.spyOn(registryManager.cache, 'setPackageInfo').mockResolvedValue();

      await registryManager.getPackageInfo('test-package');
      
      expect(cacheSpy).toHaveBeenCalled();
      expect(setCacheSpy).toHaveBeenCalled();
    });
  });

  describe('package downloading', () => {
    beforeEach(async () => {
      await registryManager.initialize();
    });

    test('should download package content', async () => {
      const content = await registryManager.downloadPackage('test-package', '1.0.0');
      
      expect(content).toBeInstanceOf(Buffer);
      expect(content.toString()).toContain('Package content for test-package@1.0.0');
    });

    test('should download latest version by default', async () => {
      const content = await registryManager.downloadPackage('test-package');
      
      expect(content.toString()).toContain('test-package@latest');
    });

    test('should try multiple registries for download', async () => {
      // Mock npm registry to fail
      const npmRegistry = registryManager.registries.get('npm');
      vi.spyOn(npmRegistry, 'downloadPackage').mockRejectedValue(
        new RegistryNotFoundError('test-package', 'npm')
      );

      const content = await registryManager.downloadPackage('test-package');
      
      expect(content).toBeInstanceOf(Buffer);
    });

    test('should cache downloaded content', async () => {
      const cacheSpy = vi.spyOn(registryManager.cache, 'getPackageContent').mockResolvedValue(null);
      const setCacheSpy = vi.spyOn(registryManager.cache, 'setPackageContent').mockResolvedValue();

      await registryManager.downloadPackage('test-package');
      
      expect(cacheSpy).toHaveBeenCalled();
      expect(setCacheSpy).toHaveBeenCalled();
    });

    test('should handle parallel downloads when configured', async () => {
      registryManager.config.setStrategy('download', {
        priority: ['npm', 'git'],
        parallel: true
      });

      const content = await registryManager.downloadPackage('test-package');
      
      expect(content).toBeInstanceOf(Buffer);
    });
  });

  describe('version listing', () => {
    beforeEach(async () => {
      await registryManager.initialize();
    });

    test('should list package versions', async () => {
      const versions = await registryManager.listVersions('test-package');
      
      expect(versions).toEqual(['1.0.0', '1.1.0', '2.0.0']);
    });

    test('should try multiple registries for versions', async () => {
      // Mock npm registry to fail
      const npmRegistry = registryManager.registries.get('npm');
      vi.spyOn(npmRegistry, 'listVersions').mockRejectedValue(
        new RegistryNotFoundError('test-package', 'npm')
      );

      const versions = await registryManager.listVersions('test-package');
      
      expect(versions).toEqual(['1.0.0', '1.1.0', '2.0.0']);
    });

    test('should throw error when package not found for versions', async () => {
      await expect(registryManager.listVersions('not-found')).rejects.toThrow(RegistryNotFoundError);
    });
  });

  describe('registry management', () => {
    beforeEach(async () => {
      await registryManager.initialize();
    });

    test('should add new registry', async () => {
      const config = {
        type: 'npm',
        name: 'custom-npm',
        baseUrl: 'https://custom.registry.com',
        enabled: true,
        priority: 3,
        features: ['search', 'download']
      };

      await registryManager.addRegistry('custom-npm', config);
      
      expect(registryManager.registries.has('custom-npm')).toBe(true);
    });

    test('should remove registry', async () => {
      await registryManager.removeRegistry('git');
      
      expect(registryManager.registries.has('git')).toBe(false);
    });

    test('should emit events when adding/removing registries', async () => {
      const addSpy = vi.fn();
      const removeSpy = vi.fn();
      
      registryManager.on('registryAdded', addSpy);
      registryManager.on('registryRemoved', removeSpy);

      const config = {
        type: 'npm',
        name: 'test-registry',
        baseUrl: 'https://test.registry.com',
        enabled: true,
        priority: 3
      };

      await registryManager.addRegistry('test-registry', config);
      await registryManager.removeRegistry('test-registry');
      
      expect(addSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'test-registry' })
      );
      expect(removeSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'test-registry' })
      );
    });
  });

  describe('health monitoring', () => {
    beforeEach(async () => {
      await registryManager.initialize();
    });

    test('should check registry health', async () => {
      const health = await registryManager.getRegistryHealth('npm');
      
      expect(health.healthy).toBe(true);
      expect(health.responseTime).toBeGreaterThan(0);
      expect(health.capabilities).toBeDefined();
    });

    test('should check all registries health', async () => {
      const health = await registryManager.getRegistryHealth();
      
      expect(Object.keys(health)).toEqual(['npm', 'git']);
      expect(health.npm.healthy).toBe(true);
      expect(health.git.healthy).toBe(true);
    });

    test('should handle unhealthy registries', async () => {
      // Mock npm registry to be unhealthy
      const npmRegistry = registryManager.registries.get('npm');
      vi.spyOn(npmRegistry, 'isHealthy').mockResolvedValue(false);

      const health = await registryManager.getRegistryHealth('npm');
      
      expect(health.healthy).toBe(false);
    });
  });

  describe('statistics', () => {
    beforeEach(async () => {
      await registryManager.initialize();
    });

    test('should track operation statistics', async () => {
      await registryManager.getPackageInfo('test-package');
      await registryManager.search('test');
      
      const stats = registryManager.getStats();
      
      expect(stats.operations).toBe(2);
      expect(stats.successes).toBe(2);
      expect(stats.failures).toBe(0);
    });

    test('should track cache statistics', async () => {
      // First call - cache miss
      await registryManager.getPackageInfo('test-package');
      
      // Mock cache hit for second call
      vi.spyOn(registryManager.cache, 'getPackageInfo').mockResolvedValue({
        name: 'test-package',
        version: '1.0.0'
      });
      
      await registryManager.getPackageInfo('test-package');
      
      const stats = registryManager.getStats();
      
      expect(stats.cacheHits).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThan(0);
    });
  });

  describe('cache management', () => {
    beforeEach(async () => {
      await registryManager.initialize();
    });

    test('should clear all caches', async () => {
      const cacheClearSpy = vi.spyOn(registryManager.cache, 'clear').mockResolvedValue();
      const discoveryClearSpy = vi.spyOn(registryManager.discovery, 'clearCache').mockImplementation(() => {});

      await registryManager.clearCache();
      
      expect(cacheClearSpy).toHaveBeenCalled();
      expect(discoveryClearSpy).toHaveBeenCalled();
    });

    test('should reset cache statistics when clearing', async () => {
      registryManager.stats.cacheHits = 10;
      registryManager.stats.cacheMisses = 5;
      
      await registryManager.clearCache();
      
      expect(registryManager.stats.cacheHits).toBe(0);
      expect(registryManager.stats.cacheMisses).toBe(0);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await registryManager.initialize();
    });

    test('should emit error events for failed operations', async () => {
      const errorSpy = vi.fn();
      registryManager.on('error', errorSpy);

      await expect(registryManager.getPackageInfo('not-found')).rejects.toThrow();
      
      expect(errorSpy).toHaveBeenCalled();
    });

    test('should handle registry initialization failures', async () => {
      registryManager.registryTypes.set('failing', class {
        constructor() {}
        async initialize() {
          throw new Error('Initialization failed');
        }
      });

      registryManager.config.setRegistry('failing-registry', {
        type: 'failing',
        name: 'failing-registry',
        enabled: true,
        priority: 4
      });

      await expect(registryManager.createRegistryInstance('failing-registry', {
        type: 'failing',
        name: 'failing-registry'
      })).rejects.toThrow('Failed to initialize registry');
    });

    test('should throw error when not initialized', async () => {
      const newManager = new RegistryManager();
      
      await expect(newManager.getPackageInfo('test')).rejects.toThrow('Registry manager not initialized');
    });
  });

  describe('authentication integration', () => {
    beforeEach(async () => {
      await registryManager.initialize({ enableAuth: true });
    });

    test('should authenticate registries during initialization', async () => {
      const authSpy = vi.spyOn(registryManager.auth, 'authenticateRegistry').mockResolvedValue({
        success: true,
        username: 'test-user'
      });

      // Re-initialize to trigger authentication
      await registryManager.createRegistryInstance('test-auth', {
        type: 'npm',
        name: 'test-auth',
        enabled: true
      });
      
      expect(authSpy).toHaveBeenCalled();
    });

    test('should handle authentication failures gracefully', async () => {
      const warningSpy = vi.fn();
      registryManager.on('warning', warningSpy);

      vi.spyOn(registryManager.auth, 'authenticateRegistry').mockRejectedValue(
        new Error('Authentication failed')
      );

      await registryManager.createRegistryInstance('test-auth-fail', {
        type: 'npm',
        name: 'test-auth-fail',
        enabled: true
      });
      
      expect(warningSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Authentication failed')
        })
      );
    });
  });
});

describe('RegistryManager Integration', () => {
  let registryManager;
  let testDir;

  beforeEach(async () => {
    testDir = join(tmpdir(), `registry-integration-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    registryManager = new RegistryManager({
      config: {
        configPath: join(testDir, 'registry-config.json')
      },
      auth: {
        credentialsPath: join(testDir, 'credentials.json'),
        keyPath: join(testDir, '.key')
      },
      cache: {
        directory: join(testDir, 'cache'),
        enabled: true,
        ttl: {
          packageInfo: 1000, // 1 second for testing
          searchResults: 500,
          packageContent: 2000
        }
      }
    });

    // Use mock registries
    registryManager.registryTypes.set('npm', MockNpmRegistry);
    registryManager.registryTypes.set('git', MockGitRegistry);
  });

  afterEach(async () => {
    if (registryManager) {
      await registryManager.destroy();
    }
    await rm(testDir, { recursive: true, force: true });
  });

  test('should perform complete workflow: publish -> search -> download', async () => {
    await registryManager.initialize();

    // Publish
    const packageInfo = {
      name: 'workflow-package',
      version: '1.0.0',
      description: 'Workflow test package',
      content: 'test content'
    };

    const publishResults = await registryManager.publish(packageInfo);
    expect(publishResults[0].success).toBe(true);

    // Search
    const searchResults = await registryManager.search('workflow');
    expect(searchResults.length).toBeGreaterThan(0);

    // Download
    const content = await registryManager.downloadPackage('workflow-package', '1.0.0');
    expect(content).toBeInstanceOf(Buffer);

    // Verify statistics
    const stats = registryManager.getStats();
    expect(stats.operations).toBe(3);
    expect(stats.successes).toBe(3);
  });

  test('should handle cache expiration correctly', async () => {
    await registryManager.initialize();

    // First call - cache miss
    await registryManager.getPackageInfo('cache-test-package');
    
    // Second call - should hit cache
    await registryManager.getPackageInfo('cache-test-package');
    
    // Wait for cache to expire
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Third call - cache expired, should miss
    await registryManager.getPackageInfo('cache-test-package');

    const stats = registryManager.getStats();
    expect(stats.cacheHits).toBeGreaterThan(0);
    expect(stats.cacheMisses).toBeGreaterThan(1);
  });
});