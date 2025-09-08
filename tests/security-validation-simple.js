/**
 * Simple security validation test - Node.js script format
 * Tests the core security measures without complex test frameworks
 */

const { validateTemplateContent } = require('../src/lib/nunjucks-env.js');

console.log('🔒 Testing Template Injection Security Fixes...\n');

// Test 1: Constructor access patterns
console.log('Test 1: Constructor access validation');
try {
  validateTemplateContent('{{ user.constructor }}');
  console.log('❌ FAILED: Constructor access was not blocked');
} catch (error) {
  console.log('✅ PASSED: Constructor access blocked -', error.message);
}

// Test 2: __proto__ access patterns
console.log('\nTest 2: __proto__ access validation');
try {
  validateTemplateContent('{{ user.__proto__ }}');
  console.log('❌ FAILED: __proto__ access was not blocked');
} catch (error) {
  console.log('✅ PASSED: __proto__ access blocked -', error.message);
}

// Test 3: Process access patterns
console.log('\nTest 3: Process access validation');
try {
  validateTemplateContent('{{ process.env }}');
  console.log('❌ FAILED: Process access was not blocked');
} catch (error) {
  console.log('✅ PASSED: Process access blocked -', error.message);
}

// Test 4: eval patterns
console.log('\nTest 4: eval validation');
try {
  validateTemplateContent('{{ eval("dangerous code") }}');
  console.log('❌ FAILED: eval was not blocked');
} catch (error) {
  console.log('✅ PASSED: eval blocked -', error.message);
}

// Test 5: require patterns
console.log('\nTest 5: require validation');
try {
  validateTemplateContent('{{ require("fs") }}');
  console.log('❌ FAILED: require was not blocked');
} catch (error) {
  console.log('✅ PASSED: require blocked -', error.message);
}

// Test 6: Function constructor patterns
console.log('\nTest 6: Function constructor validation');
try {
  validateTemplateContent('{{ Function("return process")() }}');
  console.log('❌ FAILED: Function constructor was not blocked');
} catch (error) {
  console.log('✅ PASSED: Function constructor blocked -', error.message);
}

// Test 7: Safe template should pass
console.log('\nTest 7: Safe template validation');
try {
  validateTemplateContent('Hello {{ user.name }}, your email is {{ user.email }}');
  console.log('✅ PASSED: Safe template allowed');
} catch (error) {
  console.log('❌ FAILED: Safe template was blocked -', error.message);
}

// Test 8: Complex RCE chain
console.log('\nTest 8: Complex RCE chain validation');
try {
  validateTemplateContent('{{ user.constructor.constructor("return process")() }}');
  console.log('❌ FAILED: RCE chain was not blocked');
} catch (error) {
  console.log('✅ PASSED: RCE chain blocked -', error.message);
}

console.log('\n🔒 Security validation tests completed!');