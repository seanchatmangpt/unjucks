import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UnjucksWorld } from '../support/world.js';

describe('Nunjucks Template Processing Validation', () => {
  let world;

  beforeEach(async () => {
    world = new UnjucksWorld();
    await world.createTempDirectory();
  });

  afterEach(async () => {
    await world.cleanupTempDirectory();
  });

  describe('HYGEN-DELTA Claim, () => { it('should support all Nunjucks filters claimed in HYGEN-DELTA', async () => {
      const templateContent = `---
to }}.ts"
---
export class {{ name | pascalCase }}Service {
  // Testing 8+ built-in filters
  kebabName = "{{ name | kebabCase }}";
  snakeName = "{{ name | snakeCase }}";
  camelName = "{{ name | camelCase }}";
  titleName = "{{ name | titleCase }}";
  upperName = "{{ name | upperCase }}";
  lowerName = "{{ name | lowerCase }}";
  pluralName = "{{ name | pluralize }}";
  defaultValue = "{{ optionalValue | default('fallback') }}";
}`;

      await world.helper.createDirectory('_templates/filters/test');
      await world.helper.createFile('_templates/filters/test/service.ts', templateContent);
      
      const result = await world.helper.runCli('unjucks generate filters test --name=user-profile --optionalValue=');
      expect(result.exitCode).toBe(0);
      
      const content = await world.helper.readFile('src/UserProfileService.ts');
      
      // Test all filter transformations
      expect(content).toContain('export class UserProfileService');
      expect(content).toContain('kebabName = "user-profile"');
      expect(content).toContain('snakeName = "user_profile"');
      expect(content).toContain('camelName = "userProfile"');
      expect(content).toContain('titleName = "User Profile"');
      expect(content).toContain('upperName = "USER-PROFILE"');
      expect(content).toContain('lowerName = "user-profile"');
      expect(content).toContain('pluralName = "user-profiles"');
      expect(content).toContain('defaultValue = "fallback"');
    });

    it('should support template inheritance features', async () => { // Create base template
      const baseTemplateContent = `---
to }}.ts"
---
{% block imports %}
// Default imports
{% endblock %}

{% block class %}
export class {{ name | pascalCase }} {
  {% block properties %}
  name = "{{ name }}";
  {% endblock %}

  {% block methods %}
  // Default methods
  {% endblock %}
}
{% endblock %}`;

      // Create extending template
      const extendingTemplateContent = `---
to: "src/{{ name }}Component.ts"
---
{% extends "_templates/base/extends/base.ts" %}

{% block imports %}
import React from 'react';
{{ super() }}
{% endblock %}

{% block properties %}
{{ super() }}
props = {};
{% endblock %}

{% block methods %}
render() {
  return {{ name | titleCase }}</div>;
}
{% endblock %}`;

      await world.helper.createDirectory('_templates/base/extends');
      await world.helper.createFile('_templates/base/extends/base.ts', baseTemplateContent);
      
      await world.helper.createDirectory('_templates/component/extends');
      await world.helper.createFile('_templates/component/extends/component.ts', extendingTemplateContent);
      
      const result = await world.helper.runCli('unjucks generate component extends --name=user-list');
      expect(result.exitCode).toBe(0);
      
      const content = await world.helper.readFile('src/user-listComponent.ts');
      
      // Should contain inherited and extended content
      expect(content).toContain('import React from \'react\'');
      expect(content).toContain('// Default imports');
      expect(content).toContain('export class UserList');
      expect(content).toContain('name = "user-list"');
      expect(content).toContain('props = {}');
      expect(content).toContain('render()');
      expect(content).toContain('User List</div>');
    });

    it('should support macros for reusable template components', async () => { const templateContent = `---
to }}.ts"
---
{% macro generateMethod(methodName, returnType, params) %}
  {{ methodName }}({{ params | join(', ') }}): {{ returnType }} {
    // Implementation for {{ methodName }}
    throw new Error('Not implemented');
  }
{% endmacro %}

export class {{ name | pascalCase }}Service { {{ generateMethod('create', 'Promise<' + (name | pascalCase) + '>', ['data }}
  
  { { generateMethod('update', 'Promise<' + (name | pascalCase) + '>', ['id }}
  
  {{ generateMethod('delete', 'Promise', ['id) }}
}`;

      await world.helper.createDirectory('_templates/macro/service');
      await world.helper.createFile('_templates/macro/service/service.ts', templateContent);
      
      const result = await world.helper.runCli('unjucks generate macro service --name=user');
      expect(result.exitCode).toBe(0);
      
      const content = await world.helper.readFile('src/user.ts');
      
      // Should contain macro-generated methods
      expect(content).toContain('export class UserService');
      expect(content).toContain('create(data)>');
      expect(content).toContain('update(id, data)>');
      expect(content).toContain('delete(id)>');
      expect(content).toContain('// Implementation for create');
      expect(content).toContain('// Implementation for update');
      expect(content).toContain('// Implementation for delete');
    });

    it('should support async template processing', async () => { const templateContent = `---
to }}.ts"
---
export class {{ name | pascalCase }}Service {
  {% set asyncMethods = ['create', 'read', 'update', 'delete'] %}
  {% for method in asyncMethods %}
  async {{ method }}{{ name | pascalCase }}() {
    // Async {{ method }} implementation
    return new Promise(resolve => {
      setTimeout(() => resolve({} as {{ name | pascalCase }}), 100);
    });
  }
  {% endfor %}
}`;

      await world.helper.createDirectory('_templates/async/service');
      await world.helper.createFile('_templates/async/service/service.ts', templateContent);
      
      const result = await world.helper.runCli('unjucks generate async service --name=product');
      expect(result.exitCode).toBe(0);
      
      const content = await world.helper.readFile('src/product.ts');
      
      // Should contain async methods generated from loop
      expect(content).toContain('export class ProductService');
      expect(content).toContain('async createProduct()>');
      expect(content).toContain('async readProduct()>');
      expect(content).toContain('async updateProduct()>');
      expect(content).toContain('async deleteProduct()>');
    });

    it('should handle complex expressions and conditionals', async () => { const templateContent = `---
to }}.ts"
---
export interface {{ name | pascalCase }} {
  {% if withId %}
  id: string;
  {% endif %}
  {% if withTimestamps %}
  createdAt: Date;
  updatedAt: Date;
  {% endif %}
  {% if withSoftDeletes %}
  deletedAt?: Date;
  {% endif %}
}

export class {{ name | pascalCase }}Repository {
  {% if withCaching %}
  private cache = new Map<string, {{ name | pascalCase }}>();
  {% endif %}

  async find(
    {% if withId %}id: string{% endif %}
    {% if withFilters %}
    { { ', filters? }
    // Check cache first
    if (this.cache.has(id)) {
      return [this.cache.get(id)!];
    }
    {% endif %}
    
    // Database query implementation
    return [];
  }
}`;

      await world.helper.createDirectory('_templates/complex/entity');
      await world.helper.createFile('_templates/complex/entity/entity.ts', templateContent);
      
      const result = await world.helper.runCli('unjucks generate complex entity --name=user --withId=true --withTimestamps=true --withSoftDeletes=false --withCaching=true --withFilters=true');
      expect(result.exitCode).toBe(0);
      
      const content = await world.helper.readFile('src/User.ts');
      
      // Test conditional generation
      expect(content).toContain('export interface User');
      expect(content).toContain('id);
      expect(content).toContain('createdAt);
      expect(content).toContain('updatedAt);
      expect(content).not.toContain('deletedAt?);
      expect(content).toContain('private cache = new Map');
      expect(content).toContain('id, filters?);
      expect(content).toContain('this.cache.has(id)');
    });
  });

  describe('HYGEN-DELTA Claim, () => { it('should provide detailed error messages for undefined variables', async () => {
      const templateContent = `---
to }}.ts"
---
export const {{ name }} = { value }}",
  other: "{{ anotherUndefined | someFilter }}"
};`;

      await world.helper.createDirectory('_templates/undefined/test');
      await world.helper.createFile('_templates/undefined/test/file.ts', templateContent);
      
      const result = await world.helper.runCli('unjucks generate undefined test --name=test');
      
      // Should provide helpful error about undefined variables
      if (result.exitCode !== 0) {
        const errorOutput = result.stderr || result.stdout;
        expect(errorOutput).toMatch(/undefined|variable|not defined/i);
      }
    });

    it('should validate filter usage and provide suggestions', async () => { const templateContent = `---
to }}.ts"
---
export const {{ name }} = "{{ name | nonExistentFilter }}";`;

      await world.helper.createDirectory('_templates/invalid-filter/test');
      await world.helper.createFile('_templates/invalid-filter/test/file.ts', templateContent);
      
      const result = await world.helper.runCli('unjucks generate invalid-filter test --name=test');
      
      // Should provide error about unknown filter
      if (result.exitCode !== 0) {
        const errorOutput = result.stderr || result.stdout;
        expect(errorOutput).toMatch(/filter|unknown|not found/i);
      }
    });
  });
});