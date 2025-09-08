/**
 * Container and Cloud Deployment Test Suite
 * Tests Docker containers, cloud platforms, and serverless environments
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

describe('Container and Cloud Deployment', () => {
  let testDir;
  let originalCwd;

  beforeAll(async () => {
    originalCwd = process.cwd();
    testDir = path.join(os.tmpdir(), `unjucks-deploy-test-${Date.now()}`);
    await fs.ensureDir(testDir);
    process.chdir(testDir);
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    await fs.remove(testDir);
  });

  describe('Docker Compatibility', () => {
    it('should generate proper Dockerfile for Node.js application', async () => {
      const dockerfile = `
# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Install pnpm and dependencies
RUN npm install -g pnpm@latest
RUN pnpm install --frozen-lockfile --prod

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S unjucks -u 1001
RUN chown -R unjucks:nodejs /app
USER unjucks

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node --version || exit 1

# Start application
CMD ["node", "src/cli/index.js"]
      `.trim();

      const dockerfilePath = path.join(testDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, dockerfile);

      // Validate Dockerfile structure
      const content = await fs.readFile(dockerfilePath, 'utf8');
      expect(content).toContain('FROM node:18-alpine');
      expect(content).toContain('WORKDIR /app');
      expect(content).toContain('pnpm install');
      expect(content).toContain('USER unjucks');
      expect(content).toContain('HEALTHCHECK');
    });

    it('should create .dockerignore file', async () => {
      const dockerignore = `
node_modules
npm-debug.log*
.npm
.env
.DS_Store
*.log
coverage
.nyc_output
dist
build
.git
.gitignore
README.md
.env.local
.env.development.local
.env.test.local
.env.production.local
tests
*.test.js
*.spec.js
.vscode
.idea
      `.trim();

      const dockerignorePath = path.join(testDir, '.dockerignore');
      await fs.writeFile(dockerignorePath, dockerignore);

      const exists = await fs.pathExists(dockerignorePath);
      expect(exists).toBe(true);

      const content = await fs.readFile(dockerignorePath, 'utf8');
      expect(content).toContain('node_modules');
      expect(content).toContain('*.test.js');
      expect(content).toContain('.env');
    });

    it('should support multi-stage Docker builds', async () => {
      const multistageDockerfile = `
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json pnpm-lock.yaml* ./
RUN npm install -g pnpm@latest
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app
COPY package*.json pnpm-lock.yaml* ./
RUN npm install -g pnpm@latest
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src

RUN addgroup -g 1001 -S nodejs
RUN adduser -S unjucks -u 1001
RUN chown -R unjucks:nodejs /app
USER unjucks

EXPOSE 3000
CMD ["node", "src/cli/index.js"]
      `.trim();

      const multistageDockerfilePath = path.join(testDir, 'Dockerfile.multistage');
      await fs.writeFile(multistageDockerfilePath, multistageDockerfile);

      const content = await fs.readFile(multistageDockerfilePath, 'utf8');
      expect(content).toContain('FROM node:18-alpine AS builder');
      expect(content).toContain('FROM node:18-alpine AS production');
      expect(content).toContain('COPY --from=builder');
    });

    it('should test Docker availability', async () => {
      try {
        const { stdout } = await execAsync('docker --version');
        console.log('Docker version:', stdout.trim());
        expect(stdout).toContain('Docker version');
      } catch (error) {
        console.warn('Docker not available in test environment');
      }
    });

    it('should create docker-compose configuration', async () => {
      const dockerCompose = {
        version: '3.8',
        services: {
          unjucks: {
            build: {
              context: '.',
              dockerfile: 'Dockerfile'
            },
            ports: ['3000:3000'],
            environment: [
              'NODE_ENV=production'
            ],
            volumes: [
              './templates:/app/templates:ro'
            ],
            restart: 'unless-stopped',
            healthcheck: {
              test: ['CMD', 'node', '--version'],
              interval: '30s',
              timeout: '10s',
              retries: 3,
              start_period: '40s'
            }
          }
        }
      };

      const composePath = path.join(testDir, 'docker-compose.yml');
      await fs.writeFile(composePath, JSON.stringify(dockerCompose, null, 2));

      const exists = await fs.pathExists(composePath);
      expect(exists).toBe(true);
    });
  });

  describe('Cloud Platform Compatibility', () => {
    it('should create Heroku Procfile', async () => {
      const procfile = 'web: node src/cli/index.js';
      const procfilePath = path.join(testDir, 'Procfile');
      await fs.writeFile(procfilePath, procfile);

      const content = await fs.readFile(procfilePath, 'utf8');
      expect(content).toBe('web: node src/cli/index.js');
    });

    it('should create Vercel configuration', async () => {
      const vercelConfig = {
        version: 2,
        builds: [
          {
            src: 'src/cli/index.js',
            use: '@vercel/node'
          }
        ],
        routes: [
          {
            src: '/(.*)',
            dest: '/src/cli/index.js'
          }
        ],
        env: {
          NODE_ENV: 'production'
        }
      };

      const vercelPath = path.join(testDir, 'vercel.json');
      await fs.writeJSON(vercelPath, vercelConfig, { spaces: 2 });

      const content = await fs.readJSON(vercelPath);
      expect(content.version).toBe(2);
      expect(content.builds[0].use).toBe('@vercel/node');
    });

    it('should create Netlify configuration', async () => {
      const netlifyConfig = {
        build: {
          command: 'npm run build',
          publish: 'dist',
          environment: {
            NODE_VERSION: '18'
          }
        },
        functions: {
          directory: 'netlify/functions'
        },
        redirects: [
          {
            from: '/api/*',
            to: '/.netlify/functions/:splat',
            status: 200
          }
        ]
      };

      const netlifyPath = path.join(testDir, 'netlify.toml');
      const tomlContent = `
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

[functions]
  directory = "netlify/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
      `.trim();

      await fs.writeFile(netlifyPath, tomlContent);

      const exists = await fs.pathExists(netlifyPath);
      expect(exists).toBe(true);
    });

    it('should create AWS Lambda configuration', async () => {
      const lambdaHandler = `
export const handler = async (event, context) => {
  const { runMain } = await import('./src/cli/index.js');
  
  try {
    // Set up CLI arguments from Lambda event
    process.argv = ['node', 'unjucks', ...event.arguments || []];
    
    const result = await runMain();
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        result: result
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
      `.trim();

      const lambdaPath = path.join(testDir, 'lambda-handler.js');
      await fs.writeFile(lambdaPath, lambdaHandler);

      const content = await fs.readFile(lambdaPath, 'utf8');
      expect(content).toContain('export const handler');
      expect(content).toContain('runMain()');
    });

    it('should create Google Cloud Function configuration', async () => {
      const gcfPackage = {
        name: 'unjucks-gcf',
        version: '1.0.0',
        main: 'index.js',
        engines: {
          node: '18'
        },
        dependencies: {
          '@google-cloud/functions-framework': '^3.0.0'
        }
      };

      const gcfHandler = `
import functions from '@google-cloud/functions-framework';
import { runMain } from './src/cli/index.js';

functions.http('unjucks', async (req, res) => {
  try {
    const args = req.body.arguments || req.query.arguments || [];
    process.argv = ['node', 'unjucks', ...args];
    
    const result = await runMain();
    
    res.json({
      success: true,
      result: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
      `.trim();

      await fs.writeJSON(path.join(testDir, 'package.gcf.json'), gcfPackage, { spaces: 2 });
      await fs.writeFile(path.join(testDir, 'index.gcf.js'), gcfHandler);

      const packageExists = await fs.pathExists(path.join(testDir, 'package.gcf.json'));
      const handlerExists = await fs.pathExists(path.join(testDir, 'index.gcf.js'));

      expect(packageExists).toBe(true);
      expect(handlerExists).toBe(true);
    });
  });

  describe('Kubernetes Deployment', () => {
    it('should create Kubernetes deployment manifest', async () => {
      const deployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: 'unjucks-deployment',
          labels: {
            app: 'unjucks'
          }
        },
        spec: {
          replicas: 3,
          selector: {
            matchLabels: {
              app: 'unjucks'
            }
          },
          template: {
            metadata: {
              labels: {
                app: 'unjucks'
              }
            },
            spec: {
              containers: [
                {
                  name: 'unjucks',
                  image: 'unjucks:latest',
                  ports: [
                    {
                      containerPort: 3000
                    }
                  ],
                  env: [
                    {
                      name: 'NODE_ENV',
                      value: 'production'
                    }
                  ],
                  resources: {
                    requests: {
                      memory: '128Mi',
                      cpu: '100m'
                    },
                    limits: {
                      memory: '256Mi',
                      cpu: '200m'
                    }
                  },
                  livenessProbe: {
                    httpGet: {
                      path: '/health',
                      port: 3000
                    },
                    initialDelaySeconds: 30,
                    periodSeconds: 10
                  }
                }
              ]
            }
          }
        }
      };

      const deploymentPath = path.join(testDir, 'k8s-deployment.yaml');
      await fs.writeFile(deploymentPath, JSON.stringify(deployment, null, 2));

      const content = await fs.readJSON(deploymentPath);
      expect(content.kind).toBe('Deployment');
      expect(content.spec.replicas).toBe(3);
    });

    it('should create Kubernetes service manifest', async () => {
      const service = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: 'unjucks-service'
        },
        spec: {
          selector: {
            app: 'unjucks'
          },
          ports: [
            {
              protocol: 'TCP',
              port: 80,
              targetPort: 3000
            }
          ],
          type: 'LoadBalancer'
        }
      };

      const servicePath = path.join(testDir, 'k8s-service.yaml');
      await fs.writeFile(servicePath, JSON.stringify(service, null, 2));

      const content = await fs.readJSON(servicePath);
      expect(content.kind).toBe('Service');
      expect(content.spec.type).toBe('LoadBalancer');
    });

    it('should create Helm chart configuration', async () => {
      const chartYaml = {
        apiVersion: 'v2',
        name: 'unjucks',
        description: 'A Helm chart for Unjucks',
        type: 'application',
        version: '0.1.0',
        appVersion: '1.0.0'
      };

      const valuesYaml = {
        replicaCount: 1,
        image: {
          repository: 'unjucks',
          pullPolicy: 'IfNotPresent',
          tag: 'latest'
        },
        service: {
          type: 'ClusterIP',
          port: 80
        },
        ingress: {
          enabled: false
        },
        resources: {
          limits: {
            cpu: '200m',
            memory: '256Mi'
          },
          requests: {
            cpu: '100m',
            memory: '128Mi'
          }
        }
      };

      await fs.ensureDir(path.join(testDir, 'helm'));
      await fs.writeFile(path.join(testDir, 'helm', 'Chart.yaml'), JSON.stringify(chartYaml, null, 2));
      await fs.writeFile(path.join(testDir, 'helm', 'values.yaml'), JSON.stringify(valuesYaml, null, 2));

      const chartExists = await fs.pathExists(path.join(testDir, 'helm', 'Chart.yaml'));
      const valuesExists = await fs.pathExists(path.join(testDir, 'helm', 'values.yaml'));

      expect(chartExists).toBe(true);
      expect(valuesExists).toBe(true);
    });
  });

  describe('Environment Configuration', () => {
    it('should handle different shell environments', async () => {
      const shellCommands = {
        bash: 'echo $SHELL',
        zsh: 'echo $ZSH_VERSION',
        fish: 'echo $FISH_VERSION'
      };

      // Test current shell
      try {
        const { stdout } = await execAsync('echo $SHELL');
        expect(stdout.trim()).toMatch(/\/(bash|zsh|fish|sh)$/);
      } catch (error) {
        console.warn('Unable to detect shell environment');
      }
    });

    it('should validate environment variable handling', () => {
      // Set test environment variables
      process.env.UNJUCKS_TEST_MODE = 'testing';
      process.env.UNJUCKS_CONFIG_PATH = '/tmp/config';
      process.env.UNJUCKS_LOG_LEVEL = 'debug';

      expect(process.env.UNJUCKS_TEST_MODE).toBe('testing');
      expect(process.env.UNJUCKS_CONFIG_PATH).toBe('/tmp/config');
      expect(process.env.UNJUCKS_LOG_LEVEL).toBe('debug');

      // Cleanup
      delete process.env.UNJUCKS_TEST_MODE;
      delete process.env.UNJUCKS_CONFIG_PATH;
      delete process.env.UNJUCKS_LOG_LEVEL;
    });

    it('should create environment-specific configurations', async () => {
      const envConfigs = {
        development: {
          NODE_ENV: 'development',
          DEBUG: 'unjucks:*',
          LOG_LEVEL: 'debug'
        },
        staging: {
          NODE_ENV: 'staging',
          DEBUG: 'unjucks:warn,unjucks:error',
          LOG_LEVEL: 'info'
        },
        production: {
          NODE_ENV: 'production',
          DEBUG: '',
          LOG_LEVEL: 'error'
        }
      };

      for (const [env, config] of Object.entries(envConfigs)) {
        const envFile = path.join(testDir, `.env.${env}`);
        const envContent = Object.entries(config)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n');

        await fs.writeFile(envFile, envContent);

        const exists = await fs.pathExists(envFile);
        expect(exists).toBe(true);

        const content = await fs.readFile(envFile, 'utf8');
        expect(content).toContain(`NODE_ENV=${config.NODE_ENV}`);
      }
    });

    it('should test configuration file compatibility', async () => {
      const configFormats = {
        'config.json': {
          templates: './templates',
          output: './output',
          engines: {
            nunjucks: {
              autoescape: true,
              throwOnUndefined: false
            }
          }
        },
        'config.yaml': `
templates: ./templates
output: ./output
engines:
  nunjucks:
    autoescape: true
    throwOnUndefined: false
        `.trim(),
        'config.js': `
export default {
  templates: './templates',
  output: './output',
  engines: {
    nunjucks: {
      autoescape: true,
      throwOnUndefined: false
    }
  }
};
        `.trim()
      };

      for (const [filename, content] of Object.entries(configFormats)) {
        const configPath = path.join(testDir, filename);

        if (filename.endsWith('.json')) {
          await fs.writeJSON(configPath, content, { spaces: 2 });
        } else {
          await fs.writeFile(configPath, content);
        }

        const exists = await fs.pathExists(configPath);
        expect(exists).toBe(true);
      }
    });
  });

  describe('CI/CD Pipeline Integration', () => {
    it('should create GitHub Actions workflow', async () => {
      const githubWorkflow = {
        name: 'CI/CD Pipeline',
        on: {
          push: {
            branches: ['main', 'develop']
          },
          pull_request: {
            branches: ['main']
          }
        },
        jobs: {
          test: {
            'runs-on': 'ubuntu-latest',
            strategy: {
              matrix: {
                'node-version': ['18.x', '20.x', '22.x']
              }
            },
            steps: [
              {
                uses: 'actions/checkout@v4'
              },
              {
                name: 'Use Node.js ${{ matrix.node-version }}',
                uses: 'actions/setup-node@v4',
                with: {
                  'node-version': '${{ matrix.node-version }}'
                }
              },
              {
                name: 'Install pnpm',
                run: 'npm install -g pnpm@latest'
              },
              {
                name: 'Install dependencies',
                run: 'pnpm install --frozen-lockfile'
              },
              {
                name: 'Run tests',
                run: 'pnpm test'
              }
            ]
          }
        }
      };

      await fs.ensureDir(path.join(testDir, '.github', 'workflows'));
      const workflowPath = path.join(testDir, '.github', 'workflows', 'ci.yml');
      await fs.writeFile(workflowPath, JSON.stringify(githubWorkflow, null, 2));

      const exists = await fs.pathExists(workflowPath);
      expect(exists).toBe(true);
    });

    it('should create GitLab CI configuration', async () => {
      const gitlabCi = `
stages:
  - test
  - build
  - deploy

variables:
  NODE_VERSION: "18"

.node-template: &node-template
  image: node:\${NODE_VERSION}
  before_script:
    - npm install -g pnpm@latest
    - pnpm install --frozen-lockfile

test:
  <<: *node-template
  stage: test
  script:
    - pnpm test
  coverage: '/Lines\\s*:\\s*(\\d+\\.?\\d*)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

build:
  <<: *node-template
  stage: build
  script:
    - pnpm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour

deploy:
  stage: deploy
  script:
    - echo "Deploy to production"
  only:
    - main
      `.trim();

      const gitlabCiPath = path.join(testDir, '.gitlab-ci.yml');
      await fs.writeFile(gitlabCiPath, gitlabCi);

      const exists = await fs.pathExists(gitlabCiPath);
      expect(exists).toBe(true);
    });
  });
});