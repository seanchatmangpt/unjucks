/**
 * IPFS Registry backend implementation
 * Uses InterPlanetary File System for decentralized package storage
 */

import { RegistryInterface, RegistryError, RegistryNotFoundError, RegistryAuthError, RegistryNetworkError } from '../registry-interface.js';
import { fetch } from 'undici';
import { createHash } from 'crypto';

export class IpfsRegistry extends RegistryInterface {
  constructor(config = {}) {
    super({
      type: 'ipfs',
      baseUrl: config.baseUrl || 'http://127.0.0.1:5001',
      timeout: config.timeout || 120000, // IPFS operations can be slow
      ...config
    });

    this.apiUrl = `${this.baseUrl}/api/v0`;
    this.gatewayUrl = config.gatewayUrl || 'https://ipfs.io/ipfs';
    this.pinningService = config.pinningService || null;
    this.pinningApiKey = config.pinningApiKey || null;
    this.namespace = config.namespace || 'kgen-packages';
    this.indexCid = config.indexCid || null; // CID of the package index
    this.userAgent = config.userAgent || 'kgen-marketplace/1.0.0';
  }

  async initialize() {
    try {
      // Check IPFS node connectivity
      const response = await this.makeRequest('POST', '/version');
      
      if (!response.ok) {
        throw new RegistryNetworkError('ipfs', 'initialize', `HTTP ${response.status}`);
      }

      const versionInfo = await response.json();
      this.nodeVersion = versionInfo.Version;
      
      // Initialize or load package index
      await this.initializeIndex();
      
      this.emit('initialized', { 
        registry: this.name, 
        type: this.type, 
        nodeVersion: this.nodeVersion,
        indexCid: this.indexCid
      });
      
      return true;
    } catch (error) {
      this.emit('error', { operation: 'initialize', error });
      throw new RegistryNetworkError('ipfs', 'initialize', error);
    }
  }

  async isHealthy() {
    try {
      const response = await this.makeRequest('POST', '/version', { timeout: 5000 });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async publish(packageInfo, options = {}) {
    this.validatePackageInfo(packageInfo);
    
    try {
      const { name, version, content } = packageInfo;
      
      // Upload package content to IPFS
      const contentCid = await this.uploadContent(content);
      
      // Create package metadata
      const packageMetadata = {
        name: name,
        version: version,
        description: packageInfo.description || '',
        author: packageInfo.author || '',
        license: packageInfo.license || 'MIT',
        keywords: packageInfo.keywords || [],
        contentCid: contentCid,
        publishedAt: new Date().toISOString(),
        size: Buffer.isBuffer(content) ? content.length : Buffer.from(content).length,
        ...packageInfo.metadata
      };
      
      // Upload metadata
      const metadataCid = await this.uploadJson(packageMetadata);
      
      // Update package index
      await this.updatePackageIndex(name, version, metadataCid);
      
      // Pin content if pinning service is configured
      if (this.pinningService) {
        await this.pinContent(contentCid);
        await this.pinContent(metadataCid);
      }
      
      this.emit('published', { 
        name, 
        version, 
        contentCid, 
        metadataCid,
        gateway: `${this.gatewayUrl}/${contentCid}`
      });
      
      return {
        success: true,
        name: name,
        version: version,
        contentCid: contentCid,
        metadataCid: metadataCid,
        location: `${this.gatewayUrl}/${contentCid}`,
        ipfsUrl: `ipfs://${contentCid}`
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
      const packageIndex = await this.getPackageIndex();
      const results = [];
      
      const limit = options.limit || 20;
      const offset = options.offset || 0;
      
      // Search through package index
      let count = 0;
      let skipped = 0;
      
      for (const [packageName, versions] of Object.entries(packageIndex.packages || {})) {
        if (count >= limit) break;
        
        // Check if package matches query
        const latestVersion = Object.keys(versions).sort(this.compareVersions.bind(this)).reverse()[0];
        const packageData = versions[latestVersion];
        
        const matches = this.matchesQuery(packageName, packageData, query, options);
        
        if (matches) {
          if (skipped < offset) {
            skipped++;
            continue;
          }
          
          try {
            // Fetch full metadata
            const metadata = await this.fetchJson(packageData.metadataCid);
            results.push({
              name: packageName,
              version: latestVersion,
              description: metadata.description,
              author: metadata.author,
              keywords: metadata.keywords || [],
              contentCid: metadata.contentCid,
              publishedAt: metadata.publishedAt,
              size: metadata.size,
              ipfsUrl: `ipfs://${metadata.contentCid}`,
              gatewayUrl: `${this.gatewayUrl}/${metadata.contentCid}`
            });
            count++;
          } catch (error) {
            // Skip packages with inaccessible metadata
            continue;
          }
        }
      }
      
      return results;
    } catch (error) {
      this.emit('error', { operation: 'search', error });
      if (error instanceof RegistryError) {
        throw error;
      }
      throw new RegistryNetworkError('ipfs', 'search', error);
    }
  }

  async getPackageInfo(name, version = 'latest') {
    try {
      const packageIndex = await this.getPackageIndex();
      const packageVersions = packageIndex.packages?.[name];
      
      if (!packageVersions) {
        throw new RegistryNotFoundError(name, 'ipfs');
      }
      
      let targetVersion = version;
      if (version === 'latest') {
        const versions = Object.keys(packageVersions).sort(this.compareVersions.bind(this)).reverse();
        targetVersion = versions[0];
      }
      
      const versionData = packageVersions[targetVersion];
      if (!versionData) {
        throw new RegistryNotFoundError(`${name}@${version}`, 'ipfs');
      }
      
      // Fetch metadata from IPFS
      const metadata = await this.fetchJson(versionData.metadataCid);
      
      return {
        name: name,
        version: targetVersion,
        description: metadata.description,
        author: metadata.author,
        license: metadata.license,
        keywords: metadata.keywords || [],
        contentCid: metadata.contentCid,
        metadataCid: versionData.metadataCid,
        publishedAt: metadata.publishedAt,
        size: metadata.size,
        ipfsUrl: `ipfs://${metadata.contentCid}`,
        gatewayUrl: `${this.gatewayUrl}/${metadata.contentCid}`,
        versions: Object.keys(packageVersions)
      };
    } catch (error) {
      this.emit('error', { operation: 'getPackageInfo', error });
      if (error instanceof RegistryError) {
        throw error;
      }
      throw new RegistryNetworkError('ipfs', 'getPackageInfo', error);
    }
  }

  async downloadPackage(name, version = 'latest', options = {}) {
    try {
      const packageInfo = await this.getPackageInfo(name, version);
      
      // Download content from IPFS
      const response = await this.makeRequest('POST', `/cat?arg=${packageInfo.contentCid}`);
      
      if (!response.ok) {
        throw new RegistryNetworkError('ipfs', 'downloadPackage', `HTTP ${response.status}`);
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Verify content integrity
      const actualHash = this.generateContentHash(buffer);
      if (options.verifyIntegrity && packageInfo.contentHash && actualHash !== packageInfo.contentHash) {
        throw new RegistryError(
          `Content integrity check failed for ${name}@${version}`,
          'INTEGRITY_ERROR'
        );
      }
      
      this.emit('downloaded', { name, version, size: buffer.length, cid: packageInfo.contentCid });
      return buffer;
    } catch (error) {
      this.emit('error', { operation: 'downloadPackage', error });
      if (error instanceof RegistryError) {
        throw error;
      }
      throw new RegistryNetworkError('ipfs', 'downloadPackage', error);
    }
  }

  async listVersions(name) {
    try {
      const packageIndex = await this.getPackageIndex();
      const packageVersions = packageIndex.packages?.[name];
      
      if (!packageVersions) {
        throw new RegistryNotFoundError(name, 'ipfs');
      }
      
      return Object.keys(packageVersions).sort(this.compareVersions.bind(this)).reverse();
    } catch (error) {
      if (error instanceof RegistryError) {
        throw error;
      }
      throw new RegistryNetworkError('ipfs', 'listVersions', error);
    }
  }

  async authenticate(credentials) {
    try {
      // IPFS itself doesn't require authentication, but pinning services might
      if (credentials.pinningApiKey) {
        this.pinningApiKey = credentials.pinningApiKey;
      }
      
      if (credentials.pinningService) {
        this.pinningService = credentials.pinningService;
      }
      
      // Test pinning service if configured
      if (this.pinningService && this.pinningApiKey) {
        await this.testPinningService();
      }
      
      this.emit('authenticated', { pinningService: this.pinningService });
      
      return {
        success: true,
        pinningService: this.pinningService,
        hasApiKey: !!this.pinningApiKey
      };
    } catch (error) {
      this.emit('error', { operation: 'authenticate', error });
      throw new RegistryAuthError('ipfs', 'authenticate');
    }
  }

  async getCapabilities() {
    const base = await super.getCapabilities();
    return {
      ...base,
      supports: {
        ...base.supports,
        decentralized: true,
        contentAddressing: true,
        pinning: true,
        offline: true,
        immutable: true
      },
      endpoints: {
        ...base.endpoints,
        api: this.apiUrl,
        gateway: this.gatewayUrl,
        add: `${this.apiUrl}/add`,
        cat: `${this.apiUrl}/cat`,
        pin: `${this.apiUrl}/pin/add`
      },
      features: [
        'content-addressing',
        'decentralized-storage',
        'offline-access',
        'immutable-content',
        'pinning-services',
        'gateway-access',
        'peer-to-peer'
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

  async uploadContent(content) {
    const formData = new FormData();
    
    if (Buffer.isBuffer(content)) {
      formData.append('file', new Blob([content]), 'package.tar.gz');
    } else if (typeof content === 'string') {
      formData.append('file', new Blob([content]), 'package.js');
    } else {
      throw new RegistryError('Invalid content format for IPFS upload', 'INVALID_CONTENT');
    }

    const response = await fetch(`${this.apiUrl}/add?wrap-with-directory=false`, {
      method: 'POST',
      body: formData,
      timeout: this.timeout
    });

    if (!response.ok) {
      throw new RegistryError(`IPFS upload failed: ${response.statusText}`, 'UPLOAD_FAILED');
    }

    const result = await response.json();
    return result.Hash;
  }

  async uploadJson(data) {
    const jsonContent = JSON.stringify(data, null, 2);
    return await this.uploadContent(jsonContent);
  }

  async fetchJson(cid) {
    const response = await this.makeRequest('POST', `/cat?arg=${cid}`);
    
    if (!response.ok) {
      throw new RegistryError(`Failed to fetch content from IPFS: ${cid}`, 'FETCH_FAILED');
    }
    
    const text = await response.text();
    return JSON.parse(text);
  }

  async initializeIndex() {
    if (this.indexCid) {
      // Try to load existing index
      try {
        await this.getPackageIndex();
        return;
      } catch (error) {
        // Index not accessible, create new one
      }
    }
    
    // Create new index
    const newIndex = {
      version: '1.0.0',
      namespace: this.namespace,
      createdAt: new Date().toISOString(),
      packages: {}
    };
    
    this.indexCid = await this.uploadJson(newIndex);
  }

  async getPackageIndex() {
    if (!this.indexCid) {
      throw new RegistryError('Package index not initialized', 'INDEX_NOT_FOUND');
    }
    
    return await this.fetchJson(this.indexCid);
  }

  async updatePackageIndex(packageName, version, metadataCid) {
    const currentIndex = await this.getPackageIndex();
    
    if (!currentIndex.packages[packageName]) {
      currentIndex.packages[packageName] = {};
    }
    
    currentIndex.packages[packageName][version] = {
      metadataCid: metadataCid,
      addedAt: new Date().toISOString()
    };
    
    currentIndex.updatedAt = new Date().toISOString();
    
    // Upload updated index
    const newIndexCid = await this.uploadJson(currentIndex);
    this.indexCid = newIndexCid;
    
    // Pin the new index
    if (this.pinningService) {
      await this.pinContent(newIndexCid);
    }
  }

  async pinContent(cid) {
    if (!this.pinningService || !this.pinningApiKey) {
      // Use local pinning
      const response = await this.makeRequest('POST', `/pin/add?arg=${cid}`);
      
      if (!response.ok) {
        throw new RegistryError(`Local pinning failed for ${cid}`, 'PIN_FAILED');
      }
      
      return;
    }
    
    // Use external pinning service
    const pinningUrl = this.getPinningServiceUrl();
    const response = await fetch(pinningUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.pinningApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cid: cid,
        name: `kgen-package-${Date.now()}`
      })
    });
    
    if (!response.ok) {
      throw new RegistryError(`Remote pinning failed for ${cid}`, 'PIN_FAILED');
    }
  }

  getPinningServiceUrl() {
    const services = {
      'pinata': 'https://api.pinata.cloud/pinning/pinByHash',
      'web3.storage': 'https://api.web3.storage/pins',
      'nft.storage': 'https://api.nft.storage/pins'
    };
    
    return services[this.pinningService] || this.pinningService;
  }

  async testPinningService() {
    // Test with a simple CID (empty directory)
    const testCid = 'QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn';
    
    try {
      await this.pinContent(testCid);
      return true;
    } catch (error) {
      throw new RegistryError('Pinning service test failed', 'PINNING_TEST_FAILED');
    }
  }

  matchesQuery(packageName, packageData, query, options) {
    const queryLower = query.toLowerCase();
    
    // Check package name
    if (packageName.toLowerCase().includes(queryLower)) {
      return true;
    }
    
    // Additional filtering can be added here based on options
    if (options.author && packageData.author !== options.author) {
      return false;
    }
    
    if (options.tags && options.tags.length > 0) {
      const keywords = packageData.keywords || [];
      const hasMatchingTag = options.tags.some(tag => 
        keywords.some(keyword => keyword.toLowerCase() === tag.toLowerCase())
      );
      if (!hasMatchingTag) {
        return false;
      }
    }
    
    return false;
  }

  compareVersions(a, b) {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }
    
    return 0;
  }
}

export default IpfsRegistry;