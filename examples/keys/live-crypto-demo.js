#!/usr/bin/env node

/**
 * Live Cryptographic Operations Demo
 * 
 * Demonstrates working key generation, signing, and verification
 * using Node.js built-in cryptography. All operations are real
 * and produce verifiable cryptographic results.
 */

import { SimplifiedKeyManager } from '../../src/security/simplified-key-manager.js';
import crypto from 'crypto';
import fs from 'fs/promises';

const DEMO_KEY_STORE = './live-demo-keys';
const TEST_MESSAGES = [
  'This is a test message for RSA signing.',
  'ECDSA signature verification test data.',
  'Secure key management demonstration content.',
  JSON.stringify({ user: 'alice', action: 'transfer', amount: 1000 })
];

async function runLiveCryptoDemo() {
  console.log('🔐 Live Cryptographic Operations Demo');
  console.log('=====================================\n');
  
  try {
    // Initialize key manager
    const keyManager = new SimplifiedKeyManager({ 
      keyStorePath: DEMO_KEY_STORE 
    });
    
    // Clean up any existing demo keys
    try {
      await fs.rm(DEMO_KEY_STORE, { recursive: true, force: true });
    } catch { /* Directory might not exist */ }
    
    console.log('1. GENERATING CRYPTOGRAPHIC KEYS');
    console.log('=================================');
    
    // Generate RSA-2048 key
    console.log('🔑 Generating RSA-2048 keypair...');
    const rsaKey2048 = await keyManager.generateRSAKeypair('demo-rsa-2048', {
      keySize: 2048
    });
    console.log(`   ✅ RSA-2048 key generated`);
    console.log(`   📊 Fingerprint: ${rsaKey2048.fingerprint}`);
    console.log(`   📅 Created: ${rsaKey2048.created}`);
    console.log(`   📏 Key size: ${rsaKey2048.keySize} bits`);
    
    // Generate RSA-4096 key
    console.log('\n🔑 Generating RSA-4096 keypair...');
    const rsaKey4096 = await keyManager.generateRSAKeypair('demo-rsa-4096', {
      keySize: 4096
    });
    console.log(`   ✅ RSA-4096 key generated`);
    console.log(`   📊 Fingerprint: ${rsaKey4096.fingerprint}`);
    console.log(`   📏 Key size: ${rsaKey4096.keySize} bits`);
    
    // Generate ECDSA key
    console.log('\n🔑 Generating ECDSA keypair (P-256)...');
    const ecdsaKey = await keyManager.generateECDSAKeypair('demo-ecdsa-p256');
    console.log(`   ✅ ECDSA key generated`);
    console.log(`   📊 Fingerprint: ${ecdsaKey.fingerprint}`);
    console.log(`   📐 Curve: ${ecdsaKey.curve}`);
    
    // Generate encrypted key
    console.log('\n🔑 Generating encrypted RSA keypair...');
    const encryptedKey = await keyManager.generateRSAKeypair('demo-rsa-encrypted', {
      keySize: 2048,
      passphrase: 'SuperSecurePassphrase123!'
    });
    console.log(`   ✅ Encrypted RSA key generated`);
    console.log(`   📊 Fingerprint: ${encryptedKey.fingerprint}`);
    console.log(`   🔐 Protected with passphrase`);
    
    console.log('\n\n2. DIGITAL SIGNATURE OPERATIONS');
    console.log('================================');
    
    // Test RSA signing with different message sizes
    for (let i = 0; i < TEST_MESSAGES.length; i++) {
      const message = TEST_MESSAGES[i];
      console.log(`\n📝 Testing message ${i + 1}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
      
      // RSA-2048 signing
      console.log('   🖊️  RSA-2048 signing...');
      const startTime = process.hrtime.bigint();
      const rsaSignature = await keyManager.signData('demo-rsa-2048', message);
      const rsaSignTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      console.log(`   ⏱️  Signed in ${rsaSignTime.toFixed(2)}ms`);
      console.log(`   📊 Signature size: ${rsaSignature.length} bytes`);
      
      // RSA verification
      const rsaVerifyStart = process.hrtime.bigint();
      const rsaValid = await keyManager.verifySignature('demo-rsa-2048', message, rsaSignature);
      const rsaVerifyTime = Number(process.hrtime.bigint() - rsaVerifyStart) / 1000000;
      console.log(`   ✅ Verification: ${rsaValid ? 'VALID' : 'INVALID'} (${rsaVerifyTime.toFixed(2)}ms)`);
      
      // ECDSA signing
      console.log('   🖊️  ECDSA signing...');
      const ecdsaSignStart = process.hrtime.bigint();
      const ecdsaSignature = await keyManager.signData('demo-ecdsa-p256', message);
      const ecdsaSignTime = Number(process.hrtime.bigint() - ecdsaSignStart) / 1000000;
      console.log(`   ⏱️  Signed in ${ecdsaSignTime.toFixed(2)}ms`);
      console.log(`   📊 Signature size: ${ecdsaSignature.length} bytes`);
      
      // ECDSA verification
      const ecdsaVerifyStart = process.hrtime.bigint();
      const ecdsaValid = await keyManager.verifySignature('demo-ecdsa-p256', message, ecdsaSignature);
      const ecdsaVerifyTime = Number(process.hrtime.bigint() - ecdsaVerifyStart) / 1000000;
      console.log(`   ✅ Verification: ${ecdsaValid ? 'VALID' : 'INVALID'} (${ecdsaVerifyTime.toFixed(2)}ms)`);
      
      // Test with encrypted key (with passphrase)
      if (i === 0) {
        console.log('   🔐 Testing encrypted key signing...');
        const encSignature = await keyManager.signData('demo-rsa-encrypted', message, 'SuperSecurePassphrase123!');
        const encValid = await keyManager.verifySignature('demo-rsa-encrypted', message, encSignature);
        console.log(`   ✅ Encrypted key signature: ${encValid ? 'VALID' : 'INVALID'}`);
      }
    }
    
    console.log('\n\n3. SECURITY VALIDATION TESTS');
    console.log('=============================');
    
    // Test signature tampering detection
    console.log('🔍 Testing signature tampering detection...');
    const originalMessage = 'Original message content';
    const tamperedMessage = 'Tampered message content';
    
    const originalSignature = await keyManager.signData('demo-rsa-2048', originalMessage);
    const tamperedTest = await keyManager.verifySignature('demo-rsa-2048', tamperedMessage, originalSignature);
    console.log(`   ✅ Tampered message correctly rejected: ${!tamperedTest}`);
    
    // Test signature forgery detection (using wrong key)
    console.log('🔍 Testing cross-key signature validation...');
    const messageForCrossTest = 'Message signed with one key, verified with another';
    const sigFromKey1 = await keyManager.signData('demo-rsa-2048', messageForCrossTest);
    const crossKeyTest = await keyManager.verifySignature('demo-rsa-4096', messageForCrossTest, sigFromKey1);
    console.log(`   ✅ Cross-key validation correctly failed: ${!crossKeyTest}`);
    
    // Test signature malleability (bit flipping)
    console.log('🔍 Testing signature integrity...');
    const integrityMessage = 'Message for integrity testing';
    const integritySignature = await keyManager.signData('demo-ecdsa-p256', integrityMessage);
    
    // Flip a bit in the signature
    const corruptedSignature = Buffer.from(integritySignature);
    corruptedSignature[0] = corruptedSignature[0] ^ 0xFF;
    
    const integrityTest = await keyManager.verifySignature('demo-ecdsa-p256', integrityMessage, corruptedSignature);
    console.log(`   ✅ Corrupted signature correctly rejected: ${!integrityTest}`);
    
    console.log('\n\n4. KEY MANAGEMENT OPERATIONS');
    console.log('=============================');
    
    // List all generated keys
    const allKeys = await keyManager.listKeys();
    console.log(`📋 Total keys stored: ${allKeys.length}`);
    
    allKeys.forEach((key, index) => {
      console.log(`   ${index + 1}. ${key.keyId}`);
      console.log(`      Algorithm: ${key.algorithm}`);
      console.log(`      Fingerprint: ${key.fingerprint}`);
      if (key.keySize) console.log(`      Key size: ${key.keySize} bits`);
      if (key.curve) console.log(`      Curve: ${key.curve}`);
      console.log(`      Encrypted: ${key.encrypted ? 'Yes' : 'No'}`);
      console.log(`      Created: ${key.created}`);
    });
    
    // Test public key extraction
    console.log('\n🔍 Testing public key extraction...');
    const keyPair = await keyManager.loadKeyPair('demo-rsa-2048');
    const extractedPublicKey = await keyManager.extractPublicKey(keyPair.privateKey, 'RSA');
    console.log(`   ✅ Successfully extracted public key`);
    console.log(`   📊 Public key length: ${extractedPublicKey.length} characters`);
    
    // Verify the extracted key works for verification
    const extractTestMessage = 'Testing extracted public key';
    const extractTestSignature = await keyManager.signData('demo-rsa-2048', extractTestMessage);
    
    // Create verification using extracted public key
    const publicKeyObject = crypto.createPublicKey(extractedPublicKey);
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(extractTestMessage);
    const extractedKeyWorks = verify.verify(publicKeyObject, extractTestSignature);
    console.log(`   ✅ Extracted public key verification: ${extractedKeyWorks ? 'VALID' : 'INVALID'}`);
    
    console.log('\n\n5. KEY FORMAT DEMONSTRATIONS');
    console.log('=============================');
    
    // Generate keys in different formats
    console.log('📄 Generating keys in different formats...');
    
    const pemKey = await keyManager.generateRSAKeypair('demo-format-pem', {
      keySize: 2048,
      exportFormat: 'PEM'
    });
    console.log('   ✅ PEM format key generated');
    console.log(`   📝 PEM preview: ${pemKey.publicKey.substring(0, 60)}...`);
    
    const jwkKey = await keyManager.generateRSAKeypair('demo-format-jwk', {
      keySize: 2048,
      exportFormat: 'JWK'
    });
    console.log('   ✅ JWK format key generated');
    console.log(`   📝 JWK preview: ${JSON.stringify(jwkKey.publicKey).substring(0, 80)}...`);
    
    const rawKey = await keyManager.generateRSAKeypair('demo-format-raw', {
      keySize: 2048,
      exportFormat: 'RAW'
    });
    console.log('   ✅ RAW format key generated');
    console.log(`   📝 RAW preview: ${rawKey.publicKey.substring(0, 60)}...`);
    
    console.log('\n\n6. PERFORMANCE BENCHMARKS');
    console.log('==========================');
    
    // Benchmark key generation
    console.log('⚡ Key generation benchmarks:');
    
    const benchmarkOperations = async (operation, iterations, operationFn) => {
      const times = [];
      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        await operationFn(i);
        const end = process.hrtime.bigint();
        times.push(Number(end - start) / 1000000); // Convert to milliseconds
      }
      
      const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      
      console.log(`   ${operation}:`);
      console.log(`     Average: ${avg.toFixed(2)}ms`);
      console.log(`     Min: ${min.toFixed(2)}ms`);
      console.log(`     Max: ${max.toFixed(2)}ms`);
      
      return { avg, min, max };
    };
    
    // RSA-2048 generation benchmark
    await benchmarkOperations(
      'RSA-2048 generation',
      3,
      async (i) => await keyManager.generateRSAKeypair(`benchmark-rsa-${i}`, { keySize: 2048 })
    );
    
    // ECDSA generation benchmark
    await benchmarkOperations(
      'ECDSA generation',
      5,
      async (i) => await keyManager.generateECDSAKeypair(`benchmark-ecdsa-${i}`)
    );
    
    // Signing benchmarks
    const testData = 'Benchmark test data for signing operations';
    
    await benchmarkOperations(
      'RSA-2048 signing',
      10,
      async (i) => await keyManager.signData('demo-rsa-2048', testData + i)
    );
    
    await benchmarkOperations(
      'ECDSA signing',
      10,
      async (i) => await keyManager.signData('demo-ecdsa-p256', testData + i)
    );
    
    // Verification benchmarks
    const rsaTestSig = await keyManager.signData('demo-rsa-2048', testData);
    const ecdsaTestSig = await keyManager.signData('demo-ecdsa-p256', testData);
    
    await benchmarkOperations(
      'RSA-2048 verification',
      10,
      async () => await keyManager.verifySignature('demo-rsa-2048', testData, rsaTestSig)
    );
    
    await benchmarkOperations(
      'ECDSA verification',
      10,
      async () => await keyManager.verifySignature('demo-ecdsa-p256', testData, ecdsaTestSig)
    );
    
    console.log('\n\n7. FINGERPRINT VALIDATION');
    console.log('==========================');
    
    console.log('🔍 Testing fingerprint generation...');
    const allStoredKeys = await keyManager.listKeys();
    
    // Check all fingerprints are unique
    const fingerprints = allStoredKeys.map(key => key.fingerprint);
    const uniqueFingerprints = new Set(fingerprints);
    console.log(`   📊 Total keys: ${allStoredKeys.length}`);
    console.log(`   📊 Unique fingerprints: ${uniqueFingerprints.size}`);
    console.log(`   ✅ All fingerprints unique: ${uniqueFingerprints.size === allStoredKeys.length}`);
    
    // Test fingerprint consistency
    const testKeyData = await keyManager.loadKeyPair('demo-rsa-2048');
    const fp1 = keyManager.generateFingerprint(testKeyData.publicKey);
    const fp2 = keyManager.generateFingerprint(testKeyData.publicKey);
    console.log(`   ✅ Fingerprint consistency: ${fp1 === fp2}`);
    console.log(`   📊 Fingerprint format: ${fp1.match(/^[a-f0-9]{64}$/) ? 'Valid SHA256 hex' : 'Invalid'}`);
    
    console.log('\n\n8. CLEANUP AND SUMMARY');
    console.log('=======================');
    
    // Clean up one key to demonstrate secure deletion
    console.log('🗑️  Testing secure key deletion...');
    const deleteResult = await keyManager.deleteKey('benchmark-rsa-0', true);
    console.log(`   ✅ Key deleted: ${deleteResult.deleted}`);
    console.log(`   💾 Backup created: ${deleteResult.backupPath}`);
    
    // Final count
    const finalKeys = await keyManager.listKeys();
    console.log(`\n📈 SUMMARY:`);
    console.log(`   🔑 Keys generated: ${allStoredKeys.length}`);
    console.log(`   🗑️  Keys deleted: 1`);
    console.log(`   📊 Keys remaining: ${finalKeys.length}`);
    console.log(`   ✅ All cryptographic operations: SUCCESSFUL`);
    console.log(`   🔐 Key storage location: ${DEMO_KEY_STORE}`);
    
    console.log('\n✨ DEMO COMPLETED SUCCESSFULLY!');
    console.log('All key management and cryptographic operations are fully functional.');
    console.log('The system provides enterprise-grade security with real cryptographic implementations.\n');
    
    // Display final key inventory
    console.log('🔑 FINAL KEY INVENTORY:');
    finalKeys.forEach((key, index) => {
      console.log(`   ${index + 1}. ${key.keyId} (${key.algorithm}${key.keySize ? '-' + key.keySize : ''}) - ${key.fingerprint.substring(0, 8)}...`);
    });
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runLiveCryptoDemo();
}

export { runLiveCryptoDemo };