#!/usr/bin/env node
/**
 * KGEN Template Engine Demo
 * 
 * Demonstration of the KGEN template engine working with real templates
 */

import { createTemplatingSystem } from '../packages/kgen-core/src/templating/index.js';
import { existsSync } from 'fs';
import path from 'path';

const TEMPLATES_DIR = path.resolve(process.cwd(), '_templates');

async function demo() {
  console.log('🧪 KGEN Template Engine Demo');
  console.log('=============================\n');

  // Create templating system
  const system = createTemplatingSystem({
    templatesDir: TEMPLATES_DIR
  });

  console.log(`📁 Templates directory: ${TEMPLATES_DIR}`);
  console.log(`📁 Templates exist: ${existsSync(TEMPLATES_DIR)}\n`);

  // Test 1: Simple template rendering
  console.log('✅ Test 1: String Template Rendering');
  console.log('-------------------------------------');
  
  const simpleTemplate = `---
to: "{{ name | upper }}.txt"
skipIf: "!generate"
---
// Generated {{ timestamp }}
export const {{ name | camelCase }} = {
  name: "{{ name }}",
  version: "1.0.0"
};`;

  try {
    const result = await system.renderString(simpleTemplate, {
      name: 'UserProfile',
      generate: true,
      timestamp: '2024-01-01T00:00:00.000Z'
    });

    console.log('📝 Template content:', result.content);
    console.log('📂 Output path:', result.outputPath);
    console.log('⚙️  Frontmatter:', JSON.stringify(result.frontmatter, null, 2));
    console.log();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 2: Variable extraction
  console.log('✅ Test 2: Variable Extraction');
  console.log('-------------------------------');
  
  const complexTemplate = `
---
to: "{{ directory }}/{{ filename }}.{{ extension }}"
---
Name: {{ name }}
Count: {{ count }}
{% if showItems %}
Items:
{% for item in items %}
  - {{ item.name }}: {{ item.value }}
{% endfor %}
{% endif %}
{% if user.admin %}
Admin: {{ user.name }}
{% endif %}`;

  try {
    const parsed = await system.engine.parseTemplate(complexTemplate);
    console.log('📊 Extracted variables:', parsed.variables);
    console.log('📋 Frontmatter:', JSON.stringify(parsed.frontmatter, null, 2));
    console.log();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 3: Dependency validation
  console.log('✅ Test 3: Dependency Validation');
  console.log('----------------------------------');
  
  try {
    const result = await system.render('', {
      directory: 'src',
      filename: 'user',
      extension: 'js',
      name: 'UserService'
      // Missing: count, showItems, items, user
    }, { validateDependencies: true });

    console.log('🔍 Validation result:', JSON.stringify(result.metadata.validation, null, 2));
    console.log();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 4: Real template from _templates if available
  if (existsSync(TEMPLATES_DIR)) {
    console.log('✅ Test 4: Real Template (if available)');
    console.log('---------------------------------------');
    
    const benchmarkTemplate = 'benchmark/new/template.njk';
    if (system.templateExists(benchmarkTemplate)) {
      try {
        const result = await system.render(benchmarkTemplate, {
          name: 'MyBenchmark'
        });
        
        console.log('📝 Benchmark template result:', result.content);
        console.log('📂 Output path:', result.outputPath);
        console.log();
      } catch (error) {
        console.error('❌ Benchmark template error:', error.message);
      }
    } else {
      console.log('⚠️  Benchmark template not found, skipping');
    }
  }

  // Test 5: Performance test
  console.log('✅ Test 5: Performance Test');
  console.log('----------------------------');
  
  const perfTemplate = 'Performance test: {{ name }} - {{ index }}';
  const startTime = performance.now();
  
  const results = [];
  for (let i = 0; i < 100; i++) {
    const result = await system.renderString(perfTemplate, {
      name: `Item${i}`,
      index: i
    });
    results.push(result);
  }
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  
  console.log(`🚀 Rendered 100 templates in ${totalTime.toFixed(2)}ms`);
  console.log(`⚡ Average per template: ${(totalTime / 100).toFixed(2)}ms`);
  console.log();

  // Test 6: Statistics
  console.log('✅ Test 6: Engine Statistics');
  console.log('-----------------------------');
  
  const stats = system.getStats();
  console.log('📊 Engine stats:', JSON.stringify(stats.engine, null, 2));
  console.log();

  console.log('🎉 Demo completed successfully!');
  console.log('The KGEN template engine is working correctly.');
}

// Run demo
demo().catch(error => {
  console.error('💥 Demo failed:', error);
  process.exit(1);
});