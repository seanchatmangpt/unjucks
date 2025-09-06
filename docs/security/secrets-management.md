# Secrets Management with HashiCorp Vault

## Overview

This guide covers the integration with HashiCorp Vault for enterprise-grade secrets management, including dynamic secrets, automatic rotation, and secure access patterns.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Secrets Management                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Vault     │  │  Dynamic    │  │     Secret          │  │
│  │ Integration │  │  Secrets    │  │   Rotation          │  │
│  │             │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   AppRole   │  │   Lease     │  │     Audit           │  │
│  │    Auth     │  │ Management  │  │    Logging          │  │
│  │             │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Vault Integration Setup

### Configuration

```typescript
import { SecretsManager } from '../src/security/vault/secrets-manager'

const vaultConfig = {
  enabled: true,
  url: 'https://vault.company.com:8200',
  roleId: process.env.VAULT_ROLE_ID,
  secretId: process.env.VAULT_SECRET_ID,
  namespace: 'engineering',
  mountPath: 'secret',
  keyRotation: {
    enabled: true,
    interval: 7 * 24 * 60 * 60 // 7 days
  }
}

const secretsManager = new SecretsManager(vaultConfig)
await secretsManager.initialize()
```

### AppRole Authentication

```typescript
// AppRole setup in Vault
vault auth enable approle

vault write auth/approle/role/unjucks-app \
    token_policies="unjucks-policy" \
    token_ttl=1h \
    token_max_ttl=4h \
    bind_secret_id=true

# Generate role ID and secret ID
vault read auth/approle/role/unjucks-app/role-id
vault write -field=secret_id auth/approle/role/unjucks-app/secret-id
```

### Policy Configuration

```hcl
# unjucks-policy.hcl
path "secret/data/unjucks/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "database/creds/unjucks-readonly" {
  capabilities = ["read"]
}

path "database/creds/unjucks-readwrite" {
  capabilities = ["read"]
}

path "auth/token/renew-self" {
  capabilities = ["update"]
}

path "auth/token/lookup-self" {
  capabilities = ["read"]
}
```

## Secret Storage and Retrieval

### Basic Operations

```typescript
// Store a secret
await secretsManager.setSecret('database/password', {
  username: 'app_user',
  password: 'secure_random_password_123',
  connection_string: 'postgresql://user:pass@localhost:5432/db'
})

// Retrieve a secret
const dbSecret = await secretsManager.getSecret('database/password')
console.log('DB Username:', dbSecret.username)

// List secrets
const secrets = await secretsManager.listSecrets('database/')
console.log('Available secrets:', secrets)

// Delete a secret
await secretsManager.deleteSecret('old-api-key')
```

### Secret Versioning

```typescript
// Vault KV v2 supports versioning
const secret = await secretsManager.getSecret('api-keys/external-service')

// Get specific version
const secretV1 = await secretsManager.getSecret('api-keys/external-service', {
  version: 1
})

// Get metadata
const metadata = await secretsManager.getSecretMetadata('api-keys/external-service')
console.log('Versions:', metadata.versions)
console.log('Current version:', metadata.currentVersion)
```

## Dynamic Secrets

### Database Credentials

```typescript
// Configure database secret engine in Vault
/*
vault secrets enable database

vault write database/config/postgresql \
    plugin_name=postgresql-database-plugin \
    connection_url="postgresql://{{username}}:{{password}}@localhost:5432/myapp?sslmode=disable" \
    allowed_roles="unjucks-readonly,unjucks-readwrite" \
    username="vault" \
    password="vault-password"

vault write database/roles/unjucks-readonly \
    db_name=postgresql \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
    default_ttl="1h" \
    max_ttl="24h"
*/

// Generate dynamic database credentials
const dbCreds = await secretsManager.generateDynamicSecret('database', 'unjucks-readonly')

console.log('Dynamic credentials:', {
  username: dbCreds.data.username,
  password: dbCreds.data.password,
  leaseId: dbCreds.leaseId,
  leaseDuration: dbCreds.leaseDuration
})

// Use credentials to connect to database
const dbConnection = createDatabaseConnection({
  username: dbCreds.data.username,
  password: dbCreds.data.password,
  // ... other connection options
})

// Credentials will automatically expire after lease duration
// Vault will automatically revoke database access
```

### API Key Management

```typescript
// Custom API key generation
class APIKeyManager {
  constructor(private secretsManager: SecretsManager) {}

  async generateAPIKey(service: string, permissions: string[]): Promise<APIKeyResponse> {
    const keyData = {
      key: this.generateSecureKey(),
      service,
      permissions,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    }

    await this.secretsManager.setSecret(`api-keys/${service}`, keyData)

    return {
      apiKey: keyData.key,
      expiresAt: keyData.expiresAt,
      permissions: keyData.permissions
    }
  }

  async validateAPIKey(apiKey: string, service: string): Promise<boolean> {
    try {
      const stored = await this.secretsManager.getSecret(`api-keys/${service}`)
      
      if (stored.key !== apiKey) {
        return false
      }

      const expiresAt = new Date(stored.expiresAt)
      return expiresAt > new Date()
      
    } catch (error) {
      return false
    }
  }

  private generateSecureKey(): string {
    return require('crypto').randomBytes(32).toString('hex')
  }
}

interface APIKeyResponse {
  apiKey: string
  expiresAt: string
  permissions: string[]
}
```

## Automatic Secret Rotation

### Configuration

```typescript
// Rotation policies configuration
const rotationConfig = {
  rotationPolicies: {
    'database/credentials': {
      interval: 24 * 60 * 60, // 24 hours
      strategy: 'blue-green',
      notifyBeforeExpiry: 2 * 60 * 60, // 2 hours
      maxAge: 7 * 24 * 60 * 60 // 7 days maximum
    },
    'api-keys/external-services': {
      interval: 7 * 24 * 60 * 60, // 7 days
      strategy: 'gradual-rollout',
      notifyBeforeExpiry: 24 * 60 * 60, // 24 hours
      maxAge: 30 * 24 * 60 * 60 // 30 days maximum
    }
  }
}
```

### Rotation Implementation

```typescript
class SecretRotationManager {
  constructor(private secretsManager: SecretsManager) {}

  async rotateSecret(path: string, rotationPolicy: RotationPolicy): Promise<RotationResult> {
    console.log(`Starting rotation for secret: ${path}`)

    try {
      // Get current secret
      const currentSecret = await this.secretsManager.getSecret(path)
      
      // Generate new secret
      const newSecret = await this.generateNewSecret(path, currentSecret)
      
      // Implement rotation strategy
      switch (rotationPolicy.strategy) {
        case 'blue-green':
          return await this.blueGreenRotation(path, currentSecret, newSecret)
        
        case 'gradual-rollout':
          return await this.gradualRolloutRotation(path, currentSecret, newSecret)
        
        default:
          return await this.immediateRotation(path, newSecret)
      }

    } catch (error) {
      console.error(`Rotation failed for ${path}:`, error)
      throw error
    }
  }

  private async blueGreenRotation(
    path: string,
    currentSecret: any,
    newSecret: any
  ): Promise<RotationResult> {
    // Store new secret alongside current
    await this.secretsManager.setSecret(`${path}-new`, newSecret)
    
    // Wait for applications to pick up new secret
    await this.waitForApplicationUpdate()
    
    // Replace current secret
    await this.secretsManager.setSecret(path, newSecret)
    
    // Clean up old secret
    await this.secretsManager.deleteSecret(`${path}-new`)
    
    return {
      success: true,
      oldVersion: currentSecret.version,
      newVersion: newSecret.version,
      rotatedAt: new Date()
    }
  }

  private async gradualRolloutRotation(
    path: string,
    currentSecret: any,
    newSecret: any
  ): Promise<RotationResult> {
    // Implement gradual rollout with canary testing
    const rolloutSteps = [0.1, 0.25, 0.5, 1.0] // 10%, 25%, 50%, 100%
    
    for (const percentage of rolloutSteps) {
      await this.updateSecretForPercentage(path, newSecret, percentage)
      await this.monitorHealthMetrics()
      await this.sleep(5 * 60 * 1000) // Wait 5 minutes between steps
    }
    
    return {
      success: true,
      oldVersion: currentSecret.version,
      newVersion: newSecret.version,
      rotatedAt: new Date()
    }
  }

  private async generateNewSecret(path: string, currentSecret: any): Promise<any> {
    if (path.includes('database')) {
      return this.generateDatabaseSecret()
    } else if (path.includes('api-key')) {
      return this.generateAPISecret()
    } else {
      return this.generateGenericSecret(currentSecret)
    }
  }

  private generateDatabaseSecret(): any {
    return {
      username: `app_${Date.now()}`,
      password: require('crypto').randomBytes(32).toString('hex'),
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME
    }
  }

  private generateAPISecret(): any {
    return {
      key: require('crypto').randomBytes(32).toString('hex'),
      created: new Date().toISOString(),
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  }
}

interface RotationPolicy {
  interval: number
  strategy: 'blue-green' | 'gradual-rollout' | 'immediate'
  notifyBeforeExpiry: number
  maxAge: number
}

interface RotationResult {
  success: boolean
  oldVersion?: string
  newVersion: string
  rotatedAt: Date
  error?: string
}
```

## Lease Management

### Lease Renewal

```typescript
class LeaseManager {
  private activeLeases = new Map<string, LeaseInfo>()

  constructor(private secretsManager: SecretsManager) {
    this.startLeaseRenewalProcess()
  }

  async trackLease(leaseId: string, renewalBuffer: number = 300): Promise<void> {
    const leaseInfo = await this.getLeaseInfo(leaseId)
    
    this.activeLeases.set(leaseId, {
      ...leaseInfo,
      renewalBuffer,
      nextRenewal: new Date(Date.now() + (leaseInfo.ttl - renewalBuffer) * 1000)
    })
  }

  private async getLeaseInfo(leaseId: string): Promise<LeaseInfo> {
    // Get lease information from Vault
    const response = await this.vaultRequest(`/v1/sys/leases/lookup`, 'POST', {
      lease_id: leaseId
    })
    
    return {
      id: leaseId,
      ttl: response.data.ttl,
      renewable: response.data.renewable,
      issueTime: new Date(response.data.issue_time)
    }
  }

  private startLeaseRenewalProcess(): void {
    setInterval(async () => {
      const now = new Date()
      
      for (const [leaseId, lease] of this.activeLeases.entries()) {
        if (now >= lease.nextRenewal && lease.renewable) {
          try {
            await this.renewLease(leaseId)
            console.log(`Renewed lease: ${leaseId}`)
            
            // Update next renewal time
            lease.nextRenewal = new Date(now.getTime() + (lease.ttl - lease.renewalBuffer) * 1000)
            
          } catch (error) {
            console.error(`Failed to renew lease ${leaseId}:`, error)
            this.activeLeases.delete(leaseId)
          }
        }
      }
    }, 60 * 1000) // Check every minute
  }

  private async renewLease(leaseId: string): Promise<void> {
    await this.vaultRequest('/v1/sys/leases/renew', 'POST', {
      lease_id: leaseId
    })
  }

  private async vaultRequest(path: string, method: string, body?: any): Promise<any> {
    // Implementation would make actual Vault API calls
    // This is handled by the SecretsManager
    return {}
  }
}

interface LeaseInfo {
  id: string
  ttl: number
  renewable: boolean
  issueTime: Date
  renewalBuffer?: number
  nextRenewal?: Date
}
```

## Integration Patterns

### Application Integration

```typescript
// Service configuration with automatic secret loading
class ConfigurationService {
  private config: Map<string, any> = new Map()

  constructor(private secretsManager: SecretsManager) {}

  async loadConfiguration(): Promise<void> {
    // Load static configuration
    const staticConfig = this.loadStaticConfig()
    
    // Load secrets from Vault
    const secrets = await this.loadSecrets()
    
    // Merge configurations
    this.mergeConfigurations(staticConfig, secrets)
    
    // Set up secret refresh
    this.setupSecretRefresh()
  }

  private async loadSecrets(): Promise<any> {
    const secrets = {}
    
    const secretPaths = [
      'database/credentials',
      'api-keys/external-service',
      'encryption/master-key',
      'certificates/tls'
    ]

    for (const path of secretPaths) {
      try {
        const secret = await this.secretsManager.getSecret(path)
        this.setNestedValue(secrets, path, secret)
      } catch (error) {
        console.warn(`Failed to load secret ${path}:`, error.message)
      }
    }

    return secrets
  }

  private setupSecretRefresh(): void {
    // Refresh secrets every hour
    setInterval(async () => {
      try {
        const secrets = await this.loadSecrets()
        this.mergeConfigurations({}, secrets)
        console.log('Secrets refreshed successfully')
      } catch (error) {
        console.error('Failed to refresh secrets:', error)
      }
    }, 60 * 60 * 1000)
  }

  get(key: string): any {
    return this.config.get(key)
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('/')
    let current = obj
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {}
      }
      current = current[keys[i]]
    }
    
    current[keys[keys.length - 1]] = value
  }
}
```

### Database Connection Management

```typescript
// Database connection with dynamic credentials
class SecureDatabase {
  private connection: any = null
  private currentLease: string | null = null

  constructor(
    private secretsManager: SecretsManager,
    private dbRole: string
  ) {}

  async connect(): Promise<void> {
    // Get dynamic database credentials
    const creds = await this.secretsManager.generateDynamicSecret('database', this.dbRole)
    
    // Create database connection
    this.connection = await this.createConnection({
      username: creds.data.username,
      password: creds.data.password,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME
    })

    // Track lease for renewal
    this.currentLease = creds.leaseId
    this.scheduleCredentialRenewal(creds.leaseDuration)
    
    console.log('Database connected with dynamic credentials')
  }

  async query(sql: string, params?: any[]): Promise<any> {
    if (!this.connection) {
      await this.connect()
    }
    
    return this.connection.query(sql, params)
  }

  private scheduleCredentialRenewal(leaseDuration: number): void {
    // Renew credentials at 80% of lease duration
    const renewalTime = leaseDuration * 0.8 * 1000
    
    setTimeout(async () => {
      try {
        await this.renewCredentials()
      } catch (error) {
        console.error('Failed to renew database credentials:', error)
        await this.reconnect()
      }
    }, renewalTime)
  }

  private async renewCredentials(): Promise<void> {
    if (!this.currentLease) return

    // Renew the lease
    await this.secretsManager.renewDynamicSecret(this.currentLease)
    console.log('Database credentials lease renewed')
    
    // Schedule next renewal
    const leaseInfo = await this.getLeaseInfo(this.currentLease)
    this.scheduleCredentialRenewal(leaseInfo.ttl)
  }

  private async reconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close()
    }
    
    if (this.currentLease) {
      await this.secretsManager.revokeDynamicSecret(this.currentLease)
    }
    
    await this.connect()
  }
}
```

## Monitoring and Alerting

### Metrics Collection

```typescript
class VaultMetrics {
  private metrics = {
    secretsAccessed: 0,
    secretsCreated: 0,
    secretsRotated: 0,
    authenticationSuccesses: 0,
    authenticationFailures: 0,
    leaseRenewals: 0,
    leaseRevocations: 0
  }

  recordSecretAccess(path: string): void {
    this.metrics.secretsAccessed++
    this.sendMetric('vault.secret.access', 1, { path })
  }

  recordSecretRotation(path: string, success: boolean): void {
    if (success) {
      this.metrics.secretsRotated++
      this.sendMetric('vault.secret.rotation.success', 1, { path })
    } else {
      this.sendMetric('vault.secret.rotation.failure', 1, { path })
    }
  }

  recordAuthentication(success: boolean): void {
    if (success) {
      this.metrics.authenticationSuccesses++
      this.sendMetric('vault.auth.success', 1)
    } else {
      this.metrics.authenticationFailures++
      this.sendMetric('vault.auth.failure', 1)
    }
  }

  getMetrics(): any {
    return { ...this.metrics }
  }

  private sendMetric(name: string, value: number, tags?: any): void {
    // Send to monitoring system (DataDog, Prometheus, etc.)
    console.log(`Metric: ${name} = ${value}`, tags)
  }
}
```

### Health Monitoring

```typescript
class VaultHealthMonitor {
  constructor(private secretsManager: SecretsManager) {}

  async checkHealth(): Promise<HealthStatus> {
    const health: HealthStatus = {
      vault: await this.checkVaultConnection(),
      authentication: await this.checkAuthentication(),
      secrets: await this.checkSecretAccess(),
      leases: await this.checkLeaseHealth(),
      rotation: await this.checkRotationHealth()
    }

    health.overall = this.calculateOverallHealth(health)
    return health
  }

  private async checkVaultConnection(): Promise<ComponentHealth> {
    try {
      const health = await this.secretsManager.getHealth()
      return {
        status: health.error ? 'unhealthy' : 'healthy',
        responseTime: await this.measureResponseTime(),
        details: health
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        responseTime: null
      }
    }
  }

  private async checkAuthentication(): Promise<ComponentHealth> {
    try {
      // Try to authenticate with current credentials
      await this.secretsManager.renewToken()
      return { status: 'healthy' }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: 'Authentication failed'
      }
    }
  }

  private async measureResponseTime(): Promise<number> {
    const start = Date.now()
    try {
      await this.secretsManager.listSecrets('health-check/')
    } catch (error) {
      // Ignore errors for response time measurement
    }
    return Date.now() - start
  }
}

interface HealthStatus {
  vault: ComponentHealth
  authentication: ComponentHealth
  secrets: ComponentHealth
  leases: ComponentHealth
  rotation: ComponentHealth
  overall: 'healthy' | 'degraded' | 'unhealthy'
}

interface ComponentHealth {
  status: 'healthy' | 'unhealthy'
  responseTime?: number | null
  error?: string
  details?: any
}
```

## Best Practices

### Security Best Practices

1. **Principle of Least Privilege**: Grant minimal necessary permissions
2. **Regular Rotation**: Implement automated secret rotation
3. **Audit Logging**: Enable comprehensive audit trails
4. **Network Security**: Secure Vault communication channels
5. **Backup Strategy**: Implement secure backup and recovery

### Implementation Best Practices

1. **Error Handling**: Graceful degradation on Vault unavailability
2. **Caching Strategy**: Appropriate secret caching with TTL
3. **Monitoring**: Comprehensive health and performance monitoring
4. **Testing**: Regular disaster recovery testing
5. **Documentation**: Keep runbooks and procedures current

### Operational Best Practices

1. **High Availability**: Deploy Vault in HA configuration
2. **Disaster Recovery**: Regular backup and restore testing
3. **Performance Tuning**: Monitor and optimize Vault performance
4. **Security Updates**: Keep Vault and clients updated
5. **Incident Response**: Defined procedures for security incidents

For detailed implementation examples, see `src/security/vault/secrets-manager.ts`.