# GitHub Spec Kit Installation Guide

## Overview

The GitHub Spec Kit provides a comprehensive framework for managing specifications, requirements, and documentation directly within GitHub repositories. It integrates seamlessly with Unjucks for specification-driven development workflows.

## Prerequisites

- GitHub account with repository admin access
- Node.js 18+ installed locally
- Git CLI configured with SSH keys
- GitHub CLI (`gh`) installed (optional but recommended)

## Installation Methods

### Method 1: NPM Package Installation (Recommended)

```bash
# Install globally
npm install -g @unjucks/github-spec-kit

# Or install locally in project
npm install --save-dev @unjucks/github-spec-kit

# Verify installation
spec-kit --version
```

### Method 2: GitHub App Installation

1. **Install the GitHub App**:
   - Visit: https://github.com/apps/unjucks-spec-kit
   - Click "Install" and select repositories
   - Grant necessary permissions

2. **Configure Webhook**:
   ```bash
   # Set up webhook endpoint
   spec-kit webhook setup --repository your-org/your-repo
   ```

### Method 3: Manual Setup from Source

```bash
# Clone the repository
git clone https://github.com/unjucks/github-spec-kit.git
cd github-spec-kit

# Install dependencies
npm install

# Build the project
npm run build

# Link globally
npm link

# Verify installation
spec-kit --version
```

## Repository Configuration

### Initialize Spec Kit in Repository

```bash
# Navigate to your project repository
cd your-project

# Initialize spec kit configuration
spec-kit init

# Choose configuration options
? Select specification types: (Use arrow keys, space to select)
❯ ◉ Requirements (BRD, SRS, User Stories)
  ◉ Architecture (SAD, API Design, Database Schema)
  ◉ Test Specifications (BDD Features, Test Plans)
  ◉ Process Documentation (Workflows, Guidelines)
```

This creates the following structure:
```
.github/
├── spec-kit.yml           # Main configuration
├── workflows/
│   ├── spec-validation.yml # Auto-validation workflow
│   ├── spec-generation.yml # Template generation
│   └── spec-review.yml     # Review automation
├── ISSUE_TEMPLATE/
│   ├── requirement.yml     # Requirement issues
│   ├── architecture.yml    # Architecture decisions
│   └── test-specification.yml
└── PULL_REQUEST_TEMPLATE/
    └── specification-change.md

.spec-kit/
├── templates/              # Specification templates
├── validation/             # Validation rules
├── generation/             # Code generation config
└── workflows/              # Custom workflows

specs/
├── requirements/           # Requirements documents
├── architecture/           # Architecture documents
├── api/                   # API specifications
└── testing/               # Test specifications
```

### Configure Spec Kit Settings

Edit `.github/spec-kit.yml`:

```yaml
# GitHub Spec Kit Configuration
version: "2.0"

# Repository settings
repository:
  name: "your-project"
  organization: "your-org"
  
# Specification management
specifications:
  # Directory structure
  directories:
    requirements: "specs/requirements"
    architecture: "specs/architecture"
    api: "specs/api"
    testing: "specs/testing"
  
  # Supported formats
  formats:
    - markdown
    - yaml
    - json
    - openapi
  
  # Validation rules
  validation:
    required_sections:
      - overview
      - requirements
      - acceptance_criteria
    naming_convention: "kebab-case"
    max_file_size: "1MB"

# Integration settings
integrations:
  unjucks:
    enabled: true
    templates_dir: "./templates"
    output_dir: "./src"
  
  claude_ai:
    enabled: true
    model: "claude-3-sonnet"
    max_tokens: 4000
  
  github_copilot:
    enabled: true
    
# Automation settings
automation:
  # Auto-generate issues from specifications
  issue_generation:
    enabled: true
    labels: ["specification", "auto-generated"]
  
  # Auto-validate specifications on PR
  validation:
    enabled: true
    fail_on_error: true
  
  # Auto-generate code from specifications
  code_generation:
    enabled: true
    trigger: "on_merge"
  
# Workflow settings
workflows:
  specification_review:
    required_reviewers: 2
    auto_assign: true
    assignees:
      - "tech-lead"
      - "product-owner"
  
  approval_process:
    stages:
      - name: "technical_review"
        required: true
        reviewers: ["@dev-team"]
      - name: "business_review"
        required: true
        reviewers: ["@product-team"]
      - name: "final_approval"
        required: true
        reviewers: ["@architects"]

# Notification settings
notifications:
  channels:
    slack:
      webhook_url: "${SLACK_WEBHOOK_URL}"
      channel: "#specifications"
    
    email:
      enabled: true
      recipients: ["team@company.com"]
  
  events:
    - specification_created
    - specification_updated
    - review_requested
    - approval_granted

# Security settings
security:
  branch_protection:
    enabled: true
    required_reviews: 2
    dismiss_stale_reviews: true
    require_code_owner_reviews: true
  
  webhook_secret: "${GITHUB_WEBHOOK_SECRET}"
  
# Advanced settings
advanced:
  caching:
    enabled: true
    ttl: "1h"
  
  performance:
    parallel_processing: true
    max_concurrent_jobs: 3
  
  debugging:
    log_level: "info"
    detailed_errors: false
```

## GitHub Actions Workflows

### Specification Validation Workflow

Create `.github/workflows/spec-validation.yml`:

```yaml
name: Specification Validation

on:
  pull_request:
    paths:
      - 'specs/**'
      - '.spec-kit/**'
  push:
    branches: [main]
    paths:
      - 'specs/**'

jobs:
  validate-specs:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout repository
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        npm install -g @unjucks/github-spec-kit
        npm ci
    
    - name: Validate specifications
      run: |
        spec-kit validate --directory specs/
        spec-kit lint --fix --directory specs/
      
    - name: Check specification completeness
      run: |
        spec-kit check-completeness --directory specs/
        spec-kit trace-requirements --directory specs/
    
    - name: Generate validation report
      run: |
        spec-kit report --format markdown --output validation-report.md
      
    - name: Upload validation report
      uses: actions/upload-artifact@v4
      with:
        name: validation-report
        path: validation-report.md
    
    - name: Comment on PR with validation results
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v7
      with:
        script: |
          const fs = require('fs');
          const report = fs.readFileSync('validation-report.md', 'utf8');
          
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: '## Specification Validation Report\n\n' + report
          });
```

### Code Generation Workflow

Create `.github/workflows/spec-generation.yml`:

```yaml
name: Code Generation from Specifications

on:
  push:
    branches: [main]
    paths:
      - 'specs/**'
  
  workflow_dispatch:
    inputs:
      spec_path:
        description: 'Path to specification file'
        required: false
        default: 'specs/'

jobs:
  generate-code:
    runs-on: ubuntu-latest
    
    permissions:
      contents: write
      pull-requests: write
    
    steps:
    - name: Checkout repository
      uses: actions/checkout@v4
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        npm install -g @unjucks/github-spec-kit @unjucks/cli
        npm ci
    
    - name: Generate code from specifications
      run: |
        # Analyze specifications
        spec-kit analyze --directory ${{ github.event.inputs.spec_path || 'specs/' }}
        
        # Generate code using Unjucks
        unjucks generate-from-specs --specs-dir specs/ --output-dir src/
        
        # Generate tests
        unjucks generate tests --from-specs specs/ --output-dir tests/
        
        # Generate documentation
        unjucks generate docs --from-specs specs/ --output-dir docs/generated/
    
    - name: Run generated tests
      run: |
        npm test
    
    - name: Commit generated code
      run: |
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action"
        
        git add .
        
        if ! git diff --cached --quiet; then
          git commit -m "Auto-generate code from specifications
          
          Generated from: ${{ github.sha }}
          Specifications: ${{ github.event.inputs.spec_path || 'specs/' }}
          
          [skip ci]"
          
          git push
        fi
    
    - name: Create PR for generated changes
      if: github.ref != 'refs/heads/main'
      run: |
        if ! git diff --quiet origin/main; then
          gh pr create \
            --title "Auto-generated code from specifications" \
            --body "This PR contains code automatically generated from specification changes." \
            --label "auto-generated,specification-driven"
        fi
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Issue and PR Templates

### Requirement Issue Template

Create `.github/ISSUE_TEMPLATE/requirement.yml`:

```yaml
name: Requirement Specification
description: Create a new requirement specification
title: "[REQ] "
labels: ["requirement", "specification"]
assignees: ["product-owner"]

body:
  - type: markdown
    attributes:
      value: |
        ## Requirement Specification
        
        Please provide detailed information about this requirement.
        This will be used to generate formal specification documents.
  
  - type: input
    id: requirement-id
    attributes:
      label: Requirement ID
      description: Unique identifier for this requirement
      placeholder: "REQ-001"
    validations:
      required: true
  
  - type: textarea
    id: description
    attributes:
      label: Description
      description: Clear description of the requirement
      placeholder: "As a [user type], I want [functionality] so that [benefit]"
    validations:
      required: true
  
  - type: dropdown
    id: priority
    attributes:
      label: Priority
      description: Business priority of this requirement
      options:
        - Critical
        - High
        - Medium
        - Low
    validations:
      required: true
  
  - type: checkboxes
    id: categories
    attributes:
      label: Categories
      description: Select applicable categories
      options:
        - label: Functional Requirement
        - label: Non-Functional Requirement
        - label: Business Rule
        - label: User Interface
        - label: Performance
        - label: Security
        - label: Compliance
  
  - type: textarea
    id: acceptance-criteria
    attributes:
      label: Acceptance Criteria
      description: Specific criteria that must be met
      placeholder: |
        - [ ] Criterion 1
        - [ ] Criterion 2
        - [ ] Criterion 3
    validations:
      required: true
  
  - type: textarea
    id: dependencies
    attributes:
      label: Dependencies
      description: Other requirements or components this depends on
      placeholder: "REQ-002, Component-X"
  
  - type: input
    id: epic
    attributes:
      label: Epic/Feature
      description: Parent epic or feature this requirement belongs to
      placeholder: "EPIC-001"
```

## Environment Configuration

### Required Environment Variables

Create `.env` file (add to `.gitignore`):

```bash
# GitHub Configuration
GITHUB_TOKEN=your_github_token_here
GITHUB_ORG=your-organization
GITHUB_REPO=your-repository
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Spec Kit Configuration
SPEC_KIT_CONFIG_PATH=./.github/spec-kit.yml
SPEC_KIT_TEMPLATES_DIR=./templates
SPEC_KIT_OUTPUT_DIR=./specs

# Integration Keys
ANTHROPIC_API_KEY=your_claude_api_key
SLACK_WEBHOOK_URL=your_slack_webhook_url

# Optional: Advanced Settings
SPEC_KIT_DEBUG=false
SPEC_KIT_CACHE_TTL=3600
SPEC_KIT_MAX_FILE_SIZE=1048576
```

### GitHub Secrets Configuration

Add these secrets in your GitHub repository settings:

```bash
# Required Secrets
ANTHROPIC_API_KEY         # For Claude AI integration
SLACK_WEBHOOK_URL         # For Slack notifications
GITHUB_WEBHOOK_SECRET     # For webhook security

# Optional Secrets
NPM_TOKEN                 # For publishing packages
SONAR_TOKEN              # For code quality analysis
CODECOV_TOKEN            # For coverage reporting
```

## Verification and Testing

### Test Installation

```bash
# Test CLI installation
spec-kit --version
spec-kit help

# Test repository configuration
spec-kit validate-config .github/spec-kit.yml

# Test GitHub integration
spec-kit test-github-connection

# Test webhook setup
spec-kit test-webhooks
```

### Validation Commands

```bash
# Validate all specifications
spec-kit validate --directory specs/

# Check specification completeness
spec-kit check-completeness --directory specs/

# Test code generation
spec-kit generate --dry-run --specs-dir specs/

# Verify workflow configuration
gh workflow list
gh workflow run spec-validation.yml
```

## Next Steps

1. **Complete Repository Setup**: Configure branch protection rules and team permissions
2. **Create First Specification**: Use templates to create your first requirement document
3. **Test Automation**: Trigger workflows to verify everything is working
4. **Team Onboarding**: Share documentation with team members
5. **Advanced Configuration**: Customize workflows for your specific needs

## Troubleshooting

### Common Issues

#### Issue: GitHub App Installation Failed
```bash
# Check app permissions
gh auth status
gh api user

# Reinstall GitHub App
# Visit: https://github.com/settings/installations
# Remove and reinstall the app
```

#### Issue: Workflow Permissions
```bash
# Update repository settings
gh api repos/:owner/:repo --method PATCH --field allow_auto_merge=true
gh api repos/:owner/:repo --method PATCH --field delete_branch_on_merge=true

# Check workflow permissions
gh api repos/:owner/:repo/actions/permissions
```

#### Issue: Template Validation Errors
```bash
# Debug template issues
spec-kit validate --verbose --directory .spec-kit/templates/

# Fix common template issues
spec-kit fix-templates --directory .spec-kit/templates/
```

For additional support, see the [troubleshooting guide](./troubleshooting.md) or create an issue in the GitHub repository.