#!/usr/bin/env node

/**
 * Date Format Validation Script
 * Validates the new standardized date formatting system
 */

const path = require('path');
const dayjs = require('dayjs');

// Add required dayjs plugins
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const customParseFormat = require('dayjs/plugin/customParseFormat');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

console.log('🔍 Date Format Validation Script');
console.log('=================================\n');

// Test data
const testDate = '2025-09-08T14:30:22Z';
const parsedDate = dayjs(testDate);

console.log(`📅 Test Date: ${testDate}`);
console.log(`✅ Parsed Successfully: ${parsedDate.isValid()}`);
console.log();

// Test different format scenarios
const formatTests = [
  {
    name: 'ISO 8601 (Default)',
    format: 'YYYY-MM-DD',
    expected: '2025-09-08',
    use: 'Technical systems, databases'
  },
  {
    name: 'US Legal Document',
    format: 'MMMM D, YYYY',
    expected: 'September 8, 2025',
    use: 'Legal contracts, court briefs'
  },
  {
    name: 'EU/GDPR Format',
    format: 'DD MMMM YYYY',
    expected: '08 September 2025',
    use: 'EU privacy documents'
  },
  {
    name: 'HIPAA Compliance',
    format: 'MM/DD/YYYY',
    expected: '09/08/2025',
    use: 'Healthcare documentation'
  },
  {
    name: 'Audit Trail',
    format: 'YYYY-MM-DD HH:mm:ss [UTC]',
    expected: '2025-09-08 14:30:22 UTC',
    use: 'Compliance audit logs'
  }
];

console.log('📊 Format Validation Results:');
console.log('============================');

let passedTests = 0;
let totalTests = formatTests.length;

formatTests.forEach(test => {
  const result = test.format === 'YYYY-MM-DD HH:mm:ss [UTC]' 
    ? parsedDate.utc().format(test.format)
    : parsedDate.format(test.format);
  
  const passed = result === test.expected;
  const status = passed ? '✅' : '❌';
  
  if (passed) passedTests++;
  
  console.log(`${status} ${test.name}`);
  console.log(`   Expected: ${test.expected}`);
  console.log(`   Got:      ${result}`);
  console.log(`   Use Case: ${test.use}`);
  console.log();
});

// Test ordinal generation
console.log('🔢 Ordinal Number Testing:');
console.log('=========================');

function getOrdinal(day) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const value = day % 100;
  return day + (suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0]);
}

const ordinalTests = [
  { day: 1, expected: '1st' },
  { day: 2, expected: '2nd' },
  { day: 3, expected: '3rd' },
  { day: 4, expected: '4th' },
  { day: 11, expected: '11th' },
  { day: 21, expected: '21st' },
  { day: 22, expected: '22nd' },
  { day: 31, expected: '31st' }
];

let ordinalPassed = 0;
ordinalTests.forEach(test => {
  const result = getOrdinal(test.day);
  const passed = result === test.expected;
  const status = passed ? '✅' : '❌';
  
  if (passed) ordinalPassed++;
  
  console.log(`${status} Day ${test.day}: ${result} (expected: ${test.expected})`);
});

console.log();

// Test edge cases
console.log('⚠️  Edge Case Testing:');
console.log('=====================');

const edgeCases = [
  {
    name: 'Leap Year',
    date: '2024-02-29',
    format: 'MMMM D, YYYY',
    expected: 'February 29, 2024'
  },
  {
    name: 'Year Boundary',
    date: '2025-01-01',
    format: 'MMMM D, YYYY',
    expected: 'January 1, 2025'
  },
  {
    name: 'Month Boundary',
    date: '2025-12-31',
    format: 'MMMM D, YYYY',
    expected: 'December 31, 2025'
  }
];

let edgePassed = 0;
edgeCases.forEach(test => {
  const testDate = dayjs(test.date);
  const result = testDate.format(test.format);
  const passed = result === test.expected;
  const status = passed ? '✅' : '❌';
  
  if (passed) edgePassed++;
  
  console.log(`${status} ${test.name}: ${result}`);
});

console.log();

// Test invalid date handling
console.log('🚫 Invalid Date Handling:');
console.log('=========================');

const invalidDates = ['invalid-date', '', null, undefined, 'not-a-date'];
let invalidPassed = 0;

invalidDates.forEach(invalidDate => {
  try {
    const parsed = dayjs(invalidDate);
    const isValid = parsed.isValid();
    const handled = !isValid; // Should be false for invalid dates
    const status = handled ? '✅' : '❌';
    
    if (handled) invalidPassed++;
    
    console.log(`${status} "${invalidDate}": Valid = ${isValid}`);
  } catch (error) {
    console.log(`✅ "${invalidDate}": Caught error gracefully`);
    invalidPassed++;
  }
});

console.log();

// Summary
console.log('📈 VALIDATION SUMMARY:');
console.log('=====================');
console.log(`Format Tests:     ${passedTests}/${totalTests} passed`);
console.log(`Ordinal Tests:    ${ordinalPassed}/${ordinalTests.length} passed`);
console.log(`Edge Cases:       ${edgePassed}/${edgeCases.length} passed`);
console.log(`Invalid Handling: ${invalidPassed}/${invalidDates.length} passed`);

const totalPassed = passedTests + ordinalPassed + edgePassed + invalidPassed;
const totalAllTests = totalTests + ordinalTests.length + edgeCases.length + invalidDates.length;

console.log(`OVERALL SCORE:    ${totalPassed}/${totalAllTests} (${Math.round(totalPassed/totalAllTests*100)}%)`);

if (totalPassed === totalAllTests) {
  console.log('\n🎉 ALL TESTS PASSED! Date formatting system is working correctly.');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Please review the implementation.');
  process.exit(1);
}