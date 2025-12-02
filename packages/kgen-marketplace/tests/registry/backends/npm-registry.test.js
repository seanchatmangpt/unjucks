/**
 * Test suite for NPM Registry backend
 * Tests NPM-specific functionality, authentication, and error handling
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { NpmRegistry } from '../../../src/registry/backends/npm-registry.js';
import { RegistryError, RegistryNotFoundError, RegistryAuthError, RegistryNetworkError } from '../../../src/registry/registry-interface.js';

// Mock fetch for testing - must be hoisted
vi.mock('undici', () => ({
  fetch: vi.fn()
}));

describe('NpmRegistry', () => {
  let npmRegistry;
  let mockFetch;

  beforeEach(async () => {
    const { fetch } = await import('undici');
    mockFetch = fetch;
    
    npmRegistry = new NpmRegistry({
      name: 'test-npm',
      baseUrl: 'https://registry.npmjs.org',
      authToken: 'test-token'
    });

    mockFetch.mockClear();
  });

  afterEach(async () => {
    if (npmRegistry) {
      await npmRegistry.cleanup();
    }
  });

  describe('initialization', () => {
    test('should initialize with default configuration', () => {
      const registry = new NpmRegistry();
      
      expect(registry.type).toBe('npm');
      expect(registry.baseUrl).toBe('https://registry.npmjs.org');
      expect(registry.apiUrl).toBe('https://registry.npmjs.org');
    });

    test('should initialize with custom configuration', () => {
      const config = {
        name: 'custom-npm',
        baseUrl: 'https://custom.registry.com',
        timeout: 60000,
        scope: '@myorg'
      };

      const registry = new NpmRegistry(config);
      
      expect(registry.name).toBe('custom-npm');
      expect(registry.baseUrl).toBe('https://custom.registry.com');
      expect(registry.timeout).toBe(60000);
      expect(registry.scope).toBe('@myorg');
    });

    test('should initialize successfully when registry responds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ db_name: 'registry' })
      });

      const result = await npmRegistry.initialize();
      
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://registry.npmjs.org/',
        expect.any(Object)
      );
    });

    test('should throw error when registry is unreachable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await expect(npmRegistry.initialize()).rejects.toThrow(RegistryNetworkError);
    });
  });

  describe('health checks', () => {
    test('should return true when registry is healthy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true
      });

      const healthy = await npmRegistry.isHealthy();
      
      expect(healthy).toBe(true);
    });

    test('should return false when registry is unhealthy', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const healthy = await npmRegistry.isHealthy();
      
      expect(healthy).toBe(false);
    });
  });

  describe('package publishing', () => {
    const packageInfo = {
      name: 'test-package',
      version: '1.0.0',
      description: 'Test package',
      author: 'test-author',
      content: Buffer.from('package content')
    };

    test('should publish package successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, id: 'test-package' })
      });

      const result = await npmRegistry.publish(packageInfo);
      
      expect(result.success).toBe(true);
      expect(result.name).toBe('test-package');
      expect(result.version).toBe('1.0.0');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://registry.npmjs.org/test-package',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      );
    });

    test('should publish scoped package', async () => {
      npmRegistry.scope = '@myorg';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true })
      });

      await npmRegistry.publish(packageInfo);
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://registry.npmjs.org/@myorg/test-package',
        expect.any(Object)
      );
    });

    test('should throw error when authentication is missing', async () => {
      npmRegistry.authToken = null;

      await expect(npmRegistry.publish(packageInfo)).rejects.toThrow(RegistryAuthError);
    });

    test('should throw error when publish fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Package already exists' })
      });

      await expect(npmRegistry.publish(packageInfo)).rejects.toThrow(RegistryError);
    });

    test('should validate package info before publishing', async () => {
      const invalidPackage = {
        // Missing name and version
        description: 'Invalid package'
      };

      await expect(npmRegistry.publish(invalidPackage)).rejects.toThrow(RegistryError);
    });

    test('should handle network errors during publish', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(npmRegistry.publish(packageInfo)).rejects.toThrow(RegistryError);
    });
  });

  describe('package searching', () => {
    test('should search packages successfully', async () => {
      const searchResponse = {
        objects: [
          {
            package: {
              name: 'test-package',
              version: '1.0.0',
              description: 'Test package',
              author: { name: 'test-author' },
              keywords: ['test'],
              links: {
                homepage: 'https://example.com',
                repository: 'https://github.com/test/repo'
              },
              date: '2023-01-01T00:00:00.000Z'
            },
            score: { final: 0.85 },
            searchScore: 0.9
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => searchResponse
      });

      const results = await npmRegistry.search('test');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('test-package');
      expect(results[0].score).toBe(0.85);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/-/v1/search?text=test'),
        expect.any(Object)
      );
    });

    test('should search with options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ objects: [] })
      });

      await npmRegistry.search('test', {
        limit: 50,
        offset: 10,
        author: 'specific-author',
        tags: ['tag1', 'tag2']
      });
      
      const searchUrl = mockFetch.mock.calls[0][0];
      expect(searchUrl).toContain('size=50');
      expect(searchUrl).toContain('from=10');
      expect(searchUrl).toContain('author=specific-author');
      expect(searchUrl).toContain('keywords=tag1%2Ctag2');
    });

    test('should handle search network errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await expect(npmRegistry.search('test')).rejects.toThrow(RegistryNetworkError);
    });
  });

  describe('package information retrieval', () => {
    test('should get package info for specific version', async () => {
      const packageData = {
        name: 'test-package',
        version: '1.0.0',
        description: 'Test package',
        author: 'test-author',
        license: 'MIT',
        dependencies: { lodash: '^4.17.21' },
        dist: { tarball: 'https://registry.npmjs.org/test-package/-/test-package-1.0.0.tgz' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => packageData
      });

      const result = await npmRegistry.getPackageInfo('test-package', '1.0.0');
      
      expect(result.name).toBe('test-package');
      expect(result.version).toBe('1.0.0');
      expect(result.dependencies).toEqual({ lodash: '^4.17.21' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://registry.npmjs.org/test-package/1.0.0',
        expect.any(Object)
      );
    });

    test('should get latest version when no version specified', async () => {
      const packageData = {
        name: 'test-package',
        'dist-tags': { latest: '2.0.0' },
        versions: {
          '2.0.0': {
            name: 'test-package',
            version: '2.0.0',
            description: 'Test package v2',
            author: 'test-author'
          }
        },
        time: {
          '2.0.0': '2023-01-01T00:00:00.000Z'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => packageData
      });

      const result = await npmRegistry.getPackageInfo('test-package');
      
      expect(result.version).toBe('2.0.0');
      expect(result.versions).toEqual(['2.0.0']);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://registry.npmjs.org/test-package',
        expect.any(Object)
      );
    });

    test('should throw error when package not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(npmRegistry.getPackageInfo('nonexistent-package')).rejects.toThrow(RegistryNotFoundError);
    });
  });

  describe('package downloading', () => {
    test('should download package content', async () => {
      const packageInfo = {
        dist: {
          tarball: 'https://registry.npmjs.org/test-package/-/test-package-1.0.0.tgz',
          shasum: 'abc123'
        }
      };

      // Mock getPackageInfo
      vi.spyOn(npmRegistry, 'getPackageInfo').mockResolvedValue(packageInfo);

      // Mock package content download
      const packageContent = Buffer.from('package content');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => packageContent.buffer
      });

      const result = await npmRegistry.downloadPackage('test-package', '1.0.0');
      
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('package content');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://registry.npmjs.org/test-package/-/test-package-1.0.0.tgz',
        expect.any(Object)
      );
    });

    test('should verify package integrity', async () => {
      const packageInfo = {
        dist: {
          tarball: 'https://registry.npmjs.org/test-package/-/test-package-1.0.0.tgz',
          shasum: 'da39a3ee5e6b4b0d3255bfef95601890afd80709' // SHA1 of empty string
        }
      };

      vi.spyOn(npmRegistry, 'getPackageInfo').mockResolvedValue(packageInfo);

      // Mock wrong content
      const packageContent = Buffer.from('wrong content');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => packageContent.buffer
      });

      await expect(npmRegistry.downloadPackage('test-package', '1.0.0')).rejects.toThrow(
        expect.objectContaining({
          code: 'INTEGRITY_ERROR'
        })
      );
    });

    test('should handle download errors', async () => {
      const packageInfo = {
        dist: {
          tarball: 'https://registry.npmjs.org/test-package/-/test-package-1.0.0.tgz'
        }
      };

      vi.spyOn(npmRegistry, 'getPackageInfo').mockResolvedValue(packageInfo);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(npmRegistry.downloadPackage('test-package', '1.0.0')).rejects.toThrow(RegistryNetworkError);
    });
  });

  describe('version listing', () => {
    test('should list package versions', async () => {
      const packageInfo = {
        versions: ['1.0.0', '1.1.0', '2.0.0']
      };

      vi.spyOn(npmRegistry, 'getPackageInfo').mockResolvedValue(packageInfo);

      const versions = await npmRegistry.listVersions('test-package');
      
      expect(versions).toEqual(['1.0.0', '1.1.0', '2.0.0']);
    });

    test('should handle package not found for versions', async () => {
      vi.spyOn(npmRegistry, 'getPackageInfo').mockRejectedValue(
        new RegistryNotFoundError('test-package', 'npm')
      );

      await expect(npmRegistry.listVersions('test-package')).rejects.toThrow(RegistryNotFoundError);
    });
  });

  describe('authentication', () => {
    test('should authenticate with token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ username: 'test-user' })
      });

      const result = await npmRegistry.authenticate({ token: 'new-token' });
      
      expect(result.success).toBe(true);
      expect(result.username).toBe('test-user');
      expect(npmRegistry.authToken).toBe('new-token');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://registry.npmjs.org/-/whoami',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer new-token'
          })
        })
      );
    });

    test('should authenticate with username/password', async () => {
      // Mock login request
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'auth-token' })
        })
        // Mock whoami request
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ username: 'test-user' })
        });

      const result = await npmRegistry.authenticate({
        username: 'test-user',
        password: 'test-pass'
      });
      
      expect(result.success).toBe(true);
      expect(result.token).toBe('auth-token');
      expect(npmRegistry.authToken).toBe('auth-token');
    });

    test('should handle authentication failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      await expect(npmRegistry.authenticate({ token: 'invalid-token' })).rejects.toThrow(RegistryAuthError);
    });
  });

  describe('capabilities', () => {
    test('should return registry capabilities', async () => {
      const capabilities = await npmRegistry.getCapabilities();
      
      expect(capabilities.type).toBe('npm');
      expect(capabilities.supports.authentication).toBe(true);
      expect(capabilities.supports.scoped).toBe(true);
      expect(capabilities.endpoints.search).toContain('/-/v1/search');
      expect(capabilities.features).toContain('semver');
    });
  });

  describe('retry mechanism', () => {
    test('should retry failed requests', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ db_name: 'registry' })
        });

      await npmRegistry.initialize();
      
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    test('should not retry authentication errors', async () => {
      mockFetch.mockRejectedValueOnce(new RegistryAuthError('npm', 'test'));

      await expect(npmRegistry.retryOperation(async () => {
        throw new RegistryAuthError('npm', 'test');
      })).rejects.toThrow(RegistryAuthError);
      
      // Should not retry auth errors
      expect(mockFetch).toHaveBeenCalledTimes(0);
    });
  });

  describe('request handling', () => {
    test('should make requests with correct headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

      await npmRegistry.makeRequest('GET', '/test');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://registry.npmjs.org/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'User-Agent': 'kgen-marketplace/1.0.0',
            'Accept': 'application/json'
          })
        })
      );
    });

    test('should include custom headers in requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

      await npmRegistry.makeRequest('POST', '/test', {
        headers: {
          'Content-Type': 'application/json',
          'Custom-Header': 'test-value'
        },
        body: JSON.stringify({ test: 'data' })
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://registry.npmjs.org/test',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Custom-Header': 'test-value'
          }),
          body: JSON.stringify({ test: 'data' })
        })
      );
    });
  });

  describe('tarball creation', () => {
    test('should handle buffer content', async () => {
      const content = Buffer.from('test content');
      const result = await npmRegistry.createTarball(content);
      
      expect(result).toEqual(content);
    });

    test('should handle string content', async () => {
      const content = 'test content';
      const result = await npmRegistry.createTarball(content);
      
      expect(result).toEqual(Buffer.from(content));
    });

    test('should throw error for invalid content', async () => {
      await expect(npmRegistry.createTarball(123)).rejects.toThrow(
        expect.objectContaining({
          code: 'INVALID_CONTENT'
        })
      );
    });
  });
});