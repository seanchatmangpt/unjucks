# User Management System Architecture

## 1. System Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Load Balancer (ALB)                         │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────────────────────┐
│                        API Gateway                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │Rate Limiting│ │    Auth     │ │    Audit    │ │  Request    ││
│  │   Service   │ │ Middleware  │ │  Logging    │ │ Validation  ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────────────────────┐
│                    Core Services Layer                          │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │
│ │     Auth     │ │Registration  │ │   Profile    │ │   Role   │ │
│ │   Service    │ │   Service    │ │   Service    │ │ Service  │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘ │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │
│ │   Security   │ │ Notification │ │    Audit     │ │  Session │ │
│ │   Service    │ │   Service    │ │   Service    │ │ Service  │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘ │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────────────────────┐
│                      Data Layer                                 │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │
│ │ PostgreSQL   │ │    Redis     │ │Elasticsearch │ │    S3    │ │
│ │  (Primary)   │ │(Session/Cache)│ │ (Audit Logs) │ │(Storage) │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

**Backend Services:**
- Node.js 18+ with TypeScript
- Express.js for REST APIs
- Fastify for high-performance endpoints
- Passport.js for authentication strategies
- Joi for request validation

**Authentication & Security:**
- JWT tokens with RS256 signing
- OAuth 2.0 / OpenID Connect
- bcrypt for password hashing
- speakeasy for TOTP MFA
- helmet.js for security headers

**Data Storage:**
- PostgreSQL 14+ (primary database)
- Redis 7+ (sessions, cache, rate limiting)
- Elasticsearch 8+ (audit logs, search)
- Amazon S3 (file storage)

**Infrastructure:**
- Docker containers
- Kubernetes orchestration
- AWS cloud platform
- Prometheus + Grafana monitoring

## 2. Service Architecture

### 2.1 Microservices Breakdown

```typescript
interface ServiceArchitecture {
  authService: {
    responsibilities: [
      "User authentication",
      "Token generation and validation", 
      "Password verification",
      "MFA processing",
      "Session management"
    ],
    database: "postgresql",
    cache: "redis",
    apis: ["REST", "internal gRPC"],
    events: ["UserAuthenticated", "AuthenticationFailed", "MFARequired"]
  },
  
  registrationService: {
    responsibilities: [
      "User registration workflow",
      "Email verification",
      "Account activation",
      "Onboarding process"
    ],
    database: "postgresql", 
    cache: "redis",
    apis: ["REST"],
    events: ["UserRegistered", "EmailVerified", "AccountActivated"]
  },
  
  profileService: {
    responsibilities: [
      "User profile management",
      "Profile data CRUD operations",
      "Privacy settings",
      "Preference management"
    ],
    database: "postgresql",
    cache: "redis", 
    apis: ["REST", "GraphQL"],
    events: ["ProfileUpdated", "PrivacyChanged", "ProfileDeleted"]
  },
  
  roleService: {
    responsibilities: [
      "Role and permission management",
      "RBAC implementation", 
      "Authorization decisions",
      "Access control policies"
    ],
    database: "postgresql",
    cache: "redis",
    apis: ["REST", "internal gRPC"],
    events: ["RoleAssigned", "RoleRevoked", "PermissionChanged"]
  }
}
```

### 2.2 Database Schema Design

#### 2.2.1 Core User Tables (PostgreSQL)

```sql
-- Users table with core authentication data
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending_verification', 'locked')),
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  last_login_at TIMESTAMP,
  password_changed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes for performance
  INDEX idx_users_email ON users(email),
  INDEX idx_users_status ON users(status),
  INDEX idx_users_created ON users(created_at)
);

-- User profiles with extended information
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  display_name VARCHAR(200),
  avatar_url VARCHAR(500),
  phone VARCHAR(20),
  date_of_birth DATE,
  timezone VARCHAR(50) DEFAULT 'UTC',
  locale VARCHAR(10) DEFAULT 'en-US',
  bio TEXT,
  website VARCHAR(255),
  social_profiles JSONB,
  preferences JSONB DEFAULT '{}',
  privacy_settings JSONB DEFAULT '{"profile_visibility": "private", "email_notifications": true}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id),
  INDEX idx_profiles_user_id ON user_profiles(user_id),
  INDEX idx_profiles_display_name ON user_profiles(display_name)
);

-- Roles and permissions
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_roles_name ON roles(name)
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_permissions_resource_action ON permissions(resource, action),
  UNIQUE(resource, action)
);

CREATE TABLE role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  granted_at TIMESTAMP DEFAULT NOW(),
  granted_by UUID REFERENCES users(id),
  
  PRIMARY KEY (role_id, permission_id),
  INDEX idx_role_permissions_role ON role_permissions(role_id)
);

CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id),
  expires_at TIMESTAMP,
  
  PRIMARY KEY (user_id, role_id),
  INDEX idx_user_roles_user ON user_roles(user_id),
  INDEX idx_user_roles_expires ON user_roles(expires_at)
);
```

#### 2.2.2 Security and Audit Tables

```sql
-- Session management
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash VARCHAR(255) UNIQUE NOT NULL,
  refresh_token_hash VARCHAR(255) UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  device_fingerprint VARCHAR(255),
  location JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  last_accessed_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  
  INDEX idx_sessions_user_id ON user_sessions(user_id),
  INDEX idx_sessions_token ON user_sessions(session_token_hash),
  INDEX idx_sessions_expires ON user_sessions(expires_at),
  INDEX idx_sessions_active ON user_sessions(is_active)
);

-- MFA management
CREATE TABLE user_mfa_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  method_type VARCHAR(20) NOT NULL CHECK (method_type IN ('totp', 'sms', 'email')),
  secret_encrypted TEXT, -- For TOTP
  phone VARCHAR(20), -- For SMS
  email VARCHAR(255), -- For email MFA
  backup_codes TEXT[], -- Encrypted backup codes
  is_verified BOOLEAN DEFAULT FALSE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  
  INDEX idx_mfa_user_id ON user_mfa_methods(user_id),
  INDEX idx_mfa_type ON user_mfa_methods(method_type),
  UNIQUE(user_id, method_type)
);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  ip_address INET,
  
  INDEX idx_reset_tokens_hash ON password_reset_tokens(token_hash),
  INDEX idx_reset_tokens_expires ON password_reset_tokens(expires_at),
  INDEX idx_reset_tokens_user ON password_reset_tokens(user_id)
);

-- Audit logging
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_audit_user_id ON audit_logs(user_id),
  INDEX idx_audit_event_type ON audit_logs(event_type),
  INDEX idx_audit_created_at ON audit_logs(created_at),
  INDEX idx_audit_resource ON audit_logs(resource_type, resource_id)
);

-- Security events and device tracking
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  details JSONB NOT NULL,
  ip_address INET,
  location JSONB,
  device_info JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_security_user_id ON security_events(user_id),
  INDEX idx_security_risk_level ON security_events(risk_level),
  INDEX idx_security_event_type ON security_events(event_type),
  INDEX idx_security_created ON security_events(created_at)
);
```

### 2.3 Caching Strategy

#### 2.3.1 Redis Cache Design

```typescript
interface CacheStrategy {
  layers: {
    L1: {
      type: "Application Memory",
      ttl: "30 seconds",
      size: "256MB per service",
      use: "Hot data (user sessions, permissions)"
    },
    L2: {
      type: "Redis Cluster", 
      ttl: "5-60 minutes",
      size: "8GB cluster",
      use: "User profiles, role mappings, MFA data"
    },
    L3: {
      type: "Database Read Replicas",
      ttl: "N/A",
      use: "Fallback for cache misses"
    }
  },
  
  cachePatterns: {
    // User authentication cache
    userAuth: {
      key: "auth:user:{userId}",
      ttl: "15 minutes",
      data: "user credentials, status, failed attempts"
    },
    
    // Session cache
    userSession: {
      key: "session:{sessionId}",
      ttl: "30 minutes", 
      data: "session metadata, user context"
    },
    
    // Permission cache
    userPermissions: {
      key: "perms:user:{userId}",
      ttl: "10 minutes",
      data: "user roles and computed permissions"
    },
    
    // Rate limiting
    rateLimits: {
      key: "rate:{type}:{identifier}",
      ttl: "1 hour",
      data: "request counters and timestamps"
    },
    
    // MFA challenges
    mfaChallenges: {
      key: "mfa:{challengeId}",
      ttl: "5 minutes",
      data: "temporary MFA verification state"
    }
  }
}

// Cache implementation with error handling
class CacheManager {
  private redisClient: Redis.Redis;
  private localCache: LRU<string, any>;
  
  constructor() {
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });
    
    this.localCache = new LRU({
      max: 1000,
      ttl: 30 * 1000 // 30 seconds
    });
  }
  
  async get<T>(key: string, fallback?: () => Promise<T>): Promise<T | null> {
    try {
      // L1 cache check
      const localValue = this.localCache.get(key);
      if (localValue !== undefined) {
        return localValue as T;
      }
      
      // L2 cache check
      const redisValue = await this.redisClient.get(key);
      if (redisValue) {
        const parsed = JSON.parse(redisValue) as T;
        this.localCache.set(key, parsed);
        return parsed;
      }
      
      // Fallback to data source
      if (fallback) {
        const value = await fallback();
        await this.set(key, value, 300); // 5 minutes default
        return value;
      }
      
      return null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      if (fallback) {
        return await fallback();
      }
      return null;
    }
  }
  
  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      
      // Set in both caches
      this.localCache.set(key, value);
      await this.redisClient.setex(key, ttl, serialized);
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }
  
  async invalidate(pattern: string): Promise<void> {
    try {
      // Clear local cache entries matching pattern
      for (const key of this.localCache.keys()) {
        if (key.match(pattern)) {
          this.localCache.delete(key);
        }
      }
      
      // Clear Redis entries
      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
      }
    } catch (error) {
      console.error(`Cache invalidation error for pattern ${pattern}:`, error);
    }
  }
}
```

### 2.4 Security Architecture

#### 2.4.1 Authentication Flow

```typescript
// JWT Token Architecture
interface TokenArchitecture {
  accessToken: {
    algorithm: "RS256",
    expiration: "15 minutes",
    claims: {
      sub: "user_id",
      email: "user_email", 
      roles: "user_roles_array",
      permissions: "computed_permissions",
      session_id: "session_identifier",
      device_id: "device_fingerprint"
    }
  },
  
  refreshToken: {
    algorithm: "RS256",
    expiration: "30 days",
    claims: {
      sub: "user_id",
      session_id: "session_identifier",
      type: "refresh",
      device_id: "device_fingerprint"
    }
  },
  
  keyRotation: {
    frequency: "monthly",
    gracePeriod: "7 days",
    storage: "AWS KMS"
  }
}

// Secure authentication service
class AuthenticationService {
  private jwtService: JWTService;
  private passwordService: PasswordService;
  private mfaService: MFAService;
  private securityAnalyzer: SecurityAnalyzer;
  
  async authenticateUser(credentials: LoginCredentials, clientInfo: ClientInfo): Promise<AuthResult> {
    const { email, password } = credentials;
    
    // 1. Rate limiting check
    await this.rateLimiter.checkLimit(`auth:${clientInfo.ipAddress}`, {
      points: 5,
      duration: 900 // 15 minutes
    });
    
    try {
      // 2. Find user
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        await this.auditService.logFailedAuth(email, 'user_not_found', clientInfo);
        throw new InvalidCredentialsError();
      }
      
      // 3. Check account status
      this.validateAccountStatus(user);
      
      // 4. Verify password
      const validPassword = await this.passwordService.verify(password, user.passwordHash);
      if (!validPassword) {
        await this.handleFailedLogin(user, clientInfo);
        throw new InvalidCredentialsError();
      }
      
      // 5. Security analysis
      const securityAnalysis = await this.securityAnalyzer.analyze(user.id, clientInfo);
      
      // 6. Handle high-risk scenarios
      if (securityAnalysis.riskLevel === 'high' || securityAnalysis.riskLevel === 'critical') {
        return await this.handleHighRiskAuth(user, securityAnalysis);
      }
      
      // 7. Check MFA requirement
      const mfaRequired = await this.mfaService.isMFAEnabled(user.id);
      if (mfaRequired) {
        return await this.initiateMFAChallenge(user, clientInfo);
      }
      
      // 8. Create session and tokens
      return await this.createAuthenticatedSession(user, clientInfo);
      
    } catch (error) {
      await this.rateLimiter.consume(`auth:${clientInfo.ipAddress}`);
      throw error;
    }
  }
  
  private async createAuthenticatedSession(user: User, clientInfo: ClientInfo): Promise<AuthResult> {
    // Generate session
    const session = await this.sessionService.create({
      userId: user.id,
      clientInfo,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
    
    // Generate tokens
    const accessToken = await this.jwtService.generateAccessToken({
      sub: user.id,
      email: user.email,
      session_id: session.id,
      roles: await this.roleService.getUserRoles(user.id)
    });
    
    const refreshToken = await this.jwtService.generateRefreshToken({
      sub: user.id,
      session_id: session.id,
      type: 'refresh'
    });
    
    // Cache session data
    await this.cacheManager.set(`session:${session.id}`, session, 1800); // 30 minutes
    
    // Log successful authentication
    await this.auditService.logSuccessfulAuth(user.id, clientInfo);
    
    return {
      accessToken,
      refreshToken,
      expiresAt: accessToken.expiresAt,
      user: this.sanitizeUser(user)
    };
  }
}
```

#### 2.4.2 Authorization Middleware

```typescript
// Role-based authorization middleware
class AuthorizationMiddleware {
  static requirePermission(resource: string, action: string) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { user } = req;
        
        // Check cached permissions first
        const cacheKey = `perms:${user.id}:${resource}:${action}`;
        let hasPermission = await this.cacheManager.get(cacheKey);
        
        if (hasPermission === null) {
          // Compute permission
          hasPermission = await this.authorizationService.checkPermission(
            user.id,
            resource,
            action,
            req.params // For resource-specific checks
          );
          
          // Cache result for 5 minutes
          await this.cacheManager.set(cacheKey, hasPermission, 300);
        }
        
        if (!hasPermission) {
          await this.auditService.logUnauthorizedAccess(user.id, resource, action);
          return res.status(403).json({
            error: 'Insufficient permissions',
            required: `${resource}:${action}`
          });
        }
        
        // Log authorized access
        await this.auditService.logAuthorizedAccess(user.id, resource, action);
        next();
        
      } catch (error) {
        next(error);
      }
    };
  }
  
  static requireRole(roleName: string) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { user } = req;
        const userRoles = await this.roleService.getUserRoles(user.id);
        
        if (!userRoles.some(role => role.name === roleName)) {
          return res.status(403).json({
            error: 'Insufficient role',
            required: roleName
          });
        }
        
        next();
      } catch (error) {
        next(error);
      }
    };
  }
}
```

### 2.5 Monitoring and Observability

#### 2.5.1 Metrics Collection

```typescript
// Comprehensive metrics collection
class MetricsCollector {
  private prometheus: PrometheusRegistry;
  
  constructor() {
    this.setupMetrics();
  }
  
  private setupMetrics(): void {
    // Authentication metrics
    this.authAttempts = new Counter({
      name: 'auth_attempts_total',
      help: 'Total authentication attempts',
      labelNames: ['status', 'method', 'risk_level']
    });
    
    this.authDuration = new Histogram({
      name: 'auth_duration_seconds',
      help: 'Authentication request duration',
      buckets: [0.1, 0.2, 0.5, 1, 2, 5]
    });
    
    // Session metrics
    this.activeSessions = new Gauge({
      name: 'active_sessions_current',
      help: 'Currently active user sessions'
    });
    
    this.sessionDuration = new Histogram({
      name: 'session_duration_seconds',
      help: 'User session duration',
      buckets: [60, 300, 900, 1800, 3600, 7200, 14400]
    });
    
    // Security metrics
    this.securityEvents = new Counter({
      name: 'security_events_total',
      help: 'Security events detected',
      labelNames: ['event_type', 'risk_level', 'resolved']
    });
    
    this.mfaChallenges = new Counter({
      name: 'mfa_challenges_total',
      help: 'MFA challenges issued',
      labelNames: ['method', 'status']
    });
    
    // Performance metrics
    this.databaseQueries = new Histogram({
      name: 'database_query_duration_seconds',
      help: 'Database query execution time',
      labelNames: ['operation', 'table'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2]
    });
    
    this.cacheHitRatio = new Gauge({
      name: 'cache_hit_ratio',
      help: 'Cache hit ratio percentage',
      labelNames: ['cache_type']
    });
  }
  
  // Method to record authentication attempt
  recordAuthAttempt(status: 'success' | 'failure', method: string, riskLevel: string): void {
    this.authAttempts.inc({ status, method, risk_level: riskLevel });
  }
  
  // Method to record authentication duration
  recordAuthDuration(duration: number): void {
    this.authDuration.observe(duration);
  }
  
  // Method to update active sessions count
  updateActiveSessions(count: number): void {
    this.activeSessions.set(count);
  }
}
```

#### 2.5.2 Alerting Rules

```yaml
# Prometheus alerting rules
groups:
- name: authentication
  rules:
  - alert: HighAuthFailureRate
    expr: rate(auth_attempts_total{status="failure"}[5m]) > 10
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: High authentication failure rate detected
      description: "Authentication failure rate is {{ $value }} per second"
      
  - alert: CriticalSecurityEvent
    expr: increase(security_events_total{risk_level="critical"}[5m]) > 0
    for: 0m
    labels:
      severity: critical
    annotations:
      summary: Critical security event detected
      description: "Critical security event of type {{ $labels.event_type }}"
      
  - alert: DatabasePerformanceDegraded
    expr: histogram_quantile(0.95, rate(database_query_duration_seconds_bucket[5m])) > 1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: Database performance degraded
      description: "95th percentile query time is {{ $value }}s"
      
  - alert: LowCacheHitRatio
    expr: cache_hit_ratio < 0.7
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: Low cache hit ratio
      description: "Cache hit ratio is {{ $value }} for {{ $labels.cache_type }}"
```

### 2.6 API Design

#### 2.6.1 REST API Endpoints

```typescript
// API endpoint definitions
interface APIEndpoints {
  authentication: {
    "POST /auth/login": {
      description: "Authenticate user with email/password",
      rateLimit: "5 per 15 minutes",
      validation: "LoginSchema"
    },
    "POST /auth/logout": {
      description: "Terminate current session",
      auth: "required",
      rateLimit: "10 per minute"
    },
    "POST /auth/refresh": {
      description: "Refresh access token",
      validation: "RefreshTokenSchema",
      rateLimit: "20 per hour"
    },
    "POST /auth/mfa/challenge": {
      description: "Complete MFA challenge",
      validation: "MFAChallengeSchema",
      rateLimit: "10 per 5 minutes"
    }
  },
  
  registration: {
    "POST /auth/register": {
      description: "Register new user account",
      validation: "RegistrationSchema",
      rateLimit: "3 per hour"
    },
    "POST /auth/verify-email": {
      description: "Verify email address",
      validation: "EmailVerificationSchema",
      rateLimit: "5 per hour"
    },
    "POST /auth/resend-verification": {
      description: "Resend verification email",
      validation: "EmailSchema",
      rateLimit: "3 per hour"
    }
  },
  
  profile: {
    "GET /profile": {
      description: "Get user profile",
      auth: "required",
      cache: "5 minutes"
    },
    "PUT /profile": {
      description: "Update user profile",
      auth: "required", 
      validation: "ProfileUpdateSchema",
      rateLimit: "10 per hour"
    },
    "DELETE /profile": {
      description: "Delete user account",
      auth: "required",
      validation: "AccountDeletionSchema",
      rateLimit: "1 per day"
    }
  },
  
  security: {
    "GET /security/sessions": {
      description: "List active sessions",
      auth: "required",
      cache: "1 minute"
    },
    "DELETE /security/sessions/:sessionId": {
      description: "Terminate specific session",
      auth: "required",
      rateLimit: "20 per hour"
    },
    "POST /security/change-password": {
      description: "Change account password",
      auth: "required",
      validation: "PasswordChangeSchema",
      rateLimit: "5 per hour"
    },
    "GET /security/audit-log": {
      description: "Get security audit log",
      auth: "required",
      permissions: ["security:read"]
    }
  }
}

// Request validation schemas
const schemas = {
  LoginSchema: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    rememberMe: Joi.boolean().default(false),
    captcha: Joi.string().when('$requireCaptcha', {
      is: true,
      then: Joi.required()
    })
  }),
  
  RegistrationSchema: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required(),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    termsAccepted: Joi.boolean().valid(true).required(),
    marketingConsent: Joi.boolean().default(false)
  }),
  
  ProfileUpdateSchema: Joi.object({
    firstName: Joi.string().min(2).max(50),
    lastName: Joi.string().min(2).max(50),
    displayName: Joi.string().max(100),
    bio: Joi.string().max(500),
    website: Joi.string().uri(),
    timezone: Joi.string(),
    locale: Joi.string().pattern(/^[a-z]{2}-[A-Z]{2}$/),
    preferences: Joi.object(),
    privacySettings: Joi.object({
      profileVisibility: Joi.string().valid('public', 'private'),
      emailNotifications: Joi.boolean(),
      marketingEmails: Joi.boolean()
    })
  })
};
```

This architecture provides a comprehensive, secure, and scalable foundation for the user management system, addressing authentication, authorization, security, and operational requirements while maintaining high performance and reliability.