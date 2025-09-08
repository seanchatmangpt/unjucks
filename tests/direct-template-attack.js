#!/usr/bin/env node

/**
 * Direct Template Engine Attack Test
 * Bypass CLI issues by testing the core template engine directly
 */

import fs from 'fs-extra';
import path from 'path';
import Nunjucks from 'nunjucks';
import grayMatter from 'gray-matter';

console.log('🚨 DIRECT TEMPLATE ENGINE ATTACK TESTS 🚨\n');

async function testVariableResolution() {
  console.log('🎯 ATTACK 1: Variable Resolution');
  
  const templateContent = `---
to: "{{ dest }}/{{ filename }}.js"
inject: {{ injectFlag }}
---
// Template with various variable types
export const defined = "{{ definedVar }}";
export const undefined = "{{ undefinedVar }}";
export const object = {{ objectVar }};
export const array = {{ arrayVar }};
export const nested = "{{ nested.prop }}";
export const missing = "{{ missing.deep.prop }}";
`;

  try {
    const parsed = grayMatter(templateContent);
    console.log('✅ Frontmatter parsed:', parsed.data);
    console.log('📄 Content length:', parsed.content.length);
    
    // Test Nunjucks rendering with missing variables
    const env = Nunjucks.configure({ autoescape: false });
    
    const variables = {
      dest: 'output',
      definedVar: 'DEFINED_VALUE',
      objectVar: { key: 'value' },
      arrayVar: [1, 2, 3],
      nested: { prop: 'NESTED_VALUE' }
      // Note: undefinedVar, missing object are intentionally omitted
    };
    
    try {
      const rendered = env.renderString(parsed.content, variables);
      console.log('✅ Rendered content:');
      console.log(rendered);
      
      // Check what happened to undefined variables
      if (rendered.includes('{{ undefinedVar }}')) {
        console.log('🚨 ISSUE: Undefined variables remain as literals');
      } else if (rendered.includes('undefined')) {
        console.log('✅ Undefined variables resolve to "undefined"');
      }
      
      if (rendered.includes('{{ missing.deep.prop }}')) {
        console.log('🚨 ISSUE: Missing nested properties remain as literals');
      }
      
    } catch (renderError) {
      console.log('❌ Render error:', renderError.message);
      
      if (renderError.message.includes('undefined') || renderError.message.includes('attempted to output null')) {
        console.log('✅ Nunjucks properly errors on undefined variables');
      }
    }
    
  } catch (error) {
    console.log('❌ Parse error:', error.message);
  }
}

async function testFrontmatterAttacks() {
  console.log('\n🎯 ATTACK 2: Frontmatter Attacks');
  
  const malformedTemplates = [
    {
      name: 'unclosed-array',
      content: `---
to: "output.js"
array: [item1, item2
object: valid
---
content`
    },
    {
      name: 'unclosed-string',
      content: `---
to: "output.js"
string: "unclosed
valid: true
---
content`
    },
    {
      name: 'invalid-syntax',
      content: `---
to: output.js
invalid: {unclosed: object
---
content`
    },
    {
      name: 'no-closing-delimiter',
      content: `---
to: "output.js"
valid: true
content without closing delimiter`
    },
    {
      name: 'yaml-injection',
      content: `---
to: "output.js"
script: !!js/function "function() { return process.exit(1); }"
---
content`
    }
  ];

  for (const template of malformedTemplates) {
    console.log(`\n🔧 Testing: ${template.name}`);
    try {
      const parsed = grayMatter(template.content);
      console.log(`✅ Parsed successfully:`, parsed.data);
      
      if (parsed.data.script && typeof parsed.data.script === 'function') {
        console.log('🚨 CRITICAL: YAML allowed function execution!');
      }
      
    } catch (error) {
      console.log(`❌ Failed (good): ${error.message.slice(0, 100)}`);
    }
  }
}

async function testTemplateInjection() {
  console.log('\n🎯 ATTACK 3: Template Injection');
  
  const env = Nunjucks.configure({ autoescape: false });
  
  const injectionTests = [
    {
      name: 'basic-expression',
      template: '{{ 7*7 }}',
      vars: {}
    },
    {
      name: 'global-access',
      template: '{{ global.process.exit }}',
      vars: {}
    },
    {
      name: 'constructor-access',
      template: '{{ constructor.constructor }}',
      vars: {}
    },
    {
      name: 'function-call',
      template: '{{ range.constructor("return process")() }}',
      vars: {}
    },
    {
      name: 'prototype-pollution',
      template: '{{ constructor.prototype.polluted }}',
      vars: {}
    },
    {
      name: 'filter-injection',
      template: '{{ "test" | eval("process.exit(1)") }}',
      vars: {}
    },
    {
      name: 'variable-injection',
      template: 'Result: {{ payload }}',
      vars: { payload: '{{7*7}}' }
    }
  ];

  for (const test of injectionTests) {
    console.log(`\n🔧 Testing: ${test.name}`);
    try {
      const result = env.renderString(test.template, test.vars);
      console.log(`✅ Rendered: "${result}"`);
      
      if (result.includes('49')) {
        console.log('🚨 VULNERABILITY: Mathematical expression executed!');
      }
      if (result.includes('[object Object]') || result.includes('[Function')) {
        console.log('🚨 VULNERABILITY: Object/function access succeeded!');
      }
      if (result === test.vars.payload && test.vars.payload?.includes('{{')) {
        console.log('🚨 VULNERABILITY: Double template processing!');
      }
      
    } catch (error) {
      console.log(`❌ Blocked (good): ${error.message.slice(0, 100)}`);
    }
  }
}

async function testPathManipulation() {
  console.log('\n🎯 ATTACK 4: Path Manipulation');
  
  const pathTests = [
    '../../../etc/passwd',
    '../../../../tmp/hack.txt',
    '/etc/shadow',
    '..\\..\\..\\windows\\system32\\config\\sam',
    '/proc/self/environ',
    '../../../../../root/.ssh/id_rsa'
  ];

  for (const maliciousPath of pathTests) {
    console.log(`\n🔧 Testing path: ${maliciousPath}`);
    
    const template = `---
to: "${maliciousPath}"
---
HACKED CONTENT`;

    try {
      const parsed = grayMatter(template);
      const targetPath = parsed.data.to;
      
      console.log(`Target path: ${targetPath}`);
      
      // Check if path would escape intended directory
      const resolved = path.resolve('./output', targetPath);
      const intended = path.resolve('./output');
      
      if (!resolved.startsWith(intended)) {
        console.log('🚨 VULNERABILITY: Path traversal possible!');
        console.log(`Resolved: ${resolved}`);
        console.log(`Intended: ${intended}`);
      } else {
        console.log('✅ Path contained within output directory');
      }
      
    } catch (error) {
      console.log(`❌ Parse error: ${error.message}`);
    }
  }
}

async function testSyntaxMixing() {
  console.log('\n🎯 ATTACK 5: Syntax Mixing');
  
  const env = Nunjucks.configure({ autoescape: false });
  
  const syntaxTests = [
    '{{ nunjucksVar }}',
    '<%= ejsVar %>',
    '<%- ejsRaw %>',
    '${jspVar}',
    '$velocity',
    '#{rubyInterpolation}',
    '{{handlebarsVar}}',
    '{{#handlebarsHelper}}content{{/handlebarsHelper}}',
    '{%raw%}{{raw}}{% endraw %}',
    '{% set x = 42 %}{{ x }}',
    '{% for i in range(3) %}{{ i }}{% endfor %}',
    '{% if true %}content{% endif %}'
  ];

  const variables = {
    nunjucksVar: 'NUNJUCKS_RESOLVED',
    ejsVar: 'EJS_SHOULD_NOT_RESOLVE',
    ejsRaw: 'EJS_RAW_SHOULD_NOT_RESOLVE',
    jspVar: 'JSP_SHOULD_NOT_RESOLVE',
    velocity: 'VELOCITY_SHOULD_NOT_RESOLVE',
    rubyInterpolation: 'RUBY_SHOULD_NOT_RESOLVE',
    handlebarsVar: 'HANDLEBARS_MIGHT_RESOLVE'
  };

  for (const syntax of syntaxTests) {
    console.log(`\n🔧 Testing syntax: ${syntax}`);
    try {
      const result = env.renderString(syntax, variables);
      console.log(`✅ Result: "${result}"`);
      
      // Analyze what was processed
      if (syntax.includes('{{') && syntax.includes('}}') && result.includes('_RESOLVED')) {
        console.log('✅ Nunjucks syntax processed');
      }
      if (syntax.includes('<%') && result.includes('<%')) {
        console.log('✅ EJS syntax ignored (good)');
      }
      if (syntax.includes('${') && result.includes('${')) {
        console.log('✅ JSP syntax ignored (good)');
      }
      if (syntax.includes('{% for') && result.includes('0')) {
        console.log('✅ Nunjucks control structures work');
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message.slice(0, 100)}`);
    }
  }
}

// Run all tests
async function runDirectAttacks() {
  await testVariableResolution();
  await testFrontmatterAttacks();
  await testTemplateInjection();
  await testPathManipulation();
  await testSyntaxMixing();
  
  console.log('\n🏁 DIRECT TEMPLATE ENGINE ATTACKS COMPLETED');
  console.log('\n📊 SUMMARY:');
  console.log('✅ = Security measure working');
  console.log('🚨 = Potential vulnerability');
  console.log('❌ = Attack blocked/failed');
}

runDirectAttacks().catch(console.error);