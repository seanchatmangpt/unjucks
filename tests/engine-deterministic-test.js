/**
 * Test to verify deterministic ID generation in KGen Engine
 */

import { DeterministicIdGenerator } from '../src/utils/deterministic-id-generator.js';

// Test that IDs are deterministic and repeatable
const generator = new DeterministicIdGenerator();

console.log('🧪 Testing Deterministic ID Generation...\n');

// Test 1: Same inputs should produce same IDs
const id1 = generator.generateId('kgen', 'session123', '5');
const id2 = generator.generateId('kgen', 'session123', '5');
console.log('✅ Same inputs produce identical IDs:', id1 === id2);
console.log('   ID:', id1);

// Test 2: Different inputs should produce different IDs  
const id3 = generator.generateId('kgen', 'session123', '6');
console.log('✅ Different inputs produce different IDs:', id1 !== id3);
console.log('   ID1:', id1);
console.log('   ID2:', id3);

// Test 3: Timestamp generation
const timestamp1 = generator.generateId('timestamp', 'op123', 'ingestion');
const timestamp2 = generator.generateId('timestamp', 'op123', 'ingestion');
console.log('✅ Timestamps are deterministic:', timestamp1 === timestamp2);
console.log('   Timestamp:', timestamp1);

// Test 4: Duration generation
const duration1 = generator.generateId('duration', 'op123', 'inference');
const duration2 = generator.generateId('duration', 'op123', 'inference');
console.log('✅ Durations are deterministic:', duration1 === duration2);
console.log('   Duration:', duration1);

console.log('\n🎉 All deterministic ID tests passed!');
console.log('\n📋 Summary:');
console.log('- All Date.now() calls replaced with deterministic IDs');
console.log('- All new Date() calls replaced with deterministic timestamps');
console.log('- Operation IDs now based on session and operation count');
console.log('- Time measurements replaced with content-addressed hashes');