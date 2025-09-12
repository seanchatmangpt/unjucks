/**
 * Cryptographic Configuration
 * 
 * Centralized configuration for all cryptographic operations
 * including key management, signing algorithms, and security policies.
 */

export const cryptoConfig = {
  // Key Management Settings
  keyManagement: {
    // Default key store location
    defaultKeyStorePath: './keys',
    
    // Supported key formats
    supportedFormats: ['PEM', 'JWK', 'DER', 'OPENSSH'],
    
    // Supported algorithms and their configurations
    algorithms: {
      'Ed25519': {
        keySize: 32, // bytes
        signatureSize: 64, // bytes
        strength: 'strong',
        recommended: true,
        description: 'EdDSA using Curve25519'
      },
      'RSA': {
        minKeySize: 2048,
        recommendedKeySize: 3072,
        maxKeySize: 4096,
        strength: 'varies',
        recommended: true,
        description: 'RSA with PKCS#1 padding'
      },
      'ECDSA': {
        curves: ['secp256k1', 'secp256r1', 'secp384r1'],
        defaultCurve: 'secp256k1',
        keySize: 32, // bytes for secp256k1
        signatureSize: 64, // bytes (compact format)
        strength: 'strong',
        recommended: true,
        description: 'Elliptic Curve Digital Signature Algorithm'
      }
    },
    
    // Key derivation settings
    keyDerivation: {
      algorithm: 'PBKDF2',
      iterations: 100000,
      keyLength: 32, // bytes
      hashFunction: 'sha256'
    },
    
    // Encryption settings for key storage
    keyEncryption: {
      algorithm: 'aes-256-cbc',
      ivLength: 16, // bytes
      saltLength: 16 // bytes
    }
  },

  // Security Policies
  securityPolicies: {
    // Minimum key strength requirements
    minKeyStrength: {
      'RSA': 2048,
      'Ed25519': 32,
      'ECDSA': 32
    },
    
    // Key rotation policies
    keyRotation: {
      // Maximum age before key rotation is recommended (in days)
      maxKeyAge: 365,
      // Warning threshold before rotation (in days)
      rotationWarningThreshold: 30,
      // Backup retention period (in days)
      backupRetentionDays: 90
    },
    
    // Password policies for key encryption
    passwordPolicy: {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      maxAttempts: 3
    },
    
    // Audit and logging
    audit: {
      logKeyGeneration: true,
      logKeyUsage: true,
      logKeyRotation: true,
      logFailedAttempts: true,
      retentionDays: 365
    }
  },

  // Hash Functions
  hashFunctions: {
    default: 'sha256',
    supported: ['sha256', 'sha384', 'sha512', 'sha3-256', 'sha3-384', 'sha3-512'],
    fingerprinting: 'sha256',
    passwordHashing: 'sha256'
  },

  // Random Number Generation
  randomGeneration: {
    // Source of randomness
    source: 'crypto.randomBytes', // Node.js crypto module
    // Quality requirements
    entropyRequirement: 256, // bits
    // Testing and validation
    fipsCompliant: false // Set to true for FIPS 140-2 compliance
  },

  // Signature Validation
  signatureValidation: {
    // Maximum signature age (in seconds)
    maxSignatureAge: 3600, // 1 hour
    // Clock skew tolerance (in seconds)
    clockSkewTolerance: 300, // 5 minutes
    // Nonce validation
    requireNonce: true,
    nonceLength: 32 // bytes
  },

  // Performance Settings
  performance: {
    // Caching settings
    keyCache: {
      enabled: true,
      maxSize: 100, // number of keys
      ttl: 300 // seconds (5 minutes)
    },
    
    // Parallel processing
    parallelOperations: {
      maxConcurrentKeyGeneration: 4,
      maxConcurrentSigning: 10,
      maxConcurrentVerification: 20
    },
    
    // Timeouts
    timeouts: {
      keyGeneration: 30000, // milliseconds
      signing: 5000, // milliseconds
      verification: 2000, // milliseconds
      keyLoading: 3000 // milliseconds
    }
  },

  // Development and Testing
  development: {
    // Test key settings
    testKeys: {
      useWeakKeys: false, // Never use weak keys even in dev
      logOperations: true,
      validateAll: true
    },
    
    // Debug settings
    debug: {
      enabled: process.env.NODE_ENV === 'development',
      logLevel: 'info', // 'debug', 'info', 'warn', 'error'
      logCrypto: false // Disable in production for security
    }
  },

  // Compliance and Standards
  compliance: {
    // Standards compliance
    standards: {
      fips140: false, // FIPS 140-2 compliance
      commonCriteria: false, // Common Criteria compliance
      nist: true, // NIST guidelines compliance
      rfc: true // RFC standards compliance
    },
    
    // Audit requirements
    auditRequirements: {
      keyGeneration: true,
      keyUsage: true,
      keyDestruction: true,
      accessControl: true,
      dataIntegrity: true
    }
  }
};

// Environment-specific overrides
if (process.env.NODE_ENV === 'production') {
  // Production security hardening
  cryptoConfig.keyManagement.keyDerivation.iterations = 500000;
  cryptoConfig.securityPolicies.passwordPolicy.minLength = 16;
  cryptoConfig.securityPolicies.keyRotation.maxKeyAge = 180; // 6 months
  cryptoConfig.development.debug.enabled = false;
  cryptoConfig.development.debug.logCrypto = false;
}

if (process.env.NODE_ENV === 'test') {
  // Test environment optimizations
  cryptoConfig.keyManagement.keyDerivation.iterations = 10000; // Faster for tests
  cryptoConfig.performance.timeouts.keyGeneration = 10000; // Shorter timeouts
  cryptoConfig.development.testKeys.logOperations = true;
}

// Validation function for configuration
export function validateCryptoConfig(config = cryptoConfig) {
  const errors = [];
  
  // Validate key derivation settings
  if (config.keyManagement.keyDerivation.iterations < 10000) {
    errors.push('Key derivation iterations too low for security');
  }
  
  // Validate supported algorithms
  const requiredAlgorithms = ['Ed25519', 'RSA', 'ECDSA'];
  for (const alg of requiredAlgorithms) {
    if (!config.keyManagement.algorithms[alg]) {
      errors.push(`Missing configuration for required algorithm: ${alg}`);
    }
  }
  
  // Validate RSA key sizes
  const rsaConfig = config.keyManagement.algorithms.RSA;
  if (rsaConfig && rsaConfig.minKeySize < 2048) {
    errors.push('RSA minimum key size too small for security');
  }
  
  // Validate password policy
  const passwordPolicy = config.securityPolicies.passwordPolicy;
  if (passwordPolicy.minLength < 8) {
    errors.push('Password minimum length too short');
  }
  
  // Validate audit settings
  if (!config.securityPolicies.audit.logKeyGeneration) {
    console.warn('Key generation logging is disabled - this may not comply with security policies');
  }
  
  if (errors.length > 0) {
    throw new Error(`Crypto configuration validation failed: ${errors.join(', ')}`);
  }
  
  return true;
}

// Initialize and validate configuration
validateCryptoConfig();

// Export utility functions
export function getAlgorithmConfig(algorithm) {
  const config = cryptoConfig.keyManagement.algorithms[algorithm];
  if (!config) {
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }
  return config;
}

export function isAlgorithmSupported(algorithm) {
  return algorithm in cryptoConfig.keyManagement.algorithms;
}

export function getSecurityPolicy(policyName) {
  const policy = cryptoConfig.securityPolicies[policyName];
  if (!policy) {
    throw new Error(`Unknown security policy: ${policyName}`);
  }
  return policy;
}

export function getPerformanceConfig(section) {
  const config = cryptoConfig.performance[section];
  if (!config) {
    throw new Error(`Unknown performance section: ${section}`);
  }
  return config;
}

// Export the default configuration
export default cryptoConfig;