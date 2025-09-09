#!/usr/bin/env node
/**
 * Test PCI DSS Encryption Implementation
 * Verifies encryption/decryption cycles work correctly
 */

import PCIEncryption from './pci-dss/encryption.js';

async function runEncryptionTests() {
  console.log('🔐 PCI DSS Encryption Tests');
  console.log('============================\n');

  const encryption = new PCIEncryption();
  let allPassed = true;

  // Test 1: Basic encryption/decryption
  console.log('Test 1: Basic Encryption/Decryption');
  try {
    const plaintext = 'Sensitive cardholder data: 4111-1111-1111-1111';
    const key = encryption.generateKey();
    
    const encrypted = encryption.encrypt(plaintext, key);
    const decrypted = encryption.decrypt(encrypted, key);
    
    const success = decrypted.toString('utf8') === plaintext;
    console.log(`  ✓ Basic cycle: ${success ? 'PASS' : 'FAIL'}`);
    
    if (!success) allPassed = false;
  } catch (error) {
    console.log(`  ❌ Basic cycle: FAIL - ${error.message}`);
    allPassed = false;
  }

  // Test 2: Encryption with AAD
  console.log('\nTest 2: Authenticated Encryption (AAD)');
  try {
    const plaintext = 'Transaction: $1,000 to account 12345';
    const key = encryption.generateKey();
    const aad = Buffer.from('transaction-id:tx-98765');
    
    const encrypted = encryption.encrypt(plaintext, key, aad);
    const decrypted = encryption.decrypt(encrypted, key, aad);
    
    const success = decrypted.toString('utf8') === plaintext;
    console.log(`  ✓ AAD encryption: ${success ? 'PASS' : 'FAIL'}`);
    
    if (!success) allPassed = false;
  } catch (error) {
    console.log(`  ❌ AAD encryption: FAIL - ${error.message}`);
    allPassed = false;
  }

  // Test 3: Wrong AAD should fail
  console.log('\nTest 3: Wrong AAD Rejection');
  try {
    const plaintext = 'Secret data';
    const key = encryption.generateKey();
    const aad = Buffer.from('correct-aad');
    const wrongAad = Buffer.from('wrong-aad');
    
    const encrypted = encryption.encrypt(plaintext, key, aad);
    
    let failed = false;
    try {
      encryption.decrypt(encrypted, key, wrongAad);
    } catch (error) {
      failed = true;
    }
    
    console.log(`  ✓ Wrong AAD rejected: ${failed ? 'PASS' : 'FAIL'}`);
    
    if (!failed) allPassed = false;
  } catch (error) {
    console.log(`  ❌ Wrong AAD test: FAIL - ${error.message}`);
    allPassed = false;
  }

  // Test 4: Tampered data should fail
  console.log('\nTest 4: Tampered Data Rejection');
  try {
    const plaintext = 'Important data';
    const key = encryption.generateKey();
    
    const encrypted = encryption.encrypt(plaintext, key);
    
    // Tamper with ciphertext
    const tamperedEncrypted = { ...encrypted };
    tamperedEncrypted.ciphertext = Buffer.from(tamperedEncrypted.ciphertext);
    tamperedEncrypted.ciphertext[0] ^= 1; // Flip one bit
    
    let failed = false;
    try {
      encryption.decrypt(tamperedEncrypted, key);
    } catch (error) {
      failed = true;
    }
    
    console.log(`  ✓ Tampered data rejected: ${failed ? 'PASS' : 'FAIL'}`);
    
    if (!failed) allPassed = false;
  } catch (error) {
    console.log(`  ❌ Tampered data test: FAIL - ${error.message}`);
    allPassed = false;
  }

  // Test 5: Key derivation
  console.log('\nTest 5: Key Derivation (PBKDF2)');
  try {
    const password = 'StrongPassword123!';
    const salt = encryption.generateKey(16); // 16-byte salt
    
    const key1 = encryption.deriveKey(password, salt, 100000);
    const key2 = encryption.deriveKey(password, salt, 100000);
    
    const sameKey = key1.equals(key2);
    console.log(`  ✓ Consistent derivation: ${sameKey ? 'PASS' : 'FAIL'}`);
    
    // Different salt should produce different key
    const differentSalt = encryption.generateKey(16);
    const key3 = encryption.deriveKey(password, differentSalt, 100000);
    
    const differentKey = !key1.equals(key3);
    console.log(`  ✓ Different salt produces different key: ${differentKey ? 'PASS' : 'FAIL'}`);
    
    if (!sameKey || !differentKey) allPassed = false;
  } catch (error) {
    console.log(`  ❌ Key derivation test: FAIL - ${error.message}`);
    allPassed = false;
  }

  // Test 6: Algorithm validation
  console.log('\nTest 6: Algorithm Validation');
  try {
    const encryption = new PCIEncryption();
    const key = encryption.generateKey();
    
    console.log(`  ✓ Algorithm: ${encryption.algorithm}`);
    console.log(`  ✓ Key length: ${key.length * 8} bits`);
    console.log(`  ✓ IV length: ${encryption.ivLength * 8} bits`);
    console.log(`  ✓ Tag length: ${encryption.tagLength * 8} bits`);
    
    const isSecure = encryption.algorithm === 'aes-256-gcm' && 
                    key.length === 32 && 
                    encryption.ivLength === 12 && 
                    encryption.tagLength === 16;
    
    console.log(`  ✓ Secure configuration: ${isSecure ? 'PASS' : 'FAIL'}`);
    
    if (!isSecure) allPassed = false;
  } catch (error) {
    console.log(`  ❌ Algorithm validation: FAIL - ${error.message}`);
    allPassed = false;
  }

  // Summary
  console.log('\n📊 Test Summary');
  console.log('================');
  console.log(`Overall result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  if (allPassed) {
    console.log('\n✅ PCI DSS encryption implementation is working correctly!');
    console.log('🔐 Features verified:');
    console.log('  • AES-256-GCM encryption');
    console.log('  • Proper IV generation and handling');
    console.log('  • Authentication tag validation');
    console.log('  • Additional Authenticated Data (AAD) support');
    console.log('  • Tamper detection');
    console.log('  • PBKDF2 key derivation');
  } else {
    console.log('\n❌ Some tests failed - encryption implementation has issues!');
  }

  return allPassed;
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runEncryptionTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

export { runEncryptionTests };