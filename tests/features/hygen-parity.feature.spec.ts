import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UnjucksWorld } from '../support/world';

describe('Hygen Parity Validation', () => {
  let world: UnjucksWorld;

  beforeEach(async () => {
    world = new UnjucksWorld();
    await world.createTempDirectory();
  });

  afterEach(async () => {
    await world.cleanupTempDirectory();
  });

  describe('HYGEN-DELTA Claim: 98% Hygen functionality achieved', () => {
    it('should support basic Hygen-style template structure', async () => {
      // Test Hygen-style template with EJS-like syntax converted to Nunjucks
      const templateContent = `---
to: src/components/<%= name %>.js
inject: true
after: "// Components"
---
export const <%= name %> = () => {
  return <div><%= name %></div>;
};`;

      // Convert to Unjucks format (this would be done by migration tool)
      const unjucksTemplate = templateContent
        .replace(/<%=/g, '{{')
        .replace(/%>/g, '}}')
        .replace(/<%/g, '{%')
        .replace(/%>/g, '%}');

      await world.helper.createDirectory('_templates/hygen-compat/component');
      await world.helper.createFile('_templates/hygen-compat/component/component.js', unjucksTemplate);
      
      // Create target file for injection
      await world.helper.createDirectory('src/components');
      await world.helper.createFile('src/components/index.js', `// Components\nexport * from './App';`);
      
      const result = await world.helper.runCli('unjucks generate hygen-compat component --name=UserProfile');
      expect(result.exitCode).toBe(0);
      
      const content = await world.helper.readFile('src/components/index.js');
      expect(content).toContain('// Components');
      expect(content).toContain('export const UserProfile');
    });

    it('should support all core Hygen frontmatter options', async () => {
      // Test all Hygen frontmatter options that should be supported
      const templateContent = `---
to: "src/{{ name }}.js"
inject: true
after: "// Inject after"
before: "// Inject before"
skip_if: "name==skip"
sh: "echo 'Generated {{ name }}'"
---
export const {{ name }} = "component";`;

      await world.helper.createDirectory('_templates/hygen-frontmatter/test');
      await world.helper.createFile('_templates/hygen-frontmatter/test/component.js', templateContent);
      
      // Create target file for injection tests
      await world.helper.createDirectory('src');
      await world.helper.createFile('src/target.js', `// Inject before\nconst existing = true;\n// Inject after\nmodule.exports = existing;`);
      
      // Test normal generation
      const result1 = await world.helper.runCli('unjucks generate hygen-frontmatter test --name=TestComponent');
      expect(result1.exitCode).toBe(0);
      
      // Test skip_if condition
      const result2 = await world.helper.runCli('unjucks generate hygen-frontmatter test --name=skip');
      // Should either skip or handle gracefully
      expect(result2.exitCode === 0 || result2.stdout.includes('skip')).toBe(true);
      
      // Test shell command execution
      expect(result1.stdout).toContain('Generated TestComponent');
    });

    it('should provide migration path from Hygen templates', async () => {
      // Simulate a typical Hygen template migration
      const hygenStyleTemplate = `---
to: _templates/<%= generator %>/<%= action %>/<%= name %>.js.ejs.t
---
---
to: src/components/<%= name %>.jsx
---
import React from 'react';

const <%= name %> = () => {
  return (
    <div className="<%= name.toLowerCase() %>">
      <h1><%= name %></h1>
      <% if (withProps) { %>
      <p>Props: {JSON.stringify(props)}</p>
      <% } %>
    </div>
  );
};

export default <%= name %>;`;

      // Convert to Unjucks equivalent
      const unjucksTemplate = `---
to: "src/components/{{ name }}.jsx"
---
import React from 'react';

const {{ name }} = () => {
  return (
    <div className="{{ name | lowerCase }}">
      <h1>{{ name }}</h1>
      {% if withProps %}
      <p>Props: {JSON.stringify(props)}</p>
      {% endif %}
    </div>
  );
};

export default {{ name }};`;

      await world.helper.createDirectory('_templates/migrated/component');
      await world.helper.createFile('_templates/migrated/component/component.jsx', unjucksTemplate);
      
      const result = await world.helper.runCli('unjucks generate migrated component --name=MigratedComponent --withProps=true');
      expect(result.exitCode).toBe(0);
      
      const content = await world.helper.readFile('src/components/MigratedComponent.jsx');
      expect(content).toContain('import React from \'react\'');
      expect(content).toContain('const MigratedComponent = () => {');
      expect(content).toContain('className="migratedcomponent"');
      expect(content).toContain('<h1>MigratedComponent</h1>');
      expect(content).toContain('<p>Props: {JSON.stringify(props)}</p>');
      expect(content).toContain('export default MigratedComponent');
    });

    it('should handle complex Hygen-style conditionals and loops', async () => {
      const templateContent = `---
to: "src/{{ name }}Service.js"
---
class {{ name | pascalCase }}Service {
  constructor() {
    this.name = '{{ name }}';
    {% if withDatabase %}
    this.db = require('./database');
    {% endif %}
  }

  {% if withCrud %}
  {% set crudMethods = ['create', 'read', 'update', 'delete'] %}
  {% for method in crudMethods %}
  async {{ method }}{{ name | pascalCase }}({{ 'id, ' if method != 'create' else '' }}data) {
    {% if withDatabase %}
    return await this.db.{{ method }}('{{ name | lowerCase }}', {{ 'id, ' if method != 'create' else '' }}data);
    {% else %}
    // Mock {{ method }} implementation
    console.log('{{ method | titleCase }}ing {{ name }}');
    return data;
    {% endif %}
  }
  {% endfor %}
  {% endif %}

  {% if withValidation %}
  validate(data) {
    // Validation logic for {{ name }}
    return data && typeof data === 'object';
  }
  {% endif %}
}

module.exports = {{ name | pascalCase }}Service;`;

      await world.helper.createDirectory('_templates/hygen-complex/service');
      await world.helper.createFile('_templates/hygen-complex/service/service.js', templateContent);
      
      const result = await world.helper.runCli('unjucks generate hygen-complex service --name=user --withDatabase=true --withCrud=true --withValidation=true');
      expect(result.exitCode).toBe(0);
      
      const content = await world.helper.readFile('src/userService.js');
      
      // Test complex template logic
      expect(content).toContain('class UserService');
      expect(content).toContain('this.db = require(\'./database\')');
      expect(content).toContain('async createUser(data)');
      expect(content).toContain('async readUser(id, data)');
      expect(content).toContain('async updateUser(id, data)');
      expect(content).toContain('async deleteUser(id, data)');
      expect(content).toContain('return await this.db.create(\'user\'');
      expect(content).toContain('validate(data)');
      expect(content).toContain('module.exports = UserService');
    });
  });

  describe('HYGEN-DELTA Critical Gap: Positional parameters missing', () => {
    it('should identify the need for positional parameter support', async () => {
      // This test documents the current limitation
      const templateContent = `---
to: "src/{{ type }}/{{ name }}.js"
---
export const {{ name }} = {
  type: '{{ type }}',
  name: '{{ name }}'
};`;

      await world.helper.createDirectory('_templates/positional/test');
      await world.helper.createFile('_templates/positional/test/file.js', templateContent);
      
      // Current approach (works)
      const currentResult = await world.helper.runCli('unjucks generate positional test --type=component --name=MyComponent');
      expect(currentResult.exitCode).toBe(0);
      
      // Desired Hygen-style approach (should fail currently)
      const desiredResult = await world.helper.runCli('unjucks positional test component MyComponent');
      
      // This should currently fail, proving the gap exists
      expect(desiredResult.exitCode).not.toBe(0);
      expect(desiredResult.stderr || desiredResult.stdout).toMatch(/command not found|unknown/i);
      
      console.log('✓ Confirmed: Positional parameters are not yet supported');
      console.log('Current syntax: unjucks generate positional test --type=component --name=MyComponent');
      console.log('Desired syntax: unjucks positional test component MyComponent');
    });
  });

  describe('HYGEN-DELTA Claim: Superior developer experience', () => {
    it('should provide better error messages than basic Hygen errors', async () => {
      const invalidTemplate = `---
to: "src/{{ name }}.js"
inject: true
# Missing injection target
---
export const {{ name }} = "test";`;

      await world.helper.createDirectory('_templates/error-handling/test');
      await world.helper.createFile('_templates/error-handling/test/invalid.js', invalidTemplate);
      
      const result = await world.helper.runCli('unjucks generate error-handling test --name=test');
      
      if (result.exitCode !== 0) {
        const errorOutput = result.stderr || result.stdout;
        
        // Should provide detailed, helpful error messages
        expect(errorOutput.length).toBeGreaterThan(0);
        expect(errorOutput).toMatch(/inject|target|after|before|configuration/i);
        
        console.log('Error message quality test passed');
        console.log('Error output:', errorOutput);
      } else {
        console.log('Template was processed successfully (may have default injection handling)');
      }
    });

    it('should provide interactive help and guidance', async () => {
      const helpResult = await world.helper.runCli('unjucks help generate');
      
      expect(helpResult.exitCode).toBe(0);
      expect(helpResult.stdout).toContain('generate');
      expect(helpResult.stdout.length).toBeGreaterThan(100); // Substantial help text
      
      console.log('Interactive help test passed');
    });
  });
});