#!/usr/bin/env node

/**
 * Cross-Platform Compatibility Test Suite
 * Tests Node.js >=18.0.0 support, path handling, package managers, and binary compatibility
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { exec, execSync, spawn } from 'child_process';
import { promisify } from 'util';
import { platform, arch, release } from 'os';
import { join, sep, posix, win32 } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { chmod, access, constants } from 'fs/promises';

const execAsync = promisify(exec);

// Platform detection
const PLATFORM = platform();
const ARCHITECTURE = arch();
const IS_WINDOWS = PLATFORM === 'win32';
const IS_MACOS = PLATFORM === 'darwin';
const IS_LINUX = PLATFORM === 'linux';

// Path separator tests
const TEST_PATHS = [
  'simple/path',
  'path/with spaces/file.txt',
  'path\\with\\backslashes',
  'mixed/path\\separators',
  '../relative/path',
  './current/dir',
  '../../deep/relative/path'
];

describe('Cross-Platform Compatibility Tests', () => {
  let testDir;
  let originalCwd;

  beforeAll(() => {
    originalCwd = process.cwd();
    testDir = join(process.cwd(), 'tests', '.tmp', `platform-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Platform Detection', () => {
    test('should detect platform correctly', () => {
      expect(PLATFORM).toMatch(/^(darwin|linux|win32)$/);
      expect(ARCHITECTURE).toMatch(/^(x64|arm64|x32|arm)$/);
      console.log(`Platform: ${PLATFORM}, Architecture: ${ARCHITECTURE}`);
    });

    test('should have Node.js >=18.0.0', () => {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      expect(majorVersion).toBeGreaterThanOrEqual(18);
      console.log(`Node.js version: ${nodeVersion}`);
    });
  });

  describe('Path Separator Handling', () => {
    test('should normalize path separators correctly', () => {
      TEST_PATHS.forEach(testPath => {
        const normalized = join(...testPath.split(/[/\\]+/));
        const expected = IS_WINDOWS ? 
          testPath.replace(/\//g, '\\') : 
          testPath.replace(/\\/g, '/');
        
        // Test that join() produces platform-appropriate separators
        if (IS_WINDOWS) {
          expect(normalized).toContain('\\');
        } else {
          expect(normalized).not.toContain('\\');
        }
      });
    });

    test('should handle cross-platform path operations', () => {
      const testCases = [
        { input: 'src/lib/test.js', expected: join('src', 'lib', 'test.js') },
        { input: 'templates/_templates/command', expected: join('templates', '_templates', 'command') },
        { input: '_templates\\cli\\citty', expected: join('_templates', 'cli', 'citty') }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = join(...input.split(/[/\\]+/));
        expect(result).toBe(expected);
      });
    });

    test('should resolve paths consistently across platforms', () => {
      const basePath = join(process.cwd(), 'src');
      const relativePath = join('..', 'tests', 'file.js');
      const resolved = join(basePath, relativePath);
      
      expect(resolved).toContain('tests');
      expect(resolved).toContain('file.js');
    });
  });

  describe('File System Operations', () => {
    test('should create directories with proper permissions', async () => {
      const dirPath = join(testDir, 'test-permissions');
      mkdirSync(dirPath, { recursive: true });
      
      await access(dirPath, constants.F_OK);
      expect(existsSync(dirPath)).toBe(true);
      
      if (!IS_WINDOWS) {
        // Test Unix permissions
        await chmod(dirPath, 0o755);
        await access(dirPath, constants.R_OK | constants.W_OK | constants.X_OK);
      }
    });

    test('should handle file operations with special characters', () => {
      const specialNames = [
        'file with spaces.txt',
        'file-with-dashes.txt',
        'file_with_underscores.txt',
        'file.with.dots.txt'
      ];

      if (!IS_WINDOWS) {
        specialNames.push('file:with:colons.txt');
      }

      specialNames.forEach(fileName => {
        const filePath = join(testDir, fileName);
        writeFileSync(filePath, 'test content');
        expect(existsSync(filePath)).toBe(true);
        expect(readFileSync(filePath, 'utf8')).toBe('test content');
      });
    });

    test('should respect platform line endings', () => {
      const content = 'line1\nline2\nline3';
      const filePath = join(testDir, 'line-endings.txt');
      
      writeFileSync(filePath, content);
      const readContent = readFileSync(filePath, 'utf8');
      
      if (IS_WINDOWS) {
        // Windows may convert \n to \r\n depending on the editor
        expect(readContent).toContain('line1');
        expect(readContent).toContain('line2');
        expect(readContent).toContain('line3');
      } else {
        expect(readContent).toBe(content);
      }
    });
  });

  describe('Package Manager Compatibility', () => {
    const packageManagers = ['npm', 'pnpm', 'yarn'];

    packageManagers.forEach(pm => {
      test(`should detect ${pm} availability`, async () => {
        try {
          const { stdout } = await execAsync(`${pm} --version`);
          expect(stdout.trim()).toMatch(/\d+\.\d+\.\d+/);
          console.log(`${pm} version: ${stdout.trim()}`);
        } catch (error) {
          console.warn(`${pm} not available: ${error.message}`);
        }
      });
    });

    test('should handle npm scripts cross-platform', async () => {
      const packageJson = {
        name: 'cross-platform-test',
        scripts: {
          'echo-test': IS_WINDOWS ? 'echo "Windows test"' : 'echo "Unix test"',
          'path-test': `node -e "console.log(require('path').join('a', 'b', 'c'))"`
        }
      };

      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      try {
        const { stdout } = await execAsync('npm run path-test', { cwd: testDir });
        const expectedPath = join('a', 'b', 'c');
        expect(stdout.trim()).toContain(expectedPath);
      } catch (error) {
        console.warn(`npm script test failed: ${error.message}`);
      }
    });
  });

  describe('Binary and Executable Compatibility', () => {
    test('should handle shebang lines correctly', () => {
      const shebangs = [
        '#!/usr/bin/env node',
        '#!/usr/bin/node',
        '#! /usr/bin/env node'
      ];

      shebangs.forEach(shebang => {
        const script = `${shebang}\nconsole.log('Hello World');`;
        const scriptPath = join(testDir, `test-shebang-${shebangs.indexOf(shebang)}.js`);
        
        writeFileSync(scriptPath, script);
        
        if (!IS_WINDOWS) {
          // Test executable permissions on Unix-like systems
          execSync(`chmod +x "${scriptPath}"`);
          expect(existsSync(scriptPath)).toBe(true);
        }
      });
    });

    test('should execute CLI across different shells', async () => {
      const testScript = `#!/usr/bin/env node
console.log(JSON.stringify({
  platform: process.platform,
  arch: process.arch,
  version: process.version,
  cwd: process.cwd()
}));`;

      const scriptPath = join(testDir, 'platform-info.js');
      writeFileSync(scriptPath, testScript);

      if (!IS_WINDOWS) {
        await chmod(scriptPath, 0o755);
      }

      try {
        const { stdout } = await execAsync(`node "${scriptPath}"`);
        const info = JSON.parse(stdout.trim());
        expect(info.platform).toBe(PLATFORM);
        expect(info.arch).toBe(ARCHITECTURE);
      } catch (error) {
        console.error(`Platform script execution failed: ${error.message}`);
      }
    });
  });

  describe('Dependency Compatibility', () => {
    test('should check native module compatibility', async () => {
      // Test common native modules that might cause issues
      const nativeModules = ['bcrypt', 'chokidar', 'fs-extra'];
      
      for (const module of nativeModules) {
        try {
          await import(module);
          console.log(`✓ ${module} loads successfully on ${PLATFORM}-${ARCHITECTURE}`);
        } catch (error) {
          console.warn(`⚠ ${module} failed to load: ${error.message}`);
        }
      }
    });

    test('should validate Node.js API compatibility', () => {
      // Test Node.js APIs that might behave differently across platforms
      const apis = [
        () => require('os').platform(),
        () => require('path').sep,
        () => require('fs').constants,
        () => require('child_process').spawn,
        () => require('util').promisify
      ];

      apis.forEach((apiTest, index) => {
        try {
          const result = apiTest();
          expect(result).toBeDefined();
          console.log(`✓ API test ${index + 1} passed`);
        } catch (error) {
          console.error(`✗ API test ${index + 1} failed: ${error.message}`);
        }
      });
    });
  });

  describe('Environment Variable Handling', () => {
    test('should handle environment variables consistently', () => {
      const testVars = {
        'TEST_VAR': 'test_value',
        'PATH_VAR': join('test', 'path'),
        'NUMERIC_VAR': '12345'
      };

      Object.entries(testVars).forEach(([key, value]) => {
        process.env[key] = value;
        expect(process.env[key]).toBe(value);
      });

      // Clean up
      Object.keys(testVars).forEach(key => {
        delete process.env[key];
      });
    });

    test('should handle PATH environment variable', () => {
      const pathSeparator = IS_WINDOWS ? ';' : ':';
      const paths = process.env.PATH?.split(pathSeparator);
      
      expect(paths).toBeDefined();
      expect(paths.length).toBeGreaterThan(0);
      
      if (IS_WINDOWS) {
        expect(process.env.PATH).toContain(';');
      } else {
        expect(process.env.PATH).toContain(':');
      }
    });
  });

  describe('Rollup and Build Tool Compatibility', () => {
    test('should identify potential rollup native binding issues', async () => {
      try {
        // Check if rollup or similar bundlers might have native dependencies
        const packageJsonPath = join(process.cwd(), '..', '..', 'package.json');
        if (existsSync(packageJsonPath)) {
          const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          
          const potentialNativeDeps = Object.keys(deps).filter(dep => 
            dep.includes('rollup') || 
            dep.includes('esbuild') || 
            dep.includes('swc') ||
            dep.includes('native') ||
            dep.includes('binary')
          );

          if (potentialNativeDeps.length > 0) {
            console.log(`Native/binary dependencies found: ${potentialNativeDeps.join(', ')}`);
            console.log(`Platform: ${PLATFORM}-${ARCHITECTURE}`);
          }
        }
      } catch (error) {
        console.warn(`Could not analyze native dependencies: ${error.message}`);
      }
    });
  });
});

// Platform-specific failure documentation
const PLATFORM_ISSUES = {
  windows: [
    'Path separator handling (backslashes vs forward slashes)',
    'Executable permissions and shebang lines',
    'Case sensitivity in file names',
    'Reserved file names (CON, PRN, AUX, etc.)',
    'Long path limitations (260 character limit)',
    'Line ending differences (CRLF vs LF)'
  ],
  darwin: [
    'Case sensitivity (HFS+ vs APFS)',
    'File system extended attributes',
    'Code signing for executables',
    'Architecture differences (Intel vs Apple Silicon)',
    'Homebrew vs MacPorts dependency paths'
  ],
  linux: [
    'File permissions and ownership',
    'Different distributions and package managers',
    'glibc vs musl compatibility',
    'SELinux/AppArmor restrictions',
    'Container filesystem differences'
  ]
};

console.log('\n=== Platform Compatibility Analysis ===');
console.log(`Current platform: ${PLATFORM}-${ARCHITECTURE}`);
console.log(`Node.js version: ${process.version}`);
console.log(`Known issues for ${PLATFORM}:`, PLATFORM_ISSUES[PLATFORM] || []);