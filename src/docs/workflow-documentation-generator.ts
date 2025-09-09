/**
 * Workflow Documentation Generator
 * Automatically generates comprehensive documentation from GitHub Actions YAML files
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { parse as parseYaml } from 'yaml';
import { mkdirSync } from 'fs';

export interface WorkflowStep {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, any>;
  env?: Record<string, string>;
  if?: string;
  id?: string;
}

export interface WorkflowJob {
  name?: string;
  'runs-on'?: string | string[];
  needs?: string | string[];
  if?: string;
  strategy?: {
    matrix?: Record<string, any>;
    'fail-fast'?: boolean;
  };
  steps: WorkflowStep[];
  environment?: string | { name: string; url?: string };
  concurrency?: string | { group: string; 'cancel-in-progress'?: boolean };
}

export interface WorkflowDefinition {
  name?: string;
  on: any;
  jobs: Record<string, WorkflowJob>;
  env?: Record<string, string>;
  defaults?: {
    run?: {
      shell?: string;
      'working-directory'?: string;
    };
  };
  concurrency?: string | { group: string; 'cancel-in-progress'?: boolean };
}

export interface DocumentationConfig {
  inputDir: string;
  outputDir: string;
  templateDir?: string;
  includeMetrics?: boolean;
  includeCompliance?: boolean;
  generateDiagrams?: boolean;
}

export class WorkflowDocumentationGenerator {
  private config: DocumentationConfig;

  constructor(config: DocumentationConfig) {
    this.config = config;
    this.ensureOutputDirectory();
  }

  private ensureOutputDirectory(): void {
    try {
      mkdirSync(this.config.outputDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  public generateDocumentation(): void {
    console.log('🔄 Starting workflow documentation generation...');
    
    const workflowFiles = this.findWorkflowFiles();
    const workflows: Record<string, WorkflowDefinition> = {};

    // Parse all workflow files
    for (const file of workflowFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const workflow = parseYaml(content) as WorkflowDefinition;
        const filename = basename(file, extname(file));
        workflows[filename] = workflow;
        console.log(`✅ Parsed workflow: ${filename}`);
      } catch (error) {
        console.error(`❌ Error parsing ${file}:`, error);
      }
    }

    // Generate documentation for each workflow
    for (const [filename, workflow] of Object.entries(workflows)) {
      this.generateWorkflowDoc(filename, workflow);
    }

    // Generate overview documentation
    this.generateOverviewDoc(workflows);

    // Generate compliance mapping if enabled
    if (this.config.includeCompliance) {
      this.generateComplianceMapping(workflows);
    }

    // Generate metrics if enabled
    if (this.config.includeMetrics) {
      this.generateMetricsDoc(workflows);
    }

    console.log('✅ Documentation generation complete!');
  }

  private findWorkflowFiles(): string[] {
    const workflowDirs = [
      join(process.cwd(), '.github/workflows'),
      join(this.config.inputDir, 'workflows'),
      this.config.inputDir
    ];

    const workflowFiles: string[] = [];

    for (const dir of workflowDirs) {
      try {
        const files = readdirSync(dir);
        for (const file of files) {
          const fullPath = join(dir, file);
          const stat = statSync(fullPath);
          
          if (stat.isFile() && (file.endsWith('.yml') || file.endsWith('.yaml'))) {
            workflowFiles.push(fullPath);
          }
        }
      } catch (error) {
        // Directory might not exist
      }
    }

    return workflowFiles;
  }

  private generateWorkflowDoc(filename: string, workflow: WorkflowDefinition): void {
    const docContent = this.buildWorkflowMarkdown(filename, workflow);
    const outputPath = join(this.config.outputDir, `${filename}.md`);
    writeFileSync(outputPath, docContent, 'utf-8');
    console.log(`📝 Generated documentation: ${outputPath}`);
  }

  private buildWorkflowMarkdown(filename: string, workflow: WorkflowDefinition): string {
    let markdown = `# ${workflow.name || filename}\n\n`;

    // Workflow overview
    markdown += `## Overview\n\n`;
    markdown += `**Workflow File:** \`.github/workflows/${filename}.yml\`\n\n`;

    // Triggers
    markdown += `## Triggers\n\n`;
    markdown += this.formatTriggers(workflow.on);

    // Environment Variables
    if (workflow.env) {
      markdown += `## Environment Variables\n\n`;
      markdown += this.formatEnvironmentVariables(workflow.env);
    }

    // Jobs
    markdown += `## Jobs\n\n`;
    for (const [jobId, job] of Object.entries(workflow.jobs)) {
      markdown += this.formatJob(jobId, job);
    }

    // Compliance notes
    if (this.config.includeCompliance) {
      markdown += `## Compliance Notes\n\n`;
      markdown += this.generateComplianceNotes(workflow);
    }

    // Security considerations
    markdown += `## Security Considerations\n\n`;
    markdown += this.generateSecurityNotes(workflow);

    // Troubleshooting
    markdown += `## Troubleshooting\n\n`;
    markdown += this.generateTroubleshootingGuide(workflow);

    return markdown;
  }

  private formatTriggers(triggers: any): string {
    let content = '';

    if (typeof triggers === 'string') {
      content += `- **${triggers}**\n`;
    } else if (Array.isArray(triggers)) {
      for (const trigger of triggers) {
        content += `- **${trigger}**\n`;
      }
    } else if (typeof triggers === 'object') {
      for (const [event, config] of Object.entries(triggers)) {
        content += `- **${event}**\n`;
        if (config && typeof config === 'object') {
          content += this.formatTriggerConfig(config as Record<string, any>, 2);
        }
      }
    }

    return content + '\n';
  }

  private formatTriggerConfig(config: Record<string, any>, indent: number): string {
    let content = '';
    const spaces = '  '.repeat(indent);

    for (const [key, value] of Object.entries(config)) {
      if (Array.isArray(value)) {
        content += `${spaces}- **${key}:** ${value.join(', ')}\n`;
      } else if (typeof value === 'object') {
        content += `${spaces}- **${key}:**\n`;
        content += this.formatTriggerConfig(value, indent + 1);
      } else {
        content += `${spaces}- **${key}:** ${value}\n`;
      }
    }

    return content;
  }

  private formatEnvironmentVariables(env: Record<string, string>): string {
    let content = '| Variable | Value |\n|----------|-------|\n';

    for (const [key, value] of Object.entries(env)) {
      // Mask sensitive values
      const displayValue = this.maskSensitiveValue(key, value);
      content += `| \`${key}\` | \`${displayValue}\` |\n`;
    }

    return content + '\n';
  }

  private maskSensitiveValue(key: string, value: string): string {
    const sensitivePatterns = [
      /token/i, /key/i, /secret/i, /password/i, /credential/i, /auth/i
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(key) && !value.startsWith('${{')) {
        return '***MASKED***';
      }
    }

    return value;
  }

  private formatJob(jobId: string, job: WorkflowJob): string {
    let content = `### ${job.name || jobId}\n\n`;

    // Job metadata
    content += `**Job ID:** \`${jobId}\`\n`;
    content += `**Runs on:** \`${Array.isArray(job['runs-on']) ? job['runs-on'].join(', ') : job['runs-on']}\`\n`;

    if (job.needs) {
      const needs = Array.isArray(job.needs) ? job.needs.join(', ') : job.needs;
      content += `**Depends on:** \`${needs}\`\n`;
    }

    if (job.if) {
      content += `**Condition:** \`${job.if}\`\n`;
    }

    if (job.environment) {
      const env = typeof job.environment === 'string' ? job.environment : job.environment.name;
      content += `**Environment:** \`${env}\`\n`;
    }

    content += '\n';

    // Steps
    content += `#### Steps\n\n`;
    for (let i = 0; i < job.steps.length; i++) {
      const step = job.steps[i];
      content += this.formatStep(i + 1, step);
    }

    return content + '\n';
  }

  private formatStep(index: number, step: WorkflowStep): string {
    let content = `${index}. **${step.name || `Step ${index}`}**\n`;

    if (step.uses) {
      content += `   - **Action:** \`${step.uses}\`\n`;
    }

    if (step.run) {
      content += `   - **Command:**\n     \`\`\`bash\n     ${step.run}\n     \`\`\`\n`;
    }

    if (step.with) {
      content += `   - **Parameters:**\n`;
      for (const [key, value] of Object.entries(step.with)) {
        const displayValue = this.maskSensitiveValue(key, String(value));
        content += `     - \`${key}\`: \`${displayValue}\`\n`;
      }
    }

    if (step.env) {
      content += `   - **Environment:**\n`;
      for (const [key, value] of Object.entries(step.env)) {
        const displayValue = this.maskSensitiveValue(key, value);
        content += `     - \`${key}\`: \`${displayValue}\`\n`;
      }
    }

    if (step.if) {
      content += `   - **Condition:** \`${step.if}\`\n`;
    }

    return content + '\n';
  }

  private generateComplianceNotes(workflow: WorkflowDefinition): string {
    let notes = '';

    // Check for SOX compliance indicators
    const hasAuditTrail = JSON.stringify(workflow).includes('audit') || 
                         JSON.stringify(workflow).includes('log');
    if (hasAuditTrail) {
      notes += `- ✅ **SOX Compliance**: Workflow includes audit trail mechanisms\n`;
    }

    // Check for security practices
    const hasSecretManagement = JSON.stringify(workflow).includes('secrets.');
    if (hasSecretManagement) {
      notes += `- ✅ **Security**: Uses GitHub Secrets for sensitive data\n`;
    }

    // Check for approval processes
    const hasEnvironment = Object.values(workflow.jobs).some(job => job.environment);
    if (hasEnvironment) {
      notes += `- ✅ **Compliance**: Uses environment protection rules\n`;
    }

    return notes + '\n';
  }

  private generateSecurityNotes(workflow: WorkflowDefinition): string {
    let notes = '';

    // Check for third-party actions
    const thirdPartyActions = new Set<string>();
    for (const job of Object.values(workflow.jobs)) {
      for (const step of job.steps) {
        if (step.uses && !step.uses.startsWith('actions/')) {
          thirdPartyActions.add(step.uses);
        }
      }
    }

    if (thirdPartyActions.size > 0) {
      notes += `### Third-party Actions\n\n`;
      notes += `This workflow uses the following third-party actions. Ensure they are from trusted sources:\n\n`;
      for (const action of thirdPartyActions) {
        notes += `- \`${action}\`\n`;
      }
      notes += '\n';
    }

    // Check for write permissions
    const workflowStr = JSON.stringify(workflow);
    if (workflowStr.includes('contents: write') || workflowStr.includes('permissions')) {
      notes += `### Permissions\n\n`;
      notes += `This workflow requests write permissions. Review the necessity and scope of these permissions.\n\n`;
    }

    return notes;
  }

  private generateTroubleshootingGuide(workflow: WorkflowDefinition): string {
    let guide = '';

    guide += `### Common Issues\n\n`;
    guide += `1. **Permission Denied Errors**\n`;
    guide += `   - Check GitHub token permissions\n`;
    guide += `   - Verify repository settings allow actions\n`;
    guide += `   - Ensure secrets are properly configured\n\n`;

    guide += `2. **Environment Failures**\n`;
    guide += `   - Verify environment variables are set\n`;
    guide += `   - Check environment protection rules\n`;
    guide += `   - Ensure required approvals are obtained\n\n`;

    guide += `3. **Dependency Issues**\n`;
    guide += `   - Check if dependent jobs completed successfully\n`;
    guide += `   - Verify matrix builds are configured correctly\n`;
    guide += `   - Ensure runner compatibility\n\n`;

    return guide;
  }

  private generateOverviewDoc(workflows: Record<string, WorkflowDefinition>): void {
    let content = `# Workflow Documentation Overview\n\n`;
    content += `This documentation was automatically generated from GitHub Actions workflow files.\n\n`;
    content += `## Available Workflows\n\n`;

    for (const [filename, workflow] of Object.entries(workflows)) {
      content += `### [${workflow.name || filename}](${filename}.md)\n\n`;
      
      // Brief description based on triggers
      const triggers = this.extractTriggerSummary(workflow.on);
      content += `**Triggers:** ${triggers}\n`;
      
      const jobCount = Object.keys(workflow.jobs).length;
      content += `**Jobs:** ${jobCount}\n\n`;
    }

    // Workflow dependency graph
    content += `## Workflow Dependencies\n\n`;
    content += this.generateDependencyGraph(workflows);

    const outputPath = join(this.config.outputDir, 'README.md');
    writeFileSync(outputPath, content, 'utf-8');
    console.log(`📝 Generated overview: ${outputPath}`);
  }

  private extractTriggerSummary(triggers: any): string {
    if (typeof triggers === 'string') {
      return triggers;
    } else if (Array.isArray(triggers)) {
      return triggers.join(', ');
    } else if (typeof triggers === 'object') {
      return Object.keys(triggers).join(', ');
    }
    return 'unknown';
  }

  private generateDependencyGraph(workflows: Record<string, WorkflowDefinition>): string {
    let graph = '```mermaid\ngraph TD\n';

    for (const [filename, workflow] of Object.entries(workflows)) {
      const workflowNode = filename.replace(/[^a-zA-Z0-9]/g, '_');
      graph += `  ${workflowNode}["${workflow.name || filename}"]\n`;

      // Add job dependencies within workflow
      for (const [jobId, job] of Object.entries(workflow.jobs)) {
        const jobNode = `${workflowNode}_${jobId}`;
        graph += `  ${jobNode}["${job.name || jobId}"]\n`;
        graph += `  ${workflowNode} --> ${jobNode}\n`;

        if (job.needs) {
          const needs = Array.isArray(job.needs) ? job.needs : [job.needs];
          for (const need of needs) {
            const needNode = `${workflowNode}_${need}`;
            graph += `  ${needNode} --> ${jobNode}\n`;
          }
        }
      }
    }

    graph += '```\n\n';
    return graph;
  }

  private generateComplianceMapping(workflows: Record<string, WorkflowDefinition>): void {
    let content = `# Compliance Mapping\n\n`;
    content += `This document maps workflows to compliance requirements.\n\n`;

    // SOX Compliance
    content += `## SOX Compliance\n\n`;
    content += `| Workflow | Section 302 | Section 404 | Section 409 | Audit Trail |\n`;
    content += `|----------|-------------|-------------|-------------|-------------|\n`;

    for (const [filename, workflow] of Object.entries(workflows)) {
      const sox302 = this.checkSOXCompliance(workflow, '302');
      const sox404 = this.checkSOXCompliance(workflow, '404');
      const sox409 = this.checkSOXCompliance(workflow, '409');
      const auditTrail = this.checkAuditTrail(workflow);

      content += `| ${filename} | ${sox302} | ${sox404} | ${sox409} | ${auditTrail} |\n`;
    }

    // GDPR Compliance
    content += `\n## GDPR Compliance\n\n`;
    content += `| Workflow | Data Processing | Privacy Controls | Retention | Data Subject Rights |\n`;
    content += `|----------|-----------------|------------------|-----------|--------------------|\n`;

    for (const [filename, workflow] of Object.entries(workflows)) {
      const dataProcessing = this.checkGDPRDataProcessing(workflow);
      const privacyControls = this.checkGDPRPrivacyControls(workflow);
      const retention = this.checkGDPRRetention(workflow);
      const dataSubjectRights = this.checkGDPRDataSubjectRights(workflow);

      content += `| ${filename} | ${dataProcessing} | ${privacyControls} | ${retention} | ${dataSubjectRights} |\n`;
    }

    const outputPath = join(this.config.outputDir, 'compliance-mapping.md');
    writeFileSync(outputPath, content, 'utf-8');
    console.log(`📝 Generated compliance mapping: ${outputPath}`);
  }

  private checkSOXCompliance(workflow: WorkflowDefinition, section: string): string {
    const workflowStr = JSON.stringify(workflow);
    
    switch (section) {
      case '302':
        return workflowStr.includes('audit') || workflowStr.includes('sign') ? '✅' : '❌';
      case '404':
        return workflowStr.includes('control') || workflowStr.includes('test') ? '✅' : '❌';
      case '409':
        return workflowStr.includes('deploy') || workflowStr.includes('release') ? '✅' : '❌';
      default:
        return '❌';
    }
  }

  private checkAuditTrail(workflow: WorkflowDefinition): string {
    const workflowStr = JSON.stringify(workflow);
    return workflowStr.includes('log') || workflowStr.includes('audit') || 
           workflowStr.includes('record') ? '✅' : '❌';
  }

  private checkGDPRDataProcessing(workflow: WorkflowDefinition): string {
    const workflowStr = JSON.stringify(workflow);
    return workflowStr.includes('data') || workflowStr.includes('personal') ? '⚠️' : '✅';
  }

  private checkGDPRPrivacyControls(workflow: WorkflowDefinition): string {
    const workflowStr = JSON.stringify(workflow);
    return workflowStr.includes('encrypt') || workflowStr.includes('secure') ? '✅' : '❌';
  }

  private checkGDPRRetention(workflow: WorkflowDefinition): string {
    const workflowStr = JSON.stringify(workflow);
    return workflowStr.includes('retention') || workflowStr.includes('delete') ? '✅' : '❌';
  }

  private checkGDPRDataSubjectRights(workflow: WorkflowDefinition): string {
    const workflowStr = JSON.stringify(workflow);
    return workflowStr.includes('export') || workflowStr.includes('delete') || 
           workflowStr.includes('portability') ? '✅' : '❌';
  }

  private generateMetricsDoc(workflows: Record<string, WorkflowDefinition>): void {
    let content = `# Workflow Metrics\n\n`;
    content += `This document provides metrics and analytics for all workflows.\n\n`;

    // Complexity metrics
    content += `## Complexity Metrics\n\n`;
    content += `| Workflow | Jobs | Steps | Complexity Score |\n`;
    content += `|----------|------|-------|------------------|\n`;

    for (const [filename, workflow] of Object.entries(workflows)) {
      const jobCount = Object.keys(workflow.jobs).length;
      const stepCount = Object.values(workflow.jobs).reduce((sum, job) => sum + job.steps.length, 0);
      const complexityScore = this.calculateComplexityScore(workflow);

      content += `| ${filename} | ${jobCount} | ${stepCount} | ${complexityScore} |\n`;
    }

    // Security metrics
    content += `\n## Security Metrics\n\n`;
    content += `| Workflow | Third-party Actions | Secrets Used | Write Permissions |\n`;
    content += `|----------|-------------------|---------------|-------------------|\n`;

    for (const [filename, workflow] of Object.entries(workflows)) {
      const thirdPartyCount = this.countThirdPartyActions(workflow);
      const secretsCount = this.countSecretsUsed(workflow);
      const hasWritePerms = this.hasWritePermissions(workflow);

      content += `| ${filename} | ${thirdPartyCount} | ${secretsCount} | ${hasWritePerms ? '⚠️' : '✅'} |\n`;
    }

    const outputPath = join(this.config.outputDir, 'metrics.md');
    writeFileSync(outputPath, content, 'utf-8');
    console.log(`📝 Generated metrics: ${outputPath}`);
  }

  private calculateComplexityScore(workflow: WorkflowDefinition): number {
    let score = 0;
    
    // Base score for jobs
    score += Object.keys(workflow.jobs).length * 2;
    
    // Score for steps
    for (const job of Object.values(workflow.jobs)) {
      score += job.steps.length;
      
      // Additional complexity for conditions
      if (job.if) score += 1;
      if (job.strategy?.matrix) score += 2;
      
      // Step complexity
      for (const step of job.steps) {
        if (step.if) score += 1;
        if (step.uses) score += 1;
        if (step.run && step.run.includes('|')) score += 1; // Multi-line scripts
      }
    }
    
    return score;
  }

  private countThirdPartyActions(workflow: WorkflowDefinition): number {
    let count = 0;
    
    for (const job of Object.values(workflow.jobs)) {
      for (const step of job.steps) {
        if (step.uses && !step.uses.startsWith('actions/')) {
          count++;
        }
      }
    }
    
    return count;
  }

  private countSecretsUsed(workflow: WorkflowDefinition): number {
    const workflowStr = JSON.stringify(workflow);
    const secretMatches = workflowStr.match(/secrets\./g);
    return secretMatches ? secretMatches.length : 0;
  }

  private hasWritePermissions(workflow: WorkflowDefinition): boolean {
    const workflowStr = JSON.stringify(workflow);
    return workflowStr.includes('contents: write') || 
           workflowStr.includes('pull-requests: write') ||
           workflowStr.includes('issues: write');
  }
}

// CLI interface
if (require.main === module) {
  const config: DocumentationConfig = {
    inputDir: process.env.INPUT_DIR || '.github/workflows',
    outputDir: process.env.OUTPUT_DIR || 'docs/workflows',
    includeMetrics: process.env.INCLUDE_METRICS === 'true',
    includeCompliance: process.env.INCLUDE_COMPLIANCE === 'true',
    generateDiagrams: process.env.GENERATE_DIAGRAMS === 'true'
  };

  const generator = new WorkflowDocumentationGenerator(config);
  generator.generateDocumentation();
}