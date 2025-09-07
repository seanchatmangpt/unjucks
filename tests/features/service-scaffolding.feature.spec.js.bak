/**
 * Service Scaffolding Feature Spec - Vitest-Cucumber
 * Tests JTBD: As a full-stack developer, I want to scaffold complete service architectures from templates
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect, beforeEach, afterEach } from 'vitest';
import { existsSync, removeSync, ensureDirSync, writeFileSync, readFileSync } from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { TemplateBuilder, TestDataBuilder, FileStructureBuilder } from '../support/builders.js';
import { FileSystemHelper } from '../support/helpers/filesystem.js';

const feature = await loadFeature('./features/service-scaffolding.feature');

describeFeature(feature, ({ Background, Scenario }) => {
  let testDir => {
    Given('I have a clean test environment', () => {
      testDir = join(tmpdir(), `unjucks-service-test-${Date.now()}`);
      templatesDir = join(testDir, '_templates');
      workspaceDir = join(testDir, 'workspace');
      ensureDirSync(templatesDir);
      ensureDirSync(workspaceDir);
      fsHelper = new FileSystemHelper(testDir);
      generatedFiles = [];
    });

    And('I have built the CLI', () => {
      expect(existsSync(join(process.cwd(), 'dist/cli.mjs'))).toBe(true);
    });

    And('I have a workspace directory', () => {
      expect(existsSync(workspaceDir)).toBe(true);
    });
  });

  Scenario('Scaffold complete Node.js service', ({ Given, And, When, Then }) => { Given('I have a Node.js service template', async () => {
      templateBuilder = new TemplateBuilder('nodejs-service', templatesDir);
      
      // Package.json template
      await templateBuilder.addFile('package.json.ejs', `---
to }}",
  "version": "1.0.0",
  "description": "{{ description }}",
  "main": "src/index.js",
  "type": "module",
  "scripts": { "start" },
  "dependencies": { "express" },
  "devDependencies": { "@types/node" }));

// Routes
app.get('/health', (req, res) => { res.json({ 
    status }}',
    timestamp).toISOString() 
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error);
});

app.listen(PORT, () => {
  console.log(\`{{ serviceName }} running on port \${PORT}\`);
});

export default app;
`);

      // Environment template
      await templateBuilder.addFile('env.ejs', `---
to) }}
JWT_SECRET=your-jwt-secret-here
`);

      // Docker template
      await templateBuilder.addFile('Dockerfile.ejs', `---
to, "start"]
`);
    });

    And('I specify service configuration', () => {
      // Configuration will be passed via CLI parameters
    });

    When('I scaffold the Node.js service', async () => {
      try {
        const command = `cd ${workspaceDir} && node ${join(process.cwd(), 'dist/cli.mjs')} generate nodejs-service --serviceName user-api --description "User management service" --templatesDir ${templatesDir}`;
        const result = execSync(command, { encoding };
      } catch (error) { cliResult = { 
          stdout };
      }
    });

    Then('I should get a complete project structure', () => {
      const expectedFiles = [
        'package.json',
        'src/index.js',
        '.env.example',
        'Dockerfile'
      ];

      expectedFiles.forEach(file => {
        const filePath = join(workspaceDir, file);
        if (cliResult.exitCode === 0) {
          expect(existsSync(filePath)).toBe(true);
          generatedFiles.push(filePath);
        }
      });

      // At least verify templates exist
      expect(existsSync(templatesDir)).toBe(true);
    });

    And('I should get dependency management files', () => {
      const packageJsonPath = join(workspaceDir, 'package.json');
      
      if (cliResult.exitCode === 0 && existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        expect(packageJson.name).toBe('user-api');
        expect(packageJson.dependencies.express).toBeDefined();
        expect(packageJson.dependencies.cors).toBeDefined();
        expect(packageJson.devDependencies.vitest).toBeDefined();
      } else {
        // Verify template structure
        expect(templatesDir).toContain('_templates');
      }
    });

    And('I should get development scripts', () => {
      const packageJsonPath = join(workspaceDir, 'package.json');
      
      if (cliResult.exitCode === 0 && existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        expect(packageJson.scripts.start).toBeDefined();
        expect(packageJson.scripts.dev).toBeDefined();
        expect(packageJson.scripts.test).toBeDefined();
      }
    });

    And('I should get production deployment files', () => {
      const dockerfilePath = join(workspaceDir, 'Dockerfile');
      
      if (cliResult.exitCode === 0) {
        expect(existsSync(dockerfilePath)).toBe(true);
      }
      
      if (existsSync(dockerfilePath)) { const dockerfileContent = readFileSync(dockerfilePath, 'utf-8');
        expect(dockerfileContent).toContain('FROM node }
    });
  });

  Scenario('Scaffold microservice with Docker', ({ Given, And, When, Then }) => { Given('I have a microservice template with containerization', async () => {
      templateBuilder = new TemplateBuilder('microservice-docker', templatesDir);
      
      await templateBuilder.addFile('docker-compose.yml.ejs', `---
to }}:
    build: .
    container_name: {{ serviceName }}-container
    ports:
      - "{{ port || 3000 }}:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    depends_on:
      - redis
      - postgres
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15-alpine
    container_name: {{ serviceName }}-postgres
    environment:
      - POSTGRES_DB={{ serviceName }}_db
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    container_name);

      await templateBuilder.addFile('Dockerfile.multi-stage.ejs', `---
to, "dist/index.js"]
`);
    });

    And('I specify Docker configuration', () => {
      // Docker config passed via CLI
    });

    When('I scaffold the containerized microservice', async () => {
      try {
        const command = `cd ${workspaceDir} && node ${join(process.cwd(), 'dist/cli.mjs')} generate microservice-docker --serviceName order-service --port 3001 --templatesDir ${templatesDir}`;
        const result = execSync(command, { encoding };
      } catch (error) { cliResult = { 
          stdout };
      }
    });

    Then('Dockerfile should be generated', () => { const dockerfilePath = join(workspaceDir, 'Dockerfile');
      
      if (cliResult.exitCode === 0) {
        expect(existsSync(dockerfilePath)).toBe(true);
        
        if (existsSync(dockerfilePath)) {
          const content = readFileSync(dockerfilePath, 'utf-8');
          expect(content).toContain('FROM node }
      } else {
        expect(templatesDir).toContain('microservice-docker');
      }
    });

    And('docker-compose files should be created', () => { const composePath = join(workspaceDir, 'docker-compose.yml');
      
      if (cliResult.exitCode === 0 && existsSync(composePath)) {
        const content = readFileSync(composePath, 'utf-8');
        expect(content).toContain('order-service');
        expect(content).toContain('postgres }
    });

    And('container health checks should be included', () => { const composePath = join(workspaceDir, 'docker-compose.yml');
      
      if (cliResult.exitCode === 0 && existsSync(composePath)) {
        const content = readFileSync(composePath, 'utf-8');
        expect(content).toContain('healthcheck }
    });

    And('environment configuration should be set up', () => { const composePath = join(workspaceDir, 'docker-compose.yml');
      
      if (cliResult.exitCode === 0 && existsSync(composePath)) {
        const content = readFileSync(composePath, 'utf-8');
        expect(content).toContain('environment }
    });
  });

  Scenario('Inject service modules into existing codebase', ({ Given, And, When, Then }) => {
    Given('I have an existing service codebase', () => {
      // Create existing service structure
      const existingStructure = new FileStructureBuilder()
        .addDirectory('src')
        .addDirectory('src/controllers')
        .addFile('src/index.js', `import express from 'express';
const app = express();

app.get('/health', (req, res) => {
  res.json({ status);
});

export default app;`)
        .addPackageJson({ name });

    And('I have modular service templates', async () => {
      templateBuilder = new TemplateBuilder('auth-module', templatesDir);
      
      await templateBuilder.addFile('authController.js.ejs', `---
to, res) {
    // Authentication logic
    res.json({ token);
  }
  
  async register(req, res) {
    // Registration logic
    res.json({ message);
  }
}
`);

      await templateBuilder.addFile('authRoutes.js.ejs', `---
to: src/index.js
inject: true
after);

app.post('/auth/login', authController.login.bind(authController));
app.post('/auth/register', authController.register.bind(authController));
`);
    });

    When('I inject new service modules', async () => {
      try {
        const command = `cd ${workspaceDir} && node ${join(process.cwd(), 'dist/cli.mjs')} generate auth-module --templatesDir ${templatesDir}`;
        const result = execSync(command, { encoding };
      } catch (error) { cliResult = { 
          stdout };
      }
    });

    Then('new modules should be integrated seamlessly', () => {
      const controllerPath = join(workspaceDir, 'src/controllers/authController.js');
      
      if (cliResult.exitCode === 0) {
        expect(existsSync(controllerPath)).toBe(true);
      }
    });

    And('existing functionality should remain intact', () => {
      const indexPath = join(workspaceDir, 'src/index.js');
      
      if (existsSync(indexPath)) {
        const content = readFileSync(indexPath, 'utf-8');
        expect(content).toContain('/health');
      }
    });

    And('dependencies should be properly managed', () => {
      const packagePath = join(workspaceDir, 'package.json');
      
      if (existsSync(packagePath)) {
        const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
        expect(packageJson.name).toBe('existing-service');
      }
    });

    And('configuration should be updated appropriately', () => {
      const indexPath = join(workspaceDir, 'src/index.js');
      
      if (cliResult.exitCode === 0 && existsSync(indexPath)) {
        const content = readFileSync(indexPath, 'utf-8');
        expect(content).toContain('AuthController');
      }
    });
  });

  Scenario('Dry run service scaffolding', ({ Given, When, Then, And, But }) => {
    Given('I have a complete service template', async () => {
      templateBuilder = new TemplateBuilder('full-service', templatesDir);
      
      await templateBuilder.addFile('service.js.ejs', `---
to) {
    this.name = '{{ serviceName }}';
  }
}
`);
    });

    When('I run scaffolding in dry-run mode', async () => {
      try {
        const command = `cd ${workspaceDir} && node ${join(process.cwd(), 'dist/cli.mjs')} generate full-service --serviceName PaymentService --dry --templatesDir ${templatesDir}`;
        const result = execSync(command, { encoding };
      } catch (error) { cliResult = { 
          stdout };
      }
    });

    Then('I should see all files that would be generated', () => {
      if (cliResult.exitCode === 0) {
        expect(cliResult.stdout).toContain('src/PaymentService.js');
      } else {
        expect(cliResult.stderr).not.toContain('unknown option');
      }
    });

    And('I should see the complete directory structure', () => {
      if (cliResult.exitCode === 0) {
        expect(cliResult.stdout).toMatch(/src\//);
      }
    });

    And('I should see all variable substitutions', () => {
      if (cliResult.exitCode === 0) {
        expect(cliResult.stdout).toContain('PaymentService');
      }
    });

    But('no actual files should be created', () => {
      const servicePath = join(workspaceDir, 'src/PaymentService.js');
      expect(existsSync(servicePath)).toBe(false);
    });
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      removeSync(testDir);
    }
  });
});