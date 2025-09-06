/**
 * HashiCorp Vault Integration for Secrets Management
 * Provides secure storage and management of sensitive data
 */

import { VaultConfig, SecurityEvent, SecurityEventType, SecuritySeverity } from '../types'

export class SecretsManager {
  private vaultToken: string | null = null
  private secretsCache = new Map<string, CachedSecret>()
  private rotationJobs = new Map<string, NodeJS.Timeout>()

  constructor(private config: VaultConfig) {}

  async initialize(): Promise<void> {
    if (!this.config.enabled) return

    try {
      await this.authenticate()
      await this.loadCriticalSecrets()
      
      if (this.config.keyRotation.enabled) {
        this.startAutomaticRotation()
      }
    } catch (error) {
      throw new Error(`Failed to initialize Vault secrets manager: ${error.message}`)
    }
  }

  /**
   * Authenticate with Vault using AppRole
   */
  private async authenticate(): Promise<void> {
    if (!this.config.roleId || !this.config.secretId) {
      throw new Error('Vault AppRole credentials not configured')
    }

    try {
      const response = await this.vaultRequest('/v1/auth/approle/login', 'POST', {
        role_id: this.config.roleId,
        secret_id: this.config.secretId
      })

      this.vaultToken = response.auth.client_token

      // Set up token renewal
      this.scheduleTokenRenewal(response.auth.lease_duration)
    } catch (error) {
      throw new Error(`Vault authentication failed: ${error.message}`)
    }
  }

  /**
   * Get secret from Vault
   */
  async getSecret(path: string, useCache: boolean = true): Promise<any> {
    if (!this.config.enabled) {
      return process.env[path.replace('/', '_').toUpperCase()]
    }

    // Check cache first
    if (useCache && this.secretsCache.has(path)) {
      const cached = this.secretsCache.get(path)!
      if (cached.expiresAt > new Date()) {
        return cached.value
      }
    }

    try {
      const fullPath = `/${this.config.mountPath}/${path}`
      const response = await this.vaultRequest(`/v1${fullPath}`, 'GET')
      
      const secret = response.data?.data || response.data
      
      // Cache secret with TTL
      this.secretsCache.set(path, {
        value: secret,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        createdAt: new Date()
      })

      return secret
    } catch (error) {
      await this.logSecurityEvent({
        type: SecurityEventType.AUTHENTICATION_FAILURE,
        severity: SecuritySeverity.HIGH,
        source: 'vault',
        description: `Failed to retrieve secret: ${path}`,
        metadata: { path, error: error.message }
      })
      throw error
    }
  }

  /**
   * Store secret in Vault
   */
  async setSecret(path: string, secret: any): Promise<void> {
    if (!this.config.enabled) {
      console.warn(`Vault disabled - cannot store secret at ${path}`)
      return
    }

    try {
      const fullPath = `/${this.config.mountPath}/${path}`
      await this.vaultRequest(`/v1${fullPath}`, 'POST', {
        data: secret
      })

      // Update cache
      this.secretsCache.set(path, {
        value: secret,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        createdAt: new Date()
      })

      await this.logSecurityEvent({
        type: SecurityEventType.CONFIGURATION_CHANGE,
        severity: SecuritySeverity.MEDIUM,
        source: 'vault',
        description: `Secret updated: ${path}`,
        metadata: { path }
      })
    } catch (error) {
      throw new Error(`Failed to store secret: ${error.message}`)
    }
  }

  /**
   * Delete secret from Vault
   */
  async deleteSecret(path: string): Promise<void> {
    if (!this.config.enabled) return

    try {
      const fullPath = `/${this.config.mountPath}/${path}`
      await this.vaultRequest(`/v1${fullPath}`, 'DELETE')

      // Remove from cache
      this.secretsCache.delete(path)

      await this.logSecurityEvent({
        type: SecurityEventType.CONFIGURATION_CHANGE,
        severity: SecuritySeverity.HIGH,
        source: 'vault',
        description: `Secret deleted: ${path}`,
        metadata: { path }
      })
    } catch (error) {
      throw new Error(`Failed to delete secret: ${error.message}`)
    }
  }

  /**
   * Generate dynamic secret (e.g., database credentials)
   */
  async generateDynamicSecret(engine: string, role: string): Promise<DynamicSecret> {
    if (!this.config.enabled) {
      throw new Error('Vault not enabled for dynamic secrets')
    }

    try {
      const response = await this.vaultRequest(`/v1/${engine}/creds/${role}`, 'GET')
      
      const dynamicSecret: DynamicSecret = {
        data: response.data,
        leaseId: response.lease_id,
        leaseDuration: response.lease_duration,
        renewable: response.renewable,
        createdAt: new Date()
      }

      // Schedule renewal if renewable
      if (dynamicSecret.renewable) {
        this.scheduleSecretRenewal(dynamicSecret)
      }

      return dynamicSecret
    } catch (error) {
      throw new Error(`Failed to generate dynamic secret: ${error.message}`)
    }
  }

  /**
   * Revoke dynamic secret
   */
  async revokeDynamicSecret(leaseId: string): Promise<void> {
    if (!this.config.enabled) return

    try {
      await this.vaultRequest('/v1/sys/leases/revoke', 'PUT', {
        lease_id: leaseId
      })
    } catch (error) {
      throw new Error(`Failed to revoke dynamic secret: ${error.message}`)
    }
  }

  /**
   * Rotate secret
   */
  async rotateSecret(path: string): Promise<void> {
    if (!this.config.enabled) return

    try {
      // Generate new secret value
      const newSecret = await this.generateNewSecretValue(path)
      
      // Store new secret
      await this.setSecret(path, newSecret)
      
      await this.logSecurityEvent({
        type: SecurityEventType.CONFIGURATION_CHANGE,
        severity: SecuritySeverity.MEDIUM,
        source: 'vault-rotation',
        description: `Secret rotated: ${path}`,
        metadata: { path }
      })
    } catch (error) {
      await this.logSecurityEvent({
        type: SecurityEventType.AUTHENTICATION_FAILURE,
        severity: SecuritySeverity.HIGH,
        source: 'vault-rotation',
        description: `Failed to rotate secret: ${path}`,
        metadata: { path, error: error.message }
      })
      throw error
    }
  }

  /**
   * List all secrets in a path
   */
  async listSecrets(path: string): Promise<string[]> {
    if (!this.config.enabled) return []

    try {
      const fullPath = `/${this.config.mountPath}/${path}`
      const response = await this.vaultRequest(`/v1${fullPath}?list=true`, 'GET')
      
      return response.data.keys || []
    } catch (error) {
      throw new Error(`Failed to list secrets: ${error.message}`)
    }
  }

  /**
   * Get secret metadata
   */
  async getSecretMetadata(path: string): Promise<SecretMetadata> {
    if (!this.config.enabled) {
      return {
        path,
        createdTime: new Date(),
        versions: 1,
        currentVersion: 1
      }
    }

    try {
      const fullPath = `/${this.config.mountPath}/metadata/${path}`
      const response = await this.vaultRequest(`/v1${fullPath}`, 'GET')
      
      return {
        path,
        createdTime: new Date(response.data.created_time),
        versions: Object.keys(response.data.versions).length,
        currentVersion: response.data.current_version,
        maxVersions: response.data.max_versions,
        deleteVersionAfter: response.data.delete_version_after
      }
    } catch (error) {
      throw new Error(`Failed to get secret metadata: ${error.message}`)
    }
  }

  /**
   * Make request to Vault API
   */
  private async vaultRequest(path: string, method: string, body?: any): Promise<any> {
    const url = `${this.config.url}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (this.vaultToken) {
      headers['X-Vault-Token'] = this.vaultToken
    }

    if (this.config.namespace) {
      headers['X-Vault-Namespace'] = this.config.namespace
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    })

    if (!response.ok) {
      throw new Error(`Vault API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Load critical secrets at startup
   */
  private async loadCriticalSecrets(): Promise<void> {
    const criticalPaths = [
      'database/credentials',
      'api-keys/external-services',
      'certificates/tls'
    ]

    for (const path of criticalPaths) {
      try {
        await this.getSecret(path)
      } catch (error) {
        console.warn(`Failed to load critical secret ${path}: ${error.message}`)
      }
    }
  }

  /**
   * Start automatic secret rotation
   */
  private startAutomaticRotation(): void {
    const rotationPaths = [
      'api-keys/external-services',
      'database/credentials'
    ]

    for (const path of rotationPaths) {
      const job = setInterval(async () => {
        try {
          await this.rotateSecret(path)
        } catch (error) {
          console.error(`Automatic rotation failed for ${path}:`, error.message)
        }
      }, this.config.keyRotation.interval * 1000)

      this.rotationJobs.set(path, job)
    }
  }

  /**
   * Generate new secret value
   */
  private async generateNewSecretValue(path: string): Promise<any> {
    // Generate appropriate secret based on path
    if (path.includes('api-key')) {
      return {
        key: this.generateRandomKey(32),
        created_at: new Date().toISOString()
      }
    } else if (path.includes('password')) {
      return {
        password: this.generateSecurePassword(),
        created_at: new Date().toISOString()
      }
    }

    return {
      value: this.generateRandomKey(32),
      created_at: new Date().toISOString()
    }
  }

  /**
   * Generate random key
   */
  private generateRandomKey(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    
    return result
  }

  /**
   * Generate secure password
   */
  private generateSecurePassword(): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?'
    
    const all = uppercase + lowercase + numbers + symbols
    let password = ''
    
    // Ensure at least one character from each set
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
    password += lowercase[Math.floor(Math.random() * lowercase.length)]
    password += numbers[Math.floor(Math.random() * numbers.length)]
    password += symbols[Math.floor(Math.random() * symbols.length)]
    
    // Fill remaining length
    for (let i = 4; i < 16; i++) {
      password += all[Math.floor(Math.random() * all.length)]
    }
    
    // Shuffle password
    return password.split('').sort(() => Math.random() - 0.5).join('')
  }

  /**
   * Schedule token renewal
   */
  private scheduleTokenRenewal(duration: number): void {
    // Renew at 80% of lease duration
    const renewTime = duration * 0.8 * 1000
    
    setTimeout(async () => {
      try {
        await this.renewToken()
      } catch (error) {
        console.error('Token renewal failed:', error.message)
        // Attempt re-authentication
        await this.authenticate()
      }
    }, renewTime)
  }

  /**
   * Renew Vault token
   */
  private async renewToken(): Promise<void> {
    await this.vaultRequest('/v1/auth/token/renew-self', 'POST')
  }

  /**
   * Schedule secret renewal
   */
  private scheduleSecretRenewal(secret: DynamicSecret): void {
    const renewTime = secret.leaseDuration * 0.8 * 1000
    
    setTimeout(async () => {
      try {
        await this.vaultRequest('/v1/sys/leases/renew', 'PUT', {
          lease_id: secret.leaseId,
          increment: secret.leaseDuration
        })
      } catch (error) {
        console.error('Secret renewal failed:', error.message)
      }
    }, renewTime)
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    // Implementation would send to centralized logging
    console.warn(`Vault Security Event: ${event.type} - ${event.description}`)
  }

  /**
   * Get Vault health status
   */
  async getHealth(): Promise<any> {
    if (!this.config.enabled) {
      return { enabled: false }
    }

    try {
      const health = await this.vaultRequest('/v1/sys/health', 'GET')
      
      return {
        enabled: true,
        initialized: health.initialized,
        sealed: health.sealed,
        standby: health.standby,
        version: health.version,
        cachedSecrets: this.secretsCache.size,
        rotationJobs: this.rotationJobs.size
      }
    } catch (error) {
      return {
        enabled: true,
        error: error.message,
        cachedSecrets: this.secretsCache.size
      }
    }
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    // Clear rotation jobs
    this.rotationJobs.forEach(job => clearInterval(job))
    this.rotationJobs.clear()

    // Clear secrets cache
    this.secretsCache.clear()

    // Revoke token
    if (this.vaultToken && this.config.enabled) {
      try {
        await this.vaultRequest('/v1/auth/token/revoke-self', 'POST')
      } catch (error) {
        console.warn('Failed to revoke Vault token:', error.message)
      }
    }

    this.vaultToken = null
  }
}

interface CachedSecret {
  value: any
  expiresAt: Date
  createdAt: Date
}

interface DynamicSecret {
  data: any
  leaseId: string
  leaseDuration: number
  renewable: boolean
  createdAt: Date
}

interface SecretMetadata {
  path: string
  createdTime: Date
  versions: number
  currentVersion: number
  maxVersions?: number
  deleteVersionAfter?: string
}