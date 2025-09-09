#!/usr/bin/env node

/**
 * SOC2 Audit Hash Chain Test
 * Tests the integrity of the hash chain algorithm for compliance auditing
 */

const AuditTrail = require('./audits/audit-trail.cjs');
const crypto = require('crypto');

function testHashChainIntegrity() {
  console.log('🔍 Testing SOC2 Audit Hash Chain Integrity...\n');
  
  // Create audit trail instance
  const auditTrail = new AuditTrail({
    organizationName: 'Test Organization',
    hashAlgorithm: 'sha256',
    encryptionEnabled: false // Disable for testing clarity
  });

  try {
    console.log('✅ Test 1: Basic hash chain creation');
    
    // Log several audit events to create a chain
    const event1Id = auditTrail.logEvent('authentication', 'user_login', {
      userId: 'user123',
      source: 'web_app',
      outcome: 'success',
      ipAddress: '192.168.1.100'
    });

    const event2Id = auditTrail.logEvent('data_access', 'file_accessed', {
      userId: 'user123',
      resourceId: 'document_456',
      outcome: 'success'
    });

    const event3Id = auditTrail.logEvent('authorization', 'permission_granted', {
      userId: 'user123',
      resourceType: 'financial_data',
      outcome: 'success'
    });

    console.log(`   - Created 3 events: ${event1Id}, ${event2Id}, ${event3Id}`);

    // Test integrity verification
    const integrityResult = auditTrail.verifyIntegrity();
    
    if (integrityResult.verified) {
      console.log('   ✅ Hash chain integrity verified - all hashes linked correctly');
    } else {
      console.log('   ❌ Hash chain integrity FAILED');
      console.log('   Issues found:', integrityResult.issues);
      return false;
    }

    console.log('\n✅ Test 2: Hash chain linking verification');
    
    // Get events and verify manual hash chain
    const events = auditTrail.searchLogs({});
    if (events.length < 3) {
      console.log('   ❌ Expected 3 events, got', events.length);
      return false;
    }

    // Sort by chain position
    events.sort((a, b) => a.integrity.chainPosition - b.integrity.chainPosition);
    
    // Verify first event has no previous hash
    if (events[0].integrity.previousHash !== null) {
      console.log('   ❌ First event should have null previous hash, got:', events[0].integrity.previousHash);
      return false;
    }
    console.log('   ✅ First event correctly has null previous hash');

    // Verify subsequent events link correctly
    for (let i = 1; i < events.length; i++) {
      const currentEvent = events[i];
      const previousEvent = events[i - 1];
      
      if (currentEvent.integrity.previousHash !== previousEvent.integrity.hash) {
        console.log(`   ❌ Event ${i} previousHash doesn't match event ${i-1} hash`);
        console.log(`      Expected: ${previousEvent.integrity.hash}`);
        console.log(`      Got: ${currentEvent.integrity.previousHash}`);
        return false;
      }
    }
    console.log('   ✅ All events properly linked in chain');

    console.log('\n✅ Test 3: Hash tampering detection');
    
    // Tamper with an event and verify detection
    const originalEvent = events[1];
    const tamperedEvent = JSON.parse(JSON.stringify(originalEvent)); // Deep copy
    tamperedEvent.userId = 'hacker_user'; // Tamper with user ID
    
    // Remove integrity field before recalculating hash (as the calculateEventHash method does)
    delete tamperedEvent.integrity;
    
    // Verify that userId was actually changed
    if (originalEvent.userId === tamperedEvent.userId) {
      console.log('   ❌ Test setup error: userId was not changed');
      return false;
    }
    
    // Recalculate hash as if someone tried to tamper
    const tamperedHash = auditTrail.calculateEventHash(tamperedEvent, originalEvent.integrity.previousHash);
    
    if (tamperedHash === originalEvent.integrity.hash) {
      console.log('   ❌ Tampering not detected - hash should be different');
      console.log('   Original hash:', originalEvent.integrity.hash);
      console.log('   Tampered hash:', tamperedHash);
      console.log('   Original event:', JSON.stringify(originalEvent, null, 2));
      console.log('   Tampered event:', JSON.stringify(tamperedEvent, null, 2));
      return false;
    }
    console.log('   ✅ Tampering correctly detected - hash changed when data modified');

    console.log('\n✅ Test 4: Chain break detection');
    
    // Create a new audit trail and manually break the chain
    const brokenTrail = new AuditTrail({
      organizationName: 'Broken Test',
      hashAlgorithm: 'sha256',
      encryptionEnabled: false
    });

    // Add events normally
    brokenTrail.logEvent('authentication', 'login', { userId: 'user1' });
    brokenTrail.logEvent('data_access', 'access', { userId: 'user1' });
    
    // Manually break the chain by modifying a stored event's previous hash
    const brokenEvents = brokenTrail.searchLogs({});
    if (brokenEvents.length >= 2) {
      // Find the second event and break its chain link
      const secondEvent = brokenEvents.find(e => e.integrity.chainPosition === 1);
      if (secondEvent) {
        // Store original values
        const originalPrevHash = secondEvent.integrity.previousHash;
        
        // Break the chain
        secondEvent.integrity.previousHash = 'broken_hash_link';
        
        // Verify broken chain is detected
        const brokenIntegrity = brokenTrail.verifyIntegrity();
        
        if (brokenIntegrity.verified) {
          console.log('   ❌ Chain break not detected - should have failed verification');
          return false;
        }
        
        // Check that we have a chain_break issue
        const chainBreakIssue = brokenIntegrity.issues.find(issue => issue.type === 'chain_break');
        if (!chainBreakIssue) {
          console.log('   ❌ Chain break issue not properly categorized');
          return false;
        }
        
        console.log('   ✅ Chain break correctly detected');
        
        // Restore the original value for cleanup
        secondEvent.integrity.previousHash = originalPrevHash;
      }
    }

    console.log('\n✅ Test 5: Hash algorithm consistency');
    
    // Test with different hash algorithms
    const sha256Trail = new AuditTrail({ hashAlgorithm: 'sha256', encryptionEnabled: false });
    const sha512Trail = new AuditTrail({ hashAlgorithm: 'sha512', encryptionEnabled: false });
    
    sha256Trail.logEvent('system_startup', 'sha256_test', { data: 'test' });
    sha512Trail.logEvent('system_startup', 'sha512_test', { data: 'test' });
    
    const sha256Events = sha256Trail.searchLogs({});
    const sha512Events = sha512Trail.searchLogs({});
    
    // Hashes should be different with different algorithms
    if (sha256Events[0].integrity.hash === sha512Events[0].integrity.hash) {
      console.log('   ❌ Different hash algorithms produced same hash');
      return false;
    }
    
    // SHA256 hashes should be 64 characters, SHA512 should be 128
    if (sha256Events[0].integrity.hash.length !== 64) {
      console.log('   ❌ SHA256 hash wrong length:', sha256Events[0].integrity.hash.length);
      return false;
    }
    
    if (sha512Events[0].integrity.hash.length !== 128) {
      console.log('   ❌ SHA512 hash wrong length:', sha512Events[0].integrity.hash.length);
      return false;
    }
    
    console.log('   ✅ Hash algorithms working correctly (SHA256: 64 chars, SHA512: 128 chars)');

    console.log('\n🎉 ALL TESTS PASSED - Hash chain algorithm is working correctly!');
    console.log('\n📊 Summary:');
    console.log(`   - Hash chain creation: ✅`);
    console.log(`   - Chain linking: ✅`);
    console.log(`   - Tampering detection: ✅`);
    console.log(`   - Chain break detection: ✅`);
    console.log(`   - Algorithm consistency: ✅`);
    
    return true;

  } catch (error) {
    console.log('❌ Test failed with error:', error.message);
    console.log('Stack trace:', error.stack);
    return false;
  }
}

// Run the test
if (require.main === module) {
  const success = testHashChainIntegrity();
  process.exit(success ? 0 : 1);
}

module.exports = { testHashChainIntegrity };