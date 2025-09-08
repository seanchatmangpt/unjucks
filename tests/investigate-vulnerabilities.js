#!/usr/bin/env node

/**
 * Deep Investigation of Template System Vulnerabilities
 */

import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

async function investigatePathTraversal() {
  console.log('\n🔍 INVESTIGATING PATH TRAVERSAL VULNERABILITY');
  
  const attackTemplatesDir = path.join(process.cwd(), '_templates/attack-investigate');
  const outputDir = path.join(process.cwd(), 'tests/attack-output');
  
  await fs.ensureDir(`${attackTemplatesDir}/path-test/new`);
  await fs.ensureDir(outputDir);
  
  // Create a simple template that tries to write outside the dest
  await fs.writeFile(`${attackTemplatesDir}/path-test/new/template.njk`, `---
to: "{{ maliciousPath }}"
---
HACKED: This file should not exist at {{ maliciousPath }}
Content: {{ content }}
`);

  const testPaths = [
    '../../../tmp/unjucks-hack.txt',
    '/tmp/unjucks-absolute-hack.txt',
    '../../../../usr/share/unjucks-hack.txt'
  ];

  for (const testPath of testPaths) {
    console.log(`\n🎯 Testing path: ${testPath}`);
    
    try {
      const result = execSync(`node bin/unjucks.cjs generate path-test new --dest "./tests/attack-output" --maliciousPath "${testPath}" --content "SECURITY_TEST"`, {
        cwd: process.cwd(),
        stdio: 'pipe',
        encoding: 'utf8'
      });
      
      console.log('Generate result:', result);
      
      // Check where the file actually got written
      const expectedPath = path.resolve('./tests/attack-output', testPath);
      const absolutePath = path.resolve(testPath);
      
      console.log(`Expected path: ${expectedPath}`);
      console.log(`Absolute path: ${absolutePath}`);
      
      if (await fs.pathExists(expectedPath)) {
        const content = await fs.readFile(expectedPath, 'utf8');
        console.log(`🚨 VULNERABLE: File found at expected path!`);
        console.log(`Content: ${content.slice(0, 100)}`);
        await fs.remove(expectedPath);
      }
      
      if (await fs.pathExists(absolutePath)) {
        console.log(`🚨 CRITICAL: File written to absolute path!`);
        // Don't read system files
      }
      
    } catch (error) {
      console.log('❌ Path blocked:', error.message.slice(0, 100));
    }
  }
  
  await fs.remove(attackTemplatesDir);
}

async function investigateVariableResolution() {
  console.log('\n🔍 INVESTIGATING VARIABLE RESOLUTION');
  
  const attackTemplatesDir = path.join(process.cwd(), '_templates/var-investigate');
  const outputDir = path.join(process.cwd(), 'tests/attack-output');
  
  await fs.ensureDir(`${attackTemplatesDir}/var-test/new`);
  await fs.ensureDir(outputDir);
  
  // Create template with various variable patterns
  await fs.writeFile(`${attackTemplatesDir}/var-test/new/template.njk`, `---
to: "{{ dest }}/variable-test.js"
---
// Standard Nunjucks variables
export const defined = "{{ definedVar }}";
export const undefined = "{{ undefinedVar }}";

// Object access
export const objProp = "{{ obj.prop }}";
export const objMissing = "{{ missingObj.prop }}";

// Array access  
export const arrItem = "{{ arr[0] }}";
export const arrMissing = "{{ missingArr[0] }}";

// Complex expressions
export const expr1 = {{ complexExpr }};
export const expr2 = {{ undefinedExpr }};

// Nested variables
export const nested = "{{ nested.deep.value }}";

// Filter usage
export const filtered = "{{ filterVar | upper }}";
export const undefinedFiltered = "{{ undefinedFilterVar | upper }}";
`);

  try {
    const result = execSync('node bin/unjucks.cjs generate var-test new --dest ./tests/attack-output --definedVar "DEFINED_VALUE" --obj.prop "OBJECT_PROP" --arr[0] "ARRAY_ITEM" --complexExpr "42" --nested.deep.value "NESTED_VALUE" --filterVar "lowercase"', {
      cwd: process.cwd(),
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    console.log('✅ Generation result:', result);
    
    const outputFile = path.join(outputDir, 'variable-test.js');
    if (await fs.pathExists(outputFile)) {
      const content = await fs.readFile(outputFile, 'utf8');
      console.log('\n📄 Generated content:');
      console.log(content);
      
      // Analyze what resolved vs what didn't
      console.log('\n🔍 Analysis:');
      if (content.includes('DEFINED_VALUE')) {
        console.log('✅ Defined variables resolve');
      }
      if (content.includes('{{ undefinedVar }}')) {
        console.log('🚨 Undefined variables left as literals');
      }
      if (content.includes('undefined') && !content.includes('{{ undefinedVar }}')) {
        console.log('✅ Undefined variables resolve to "undefined"');
      }
      if (content.includes('{{ missingObj.prop }}')) {
        console.log('🚨 Missing object properties left as literals');
      }
    }
    
  } catch (error) {
    console.log('❌ Variable test failed:', error.stderr?.toString().slice(0, 300) || error.message);
  }
  
  await fs.remove(attackTemplatesDir);
}

async function investigateFrontmatterParsing() {
  console.log('\n🔍 INVESTIGATING FRONTMATTER PARSING');
  
  const attackTemplatesDir = path.join(process.cwd(), '_templates/front-investigate');
  const outputDir = path.join(process.cwd(), 'tests/attack-output');
  
  await fs.ensureDir(`${attackTemplatesDir}/front-test/new`);
  
  // Test various frontmatter edge cases
  const testCases = [
    {
      name: 'valid-yaml',
      frontmatter: `---
to: "{{ dest }}/valid.js"
inject: true
lineAt: 5
---`
    },
    {
      name: 'invalid-yaml',  
      frontmatter: `---
to: "{{ dest }}/invalid.js"
invalid: [unclosed
missing: "quote
---`
    },
    {
      name: 'no-closing',
      frontmatter: `---
to: "{{ dest }}/no-closing.js"
valid: true`
    },
    {
      name: 'no-opening',
      frontmatter: `to: "{{ dest }}/no-opening.js"
valid: false
---`
    },
    {
      name: 'empty-frontmatter',
      frontmatter: `---
---`
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🎯 Testing: ${testCase.name}`);
    
    await fs.writeFile(`${attackTemplatesDir}/front-test/new/template.njk`, 
      `${testCase.frontmatter}
export const test = "{{ name }}";
`);

    try {
      const result = execSync('node bin/unjucks.cjs generate front-test new --dest ./tests/attack-output --name TEST_VALUE', {
        cwd: process.cwd(),
        stdio: 'pipe',
        encoding: 'utf8'
      });
      
      console.log(`✅ ${testCase.name} succeeded`);
      
      // Check if file was generated
      const expectedFiles = [
        path.join(outputDir, 'valid.js'),
        path.join(outputDir, 'invalid.js'),
        path.join(outputDir, 'no-closing.js'),
        path.join(outputDir, 'no-opening.js')
      ];
      
      for (const file of expectedFiles) {
        if (await fs.pathExists(file)) {
          console.log(`📄 Generated: ${path.basename(file)}`);
          await fs.remove(file);
        }
      }
      
    } catch (error) {
      console.log(`❌ ${testCase.name} failed:`, error.message.slice(0, 100));
    }
  }
  
  await fs.remove(attackTemplatesDir);
}

async function investigateTemplateSyntax() {
  console.log('\n🔍 INVESTIGATING TEMPLATE SYNTAX PROCESSING');
  
  const attackTemplatesDir = path.join(process.cwd(), '_templates/syntax-investigate');
  const outputDir = path.join(process.cwd(), 'tests/attack-output');
  
  await fs.ensureDir(`${attackTemplatesDir}/syntax-test/new`);
  
  // Test different template syntaxes
  await fs.writeFile(`${attackTemplatesDir}/syntax-test/new/template.njk`, `---
to: "{{ dest }}/syntax-test.js"
---
// Nunjucks (should work)
const nunjucks1 = "{{ var1 }}";
const nunjucks2 = "{{var2}}";
const nunjucks3 = "{{ var3 | upper }}";

// EJS (should NOT work) 
const ejs1 = "<%= var1 %>";
const ejs2 = "<%- var2 %>";
const ejs3 = "<% if (var3) { %>code<% } %>";

// Handlebars (might work since similar to Nunjucks)
const hbs1 = "{{var1}}";
const hbs2 = "{{#if var2}}code{{/if}}";

// Mustache (similar to Handlebars)
const mustache = "{{var1}}";

// JSP/JSTL
const jsp = "\${var1}";

// Velocity
const velocity = "$var1";

// Freemarker  
const freemarker = "\${var1}";

// Liquid (Jekyll)
const liquid = "{{ var1 }}";

// Angular
const angular = "{{var1}}";

// Vue
const vue = "{{var1}}";

// Various escape attempts
const escape1 = "\\{{ var1 }}";
const escape2 = "\\{\\{ var1 \\}\\}";
const escape3 = "{{ "var1" }}";
const escape4 = "{{ 'var1' }}";
const escape5 = "{{ var1 + var2 }}";
`);

  try {
    const result = execSync('node bin/unjucks.cjs generate syntax-test new --dest ./tests/attack-output --var1 "VALUE1" --var2 "value2" --var3 "value3"', {
      cwd: process.cwd(),
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    const outputFile = path.join(outputDir, 'syntax-test.js');
    if (await fs.pathExists(outputFile)) {
      const content = await fs.readFile(outputFile, 'utf8');
      console.log('\n📄 Generated syntax test:');
      console.log(content);
      
      // Analyze syntax processing
      console.log('\n🔍 Syntax Analysis:');
      
      if (content.includes('VALUE1')) {
        console.log('✅ Nunjucks {{ }} syntax works');
      }
      if (content.includes('<%= var1 %>')) {
        console.log('✅ EJS syntax ignored (good)');
      } else if (content.includes('VALUE1') && content.includes('<%=')) {
        console.log('🚨 EJS syntax may have been processed');
      }
      if (content.includes('${var1}')) {
        console.log('✅ JSP syntax ignored (good)'); 
      }
      if (content.includes('$var1')) {
        console.log('✅ Velocity syntax ignored (good)');
      }
      if (content.includes('{{ var1 }}') && content.includes('VALUE1')) {
        console.log('✅ Standard Nunjucks processing confirmed');
      }
    }
    
  } catch (error) {
    console.log('❌ Syntax test failed:', error.message.slice(0, 200));
  }
  
  await fs.remove(attackTemplatesDir);
}

// Run all investigations
async function runInvestigations() {
  console.log('🔬 DEEP INVESTIGATION OF TEMPLATE VULNERABILITIES\n');
  
  await investigatePathTraversal();
  await investigateVariableResolution(); 
  await investigateFrontmatterParsing();
  await investigateTemplateSyntax();
  
  console.log('\n🏁 INVESTIGATION COMPLETED');
}

runInvestigations().catch(console.error);