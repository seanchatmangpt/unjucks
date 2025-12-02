#!/usr/bin/env node

/**
 * KGEN Marketplace Search Demo
 * 
 * Demonstrates the N-dimensional facet filtering capabilities
 * of the marketplace search command with real-world examples.
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Path to kgen CLI
const kgenPath = path.resolve(__dirname, '../bin/kgen.mjs')

// Demo search scenarios
const searchScenarios = [
  {
    name: 'Show Available Facets',
    description: 'List all available facet dimensions for filtering',
    command: ['marketplace', 'search', '--facets']
  },
  {
    name: 'Basic Text Search',
    description: 'Search for legal contract templates',
    command: ['marketplace', 'search', '--query', 'legal contracts', '--format', 'summary']
  },
  {
    name: 'Single Facet Filter',
    description: 'Find all Legal domain packages',
    command: ['marketplace', 'search', '--dim', 'domain=Legal', '--format', 'table']
  },
  {
    name: 'Multi-dimensional Facet Filter',
    description: 'Find Legal DOCX packages with GDPR compliance',
    command: [
      'marketplace', 'search', 
      '--dim', 'domain=Legal',
      '--dim', 'artifact=DOCX',
      '--dim', 'compliance=GDPR',
      '--format', 'summary'
    ]
  },
  {
    name: 'Complex Query with Trust Policy',
    description: 'Find verified Financial APIs with encryption',
    command: [
      'marketplace', 'search',
      '--query', 'api',
      '--dim', 'domain=Financial',
      '--dim', 'security=encryption',
      '--trust', 'verified',
      '--format', 'json'
    ]
  },
  {
    name: 'Enterprise Architecture Search',
    description: 'Find Enterprise microservice packages',
    command: [
      'marketplace', 'search',
      '--dim', 'domain=Enterprise',
      '--dim', 'architecture=microservice',
      '--dim', 'maturity=stable',
      '--verbose'
    ]
  },
  {
    name: 'Compliance-focused Search',
    description: 'Find packages meeting multiple compliance standards',
    command: [
      'marketplace', 'search',
      '--compliance', 'GDPR,SOX',
      '--trust', 'attested',
      '--limit', 10,
      '--format', 'table'
    ]
  },
  {
    name: 'Debug Search',
    description: 'Search with full debug information',
    command: [
      'marketplace', 'search',
      '--query', 'healthcare',
      '--dim', 'domain=Healthcare',
      '--registry', 'npm,oci,git',
      '--debug',
      '--verbose'
    ]
  }
]

async function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { 
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true 
    })
    
    let stdout = ''
    let stderr = ''
    
    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    
    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    child.on('close', (code) => {
      resolve({ code, stdout, stderr })
    })
    
    child.on('error', (error) => {
      reject(error)
    })
  })
}

async function runDemo() {
  console.log('🚀 KGEN Marketplace Search Demo')
  console.log('=' .repeat(50))
  console.log()
  
  for (const scenario of searchScenarios) {
    console.log(`📋 ${scenario.name}`)
    console.log(`   ${scenario.description}`)
    console.log(`   Command: node ${kgenPath} ${scenario.command.join(' ')}`)
    console.log()
    
    try {
      const result = await runCommand('node', [kgenPath, ...scenario.command])
      
      if (result.code === 0) {
        console.log('✅ Success:')
        console.log(result.stdout)
      } else {
        console.log('❌ Error:')
        console.log(result.stderr || result.stdout)
      }
    } catch (error) {
      console.log('💥 Exception:', error.message)
    }
    
    console.log('-'.repeat(50))
    console.log()
  }
  
  console.log('🎯 Facet Filtering Examples:')
  console.log('=' .repeat(30))
  console.log()
  console.log('Single dimension:')
  console.log('  kgen marketplace search --dim domain=Legal')
  console.log('  kgen marketplace search --dim artifact=API')
  console.log()
  console.log('Multiple dimensions:')
  console.log('  kgen marketplace search --dim domain=Legal --dim artifact=DOCX')
  console.log('  kgen marketplace search --dim compliance=GDPR --dim maturity=stable')
  console.log()
  console.log('Combined with text search:')
  console.log('  kgen marketplace search --query "contract" --dim domain=Legal')
  console.log('  kgen marketplace search --query "api" --dim domain=Financial --dim security=encryption')
  console.log()
  console.log('Policy filters:')
  console.log('  kgen marketplace search --trust verified --visibility public')
  console.log('  kgen marketplace search --compliance GDPR,HIPAA --trust attested')
  console.log()
  console.log('Output formats:')
  console.log('  kgen marketplace search --format table      # Tabular output')
  console.log('  kgen marketplace search --format summary    # Human-readable summary')
  console.log('  kgen marketplace search --format json       # Full JSON output (default)')
  console.log()
  
  console.log('Demo completed! 🎉')
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error)
}

export { searchScenarios, runDemo }