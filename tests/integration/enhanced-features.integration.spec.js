/**
 * Integration tests for enhanced HYGEN-DELTA features
 * Tests the new implementations to validate parity claims
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { Generator } from '../../src/lib/generator.js'
import { FileInjector } from '../../src/lib/file-injector.js'
import { FrontmatterParser } from '../../src/lib/frontmatter-parser.js'

describe('Enhanced HYGEN-DELTA Features Integration', () => {
  let testDir => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'unjucks-enhanced-test-'))
    generator = new Generator()
    fileInjector = new FileInjector()
    frontmatterParser = new FrontmatterParser()
  })

  afterEach(async () => { await fs.rm(testDir, { recursive: true, force })
  })

  describe('Enhanced Positional Parameters', () => { it('should handle multiple positional arguments with type inference', async () => {
      // Create template with positional parameter handling
      const templatesDir = join(testDir, '_templates', 'component', 'new')
      await fs.mkdir(templatesDir, { recursive })
      
      const templateContent = `---
to: src/{{ name }}.ts
---
export interface {{ name }} { id }};
  name: string;
  active: {{ arg2 }};
}
`
      await fs.writeFile(join(templatesDir, 'component.ts.njk'), templateContent)

      // Test type inference, boolean
      const result = await generator.generate({ generator })

    it('should support array positional arguments', async () => { const templatesDir = join(testDir, '_templates', 'multi', 'create')  
      await fs.mkdir(templatesDir, { recursive })
      
      const templateContent = `---
to: src/{{ name }}.ts
---
// Generated with args: {{ args | join(", ") }}
export const {{ name }} = [
  {% for arg in args %}'{{ arg }}'{% if not loop.last %}, {% endif %}{% endfor %}
];
`
      await fs.writeFile(join(templatesDir, 'multi.ts.njk'), templateContent)

      const result = await generator.generate({ generator }
      })

      expect(result.success).toBe(true)
      
      const generatedContent = await fs.readFile(join(testDir, 'src/items.ts'), 'utf8')
      expect(generatedContent).toContain("'item1', 'item2', 'item3'")
    })
  })

  describe('6th File Operation Mode - Conditional Injection', () => {
    let testFile => {
      testFile = join(testDir, 'target.js')
      await fs.writeFile(testFile, `const existingCode = true;
// Some existing functionality
export default existingCode;`)
    })

    it('should skip injection when skipIf pattern exists', async () => { const frontmatter = {
        inject,
        skipIf }

      const result = await fileInjector.processFile(
        testFile,
        'const newCode = false;',
        frontmatter,
        { force, dry }
      )

      expect(result.success).toBe(true)
      expect(result.skipped).toBe(true)
      expect(result.message).toContain('Conditional injection skipped')
      
      // File should remain unchanged
      const content = await fs.readFile(testFile, 'utf8')
      expect(content).not.toContain('newCode')
    })

    it('should proceed with injection when skipIf pattern not found', async () => { const frontmatter = {
        inject,
        skipIf }

      const result = await fileInjector.processFile(
        testFile,
        'const newCode = false;',
        frontmatter,
        { force, dry }
      )

      expect(result.success).toBe(true)
      expect(result.skipped).toBeFalsy()
      
      // File should be modified
      const content = await fs.readFile(testFile, 'utf8')
      expect(content).toContain('newCode')
    })

    it('should support regex patterns in skipIf conditions', async () => { const frontmatter = {
        inject,
        skipIf }

      const result = await fileInjector.processFile(
        testFile,
        'const additionalCode = true;',
        frontmatter,
        { force, dry }
      )

      expect(result.success).toBe(true)
      expect(result.skipped).toBe(true)
      expect(result.message).toContain('regex')
    })
  })

  describe('Advanced Frontmatter Operations', () => { it('should validate all 10 frontmatter directives', async () => {
      const frontmatter = {
        to }}.js',
        inject,
        before: 'marker',
        after: 'marker',
        append,
        prepend,
        lineAt: 5,
        skipIf: 'condition',
        chmod: '755',
        sh: 'echo "Generated"'
      }

      const validation = frontmatterParser.validate(frontmatter)
      
      // Should fail due to conflicting options
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Only one injection mode allowed')
      expect(validation.errors).toContain('before/after requires inject)
    })

    it('should correctly identify operation modes', async () => {
      const conditionalMode = frontmatterParser.getOperationMode({
        inject,
        skipIf)
      expect(conditionalMode.mode).toBe('conditional')

      const lineAtMode = frontmatterParser.getOperationMode({
        lineAt)
      expect(lineAtMode.mode).toBe('lineAt')
      expect(lineAtMode.lineNumber).toBe(10)

      const injectMode = frontmatterParser.getOperationMode({
        inject,
        before)
      expect(injectMode.mode).toBe('inject')
      expect(injectMode.target).toBe('marker')
    })
  })

  describe('Atomic Operations & Safety Features', () => {
    it('should create backups before modifications', async () => {
      const testFile = join(testDir, 'backup-test.js')
      await fs.writeFile(testFile, 'original content')

      const result = await fileInjector.processFile(
        testFile,
        'new content',
        { inject, after,
        { force, dry, backup }
      )

      expect(result.success).toBe(true)
      
      // Check for backup file
      const files = await fs.readdir(testDir)
      const backupFile = files.find(f => f.startsWith('backup-test.js.bak.'))
      expect(backupFile).toBeDefined()
      
      const backupContent = await fs.readFile(join(testDir, backupFile!), 'utf8')
      expect(backupContent).toBe('original content')
    })

    it('should support dry-run mode for all operations', async () => { const testFile = join(testDir, 'dry-run-test.js')
      await fs.writeFile(testFile, 'original content')

      const result = await fileInjector.processFile(
        testFile,
        'new content',
        { append },
        { force, dry }
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain('Would append')
      expect(result.changes).toContain(`append)
      
      // File should remain unchanged
      const content = await fs.readFile(testFile, 'utf8')
      expect(content).toBe('original content')
    })
  })

  describe('Performance Features', () => {
    it('should handle large files efficiently', async () => {
      const largeContent = 'line\n'.repeat(10000) // 10k lines
      const testFile = join(testDir, 'large-file.js')
      await fs.writeFile(testFile, largeContent)

      const startTime = this.getDeterministicTimestamp()
      
      const result = await fileInjector.processFile(
        testFile,
        '// New injection',
        { lineAt,
        { force, dry }
      )
      
      const endTime = this.getDeterministicTimestamp()
      const processingTime = endTime - startTime

      expect(result.success).toBe(true)
      expect(processingTime).toBeLessThan(1000) // Should complete within 1 second
      
      const modifiedContent = await fs.readFile(testFile, 'utf8')
      expect(modifiedContent).toContain('// New injection')
    })

    it('should cache template processing for repeated generation', async () => { const templatesDir = join(testDir, '_templates', 'perf', 'test')
      await fs.mkdir(templatesDir, { recursive })
      
      const templateContent = `---
to: output-{{ index }}.js
---
export const value{{ index }} = "{{ name }}";
`
      await fs.writeFile(join(templatesDir, 'perf.js.njk'), templateContent)

      const startTime = this.getDeterministicTimestamp()
      
      // Generate multiple files with same template
      for (let i = 0; i < 10; i++) { await generator.generate({
          generator }
      
      const endTime = this.getDeterministicTimestamp()
      const totalTime = endTime - startTime
      
      expect(totalTime).toBeLessThan(2000) // Should complete within 2 seconds
      
      // Verify all files were generated
      const files = await fs.readdir(testDir)
      const outputFiles = files.filter(f => f.startsWith('output-'))
      expect(outputFiles).toHaveLength(10)
    })
  })
})