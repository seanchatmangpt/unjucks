# Security Architecture

## Overview

Unjucks implements a comprehensive security architecture designed for enterprise environments, incorporating zero-trust principles, multi-layer security controls, and compliance with major regulatory frameworks. The security model protects against common vulnerabilities while maintaining system performance and usability.

## Security Architecture Layers

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           Security Architecture Layers                           │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ Layer 7: Compliance & Governance (GDPR, HIPAA, SOX, FIPS)           ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                       │                                       │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ Layer 6: Audit & Monitoring         ┃ ┃ Layer 5: Access Control         ┃ │
│ ┃ • Activity Logging                ┃ ┃ • RBAC/ABAC                   ┃ │
│ ┃ • Security Analytics             ┃ ┃ • Multi-Factor Auth           ┃ │
│ ┃ • Threat Detection               ┃ ┃ • Session Management          ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                       │                                       │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ Layer 4: Data Protection          ┃ ┃ Layer 3: Application Security   ┃ │
│ ┃ • Encryption at Rest             ┃ ┃ • Input Validation            ┃ │
│ ┃ • Encryption in Transit         ┃ ┃ • Template Sandboxing         ┃ │
│ ┃ • Key Management                ┃ ┃ • Code Injection Prevention   ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                       │                                       │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ Layer 2: Network Security          ┃ ┃ Layer 1: Infrastructure Security ┃ │
│ ┃ • TLS/mTLS                       ┃ ┃ • Container Security          ┃ │
│ ┃ • Rate Limiting                  ┃ ┃ • Runtime Protection          ┃ │
│ ┃ • DDoS Protection               ┃ ┃ • Resource Isolation          ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## 1. Zero-Trust Security Model

### Core Principles

1. **Never Trust, Always Verify**: Every request is authenticated and authorized
2. **Least Privilege Access**: Minimal required permissions for each operation
3. **Assume Breach**: Design for compromised environments
4. **Continuous Monitoring**: Real-time security posture assessment
5. **Data-Centric Security**: Protect data regardless of location

### Implementation

```typescript
// zero-trust-manager.ts
export class ZeroTrustManager {
  private authProvider: AuthenticationProvider;
  private authzProvider: AuthorizationProvider;
  private riskAssessment: RiskAssessmentEngine;
  private contextAnalyzer: ContextAnalyzer;
  
  async evaluateAccess(request: AccessRequest): Promise<AccessDecision> {
    // 1. Identity verification
    const identity = await this.verifyIdentity(request);
    if (!identity.verified) {
      return this.denyAccess('IDENTITY_VERIFICATION_FAILED', request);
    }
    
    // 2. Context analysis
    const context = await this.contextAnalyzer.analyze(request, identity);
    const riskScore = await this.riskAssessment.calculateRisk(context);
    
    // 3. Dynamic authorization
    const authzDecision = await this.authzProvider.authorize({
      identity,
      resource: request.resource,
      action: request.action,
      context,
      riskScore
    });
    
    // 4. Adaptive controls
    if (riskScore > 0.7) {
      return this.requireAdditionalVerification(authzDecision, riskScore);
    }
    
    return authzDecision;
  }
  
  private async verifyIdentity(request: AccessRequest): Promise<IdentityVerification> {
    // Multi-factor verification
    const primaryAuth = await this.authProvider.verifyPrimary(request.credentials);
    if (!primaryAuth.valid) {
      return { verified: false, reason: 'INVALID_CREDENTIALS' };
    }
    
    // Device verification
    const deviceVerification = await this.verifyDevice(request.deviceFingerprint);
    if (!deviceVerification.trusted) {
      // Require additional verification for untrusted devices
      const additionalAuth = await this.requireSecondFactor(request);
      if (!additionalAuth.valid) {
        return { verified: false, reason: 'MFA_FAILED' };
      }
    }
    
    return {
      verified: true,
      identity: primaryAuth.identity,
      trustLevel: deviceVerification.trustLevel,
      authenticationStrength: this.calculateAuthStrength(primaryAuth, deviceVerification)
    };
  }
}
```

### Risk-Based Access Control

```typescript
// risk-assessment.ts
export class RiskAssessmentEngine {
  async calculateRisk(context: SecurityContext): Promise<number> {
    const riskFactors: RiskFactor[] = [];
    
    // Geographic risk
    if (this.isHighRiskLocation(context.location)) {
      riskFactors.push({ type: 'GEOGRAPHIC', score: 0.3, weight: 0.2 });
    }
    
    // Time-based risk
    if (this.isOutsideBusinessHours(context.timestamp)) {
      riskFactors.push({ type: 'TEMPORAL', score: 0.2, weight: 0.1 });
    }
    
    // Behavioral risk
    const behaviorScore = await this.analyzeBehavior(context.user, context.action);
    if (behaviorScore > 0.5) {
      riskFactors.push({ type: 'BEHAVIORAL', score: behaviorScore, weight: 0.3 });
    }
    
    // Resource sensitivity
    const sensitivityScore = await this.assessResourceSensitivity(context.resource);
    riskFactors.push({ type: 'RESOURCE_SENSITIVITY', score: sensitivityScore, weight: 0.4 });
    
    // Calculate weighted risk score
    return riskFactors.reduce((total, factor) => {
      return total + (factor.score * factor.weight);
    }, 0);
  }
  
  private async analyzeBehavior(user: User, action: string): Promise<number> {
    const historicalData = await this.getUserBehaviorHistory(user.id);
    const currentBehavior = {
      action,
      timestamp: new Date(),
      frequency: await this.getActionFrequency(user.id, action)
    };
    
    return this.behaviorAnalysisModel.predict(currentBehavior, historicalData);
  }
}
```

## 2. Authentication and Authorization

### Multi-Factor Authentication (MFA)

```typescript
// mfa-provider.ts
export class MultiFactorAuthProvider {
  private factors: Map<string, AuthFactor> = new Map();
  
  constructor() {
    this.registerFactors();
  }
  
  private registerFactors(): void {
    // TOTP (Time-based One-Time Password)
    this.factors.set('totp', new TOTPFactor());
    
    // SMS-based verification
    this.factors.set('sms', new SMSFactor());
    
    // Hardware security keys (FIDO2/WebAuthn)
    this.factors.set('fido2', new FIDO2Factor());
    
    // Biometric authentication
    this.factors.set('biometric', new BiometricFactor());
    
    // Push notifications
    this.factors.set('push', new PushNotificationFactor());
  }
  
  async initiateChallenge(userId: string, factors: string[]): Promise<ChallengeResponse> {
    const user = await this.getUserMFAConfig(userId);
    const availableFactors = factors.filter(f => user.enabledFactors.includes(f));
    
    if (availableFactors.length === 0) {
      throw new Error('No valid MFA factors available');
    }
    
    const challenges: Challenge[] = [];
    for (const factorType of availableFactors) {
      const factor = this.factors.get(factorType);
      if (factor) {
        const challenge = await factor.createChallenge(user);
        challenges.push(challenge);
      }
    }
    
    return {
      challengeId: this.generateChallengeId(),
      challenges,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      allowedAttempts: 3
    };
  }
  
  async verifyResponse(challengeId: string, responses: ChallengeResponse[]): Promise<VerificationResult> {
    const challenge = await this.getChallenge(challengeId);
    if (!challenge || challenge.expiresAt < new Date()) {
      return { verified: false, reason: 'CHALLENGE_EXPIRED' };
    }
    
    const verifications: boolean[] = [];
    for (const response of responses) {
      const factor = this.factors.get(response.factorType);
      if (factor) {
        const verified = await factor.verifyResponse(challenge, response);
        verifications.push(verified);
      }
    }
    
    // Require at least one successful verification
    const verified = verifications.some(v => v === true);
    
    if (verified) {
      await this.recordSuccessfulAuth(challengeId);
    } else {
      await this.recordFailedAuth(challengeId);
    }
    
    return {
      verified,
      authenticationStrength: this.calculateAuthStrength(verifications),
      timestamp: new Date()
    };
  }
}
```

### Role-Based Access Control (RBAC)

```typescript
// rbac-provider.ts
export class RBACProvider {
  private roleHierarchy: RoleHierarchy;
  private permissions: PermissionRegistry;
  
  async authorize(authzRequest: AuthorizationRequest): Promise<AuthorizationDecision> {
    const user = authzRequest.identity.user;
    const resource = authzRequest.resource;
    const action = authzRequest.action;
    
    // Get user roles (including inherited roles)
    const userRoles = await this.getUserRoles(user.id);
    const effectiveRoles = await this.expandRoles(userRoles);
    
    // Check direct permissions
    for (const role of effectiveRoles) {
      const rolePermissions = await this.permissions.getRolePermissions(role.id);
      
      for (const permission of rolePermissions) {
        if (this.permissionMatches(permission, resource, action)) {
          if (permission.effect === 'ALLOW') {
            return this.allowAccess(authzRequest, permission, role);
          } else if (permission.effect === 'DENY') {
            return this.denyAccess('EXPLICIT_DENY', authzRequest, permission);
          }
        }
      }
    }
    
    // Check attribute-based conditions
    const abacDecision = await this.evaluateABACRules(authzRequest, effectiveRoles);
    if (abacDecision) {
      return abacDecision;
    }
    
    // Default deny
    return this.denyAccess('NO_MATCHING_PERMISSION', authzRequest);
  }
  
  private async evaluateABACRules(
    request: AuthorizationRequest, 
    roles: Role[]
  ): Promise<AuthorizationDecision | null> {
    const abacEvaluator = new ABACEvaluator();
    
    // Define policy rules
    const policies = await this.getApplicablePolicies(request.resource, request.action);
    
    for (const policy of policies) {
      const evaluation = await abacEvaluator.evaluate(policy, {
        subject: request.identity,
        resource: request.resource,
        action: request.action,
        environment: request.context,
        roles
      });
      
      if (evaluation.decision !== 'NOT_APPLICABLE') {
        return {
          decision: evaluation.decision,
          reason: evaluation.reason,
          policy: policy.id,
          conditions: evaluation.obligations
        };
      }
    }
    
    return null;
  }
}
```

## 3. Data Protection and Encryption

### Encryption at Rest

```typescript
// encryption-manager.ts
export class EncryptionManager {
  private keyManager: KeyManager;
  private algorithms: Map<string, EncryptionAlgorithm>;
  
  constructor(keyManager: KeyManager) {
    this.keyManager = keyManager;
    this.initializeAlgorithms();
  }
  
  private initializeAlgorithms(): void {
    // AES-256-GCM for symmetric encryption
    this.algorithms.set('AES-256-GCM', new AESGCMAlgorithm());
    
    // ChaCha20-Poly1305 for high-performance scenarios
    this.algorithms.set('CHACHA20-POLY1305', new ChaCha20Algorithm());
    
    // RSA-OAEP for asymmetric encryption
    this.algorithms.set('RSA-OAEP', new RSAOAEPAlgorithm());
  }
  
  async encryptData(data: Buffer, context: EncryptionContext): Promise<EncryptedData> {
    // Select appropriate algorithm based on data type and size
    const algorithm = this.selectAlgorithm(data.length, context);
    
    // Get encryption key
    const keyId = await this.keyManager.getKeyId(context);
    const key = await this.keyManager.getKey(keyId);
    
    // Generate unique nonce/IV
    const nonce = crypto.randomBytes(algorithm.nonceSize);
    
    // Encrypt data
    const encryptedData = await algorithm.encrypt(data, key, nonce);
    
    // Return encrypted data with metadata
    return {
      data: encryptedData,
      keyId,
      algorithm: algorithm.name,
      nonce: nonce.toString('base64'),
      timestamp: new Date(),
      context: this.sanitizeContext(context)
    };
  }
  
  async decryptData(encryptedData: EncryptedData, context: DecryptionContext): Promise<Buffer> {
    // Verify decryption permissions
    await this.verifyDecryptionAuthorization(encryptedData, context);
    
    // Get decryption key
    const key = await this.keyManager.getKey(encryptedData.keyId);
    if (!key) {
      throw new Error('Encryption key not available');
    }
    
    // Get algorithm
    const algorithm = this.algorithms.get(encryptedData.algorithm);
    if (!algorithm) {
      throw new Error(`Unsupported encryption algorithm: ${encryptedData.algorithm}`);
    }
    
    // Decrypt data
    const nonce = Buffer.from(encryptedData.nonce, 'base64');
    const decryptedData = await algorithm.decrypt(encryptedData.data, key, nonce);
    
    // Log decryption event
    await this.auditLogger.logDecryption({
      keyId: encryptedData.keyId,
      context,
      timestamp: new Date(),
      success: true
    });
    
    return decryptedData;
  }
  
  private selectAlgorithm(dataSize: number, context: EncryptionContext): EncryptionAlgorithm {
    // Use ChaCha20 for large data (better performance)
    if (dataSize > 1024 * 1024) {
      return this.algorithms.get('CHACHA20-POLY1305')!;
    }
    
    // Use AES-GCM for standard encryption
    return this.algorithms.get('AES-256-GCM')!;
  }
}
```

### Key Management

```typescript
// key-manager.ts
export class KeyManager {
  private keyStore: KeyStore;
  private hsmProvider: HSMProvider;
  private keyRotationScheduler: KeyRotationScheduler;
  
  async generateKey(context: KeyGenerationContext): Promise<KeyMetadata> {
    const keySpec = this.determineKeySpec(context);
    
    // Generate key using HSM or software
    const keyData = context.useHSM 
      ? await this.hsmProvider.generateKey(keySpec)
      : await this.generateSoftwareKey(keySpec);
    
    // Create key metadata
    const keyMetadata: KeyMetadata = {
      id: this.generateKeyId(),
      algorithm: keySpec.algorithm,
      keySize: keySpec.keySize,
      purpose: context.purpose,
      createdAt: new Date(),
      expiresAt: this.calculateExpirationDate(context),
      rotationInterval: context.rotationInterval || 365 * 24 * 60 * 60 * 1000, // 1 year
      status: 'ACTIVE',
      context: this.sanitizeContext(context)
    };
    
    // Store key securely
    await this.keyStore.store(keyMetadata.id, keyData, keyMetadata);
    
    // Schedule automatic rotation
    await this.keyRotationScheduler.scheduleRotation(keyMetadata);
    
    return keyMetadata;
  }
  
  async rotateKey(keyId: string): Promise<KeyMetadata> {
    const currentKey = await this.keyStore.getMetadata(keyId);
    if (!currentKey) {
      throw new Error(`Key ${keyId} not found`);
    }
    
    // Generate new key with same specifications
    const newKeyContext: KeyGenerationContext = {
      algorithm: currentKey.algorithm,
      keySize: currentKey.keySize,
      purpose: currentKey.purpose,
      rotationInterval: currentKey.rotationInterval,
      useHSM: currentKey.context.useHSM
    };
    
    const newKey = await this.generateKey(newKeyContext);
    
    // Mark old key as superseded
    await this.keyStore.updateStatus(keyId, 'SUPERSEDED', {
      supersededBy: newKey.id,
      supersededAt: new Date()
    });
    
    // Update key references in encrypted data
    await this.updateKeyReferences(keyId, newKey.id);
    
    return newKey;
  }
  
  private calculateExpirationDate(context: KeyGenerationContext): Date {
    const now = new Date();
    const rotationMs = context.rotationInterval || 365 * 24 * 60 * 60 * 1000;
    return new Date(now.getTime() + rotationMs);
  }
}
```

## 4. Secure Template Processing

### Template Sandboxing

```typescript
// template-sandbox.ts
export class TemplateSandbox {
  private vm: VM2;
  private allowedModules: Set<string>;
  private resourceLimits: ResourceLimits;
  
  constructor(config: SandboxConfig) {
    this.allowedModules = new Set(config.allowedModules || []);
    this.resourceLimits = config.resourceLimits || this.getDefaultLimits();
    
    this.vm = new VM2({
      timeout: this.resourceLimits.executionTimeout,
      sandbox: this.createSandboxEnvironment(),
      require: {
        external: false,
        builtin: this.allowedModules.has('*') ? ['*'] : Array.from(this.allowedModules),
        resolve: this.customModuleResolver.bind(this)
      }
    });
  }
  
  async executeTemplate(template: string, context: TemplateContext): Promise<string> {
    // Validate template for security issues
    await this.validateTemplateSecurity(template);
    
    // Create isolated execution context
    const isolatedContext = this.createIsolatedContext(context);
    
    try {
      // Monitor resource usage
      const resourceMonitor = new ResourceMonitor(this.resourceLimits);
      resourceMonitor.start();
      
      // Execute template in sandbox
      const result = await this.vm.run(template, isolatedContext);
      
      // Verify resource limits weren't exceeded
      const resourceUsage = resourceMonitor.stop();
      if (resourceUsage.exceeded) {
        throw new SecurityError('Resource limits exceeded during template execution');
      }
      
      // Validate output
      await this.validateTemplateOutput(result);
      
      return result;
    } catch (error) {
      await this.auditLogger.logTemplateExecutionError({
        template: this.hashTemplate(template),
        error: error.message,
        context: this.sanitizeContext(context)
      });
      throw error;
    }
  }
  
  private async validateTemplateSecurity(template: string): Promise<void> {
    const validators = [
      new CodeInjectionValidator(),
      new PathTraversalValidator(),
      new CommandInjectionValidator(),
      new FileSystemAccessValidator(),
      new NetworkAccessValidator()
    ];
    
    for (const validator of validators) {
      const result = await validator.validate(template);
      if (!result.valid) {
        throw new SecurityError(
          `Template security validation failed: ${result.errors.join(', ')}`
        );
      }
    }
  }
  
  private createIsolatedContext(context: TemplateContext): SafeTemplateContext {
    return {
      // Only expose safe, sanitized data
      variables: this.sanitizeVariables(context.variables),
      functions: this.createSafeFunctions(),
      constants: context.constants,
      
      // Restrict dangerous operations
      require: undefined,
      process: undefined,
      global: undefined,
      Buffer: undefined,
      
      // Provide safe alternatives
      console: this.createSafeConsole(),
      JSON: this.createSafeJSON()
    };
  }
}
```

### Input Validation and Sanitization

```typescript
// input-validator.ts
export class InputValidator {
  private sanitizers: Map<string, Sanitizer>;
  private validators: Map<string, Validator>;
  
  constructor() {
    this.initializeSanitizers();
    this.initializeValidators();
  }
  
  async validateAndSanitize(
    input: any, 
    schema: ValidationSchema
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      sanitizedData: null,
      errors: [],
      warnings: []
    };
    
    try {
      // 1. Type validation
      const typeValidation = await this.validateType(input, schema.type);
      if (!typeValidation.valid) {
        result.valid = false;
        result.errors.push(...typeValidation.errors);
      }
      
      // 2. Format validation
      if (schema.format) {
        const formatValidation = await this.validateFormat(input, schema.format);
        if (!formatValidation.valid) {
          result.valid = false;
          result.errors.push(...formatValidation.errors);
        }
      }
      
      // 3. Security validation
      const securityValidation = await this.validateSecurity(input, schema.security);
      if (!securityValidation.valid) {
        result.valid = false;
        result.errors.push(...securityValidation.errors);
      }
      
      // 4. Sanitization
      let sanitizedData = input;
      if (schema.sanitize && result.errors.length === 0) {
        sanitizedData = await this.sanitizeInput(input, schema.sanitize);
      }
      
      result.sanitizedData = sanitizedData;
      return result;
      
    } catch (error) {
      return {
        valid: false,
        sanitizedData: null,
        errors: [`Validation error: ${error.message}`],
        warnings: []
      };
    }
  }
  
  private async validateSecurity(
    input: any, 
    securityConfig?: SecurityValidationConfig
  ): Promise<ValidationResult> {
    if (!securityConfig) {
      return { valid: true, errors: [], warnings: [] };
    }
    
    const errors: string[] = [];
    
    // Check for SQL injection patterns
    if (securityConfig.checkSQLInjection) {
      if (this.containsSQLInjection(input)) {
        errors.push('Potential SQL injection detected');
      }
    }
    
    // Check for XSS patterns
    if (securityConfig.checkXSS) {
      if (this.containsXSS(input)) {
        errors.push('Potential XSS payload detected');
      }
    }
    
    // Check for command injection
    if (securityConfig.checkCommandInjection) {
      if (this.containsCommandInjection(input)) {
        errors.push('Potential command injection detected');
      }
    }
    
    // Check for path traversal
    if (securityConfig.checkPathTraversal) {
      if (this.containsPathTraversal(input)) {
        errors.push('Potential path traversal detected');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }
  
  private containsSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /('|(\-\-)|(;)|(\||\||)|(\*|\*|)|(%27)|(')|(\+)|(,))/i,
      /(exec|execute|insert|select|delete|update|count|master|truncate|declare|create|drop)/i,
      /(script|javascript|vbscript|iframe|frame|frameset|object|embed)/i
    ];
    
    return sqlPatterns.some(pattern => pattern.test(input));
  }
  
  private containsXSS(input: string): boolean {
    const xssPatterns = [
      /<script[^>]*>[\s\S]*?<\/script>/gi,
      /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<[^>]*\son\w+\s*=[^>]*>/gi
    ];
    
    return xssPatterns.some(pattern => pattern.test(input));
  }
}
```

## 5. Security Monitoring and Incident Response

### Security Event Monitoring

```typescript
// security-monitor.ts
export class SecurityMonitor {
  private eventStore: SecurityEventStore;
  private alerting: AlertingSystem;
  private analyzer: SecurityAnalyzer;
  private responseSystem: IncidentResponseSystem;
  
  async processSecurityEvent(event: SecurityEvent): Promise<void> {
    // Store event for analysis
    await this.eventStore.store(event);
    
    // Real-time threat analysis
    const threatAnalysis = await this.analyzer.analyzeThreat(event);
    
    // Determine if immediate response is needed
    if (threatAnalysis.riskLevel >= RiskLevel.HIGH) {
      await this.handleHighRiskEvent(event, threatAnalysis);
    }
    
    // Check for patterns and anomalies
    const patterns = await this.analyzer.detectPatterns(event);
    if (patterns.length > 0) {
      await this.handleSecurityPatterns(patterns);
    }
    
    // Update security posture metrics
    await this.updateSecurityMetrics(event, threatAnalysis);
  }
  
  private async handleHighRiskEvent(
    event: SecurityEvent, 
    analysis: ThreatAnalysis
  ): Promise<void> {
    // Immediate containment actions
    const containmentActions = await this.determineContainmentActions(event, analysis);
    
    for (const action of containmentActions) {
      try {
        await this.executeContainmentAction(action);
        
        await this.auditLogger.log({
          type: 'CONTAINMENT_ACTION_EXECUTED',
          action: action.type,
          event: event.id,
          timestamp: new Date(),
          success: true
        });
      } catch (error) {
        await this.auditLogger.log({
          type: 'CONTAINMENT_ACTION_FAILED',
          action: action.type,
          event: event.id,
          error: error.message,
          timestamp: new Date(),
          success: false
        });
      }
    }
    
    // Generate security alert
    await this.alerting.sendAlert({
      severity: analysis.riskLevel,
      title: `High-Risk Security Event: ${event.type}`,
      description: analysis.description,
      event,
      containmentActions,
      recommendedActions: analysis.recommendations
    });
    
    // Initiate incident response
    await this.responseSystem.createIncident({
      event,
      analysis,
      containmentActions,
      severity: analysis.riskLevel
    });
  }
  
  private async determineContainmentActions(
    event: SecurityEvent,
    analysis: ThreatAnalysis
  ): Promise<ContainmentAction[]> {
    const actions: ContainmentAction[] = [];
    
    switch (event.type) {
      case 'BRUTE_FORCE_ATTACK':
        actions.push({
          type: 'RATE_LIMIT_INCREASE',
          target: event.sourceIP,
          duration: 3600000, // 1 hour
          parameters: { maxRequests: 1, windowMs: 60000 }
        });
        
        if (analysis.confidence > 0.9) {
          actions.push({
            type: 'IP_BLOCK',
            target: event.sourceIP,
            duration: 86400000, // 24 hours
            reason: 'Brute force attack detection'
          });
        }
        break;
        
      case 'SUSPICIOUS_TEMPLATE_EXECUTION':
        actions.push({
          type: 'TEMPLATE_QUARANTINE',
          target: event.templateId,
          reason: 'Suspicious template behavior detected'
        });
        
        actions.push({
          type: 'USER_SESSION_INVALIDATE',
          target: event.userId,
          reason: 'Template security incident'
        });
        break;
        
      case 'DATA_EXFILTRATION_ATTEMPT':
        actions.push({
          type: 'USER_ACCOUNT_SUSPEND',
          target: event.userId,
          reason: 'Data exfiltration attempt detected'
        });
        
        actions.push({
          type: 'NETWORK_ISOLATION',
          target: event.sourceIP,
          duration: 3600000, // 1 hour
          reason: 'Potential data breach'
        });
        break;
    }
    
    return actions;
  }
}
```

## 6. Compliance and Governance

### GDPR Compliance Implementation

```typescript
// gdpr-compliance.ts
export class GDPRComplianceManager {
  private dataProcessor: PersonalDataProcessor;
  private consentManager: ConsentManager;
  private rightsManager: DataSubjectRightsManager;
  private auditLogger: AuditLogger;
  
  async processPersonalData(
    data: any, 
    processing: ProcessingContext
  ): Promise<ProcessingResult> {
    // 1. Verify legal basis (Article 6)
    const legalBasis = await this.verifyLegalBasis(data, processing);
    if (!legalBasis.valid) {
      throw new GDPRViolationError(
        'No valid legal basis for processing personal data',
        'GDPR-6.1'
      );
    }
    
    // 2. Check for special category data (Article 9)
    if (this.containsSpecialCategoryData(data)) {
      const specialCategoryBasis = await this.verifySpecialCategoryBasis(data, processing);
      if (!specialCategoryBasis.valid) {
        throw new GDPRViolationError(
          'No valid legal basis for processing special category data',
          'GDPR-9.1'
        );
      }
    }
    
    // 3. Apply data minimization (Article 5.1.c)
    const minimizedData = await this.dataProcessor.minimize(data, processing.purpose);
    
    // 4. Check retention limits (Article 5.1.e)
    const retentionCheck = await this.checkRetentionLimits(minimizedData, processing);
    if (!retentionCheck.compliant) {
      await this.handleRetentionViolation(minimizedData, retentionCheck);
    }
    
    // 5. Apply purpose limitation (Article 5.1.b)
    const purposeLimitationCheck = await this.verifyPurposeLimitation(
      minimizedData, 
      processing.originalPurpose, 
      processing.currentPurpose
    );
    
    if (!purposeLimitationCheck.compliant) {
      throw new GDPRViolationError(
        'Processing violates purpose limitation principle',
        'GDPR-5.1b'
      );
    }
    
    // 6. Log processing activity (Article 30)
    await this.auditLogger.logProcessingActivity({
      dataSubject: processing.dataSubject,
      purpose: processing.purpose,
      legalBasis: legalBasis.basis,
      dataCategories: this.categorizeData(minimizedData),
      recipients: processing.recipients,
      timestamp: new Date(),
      retentionPeriod: processing.retentionPeriod
    });
    
    return {
      processedData: minimizedData,
      legalBasis,
      complianceStatus: 'COMPLIANT',
      processingRecord: await this.createProcessingRecord(processing)
    };
  }
  
  async handleDataSubjectRequest(request: DataSubjectRequest): Promise<DataSubjectResponse> {
    // Verify identity of data subject
    const identity = await this.verifyDataSubjectIdentity(request.identity);
    if (!identity.verified) {
      return {
        status: 'IDENTITY_VERIFICATION_FAILED',
        message: 'Could not verify identity of data subject'
      };
    }
    
    switch (request.type) {
      case 'ACCESS': // Article 15
        return await this.handleAccessRequest(request);
        
      case 'RECTIFICATION': // Article 16
        return await this.handleRectificationRequest(request);
        
      case 'ERASURE': // Article 17 (Right to be forgotten)
        return await this.handleErasureRequest(request);
        
      case 'PORTABILITY': // Article 20
        return await this.handlePortabilityRequest(request);
        
      case 'RESTRICTION': // Article 18
        return await this.handleRestrictionRequest(request);
        
      case 'OBJECTION': // Article 21
        return await this.handleObjectionRequest(request);
        
      default:
        return {
          status: 'UNSUPPORTED_REQUEST_TYPE',
          message: `Request type '${request.type}' is not supported`
        };
    }
  }
  
  private async handleErasureRequest(request: DataSubjectRequest): Promise<DataSubjectResponse> {
    // Verify grounds for erasure (Article 17.1)
    const erasureGrounds = await this.verifyErasureGrounds(request);
    if (!erasureGrounds.valid) {
      return {
        status: 'ERASURE_NOT_APPLICABLE',
        message: 'No valid grounds for erasure',
        details: erasureGrounds.reasons
      };
    }
    
    // Check for exemptions (Article 17.3)
    const exemptions = await this.checkErasureExemptions(request);
    if (exemptions.applicable) {
      return {
        status: 'ERASURE_EXEMPTION_APPLIES',
        message: 'Erasure request cannot be fulfilled due to applicable exemptions',
        details: exemptions.exemptions
      };
    }
    
    // Perform data erasure
    const erasureResult = await this.rightsManager.erasePersonalData(request.dataSubject);
    
    // Notify third parties if data was disclosed (Article 17.2)
    if (erasureResult.disclosedTo.length > 0) {
      await this.notifyThirdPartiesOfErasure(erasureResult.disclosedTo, request.dataSubject);
    }
    
    return {
      status: 'ERASURE_COMPLETED',
      message: 'Personal data has been erased',
      details: {
        erasedRecords: erasureResult.recordsErased,
        thirdPartiesNotified: erasureResult.disclosedTo.length
      }
    };
  }
}
```

This comprehensive security architecture ensures that Unjucks can operate safely in enterprise environments while maintaining compliance with major regulatory frameworks and protecting against modern cybersecurity threats.