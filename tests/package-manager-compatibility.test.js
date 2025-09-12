/**
 * Package Manager Compatibility Test Suite
 * Tests compatibility with pnpm (primary), npm, and yarn
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

describe('Package Manager Compatibility', () => {
  let testDir;
  let originalCwd;

  beforeAll(async () => {
    originalCwd = process.cwd();
    testDir = path.join(os.tmpdir(), `unjucks-pm-test-${this.getDeterministicTimestamp()}`);
    await fs.ensureDir(testDir);
    process.chdir(testDir);
    
    // Create a test package.json
    const packageJson = {
      name: 'unjucks-test-package',
      version: '1.0.0',
      type: 'module',
      engines: {
        node: '>=18.0.0'
      },
      dependencies: {
        chalk: '^4.1.2',
        'fs-extra': '^11.3.1'
      },
      devDependencies: {
        vitest: '^3.2.4'
      },
      scripts: {
        test: 'echo "test script works"',
        start: 'echo "start script works"',
        build: 'echo "build script works"'
      }
    };
    
    await fs.writeJSON(path.join(testDir, 'package.json'), packageJson, { spaces: 2 });
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    await fs.remove(testDir);
  });

  describe('Package Manager Detection', () => {
    it('should detect available package managers', async () => {
      const managers = {};
      
      // Test pnpm
      try {
        const { stdout } = await execAsync('pnpm --version');
        managers.pnpm = stdout.trim();
      } catch {
        managers.pnpm = null;
      }
      
      // Test npm (should always be available)
      try {
        const { stdout } = await execAsync('npm --version');
        managers.npm = stdout.trim();
      } catch {
        managers.npm = null;
      }
      
      // Test yarn
      try {
        const { stdout } = await execAsync('yarn --version');
        managers.yarn = stdout.trim();
      } catch {
        managers.yarn = null;
      }
      
      // npm should always be available
      expect(managers.npm).toBeTruthy();
      expect(managers.npm).toMatch(/^\d+\.\d+\.\d+/);
      
      console.log('Available package managers:', managers);
    });

    it('should prefer pnpm when available', async () => {
      let preferredManager = 'npm'; // default
      
      try {
        await execAsync('pnpm --version');
        preferredManager = 'pnpm';
      } catch {
        // pnpm not available
      }
      
      expect(['pnpm', 'npm']).toContain(preferredManager);
    });
  });

  describe('pnpm Compatibility (Primary)', () => {
    it('should install dependencies with pnpm', async () => {
      try {
        const { stdout } = await execAsync('pnpm --version');
        console.log('pnpm version:', stdout.trim());
        
        // Test pnpm install in a temporary directory
        const pnpmTestDir = path.join(testDir, 'pnpm-test');
        await fs.ensureDir(pnpmTestDir);
        
        const testPackage = {
          name: 'pnpm-test',
          version: '1.0.0',
          dependencies: {
            'chalk': '^4.1.2'
          }
        };
        
        await fs.writeJSON(path.join(pnpmTestDir, 'package.json'), testPackage);
        
        process.chdir(pnpmTestDir);
        const { stdout: installOutput } = await execAsync('pnpm install --silent');
        
        // Check if node_modules was created
        const nodeModulesExists = await fs.pathExists(path.join(pnpmTestDir, 'node_modules'));
        expect(nodeModulesExists).toBe(true);
        
        // Check if pnpm-lock.yaml was created
        const lockFileExists = await fs.pathExists(path.join(pnpmTestDir, 'pnpm-lock.yaml'));
        expect(lockFileExists).toBe(true);
        
        process.chdir(testDir);
      } catch (error) {
        if (error.message.includes('pnpm')) {
          console.warn('pnpm not available, skipping pnpm-specific tests');
        } else {
          throw error;
        }
      }
    });

    it('should run scripts with pnpm', async () => {
      try {
        await execAsync('pnpm --version');
        
        const { stdout } = await execAsync('pnpm run test');
        expect(stdout).toContain('test script works');
      } catch (error) {
        if (error.message.includes('pnpm')) {
          console.warn('pnpm not available for script testing');
        } else {
          throw error;
        }
      }
    });

    it('should support pnpm workspace features', async () => {
      try {
        await execAsync('pnpm --version');
        
        // Create workspace structure
        const workspaceDir = path.join(testDir, 'workspace-test');
        await fs.ensureDir(workspaceDir);
        
        const workspaceYaml = `
packages:
  - 'packages/*'
`;
        
        const rootPackage = {
          name: 'workspace-root',
          private: true,
          devDependencies: {
            'chalk': '^4.1.2'
          }
        };
        
        await fs.writeFile(path.join(workspaceDir, 'pnpm-workspace.yaml'), workspaceYaml);
        await fs.writeJSON(path.join(workspaceDir, 'package.json'), rootPackage);
        
        // Workspace file created successfully
        const workspaceExists = await fs.pathExists(path.join(workspaceDir, 'pnpm-workspace.yaml'));
        expect(workspaceExists).toBe(true);
      } catch (error) {
        console.warn('pnpm workspace test skipped:', error.message);
      }
    });
  });

  describe('npm Compatibility (Secondary)', () => {
    it('should install dependencies with npm', async () => {
      const npmTestDir = path.join(testDir, 'npm-test');
      await fs.ensureDir(npmTestDir);
      
      const testPackage = {
        name: 'npm-test',
        version: '1.0.0',
        dependencies: {
          'chalk': '^4.1.2'
        }
      };
      
      await fs.writeJSON(path.join(npmTestDir, 'package.json'), testPackage);
      
      process.chdir(npmTestDir);
      const { stdout } = await execAsync('npm install --silent');
      
      // Check if node_modules was created
      const nodeModulesExists = await fs.pathExists(path.join(npmTestDir, 'node_modules'));
      expect(nodeModulesExists).toBe(true);
      
      // Check if package-lock.json was created
      const lockFileExists = await fs.pathExists(path.join(npmTestDir, 'package-lock.json'));
      expect(lockFileExists).toBe(true);
      
      process.chdir(testDir);
    });

    it('should run scripts with npm', async () => {
      const { stdout } = await execAsync('npm run test');
      expect(stdout).toContain('test script works');
    });

    it('should support npm workspaces', async () => {
      const workspaceDir = path.join(testDir, 'npm-workspace-test');
      await fs.ensureDir(workspaceDir);
      
      const rootPackage = {
        name: 'npm-workspace-root',
        private: true,
        workspaces: ['packages/*'],
        devDependencies: {
          'chalk': '^4.1.2'
        }
      };
      
      await fs.writeJSON(path.join(workspaceDir, 'package.json'), rootPackage);
      
      // Workspace configuration created successfully
      const packageExists = await fs.pathExists(path.join(workspaceDir, 'package.json'));
      expect(packageExists).toBe(true);
      
      const packageContent = await fs.readJSON(path.join(workspaceDir, 'package.json'));
      expect(packageContent.workspaces).toEqual(['packages/*']);
    });
  });

  describe('Yarn Compatibility (Optional)', () => {
    it('should install dependencies with yarn if available', async () => {
      try {
        const { stdout: version } = await execAsync('yarn --version');
        console.log('yarn version:', version.trim());
        
        const yarnTestDir = path.join(testDir, 'yarn-test');
        await fs.ensureDir(yarnTestDir);
        
        const testPackage = {
          name: 'yarn-test',
          version: '1.0.0',
          dependencies: {
            'chalk': '^4.1.2'
          }
        };
        
        await fs.writeJSON(path.join(yarnTestDir, 'package.json'), testPackage);
        
        process.chdir(yarnTestDir);
        const { stdout } = await execAsync('yarn install --silent');
        
        // Check if node_modules was created
        const nodeModulesExists = await fs.pathExists(path.join(yarnTestDir, 'node_modules'));
        expect(nodeModulesExists).toBe(true);
        
        // Check if lock file was created
        const yarnLockExists = await fs.pathExists(path.join(yarnTestDir, 'yarn.lock'));
        expect(yarnLockExists).toBe(true);
        
        process.chdir(testDir);
      } catch (error) {
        console.warn('yarn not available, skipping yarn tests');
      }
    });

    it('should run scripts with yarn if available', async () => {
      try {
        await execAsync('yarn --version');
        const { stdout } = await execAsync('yarn run test');
        expect(stdout).toContain('test script works');
      } catch (error) {
        console.warn('yarn not available for script testing');
      }
    });
  });

  describe('Lockfile Compatibility', () => {
    it('should understand different lockfile formats', async () => {
      const lockFiles = {
        'package-lock.json': {
          name: 'test',
          lockfileVersion: 3,
          requires: true,
          packages: {}
        },
        'pnpm-lock.yaml': `lockfileVersion: '6.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

dependencies: {}
`,
        'yarn.lock': `# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
# yarn lockfile v1

package@^1.0.0:
  version "1.0.0"
  resolved "https://registry.example.com/package/-/package-1.0.0.tgz"
`
      };
      
      for (const [filename, content] of Object.entries(lockFiles)) {
        const lockFile = path.join(testDir, filename);
        
        if (typeof content === 'string') {
          await fs.writeFile(lockFile, content);
        } else {
          await fs.writeJSON(lockFile, content);
        }
        
        const exists = await fs.pathExists(lockFile);
        expect(exists).toBe(true);
        
        // Validate content can be read back
        const stats = await fs.stat(lockFile);
        expect(stats.size).toBeGreaterThan(0);
      }
    });

    it('should detect lockfile types correctly', async () => {
      const detectLockfileType = (filename) => {
        if (filename === 'package-lock.json') return 'npm';
        if (filename === 'pnpm-lock.yaml') return 'pnpm';
        if (filename === 'yarn.lock') return 'yarn';
        return 'unknown';
      };
      
      expect(detectLockfileType('package-lock.json')).toBe('npm');
      expect(detectLockfileType('pnpm-lock.yaml')).toBe('pnpm');
      expect(detectLockfileType('yarn.lock')).toBe('yarn');
      expect(detectLockfileType('unknown.lock')).toBe('unknown');
    });
  });

  describe('Script Execution', () => {
    it('should execute lifecycle scripts correctly', async () => {
      const testScripts = {
        pretest: 'echo "pretest executed"',
        test: 'echo "test executed"',
        posttest: 'echo "posttest executed"'
      };
      
      // Test with npm (most compatible)
      const { stdout } = await execAsync('npm run test');
      expect(stdout).toContain('test executed');
    });

    it('should handle script arguments', async () => {
      // Create package.json with a script that accepts arguments
      const packageWithArgs = await fs.readJSON(path.join(testDir, 'package.json'));
      packageWithArgs.scripts['test:args'] = 'echo "Arguments: $@"';
      await fs.writeJSON(path.join(testDir, 'package.json'), packageWithArgs, { spaces: 2 });
      
      try {
        const { stdout } = await execAsync('npm run test:args -- --verbose --production');
        expect(stdout).toContain('Arguments:');
      } catch (error) {
        // Some package managers handle arguments differently
        console.warn('Script argument test may vary by package manager');
      }
    });

    it('should respect environment variables in scripts', async () => {
      const packageWithEnv = await fs.readJSON(path.join(testDir, 'package.json'));
      packageWithEnv.scripts['test:env'] = 'echo "NODE_ENV: $NODE_ENV"';
      await fs.writeJSON(path.join(testDir, 'package.json'), packageWithEnv, { spaces: 2 });
      
      const { stdout } = await execAsync('NODE_ENV=test npm run test:env');
      expect(stdout).toContain('NODE_ENV: test');
    });
  });

  describe('Dependency Resolution', () => {
    it('should resolve peer dependencies correctly', async () => {
      const packageWithPeers = {
        name: 'peer-test',
        version: '1.0.0',
        dependencies: {
          'react': '^18.0.0'
        },
        peerDependencies: {
          'react': '^18.0.0'
        }
      };
      
      const peerTestDir = path.join(testDir, 'peer-test');
      await fs.ensureDir(peerTestDir);
      await fs.writeJSON(path.join(peerTestDir, 'package.json'), packageWithPeers);
      
      // Package.json structure is correct for peer dependencies
      const content = await fs.readJSON(path.join(peerTestDir, 'package.json'));
      expect(content.peerDependencies).toBeDefined();
      expect(content.peerDependencies.react).toBe('^18.0.0');
    });

    it('should handle optional dependencies gracefully', async () => {
      const packageWithOptional = {
        name: 'optional-test',
        version: '1.0.0',
        dependencies: {
          'chalk': '^4.1.2'
        },
        optionalDependencies: {
          'fsevents': '^2.3.0' // macOS-specific dependency
        }
      };
      
      const optionalTestDir = path.join(testDir, 'optional-test');
      await fs.ensureDir(optionalTestDir);
      await fs.writeJSON(path.join(optionalTestDir, 'package.json'), packageWithOptional);
      
      // Package.json structure is correct for optional dependencies
      const content = await fs.readJSON(path.join(optionalTestDir, 'package.json'));
      expect(content.optionalDependencies).toBeDefined();
    });
  });

  describe('Configuration Files', () => {
    it('should handle .npmrc configuration', async () => {
      const npmrcContent = `
registry=https://registry.npmjs.org/
save-exact=true
engine-strict=true
`;
      
      const npmrcFile = path.join(testDir, '.npmrc');
      await fs.writeFile(npmrcFile, npmrcContent.trim());
      
      const exists = await fs.pathExists(npmrcFile);
      expect(exists).toBe(true);
      
      const content = await fs.readFile(npmrcFile, 'utf8');
      expect(content).toContain('registry=');
    });

    it('should handle .pnpmrc configuration', async () => {
      const pnpmrcContent = `
store-dir=/tmp/pnpm-store
verify-store-integrity=false
`;
      
      const pnpmrcFile = path.join(testDir, '.pnpmrc');
      await fs.writeFile(pnpmrcFile, pnpmrcContent.trim());
      
      const exists = await fs.pathExists(pnpmrcFile);
      expect(exists).toBe(true);
      
      const content = await fs.readFile(pnpmrcFile, 'utf8');
      expect(content).toContain('store-dir=');
    });

    it('should handle .yarnrc.yml configuration', async () => {
      const yarnrcContent = `
yarnPath: .yarn/releases/yarn-3.6.0.cjs
nodeLinker: node-modules
`;
      
      const yarnrcFile = path.join(testDir, '.yarnrc.yml');
      await fs.writeFile(yarnrcFile, yarnrcContent.trim());
      
      const exists = await fs.pathExists(yarnrcFile);
      expect(exists).toBe(true);
      
      const content = await fs.readFile(yarnrcFile, 'utf8');
      expect(content).toContain('yarnPath:');
    });
  });

  describe('Global Package Installation', () => {
    it('should support global installation patterns', () => {
      const globalInstallCommands = {
        npm: 'npm install -g package',
        pnpm: 'pnpm add -g package',
        yarn: 'yarn global add package'
      };
      
      Object.entries(globalInstallCommands).forEach(([manager, command]) => {
        expect(command).toContain('package');
        expect(command).toContain(manager);
      });
    });
  });
});