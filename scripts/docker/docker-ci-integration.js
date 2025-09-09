#!/usr/bin/env node

/**
 * Docker CI Integration Script
 * Provides CI/CD integration for Docker testing environment
 */

import { spawn, exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DockerCIIntegration {
    constructor() {
        this.config = {
            projectRoot: path.resolve(__dirname, '../..'),
            dockerComposeFile: 'docker/docker-compose.testing.yml',
            ciConfigFile: '.github/workflows/docker-tests.yml',
            maxRetries: 3,
            timeoutMinutes: 30,
            artifactPaths: [
                'test-results-docker',
                'coverage',
                'reports'
            ]
        };
        
        this.ciProviders = {
            github: this.generateGitHubActions.bind(this),
            gitlab: this.generateGitLabCI.bind(this),
            jenkins: this.generateJenkinsfile.bind(this),
            circleci: this.generateCircleCI.bind(this)
        };
    }

    async claudeFlowHooks(action, data = {}) {
        try {
            console.log(`🔗 Claude Flow Hook: ${action}`, data);
            // Integration with Claude Flow coordination
        } catch (error) {
            console.warn('Claude Flow hook failed:', error.message);
        }
    }

    async initialize() {
        console.log('🚀 Initializing Docker CI integration...');
        await this.claudeFlowHooks('pre-task', { description: 'Docker CI integration setup' });
        
        // Verify Docker environment
        await this.verifyDockerEnvironment();
        
        // Create CI configuration directory
        await fs.mkdir(path.join(this.config.projectRoot, '.ci'), { recursive: true });
        
        console.log('✅ Docker CI integration initialized');
    }

    async verifyDockerEnvironment() {
        try {
            await this.execPromise('docker --version');
            await this.execPromise('docker-compose --version');
            console.log('✅ Docker environment verified');
        } catch (error) {
            throw new Error(`Docker environment verification failed: ${error.message}`);
        }
    }

    async execPromise(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });
    }

    async generateGitHubActions() {
        const workflow = `name: Docker Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  schedule:
    # Run tests daily at 2 AM UTC
    - cron: '0 2 * * *'

env:
  DOCKER_BUILDKIT: 1
  COMPOSE_DOCKER_CLI_BUILD: 1

jobs:
  docker-test-matrix:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        test-type: [minimal, security, performance, integration]
        node-version: [18, 20]
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
      
    - name: Cache Docker layers
      uses: actions/cache@v3
      with:
        path: /tmp/.buildx-cache
        key: \${{ runner.os }}-buildx-\${{ github.sha }}
        restore-keys: |
          \${{ runner.os }}-buildx-
    
    - name: Claude Flow Pre-task Hook
      run: |
        npx claude-flow@alpha hooks pre-task --description "Docker CI test execution" || true
    
    - name: Build Docker images
      run: |
        docker-compose -f docker/docker-compose.testing.yml build --parallel
        
    - name: Run \${{ matrix.test-type }} tests
      run: |
        ./scripts/docker/run-docker-tests.sh \${{ matrix.test-type }} -v
        
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: test-results-\${{ matrix.test-type }}-node\${{ matrix.node-version }}
        path: |
          test-results-docker/
          reports/
          coverage/
        retention-days: 30
    
    - name: Claude Flow Post-task Hook
      if: always()
      run: |
        npx claude-flow@alpha hooks post-task --task-id "docker-ci-\${{ matrix.test-type }}" || true

  docker-comprehensive-test:
    runs-on: ubuntu-latest
    needs: docker-test-matrix
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
      
    - name: Run comprehensive tests
      run: |
        ./scripts/docker/run-docker-tests.sh all -c -v
        
    - name: Generate final report
      run: |
        node scripts/docker/aggregate-test-results.js
        
    - name: Upload comprehensive results
      uses: actions/upload-artifact@v3
      with:
        name: comprehensive-test-results
        path: |
          test-results-docker/
          reports/
          coverage/
    
    - name: Comment PR with results
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v6
      with:
        script: |
          const fs = require('fs');
          try {
            const report = JSON.parse(fs.readFileSync('reports/docker-test-summary.json', 'utf8'));
            const comment = \`## 🐳 Docker Test Results
            
            | Metric | Value |
            |--------|-------|
            | Total Tests | \${report.summary.totalTests} |
            | Passed | \${report.summary.passedTests} |
            | Failed | \${report.summary.failedTests} |
            | Success Rate | \${report.summary.successRate}% |
            
            \${report.summary.failedTests > 0 ? '❌ Some tests failed!' : '✅ All tests passed!'}
            \`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
          } catch (error) {
            console.log('Could not post test results comment:', error.message);
          }

  docker-security-scan:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: 'unjucks:testing'
        format: 'sarif'
        output: 'trivy-results.sarif'
        
    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'

  docker-performance-baseline:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Run performance baseline tests
      run: |
        ./scripts/docker/run-docker-tests.sh performance -v
        
    - name: Store performance baseline
      run: |
        mkdir -p .ci/baselines
        cp reports/performance-results.json .ci/baselines/performance-baseline-$(date +%Y%m%d).json
        
    - name: Commit baseline if changed
      run: |
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action"
        git add .ci/baselines/
        git diff --staged --quiet || git commit -m "Update performance baseline [skip ci]"
        git push
`;

        await fs.writeFile(
            path.join(this.config.projectRoot, '.github/workflows/docker-tests.yml'),
            workflow
        );
        
        console.log('✅ GitHub Actions workflow generated');
    }

    async generateGitLabCI() {
        const config = `# GitLab CI configuration for Docker tests
stages:
  - build
  - test
  - report
  - deploy

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_BUILDKIT: 1
  COMPOSE_DOCKER_CLI_BUILD: 1

services:
  - docker:dind

before_script:
  - docker --version
  - docker-compose --version

build-images:
  stage: build
  script:
    - npx claude-flow@alpha hooks pre-task --description "GitLab CI Docker build" || true
    - docker-compose -f docker/docker-compose.testing.yml build
    - npx claude-flow@alpha hooks post-task --task-id "gitlab-build" || true
  artifacts:
    paths:
      - docker/
    expire_in: 1 hour

.test-template: &test-template
  stage: test
  dependencies:
    - build-images
  artifacts:
    when: always
    paths:
      - test-results-docker/
      - reports/
      - coverage/
    expire_in: 1 week
    reports:
      junit: test-results-docker/*.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

test:minimal:
  <<: *test-template
  script:
    - ./scripts/docker/run-docker-tests.sh minimal -v

test:security:
  <<: *test-template
  script:
    - ./scripts/docker/run-docker-tests.sh security -v
  allow_failure: true

test:performance:
  <<: *test-template
  script:
    - ./scripts/docker/run-docker-tests.sh performance -v
  artifacts:
    reports:
      performance: reports/performance-results.json

test:integration:
  <<: *test-template
  script:
    - ./scripts/docker/run-docker-tests.sh integration -v

comprehensive-test:
  stage: test
  dependencies:
    - build-images
  script:
    - ./scripts/docker/run-docker-tests.sh all -c -v
    - node scripts/docker/aggregate-test-results.js
  artifacts:
    when: always
    paths:
      - test-results-docker/
      - reports/
    reports:
      junit: test-results-docker/*.xml
  only:
    - main
    - develop

generate-report:
  stage: report
  dependencies:
    - test:minimal
    - test:security
    - test:performance
    - test:integration
  script:
    - node scripts/docker/aggregate-test-results.js
  artifacts:
    paths:
      - reports/docker-test-report.html
    expire_in: 30 days
  only:
    - main
    - merge_requests
`;

        await fs.writeFile(
            path.join(this.config.projectRoot, '.gitlab-ci.yml'),
            config
        );
        
        console.log('✅ GitLab CI configuration generated');
    }

    async generateJenkinsfile() {
        const jenkinsfile = `pipeline {
    agent any
    
    environment {
        DOCKER_BUILDKIT = '1'
        COMPOSE_DOCKER_CLI_BUILD = '1'
    }
    
    stages {
        stage('Setup') {
            steps {
                script {
                    sh 'npx claude-flow@alpha hooks pre-task --description "Jenkins Docker CI pipeline" || true'
                }
                sh 'docker --version'
                sh 'docker-compose --version'
            }
        }
        
        stage('Build Images') {
            steps {
                sh 'docker-compose -f docker/docker-compose.testing.yml build --parallel'
            }
        }
        
        stage('Parallel Tests') {
            parallel {
                stage('Minimal Tests') {
                    steps {
                        sh './scripts/docker/run-docker-tests.sh minimal -v'
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: 'test-results-docker/**', allowEmptyArchive: true
                        }
                    }
                }
                
                stage('Security Tests') {
                    steps {
                        catchError(buildResult: 'UNSTABLE', stageResult: 'FAILURE') {
                            sh './scripts/docker/run-docker-tests.sh security -v'
                        }
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: 'test-results-docker/**', allowEmptyArchive: true
                        }
                    }
                }
                
                stage('Performance Tests') {
                    steps {
                        sh './scripts/docker/run-docker-tests.sh performance -v'
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: 'test-results-docker/**', allowEmptyArchive: true
                        }
                    }
                }
                
                stage('Integration Tests') {
                    steps {
                        sh './scripts/docker/run-docker-tests.sh integration -v'
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: 'test-results-docker/**', allowEmptyArchive: true
                        }
                    }
                }
            }
        }
        
        stage('Comprehensive Test') {
            when {
                anyOf {
                    branch 'main'
                    branch 'develop'
                }
            }
            steps {
                sh './scripts/docker/run-docker-tests.sh all -c -v'
                sh 'node scripts/docker/aggregate-test-results.js'
            }
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'reports',
                        reportFiles: 'docker-test-report.html',
                        reportName: 'Docker Test Report'
                    ])
                    
                    archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
                }
            }
        }
    }
    
    post {
        always {
            sh 'docker-compose -f docker/docker-compose.testing.yml down --remove-orphans'
            sh 'npx claude-flow@alpha hooks post-task --task-id "jenkins-docker-ci" || true'
        }
        
        success {
            echo 'All Docker tests passed successfully!'
        }
        
        failure {
            echo 'Some Docker tests failed. Check the reports for details.'
        }
        
        unstable {
            echo 'Some tests are unstable but the build succeeded.'
        }
    }
}
`;

        await fs.writeFile(
            path.join(this.config.projectRoot, 'Jenkinsfile'),
            jenkinsfile
        );
        
        console.log('✅ Jenkinsfile generated');
    }

    async generateCircleCI() {
        const config = `version: 2.1

orbs:
  docker: circleci/docker@2.2.0

executors:
  docker-executor:
    docker:
      - image: cimg/base:stable
    resource_class: medium

jobs:
  build-and-test:
    executor: docker-executor
    steps:
      - checkout
      - setup_remote_docker:
          version: 20.10.14
          docker_layer_caching: true
      
      - run:
          name: Claude Flow Pre-task Hook
          command: npx claude-flow@alpha hooks pre-task --description "CircleCI Docker tests" || true
      
      - run:
          name: Build Docker images
          command: docker-compose -f docker/docker-compose.testing.yml build --parallel
      
      - run:
          name: Run minimal tests
          command: ./scripts/docker/run-docker-tests.sh minimal -v
      
      - run:
          name: Run security tests
          command: ./scripts/docker/run-docker-tests.sh security -v || true
      
      - run:
          name: Run performance tests
          command: ./scripts/docker/run-docker-tests.sh performance -v
      
      - run:
          name: Run integration tests
          command: ./scripts/docker/run-docker-tests.sh integration -v
      
      - run:
          name: Generate comprehensive report
          command: node scripts/docker/aggregate-test-results.js
      
      - store_test_results:
          path: test-results-docker
      
      - store_artifacts:
          path: test-results-docker
          destination: test-results
      
      - store_artifacts:
          path: reports
          destination: reports
      
      - store_artifacts:
          path: coverage
          destination: coverage
      
      - run:
          name: Claude Flow Post-task Hook
          command: npx claude-flow@alpha hooks post-task --task-id "circleci-docker" || true
          when: always

workflows:
  version: 2
  docker-tests:
    jobs:
      - build-and-test:
          filters:
            branches:
              only:
                - main
                - develop
                - /feature/.*/
                - /hotfix/.*/
  
  nightly-tests:
    triggers:
      - schedule:
          cron: "0 2 * * *"
          filters:
            branches:
              only:
                - main
    jobs:
      - build-and-test
`;

        await fs.writeFile(
            path.join(this.config.projectRoot, '.circleci/config.yml'),
            config
        );
        
        console.log('✅ CircleCI configuration generated');
    }

    async generateCIConfigurations() {
        console.log('📝 Generating CI/CD configurations...');
        
        // Create directories
        await fs.mkdir(path.join(this.config.projectRoot, '.github/workflows'), { recursive: true });
        await fs.mkdir(path.join(this.config.projectRoot, '.circleci'), { recursive: true });
        
        // Generate all CI configurations
        await Promise.all([
            this.generateGitHubActions(),
            this.generateGitLabCI(),
            this.generateJenkinsfile(),
            this.generateCircleCI()
        ]);
        
        await this.claudeFlowHooks('post-edit', { 
            file: 'ci-configurations', 
            'memory-key': 'swarm/docker/ci-generated' 
        });
        
        console.log('✅ All CI/CD configurations generated');
    }

    async generateDockerOptimizations() {
        console.log('🔧 Generating Docker optimization configurations...');
        
        // .dockerignore for faster builds
        const dockerignore = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Test results and coverage
test-results*/
coverage/
reports/
*.log

# Development files
.git/
.gitignore
.env*
.DS_Store

# Documentation
docs/
*.md
!README.md

# IDE files
.vscode/
.idea/
*.swp
*.swo

# Temporary files
tmp/
temp/
.cache/
.npm/

# Build artifacts
dist/
build/
.output/

# Claude Flow artifacts
.claude-flow/
.swarm/
.hive-mind/
`;

        await fs.writeFile(
            path.join(this.config.projectRoot, '.dockerignore'),
            dockerignore
        );

        // Docker buildx configuration
        const buildxConfig = {
            "experimental": true,
            "buildkit": true,
            "features": {
                "containerd-snapshotter": true
            }
        };

        await fs.writeFile(
            path.join(this.config.projectRoot, '.ci/buildx-config.json'),
            JSON.stringify(buildxConfig, null, 2)
        );

        console.log('✅ Docker optimization configurations generated');
    }

    async run() {
        try {
            await this.initialize();
            await this.generateCIConfigurations();
            await this.generateDockerOptimizations();
            
            await this.claudeFlowHooks('post-task', { 
                'task-id': 'docker-ci-integration',
                configurations: Object.keys(this.ciProviders)
            });
            
            console.log('🎉 Docker CI integration setup completed successfully!');
            console.log('📁 Generated configurations:');
            console.log('  - GitHub Actions: .github/workflows/docker-tests.yml');
            console.log('  - GitLab CI: .gitlab-ci.yml');
            console.log('  - Jenkins: Jenkinsfile');
            console.log('  - CircleCI: .circleci/config.yml');
            console.log('  - Docker optimizations: .dockerignore, .ci/buildx-config.json');
            
        } catch (error) {
            console.error('❌ Docker CI integration failed:', error);
            await this.claudeFlowHooks('error', { error: error.message });
            process.exit(1);
        }
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const integration = new DockerCIIntegration();
    integration.run();
}

export default DockerCIIntegration;