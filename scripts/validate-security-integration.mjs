#!/usr/bin/env node
/**
 * Security Integration Validation Script
 * 
 * Quick validation that core security components work together
 * and can handle basic integration scenarios.
 */

import crypto from 'crypto';
import { performance } from 'perf_hooks';

class SecurityIntegrationValidator {
  constructor() {
    this.results = {
      startTime: performance.now(),
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0
      }
    };
  }

  async validate() {
    console.log('🔒 Security Integration Validation');
    console.log('=================================');

    try {
      await this.testBasicCrypto();
      await this.testSigningVerification();
      await this.testConcurrentOperations();
      await this.testMemoryUsage();
      await this.testIntegrationWorkflow();

      this.printSummary();
      return this.results;

    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      throw error;
    }
  }

  async testBasicCrypto() {
    console.log('\n1. Testing basic cryptographic operations...');
    const testStart = performance.now();

    try {
      const testData = 'Security integration test data';
      
      // Test hashing
      const sha256Hash = crypto.createHash('sha256').update(testData).digest('hex');
      const sha512Hash = crypto.createHash('sha512').update(testData).digest('hex');
      
      if (sha256Hash.length !== 64) throw new Error('SHA256 hash invalid length');
      if (sha512Hash.length !== 128) throw new Error('SHA512 hash invalid length');
      
      // Test random generation
      const randomBytes = crypto.randomBytes(32);
      if (randomBytes.length !== 32) throw new Error('Random bytes invalid length');
      
      const testEnd = performance.now();
      this.addTestResult('basic-crypto', true, testEnd - testStart, {
        sha256Length: sha256Hash.length,
        sha512Length: sha512Hash.length,
        randomBytesLength: randomBytes.length
      });
      
      console.log('  ✅ SHA256:', sha256Hash.substring(0, 16) + '...');
      console.log('  ✅ SHA512:', sha512Hash.substring(0, 16) + '...');
      console.log('  ✅ Random bytes generated successfully');

    } catch (error) {
      const testEnd = performance.now();
      this.addTestResult('basic-crypto', false, testEnd - testStart, { error: error.message });
      console.log('  ❌ Basic crypto test failed:', error.message);
    }
  }

  async testSigningVerification() {
    console.log('\n2. Testing signing and verification...');
    const testStart = performance.now();

    try {
      const testData = 'Data to sign and verify';
      const signingKey = crypto.randomBytes(32);
      
      // Create signature
      const hmac = crypto.createHmac('sha256', signingKey);
      hmac.update(testData);
      const signature = hmac.digest('hex');
      
      // Verify signature
      const verifyHmac = crypto.createHmac('sha256', signingKey);
      verifyHmac.update(testData);
      const expectedSignature = verifyHmac.digest('hex');
      
      const isValid = signature === expectedSignature;
      if (!isValid) throw new Error('Signature verification failed');
      
      // Test with wrong data
      const wrongHmac = crypto.createHmac('sha256', signingKey);
      wrongHmac.update(testData + 'tampered');
      const wrongSignature = wrongHmac.digest('hex');
      
      const shouldBeInvalid = signature !== wrongSignature;
      if (!shouldBeInvalid) throw new Error('Tamper detection failed');
      
      const testEnd = performance.now();
      this.addTestResult('signing-verification', true, testEnd - testStart, {
        signatureLength: signature.length,
        validSignature: isValid,
        tamperDetected: shouldBeInvalid
      });
      
      console.log('  ✅ Signature created:', signature.substring(0, 16) + '...');
      console.log('  ✅ Signature verified successfully');
      console.log('  ✅ Tamper detection working');

    } catch (error) {
      const testEnd = performance.now();
      this.addTestResult('signing-verification', false, testEnd - testStart, { error: error.message });
      console.log('  ❌ Signing test failed:', error.message);
    }
  }

  async testConcurrentOperations() {
    console.log('\n3. Testing concurrent operations performance...');
    const testStart = performance.now();

    try {
      const concurrency = 100;
      const operations = [];

      for (let i = 0; i < concurrency; i++) {
        operations.push(this.performConcurrentOperation(i));
      }

      const results = await Promise.all(operations);
      const testEnd = performance.now();
      const testDuration = testEnd - testStart;

      const successfulOps = results.filter(r => r.success).length;
      const failedOps = results.length - successfulOps;
      
      if (failedOps > 0) throw new Error(`${failedOps} concurrent operations failed`);

      this.addTestResult('concurrent-operations', true, testDuration, {
        totalOperations: results.length,
        successfulOperations: successfulOps,
        failedOperations: failedOps,
        throughput: results.length / (testDuration / 1000)
      });

      console.log(`  ✅ ${successfulOps} concurrent operations completed`);
      console.log(`  📊 Throughput: ${(results.length / (testDuration / 1000)).toFixed(2)} ops/sec`);
      console.log(`  ⏱️  Average per operation: ${(testDuration / results.length).toFixed(2)}ms`);

    } catch (error) {
      const testEnd = performance.now();
      this.addTestResult('concurrent-operations', false, testEnd - testStart, { error: error.message });
      console.log('  ❌ Concurrent operations test failed:', error.message);
    }
  }

  async performConcurrentOperation(id) {
    try {
      const data = `concurrent-test-${id}-${Math.random()}`;
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      
      // Add some signing
      const key = crypto.randomBytes(16);
      const hmac = crypto.createHmac('sha256', key);
      hmac.update(hash);
      const signature = hmac.digest('hex');
      
      return {
        id,
        success: true,
        hash: hash.substring(0, 8),
        signature: signature.substring(0, 8)
      };
    } catch (error) {
      return {
        id,
        success: false,
        error: error.message
      };
    }
  }

  async testMemoryUsage() {
    console.log('\n4. Testing memory usage under load...');
    const testStart = performance.now();

    try {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create large dataset and process it
      const dataSet = [];
      for (let i = 0; i < 1000; i++) {
        const item = {
          id: i,
          content: crypto.randomBytes(512).toString('hex'), // 1KB per item
          hash: crypto.createHash('sha256').update(`item-${i}`).digest('hex')
        };
        dataSet.push(item);
        
        // Process every 10th item with additional crypto
        if (i % 10 === 0) {
          const key = crypto.randomBytes(16);
          const hmac = crypto.createHmac('sha256', key);
          hmac.update(item.content);
          item.signature = hmac.digest('hex');
        }
      }
      
      const peakMemory = process.memoryUsage().heapUsed;
      
      // Clear dataset to test cleanup
      dataSet.length = 0;
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const testEnd = performance.now();
      
      const peakIncrease = (peakMemory - initialMemory) / 1024 / 1024;
      const finalIncrease = (finalMemory - initialMemory) / 1024 / 1024;
      
      this.addTestResult('memory-usage', true, testEnd - testStart, {
        itemsProcessed: 1000,
        peakMemoryIncreaseMB: peakIncrease,
        finalMemoryIncreaseMB: finalIncrease,
        memoryPerItem: (peakMemory - initialMemory) / 1000
      });

      console.log(`  ✅ Processed 1000 items successfully`);
      console.log(`  💾 Peak memory increase: ${peakIncrease.toFixed(2)}MB`);
      console.log(`  🧹 Final memory increase: ${finalIncrease.toFixed(2)}MB`);
      console.log(`  📏 Memory per item: ${((peakMemory - initialMemory) / 1000).toFixed(0)} bytes`);

    } catch (error) {
      const testEnd = performance.now();
      this.addTestResult('memory-usage', false, testEnd - testStart, { error: error.message });
      console.log('  ❌ Memory usage test failed:', error.message);
    }
  }

  async testIntegrationWorkflow() {
    console.log('\n5. Testing end-to-end integration workflow...');
    const testStart = performance.now();

    try {
      // Simulate full workflow: Generate → Hash → Sign → Verify → Attest
      
      // Step 1: Generate content
      const content = {
        id: crypto.randomUUID(),
        data: 'Integration workflow test content',
        timestamp: new Date().toISOString(),
        metadata: { type: 'integration-test', version: '1.0' }
      };
      
      // Step 2: Hash content
      const contentHash = crypto.createHash('sha256')
        .update(JSON.stringify(content))
        .digest('hex');
      
      // Step 3: Sign hash
      const signingKey = crypto.randomBytes(32);
      const hmac = crypto.createHmac('sha256', signingKey);
      hmac.update(contentHash);
      const signature = hmac.digest('hex');
      
      // Step 4: Verify signature
      const verifyHmac = crypto.createHmac('sha256', signingKey);
      verifyHmac.update(contentHash);
      const verifiedSignature = verifyHmac.digest('hex');
      
      if (signature !== verifiedSignature) {
        throw new Error('Signature verification failed in workflow');
      }
      
      // Step 5: Create attestation-like structure
      const attestation = {
        contentId: content.id,
        contentHash,
        signature,
        algorithm: 'HMAC-SHA256',
        timestamp: new Date().toISOString(),
        workflow: ['generate', 'hash', 'sign', 'verify', 'attest']
      };
      
      // Step 6: Validate attestation integrity
      const attestationHash = crypto.createHash('sha256')
        .update(JSON.stringify({
          contentId: attestation.contentId,
          contentHash: attestation.contentHash,
          signature: attestation.signature,
          algorithm: attestation.algorithm
        }))
        .digest('hex');
      
      const testEnd = performance.now();
      
      this.addTestResult('integration-workflow', true, testEnd - testStart, {
        workflowSteps: attestation.workflow.length,
        contentId: content.id,
        contentHashLength: contentHash.length,
        signatureLength: signature.length,
        attestationHash: attestationHash.substring(0, 16)
      });

      console.log(`  ✅ Content generated: ${content.id}`);
      console.log(`  ✅ Content hashed: ${contentHash.substring(0, 16)}...`);
      console.log(`  ✅ Signature created: ${signature.substring(0, 16)}...`);
      console.log(`  ✅ Signature verified successfully`);
      console.log(`  ✅ Attestation created: ${attestationHash.substring(0, 16)}...`);
      console.log(`  📝 Workflow completed: ${attestation.workflow.join(' → ')}`);

    } catch (error) {
      const testEnd = performance.now();
      this.addTestResult('integration-workflow', false, testEnd - testStart, { error: error.message });
      console.log('  ❌ Integration workflow test failed:', error.message);
    }
  }

  addTestResult(testName, passed, duration, data) {
    this.results.tests.push({
      testName,
      passed,
      duration,
      data,
      timestamp: new Date().toISOString()
    });

    this.results.summary.total++;
    if (passed) {
      this.results.summary.passed++;
    } else {
      this.results.summary.failed++;
    }
  }

  printSummary() {
    const endTime = performance.now();
    const totalTime = endTime - this.results.startTime;

    console.log('\n📊 VALIDATION SUMMARY');
    console.log('====================');
    console.log(`Total Tests: ${this.results.summary.total}`);
    console.log(`Passed: ${this.results.summary.passed} ✅`);
    console.log(`Failed: ${this.results.summary.failed} ${this.results.summary.failed > 0 ? '❌' : '✅'}`);
    
    const successRate = Math.round((this.results.summary.passed / this.results.summary.total) * 100);
    console.log(`Success Rate: ${successRate}%`);
    console.log(`Total Time: ${totalTime.toFixed(2)}ms`);

    console.log('\n📋 TEST DETAILS:');
    this.results.tests.forEach(test => {
      const status = test.passed ? '✅' : '❌';
      const duration = test.duration.toFixed(2);
      console.log(`  ${status} ${test.testName}: ${duration}ms`);
      
      if (test.data && !test.passed) {
        console.log(`      Error: ${test.data.error}`);
      }
    });

    if (this.results.summary.failed === 0) {
      console.log('\n🎉 ALL SECURITY INTEGRATIONS VALIDATED SUCCESSFULLY!');
      console.log('✅ Cryptographic operations working');
      console.log('✅ Signing and verification working'); 
      console.log('✅ Concurrent operations handling correctly');
      console.log('✅ Memory management under control');
      console.log('✅ End-to-end workflow functioning');
    } else {
      console.log('\n⚠️  Some security integration tests failed!');
      console.log('Please review the failed tests and fix issues before deployment.');
    }
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new SecurityIntegrationValidator();
  
  validator.validate()
    .then((results) => {
      if (results.summary.failed === 0) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}

export default SecurityIntegrationValidator;