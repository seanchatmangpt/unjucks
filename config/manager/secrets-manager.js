import { readFileSync } from 'fs';
import { resolve } from 'path';
import consola from 'consola';

/**
 * Enterprise Secrets Management
 * Supports multiple secret providers: Environment, Vault, AWS Secrets Manager, Azure Key Vault
 */
export class SecretsManager {
  constructor(config = {}) {
    this.config = {
      provider: 'env',
      caching: {
        enabled: true,
        ttl: 900 // 15 minutes
      },
      ...config
    };
    
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    this.logger = consola.withTag('secrets-manager');
    
    // Initialize provider-specific clients
    this.providers = {
      env: new EnvironmentSecretsProvider(),
      vault: new VaultSecretsProvider(config.vault),
      'aws-secrets-manager': new AWSSecretsProvider(config.aws),
      'azure-key-vault': new AzureKeyVaultProvider(config.azure)
    };
  }
  
  /**
   * Initialize secrets manager
   */
  async initialize() {
    try {
      const provider = this.providers[this.config.provider];
      if (!provider) {
        throw new Error(`Unknown secrets provider: ${this.config.provider}`);
      }
      
      await provider.initialize();
      this.logger.success(`Secrets manager initialized with provider: ${this.config.provider}`);
      
    } catch (error) {
      this.logger.error('Failed to initialize secrets manager:', error);
      throw error;
    }
  }
  
  /**
   * Get a secret value
   */
  async getSecret(secretName, options = {}) {
    try {
      // Check cache first
      if (this.config.caching.enabled && !options.skipCache) {
        const cached = this.getCachedSecret(secretName);
        if (cached) {
          return cached;
        }
      }
      
      // Get from provider
      const provider = this.providers[this.config.provider];
      const secret = await provider.getSecret(secretName, options);
      
      // Cache the secret
      if (this.config.caching.enabled && secret) {
        this.cacheSecret(secretName, secret);
      }
      
      return secret;
      
    } catch (error) {
      this.logger.error(`Failed to get secret '${secretName}':`, error.message);
      
      // Fallback to environment variable
      if (this.config.provider !== 'env') {
        this.logger.warn(`Falling back to environment variable for secret '${secretName}'`);
        return process.env[secretName];
      }
      
      throw error;
    }
  }
  
  /**
   * Get multiple secrets at once
   */
  async getSecrets(secretNames, options = {}) {
    const results = {};
    const promises = secretNames.map(async (name) => {
      try {
        results[name] = await this.getSecret(name, options);
      } catch (error) {
        this.logger.warn(`Failed to get secret '${name}':`, error.message);
        results[name] = null;
      }
    });
    
    await Promise.all(promises);
    return results;
  }
  
  /**
   * Set a secret (for supported providers)
   */
  async setSecret(secretName, secretValue, options = {}) {
    const provider = this.providers[this.config.provider];
    
    if (!provider.setSecret) {
      throw new Error(`Provider '${this.config.provider}' does not support setting secrets`);
    }
    
    await provider.setSecret(secretName, secretValue, options);
    
    // Invalidate cache
    this.cache.delete(secretName);
    this.cacheTimestamps.delete(secretName);
  }
  
  /**
   * Delete a secret (for supported providers)
   */
  async deleteSecret(secretName, options = {}) {
    const provider = this.providers[this.config.provider];
    
    if (!provider.deleteSecret) {
      throw new Error(`Provider '${this.config.provider}' does not support deleting secrets`);
    }
    
    await provider.deleteSecret(secretName, options);
    
    // Remove from cache
    this.cache.delete(secretName);
    this.cacheTimestamps.delete(secretName);
  }
  
  /**
   * Get cached secret if still valid
   */
  getCachedSecret(secretName) {
    if (!this.cache.has(secretName)) {
      return null;
    }
    
    const timestamp = this.cacheTimestamps.get(secretName);
    const now = this.getDeterministicTimestamp();
    const ttlMs = this.config.caching.ttl * 1000;
    
    if (now - timestamp > ttlMs) {
      // Cache expired
      this.cache.delete(secretName);
      this.cacheTimestamps.delete(secretName);
      return null;
    }
    
    return this.cache.get(secretName);
  }
  
  /**
   * Cache a secret value
   */
  cacheSecret(secretName, secretValue) {
    this.cache.set(secretName, secretValue);
    this.cacheTimestamps.set(secretName, this.getDeterministicTimestamp());
  }
  
  /**
   * Clear all cached secrets
   */
  clearCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
    this.logger.info('Secrets cache cleared');
  }
  
  /**
   * Health check for secrets manager
   */
  async healthCheck() {
    try {
      const provider = this.providers[this.config.provider];
      const providerHealth = await provider.healthCheck();
      
      return {
        status: 'healthy',
        provider: this.config.provider,
        cacheSize: this.cache.size,
        ...providerHealth
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: this.config.provider,
        error: error.message
      };
    }
  }
  
  /**
   * Cleanup resources
   */
  destroy() {
    this.clearCache();
    
    // Cleanup providers
    for (const provider of Object.values(this.providers)) {
      if (provider.destroy) {
        provider.destroy();
      }
    }
  }
}

/**
 * Environment Variables Secrets Provider
 */
class EnvironmentSecretsProvider {
  async initialize() {
    // No initialization needed
  }
  
  async getSecret(secretName) {
    return process.env[secretName] || null;
  }
  
  async healthCheck() {
    return {
      provider: 'environment',
      status: 'healthy'
    };
  }
}

/**
 * HashiCorp Vault Secrets Provider
 */
class VaultSecretsProvider {
  constructor(config = {}) {
    this.config = {
      endpoint: process.env.VAULT_ADDR || 'http://localhost:8200',
      token: process.env.VAULT_TOKEN,
      roleId: process.env.VAULT_ROLE_ID,
      secretId: process.env.VAULT_SECRET_ID,
      mount: 'secret',
      version: 'v2',
      timeout: 5000,
      ...config
    };
    
    this.client = null;
    this.logger = consola.withTag('vault-provider');
  }
  
  async initialize() {
    try {
      // Lazy load vault client to avoid dependency issues
      const { default: vault } = await import('node-vault');
      
      this.client = vault({
        endpoint: this.config.endpoint,
        token: this.config.token,
        timeout: this.config.timeout
      });
      
      // Authenticate if using AppRole
      if (this.config.roleId && this.config.secretId) {
        await this.authenticateWithAppRole();
      }
      
      // Test connection
      await this.client.status();
      this.logger.success('Vault client initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Vault client:', error.message);
      throw error;
    }
  }
  
  async authenticateWithAppRole() {
    try {
      const result = await this.client.approleLogin({
        role_id: this.config.roleId,
        secret_id: this.config.secretId
      });
      
      this.client.token = result.auth.client_token;
      this.logger.info('Authenticated with Vault using AppRole');
      
    } catch (error) {
      this.logger.error('Failed to authenticate with Vault AppRole:', error.message);
      throw error;
    }
  }
  
  async getSecret(secretName, options = {}) {
    if (!this.client) {
      throw new Error('Vault client not initialized');
    }
    
    try {
      const path = options.path || `${this.config.mount}/data/${secretName}`;
      
      let result;
      if (this.config.version === 'v2') {
        result = await this.client.read(path);
        return result.data?.data?.[secretName] || result.data?.data;
      } else {
        result = await this.client.read(`${this.config.mount}/${secretName}`);
        return result.data?.[secretName] || result.data;
      }
      
    } catch (error) {
      if (error.response?.statusCode === 404) {
        return null; // Secret not found
      }
      throw error;
    }
  }
  
  async setSecret(secretName, secretValue, options = {}) {
    if (!this.client) {
      throw new Error('Vault client not initialized');
    }
    
    const path = options.path || `${this.config.mount}/data/${secretName}`;
    
    if (this.config.version === 'v2') {
      await this.client.write(path, {
        data: { [secretName]: secretValue }
      });
    } else {
      await this.client.write(`${this.config.mount}/${secretName}`, {
        [secretName]: secretValue
      });
    }
  }
  
  async deleteSecret(secretName, options = {}) {
    if (!this.client) {
      throw new Error('Vault client not initialized');
    }
    
    const path = options.path || `${this.config.mount}/data/${secretName}`;
    
    if (this.config.version === 'v2') {
      await this.client.delete(path);
    } else {
      await this.client.delete(`${this.config.mount}/${secretName}`);
    }
  }
  
  async healthCheck() {
    try {
      if (!this.client) {
        throw new Error('Vault client not initialized');
      }
      
      const status = await this.client.status();
      
      return {
        provider: 'vault',
        status: status.sealed ? 'sealed' : 'healthy',
        endpoint: this.config.endpoint,
        version: status.version
      };
      
    } catch (error) {
      return {
        provider: 'vault',
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

/**
 * AWS Secrets Manager Provider
 */
class AWSSecretsProvider {
  constructor(config = {}) {
    this.config = {
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      roleArn: process.env.AWS_ROLE_ARN,
      ...config
    };
    
    this.client = null;
    this.logger = consola.withTag('aws-secrets-provider');
  }
  
  async initialize() {
    try {
      // Lazy load AWS SDK to avoid dependency issues
      const { SecretsManagerClient } = await import('@aws-sdk/client-secrets-manager');
      
      const clientConfig = {
        region: this.config.region
      };
      
      if (this.config.accessKeyId && this.config.secretAccessKey) {
        clientConfig.credentials = {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey
        };
      }
      
      this.client = new SecretsManagerClient(clientConfig);
      this.logger.success('AWS Secrets Manager client initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize AWS Secrets Manager client:', error.message);
      throw error;
    }
  }
  
  async getSecret(secretName, options = {}) {
    if (!this.client) {
      throw new Error('AWS Secrets Manager client not initialized');
    }
    
    try {
      const { GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
      
      const command = new GetSecretValueCommand({
        SecretId: secretName,
        VersionStage: options.versionStage || 'AWSCURRENT'
      });
      
      const result = await this.client.send(command);
      
      // Handle both string and JSON secrets
      if (result.SecretString) {
        try {
          const parsed = JSON.parse(result.SecretString);
          return parsed[secretName] || parsed;
        } catch {
          return result.SecretString;
        }
      }
      
      if (result.SecretBinary) {
        return Buffer.from(result.SecretBinary).toString('utf8');
      }
      
      return null;
      
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        return null; // Secret not found
      }
      throw error;
    }
  }
  
  async setSecret(secretName, secretValue, options = {}) {
    if (!this.client) {
      throw new Error('AWS Secrets Manager client not initialized');
    }
    
    const { CreateSecretCommand, UpdateSecretCommand } = await import('@aws-sdk/client-secrets-manager');
    
    try {
      // Try to update first
      const updateCommand = new UpdateSecretCommand({
        SecretId: secretName,
        SecretString: typeof secretValue === 'string' ? secretValue : JSON.stringify(secretValue)
      });
      
      await this.client.send(updateCommand);
      
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        // Secret doesn't exist, create it
        const createCommand = new CreateSecretCommand({
          Name: secretName,
          SecretString: typeof secretValue === 'string' ? secretValue : JSON.stringify(secretValue),
          Description: options.description || `Secret created by Unjucks`
        });
        
        await this.client.send(createCommand);
      } else {
        throw error;
      }
    }
  }
  
  async deleteSecret(secretName, options = {}) {
    if (!this.client) {
      throw new Error('AWS Secrets Manager client not initialized');
    }
    
    const { DeleteSecretCommand } = await import('@aws-sdk/client-secrets-manager');
    
    const command = new DeleteSecretCommand({
      SecretId: secretName,
      ForceDeleteWithoutRecovery: options.force || false,
      RecoveryWindowInDays: options.recoveryDays || 30
    });
    
    await this.client.send(command);
  }
  
  async healthCheck() {
    try {
      if (!this.client) {
        throw new Error('AWS Secrets Manager client not initialized');
      }
      
      const { ListSecretsCommand } = await import('@aws-sdk/client-secrets-manager');
      const command = new ListSecretsCommand({ MaxResults: 1 });
      await this.client.send(command);
      
      return {
        provider: 'aws-secrets-manager',
        status: 'healthy',
        region: this.config.region
      };
      
    } catch (error) {
      return {
        provider: 'aws-secrets-manager',
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

/**
 * Azure Key Vault Provider
 */
class AzureKeyVaultProvider {
  constructor(config = {}) {
    this.config = {
      vaultUrl: process.env.AZURE_KEY_VAULT_URL,
      clientId: process.env.AZURE_CLIENT_ID,
      clientSecret: process.env.AZURE_CLIENT_SECRET,
      tenantId: process.env.AZURE_TENANT_ID,
      ...config
    };
    
    this.client = null;
    this.logger = consola.withTag('azure-keyvault-provider');
  }
  
  async initialize() {
    try {
      // Lazy load Azure SDK to avoid dependency issues
      const { SecretClient } = await import('@azure/keyvault-secrets');
      const { DefaultAzureCredential, ClientSecretCredential } = await import('@azure/identity');
      
      let credential;
      if (this.config.clientId && this.config.clientSecret && this.config.tenantId) {
        credential = new ClientSecretCredential(
          this.config.tenantId,
          this.config.clientId,
          this.config.clientSecret
        );
      } else {
        credential = new DefaultAzureCredential();
      }
      
      this.client = new SecretClient(this.config.vaultUrl, credential);
      this.logger.success('Azure Key Vault client initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize Azure Key Vault client:', error.message);
      throw error;
    }
  }
  
  async getSecret(secretName, options = {}) {
    if (!this.client) {
      throw new Error('Azure Key Vault client not initialized');
    }
    
    try {
      const secret = await this.client.getSecret(secretName, options);
      return secret.value;
      
    } catch (error) {
      if (error.statusCode === 404) {
        return null; // Secret not found
      }
      throw error;
    }
  }
  
  async setSecret(secretName, secretValue, options = {}) {
    if (!this.client) {
      throw new Error('Azure Key Vault client not initialized');
    }
    
    await this.client.setSecret(secretName, secretValue, options);
  }
  
  async deleteSecret(secretName, options = {}) {
    if (!this.client) {
      throw new Error('Azure Key Vault client not initialized');
    }
    
    const poller = await this.client.beginDeleteSecret(secretName);
    
    if (options.wait) {
      await poller.pollUntilDone();
    }
  }
  
  async healthCheck() {
    try {
      if (!this.client) {
        throw new Error('Azure Key Vault client not initialized');
      }
      
      // Try to list secrets (with limit 1) to test connectivity
      const secretsIter = this.client.listPropertiesOfSecrets();
      await secretsIter.next();
      
      return {
        provider: 'azure-key-vault',
        status: 'healthy',
        vaultUrl: this.config.vaultUrl
      };
      
    } catch (error) {
      return {
        provider: 'azure-key-vault',
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

export default SecretsManager;