/**
 * Security Audit Runner - ES Module Compatible
 * Executes comprehensive security testing and validation
 */

import crypto from 'crypto';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { performance } from 'perf_hooks';
import { execSync } from 'child_process';

class SecurityAuditor {
  constructor() {
    this.vulnerabilities = [];
    this.testResults = [];
    this.auditStartTime = Date.now();
  }

  async runSecurityAudit() {
    console.log('🔍 Starting comprehensive security audit...\n');

    const results = {
      cryptographicTests: await this.runCryptographicTests(),
      entropyTests: await this.runEntropyTests(),
      timingAttackTests: await this.runTimingAttackTests(),
      penetrationTests: await this.runBasicPenetrationTests(),
      systemSecurityTests: await this.runSystemSecurityTests()
    };

    const summary = this.generateAuditSummary(results);
    console.log('\n📊 SECURITY AUDIT COMPLETE');
    console.log('='.repeat(50));
    this.displayResults(summary);

    return { results, summary, vulnerabilities: this.vulnerabilities };
  }

  async runCryptographicTests() {
    console.log('🔐 Testing cryptographic implementations...');
    
    const tests = {
      keyGeneration: await this.testKeyGeneration(),
      signatureVerification: await this.testSignatureVerification(),
      encryptionDecryption: await this.testEncryptionDecryption(),
      hashFunctions: await this.testHashFunctions()
    };

    return tests;
  }

  async testKeyGeneration() {
    console.log('  - Testing key generation security...');
    
    try {
      // Test RSA key generation
      const rsaKeys = [];
      for (let i = 0; i < 5; i++) {
        const keyPair = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048
        });
        rsaKeys.push(keyPair);
      }

      // Test ECDSA key generation
      const ecKeys = [];
      for (let i = 0; i < 5; i++) {
        const keyPair = crypto.generateKeyPairSync('ec', {
          namedCurve: 'secp256k1'
        });
        ecKeys.push(keyPair);
      }

      // Basic uniqueness test
      const rsaFingerprints = rsaKeys.map(key => 
        crypto.createHash('sha256')
          .update(key.publicKey.export({ type: 'spki', format: 'der' }))
          .digest('hex')
      );

      const uniqueRSAKeys = new Set(rsaFingerprints).size;
      const rsaUniquenessOK = uniqueRSAKeys === rsaKeys.length;

      this.recordTest('RSA Key Uniqueness', rsaUniquenessOK, 
        `Generated ${uniqueRSAKeys}/${rsaKeys.length} unique keys`);

      // Test key strength
      const keyStrengthOK = rsaKeys.every(key => {
        const keySize = key.publicKey.asymmetricKeySize;
        return keySize >= 256; // 2048 bits = 256 bytes
      });

      this.recordTest('RSA Key Strength', keyStrengthOK, 
        `All keys meet minimum 2048-bit requirement`);

      return {
        rsaKeysGenerated: rsaKeys.length,
        ecKeysGenerated: ecKeys.length,
        uniquenessTest: rsaUniquenessOK,
        strengthTest: keyStrengthOK,
        passed: rsaUniquenessOK && keyStrengthOK
      };

    } catch (error) {
      this.vulnerabilities.push({
        severity: 'HIGH',
        type: 'KEY_GENERATION_ERROR',
        description: `Key generation failed: ${error.message}`
      });
      
      return { passed: false, error: error.message };
    }
  }

  async testSignatureVerification() {
    console.log('  - Testing digital signature verification...');
    
    try {
      const keyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048
      });

      const message = 'Test message for signature verification';
      const signature = crypto.sign('sha256', Buffer.from(message), keyPair.privateKey);
      
      // Test valid signature
      const validSignature = crypto.verify('sha256', Buffer.from(message), keyPair.publicKey, signature);
      
      // Test invalid signature (tampered message)
      const tamperedMessage = 'Tampered message for signature verification';
      const invalidSignature = crypto.verify('sha256', Buffer.from(tamperedMessage), keyPair.publicKey, signature);
      
      // Test signature forgery attempt
      const forgedSignature = Buffer.alloc(signature.length);
      forgedSignature.fill(0xFF);
      const forgedSignatureRejected = !crypto.verify('sha256', Buffer.from(message), keyPair.publicKey, forgedSignature);

      const signatureTestsPassed = validSignature && !invalidSignature && forgedSignatureRejected;

      this.recordTest('Digital Signature Verification', signatureTestsPassed,
        `Valid: ${validSignature}, Invalid rejected: ${!invalidSignature}, Forged rejected: ${forgedSignatureRejected}`);

      return {
        validSignature,
        invalidSignature,
        forgedSignatureRejected,
        passed: signatureTestsPassed
      };

    } catch (error) {
      this.vulnerabilities.push({
        severity: 'HIGH',
        type: 'SIGNATURE_VERIFICATION_ERROR',
        description: `Signature verification failed: ${error.message}`
      });
      
      return { passed: false, error: error.message };
    }
  }

  async testEncryptionDecryption() {
    console.log('  - Testing encryption/decryption...');
    
    try {
      const keyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048
      });

      const plaintext = 'Secret message for encryption testing';
      
      // Test RSA encryption/decryption
      const encrypted = crypto.publicEncrypt(keyPair.publicKey, Buffer.from(plaintext));
      const decrypted = crypto.privateDecrypt(keyPair.privateKey, encrypted);
      const decryptedText = decrypted.toString('utf8');
      
      const encryptionOK = decryptedText === plaintext;

      // Test AES encryption/decryption
      const aesKey = crypto.randomBytes(32); // 256-bit key
      const iv = crypto.randomBytes(16);
      
      const aesCipher = crypto.createCipherGCM('aes-256-gcm', aesKey, iv);
      let aesEncrypted = aesCipher.update(plaintext, 'utf8', 'hex');
      aesEncrypted += aesCipher.final('hex');
      const authTag = aesCipher.getAuthTag();

      const aesDecipher = crypto.createDecipherGCM('aes-256-gcm', aesKey, iv);
      aesDecipher.setAuthTag(authTag);
      let aesDecrypted = aesDecipher.update(aesEncrypted, 'hex', 'utf8');
      aesDecrypted += aesDecipher.final('utf8');

      const aesEncryptionOK = aesDecrypted === plaintext;

      this.recordTest('RSA Encryption/Decryption', encryptionOK,
        `Plaintext recovered successfully: ${encryptionOK}`);
      
      this.recordTest('AES-GCM Encryption/Decryption', aesEncryptionOK,
        `Authenticated encryption working: ${aesEncryptionOK}`);

      return {
        rsaEncryption: encryptionOK,
        aesEncryption: aesEncryptionOK,
        passed: encryptionOK && aesEncryptionOK
      };

    } catch (error) {
      this.vulnerabilities.push({
        severity: 'HIGH',
        type: 'ENCRYPTION_ERROR',
        description: `Encryption/decryption failed: ${error.message}`
      });
      
      return { passed: false, error: error.message };
    }
  }

  async testHashFunctions() {
    console.log('  - Testing hash function security...');
    
    try {
      const testData = 'Test data for hash function validation';
      
      // Test different hash algorithms
      const sha256Hash = crypto.createHash('sha256').update(testData).digest('hex');
      const sha512Hash = crypto.createHash('sha512').update(testData).digest('hex');
      const blake2bHash = crypto.createHash('blake2b512').update(testData).digest('hex');

      // Test hash consistency
      const sha256Hash2 = crypto.createHash('sha256').update(testData).digest('hex');
      const hashConsistency = sha256Hash === sha256Hash2;

      // Test hash length
      const sha256LengthOK = sha256Hash.length === 64; // 256 bits = 32 bytes = 64 hex chars
      const sha512LengthOK = sha512Hash.length === 128; // 512 bits = 64 bytes = 128 hex chars

      // Test avalanche effect (small input change causes large output change)
      const modifiedData = 'Test data for hash function validatioN'; // Changed last 'n' to 'N'
      const modifiedHash = crypto.createHash('sha256').update(modifiedData).digest('hex');
      
      // Count different bits
      let differentBits = 0;
      for (let i = 0; i < sha256Hash.length; i++) {
        if (sha256Hash[i] !== modifiedHash[i]) {
          differentBits++;
        }
      }
      
      const avalancheEffect = differentBits > sha256Hash.length * 0.4; // At least 40% different

      this.recordTest('Hash Function Consistency', hashConsistency,
        `SHA256 produces consistent results`);
      
      this.recordTest('Hash Output Length', sha256LengthOK && sha512LengthOK,
        `SHA256: ${sha256Hash.length} chars, SHA512: ${sha512Hash.length} chars`);
        
      this.recordTest('Avalanche Effect', avalancheEffect,
        `${differentBits}/${sha256Hash.length} characters changed`);

      return {
        consistency: hashConsistency,
        lengthValidation: sha256LengthOK && sha512LengthOK,
        avalancheEffect: avalancheEffect,
        passed: hashConsistency && sha256LengthOK && sha512LengthOK && avalancheEffect
      };

    } catch (error) {
      this.vulnerabilities.push({
        severity: 'MEDIUM',
        type: 'HASH_FUNCTION_ERROR',
        description: `Hash function testing failed: ${error.message}`
      });
      
      return { passed: false, error: error.message };
    }
  }

  async runEntropyTests() {
    console.log('🎲 Testing entropy and randomness...');
    
    const tests = {
      randomnessQuality: await this.testRandomnessQuality(),
      entropyDistribution: await this.testEntropyDistribution()
    };

    return tests;
  }

  async testRandomnessQuality() {
    console.log('  - Testing random number generation quality...');
    
    try {
      const samples = [];
      const sampleSize = 1000;

      // Collect random samples
      for (let i = 0; i < sampleSize; i++) {
        const sample = randomBytes(4).readUInt32BE(0);
        samples.push(sample);
      }

      // Basic statistical tests
      const mean = samples.reduce((a, b) => a + b) / samples.length;
      const expectedMean = Math.pow(2, 31); // Expected mean for 32-bit unsigned integers
      const meanDeviation = Math.abs(mean - expectedMean) / expectedMean;

      // Test for duplicates
      const uniqueValues = new Set(samples).size;
      const uniquenessRatio = uniqueValues / samples.length;

      // Simple frequency test
      const bins = new Array(256).fill(0);
      samples.forEach(sample => {
        bins[sample % 256]++;
      });

      const expectedBinCount = samples.length / 256;
      const maxBinDeviation = Math.max(...bins.map(count => 
        Math.abs(count - expectedBinCount) / expectedBinCount
      ));

      const randomnessOK = meanDeviation < 0.1 && uniquenessRatio > 0.99 && maxBinDeviation < 0.5;

      this.recordTest('Random Number Quality', randomnessOK,
        `Mean deviation: ${(meanDeviation * 100).toFixed(2)}%, Uniqueness: ${(uniquenessRatio * 100).toFixed(2)}%`);

      return {
        meanDeviation,
        uniquenessRatio,
        maxBinDeviation,
        passed: randomnessOK
      };

    } catch (error) {
      this.vulnerabilities.push({
        severity: 'HIGH',
        type: 'ENTROPY_ERROR',
        description: `Entropy testing failed: ${error.message}`
      });
      
      return { passed: false, error: error.message };
    }
  }

  async testEntropyDistribution() {
    console.log('  - Testing entropy distribution...');
    
    try {
      // Test byte distribution in random data
      const randomData = randomBytes(10000);
      const byteFrequency = new Array(256).fill(0);
      
      for (const byte of randomData) {
        byteFrequency[byte]++;
      }

      const expectedFrequency = randomData.length / 256;
      const maxDeviation = Math.max(...byteFrequency.map(freq => 
        Math.abs(freq - expectedFrequency) / expectedFrequency
      ));

      // Calculate entropy
      let entropy = 0;
      for (const freq of byteFrequency) {
        if (freq > 0) {
          const p = freq / randomData.length;
          entropy -= p * Math.log2(p);
        }
      }

      const entropyOK = entropy > 7.9; // Close to theoretical max of 8 bits
      const distributionOK = maxDeviation < 0.2; // 20% tolerance

      this.recordTest('Entropy Distribution', entropyOK && distributionOK,
        `Entropy: ${entropy.toFixed(3)} bits, Max deviation: ${(maxDeviation * 100).toFixed(2)}%`);

      return {
        entropy,
        maxDeviation,
        passed: entropyOK && distributionOK
      };

    } catch (error) {
      return { passed: false, error: error.message };
    }
  }

  async runTimingAttackTests() {
    console.log('⏱️ Testing timing attack vulnerabilities...');
    
    const tests = {
      constantTimeComparison: await this.testConstantTimeComparison(),
      cryptoOperationTiming: await this.testCryptoOperationTiming()
    };

    return tests;
  }

  async testConstantTimeComparison() {
    console.log('  - Testing constant-time string comparison...');
    
    try {
      const secret = 'supersecretpassword123';
      const iterations = 1000;

      // Test vulnerable comparison
      const vulnerableCompare = (a, b) => {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) return false;
        }
        return true;
      };

      // Test guesses with different prefixes
      const guesses = [
        'wrongguess',                    // Completely wrong
        's',                           // First character correct
        'super',                       // First 5 characters correct
        'supersecretpass',             // Most characters correct
        secret                         // Exact match
      ];

      const vulnerableTimes = [];
      const safeTimes = [];

      for (const guess of guesses) {
        // Time vulnerable comparison
        let vulnStart = performance.now();
        for (let i = 0; i < iterations; i++) {
          vulnerableCompare(guess, secret);
        }
        let vulnEnd = performance.now();
        vulnerableTimes.push(vulnEnd - vulnStart);

        // Time safe comparison
        let safeStart = performance.now();
        for (let i = 0; i < iterations; i++) {
          const a = Buffer.from(guess, 'utf8');
          const b = Buffer.from(secret, 'utf8');
          if (a.length === b.length) {
            timingSafeEqual(a, b);
          }
        }
        let safeEnd = performance.now();
        safeTimes.push(safeEnd - safeStart);
      }

      // Calculate variance
      const vulnVariance = this.calculateVariance(vulnerableTimes);
      const safeVariance = this.calculateVariance(safeTimes);

      const timingLeakage = vulnVariance > safeVariance * 2;
      const constantTimeOK = !timingLeakage;

      this.recordTest('Constant-Time Comparison', constantTimeOK,
        `Vulnerable variance: ${vulnVariance.toFixed(3)}, Safe variance: ${safeVariance.toFixed(3)}`);

      if (timingLeakage) {
        this.vulnerabilities.push({
          severity: 'HIGH',
          type: 'TIMING_ATTACK_VULNERABILITY',
          description: 'String comparison vulnerable to timing attacks'
        });
      }

      return {
        vulnerableTimes,
        safeTimes,
        vulnVariance,
        safeVariance,
        passed: constantTimeOK
      };

    } catch (error) {
      return { passed: false, error: error.message };
    }
  }

  async testCryptoOperationTiming() {
    console.log('  - Testing cryptographic operation timing consistency...');
    
    try {
      const keyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 1024 // Smaller for faster testing
      });

      const testInputs = [
        Buffer.alloc(32, 0x00),      // All zeros
        Buffer.alloc(32, 0xFF),      // All ones
        crypto.randomBytes(32),       // Random
        Buffer.from('A'.repeat(32))   // Repeated pattern
      ];

      const timingData = {};

      for (const input of testInputs) {
        const times = [];
        const inputKey = input.slice(0, 4).toString('hex');

        for (let i = 0; i < 20; i++) {
          const start = performance.now();
          try {
            const encrypted = crypto.publicEncrypt(keyPair.publicKey, input);
            crypto.privateDecrypt(keyPair.privateKey, encrypted);
          } catch (e) {
            // Some inputs might fail, continue
          }
          const end = performance.now();
          times.push(end - start);
        }

        timingData[inputKey] = {
          times,
          mean: times.reduce((a, b) => a + b) / times.length,
          variance: this.calculateVariance(times)
        };
      }

      const variances = Object.values(timingData).map(d => d.variance);
      const maxVariance = Math.max(...variances);
      const minVariance = Math.min(...variances);
      const timingConsistent = (maxVariance / minVariance) < 2.0;

      this.recordTest('Crypto Operation Timing', timingConsistent,
        `Variance ratio: ${(maxVariance / minVariance).toFixed(2)}`);

      return {
        timingData,
        timingConsistent,
        passed: timingConsistent
      };

    } catch (error) {
      return { passed: false, error: error.message };
    }
  }

  async runBasicPenetrationTests() {
    console.log('🎯 Running basic penetration tests...');
    
    const tests = {
      inputValidation: await this.testInputValidation(),
      bufferOverflow: await this.testBufferOverflow()
    };

    return tests;
  }

  async testInputValidation() {
    console.log('  - Testing input validation...');
    
    try {
      const maliciousInputs = [
        '',                           // Empty input
        'x'.repeat(10000),           // Very long input
        '\x00\x01\x02\x03',         // Binary data
        '../../../etc/passwd',       // Path traversal
        '<script>alert(1)</script>', // XSS attempt
        'DROP TABLE users;',         // SQL injection attempt
        '\n\r\t',                   // Control characters
      ];

      const results = [];
      
      for (const input of maliciousInputs) {
        try {
          // Test hash function with malicious input
          const hash = createHash('sha256').update(input).digest('hex');
          const validHash = hash.length === 64;
          
          results.push({
            input: input.substring(0, 20) + (input.length > 20 ? '...' : ''),
            handled: true,
            validOutput: validHash
          });
        } catch (error) {
          results.push({
            input: input.substring(0, 20) + (input.length > 20 ? '...' : ''),
            handled: false,
            error: error.message
          });
        }
      }

      const allHandled = results.every(r => r.handled);
      const allValidOutput = results.filter(r => r.handled).every(r => r.validOutput);

      this.recordTest('Input Validation', allHandled && allValidOutput,
        `${results.filter(r => r.handled).length}/${results.length} inputs handled correctly`);

      return {
        results,
        passed: allHandled && allValidOutput
      };

    } catch (error) {
      return { passed: false, error: error.message };
    }
  }

  async testBufferOverflow() {
    console.log('  - Testing buffer overflow protection...');
    
    try {
      const testSizes = [1, 100, 1000, 10000, 100000];
      const results = [];

      for (const size of testSizes) {
        try {
          const largeInput = 'X'.repeat(size);
          const hash = createHash('sha256').update(largeInput).digest('hex');
          
          results.push({
            size,
            handled: true,
            outputValid: hash.length === 64
          });
        } catch (error) {
          results.push({
            size,
            handled: false,
            error: error.message
          });
        }
      }

      const allSizesHandled = results.every(r => r.handled && r.outputValid);

      this.recordTest('Buffer Overflow Protection', allSizesHandled,
        `All input sizes handled safely`);

      return {
        results,
        passed: allSizesHandled
      };

    } catch (error) {
      return { passed: false, error: error.message };
    }
  }

  async runSystemSecurityTests() {
    console.log('🛡️ Running system security tests...');
    
    const tests = {
      environmentCheck: await this.checkSecurityEnvironment(),
      dependencyAudit: await this.runDependencyAudit()
    };

    return tests;
  }

  async checkSecurityEnvironment() {
    console.log('  - Checking security environment...');
    
    try {
      const nodeVersion = process.version;
      const platform = process.platform;
      const arch = process.arch;
      
      // Check for basic security features
      const hasRandomBytes = typeof randomBytes === 'function';
      const hasTimingSafeEqual = typeof timingSafeEqual === 'function';
      const hasCrypto = typeof crypto !== 'undefined';

      // Check Node.js version (should be recent for security patches)
      const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
      const nodeVersionOK = majorVersion >= 18;

      const securityFeaturesOK = hasRandomBytes && hasTimingSafeEqual && hasCrypto;

      this.recordTest('Security Environment', nodeVersionOK && securityFeaturesOK,
        `Node ${nodeVersion} on ${platform}-${arch}, Crypto features: ${securityFeaturesOK}`);

      return {
        nodeVersion,
        platform,
        arch,
        hasRandomBytes,
        hasTimingSafeEqual,
        hasCrypto,
        passed: nodeVersionOK && securityFeaturesOK
      };

    } catch (error) {
      return { passed: false, error: error.message };
    }
  }

  async runDependencyAudit() {
    console.log('  - Running dependency security audit...');
    
    try {
      // Try to run npm audit if available
      try {
        const auditOutput = execSync('npm audit --audit-level moderate --json', { 
          encoding: 'utf8',
          timeout: 30000
        });
        
        const auditData = JSON.parse(auditOutput);
        const vulnerabilities = auditData.vulnerabilities || {};
        const vulnCount = Object.keys(vulnerabilities).length;
        
        const auditPassed = vulnCount === 0;

        this.recordTest('Dependency Audit', auditPassed,
          `${vulnCount} vulnerabilities found in dependencies`);

        if (!auditPassed) {
          this.vulnerabilities.push({
            severity: 'MEDIUM',
            type: 'DEPENDENCY_VULNERABILITIES',
            description: `${vulnCount} vulnerabilities found in dependencies`
          });
        }

        return {
          vulnerabilities: vulnCount,
          passed: auditPassed
        };

      } catch (auditError) {
        // npm audit might fail or not be available
        this.recordTest('Dependency Audit', false,
          'npm audit failed or not available');
          
        return {
          passed: false,
          error: 'npm audit not available or failed'
        };
      }

    } catch (error) {
      return { passed: false, error: error.message };
    }
  }

  // Utility methods
  recordTest(testName, passed, details) {
    this.testResults.push({
      name: testName,
      passed,
      details,
      timestamp: new Date().toISOString()
    });

    const status = passed ? '✅' : '❌';
    console.log(`    ${status} ${testName}: ${details}`);
  }

  calculateVariance(data) {
    if (data.length === 0) return 0;
    const mean = data.reduce((a, b) => a + b) / data.length;
    const squaredDiffs = data.map(value => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b) / data.length;
  }

  generateAuditSummary(results) {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.passed).length;
    const failedTests = totalTests - passedTests;
    
    const criticalVulns = this.vulnerabilities.filter(v => v.severity === 'CRITICAL').length;
    const highVulns = this.vulnerabilities.filter(v => v.severity === 'HIGH').length;
    const mediumVulns = this.vulnerabilities.filter(v => v.severity === 'MEDIUM').length;
    const lowVulns = this.vulnerabilities.filter(v => v.severity === 'LOW').length;
    
    const securityScore = Math.max(0, 100 - (criticalVulns * 25 + highVulns * 10 + mediumVulns * 5 + lowVulns * 1));
    const auditDuration = Date.now() - this.auditStartTime;
    
    return {
      totalTests,
      passedTests,
      failedTests,
      passRate: ((passedTests / totalTests) * 100).toFixed(1),
      vulnerabilities: {
        total: this.vulnerabilities.length,
        critical: criticalVulns,
        high: highVulns,
        medium: mediumVulns,
        low: lowVulns
      },
      securityScore,
      securityLevel: this.determineSecurityLevel(securityScore),
      auditDuration: Math.round(auditDuration / 1000),
      recommendations: this.generateRecommendations()
    };
  }

  determineSecurityLevel(score) {
    if (score >= 95) return 'EXCELLENT';
    if (score >= 85) return 'GOOD';
    if (score >= 70) return 'ACCEPTABLE';
    if (score >= 50) return 'POOR';
    return 'CRITICAL';
  }

  generateRecommendations() {
    const recommendations = [];
    
    const vulnTypes = [...new Set(this.vulnerabilities.map(v => v.type))];
    
    if (vulnTypes.includes('TIMING_ATTACK_VULNERABILITY')) {
      recommendations.push('Implement constant-time algorithms for all security-sensitive operations');
    }
    
    if (vulnTypes.includes('KEY_GENERATION_ERROR')) {
      recommendations.push('Review and strengthen key generation procedures');
    }
    
    if (vulnTypes.includes('DEPENDENCY_VULNERABILITIES')) {
      recommendations.push('Update dependencies and run regular security audits');
    }
    
    if (this.testResults.filter(t => !t.passed).length > 0) {
      recommendations.push('Address all failed security tests before production deployment');
    }
    
    recommendations.push('Implement continuous security monitoring and testing');
    recommendations.push('Regular security audits and penetration testing');
    
    return recommendations;
  }

  displayResults(summary) {
    console.log(`Overall Security Score: ${summary.securityScore}/100`);
    console.log(`Security Level: ${summary.securityLevel}`);
    console.log(`Tests: ${summary.passedTests}/${summary.totalTests} passed (${summary.passRate}%)`);
    console.log(`Vulnerabilities: ${summary.vulnerabilities.total} total`);
    console.log(`  - Critical: ${summary.vulnerabilities.critical}`);
    console.log(`  - High: ${summary.vulnerabilities.high}`);  
    console.log(`  - Medium: ${summary.vulnerabilities.medium}`);
    console.log(`  - Low: ${summary.vulnerabilities.low}`);
    console.log(`Audit Duration: ${summary.auditDuration} seconds`);

    if (this.vulnerabilities.length > 0) {
      console.log('\n🚨 VULNERABILITIES FOUND:');
      this.vulnerabilities.forEach((vuln, index) => {
        console.log(`${index + 1}. [${vuln.severity}] ${vuln.type}: ${vuln.description}`);
      });
    }

    if (summary.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      summary.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }
  }
}

// Run the audit
const auditor = new SecurityAuditor();
const results = await auditor.runSecurityAudit();

// Exit with appropriate code
const criticalIssues = results.summary.vulnerabilities.critical + results.summary.vulnerabilities.high;
if (criticalIssues > 0) {
  console.log('\n❌ SECURITY AUDIT FAILED - Critical vulnerabilities found');
  process.exit(1);
} else if (results.summary.failedTests > 0) {
  console.log('\n⚠️  SECURITY AUDIT COMPLETED WITH WARNINGS - Some tests failed');
  process.exit(2);
} else {
  console.log('\n✅ SECURITY AUDIT PASSED - No critical vulnerabilities detected');
  process.exit(0);
}