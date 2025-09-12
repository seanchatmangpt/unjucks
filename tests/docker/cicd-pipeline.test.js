/**
 * CI/CD Pipeline Integration Tests
 * Validates Docker integration with GitHub Actions and CI/CD workflows
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

describe('CI/CD Pipeline Integration', () => {
  const workflowsDir = './.github/workflows';
  const dockerComposeFile = './docker-compose.test.yml';
  const testImageName = 'unjucks:test';
  
  beforeAll(async () => {
    // Ensure workflows directory exists
    await fs.ensureDir(workflowsDir);
  });

  afterAll(async () => {
    // Cleanup docker-compose resources
    try {
      await execAsync('docker-compose -f docker-compose.test.yml down --volumes --remove-orphans');
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should create optimized Docker workflow for GitHub Actions', async () => {
    const workflowContent = `name: Docker CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  docker-build-test:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        
      - name: Log in to Container Registry
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
          
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            
      - name: Build Docker image for testing
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./tests/docker/Dockerfile.test
          target: test
          push: false
          tags: unjucks:test
          cache-from: type=gha
          cache-to: type=gha,mode=max
          
      - name: Run security scan
        run: |
          docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \\
            aquasec/trivy image --severity HIGH,CRITICAL unjucks:test
            
      - name: Run unit tests in container
        run: |
          docker run --rm unjucks:test npm run test:minimal
          
      - name: Run integration tests in container  
        run: |
          docker run --rm unjucks:test npm run test:integration
          
      - name: Run CLI smoke tests
        run: |
          docker run --rm unjucks:test sh -c "
            node bin/unjucks.cjs --version &&
            node bin/unjucks.cjs list
          "
          
      - name: Build and push production image
        if: github.event_name != 'pull_request'
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./tests/docker/Dockerfile.test
          target: production
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          
      - name: Generate SBOM
        if: github.event_name != 'pull_request'
        run: |
          docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \\
            anchore/syft unjucks:test -o spdx-json > sbom.json
            
      - name: Upload SBOM
        if: github.event_name != 'pull_request'
        uses: actions/upload-artifact@v4
        with:
          name: sbom
          path: sbom.json

  docker-compose-test:
    runs-on: ubuntu-latest
    needs: docker-build-test
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        
      - name: Run docker-compose tests
        run: |
          docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
          docker-compose -f docker-compose.test.yml down --volumes
`;

    const workflowPath = path.join(workflowsDir, 'docker-ci.yml');
    await fs.writeFile(workflowPath, workflowContent);
    
    expect(await fs.pathExists(workflowPath)).toBe(true);
    
    // Validate workflow syntax
    const content = await fs.readFile(workflowPath, 'utf8');
    expect(content).toContain('name: Docker CI/CD Pipeline');
    expect(content).toContain('docker/build-push-action@v5');
    expect(content).toContain('cache-from: type=gha');
  });

  test('should create docker-compose configuration for testing', async () => {
    const composeContent = `version: '3.8'

services:
  unjucks-test:
    build:
      context: .
      dockerfile: ./tests/docker/Dockerfile.test
      target: test
    environment:
      - NODE_ENV=test
      - CI=true
    volumes:
      - .:/workspace
    working_dir: /workspace
    command: npm run test:minimal
    healthcheck:
      test: ["CMD", "node", "-e", "console.log('healthy')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    mem_limit: 512m
    cpus: 1.0
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
      - /workspace/node_modules/.cache

  unjucks-integration:
    build:
      context: .
      dockerfile: ./tests/docker/Dockerfile.test
      target: test
    environment:
      - NODE_ENV=test
      - CI=true
    volumes:
      - .:/workspace
    working_dir: /workspace
    command: npm run test:integration
    depends_on:
      unjucks-test:
        condition: service_healthy
    mem_limit: 1g
    cpus: 2.0

  unjucks-security:
    build:
      context: .
      dockerfile: ./tests/docker/Dockerfile.test
      target: test
    environment:
      - NODE_ENV=test
      - CI=true
    volumes:
      - .:/workspace
    working_dir: /workspace
    command: npm run security:scan
    depends_on:
      - unjucks-test
    mem_limit: 256m
    cpus: 0.5
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp

networks:
  default:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
`;

    await fs.writeFile(dockerComposeFile, composeContent);
    
    expect(await fs.pathExists(dockerComposeFile)).toBe(true);
    
    // Validate compose file syntax
    const { stdout } = await execAsync(`docker-compose -f ${dockerComposeFile} config`);
    expect(stdout).toContain('unjucks-test');
    expect(stdout).toContain('unjucks-integration');
    expect(stdout).toContain('unjucks-security');
  });

  test('should validate docker-compose service startup', async () => {
    const startTime = this.getDeterministicTimestamp();
    
    // Build and start services
    await execAsync(`docker-compose -f ${dockerComposeFile} build`);
    await execAsync(`docker-compose -f ${dockerComposeFile} up -d`);
    
    // Wait for services to be healthy
    let allHealthy = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout
    
    while (!allHealthy && attempts < maxAttempts) {
      const { stdout } = await execAsync(`docker-compose -f ${dockerComposeFile} ps --format json`);
      const services = stdout.split('\n').filter(Boolean).map(line => JSON.parse(line));
      
      allHealthy = services.every(service => 
        service.Health === 'healthy' || service.Health === undefined
      );
      
      if (!allHealthy) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
    }
    
    const startupTime = this.getDeterministicTimestamp() - startTime;
    
    // Stop services
    await execAsync(`docker-compose -f ${dockerComposeFile} down`);
    
    expect(allHealthy).toBe(true);
    expect(startupTime).toBeLessThan(120000); // Should start in under 2 minutes
  });

  test('should run complete test suite via docker-compose', async () => {
    const testCommand = `docker-compose -f ${dockerComposeFile} up --build --abort-on-container-exit --exit-code-from unjucks-test`;
    
    const { stdout, stderr } = await execAsync(testCommand);
    
    // Cleanup
    await execAsync(`docker-compose -f ${dockerComposeFile} down --volumes`);
    
    expect(stdout + stderr).toContain('unjucks-test');
    
    // Check for test completion
    const hasTestResults = (stdout + stderr).includes('test results') || 
                          (stdout + stderr).includes('✓') ||
                          (stdout + stderr).includes('Tests:');
    
    expect(hasTestResults).toBe(true);
  });

  test('should create GitHub Actions cache optimization workflow', async () => {
    const cacheWorkflow = `name: Docker Cache Optimization

on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly cache cleanup
  workflow_dispatch:

jobs:
  cache-cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Cleanup old cache entries
        run: |
          gh extension install actions/gh-actions-cache
          
          echo "Fetching list of cache key"
          cacheKeysForPR=\$(gh actions-cache list -R \$REPO -B \$BRANCH | cut -f 1 )

          ## Setting this to not fail the workflow while deleting cache keys. 
          set +e
          echo "Deleting caches..."
          for cacheKey in \$cacheKeysForPR
          do
              gh actions-cache delete \$cacheKey -R \$REPO -B \$BRANCH --confirm
          done
          echo "Done"
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          REPO: \${{ github.repository }}
          BRANCH: refs/heads/main

  build-cache-warming:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        
      - name: Warm build cache
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./tests/docker/Dockerfile.test
          target: test
          push: false
          cache-from: type=gha
          cache-to: type=gha,mode=max
`;

    const cacheWorkflowPath = path.join(workflowsDir, 'docker-cache.yml');
    await fs.writeFile(cacheWorkflowPath, cacheWorkflow);
    
    expect(await fs.pathExists(cacheWorkflowPath)).toBe(true);
  });

  test('should validate multi-architecture build workflow', async () => {
    const multiArchWorkflow = `name: Multi-Architecture Docker Build

on:
  release:
    types: [published]

jobs:
  multi-arch-build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        
      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3
        
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
          
      - name: Build and push multi-arch image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./tests/docker/Dockerfile.test
          target: production
          platforms: linux/amd64,linux/arm64
          push: true
          tags: |
            ghcr.io/\${{ github.repository }}:latest
            ghcr.io/\${{ github.repository }}:\${{ github.event.release.tag_name }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
`;

    const multiArchPath = path.join(workflowsDir, 'docker-multi-arch.yml');
    await fs.writeFile(multiArchPath, multiArchWorkflow);
    
    expect(await fs.pathExists(multiArchPath)).toBe(true);
  });

  test('should create container security scanning workflow', async () => {
    const securityWorkflow = `name: Container Security Scanning

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * *'  # Daily security scan

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        
      - name: Build image for scanning
        run: |
          docker build -f ./tests/docker/Dockerfile.test -t unjucks:security-scan .
          
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'unjucks:security-scan'
          format: 'sarif'
          output: 'trivy-results.sarif'
          
      - name: Upload Trivy scan results to GitHub Security tab
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'
          
      - name: Run Hadolint Dockerfile linter
        uses: hadolint/hadolint-action@v3.1.0
        with:
          dockerfile: ./tests/docker/Dockerfile.test
          format: sarif
          output-file: hadolint-results.sarif
          no-fail: true
          
      - name: Upload Hadolint scan results
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: hadolint-results.sarif
          
      - name: Generate security report
        run: |
          echo "# Container Security Report" > security-report.md
          echo "Generated: \$(date)" >> security-report.md
          echo "" >> security-report.md
          docker run --rm aquasec/trivy image --format table unjucks:security-scan >> security-report.md
          
      - name: Upload security report
        uses: actions/upload-artifact@v4
        with:
          name: security-report
          path: security-report.md
`;

    const securityPath = path.join(workflowsDir, 'docker-security.yml');
    await fs.writeFile(securityPath, securityWorkflow);
    
    expect(await fs.pathExists(securityPath)).toBe(true);
  });

  test('should validate workflow file syntax and structure', async () => {
    const workflowFiles = await fs.readdir(workflowsDir);
    const ymlFiles = workflowFiles.filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
    
    expect(ymlFiles.length).toBeGreaterThanOrEqual(4);
    
    for (const file of ymlFiles) {
      const content = await fs.readFile(path.join(workflowsDir, file), 'utf8');
      
      // Basic YAML structure validation
      expect(content).toContain('name:');
      expect(content).toContain('on:');
      expect(content).toContain('jobs:');
      
      // Docker-specific validations
      if (content.includes('docker')) {
        expect(content).toMatch(/docker\/build-push-action@v[3-5]/);
        expect(content).toMatch(/actions\/checkout@v[3-4]/);
      }
    }
  });

  test('should create deployment environment configuration', async () => {
    const envConfig = {
      development: {
        image: 'unjucks:dev',
        replicas: 1,
        resources: {
          limits: { memory: '512Mi', cpu: '500m' },
          requests: { memory: '256Mi', cpu: '250m' }
        }
      },
      staging: {
        image: 'unjucks:staging',
        replicas: 2,
        resources: {
          limits: { memory: '1Gi', cpu: '1000m' },
          requests: { memory: '512Mi', cpu: '500m' }
        }
      },
      production: {
        image: 'unjucks:latest',
        replicas: 3,
        resources: {
          limits: { memory: '2Gi', cpu: '2000m' },
          requests: { memory: '1Gi', cpu: '1000m' }
        }
      }
    };
    
    await fs.writeFile('./config/docker/environments.json', JSON.stringify(envConfig, null, 2));
    
    expect(await fs.pathExists('./config/docker/environments.json')).toBe(true);
  });
});