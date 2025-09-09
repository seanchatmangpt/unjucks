#!/usr/bin/env node

/**
 * GitHub Actions Workflow Validation Script
 * Validates YAML syntax and workflow configuration
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workflowsDir = join(__dirname, '../.github/workflows');

class WorkflowValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.validated = 0;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '🔍',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }[type];
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  validateYamlSyntax(filePath, content) {
    try {
      const parsed = yaml.parse(content);
      this.log(`YAML syntax valid: ${filePath}`, 'success');
      return parsed;
    } catch (error) {
      const message = `YAML syntax error in ${filePath}: ${error.message}`;
      this.errors.push(message);
      this.log(message, 'error');
      return null;
    }
  }

  validateWorkflowStructure(filePath, workflow) {
    if (!workflow) return false;

    const required = ['name', 'on', 'jobs'];
    const missing = required.filter(field => !workflow[field]);
    
    if (missing.length > 0) {
      const message = `Missing required fields in ${filePath}: ${missing.join(', ')}`;
      this.errors.push(message);
      this.log(message, 'error');
      return false;
    }

    this.log(`Workflow structure valid: ${filePath}`, 'success');
    return true;
  }

  validateJobs(filePath, jobs) {
    if (!jobs || typeof jobs !== 'object') {
      const message = `Invalid jobs configuration in ${filePath}`;
      this.errors.push(message);
      this.log(message, 'error');
      return false;
    }

    let jobsValid = true;
    for (const [jobId, job] of Object.entries(jobs)) {
      if (!job.steps) {
        const message = `Job '${jobId}' missing steps in ${filePath}`;
        this.errors.push(message);
        this.log(message, 'error');
        jobsValid = false;
      }

      if (!job['runs-on']) {
        const message = `Job '${jobId}' missing runs-on in ${filePath}`;
        this.errors.push(message);
        this.log(message, 'error');
        jobsValid = false;
      }

      // Validate timeout
      if (job['timeout-minutes'] && job['timeout-minutes'] > 360) {
        const message = `Job '${jobId}' has excessive timeout (${job['timeout-minutes']}min) in ${filePath}`;
        this.warnings.push(message);
        this.log(message, 'warning');
      }
    }

    if (jobsValid) {
      this.log(`Jobs configuration valid: ${filePath}`, 'success');
    }
    return jobsValid;
  }

  validateTriggers(filePath, triggers) {
    if (!triggers || typeof triggers !== 'object') {
      const message = `Invalid triggers configuration in ${filePath}`;
      this.errors.push(message);
      this.log(message, 'error');
      return false;
    }

    // Check for common trigger patterns
    const validTriggers = [
      'push', 'pull_request', 'workflow_dispatch', 'schedule',
      'release', 'create', 'delete', 'issues', 'pull_request_target'
    ];

    const invalidTriggers = Object.keys(triggers).filter(
      trigger => !validTriggers.includes(trigger)
    );

    if (invalidTriggers.length > 0) {
      const message = `Unknown triggers in ${filePath}: ${invalidTriggers.join(', ')}`;
      this.warnings.push(message);
      this.log(message, 'warning');
    }

    this.log(`Triggers configuration valid: ${filePath}`, 'success');
    return true;
  }

  validateSecrets(filePath, workflow) {
    const content = JSON.stringify(workflow);
    const secretPattern = /\$\{\{\s*secrets\.([A-Z_]+)\s*\}\}/g;
    const secrets = [];
    let match;

    while ((match = secretPattern.exec(content)) !== null) {
      secrets.push(match[1]);
    }

    if (secrets.length > 0) {
      this.log(`Secrets found in ${filePath}: ${secrets.join(', ')}`, 'info');
      
      // Check for common required secrets
      const requiredSecrets = ['GITHUB_TOKEN', 'NPM_TOKEN'];
      const hasRequired = requiredSecrets.some(secret => secrets.includes(secret));
      
      if (!hasRequired && secrets.length > 0) {
        const message = `Consider using standard secrets (GITHUB_TOKEN, NPM_TOKEN) in ${filePath}`;
        this.warnings.push(message);
        this.log(message, 'warning');
      }
    }

    return true;
  }

  validateEnvironments(filePath, workflow) {
    const content = JSON.stringify(workflow);
    const envPattern = /environment:\s*\n?\s*name:\s*([a-zA-Z0-9_-]+)/g;
    const environments = [];
    let match;

    while ((match = envPattern.exec(content)) !== null) {
      environments.push(match[1]);
    }

    if (environments.length > 0) {
      this.log(`Environments found in ${filePath}: ${environments.join(', ')}`, 'info');
      
      // Validate environment naming
      const validEnvs = ['development', 'staging', 'production', 'testing'];
      const invalidEnvs = environments.filter(env => 
        !validEnvs.some(valid => env.includes(valid))
      );

      if (invalidEnvs.length > 0) {
        const message = `Non-standard environment names in ${filePath}: ${invalidEnvs.join(', ')}`;
        this.warnings.push(message);
        this.log(message, 'warning');
      }
    }

    return true;
  }

  validateWorkflowFile(filePath) {
    this.log(`Validating workflow: ${filePath}`);
    
    try {
      const content = readFileSync(filePath, 'utf8');
      const workflow = this.validateYamlSyntax(filePath, content);
      
      if (!workflow) return false;

      const isValid = 
        this.validateWorkflowStructure(filePath, workflow) &&
        this.validateJobs(filePath, workflow.jobs) &&
        this.validateTriggers(filePath, workflow.on);

      // Additional validations
      this.validateSecrets(filePath, workflow);
      this.validateEnvironments(filePath, workflow);

      if (isValid) {
        this.validated++;
        this.log(`✅ Workflow validation passed: ${filePath}`, 'success');
      }

      return isValid;
    } catch (error) {
      const message = `Error reading workflow file ${filePath}: ${error.message}`;
      this.errors.push(message);
      this.log(message, 'error');
      return false;
    }
  }

  validateNewWorkflows() {
    const newWorkflows = [
      'deployment-production.yml',
      'npm-publish.yml',
      'docker-deployment.yml',
      'environment-deployment.yml'
    ];

    this.log('🚀 Validating new deployment workflows...');
    
    let allValid = true;
    for (const workflow of newWorkflows) {
      const filePath = join(workflowsDir, workflow);
      const isValid = this.validateWorkflowFile(filePath);
      allValid = allValid && isValid;
    }

    return allValid;
  }

  validateAllWorkflows() {
    this.log('🔍 Validating all GitHub Actions workflows...');
    
    try {
      const workflowFiles = readdirSync(workflowsDir)
        .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));

      let allValid = true;
      for (const file of workflowFiles) {
        const filePath = join(workflowsDir, file);
        const isValid = this.validateWorkflowFile(filePath);
        allValid = allValid && isValid;
      }

      return allValid;
    } catch (error) {
      this.log(`Error reading workflows directory: ${error.message}`, 'error');
      return false;
    }
  }

  generateReport() {
    this.log('\n📊 Validation Report');
    this.log('==================');
    this.log(`Workflows validated: ${this.validated}`);
    this.log(`Errors: ${this.errors.length}`);
    this.log(`Warnings: ${this.warnings.length}`);

    if (this.errors.length > 0) {
      this.log('\n❌ Errors:', 'error');
      this.errors.forEach((error, index) => {
        this.log(`${index + 1}. ${error}`, 'error');
      });
    }

    if (this.warnings.length > 0) {
      this.log('\n⚠️ Warnings:', 'warning');
      this.warnings.forEach((warning, index) => {
        this.log(`${index + 1}. ${warning}`, 'warning');
      });
    }

    const success = this.errors.length === 0;
    if (success) {
      this.log('\n🎉 All workflows passed validation!', 'success');
    } else {
      this.log('\n💥 Workflow validation failed!', 'error');
    }

    return success;
  }
}

// Main execution
async function main() {
  const validator = new WorkflowValidator();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const validateAll = args.includes('--all');
  const validateNew = args.includes('--new') || !validateAll;

  let success;
  if (validateAll) {
    success = validator.validateAllWorkflows();
  } else {
    success = validator.validateNewWorkflows();
  }

  const reportSuccess = validator.generateReport();
  
  process.exit(success && reportSuccess ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Validation script failed:', error);
    process.exit(1);
  });
}

export default WorkflowValidator;