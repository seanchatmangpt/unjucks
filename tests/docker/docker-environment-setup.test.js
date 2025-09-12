/**
 * Docker Environment Setup and Configuration Tests
 * Tests clean Docker environment setup with multi-stage builds
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

describe('Docker Environment Setup', () => {
  const testContainerName = 'unjucks-test-env';
  const testImageName = 'unjucks:test';
  const dockerfilePath = './tests/docker/Dockerfile.test';
  
  beforeAll(async () => {
    // Ensure Docker is running
    try {
      execSync('docker info', { stdio: 'pipe' });
    } catch (error) {
      throw new Error('Docker is not running or not installed');
    }
    
    // Cleanup any existing test containers/images
    await cleanupDockerResources();
  });

  afterAll(async () => {
    await cleanupDockerResources();
  });

  async function cleanupDockerResources() {
    try {
      // Stop and remove container
      execSync(`docker stop ${testContainerName} 2>/dev/null || true`, { stdio: 'pipe' });
      execSync(`docker rm ${testContainerName} 2>/dev/null || true`, { stdio: 'pipe' });
      
      // Remove image
      execSync(`docker rmi ${testImageName} 2>/dev/null || true`, { stdio: 'pipe' });
      
      // Remove dangling images
      execSync('docker image prune -f 2>/dev/null || true', { stdio: 'pipe' });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  test('should create multi-stage Dockerfile for testing', async () => {
    const dockerfileContent = `# Multi-stage Docker build for Unjucks testing
# Stage 1: Base dependencies
FROM node:18-alpine AS base
WORKDIR /app
RUN apk add --no-cache git curl
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Development dependencies
FROM base AS dev-deps
RUN npm ci --include=dev
COPY . .

# Stage 3: Testing environment
FROM dev-deps AS test
ENV NODE_ENV=test
ENV CI=true
RUN npm run lint || echo "Linting completed"
RUN npm run test:minimal
CMD ["npm", "test"]

# Stage 4: Production build
FROM base AS production
COPY --from=dev-deps /app/src ./src
COPY --from=dev-deps /app/bin ./bin
COPY --from=dev-deps /app/_templates ./_templates
COPY --from=dev-deps /app/scripts ./scripts
EXPOSE 3000
CMD ["node", "src/cli/index.js"]
`;

    await fs.ensureDir(path.dirname(dockerfilePath));
    await fs.writeFile(dockerfilePath, dockerfileContent);
    
    expect(await fs.pathExists(dockerfilePath)).toBe(true);
  });

  test('should build Docker image with caching', async () => {
    const buildCommand = `docker build -f ${dockerfilePath} -t ${testImageName} --target test .`;
    
    const startTime = this.getDeterministicTimestamp();
    const { stdout, stderr } = await execAsync(buildCommand);
    const buildTime = this.getDeterministicTimestamp() - startTime;
    
    expect(buildTime).toBeLessThan(120000); // Should build in under 2 minutes
    expect(stdout).toContain('Successfully tagged');
    
    // Verify image exists
    const { stdout: images } = await execAsync(`docker images ${testImageName}`);
    expect(images).toContain(testImageName);
  });

  test('should create container with proper resource limits', async () => {
    const createCommand = `docker create --name ${testContainerName} ` +
      `--memory=512m --cpus=1.0 --security-opt=no-new-privileges ` +
      `--read-only --tmpfs /tmp --tmpfs /app/node_modules/.cache ` +
      `${testImageName}`;
    
    const { stdout } = await execAsync(createCommand);
    expect(stdout.trim()).toMatch(/^[a-f0-9]{64}$/); // Container ID
    
    // Verify container configuration
    const { stdout: inspect } = await execAsync(`docker inspect ${testContainerName}`);
    const config = JSON.parse(inspect)[0];
    
    expect(config.HostConfig.Memory).toBe(536870912); // 512MB in bytes
    expect(config.HostConfig.CpuQuota).toBe(100000);
    expect(config.HostConfig.ReadonlyRootfs).toBe(true);
    expect(config.HostConfig.SecurityOpt).toContain('no-new-privileges');
  });

  test('should validate environment variables and paths', async () => {
    const runCommand = `docker run --rm ${testImageName} node -e "
      console.log('NODE_ENV:', process.env.NODE_ENV);
      console.log('CI:', process.env.CI);
      console.log('PWD:', process.cwd());
      console.log('Node version:', process.version);
    "`;
    
    const { stdout } = await execAsync(runCommand);
    
    expect(stdout).toContain('NODE_ENV: test');
    expect(stdout).toContain('CI: true');
    expect(stdout).toContain('PWD: /app');
    expect(stdout).toContain('Node version: v18');
  });

  test('should verify clean container environment', async () => {
    const runCommand = `docker run --rm ${testImageName} sh -c "
      echo 'Checking for sensitive files:';
      find / -name '*.key' -o -name '*.pem' -o -name '.env*' 2>/dev/null | head -5;
      echo 'Checking running processes:';
      ps aux | wc -l;
      echo 'Checking network interfaces:';
      ip addr show | grep inet | wc -l;
    "`;
    
    const { stdout } = await execAsync(runCommand);
    
    // Should not contain sensitive files
    expect(stdout).not.toMatch(/\.key|\.pem|\.env/);
    
    // Should have minimal processes running
    const processCount = parseInt(stdout.match(/Checking running processes:\s*(\d+)/)?.[1] || '0');
    expect(processCount).toBeLessThan(10);
  });

  test('should validate layer caching efficiency', async () => {
    // Build again to test caching
    const startTime = this.getDeterministicTimestamp();
    const { stdout } = await execAsync(`docker build -f ${dockerfilePath} -t ${testImageName}-cached --target test .`);
    const buildTime = this.getDeterministicTimestamp() - startTime;
    
    // Cached build should be much faster
    expect(buildTime).toBeLessThan(30000); // Under 30 seconds for cached build
    expect(stdout).toContain('CACHED');
    
    // Clean up cached image
    execSync(`docker rmi ${testImageName}-cached 2>/dev/null || true`, { stdio: 'pipe' });
  });
});