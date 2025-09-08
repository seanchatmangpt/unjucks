import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

describe('Template System Attack Tests', () => {
  const attackTemplatesDir = path.join(process.cwd(), '_templates/attack-tests');
  const outputDir = path.join(process.cwd(), 'tests/attack-output');
  
  beforeAll(async () => {
    await fs.ensureDir(attackTemplatesDir);
    await fs.ensureDir(outputDir);
  });

  afterAll(async () => {
    await fs.remove(attackTemplatesDir);
    await fs.remove(outputDir);
  });

  describe('1. Missing Variables Attack', () => {
    it('should fail gracefully with missing required variables', async () => {
      // Create template requiring variables that won't be provided
      const templateDir = path.join(attackTemplatesDir, 'missing-vars/new');
      await fs.ensureDir(templateDir);
      
      await fs.writeFile(path.join(templateDir, 'template.njk'), `---
to: "{{ dest }}/{{ requiredVar }}.js"
---
export const {{ anotherRequiredVar }} = "{{ yetAnotherVar }}";
// Template requires: requiredVar, anotherRequiredVar, yetAnotherVar, dest
`);

      // Try to generate without providing required variables
      let error;
      try {
        execSync('node bin/unjucks.cjs generate missing-vars new', {
          cwd: process.cwd(),
          stdio: 'pipe'
        });
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
      expect(error.stderr?.toString()).toMatch(/variable|undefined|missing/i);
    });

    it('should identify all missing variables in complex template', async () => {
      const templateDir = path.join(attackTemplatesDir, 'complex-missing/new');
      await fs.ensureDir(templateDir);
      
      await fs.writeFile(path.join(templateDir, 'template.njk'), `---
to: "{{ basePath }}/{{ moduleName }}/{{ fileName }}.{{ extension }}"
---
{% if hasAuth %}
import { {{ authModule }} } from "{{ authPath }}";
{% endif %}

export class {{ className }} {
  constructor({{ constructorParams }}) {
    this.config = {{ configObject }};
  }
  
  {% for method in methods %}
  {{ method.name }}({{ method.params }}) {
    return {{ method.returnValue }};
  }
  {% endfor %}
}
`);

      let error;
      try {
        execSync('node bin/unjucks.cjs generate complex-missing new --dest ./tests/attack-output', {
          cwd: process.cwd(),
          stdio: 'pipe'
        });
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
    });
  });

  describe('2. Circular References Attack', () => {
    it('should detect circular template references', async () => {
      const templateDir = path.join(attackTemplatesDir, 'circular/new');
      await fs.ensureDir(templateDir);
      
      await fs.writeFile(path.join(templateDir, 'template.njk'), `---
to: "{{ dest }}/circular.js"
---
{% include "circular2.njk" %}
export const data = "{{ value }}";
`);

      await fs.writeFile(path.join(templateDir, 'circular2.njk'), `---
to: "{{ dest }}/circular2.js"
---
{% include "template.njk" %}
export const data2 = "{{ value2 }}";
`);

      let error;
      try {
        execSync('node bin/unjucks.cjs generate circular new --dest ./tests/attack-output --value test --value2 test2', {
          cwd: process.cwd(),
          stdio: 'pipe'
        });
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
    });
  });

  describe('3. Malformed Frontmatter Attack', () => {
    it('should handle invalid YAML frontmatter', async () => {
      const templateDir = path.join(attackTemplatesDir, 'bad-yaml/new');
      await fs.ensureDir(templateDir);
      
      await fs.writeFile(path.join(templateDir, 'template.njk'), `---
to: "output.js"
invalid_yaml: [unclosed array
missing_quote: "unclosed string
nested:
  - item1
  - item2: {unclosed object
    bad_indent:
---
export const test = "{{ name }}";
`);

      let error;
      try {
        execSync('node bin/unjucks.cjs generate bad-yaml new --dest ./tests/attack-output --name testValue', {
          cwd: process.cwd(),
          stdio: 'pipe'
        });
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
    });

    it('should handle missing frontmatter delimiters', async () => {
      const templateDir = path.join(attackTemplatesDir, 'no-frontmatter/new');
      await fs.ensureDir(templateDir);
      
      await fs.writeFile(path.join(templateDir, 'template.njk'), `to: "output.js"
export const test = "{{ name }}";
`);

      let error;
      try {
        execSync('node bin/unjucks.cjs generate no-frontmatter new --dest ./tests/attack-output --name testValue', {
          cwd: process.cwd(),
          stdio: 'pipe'
        });
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
    });
  });

  describe('4. Infinite Loop Attack', () => {
    it('should prevent infinite loops in templates', async () => {
      const templateDir = path.join(attackTemplatesDir, 'infinite-loop/new');
      await fs.ensureDir(templateDir);
      
      await fs.writeFile(path.join(templateDir, 'template.njk'), `---
to: "{{ dest }}/infinite.js"
---
{% set counter = 1 %}
{% for i in range(1000000) %}
  {% if counter < 1000000 %}
    {% set counter = counter + 1 %}
    // Loop iteration {{ counter }}
    {% if counter == 999999 %}
      {% set counter = 1 %}
    {% endif %}
  {% endif %}
{% endfor %}
export const result = {{ counter }};
`);

      let error;
      try {
        execSync('node bin/unjucks.cjs generate infinite-loop new --dest ./tests/attack-output', {
          cwd: process.cwd(),
          stdio: 'pipe',
          timeout: 5000 // 5 second timeout
        });
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
      expect(error.signal === 'SIGTERM' || error.code !== 0).toBe(true);
    });

    it('should handle recursive macro calls', async () => {
      const templateDir = path.join(attackTemplatesDir, 'recursive-macro/new');
      await fs.ensureDir(templateDir);
      
      await fs.writeFile(path.join(templateDir, 'template.njk'), `---
to: "{{ dest }}/recursive.js"
---
{% macro recursive(depth) %}
  {% if depth > 0 %}
    {{ recursive(depth - 1) }}
  {% endif %}
  depth: {{ depth }}
{% endmacro %}

export const result = {{ recursive(10000) }};
`);

      let error;
      try {
        execSync('node bin/unjucks.cjs generate recursive-macro new --dest ./tests/attack-output', {
          cwd: process.cwd(),
          stdio: 'pipe',
          timeout: 5000
        });
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
    });
  });

  describe('5. Large Template Attack', () => {
    it('should handle very large templates gracefully', async () => {
      const templateDir = path.join(attackTemplatesDir, 'large-template/new');
      await fs.ensureDir(templateDir);
      
      // Create a template that will generate a >10MB file
      let largeContent = `---
to: "{{ dest }}/large.js"
---
export const largeData = {
`;
      
      // Generate 1 million lines of content
      for (let i = 0; i < 100000; i++) {
        largeContent += `  property${i}: "This is a very long string that will make the file large ${i.toString().repeat(100)}",\n`;
      }
      
      largeContent += `};
export const name = "{{ name }}";`;
      
      await fs.writeFile(path.join(templateDir, 'template.njk'), largeContent);

      let error;
      try {
        execSync('node bin/unjucks.cjs generate large-template new --dest ./tests/attack-output --name testValue', {
          cwd: process.cwd(),
          stdio: 'pipe',
          timeout: 30000, // 30 second timeout
          maxBuffer: 1024 * 1024 * 50 // 50MB buffer
        });
      } catch (e) {
        error = e;
      }
      
      // Should either succeed or fail gracefully with memory/timeout error
      if (error) {
        expect(
          error.signal === 'SIGTERM' || 
          error.message.includes('timeout') || 
          error.message.includes('memory') ||
          error.message.includes('EMFILE') ||
          error.message.includes('ENOMEM')
        ).toBe(true);
      }
    });
  });

  describe('6. Template Injection Attack', () => {
    it('should prevent code injection through template variables', async () => {
      const templateDir = path.join(attackTemplatesDir, 'injection/new');
      await fs.ensureDir(templateDir);
      
      await fs.writeFile(path.join(templateDir, 'template.njk'), `---
to: "{{ dest }}/injection.js"
---
export const userInput = "{{ userInput }}";
export const safeValue = {{ safeValue }};
`);

      // Try to inject malicious code
      const maliciousInput = '"; process.exit(1); console.log("';
      const maliciousValue = 'require("fs").writeFileSync("hacked.txt", "HACKED")';
      
      let error;
      let stdout;
      try {
        stdout = execSync(`node bin/unjucks.cjs generate injection new --dest ./tests/attack-output --userInput "${maliciousInput}" --safeValue "${maliciousValue}"`, {
          cwd: process.cwd(),
          stdio: 'pipe',
          timeout: 5000
        });
      } catch (e) {
        error = e;
      }
      
      // Check if malicious code was executed (hacked.txt created)
      const hackedFileExists = await fs.pathExists('hacked.txt');
      expect(hackedFileExists).toBe(false);
      
      // Check output file for proper escaping
      const outputFile = path.join(outputDir, 'injection.js');
      if (await fs.pathExists(outputFile)) {
        const content = await fs.readFile(outputFile, 'utf8');
        expect(content).not.toContain('process.exit');
        expect(content).not.toContain('require("fs")');
      }
    });

    it('should prevent server-side template injection', async () => {
      const templateDir = path.join(attackTemplatesDir, 'ssti/new');
      await fs.ensureDir(templateDir);
      
      await fs.writeFile(path.join(templateDir, 'template.njk'), `---
to: "{{ dest }}/ssti.js"
---
export const data = "{{ payload }}";
`);

      // SSTI payloads
      const sstiPayloads = [
        '{{7*7}}',
        '{{constructor.constructor("return process")().exit()}}',
        '{{range.constructor("return process")().env}}',
        '#{7*7}',
        '${{7*7}}',
        '${7*7}',
        '<%- 7*7 %>',
        '<%= 7*7 %>'
      ];

      for (const payload of sstiPayloads) {
        let error;
        try {
          execSync(`node bin/unjucks.cjs generate ssti new --dest ./tests/attack-output --payload "${payload}"`, {
            cwd: process.cwd(),
            stdio: 'pipe',
            timeout: 5000
          });
        } catch (e) {
          error = e;
        }
        
        // Check if output contains executed code (49 from 7*7)
        const outputFile = path.join(outputDir, 'ssti.js');
        if (await fs.pathExists(outputFile)) {
          const content = await fs.readFile(outputFile, 'utf8');
          expect(content).not.toContain('49'); // Should not execute 7*7
          await fs.remove(outputFile); // Clean for next test
        }
      }
    });
  });

  describe('7. Non-existent Path Attack', () => {
    it('should handle non-existent template paths', async () => {
      let error;
      try {
        execSync('node bin/unjucks.cjs generate non-existent-generator template-name --dest ./tests/attack-output', {
          cwd: process.cwd(),
          stdio: 'pipe'
        });
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
      expect(error.stderr?.toString()).toMatch(/not found|missing|does not exist/i);
    });

    it('should handle templates with invalid paths in frontmatter', async () => {
      const templateDir = path.join(attackTemplatesDir, 'invalid-path/new');
      await fs.ensureDir(templateDir);
      
      await fs.writeFile(path.join(templateDir, 'template.njk'), `---
to: "../../../../../../../etc/passwd"
---
export const hack = "attempted";
`);

      let error;
      try {
        execSync('node bin/unjucks.cjs generate invalid-path new --dest ./tests/attack-output', {
          cwd: process.cwd(),
          stdio: 'pipe'
        });
      } catch (e) {
        error = e;
      }
      
      // Should prevent path traversal
      const etcPasswdExists = await fs.pathExists('/etc/passwd');
      if (etcPasswdExists) {
        const content = await fs.readFile('/etc/passwd', 'utf8');
        expect(content).not.toContain('export const hack');
      }
    });
  });

  describe('8. Variable Type Mismatch Attack', () => {
    it('should handle string where object expected', async () => {
      const templateDir = path.join(attackTemplatesDir, 'type-mismatch/new');
      await fs.ensureDir(templateDir);
      
      await fs.writeFile(path.join(templateDir, 'template.njk'), `---
to: "{{ dest }}/types.js"
---
export const config = {
  {% for key, value in configObject %}
  {{ key }}: {{ value }},
  {% endfor %}
};

export const items = [
  {% for item in itemArray %}
  "{{ item.name }}",
  {% endfor %}
];
`);

      let error;
      try {
        execSync('node bin/unjucks.cjs generate type-mismatch new --dest ./tests/attack-output --configObject "not-an-object" --itemArray "not-an-array"', {
          cwd: process.cwd(),
          stdio: 'pipe'
        });
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
    });
  });

  describe('9. Variable Syntax Attack', () => {
    it('should handle <%= %> vs {{ }} syntax correctly', async () => {
      const templateDir = path.join(attackTemplatesDir, 'syntax-mix/new');
      await fs.ensureDir(templateDir);
      
      await fs.writeFile(path.join(templateDir, 'template.njk'), `---
to: "{{ dest }}/syntax.js"
---
// Nunjucks syntax
export const nunjucks = "{{ nunjucksVar }}";

// EJS syntax (should NOT be processed)
export const ejs = "<%= ejsVar %>";

// Mixed syntax
export const mixed = "{{ start }}<%= middle %>{{ end }}";

// Expression syntax
export const expr = "<%- expression %>";
`);

      let output;
      try {
        output = execSync('node bin/unjucks.cjs generate syntax-mix new --dest ./tests/attack-output --nunjucksVar "NUNJUCKS" --ejsVar "EJS" --start "START" --middle "MIDDLE" --end "END" --expression "EXPR"', {
          cwd: process.cwd(),
          stdio: 'pipe'
        });
      } catch (e) {
        // May error due to undefined variables
      }
      
      const outputFile = path.join(outputDir, 'syntax.js');
      if (await fs.pathExists(outputFile)) {
        const content = await fs.readFile(outputFile, 'utf8');
        
        // Nunjucks variables should be resolved
        expect(content).toContain('"NUNJUCKS"');
        
        // EJS syntax should remain unprocessed
        expect(content).toContain('<%= ejsVar %>');
        expect(content).not.toContain('"EJS"');
        
        console.log('Generated syntax test file content:', content);
      }
    });
  });
});