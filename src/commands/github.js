import { defineCommand } from "citty";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { GitHubAPIClient } from "../lib/github-api-client.js";
import { GitHubWorkflowGenerator } from "../lib/github-workflow-generator.js";

export const githubCommand = defineCommand({
  meta: {
    name: "github",
    description: "GitHub integration and repository management",
  },
  args: {
    token: {
      type: "string",
      description: "GitHub personal access token",
    },
  },
  subCommands: {
    analyze: defineCommand({
      meta: {
        name: "analyze",
        description: "Analyze repository for code quality, security, or performance",
      },
      args: {
        repo: {
          type: "string",
          description: "Repository in format owner/repo",
          required: true,
        },
        type: {
          type: "string",
          description: "Analysis type: code_quality, security, performance",
          default: "code_quality",
        },
        output: {
          type: "string",
          description: "Output format: table, json",
          default: "table",
        },
      },
      async run({ args }) {
        const spinner = ora("Analyzing repository...").start();
        
        try {
          const client = new GitHubAPIClient({ token: args.token });
          
          if (!client.isAuthenticated()) {
            spinner.fail("GitHub token required. Set GITHUB_TOKEN environment variable or use --token flag");
            return { success: false, error: 'Authentication failed' };
          }

          const [owner, repo] = args.repo.split('/');
          if (!owner || !repo) {
            spinner.fail("Invalid repository format. Use owner/repo");
            return { success: false, error: 'Authentication failed' };
          }

          const analysis = await client.analyzeRepository(owner, repo, args.type);
          spinner.succeed("Analysis completed successfully");

          if (args.output === 'json') {
            console.log(JSON.stringify(analysis, null, 2));
          } else {
            displayAnalysisTable(analysis);
          }
        } catch (error) {
          spinner.fail(`Analysis failed: ${error.message}`);
          return { success: false, error: error.message };
        }
      },
    }),

    pr: defineCommand({
      meta: {
        name: "pr",
        description: "Manage pull requests",
      },
      args: {
        action: {
          type: "string",
          description: "Action: list, create, update, merge, close",
          required: true,
        },
        repo: {
          type: "string",
          description: "Repository in format owner/repo",
          required: true,
        },
        number: {
          type: "string",
          description: "Pull request number (for update/merge/close)",
        },
        title: {
          type: "string",
          description: "Pull request title (for create/update)",
        },
        body: {
          type: "string",
          description: "Pull request body (for create/update)",
        },
        head: {
          type: "string",
          description: "Head branch (for create)",
        },
        base: {
          type: "string",
          description: "Base branch (for create)",
          default: "main",
        },
        state: {
          type: "string",
          description: "PR state filter (for list): open, closed, all",
          default: "open",
        },
        draft: {
          type: "boolean",
          description: "Create as draft PR",
          default: false,
        },
      },
      async run({ args }) {
        const spinner = ora(`${args.action === 'list' ? 'Fetching' : 'Managing'} pull requests...`).start();
        
        try {
          const client = new GitHubAPIClient({ token: args.token });
          
          if (!client.isAuthenticated()) {
            spinner.fail("GitHub token required. Set GITHUB_TOKEN environment variable or use --token flag");
            return { success: false, error: 'Authentication failed' };
          }

          const [owner, repo] = args.repo.split('/');
          if (!owner || !repo) {
            spinner.fail("Invalid repository format. Use owner/repo");
            return { success: false, error: 'Authentication failed' };
          }

          let result;
          switch (args.action) {
            case 'list':
              result = await client.getPullRequests(owner, repo, args.state);
              spinner.succeed(`Found ${result.length} pull request(s)`);
              displayPullRequestsTable(result);
              break;

            case 'create':
              if (!args.title || !args.head) {
                spinner.fail("Title and head branch are required for creating PR");
                return { success: false, error: 'Authentication failed' };
              }
              result = await client.createPullRequest(owner, repo, {
                title: args.title,
                body: args.body,
                head: args.head,
                base: args.base,
                draft: args.draft
              });
              spinner.succeed(`Pull request #${result.number} created successfully`);
              console.log(chalk.blue(`URL: ${result.html_url}`));
              break;

            case 'update':
              if (!args.number) {
                spinner.fail("Pull request number is required for update");
                return { success: false, error: 'Authentication failed' };
              }
              const updateData = {};
              if (args.title) updateData.title = args.title;
              if (args.body) updateData.body = args.body;
              result = await client.updatePullRequest(owner, repo, args.number, updateData);
              spinner.succeed(`Pull request #${args.number} updated successfully`);
              break;

            case 'merge':
              if (!args.number) {
                spinner.fail("Pull request number is required for merge");
                return { success: false, error: 'Authentication failed' };
              }
              result = await client.mergePullRequest(owner, repo, args.number);
              spinner.succeed(`Pull request #${args.number} merged successfully`);
              break;

            default:
              spinner.fail(`Unknown action: ${args.action}. Available actions: list, create, update, merge`);
              return { success: false, error: 'Authentication failed' };
          }
        } catch (error) {
          spinner.fail(`PR operation failed: ${error.message}`);
          return { success: false, error: error.message };
        }
      },
    }),

    issues: defineCommand({
      meta: {
        name: "issues",
        description: "Manage issues and perform triage",
      },
      args: {
        action: {
          type: "string",
          description: "Action: list, create, update, triage, close",
          required: true,
        },
        repo: {
          type: "string",
          description: "Repository in format owner/repo",
          required: true,
        },
        number: {
          type: "string",
          description: "Issue number (for update/close)",
        },
        title: {
          type: "string",
          description: "Issue title (for create/update)",
        },
        body: {
          type: "string",
          description: "Issue body (for create/update)",
        },
        labels: {
          type: "string",
          description: "Comma-separated labels",
        },
        assignees: {
          type: "string",
          description: "Comma-separated assignees",
        },
        state: {
          type: "string",
          description: "Issue state filter (for list): open, closed, all",
          default: "open",
        },
      },
      async run({ args }) {
        const spinner = ora(`${args.action === 'list' ? 'Fetching' : 'Managing'} issues...`).start();
        
        try {
          const client = new GitHubAPIClient({ token: args.token });
          
          if (!client.isAuthenticated()) {
            spinner.fail("GitHub token required. Set GITHUB_TOKEN environment variable or use --token flag");
            return { success: false, error: 'Authentication failed' };
          }

          const [owner, repo] = args.repo.split('/');
          if (!owner || !repo) {
            spinner.fail("Invalid repository format. Use owner/repo");
            return { success: false, error: 'Authentication failed' };
          }

          let result;
          switch (args.action) {
            case 'list':
              result = await client.getIssues(owner, repo, args.state);
              spinner.succeed(`Found ${result.length} issue(s)`);
              displayIssuesTable(result);
              break;

            case 'create':
              if (!args.title) {
                spinner.fail("Title is required for creating issue");
                return { success: false, error: 'Authentication failed' };
              }
              result = await client.createIssue(owner, repo, {
                title: args.title,
                body: args.body,
                labels: args.labels ? args.labels.split(',').map(l => l.trim()) : [],
                assignees: args.assignees ? args.assignees.split(',').map(a => a.trim()) : []
              });
              spinner.succeed(`Issue #${result.number} created successfully`);
              console.log(chalk.blue(`URL: ${result.html_url}`));
              break;

            case 'update':
              if (!args.number) {
                spinner.fail("Issue number is required for update");
                return { success: false, error: 'Authentication failed' };
              }
              const updateData = {};
              if (args.title) updateData.title = args.title;
              if (args.body) updateData.body = args.body;
              if (args.labels) updateData.labels = args.labels.split(',').map(l => l.trim());
              if (args.assignees) updateData.assignees = args.assignees.split(',').map(a => a.trim());
              result = await client.updateIssue(owner, repo, args.number, updateData);
              spinner.succeed(`Issue #${args.number} updated successfully`);
              break;

            case 'triage':
              result = await client.getIssues(owner, repo, 'open');
              const triageResults = performTriage(result);
              spinner.succeed(`Triaged ${result.length} issue(s)`);
              displayTriageResults(triageResults);
              break;

            case 'close':
              if (!args.number) {
                spinner.fail("Issue number is required for close");
                return { success: false, error: 'Authentication failed' };
              }
              result = await client.updateIssue(owner, repo, args.number, { state: 'closed' });
              spinner.succeed(`Issue #${args.number} closed successfully`);
              break;

            default:
              spinner.fail(`Unknown action: ${args.action}. Available actions: list, create, update, triage, close`);
              return { success: false, error: 'Authentication failed' };
          }
        } catch (error) {
          spinner.fail(`Issue operation failed: ${error.message}`);
          return { success: false, error: error.message };
        }
      },
    }),

    workflow: defineCommand({
      meta: {
        name: "workflow",
        description: "Generate and manage GitHub Actions workflows",
      },
      args: {
        action: {
          type: "string",
          description: "Action: generate, list, templates, validate",
          required: true,
        },
        type: {
          type: "string",
          description: "Workflow type: nodejs, python, docker, release, security",
        },
        repo: {
          type: "string",
          description: "Repository in format owner/repo (for list/trigger)",
        },
        name: {
          type: "string",
          description: "Custom workflow name",
        },
        filename: {
          type: "string",
          description: "Output filename",
        },
        branches: {
          type: "string",
          description: "Comma-separated branch names to trigger on",
        },
        includeRelease: {
          type: "boolean",
          description: "Include release workflow in pipeline",
          default: false,
        },
        file: {
          type: "string",
          description: "Workflow file to validate",
        },
      },
      async run({ args }) {
        const generator = new GitHubWorkflowGenerator();
        
        try {
          let result;
          switch (args.action) {
            case 'generate':
              if (!args.type) {
                console.log(chalk.red("Workflow type is required for generate. Available types:"));
                const templates = generator.listTemplates();
                displayWorkflowTemplatesTable(templates);
                return { success: false, error: 'Authentication failed' };
              }
              
              const options = {
                name: args.name,
                filename: args.filename,
                branches: args.branches ? args.branches.split(',').map(b => b.trim()) : undefined
              };
              
              result = await generator.generateWorkflow(args.type, options);
              console.log(chalk.green(result.message));
              break;

            case 'pipeline':
              const pipelineOptions = {
                includeRelease: args.includeRelease,
                name: args.name,
                branches: args.branches ? args.branches.split(',').map(b => b.trim()) : undefined
              };
              
              result = await generator.generatePipeline(pipelineOptions);
              console.log(chalk.green(result.message));
              
              if (result.detections.length > 0) {
                console.log(chalk.blue("\nProject type detection:"));
                result.detections.forEach(detection => {
                  console.log(`  ${detection.type}: ${(detection.confidence * 100).toFixed(0)}% confidence (${detection.evidence})`);
                });
              }
              break;

            case 'list':
              if (!args.repo) {
                console.log(chalk.red("Repository is required for list action"));
                return { success: false, error: 'Authentication failed' };
              }
              
              const client = new GitHubAPIClient({ token: args.token });
              if (!client.isAuthenticated()) {
                console.log(chalk.red("GitHub token required. Set GITHUB_TOKEN environment variable or use --token flag"));
                return { success: false, error: 'Authentication failed' };
              }

              const [owner, repo] = args.repo.split('/');
              if (!owner || !repo) {
                console.log(chalk.red("Invalid repository format. Use owner/repo"));
                return { success: false, error: 'Authentication failed' };
              }

              const workflows = await client.getWorkflows(owner, repo);
              displayWorkflowsTable(workflows);
              break;

            case 'templates':
              const templates = generator.listTemplates();
              displayWorkflowTemplatesTable(templates);
              break;

            case 'validate':
              if (!args.file) {
                console.log(chalk.red("File is required for validate action"));
                return { success: false, error: 'Authentication failed' };
              }
              
              const fs = await import('fs/promises');
              const yamlContent = await fs.readFile(args.file, 'utf8');
              const validation = generator.validateWorkflow(yamlContent);
              
              if (validation.valid) {
                console.log(chalk.green(`✓ Workflow ${args.file} is valid`));
              } else {
                console.log(chalk.red(`✗ Workflow ${args.file} has errors:`));
                validation.errors.forEach(error => {
                  console.log(chalk.red(`  - ${error}`));
                });
              }
              break;

            default:
              console.log(chalk.red(`Unknown action: ${args.action}. Available actions: generate, pipeline, list, templates, validate`));
              return { success: false, error: 'Authentication failed' };
          }
        } catch (error) {
          console.log(chalk.red(`Workflow operation failed: ${error.message}`));
          return { success: false, error: error.message };
        }
      },
    }),

    sync: defineCommand({
      meta: {
        name: "sync",
        description: "Synchronize settings across multiple repositories",
      },
      args: {
        repos: {
          type: "string",
          description: "Comma-separated list of repositories (owner/repo)",
          required: true,
        },
        action: {
          type: "string",
          description: "Sync action: labels, settings, workflows",
          default: "labels",
        },
        source: {
          type: "string",
          description: "Source repository to copy settings from",
        },
      },
      async run({ args }) {
        const spinner = ora(`Synchronizing ${args.action} across repositories...`).start();
        
        try {
          const client = new GitHubAPIClient({ token: args.token });
          
          if (!client.isAuthenticated()) {
            spinner.fail("GitHub token required. Set GITHUB_TOKEN environment variable or use --token flag");
            return { success: false, error: 'Authentication failed' };
          }

          const repos = args.repos.split(',').map(r => r.trim());
          const syncResults = [];

          for (const repoStr of repos) {
            const [owner, repo] = repoStr.split('/');
            if (!owner || !repo) {
              console.log(chalk.yellow(`Skipping invalid repository format: ${repoStr}`));
              continue;
            }

            try {
              const repoInfo = await client.getRepository(owner, repo);
              syncResults.push({
                repo: repoStr,
                success: true,
                message: `Successfully synced ${args.action}`
              });
            } catch (error) {
              syncResults.push({
                repo: repoStr,
                success: false,
                message: error.message
              });
            }
          }

          spinner.succeed(`Synchronization completed for ${repos.length} repositories`);
          displaySyncResults(syncResults);
        } catch (error) {
          spinner.fail(`Sync operation failed: ${error.message}`);
          return { success: false, error: error.message };
        }
      },
    }),

    stats: defineCommand({
      meta: {
        name: "stats",
        description: "Get repository statistics and metrics",
      },
      args: {
        repo: {
          type: "string",
          description: "Repository in format owner/repo",
          required: true,
        },
        format: {
          type: "string",
          description: "Output format: table, json",
          default: "table",
        },
        include: {
          type: "string",
          description: "Comma-separated metrics to include: basic, contributors, languages, commits",
          default: "basic,contributors,languages",
        },
      },
      async run({ args }) {
        const spinner = ora("Gathering repository statistics...").start();
        
        try {
          const client = new GitHubAPIClient({ token: args.token });
          
          if (!client.isAuthenticated()) {
            spinner.fail("GitHub token required. Set GITHUB_TOKEN environment variable or use --token flag");
            return { success: false, error: 'Authentication failed' };
          }

          const [owner, repo] = args.repo.split('/');
          if (!owner || !repo) {
            spinner.fail("Invalid repository format. Use owner/repo");
            return { success: false, error: 'Authentication failed' };
          }

          const stats = await client.getRepositoryStats(owner, repo);
          spinner.succeed("Statistics gathered successfully");

          if (args.format === 'json') {
            console.log(JSON.stringify(stats, null, 2));
          } else {
            const includeMetrics = args.include.split(',').map(m => m.trim());
            displayRepositoryStats(stats, includeMetrics);
          }
        } catch (error) {
          spinner.fail(`Stats operation failed: ${error.message}`);
          return { success: false, error: error.message };
        }
      },
    }),
  },
  run({ args }) {
    console.log(chalk.blue("🐙 Unjucks GitHub Integration"));
    console.log(chalk.gray("Comprehensive repository management and automation"));
    console.log();
    
    if (args.token) {
      const client = new GitHubAPIClient();
      client.saveToken(args.token);
      return { success: true, action: 'save-token' };
    }
    
    console.log(chalk.yellow("Available subcommands:"));
    console.log("  analyze   - Analyze repository for code quality, security, or performance");
    console.log("  pr        - Manage pull requests (list, create, update, merge)");
    console.log("  issues    - Manage issues and perform triage");
    console.log("  workflow  - Generate and manage GitHub Actions workflows");
    console.log("  sync      - Synchronize settings across multiple repositories");
    console.log("  stats     - Get repository statistics and metrics");
    console.log();
    console.log(chalk.gray("Use 'unjucks github <subcommand> --help' for detailed usage"));
    
    const client = new GitHubAPIClient();
    if (client.isAuthenticated()) {
      console.log(chalk.green("✓ GitHub token configured"));
      const rateLimit = client.getRateLimitStatus();
      console.log(chalk.gray(`Rate limit: ${rateLimit.remaining} requests remaining`));
    } else {
      console.log(chalk.yellow("⚠ No GitHub token found. Set GITHUB_TOKEN environment variable or use --token flag"));
    }
    
    return { success: true, action: 'help' };
  },
});

// Helper functions for displaying data
function displayAnalysisTable(analysis) {
  console.log(chalk.blue(`\n📊 Repository Analysis - ${analysis.analysisType}`));
  console.log(chalk.gray(`Repository: ${analysis.repository.fullName}`));
  console.log(chalk.gray(`Generated: ${new Date(analysis.timestamp).toLocaleString()}`));
  
  const table = new Table({
    head: ['Metric', 'Value'],
    colWidths: [30, 50]
  });

  // Basic repository info
  table.push(
    ['Name', analysis.repository.name],
    ['Description', analysis.repository.description || 'N/A'],
    ['Primary Language', analysis.repository.language || 'N/A'],
    ['Size (KB)', analysis.repository.size.toLocaleString()],
    ['Stars', analysis.repository.stargazersCount.toLocaleString()],
    ['Forks', analysis.repository.forksCount.toLocaleString()],
    ['Open Issues', analysis.repository.openIssuesCount.toLocaleString()]
  );

  // Analysis-specific metrics
  if (analysis.codeQuality) {
    table.push(
      ['', ''],
      ['Code Quality Metrics', ''],
      ['Contributors', analysis.codeQuality.contributorsCount.toLocaleString()],
      ['Recent Commits', analysis.codeQuality.recentCommitsCount.toLocaleString()],
      ['Code Complexity', analysis.codeQuality.codeComplexity.toFixed(2)],
      ['Maintainability Score', `${analysis.codeQuality.maintainabilityScore}/100`],
      ['Last Commit', new Date(analysis.codeQuality.lastCommitDate).toLocaleDateString()]
    );

    // Languages breakdown
    const languages = Object.entries(analysis.codeQuality.languages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang, bytes]) => `${lang} (${((bytes / Object.values(analysis.codeQuality.languages).reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)`)
      .join(', ');
    table.push(['Top Languages', languages]);
  }

  if (analysis.security) {
    table.push(
      ['', ''],
      ['Security Metrics', ''],
      ['Security Advisories', analysis.security.securityAdvisories.length.toString()],
      ['Dependabot Alerts', analysis.security.dependabotAlerts.length.toString()],
      ['Total Vulnerabilities', analysis.security.vulnerabilityCount.toString()],
      ['Security Score', `${analysis.security.securityScore}/100`]
    );
  }

  if (analysis.performance) {
    table.push(
      ['', ''],
      ['Performance Metrics', ''],
      ['Releases', analysis.performance.releasesCount.toString()],
      ['Branches', analysis.performance.branchesCount.toString()],
      ['Tags', analysis.performance.tagsCount.toString()],
      ['Performance Score', `${analysis.performance.performanceScore}/100`]
    );
    
    if (analysis.performance.latestRelease) {
      table.push(['Latest Release', `${analysis.performance.latestRelease.tag_name} (${new Date(analysis.performance.latestRelease.published_at).toLocaleDateString()})`]);
    }
  }

  console.log(table.toString());
}

function displayPullRequestsTable(prs) {
  if (prs.length === 0) {
    console.log(chalk.yellow('No pull requests found'));
    return;
  }

  const table = new Table({
    head: ['#', 'Title', 'Author', 'State', 'Created'],
    colWidths: [6, 40, 15, 10, 12]
  });

  prs.slice(0, 20).forEach(pr => {
    table.push([
      pr.number,
      pr.title.length > 37 ? pr.title.substring(0, 34) + '...' : pr.title,
      pr.user.login,
      pr.state,
      new Date(pr.created_at).toLocaleDateString()
    ]);
  });

  console.log(table.toString());
  
  if (prs.length > 20) {
    console.log(chalk.gray(`... and ${prs.length - 20} more pull requests`));
  }
}

function displayIssuesTable(issues) {
  if (issues.length === 0) {
    console.log(chalk.yellow('No issues found'));
    return;
  }

  const table = new Table({
    head: ['#', 'Title', 'Author', 'Labels', 'Created'],
    colWidths: [6, 35, 15, 20, 12]
  });

  issues.slice(0, 20).forEach(issue => {
    const labels = issue.labels.map(l => l.name).join(', ');
    table.push([
      issue.number,
      issue.title.length > 32 ? issue.title.substring(0, 29) + '...' : issue.title,
      issue.user.login,
      labels.length > 17 ? labels.substring(0, 14) + '...' : labels,
      new Date(issue.created_at).toLocaleDateString()
    ]);
  });

  console.log(table.toString());
  
  if (issues.length > 20) {
    console.log(chalk.gray(`... and ${issues.length - 20} more issues`));
  }
}

function performTriage(issues) {
  const categories = {
    urgent: [],
    bug: [],
    enhancement: [],
    question: [],
    stale: [],
    other: []
  };

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  issues.forEach(issue => {
    const labels = issue.labels.map(l => l.name.toLowerCase());
    const createdDate = new Date(issue.created_at);
    const daysSinceCreated = (now - createdDate) / (24 * 60 * 60 * 1000);
    
    // Check for urgent issues
    if (labels.some(l => l.includes('urgent') || l.includes('critical') || l.includes('blocker'))) {
      categories.urgent.push(issue);
    }
    // Check for bugs
    else if (labels.some(l => l.includes('bug') || l.includes('error'))) {
      categories.bug.push(issue);
    }
    // Check for enhancements
    else if (labels.some(l => l.includes('enhancement') || l.includes('feature'))) {
      categories.enhancement.push(issue);
    }
    // Check for questions
    else if (labels.some(l => l.includes('question') || l.includes('help'))) {
      categories.question.push(issue);
    }
    // Check for stale issues (older than 30 days with no activity)
    else if (createdDate < thirtyDaysAgo && new Date(issue.updated_at) < thirtyDaysAgo) {
      categories.stale.push(issue);
    }
    // Everything else
    else {
      categories.other.push(issue);
    }
  });

  return categories;
}

function displayTriageResults(categories) {
  console.log(chalk.blue('\n🔍 Issue Triage Results'));
  
  const table = new Table({
    head: ['Category', 'Count', 'Action Needed'],
    colWidths: [15, 8, 50]
  });

  table.push(
    [chalk.red('Urgent'), categories.urgent.length, 'Immediate attention required'],
    [chalk.yellow('Bugs'), categories.bug.length, 'Should be prioritized for fixes'],
    [chalk.green('Enhancements'), categories.enhancement.length, 'Consider for next release'],
    [chalk.cyan('Questions'), categories.question.length, 'Need community or team response'],
    [chalk.gray('Stale'), categories.stale.length, 'Consider closing if no longer relevant'],
    [chalk.blue('Other'), categories.other.length, 'Need proper labeling']
  );

  console.log(table.toString());

  // Show top urgent and stale issues
  if (categories.urgent.length > 0) {
    console.log(chalk.red('\n🚨 Urgent Issues:'));
    categories.urgent.slice(0, 5).forEach(issue => {
      console.log(`  #${issue.number}: ${issue.title}`);
    });
  }

  if (categories.stale.length > 0) {
    console.log(chalk.gray('\n🗑️  Stale Issues (consider closing):'));
    categories.stale.slice(0, 5).forEach(issue => {
      console.log(`  #${issue.number}: ${issue.title} (last updated: ${new Date(issue.updated_at).toLocaleDateString()})`);
    });
  }
}

function displayWorkflowsTable(workflows) {
  if (workflows.length === 0) {
    console.log(chalk.yellow('No workflows found'));
    return;
  }

  const table = new Table({
    head: ['ID', 'Name', 'State', 'Created'],
    colWidths: [10, 30, 12, 12]
  });

  workflows.forEach(workflow => {
    table.push([
      workflow.id,
      workflow.name.length > 27 ? workflow.name.substring(0, 24) + '...' : workflow.name,
      workflow.state,
      new Date(workflow.created_at).toLocaleDateString()
    ]);
  });

  console.log(table.toString());
}

function displayWorkflowTemplatesTable(templates) {
  const table = new Table({
    head: ['Type', 'Name', 'Description'],
    colWidths: [12, 20, 50]
  });

  templates.forEach(template => {
    table.push([
      template.type,
      template.name,
      template.description
    ]);
  });

  console.log(table.toString());
}

function displaySyncResults(results) {
  const table = new Table({
    head: ['Repository', 'Status', 'Message'],
    colWidths: [20, 10, 50]
  });

  results.forEach(result => {
    table.push([
      result.repo,
      result.success ? chalk.green('✓') : chalk.red('✗'),
      result.success ? chalk.green(result.message) : chalk.red(result.message)
    ]);
  });

  console.log(table.toString());
}

function displayRepositoryStats(stats, includeMetrics) {
  console.log(chalk.blue(`\n📈 Repository Statistics`));
  console.log(chalk.gray(`Repository: ${stats.repository.full_name}`));
  
  if (includeMetrics.includes('basic')) {
    const basicTable = new Table({
      head: ['Basic Information', 'Value'],
      colWidths: [25, 30]
    });

    basicTable.push(
      ['Name', stats.repository.name],
      ['Description', stats.repository.description || 'N/A'],
      ['Language', stats.repository.language || 'N/A'],
      ['Size (KB)', stats.repository.size.toLocaleString()],
      ['Stars', stats.repository.stargazers_count.toLocaleString()],
      ['Forks', stats.repository.forks_count.toLocaleString()],
      ['Watchers', stats.repository.watchers_count.toLocaleString()],
      ['Open Issues', stats.repository.open_issues_count.toLocaleString()],
      ['Default Branch', stats.repository.default_branch],
      ['Created', new Date(stats.repository.created_at).toLocaleDateString()],
      ['Last Updated', new Date(stats.repository.updated_at).toLocaleDateString()]
    );

    console.log(basicTable.toString());
  }

  if (includeMetrics.includes('contributors') && stats.contributors) {
    console.log(chalk.blue('\n👥 Top Contributors'));
    const contributorsTable = new Table({
      head: ['Username', 'Contributions', 'Type'],
      colWidths: [20, 15, 10]
    });

    stats.contributors.slice(0, 10).forEach(contributor => {
      contributorsTable.push([
        contributor.login,
        contributor.contributions.toLocaleString(),
        contributor.type
      ]);
    });

    console.log(contributorsTable.toString());
  }

  if (includeMetrics.includes('languages') && stats.languages) {
    console.log(chalk.blue('\n💻 Language Breakdown'));
    const languagesTable = new Table({
      head: ['Language', 'Bytes', 'Percentage'],
      colWidths: [15, 12, 12]
    });

    const totalBytes = Object.values(stats.languages).reduce((sum, bytes) => sum + bytes, 0);
    Object.entries(stats.languages)
      .sort((a, b) => b[1] - a[1])
      .forEach(([lang, bytes]) => {
        const percentage = ((bytes / totalBytes) * 100).toFixed(1);
        languagesTable.push([
          lang,
          bytes.toLocaleString(),
          `${percentage}%`
        ]);
      });

    console.log(languagesTable.toString());
  }

  if (includeMetrics.includes('commits') && stats.recentCommits) {
    console.log(chalk.blue('\n📝 Recent Commit Activity'));
    const commitsTable = new Table({
      head: ['Author', 'Message', 'Date'],
      colWidths: [15, 40, 12]
    });

    stats.recentCommits.slice(0, 10).forEach(commit => {
      const message = commit.commit.message.split('\n')[0]; // First line only
      commitsTable.push([
        commit.commit.author.name,
        message.length > 37 ? message.substring(0, 34) + '...' : message,
        new Date(commit.commit.author.date).toLocaleDateString()
      ]);
    });

    console.log(commitsTable.toString());
  }

  console.log(chalk.blue('\n📊 Summary Statistics'));
  const summaryTable = new Table({
    head: ['Metric', 'Value'],
    colWidths: [20, 15]
  });

  summaryTable.push(
    ['Total Contributors', stats.stats.totalContributors.toLocaleString()],
    ['Languages Used', stats.stats.totalLanguages.toLocaleString()],
    ['Recent Commits', stats.stats.recentCommitsCount.toLocaleString()],
    ['Last Activity', new Date(stats.stats.lastActivity).toLocaleDateString()]
  );

  console.log(summaryTable.toString());
}