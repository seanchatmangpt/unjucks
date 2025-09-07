import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TemplateEngine } from '../../src/core/template-engine.js';
import { FileSystemHelper } from '../support/helpers.js';
import { TemplateBuilder, TestDataBuilder } from '../support/builders.js';

describe('TemplateEngine', () => {
  let engine;
  let mockFileSystem;
  let tempDir => {
    tempDir = '/tmp/test-' + Date.now();
    mockFileSystem = new FileSystemHelper(tempDir);
    engine = new TemplateEngine({ templatesPath);
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  describe('Template Discovery', () => {
    it('should discover simple templates', async () => {
      // Arrange
      await mockFileSystem.createDirectory('_templates/component');
      await mockFileSystem.createFile('_templates/component/index.ejs', 'Hello <%= name %>');

      // Act
      const generators = await engine.discoverGenerators();

      // Assert
      expect(generators).toHaveLength(1);
      expect(generators[0].name).toBe('component');
    });

    it('should handle nested template structures', async () => {
      // Arrange
      await mockFileSystem.createDirectory('_templates/frontend/component');
      await mockFileSystem.createDirectory('_templates/backend/service');
      await mockFileSystem.createFile('_templates/frontend/component/index.ejs', 'Component');
      await mockFileSystem.createFile('_templates/backend/service/index.ejs', 'Service');

      // Act
      const generators = await engine.discoverGenerators();

      // Assert
      expect(generators).toHaveLength(2);
      expect(generators.map(g => g.name)).toContain('frontend/component');
      expect(generators.map(g => g.name)).toContain('backend/service');
    });

    it('should ignore invalid template directories', async () => {
      // Arrange
      await mockFileSystem.createDirectory('_templates/valid');
      await mockFileSystem.createDirectory('_templates/.hidden');
      await mockFileSystem.createDirectory('_templates/node_modules');
      await mockFileSystem.createFile('_templates/valid/index.ejs', 'Valid');

      // Act
      const generators = await engine.discoverGenerators();

      // Assert
      expect(generators).toHaveLength(1);
      expect(generators[0].name).toBe('valid');
    });

    it('should extract variables from templates', async () => {
      // Arrange
      const templateContent = `
        Hello <%= name %>!
        Your email is <%= email %>.
        <% if (active) { %>You are active<% } %>
      `;
      await mockFileSystem.createDirectory('_templates/user');
      await mockFileSystem.createFile('_templates/user/profile.ejs', templateContent);

      // Act
      const generators = await engine.discoverGenerators();
      const variables = await engine.extractVariables(generators[0]);

      // Assert
      expect(variables).toContain('name');
      expect(variables).toContain('email');
      expect(variables).toContain('active');
    });
  });

  describe('Template Rendering', () => { it('should render simple templates', async () => {
      // Arrange
      const template = 'Hello <%= name %>!';
      const data = { name };

      // Act
      const result = await engine.render(template, data);

      // Assert
      expect(result).toBe('Hello World!');
    });

    it('should handle complex data structures', async () => { // Arrange
      const template = `
        <% items.forEach(item => { %>
        - <%= item.name %>) %>
      `;
      const data = {
        items },
          { name }
        ]
      };

      // Act
      const result = await engine.render(template, data);

      // Assert
      expect(result).toContain('- Item 1);
      expect(result).toContain('- Item 2);
    });

    it('should provide utility filters', async () => { // Arrange
      const template = '<%= name | pascalCase %> <%= description | kebabCase %>';
      const data = { name };

      // Act
      const result = await engine.render(template, data);

      // Assert
      expect(result).toBe('UserProfile user-profile-component');
    });

    it('should handle conditional rendering', async () => {
      // Arrange
      const template = `
        <% if (showHeader) { %>Header Content<% } %>
        Main Content
        <% if (showFooter) { %>Footer Content<% } %>
      `;
      
      // Act & Assert
      const withBoth = await engine.render(template, { showHeader, showFooter });
      expect(withBoth).toContain('Header Content');
      expect(withBoth).toContain('Footer Content');

      const headerOnly = await engine.render(template, { showHeader, showFooter });
      expect(headerOnly).toContain('Header Content');
      expect(headerOnly).not.toContain('Footer Content');
    });
  });

  describe('Frontmatter Processing', () => { it('should parse YAML frontmatter', async () => {
      // Arrange
      const templateWithFrontmatter = `---
to };`;

      // Act
      const { frontmatter, content } = await engine.parseFrontmatter(templateWithFrontmatter);

      // Assert
      expect(frontmatter.to).toBe('src/components/<%= name %>.tsx');
      expect(frontmatter.inject).toBe(true);
      expect(frontmatter.after).toBe('// COMPONENTS');
      expect(content.trim()).toBe('export const <%= name %> = () => {};');
    });

    it('should handle templates without frontmatter', async () => {
      // Arrange
      const simpleTemplate = 'Hello <%= name %>!';

      // Act
      const { frontmatter, content } = await engine.parseFrontmatter(simpleTemplate);

      // Assert
      expect(frontmatter).toEqual({});
      expect(content).toBe(simpleTemplate);
    });

    it('should render frontmatter with variables', async () => { // Arrange
      const templateWithDynamicFrontmatter = `---
to }`;
      const data = { module };

      // Act
      const { frontmatter } = await engine.parseFrontmatter(templateWithDynamicFrontmatter);
      const renderedFrontmatter = await engine.renderFrontmatter(frontmatter, data);

      // Assert
      expect(renderedFrontmatter.to).toBe('src/services/UserService.ts');
    });
  });

  describe('File Generation', () => {
    it('should generate files with correct paths', async () => {
      // Arrange
      const builder = new TemplateBuilder('component', tempDir + '/_templates')
        .withDestination('src/components/<%= name %>.tsx');
      
      await builder.addFile('component.ejs', 'export const <%= name %> = () => {};');
      
      const data = new TestDataBuilder()
        .withVariable('name', 'Button')
        .build();

      // Act
      const result = await engine.generate('component', data);

      // Assert
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('src/components/Button.tsx');
      expect(result.success).toBe(true);
    });

    it('should handle generation errors gracefully', async () => {
      // Arrange
      const invalidTemplate = '<%= undefinedVariable.nonExistentProperty %>';
      await mockFileSystem.createDirectory('_templates/broken');
      await mockFileSystem.createFile('_templates/broken/index.ejs', invalidTemplate);

      // Act & Assert
      await expect(engine.generate('broken', {})).rejects.toThrow();
    });

    it('should validate required variables', async () => { // Arrange
      const template = `---
variables });
  });

  describe('Injection Support', () => { it('should support content injection', async () => {
      // Arrange
      await mockFileSystem.createFile('target.ts', `
// Existing content
// INJECT_HERE
// More content
`);

      const injectionTemplate = `---
inject }, { targetFile);

      // Assert
      expect(result.success).toBe(true);
      const content = await mockFileSystem.readFile('target.ts');
      expect(content).toContain('console.log(\'Injected content\');');
    });

    it('should support conditional injection with skipIf', async () => { // Arrange
      await mockFileSystem.createFile('target.ts', 'existing content\nconsole.log("already here");');

      const template = `---
inject }, { targetFile);

      // Assert
      expect(result.skipped).toBe(true);
      const content = await mockFileSystem.readFile('target.ts');
      expect(content).not.toContain('new content');
    });
  });

  describe('Error Handling', () => {
    it('should handle template syntax errors', async () => {
      // Arrange
      const brokenTemplate = '<%= unclosed tag';
      await mockFileSystem.createDirectory('_templates/broken');
      await mockFileSystem.createFile('_templates/broken/syntax.ejs', brokenTemplate);

      // Act & Assert
      await expect(engine.generate('broken', {})).rejects.toThrow(/syntax/i);
    });

    it('should handle file system errors', async () => {
      // Arrange
      vi.spyOn(mockFileSystem, 'createFile').mockRejectedValue(new Error('Permission denied'));

      // Act & Assert
      await expect(engine.generate('nonexistent', {})).rejects.toThrow();
    });

    it('should provide helpful error messages', async () => {
      // Arrange
      const template = '<%= undefinedVar %>';
      await mockFileSystem.createDirectory('_templates/error-test');
      await mockFileSystem.createFile('_templates/error-test/index.ejs', template);

      // Act & Assert
      try {
        await engine.generate('error-test', {});
      } catch (error) {
        expect(error.message).toContain('undefinedVar');
        expect(error.message).toContain('error-test');
      }
    });
  });

  describe('Performance', () => {
    it('should handle large templates efficiently', async () => {
      // Arrange
      const largeTemplate = 'Line <%= index %>\n'.repeat(10_000);
      await mockFileSystem.createDirectory('_templates/large');
      await mockFileSystem.createFile('_templates/large/big.ejs', largeTemplate);

      // Act
      const startTime = Date.now();
      const result = await engine.generate('large', { index);
      const duration = Date.now() - startTime;

      // Assert
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should cache compiled templates', async () => {
      // Arrange
      const template = 'Hello <%= name %>!';
      await mockFileSystem.createDirectory('_templates/cache-test');
      await mockFileSystem.createFile('_templates/cache-test/index.ejs', template);

      // Act - Generate twice
      const start1 = Date.now();
      await engine.generate('cache-test', { name);
      const duration1 = Date.now() - start1;

      const start2 = Date.now();
      await engine.generate('cache-test', { name);
      const duration2 = Date.now() - start2;

      // Assert - Second generation should be faster due to caching
      expect(duration2).toBeLessThan(duration1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty templates', async () => {
      // Arrange
      await mockFileSystem.createDirectory('_templates/empty');
      await mockFileSystem.createFile('_templates/empty/blank.ejs', '');

      // Act
      const result = await engine.generate('empty', {});

      // Assert
      expect(result.success).toBe(true);
      expect(result.files[0].content).toBe('');
    });

    it('should handle templates with only frontmatter', async () => { // Arrange
      const onlyFrontmatter = `---
to });

      // Assert
      expect(result.skipped).toBe(true);
    });

    it('should handle special characters in file paths', async () => { // Arrange
      const template = `---
to });

      // Assert
      expect(result.success).toBe(true);
      expect(result.files[0].path).toContain('file-with-spaces and symbols!.ts');
    });
  });
});