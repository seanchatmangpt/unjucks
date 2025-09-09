/**
 * HashiCorp Vault Integration for Secrets Management
 * Handles secret storage, retrieval, and rotation
 */

const crypto = require('crypto');
const axios = require('axios');

class VaultManager {
  constructor(config = {}) {
    this.config = {
      endpoint: config.endpoint || process.env.VAULT_ENDPOINT || 'http://localhost:8200',
      token: config.token || process.env.VAULT_TOKEN,
      namespace: config.namespace || process.env.VAULT_NAMESPACE,
      transitEngine: config.transitEngine || 'transit',
      kvEngine: config.kvEngine || 'kv',
      authMethod: config.authMethod || 'token',
      tokenTTL: config.tokenTTL || 3600, // 1 hour
      renewThreshold: config.renewThreshold || 300, // 5 minutes
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000
    };

    this.client = axios.create({
      baseURL: this.config.endpoint,
      timeout: 30000,
      headers: {
        'X-Vault-Token': this.config.token,
        'X-Vault-Namespace': this.config.namespace,
        'Content-Type': 'application/json'
      }
    });

    this.tokenRenewalTimer = null;
    this.isAuthenticated = false;
  }

  // Initialize Vault connection and authentication
  async initialize() {
    try {
      await this.authenticate();
      await this.setupTokenRenewal();
      await this.validateEngines();
      
      console.log('Vault Manager initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Vault Manager:', error.message);
      throw error;
    }
  }

  // Authenticate with Vault
  async authenticate() {
    switch (this.config.authMethod) {
      case 'token':
        return this.authenticateWithToken();
      case 'kubernetes':
        return this.authenticateWithK8s();
      case 'aws':
        return this.authenticateWithAWS();
      case 'azure':
        return this.authenticateWithAzure();
      default:
        throw new Error(`Unsupported auth method: ${this.config.authMethod}`);
    }
  }

  async authenticateWithToken() {
    try {
      const response = await this.client.get('/v1/auth/token/lookup-self');
      this.isAuthenticated = true;
      return response.data;
    } catch (error) {
      throw new Error(`Token authentication failed: ${error.message}`);
    }
  }

  async authenticateWithK8s() {
    try {
      const jwt = require('fs').readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8');
      const role = process.env.VAULT_K8S_ROLE || 'unjucks-app';

      const response = await this.client.post('/v1/auth/kubernetes/login', {
        jwt: jwt,
        role: role
      });

      this.client.defaults.headers['X-Vault-Token'] = response.data.auth.client_token;
      this.isAuthenticated = true;
      return response.data;
    } catch (error) {
      throw new Error(`Kubernetes authentication failed: ${error.message}`);
    }
  }

  // Setup automatic token renewal
  async setupTokenRenewal() {
    if (this.config.authMethod === 'token') {
      this.tokenRenewalTimer = setInterval(async () => {
        try {
          await this.renewToken();
        } catch (error) {
          console.error('Token renewal failed:', error.message);
        }
      }, (this.config.tokenTTL - this.config.renewThreshold) * 1000);
    }
  }

  async renewToken() {
    try {
      const response = await this.client.post('/v1/auth/token/renew-self');
      console.log('Token renewed successfully');
      return response.data;
    } catch (error) {
      console.error('Token renewal failed:', error.message);
      throw error;
    }
  }

  // Validate required engines are enabled
  async validateEngines() {
    try {
      const response = await this.client.get('/v1/sys/mounts');
      const mounts = response.data;

      const requiredEngines = [
        `${this.config.kvEngine}/`,
        `${this.config.transitEngine}/`
      ];

      for (const engine of requiredEngines) {
        if (!mounts[engine]) {
          throw new Error(`Required engine ${engine} is not mounted`);
        }
      }

      return true;
    } catch (error) {
      throw new Error(`Engine validation failed: ${error.message}`);
    }
  }

  // KV Operations
  async storeSecret(path, data, version = null) {
    try {
      const endpoint = version ? 
        `/v1/${this.config.kvEngine}/data/${path}` :
        `/v1/${this.config.kvEngine}/${path}`;

      const payload = version ? { data } : data;

      const response = await this.client.post(endpoint, payload);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to store secret at ${path}: ${error.message}`);
    }
  }

  async getSecret(path, version = null) {
    try {
      const endpoint = version ? 
        `/v1/${this.config.kvEngine}/data/${path}${version ? `?version=${version}` : ''}` :
        `/v1/${this.config.kvEngine}/${path}`;

      const response = await this.client.get(endpoint);
      return version ? response.data.data.data : response.data.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new Error(`Failed to retrieve secret from ${path}: ${error.message}`);
    }
  }

  async deleteSecret(path) {
    try {
      await this.client.delete(`/v1/${this.config.kvEngine}/data/${path}`);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete secret at ${path}: ${error.message}`);
    }
  }

  async listSecrets(path = '') {
    try {
      const response = await this.client.get(`/v1/${this.config.kvEngine}/metadata/${path}?list=true`);
      return response.data.data.keys;
    } catch (error) {
      throw new Error(`Failed to list secrets at ${path}: ${error.message}`);
    }
  }

  // Transit Engine Operations (Encryption as a Service)
  async createEncryptionKey(keyName, keyType = 'aes256-gcm96') {
    try {
      await this.client.post(`/v1/${this.config.transitEngine}/keys/${keyName}`, {
        type: keyType,
        exportable: false,
        allow_plaintext_backup: false
      });
      return true;
    } catch (error) {
      throw new Error(`Failed to create encryption key ${keyName}: ${error.message}`);
    }
  }

  async encrypt(keyName, plaintext, context = null) {
    try {
      const payload = {
        plaintext: Buffer.from(plaintext).toString('base64')
      };

      if (context) {
        payload.context = Buffer.from(context).toString('base64');
      }

      const response = await this.client.post(`/v1/${this.config.transitEngine}/encrypt/${keyName}`, payload);
      return response.data.data.ciphertext;
    } catch (error) {
      throw new Error(`Encryption failed for key ${keyName}: ${error.message}`);
    }
  }

  async decrypt(keyName, ciphertext, context = null) {
    try {
      const payload = { ciphertext };

      if (context) {
        payload.context = Buffer.from(context).toString('base64');
      }

      const response = await this.client.post(`/v1/${this.config.transitEngine}/decrypt/${keyName}`, payload);
      return Buffer.from(response.data.data.plaintext, 'base64').toString();
    } catch (error) {
      throw new Error(`Decryption failed for key ${keyName}: ${error.message}`);
    }
  }

  async rotateKey(keyName) {
    try {
      await this.client.post(`/v1/${this.config.transitEngine}/keys/${keyName}/rotate`);
      return true;
    } catch (error) {
      throw new Error(`Key rotation failed for ${keyName}: ${error.message}`);
    }
  }

  // Database Credentials Management
  async getDatabaseCredentials(dbName) {
    try {
      const response = await this.client.get(`/v1/database/creds/${dbName}`);
      return {
        username: response.data.data.username,
        password: response.data.data.password,
        leaseId: response.data.lease_id,
        leaseDuration: response.data.lease_duration
      };
    } catch (error) {
      throw new Error(`Failed to get database credentials for ${dbName}: ${error.message}`);
    }
  }

  async renewDatabaseCredentials(leaseId) {
    try {
      const response = await this.client.post('/v1/sys/leases/renew', {
        lease_id: leaseId
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to renew database credentials: ${error.message}`);
    }
  }

  async revokeDatabaseCredentials(leaseId) {
    try {
      await this.client.post('/v1/sys/leases/revoke', {
        lease_id: leaseId
      });
      return true;
    } catch (error) {
      throw new Error(`Failed to revoke database credentials: ${error.message}`);
    }
  }

  // Secret Rotation Management
  async setupSecretRotation(secretPath, rotationConfig) {
    const {
      interval = 86400, // 24 hours
      maxVersions = 5,
      deleteVersionAfter = 2592000 // 30 days
    } = rotationConfig;

    // Store rotation configuration
    await this.storeSecret(`${secretPath}/rotation-config`, {
      interval,
      maxVersions,
      deleteVersionAfter,
      lastRotation: Date.now()
    });

    // Schedule rotation
    setInterval(async () => {
      try {
        await this.rotateSecret(secretPath);
      } catch (error) {
        console.error(`Secret rotation failed for ${secretPath}:`, error.message);
      }
    }, interval * 1000);
  }

  async rotateSecret(secretPath) {
    try {
      // Get current secret
      const currentSecret = await this.getSecret(secretPath);
      if (!currentSecret) {
        throw new Error('Secret not found');
      }

      // Generate new secret value
      const newSecret = this.generateSecretValue(currentSecret);

      // Store new version
      await this.storeSecret(secretPath, newSecret);

      // Update rotation timestamp
      await this.storeSecret(`${secretPath}/rotation-config`, {
        ...await this.getSecret(`${secretPath}/rotation-config`),
        lastRotation: Date.now()
      });

      console.log(`Secret rotated successfully: ${secretPath}`);
      return newSecret;
    } catch (error) {
      throw new Error(`Secret rotation failed for ${secretPath}: ${error.message}`);
    }
  }

  generateSecretValue(currentSecret) {
    // Generate new random values based on secret type
    const newSecret = { ...currentSecret };

    for (const [key, value] of Object.entries(newSecret)) {
      if (key.includes('password') || key.includes('secret') || key.includes('key')) {
        newSecret[key] = crypto.randomBytes(32).toString('hex');
      } else if (key.includes('token')) {
        newSecret[key] = crypto.randomBytes(64).toString('base64url');
      }
    }

    return newSecret;
  }

  // Secrets Health Check
  async healthCheck() {
    try {
      const health = {
        vault: false,
        engines: {},
        authentication: false,
        timestamp: new Date().toISOString()
      };

      // Check Vault status
      const statusResponse = await this.client.get('/v1/sys/health');
      health.vault = statusResponse.status === 200;

      // Check authentication
      try {
        await this.client.get('/v1/auth/token/lookup-self');
        health.authentication = true;
      } catch (error) {
        health.authentication = false;
      }

      // Check engines
      const mounts = await this.client.get('/v1/sys/mounts');
      health.engines.kv = !!mounts.data[`${this.config.kvEngine}/`];
      health.engines.transit = !!mounts.data[`${this.config.transitEngine}/`];

      return health;
    } catch (error) {
      return {
        vault: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Cleanup and shutdown
  async shutdown() {
    if (this.tokenRenewalTimer) {
      clearInterval(this.tokenRenewalTimer);
    }

    try {
      if (this.config.authMethod !== 'token') {
        await this.client.post('/v1/auth/token/revoke-self');
      }
    } catch (error) {
      console.error('Error during shutdown:', error.message);
    }

    console.log('Vault Manager shutdown complete');
  }

  // Utility method for retrying operations
  async withRetry(operation, maxAttempts = this.config.retryAttempts) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxAttempts) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}

module.exports = VaultManager;