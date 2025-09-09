#!/usr/bin/env node

/**
 * Validation script for reusable GitHub workflows
 * Checks syntax, inputs, outputs, and best practices
 */

import fs from 'fs';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REUSABLE_DIR = path.join(__dirname, '../.github/workflows/reusable');

// Required workflow files
const REQUIRED_WORKFLOWS = [
  'setup.yml',
  'test.yml', 
  'build.yml',
  'publish.yml'
];

// Validation rules
const VALIDATION_RULES = {
  // All reusable workflows must have workflow_call trigger
  hasWorkflowCallTrigger: (workflow) => {
    return workflow.on && workflow.on.workflow_call;
  },
  
  // Inputs should have descriptions and types
  hasProperInputs: (workflow) => {
    if (!workflow.on.workflow_call.inputs) return true;
    
    const inputs = workflow.on.workflow_call.inputs;
    return Object.keys(inputs).every(key => {
      const input = inputs[key];
      return input.description && input.type;
    });
  },
  
  // Jobs should have meaningful names
  hasJobNames: (workflow) => {
    return Object.keys(workflow.jobs).every(jobKey => {
      return workflow.jobs[jobKey].name;
    });
  },
  
  // Should use actions/checkout@v4 or later
  usesLatestCheckout: (workflow) => {
    const workflowStr = JSON.stringify(workflow);
    return !workflowStr.includes('actions/checkout@v3') && 
           !workflowStr.includes('actions/checkout@v2');
  },
  
  // Should use actions/setup-node@v4 or later
  usesLatestSetupNode: (workflow) => {
    const workflowStr = JSON.stringify(workflow);
    return !workflowStr.includes('actions/setup-node@v3') &&
           !workflowStr.includes('actions/setup-node@v2');
  }
};

function validateWorkflow(filePath, content) {
  const results = [];
  const filename = path.basename(filePath);
  
  try {
    const workflow = parseYaml(content);
    
    // Check each validation rule
    Object.entries(VALIDATION_RULES).forEach(([ruleName, ruleFunc]) => {
      const passed = ruleFunc(workflow);
      results.push({
        file: filename,
        rule: ruleName,
        passed,
        message: passed ? 'OK' : `Failed: ${ruleName}`
      });
    });
    
    // Specific validations per workflow type
    if (filename === 'setup.yml') {
      results.push({
        file: filename,
        rule: 'setupSpecific',
        passed: workflow.jobs.setup !== undefined,
        message: workflow.jobs.setup ? 'Has setup job' : 'Missing setup job'
      });
    }
    
    if (filename === 'test.yml') {
      const hasMatrixStrategy = workflow.jobs.test?.strategy?.matrix !== undefined;
      results.push({
        file: filename,
        rule: 'testSpecific',
        passed: hasMatrixStrategy,
        message: hasMatrixStrategy ? 'Has matrix strategy' : 'Missing matrix strategy'
      });
    }
    
    if (filename === 'build.yml') {
      const hasOutputs = workflow.on.workflow_call.outputs !== undefined;
      results.push({
        file: filename,
        rule: 'buildSpecific',
        passed: hasOutputs,
        message: hasOutputs ? 'Has outputs defined' : 'Missing outputs'
      });
    }
    
    if (filename === 'publish.yml') {
      const hasSecrets = workflow.on.workflow_call.secrets !== undefined;
      results.push({
        file: filename,
        rule: 'publishSpecific', 
        passed: hasSecrets,
        message: hasSecrets ? 'Has secrets defined' : 'Missing secrets'
      });
    }
    
  } catch (error) {
    results.push({
      file: filename,
      rule: 'yamlParsing',
      passed: false,
      message: `YAML parsing error: ${error.message}`
    });
  }
  
  return results;
}

function main() {
  console.log('🔍 Validating reusable GitHub workflows...\n');
  
  // Check if reusable directory exists
  if (!fs.existsSync(REUSABLE_DIR)) {
    console.error('❌ Reusable workflows directory not found:', REUSABLE_DIR);
    process.exit(1);
  }
  
  let allPassed = true;
  const allResults = [];
  
  // Check for required workflow files
  for (const requiredFile of REQUIRED_WORKFLOWS) {
    const filePath = path.join(REUSABLE_DIR, requiredFile);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Required workflow file missing: ${requiredFile}`);
      allPassed = false;
      continue;
    }
    
    console.log(`📋 Validating ${requiredFile}...`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    const results = validateWorkflow(filePath, content);
    allResults.push(...results);
    
    // Print results for this file
    results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`   ${icon} ${result.rule}: ${result.message}`);
      if (!result.passed) allPassed = false;
    });
    
    console.log('');
  }
  
  // Summary
  const totalChecks = allResults.length;
  const passedChecks = allResults.filter(r => r.passed).length;
  const failedChecks = totalChecks - passedChecks;
  
  console.log('📊 Validation Summary:');
  console.log(`   Total checks: ${totalChecks}`);
  console.log(`   ✅ Passed: ${passedChecks}`);
  console.log(`   ❌ Failed: ${failedChecks}`);
  
  if (allPassed) {
    console.log('\n🎉 All reusable workflows are valid!');
    process.exit(0);
  } else {
    console.log('\n💥 Some workflows have validation errors. Please fix them before using.');
    process.exit(1);
  }
}

// Check if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { validateWorkflow, VALIDATION_RULES };