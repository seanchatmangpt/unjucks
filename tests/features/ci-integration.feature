Feature: CI/CD Integration for Semantic Drift Detection
  As a DevOps engineer
  I want to integrate KGEN drift detection into CI/CD pipelines
  So that semantic changes are caught before deployment

  Background:
    Given KGEN is installed in the CI environment
    And baseline artifacts are available from previous builds
    And proper exit codes are configured for CI interpretation

  @ci-integration @exit-codes
  Scenario: Proper exit codes for CI pipeline decisions
    Given I have a CI pipeline running KGEN drift detection
    When no semantic changes are detected
    Then KGEN should exit with code 0
    And CI pipeline should continue to next stage
    When only cosmetic changes are detected
    Then KGEN should exit with code 0
    And log "Cosmetic changes only, no semantic drift"
    When semantic changes are detected
    Then KGEN should exit with code 3
    And CI pipeline should halt for manual review

  @ci-integration @github-actions
  Scenario: GitHub Actions workflow integration
    Given I have a GitHub Actions workflow with KGEN step
    And the workflow runs on pull requests
    When a PR contains semantic changes in generated artifacts
    Then KGEN should exit with code 3
    And GitHub Actions should mark the check as "failed"
    And create a comment with drift analysis report
    And prevent auto-merge until reviewed

  @ci-integration @pipeline-artifacts
  Scenario: Store drift analysis artifacts for CI
    Given KGEN runs in a CI pipeline
    When semantic drift is detected
    Then generate "drift-report.json" with detailed analysis
    And create "drift-summary.md" for human review
    And store artifacts for 30 days retention
    And make artifacts downloadable from CI interface

  @ci-integration @baseline-management
  Scenario: Automated baseline updates in CI
    Given I have a successful build with semantic changes approved
    When the build reaches the main branch
    Then KGEN should update baseline artifacts automatically
    And commit new baselines with message "chore: update KGEN baselines"
    And tag the commit with "kgen-baseline-v{timestamp}"
    And notify team of baseline update

  @ci-integration @multi-branch
  Scenario: Handle baselines across multiple branches
    Given I have feature branch "feature/user-management"
    And main branch has baseline version "1.0"
    When feature branch runs KGEN drift detection
    Then compare against main branch baseline
    And also compare against feature branch previous state
    And report drift relative to both baselines
    And exit with code 3 if either comparison shows semantic drift

  @ci-integration @parallel-builds
  Scenario: Concurrent drift detection in parallel CI jobs
    Given I have a CI matrix build with 4 parallel jobs
    And each job processes different artifact subsets
    When all jobs run KGEN drift detection simultaneously
    Then each job should analyze only assigned artifacts
    And aggregate results in a final consolidation step
    And single final exit code (0 or 3) for entire build

  @ci-integration @build-cache
  Scenario: Utilize CI build cache for drift detection
    Given CI environment has build caching enabled
    When KGEN runs drift detection
    Then cache artifact checksums and analysis results
    And skip analysis for unchanged files in subsequent runs
    And reduce analysis time by 70% for cached artifacts
    And maintain cache validity for 7 days

  @ci-integration @notification-channels
  Scenario: Configure notifications for semantic drift
    Given semantic drift is detected in CI
    When drift severity is "HIGH"
    Then send immediate Slack notification to "#dev-alerts"
    And email engineering leads
    And create JIRA ticket for investigation
    When drift severity is "MEDIUM"
    Then post to "#dev-notifications"
    When drift severity is "LOW"
    Then only log to build output

  @ci-integration @deployment-gating
  Scenario: Gate deployments based on drift analysis
    Given production deployment pipeline is configured
    When KGEN detects HIGH severity semantic drift
    Then block deployment to production
    And require manual approval with justification
    And log approval decision for audit trail
    When drift is MEDIUM severity
    Then allow deployment with warning notification
    When drift is LOW severity or no drift
    Then allow automatic deployment

  @ci-integration @rollback-scenarios
  Scenario: Handle rollback scenarios with drift detection
    Given production deployment is rolled back
    And previous version baselines are available
    When KGEN analyzes current state against rollback target
    Then detect semantic differences from rollback
    And warn about potential issues from version downgrade
    And suggest data migration considerations
    And exit with appropriate code based on rollback safety

  @ci-integration @metrics-collection
  Scenario: Collect drift detection metrics for CI analytics
    Given KGEN runs in CI pipeline
    When drift detection completes
    Then record analysis duration
    And count semantic vs cosmetic changes
    And track signal-to-noise ratio over time
    And measure CI pipeline impact (time added)
    And export metrics to monitoring system

  @ci-integration @docker-container
  Scenario: Run KGEN drift detection in Docker container
    Given CI pipeline uses Docker for isolation
    When KGEN drift detection runs in container
    Then mount baseline artifacts as read-only volume
    And mount current artifacts as read-write volume
    And ensure container has proper permissions
    And exit container with correct code (0 or 3)
    And preserve drift reports in mounted volume

  @ci-integration @security-scanning
  Scenario: Integrate with security scanning in CI
    Given CI pipeline includes security scanning
    When KGEN detects semantic changes in security-related code
    Then trigger additional security scans on changed artifacts
    And flag for security team review
    And require security approval before merge
    And track security-sensitive drift patterns

  @ci-integration @performance-budget
  Scenario: Enforce performance budgets in CI drift detection
    Given CI has performance budget enforcement
    When KGEN detects changes that may impact performance
    Then run performance benchmarks on affected code
    And compare against performance baseline
    And fail CI if performance regression > 10%
    And provide performance analysis in drift report

  @ci-integration @compliance-reporting
  Scenario: Generate compliance reports for semantic changes
    Given organization requires change compliance reporting
    When KGEN detects semantic drift
    Then generate compliance report with change catalog
    And include risk assessment for each change
    And map changes to affected business capabilities
    And export report in required compliance format
    And store in compliance audit trail