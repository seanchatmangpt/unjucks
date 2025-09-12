#!/usr/bin/env node

/**
 * CLI command to trigger GitHub Actions build/publish workflow remotely
 * Uses GitHub API to dispatch workflow_dispatch or repository_dispatch events
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

// GitHub API configuration
const GITHUB_API_BASE = 'https://api.github.com';

function getRepoInfo() {
  try {
    // Try to get repo info from git remote
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    const match = remoteUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);
    
    if (match) {
      return {
        owner: match[1],
        repo: match[2]
      };
    }
  } catch (error) {
    // Fallback to package.json
    try {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      const repoUrl = packageJson.repository?.url || packageJson.homepage;
      if (repoUrl) {
        const match = repoUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);
        if (match) {
          return {
            owner: match[1],
            repo: match[2]
          };
        }
      }
    } catch {}
  }
  
  throw new Error('Could not determine GitHub repository info');
}

async function triggerWorkflowDispatch(repoInfo, options, token) {
  const url = `${GITHUB_API_BASE}/repos/${repoInfo.owner}/${repoInfo.repo}/actions/workflows/auto-build-publish.yml/dispatches`;
  
  const payload = {
    ref: options.branch || 'main',
    inputs: {
      version_type: options.versionType || 'auto',
      skip_tests: String(options.skipTests || false),
      dry_run: String(options.dryRun || false),
      environment: options.environment || 'production'
    }
  };
  
  console.log('🚀 Triggering GitHub Actions workflow...');
  console.log(`📍 Repository: ${repoInfo.owner}/${repoInfo.repo}`);
  console.log(`🔧 Options:`, payload.inputs);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (response.status === 204) {
      console.log('✅ Workflow triggered successfully!');
      return true;
    } else {
      const error = await response.text();
      console.error('❌ Failed to trigger workflow:', response.status, error);
      return false;
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
    return false;
  }
}

async function triggerRepositoryDispatch(repoInfo, options, token) {
  const url = `${GITHUB_API_BASE}/repos/${repoInfo.owner}/${repoInfo.repo}/dispatches`;
  
  const payload = {
    event_type: 'trigger-build',
    client_payload: {
      version_type: options.versionType || 'auto',
      skip_tests: options.skipTests || false,
      dry_run: options.dryRun || false,
      environment: options.environment || 'production',
      triggered_by: 'cli',
      timestamp: this.getDeterministicDate().toISOString()
    }
  };
  
  console.log('🚀 Triggering GitHub Actions via repository dispatch...');
  console.log(`📍 Repository: ${repoInfo.owner}/${repoInfo.repo}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (response.status === 204) {
      console.log('✅ Repository dispatch sent successfully!');
      return true;
    } else {
      const error = await response.text();
      console.error('❌ Failed to send repository dispatch:', response.status, error);
      return false;
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
    return false;
  }
}

function getGitHubToken() {
  // Try multiple sources for GitHub token
  const token = process.env.GITHUB_TOKEN || 
                process.env.GH_TOKEN || 
                process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  
  if (!token) {
    console.error('❌ GitHub token not found!');
    console.log('');
    console.log('Please set one of these environment variables:');
    console.log('  - GITHUB_TOKEN');
    console.log('  - GH_TOKEN');
    console.log('  - GITHUB_PERSONAL_ACCESS_TOKEN');
    console.log('');
    console.log('Or install GitHub CLI and authenticate:');
    console.log('  gh auth login');
    process.exit(1);
  }
  
  return token;
}

async function getWorkflowRuns(repoInfo, token) {
  const url = `${GITHUB_API_BASE}/repos/${repoInfo.owner}/${repoInfo.repo}/actions/workflows/auto-build-publish.yml/runs?per_page=5`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.workflow_runs;
    }
  } catch (error) {
    console.log('⚠️ Could not fetch workflow runs');
  }
  
  return [];
}

function parseArgs(args) {
  const options = {
    versionType: 'auto',
    skipTests: false,
    dryRun: false,
    environment: 'production',
    branch: 'main',
    method: 'workflow_dispatch'
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--version-type':
        options.versionType = args[++i];
        break;
      case '--skip-tests':
        options.skipTests = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--environment':
        options.environment = args[++i];
        break;
      case '--branch':
        options.branch = args[++i];
        break;
      case '--repository-dispatch':
        options.method = 'repository_dispatch';
        break;
      case '--help':
        console.log(`
🚀 Unjucks Remote Build Trigger

Usage: npm run build:remote [options]

Options:
  --version-type <type>    Version type: auto, patch, minor, major (default: auto)
  --skip-tests            Skip running tests
  --dry-run               Dry run without publishing
  --environment <env>     Target environment: production, staging, development
  --branch <branch>       Git branch to build (default: main)
  --repository-dispatch   Use repository dispatch instead of workflow dispatch
  --help                  Show this help

Examples:
  npm run build:remote                           # Auto-version build & publish
  npm run build:remote -- --dry-run              # Preview without publishing
  npm run build:remote -- --version-type minor   # Minor version bump
  npm run build:remote -- --skip-tests           # Skip tests
`);
        process.exit(0);
        break;
    }
  }
  
  return options;
}

async function main() {
  console.log('🚀 Unjucks Remote Build Trigger');
  console.log('================================');
  
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  
  try {
    const repoInfo = getRepoInfo();
    const token = getGitHubToken();
    
    let success = false;
    
    if (options.method === 'repository_dispatch') {
      success = await triggerRepositoryDispatch(repoInfo, options, token);
    } else {
      success = await triggerWorkflowDispatch(repoInfo, options, token);
    }
    
    if (success) {
      console.log('');
      console.log('📋 Next steps:');
      console.log(`   🌐 View workflow: https://github.com/${repoInfo.owner}/${repoInfo.repo}/actions`);
      console.log('   ⏳ Wait for completion');
      console.log('   📦 Check npm: https://www.npmjs.com/package/@seanchatmangpt/unjucks');
      
      // Show recent workflow runs
      const runs = await getWorkflowRuns(repoInfo, token);
      if (runs.length > 0) {
        console.log('');
        console.log('📊 Recent workflow runs:');
        runs.slice(0, 3).forEach(run => {
          const status = run.status === 'completed' ? 
            (run.conclusion === 'success' ? '✅' : '❌') : '🔄';
          console.log(`   ${status} ${run.display_title} (${run.status})`);
        });
      }
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Handle CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { triggerWorkflowDispatch, triggerRepositoryDispatch };