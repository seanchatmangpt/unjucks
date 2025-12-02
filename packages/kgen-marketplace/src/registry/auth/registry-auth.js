/**
 * Registry authentication management system
 * Handles multiple authentication methods and credential storage
 */

import { readFile, writeFile, mkdir, chmod, access } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { EventEmitter } from 'events';

export class RegistryAuthError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'RegistryAuthError';
    this.code = code;
  }
}

export class RegistryAuth extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.credentialsPath = options.credentialsPath || join(homedir(), '.kgen', 'credentials.json');
    this.keyPath = options.keyPath || join(homedir(), '.kgen', '.key');
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    
    this.credentials = new Map();
    this.tokens = new Map();
    this.loaded = false;
    this.masterKey = null;
    
    // Token refresh intervals (in milliseconds)
    this.refreshIntervals = new Map();
    this.defaultRefreshMargin = 5 * 60 * 1000; // 5 minutes before expiry
  }

  /**
   * Initialize authentication system
   * @param {string} passphrase - Master passphrase for encryption
   * @returns {Promise<void>}
   */
  async initialize(passphrase = null) {
    try {
      // Generate or load master key
      await this.loadOrGenerateMasterKey(passphrase);
      
      // Load existing credentials
      await this.loadCredentials();
      
      this.loaded = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', { operation: 'initialize', error });
      throw new RegistryAuthError(`Failed to initialize auth: ${error.message}`, 'INIT_FAILED');
    }
  }

  /**
   * Store credentials for a registry
   * @param {string} registryName - Registry name
   * @param {Object} credentials - Credentials object
   * @param {Object} options - Storage options
   * @returns {Promise<void>}
   */
  async storeCredentials(registryName, credentials, options = {}) {
    if (!this.loaded) {
      throw new RegistryAuthError('Authentication not initialized', 'NOT_INITIALIZED');
    }

    try {
      const credentialEntry = {
        registry: registryName,
        type: credentials.type || 'unknown',
        data: credentials,
        createdAt: new Date().toISOString(),
        expiresAt: credentials.expiresAt || null,
        scopes: credentials.scopes || [],
        metadata: options.metadata || {}
      };

      this.credentials.set(registryName, credentialEntry);
      
      // Save to disk if persistent
      if (options.persistent !== false) {
        await this.saveCredentials();
      }

      // Set up token refresh if applicable
      if (credentials.refreshToken || credentials.expiresAt) {
        this.setupTokenRefresh(registryName, credentialEntry);
      }

      this.emit('credentialsStored', { 
        registry: registryName, 
        type: credentials.type,
        persistent: options.persistent !== false
      });
    } catch (error) {
      this.emit('error', { operation: 'storeCredentials', error });
      throw new RegistryAuthError(`Failed to store credentials: ${error.message}`, 'STORE_FAILED');
    }
  }

  /**
   * Get credentials for a registry
   * @param {string} registryName - Registry name
   * @param {Object} options - Retrieval options
   * @returns {Promise<Object|null>} Credentials or null if not found
   */
  async getCredentials(registryName, options = {}) {
    if (!this.loaded) {
      throw new RegistryAuthError('Authentication not initialized', 'NOT_INITIALIZED');
    }

    try {
      const credentialEntry = this.credentials.get(registryName);
      
      if (!credentialEntry) {
        // Try to load from environment
        const envCredentials = this.loadFromEnvironment(registryName);
        if (envCredentials) {
          return envCredentials;
        }
        
        this.emit('credentialsNotFound', { registry: registryName });
        return null;
      }

      // Check if credentials are expired
      if (credentialEntry.expiresAt && new Date(credentialEntry.expiresAt) < new Date()) {
        // Try to refresh token
        const refreshed = await this.refreshCredentials(registryName);
        if (refreshed) {
          return refreshed.data;
        }
        
        this.emit('credentialsExpired', { registry: registryName });
        return null;
      }

      // Check scopes if specified
      if (options.requiredScopes) {
        const hasRequiredScopes = options.requiredScopes.every(scope => 
          credentialEntry.scopes.includes(scope)
        );
        
        if (!hasRequiredScopes) {
          this.emit('insufficientScopes', { 
            registry: registryName,
            required: options.requiredScopes,
            available: credentialEntry.scopes
          });
          return null;
        }
      }

      return credentialEntry.data;
    } catch (error) {
      this.emit('error', { operation: 'getCredentials', error });
      throw new RegistryAuthError(`Failed to get credentials: ${error.message}`, 'GET_FAILED');
    }
  }

  /**
   * Remove credentials for a registry
   * @param {string} registryName - Registry name
   * @returns {Promise<boolean>} True if credentials were removed
   */
  async removeCredentials(registryName) {
    if (!this.loaded) {
      throw new RegistryAuthError('Authentication not initialized', 'NOT_INITIALIZED');
    }

    try {
      const existed = this.credentials.has(registryName);
      this.credentials.delete(registryName);
      
      // Clear token refresh
      this.clearTokenRefresh(registryName);
      
      // Save to disk
      await this.saveCredentials();
      
      if (existed) {
        this.emit('credentialsRemoved', { registry: registryName });
      }
      
      return existed;
    } catch (error) {
      this.emit('error', { operation: 'removeCredentials', error });
      throw new RegistryAuthError(`Failed to remove credentials: ${error.message}`, 'REMOVE_FAILED');
    }
  }

  /**
   * Refresh credentials for a registry
   * @param {string} registryName - Registry name
   * @returns {Promise<Object|null>} Refreshed credentials or null
   */
  async refreshCredentials(registryName) {
    try {
      const credentialEntry = this.credentials.get(registryName);
      
      if (!credentialEntry) {
        return null;
      }

      const { type, data } = credentialEntry;
      let refreshed = null;

      switch (type) {
        case 'oauth2':
          refreshed = await this.refreshOAuth2Token(data);
          break;
        case 'jwt':
          refreshed = await this.refreshJwtToken(data);
          break;
        case 'api-key':
          // API keys typically don't refresh, but check with provider
          refreshed = await this.validateApiKey(data);
          break;
        default:
          // No refresh mechanism available
          return null;
      }

      if (refreshed) {
        const updatedEntry = {
          ...credentialEntry,
          data: refreshed,
          updatedAt: new Date().toISOString()
        };

        this.credentials.set(registryName, updatedEntry);
        await this.saveCredentials();
        
        // Update refresh timer
        this.setupTokenRefresh(registryName, updatedEntry);
        
        this.emit('credentialsRefreshed', { registry: registryName });
        return updatedEntry;
      }

      return null;
    } catch (error) {
      this.emit('error', { operation: 'refreshCredentials', error, registry: registryName });
      return null;
    }
  }

  /**
   * Authenticate with a registry using stored credentials
   * @param {string} registryName - Registry name
   * @param {Object} registry - Registry instance
   * @returns {Promise<Object|null>} Authentication result
   */
  async authenticateRegistry(registryName, registry) {
    try {
      const credentials = await this.getCredentials(registryName);
      
      if (!credentials) {
        return null;
      }

      // Call registry's authenticate method
      const result = await registry.authenticate(credentials);
      
      if (result.success) {
        // Update stored credentials with any new tokens
        if (result.token && result.token !== credentials.token) {
          credentials.token = result.token;
          credentials.expiresAt = result.expiresAt;
          await this.storeCredentials(registryName, credentials);
        }
        
        this.emit('registryAuthenticated', { 
          registry: registryName,
          username: result.username
        });
      }

      return result;
    } catch (error) {
      this.emit('error', { 
        operation: 'authenticateRegistry', 
        error, 
        registry: registryName 
      });
      throw new RegistryAuthError(
        `Registry authentication failed: ${error.message}`, 
        'AUTH_FAILED'
      );
    }
  }

  /**
   * List all stored credentials
   * @returns {Array<Object>} List of credential summaries
   */
  listCredentials() {
    if (!this.loaded) {
      throw new RegistryAuthError('Authentication not initialized', 'NOT_INITIALIZED');
    }

    const summaries = [];
    
    for (const [registryName, entry] of this.credentials.entries()) {
      summaries.push({
        registry: registryName,
        type: entry.type,
        createdAt: entry.createdAt,
        expiresAt: entry.expiresAt,
        scopes: entry.scopes,
        expired: entry.expiresAt && new Date(entry.expiresAt) < new Date()
      });
    }

    return summaries;
  }

  /**
   * Validate stored credentials
   * @param {string} registryName - Registry name (optional)
   * @returns {Promise<Object>} Validation results
   */
  async validateCredentials(registryName = null) {
    const results = {
      valid: [],
      invalid: [],
      expired: []
    };

    const credentialsToCheck = registryName 
      ? [registryName]
      : Array.from(this.credentials.keys());

    for (const name of credentialsToCheck) {
      const entry = this.credentials.get(name);
      
      if (!entry) {
        results.invalid.push({ registry: name, reason: 'Not found' });
        continue;
      }

      // Check expiry
      if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
        results.expired.push({ 
          registry: name, 
          expiresAt: entry.expiresAt 
        });
        continue;
      }

      // Validate format based on type
      try {
        const isValid = await this.validateCredentialFormat(entry);
        
        if (isValid) {
          results.valid.push({ registry: name, type: entry.type });
        } else {
          results.invalid.push({ 
            registry: name, 
            reason: 'Invalid format' 
          });
        }
      } catch (error) {
        results.invalid.push({ 
          registry: name, 
          reason: error.message 
        });
      }
    }

    return results;
  }

  /**
   * Clear all stored credentials
   * @returns {Promise<void>}
   */
  async clearAllCredentials() {
    if (!this.loaded) {
      throw new RegistryAuthError('Authentication not initialized', 'NOT_INITIALIZED');
    }

    try {
      // Clear all refresh timers
      for (const registryName of this.credentials.keys()) {
        this.clearTokenRefresh(registryName);
      }

      this.credentials.clear();
      this.tokens.clear();
      
      await this.saveCredentials();
      
      this.emit('allCredentialsCleared');
    } catch (error) {
      this.emit('error', { operation: 'clearAllCredentials', error });
      throw new RegistryAuthError(`Failed to clear credentials: ${error.message}`, 'CLEAR_FAILED');
    }
  }

  /**
   * Generate secure API key for registry
   * @param {string} registryName - Registry name
   * @param {Object} options - Generation options
   * @returns {string} Generated API key
   */
  generateApiKey(registryName, options = {}) {
    const keyLength = options.length || 64;
    const prefix = options.prefix || `kgen_${registryName}_`;
    const entropy = randomBytes(keyLength);
    
    return prefix + entropy.toString('hex');
  }

  /**
   * Private methods
   */

  async loadOrGenerateMasterKey(passphrase) {
    try {
      // Try to load existing key
      await access(this.keyPath);
      const keyData = await readFile(this.keyPath, 'utf8');
      const parsed = JSON.parse(keyData);
      
      if (passphrase) {
        // Decrypt key with passphrase
        const decipher = createDecipheriv('aes-256-cbc', 
          createHash('sha256').update(passphrase).digest(), 
          Buffer.from(parsed.iv, 'hex')
        );
        
        this.masterKey = Buffer.concat([
          decipher.update(Buffer.from(parsed.key, 'hex')),
          decipher.final()
        ]);
      } else {
        this.masterKey = Buffer.from(parsed.key, 'hex');
      }
    } catch (error) {
      // Generate new master key
      this.masterKey = randomBytes(this.keyLength);
      
      const keyData = {
        key: this.masterKey.toString('hex'),
        created: new Date().toISOString()
      };
      
      if (passphrase) {
        // Encrypt key with passphrase
        const iv = randomBytes(16);
        const cipher = createCipheriv('aes-256-cbc', 
          createHash('sha256').update(passphrase).digest(), 
          iv
        );
        
        const encrypted = Buffer.concat([
          cipher.update(this.masterKey),
          cipher.final()
        ]);
        
        keyData.key = encrypted.toString('hex');
        keyData.iv = iv.toString('hex');
      }
      
      // Ensure directory exists
      await mkdir(dirname(this.keyPath), { recursive: true });
      
      // Write key file with restricted permissions
      await writeFile(this.keyPath, JSON.stringify(keyData));
      await chmod(this.keyPath, 0o600); // Read/write for owner only
    }
  }

  async loadCredentials() {
    try {
      await access(this.credentialsPath);
      const encryptedData = await readFile(this.credentialsPath, 'utf8');
      const parsed = JSON.parse(encryptedData);
      
      // Decrypt credentials
      const decipher = createDecipheriv(this.algorithm, this.masterKey, Buffer.from(parsed.iv, 'hex'));
      decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'));
      
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(parsed.data, 'hex')),
        decipher.final()
      ]);
      
      const credentials = JSON.parse(decrypted.toString());
      
      // Restore credentials map
      for (const [name, entry] of Object.entries(credentials)) {
        this.credentials.set(name, entry);
        
        // Set up refresh timers for valid tokens
        if (entry.expiresAt && new Date(entry.expiresAt) > new Date()) {
          this.setupTokenRefresh(name, entry);
        }
      }
      
    } catch (error) {
      // No credentials file exists or failed to decrypt
      // Start with empty credentials
    }
  }

  async saveCredentials() {
    try {
      // Convert credentials map to object
      const credentialsObj = {};
      for (const [name, entry] of this.credentials.entries()) {
        credentialsObj[name] = entry;
      }
      
      // Encrypt credentials
      const iv = randomBytes(this.ivLength);
      const cipher = createCipheriv(this.algorithm, this.masterKey, iv);
      
      const data = JSON.stringify(credentialsObj);
      const encrypted = Buffer.concat([
        cipher.update(data),
        cipher.final()
      ]);
      
      const encryptedData = {
        data: encrypted.toString('hex'),
        iv: iv.toString('hex'),
        tag: cipher.getAuthTag().toString('hex'),
        version: 1
      };
      
      // Ensure directory exists
      await mkdir(dirname(this.credentialsPath), { recursive: true });
      
      // Write credentials file with restricted permissions
      await writeFile(this.credentialsPath, JSON.stringify(encryptedData));
      await chmod(this.credentialsPath, 0o600); // Read/write for owner only
      
    } catch (error) {
      throw new RegistryAuthError(`Failed to save credentials: ${error.message}`, 'SAVE_FAILED');
    }
  }

  loadFromEnvironment(registryName) {
    const envMappings = {
      npm: {
        token: ['NPM_TOKEN', 'NPM_AUTH_TOKEN'],
        username: ['NPM_USERNAME'],
        password: ['NPM_PASSWORD'],
        email: ['NPM_EMAIL']
      },
      github: {
        token: ['GITHUB_TOKEN', 'GH_TOKEN'],
        username: ['GITHUB_USERNAME'],
        password: ['GITHUB_PASSWORD']
      },
      docker: {
        username: ['DOCKER_USERNAME', 'DOCKER_USER'],
        password: ['DOCKER_PASSWORD', 'DOCKER_PASS'],
        registry: ['DOCKER_REGISTRY']
      },
      ipfs: {
        apiKey: ['IPFS_PINNING_KEY', 'IPFS_API_KEY']
      }
    };

    const mapping = envMappings[registryName];
    if (!mapping) return null;

    const credentials = {};
    let hasCredentials = false;

    for (const [key, envVars] of Object.entries(mapping)) {
      for (const envVar of envVars) {
        const value = process.env[envVar];
        if (value) {
          credentials[key] = value;
          hasCredentials = true;
          break;
        }
      }
    }

    if (!hasCredentials) return null;

    // Determine credential type
    let type = 'unknown';
    if (credentials.token) type = 'token';
    else if (credentials.username && credentials.password) type = 'credentials';
    else if (credentials.apiKey) type = 'api-key';

    return {
      type,
      ...credentials,
      source: 'environment'
    };
  }

  setupTokenRefresh(registryName, credentialEntry) {
    if (!credentialEntry.expiresAt) return;

    // Clear existing refresh timer
    this.clearTokenRefresh(registryName);

    const expiryTime = new Date(credentialEntry.expiresAt).getTime();
    const refreshTime = expiryTime - this.defaultRefreshMargin;
    const now = Date.now();

    if (refreshTime > now) {
      const timeout = refreshTime - now;
      const timerId = setTimeout(async () => {
        try {
          await this.refreshCredentials(registryName);
        } catch (error) {
          this.emit('refreshFailed', { registry: registryName, error });
        }
      }, timeout);

      this.refreshIntervals.set(registryName, timerId);
    }
  }

  clearTokenRefresh(registryName) {
    const timerId = this.refreshIntervals.get(registryName);
    if (timerId) {
      clearTimeout(timerId);
      this.refreshIntervals.delete(registryName);
    }
  }

  async refreshOAuth2Token(credentials) {
    if (!credentials.refreshToken) {
      throw new Error('No refresh token available');
    }

    // Implementation depends on OAuth2 provider
    // This is a placeholder for actual OAuth2 refresh logic
    throw new Error('OAuth2 refresh not implemented');
  }

  async refreshJwtToken(credentials) {
    // JWT tokens typically cannot be refreshed, only re-issued
    // This would require re-authentication
    throw new Error('JWT refresh requires re-authentication');
  }

  async validateApiKey(credentials) {
    // API key validation depends on the specific registry
    // Return the same credentials if still valid
    return credentials;
  }

  async validateCredentialFormat(entry) {
    const { type, data } = entry;

    switch (type) {
      case 'token':
        return typeof data.token === 'string' && data.token.length > 0;
      
      case 'credentials':
        return typeof data.username === 'string' && 
               typeof data.password === 'string' &&
               data.username.length > 0 && 
               data.password.length > 0;
      
      case 'api-key':
        return typeof data.apiKey === 'string' && data.apiKey.length > 0;
      
      case 'oauth2':
        return typeof data.accessToken === 'string' && data.accessToken.length > 0;
      
      case 'jwt':
        return typeof data.token === 'string' && 
               data.token.split('.').length === 3; // Basic JWT format check
      
      default:
        return false;
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    // Clear all refresh timers
    for (const timerId of this.refreshIntervals.values()) {
      clearTimeout(timerId);
    }
    this.refreshIntervals.clear();
    
    // Clear sensitive data
    this.credentials.clear();
    this.tokens.clear();
    
    if (this.masterKey) {
      this.masterKey.fill(0); // Zero out master key
      this.masterKey = null;
    }
    
    this.removeAllListeners();
  }
}

export default RegistryAuth;