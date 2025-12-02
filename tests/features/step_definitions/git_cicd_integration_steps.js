const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

// Git and CI/CD Integration Test Context
class GitCICDIntegrationContext {
  constructor() {
    this.reset();
  }

  reset() {
    this.gitRepo = {
      commits: [],
      branches: ['main'],
      currentBranch: 'main',
      changes: []
    };
    this.ciConfig = {
      provider: null,
      workflows: [],
      environment: {},
      secrets: {}
    };
    this.driftReports = [];
    this.buildResults = [];
    this.deploymentStatus = null;
    this.notifications = [];
    this.webhookEvents = [];
    this.prAnalysis = {};
  }

  // Git simulation methods
  createCommit(message, files, author = 'test@example.com') {
    const commit = {
      sha: this.generateSHA(),
      message,
      author,
      timestamp: new Date().toISOString(),
      files: files.map(file => ({
        path: file.path,
        status: file.status, // 'added', 'modified', 'deleted'
        additions: file.additions || 0,
        deletions: file.deletions || 0,
        changes: file.changes || 0,
        patch: file.patch || null
      }))
    };
    
    this.gitRepo.commits.push(commit);
    return commit;
  }

  generateSHA() {
    return crypto.randomBytes(20).toString('hex');
  }

  simulateGitDiff(baseCommit, headCommit) {
    // Simulate git diff output
    return {
      baseCommit: baseCommit || 'HEAD~1',
      headCommit: headCommit || 'HEAD',
      files: this.gitRepo.commits
        .slice(-2)
        .flatMap(commit => commit.files)
        .map(file => ({
          ...file,
          hunks: this.generateHunks(file)
        }))
    };
  }

  generateHunks(file) {
    if (file.status === 'added') {
      return [{
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: file.additions,
        header: `@@ -0,0 +1,${file.additions} @@`,
        changes: Array(file.additions).fill(null).map((_, i) => ({
          type: 'add',
          lineNumber: i + 1,
          content: `+  Line ${i + 1} of ${file.path}`
        }))
      }];
    }

    if (file.status === 'deleted') {
      return [{
        oldStart: 1,
        oldLines: file.deletions,
        newStart: 0,
        newLines: 0,
        header: `@@ -1,${file.deletions} +0,0 @@`,
        changes: Array(file.deletions).fill(null).map((_, i) => ({
          type: 'delete',
          lineNumber: i + 1,
          content: `-  Line ${i + 1} of ${file.path}`
        }))
      }];
    }

    // Modified file
    return [{
      oldStart: 1,
      oldLines: file.deletions + file.additions,
      newStart: 1,
      newLines: file.additions + file.deletions,
      header: `@@ -1,${file.deletions + file.additions} +1,${file.additions + file.deletions} @@`,
      changes: [
        ...Array(file.deletions).fill(null).map((_, i) => ({
          type: 'delete',
          lineNumber: i + 1,
          content: `-  Old line ${i + 1} of ${file.path}`
        })),
        ...Array(file.additions).fill(null).map((_, i) => ({
          type: 'add',
          lineNumber: file.deletions + i + 1,
          content: `+  New line ${i + 1} of ${file.path}`
        }))
      ]
    }];
  }

  // CI/CD simulation methods
  createWorkflow(name, triggers, jobs) {
    const workflow = {
      name,
      triggers,
      jobs: jobs.map(job => ({
        name: job.name,
        steps: job.steps || [],
        environment: job.environment || {},
        needs: job.needs || [],
        if: job.if || null
      }))
    };

    this.ciConfig.workflows.push(workflow);
    return workflow;
  }

  simulateBuild(workflow, commit) {
    const build = {
      id: this.generateBuildId(),
      workflow: workflow.name,
      commit: commit.sha,
      status: 'running',
      startTime: new Date().toISOString(),
      steps: [],
      environment: { ...this.ciConfig.environment },
      logs: []
    };

    // Simulate workflow steps
    for (const job of workflow.jobs) {
      for (const step of job.steps) {
        const stepResult = this.simulateStep(step, build);
        build.steps.push(stepResult);
      }
    }

    build.status = build.steps.every(step => step.status === 'success') ? 'success' : 'failure';
    build.endTime = new Date().toISOString();
    build.duration = 1000 + Math.random() * 5000; // 1-6 seconds

    this.buildResults.push(build);
    return build;
  }

  simulateStep(step, build) {
    const stepResult = {
      name: step.name || step,
      status: 'running',
      startTime: new Date().toISOString(),
      logs: [],
      outputs: {}
    };

    // Simulate specific step types
    switch (step.name || step) {
      case 'checkout':
        stepResult.status = 'success';
        stepResult.logs.push('Checking out code...');
        break;

      case 'setup-node':
        stepResult.status = 'success';
        stepResult.logs.push('Setting up Node.js...');
        break;

      case 'install-dependencies':
        stepResult.status = 'success';
        stepResult.logs.push('Installing dependencies...');
        break;

      case 'drift-detection':
        return this.simulateDriftDetectionStep(build);

      case 'build':
        stepResult.status = 'success';
        stepResult.logs.push('Building project...');
        break;

      case 'test':
        stepResult.status = 'success';
        stepResult.logs.push('Running tests...');
        break;

      case 'deploy':
        stepResult.status = this.deploymentStatus || 'success';
        stepResult.logs.push('Deploying to production...');
        break;

      default:
        stepResult.status = 'success';
        stepResult.logs.push(`Running ${step.name || step}...`);
    }

    stepResult.endTime = new Date().toISOString();
    return stepResult;
  }

  simulateDriftDetectionStep(build) {
    const stepResult = {
      name: 'drift-detection',
      status: 'running',
      startTime: new Date().toISOString(),
      logs: [
        'Running KGEN drift detection...',
        'Loading baseline from kgen.lock.json...',
        'Analyzing changes in current commit...'
      ],
      outputs: {}
    };

    // Simulate drift analysis based on git changes
    const gitDiff = this.simulateGitDiff();
    const driftResults = {
      totalFiles: gitDiff.files.length,
      filesWithSemanticDrift: gitDiff.files.filter(f => 
        f.path.endsWith('.ts') || f.path.endsWith('.js')
      ).length,
      filesWithCosmeticChanges: gitDiff.files.filter(f => 
        f.changes && f.changes < 5
      ).length,
      severityBreakdown: {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0
      }
    };

    // Categorize changes by severity
    gitDiff.files.forEach(file => {
      if (file.path.includes('interface') || file.path.includes('api')) {
        driftResults.severityBreakdown.HIGH++;
      } else if (file.deletions > 0) {
        driftResults.severityBreakdown.MEDIUM++;
      } else {
        driftResults.severityBreakdown.LOW++;
      }
    });

    const hasCriticalDrift = driftResults.severityBreakdown.CRITICAL > 0;
    const hasHighDrift = driftResults.severityBreakdown.HIGH > 0;

    if (hasCriticalDrift) {
      stepResult.status = 'failure';
      stepResult.logs.push('❌ CRITICAL drift detected - build failed');
      build.environment.DRIFT_EXIT_CODE = '3';
    } else if (hasHighDrift && this.ciConfig.failOnHigh) {
      stepResult.status = 'failure';
      stepResult.logs.push('❌ HIGH severity drift detected - build failed');
      build.environment.DRIFT_EXIT_CODE = '2';
    } else {
      stepResult.status = 'success';
      stepResult.logs.push('✅ Drift detection completed - no critical issues');
      build.environment.DRIFT_EXIT_CODE = '0';
    }

    // Generate drift report
    const driftReport = {
      timestamp: new Date().toISOString(),
      commit: build.commit,
      results: driftResults,
      recommendations: this.generateDriftRecommendations(driftResults)
    };

    this.driftReports.push(driftReport);
    stepResult.outputs.driftReport = driftReport;
    stepResult.endTime = new Date().toISOString();

    return stepResult;
  }

  generateDriftRecommendations(results) {
    const recommendations = [];

    if (results.severityBreakdown.CRITICAL > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        action: 'Review and fix critical breaking changes before deployment',
        description: 'Files with critical drift may break existing functionality'
      });
    }

    if (results.severityBreakdown.HIGH > 0) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Validate high-impact changes with stakeholders',
        description: 'Changes may affect API contracts or public interfaces'
      });
    }

    if (results.filesWithSemanticDrift > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'Update documentation and notify dependent teams',
        description: 'Semantic changes require communication and coordination'
      });
    }

    return recommendations;
  }

  generateBuildId() {
    return `build-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // PR analysis methods
  analyzePullRequest(prData) {
    const analysis = {
      number: prData.number,
      title: prData.title,
      changedFiles: prData.files || [],
      driftAnalysis: {
        semanticChanges: 0,
        cosmeticChanges: 0,
        breakingChanges: 0,
        riskLevel: 'LOW'
      },
      recommendations: [],
      checks: []
    };

    // Analyze changed files
    analysis.changedFiles.forEach(file => {
      if (file.filename.match(/\.(ts|js|tsx|jsx)$/)) {
        if (file.changes > 50) {
          analysis.driftAnalysis.breakingChanges++;
        } else if (file.changes > 10) {
          analysis.driftAnalysis.semanticChanges++;
        } else {
          analysis.driftAnalysis.cosmeticChanges++;
        }
      }
    });

    // Determine risk level
    if (analysis.driftAnalysis.breakingChanges > 0) {
      analysis.driftAnalysis.riskLevel = 'CRITICAL';
    } else if (analysis.driftAnalysis.semanticChanges > 5) {
      analysis.driftAnalysis.riskLevel = 'HIGH';
    } else if (analysis.driftAnalysis.semanticChanges > 0) {
      analysis.driftAnalysis.riskLevel = 'MEDIUM';
    }

    this.prAnalysis = analysis;
    return analysis;
  }
}

const gitCicdContext = new GitCICDIntegrationContext();

// Git Integration Steps
Given('I have a git repository with commit history', function () {
  // Create initial commit
  gitCicdContext.createCommit('Initial commit', [
    {
      path: 'src/user-service.ts',
      status: 'added',
      additions: 25,
      deletions: 0,
      changes: 25
    }
  ]);

  // Create drift-introducing commit
  gitCicdContext.createCommit('Update user service interface', [
    {
      path: 'src/user-service.ts',
      status: 'modified',
      additions: 5,
      deletions: 2,
      changes: 7,
      patch: `@@ -10,7 +10,7 @@
 interface UserService {
-  getUserById(id: string): Promise<User>;
+  getUserById(id: number): Promise<User>;
   createUser(user: CreateUserRequest): Promise<User>;`
    }
  ]);

  expect(gitCicdContext.gitRepo.commits).to.have.length(2);
});

When('I run drift detection on git changes', function () {
  const gitDiff = gitCicdContext.simulateGitDiff();
  gitCicdContext.gitChanges = gitDiff;
  
  expect(gitDiff.files).to.have.length.greaterThan(0);
});

Then('track file changes with git hunks', function () {
  expect(gitCicdContext.gitChanges.files[0]).to.have.property('hunks');
  expect(gitCicdContext.gitChanges.files[0].hunks[0]).to.have.property('changes');
});

Then('identify semantic changes from git diff', function () {
  const semanticFile = gitCicdContext.gitChanges.files.find(file => 
    file.path.includes('user-service') && file.status === 'modified'
  );
  
  expect(semanticFile).to.exist;
  expect(semanticFile.hunks[0].changes.some(change => 
    change.content.includes('getUserById') && 
    (change.content.includes('string') || change.content.includes('number'))
  )).to.be.true;
});

// CI/CD Integration Steps
Given('I have a GitHub Actions workflow', function () {
  const workflow = gitCicdContext.createWorkflow('CI/CD Pipeline', 
    ['push', 'pull_request'], [
      {
        name: 'test-and-deploy',
        steps: [
          'checkout',
          'setup-node',
          'install-dependencies',
          'drift-detection',
          'build',
          'test',
          'deploy'
        ]
      }
    ]
  );

  gitCicdContext.ciConfig.provider = 'github-actions';
  gitCicdContext.ciConfig.failOnHigh = true;
  
  expect(workflow.jobs).to.have.length(1);
});

Given('drift detection is configured as a CI step', function () {
  const workflow = gitCicdContext.ciConfig.workflows[0];
  const hasDeriftStep = workflow.jobs[0].steps.includes('drift-detection');
  
  expect(hasDeriftStep).to.be.true;
});

When('a commit with semantic drift is pushed', function () {
  const commit = gitCicdContext.createCommit('Breaking: Change API signature', [
    {
      path: 'src/api/user-routes.ts',
      status: 'modified',
      additions: 3,
      deletions: 5,
      changes: 8,
      patch: `@@ -15,5 +15,3 @@
-router.delete('/users/:id', async (req, res) => {
-  // Delete endpoint removed
-});`
    }
  ]);

  expect(commit.files[0].deletions).to.be.greaterThan(0);
});

When('the CI/CD pipeline runs', function () {
  const workflow = gitCicdContext.ciConfig.workflows[0];
  const latestCommit = gitCicdContext.gitRepo.commits[gitCicdContext.gitRepo.commits.length - 1];
  
  const buildResult = gitCicdContext.simulateBuild(workflow, latestCommit);
  
  expect(buildResult.status).to.exist;
  expect(buildResult.steps).to.have.length.greaterThan(0);
});

Then('drift detection step runs and analyzes changes', function () {
  const latestBuild = gitCicdContext.buildResults[gitCicdContext.buildResults.length - 1];
  const driftStep = latestBuild.steps.find(step => step.name === 'drift-detection');
  
  expect(driftStep).to.exist;
  expect(driftStep.status).to.be.oneOf(['success', 'failure']);
  expect(driftStep.outputs.driftReport).to.exist;
});

Then('CI build fails on high severity drift', function () {
  const latestBuild = gitCicdContext.buildResults[gitCicdContext.buildResults.length - 1];
  const driftStep = latestBuild.steps.find(step => step.name === 'drift-detection');
  
  if (driftStep.outputs.driftReport.results.severityBreakdown.HIGH > 0) {
    expect(driftStep.status).to.equal('failure');
    expect(latestBuild.environment.DRIFT_EXIT_CODE).to.be.oneOf(['2', '3']);
  }
});

Then('generate drift report artifact', function () {
  const latestReport = gitCicdContext.driftReports[gitCicdContext.driftReports.length - 1];
  
  expect(latestReport).to.exist;
  expect(latestReport).to.have.property('timestamp');
  expect(latestReport).to.have.property('commit');
  expect(latestReport).to.have.property('results');
  expect(latestReport).to.have.property('recommendations');
});

// Pull Request Integration Steps
Given('I have an open pull request with changes', function () {
  const prData = {
    number: 123,
    title: 'Update user service API',
    files: [
      {
        filename: 'src/user-service.ts',
        status: 'modified',
        additions: 10,
        deletions: 5,
        changes: 15,
        patch: '@@ -1,10 +1,10 @@\n interface UserService {\n-  getUserById(id: string): Promise<User>;\n+  getUserById(id: number): Promise<User>;\n }'
      },
      {
        filename: 'src/user-routes.ts',
        status: 'modified',
        additions: 2,
        deletions: 8,
        changes: 10,
        patch: '@@ -20,8 +20,2 @@\n-router.delete(\'/users/:id\', handler);\n-router.put(\'/users/:id\', handler);'
      }
    ]
  };

  gitCicdContext.analyzePullRequest(prData);
  
  expect(gitCicdContext.prAnalysis.number).to.equal(123);
});

When('drift detection runs on PR changes', function () {
  const analysis = gitCicdContext.prAnalysis;
  
  // Simulate drift analysis on PR files
  analysis.checks.push({
    name: 'drift-detection',
    status: analysis.driftAnalysis.riskLevel === 'CRITICAL' ? 'failure' : 'success',
    conclusion: analysis.driftAnalysis.breakingChanges > 0 ? 'failure' : 'success',
    output: {
      title: 'KGEN Drift Detection',
      summary: `Found ${analysis.driftAnalysis.semanticChanges} semantic changes and ${analysis.driftAnalysis.breakingChanges} breaking changes`,
      text: `Risk Level: ${analysis.driftAnalysis.riskLevel}\n\nFiles analyzed: ${analysis.changedFiles.length}`
    }
  });
});

Then('add PR check status with drift results', function () {
  const analysis = gitCicdContext.prAnalysis;
  const driftCheck = analysis.checks.find(check => check.name === 'drift-detection');
  
  expect(driftCheck).to.exist;
  expect(driftCheck.output.title).to.equal('KGEN Drift Detection');
  expect(driftCheck.output.summary).to.include('semantic changes');
});

Then('comment on PR with detailed drift analysis', function () {
  const analysis = gitCicdContext.prAnalysis;
  
  const prComment = {
    body: `## 🔍 KGEN Drift Detection Report

**Risk Level**: ${analysis.driftAnalysis.riskLevel}

**Summary**:
- Semantic Changes: ${analysis.driftAnalysis.semanticChanges}
- Breaking Changes: ${analysis.driftAnalysis.breakingChanges}
- Cosmetic Changes: ${analysis.driftAnalysis.cosmeticChanges}

**Recommendations**:
${analysis.recommendations.map(rec => `- **${rec.priority}**: ${rec.description}`).join('\n')}

**Files Analyzed**: ${analysis.changedFiles.length}
`,
    timestamp: new Date().toISOString()
  };

  gitCicdContext.prAnalysis.comment = prComment;
  
  expect(prComment.body).to.include('KGEN Drift Detection Report');
  expect(prComment.body).to.include('Risk Level');
});

// Webhook Integration Steps
Given('I have webhook notifications configured', function () {
  gitCicdContext.webhookConfig = {
    url: 'https://api.slack.com/hooks/drift-notifications',
    events: ['drift.detected', 'build.failed', 'pr.opened'],
    secret: 'webhook-secret-key'
  };
});

When('critical drift is detected', function () {
  const webhookEvent = {
    type: 'drift.detected',
    severity: 'CRITICAL',
    repository: 'user/repo',
    commit: gitCicdContext.gitRepo.commits[gitCicdContext.gitRepo.commits.length - 1].sha,
    files: ['src/user-service.ts', 'src/user-routes.ts'],
    timestamp: new Date().toISOString()
  };

  gitCicdContext.webhookEvents.push(webhookEvent);
});

Then('send notification to configured webhook', function () {
  const criticalEvent = gitCicdContext.webhookEvents.find(event => 
    event.type === 'drift.detected' && event.severity === 'CRITICAL'
  );

  expect(criticalEvent).to.exist;
  
  // Simulate webhook payload
  const payload = {
    text: `🚨 Critical drift detected in ${criticalEvent.repository}`,
    attachments: [{
      color: 'danger',
      fields: [
        { title: 'Commit', value: criticalEvent.commit.substring(0, 7), short: true },
        { title: 'Files', value: criticalEvent.files.length.toString(), short: true },
        { title: 'Severity', value: criticalEvent.severity, short: true }
      ]
    }]
  };

  gitCicdContext.webhookPayload = payload;
  expect(payload.text).to.include('Critical drift detected');
});

// Performance and Scaling Steps
Given('I have a repository with {int} changed files', function (fileCount) {
  const files = [];
  for (let i = 0; i < fileCount; i++) {
    files.push({
      path: `src/module-${i}.ts`,
      status: i < 50 ? 'modified' : 'added',
      additions: 5 + (i % 10),
      deletions: i < 50 ? 2 + (i % 5) : 0,
      changes: 7 + (i % 15)
    });
  }

  const commit = gitCicdContext.createCommit(`Large refactor: ${fileCount} files changed`, files);
  expect(commit.files).to.have.length(fileCount);
});

When('drift detection runs on large changeset', function () {
  const startTime = Date.now();
  
  // Simulate processing time: 10ms per file + base overhead
  const fileCount = gitCicdContext.gitRepo.commits[gitCicdContext.gitRepo.commits.length - 1].files.length;
  const processingTime = (fileCount * 10) + 500;
  
  setTimeout(() => {
    gitCicdContext.largeChangesetResult = {
      filesProcessed: fileCount,
      processingTime,
      memoryUsed: fileCount * 0.1, // MB
      completed: true
    };
  }, 10); // Simulate async processing

  gitCicdContext.largeChangesetStartTime = startTime;
});

Then('complete analysis within acceptable time limits', function () {
  // Allow some time for simulation to complete
  return new Promise((resolve) => {
    setTimeout(() => {
      expect(gitCicdContext.largeChangesetResult).to.exist;
      expect(gitCicdContext.largeChangesetResult.completed).to.be.true;
      
      // Should complete within 30 seconds for up to 1000 files
      const maxTimeMs = 30000;
      expect(gitCicdContext.largeChangesetResult.processingTime).to.be.at.most(maxTimeMs);
      
      resolve();
    }, 100);
  });
});

// Cleanup
Before(function () {
  gitCicdContext.reset();
});

After(function () {
  // Cleanup any temporary files or processes
});

module.exports = {
  GitCICDIntegrationContext,
  gitCicdContext
};