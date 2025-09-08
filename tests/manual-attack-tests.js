#!/usr/bin/env node

/**
 * Manual Attack Tests for Template System
 * Execute attacks individually to identify vulnerabilities
 */

import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

const attackTemplatesDir = path.join(process.cwd(), '_templates/attack-tests');
const outputDir = path.join(process.cwd(), 'tests/attack-output');

async function setupDirectories() {
  await fs.ensureDir(attackTemplatesDir);
  await fs.ensureDir(outputDir);
  console.log('🏗️  Setup attack directories');
}

async function attack1_MissingVariables() {
  console.log('\n🎯 ATTACK 1: Missing Variables');
  
  const templateDir = path.join(attackTemplatesDir, 'missing-vars/new');
  await fs.ensureDir(templateDir);
  
  await fs.writeFile(path.join(templateDir, 'template.njk'), `---
to: "{{ dest }}/{{ requiredVar }}.js"
---
export const {{ anotherRequiredVar }} = "{{ yetAnotherVar }}";
export const name = "{{ name }}";
`);

  try {
    const result = execSync('node bin/unjucks.cjs generate missing-vars new --dest ./tests/attack-output', {
      cwd: process.cwd(),
      stdio: 'pipe',
      encoding: 'utf8'
    });
    console.log('✅ Unexpectedly succeeded:', result);
  } catch (error) {
    console.log('❌ Failed as expected:', error.stderr.toString().slice(0, 200));
  }
}

async function attack2_MalformedFrontmatter() {
  console.log('\n🎯 ATTACK 2: Malformed Frontmatter');
  
  const templateDir = path.join(attackTemplatesDir, 'bad-yaml/new');
  await fs.ensureDir(templateDir);
  
  await fs.writeFile(path.join(templateDir, 'template.njk'), `---
to: "output.js"
invalid_yaml: [unclosed array
missing_quote: "unclosed string
nested:
  - item1
  - item2: {unclosed object
---
export const test = "{{ name }}";
`);

  try {
    const result = execSync('node bin/unjucks.cjs generate bad-yaml new --dest ./tests/attack-output --name testValue', {
      cwd: process.cwd(),
      stdio: 'pipe',
      encoding: 'utf8'
    });
    console.log('✅ Unexpectedly succeeded:', result);
  } catch (error) {
    console.log('❌ Failed as expected:', error.stderr.toString().slice(0, 300));
  }
}

async function attack3_TemplateInjection() {
  console.log('\n🎯 ATTACK 3: Template Injection');
  
  const templateDir = path.join(attackTemplatesDir, 'injection/new');
  await fs.ensureDir(templateDir);
  
  await fs.writeFile(path.join(templateDir, 'template.njk'), `---
to: "{{ dest }}/injection.js"
---
export const userInput = "{{ userInput }}";
export const computed = {{ computation }};
`);

  // Try various injection payloads
  const payloads = [
    { userInput: '"; process.exit(1); console.log("', computation: '7*7' },
    { userInput: '{{7*7}}', computation: 'require("child_process").execSync("echo HACKED").toString()' },
    { userInput: '#{7*7}', computation: '49' },
    { userInput: '<%= 7*7 %>', computation: 'global.process.exit()' }
  ];

  for (const payload of payloads) {
    try {
      const result = execSync(`node bin/unjucks.cjs generate injection new --dest ./tests/attack-output --userInput "${payload.userInput}" --computation "${payload.computation}"`, {
        cwd: process.cwd(),
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 3000
      });
      
      // Check generated file
      const outputFile = path.join(outputDir, 'injection.js');
      if (await fs.pathExists(outputFile)) {
        const content = await fs.readFile(outputFile, 'utf8');
        console.log(`✅ Generated for payload ${JSON.stringify(payload)}:`);
        console.log(content.slice(0, 200));
        
        if (content.includes('49') && payload.computation === '7*7') {
          console.log('🚨 VULNERABILITY: Code execution detected!');
        }
        
        await fs.remove(outputFile);
      }
    } catch (error) {
      console.log(`❌ Failed for payload ${JSON.stringify(payload)}: ${error.message.slice(0, 100)}`);
    }
  }
}

async function attack4_SyntaxMixing() {
  console.log('\n🎯 ATTACK 4: Variable Syntax Mixing');
  
  const templateDir = path.join(attackTemplatesDir, 'syntax-mix/new');
  await fs.ensureDir(templateDir);
  
  await fs.writeFile(path.join(templateDir, 'template.njk'), `---
to: "{{ dest }}/syntax.js"
---
// Nunjucks syntax (should work)
export const nunjucks = "{{ nunjucksVar }}";

// EJS syntax (should NOT be processed)
export const ejs = "<%= ejsVar %>";

// Mixed syntax test
export const mixed = "{{ start }}<%= middle %>{{ end }}";

// JSP-style syntax (should not work)
export const jsp = "\${jspVar}";

// Handlebars style (should not work) 
export const handlebars = "{{handlebarsVar}}";
`);

  try {
    const result = execSync('node bin/unjucks.cjs generate syntax-mix new --dest ./tests/attack-output --nunjucksVar "NUNJUCKS_OK" --ejsVar "EJS_SHOULD_NOT_RESOLVE" --start "START" --middle "MIDDLE_SHOULD_NOT_RESOLVE" --end "END" --jspVar "JSP_SHOULD_NOT_RESOLVE" --handlebarsVar "HANDLEBARS_SHOULD_NOT_RESOLVE"', {
      cwd: process.cwd(),
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    const outputFile = path.join(outputDir, 'syntax.js');
    if (await fs.pathExists(outputFile)) {
      const content = await fs.readFile(outputFile, 'utf8');
      console.log('✅ Generated syntax test:');
      console.log(content);
      
      // Analyze what got resolved
      if (content.includes('NUNJUCKS_OK')) {
        console.log('✅ Nunjucks variables resolved correctly');
      }
      if (content.includes('<%= ejsVar %>')) {
        console.log('✅ EJS syntax left unprocessed');
      } else if (content.includes('EJS_SHOULD_NOT_RESOLVE')) {
        console.log('🚨 VULNERABILITY: EJS syntax was processed!');
      }
      
      if (content.includes('${jspVar}')) {
        console.log('✅ JSP syntax left unprocessed');
      } else if (content.includes('JSP_SHOULD_NOT_RESOLVE')) {
        console.log('🚨 VULNERABILITY: JSP syntax was processed!');
      }
    }
  } catch (error) {
    console.log('❌ Failed:', error.stderr.toString().slice(0, 300));
  }
}

async function attack5_PathTraversal() {
  console.log('\n🎯 ATTACK 5: Path Traversal');
  
  const templateDir = path.join(attackTemplatesDir, 'path-traversal/new');
  await fs.ensureDir(templateDir);
  
  await fs.writeFile(path.join(templateDir, 'template.njk'), `---
to: "{{ maliciousPath }}"
---
export const hack = "This should not be written outside the output directory";
`);

  const maliciousPaths = [
    '../../../etc/passwd',
    '../../../../tmp/hacked.txt',
    '/etc/shadow',
    '../../../../../root/.ssh/authorized_keys',
    'C:\\Windows\\System32\\drivers\\etc\\hosts',
    '\\\\?\\C:\\Windows\\System32\\config\\SAM'
  ];

  for (const maliciousPath of maliciousPaths) {
    try {
      const result = execSync(`node bin/unjucks.cjs generate path-traversal new --dest ./tests/attack-output --maliciousPath "${maliciousPath}"`, {
        cwd: process.cwd(),
        stdio: 'pipe',
        encoding: 'utf8'
      });
      
      console.log(`✅ Generated for path: ${maliciousPath}`);
      
      // Check if file was created outside output directory
      if (await fs.pathExists(path.resolve(maliciousPath))) {
        console.log(`🚨 CRITICAL VULNERABILITY: Path traversal successful! File written to ${maliciousPath}`);
      }
      
    } catch (error) {
      console.log(`❌ Blocked path traversal for: ${maliciousPath}`);
    }
  }
}

async function attack6_InfiniteLoop() {
  console.log('\n🎯 ATTACK 6: Infinite Loop');
  
  const templateDir = path.join(attackTemplatesDir, 'infinite-loop/new');
  await fs.ensureDir(templateDir);
  
  await fs.writeFile(path.join(templateDir, 'template.njk'), `---
to: "{{ dest }}/infinite.js"
---
{% for i in range(1000000) %}
Line {{ i }}
{% endfor %}
export const done = true;
`);

  try {
    const start = Date.now();
    const result = execSync('node bin/unjucks.cjs generate infinite-loop new --dest ./tests/attack-output', {
      cwd: process.cwd(),
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 5000 // 5 second timeout
    });
    const duration = Date.now() - start;
    console.log(`✅ Completed in ${duration}ms (this could be a problem if too long)`);
  } catch (error) {
    if (error.signal === 'SIGTERM') {
      console.log('✅ Properly timed out infinite loop');
    } else {
      console.log('❌ Failed for other reason:', error.message.slice(0, 100));
    }
  }
}

async function attack7_TypeMismatch() {
  console.log('\n🎯 ATTACK 7: Variable Type Mismatch');
  
  const templateDir = path.join(attackTemplatesDir, 'type-mismatch/new');
  await fs.ensureDir(templateDir);
  
  await fs.writeFile(path.join(templateDir, 'template.njk'), `---
to: "{{ dest }}/types.js"
---
export const config = {
  {% for key, value in configObject %}
  {{ key }}: "{{ value }}",
  {% endfor %}
};

export const items = [
  {% for item in itemArray %}
  "{{ item.name }}",
  {% endfor %}
];
`);

  try {
    const result = execSync('node bin/unjucks.cjs generate type-mismatch new --dest ./tests/attack-output --configObject "not-an-object" --itemArray "not-an-array"', {
      cwd: process.cwd(),
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    const outputFile = path.join(outputDir, 'types.js');
    if (await fs.pathExists(outputFile)) {
      const content = await fs.readFile(outputFile, 'utf8');
      console.log('✅ Generated despite type mismatch:');
      console.log(content.slice(0, 300));
    }
  } catch (error) {
    console.log('❌ Failed as expected:', error.stderr.toString().slice(0, 200));
  }
}

async function attack8_NonExistentTemplate() {
  console.log('\n🎯 ATTACK 8: Non-existent Template');
  
  try {
    const result = execSync('node bin/unjucks.cjs generate non-existent-generator template-name --dest ./tests/attack-output', {
      cwd: process.cwd(),
      stdio: 'pipe',
      encoding: 'utf8'
    });
    console.log('✅ Unexpectedly succeeded:', result);
  } catch (error) {
    console.log('❌ Failed as expected:', error.stderr.toString().slice(0, 200));
  }
}

async function cleanup() {
  await fs.remove(attackTemplatesDir);
  console.log('\n🧹 Cleaned up attack templates');
}

// Execute all attacks
async function runAllAttacks() {
  console.log('🚨 STARTING TEMPLATE SYSTEM ATTACK TESTS 🚨\n');
  
  await setupDirectories();
  
  await attack1_MissingVariables();
  await attack2_MalformedFrontmatter();
  await attack3_TemplateInjection();
  await attack4_SyntaxMixing();
  await attack5_PathTraversal();
  await attack6_InfiniteLoop();
  await attack7_TypeMismatch();
  await attack8_NonExistentTemplate();
  
  await cleanup();
  
  console.log('\n🏁 ATTACK TESTS COMPLETED');
  console.log('\nSUMMARY:');
  console.log('- Check output above for any 🚨 VULNERABILITY or 🚨 CRITICAL VULNERABILITY messages');
  console.log('- Template system behavior analyzed for security weaknesses');
  console.log('- Variable resolution patterns documented');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllAttacks().catch(console.error);
}

export {
  runAllAttacks,
  attack1_MissingVariables,
  attack2_MalformedFrontmatter,
  attack3_TemplateInjection,
  attack4_SyntaxMixing,
  attack5_PathTraversal,
  attack6_InfiniteLoop,
  attack7_TypeMismatch,
  attack8_NonExistentTemplate
};