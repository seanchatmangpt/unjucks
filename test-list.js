#!/usr/bin/env node

// Quick test to see if our fix worked
import { Generator } from './src/lib/generator.js';

async function testList() {
  try {
    const generator = new Generator();
    const generators = await generator.listGenerators();
    
    console.log(`✅ SUCCESS: Found ${generators.length} generators`);
    
    if (generators.length > 0) {
      console.log('\nFirst 5 generators:');
      for (let i = 0; i < Math.min(5, generators.length); i++) {
        const gen = generators[i];
        console.log(`- ${gen.name} (${gen.templates.length} templates)`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ FAILED:', error.message);
    return false;
  }
}

testList();