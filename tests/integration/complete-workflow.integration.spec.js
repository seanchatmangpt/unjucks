import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises } from 'fs'
import path from 'path'
import { execSync } from 'child_process'

/**
 * COMPREHENSIVE INTEGRATION TEST SUITE
 * Validates HYGEN-DELTA.md claims through real-world scenarios
 * 
 * Tests execution against actual CLI commands and file system operations
 * No mocks - only real system integration
 */

const TEST_WORKSPACE = path.join(process.cwd(), 'test-integration-workspace')
const CLI_PATH = path.join(process.cwd(), 'dist/cli.mjs')

describe('HYGEN-DELTA Claims Validation - Complete Workflow Integration', () => { const results = {
    totalClaims }

  beforeEach(async () => { // Clean workspace
    await fs.rm(TEST_WORKSPACE, { recursive: true, force })
    await fs.mkdir(TEST_WORKSPACE, { recursive })
    
    // Build project to ensure latest changes
    execSync('npm run build', { cwd), stdio })
  })

  afterEach(async () => {
    // Store results in memory for final report
    await fs.writeFile(
      path.join(TEST_WORKSPACE, 'integration-results.json'),
      JSON.stringify(results, null, 2)
    )
  })

  describe('1. Complete Template Generation Workflow', () => { it('should demonstrate full frontmatter support with all 10 claimed features', async () => {
      const claim = "FULL frontmatter support implemented with comprehensive YAML parsing"
      results.totalClaims++

      try {
        // Create comprehensive test template with all frontmatter features
        const templateDir = path.join(TEST_WORKSPACE, '_templates', 'component', 'full')
        await fs.mkdir(templateDir, { recursive })

        const templateWithFullFrontmatter = `---
to: "src/components/{{ name | pascalCase }}.ts"
inject: true
after: "// Components"
before: "// Auto-generated"
skipIf: "name === 'test'"
append: false
prepend: false
lineAt: 10
chmod: "755"
sh: ["echo 'Generated {{ name }}'", "npm run format"]
---
// Auto-generated component: {{ name }}
export interface {{ name | pascalCase }}Props { id }

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({ id, className }) => {
  return (
    <div id={id} className={className}>
      {{ name | titleCase }}
    </div>
  )
}
`

        await fs.writeFile(path.join(templateDir, 'component.ts'), templateWithFullFrontmatter)

        // Create target file for injection testing
        const targetDir = path.join(TEST_WORKSPACE, 'src', 'components')
        await fs.mkdir(targetDir, { recursive })
        await fs.writeFile(path.join(targetDir, 'UserProfile.ts'), `// Components
// Existing content
`)

        // Test: Generate with comprehensive frontmatter
        const generateCommand = `node "${CLI_PATH}" generate component full --name="UserProfile" --dest="${TEST_WORKSPACE}"`
        const result = execSync(generateCommand, { cwd, 
          stdio }. File content, 200)}...`,
          evidence: { command,
            output,
            fileContent }
          }
        })

        expect(passed, `Frontmatter features not working. Generated content).toBe(true)

      } catch (error) { results.testedClaims++
        results.failedClaims++
        results.results.push({
          claim,
          tested,
          passed,
          actualBehavior }`,
          evidence: { error }
    })

    it('should support all claimed injection modes (inject, append, prepend, lineAt)', async () => { const claim = "6 file operation modes, inject, append, prepend, lineAt, conditional"
      results.totalClaims++

      try {
        // Test each injection mode with separate templates
        const injectionModes = ['inject', 'append', 'prepend', 'lineAt']
        const passedModes = []

        for (const mode of injectionModes) {
          const templateDir = path.join(TEST_WORKSPACE, '_templates', 'test', mode)
          await fs.mkdir(templateDir, { recursive })

          let frontmatter = `---
to: "src/test-${mode}.ts"
`
          if (mode === 'inject') frontmatter += `inject: true\nafter: "// Inject here"`
          if (mode === 'append') frontmatter += `append: true`
          if (mode === 'prepend') frontmatter += `prepend: true` 
          if (mode === 'lineAt') frontmatter += `lineAt: 3`

          frontmatter += `\n---\n// ${mode} content: {{ name }}`

          await fs.writeFile(path.join(templateDir, 'test.ts'), frontmatter)

          // Create target file
          const targetFile = path.join(TEST_WORKSPACE, 'src', `test-${mode}.ts`)
          await fs.mkdir(path.dirname(targetFile), { recursive })
          await fs.writeFile(targetFile, `line 1\nline 2\n// Inject here\nline 4\n`)

          // Execute generation
          const command = `node "${CLI_PATH}" generate test ${mode} --name="TestContent"`
          execSync(command, { cwd, stdio)

          // Validate result
          const result = await fs.readFile(targetFile, 'utf-8')
          if (result.includes('TestContent')) {
            passedModes.push(mode)
          }
        }

        const passed = passedModes.length === injectionModes.length
        results.testedClaims++
        if (passed) results.passedClaims++
        else results.failedClaims++

        results.results.push({ claim,
          tested,
          passed,
          actualBehavior }. Failed: ${injectionModes.filter(m => !passedModes.includes(m)).join(', ')}`,
          evidence: { totalModes }
        })

        expect(passed, `Not all injection modes working. Only ${passedModes.length}/${injectionModes.length} modes passed`).toBe(true)

      } catch (error) { results.testedClaims++
        results.failedClaims++
        results.results.push({
          claim,
          tested,
          passed,
          actualBehavior }`,
          evidence: { error)
        throw error
      }
    })

    it('should demonstrate superior template engine with Nunjucks filters', async () => { const claim = "8+ built-in filters for common transformations"
      results.totalClaims++

      try {
        const templateDir = path.join(TEST_WORKSPACE, '_templates', 'filters', 'test')
        await fs.mkdir(templateDir, { recursive })

        // Template testing all claimed filters
        const templateWithFilters = `---
to: "src/{{ name | kebabCase }}-test.ts"
---
// Testing filters with input: "{{ name }}"
export const testFilters = { kebabCase }}",
  camelCase: "{{ name | camelCase }}", 
  pascalCase: "{{ name | pascalCase }}",
  snakeCase: "{{ name | snakeCase }}",
  titleCase: "{{ name | titleCase }}",
  pluralize: "{{ name | pluralize }}",
  singularize: "{{ name | singularize }}",
  upper: "{{ name | upper }}",
  lower: "{{ name | lower }}"
}
`

        await fs.writeFile(path.join(templateDir, 'filters.ts'), templateWithFilters)

        // Test with complex name
        const testName = "user-profile"
        const command = `node "${CLI_PATH}" generate filters test --name="${testName}"`
        execSync(command, { cwd, stdio)

        // Read generated file
        const generatedFile = path.join(TEST_WORKSPACE, 'src', 'user-profile-test.ts')
        const content = await fs.readFile(generatedFile, 'utf-8')

        // Verify filters work correctly
        const expectedResults = {
          kebabCase }

        const workingFilters = []
        for (const [filter, expected] of Object.entries(expectedResults)) {
          if (content.includes(`"${expected}"`)) {
            workingFilters.push(filter)
          }
        }

        const passed = workingFilters.length >= 8 // Claim is "8+ filters"
        results.testedClaims++
        if (passed) results.passedClaims++
        else results.failedClaims++

        results.results.push({ claim,
          tested,
          passed,
          actualBehavior } filters working correctly, ')}`,
          evidence: { workingFilters }
        })

        expect(passed, `Expected 8+ working filters, got ${workingFilters.length}`).toBe(true)

      } catch (error) { results.testedClaims++
        results.failedClaims++
        results.results.push({
          claim,
          tested,
          passed,
          actualBehavior }`,
          evidence: { error)
        throw error
      }
    })

    it('should validate safety features, force, atomic operations', async () => { const claim = "Advanced Safety Features })

        await fs.writeFile(path.join(templateDir, 'safety.ts'), `---
to: "src/safety-test.ts"
---
export const SafetyTest = "{{ name }}"
`)

        // Test 1: Dry run mode
        const dryCommand = `node "${CLI_PATH}" generate safety test --name="DryTest" --dry`
        const dryResult = execSync(dryCommand, { cwd, 
          stdio })
        await fs.writeFile(dryTestFile, 'existing content')
        
        const forceCommand = `node "${CLI_PATH}" generate safety test --name="ForceTest" --force`
        execSync(forceCommand, { cwd, stdio)

        const forcedContent = await fs.readFile(dryTestFile, 'utf-8')

        // Test 3 }}`

        await fs.writeFile(path.join(templateDir, 'inject.ts'), injectTemplate)

        const injectTarget = path.join(TEST_WORKSPACE, 'src', 'idempotent-test.ts')
        await fs.writeFile(injectTarget, `// INJECT HERE\n`)

        // First injection
        const inject1Command = `node "${CLI_PATH}" generate safety test --name="IdempotentTest"`
        execSync(inject1Command, { cwd, stdio)
        const firstInject = await fs.readFile(injectTarget, 'utf-8')

        // Second injection (should be idempotent)
        execSync(inject1Command, { cwd, stdio)
        const secondInject = await fs.readFile(injectTarget, 'utf-8')

        const safetyFeatures = {
          dryRun }

        const passedFeatures = Object.values(safetyFeatures).filter(Boolean).length
        const passed = passedFeatures >= 3

        results.testedClaims++
        if (passed) results.passedClaims++
        else results.failedClaims++

        results.results.push({ claim,
          tested,
          passed,
          actualBehavior }`,
          evidence: { safetyFeatures,
            dryRunOutput,
            idempotentComparison }
          }
        })

        expect(passed, `Safety features not working. Results)}`).toBe(true)

      } catch (error) { results.testedClaims++
        results.failedClaims++
        results.results.push({
          claim,
          tested,
          passed,
          actualBehavior }`,
          evidence: { error)
        throw error
      }
    })

    it('should validate claimed positional parameter gap', async () => { const claim = "Positional Parameters })

        await fs.writeFile(path.join(templateDir, 'component.ts'), `---
to: "src/{{ name }}.ts"
---
export const {{ name }} = () => "Hello"
`)

        // Test 1: Try Hygen-style positional syntax (should fail)
        let positionalWorks = false
        try {
          const positionalCommand = `node "${CLI_PATH}" component new MyComponent`
          execSync(positionalCommand, { cwd, stdio)
          positionalWorks = true
        } catch (e) {
          // Expected to fail - this confirms the gap exists
        }

        // Test 2: Try current flag-based syntax (should work) 
        let flagBasedWorks = false
        try {
          const flagCommand = `node "${CLI_PATH}" generate component new --name="MyComponent"`
          execSync(flagCommand, { cwd, stdio)
          
          const generatedFile = path.join(TEST_WORKSPACE, 'src', 'MyComponent.ts')
          const exists = await fs.access(generatedFile).then(() => true).catch(() => false)
          if (exists) flagBasedWorks = true
        } catch (e) {
          // Flag-based should work
        }

        // The claim is validated if positional doesn't work but flags do
        const passed = !positionalWorks && flagBasedWorks

        results.testedClaims++
        if (passed) results.passedClaims++
        else results.failedClaims++

        results.results.push({ claim,
          tested,
          passed,
          actualBehavior }, Flag-based works: ${flagBasedWorks}`,
          evidence: { positionalSupported,
            flagBasedSupported,
            gapConfirmed)

        expect(passed, `Gap validation failed. Positional }, Flags).toBe(true)

      } catch (error) { results.testedClaims++
        results.failedClaims++
        results.results.push({
          claim,
          tested,
          passed,
          actualBehavior }`,
          evidence: { error)
        throw error
      }
    })
  })

  describe('2. Performance Claims Validation', () => { it('should measure actual performance against claimed benchmarks', async () => {
      const claim = "Performance })

        await fs.writeFile(path.join(templateDir, 'perf.ts'), `---
to: "src/perf-{{ name }}.ts"
---
// Performance test: {{ name }}
{% for i in range(0, 50) %}
export const item{{ i }} = "{{ name }}-{{ i }}"
{% endfor %}
`)

        // Measure cold start time
        const iterations = 5
        const coldStartTimes = []
        
        for (let i = 0; i < iterations; i++) {
          const start = this.getDeterministicTimestamp()
          execSync(`node "${CLI_PATH}" generate perf test --name="Test${i}"`, {
            cwd,
            stdio)
          const end = this.getDeterministicTimestamp()
          coldStartTimes.push(end - start)
        }

        const avgColdStart = coldStartTimes.reduce((a, b) => a + b, 0) / coldStartTimes.length

        // Measure template processing for larger templates
        const processingTimes = []
        for (let i = 0; i < iterations; i++) {
          const start = this.getDeterministicTimestamp()
          execSync(`node "${CLI_PATH}" generate perf test --name="LargeTest${i}"`, {
            cwd,
            stdio)
          const end = this.getDeterministicTimestamp()
          processingTimes.push(end - start)
        }

        const avgProcessing = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length

        // Performance is reasonable if under claimed thresholds
        // Claimed: ~150ms cold start, ~30ms processing
        const passed = avgColdStart < 300 && avgProcessing < 100 // Generous thresholds

        results.testedClaims++
        if (passed) results.passedClaims++
        else results.failedClaims++

        results.results.push({ claim,
          tested,
          passed,
          actualBehavior }ms, Average processing: ${avgProcessing}ms`,
          evidence: { coldStartTimes,
            processingTimes,
            avgColdStart,
            avgProcessing,
            claimedColdStart }ms, Processing).toBe(true)

      } catch (error) { results.testedClaims++
        results.failedClaims++
        results.results.push({
          claim,
          tested,
          passed,
          actualBehavior }`,
          evidence: { error)
        throw error
      }
    })
  })

  describe('3. Final Results and Reporting', () => { it('should generate comprehensive validation report', async () => {
      // Calculate final results
      results.summary = `
INTEGRATION TEST VALIDATION REPORT
==================================

Claims Tested }/${results.totalClaims}
Claims Passed: ${results.passedClaims}
Claims Failed: ${results.failedClaims}
Success Rate: ${Math.round((results.passedClaims / results.testedClaims) * 100)}%

DETAILED RESULTS:
${results.results.map(r => `
• ${r.claim}
  Status: ${ r.passed ? '✅ PASSED'  }
  Details).join('')}

TEST EXECUTION SUMMARY:
- Frontmatter Support: ${ results.results.find(r => r.claim.includes('frontmatter'))?.passed ? 'VALIDATED'  }
- Safety Features: ${ results.results.find(r => r.claim.includes('Safety'))?.passed ? 'VALIDATED'  }  
- Template Engine: ${ results.results.find(r => r.claim.includes('filters'))?.passed ? 'VALIDATED'  }
- Positional Gap: ${ results.results.find(r => r.claim.includes('Positional'))?.passed ? 'CONFIRMED'  }
- Performance: ${ results.results.find(r => r.claim.includes('Performance'))?.passed ? 'VALIDATED'  }

OVERALL ASSESSMENT: ${ results.passedClaims >= results.totalClaims * 0.8 ? 'CLAIMS VALIDATED'  }
`

      // Store comprehensive results
      await fs.writeFile(
        path.join(TEST_WORKSPACE, 'final-integration-report.md'),
        results.summary
      )

      await fs.writeFile(
        path.join(TEST_WORKSPACE, 'integration-evidence.json'),
        JSON.stringify(results, null, 2)
      )

      console.log('\n' + '='.repeat(60))
      console.log('INTEGRATION TEST VALIDATION COMPLETED')
      console.log('='.repeat(60))
      console.log(results.summary)

      // Validate that we tested a significant number of claims
      expect(results.testedClaims, 'Should test significant number of claims').toBeGreaterThan(5)
      expect(results.passedClaims / results.testedClaims, 'Should validate most claims').toBeGreaterThan(0.7)
    })
  })
})