#!/usr/bin/env node

/**
 * GitHub Actions Failure Analysis Script
 * Analyzes workflow failures and generates structured data for issue creation
 */

import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

class FailureAnalyzer {
  constructor(options = {}) {
    this.workflowId = options.workflowId;
    this.workflowName = options.workflowName;
    this.runUrl = options.runUrl;
    this.headSha = options.headSha;
    this.conclusion = options.conclusion;
  }

  async analyze() {
    console.log(`🔍 Analyzing failure for workflow: ${this.workflowName}`);
    
    const analysis = {
      id: `failure-${Date.now()}`,
      timestamp: new Date().toISOString(),
      workflow_id: this.workflowId,
      workflow_name: this.workflowName,
      run_url: this.runUrl,
      head_sha: this.headSha,
      conclusion: this.conclusion,
      summary: '',
      error_type: '',
      category: '',
      issues: [],
      recommendations: [],
      logs_preview: '',
      duration: '',
      success_rate: '',
      pattern: '',
      priority: this.determinePriority(),
      suggested_assignees: this.getSuggestedAssignees()
    };

    try {
      // Get workflow logs and analyze
      const logsPreview = await this.extractLogsPreview();
      analysis.logs_preview = logsPreview;
      
      // Analyze error patterns
      const errorAnalysis = this.analyzeErrorPatterns(logsPreview);
      analysis.error_type = errorAnalysis.type;
      analysis.category = errorAnalysis.category;
      analysis.issues = errorAnalysis.issues;
      
      // Generate recommendations
      analysis.recommendations = this.generateRecommendations(errorAnalysis);
      
      // Get historical context
      const historicalData = await this.getHistoricalContext();
      analysis.success_rate = historicalData.success_rate;
      analysis.pattern = historicalData.pattern;
      analysis.duration = historicalData.avg_duration;
      
      // Generate summary
      analysis.summary = this.generateSummary(analysis);
      
      // Save analysis
      writeFileSync('failure-analysis.json', JSON.stringify(analysis, null, 2));
      
      console.log(`✅ Failure analysis completed. Error type: ${analysis.error_type}`);
      return analysis;
      
    } catch (error) {
      console.error('❌ Failure analysis error:', error.message);
      
      // Fallback analysis
      analysis.error_type = 'unknown';
      analysis.category = 'system';
      analysis.summary = `Workflow ${this.workflowName} failed with conclusion: ${this.conclusion}`;
      analysis.recommendations = ['Investigate workflow logs manually', 'Check for system issues'];
      
      writeFileSync('failure-analysis.json', JSON.stringify(analysis, null, 2));
      return analysis;
    }
  }

  async extractLogsPreview() {
    try {
      // Use GitHub CLI to get workflow run logs
      const logs = execSync(`gh run view ${this.workflowId} --log`, { 
        encoding: 'utf8', 
        maxBuffer: 1024 * 1024 
      });
      
      // Extract last 50 lines of logs
      const logLines = logs.split('\n');
      const previewLines = logLines.slice(-50);
      
      // Filter for error/failure patterns
      const errorLines = previewLines.filter(line => 
        line.match(/error|failed|exception|timeout|abort/i)
      );
      
      return errorLines.slice(0, 20).join('\n');
      
    } catch (error) {
      return `Unable to retrieve logs: ${error.message}`;
    }
  }

  analyzeErrorPatterns(logs) {
    const patterns = {
      // Build errors
      build: /build.*failed|compilation.*error|syntax.*error/i,
      // Test failures
      test: /test.*failed|assertion.*error|expect.*received/i,
      // Dependency issues
      dependency: /npm.*error|package.*not.*found|module.*not.*found/i,
      // Network issues
      network: /network.*error|timeout|connection.*refused|dns.*error/i,
      // Security issues
      security: /security.*vulnerability|audit.*error|cve/i,
      // Resource issues
      resource: /out.*of.*memory|disk.*space|quota.*exceeded/i,
      // Permission issues
      permission: /permission.*denied|access.*denied|forbidden/i,
      // System issues
      system: /internal.*error|system.*error|platform.*error/i
    };

    const issues = [];
    let primaryType = 'unknown';
    let category = 'general';

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(logs)) {
        issues.push({
          type: type,
          description: this.getErrorDescription(type, logs),
          severity: this.getErrorSeverity(type),
          line_match: logs.split('\n').find(line => pattern.test(line)) || ''
        });
        
        if (primaryType === 'unknown') {
          primaryType = type;
          category = this.getCategoryForType(type);
        }
      }
    }

    return {
      type: primaryType,
      category: category,
      issues: issues
    };
  }

  getErrorDescription(type, logs) {
    const descriptions = {
      build: 'Build process failed during compilation or bundling',
      test: 'Test suite failed with assertion errors or test failures',
      dependency: 'Package dependency resolution or installation failed',
      network: 'Network connectivity or timeout issues encountered',
      security: 'Security vulnerabilities or audit failures detected',
      resource: 'System resource exhaustion (memory, disk, CPU)',
      permission: 'Access permission or authentication issues',
      system: 'Internal system or platform-level errors'
    };
    
    return descriptions[type] || 'Unknown error type detected';
  }

  getErrorSeverity(type) {
    const severities = {
      security: 'high',
      resource: 'high',
      build: 'medium',
      test: 'medium',
      dependency: 'medium',
      network: 'low',
      permission: 'medium',
      system: 'high'
    };
    
    return severities[type] || 'medium';
  }

  getCategoryForType(type) {
    const categories = {
      build: 'build-failure',
      test: 'test-failure',
      dependency: 'dependency-issue',
      network: 'infrastructure',
      security: 'security',
      resource: 'infrastructure',
      permission: 'configuration',
      system: 'infrastructure'
    };
    
    return categories[type] || 'general';
  }

  generateRecommendations(errorAnalysis) {
    const recommendations = [];
    
    for (const issue of errorAnalysis.issues) {
      switch (issue.type) {
        case 'build':
          recommendations.push('Check build configuration and dependencies');
          recommendations.push('Verify Node.js version compatibility');
          recommendations.push('Review recent code changes for syntax errors');
          break;
          
        case 'test':
          recommendations.push('Review failing test cases and assertions');
          recommendations.push('Check test environment configuration');
          recommendations.push('Verify test data and fixtures');
          break;
          
        case 'dependency':
          recommendations.push('Update package.json and lock files');
          recommendations.push('Clear npm cache and reinstall dependencies');
          recommendations.push('Check for package version conflicts');
          break;
          
        case 'network':
          recommendations.push('Retry the workflow run');
          recommendations.push('Check GitHub Actions service status');
          recommendations.push('Verify external service dependencies');
          break;
          
        case 'security':
          recommendations.push('Review and update vulnerable dependencies');
          recommendations.push('Run security audit and fix vulnerabilities');
          recommendations.push('Update security scanning configuration');
          break;
          
        case 'resource':
          recommendations.push('Optimize workflow resource usage');
          recommendations.push('Reduce parallel job count');
          recommendations.push('Split large jobs into smaller ones');
          break;
          
        case 'permission':
          recommendations.push('Review workflow permissions and secrets');
          recommendations.push('Check repository access settings');
          recommendations.push('Verify GitHub token scope');
          break;
          
        case 'system':
          recommendations.push('Contact GitHub Support if issue persists');
          recommendations.push('Check GitHub Actions status page');
          recommendations.push('Retry workflow after system recovery');
          break;
      }
    }
    
    // Remove duplicates and limit recommendations
    return [...new Set(recommendations)].slice(0, 8);
  }

  async getHistoricalContext() {
    try {
      // Get recent workflow runs for this workflow
      const runs = execSync(`gh run list --workflow="${this.workflowName}" --limit=20 --json conclusion,status,createdAt`, {
        encoding: 'utf8'
      });
      
      const runsData = JSON.parse(runs);
      const completedRuns = runsData.filter(run => run.conclusion);
      
      if (completedRuns.length === 0) {
        return {
          success_rate: 'Unknown',
          pattern: 'Insufficient data',
          avg_duration: 'Unknown'
        };
      }
      
      const successfulRuns = completedRuns.filter(run => run.conclusion === 'success');
      const successRate = Math.round((successfulRuns.length / completedRuns.length) * 100);
      
      // Determine failure pattern
      const recentRuns = completedRuns.slice(0, 5);
      const recentFailures = recentRuns.filter(run => run.conclusion === 'failure').length;
      
      let pattern = 'Sporadic';
      if (recentFailures >= 4) {
        pattern = 'Persistent';
      } else if (recentFailures >= 2) {
        pattern = 'Intermittent';
      }
      
      return {
        success_rate: `${successRate}%`,
        pattern: pattern,
        avg_duration: 'Unknown' // Would need more detailed timing data
      };
      
    } catch (error) {
      return {
        success_rate: 'Unknown',
        pattern: 'Analysis failed',
        avg_duration: 'Unknown'
      };
    }
  }

  generateSummary(analysis) {
    const { error_type, issues, workflow_name, success_rate, pattern } = analysis;
    
    let summary = `The ${workflow_name} workflow failed due to ${error_type} issues. `;
    
    if (issues.length > 0) {
      const primaryIssue = issues[0];
      summary += `Primary failure: ${primaryIssue.description}. `;
    }
    
    summary += `Historical success rate: ${success_rate}. `;
    summary += `Failure pattern: ${pattern}.`;
    
    return summary;
  }

  determinePriority() {
    const criticalWorkflows = ['CI', 'Security Scanning', 'Release'];
    const criticalPatterns = /security|vulnerability|build.*failed|test.*failed/i;
    
    if (criticalWorkflows.includes(this.workflowName)) {
      return 'high';
    }
    
    if (criticalPatterns.test(this.workflowName)) {
      return 'high';
    }
    
    return 'medium';
  }

  getSuggestedAssignees() {
    const workflowAssignees = {
      'CI': ['sac'],
      'Security Scanning': ['sac'],
      'Comprehensive Testing': ['sac'],
      'Release': ['sac']
    };
    
    return workflowAssignees[this.workflowName] || [];
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '').replace(/-/g, '_');
    const value = args[i + 1];
    options[key] = value;
  }
  
  const analyzer = new FailureAnalyzer(options);
  analyzer.analyze().catch(console.error);
}

export { FailureAnalyzer };