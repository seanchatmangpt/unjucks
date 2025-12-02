/**
 * NPM Registry backend implementation
 * Integrates with npm registry API for package operations
 */

import { RegistryInterface, RegistryError, RegistryNotFoundError, RegistryAuthError, RegistryNetworkError } from '../registry-interface.js';
import { fetch } from 'undici';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import FormData from 'form-data';

export class NpmRegistry extends RegistryInterface {
  constructor(config = {}) {
    super({
      type: 'npm',
      baseUrl: config.baseUrl || 'https://registry.npmjs.org',
      timeout: config.timeout || 30000,
      ...config
    });

    this.apiUrl = this.baseUrl;
    this.authToken = config.authToken || process.env.NPM_TOKEN;
    this.scope = config.scope || null;
    this.userAgent = config.userAgent || 'kgen-marketplace/1.0.0';
  }

  async initialize() {
    try {
      // Test registry connectivity
      const response = await this.makeRequest('GET', '/');
      if (!response.ok) {
        throw new RegistryNetworkError('npm', 'initialize', `HTTP ${response.status}`);
      }
      
      this.emit('initialized', { registry: this.name, type: this.type });
      return true;
    } catch (error) {
      this.emit('error', { operation: 'initialize', error });
      throw new RegistryNetworkError('npm', 'initialize', error);
    }
  }

  async isHealthy() {
    try {
      const response = await this.makeRequest('GET', '/', { timeout: 5000 });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async publish(packageInfo, options = {}) {
    this.validatePackageInfo(packageInfo);
    
    if (!this.authToken) {
      throw new RegistryAuthError('npm', 'publish');
    }

    try {
      const { name, version, content } = packageInfo;
      const packageName = this.scope ? `${this.scope}/${name}` : name;
      
      // Create package tarball
      const tarball = await this.createTarball(content);
      const shasum = this.generateContentHash(tarball, 'sha1');
      
      // Prepare package document
      const packageDoc = {
        _id: packageName,
        name: packageName,
        description: packageInfo.description || '',
        'dist-tags': {
          latest: version
        },
        versions: {
          [version]: {
            name: packageName,
            version: version,
            description: packageInfo.description || '',
            main: packageInfo.main || 'index.js',
            keywords: packageInfo.keywords || [],
            author: packageInfo.author || '',
            license: packageInfo.license || 'MIT',
            repository: packageInfo.repository || {},
            bugs: packageInfo.bugs || {},
            homepage: packageInfo.homepage || '',
            dependencies: packageInfo.dependencies || {},
            devDependencies: packageInfo.devDependencies || {},
            dist: {
              shasum: shasum,
              tarball: `${this.apiUrl}/${packageName}/-/${name}-${version}.tgz`
            },
            ...packageInfo.metadata
          }
        },
        _attachments: {
          [`${name}-${version}.tgz`]: {
            content_type: 'application/octet-stream',
            data: tarball.toString('base64'),
            length: tarball.length
          }
        }
      };

      const response = await this.makeRequest('PUT', `/${packageName}`, {
        body: JSON.stringify(packageDoc),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new RegistryError(
          `Failed to publish package: ${errorData.error || response.statusText}`,
          'PUBLISH_FAILED'
        );
      }

      const result = await response.json();
      this.emit('published', { name: packageName, version, result });
      
      return {
        success: true,
        name: packageName,
        version: version,
        shasum: shasum,
        location: `${this.apiUrl}/${packageName}/-/${name}-${version}.tgz`
      };
    } catch (error) {
      this.emit('error', { operation: 'publish', error });
      if (error instanceof RegistryError) {
        throw error;
      }
      throw new RegistryError(`Publish failed: ${error.message}`, 'PUBLISH_FAILED', error);
    }
  }

  async search(query, options = {}) {
    try {
      const params = new URLSearchParams({
        text: query,
        size: options.limit || 20,
        from: options.offset || 0
      });

      if (options.author) {
        params.append('author', options.author);
      }

      if (options.tags && options.tags.length > 0) {
        params.append('keywords', options.tags.join(','));
      }

      const response = await this.makeRequest('GET', `/-/v1/search?${params}`);
      
      if (!response.ok) {
        throw new RegistryNetworkError('npm', 'search', `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      return data.objects.map(item => ({
        name: item.package.name,
        version: item.package.version,
        description: item.package.description,
        author: item.package.author?.name || '',
        keywords: item.package.keywords || [],
        homepage: item.package.links?.homepage || '',
        repository: item.package.links?.repository || '',
        npm: item.package.links?.npm || '',
        score: item.score.final,
        searchScore: item.searchScore,
        downloads: item.downloads?.weekly || 0,
        publishedAt: item.package.date
      }));
    } catch (error) {
      this.emit('error', { operation: 'search', error });
      if (error instanceof RegistryError) {
        throw error;
      }
      throw new RegistryNetworkError('npm', 'search', error);
    }
  }

  async getPackageInfo(name, version = 'latest') {
    try {
      const packageName = this.scope ? `${this.scope}/${name}` : name;
      const url = version === 'latest' ? `/${packageName}` : `/${packageName}/${version}`;
      
      const response = await this.makeRequest('GET', url);
      
      if (response.status === 404) {
        throw new RegistryNotFoundError(packageName, 'npm');
      }
      
      if (!response.ok) {
        throw new RegistryNetworkError('npm', 'getPackageInfo', `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (version === 'latest') {
        const latestVersion = data['dist-tags']?.latest;
        const versionData = data.versions[latestVersion];
        
        return {
          name: data.name,
          version: latestVersion,
          description: versionData.description,
          author: versionData.author,
          license: versionData.license,
          keywords: versionData.keywords || [],
          dependencies: versionData.dependencies || {},
          devDependencies: versionData.devDependencies || {},
          repository: versionData.repository,
          bugs: versionData.bugs,
          homepage: versionData.homepage,
          publishedAt: data.time[latestVersion],
          dist: versionData.dist,
          versions: Object.keys(data.versions)
        };
      } else {
        return {
          name: data.name,
          version: data.version,
          description: data.description,
          author: data.author,
          license: data.license,
          keywords: data.keywords || [],
          dependencies: data.dependencies || {},
          devDependencies: data.devDependencies || {},
          repository: data.repository,
          bugs: data.bugs,
          homepage: data.homepage,
          dist: data.dist
        };
      }
    } catch (error) {
      this.emit('error', { operation: 'getPackageInfo', error });
      if (error instanceof RegistryError) {
        throw error;
      }
      throw new RegistryNetworkError('npm', 'getPackageInfo', error);
    }
  }

  async downloadPackage(name, version = 'latest', options = {}) {
    try {
      const packageInfo = await this.getPackageInfo(name, version);
      const tarballUrl = packageInfo.dist.tarball;
      
      const response = await fetch(tarballUrl, {
        timeout: this.timeout,
        headers: {
          'User-Agent': this.userAgent
        }
      });

      if (!response.ok) {
        throw new RegistryNetworkError('npm', 'downloadPackage', `HTTP ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Verify integrity if shasum is available
      if (packageInfo.dist.shasum) {
        const actualShasum = this.generateContentHash(buffer, 'sha1');
        if (actualShasum !== packageInfo.dist.shasum) {
          throw new RegistryError(
            `Package integrity check failed for ${name}@${version}`,
            'INTEGRITY_ERROR'
          );
        }
      }

      this.emit('downloaded', { name, version, size: buffer.length });
      return buffer;
    } catch (error) {
      this.emit('error', { operation: 'downloadPackage', error });
      if (error instanceof RegistryError) {
        throw error;
      }
      throw new RegistryNetworkError('npm', 'downloadPackage', error);
    }
  }

  async listVersions(name) {
    try {
      const packageInfo = await this.getPackageInfo(name);
      return packageInfo.versions;
    } catch (error) {
      if (error instanceof RegistryNotFoundError) {
        throw error;
      }
      throw new RegistryNetworkError('npm', 'listVersions', error);
    }
  }

  async authenticate(credentials) {
    try {
      if (credentials.token) {
        this.authToken = credentials.token;
      } else if (credentials.username && credentials.password) {
        // Login with username/password to get token
        const loginData = {
          name: credentials.username,
          password: credentials.password
        };

        const response = await this.makeRequest('PUT', '/-/user/org.couchdb.user:' + credentials.username, {
          body: JSON.stringify(loginData),
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new RegistryAuthError('npm', 'authenticate');
        }

        const result = await response.json();
        this.authToken = result.token;
      }

      // Verify authentication
      const whoamiResponse = await this.makeRequest('GET', '/-/whoami', {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (!whoamiResponse.ok) {
        throw new RegistryAuthError('npm', 'authenticate');
      }

      const userInfo = await whoamiResponse.json();
      this.emit('authenticated', { username: userInfo.username });
      
      return {
        success: true,
        username: userInfo.username,
        token: this.authToken
      };
    } catch (error) {
      this.emit('error', { operation: 'authenticate', error });
      if (error instanceof RegistryError) {
        throw error;
      }
      throw new RegistryAuthError('npm', 'authenticate');
    }
  }

  async getCapabilities() {
    const base = await super.getCapabilities();
    return {
      ...base,
      supports: {
        ...base.supports,
        authentication: true,
        tags: true,
        scoped: true,
        search: true,
        integrity: true
      },
      endpoints: {
        ...base.endpoints,
        search: `${this.apiUrl}/-/v1/search`,
        package: `${this.apiUrl}/{package}`,
        tarball: `${this.apiUrl}/{package}/-/{filename}`,
        whoami: `${this.apiUrl}/-/whoami`
      },
      features: [
        'semver',
        'dist-tags',
        'scoped-packages',
        'dependencies',
        'devDependencies',
        'keywords',
        'integrity-verification'
      ]
    };
  }

  async makeRequest(method, path, options = {}) {
    const url = `${this.apiUrl}${path}`;
    const requestOptions = {
      method,
      timeout: options.timeout || this.timeout,
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/json',
        ...options.headers
      }
    };

    if (options.body) {
      requestOptions.body = options.body;
    }

    return await this.retryOperation(async () => {
      return await fetch(url, requestOptions);
    });
  }

  async createTarball(content) {
    // Simple tarball creation for demonstration
    // In production, use proper tar library
    if (Buffer.isBuffer(content)) {
      return content;
    }
    
    if (typeof content === 'string') {
      return Buffer.from(content);
    }
    
    // For file path, read and compress
    if (typeof content === 'object' && content.path) {
      const stream = createReadStream(content.path);
      const gzip = createGzip();
      const chunks = [];
      
      await pipeline(
        stream,
        gzip,
        async function* (source) {
          for await (const chunk of source) {
            chunks.push(chunk);
            yield chunk;
          }
        }
      );
      
      return Buffer.concat(chunks);
    }
    
    throw new RegistryError('Invalid content format for tarball creation', 'INVALID_CONTENT');
  }
}

export default NpmRegistry;