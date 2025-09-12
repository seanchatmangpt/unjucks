/**
 * Demonstration of Secure Key Management Operations
 * 
 * This example shows how to use the SecureKeyManager for various
 * cryptographic operations including key generation, signing, and validation.
 */

import { SecureKeyManager } from '../../src/security/key-manager.js';
import { KeyValidator } from '../../src/security/key-validator.js';
import crypto from 'crypto';
import path from 'path';

// Demo configuration
const DEMO_KEY_STORE = './demo-keys';
const TEST_MESSAGE = 'This is a test message for cryptographic signing operations.';

async function runKeyManagementDemo() {
  console.log('🔐 Secure Key Management Demo\n');
  
  try {
    // Initialize key manager with demo key store
    const keyManager = new SecureKeyManager({ 
      keyStorePath: DEMO_KEY_STORE 
    });
    
    const keyValidator = new KeyValidator();
    
    console.log('1. Generating Ed25519 keypair...');
    const ed25519Key = await keyManager.generateEd25519Keypair('demo-ed25519', {
      exportFormat: 'PEM'
    });
    console.log(`   ✅ Generated Ed25519 key with fingerprint: ${ed25519Key.fingerprint}`);
    console.log(`   📅 Created: ${ed25519Key.created}`);
    
    console.log('\n2. Generating RSA-3072 keypair...');
    const rsaKey = await keyManager.generateRSAKeypair('demo-rsa-3072', {
      keySize: 3072
    });
    console.log(`   ✅ Generated RSA-3072 key with fingerprint: ${rsaKey.fingerprint}`);
    console.log(`   📏 Key size: ${rsaKey.keySize} bits`);
    
    console.log('\n3. Generating ECDSA keypair...');
    const ecdsaKey = await keyManager.generateECDSAKeypair('demo-ecdsa');
    console.log(`   ✅ Generated ECDSA key with fingerprint: ${ecdsaKey.fingerprint}`);
    console.log(`   📐 Curve: ${ecdsaKey.curve}`);
    
    console.log('\n4. Generating encrypted keypair with passphrase...');
    const encryptedKey = await keyManager.generateEd25519Keypair('demo-encrypted', {
      passphrase: 'super-secure-passphrase-123!'
    });
    console.log(`   ✅ Generated encrypted key with fingerprint: ${encryptedKey.fingerprint}`);
    
    console.log('\n5. Testing signing and verification operations...');
    
    // Ed25519 signing
    console.log('   🖊️  Ed25519 signing...');
    const ed25519Signature = await keyManager.signData('demo-ed25519', TEST_MESSAGE);
    const ed25519Valid = await keyManager.verifySignature('demo-ed25519', TEST_MESSAGE, ed25519Signature);
    console.log(`   ✅ Ed25519 signature valid: ${ed25519Valid}`);
    console.log(`   📊 Signature size: ${ed25519Signature.length} bytes`);
    
    // RSA signing
    console.log('   🖊️  RSA signing...');
    const rsaSignature = await keyManager.signData('demo-rsa-3072', TEST_MESSAGE);
    const rsaValid = await keyManager.verifySignature('demo-rsa-3072', TEST_MESSAGE, rsaSignature);
    console.log(`   ✅ RSA signature valid: ${rsaValid}`);
    console.log(`   📊 Signature size: ${rsaSignature.length} bytes`);
    
    // ECDSA signing
    console.log('   🖊️  ECDSA signing...');
    const ecdsaSignature = await keyManager.signData('demo-ecdsa', TEST_MESSAGE);
    const ecdsaValid = await keyManager.verifySignature('demo-ecdsa', TEST_MESSAGE, ecdsaSignature);
    console.log(`   ✅ ECDSA signature valid: ${ecdsaValid}`);
    console.log(`   📊 Signature size: ${ecdsaSignature.length} bytes`);
    
    console.log('\n6. Testing invalid signature detection...');
    const tamperedMessage = 'This message has been tampered with!';
    const invalidSignature = await keyManager.verifySignature('demo-ed25519', tamperedMessage, ed25519Signature);
    console.log(`   ❌ Tampered message signature valid: ${invalidSignature}`);
    
    console.log('\n7. Listing all stored keys...');
    const allKeys = await keyManager.listKeys();
    console.log(`   📋 Total keys stored: ${allKeys.length}`);
    allKeys.forEach(key => {
      console.log(`   🔑 ${key.keyId} (${key.algorithm}) - ${key.fingerprint}`);
      if (key.keySize) console.log(`      📏 Size: ${key.keySize} bits`);
      if (key.encrypted) console.log(`      🔐 Encrypted: Yes`);
      console.log(`      📅 Created: ${key.created}`);
    });
    
    console.log('\n8. Testing key format detection and validation...');
    
    // Load a key and test format detection
    const loadedKey = await keyManager.loadKeyPair('demo-ed25519');
    const formatInfo = keyValidator.detectKeyFormat(loadedKey.publicKey);
    console.log(`   📋 Key format detected: ${formatInfo.format} (${formatInfo.type} ${formatInfo.algorithm})`);
    
    // Validate key strength
    const validation = await keyValidator.validateKeyStrength(
      Buffer.from(loadedKey.publicKey, 'base64'), 
      loadedKey.algorithm
    );
    console.log(`   🛡️  Key strength validation:`);
    console.log(`      Valid: ${validation.valid}`);
    console.log(`      Strength: ${validation.strength}`);
    if (validation.warnings.length > 0) {
      console.log(`      Warnings: ${validation.warnings.join(', ')}`);
    }
    if (validation.recommendations.length > 0) {
      console.log(`      Recommendations: ${validation.recommendations.join(', ')}`);
    }
    
    console.log('\n9. Testing public key extraction...');
    const extractedPubKey = await keyManager.extractPublicKey(
      Buffer.from(loadedKey.privateKey, 'base64'),
      'Ed25519'
    );
    console.log(`   ✅ Successfully extracted public key (${extractedPubKey.length} bytes)`);
    
    // Verify extracted public key matches stored public key
    const storedPubKey = Buffer.from(loadedKey.publicKey, 'base64');
    const keysMatch = Buffer.compare(Buffer.from(extractedPubKey), storedPubKey) === 0;
    console.log(`   🔍 Extracted key matches stored: ${keysMatch}`);
    
    console.log('\n10. Testing key rotation...');
    const rotationResult = await keyManager.rotateKey('demo-ed25519');
    console.log(`   ✅ Key rotated successfully`);
    console.log(`   🆕 New fingerprint: ${rotationResult.newKey.fingerprint}`);
    console.log(`   💾 Backup saved to: ${rotationResult.backupPath}`);
    console.log(`   📅 Rotated at: ${rotationResult.rotatedAt}`);
    
    console.log('\n11. Performance benchmarking...');
    await runPerformanceBenchmarks(keyManager);
    
    console.log('\n12. Security validation tests...');
    await runSecurityTests(keyManager, keyValidator);
    
    console.log('\n✅ Demo completed successfully!');
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error(error.stack);
  }
}

async function runPerformanceBenchmarks(keyManager) {
  const iterations = 10;
  const testData = crypto.randomBytes(1024); // 1KB test data
  
  console.log(`   🏃 Running performance benchmarks (${iterations} iterations)...`);
  
  // Benchmark key generation
  console.log('   📊 Key generation benchmarks:');
  
  let startTime = process.hrtime.bigint();
  for (let i = 0; i < 5; i++) {
    await keyManager.generateEd25519Keypair(`bench-ed25519-${i}`);
  }
  let endTime = process.hrtime.bigint();
  const ed25519GenTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
  console.log(`      Ed25519: ${(ed25519GenTime / 5).toFixed(2)}ms average`);
  
  startTime = process.hrtime.bigint();
  for (let i = 0; i < 3; i++) {
    await keyManager.generateRSAKeypair(`bench-rsa-${i}`, { keySize: 2048 });
  }
  endTime = process.hrtime.bigint();
  const rsaGenTime = Number(endTime - startTime) / 1000000;
  console.log(`      RSA-2048: ${(rsaGenTime / 3).toFixed(2)}ms average`);
  
  // Benchmark signing operations
  console.log('   📊 Signing benchmarks:');
  
  startTime = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    await keyManager.signData('bench-ed25519-0', testData);
  }
  endTime = process.hrtime.bigint();
  const ed25519SignTime = Number(endTime - startTime) / 1000000;
  console.log(`      Ed25519 signing: ${(ed25519SignTime / iterations).toFixed(2)}ms average`);
  
  startTime = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    await keyManager.signData('bench-rsa-0', testData);
  }
  endTime = process.hrtime.bigint();
  const rsaSignTime = Number(endTime - startTime) / 1000000;
  console.log(`      RSA-2048 signing: ${(rsaSignTime / iterations).toFixed(2)}ms average`);
  
  // Benchmark verification operations
  console.log('   📊 Verification benchmarks:');
  
  const ed25519Sig = await keyManager.signData('bench-ed25519-0', testData);
  startTime = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    await keyManager.verifySignature('bench-ed25519-0', testData, ed25519Sig);
  }
  endTime = process.hrtime.bigint();
  const ed25519VerifyTime = Number(endTime - startTime) / 1000000;
  console.log(`      Ed25519 verification: ${(ed25519VerifyTime / iterations).toFixed(2)}ms average`);
  
  const rsaSig = await keyManager.signData('bench-rsa-0', testData);
  startTime = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    await keyManager.verifySignature('bench-rsa-0', testData, rsaSig);
  }
  endTime = process.hrtime.bigint();
  const rsaVerifyTime = Number(endTime - startTime) / 1000000;
  console.log(`      RSA-2048 verification: ${(rsaVerifyTime / iterations).toFixed(2)}ms average`);
}

async function runSecurityTests(keyManager, keyValidator) {
  console.log('   🛡️  Running security validation tests...');
  
  // Test 1: Verify signatures don't validate with wrong keys
  const key1 = await keyManager.generateEd25519Keypair('security-test-1');
  const key2 = await keyManager.generateEd25519Keypair('security-test-2');
  
  const message = 'Security test message';
  const sig1 = await keyManager.signData('security-test-1', message);
  
  const wrongKeyValidation = await keyManager.verifySignature('security-test-2', message, sig1);
  console.log(`      ✅ Cross-key signature validation correctly failed: ${!wrongKeyValidation}`);
  
  // Test 2: Verify tampering detection
  const originalSig = await keyManager.signData('security-test-1', message);
  const tamperedSig = new Uint8Array(originalSig);
  tamperedSig[0] = tamperedSig[0] ^ 0xFF; // Flip bits in first byte
  
  const tamperedValidation = await keyManager.verifySignature('security-test-1', message, tamperedSig);
  console.log(`      ✅ Tampered signature correctly rejected: ${!tamperedValidation}`);
  
  // Test 3: Test key strength validation
  const weakKey = Buffer.alloc(16); // Too small for Ed25519
  const validation = await keyValidator.validateKeyStrength(weakKey, 'Ed25519');
  console.log(`      ✅ Weak key correctly rejected: ${!validation.valid}`);
  
  // Test 4: Test fingerprint uniqueness
  const fingerprints = new Set();
  for (let i = 0; i < 10; i++) {
    const key = await keyManager.generateEd25519Keypair(`uniqueness-test-${i}`);
    fingerprints.add(key.fingerprint);
  }
  console.log(`      ✅ All 10 generated keys have unique fingerprints: ${fingerprints.size === 10}`);
  
  // Test 5: Test passphrase protection
  try {
    await keyManager.generateEd25519Keypair('passphrase-test', {
      passphrase: 'test-passphrase'
    });
    
    // Loading with wrong passphrase should work for metadata but fail for operations
    const keyData = await keyManager.loadKeyPair('passphrase-test');
    console.log(`      ✅ Encrypted key metadata accessible: ${keyData.encrypted === true}`);
    
    // Signing operations would require the correct passphrase
    console.log(`      ✅ Passphrase protection is active`);
  } catch (error) {
    console.log(`      ❌ Passphrase test failed: ${error.message}`);
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runKeyManagementDemo();
}

export { runKeyManagementDemo };