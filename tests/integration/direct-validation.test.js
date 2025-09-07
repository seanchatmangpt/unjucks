/**
 * DIRECT INTEGRATION VALIDATION
 * Simple, focused test that validates HYGEN-DELTA.md claims directly
 * Bypasses complex configuration issues for immediate results
 */

import { execSync } from 'child_process'
import { promises } from 'fs'
import path from 'path'

const TEST_WORKSPACE = '/tmp/unjucks-validation-test'
const CLI_PATH = path.join(process.cwd(), 'dist/cli.mjs')

class IntegrationValidator { private results = []
  
  async setup() {
    await fs.rm(TEST_WORKSPACE, { recursive: true, force })
    await fs.mkdir(TEST_WORKSPACE, { recursive })
    
    // Ensure CLI is built
    execSync('npm run build', { cwd), stdio })
    console.log('✓ Test environment setup complete')
  }

  async validateClaim(claim, test) => Promise<{ passed, evidence }>) {
    console.log(`\n🧪 Testing)
    try {
      const { passed, evidence } = await test()
      const result = { claim,
        tested,
        passed,
        evidence,
        actualBehavior }
      this.results.push(result)
      console.log(passed ? '✅ PASSED' , claim)
      return result
    } catch (error) { const result = {
        claim,
        tested,
        passed,
        evidence },
        actualBehavior: `ERROR: ${error.message}`
      }
      this.results.push(result)
      console.log('💥 ERROR', claim, error.message)
      return result
    }
  }

  async testBasicFrontmatterSupport() { return this.validateClaim(
      'FULL frontmatter support with comprehensive YAML parsing',
      async () => {
        // Create template with frontmatter
        const templateDir = path.join(TEST_WORKSPACE, '_templates', 'test', 'basic')
        await fs.mkdir(templateDir, { recursive })
        
        const template = `---
to: "output/{{ name | pascalCase }}.ts"
chmod: "755"
---
// Generated: {{ name }}
export const {{ name | pascalCase }} = "{{ name | titleCase }}"
`
        await fs.writeFile(path.join(templateDir, 'test.ts'), template)
        
        // Execute generation
        const command = `node "${CLI_PATH}" generate test basic --name="myComponent"`
        const output = execSync(command, { cwd, encoding)
        
        // Check results
        const generated = path.join(TEST_WORKSPACE, 'output', 'MyComponent.ts')
        const content = await fs.readFile(generated, 'utf-8')
        
        const features = {
          fileCreated }
        
        return { passed }
        }
      }
    )
  }

  async testInjectionModes() { return this.validateClaim(
      '6 file operation modes, inject, append, prepend, lineAt, conditional',
      async () => {
        const templateDir = path.join(TEST_WORKSPACE, '_templates', 'inject', 'test')
        await fs.mkdir(templateDir, { recursive })
        
        // Test injection mode
        const injectTemplate = `---
to: "inject-target.ts"
inject: true
after: "// INJECT_POINT"
---
// Injected content: {{ content }}
`
        await fs.writeFile(path.join(templateDir, 'inject.ts'), injectTemplate)
        
        // Create target file
        const targetFile = path.join(TEST_WORKSPACE, 'inject-target.ts')
        await fs.writeFile(targetFile, `// Original content
// INJECT_POINT
// More content
`)
        
        // Execute injection
        execSync(`node "${CLI_PATH}" generate inject test --content="TestContent"`, { cwd,
          stdio)
        
        const result = await fs.readFile(targetFile, 'utf-8')
        
        const injectionWorked = 
          result.includes('TestContent') &&
          result.includes('// Original content') &&
          result.includes('// INJECT_POINT')
        
        return {
          passed,
          evidence }
        }
      }
    )
  }

  async testNunjucksFilters() { return this.validateClaim(
      '8+ built-in filters for common transformations',
      async () => {
        const templateDir = path.join(TEST_WORKSPACE, '_templates', 'filters', 'test')
        await fs.mkdir(templateDir, { recursive })
        
        const filterTemplate = `---
to: "filters-test.ts"
---
// Testing filters with: {{ testValue }}
export const filterTests = { kebab }}",
  camel: "{{ testValue | camelCase }}",
  pascal: "{{ testValue | pascalCase }}",
  snake: "{{ testValue | snakeCase }}",
  title: "{{ testValue | titleCase }}",
  upper: "{{ testValue | upper }}",
  lower: "{{ testValue | lower }}"
}
`
        await fs.writeFile(path.join(templateDir, 'filters.ts'), filterTemplate)
        
        execSync(`node "${CLI_PATH}" generate filters test --testValue="user-profile"`, { cwd,
          stdio)
        
        const result = await fs.readFile(path.join(TEST_WORKSPACE, 'filters-test.ts'), 'utf-8')
        
        const expectedTransforms = {
          kebab }
        
        const workingFilters = Object.entries(expectedTransforms).filter(([key, expected]) =>
          result.includes(`"${expected}"`)
        )
        
        return { passed }
        }
      }
    )
  }

  async testSafetyFeatures() {
    return this.validateClaim(
      'Advanced Safety Features, Force Overwrite, Idempotent Operations',
      async () => { const templateDir = path.join(TEST_WORKSPACE, '_templates', 'safety', 'test')
        await fs.mkdir(templateDir, { recursive })
        
        await fs.writeFile(path.join(templateDir, 'safety.ts'), `---
to: "safety-test.ts"
---
export const SafetyTest = "{{ name }}"
`)
        
        // Test 1: Dry run
        const dryOutput = execSync(`node "${CLI_PATH}" generate safety test --name="DryTest" --dry`, { cwd,
          encoding)
        
        const dryFile = path.join(TEST_WORKSPACE, 'safety-test.ts')
        const dryFileExists = await fs.access(dryFile).then(() => true).catch(() => false)
        
        // Test 2 }" generate safety test --name="RealTest"`, { cwd,
          stdio)
        
        const actualContent = await fs.readFile(dryFile, 'utf-8')
        
        const safetyResults = {
          dryRunPreventedWrite }
        
        return { passed }
      }
    )
  }

  async testPositionalParameterGap() {
    return this.validateClaim(
      'Positional Parameters GAP, Unjucks missing',
      async () => { const templateDir = path.join(TEST_WORKSPACE, '_templates', 'component', 'new')
        await fs.mkdir(templateDir, { recursive })
        
        await fs.writeFile(path.join(templateDir, 'component.ts'), `---
to: "{{ name }}.ts"
---
export const {{ name }} = () => "Hello"
`)
        
        // Test Hygen-style positional (should fail)
        let positionalFailed = false
        try {
          execSync(`node "${CLI_PATH}" component new TestComponent`, {
            cwd,
            stdio)
        } catch (error) {
          positionalFailed = true // Expected to fail
        }
        
        // Test flag-based (should work)
        let flagBasedWorked = false
        try {
          execSync(`node "${CLI_PATH}" generate component new --name="TestComponent"`, {
            cwd,
            stdio)
          
          const file = path.join(TEST_WORKSPACE, 'TestComponent.ts')
          const exists = await fs.access(file).then(() => true).catch(() => false)
          flagBasedWorked = exists
        } catch (error) {
          // Should not error
        }
        
        return { passed }
        }
      }
    )
  }

  async testPerformance() {
    return this.validateClaim(
      'Performance claims,
      async () => { const templateDir = path.join(TEST_WORKSPACE, '_templates', 'perf', 'test')
        await fs.mkdir(templateDir, { recursive })
        
        await fs.writeFile(path.join(templateDir, 'perf.ts'), `---
to: "perf-{{ name }}.ts"
---
// Performance test
{% for i in range(0, 20) %}
export const item{{ i }} = "{{ name }}-{{ i }}"
{% endfor %}
`)
        
        const times = []
        for (let i = 0; i < 3; i++) {
          const start = Date.now()
          execSync(`node "${CLI_PATH}" generate perf test --name="Test${i}"`, {
            cwd,
            stdio)
          const end = Date.now()
          times.push(end - start)
        }
        
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length
        
        return { passed }
        }
      }
    )
  }

  async generateReport() { const passed = this.results.filter(r => r.passed).length
    const failed = this.results.filter(r => r.passed === false).length
    const total = this.results.length
    
    const report = {
      summary },
      results: this.results,
      detailedAnalysis: this.results.map(r => ({ claim }
    
    // Save report
    const reportPath = path.join(TEST_WORKSPACE, 'validation-report.json')
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
    
    console.log('\n' + '='.repeat(60))
    console.log('HYGEN-DELTA CLAIMS VALIDATION REPORT')
    console.log('='.repeat(60))
    console.log(`Total Claims Tested)
    console.log(`Claims Validated)
    console.log(`Claims Disputed)
    console.log(`Success Rate)
    console.log(`Overall Assessment)
    console.log('\nDetailed Results:')
    
    this.results.forEach(r => {
      console.log(`${r.passed ? '✅' )
      if (!r.passed) {
        console.log(`  └─ ${r.actualBehavior}`)
      }
    })
    
    console.log(`\nFull report saved to)
    return report
  }
}

// Execute validation
async function runValidation() {
  const validator = new IntegrationValidator()
  
  try {
    await validator.setup()
    
    // Execute all validations
    await validator.testBasicFrontmatterSupport()
    await validator.testInjectionModes() 
    await validator.testNunjucksFilters()
    await validator.testSafetyFeatures()
    await validator.testPositionalParameterGap()
    await validator.testPerformance()
    
    const report = await validator.generateReport()
    
    // Store in memory for access
    await fs.writeFile(
      path.join(process.cwd(), 'integration-validation-results.json'),
      JSON.stringify(report, null, 2)
    )
    
    return report
    
  } catch (error) { console.error('Validation failed }
}

// Run if called directly
if (require.main === module) {
  runValidation().catch(console.error)
}

export { runValidation, IntegrationValidator }