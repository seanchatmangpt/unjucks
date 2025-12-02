/**
 * OCI (Open Container Initiative) Registry backend implementation
 * Supports Docker Registry API v2 and OCI Distribution Specification
 */

import { RegistryInterface, RegistryError, RegistryNotFoundError, RegistryAuthError, RegistryNetworkError } from '../registry-interface.js';
import { fetch } from 'undici';
import { createHash } from 'crypto';

export class OciRegistry extends RegistryInterface {
  constructor(config = {}) {
    super({
      type: 'oci',
      baseUrl: config.baseUrl || 'https://registry-1.docker.io',
      timeout: config.timeout || 60000,
      ...config
    });

    this.apiVersion = 'v2';
    this.username = config.username || null;
    this.password = config.password || null;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.namespace = config.namespace || 'library';
    this.userAgent = config.userAgent || 'kgen-marketplace/1.0.0';
  }

  async initialize() {
    try {
      // Check registry API version support
      const response = await this.makeRequest('GET', `/${this.apiVersion}/`);
      
      if (response.status === 401) {
        // Registry requires authentication
        await this.authenticate({
          username: this.username,
          password: this.password
        });
      } else if (!response.ok) {
        throw new RegistryNetworkError('oci', 'initialize', `HTTP ${response.status}`);
      }
      
      this.emit('initialized', { registry: this.name, type: this.type });
      return true;
    } catch (error) {
      this.emit('error', { operation: 'initialize', error });
      throw new RegistryNetworkError('oci', 'initialize', error);
    }
  }

  async isHealthy() {
    try {
      const response = await this.makeRequest('GET', `/${this.apiVersion}/`, { timeout: 5000 });
      return response.ok || response.status === 401; // 401 is expected for some registries
    } catch (error) {
      return false;
    }
  }

  async publish(packageInfo, options = {}) {
    this.validatePackageInfo(packageInfo);
    
    try {
      const { name, version, content } = packageInfo;
      const repository = `${this.namespace}/${name}`;
      
      // Create blob from content
      const blob = Buffer.isBuffer(content) ? content : Buffer.from(content);
      const blobDigest = this.generateContentDigest(blob);
      
      // Upload blob
      await this.uploadBlob(repository, blob, blobDigest);
      
      // Create manifest
      const manifest = this.createManifest(packageInfo, blobDigest, blob.length);
      const manifestDigest = this.generateContentDigest(JSON.stringify(manifest));
      
      // Upload manifest
      await this.uploadManifest(repository, version, manifest);
      
      this.emit('published', { name: repository, version, digest: manifestDigest });
      
      return {
        success: true,
        name: repository,
        version: version,
        digest: manifestDigest,
        location: `${this.baseUrl}/${this.apiVersion}/${repository}/manifests/${version}`
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
      // OCI registry doesn't have standardized search
      // Implement basic search via catalog API if available
      const response = await this.makeRequest('GET', `/${this.apiVersion}/_catalog`);
      
      if (!response.ok) {
        throw new RegistryNetworkError('oci', 'search', `HTTP ${response.status}`);
      }

      const data = await response.json();
      const repositories = data.repositories || [];
      
      // Filter repositories based on query
      const filtered = repositories.filter(repo => 
        repo.toLowerCase().includes(query.toLowerCase())
      );

      // Get metadata for each repository
      const results = [];
      const limit = Math.min(options.limit || 20, filtered.length);
      
      for (let i = 0; i < limit && i < filtered.length; i++) {
        try {
          const repoInfo = await this.getPackageInfo(filtered[i].split('/').pop());
          results.push(repoInfo);
        } catch (error) {
          // Skip repositories that can't be accessed
          continue;
        }
      }
      
      return results;
    } catch (error) {
      this.emit('error', { operation: 'search', error });
      if (error instanceof RegistryError) {
        throw error;
      }
      throw new RegistryNetworkError('oci', 'search', error);
    }
  }

  async getPackageInfo(name, version = 'latest') {
    try {
      const repository = `${this.namespace}/${name}`;
      
      // Get manifest
      const response = await this.makeRequest('GET', `/${this.apiVersion}/${repository}/manifests/${version}`, {
        headers: {
          'Accept': 'application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json'
        }
      });
      
      if (response.status === 404) {
        throw new RegistryNotFoundError(repository, 'oci');
      }
      
      if (!response.ok) {
        throw new RegistryNetworkError('oci', 'getPackageInfo', `HTTP ${response.status}`);
      }

      const manifest = await response.json();
      const contentDigest = response.headers.get('docker-content-digest');
      
      // Get config blob for metadata
      let metadata = {};
      if (manifest.config) {
        try {
          const configResponse = await this.makeRequest('GET', 
            `/${this.apiVersion}/${repository}/blobs/${manifest.config.digest}`
          );
          
          if (configResponse.ok) {
            const config = await configResponse.json();
            metadata = {
              description: config.config?.Labels?.['org.opencontainers.image.description'] || '',
              author: config.config?.Labels?.['org.opencontainers.image.authors'] || '',
              version: config.config?.Labels?.['org.opencontainers.image.version'] || version,
              created: config.created,
              labels: config.config?.Labels || {}
            };
          }
        } catch (error) {
          // Config blob not accessible, continue with basic info
        }
      }
      
      return {
        name: name,
        version: version,
        repository: repository,
        digest: contentDigest,
        mediaType: manifest.mediaType,
        schemaVersion: manifest.schemaVersion,
        size: manifest.layers?.reduce((sum, layer) => sum + layer.size, 0) || 0,
        layers: manifest.layers?.length || 0,
        architecture: manifest.platform?.architecture || 'unknown',
        os: manifest.platform?.os || 'unknown',
        ...metadata
      };
    } catch (error) {
      this.emit('error', { operation: 'getPackageInfo', error });
      if (error instanceof RegistryError) {
        throw error;
      }
      throw new RegistryNetworkError('oci', 'getPackageInfo', error);
    }
  }

  async downloadPackage(name, version = 'latest', options = {}) {
    try {
      const repository = `${this.namespace}/${name}`;
      const packageInfo = await this.getPackageInfo(name, version);
      
      // Download manifest first
      const manifestResponse = await this.makeRequest('GET', 
        `/${this.apiVersion}/${repository}/manifests/${version}`
      );
      
      if (!manifestResponse.ok) {
        throw new RegistryNetworkError('oci', 'downloadPackage', `HTTP ${manifestResponse.status}`);
      }

      const manifest = await manifestResponse.json();
      
      // Download all layers
      const layers = [];
      for (const layer of manifest.layers || []) {
        const layerResponse = await this.makeRequest('GET', 
          `/${this.apiVersion}/${repository}/blobs/${layer.digest}`
        );
        
        if (!layerResponse.ok) {
          throw new RegistryNetworkError('oci', 'downloadPackage', 
            `Failed to download layer ${layer.digest}`
          );
        }
        
        const layerData = Buffer.from(await layerResponse.arrayBuffer());
        
        // Verify layer integrity
        const actualDigest = this.generateContentDigest(layerData);
        if (actualDigest !== layer.digest.split(':')[1]) {
          throw new RegistryError(
            `Layer integrity check failed for ${layer.digest}`,
            'INTEGRITY_ERROR'
          );
        }
        
        layers.push({
          digest: layer.digest,
          size: layer.size,
          mediaType: layer.mediaType,
          data: layerData
        });
      }
      
      this.emit('downloaded', { name, version, layers: layers.length });
      
      return {
        manifest: manifest,
        layers: layers,
        totalSize: layers.reduce((sum, layer) => sum + layer.size, 0)
      };
    } catch (error) {
      this.emit('error', { operation: 'downloadPackage', error });
      if (error instanceof RegistryError) {
        throw error;
      }
      throw new RegistryNetworkError('oci', 'downloadPackage', error);
    }
  }

  async listVersions(name) {
    try {
      const repository = `${this.namespace}/${name}`;
      const response = await this.makeRequest('GET', `/${this.apiVersion}/${repository}/tags/list`);
      
      if (response.status === 404) {
        throw new RegistryNotFoundError(repository, 'oci');
      }
      
      if (!response.ok) {
        throw new RegistryNetworkError('oci', 'listVersions', `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.tags || [];
    } catch (error) {
      if (error instanceof RegistryError) {
        throw error;
      }
      throw new RegistryNetworkError('oci', 'listVersions', error);
    }
  }

  async authenticate(credentials) {
    try {
      if (!credentials.username || !credentials.password) {
        throw new RegistryAuthError('oci', 'authenticate');
      }

      // Try to get a bearer token from the registry's auth service
      const authResponse = await this.makeRequest('GET', `/${this.apiVersion}/`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`
        }
      });

      if (authResponse.status === 401) {
        // Parse WWW-Authenticate header for token endpoint
        const authHeader = authResponse.headers.get('www-authenticate');
        if (authHeader && authHeader.includes('Bearer')) {
          const tokenUrl = this.parseAuthHeader(authHeader);
          
          const tokenResponse = await fetch(tokenUrl, {
            headers: {
              'Authorization': `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`
            }
          });

          if (!tokenResponse.ok) {
            throw new RegistryAuthError('oci', 'authenticate');
          }

          const tokenData = await tokenResponse.json();
          this.accessToken = tokenData.access_token || tokenData.token;
          this.tokenExpiry = Date.now() + ((tokenData.expires_in || 3600) * 1000);
        }
      }

      this.username = credentials.username;
      this.password = credentials.password;
      
      this.emit('authenticated', { username: credentials.username });
      
      return {
        success: true,
        username: credentials.username,
        hasToken: !!this.accessToken
      };
    } catch (error) {
      this.emit('error', { operation: 'authenticate', error });
      if (error instanceof RegistryError) {
        throw error;
      }
      throw new RegistryAuthError('oci', 'authenticate');
    }
  }

  async getCapabilities() {
    const base = await super.getCapabilities();
    return {
      ...base,
      supports: {
        ...base.supports,
        authentication: true,
        layers: true,
        manifests: true,
        blobs: true,
        integrity: true
      },
      endpoints: {
        ...base.endpoints,
        catalog: `${this.baseUrl}/${this.apiVersion}/_catalog`,
        manifests: `${this.baseUrl}/${this.apiVersion}/{name}/manifests/{reference}`,
        blobs: `${this.baseUrl}/${this.apiVersion}/{name}/blobs/{digest}`,
        tags: `${this.baseUrl}/${this.apiVersion}/{name}/tags/list`
      },
      features: [
        'docker-registry-api-v2',
        'oci-distribution-spec',
        'content-addressable',
        'multi-layer',
        'cross-platform'
      ]
    };
  }

  async makeRequest(method, path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'User-Agent': this.userAgent,
      'Accept': 'application/json',
      ...options.headers
    };

    // Add authentication if available
    if (this.accessToken && (!this.tokenExpiry || Date.now() < this.tokenExpiry)) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    } else if (this.username && this.password) {
      headers['Authorization'] = `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
    }

    const requestOptions = {
      method,
      timeout: options.timeout || this.timeout,
      headers
    };

    if (options.body) {
      requestOptions.body = options.body;
    }

    return await this.retryOperation(async () => {
      return await fetch(url, requestOptions);
    });
  }

  generateContentDigest(content) {
    const hash = createHash('sha256').update(content).digest('hex');
    return `sha256:${hash}`;
  }

  createManifest(packageInfo, blobDigest, blobSize) {
    return {
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      config: {
        mediaType: 'application/vnd.oci.image.config.v1+json',
        size: 0,
        digest: 'sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a' // empty config
      },
      layers: [
        {
          mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip',
          size: blobSize,
          digest: blobDigest
        }
      ],
      annotations: {
        'org.opencontainers.image.title': packageInfo.name,
        'org.opencontainers.image.version': packageInfo.version,
        'org.opencontainers.image.description': packageInfo.description || '',
        'org.opencontainers.image.created': new Date().toISOString(),
        'org.kgen.marketplace.package': 'true'
      }
    };
  }

  async uploadBlob(repository, blob, digest) {
    // Initiate blob upload
    const uploadResponse = await this.makeRequest('POST', `/${this.apiVersion}/${repository}/blobs/uploads/`);
    
    if (!uploadResponse.ok) {
      throw new RegistryError(`Failed to initiate blob upload: ${uploadResponse.statusText}`, 'UPLOAD_FAILED');
    }

    const uploadUrl = uploadResponse.headers.get('location');
    if (!uploadUrl) {
      throw new RegistryError('No upload URL provided by registry', 'UPLOAD_FAILED');
    }

    // Upload blob data
    const putResponse = await fetch(`${uploadUrl}&digest=${digest}`, {
      method: 'PUT',
      body: blob,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': blob.length.toString()
      }
    });

    if (!putResponse.ok) {
      throw new RegistryError(`Blob upload failed: ${putResponse.statusText}`, 'UPLOAD_FAILED');
    }
  }

  async uploadManifest(repository, tag, manifest) {
    const manifestJson = JSON.stringify(manifest);
    const response = await this.makeRequest('PUT', `/${this.apiVersion}/${repository}/manifests/${tag}`, {
      body: manifestJson,
      headers: {
        'Content-Type': 'application/vnd.oci.image.manifest.v1+json'
      }
    });

    if (!response.ok) {
      throw new RegistryError(`Manifest upload failed: ${response.statusText}`, 'UPLOAD_FAILED');
    }
  }

  parseAuthHeader(authHeader) {
    // Parse WWW-Authenticate header to extract token endpoint
    const match = authHeader.match(/realm="([^"]+)"/);
    if (match) {
      return match[1];
    }
    throw new RegistryError('Invalid authentication header', 'AUTH_PARSE_ERROR');
  }
}

export default OciRegistry;