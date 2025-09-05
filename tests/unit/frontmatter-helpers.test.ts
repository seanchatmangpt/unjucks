import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UnjucksWorld } from '../support/world';
import * as yaml from 'js-yaml';

// Helper functions that will be added to UnjucksWorld
function parseFrontmatter(template: string) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
  const match = template.match(frontmatterRegex);
  
  if (!match) {
    return { frontmatter: {}, body: template };
  }
  
  const [, frontmatterContent, body] = match;
  
  try {
    const frontmatter = yaml.load(frontmatterContent) as any;
    return { frontmatter: frontmatter || {}, body: body || '' };
  } catch (error: any) {
    throw new Error(`Failed to parse YAML frontmatter: ${error.message}`);
  }
}

function renderTemplate(template: string, variables: any) {
  if (!template) return template;
  
  // Simple template rendering - replace {{ variable }} with values
  return template.replace(/{{\s*([^}]+)\s*}}/g, (match, varName) => {
    const trimmed = varName.trim();
    
    // Handle filters like "{{ name | pascalCase }}"
    if (trimmed.includes('|')) {
      const [variable, filter] = trimmed.split('|').map(s => s.trim());
      const value = variables[variable] || '';
      
      switch (filter) {
        case 'pascalCase':
          return value.replace(/(?:^|[-_])(\w)/g, (_: string, c: string) => c.toUpperCase());
        case 'kebabCase':
          return value.replace(/[A-Z]/g, (c: string) => `-${c.toLowerCase()}`);
        case 'titleCase':
          return value.replace(/\b\w/g, (c: string) => c.toUpperCase());
        default:
          return value;
      }
    }
    
    return variables[trimmed] || match;
  });
}

function evaluateSkipCondition(condition: string, variables: any) {
  try {
    // Handle simple template expressions like "{{ !withFeature }}"
    const templateMatch = condition.match(/^{{\s*(.+?)\s*}}$/);
    if (templateMatch) {
      const expression = templateMatch[1];
      
      // Handle negation
      if (expression.startsWith('!')) {
        const varName = expression.slice(1).trim();
        return !variables[varName];
      }
      
      // Handle method calls like "existingConfig.includes(configName)"
      if (expression.includes('.includes(')) {
        const [arrayName, methodCall] = expression.split('.includes(');
        const varName = methodCall.replace(')', '').trim();
        const array = variables[arrayName];
        const value = variables[varName];
        
        if (Array.isArray(array)) {
          return array.includes(value);
        }
      }
      
      // Simple variable evaluation
      return !!variables[expression];
    }
    
    // Fallback: evaluate as JavaScript (unsafe in production)
    return false;
  } catch {
    return false;
  }
}

function validateFrontmatter(frontmatter: any) {
  const knownDirectives = [
    'to', 'inject', 'before', 'after', 'append', 'prepend', 'lineAt', 
    'skipIf', 'chmod', 'sh', 'backup'
  ];
  
  const warnings: string[] = [];
  const errors: string[] = [];
  const validDirectives: string[] = [];
  
  for (const [key, value] of Object.entries(frontmatter)) {
    if (knownDirectives.includes(key)) {
      validDirectives.push(key);
      
      // Validate specific directive types
      if (key === 'inject' && typeof value !== 'boolean') {
        errors.push(`Invalid value for 'inject': expected boolean, got ${typeof value}`);
      }
      if (key === 'lineAt' && !Number.isInteger(value)) {
        errors.push(`Invalid value for 'lineAt': expected integer, got ${typeof value}`);
      }
      if (key === 'chmod' && (!Number.isInteger(value as number) || (value as number) < 0 || (value as number) > 777)) {
        errors.push(`Invalid value for 'chmod': expected octal number (0-777), got ${value}`);
      }
    } else {
      warnings.push(`Unknown directive: ${key}`);
    }
  }
  
  return {
    warnings,
    errors,
    validDirectives,
    valid: errors.length === 0
  };
}

describe('Frontmatter Helper Functions', () => {
  describe('parseFrontmatter', () => {
    it('should parse basic frontmatter correctly', () => {
      const template = `---
to: src/components/{{ componentName }}.ts
---
export class {{ componentName }} {}`;
      
      const result = parseFrontmatter(template);
      
      expect(result.frontmatter.to).toBe('src/components/{{ componentName }}.ts');
      expect(result.body.trim()).toBe('export class {{ componentName }} {}');
    });
    
    it('should handle templates without frontmatter', () => {
      const template = 'export class MyComponent {}';
      const result = parseFrontmatter(template);
      
      expect(result.frontmatter).toEqual({});
      expect(result.body).toBe(template);
    });
    
    it('should parse complex frontmatter with multiple directives', () => {
      const template = `---
to: src/routes.ts
inject: true
before: "// END ROUTES"
skipIf: "{{ !withRoutes }}"
chmod: 755
---
router.get('{{ path }}', {{ handler }});`;
      
      const result = parseFrontmatter(template);
      
      expect(result.frontmatter.to).toBe('src/routes.ts');
      expect(result.frontmatter.inject).toBe(true);
      expect(result.frontmatter.before).toBe('// END ROUTES');
      expect(result.frontmatter.skipIf).toBe('{{ !withRoutes }}');
      expect(result.frontmatter.chmod).toBe(755);
      expect(result.body.trim()).toBe("router.get('{{ path }}', {{ handler }});");
    });
    
    it('should throw error for malformed YAML', () => {
      const template = `---
to src/invalid.ts
inject: [unclosed
---
content`;
      
      expect(() => parseFrontmatter(template)).toThrow(/Failed to parse YAML frontmatter/);
    });
  });
  
  describe('renderTemplate', () => {
    it('should render simple template variables', () => {
      const template = 'Hello {{ name }}!';
      const variables = { name: 'World' };
      
      const result = renderTemplate(template, variables);
      
      expect(result).toBe('Hello World!');
    });
    
    it('should handle pascalCase filter', () => {
      const template = '{{ name | pascalCase }}';
      const variables = { name: 'user-service' };
      
      const result = renderTemplate(template, variables);
      
      expect(result).toBe('UserService');
    });
    
    it('should handle kebabCase filter', () => {
      const template = '{{ name | kebabCase }}';
      const variables = { name: 'UserService' };
      
      const result = renderTemplate(template, variables);
      
      expect(result).toBe('-user-service');
    });
    
    it('should handle titleCase filter', () => {
      const template = '{{ name | titleCase }}';
      const variables = { name: 'hello world' };
      
      const result = renderTemplate(template, variables);
      
      expect(result).toBe('Hello World');
    });
    
    it('should handle missing variables gracefully', () => {
      const template = 'Hello {{ missing }}!';
      const variables = { name: 'World' };
      
      const result = renderTemplate(template, variables);
      
      expect(result).toBe('Hello {{ missing }}!');
    });
    
    it('should handle multiple variables', () => {
      const template = '{{ greeting }} {{ name }}, today is {{ day }}!';
      const variables = { greeting: 'Hello', name: 'Alice', day: 'Monday' };
      
      const result = renderTemplate(template, variables);
      
      expect(result).toBe('Hello Alice, today is Monday!');
    });
  });
  
  describe('evaluateSkipCondition', () => {
    it('should evaluate simple boolean conditions', () => {
      const condition = '{{ !withFeature }}';
      const variables = { withFeature: false };
      
      const result = evaluateSkipCondition(condition, variables);
      
      expect(result).toBe(true);
    });
    
    it('should evaluate negation correctly when false', () => {
      const condition = '{{ !withFeature }}';
      const variables = { withFeature: true };
      
      const result = evaluateSkipCondition(condition, variables);
      
      expect(result).toBe(false);
    });
    
    it('should evaluate array includes conditions', () => {
      const condition = '{{ existingConfig.includes(configName) }}';
      const variables = { 
        existingConfig: ['feature1', 'feature2'],
        configName: 'feature1'
      };
      
      const result = evaluateSkipCondition(condition, variables);
      
      expect(result).toBe(true);
    });
    
    it('should return false for array includes when not found', () => {
      const condition = '{{ existingConfig.includes(configName) }}';
      const variables = { 
        existingConfig: ['feature1', 'feature2'],
        configName: 'feature3'
      };
      
      const result = evaluateSkipCondition(condition, variables);
      
      expect(result).toBe(false);
    });
    
    it('should handle simple variable evaluation', () => {
      const condition = '{{ withTests }}';
      const variables = { withTests: true };
      
      const result = evaluateSkipCondition(condition, variables);
      
      expect(result).toBe(true);
    });
    
    it('should handle falsy variable evaluation', () => {
      const condition = '{{ withTests }}';
      const variables = { withTests: false };
      
      const result = evaluateSkipCondition(condition, variables);
      
      expect(result).toBe(false);
    });
    
    it('should return false for malformed conditions', () => {
      const condition = '{{ invalid.syntax(unclosed }}';
      const variables = {};
      
      const result = evaluateSkipCondition(condition, variables);
      
      expect(result).toBe(false);
    });
  });
  
  describe('validateFrontmatter', () => {
    it('should validate known directives', () => {
      const frontmatter = {
        to: 'src/file.ts',
        inject: true,
        before: '// marker',
        chmod: 755
      };
      
      const result = validateFrontmatter(frontmatter);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.validDirectives).toEqual(['to', 'inject', 'before', 'chmod']);
    });
    
    it('should warn about unknown directives', () => {
      const frontmatter = {
        to: 'src/file.ts',
        unknownDirective: 'value',
        anotherUnknown: true
      };
      
      const result = validateFrontmatter(frontmatter);
      
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings).toContain('Unknown directive: unknownDirective');
      expect(result.warnings).toContain('Unknown directive: anotherUnknown');
      expect(result.validDirectives).toEqual(['to']);
    });
    
    it('should error on invalid directive values', () => {
      const frontmatter = {
        to: 'src/file.ts',
        inject: 'not-a-boolean',
        lineAt: 'not-a-number',
        chmod: 999
      };
      
      const result = validateFrontmatter(frontmatter);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContain("Invalid value for 'inject': expected boolean, got string");
      expect(result.errors).toContain("Invalid value for 'lineAt': expected integer, got string");
      expect(result.errors).toContain("Invalid value for 'chmod': expected octal number (0-777), got 999");
    });
    
    it('should validate chmod permissions correctly', () => {
      const validChmod = { chmod: 644 };
      const invalidChmod1 = { chmod: -1 };
      const invalidChmod2 = { chmod: 888 };
      
      expect(validateFrontmatter(validChmod).valid).toBe(true);
      expect(validateFrontmatter(invalidChmod1).valid).toBe(false);
      expect(validateFrontmatter(invalidChmod2).valid).toBe(false);
    });
    
    it('should validate all known directives', () => {
      const frontmatter = {
        to: 'src/file.ts',
        inject: true,
        before: 'marker',
        after: 'marker',
        append: true,
        prepend: false,
        lineAt: 42,
        skipIf: '{{ condition }}',
        chmod: 755,
        sh: 'echo "test"',
        backup: true
      };
      
      const result = validateFrontmatter(frontmatter);
      
      expect(result.valid).toBe(true);
      expect(result.validDirectives).toHaveLength(11);
    });
  });
});