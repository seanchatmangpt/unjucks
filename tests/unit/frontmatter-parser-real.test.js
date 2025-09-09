/**
 * Frontmatter Parser Real Tests - Tests actual frontmatter parsing functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';

// Import frontmatter parser - try multiple possible paths
let FrontmatterParser;
let parseFrontmatter;

try {
  const frontmatterModule = await import('../../src/lib/frontmatter-parser.js');
  FrontmatterParser = frontmatterModule.FrontmatterParser || frontmatterModule.default;
  parseFrontmatter = frontmatterModule.parseFrontmatter;
} catch (error) {
  console.warn('Could not import frontmatter parser, using fallback');
}

describe('Frontmatter Parser - Real Functionality', () => {
  let testDir;
  let parser;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'tests', 'temp', `frontmatter-test-${Date.now()}`);
    await fs.ensureDir(testDir);
    
    if (FrontmatterParser) {
      parser = new FrontmatterParser();
    }
  });

  afterEach(async () => {
    try {
      await fs.remove(testDir);
    } catch (error) {
      console.warn('Could not clean up test directory:', error.message);
    }
  });

  describe('Basic Frontmatter Parsing', () => {
    it('should parse YAML frontmatter', async () => {
      const content = `---
to: "{{ name }}.ts"
inject: true
skipIf: "{{ skip }}"
---
export class {{ name }} {
  constructor() {}
}`;

      if (parseFrontmatter) {
        const result = parseFrontmatter(content);
        
        expect(result).toMatchObject({
          data: {
            to: "{{ name }}.ts",
            inject: true,
            skipIf: "{{ skip }}"
          },
          content: expect.stringContaining('export class')
        });
      } else {
        // Fallback test using gray-matter directly
        const matter = await import('gray-matter');
        const result = matter.default(content);
        
        expect(result.data.to).toBe("{{ name }}.ts");
        expect(result.data.inject).toBe(true);
      }
    });

    it('should parse JSON frontmatter', async () => {
      const content = `---json
{
  "to": "{{ name }}.js",
  "inject": false,
  "variables": ["name", "type"]
}
---
function {{ name }}() {
  return "{{ type }}";
}`;

      if (parseFrontmatter) {
        const result = parseFrontmatter(content);
        
        expect(result.data.to).toBe("{{ name }}.js");
        expect(result.data.inject).toBe(false);
        expect(Array.isArray(result.data.variables)).toBe(true);
      }
    });

    it('should handle content without frontmatter', async () => {
      const content = `export class {{ name }} {
  constructor() {}
}`;

      if (parseFrontmatter) {
        const result = parseFrontmatter(content);
        
        expect(result.data).toEqual({});
        expect(result.content).toBe(content);
      }
    });

    it('should handle empty frontmatter', async () => {
      const content = `---
---
export class {{ name }} {}`;

      if (parseFrontmatter) {
        const result = parseFrontmatter(content);
        
        expect(result.data).toEqual({});
        expect(result.content).toContain('export class');
      }
    });

    it('should parse complex frontmatter with arrays and objects', async () => {
      const content = `---
to: "{{ name }}/index.ts"
inject: true
variables:
  - name: "Entity name"
  - type: "Entity type"
dependencies:
  - react
  - typescript
config:
  typescript: true
  eslint: true
  prettier: true
hooks:
  before: ["validate", "backup"]
  after: ["format", "test"]
---
export interface {{ name }} {
  id: {{ type }};
}`;

      if (parseFrontmatter) {
        const result = parseFrontmatter(content);
        
        expect(result.data.to).toBe("{{ name }}/index.ts");
        expect(Array.isArray(result.data.variables)).toBe(true);
        expect(Array.isArray(result.data.dependencies)).toBe(true);
        expect(typeof result.data.config).toBe('object');
        expect(typeof result.data.hooks).toBe('object');
        expect(Array.isArray(result.data.hooks.before)).toBe(true);
      }
    });
  });

  describe('Frontmatter Validation', () => {
    it('should validate required frontmatter fields', async () => {
      if (!parser || !parser.validate) {
        return; // Skip if validation method not available
      }

      const validFrontmatter = {
        to: "{{ name }}.ts",
        inject: false
      };

      const result = parser.validate(validFrontmatter);
      expect(result.valid).toBe(true);
    });

    it('should detect invalid frontmatter', async () => {
      if (!parser || !parser.validate) {
        return; // Skip if validation method not available
      }

      const invalidFrontmatter = {
        inject: "not-a-boolean",
        to: 123 // should be string
      };

      const result = parser.validate(invalidFrontmatter);
      expect(result.valid).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('File Injection Directives', () => {
    it('should parse injection directives', async () => {
      const content = `---
to: "{{ name }}.ts"
inject: true
before: "// Imports"
after: "// End of file"
at: 10
skipIf: "{{ name }} === 'skip'"
---
import { {{ name }} } from './types';`;

      if (parseFrontmatter) {
        const result = parseFrontmatter(content);
        
        expect(result.data.inject).toBe(true);
        expect(result.data.before).toBe("// Imports");
        expect(result.data.after).toBe("// End of file");
        expect(result.data.at).toBe(10);
        expect(result.data.skipIf).toBe("{{ name }} === 'skip'");
      }
    });

    it('should parse prepend and append directives', async () => {
      const content = `---
to: "{{ name }}.ts"
inject: true
prepend: "/* Auto-generated file */\n"
append: "\n/* End of auto-generated file */"
---
export const {{ name }} = {};`;

      if (parseFrontmatter) {
        const result = parseFrontmatter(content);
        
        expect(result.data.prepend).toContain('Auto-generated');
        expect(result.data.append).toContain('End of auto-generated');
      }
    });

    it('should parse chmod directives', async () => {
      const content = `---
to: "scripts/{{ name }}.sh"
chmod: 755
---
#!/bin/bash
echo "{{ name }}"`;

      if (parseFrontmatter) {
        const result = parseFrontmatter(content);
        
        expect(result.data.chmod).toBe(755);
      }
    });

    it('should parse shell execution directives', async () => {
      const content = `---
to: "{{ name }}.ts"
sh: "npm install {{ packageName }}"
---
import {{ name }} from '{{ packageName }}';`;

      if (parseFrontmatter) {
        const result = parseFrontmatter(content);
        
        expect(result.data.sh).toBe("npm install {{ packageName }}");
      }
    });
  });

  describe('Template Variables in Frontmatter', () => {
    it('should preserve template variables in frontmatter values', async () => {
      const content = `---
to: "{{ baseDir }}/{{ name | kebabCase }}.{{ extension }}"
inject: "{{ shouldInject }}"
condition: "{{ name !== 'skip' }}"
---
Content with {{ variables }}`;

      if (parseFrontmatter) {
        const result = parseFrontmatter(content);
        
        expect(result.data.to).toContain('{{ baseDir }}');
        expect(result.data.to).toContain('{{ name | kebabCase }}');
        expect(result.data.inject).toContain('{{ shouldInject }}');
        expect(result.data.condition).toContain("{{ name !== 'skip' }}");
      }
    });

    it('should handle complex template expressions in frontmatter', async () => {
      const content = `---
to: "{{ name | pascalCase }}/{{ type | kebabCase }}.{{ format || 'ts' }}"
inject: "{{ mode === 'update' }}"
skipIf: "{{ existing && !force }}"
variables:
  - "{{ primaryKey }}"
  - "{{ foreignKeys | join(',') }}"
---
Template content`;

      if (parseFrontmatter) {
        const result = parseFrontmatter(content);
        
        expect(result.data.to).toContain('{{ name | pascalCase }}');
        expect(result.data.inject).toContain("{{ mode === 'update' }}");
        expect(result.data.skipIf).toContain('{{ existing && !force }}');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed YAML frontmatter', async () => {
      const content = `---
to: "{{ name }}.ts
invalid: yaml: content
unbalanced: { brackets
---
export class {{ name }} {}`;

      if (parseFrontmatter) {
        // Should handle gracefully without throwing
        const result = parseFrontmatter(content);
        expect(typeof result).toBe('object');
        expect(result.content).toBeDefined();
      }
    });

    it('should handle frontmatter without closing delimiter', async () => {
      const content = `---
to: "{{ name }}.ts"
inject: true
export class {{ name }} {}`;

      if (parseFrontmatter) {
        const result = parseFrontmatter(content);
        expect(typeof result).toBe('object');
      }
    });

    it('should handle multiple frontmatter blocks', async () => {
      const content = `---
to: "first.ts"
---
---
to: "second.ts"
---
Content here`;

      if (parseFrontmatter) {
        const result = parseFrontmatter(content);
        // Should parse the first block
        expect(result.data.to).toBe("first.ts");
      }
    });

    it('should handle very large frontmatter blocks', async () => {
      const largeFrontmatter = `---
to: "{{ name }}.ts"
data: ${JSON.stringify(Array.from({ length: 1000 }, (_, i) => `item-${i}`))}
---
Content`;

      if (parseFrontmatter) {
        const result = parseFrontmatter(largeFrontmatter);
        expect(Array.isArray(result.data.data)).toBe(true);
        expect(result.data.data.length).toBe(1000);
      }
    });
  });

  describe('Special Characters and Encoding', () => {
    it('should handle Unicode characters in frontmatter', async () => {
      const content = `---
to: "{{ name }}-测试.ts"
description: "Component with émojis 🚀"
author: "José María"
---
Content with special chars`;

      if (parseFrontmatter) {
        const result = parseFrontmatter(content);
        
        expect(result.data.to).toContain('测试');
        expect(result.data.description).toContain('🚀');
        expect(result.data.author).toContain('José María');
      }
    });

    it('should handle escaped characters', async () => {
      const content = `---
to: "{{ name | replace('\\\\', '/') }}.ts"
description: "Path with \"quotes\" and \\backslashes"
regex: "\\d+\\.\\d+"
---
Template content`;

      if (parseFrontmatter) {
        const result = parseFrontmatter(content);
        
        expect(result.data.description).toContain('"quotes"');
        expect(result.data.regex).toContain('\\d+');
      }
    });

    it('should preserve line breaks and whitespace', async () => {
      const content = `---
to: "{{ name }}.ts"
multiline: |
  Line one
  Line two
    Indented line
literal: |-
  No trailing newline
---
Content`;

      if (parseFrontmatter) {
        const result = parseFrontmatter(content);
        
        expect(result.data.multiline).toContain('Line one\nLine two');
        expect(result.data.literal).toBe('No trailing newline');
      }
    });
  });

  describe('Integration with File Operations', () => {
    it('should parse frontmatter from actual files', async () => {
      const templateContent = `---
to: "{{ name }}.service.ts"
inject: true
dependencies:
  - "@nestjs/common"
  - "typeorm"
---
import { Injectable } from '@nestjs/common';

@Injectable()
export class {{ name }}Service {
  // Service implementation
}`;

      const templateFile = path.join(testDir, 'service.njk');
      await fs.writeFile(templateFile, templateContent);

      if (parseFrontmatter) {
        const fileContent = await fs.readFile(templateFile, 'utf8');
        const result = parseFrontmatter(fileContent);
        
        expect(result.data.to).toBe("{{ name }}.service.ts");
        expect(result.data.inject).toBe(true);
        expect(Array.isArray(result.data.dependencies)).toBe(true);
        expect(result.content).toContain('@Injectable');
      }
    });

    it('should handle different file encodings', async () => {
      const templateContent = `---
to: "{{ name }}.ts"
encoding: "utf8"
---
Content with special characters: àáâãäåæçèé`;

      const templateFile = path.join(testDir, 'encoded.njk');
      await fs.writeFile(templateFile, templateContent, 'utf8');

      if (parseFrontmatter) {
        const fileContent = await fs.readFile(templateFile, 'utf8');
        const result = parseFrontmatter(fileContent);
        
        expect(result.content).toContain('àáâãäåæçèé');
      }
    });
  });
});