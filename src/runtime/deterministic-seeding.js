/**
 * Deterministic Seeding System
 * 
 * Advanced deterministic seeding for reproducible random number generation,
 * UUID generation, and other sources of non-determinism in builds.
 * 
 * Agent 12: Hermetic Runtime Manager - Deterministic Seeding
 */

import { createHash, randomBytes } from 'crypto';
import { consola } from 'consola';

class DeterministicSeeding {
  constructor(options = {}) {
    this.options = {
      globalSeed: options.globalSeed || this.generateDefaultSeed(),
      enableMathRandom: options.enableMathRandom !== false,
      enableCryptoRandom: options.enableCryptoRandom !== false,
      enableUuidGeneration: options.enableUuidGeneration !== false,
      enableDateNow: options.enableDateNow !== false,
      enableProcessHrtime: options.enableProcessHrtime !== false,
      seedNamespace: options.seedNamespace || 'kgen-deterministic',
      ...options
    };

    this.logger = consola.withTag('deterministic-seed');
    this.originalFunctions = new Map();
    this.seedRegistry = new Map();
    this.randomStates = new Map();
    this.isActive = false;
    
    // Seeded random number generators
    this.generators = {
      lcg: this.createLCGGenerator(this.options.globalSeed),
      xorshift: this.createXorShiftGenerator(this.options.globalSeed),
      mulberry32: this.createMulberry32Generator(this.options.globalSeed)
    };
    
    this.currentGenerator = this.generators.mulberry32; // Default to high-quality generator
  }

  /**
   * Generate default seed from environment and context
   */
  generateDefaultSeed() {
    // Use SOURCE_DATE_EPOCH or KGEN_RANDOM_SEED if available
    if (process.env.SOURCE_DATE_EPOCH) {
      return parseInt(process.env.SOURCE_DATE_EPOCH);
    }
    
    if (process.env.KGEN_RANDOM_SEED) {
      return parseInt(process.env.KGEN_RANDOM_SEED) || 12345;
    }
    
    // Generate seed from build context for reproducibility
    const context = [
      process.version,
      process.platform,
      process.arch,
      process.cwd(),
      '2024-01-01' // Fixed date for reproducibility
    ].join('|');
    
    const hash = createHash('sha256').update(context).digest('hex');
    return parseInt(hash.substring(0, 8), 16);
  }

  /**
   * Create Linear Congruential Generator
   */
  createLCGGenerator(seed) {
    return {
      name: 'lcg',
      state: seed % 2147483647, // Ensure positive 32-bit integer
      next() {
        this.state = (this.state * 16807) % 2147483647;
        return (this.state - 1) / 2147483646;
      },
      reset(newSeed) {
        this.state = (newSeed || seed) % 2147483647;
      }
    };
  }

  /**
   * Create XorShift Generator (higher quality)
   */
  createXorShiftGenerator(seed) {
    return {
      name: 'xorshift',
      state: seed || 1,
      next() {
        this.state ^= this.state << 13;
        this.state ^= this.state >> 17;
        this.state ^= this.state << 5;
        return Math.abs(this.state) / 2147483647;
      },
      reset(newSeed) {
        this.state = newSeed || seed || 1;
      }
    };
  }

  /**
   * Create Mulberry32 Generator (high quality, fast)
   */
  createMulberry32Generator(seed) {
    return {
      name: 'mulberry32',
      state: seed >>> 0, // Ensure unsigned 32-bit integer
      next() {
        let t = this.state += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      },
      reset(newSeed) {
        this.state = (newSeed || seed) >>> 0;
      }
    };
  }

  /**
   * Generate seeded random bytes
   */
  generateSeededBytes(length, seed = null) {
    const generator = seed ? this.createMulberry32Generator(seed) : this.currentGenerator;
    const bytes = new Uint8Array(length);
    
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(generator.next() * 256);
    }
    
    return bytes;
  }

  /**
   * Generate deterministic UUID
   */
  generateDeterministicUuid(namespace = 'default') {
    const namespaceSeed = this.createNamespaceSeed(namespace);
    const bytes = this.generateSeededBytes(16, namespaceSeed);
    
    // Set version (4) and variant bits for UUID v4 format
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant bits
    
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    
    return [
      hex.substring(0, 8),
      hex.substring(8, 12),
      hex.substring(12, 16),
      hex.substring(16, 20),
      hex.substring(20, 32)
    ].join('-');
  }

  /**
   * Create namespace-specific seed
   */
  createNamespaceSeed(namespace) {
    const nsString = `${this.options.seedNamespace}:${namespace}:${this.options.globalSeed}`;
    const hash = createHash('sha256').update(nsString).digest('hex');
    return parseInt(hash.substring(0, 8), 16);
  }

  /**
   * Activate deterministic seeding
   */
  activate() {
    if (this.isActive) {
      this.logger.warn('Deterministic seeding already active');
      return;
    }

    this.logger.info(`Activating deterministic seeding (seed: ${this.options.globalSeed})`);

    try {
      if (this.options.enableMathRandom) {
        this.replaceMathRandom();
      }

      if (this.options.enableCryptoRandom) {
        this.replaceCryptoRandom();
      }

      if (this.options.enableUuidGeneration) {
        this.replaceUuidGeneration();
      }

      if (this.options.enableDateNow) {
        this.replaceDateNow();
      }

      if (this.options.enableProcessHrtime) {
        this.replaceProcessHrtime();
      }

      this.isActive = true;
      
      // Mark as active globally
      global.__KGEN_DETERMINISTIC_SEEDING__ = {
        seed: this.options.globalSeed,
        generator: this.currentGenerator.name,
        restore: () => this.deactivate()
      };

      this.logger.success('Deterministic seeding activated');
      
    } catch (error) {
      this.logger.error('Failed to activate deterministic seeding:', error);
      this.deactivate(); // Clean up partial activation
      throw error;
    }
  }

  /**
   * Replace Math.random with deterministic version
   */
  replaceMathRandom() {
    if (!this.originalFunctions.has('Math.random')) {
      this.originalFunctions.set('Math.random', Math.random);
    }

    const self = this;
    Math.random = function() {
      return self.currentGenerator.next();
    };

    this.logger.debug('Replaced Math.random with deterministic generator');
  }

  /**
   * Replace crypto.randomBytes and crypto.randomFillSync
   */
  replaceCryptoRandom() {
    try {
      const crypto = require('crypto');

      // Store original functions
      if (!this.originalFunctions.has('crypto.randomBytes')) {
        this.originalFunctions.set('crypto.randomBytes', crypto.randomBytes);
        this.originalFunctions.set('crypto.randomFillSync', crypto.randomFillSync);
      }

      const self = this;

      // Replace randomBytes
      crypto.randomBytes = function(size, callback) {
        const bytes = self.generateSeededBytes(size);
        const buffer = Buffer.from(bytes);
        
        if (callback) {
          process.nextTick(() => callback(null, buffer));
        } else {
          return buffer;
        }
      };

      // Replace randomFillSync
      crypto.randomFillSync = function(buffer, offset = 0, size = null) {
        if (size === null) {
          size = buffer.length - offset;
        }
        
        const bytes = self.generateSeededBytes(size);
        
        for (let i = 0; i < size; i++) {
          buffer[offset + i] = bytes[i];
        }
        
        return buffer;
      };

      this.logger.debug('Replaced crypto random functions with deterministic versions');

    } catch (error) {
      this.logger.warn('Could not replace crypto functions:', error.message);
    }
  }

  /**
   * Replace UUID generation libraries
   */
  replaceUuidGeneration() {
    try {
      // Try to replace common UUID libraries
      const uuidLibraries = ['uuid', 'node-uuid', 'uuid-js'];
      
      for (const libName of uuidLibraries) {
        try {
          const uuidLib = require(libName);
          this.replaceUuidLibrary(libName, uuidLib);
        } catch (error) {
          // Library not found, continue
        }
      }

    } catch (error) {
      this.logger.warn('Could not replace UUID libraries:', error.message);
    }
  }

  /**
   * Replace specific UUID library
   */
  replaceUuidLibrary(libName, uuidLib) {
    const self = this;

    if (!this.originalFunctions.has(`${libName}.v4`)) {
      this.originalFunctions.set(`${libName}.v4`, uuidLib.v4);
    }

    if (uuidLib.v4) {
      uuidLib.v4 = function(options, buffer, offset) {
        const deterministicUuid = self.generateDeterministicUuid('uuid-v4');
        
        if (buffer) {
          const uuidBytes = deterministicUuid.replace(/-/g, '');
          for (let i = 0; i < 16; i++) {
            buffer[offset + i] = parseInt(uuidBytes.substring(i * 2, i * 2 + 2), 16);
          }
          return buffer;
        }
        
        return deterministicUuid;
      };

      this.logger.debug(`Replaced ${libName}.v4 with deterministic version`);
    }
  }

  /**
   * Replace Date.now with deterministic version
   */
  replaceDateNow() {
    if (!this.originalFunctions.has('Date.now')) {
      this.originalFunctions.set('Date.now', Date.now);
    }

    const deterministicTime = process.env.SOURCE_DATE_EPOCH ? 
      parseInt(process.env.SOURCE_DATE_EPOCH) * 1000 :
      new Date('2024-01-01T00:00:00.000Z').getTime();

    Date.now = function() {
      return deterministicTime;
    };

    this.logger.debug(`Replaced Date.now with deterministic time: ${new Date(deterministicTime).toISOString()}`);
  }

  /**
   * Replace process.hrtime with deterministic version
   */
  replaceProcessHrtime() {
    if (!this.originalFunctions.has('process.hrtime')) {
      this.originalFunctions.set('process.hrtime', process.hrtime);
    }

    const self = this;
    let hrtimeCounter = 0;

    process.hrtime = function(previousTime) {
      // Generate deterministic high-resolution time
      const baseTime = [1640995200, 0]; // 2022-01-01 00:00:00 UTC in hrtime format
      const increment = ++hrtimeCounter;
      
      const seconds = baseTime[0];
      const nanoseconds = baseTime[1] + (increment * 1000000); // Add milliseconds in nanoseconds
      
      if (previousTime) {
        const diffSeconds = seconds - previousTime[0];
        const diffNanoseconds = nanoseconds - previousTime[1];
        return [diffSeconds, diffNanoseconds];
      }
      
      return [seconds, nanoseconds];
    };

    // Replace process.hrtime.bigint if available
    if (process.hrtime.bigint) {
      process.hrtime.bigint = function() {
        const [seconds, nanoseconds] = process.hrtime();
        return BigInt(seconds) * BigInt(1000000000) + BigInt(nanoseconds);
      };
    }

    this.logger.debug('Replaced process.hrtime with deterministic version');
  }

  /**
   * Deactivate deterministic seeding and restore original functions
   */
  deactivate() {
    if (!this.isActive) {
      return;
    }

    this.logger.info('Deactivating deterministic seeding...');

    try {
      // Restore all original functions
      for (const [key, originalFunction] of this.originalFunctions) {
        const [object, method] = this.parseObjectMethod(key);
        
        if (object && method && object[method]) {
          object[method] = originalFunction;
        }
      }

      this.originalFunctions.clear();
      this.isActive = false;

      // Clean up global marker
      if (global.__KGEN_DETERMINISTIC_SEEDING__) {
        delete global.__KGEN_DETERMINISTIC_SEEDING__;
      }

      this.logger.success('Deterministic seeding deactivated');

    } catch (error) {
      this.logger.error('Error during deactivation:', error);
    }
  }

  /**
   * Parse object.method string into object and method
   */
  parseObjectMethod(key) {
    if (key === 'Math.random') {
      return [Math, 'random'];
    }
    
    if (key === 'Date.now') {
      return [Date, 'now'];
    }
    
    if (key === 'process.hrtime') {
      return [process, 'hrtime'];
    }
    
    if (key.startsWith('crypto.')) {
      try {
        const crypto = require('crypto');
        const method = key.split('.')[1];
        return [crypto, method];
      } catch (error) {
        return [null, null];
      }
    }
    
    if (key.includes('.v4')) {
      try {
        const libName = key.split('.')[0];
        const uuidLib = require(libName);
        return [uuidLib, 'v4'];
      } catch (error) {
        return [null, null];
      }
    }
    
    return [null, null];
  }

  /**
   * Reset generator state with new seed
   */
  resetSeed(newSeed = null) {
    const seed = newSeed || this.options.globalSeed;
    
    for (const generator of Object.values(this.generators)) {
      generator.reset(seed);
    }
    
    this.options.globalSeed = seed;
    
    this.logger.debug(`Reset generators with seed: ${seed}`);
  }

  /**
   * Get current seeding status
   */
  getStatus() {
    return {
      active: this.isActive,
      globalSeed: this.options.globalSeed,
      generator: this.currentGenerator.name,
      options: {
        enableMathRandom: this.options.enableMathRandom,
        enableCryptoRandom: this.options.enableCryptoRandom,
        enableUuidGeneration: this.options.enableUuidGeneration,
        enableDateNow: this.options.enableDateNow,
        enableProcessHrtime: this.options.enableProcessHrtime
      },
      replacedFunctions: Array.from(this.originalFunctions.keys())
    };
  }

  /**
   * Test deterministic behavior
   */
  testDeterminism() {
    const results = {
      mathRandom: [],
      deterministicUuid: [],
      seededBytes: []
    };

    // Test with same seed multiple times
    for (let i = 0; i < 3; i++) {
      this.resetSeed(12345);
      
      // Test Math.random (if replaced)
      if (this.options.enableMathRandom) {
        results.mathRandom.push(Math.random());
      }
      
      // Test deterministic UUID
      results.deterministicUuid.push(this.generateDeterministicUuid('test'));
      
      // Test seeded bytes
      results.seededBytes.push(Array.from(this.generateSeededBytes(4, 12345)));
    }

    // Check if all results are identical
    const isDeterministic = {
      mathRandom: results.mathRandom.length === 0 || 
        results.mathRandom.every(val => val === results.mathRandom[0]),
      deterministicUuid: results.deterministicUuid.every(val => val === results.deterministicUuid[0]),
      seededBytes: results.seededBytes.every(arr => 
        JSON.stringify(arr) === JSON.stringify(results.seededBytes[0]))
    };

    return {
      results,
      isDeterministic,
      allDeterministic: Object.values(isDeterministic).every(Boolean)
    };
  }

  /**
   * Generate seed from string
   */
  static seedFromString(str) {
    const hash = createHash('sha256').update(str).digest('hex');
    return parseInt(hash.substring(0, 8), 16);
  }

  /**
   * Create seeding instance from environment
   */
  static fromEnvironment(options = {}) {
    const envSeed = process.env.KGEN_RANDOM_SEED || process.env.SOURCE_DATE_EPOCH;
    
    return new DeterministicSeeding({
      globalSeed: envSeed ? parseInt(envSeed) : undefined,
      ...options
    });
  }
}

/**
 * Global deterministic seeding instance
 */
let globalSeeding = null;

/**
 * Activate global deterministic seeding
 */
export function activateDeterministicSeeding(options = {}) {
  if (globalSeeding && globalSeeding.isActive) {
    globalSeeding.logger.warn('Global deterministic seeding already active');
    return globalSeeding;
  }

  globalSeeding = DeterministicSeeding.fromEnvironment(options);
  globalSeeding.activate();
  
  return globalSeeding;
}

/**
 * Deactivate global deterministic seeding
 */
export function deactivateDeterministicSeeding() {
  if (globalSeeding) {
    globalSeeding.deactivate();
    globalSeeding = null;
  }
}

/**
 * Get global seeding instance
 */
export function getGlobalSeeding() {
  return globalSeeding;
}

/**
 * Check if deterministic seeding is active
 */
export function isDeterministicSeedingActive() {
  return globalSeeding?.isActive || false;
}

export default DeterministicSeeding;
export { DeterministicSeeding };