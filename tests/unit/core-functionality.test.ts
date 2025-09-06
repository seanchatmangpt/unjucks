import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { Generator } from '../../src/lib/generator.js';
import { FileInjector } from '../../src/lib/file-injector.js';
import { FrontmatterParser } from '../../src/lib/frontmatter-parser.js';

describe('Core Functionality Unit Tests - Real Operations', () => {
  let tempDir: string;
  let generator: Generator;
  let fileInjector: FileInjector;
  let frontmatterParser: FrontmatterParser;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unjucks-unit-test-'));
    process.chdir(tempDir);
    
    // Initialize components with real temp directory
    generator = new Generator(path.join(tempDir, '_templates'));
    fileInjector = new FileInjector();
    frontmatterParser = new FrontmatterParser();

    // Create test template structure
    await setupTestTemplates();
  });

  afterEach(async () => {
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  async function setupTestTemplates() {
    // Basic component template
    await fs.ensureDir('_templates/component/basic');
    await fs.writeFile(
      '_templates/component/basic/component.ts.njk',
      `---\nto: src/{{ name | kebabCase }}/{{ name | pascalCase }}.ts\n---\nexport class {{ name | pascalCase }} {\n  constructor(public name: string = '{{ name }}') {}\n\n  greet(): string {\n    return \`Hello, \${this.name}!\`;\n  }\n}\n`
    );

    // Template with variables for scanning
    await fs.writeFile(
      '_templates/component/basic/with-vars.njk',
      `---\nto: src/{{ outputDir }}/{{ name }}.{{ fileExtension }}\n---\n{{ content }}\n\n// Generated with: {{ generatorName }}\n// Version: {{ version }}\n// Author: {{ author }}\n// Timestamp: {{ timestamp }}\n`
    );

    // Injection test templates
    await fs.ensureDir('_templates/inject/test');
    await fs.writeFile(
      '_templates/inject/test/append.js',
      `---\nto: target.js\nappend: true\n---\n\n// This content should be appended\nconst appendedVar = 'appended';\n`
    );

    await fs.writeFile(
      '_templates/inject/test/inject-after.js',
      `---\nto: target.js\ninject: true\nafter: "// MARKER_AFTER"\n---\n// Injected after marker\nconst afterInjection = true;\n`
    );

    await fs.writeFile(
      '_templates/inject/test/conditional.js',
      `---\nto: conditional.js\nskipIf: "{{ shouldSkip === true }}"\n---\nconst shouldGenerate = true;\n`
    );

    // Complex frontmatter template
    await fs.writeFile(
      '_templates/complex/advanced/config.yaml',
      `---\nto: config/{{ environment }}.yaml\nchmod: "644"\nsh: ["echo 'Config generated'"]\nskipIf: "{{ environment === 'test' && !generateTestConfig }}"\n---\nenvironment: {{ environment }}\ndebug: {{ debug || false }}\nport: {{ port || 3000 }}\n{% if features %}\nfeatures:\n{% for feature in features %}  - {{ feature }}\n{% endfor %}\n{% endif %}\n`
    );
  }

  describe('Generator Class', () => {
    it('should find templates directory correctly', () => {
      const templatesDir = generator.getTemplatesDirectory();
      expect(templatesDir).toBe(path.join(tempDir, '_templates'));
    });

    it('should list generators correctly', async () => {
      const generators = await generator.listGenerators();
      
      expect(generators.length).toBeGreaterThan(0);
      const generatorNames = generators.map(g => g.name);
      expect(generatorNames).toContain('component');
      expect(generatorNames).toContain('inject');
      expect(generatorNames).toContain('complex');
    });

    it('should list templates for a specific generator', async () => {
      const templates = await generator.listTemplates('component');
      
      expect(templates.length).toBeGreaterThan(0);
      const templateNames = templates.map(t => t.name);
      expect(templateNames).toContain('basic');
    });

    it('should scan template variables correctly', async () => {
      const { variables, cliArgs } = await generator.scanTemplateForVariables('component', 'basic');
      
      expect(variables.length).toBeGreaterThan(0);
      const variableNames = variables.map(v => v.name);
      expect(variableNames).toContain('name');
      
      expect(cliArgs).toHaveProperty('name');
    });

    it('should generate files with correct content and filters', async () => {
      const result = await generator.generate({
        generator: 'component',
        template: 'basic',
        dest: tempDir,
        force: false,
        dry: false,
        variables: {
          name: 'UserService'
        }
      });

      expect(result.files.length).toBe(1);
      const file = result.files[0];
      
      expect(file.path).toContain('user-service');
      expect(file.path).toContain('UserService.ts');
      
      expect(file.content).toContain('export class UserService');
      expect(file.content).toContain('constructor(public name: string = \'UserService\')');
      expect(file.content).toContain('Hello, ${this.name}!');

      // Verify file was actually written
      expect(await fs.pathExists(file.path)).toBe(true);
      const writtenContent = await fs.readFile(file.path, 'utf-8');
      expect(writtenContent).toBe(file.content);
    });

    it('should handle template not found error', async () => {
      await expect(generator.scanTemplateForVariables('component', 'nonexistent'))
        .rejects.toThrow(/Template 'nonexistent' not found/);
    });

    it('should handle generator not found error', async () => {
      await expect(generator.scanTemplateForVariables('nonexistent', 'template'))
        .rejects.toThrow(/Generator 'nonexistent' not found/);
    });

    it('should apply all Nunjucks filters correctly', async () => {
      const result = await generator.generate({
        generator: 'component',
        template: 'basic',
        dest: tempDir,
        force: false,
        dry: false,
        variables: {
          name: 'user profile manager'
        }
      });

      const file = result.files[0];
      
      // Test filters
      expect(file.path).toContain('user-profile-manager'); // kebabCase
      expect(file.content).toContain('UserProfileManager'); // pascalCase
    });
  });

  describe('FileInjector Class', () => {
    let targetFile: string;

    beforeEach(async () => {
      targetFile = path.join(tempDir, 'target.js');
      await fs.writeFile(targetFile, `// Target file\nconst original = true;\n\n// MARKER_AFTER\nconst afterMarker = false;\n\n// End of file\n`);
    });

    it('should write new files correctly', async () => {
      const result = await fileInjector.processFile(
        path.join(tempDir, 'new-file.js'),
        'const newFile = true;',
        {},
        { force: false, dry: false }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('File written');
      expect(await fs.pathExists(path.join(tempDir, 'new-file.js'))).toBe(true);
      
      const content = await fs.readFile(path.join(tempDir, 'new-file.js'), 'utf-8');
      expect(content).toBe('const newFile = true;');
    });

    it('should refuse to overwrite without force flag', async () => {
      const result = await fileInjector.processFile(
        targetFile,
        'const overwrite = true;',
        {},
        { force: false, dry: false }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
      expect(result.message).toContain('Use --force');
    });

    it('should overwrite with force flag', async () => {
      const result = await fileInjector.processFile(
        targetFile,
        'const overwrite = true;',
        {},
        { force: true, dry: false }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('File written');
      
      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toBe('const overwrite = true;');
    });

    it('should inject content after marker', async () => {
      const result = await fileInjector.processFile(
        targetFile,
        '// Injected content\nconst injected = true;',
        { inject: true, after: '// MARKER_AFTER' },
        { force: false, dry: false }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Content injected');
      
      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toContain('// MARKER_AFTER');
      expect(content).toContain('// Injected content');
      
      // Verify order
      const markerIndex = content.indexOf('// MARKER_AFTER');
      const injectedIndex = content.indexOf('// Injected content');
      expect(injectedIndex).toBeGreaterThan(markerIndex);
    });

    it('should append content to file', async () => {
      const result = await fileInjector.processFile(
        targetFile,
        '// Appended content\nconst appended = true;',
        { append: true },
        { force: false, dry: false }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Content appended');
      
      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toContain('// Appended content');
      expect(content.endsWith('const appended = true;\n')).toBe(true);
    });

    it('should prepend content to file', async () => {
      const result = await fileInjector.processFile(
        targetFile,
        '// Prepended content\nconst prepended = true;\n',
        { prepend: true },
        { force: false, dry: false }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Content prepended');
      
      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toContain('// Prepended content');
      expect(content.startsWith('// Prepended content')).toBe(true);
    });

    it('should inject at specific line number', async () => {
      const result = await fileInjector.processFile(
        targetFile,
        '// Line injection\nconst atLine = true;',
        { lineAt: 3 },
        { force: false, dry: false }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('injected at line 3');
      
      const content = await fs.readFile(targetFile, 'utf-8');
      const lines = content.split('\n');
      expect(lines[2]).toContain('// Line injection');
    });

    it('should be idempotent for injections', async () => {
      // First injection
      const result1 = await fileInjector.processFile(
        targetFile,
        '// Idempotent content\nconst idempotent = true;',
        { append: true },
        { force: false, dry: false }
      );

      expect(result1.success).toBe(true);
      
      const contentAfterFirst = await fs.readFile(targetFile, 'utf-8');
      
      // Second injection (should be skipped)
      const result2 = await fileInjector.processFile(
        targetFile,
        '// Idempotent content\nconst idempotent = true;',
        { append: true },
        { force: false, dry: false }
      );

      expect(result2.success).toBe(true);
      expect(result2.skipped).toBe(true);
      expect(result2.message).toContain('already at end');
      
      const contentAfterSecond = await fs.readFile(targetFile, 'utf-8');
      expect(contentAfterSecond).toBe(contentAfterFirst);
    });

    it('should set file permissions correctly', async () => {
      const testFile = path.join(tempDir, 'test-chmod.sh');
      await fs.writeFile(testFile, '#!/bin/bash\necho "test"\n');
      
      const success = await fileInjector.setPermissions(testFile, '755');
      expect(success).toBe(true);
      
      const stats = await fs.stat(testFile);
      const permissions = (stats.mode & parseInt('777', 8)).toString(8);
      expect(permissions).toBe('755');
    });

    it('should validate chmod permissions', async () => {
      const testFile = path.join(tempDir, 'test-invalid-chmod.sh');
      await fs.writeFile(testFile, 'test');
      
      const success = await fileInjector.setPermissions(testFile, '999'); // Invalid
      expect(success).toBe(false);
    });

    it('should execute shell commands', async () => {
      const result = await fileInjector.executeCommands([
        'echo "Hello World"',
        'echo "Second Command"'
      ], tempDir);

      expect(result.success).toBe(true);
      expect(result.outputs).toContain('Hello World');
      expect(result.outputs).toContain('Second Command');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle command execution failures', async () => {
      const result = await fileInjector.executeCommands([
        'nonexistent-command-that-will-fail'
      ], tempDir);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Command failed');
    });

    it('should work in dry run mode', async () => {
      const result = await fileInjector.processFile(
        path.join(tempDir, 'dry-run-test.js'),
        'const dryRun = true;',
        {},
        { force: false, dry: true }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Would write file');
      
      // File should not be created
      expect(await fs.pathExists(path.join(tempDir, 'dry-run-test.js'))).toBe(false);
    });
  });

  describe('FrontmatterParser Class', () => {
    it('should parse simple frontmatter correctly', () => {
      const content = `---\nto: output.js\n---\nconst content = true;`;
      const result = frontmatterParser.parse(content);
      
      expect(result.frontmatter.to).toBe('output.js');
      expect(result.content).toBe('const content = true;');
    });

    it('should parse complex frontmatter with multiple fields', () => {
      const content = `---\nto: output.js\ninject: true\nafter: "marker"\nchmod: "755"\nsh: ["echo test"]\nskipIf: "{{ skip === true }}"\n---\ncontent here`;
      const result = frontmatterParser.parse(content);
      
      expect(result.frontmatter.to).toBe('output.js');
      expect(result.frontmatter.inject).toBe(true);
      expect(result.frontmatter.after).toBe('marker');
      expect(result.frontmatter.chmod).toBe('755');
      expect(result.frontmatter.sh).toEqual(['echo test']);
      expect(result.frontmatter.skipIf).toBe('{{ skip === true }}');
      expect(result.content).toBe('content here');
    });

    it('should handle templates without frontmatter', () => {
      const content = 'just content, no frontmatter';
      const result = frontmatterParser.parse(content);
      
      expect(result.frontmatter).toEqual({});
      expect(result.content).toBe('just content, no frontmatter');
    });

    it('should validate frontmatter correctly', () => {
      const validFrontmatter = {
        to: 'output.js',
        inject: true,
        after: 'marker'
      };
      
      const validation = frontmatterParser.validate(validFrontmatter);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect frontmatter validation errors', () => {
      const invalidFrontmatter = {
        inject: true,
        append: true // Conflicting directives
      };
      
      const validation = frontmatterParser.validate(invalidFrontmatter);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should evaluate skipIf conditions correctly', () => {
      // True condition - should skip
      const shouldSkip1 = frontmatterParser.shouldSkip(
        { skipIf: '{{ skip === true }}' },
        { skip: true }
      );
      expect(shouldSkip1).toBe(true);
      
      // False condition - should not skip
      const shouldSkip2 = frontmatterParser.shouldSkip(
        { skipIf: '{{ skip === true }}' },
        { skip: false }
      );
      expect(shouldSkip2).toBe(false);
      
      // No skipIf - should not skip
      const shouldSkip3 = frontmatterParser.shouldSkip(
        { to: 'output.js' },
        { skip: true }
      );
      expect(shouldSkip3).toBe(false);
    });

    it('should handle complex skipIf expressions', () => {
      // Complex boolean expression
      const shouldSkip1 = frontmatterParser.shouldSkip(
        { skipIf: '{{ environment === "test" && !includeTests }}' },
        { environment: 'test', includeTests: false }
      );
      expect(shouldSkip1).toBe(true);
      
      const shouldSkip2 = frontmatterParser.shouldSkip(
        { skipIf: '{{ environment === "test" && !includeTests }}' },
        { environment: 'production', includeTests: false }
      );
      expect(shouldSkip2).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should complete full template generation workflow', async () => {
      // Generate a file with complex frontmatter
      const result = await generator.generate({
        generator: 'complex',
        template: 'advanced',
        dest: tempDir,
        force: false,
        dry: false,
        variables: {
          environment: 'production',
          debug: true,
          port: 8080,
          features: ['logging', 'metrics', 'auth']
        }
      });

      expect(result.files.length).toBe(1);
      const file = result.files[0];
      
      expect(file.path).toContain('config/production.yaml');
      expect(file.content).toContain('environment: production');
      expect(file.content).toContain('debug: true');
      expect(file.content).toContain('port: 8080');
      expect(file.content).toContain('- logging');
      expect(file.content).toContain('- metrics');
      expect(file.content).toContain('- auth');
      
      // Verify file permissions were set
      expect(await fs.pathExists(file.path)).toBe(true);
      const stats = await fs.stat(file.path);
      const permissions = (stats.mode & parseInt('777', 8)).toString(8);
      expect(permissions).toBe('644');
    });

    it('should handle skipIf conditions during generation', async () => {
      // Should skip generation
      const result1 = await generator.generate({
        generator: 'complex',
        template: 'advanced',
        dest: tempDir,
        force: false,
        dry: false,
        variables: {
          environment: 'test',
          generateTestConfig: false
        }
      });

      expect(result1.files).toHaveLength(0);
      
      // Should not skip generation
      const result2 = await generator.generate({
        generator: 'complex',
        template: 'advanced',
        dest: tempDir,
        force: false,
        dry: false,
        variables: {
          environment: 'test',
          generateTestConfig: true
        }
      });

      expect(result2.files.length).toBe(1);
      expect(await fs.pathExists(result2.files[0].path)).toBe(true);
    });

    it('should work with injection-based templates', async () => {
      // Create target file for injection
      const targetPath = path.join(tempDir, 'target.js');
      await fs.writeFile(targetPath, '// Original file\nconst original = true;\n');
      
      // Generate injection
      const result = await generator.generate({
        generator: 'inject',
        template: 'test',
        dest: tempDir,
        force: false,
        dry: false,
        variables: {}
      });

      expect(result.files.length).toBe(1);
      
      const content = await fs.readFile(targetPath, 'utf-8');
      expect(content).toContain('// Original file');
      expect(content).toContain('// This content should be appended');
      expect(content).toContain('const appendedVar = \'appended\';');
    });

    it('should handle errors gracefully during generation', async () => {
      // Try to inject into non-existent file
      await expect(generator.generate({
        generator: 'inject',
        template: 'test',
        dest: tempDir,
        force: false,
        dry: false,
        variables: {}
      })).rejects.toThrow();
    });
  });
});
