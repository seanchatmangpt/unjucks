# User Management System Completion - Integration and Deployment

## 1. System Integration

### 1.1 Service Integration Architecture

```typescript
interface IntegrationStrategy {
  internalServices: {
    communication: "gRPC for internal, REST for external",
    serviceDiscovery: "Kubernetes service mesh with Istio",
    loadBalancing: "Round-robin with health checks",
    circuitBreakers: "Hystrix pattern for fault tolerance"
  },
  
  externalIntegrations: {
    identityProviders: ["Google OAuth", "GitHub OAuth", "Microsoft AD"],
    notificationServices: ["SendGrid", "Twilio", "Firebase"],
    securityServices: ["Auth0", "Okta", "AWS Cognito"],
    monitoringServices: ["DataDog", "New Relic", "Sentry"]
  },
  
  dataIntegration: {
    eventSourcing: "Event store for audit trails",
    cdc: "Change data capture for data sync",
    replication: "Multi-region database replication"
  }
}
```

### 1.2 External Identity Provider Integration

#### 1.2.1 OAuth 2.0 Integration Service

```typescript
// OAuth provider integration
class OAuthIntegrationService {
  private providers: Map<string, OAuthProvider>;
  
  constructor() {
    this.setupProviders();
  }
  
  private setupProviders(): void {
    this.providers.set('google', new GoogleOAuthProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
      scopes: ['openid', 'email', 'profile']
    }));
    
    this.providers.set('github', new GitHubOAuthProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      redirectUri: process.env.GITHUB_REDIRECT_URI,
      scopes: ['user:email', 'read:user']
    }));
    
    this.providers.set('microsoft', new MicrosoftOAuthProvider({
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      redirectUri: process.env.MICROSOFT_REDIRECT_URI,
      scopes: ['openid', 'email', 'profile']
    }));
  }
  
  async initiateOAuthFlow(provider: string, state: string): Promise<AuthorizationUrl> {
    const oauthProvider = this.providers.get(provider);
    if (!oauthProvider) {
      throw new UnsupportedProviderError(`Provider ${provider} is not supported`);
    }
    
    // Generate secure state parameter
    const secureState = await this.generateSecureState(state);
    
    // Store state for validation
    await this.stateRepository.saveState(secureState, {
      provider,
      originalState: state,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });
    
    return await oauthProvider.getAuthorizationUrl(secureState);
  }
  
  async handleOAuthCallback(
    provider: string,
    code: string,
    state: string
  ): Promise<ExternalUser> {
    // Validate state parameter
    const stateData = await this.stateRepository.findByState(state);
    if (!stateData || stateData.expiresAt < new Date()) {
      throw new InvalidStateError('Invalid or expired OAuth state');
    }
    
    const oauthProvider = this.providers.get(provider);
    if (!oauthProvider) {
      throw new UnsupportedProviderError(`Provider ${provider} is not supported`);
    }
    
    try {
      // Exchange code for tokens
      const tokens = await oauthProvider.exchangeCodeForTokens(code);
      
      // Fetch user information
      const userInfo = await oauthProvider.fetchUserInfo(tokens.accessToken);
      
      // Clean up state
      await this.stateRepository.deleteState(state);
      
      return {
        provider,
        externalId: userInfo.id,
        email: userInfo.email,
        firstName: userInfo.given_name || userInfo.name?.split(' ')[0],
        lastName: userInfo.family_name || userInfo.name?.split(' ').slice(1).join(' '),
        avatarUrl: userInfo.picture,
        emailVerified: userInfo.email_verified || false,
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt
        }
      };
      
    } catch (error) {
      await this.auditService.logOAuthError(provider, error);
      throw new OAuthAuthenticationError(`OAuth authentication failed: ${error.message}`);
    }
  }
  
  async linkExternalAccount(userId: string, externalUser: ExternalUser): Promise<void> {
    // Check if external account is already linked
    const existingLink = await this.externalAccountRepository.findByProviderAndExternalId(
      externalUser.provider,
      externalUser.externalId
    );
    
    if (existingLink && existingLink.userId !== userId) {
      throw new AccountAlreadyLinkedError('External account is already linked to another user');
    }
    
    // Create or update link
    const accountLink = {
      userId,
      provider: externalUser.provider,
      externalId: externalUser.externalId,
      email: externalUser.email,
      displayName: `${externalUser.firstName} ${externalUser.lastName}`,
      avatarUrl: externalUser.avatarUrl,
      linkedAt: new Date(),
      lastSyncAt: new Date()
    };
    
    await this.externalAccountRepository.upsert(accountLink);
    
    // Log account linking
    await this.auditService.logAccountLink(userId, externalUser.provider);
  }
}
```

#### 1.2.2 Single Sign-On Integration

```typescript
// SAML 2.0 SSO Integration
class SAMLSSOService {
  private samlProviders: Map<string, SAMLProvider>;
  
  constructor() {
    this.setupSAMLProviders();
  }
  
  private setupSAMLProviders(): void {
    // Enterprise SAML providers
    this.samlProviders.set('okta', new OktaSAMLProvider({
      issuer: process.env.OKTA_ISSUER,
      ssoUrl: process.env.OKTA_SSO_URL,
      certificate: process.env.OKTA_CERTIFICATE,
      callbackUrl: `${process.env.BASE_URL}/auth/saml/okta/callback`
    }));
    
    this.samlProviders.set('azure-ad', new AzureADSAMLProvider({
      tenantId: process.env.AZURE_TENANT_ID,
      clientId: process.env.AZURE_CLIENT_ID,
      certificate: process.env.AZURE_CERTIFICATE,
      callbackUrl: `${process.env.BASE_URL}/auth/saml/azure/callback`
    }));
  }
  
  async generateSAMLRequest(provider: string, relayState?: string): Promise<SAMLRequest> {
    const samlProvider = this.samlProviders.get(provider);
    if (!samlProvider) {
      throw new UnsupportedProviderError(`SAML provider ${provider} not configured`);
    }
    
    const requestId = generateUniqueId();
    const request = await samlProvider.generateAuthRequest(requestId, relayState);
    
    // Store request for validation
    await this.samlRequestRepository.save({
      id: requestId,
      provider,
      relayState,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    });
    
    return request;
  }
  
  async processSAMLResponse(provider: string, samlResponse: string): Promise<SAMLUser> {
    const samlProvider = this.samlProviders.get(provider);
    if (!samlProvider) {
      throw new UnsupportedProviderError(`SAML provider ${provider} not configured`);
    }
    
    try {
      // Validate and parse SAML response
      const parsedResponse = await samlProvider.validateAndParseResponse(samlResponse);
      
      // Validate request/response correlation
      const originalRequest = await this.samlRequestRepository.findById(parsedResponse.inResponseTo);
      if (!originalRequest || originalRequest.expiresAt < new Date()) {
        throw new InvalidSAMLResponseError('Invalid or expired SAML request correlation');
      }
      
      // Extract user attributes
      const samlUser: SAMLUser = {
        nameId: parsedResponse.nameId,
        email: parsedResponse.attributes.email || parsedResponse.nameId,
        firstName: parsedResponse.attributes.firstName,
        lastName: parsedResponse.attributes.lastName,
        displayName: parsedResponse.attributes.displayName,
        groups: parsedResponse.attributes.groups || [],
        attributes: parsedResponse.attributes,
        sessionIndex: parsedResponse.sessionIndex,
        provider
      };
      
      // Clean up request
      await this.samlRequestRepository.deleteById(parsedResponse.inResponseTo);
      
      return samlUser;
      
    } catch (error) {
      await this.auditService.logSAMLError(provider, error);
      throw new SAMLAuthenticationError(`SAML authentication failed: ${error.message}`);
    }
  }
  
  async initiateSAMLLogout(userId: string, sessionId: string): Promise<LogoutRequest> {
    const userSessions = await this.sessionRepository.findSAMLSessions(userId);
    const logoutRequests = [];
    
    for (const session of userSessions) {
      if (session.samlProvider && session.samlSessionIndex) {
        const samlProvider = this.samlProviders.get(session.samlProvider);
        if (samlProvider) {
          const logoutRequest = await samlProvider.generateLogoutRequest({
            nameId: session.samlNameId,
            sessionIndex: session.samlSessionIndex,
            reason: 'user'
          });
          
          logoutRequests.push(logoutRequest);
        }
      }
    }
    
    return logoutRequests;
  }
}
```

### 1.3 Notification Service Integration

#### 1.3.1 Multi-Channel Notification Service

```typescript
// Comprehensive notification service
class NotificationService {
  private emailProvider: EmailProvider;
  private smsProvider: SMSProvider;
  private pushProvider: PushProvider;
  private templateEngine: TemplateEngine;
  
  constructor() {
    this.setupProviders();
    this.templateEngine = new HandlebarsTemplateEngine();
  }
  
  private setupProviders(): void {
    this.emailProvider = new SendGridProvider({
      apiKey: process.env.SENDGRID_API_KEY,
      defaultFrom: process.env.DEFAULT_FROM_EMAIL,
      templatePath: './templates/email'
    });
    
    this.smsProvider = new TwilioProvider({
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.TWILIO_FROM_NUMBER
    });
    
    this.pushProvider = new FirebasePushProvider({
      serverKey: process.env.FIREBASE_SERVER_KEY,
      projectId: process.env.FIREBASE_PROJECT_ID
    });
  }
  
  async sendWelcomeEmail(user: User, verificationToken: string): Promise<void> {
    const template = 'welcome';
    const templateData = {
      user: {
        firstName: user.profile.firstName,
        email: user.email
      },
      verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`,
      supportUrl: process.env.SUPPORT_URL,
      companyName: process.env.COMPANY_NAME
    };
    
    await this.emailProvider.sendTemplateEmail({
      to: user.email,
      template,
      data: templateData,
      tags: ['welcome', 'verification'],
      trackingId: `welcome-${user.id}`
    });
    
    // Log notification
    await this.logNotification({
      userId: user.id,
      type: 'email',
      template,
      recipient: user.email,
      status: 'sent',
      sentAt: new Date()
    });
  }
  
  async sendSecurityAlert(user: User, alertType: SecurityAlertType, details: any): Promise<void> {
    // Determine notification channels based on user preferences
    const preferences = await this.getNotificationPreferences(user.id);
    const channels = this.determineChannels(alertType, preferences);
    
    const notifications = [];
    
    // Email notification
    if (channels.includes('email')) {
      notifications.push(
        this.sendSecurityEmailAlert(user, alertType, details)
      );
    }
    
    // SMS notification for critical alerts
    if (channels.includes('sms') && alertType === 'critical') {
      notifications.push(
        this.sendSecuritySMSAlert(user, alertType, details)
      );
    }
    
    // Push notification
    if (channels.includes('push')) {
      notifications.push(
        this.sendSecurityPushAlert(user, alertType, details)
      );
    }
    
    await Promise.allSettled(notifications);
  }
  
  private async sendSecurityEmailAlert(
    user: User,
    alertType: SecurityAlertType,
    details: any
  ): Promise<void> {
    const template = `security-alert-${alertType}`;
    const templateData = {
      user: { firstName: user.profile.firstName },
      alert: {
        type: alertType,
        timestamp: new Date().toISOString(),
        location: details.location,
        ipAddress: details.ipAddress,
        device: details.device,
        action: details.action
      },
      securityUrl: `${process.env.FRONTEND_URL}/security`,
      supportUrl: process.env.SUPPORT_URL
    };
    
    await this.emailProvider.sendTemplateEmail({
      to: user.email,
      template,
      data: templateData,
      priority: alertType === 'critical' ? 'high' : 'normal',
      tags: ['security', alertType],
      trackingId: `security-${alertType}-${user.id}-${Date.now()}`
    });
  }
  
  async sendMFACode(user: User, method: MFAMethod, code: string): Promise<void> {
    switch (method) {
      case 'sms':
        await this.sendMFASMS(user, code);
        break;
      case 'email':
        await this.sendMFAEmail(user, code);
        break;
      default:
        throw new UnsupportedMFAMethodError(`MFA method ${method} not supported`);
    }
  }
  
  private async sendMFASMS(user: User, code: string): Promise<void> {
    const mfaPhone = await this.getMFAPhoneNumber(user.id);
    if (!mfaPhone) {
      throw new MissingMFAPhoneError('No phone number configured for MFA');
    }
    
    const message = `Your ${process.env.COMPANY_NAME} verification code is: ${code}. This code expires in 5 minutes.`;
    
    await this.smsProvider.sendSMS({
      to: mfaPhone,
      message,
      type: 'mfa'
    });
    
    await this.logNotification({
      userId: user.id,
      type: 'sms',
      recipient: maskPhoneNumber(mfaPhone),
      status: 'sent',
      sentAt: new Date(),
      metadata: { purpose: 'mfa' }
    });
  }
  
  async sendBulkNotification(
    userIds: string[],
    template: string,
    data: any,
    channels: NotificationChannel[]
  ): Promise<BulkNotificationResult> {
    const batchSize = 100;
    const results = {
      total: userIds.length,
      successful: 0,
      failed: 0,
      errors: []
    };
    
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (userId) => {
        try {
          const user = await this.userRepository.findById(userId);
          if (!user) {
            throw new UserNotFoundError(`User ${userId} not found`);
          }
          
          // Send notification on each channel
          const channelPromises = channels.map(channel =>
            this.sendChannelNotification(user, template, data, channel)
          );
          
          await Promise.all(channelPromises);
          results.successful++;
          
        } catch (error) {
          results.failed++;
          results.errors.push({
            userId,
            error: error.message
          });
        }
      });
      
      await Promise.allSettled(batchPromises);
      
      // Rate limiting between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }
}
```

## 2. Deployment Strategy

### 2.1 Kubernetes Deployment Configuration

#### 2.1.1 Core Service Deployments

```yaml
# k8s/auth-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: user-management
  labels:
    app: auth-service
    version: v1.0.0
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
        version: v1.0.0
    spec:
      serviceAccountName: auth-service-sa
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 2000
      containers:
      - name: auth-service
        image: user-management/auth-service:1.0.0
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 3000
          name: http
          protocol: TCP
        env:
        - name: NODE_ENV
          value: production
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: connection-string
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: connection-string
        - name: JWT_PRIVATE_KEY
          valueFrom:
            secretKeyRef:
              name: jwt-secret
              key: private-key
        - name: JWT_PUBLIC_KEY
          valueFrom:
            secretKeyRef:
              name: jwt-secret
              key: public-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "200m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          failureThreshold: 3
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL

---
apiVersion: v1
kind: Service
metadata:
  name: auth-service
  namespace: user-management
spec:
  selector:
    app: auth-service
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
  type: ClusterIP

---
# Auto-scaling configuration
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: auth-service-hpa
  namespace: user-management
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: auth-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

#### 2.1.2 Security and Secrets Management

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: database-secret
  namespace: user-management
type: Opaque
stringData:
  connection-string: "postgresql://username:password@postgres:5432/userdb?sslmode=require"

---
apiVersion: v1
kind: Secret
metadata:
  name: jwt-secret
  namespace: user-management
type: Opaque
data:
  private-key: LS0tLS1CRUdJTi... # Base64 encoded RSA private key
  public-key: LS0tLS1CRUdJTi...  # Base64 encoded RSA public key

---
# Service Account with RBAC
apiVersion: v1
kind: ServiceAccount
metadata:
  name: auth-service-sa
  namespace: user-management

---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: auth-service-role
  namespace: user-management
rules:
- apiGroups: [""]
  resources: ["secrets"]
  resourceNames: ["database-secret", "redis-secret", "jwt-secret"]
  verbs: ["get"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: auth-service-binding
  namespace: user-management
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: auth-service-role
subjects:
- kind: ServiceAccount
  name: auth-service-sa
  namespace: user-management

---
# Network Policy for security
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: auth-service-netpol
  namespace: user-management
spec:
  podSelector:
    matchLabels:
      app: auth-service
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: api-gateway
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to: []
    ports:
    - protocol: TCP
      port: 5432  # PostgreSQL
    - protocol: TCP
      port: 6379  # Redis
    - protocol: TCP
      port: 443   # HTTPS outbound
    - protocol: TCP
      port: 53    # DNS
    - protocol: UDP
      port: 53    # DNS
```

### 2.2 Continuous Deployment Pipeline

#### 2.2.1 GitOps Deployment Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy User Management System

on:
  push:
    branches: [main]
    paths: ['src/**', 'k8s/**', 'Dockerfile']
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        default: 'staging'
        type: choice
        options:
        - staging
        - production

env:
  REGISTRY: ghcr.io
  IMAGE_BASE: ghcr.io/${{ github.repository }}

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      image-digest: ${{ steps.build.outputs.digest }}
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run type checking
      run: npm run type-check
    
    - name: Run unit tests
      run: npm run test:unit
      env:
        NODE_ENV: test
    
    - name: Run integration tests
      run: npm run test:integration
      env:
        NODE_ENV: test
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/testdb
        REDIS_URL: redis://localhost:6379
    
    - name: Generate test coverage
      run: npm run test:coverage
    
    - name: Security scan
      run: |
        npm audit --audit-level moderate
        npm run security:scan
    
    - name: Build Docker image
      id: build
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        tags: ${{ env.IMAGE_BASE }}:${{ github.sha }}
        labels: |
          org.opencontainers.image.title=User Management System
          org.opencontainers.image.description=Secure authentication and user management
          org.opencontainers.image.version=${{ github.sha }}
          org.opencontainers.image.source=${{ github.repositoryUrl }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  security-scan:
    needs: build-and-test
    runs-on: ubuntu-latest
    
    steps:
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: ${{ env.IMAGE_BASE }}:${{ github.sha }}
        format: 'sarif'
        output: 'trivy-results.sarif'
        severity: 'CRITICAL,HIGH'
        exit-code: '1'
    
    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      if: always()
      with:
        sarif_file: 'trivy-results.sarif'

  deploy-staging:
    needs: [build-and-test, security-scan]
    runs-on: ubuntu-latest
    environment: staging
    if: github.ref == 'refs/heads/main' || github.event.inputs.environment == 'staging'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.28.0'
    
    - name: Deploy to staging
      run: |
        # Update image tags in manifests
        sed -i "s|image: .*|image: ${{ env.IMAGE_BASE }}:${{ github.sha }}|g" k8s/staging/*.yaml
        
        # Apply manifests
        kubectl apply -f k8s/staging/ --namespace=user-management-staging
        
        # Wait for rollout
        kubectl rollout status deployment/auth-service -n user-management-staging --timeout=300s
        kubectl rollout status deployment/profile-service -n user-management-staging --timeout=300s
    
    - name: Run smoke tests
      run: |
        # Wait for services to be ready
        sleep 30
        
        # Run smoke tests against staging
        npm run test:smoke -- --env=staging
        
        # Run security tests
        npm run test:security -- --env=staging

  deploy-production:
    needs: [build-and-test, security-scan, deploy-staging]
    runs-on: ubuntu-latest
    environment: production
    if: github.ref == 'refs/heads/main' && github.event.inputs.environment == 'production'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Blue-Green Deployment
      run: |
        # Determine current environment (blue/green)
        CURRENT_ENV=$(kubectl get service auth-service-active -o jsonpath='{.spec.selector.environment}' -n user-management-prod)
        TARGET_ENV=$([ "$CURRENT_ENV" = "blue" ] && echo "green" || echo "blue")
        
        echo "Deploying to $TARGET_ENV environment"
        
        # Deploy to target environment
        sed -i "s|image: .*|image: ${{ env.IMAGE_BASE }}:${{ github.sha }}|g" k8s/production/*.yaml
        sed -i "s|environment: .*|environment: $TARGET_ENV|g" k8s/production/*.yaml
        
        kubectl apply -f k8s/production/ --namespace=user-management-prod
        
        # Wait for deployment
        kubectl rollout status deployment/auth-service-$TARGET_ENV -n user-management-prod --timeout=600s
        
        # Run health checks
        ./scripts/health-check.sh $TARGET_ENV
        
        # Gradual traffic switch
        ./scripts/traffic-switch.sh $CURRENT_ENV $TARGET_ENV
        
        # Final validation
        ./scripts/production-validation.sh
        
        echo "Deployment to production completed successfully"
```

### 2.3 Security Hardening

#### 2.3.1 Runtime Security Configuration

```typescript
// Security middleware configuration
class SecurityMiddleware {
  static configureExpress(app: Express): void {
    // Security headers
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        }
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));
    
    // CORS configuration
    app.use(cors({
      origin: (origin, callback) => {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));
    
    // Rate limiting with Redis
    const rateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rl_',
      points: 100, // Number of requests
      duration: 60, // Per 60 seconds
      blockDuration: 60, // Block for 60 seconds if limit exceeded
      execEvenly: true
    });
    
    app.use(async (req, res, next) => {
      try {
        await rateLimiter.consume(req.ip);
        next();
      } catch (rejRes) {
        const totalHits = rejRes.totalHits;
        const timeToReset = rejRes.msBeforeNext;
        
        res.status(429).json({
          error: 'Too Many Requests',
          retryAfter: Math.ceil(timeToReset / 1000)
        });
      }
    });
    
    // Request size limiting
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request timeout
    app.use(timeout('30s'));
    
    // IP filtering for admin endpoints
    app.use('/admin', (req, res, next) => {
      const allowedIPs = process.env.ADMIN_ALLOWED_IPS?.split(',') || [];
      const clientIP = req.ip;
      
      if (allowedIPs.length && !allowedIPs.includes(clientIP)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      next();
    });
  }
  
  static configureSecurityMonitoring(app: Express): void {
    // Security event monitoring
    app.use((req, res, next) => {
      // Log suspicious patterns
      const suspiciousPatterns = [
        /\b(union|select|insert|delete|drop|exec|script)\b/i,
        /<script|javascript:|vbscript:|onload=|onerror=/i,
        /\.\.\//,
        /\/etc\/passwd|\/etc\/shadow/,
        /__proto__|constructor\.prototype/
      ];
      
      const requestContent = JSON.stringify({
        url: req.url,
        query: req.query,
        body: req.body,
        headers: req.headers
      });
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(requestContent)) {
          SecurityEventLogger.logSuspiciousRequest(req, pattern.source);
          break;
        }
      }
      
      next();
    });
    
    // Failed authentication attempts monitoring
    app.on('authenticationFailed', (event) => {
      SecurityEventLogger.logFailedAuthentication(event);
      
      // Trigger additional security measures for repeated failures
      if (event.consecutiveFailures > 10) {
        SecurityEventLogger.triggerSecurityAlert('brute_force_detected', event);
      }
    });
    
    // Suspicious activity detection
    app.use((req, res, next) => {
      if (req.user) {
        SecurityAnalyzer.analyzeRequest(req.user.id, {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method
        });
      }
      next();
    });
  }
}
```

#### 2.3.2 Container Security Hardening

```dockerfile
# Multi-stage security-focused Dockerfile
FROM node:18-alpine AS base
RUN apk add --no-cache dumb-init
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

FROM node:18-alpine AS runtime
# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeuser -u 1001

# Security: Install security updates only
RUN apk add --no-cache --upgrade \
    && rm -rf /var/cache/apk/*

# Security: Set up secure directories
WORKDIR /app
RUN chown nodeuser:nodejs /app

# Copy built application
COPY --from=build --chown=nodeuser:nodejs /app/dist ./dist
COPY --from=base --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodeuser:nodejs /app/package*.json ./

# Security: Remove unnecessary packages and files
RUN apk del --purge \
    && rm -rf /var/cache/apk/* \
    && rm -rf /tmp/* \
    && rm -rf /root/.npm

# Security: Set proper permissions
RUN chmod -R 755 /app
RUN chmod -R 644 /app/dist

# Security: Switch to non-root user
USER nodeuser

# Security: Expose only necessary port
EXPOSE 3000

# Security: Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

# Security: Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/health-check.js
```

## 3. Monitoring and Observability

### 3.1 Comprehensive Monitoring Setup

#### 3.1.1 Prometheus Metrics Configuration

```typescript
// Advanced metrics collection
class MetricsCollector {
  private static instance: MetricsCollector;
  private registry: Registry;
  
  private constructor() {
    this.registry = new Registry();
    this.setupMetrics();
    this.setupDefaultMetrics();
  }
  
  private setupMetrics(): void {
    // Authentication metrics
    this.authenticationAttempts = new Counter({
      name: 'authentication_attempts_total',
      help: 'Total authentication attempts by status and method',
      labelNames: ['status', 'method', 'provider', 'risk_level'],
      registers: [this.registry]
    });
    
    this.authenticationDuration = new Histogram({
      name: 'authentication_duration_seconds',
      help: 'Authentication request duration in seconds',
      labelNames: ['method', 'status'],
      buckets: [0.1, 0.2, 0.5, 1, 2, 5, 10],
      registers: [this.registry]
    });
    
    // Session metrics
    this.activeSessionsGauge = new Gauge({
      name: 'active_sessions_current',
      help: 'Current number of active user sessions',
      labelNames: ['type'],
      registers: [this.registry]
    });
    
    this.sessionDuration = new Histogram({
      name: 'session_duration_seconds',
      help: 'User session duration in seconds',
      buckets: [60, 300, 900, 1800, 3600, 7200, 14400, 28800],
      registers: [this.registry]
    });
    
    // Security metrics
    this.securityEvents = new Counter({
      name: 'security_events_total',
      help: 'Security events detected',
      labelNames: ['event_type', 'severity', 'user_id'],
      registers: [this.registry]
    });
    
    this.mfaChallenges = new Counter({
      name: 'mfa_challenges_total',
      help: 'MFA challenges by method and outcome',
      labelNames: ['method', 'status'],
      registers: [this.registry]
    });
    
    // Performance metrics
    this.databaseOperations = new Histogram({
      name: 'database_operation_duration_seconds',
      help: 'Database operation duration',
      labelNames: ['operation', 'table', 'status'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry]
    });
    
    this.cacheOperations = new Counter({
      name: 'cache_operations_total',
      help: 'Cache operations by type and result',
      labelNames: ['operation', 'result', 'cache_type'],
      registers: [this.registry]
    });
    
    // Business metrics
    this.userRegistrations = new Counter({
      name: 'user_registrations_total',
      help: 'User registrations by method and completion status',
      labelNames: ['method', 'status', 'source'],
      registers: [this.registry]
    });
    
    this.passwordResets = new Counter({
      name: 'password_resets_total',
      help: 'Password reset attempts by status',
      labelNames: ['status', 'method'],
      registers: [this.registry]
    });
  }
  
  private setupDefaultMetrics(): void {
    // Collect default Node.js metrics
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'user_management_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
    });
  }
  
  // Method to record authentication metrics
  recordAuthentication(
    status: 'success' | 'failure' | 'mfa_required',
    method: string,
    provider?: string,
    riskLevel?: string,
    duration?: number
  ): void {
    this.authenticationAttempts.inc({
      status,
      method,
      provider: provider || 'internal',
      risk_level: riskLevel || 'low'
    });
    
    if (duration) {
      this.authenticationDuration.observe({ method, status }, duration);
    }
  }
  
  // Method to update session metrics
  updateSessions(activeSessions: number, sessionType: string = 'standard'): void {
    this.activeSessionsGauge.set({ type: sessionType }, activeSessions);
  }
  
  recordSessionEnd(duration: number): void {
    this.sessionDuration.observe(duration);
  }
  
  // Security event recording
  recordSecurityEvent(
    eventType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    userId?: string
  ): void {
    this.securityEvents.inc({
      event_type: eventType,
      severity,
      user_id: userId || 'anonymous'
    });
  }
  
  // Database operation tracking
  recordDatabaseOperation(
    operation: string,
    table: string,
    status: 'success' | 'error',
    duration: number
  ): void {
    this.databaseOperations.observe({ operation, table, status }, duration);
  }
  
  // Get metrics for Prometheus scraping
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
```

#### 3.1.2 Alerting Rules Configuration

```yaml
# prometheus/alerts.yml
groups:
- name: user-management.authentication
  rules:
  - alert: HighAuthenticationFailureRate
    expr: |
      (
        rate(authentication_attempts_total{status="failure"}[5m]) /
        rate(authentication_attempts_total[5m])
      ) > 0.1
    for: 2m
    labels:
      severity: warning
      service: user-management
    annotations:
      summary: "High authentication failure rate detected"
      description: "Authentication failure rate is {{ $value | humanizePercentage }} over the last 5 minutes"
      runbook_url: "https://docs.company.com/runbooks/auth-failure-rate"
      
  - alert: CriticalSecurityEvent
    expr: increase(security_events_total{severity="critical"}[5m]) > 0
    for: 0m
    labels:
      severity: critical
      service: user-management
    annotations:
      summary: "Critical security event detected"
      description: "Critical security event: {{ $labels.event_type }}"
      runbook_url: "https://docs.company.com/runbooks/security-incident"
      
  - alert: AuthenticationServiceDown
    expr: up{job="auth-service"} == 0
    for: 1m
    labels:
      severity: critical
      service: user-management
    annotations:
      summary: "Authentication service is down"
      description: "Authentication service {{ $labels.instance }} has been down for more than 1 minute"
      runbook_url: "https://docs.company.com/runbooks/service-down"

- name: user-management.performance
  rules:
  - alert: HighAuthenticationLatency
    expr: |
      histogram_quantile(0.95, 
        rate(authentication_duration_seconds_bucket[5m])
      ) > 1
    for: 5m
    labels:
      severity: warning
      service: user-management
    annotations:
      summary: "High authentication latency"
      description: "95th percentile authentication latency is {{ $value }}s"
      runbook_url: "https://docs.company.com/runbooks/high-latency"
      
  - alert: DatabaseConnectionExhaustion
    expr: |
      (
        sum(database_connections_active) /
        sum(database_connections_max)
      ) > 0.9
    for: 2m
    labels:
      severity: critical
      service: user-management
    annotations:
      summary: "Database connection pool near exhaustion"
      description: "Database connection usage is at {{ $value | humanizePercentage }}"
      runbook_url: "https://docs.company.com/runbooks/db-connections"

- name: user-management.business
  rules:
  - alert: UserRegistrationSpike
    expr: |
      rate(user_registrations_total[5m]) > 
      (avg_over_time(rate(user_registrations_total[5m])[1h:5m]) * 5)
    for: 10m
    labels:
      severity: warning
      service: user-management
    annotations:
      summary: "Unusual spike in user registrations"
      description: "Registration rate is {{ $value }} registrations/sec, 5x normal rate"
      runbook_url: "https://docs.company.com/runbooks/registration-spike"
      
  - alert: MFAFailureSpike
    expr: |
      rate(mfa_challenges_total{status="failure"}[5m]) > 10
    for: 5m
    labels:
      severity: warning
      service: user-management
    annotations:
      summary: "High MFA failure rate"
      description: "MFA failure rate is {{ $value }} failures/sec"
      runbook_url: "https://docs.company.com/runbooks/mfa-failures"
```

### 3.2 Production Readiness Validation

#### 3.2.1 Health Check Implementation

```typescript
// Comprehensive health check system
class HealthCheckService {
  private checks: Map<string, HealthCheck> = new Map();
  
  constructor() {
    this.registerHealthChecks();
  }
  
  private registerHealthChecks(): void {
    // Database connectivity
    this.checks.set('database', new DatabaseHealthCheck());
    this.checks.set('redis', new RedisHealthCheck());
    
    // External services
    this.checks.set('email_service', new EmailServiceHealthCheck());
    this.checks.set('sms_service', new SMSServiceHealthCheck());
    
    // Internal services
    this.checks.set('auth_service', new AuthServiceHealthCheck());
    this.checks.set('profile_service', new ProfileServiceHealthCheck());
    
    // Security services
    this.checks.set('rate_limiter', new RateLimiterHealthCheck());
    this.checks.set('token_validation', new TokenValidationHealthCheck());
  }
  
  async runHealthChecks(): Promise<HealthCheckResult> {
    const results = new Map<string, CheckResult>();
    const promises = Array.from(this.checks.entries()).map(async ([name, check]) => {
      try {
        const result = await Promise.race([
          check.execute(),
          new Promise<CheckResult>((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 5000)
          )
        ]);
        results.set(name, result);
      } catch (error) {
        results.set(name, {
          status: 'unhealthy',
          message: error.message,
          timestamp: new Date()
        });
      }
    });
    
    await Promise.all(promises);
    
    const overallStatus = Array.from(results.values()).every(r => r.status === 'healthy')
      ? 'healthy'
      : 'unhealthy';
    
    return {
      status: overallStatus,
      timestamp: new Date(),
      checks: Object.fromEntries(results),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || 'unknown'
    };
  }
  
  async runReadinessCheck(): Promise<ReadinessResult> {
    // Critical services that must be ready for traffic
    const criticalChecks = ['database', 'redis', 'auth_service'];
    
    const results = await Promise.all(
      criticalChecks.map(async (checkName) => {
        const check = this.checks.get(checkName);
        if (!check) {
          return { name: checkName, ready: false, error: 'Check not found' };
        }
        
        try {
          const result = await check.execute();
          return { 
            name: checkName, 
            ready: result.status === 'healthy',
            message: result.message 
          };
        } catch (error) {
          return { 
            name: checkName, 
            ready: false, 
            error: error.message 
          };
        }
      })
    );
    
    const allReady = results.every(r => r.ready);
    
    return {
      ready: allReady,
      timestamp: new Date(),
      checks: results
    };
  }
}

// Database health check implementation
class DatabaseHealthCheck implements HealthCheck {
  async execute(): Promise<CheckResult> {
    try {
      const start = Date.now();
      
      // Test connection with simple query
      await database.raw('SELECT 1');
      
      const duration = Date.now() - start;
      
      // Check connection pool status
      const poolStats = database.client.pool.stats;
      
      if (poolStats.pendingAcquires > 10) {
        return {
          status: 'degraded',
          message: `High pending connections: ${poolStats.pendingAcquires}`,
          timestamp: new Date(),
          metadata: { duration, poolStats }
        };
      }
      
      return {
        status: 'healthy',
        message: `Database responsive in ${duration}ms`,
        timestamp: new Date(),
        metadata: { duration, poolStats }
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database connection failed: ${error.message}`,
        timestamp: new Date()
      };
    }
  }
}
```

This completion phase ensures the user management system is fully integrated, properly deployed with security hardening, and equipped with comprehensive monitoring and observability for production operations.