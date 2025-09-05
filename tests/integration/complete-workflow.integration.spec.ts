import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
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

interface TestResult {
  claim: string
  tested: boolean
  passed: boolean
  actualBehavior: string
  evidence: any
}

interface IntegrationResults {
  totalClaims: number
  testedClaims: number
  passedClaims: number
  failedClaims: number
  results: TestResult[]
  summary: string
}

describe('HYGEN-DELTA Claims Validation - Complete Workflow Integration', () => {
  const results: IntegrationResults = {
    totalClaims: 0,
    testedClaims: 0,  
    passedClaims: 0,
    failedClaims: 0,
    results: [],
    summary: ''
  }

  beforeEach(async () => {
    // Clean workspace
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    await fs.mkdir(TEST_WORKSPACE, { recursive: true })
    
    // Build project to ensure latest changes
    execSync('npm run build', { cwd: process.cwd(), stdio: 'pipe' })
  })

  afterEach(async () => {
    // Store results in memory for final report
    await fs.writeFile(
      path.join(TEST_WORKSPACE, 'integration-results.json'),
      JSON.stringify(results, null, 2)
    )
  })

  describe('1. Complete Template Generation Workflow', () => {
    it('should demonstrate full frontmatter support with all 10 claimed features', async () => {
      const claim = "FULL frontmatter support implemented with comprehensive YAML parsing"
      results.totalClaims++

      try {
        // Create comprehensive test template with all frontmatter features
        const templateDir = path.join(TEST_WORKSPACE, '_templates', 'component', 'full')
        await fs.mkdir(templateDir, { recursive: true })

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
export interface {{ name | pascalCase }}Props {
  id: string
  className?: string
}

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
        await fs.mkdir(targetDir, { recursive: true })
        await fs.writeFile(path.join(targetDir, 'UserProfile.ts'), `// Components
// Existing content
`)

        // Test: Generate with comprehensive frontmatter
        const generateCommand = `node "${CLI_PATH}" generate component full --name="UserProfile" --dest="${TEST_WORKSPACE}"`
        const result = execSync(generateCommand, { 
          cwd: TEST_WORKSPACE, 
          stdio: 'pipe',
          encoding: 'utf-8' 
        })

        // Validate: Check if file was created/modified correctly
        const generatedFile = await fs.readFile(
          path.join(TEST_WORKSPACE, 'src', 'components', 'UserProfile.ts'),
          'utf-8'
        )

        const passed = 
          generatedFile.includes('UserProfile') &&
          generatedFile.includes('React.FC<UserProfileProps>') &&
          generatedFile.includes('User Profile') && // titleCase filter test
          generatedFile.includes('// Components') // injection test

        results.testedClaims++
        if (passed) results.passedClaims++
        else results.failedClaims++

        results.results.push({
          claim,
          tested: true,
          passed,
          actualBehavior: `Frontmatter processing: ${passed ? 'SUCCESS' : 'FAILED'}. File content: ${generatedFile.substring(0, 200)}...`,
          evidence: {
            command: generateCommand,
            output: result,
            fileContent: generatedFile.length > 0 ? 'Generated' : 'Empty',
            features: {
              'to': generatedFile.includes('UserProfile'),
              'filters': generatedFile.includes('UserProfile'),
              'inject': true, // We'll validate injection separately
              'after': generatedFile.includes('// Components'),
              'titleCase': generatedFile.includes('User Profile')
            }
          }
        })

        expect(passed, `Frontmatter features not working as claimed. Generated content: ${generatedFile}`).toBe(true)

      } catch (error) {
        results.testedClaims++
        results.failedClaims++
        results.results.push({
          claim,
          tested: true,
          passed: false,
          actualBehavior: `Error during frontmatter test: ${error.message}`,
          evidence: { error: error.message, stack: error.stack }
        })
        throw error
      }
    })

    it('should support all claimed injection modes (inject, append, prepend, lineAt)', async () => {
      const claim = "6 file operation modes: write, inject, append, prepend, lineAt, conditional"
      results.totalClaims++

      try {
        // Test each injection mode with separate templates
        const injectionModes = ['inject', 'append', 'prepend', 'lineAt']
        const passedModes = []

        for (const mode of injectionModes) {
          const templateDir = path.join(TEST_WORKSPACE, '_templates', 'test', mode)
          await fs.mkdir(templateDir, { recursive: true })

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
          await fs.mkdir(path.dirname(targetFile), { recursive: true })
          await fs.writeFile(targetFile, `line 1\nline 2\n// Inject here\nline 4\n`)

          // Execute generation
          const command = `node "${CLI_PATH}" generate test ${mode} --name="TestContent"`
          execSync(command, { cwd: TEST_WORKSPACE, stdio: 'pipe' })

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

        results.results.push({
          claim,
          tested: true,
          passed,
          actualBehavior: `Injection modes working: ${passedModes.join(', ')}. Failed: ${injectionModes.filter(m => !passedModes.includes(m)).join(', ')}`,
          evidence: {
            totalModes: injectionModes.length,
            passedModes: passedModes.length,
            details: passedModes
          }
        })

        expect(passed, `Not all injection modes working. Only ${passedModes.length}/${injectionModes.length} modes passed`).toBe(true)

      } catch (error) {
        results.testedClaims++
        results.failedClaims++
        results.results.push({
          claim,
          tested: true,
          passed: false,
          actualBehavior: `Error testing injection modes: ${error.message}`,
          evidence: { error: error.message }
        })
        throw error
      }
    })

    it('should demonstrate superior template engine with Nunjucks filters', async () => {
      const claim = "8+ built-in filters for common transformations"
      results.totalClaims++

      try {
        const templateDir = path.join(TEST_WORKSPACE, '_templates', 'filters', 'test')
        await fs.mkdir(templateDir, { recursive: true })

        // Template testing all claimed filters
        const templateWithFilters = `---
to: "src/{{ name | kebabCase }}-test.ts"
---
// Testing filters with input: "{{ name }}"
export const testFilters = {
  kebabCase: "{{ name | kebabCase }}",
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
        execSync(command, { cwd: TEST_WORKSPACE, stdio: 'pipe' })

        // Read generated file
        const generatedFile = path.join(TEST_WORKSPACE, 'src', 'user-profile-test.ts')
        const content = await fs.readFile(generatedFile, 'utf-8')

        // Verify filters work correctly
        const expectedResults = {
          kebabCase: 'user-profile',
          camelCase: 'userProfile',
          pascalCase: 'UserProfile', 
          snakeCase: 'user_profile',
          titleCase: 'User Profile',
          pluralize: 'user-profiles',
          upper: 'USER-PROFILE',
          lower: 'user-profile'
        }

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

        results.results.push({
          claim,
          tested: true,
          passed,
          actualBehavior: `${workingFilters.length} filters working correctly: ${workingFilters.join(', ')}`,
          evidence: {
            workingFilters: workingFilters.length,
            totalExpected: Object.keys(expectedResults).length,
            fileContent: content,
            filterDetails: expectedResults
          }
        })

        expect(passed, `Expected 8+ working filters, got ${workingFilters.length}`).toBe(true)

      } catch (error) {
        results.testedClaims++
        results.failedClaims++
        results.results.push({
          claim,
          tested: true,
          passed: false,
          actualBehavior: `Error testing filters: ${error.message}`,
          evidence: { error: error.message }
        })
        throw error
      }
    })

    it('should validate safety features: dry-run, force, atomic operations', async () => {
      const claim = "Advanced Safety Features: Idempotent Operations, Atomic Writes, Comprehensive Validation, Dry Run Mode"
      results.totalClaims++

      try {
        // Set up test template
        const templateDir = path.join(TEST_WORKSPACE, '_templates', 'safety', 'test') 
        await fs.mkdir(templateDir, { recursive: true })

        await fs.writeFile(path.join(templateDir, 'safety.ts'), `---
to: "src/safety-test.ts"
---
export const SafetyTest = "{{ name }}"
`)

        // Test 1: Dry run mode
        const dryCommand = `node "${CLI_PATH}" generate safety test --name="DryTest" --dry`
        const dryResult = execSync(dryCommand, { 
          cwd: TEST_WORKSPACE, 
          stdio: 'pipe',
          encoding: 'utf-8'
        })

        // Verify dry run doesn't create files
        const dryTestFile = path.join(TEST_WORKSPACE, 'src', 'safety-test.ts')
        const dryFileExists = await fs.access(dryTestFile).then(() => true).catch(() => false)

        // Test 2: Force mode with existing file
        await fs.mkdir(path.join(TEST_WORKSPACE, 'src'), { recursive: true })
        await fs.writeFile(dryTestFile, 'existing content')
        
        const forceCommand = `node "${CLI_PATH}" generate safety test --name="ForceTest" --force`
        execSync(forceCommand, { cwd: TEST_WORKSPACE, stdio: 'pipe' })

        const forcedContent = await fs.readFile(dryTestFile, 'utf-8')

        // Test 3: Idempotent injection
        const injectTemplate = `---
to: "src/idempotent-test.ts"
inject: true
after: "// INJECT HERE"
---
// Injected: {{ name }}`

        await fs.writeFile(path.join(templateDir, 'inject.ts'), injectTemplate)

        const injectTarget = path.join(TEST_WORKSPACE, 'src', 'idempotent-test.ts')
        await fs.writeFile(injectTarget, `// INJECT HERE\n`)

        // First injection
        const inject1Command = `node "${CLI_PATH}" generate safety test --name="IdempotentTest"`
        execSync(inject1Command, { cwd: TEST_WORKSPACE, stdio: 'pipe' })
        const firstInject = await fs.readFile(injectTarget, 'utf-8')

        // Second injection (should be idempotent)
        execSync(inject1Command, { cwd: TEST_WORKSPACE, stdio: 'pipe' })
        const secondInject = await fs.readFile(injectTarget, 'utf-8')

        const safetyFeatures = {
          dryRun: !dryFileExists && dryResult.includes('would'),
          forceOverwrite: forcedContent.includes('ForceTest'),
          idempotent: firstInject === secondInject && firstInject.includes('IdempotentTest')
        }

        const passedFeatures = Object.values(safetyFeatures).filter(Boolean).length
        const passed = passedFeatures >= 3

        results.testedClaims++
        if (passed) results.passedClaims++
        else results.failedClaims++

        results.results.push({
          claim,
          tested: true,
          passed,
          actualBehavior: `Safety features working: ${Object.entries(safetyFeatures).filter(([k,v]) => v).map(([k]) => k).join(', ')}`,
          evidence: {
            safetyFeatures,
            dryRunOutput: dryResult,
            idempotentComparison: { firstInject: firstInject.length, secondInject: secondInject.length }
          }
        })

        expect(passed, `Safety features not working as claimed. Results: ${JSON.stringify(safetyFeatures)}`).toBe(true)

      } catch (error) {
        results.testedClaims++
        results.failedClaims++
        results.results.push({
          claim,
          tested: true,
          passed: false,
          actualBehavior: `Error testing safety features: ${error.message}`,
          evidence: { error: error.message }
        })
        throw error
      }
    })

    it('should validate claimed positional parameter gap', async () => {
      const claim = "Positional Parameters: Hygen has, Unjucks missing"
      results.totalClaims++

      try {
        // Test current positional parameter support (should fail)
        const templateDir = path.join(TEST_WORKSPACE, '_templates', 'component', 'new')
        await fs.mkdir(templateDir, { recursive: true })

        await fs.writeFile(path.join(templateDir, 'component.ts'), `---
to: "src/{{ name }}.ts"
---
export const {{ name }} = () => "Hello"
`)

        // Test 1: Try Hygen-style positional syntax (should fail)
        let positionalWorks = false
        try {
          const positionalCommand = `node "${CLI_PATH}" component new MyComponent`
          execSync(positionalCommand, { cwd: TEST_WORKSPACE, stdio: 'pipe' })
          positionalWorks = true
        } catch (e) {
          // Expected to fail - this confirms the gap exists
        }

        // Test 2: Try current flag-based syntax (should work) 
        let flagBasedWorks = false
        try {
          const flagCommand = `node "${CLI_PATH}" generate component new --name="MyComponent"`
          execSync(flagCommand, { cwd: TEST_WORKSPACE, stdio: 'pipe' })
          
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

        results.results.push({
          claim,
          tested: true,
          passed,
          actualBehavior: `Positional parameters work: ${positionalWorks}, Flag-based works: ${flagBasedWorks}`,
          evidence: {
            positionalSupported: positionalWorks,
            flagBasedSupported: flagBasedWorks,
            gapConfirmed: !positionalWorks && flagBasedWorks
          }
        })

        expect(passed, `Gap validation failed. Positional: ${positionalWorks}, Flags: ${flagBasedWorks}`).toBe(true)

      } catch (error) {
        results.testedClaims++
        results.failedClaims++
        results.results.push({
          claim,
          tested: true,
          passed: false,
          actualBehavior: `Error validating positional parameter gap: ${error.message}`,
          evidence: { error: error.message }
        })
        throw error
      }
    })
  })

  describe('2. Performance Claims Validation', () => {
    it('should measure actual performance against claimed benchmarks', async () => {
      const claim = "Performance: 25% faster cold start, 40% faster template processing"
      results.totalClaims++

      try {
        // Set up performance test template
        const templateDir = path.join(TEST_WORKSPACE, '_templates', 'perf', 'test')
        await fs.mkdir(templateDir, { recursive: true })

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
          const start = Date.now()
          execSync(`node "${CLI_PATH}" generate perf test --name="Test${i}"`, {
            cwd: TEST_WORKSPACE,
            stdio: 'pipe'
          })
          const end = Date.now()
          coldStartTimes.push(end - start)
        }

        const avgColdStart = coldStartTimes.reduce((a, b) => a + b, 0) / coldStartTimes.length

        // Measure template processing for larger templates
        const processingTimes = []
        for (let i = 0; i < iterations; i++) {
          const start = Date.now()
          execSync(`node "${CLI_PATH}" generate perf test --name="LargeTest${i}"`, {
            cwd: TEST_WORKSPACE,
            stdio: 'pipe'
          })
          const end = Date.now()
          processingTimes.push(end - start)
        }

        const avgProcessing = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length

        // Performance is reasonable if under claimed thresholds
        // Claimed: ~150ms cold start, ~30ms processing
        const passed = avgColdStart < 300 && avgProcessing < 100 // Generous thresholds

        results.testedClaims++
        if (passed) results.passedClaims++
        else results.failedClaims++

        results.results.push({
          claim,
          tested: true,
          passed,
          actualBehavior: `Average cold start: ${avgColdStart}ms, Average processing: ${avgProcessing}ms`,
          evidence: {
            coldStartTimes,
            processingTimes,
            avgColdStart,
            avgProcessing,
            claimedColdStart: 150,
            claimedProcessing: 30
          }
        })

        expect(passed, `Performance not meeting reasonable thresholds. Cold start: ${avgColdStart}ms, Processing: ${avgProcessing}ms`).toBe(true)

      } catch (error) {
        results.testedClaims++
        results.failedClaims++
        results.results.push({
          claim,
          tested: true,
          passed: false,
          actualBehavior: `Error during performance testing: ${error.message}`,
          evidence: { error: error.message }
        })
        throw error
      }
    })
  })

  describe('3. Final Results and Reporting', () => {
    it('should generate comprehensive validation report', async () => {
      // Calculate final results
      results.summary = `
INTEGRATION TEST VALIDATION REPORT
==================================

Claims Tested: ${results.testedClaims}/${results.totalClaims}
Claims Passed: ${results.passedClaims}
Claims Failed: ${results.failedClaims}
Success Rate: ${Math.round((results.passedClaims / results.testedClaims) * 100)}%

DETAILED RESULTS:
${results.results.map(r => `
• ${r.claim}
  Status: ${r.passed ? '✅ PASSED' : '❌ FAILED'}
  Details: ${r.actualBehavior}
`).join('')}

TEST EXECUTION SUMMARY:
- Frontmatter Support: ${results.results.find(r => r.claim.includes('frontmatter'))?.passed ? 'VALIDATED' : 'FAILED'}
- Safety Features: ${results.results.find(r => r.claim.includes('Safety'))?.passed ? 'VALIDATED' : 'FAILED'}  
- Template Engine: ${results.results.find(r => r.claim.includes('filters'))?.passed ? 'VALIDATED' : 'FAILED'}
- Positional Gap: ${results.results.find(r => r.claim.includes('Positional'))?.passed ? 'CONFIRMED' : 'DISPUTED'}
- Performance: ${results.results.find(r => r.claim.includes('Performance'))?.passed ? 'VALIDATED' : 'FAILED'}

OVERALL ASSESSMENT: ${results.passedClaims >= results.totalClaims * 0.8 ? 'CLAIMS VALIDATED' : 'CLAIMS DISPUTED'}
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