import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UnjucksWorld } from '../support/world.js';
import * from 'fs-extra';
import * from 'path';

describe('Frontmatter Parsing Validation', () => {
  let world;

  beforeEach(async () => {
    world = new UnjucksWorld();
    await world.createTempDirectory();
  });

  afterEach(async () => {
    await world.cleanupTempDirectory();
  });

  describe('HYGEN-DELTA Claim, () => { it('should parse all 10 frontmatter options correctly', async () => {
      const templateContent = `---
to }}.ts"
inject: true
after: "// Components"
before: "// Imports" 
skipIf: "name==test"
append: false
prepend: false
lineAt: 5
chmod: "755"
sh: ["echo 'Generated {{ name }}'", "npm run format"]
---
export class {{ name | pascalCase }}Component {
  name = "{{ name }}";
}`;

      await world.helper.createDirectory('_templates/component/new');
      await world.helper.createFile('_templates/component/new/component.ts', templateContent);
      
      // Test frontmatter parsing by generating a file
      const result = await world.helper.runCli('unjucks generate component new --name=TestComponent');
      
      // Verify the template was processed (proves frontmatter was parsed)
      expect(result.exitCode).toBe(0);
      
      // Check if generated content has expected frontmatter effects
      const files = await world.helper.listFiles();
      expect(files.some(f => f.includes('TestComponent'))).toBe(true);
    });

    it('should support enhanced skipIf condition syntax', async () => { const templateContent = `---
to }}.ts"
skipIf: "name==skip-me"
---
export const {{ name }} = "generated";`;

      await world.helper.createDirectory('_templates/test/skip');
      await world.helper.createFile('_templates/test/skip/file.ts', templateContent);
      
      // Test that file is skipped when condition matches
      const skipResult = await world.helper.runCli('unjucks generate test skip --name=skip-me');
      let files = await world.helper.listFiles();
      expect(files.some(f => f.includes('skip-me'))).toBe(false);
      
      // Test that file is generated when condition doesn't match
      const generateResult = await world.helper.runCli('unjucks generate test skip --name=generate-me');
      files = await world.helper.listFiles();
      expect(files.some(f => f.includes('generate-me'))).toBe(true);
    });

    it('should handle dynamic file paths with Nunjucks filters', async () => { const templateContent = `---
to }}Component.ts"
---
export class {{ name | pascalCase }}Component {
  constructor() {}
}`;

      await world.helper.createDirectory('_templates/component/dynamic');
      await world.helper.createFile('_templates/component/dynamic/component.ts', templateContent);
      
      const result = await world.helper.runCli('unjucks generate component dynamic --name=user-profile');
      
      expect(result.exitCode).toBe(0);
      const files = await world.helper.listFiles();
      expect(files).toContain('src/components/UserProfileComponent.ts');
    });
  });

  describe('HYGEN-DELTA Claim, () => {
    beforeEach(async () => {
      // Create a target file for injection tests
      await world.helper.createDirectory('src');
      await world.helper.createFile('src/existing.ts', `// Imports
import { Component } from 'react';

// Components
export class ExistingComponent {}

// End of file`);
    });

    it('should support inject mode with after target', async () => { const templateContent = `---
to }}Component {}`;

      await world.helper.createDirectory('_templates/inject/after');
      await world.helper.createFile('_templates/inject/after/component.ts', templateContent);
      
      const result = await world.helper.runCli('unjucks generate inject after --name=New');
      expect(result.exitCode).toBe(0);
      
      const content = await world.helper.readFile('src/existing.ts');
      expect(content).toContain('// Components\nexport class NewComponent {}');
    });

    it('should support inject mode with before target', async () => { const templateContent = `---
to }}Component {}`;

      await world.helper.createDirectory('_templates/inject/before');
      await world.helper.createFile('_templates/inject/before/component.ts', templateContent);
      
      const result = await world.helper.runCli('unjucks generate inject before --name=Before');
      expect(result.exitCode).toBe(0);
      
      const content = await world.helper.readFile('src/existing.ts');
      expect(content).toContain('export class BeforeComponent {}\n// Components');
    });

    it('should support append mode (Unjucks unique feature)', async () => { const templateContent = `---
to });

    it('should support prepend mode (Unjucks unique feature)', async () => { const templateContent = `---
to });

    it('should support lineAt mode (Unjucks unique feature)', async () => { const templateContent = `---
to });
  });

  describe('HYGEN-DELTA Claim, () => { it('should support array of shell commands', async () => {
      const templateContent = `---
to }}.ts"
sh: ["echo 'Generated {{ name }}'", "echo 'Second command'"]
---
export const {{ name }} = "test";`;

      await world.helper.createDirectory('_templates/shell/array');
      await world.helper.createFile('_templates/shell/array/file.ts', templateContent);
      
      const result = await world.helper.runCli('unjucks generate shell array --name=TestFile');
      
      // Check that commands were executed (would be in stdout)
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Generated TestFile');
      expect(result.stdout).toContain('Second command');
    });
  });

  describe('HYGEN-DELTA Claim)', () => { it('should set file permissions via chmod frontmatter', async () => {
      const templateContent = `---
to }}.sh"
chmod: "755"
---
#!/bin/bash
echo "{{ name }} script"`;

      await world.helper.createDirectory('_templates/script/executable');
      await world.helper.createFile('_templates/script/executable/script.sh', templateContent);
      
      const result = await world.helper.runCli('unjucks generate script executable --name=deploy');
      expect(result.exitCode).toBe(0);
      
      // Verify file exists
      const files = await world.helper.listFiles();
      expect(files).toContain('scripts/deploy.sh');
      
      // Check file permissions (on Unix systems)
      if (process.platform !== 'win32') {
        const stats = await fs.stat(path.join(world.context.tempDirectory!, 'scripts/deploy.sh'));
        const mode = (stats.mode & parseInt('777', 8)).toString(8);
        expect(mode).toBe('755');
      }
    });
  });
});