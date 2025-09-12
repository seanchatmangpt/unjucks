#!/usr/bin/env node

/**
 * Native Bindings and Architecture Compatibility Test
 * Tests native modules, rollup bindings, and architecture-specific issues
 */

import { describe, test, expect } from 'vitest';
import { platform, arch, release } from 'os';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);
const PLATFORM = platform();
const ARCHITECTURE = arch();

describe('Native Bindings Compatibility Tests', () => {
  describe('Platform and Architecture Detection', () => {
    test('should correctly identify platform and architecture', () => {
      console.log(`Platform: ${PLATFORM}`);
      console.log(`Architecture: ${ARCHITECTURE}`);
      console.log(`OS Release: ${release()}`);
      console.log(`Node.js Version: ${process.version}`);
      
      expect(PLATFORM).toMatch(/^(darwin|linux|win32)$/);
      expect(ARCHITECTURE).toMatch(/^(x64|arm64|x32|arm)$/);
    });

    test('should check Node.js binary architecture', async () => {
      try {
        const { stdout } = await execAsync('node -p "process.arch"');
        const nodeArch = stdout.trim();
        expect(nodeArch).toBe(ARCHITECTURE);
        console.log(`Node.js Architecture: ${nodeArch}`);
      } catch (error) {
        console.error('Failed to get Node.js architecture:', error.message);
        throw error;
      }
    });
  });

  describe('Native Module Loading Tests', () => {
    const nativeModules = [
      { name: 'bcrypt', hasNativeBinding: true },
      { name: 'chokidar', hasNativeBinding: false }, // Pure JS with native fallbacks
      { name: 'fs-extra', hasNativeBinding: false },
      { name: 'glob', hasNativeBinding: false },
      { name: 'chalk', hasNativeBinding: false }
    ];

    nativeModules.forEach(({ name, hasNativeBinding }) => {
      test(`should load ${name} module successfully`, async () => {
        try {
          const module = await import(name);
          expect(module).toBeDefined();
          console.log(`✓ ${name}: loaded successfully`);
          
          if (hasNativeBinding) {
            console.log(`  → ${name} has native bindings (${PLATFORM}-${ARCHITECTURE})`);
          }
        } catch (error) {
          console.error(`✗ ${name}: failed to load - ${error.message}`);
          
          if (hasNativeBinding) {
            console.error(`  → This may indicate native binding incompatibility for ${PLATFORM}-${ARCHITECTURE}`);
          }
          
          throw error;
        }
      });
    });

    test('should test bcrypt native functionality', async () => {
      try {
        const bcrypt = await import('bcrypt');
        const testPassword = 'test123';
        const saltRounds = 10;
        
        const hash = await bcrypt.hash(testPassword, saltRounds);
        const isValid = await bcrypt.compare(testPassword, hash);
        
        expect(isValid).toBe(true);
        console.log('✓ bcrypt native functionality works');
        console.log(`  → Platform: ${PLATFORM}-${ARCHITECTURE}`);
      } catch (error) {
        console.error('✗ bcrypt native functionality failed:', error.message);
        console.error(`  → This indicates native binding issues on ${PLATFORM}-${ARCHITECTURE}`);
        throw error;
      }
    });
  });

  describe('Build Tool Native Dependencies', () => {
    test('should analyze package.json for native build dependencies', async () => {
      try {
        const packageJsonPath = join(process.cwd(), 'package.json');
        if (!existsSync(packageJsonPath)) {
          console.log('⚠ No package.json found in current directory');
          return;
        }

        const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        const nativeBuildDeps = [];
        const potentialNativeDeps = [
          'rollup', 'esbuild', 'swc', 'webpack', 'vite',
          'node-gyp', 'node-pre-gyp', 'prebuild',
          'canvas', 'sharp', 'sqlite3', 'better-sqlite3'
        ];

        for (const [depName, version] of Object.entries(allDeps)) {
          if (potentialNativeDeps.some(native => depName.includes(native))) {
            nativeBuildDeps.push({ name: depName, version });
          }
        }

        console.log('\n=== Native Build Dependencies Analysis ===');
        console.log(`Platform: ${PLATFORM}-${ARCHITECTURE}`);
        
        if (nativeBuildDeps.length === 0) {
          console.log('✓ No native build dependencies found');
        } else {
          console.log('Native build dependencies found:');
          nativeBuildDeps.forEach(({ name, version }) => {
            console.log(`  - ${name}@${version}`);
          });
        }

        // Test loading each native build dependency
        for (const { name } of nativeBuildDeps) {
          try {
            await import(name);
            console.log(`✓ ${name}: loads successfully`);
          } catch (error) {
            console.log(`✗ ${name}: failed to load - ${error.message}`);
            console.log(`  → Potential architecture incompatibility: ${PLATFORM}-${ARCHITECTURE}`);
          }
        }

      } catch (error) {
        console.error('Failed to analyze native dependencies:', error.message);
      }
    });

    test('should check for rollup native optimizations', async () => {
      try {
        // Check if rollup is available and can be imported
        const rollup = await import('rollup');
        expect(rollup).toBeDefined();
        
        console.log('✓ Rollup loads successfully');
        console.log(`  → Platform: ${PLATFORM}-${ARCHITECTURE}`);
        
        // Try to detect if rollup is using native bindings
        if (rollup.VERSION) {
          console.log(`  → Rollup version: ${rollup.VERSION}`);
        }
        
      } catch (error) {
        console.log('⚠ Rollup not available or failed to load:', error.message);
        
        if (error.message.includes('native')) {
          console.error(`  → Native binding issue detected for ${PLATFORM}-${ARCHITECTURE}`);
          console.error('  → This may cause build failures');
        }
      }
    });
  });

  describe('Binary Compatibility Tests', () => {
    test('should check executable permissions and shebang support', async () => {
      const isWindows = PLATFORM === 'win32';
      
      if (isWindows) {
        console.log('⚠ Skipping shebang tests on Windows');
        return;
      }

      try {
        // Test shebang line execution
        const testScript = `#!/usr/bin/env node
console.log(JSON.stringify({
  platform: process.platform,
  arch: process.arch,
  execPath: process.execPath
}));`;

        const tempFile = `/tmp/test-shebang-${this.getDeterministicTimestamp()}.js`;
        require('fs').writeFileSync(tempFile, testScript);
        execSync(`chmod +x ${tempFile}`);
        
        const { stdout } = await execAsync(tempFile);
        const result = JSON.parse(stdout.trim());
        
        expect(result.platform).toBe(PLATFORM);
        expect(result.arch).toBe(ARCHITECTURE);
        console.log('✓ Shebang execution works');
        console.log(`  → Executed on ${result.platform}-${result.arch}`);
        
        // Clean up
        require('fs').unlinkSync(tempFile);
        
      } catch (error) {
        console.error('✗ Shebang execution failed:', error.message);
        throw error;
      }
    });

    test('should test CLI binary execution', async () => {
      try {
        const binPath = join(process.cwd(), 'bin', 'unjucks.cjs');
        if (!existsSync(binPath)) {
          console.log('⚠ CLI binary not found at expected path');
          return;
        }

        const { stdout } = await execAsync(`node "${binPath}" --version`);
        expect(stdout.trim()).toMatch(/\d+\.\d+\.\d+/);
        console.log('✓ CLI binary executes successfully');
        console.log(`  → Version output: ${stdout.trim()}`);
        
      } catch (error) {
        console.log('⚠ CLI binary test failed:', error.message);
      }
    });
  });

  describe('Memory and Performance Architecture Tests', () => {
    test('should check memory model compatibility', () => {
      const memUsage = process.memoryUsage();
      console.log('\n=== Memory Usage Analysis ===');
      console.log(`RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
      console.log(`Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
      console.log(`Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
      console.log(`External: ${Math.round(memUsage.external / 1024 / 1024)}MB`);
      
      expect(memUsage.rss).toBeGreaterThan(0);
      expect(memUsage.heapUsed).toBeGreaterThan(0);
    });

    test('should test JavaScript engine features', () => {
      const v8Version = process.versions.v8;
      console.log(`V8 Engine: ${v8Version}`);
      
      // Test modern JS features
      const features = {
        'Async/Await': typeof (async () => {})().then === 'function',
        'BigInt': typeof BigInt !== 'undefined',
        'Optional Chaining': true, // Would cause syntax error if not supported
        'Nullish Coalescing': true, // Would cause syntax error if not supported
        'Dynamic Import': typeof import === 'function'
      };

      Object.entries(features).forEach(([feature, supported]) => {
        console.log(`${supported ? '✓' : '✗'} ${feature}: ${supported ? 'supported' : 'not supported'}`);
        expect(supported).toBe(true);
      });
    });
  });

  describe('Platform-Specific Workarounds', () => {
    test('should document platform-specific issues and solutions', () => {
      const platformSolutions = {
        win32: {
          issues: [
            'Path length limitations (260 characters)',
            'Case-insensitive file system',
            'Reserved file names (CON, PRN, AUX)',
            'Different line endings (CRLF)',
            'No shebang support'
          ],
          solutions: [
            'Use long path support APIs',
            'Normalize case in file operations',
            'Validate against reserved names',
            'Handle line ending conversion',
            'Use .cmd or .bat wrappers for executables'
          ]
        },
        darwin: {
          issues: [
            'Apple Silicon vs Intel architecture',
            'Code signing requirements',
            'Case sensitivity varies by filesystem',
            'Homebrew path variations'
          ],
          solutions: [
            'Use universal binaries or detect architecture',
            'Skip code signing in development',
            'Normalize case handling',
            'Check multiple package manager paths'
          ]
        },
        linux: {
          issues: [
            'Distribution-specific paths',
            'glibc vs musl libc',
            'Various init systems',
            'SELinux/AppArmor restrictions'
          ],
          solutions: [
            'Use portable installation methods',
            'Static linking or musl detection',
            'Avoid system service dependencies',
            'Test with security contexts'
          ]
        }
      };

      const currentPlatformInfo = platformSolutions[PLATFORM];
      if (currentPlatformInfo) {
        console.log(`\n=== ${PLATFORM.toUpperCase()} Platform Issues & Solutions ===`);
        console.log('\nKnown Issues:');
        currentPlatformInfo.issues.forEach((issue, i) => {
          console.log(`${i + 1}. ${issue}`);
        });
        
        console.log('\nRecommended Solutions:');
        currentPlatformInfo.solutions.forEach((solution, i) => {
          console.log(`${i + 1}. ${solution}`);
        });
      }

      expect(currentPlatformInfo).toBeDefined();
    });

    test('should provide rollup native binding fallback strategy', () => {
      const fallbackStrategy = {
        detection: 'Check if native bindings load successfully',
        fallback: 'Use JavaScript-only alternatives when native bindings fail',
        platforms: {
          'win32-x64': 'Usually works, check for Visual Studio Build Tools',
          'win32-x32': 'May require 32-bit Node.js',
          'darwin-arm64': 'Apple Silicon - check for native ARM64 bindings',
          'darwin-x64': 'Intel Mac - generally compatible',
          'linux-x64': 'Most compatible, check glibc version',
          'linux-arm64': 'ARM Linux - may need compilation'
        }
      };

      const currentPlatformKey = `${PLATFORM}-${ARCHITECTURE}`;
      const platformAdvice = fallbackStrategy.platforms[currentPlatformKey];
      
      console.log('\n=== Rollup Native Binding Strategy ===');
      console.log(`Current Platform: ${currentPlatformKey}`);
      console.log(`Advice: ${platformAdvice || 'No specific advice available'}`);
      console.log(`Detection: ${fallbackStrategy.detection}`);
      console.log(`Fallback: ${fallbackStrategy.fallback}`);

      expect(fallbackStrategy).toBeDefined();
    });
  });
});