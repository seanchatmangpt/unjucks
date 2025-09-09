#!/usr/bin/env node

/**
 * GitHub Actions Workflow Analyzer for Act Compatibility
 * 
 * This script analyzes all GitHub Actions workflows for act compatibility
 * and identifies potential issues with local testing.
 * 
 * @author Act Compatibility Engineering Team
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WorkflowAnalyzer {
  constructor() {
    this.workflows = [];
    this.compatibility = {
      supported: [],
      partiallySupported: [],
      unsupported: [],
      issues: []
    };
    this.actLimitations = {
      'github-script': 'Act has limited GitHub API access',
      'workflow_dispatch': 'Manual trigger not fully supported',
      'schedule': 'Cron jobs not supported in act',
      'repository_dispatch': 'External webhooks not supported',
      'deployment': 'GitHub deployments API limited',
      'pages': 'GitHub Pages deployment not supported',
      'release': 'Release events require manual simulation'
    };
  }

  async analyzeWorkflows() {
    console.log('🔍 Analyzing GitHub Actions workflows for act compatibility...');
    
    const workflowsDir = path.join(process.cwd(), '.github/workflows');
    
    try {
      const files = await fs.readdir(workflowsDir);
      const yamlFiles = files.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
      
      console.log(`Found ${yamlFiles.length} workflow files`);
      
      for (const file of yamlFiles) {
        await this.analyzeWorkflow(path.join(workflowsDir, file));
      }
      
      this.generateCompatibilityReport();
      return this.compatibility;
      
    } catch (error) {
      console.error('Error analyzing workflows:', error);
      throw error;
    }
  }

  async analyzeWorkflow(filePath) {
    const filename = path.basename(filePath);
    console.log(`📄 Analyzing ${filename}...`);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const workflow = yaml.parse(content);
      
      const analysis = {
        name: workflow.name || filename,
        file: filename,
        triggers: this.analyzeTriggers(workflow.on),
        jobs: this.analyzeJobs(workflow.jobs),
        compatibility: 'supported',
        issues: [],
        actCommand: this.generateActCommand(workflow, filename)
      };
      
      // Determine overall compatibility
      if (analysis.issues.length === 0) {
        analysis.compatibility = 'supported';
        this.compatibility.supported.push(analysis);
      } else if (analysis.issues.some(i => i.severity === 'high')) {
        analysis.compatibility = 'unsupported';
        this.compatibility.unsupported.push(analysis);
      } else {
        analysis.compatibility = 'partially-supported';
        this.compatibility.partiallySupported.push(analysis);
      }
      
      this.workflows.push(analysis);
      
    } catch (error) {
      console.error(`Error analyzing ${filename}:`, error);
      this.compatibility.issues.push({
        file: filename,
        error: error.message
      });
    }
  }

  analyzeTriggers(triggers) {
    const analysis = {
      supported: [],
      unsupported: [],
      issues: []
    };
    
    if (typeof triggers === 'string') {
      triggers = [triggers];
    }
    
    if (Array.isArray(triggers)) {
      triggers = triggers.reduce((acc, trigger) => {
        acc[trigger] = true;
        return acc;
      }, {});
    }
    
    Object.keys(triggers || {}).forEach(trigger => {
      switch (trigger) {
        case 'push':
        case 'pull_request':
        case 'workflow_dispatch':
          analysis.supported.push(trigger);
          break;
        case 'schedule':
        case 'repository_dispatch':
        case 'release':
        case 'deployment':
          analysis.unsupported.push(trigger);
          analysis.issues.push({
            type: 'trigger',
            trigger,
            severity: 'medium',
            message: this.actLimitations[trigger] || `${trigger} trigger has limited act support`
          });
          break;
        default:
          analysis.issues.push({
            type: 'trigger',
            trigger,
            severity: 'low',
            message: `Unknown trigger compatibility: ${trigger}`
          });
      }
    });
    
    return analysis;
  }

  analyzeJobs(jobs) {
    const analysis = {
      totalJobs: Object.keys(jobs || {}).length,
      matrixJobs: 0,
      serviceJobs: 0,
      containerJobs: 0,
      issues: []
    };
    
    Object.entries(jobs || {}).forEach(([jobId, job]) => {
      // Check for matrix strategy
      if (job.strategy?.matrix) {
        analysis.matrixJobs++;
        analysis.issues.push({
          type: 'matrix',
          job: jobId,
          severity: 'low',
          message: 'Matrix builds may have limited parallelism in act'
        });
      }
      
      // Check for services
      if (job.services) {
        analysis.serviceJobs++;
        analysis.issues.push({
          type: 'services',
          job: jobId,
          severity: 'medium',
          message: 'Service containers require Docker network configuration'
        });
      }
      
      // Check for container jobs
      if (job.container) {
        analysis.containerJobs++;
        analysis.issues.push({
          type: 'container',
          job: jobId,
          severity: 'low',
          message: 'Container jobs require additional act configuration'
        });
      }
      
      // Check for unsupported actions
      this.analyzeJobSteps(job.steps || [], jobId, analysis);
    });
    
    return analysis;
  }

  analyzeJobSteps(steps, jobId, analysis) {
    steps.forEach((step, index) => {
      if (step.uses) {
        const action = step.uses;
        
        // Check for problematic actions
        if (action.includes('github-script')) {
          analysis.issues.push({
            type: 'action',
            job: jobId,
            step: index,
            severity: 'high',
            message: 'github-script action has limited GitHub API access in act'
          });
        }
        
        if (action.includes('deploy') || action.includes('pages')) {
          analysis.issues.push({
            type: 'action',
            job: jobId,
            step: index,
            severity: 'high',
            message: 'Deployment actions not supported in act'
          });
        }
        
        if (action.includes('codecov') || action.includes('sonarqube')) {
          analysis.issues.push({
            type: 'action',
            job: jobId,
            step: index,
            severity: 'medium',
            message: 'External service integrations require API keys'
          });
        }
      }
    });
  }

  generateActCommand(workflow, filename) {
    const workflowName = filename.replace(/\.ya?ml$/, '');
    const baseCommand = `act`;
    const options = [];
    
    // Add platform mappings
    options.push('--platform ubuntu-latest=catthehacker/ubuntu:act-latest');
    
    // Add artifact server
    options.push('--artifact-server-path /tmp/artifacts');
    
    // Add reuse flag for faster runs
    options.push('--reuse');
    
    // Add workflow-specific options
    if (workflow.jobs) {
      Object.values(workflow.jobs).forEach(job => {
        if (job.services) {
          options.push('--bind');
        }
        if (job.strategy?.matrix) {
          options.push('--matrix');
        }
      });
    }
    
    // Generate different trigger commands
    const commands = {
      push: `${baseCommand} push ${options.join(' ')} -W .github/workflows/${filename}`,
      pull_request: `${baseCommand} pull_request ${options.join(' ')} -W .github/workflows/${filename}`,
      workflow_dispatch: `${baseCommand} workflow_dispatch ${options.join(' ')} -W .github/workflows/${filename}`,
      manual: `${baseCommand} ${options.join(' ')} -W .github/workflows/${filename}`
    };
    
    return commands;
  }

  generateCompatibilityReport() {
    const report = {
      summary: {
        total: this.workflows.length,
        supported: this.compatibility.supported.length,
        partiallySupported: this.compatibility.partiallySupported.length,
        unsupported: this.compatibility.unsupported.length,
        issues: this.compatibility.issues.length
      },
      compatibility: this.compatibility,
      recommendations: this.generateRecommendations()
    };
    
    console.log('\n📊 Act Compatibility Report:');
    console.log(`✅ Fully Supported: ${report.summary.supported}`);
    console.log(`⚠️  Partially Supported: ${report.summary.partiallySupported}`);
    console.log(`❌ Unsupported: ${report.summary.unsupported}`);
    console.log(`🐛 Parse Errors: ${report.summary.issues}`);
    
    return report;
  }

  generateRecommendations() {
    return [
      {
        category: 'Setup',
        recommendations: [
          'Install act: brew install act (macOS) or follow https://github.com/nektos/act#installation',
          'Configure .actrc file with platform mappings and default options',
          'Set up secrets file for workflows requiring authentication'
        ]
      },
      {
        category: 'Testing',
        recommendations: [
          'Test workflows individually before running full suites',
          'Use --dry-run flag to validate workflow syntax',
          'Monitor resource usage during matrix builds'
        ]
      },
      {
        category: 'Workarounds',
        recommendations: [
          'Mock external API calls in act environment',
          'Use environment variables to skip deployment steps',
          'Replace github-script actions with bash equivalents'
        ]
      }
    ];
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const analyzer = new WorkflowAnalyzer();
  
  analyzer.analyzeWorkflows()
    .then(report => {
      // Write report to file
      const reportPath = path.join(process.cwd(), 'docs/act-testing/compatibility-report.json');
      return fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    })
    .then(() => {
      console.log('\n✅ Analysis complete! Report saved to docs/act-testing/compatibility-report.json');
    })
    .catch(error => {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    });
}

export { WorkflowAnalyzer };