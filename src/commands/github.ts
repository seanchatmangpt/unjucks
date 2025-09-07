import { defineCommand } from "citty";
import * as chalk from "chalk";
import { consola } from "consola";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs-extra";
import * as path from "path";
import { glob } from "glob";

const execAsync = promisify(exec);

// GitHub API interfaces
interface GitHubRepository {
  name: string;
  full_name: string;
  owner: { login: string };
  description: string;
  language: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  created_at: string;
  updated_at: string;
}

interface GitHubPullRequest {
  number: number;
  title: string;
  body: string;
  state: string;
  user: { login: string };
  head: { ref: string };
  base: { ref: string };
  created_at: string;
  updated_at: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: Array<{ name: string; color: string }>;
  assignees: Array<{ login: string }>;
  user: { login: string };
  created_at: string;
  updated_at: string;
}

interface AnalysisResult {
  score: number;
  issues: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    file: string;
    line?: number;
    message: string;
  }>;
  metrics: Record<string, number>;
  recommendations: string[];
}

interface WorkflowConfig {
  name: string;
  on: Record<string, any>;
  jobs: Record<string, any>;
}

// Utility functions
async function executeGitHubAPI(endpoint: string, method = 'GET', data?: any): Promise<any> {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    const response = await fetch(`https://api.github.com${endpoint}`, {
      method,
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    consola.error('GitHub API request failed:', error);
    throw error;
  }
}

async function analyzeCodeQuality(repoPath: string): Promise<AnalysisResult> {
  const issues: AnalysisResult['issues'] = [];
  const metrics: Record<string, number> = {};
  const recommendations: string[] = [];

  try {
    // Analyze file structure
    const files = await glob('**/*.{js,ts,jsx,tsx,py,java,go,rb}', { cwd: repoPath });
    metrics.totalFiles = files.length;

    // Analyze code complexity
    let totalLines = 0;
    let totalComplexity = 0;

    for (const file of files.slice(0, 50)) { // Limit for performance
      const filePath = path.join(repoPath, file);
      if (await fs.pathExists(filePath)) {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n').length;
        totalLines += lines;

        // Simple complexity analysis
        const complexity = (content.match(/if|for|while|switch|catch/g) || []).length;
        totalComplexity += complexity;

        if (lines > 1000) {
          issues.push({
            type: 'maintainability',
            severity: 'medium',
            file,
            message: `File is too large (${lines} lines). Consider breaking it down.`,
          });
        }

        if (complexity > 20) {
          issues.push({
            type: 'complexity',
            severity: 'high',
            file,
            message: `High cyclomatic complexity (${complexity}). Consider refactoring.`,
          });
        }
      }
    }

    metrics.averageFileSize = Math.round(totalLines / files.length);
    metrics.averageComplexity = Math.round(totalComplexity / files.length);

    // Check for common issues
    if (!(await fs.pathExists(path.join(repoPath, 'README.md')))) {
      issues.push({
        type: 'documentation',
        severity: 'medium',
        file: 'README.md',
        message: 'Missing README.md file',
      });
      recommendations.push('Add a comprehensive README.md file');
    }

    if (!(await fs.pathExists(path.join(repoPath, '.gitignore')))) {
      issues.push({
        type: 'configuration',
        severity: 'low',
        file: '.gitignore',
        message: 'Missing .gitignore file',
      });
      recommendations.push('Add appropriate .gitignore file');
    }

    // Calculate overall score
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;
    const mediumIssues = issues.filter(i => i.severity === 'medium').length;
    
    const score = Math.max(0, 100 - (criticalIssues * 25) - (highIssues * 10) - (mediumIssues * 5));

    return { score, issues, metrics, recommendations };
  } catch (error) {
    consola.error('Code quality analysis failed:', error);
    return {
      score: 0,
      issues: [{
        type: 'analysis',
        severity: 'critical',
        file: 'analysis',
        message: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      metrics: {},
      recommendations: ['Fix analysis issues before proceeding'],
    };
  }
}

async function analyzeSecurityIssues(repoPath: string): Promise<AnalysisResult> {
  const issues: AnalysisResult['issues'] = [];
  const metrics: Record<string, number> = {};
  const recommendations: string[] = [];

  try {
    // Check for sensitive files
    const sensitivePatterns = [
      '**/*.env*',
      '**/.env*',
      '**/config/database.yml',
      '**/secrets.json',
      '**/*key*.pem',
      '**/*cert*.pem',
    ];

    for (const pattern of sensitivePatterns) {
      const matches = await glob(pattern, { cwd: repoPath });
      for (const match of matches) {
        if (!match.includes('.example') && !match.includes('.template')) {
          issues.push({
            type: 'security',
            severity: 'critical',
            file: match,
            message: 'Sensitive file detected in repository',
          });
        }
      }
    }

    // Check for hardcoded secrets in code files
    const codeFiles = await glob('**/*.{js,ts,jsx,tsx,py,java,rb,go}', { cwd: repoPath });
    const secretPatterns = [
      /password\s*[=:]\s*["'][^"']{8,}["']/gi,
      /api[_-]?key\s*[=:]\s*["'][^"']{16,}["']/gi,
      /secret\s*[=:]\s*["'][^"']{16,}["']/gi,
      /token\s*[=:]\s*["'][^"']{20,}["']/gi,
    ];

    let secretCount = 0;
    for (const file of codeFiles.slice(0, 100)) { // Limit for performance
      const filePath = path.join(repoPath, file);
      if (await fs.pathExists(filePath)) {
        const content = await fs.readFile(filePath, 'utf8');
        
        for (const pattern of secretPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            secretCount += matches.length;
            issues.push({
              type: 'security',
              severity: 'high',
              file,
              message: `Potential hardcoded secret detected: ${matches[0].substring(0, 50)}...`,
            });
          }
        }
      }
    }

    metrics.potentialSecrets = secretCount;
    metrics.sensitiveFiles = issues.filter(i => i.message.includes('Sensitive file')).length;

    // Security recommendations
    if (secretCount > 0) {
      recommendations.push('Use environment variables for sensitive data');
      recommendations.push('Consider using a secrets management service');
    }

    if (!(await fs.pathExists(path.join(repoPath, 'SECURITY.md')))) {
      recommendations.push('Add a SECURITY.md file with security policy');
    }

    const score = Math.max(0, 100 - (issues.length * 5));
    return { score, issues, metrics, recommendations };
  } catch (error) {
    consola.error('Security analysis failed:', error);
    return {
      score: 0,
      issues: [{
        type: 'security',
        severity: 'critical',
        file: 'analysis',
        message: `Security analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      metrics: {},
      recommendations: ['Fix analysis issues before proceeding'],
    };
  }
}

async function analyzePerformance(repoPath: string): Promise<AnalysisResult> {
  const issues: AnalysisResult['issues'] = [];
  const metrics: Record<string, number> = {};
  const recommendations: string[] = [];

  try {
    // Analyze bundle size and dependencies
    const packageJsonPath = path.join(repoPath, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = await fs.readJson(packageJsonPath);
      const totalDeps = Object.keys(packageJson.dependencies || {}).length + 
                       Object.keys(packageJson.devDependencies || {}).length;
      
      metrics.totalDependencies = totalDeps;
      
      if (totalDeps > 100) {
        issues.push({
          type: 'performance',
          severity: 'medium',
          file: 'package.json',
          message: `High number of dependencies (${totalDeps}). Consider reducing.`,
        });
        recommendations.push('Audit and reduce unnecessary dependencies');
      }
    }

    // Check for large files
    const allFiles = await glob('**/*', { cwd: repoPath, nodir: true });
    let largeFileCount = 0;
    
    for (const file of allFiles) {
      const filePath = path.join(repoPath, file);
      try {
        const stats = await fs.stat(filePath);
        const sizeInMB = stats.size / (1024 * 1024);
        
        if (sizeInMB > 10) {
          largeFileCount++;
          issues.push({
            type: 'performance',
            severity: sizeInMB > 50 ? 'high' : 'medium',
            file,
            message: `Large file detected (${sizeInMB.toFixed(2)}MB). Consider optimization.`,
          });
        }
      } catch (error) {
        // Skip files that can't be accessed
      }
    }

    metrics.largeFiles = largeFileCount;
    
    if (largeFileCount > 0) {
      recommendations.push('Optimize or compress large files');
      recommendations.push('Consider using Git LFS for large binary files');
    }

    const score = Math.max(0, 100 - (issues.length * 5));
    return { score, issues, metrics, recommendations };
  } catch (error) {
    consola.error('Performance analysis failed:', error);
    return {
      score: 0,
      issues: [{
        type: 'performance',
        severity: 'critical',
        file: 'analysis',
        message: `Performance analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      metrics: {},
      recommendations: ['Fix analysis issues before proceeding'],
    };
  }
}

async function tryMCPGitHubIntegration(command: string, params: Record<string, any>): Promise<any> {
  try {
    // Try to use MCP GitHub integration if available
    const { spawn } = await import('child_process');
    
    // First try claude-flow MCP tools
    const mcpCommands = {
      'analyze': 'mcp__claude-flow__github_repo_analyze',
      'pr-manage': 'mcp__claude-flow__github_pr_manage', 
      'issue-track': 'mcp__claude-flow__github_issue_track',
      'release-coord': 'mcp__claude-flow__github_release_coord',
      'workflow-auto': 'mcp__claude-flow__github_workflow_auto',
      'code-review': 'mcp__claude-flow__github_code_review',
      'sync-coord': 'mcp__claude-flow__github_sync_coord',
      'metrics': 'mcp__claude-flow__github_metrics'
    };
    
    const mcpTool = mcpCommands[command as keyof typeof mcpCommands];
    
    if (mcpTool) {
      return new Promise((resolve, reject) => {
        const mcpProcess = spawn('npx', [
          'claude-flow@alpha', 
          'tools', 
          'call', 
          mcpTool, 
          JSON.stringify(params)
        ], {
          stdio: 'pipe',
          timeout: 30000
        });
        
        let stdout = '';
        let stderr = '';
        
        mcpProcess.stdout?.on('data', (data) => {
          stdout += data.toString();
        });
        
        mcpProcess.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
        
        mcpProcess.on('close', (code) => {
          if (code === 0) {
            try {
              resolve(JSON.parse(stdout));
            } catch {
              resolve({ success: true, output: stdout });
            }
          } else {
            consola.debug('MCP GitHub integration not available or failed, using fallback');
            resolve(null);
          }
        });
        
        setTimeout(() => {
          mcpProcess.kill();
          resolve(null);
        }, 30000);
      });
    }
    
    // Fallback to direct command
    return new Promise((resolve, reject) => {
      const mcpProcess = spawn('npx', ['claude-flow@alpha', 'github', command, ...Object.entries(params).flat()], {
        stdio: 'pipe'
      });
      
      let stdout = '';
      let stderr = '';
      
      mcpProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      mcpProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      mcpProcess.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve({ success: true, output: stdout });
          }
        } else {
          consola.debug('MCP GitHub integration not available or failed, using fallback');
          resolve(null);
        }
      });
      
      setTimeout(() => {
        mcpProcess.kill();
        resolve(null);
      }, 10000); // 10 second timeout
    });
  } catch (error) {
    consola.debug('MCP integration not available:', error);
    return null;
  }
}

export const githubCommand = defineCommand({
  meta: {
    name: "github",
    description: "GitHub integration and repository management with MCP support",
  },
  subCommands: {
    analyze: defineCommand({
      meta: {
        name: "analyze",
        description: "Analyze GitHub repository for code quality, security, or performance",
      },
      args: {
        repo: {
          type: "string",
          description: "Repository name (owner/repo)",
          required: true,
          alias: "r",
        },
        type: {
          type: "string",
          description: "Analysis type (code_quality, performance, security)",
          default: "code_quality",
          alias: "t",
        },
        output: {
          type: "string",
          description: "Output format (json, table, summary)",
          default: "summary",
          alias: "o",
        },
        clone: {
          type: "boolean",
          description: "Clone repository for detailed analysis",
          default: false,
          alias: "c",
        },
      },
      async run({ args }: { args: any }) {
        const spinner = consola.withTag('github-analyze');
        
        try {
          spinner.start(`Analyzing repository ${args.repo} (${args.type})`);

          // Try MCP integration first
          const mcpResult = await tryMCPGitHubIntegration('analyze', {
            repo: args.repo,
            analysis_type: args.type
          });

          if (mcpResult) {
            spinner.success('Analysis completed via MCP integration');
            console.log(JSON.stringify(mcpResult, null, 2));
            return;
          }

          // Fallback to local analysis
          let repoPath: string | null = null;
          let tempDir = false;

          if (args.clone) {
            // Clone repository for detailed analysis
            const tempPath = path.join(process.cwd(), '.temp', args.repo.replace('/', '-'));
            await fs.ensureDir(path.dirname(tempPath));
            
            try {
              await execAsync(`git clone https://github.com/${args.repo}.git ${tempPath}`, {
                timeout: 30000
              });
              repoPath = tempPath;
              tempDir = true;
            } catch (error) {
              spinner.warn('Failed to clone repository, using API-only analysis');
            }
          }

          // Get basic repository info
          const repoInfo: GitHubRepository = await executeGitHubAPI(`/repos/${args.repo}`);
          
          let result: AnalysisResult;

          if (repoPath && tempDir) {
            // Perform detailed analysis on cloned repository
            switch (args.type) {
              case 'code_quality':
                result = await analyzeCodeQuality(repoPath);
                break;
              case 'security':
                result = await analyzeSecurityIssues(repoPath);
                break;
              case 'performance':
                result = await analyzePerformance(repoPath);
                break;
              default:
                throw new Error(`Unknown analysis type: ${args.type}`);
            }

            // Clean up temp directory
            await fs.remove(repoPath);
          } else {
            // API-only analysis
            result = {
              score: 75, // Default score for API-only analysis
              issues: [],
              metrics: {
                stars: repoInfo.stargazers_count,
                forks: repoInfo.forks_count,
                openIssues: repoInfo.open_issues_count,
              },
              recommendations: [
                'Clone repository for detailed analysis using --clone flag',
                'Consider implementing automated code quality checks',
              ],
            };
          }

          spinner.success(`Analysis completed for ${args.repo}`);

          // Format output
          if (args.output === 'json') {
            console.log(JSON.stringify({ repository: repoInfo, analysis: result }, null, 2));
          } else if (args.output === 'table') {
            console.log(chalk.blue.bold(`\n📊 Analysis Results for ${args.repo}`));
            console.log(chalk.gray(`Language: ${repoInfo.language || 'Unknown'}`));
            console.log(chalk.gray(`Stars: ${repoInfo.stargazers_count} | Forks: ${repoInfo.forks_count}`));
            console.log(`\n${chalk.green('Score:')} ${result.score}/100`);
            
            if (result.issues.length > 0) {
              console.log(`\n${chalk.red.bold('Issues:')}`);
              result.issues.forEach((issue, i) => {
                const severity = issue.severity === 'critical' ? chalk.red('🚨') :
                               issue.severity === 'high' ? chalk.yellow('⚠️') :
                               issue.severity === 'medium' ? chalk.blue('ℹ️') : '💡';
                console.log(`  ${i + 1}. ${severity} ${issue.file}: ${issue.message}`);
              });
            }

            if (result.recommendations.length > 0) {
              console.log(`\n${chalk.green.bold('Recommendations:')}`);
              result.recommendations.forEach((rec, i) => {
                console.log(`  ${i + 1}. ${rec}`);
              });
            }
          } else {
            // Summary format
            console.log(chalk.blue.bold(`\n🔍 ${args.type.replace('_', ' ').toUpperCase()} Analysis`));
            console.log(chalk.gray(`Repository: ${args.repo}`));
            console.log(chalk.gray(`Language: ${repoInfo.language || 'Unknown'}`));
            console.log(`Score: ${result.score >= 80 ? chalk.green(result.score) : 
                              result.score >= 60 ? chalk.yellow(result.score) : 
                              chalk.red(result.score)}/100`);
            console.log(`Issues: ${result.issues.length}`);
            console.log(`Recommendations: ${result.recommendations.length}`);
            
            if (result.issues.length > 0) {
              console.log(`\nTop issues: ${result.issues.slice(0, 3).map(i => i.message).join(', ')}`);
            }
            
            console.log(chalk.green('\n✅ Analysis completed'));
          }

        } catch (error) {
          spinner.error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      },
    }),

    pr: defineCommand({
      meta: {
        name: "pr",
        description: "Pull request management and automated reviews",
      },
      args: {
        action: {
          type: "string",
          description: "PR action (list, review, merge, close, create)",
          required: true,
          alias: "a",
        },
        repo: {
          type: "string",
          description: "Repository name (owner/repo)",
          required: true,
          alias: "r",
        },
        number: {
          type: "string",
          description: "PR number",
          alias: "n",
        },
        title: {
          type: "string",
          description: "PR title (for create action)",
          alias: "t",
        },
        head: {
          type: "string",
          description: "Head branch (for create action)",
          alias: "h",
        },
        base: {
          type: "string",
          description: "Base branch (for create action)",
          default: "main",
          alias: "b",
        },
        body: {
          type: "string",
          description: "PR description (for create action)",
        },
        auto: {
          type: "boolean",
          description: "Enable automated review",
          default: false,
        },
      },
      async run({ args }: { args: any }) {
        const spinner = consola.withTag('github-pr');
        
        try {
          spinner.start(`Managing pull request: ${args.action}`);

          // Try MCP integration first
          const mcpResult = await tryMCPGitHubIntegration('pr-manage', {
            action: args.action,
            repo: args.repo,
            pr_number: args.number
          });

          if (mcpResult) {
            spinner.success('PR operation completed via MCP integration');
            console.log(JSON.stringify(mcpResult, null, 2));
            return;
          }

          // Fallback implementation
          switch (args.action) {
            case 'list': {
              const prs: GitHubPullRequest[] = await executeGitHubAPI(`/repos/${args.repo}/pulls`);
              
              console.log(chalk.blue.bold(`\n📋 Pull Requests for ${args.repo}`));
              console.log(`Total: ${prs.length} open PRs\n`);
              
              prs.forEach(pr => {
                console.log(`#${pr.number} - ${pr.title}`);
                console.log(`  ${chalk.gray(`by ${pr.user.login} • ${pr.head.ref} → ${pr.base.ref}`)}`);
                console.log(`  ${chalk.gray(`Created: ${new Date(pr.created_at).toLocaleDateString()}`)}`);
                console.log();
              });
              break;
            }

            case 'review': {
              if (!args.number) {
                throw new Error('PR number is required for review action');
              }

              const pr: GitHubPullRequest = await executeGitHubAPI(`/repos/${args.repo}/pulls/${args.number}`);
              
              console.log(chalk.blue.bold(`\n🔍 Reviewing PR #${args.number}`));
              console.log(`Title: ${pr.title}`);
              console.log(`Author: ${pr.user.login}`);
              console.log(`Branch: ${pr.head.ref} → ${pr.base.ref}`);
              
              if (args.auto) {
                // Automated review logic
                const files = await executeGitHubAPI(`/repos/${args.repo}/pulls/${args.number}/files`);
                
                const reviewComments = [];
                let approvalStatus = 'APPROVE';
                
                for (const file of files.slice(0, 10)) { // Limit for performance
                  if (file.filename.includes('test') && file.additions > file.deletions * 2) {
                    reviewComments.push({
                      path: file.filename,
                      line: 1,
                      body: 'Consider adding more comprehensive tests for the new functionality.',
                    });
                  }
                  
                  if (file.changes > 500) {
                    reviewComments.push({
                      path: file.filename,
                      line: 1,
                      body: 'Large file change detected. Consider breaking this into smaller commits.',
                    });
                    approvalStatus = 'REQUEST_CHANGES';
                  }
                }
                
                // Submit review
                await executeGitHubAPI(`/repos/${args.repo}/pulls/${args.number}/reviews`, 'POST', {
                  event: approvalStatus,
                  body: `Automated review completed. ${reviewComments.length} suggestions provided.`,
                  comments: reviewComments,
                });
                
                console.log(chalk.green(`✅ Automated review submitted: ${approvalStatus}`));
              } else {
                console.log(chalk.yellow('Manual review mode - use GitHub interface to complete review'));
              }
              break;
            }

            case 'merge': {
              if (!args.number) {
                throw new Error('PR number is required for merge action');
              }

              const result = await executeGitHubAPI(`/repos/${args.repo}/pulls/${args.number}/merge`, 'PUT', {
                commit_title: `Merge pull request #${args.number}`,
                merge_method: 'squash',
              });
              
              console.log(chalk.green(`✅ PR #${args.number} merged successfully`));
              console.log(`Commit SHA: ${result.sha}`);
              break;
            }

            case 'close': {
              if (!args.number) {
                throw new Error('PR number is required for close action');
              }

              await executeGitHubAPI(`/repos/${args.repo}/pulls/${args.number}`, 'PATCH', {
                state: 'closed',
              });
              
              console.log(chalk.yellow(`🔒 PR #${args.number} closed`));
              break;
            }

            case 'create': {
              if (!args.title || !args.head) {
                throw new Error('Title and head branch are required for create action');
              }

              const newPR = await executeGitHubAPI(`/repos/${args.repo}/pulls`, 'POST', {
                title: args.title,
                head: args.head,
                base: args.base,
                body: args.body || '',
              });
              
              console.log(chalk.green(`✅ PR #${newPR.number} created successfully`));
              console.log(`URL: ${newPR.html_url}`);
              break;
            }

            default:
              throw new Error(`Unknown PR action: ${args.action}`);
          }

          spinner.success('PR operation completed');

        } catch (error) {
          spinner.error(`PR operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      },
    }),

    issues: defineCommand({
      meta: {
        name: "issues",
        description: "Issue tracking and triage management",
      },
      args: {
        action: {
          type: "string",
          description: "Issue action (list, triage, create, close, assign)",
          required: true,
          alias: "a",
        },
        repo: {
          type: "string",
          description: "Repository name (owner/repo)",
          required: true,
          alias: "r",
        },
        number: {
          type: "string",
          description: "Issue number",
          alias: "n",
        },
        title: {
          type: "string",
          description: "Issue title (for create action)",
          alias: "t",
        },
        body: {
          type: "string",
          description: "Issue description",
          alias: "b",
        },
        assignee: {
          type: "string",
          description: "Assignee username",
        },
        labels: {
          type: "string",
          description: "Comma-separated labels",
          alias: "l",
        },
        state: {
          type: "string",
          description: "Issue state (open, closed)",
          default: "open",
        },
      },
      async run({ args }: { args: any }) {
        const spinner = consola.withTag('github-issues');
        
        try {
          spinner.start(`Managing issues: ${args.action}`);

          switch (args.action) {
            case 'list': {
              const issues: GitHubIssue[] = await executeGitHubAPI(
                `/repos/${args.repo}/issues?state=${args.state}`
              );
              
              console.log(chalk.blue.bold(`\n🎯 Issues for ${args.repo}`));
              console.log(`Total: ${issues.length} ${args.state} issues\n`);
              
              issues.forEach(issue => {
                const labels = issue.labels.map(l => chalk.bgBlue.white(` ${l.name} `)).join(' ');
                console.log(`#${issue.number} - ${issue.title}`);
                console.log(`  ${chalk.gray(`by ${issue.user.login} • ${new Date(issue.created_at).toLocaleDateString()}`)}`);
                if (labels) console.log(`  ${labels}`);
                if (issue.assignees.length > 0) {
                  console.log(`  ${chalk.green(`Assigned: ${issue.assignees.map(a => a.login).join(', ')}`)}`);
                }
                console.log();
              });
              break;
            }

            case 'triage': {
              const issues: GitHubIssue[] = await executeGitHubAPI(
                `/repos/${args.repo}/issues?state=open&labels=needs-triage`
              );
              
              console.log(chalk.blue.bold(`\n🔍 Triaging Issues for ${args.repo}`));
              
              for (const issue of issues.slice(0, 10)) { // Limit for performance
                console.log(`\n--- Issue #${issue.number}: ${issue.title} ---`);
                
                // Auto-triage logic
                const suggestedLabels = [];
                const body = (issue.body || '').toLowerCase();
                
                if (body.includes('bug') || body.includes('error') || body.includes('broken')) {
                  suggestedLabels.push('bug');
                }
                if (body.includes('feature') || body.includes('enhancement')) {
                  suggestedLabels.push('enhancement');
                }
                if (body.includes('documentation') || body.includes('docs')) {
                  suggestedLabels.push('documentation');
                }
                if (body.includes('urgent') || body.includes('critical')) {
                  suggestedLabels.push('priority-high');
                }
                
                console.log(`Suggested labels: ${suggestedLabels.join(', ') || 'none'}`);
                
                // Apply suggested labels
                if (suggestedLabels.length > 0) {
                  await executeGitHubAPI(`/repos/${args.repo}/issues/${issue.number}/labels`, 'POST', {
                    labels: suggestedLabels,
                  });
                  
                  // Remove needs-triage label
                  try {
                    await executeGitHubAPI(`/repos/${args.repo}/issues/${issue.number}/labels/needs-triage`, 'DELETE');
                  } catch {
                    // Label might not exist
                  }
                }
              }
              
              console.log(chalk.green(`\n✅ Triaged ${Math.min(issues.length, 10)} issues`));
              break;
            }

            case 'create': {
              if (!args.title) {
                throw new Error('Title is required for create action');
              }

              const labels = args.labels ? args.labels.split(',').map((l: string) => l.trim()) : [];
              
              const newIssue = await executeGitHubAPI(`/repos/${args.repo}/issues`, 'POST', {
                title: args.title,
                body: args.body || '',
                labels,
                assignees: args.assignee ? [args.assignee] : [],
              });
              
              console.log(chalk.green(`✅ Issue #${newIssue.number} created successfully`));
              console.log(`URL: ${newIssue.html_url}`);
              break;
            }

            case 'assign': {
              if (!args.number || !args.assignee) {
                throw new Error('Issue number and assignee are required for assign action');
              }

              await executeGitHubAPI(`/repos/${args.repo}/issues/${args.number}/assignees`, 'POST', {
                assignees: [args.assignee],
              });
              
              console.log(chalk.green(`✅ Issue #${args.number} assigned to ${args.assignee}`));
              break;
            }

            case 'close': {
              if (!args.number) {
                throw new Error('Issue number is required for close action');
              }

              await executeGitHubAPI(`/repos/${args.repo}/issues/${args.number}`, 'PATCH', {
                state: 'closed',
              });
              
              console.log(chalk.yellow(`🔒 Issue #${args.number} closed`));
              break;
            }

            default:
              throw new Error(`Unknown issue action: ${args.action}`);
          }

          spinner.success('Issue operation completed');

        } catch (error) {
          spinner.error(`Issue operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      },
    }),

    release: defineCommand({
      meta: {
        name: "release",
        description: "Release coordination and automation",
      },
      args: {
        action: {
          type: "string",
          description: "Release action (list, create, draft, publish)",
          required: true,
          alias: "a",
        },
        repo: {
          type: "string",
          description: "Repository name (owner/repo)",
          required: true,
          alias: "r",
        },
        tag: {
          type: "string",
          description: "Release tag name",
          alias: "t",
        },
        name: {
          type: "string",
          description: "Release name",
          alias: "n",
        },
        body: {
          type: "string",
          description: "Release description",
          alias: "b",
        },
        draft: {
          type: "boolean",
          description: "Create as draft",
          default: false,
        },
        prerelease: {
          type: "boolean",
          description: "Mark as prerelease",
          default: false,
        },
      },
      async run({ args }: { args: any }) {
        const spinner = consola.withTag('github-release');
        
        try {
          spinner.start(`Managing release: ${args.action}`);

          switch (args.action) {
            case 'list': {
              const releases = await executeGitHubAPI(`/repos/${args.repo}/releases`);
              
              console.log(chalk.blue.bold(`\n🚀 Releases for ${args.repo}`));
              console.log(`Total: ${releases.length} releases\n`);
              
              releases.forEach((release: any) => {
                console.log(`${release.tag_name} - ${release.name}`);
                console.log(`  ${chalk.gray(`Published: ${new Date(release.published_at).toLocaleDateString()}`)}`);
                console.log(`  ${chalk.gray(`Downloads: ${release.assets.reduce((sum: number, asset: any) => sum + asset.download_count, 0)}`)}`);
                if (release.draft) console.log(`  ${chalk.yellow('DRAFT')}`);
                if (release.prerelease) console.log(`  ${chalk.blue('PRERELEASE')}`);
                console.log();
              });
              break;
            }

            case 'create':
            case 'draft': {
              if (!args.tag) {
                throw new Error('Tag name is required for create/draft action');
              }

              const isDraft = args.action === 'draft' || args.draft;
              
              const newRelease = await executeGitHubAPI(`/repos/${args.repo}/releases`, 'POST', {
                tag_name: args.tag,
                name: args.name || args.tag,
                body: args.body || '',
                draft: isDraft,
                prerelease: args.prerelease,
              });
              
              console.log(chalk.green(`✅ Release ${args.tag} ${isDraft ? 'drafted' : 'created'} successfully`));
              console.log(`URL: ${newRelease.html_url}`);
              break;
            }

            case 'publish': {
              if (!args.tag) {
                throw new Error('Tag name is required for publish action');
              }

              // Find the release by tag
              const releases = await executeGitHubAPI(`/repos/${args.repo}/releases`);
              const release = releases.find((r: any) => r.tag_name === args.tag);
              
              if (!release) {
                throw new Error(`Release with tag ${args.tag} not found`);
              }
              
              if (!release.draft) {
                console.log(chalk.yellow(`Release ${args.tag} is already published`));
                return;
              }

              await executeGitHubAPI(`/repos/${args.repo}/releases/${release.id}`, 'PATCH', {
                draft: false,
              });
              
              console.log(chalk.green(`✅ Release ${args.tag} published successfully`));
              break;
            }

            default:
              throw new Error(`Unknown release action: ${args.action}`);
          }

          spinner.success('Release operation completed');

        } catch (error) {
          spinner.error(`Release operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      },
    }),

    sync: defineCommand({
      meta: {
        name: "sync",
        description: "Multi-repository synchronization",
      },
      args: {
        repos: {
          type: "string",
          description: "Comma-separated list of repositories (owner/repo)",
          required: true,
          alias: "r",
        },
        action: {
          type: "string",
          description: "Sync action (labels, workflows, settings)",
          default: "labels",
          alias: "a",
        },
        source: {
          type: "string",
          description: "Source repository for sync (first repo if not specified)",
          alias: "s",
        },
      },
      async run({ args }: { args: any }) {
        const spinner = consola.withTag('github-sync');
        
        try {
          const repos = args.repos.split(',').map((r: string) => r.trim());
          const sourceRepo = args.source || repos[0];
          const targetRepos = repos.filter((r: string) => r !== sourceRepo);

          spinner.start(`Syncing ${args.action} from ${sourceRepo} to ${targetRepos.length} repositories`);

          switch (args.action) {
            case 'labels': {
              // Get labels from source repository
              const sourceLabels = await executeGitHubAPI(`/repos/${sourceRepo}/labels`);
              
              console.log(`Found ${sourceLabels.length} labels in ${sourceRepo}`);
              
              for (const targetRepo of targetRepos) {
                console.log(`\nSyncing labels to ${targetRepo}...`);
                
                try {
                  const existingLabels = await executeGitHubAPI(`/repos/${targetRepo}/labels`);
                  const existingLabelNames = new Set(existingLabels.map((l: any) => l.name));
                  
                  for (const label of sourceLabels) {
                    if (existingLabelNames.has(label.name)) {
                      // Update existing label
                      await executeGitHubAPI(`/repos/${targetRepo}/labels/${encodeURIComponent(label.name)}`, 'PATCH', {
                        color: label.color,
                        description: label.description,
                      });
                    } else {
                      // Create new label
                      await executeGitHubAPI(`/repos/${targetRepo}/labels`, 'POST', {
                        name: label.name,
                        color: label.color,
                        description: label.description,
                      });
                    }
                  }
                  
                  console.log(`  ✅ ${targetRepo} synchronized`);
                } catch (error) {
                  console.log(`  ❌ Failed to sync ${targetRepo}: ${error}`);
                }
              }
              break;
            }

            case 'workflows': {
              console.log(chalk.yellow('Workflow sync requires file-level access - consider using GitHub CLI or direct file operations'));
              
              // This would require more complex logic to sync .github/workflows files
              // For now, provide guidance
              console.log('\nTo sync workflows manually:');
              console.log('1. Clone both repositories');
              console.log('2. Copy .github/workflows/ files from source to target');
              console.log('3. Commit and push changes');
              break;
            }

            case 'settings': {
              // Sync basic repository settings
              const sourceSettings = await executeGitHubAPI(`/repos/${sourceRepo}`);
              
              const settingsToSync = {
                description: sourceSettings.description,
                homepage: sourceSettings.homepage,
                has_issues: sourceSettings.has_issues,
                has_projects: sourceSettings.has_projects,
                has_wiki: sourceSettings.has_wiki,
                allow_merge_commit: sourceSettings.allow_merge_commit,
                allow_squash_merge: sourceSettings.allow_squash_merge,
                allow_rebase_merge: sourceSettings.allow_rebase_merge,
                delete_branch_on_merge: sourceSettings.delete_branch_on_merge,
              };
              
              for (const targetRepo of targetRepos) {
                console.log(`\nSyncing settings to ${targetRepo}...`);
                
                try {
                  await executeGitHubAPI(`/repos/${targetRepo}`, 'PATCH', settingsToSync);
                  console.log(`  ✅ ${targetRepo} settings synchronized`);
                } catch (error) {
                  console.log(`  ❌ Failed to sync ${targetRepo}: ${error}`);
                }
              }
              break;
            }

            default:
              throw new Error(`Unknown sync action: ${args.action}`);
          }

          spinner.success('Synchronization completed');

        } catch (error) {
          spinner.error(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      },
    }),

    workflow: defineCommand({
      meta: {
        name: "workflow",
        description: "GitHub Actions workflow automation",
      },
      args: {
        action: {
          type: "string",
          description: "Workflow action (list, run, status, logs, create)",
          required: true,
          alias: "a",
        },
        repo: {
          type: "string",
          description: "Repository name (owner/repo)",
          required: true,
          alias: "r",
        },
        workflow: {
          type: "string",
          description: "Workflow ID or filename",
          alias: "w",
        },
        ref: {
          type: "string",
          description: "Branch or tag to run workflow on",
          default: "main",
        },
        inputs: {
          type: "string",
          description: "JSON string of workflow inputs",
          alias: "i",
        },
      },
      async run({ args }: { args: any }) {
        const spinner = consola.withTag('github-workflow');
        
        try {
          spinner.start(`Managing workflow: ${args.action}`);

          switch (args.action) {
            case 'list': {
              const workflows = await executeGitHubAPI(`/repos/${args.repo}/actions/workflows`);
              
              console.log(chalk.blue.bold(`\n⚙️ Workflows for ${args.repo}`));
              console.log(`Total: ${workflows.total_count} workflows\n`);
              
              workflows.workflows.forEach((workflow: any) => {
                console.log(`${workflow.name} (${workflow.id})`);
                console.log(`  ${chalk.gray(`File: ${workflow.path}`)}`);
                console.log(`  ${chalk.gray(`State: ${workflow.state}`)}`);
                console.log();
              });
              break;
            }

            case 'run': {
              if (!args.workflow) {
                throw new Error('Workflow ID or filename is required for run action');
              }

              const inputs = args.inputs ? JSON.parse(args.inputs) : {};
              
              await executeGitHubAPI(`/repos/${args.repo}/actions/workflows/${args.workflow}/dispatches`, 'POST', {
                ref: args.ref,
                inputs,
              });
              
              console.log(chalk.green(`✅ Workflow ${args.workflow} triggered on ${args.ref}`));
              break;
            }

            case 'status': {
              const runs = await executeGitHubAPI(`/repos/${args.repo}/actions/runs?per_page=10`);
              
              console.log(chalk.blue.bold(`\n📊 Recent Workflow Runs for ${args.repo}`));
              
              runs.workflow_runs.forEach((run: any) => {
                const status = run.status === 'completed' ? 
                  (run.conclusion === 'success' ? chalk.green('✅') : 
                   run.conclusion === 'failure' ? chalk.red('❌') : 
                   chalk.yellow('⚠️')) : 
                  chalk.blue('🔄');
                
                console.log(`${status} ${run.name} #${run.run_number}`);
                console.log(`  ${chalk.gray(`Branch: ${run.head_branch} • ${new Date(run.created_at).toLocaleString()}`)}`);
                console.log(`  ${chalk.gray(`Status: ${run.status} • Conclusion: ${run.conclusion || 'N/A'}`)}`);
                console.log();
              });
              break;
            }

            case 'logs': {
              if (!args.workflow) {
                const runs = await executeGitHubAPI(`/repos/${args.repo}/actions/runs?per_page=1`);
                if (runs.workflow_runs.length === 0) {
                  throw new Error('No workflow runs found');
                }
                args.workflow = runs.workflow_runs[0].id;
              }

              try {
                const logsUrl = await executeGitHubAPI(`/repos/${args.repo}/actions/runs/${args.workflow}/logs`);
                console.log(chalk.blue(`📝 Workflow logs available at: ${logsUrl}`));
                console.log(chalk.gray('Note: Use GitHub CLI or web interface to view detailed logs'));
              } catch (error) {
                console.log(chalk.yellow('Logs may not be available or run may still be in progress'));
              }
              break;
            }

            case 'create': {
              console.log(chalk.blue.bold('\n🛠️ Creating GitHub Workflow'));
              
              // Basic workflow template
              const workflowTemplate: WorkflowConfig = {
                name: 'CI',
                on: {
                  push: {
                    branches: ['main', 'develop'],
                  },
                  pull_request: {
                    branches: ['main'],
                  },
                },
                jobs: {
                  test: {
                    'runs-on': 'ubuntu-latest',
                    steps: [
                      {
                        uses: 'actions/checkout@v3',
                      },
                      {
                        name: 'Setup Node.js',
                        uses: 'actions/setup-node@v3',
                        with: {
                          'node-version': '18',
                        },
                      },
                      {
                        name: 'Install dependencies',
                        run: 'npm ci',
                      },
                      {
                        name: 'Run tests',
                        run: 'npm test',
                      },
                    ],
                  },
                },
              };
              
              console.log('Workflow template:');
              console.log(chalk.gray(JSON.stringify(workflowTemplate, null, 2)));
              
              console.log('\nTo add this workflow:');
              console.log('1. Create .github/workflows/ci.yml in your repository');
              console.log('2. Copy the above configuration (as YAML)');
              console.log('3. Commit and push the changes');
              break;
            }

            default:
              throw new Error(`Unknown workflow action: ${args.action}`);
          }

          spinner.success('Workflow operation completed');

        } catch (error) {
          spinner.error(`Workflow operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      },
    }),

    stats: defineCommand({
      meta: {
        name: "stats",
        description: "Repository statistics and metrics",
      },
      args: {
        repo: {
          type: "string",
          description: "Repository name (owner/repo)",
          required: true,
          alias: "r",
        },
        period: {
          type: "string",
          description: "Time period (week, month, year)",
          default: "month",
          alias: "p",
        },
        format: {
          type: "string",
          description: "Output format (table, json)",
          default: "table",
          alias: "f",
        },
      },
      async run({ args }: { args: any }) {
        const spinner = consola.withTag('github-stats');
        
        try {
          spinner.start(`Gathering statistics for ${args.repo}`);

          // Get basic repository info
          const repo: GitHubRepository = await executeGitHubAPI(`/repos/${args.repo}`);
          
          // Get contributor statistics
          const contributors = await executeGitHubAPI(`/repos/${args.repo}/contributors`);
          
          // Get language statistics
          const languages = await executeGitHubAPI(`/repos/${args.repo}/languages`);
          
          // Get recent activity (commits, issues, PRs)
          const commits = await executeGitHubAPI(`/repos/${args.repo}/commits?per_page=100`);
          const issues = await executeGitHubAPI(`/repos/${args.repo}/issues?state=all&per_page=100`);
          const pulls = await executeGitHubAPI(`/repos/${args.repo}/pulls?state=all&per_page=100`);
          
          const stats = {
            repository: {
              name: repo.full_name,
              description: repo.description,
              language: repo.language,
              created: repo.created_at,
              updated: repo.updated_at,
            },
            metrics: {
              stars: repo.stargazers_count,
              forks: repo.forks_count,
              openIssues: repo.open_issues_count,
              contributors: contributors.length,
              totalCommits: commits.length >= 100 ? '100+' : commits.length,
              totalIssues: issues.length >= 100 ? '100+' : issues.length,
              totalPRs: pulls.length >= 100 ? '100+' : pulls.length,
            },
            languages: languages,
            topContributors: contributors.slice(0, 5).map((c: any) => ({
              login: c.login,
              contributions: c.contributions,
            })),
          };

          spinner.success('Statistics gathered');

          if (args.format === 'json') {
            console.log(JSON.stringify(stats, null, 2));
          } else {
            console.log(chalk.blue.bold(`\n📊 Repository Statistics: ${args.repo}`));
            console.log(`Description: ${stats.repository.description || 'N/A'}`);
            console.log(`Primary Language: ${stats.repository.language || 'Unknown'}`);
            console.log(`Created: ${new Date(stats.repository.created).toLocaleDateString()}`);
            console.log(`Last Updated: ${new Date(stats.repository.updated).toLocaleDateString()}`);
            
            console.log(`\n${chalk.green.bold('Metrics:')}`);
            console.log(`  Stars: ${stats.metrics.stars}`);
            console.log(`  Forks: ${stats.metrics.forks}`);
            console.log(`  Open Issues: ${stats.metrics.openIssues}`);
            console.log(`  Contributors: ${stats.metrics.contributors}`);
            console.log(`  Recent Commits: ${stats.metrics.totalCommits}`);
            
            if (Object.keys(stats.languages).length > 0) {
              console.log(`\n${chalk.yellow.bold('Languages:')}`);
              const totalBytes = Object.values(stats.languages).reduce((sum: number, bytes: any) => sum + bytes, 0);
              Object.entries(stats.languages).forEach(([lang, bytes]: [string, any]) => {
                const percentage = ((Number(bytes) / totalBytes) * 100).toFixed(1);
                console.log(`  ${lang}: ${percentage}%`);
              });
            }
            
            if (stats.topContributors.length > 0) {
              console.log(`\n${chalk.cyan.bold('Top Contributors:')}`);
              stats.topContributors.forEach((contributor: any, i: number) => {
                console.log(`  ${i + 1}. ${contributor.login} (${contributor.contributions} contributions)`);
              });
            }
          }

        } catch (error) {
          spinner.error(`Statistics gathering failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      },
    }),
  },
});