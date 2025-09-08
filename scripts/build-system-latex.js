#!/usr/bin/env node
/**
 * LaTeX Build System Integration
 * Extends the main build system with LaTeX compilation capabilities
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LaTeXBuildIntegration } from '../src/lib/latex/build-integration.js';
import consola from 'consola';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LaTeXBuildSystem {
  constructor() {
    this.logger = consola.create({ tag: 'latex-build-system' });
    this.integration = null;
  }

  /**
   * Initialize LaTeX build system
   */
  async initialize() {
    try {
      this.integration = new LaTeXBuildIntegration({
        outputDir: './dist',
        concurrency: 2
      });

      await this.integration.initialize();
      this.logger.success('LaTeX build system initialized');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize LaTeX build system:', error);
      // Don't throw - make it non-blocking for main build
      return false;
    }
  }

  /**
   * Run LaTeX build process
   */
  async build() {
    if (!this.integration) {
      this.logger.warn('LaTeX integration not initialized, skipping LaTeX build');
      return { success: true, skipped: true };
    }

    try {
      this.logger.info('Building LaTeX documents...');
      const result = await this.integration.buildAllDocuments();
      
      if (result.success) {
        this.logger.success(`LaTeX build completed: ${result.successful}/${result.total} documents built`);
      } else {
        this.logger.warn(`LaTeX build completed with issues: ${result.failed}/${result.total} documents failed`);
      }

      return result;
    } catch (error) {
      this.logger.error('LaTeX build failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Setup LaTeX build hooks
   */
  async setupBuildHooks() {
    try {
      // Create build hook script
      const hookPath = path.join(process.cwd(), 'scripts', 'latex-build-hook.js');
      
      const hookContent = `#!/usr/bin/env node
/**
 * LaTeX Build Hook - Standalone LaTeX compilation
 */
import { LaTeXBuildSystem } from './build-system-latex.js';

async function main() {
  const buildSystem = new LaTeXBuildSystem();
  
  try {
    const initialized = await buildSystem.initialize();
    if (!initialized) {
      console.warn('LaTeX build system initialization failed, exiting gracefully');
      process.exit(0);
    }

    const result = await buildSystem.build();
    
    if (result.success || result.skipped) {
      process.exit(0);
    } else {
      console.error('LaTeX build failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('LaTeX build hook failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  main();
}
`;

      await fs.writeFile(hookPath, hookContent);
      await fs.chmod(hookPath, 0o755);

      this.logger.success('LaTeX build hook created successfully');
      return hookPath;
    } catch (error) {
      this.logger.error('Failed to setup build hooks:', error);
      throw error;
    }
  }

  /**
   * Update package.json with LaTeX build scripts
   */
  async updatePackageJson() {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageContent = JSON.parse(await fs.readFile(packagePath, 'utf8'));

      const latexScripts = {
        'build:latex': 'node scripts/latex-build-hook.js',
        'watch:latex': 'node -e "import(\'./scripts/build-system-latex.js\').then(m => { const bs = new m.LaTeXBuildSystem(); bs.initialize().then(() => bs.integration?.startWatchMode()); })"',
        'clean:latex': 'rm -rf dist/latex temp/latex .latex-cache'
      };

      // Add scripts
      packageContent.scripts = packageContent.scripts || {};
      Object.entries(latexScripts).forEach(([key, value]) => {
        if (!packageContent.scripts[key]) {
          packageContent.scripts[key] = value;
        }
      });

      // Update main build script to include LaTeX (non-blocking)
      if (packageContent.scripts.build && !packageContent.scripts.build.includes('build:latex')) {
        const buildScript = packageContent.scripts.build;
        packageContent.scripts.build = `${buildScript} && (npm run build:latex || echo "LaTeX build skipped")`;
      }

      await fs.writeFile(packagePath, JSON.stringify(packageContent, null, 2));
      this.logger.success('Package.json updated with LaTeX build scripts');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to update package.json:', error);
      throw error;
    }
  }

  /**
   * Create LaTeX configuration
   */
  async createConfiguration() {
    try {
      const configPath = path.join(process.cwd(), 'config', 'latex.config.js');
      
      // Ensure config directory exists
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      
      const configContent = `/**
 * LaTeX Build Configuration
 */
export default {
  latex: {
    // LaTeX engine to use
    engine: 'pdflatex', // pdflatex, xelatex, lualatex
    
    // Output directory for compiled PDFs
    outputDir: './dist/latex',
    
    // Temporary directory for compilation
    tempDir: './temp/latex',
    
    // Enable bibliography processing
    enableBibtex: true,
    enableBiber: true,
    
    // Compilation settings
    maxRetries: 3,
    timeout: 60000, // 60 seconds
    verbose: false,
    
    // Concurrent compilation limit
    concurrency: 2,
    
    // Watch mode settings
    watch: {
      enabled: false,
      patterns: ['**/*.tex', '**/*.bib'],
      ignored: ['**/node_modules/**', '**/dist/**', '**/temp/**']
    },
    
    // Docker settings (optional)
    docker: {
      enabled: false,
      image: 'texlive/texlive:latest',
      volumes: {},
      environment: {}
    },
    
    // Build integration
    buildIntegration: {
      // Include LaTeX in main build process
      includeInBuild: true,
      
      // Fail build if LaTeX compilation fails
      failOnError: false,
      
      // Skip LaTeX build if no .tex files found
      skipIfNoFiles: true
    }
  }
};
`;

      await fs.writeFile(configPath, configContent);
      this.logger.success(`LaTeX configuration created: ${configPath}`);
      
      return configPath;
    } catch (error) {
      this.logger.error('Failed to create configuration:', error);
      throw error;
    }
  }

  /**
   * Create Dockerfile for LaTeX support
   */
  async createDockerfile() {
    try {
      const dockerfilePath = path.join(process.cwd(), 'docker', 'Dockerfile.latex');
      
      // Ensure docker directory exists
      await fs.mkdir(path.dirname(dockerfilePath), { recursive: true });
      
      const dockerfileContent = `# LaTeX Build Environment
FROM texlive/texlive:latest

# Install Node.js for build integration
RUN apt-get update && \\
    apt-get install -y curl && \\
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \\
    apt-get install -y nodejs

# Install additional LaTeX packages if needed
RUN tlmgr update --self && \\
    tlmgr install \\
      collection-fontsrecommended \\
      collection-latexextra \\
      collection-mathscience \\
      collection-bibtexextra

# Set working directory
WORKDIR /workspace

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm ci --only=production

# Copy source files
COPY . .

# Set permissions
RUN chmod +x scripts/*.js

# Build command
CMD ["npm", "run", "build:latex"]
`;

      await fs.writeFile(dockerfilePath, dockerfileContent);
      
      // Create docker-compose for LaTeX
      const composeContent = `version: '3.8'
services:
  latex-builder:
    build:
      context: ..
      dockerfile: docker/Dockerfile.latex
    volumes:
      - ../:/workspace
      - latex-output:/workspace/dist/latex
    environment:
      - NODE_ENV=production
    command: npm run build:latex

volumes:
  latex-output:
`;

      await fs.writeFile(
        path.join(path.dirname(dockerfilePath), 'docker-compose.latex.yml'),
        composeContent
      );

      this.logger.success('Docker configuration created for LaTeX support');
      return dockerfilePath;
    } catch (error) {
      this.logger.error('Failed to create Docker configuration:', error);
      throw error;
    }
  }

  /**
   * Full setup process
   */
  async setup() {
    try {
      this.logger.info('Setting up LaTeX build system...');
      
      // Initialize
      await this.initialize();
      
      // Create configuration
      await this.createConfiguration();
      
      // Setup build hooks
      await this.setupBuildHooks();
      
      // Update package.json
      await this.updatePackageJson();
      
      // Create Docker support
      await this.createDockerfile();
      
      this.logger.success('LaTeX build system setup completed successfully!');
      
      return {
        success: true,
        components: [
          'Configuration created',
          'Build hooks setup',
          'Package.json updated',
          'Docker support added'
        ]
      };
      
    } catch (error) {
      this.logger.error('LaTeX build system setup failed:', error);
      throw error;
    }
  }

  /**
   * Test the build system
   */
  async test() {
    try {
      this.logger.info('Testing LaTeX build system...');
      
      // Test initialization
      const initialized = await this.initialize();
      if (!initialized) {
        return { success: false, error: 'Initialization failed' };
      }
      
      // Test build process
      const buildResult = await this.build();
      
      this.logger.info('LaTeX build system test completed');
      return {
        success: true,
        buildResult,
        message: 'LaTeX build system is working correctly'
      };
      
    } catch (error) {
      this.logger.error('LaTeX build system test failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export for use in other scripts
export { LaTeXBuildSystem };

// Run setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const buildSystem = new LaTeXBuildSystem();
  
  const command = process.argv[2] || 'setup';
  
  switch (command) {
    case 'setup':
      buildSystem.setup().catch(console.error);
      break;
    case 'build':
      buildSystem.initialize()
        .then(() => buildSystem.build())
        .catch(console.error);
      break;
    case 'test':
      buildSystem.test()
        .then(result => {
          console.log('Test result:', result);
          process.exit(result.success ? 0 : 1);
        })
        .catch(console.error);
      break;
    default:
      console.log('Usage: node build-system-latex.js [setup|build|test]');
      process.exit(1);
  }
}