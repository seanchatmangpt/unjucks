# Chapter 6: Deployment - Modern Deployment Patterns

## The Evolution of Code Generation Deployment

Deploying code generation systems in 2026 encompasses far more than simply installing a tool on developer machines. Modern deployment patterns must address distributed teams, multi-environment workflows, continuous integration pipelines, and the seamless integration of generation tools into existing development ecosystems.

This chapter explores advanced deployment strategies that ensure code generation tools like Unjucks can be reliably deployed, scaled, and maintained across diverse organizational structures and technical environments. We'll examine patterns for local development, team collaboration, CI/CD integration, and enterprise-scale deployments.

## Deployment Architecture Principles

### 1. Multi-Tier Deployment Strategy

Modern code generation deployment follows a multi-tier architecture:

```typescript
// Deployment tier definitions
enum DeploymentTier {
  DEVELOPMENT = 'development',     // Local developer machines
  INTEGRATION = 'integration',     // Team integration environments
  STAGING = 'staging',            // Pre-production testing
  PRODUCTION = 'production',      // Live production systems
  EDGE = 'edge'                   // Distributed edge locations
}

interface DeploymentConfiguration {
  tier: DeploymentTier;
  
  // Environment-specific settings
  environment: {
    nodeVersion: string;
    packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
    cachingStrategy: 'local' | 'distributed' | 'hybrid';
    telemetry: boolean;
    debugging: boolean;
  };
  
  // Resource allocation
  resources: {
    cpu: string;          // e.g., '2 cores', '4000m'
    memory: string;       // e.g., '4Gi', '8192Mi'
    storage: string;      // e.g., '10Gi', 'unlimited'
    network: string;      // e.g., 'fast', 'standard'
  };
  
  // Security configuration
  security: {
    sandboxed: boolean;
    allowedRegistries: string[];
    secretsProvider: 'env' | 'vault' | 'k8s-secrets';
    networkPolicies: SecurityPolicy[];
  };
  
  // Scaling parameters
  scaling: {
    horizontal: boolean;
    minInstances: number;
    maxInstances: number;
    targetCPU: number;
    targetMemory: number;
  };
}
```

### 2. Infrastructure as Code (IaC)

Define deployment infrastructure using code:

```typescript
// Terraform configuration for Unjucks deployment
interface TerraformDeployment {
  provider: {
    aws: {
      region: string;
      version: string;
    };
  };
  
  modules: {
    unjucks_cluster: {
      source: './modules/unjucks-cluster';
      
      // Cluster configuration
      cluster_name: string;
      node_count: number;
      instance_type: string;
      
      // Networking
      vpc_id: string;
      subnet_ids: string[];
      
      // Security
      security_groups: string[];
      iam_roles: string[];
      
      // Storage
      storage_class: 'gp3' | 'io2' | 'efs';
      storage_size: string;
      
      // Monitoring
      monitoring_enabled: boolean;
      logging_level: 'debug' | 'info' | 'warn' | 'error';
    };
    
    unjucks_registry: {
      source: './modules/template-registry';
      
      // Registry configuration
      registry_type: 'npm' | 'docker' | 'git';
      storage_backend: 's3' | 'gcs' | 'azure-blob';
      
      // Access control
      authentication: 'token' | 'oauth' | 'saml';
      authorization: 'rbac' | 'acl';
      
      // Caching
      cache_enabled: boolean;
      cache_ttl: string;
    };
  };
}

// Kubernetes deployment manifests
const unjucksDeployment = {
  apiVersion: 'apps/v1',
  kind: 'Deployment',
  metadata: {
    name: 'unjucks-service',
    namespace: 'code-generation',
    labels: {
      app: 'unjucks',
      version: 'v2.1.0',
      tier: 'generation'
    }
  },
  
  spec: {
    replicas: 3,
    strategy: {
      type: 'RollingUpdate',
      rollingUpdate: {
        maxUnavailable: 1,
        maxSurge: 1
      }
    },
    
    selector: {
      matchLabels: {
        app: 'unjucks'
      }
    },
    
    template: {
      metadata: {
        labels: {
          app: 'unjucks',
          version: 'v2.1.0'
        }
      },
      
      spec: {
        containers: [{
          name: 'unjucks',
          image: 'unjucks/unjucks:2.1.0',
          
          ports: [{
            containerPort: 3000,
            name: 'http'
          }],
          
          env: [
            {
              name: 'NODE_ENV',
              value: 'production'
            },
            {
              name: 'REGISTRY_URL',
              valueFrom: {
                configMapKeyRef: {
                  name: 'unjucks-config',
                  key: 'registry.url'
                }
              }
            },
            {
              name: 'API_KEY',
              valueFrom: {
                secretKeyRef: {
                  name: 'unjucks-secrets',
                  key: 'api.key'
                }
              }
            }
          ],
          
          resources: {
            requests: {
              cpu: '500m',
              memory: '1Gi'
            },
            limits: {
              cpu: '2000m',
              memory: '4Gi'
            }
          },
          
          livenessProbe: {
            httpGet: {
              path: '/health',
              port: 3000
            },
            initialDelaySeconds: 30,
            periodSeconds: 10
          },
          
          readinessProbe: {
            httpGet: {
              path: '/ready',
              port: 3000
            },
            initialDelaySeconds: 5,
            periodSeconds: 5
          }
        }],
        
        volumes: [{
          name: 'template-cache',
          emptyDir: {
            sizeLimit: '10Gi'
          }
        }]
      }
    }
  }
};
```

## Local Development Deployment

### 1. Developer Environment Setup

Streamlined setup for individual developers:

```typescript
// Development environment configuration
interface DeveloperSetup {
  // Automatic dependency detection and installation
  dependencies: {
    autoDetect: boolean;
    packageManagers: ('npm' | 'yarn' | 'pnpm' | 'bun')[];
    nodeVersions: string[];
    globalPackages: string[];
  };
  
  // IDE integration
  ide: {
    vscode: {
      extensions: string[];
      settings: Record<string, any>;
      tasks: VSCodeTask[];
      launch: VSCodeLaunch[];
    };
    
    jetbrains: {
      plugins: string[];
      configurations: Record<string, any>;
    };
    
    vim: {
      plugins: string[];
      configuration: string;
    };
  };
  
  // Local services
  services: {
    templateRegistry: boolean;
    codeValidation: boolean;
    performanceMonitoring: boolean;
    collaborationTools: boolean;
  };
}

// Automated setup script
class DeveloperEnvironmentSetup {
  async setupEnvironment(config: DeveloperSetup): Promise<void> {
    console.log('🚀 Setting up Unjucks development environment...');
    
    // Step 1: Verify system requirements
    await this.verifySystemRequirements();
    
    // Step 2: Install Node.js and package manager
    await this.setupNodeEnvironment(config.dependencies);
    
    // Step 3: Install Unjucks CLI
    await this.installUnjucksCLI();
    
    // Step 4: Configure IDE integration
    await this.setupIDEIntegration(config.ide);
    
    // Step 5: Initialize project structure
    await this.initializeProject();
    
    // Step 6: Setup local services
    await this.setupLocalServices(config.services);
    
    // Step 7: Verify installation
    await this.verifyInstallation();
    
    console.log('✅ Development environment setup complete!');
    console.log('Run `unjucks --help` to get started');
  }
  
  private async verifySystemRequirements(): Promise<void> {
    const requirements = [
      { name: 'Node.js', version: '>=18.0.0', command: 'node --version' },
      { name: 'Git', version: '>=2.0.0', command: 'git --version' },
      { name: 'Docker', version: '>=20.0.0', command: 'docker --version', optional: true }
    ];
    
    for (const req of requirements) {
      try {
        const version = await execAsync(req.command);
        console.log(`✅ ${req.name}: ${version.trim()}`);
      } catch (error) {
        if (req.optional) {
          console.log(`⚠️  ${req.name}: Not installed (optional)`);
        } else {
          throw new Error(`❌ ${req.name} is required but not installed`);
        }
      }
    }
  }
  
  private async setupNodeEnvironment(deps: DeveloperSetup['dependencies']): Promise<void> {
    // Auto-detect preferred package manager
    const packageManager = deps.autoDetect 
      ? await this.detectPackageManager()
      : deps.packageManagers[0];
    
    console.log(`📦 Using ${packageManager} as package manager`);
    
    // Install global dependencies
    for (const pkg of deps.globalPackages) {
      await execAsync(`${packageManager} install -g ${pkg}`);
    }
  }
  
  private async setupIDEIntegration(ide: DeveloperSetup['ide']): Promise<void> {
    // VSCode setup
    if (ide.vscode && await this.isVSCodeInstalled()) {
      await this.setupVSCode(ide.vscode);
    }
    
    // JetBrains setup
    if (ide.jetbrains && await this.isJetBrainsInstalled()) {
      await this.setupJetBrains(ide.jetbrains);
    }
    
    // Vim setup
    if (ide.vim && await this.isVimInstalled()) {
      await this.setupVim(ide.vim);
    }
  }
}

// Package manager detection
const detectPackageManager = async (): Promise<string> => {
  const lockFiles = {
    'pnpm-lock.yaml': 'pnpm',
    'yarn.lock': 'yarn',
    'package-lock.json': 'npm',
    'bun.lockb': 'bun'
  };
  
  for (const [lockFile, manager] of Object.entries(lockFiles)) {
    if (await fileExists(lockFile)) {
      return manager;
    }
  }
  
  // Default to pnpm (fastest in 2026)
  return 'pnpm';
};
```

### 2. Hot Reloading and Development Server

Real-time template development with instant feedback:

```typescript
// Development server with hot reloading
class UnjucksDevelopmentServer {
  private watcher: FSWatcher;
  private clients: WebSocket[] = [];
  private templateCache = new Map<string, CompiledTemplate>();
  
  constructor(private config: DevServerConfig) {}
  
  async start(): Promise<void> {
    console.log('🔥 Starting Unjucks development server...');
    
    // Start HTTP server
    const app = express();
    const server = createServer(app);
    const wss = new WebSocketServer({ server });
    
    // WebSocket connection for live updates
    wss.on('connection', (ws) => {
      this.clients.push(ws);
      ws.on('close', () => {
        this.clients = this.clients.filter(client => client !== ws);
      });
    });
    
    // API endpoints
    app.use('/api', this.createAPIRoutes());
    app.use('/', express.static('public'));
    
    // File watcher for templates
    this.setupFileWatcher();
    
    server.listen(this.config.port, () => {
      console.log(`🚀 Development server running on http://localhost:${this.config.port}`);
      console.log('📂 Template directory:', this.config.templatesPath);
      console.log('👁️  Watching for changes...');
    });
  }
  
  private setupFileWatcher(): void {
    this.watcher = chokidar.watch([
      this.config.templatesPath,
      this.config.configPath
    ], {
      ignored: /node_modules/,
      persistent: true,
      ignoreInitial: true
    });
    
    this.watcher
      .on('change', (path) => this.handleFileChange(path))
      .on('add', (path) => this.handleFileAdd(path))
      .on('unlink', (path) => this.handleFileDelete(path));
  }
  
  private async handleFileChange(filePath: string): Promise<void> {
    console.log(`📝 File changed: ${filePath}`);
    
    try {
      // Invalidate cache
      this.templateCache.delete(filePath);
      
      // Recompile template
      if (filePath.endsWith('.njk') || filePath.endsWith('.yml')) {
        const template = await this.compileTemplate(filePath);
        this.templateCache.set(filePath, template);
        
        // Notify connected clients
        this.broadcast({
          type: 'template-updated',
          path: filePath,
          timestamp: Date.now()
        });
        
        console.log(`✅ Template recompiled: ${filePath}`);
      }
      
      // Handle configuration changes
      if (filePath.includes('unjucks.config')) {
        await this.reloadConfiguration();
        this.broadcast({
          type: 'config-updated',
          timestamp: Date.now()
        });
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
      
      this.broadcast({
        type: 'compilation-error',
        path: filePath,
        error: error.message,
        timestamp: Date.now()
      });
    }
  }
  
  private createAPIRoutes(): express.Router {
    const router = express.Router();
    
    // List available templates
    router.get('/templates', async (req, res) => {
      const templates = await this.discoverTemplates();
      res.json(templates);
    });
    
    // Generate preview
    router.post('/generate/preview', async (req, res) => {
      const { template, variables } = req.body;
      
      try {
        const result = await this.generatePreview(template, variables);
        res.json({ success: true, result });
      } catch (error) {
        res.status(400).json({ 
          success: false, 
          error: error.message 
        });
      }
    });
    
    // Validate template
    router.post('/validate', async (req, res) => {
      const { template, variables } = req.body;
      
      try {
        const validation = await this.validateTemplate(template, variables);
        res.json(validation);
      } catch (error) {
        res.status(400).json({ 
          valid: false, 
          errors: [error.message] 
        });
      }
    });
    
    return router;
  }
  
  private broadcast(message: any): void {
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
}

// Development server configuration
interface DevServerConfig {
  port: number;
  templatesPath: string;
  configPath: string;
  
  features: {
    hotReload: boolean;
    preview: boolean;
    validation: boolean;
    debugging: boolean;
  };
  
  proxy: {
    enabled: boolean;
    target?: string;
    changeOrigin?: boolean;
  };
}
```

## Team Collaboration Deployment

### 1. Shared Template Registry

Centralized template sharing and versioning:

```typescript
// Template registry service
class TemplateRegistryService {
  constructor(private config: RegistryConfig) {}
  
  async publishTemplate(template: TemplatePackage): Promise<void> {
    // Validate template
    const validation = await this.validateTemplate(template);
    if (!validation.valid) {
      throw new TemplateValidationError(validation.errors);
    }
    
    // Version management
    const version = await this.generateVersion(template);
    template.version = version;
    
    // Store template
    await this.storeTemplate(template);
    
    // Update registry index
    await this.updateRegistryIndex(template);
    
    // Notify subscribers
    await this.notifySubscribers({
      type: 'template-published',
      template: template.name,
      version: template.version,
      author: template.author
    });
    
    console.log(`📦 Published ${template.name}@${template.version}`);
  }
  
  async installTemplate(name: string, version?: string): Promise<void> {
    const templateInfo = await this.resolveTemplate(name, version);
    
    if (!templateInfo) {
      throw new Error(`Template ${name} not found`);
    }
    
    // Download template package
    const packageData = await this.downloadTemplate(templateInfo);
    
    // Install dependencies
    await this.installDependencies(packageData);
    
    // Setup local configuration
    await this.setupLocalConfiguration(packageData);
    
    console.log(`✅ Installed ${name}@${templateInfo.version}`);
  }
  
  async searchTemplates(query: TemplateSearchQuery): Promise<TemplateSearchResult[]> {
    const searchIndex = await this.getSearchIndex();
    
    return searchIndex
      .filter(template => this.matchesQuery(template, query))
      .sort((a, b) => this.scoreTemplate(b, query) - this.scoreTemplate(a, query));
  }
  
  private async validateTemplate(template: TemplatePackage): Promise<ValidationResult> {
    const validators = [
      this.validateMetadata,
      this.validateSyntax,
      this.validateSecurity,
      this.validateCompatibility,
      this.validateDocumentation
    ];
    
    const results = await Promise.all(
      validators.map(validator => validator(template))
    );
    
    const errors = results.flatMap(result => result.errors);
    const warnings = results.flatMap(result => result.warnings || []);
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Team collaboration features
interface TeamCollaboration {
  // Shared workspaces
  workspaces: {
    name: string;
    members: TeamMember[];
    permissions: WorkspacePermissions;
    templates: string[];
    configurations: SharedConfiguration[];
  }[];
  
  // Review and approval workflows
  reviewWorkflow: {
    enabled: boolean;
    requiredReviewers: number;
    autoApprovalRules: ApprovalRule[];
    notificationChannels: NotificationChannel[];
  };
  
  // Usage analytics
  analytics: {
    templateUsage: UsageMetrics[];
    generationStats: GenerationStats;
    performanceMetrics: PerformanceMetrics;
    errorReports: ErrorReport[];
  };
  
  // Integration with team tools
  integrations: {
    slack: SlackIntegration;
    teams: TeamsIntegration;
    jira: JiraIntegration;
    github: GitHubIntegration;
  };
}
```

### 2. Collaborative Template Development

Version control and collaborative editing for templates:

```typescript
// Git-based template collaboration
class TemplateCollaboration {
  constructor(private gitService: GitService) {}
  
  async createTemplateRepository(config: TemplateRepoConfig): Promise<Repository> {
    const repo = await this.gitService.createRepository({
      name: `${config.name}-templates`,
      description: `Template repository for ${config.name}`,
      private: config.private,
      
      // Initialize with template structure
      initialFiles: [
        {
          path: 'README.md',
          content: this.generateReadme(config)
        },
        {
          path: '.gitignore',
          content: this.generateGitignore()
        },
        {
          path: 'unjucks.config.ts',
          content: this.generateConfig(config)
        },
        {
          path: 'templates/.gitkeep',
          content: ''
        },
        {
          path: '.github/workflows/template-ci.yml',
          content: this.generateCIWorkflow(config)
        }
      ]
    });
    
    // Setup branch protection
    await this.setupBranchProtection(repo);
    
    // Configure webhooks
    await this.setupWebhooks(repo, config);
    
    return repo;
  }
  
  async submitTemplateChange(change: TemplateChange): Promise<PullRequest> {
    // Create feature branch
    const branchName = `template/${change.templateName}/${change.type}`;
    await this.gitService.createBranch(change.repository, branchName);
    
    // Apply changes
    const files = await this.applyChanges(change);
    await this.gitService.commitFiles(change.repository, branchName, files, {
      message: `${change.type}: ${change.description}`,
      author: change.author
    });
    
    // Create pull request
    const pr = await this.gitService.createPullRequest({
      repository: change.repository,
      
      head: branchName,
      base: 'main',
      
      title: `${change.type}: Update ${change.templateName}`,
      body: this.generatePRDescription(change),
      
      labels: [change.type, 'template-update'],
      assignees: change.reviewers,
      
      // Auto-trigger template validation
      checks: ['template-validation', 'security-scan', 'compatibility-test']
    });
    
    return pr;
  }
  
  private async setupBranchProtection(repo: Repository): Promise<void> {
    await this.gitService.setBranchProtection(repo, 'main', {
      required_status_checks: {
        strict: true,
        contexts: [
          'template-validation',
          'security-scan',
          'compatibility-test'
        ]
      },
      
      enforce_admins: true,
      required_pull_request_reviews: {
        required_approving_review_count: 2,
        dismiss_stale_reviews: true,
        require_code_owner_reviews: true
      },
      
      restrictions: null
    });
  }
  
  private generateCIWorkflow(config: TemplateRepoConfig): string {
    return `
name: Template CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  validate-templates:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20.x'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Validate template syntax
        run: pnpm unjucks validate --all
      
      - name: Test template generation
        run: pnpm test:templates
      
      - name: Security scan
        run: pnpm security:scan
      
      - name: Compatibility test
        run: pnpm test:compatibility

  publish-templates:
    if: github.ref == 'refs/heads/main'
    needs: validate-templates
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20.x'
      
      - name: Publish to registry
        run: pnpm unjucks publish --registry ${{ secrets.TEMPLATE_REGISTRY_URL }}
        env:
          REGISTRY_TOKEN: ${{ secrets.REGISTRY_TOKEN }}
    `;
  }
}
```

## CI/CD Integration

### 1. Pipeline Integration Patterns

Integrate code generation into build and deployment pipelines:

```typescript
// CI/CD pipeline integration
interface PipelineIntegration {
  // Pre-build generation
  prebuild: {
    enabled: boolean;
    templates: string[];
    conditions: PipelineCondition[];
    caching: CachingStrategy;
  };
  
  // Build-time generation
  buildtime: {
    enabled: boolean;
    parallelization: boolean;
    resourceLimits: ResourceLimits;
    artifactStorage: ArtifactStorageConfig;
  };
  
  // Post-build validation
  postbuild: {
    validation: ValidationConfig;
    qualityGates: QualityGate[];
    notifications: NotificationConfig;
  };
  
  // Deployment hooks
  deployment: {
    preDeployment: DeploymentHook[];
    postDeployment: DeploymentHook[];
    rollback: RollbackConfig;
  };
}

// GitHub Actions workflow for Unjucks integration
const createGitHubWorkflow = (config: PipelineIntegration): string => `
name: Build and Deploy with Code Generation

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20.x'
  PNPM_VERSION: '8.x'

jobs:
  generate-code:
    runs-on: ubuntu-latest
    
    outputs:
      generation-cache-key: \${{ steps.cache-key.outputs.key }}
      
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Generate cache key
        id: cache-key
        run: |
          echo "key=generation-\${{ hashFiles('templates/**/*', 'unjucks.config.ts') }}" >> $GITHUB_OUTPUT
      
      - name: Restore generation cache
        uses: actions/cache@v3
        with:
          path: .unjucks/cache
          key: \${{ steps.cache-key.outputs.key }}
          restore-keys: generation-
      
      - name: Generate code
        run: |
          pnpm unjucks generate --all --parallel --cache
          
      - name: Validate generated code
        run: |
          pnpm typecheck
          pnpm lint:generated
          pnpm test:generated
      
      - name: Upload generated artifacts
        uses: actions/upload-artifact@v3
        with:
          name: generated-code
          path: |
            src/generated/
            !src/generated/**/*.test.*
          retention-days: 30

  build:
    needs: generate-code
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        environment: [development, staging, production]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Download generated code
        uses: actions/download-artifact@v3
        with:
          name: generated-code
          path: src/generated/
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Build application
        run: pnpm build:\${{ matrix.environment }}
        env:
          ENVIRONMENT: \${{ matrix.environment }}
      
      - name: Run tests
        run: |
          pnpm test:unit
          pnpm test:integration
      
      - name: Quality gates
        run: |
          pnpm audit --audit-level moderate
          pnpm coverage:check --threshold 80
          pnpm performance:check
      
      - name: Build Docker image
        if: matrix.environment == 'production'
        run: |
          docker build -t myapp:\${{ github.sha }} .
          docker tag myapp:\${{ github.sha }} myapp:latest

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: [generate-code, build]
    runs-on: ubuntu-latest
    
    environment: production
    
    steps:
      - name: Deploy to production
        run: |
          # Deployment logic here
          echo "Deploying with generated code..."
          
      - name: Post-deployment validation
        run: |
          # Validation logic here
          echo "Validating deployment..."
          
      - name: Notify team
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: \${{ job.status }}
          channel: '#deployments'
          webhook_url: \${{ secrets.SLACK_WEBHOOK_URL }}
`;
```

### 2. Progressive Deployment Strategies

Implement safe deployment patterns for code generation changes:

```typescript
// Progressive deployment configuration
interface ProgressiveDeployment {
  strategy: 'blue-green' | 'canary' | 'rolling' | 'feature-flag';
  
  // Canary deployment settings
  canary: {
    enabled: boolean;
    stages: CanaryStage[];
    successCriteria: SuccessCriteria;
    rollbackTriggers: RollbackTrigger[];
  };
  
  // Feature flag integration
  featureFlags: {
    provider: 'launchdarkly' | 'split' | 'unleash' | 'custom';
    flags: FeatureFlagConfig[];
    audienceTargeting: AudienceConfig;
  };
  
  // Monitoring and observability
  monitoring: {
    metrics: MonitoringMetric[];
    alerts: AlertConfig[];
    dashboards: DashboardConfig[];
  };
}

// Canary deployment implementation
class CanaryDeployment {
  constructor(private config: ProgressiveDeployment) {}
  
  async deployWithCanary(deployment: DeploymentConfig): Promise<DeploymentResult> {
    const stages = this.config.canary.stages;
    const results: StageResult[] = [];
    
    for (const stage of stages) {
      console.log(`🚀 Starting canary stage: ${stage.name} (${stage.trafficPercentage}%)`);
      
      try {
        // Deploy to canary environment
        await this.deployToCanary(deployment, stage);
        
        // Monitor metrics
        const metrics = await this.monitorStage(stage);
        
        // Evaluate success criteria
        const success = await this.evaluateSuccessCriteria(metrics, stage);
        
        if (!success) {
          throw new CanaryFailureError(`Stage ${stage.name} failed success criteria`);
        }
        
        results.push({
          stage: stage.name,
          success: true,
          metrics,
          duration: stage.duration
        });
        
        console.log(`✅ Canary stage ${stage.name} completed successfully`);
        
      } catch (error) {
        console.error(`❌ Canary stage ${stage.name} failed:`, error.message);
        
        // Automatic rollback
        await this.rollbackDeployment(deployment, results);
        
        throw new DeploymentError(`Canary deployment failed at stage ${stage.name}`, {
          stage: stage.name,
          error: error.message,
          completedStages: results
        });
      }
    }
    
    // All stages successful - proceed with full deployment
    console.log('🎉 All canary stages successful, proceeding with full deployment');
    await this.deployToProduction(deployment);
    
    return {
      success: true,
      strategy: 'canary',
      stages: results,
      deploymentTime: new Date()
    };
  }
  
  private async monitorStage(stage: CanaryStage): Promise<StageMetrics> {
    const monitoringPeriod = stage.duration;
    const checkInterval = 30000; // 30 seconds
    const checks = Math.ceil(monitoringPeriod / checkInterval);
    
    const metrics: MetricDataPoint[] = [];
    
    for (let i = 0; i < checks; i++) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      
      const currentMetrics = await this.collectMetrics();
      metrics.push(currentMetrics);
      
      // Check for immediate failures
      if (currentMetrics.errorRate > stage.maxErrorRate) {
        throw new Error(`Error rate exceeded threshold: ${currentMetrics.errorRate}%`);
      }
      
      if (currentMetrics.responseTime > stage.maxResponseTime) {
        throw new Error(`Response time exceeded threshold: ${currentMetrics.responseTime}ms`);
      }
    }
    
    return this.aggregateMetrics(metrics);
  }
}

// Feature flag integration for gradual rollouts
class FeatureFlagDeployment {
  constructor(private flagProvider: FeatureFlagProvider) {}
  
  async deployWithFlags(features: FeatureDeployment[]): Promise<void> {
    for (const feature of features) {
      console.log(`🏳️  Deploying feature: ${feature.name}`);
      
      // Create feature flag
      await this.flagProvider.createFlag({
        key: feature.flagKey,
        name: feature.name,
        description: feature.description,
        defaultValue: false,
        
        // Initial targeting - only internal users
        targeting: {
          enabled: true,
          rules: [{
            conditions: [{
              attribute: 'userType',
              operator: 'equals',
              value: 'internal'
            }],
            percentage: 100,
            value: true
          }]
        }
      });
      
      // Gradual rollout schedule
      await this.scheduleGradualRollout(feature);
    }
  }
  
  private async scheduleGradualRollout(feature: FeatureDeployment): Promise<void> {
    const rolloutStages = [
      { percentage: 5, duration: '1h', audience: 'beta-users' },
      { percentage: 25, duration: '4h', audience: 'early-adopters' },
      { percentage: 50, duration: '8h', audience: 'standard-users' },
      { percentage: 100, duration: 'permanent', audience: 'all-users' }
    ];
    
    for (const stage of rolloutStages) {
      await this.scheduleStageRollout(feature, stage);
    }
  }
}
```

## Enterprise Deployment

### 1. Multi-Tenant Architecture

Support multiple teams and organizations:

```typescript
// Multi-tenant deployment architecture
interface MultiTenantDeployment {
  // Tenant isolation
  isolation: {
    level: 'namespace' | 'cluster' | 'account';
    networkPolicies: NetworkPolicy[];
    resourceQuotas: ResourceQuota[];
    securityPolicies: SecurityPolicy[];
  };
  
  // Shared services
  sharedServices: {
    templateRegistry: RegistryConfig;
    authenticationService: AuthConfig;
    monitoringService: MonitoringConfig;
    loggingService: LoggingConfig;
  };
  
  // Tenant-specific configurations
  tenants: {
    [tenantId: string]: TenantConfig;
  };
  
  // Cross-tenant features
  crossTenant: {
    templateSharing: boolean;
    collaborationTools: boolean;
    analytics: boolean;
    supportTicketing: boolean;
  };
}

// Tenant management system
class TenantManager {
  async provisionTenant(config: TenantProvisionConfig): Promise<Tenant> {
    console.log(`🏢 Provisioning tenant: ${config.name}`);
    
    // Step 1: Create tenant namespace
    const namespace = await this.createTenantNamespace(config);
    
    // Step 2: Setup resource quotas
    await this.setupResourceQuotas(namespace, config.resources);
    
    // Step 3: Deploy tenant-specific services
    await this.deployTenantServices(namespace, config);
    
    // Step 4: Configure networking and security
    await this.setupNetworkPolicies(namespace, config.security);
    
    // Step 5: Setup monitoring and logging
    await this.setupTenantMonitoring(namespace, config);
    
    // Step 6: Create tenant admin account
    const adminAccount = await this.createTenantAdmin(config);
    
    const tenant: Tenant = {
      id: config.id,
      name: config.name,
      namespace: namespace.name,
      adminAccount,
      status: 'active',
      createdAt: new Date(),
      
      endpoints: {
        api: `https://api.unjucks.com/tenants/${config.id}`,
        registry: `https://registry.unjucks.com/tenants/${config.id}`,
        dashboard: `https://dashboard.unjucks.com/tenants/${config.id}`
      },
      
      limits: config.resources,
      features: config.features
    };
    
    // Step 7: Store tenant configuration
    await this.storeTenantConfig(tenant);
    
    console.log(`✅ Tenant ${config.name} provisioned successfully`);
    return tenant;
  }
  
  async scaleTenant(tenantId: string, scaling: ScalingConfig): Promise<void> {
    const tenant = await this.getTenant(tenantId);
    
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }
    
    console.log(`📈 Scaling tenant: ${tenant.name}`);
    
    // Update resource quotas
    await this.updateResourceQuotas(tenant.namespace, scaling.resources);
    
    // Scale services
    if (scaling.services) {
      await this.scaleServices(tenant.namespace, scaling.services);
    }
    
    // Update monitoring
    await this.updateMonitoringConfig(tenant.namespace, scaling);
    
    console.log(`✅ Tenant ${tenant.name} scaled successfully`);
  }
}
```

### 2. High Availability and Disaster Recovery

Ensure reliable operation at enterprise scale:

```typescript
// High availability configuration
interface HighAvailabilityConfig {
  // Redundancy settings
  redundancy: {
    zones: string[];
    regions: string[];
    replicas: number;
    crossRegion: boolean;
  };
  
  // Load balancing
  loadBalancing: {
    algorithm: 'round-robin' | 'least-connections' | 'ip-hash';
    healthChecks: HealthCheckConfig[];
    sessionAffinity: boolean;
  };
  
  // Data replication
  dataReplication: {
    strategy: 'sync' | 'async' | 'semi-sync';
    replicas: number;
    backupSchedule: BackupSchedule;
  };
  
  // Failover configuration
  failover: {
    automatic: boolean;
    detectionThreshold: number;
    recoveryTime: number;
    rollbackStrategy: RollbackStrategy;
  };
}

// Disaster recovery implementation
class DisasterRecoveryManager {
  async createBackupStrategy(config: DRConfig): Promise<BackupStrategy> {
    return {
      // Template repository backups
      templateBackups: {
        frequency: 'hourly',
        retention: '90 days',
        destinations: ['s3', 'gcs', 'azure-blob'],
        encryption: 'AES-256'
      },
      
      // Configuration backups
      configBackups: {
        frequency: 'daily',
        retention: '1 year',
        versionControl: true,
        crossRegion: true
      },
      
      // Generated code artifacts
      artifactBackups: {
        frequency: 'on-change',
        retention: '30 days',
        compression: true,
        deduplication: true
      },
      
      // Database backups
      databaseBackups: {
        frequency: 'every 6 hours',
        retention: '180 days',
        pointInTimeRecovery: true,
        crossRegion: true
      }
    };
  }
  
  async executeFailover(failoverPlan: FailoverPlan): Promise<FailoverResult> {
    console.log('🚨 Executing disaster recovery failover...');
    
    const startTime = Date.now();
    
    try {
      // Step 1: Assess primary site status
      const primaryStatus = await this.assessPrimaryStatus();
      
      // Step 2: Prepare secondary site
      await this.prepareSecondarySite(failoverPlan);
      
      // Step 3: Update DNS and load balancer
      await this.redirectTraffic(failoverPlan.secondarySite);
      
      // Step 4: Start services on secondary site
      await this.startServices(failoverPlan.secondarySite);
      
      // Step 5: Verify system health
      const healthCheck = await this.performHealthCheck(failoverPlan.secondarySite);
      
      if (!healthCheck.healthy) {
        throw new Error('Secondary site health check failed');
      }
      
      const duration = Date.now() - startTime;
      
      console.log(`✅ Failover completed successfully in ${duration}ms`);
      
      return {
        success: true,
        duration,
        primarySite: failoverPlan.primarySite,
        secondarySite: failoverPlan.secondarySite,
        servicesRestored: healthCheck.services.length
      };
      
    } catch (error) {
      console.error('❌ Failover failed:', error.message);
      
      // Attempt rollback if possible
      if (primaryStatus.accessible) {
        await this.rollbackToPrimary(failoverPlan.primarySite);
      }
      
      throw new FailoverError('Disaster recovery failover failed', error);
    }
  }
}
```

## Monitoring and Observability

### 1. Comprehensive Monitoring Setup

Monitor all aspects of the code generation system:

```typescript
// Monitoring configuration
interface MonitoringSetup {
  // Metrics collection
  metrics: {
    collectors: MetricCollector[];
    retention: RetentionPolicy;
    aggregation: AggregationRule[];
  };
  
  // Logging configuration
  logging: {
    levels: LogLevel[];
    destinations: LogDestination[];
    structured: boolean;
    sampling: SamplingConfig;
  };
  
  // Distributed tracing
  tracing: {
    enabled: boolean;
    samplingRate: number;
    exporters: TracingExporter[];
  };
  
  // Alerting rules
  alerting: {
    rules: AlertingRule[];
    channels: AlertChannel[];
    escalation: EscalationPolicy;
  };
  
  // Dashboards
  dashboards: {
    operational: DashboardConfig;
    business: DashboardConfig;
    security: DashboardConfig;
    performance: DashboardConfig;
  };
}

// Prometheus metrics setup
const prometheusMetrics = {
  // Generation metrics
  template_generation_total: new prometheus.Counter({
    name: 'template_generation_total',
    help: 'Total number of template generations',
    labelNames: ['template', 'status', 'user', 'tenant']
  }),
  
  template_generation_duration: new prometheus.Histogram({
    name: 'template_generation_duration_seconds',
    help: 'Time spent generating templates',
    labelNames: ['template', 'complexity'],
    buckets: [0.1, 0.5, 1, 5, 10, 30, 60]
  }),
  
  template_compilation_errors: new prometheus.Counter({
    name: 'template_compilation_errors_total',
    help: 'Number of template compilation errors',
    labelNames: ['template', 'error_type']
  }),
  
  // System metrics
  active_users: new prometheus.Gauge({
    name: 'active_users',
    help: 'Number of active users',
    labelNames: ['tenant', 'time_window']
  }),
  
  registry_downloads: new prometheus.Counter({
    name: 'registry_downloads_total',
    help: 'Total template downloads from registry',
    labelNames: ['template', 'version', 'tenant']
  }),
  
  // Performance metrics
  cache_hit_ratio: new prometheus.Gauge({
    name: 'cache_hit_ratio',
    help: 'Template cache hit ratio',
    labelNames: ['cache_type']
  }),
  
  memory_usage: new prometheus.Gauge({
    name: 'memory_usage_bytes',
    help: 'Memory usage in bytes',
    labelNames: ['component']
  })
};

// Distributed tracing setup
class DistributedTracing {
  private tracer: Tracer;
  
  constructor() {
    this.tracer = trace.getTracer('unjucks', '2.1.0');
  }
  
  async traceTemplateGeneration(
    template: string,
    variables: any,
    generationFn: () => Promise<any>
  ): Promise<any> {
    return this.tracer.startActiveSpan('template.generation', async (span) => {
      span.setAttributes({
        'template.name': template,
        'template.variable_count': Object.keys(variables).length,
        'user.id': variables.userId || 'anonymous',
        'tenant.id': variables.tenantId || 'default'
      });
      
      try {
        // Trace template compilation
        const compiledTemplate = await this.tracer.startActiveSpan(
          'template.compilation',
          async (compilationSpan) => {
            compilationSpan.setAttributes({
              'template.size': template.length,
              'template.complexity': this.calculateComplexity(template)
            });
            
            return await compileTemplate(template);
          }
        );
        
        // Trace template rendering
        const result = await this.tracer.startActiveSpan(
          'template.rendering',
          async (renderSpan) => {
            renderSpan.setAttributes({
              'variables.count': Object.keys(variables).length,
              'variables.size': JSON.stringify(variables).length
            });
            
            return await generationFn();
          }
        );
        
        span.setAttributes({
          'generation.success': true,
          'generation.files_created': result.files.length,
          'generation.total_size': result.files.reduce((sum, f) => sum + f.content.length, 0)
        });
        
        return result;
        
      } catch (error) {
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        });
        
        throw error;
        
      } finally {
        span.end();
      }
    });
  }
}
```

### 2. Performance Optimization and Scaling

Optimize performance and handle scaling requirements:

```typescript
// Performance optimization strategies
class PerformanceOptimizer {
  async optimizeDeployment(config: OptimizationConfig): Promise<OptimizationResult> {
    const optimizations: Optimization[] = [];
    
    // Template compilation caching
    if (config.enableTemplateCache) {
      optimizations.push(await this.setupTemplateCache());
    }
    
    // Parallel generation
    if (config.enableParallelGeneration) {
      optimizations.push(await this.setupParallelProcessing());
    }
    
    // CDN for template registry
    if (config.enableCDN) {
      optimizations.push(await this.setupCDN());
    }
    
    // Database optimization
    if (config.optimizeDatabase) {
      optimizations.push(await this.optimizeDatabase());
    }
    
    // Memory management
    if (config.optimizeMemory) {
      optimizations.push(await this.setupMemoryManagement());
    }
    
    return {
      optimizations,
      estimatedImprovement: this.calculateImprovement(optimizations),
      cost: this.calculateCost(optimizations)
    };
  }
  
  private async setupTemplateCache(): Promise<Optimization> {
    // Redis-based distributed cache
    const cacheConfig = {
      type: 'redis-cluster',
      nodes: 3,
      maxMemory: '8gb',
      evictionPolicy: 'allkeys-lru',
      persistence: false,
      
      // Cache strategies
      strategies: {
        templateCompilation: {
          ttl: '24h',
          keyPattern: 'template:compiled:*'
        },
        
        generationResults: {
          ttl: '1h',
          keyPattern: 'generation:result:*',
          maxSize: '100mb'
        },
        
        configurationCache: {
          ttl: '6h',
          keyPattern: 'config:*'
        }
      }
    };
    
    await this.deployRedisCluster(cacheConfig);
    
    return {
      type: 'template-cache',
      description: 'Distributed template compilation cache',
      impact: {
        compilationTime: -85,  // 85% reduction
        memoryUsage: +15,      // 15% increase (cache overhead)
        networkTraffic: -60    // 60% reduction
      }
    };
  }
  
  private async setupParallelProcessing(): Promise<Optimization> {
    const parallelConfig = {
      maxWorkers: 8,
      queueSize: 1000,
      batchSize: 50,
      
      // Worker configuration
      workers: {
        cpu: '2000m',
        memory: '4Gi',
        concurrency: 4
      },
      
      // Queue management
      queue: {
        priority: true,
        deadLetterQueue: true,
        retryPolicy: {
          maxRetries: 3,
          backoff: 'exponential'
        }
      }
    };
    
    await this.deployWorkerPool(parallelConfig);
    
    return {
      type: 'parallel-processing',
      description: 'Parallel template generation workers',
      impact: {
        throughput: +300,      // 300% increase
        latency: -40,          // 40% reduction
        resourceUtilization: +25
      }
    };
  }
}

// Auto-scaling configuration
interface AutoScalingConfig {
  // Horizontal pod autoscaler
  hpa: {
    enabled: boolean;
    minReplicas: number;
    maxReplicas: number;
    
    metrics: {
      cpu: { target: 70 };
      memory: { target: 80 };
      custom: CustomMetricConfig[];
    };
  };
  
  // Vertical pod autoscaler
  vpa: {
    enabled: boolean;
    updateMode: 'off' | 'initial' | 'recreate' | 'auto';
    resourcePolicy: ResourcePolicyConfig;
  };
  
  // Cluster autoscaler
  ca: {
    enabled: boolean;
    minNodes: number;
    maxNodes: number;
    scaleDownDelay: string;
    scaleDownUtilization: number;
  };
}
```

## Conclusion

Modern deployment patterns for code generation systems require sophisticated approaches that address scalability, reliability, security, and developer experience across diverse environments and organizational structures. The patterns explored in this chapter provide:

1. **Multi-tier deployment architecture** for different environments and use cases
2. **Infrastructure as Code** for reproducible and version-controlled deployments
3. **Local development optimization** with hot reloading and real-time feedback
4. **Team collaboration features** including shared registries and review workflows
5. **CI/CD integration** with automated testing and validation
6. **Progressive deployment strategies** for safe rollouts
7. **Enterprise-grade features** including multi-tenancy and high availability
8. **Comprehensive monitoring** and observability
9. **Performance optimization** and auto-scaling capabilities

Key principles for modern deployment:

- **Automate everything** from local setup to production deployment
- **Embrace immutable infrastructure** with declarative configuration
- **Implement progressive delivery** to minimize risk
- **Design for scale** with multi-tenant architecture
- **Prioritize observability** for operational excellence
- **Optimize for developer experience** at every level
- **Ensure security** throughout the deployment pipeline
- **Plan for disaster recovery** and high availability

As code generation becomes more central to development workflows, these deployment patterns become essential for organizations seeking to scale their development practices while maintaining reliability and quality. The investment in sophisticated deployment infrastructure pays dividends in developer productivity, system reliability, and organizational agility.

The future of code generation deployment lies in intelligent systems that can self-optimize, automatically scale, and seamlessly integrate with the broader development ecosystem. The patterns outlined in this chapter provide the foundation for building such systems and preparing for the continued evolution of development practices in 2026 and beyond.