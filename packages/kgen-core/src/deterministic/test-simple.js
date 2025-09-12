/**
 * Simple test to verify our deterministic renderer works
 */

import { DeterministicRenderer } from './renderer.js';

async function runSimpleTest() {
  console.log('🧪 Testing KGEN Deterministic Renderer...');
  
  try {
    // Create renderer
    const renderer = new DeterministicRenderer({
      debug: false,
      validateDeterminism: false // Skip validation for speed
    });
    
    console.log('✓ Renderer created successfully');
    
    // Test basic template rendering
    const template = 'Hello {{ name }}! Build time: {{ BUILD_TIME }}';
    const context = { name: 'World' };
    
    const result = await renderer.renderString(template, context);
    
    console.log('✓ Template rendered successfully');
    console.log('📄 Result:', result.content.trim());
    console.log('🔐 Content hash:', result.contentHash.substring(0, 8));
    
    // Test deterministic rendering (2 iterations)
    const result2 = await renderer.renderString(template, context);
    
    if (result.contentHash === result2.contentHash) {
      console.log('✅ Deterministic rendering verified');
    } else {
      console.log('❌ Non-deterministic rendering detected');
      return false;
    }
    
    // Test custom filters
    const filterTemplate = '{{ name | pascalCase }} - {{ name | kebabCase }}';
    const filterResult = await renderer.renderString(filterTemplate, { name: 'hello world' });
    
    console.log('✓ Filter test result:', filterResult.content.trim());
    
    if (filterResult.content.includes('HelloWorld') && filterResult.content.includes('hello-world')) {
      console.log('✅ Custom filters working correctly');
    } else {
      console.log('❌ Custom filters not working');
      return false;
    }
    
    // Test frontmatter
    const frontmatterTemplate = `---
title: Test Page
version: 1.0.0
---
# {{ title }} v{{ version }}`;
    
    const fmResult = await renderer.renderString(frontmatterTemplate, {});
    
    console.log('✓ Frontmatter test result:', fmResult.content.trim());
    
    if (fmResult.content.includes('# Test Page v1.0.0')) {
      console.log('✅ Frontmatter processing working');
    } else {
      console.log('❌ Frontmatter processing failed');
      return false;
    }
    
    console.log('\n🎉 All tests passed! KGEN Deterministic Renderer is working correctly.');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Run the test
runSimpleTest().then(success => {
  process.exit(success ? 0 : 1);
});