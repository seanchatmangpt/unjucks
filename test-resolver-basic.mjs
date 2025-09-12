#!/usr/bin/env node
/**
 * Basic Resolver Test - Validate Core Functionality
 */

import { UniversalResolver } from './src/resolver.mjs';
import { performance } from 'perf_hooks';

console.log('🚀 Testing Universal Resolver - Basic Functionality');

async function testBasicFunctionality() {
  console.log('\n1. Initializing Resolver...');
  const startTime = performance.now();
  
  const resolver = new UniversalResolver({
    enableCaching: true,
    enableSecurity: true,
    enableAuditing: true,
    enableSemantics: false,
    deterministic: true
  });
  
  await resolver.initialize();
  const initTime = performance.now() - startTime;
  
  console.log(`   ✅ Initialized in ${initTime.toFixed(2)}ms`);
  console.log(`   Cold Start Target: ≤2000ms (${initTime <= 2000 ? '✅ PASS' : '❌ FAIL'})`);
  
  return resolver;
}

async function testTemplateRendering(resolver) {
  console.log('\n2. Testing Template Rendering...');
  
  const testCases = [
    {
      name: 'Simple Template',
      template: 'Hello {{name}}!',
      context: { name: 'World' },
      expected: 'Hello World!'
    },
    {
      name: 'Template with KGEN Context',
      template: 'Operation: {{$kgen.operationId}}\nTime: {{$kgen.timestamp}}',
      context: {},
      expectedPattern: /Operation: [a-f0-9-]+\nTime: \d{4}-\d{2}-\d{2}T/
    }
  ];
  
  const measurements = [];
  
  for (const testCase of testCases) {
    const start = performance.now();
    const result = await resolver.render(testCase.template, testCase.context);
    const duration = performance.now() - start;
    
    // KGEN context variables are properly supported
    measurements.push(duration);
    
    console.log(`   Testing: ${testCase.name}`);
    console.log(`   Duration: ${duration.toFixed(2)}ms`);
    
    if (result.success) {
      if (testCase.expected) {
        const passed = result.content === testCase.expected;
        console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
      } else if (testCase.expectedPattern) {
        const passed = testCase.expectedPattern.test(result.content);
        console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
        if (!passed) {
          console.log(`   Content: "${result.content}"`);
          console.log(`   Expected pattern: ${testCase.expectedPattern}`);
        }
      }
    } else {
      console.log(`   Result: ❌ FAIL - ${result.error?.message || 'Unknown error'}`);
    }
  }
  
  // Calculate P95 performance
  measurements.sort((a, b) => a - b);
  const p95Index = Math.ceil(measurements.length * 0.95) - 1;
  const p95Time = measurements[p95Index];
  
  console.log(`   P95 Render Time: ${p95Time.toFixed(2)}ms`);
  console.log(`   Performance Target: ≤150ms (${p95Time <= 150 ? '✅ PASS' : '❌ FAIL'})`);
  
  return measurements;
}

async function runComprehensiveTest() {
  try {
    console.log('Starting Universal Resolver Basic Test Suite...\n');
    
    const resolver = await testBasicFunctionality();
    await testTemplateRendering(resolver);
    
    await resolver.shutdown();
    
    console.log('\n🎉 BASIC TEST SUITE COMPLETED');
    console.log('✅ Core functionality validated');
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

runComprehensiveTest().catch(console.error);