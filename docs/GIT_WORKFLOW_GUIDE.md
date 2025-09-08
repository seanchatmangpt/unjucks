# Git Workflow and Version Management Guide

## Table of Contents
1. [Overview](#overview)
2. [Branch Strategy](#branch-strategy)
3. [Commit Standards](#commit-standards)
4. [Version Management](#version-management)
5. [Release Process](#release-process)
6. [Pull Request Workflow](#pull-request-workflow)
7. [Hotfix Process](#hotfix-process)
8. [Tag Management](#tag-management)
9. [Git Hooks](#git-hooks)
10. [Best Practices](#best-practices)

## Overview

This guide establishes the Git workflow and version management practices for the Unjucks project. The workflow emphasizes code quality, collaboration, and maintainable release cycles.

### Core Principles
- **Trunk-based Development**: Main branch as source of truth
- **Feature Isolation**: Feature branches for new development
- **Automated Quality**: CI/CD integration with quality gates
- **Semantic Versioning**: Predictable version numbering
- **Clean History**: Readable and meaningful commit history

## Branch Strategy

### Branch Types

#### Main Branches
```
main                    # Production-ready code
├── develop            # Integration branch for features
├── release/v2.1.0     # Release preparation branches
└── hotfix/critical-fix # Emergency fixes for production
```

#### Feature Branches
```
feature/user-auth      # New feature development
feature/rdf-validator  # Semantic web enhancements
feature/cli-improve    # CLI improvements
```

#### Support Branches
```
bugfix/template-error  # Non-critical bug fixes
refactor/build-system  # Code improvements
docs/api-update       # Documentation updates
```

### Branch Naming Conventions
```bash
# Feature branches
feature/short-description
feature/issue-123-user-authentication

# Bug fixes
bugfix/template-generation-error
bugfix/issue-456-cli-hang

# Hotfixes (production issues)
hotfix/security-vulnerability
hotfix/critical-build-failure

# Release branches
release/v2.1.0
release/v2.1.0-beta.1

# Documentation
docs/user-guide-update
docs/api-documentation

# Refactoring
refactor/template-engine
refactor/semantic-processor
```

### Branch Lifecycle

#### Creating Feature Branches
```bash
# Start from latest develop
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/new-template-system

# Push to remote
git push -u origin feature/new-template-system
```

#### Working on Features
```bash
# Make changes and commit regularly
git add .
git commit -m "feat: add new template engine foundation"

# Keep branch updated with develop
git checkout develop
git pull origin develop
git checkout feature/new-template-system
git merge develop

# Push changes
git push origin feature/new-template-system
```

#### Completing Features
```bash
# Final cleanup and testing
npm run lint
npm test
npm run build

# Push final changes
git add .
git commit -m "feat: complete new template system implementation"
git push origin feature/new-template-system

# Create pull request (via GitHub/GitLab interface)
```

## Commit Standards

### Conventional Commits
Using [Conventional Commits](https://conventionalcommits.org/) specification:

#### Commit Message Format
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Commit Types
```bash
feat:     # New feature
fix:      # Bug fix
docs:     # Documentation changes
style:    # Code style changes (formatting, etc.)
refactor: # Code refactoring
perf:     # Performance improvements
test:     # Adding or modifying tests
chore:    # Build process, dependency updates
ci:       # CI/CD configuration changes
revert:   # Reverting previous commits
```

#### Examples
```bash
# Feature addition
feat(cli): add semantic code generation command

# Bug fix
fix(template): resolve variable scoping issue in EJS templates

# Documentation
docs(api): update semantic web API documentation

# Breaking change
feat(cli)!: redesign command structure for better usability

BREAKING CHANGE: Command syntax has changed from `unjucks gen` to `unjucks generate`

# Multiple types
feat(template): add conditional file generation
test(template): add comprehensive template generation tests
```

#### Scope Guidelines
```bash
# Core components
cli           # Command-line interface
template      # Template engine and processing
semantic      # RDF/semantic web features
build         # Build system and tooling

# Specific areas
generator     # Template generators
validator     # Validation systems
docs          # Documentation
test          # Testing infrastructure
```

### Commit Best Practices

1. **Atomic Commits**: One logical change per commit
2. **Clear Messages**: Descriptive and meaningful commit messages
3. **Present Tense**: Use imperative mood ("add" not "added")
4. **50/72 Rule**: 50 characters for subject, 72 for body lines
5. **Reference Issues**: Include issue numbers when applicable

```bash
# Good commits
feat(cli): add --dry-run option for template preview
fix(semantic): handle malformed RDF gracefully (#123)
docs: update installation instructions for Windows

# Poor commits  
fix: stuff
update files
WIP
asdfgh
```

## Version Management

### Semantic Versioning
Following [SemVer](https://semver.org/) with date-based format:

#### Version Format
```
YYYY.M.DD.patch

Examples:
2025.1.15.0      # Major release on January 15, 2025
2025.1.15.1      # Patch release same day
2025.2.1.0       # Minor release on February 1, 2025
```

#### Version Types
```bash
# Major version (breaking changes)
2025.1.1.0 → 2025.2.1.0

# Minor version (new features, backward compatible)  
2025.1.1.0 → 2025.1.15.0

# Patch version (bug fixes)
2025.1.1.0 → 2025.1.1.1
```

### Version Bumping

#### Automated Version Management
```bash
# Automatic version bumping based on commits
npm run version:auto

# Patch version (bug fixes)
npm run version:patch

# Minor version (new features)
npm run version:minor  

# Major version (breaking changes)
npm run version:major

# Custom version
npm version 2025.3.1.0
```

#### Version Bump Script
```javascript
// scripts/auto-version.js
const { execSync } = require('child_process');
const fs = require('fs');

class VersionManager {
  constructor() {
    this.packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    this.currentVersion = this.packageJson.version;
  }
  
  determineVersionType() {
    // Get commits since last version
    const commits = execSync('git log --format="%s" $(git describe --tags --abbrev=0)..HEAD', { encoding: 'utf8' })
      .split('\n')
      .filter(commit => commit.trim());
    
    const hasBreaking = commits.some(commit => 
      commit.includes('BREAKING CHANGE') || commit.includes('!:')
    );
    const hasFeature = commits.some(commit => commit.startsWith('feat'));
    const hasFix = commits.some(commit => commit.startsWith('fix'));
    
    if (hasBreaking) return 'major';
    if (hasFeature) return 'minor';
    if (hasFix) return 'patch';
    return 'patch'; // Default to patch
  }
  
  generateVersion(type) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    
    const [currentYear, currentMonth, currentDay, currentPatch] = 
      this.currentVersion.split('.').map(Number);
    
    if (type === 'major') {
      return `${year}.${month}.${day}.0`;
    } else if (type === 'minor') {
      if (year === currentYear && month === currentMonth) {
        return `${year}.${month}.${day}.0`;
      } else {
        return `${year}.${month}.${day}.0`;
      }
    } else { // patch
      if (year === currentYear && month === currentMonth && day === currentDay) {
        return `${year}.${month}.${day}.${currentPatch + 1}`;
      } else {
        return `${year}.${month}.${day}.0`;
      }
    }
  }
  
  bump(type) {
    const newVersion = this.generateVersion(type);
    
    console.log(`Bumping version: ${this.currentVersion} → ${newVersion}`);
    
    // Update package.json
    this.packageJson.version = newVersion;
    fs.writeFileSync('package.json', JSON.stringify(this.packageJson, null, 2) + '\n');
    
    // Commit version change
    execSync(`git add package.json`);
    execSync(`git commit -m "chore: bump version ${this.currentVersion} → ${newVersion}"`);
    
    // Create tag
    execSync(`git tag -a v${newVersion} -m "Release v${newVersion}"`);
    
    console.log(`✅ Version bumped to ${newVersion}`);
    return newVersion;
  }
}

// Auto-detect version type and bump
const versionManager = new VersionManager();
const versionType = versionManager.determineVersionType();
const newVersion = versionManager.bump(versionType);

console.log(`New version: ${newVersion}`);
```

## Release Process

### Release Preparation

#### 1. Create Release Branch
```bash
# Start from develop
git checkout develop
git pull origin develop

# Create release branch
git checkout -b release/v2025.3.1.0

# Update version
npm run version:auto

# Update changelog
npm run changelog:generate

# Commit changes
git add .
git commit -m "chore: prepare release v2025.3.1.0"

# Push release branch
git push -u origin release/v2025.3.1.0
```

#### 2. Release Testing
```bash
# Run full test suite
npm run test:full

# Run production tests
npm run test:production

# Run security audit
npm audit

# Build and validate
npm run build
npm run test:smoke
```

#### 3. Release Finalization
```bash
# Merge to main
git checkout main
git pull origin main
git merge --no-ff release/v2025.3.1.0
git push origin main

# Merge back to develop
git checkout develop
git merge --no-ff release/v2025.3.1.0
git push origin develop

# Delete release branch
git branch -d release/v2025.3.1.0
git push origin --delete release/v2025.3.1.0

# Push tags
git push origin --tags
```

### Automated Release Script
```javascript
// scripts/release.js
const { execSync } = require('child_process');

class ReleaseManager {
  async createRelease(version) {
    console.log(`🚀 Creating release v${version}`);
    
    try {
      // Validate environment
      await this.validateEnvironment();
      
      // Create release branch
      execSync(`git checkout -b release/v${version}`);
      
      // Run tests
      execSync('npm run test:full');
      
      // Build project
      execSync('npm run build');
      
      // Update version
      execSync(`npm version ${version} --no-git-tag-version`);
      
      // Generate changelog
      execSync('npm run changelog:generate');
      
      // Commit changes
      execSync('git add .');
      execSync(`git commit -m "chore: prepare release v${version}"`);
      
      // Merge to main
      execSync('git checkout main');
      execSync(`git merge --no-ff release/v${version}`);
      
      // Create tag
      execSync(`git tag -a v${version} -m "Release v${version}"`);
      
      // Push changes
      execSync('git push origin main --tags');
      
      // Merge back to develop
      execSync('git checkout develop');
      execSync(`git merge --no-ff release/v${version}`);
      execSync('git push origin develop');
      
      // Cleanup
      execSync(`git branch -d release/v${version}`);
      
      // Publish to npm
      execSync('npm publish');
      
      // Create GitHub release
      execSync(`gh release create v${version} --generate-notes`);
      
      console.log(`✅ Release v${version} completed successfully`);
      
    } catch (error) {
      console.error(`❌ Release failed: ${error.message}`);
      await this.cleanup();
      process.exit(1);
    }
  }
  
  async validateEnvironment() {
    // Check clean working directory
    try {
      execSync('git diff --exit-code');
      execSync('git diff --cached --exit-code');
    } catch {
      throw new Error('Working directory must be clean');
    }
    
    // Check current branch
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    if (currentBranch !== 'develop') {
      throw new Error('Must be on develop branch');
    }
    
    // Pull latest changes
    execSync('git pull origin develop');
  }
  
  async cleanup() {
    console.log('🧹 Cleaning up failed release...');
    try {
      execSync('git checkout develop');
      execSync('git branch -D release/v*', { stdio: 'ignore' });
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Execute release
if (require.main === module) {
  const version = process.argv[2];
  if (!version) {
    console.error('Usage: node scripts/release.js <version>');
    process.exit(1);
  }
  
  const releaseManager = new ReleaseManager();
  releaseManager.createRelease(version);
}
```

## Pull Request Workflow

### Creating Pull Requests

#### 1. Pre-PR Checklist
```bash
# Ensure branch is up to date
git checkout feature/my-feature
git fetch origin
git rebase origin/develop

# Run quality checks
npm run lint
npm test
npm run build

# Self-review changes
git diff develop..HEAD

# Push final changes
git push origin feature/my-feature
```

#### 2. PR Template
```markdown
## Pull Request

### Description
Brief description of changes and their purpose.

### Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement

### Changes Made
- Change 1: Description
- Change 2: Description
- Change 3: Description

### Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] All tests passing

### Documentation
- [ ] Code comments updated
- [ ] README updated (if needed)
- [ ] API documentation updated (if needed)
- [ ] Changelog entry added

### Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Breaking changes documented
- [ ] Dependent changes merged

### Related Issues
Fixes #123
Related to #456

### Screenshots (if applicable)
```

### PR Review Process

#### Code Review Guidelines
1. **Functionality**: Does the code work as intended?
2. **Style**: Does it follow coding standards?
3. **Performance**: Are there performance implications?
4. **Security**: Are there security concerns?
5. **Tests**: Is there adequate test coverage?
6. **Documentation**: Is the code well-documented?

#### Review Checklist
```bash
# Automated checks (CI/CD)
✓ Lint passes
✓ Tests pass
✓ Build succeeds
✓ Security scan clean

# Manual review
□ Code logic is correct
□ Error handling is appropriate
□ Performance impact assessed
□ Breaking changes identified
□ Documentation is adequate
```

## Hotfix Process

### Emergency Fixes

#### 1. Create Hotfix Branch
```bash
# Start from main (production)
git checkout main
git pull origin main

# Create hotfix branch
git checkout -b hotfix/critical-security-fix

# Make minimal fix
# ... edit files ...

# Commit fix
git add .
git commit -m "fix: resolve critical security vulnerability"
```

#### 2. Test and Deploy
```bash
# Run targeted tests
npm run test:security
npm run test:smoke

# Build and validate
npm run build

# Push hotfix
git push -u origin hotfix/critical-security-fix
```

#### 3. Merge and Release
```bash
# Merge to main
git checkout main
git merge --no-ff hotfix/critical-security-fix

# Create hotfix version
npm version patch
git push origin main --tags

# Emergency deploy
npm publish

# Merge back to develop
git checkout develop
git merge --no-ff hotfix/critical-security-fix
git push origin develop

# Cleanup
git branch -d hotfix/critical-security-fix
git push origin --delete hotfix/critical-security-fix
```

## Tag Management

### Tagging Strategy

#### Version Tags
```bash
# Release tags
v2025.3.1.0        # Stable release
v2025.3.1.1        # Patch release

# Pre-release tags  
v2025.3.1.0-alpha.1  # Alpha release
v2025.3.1.0-beta.1   # Beta release
v2025.3.1.0-rc.1     # Release candidate
```

#### Creating Tags
```bash
# Annotated tag (recommended)
git tag -a v2025.3.1.0 -m "Release version 2025.3.1.0"

# Lightweight tag
git tag v2025.3.1.0

# Tag specific commit
git tag -a v2025.3.1.0 -m "Release version 2025.3.1.0" 9fceb02

# Push tags
git push origin v2025.3.1.0  # Single tag
git push origin --tags       # All tags
```

#### Tag Management
```bash
# List tags
git tag -l
git tag -l "v2025.3.*"

# Delete tag (local)
git tag -d v2025.3.1.0

# Delete tag (remote)
git push origin --delete v2025.3.1.0

# Move tag to different commit
git tag -f v2025.3.1.0 9fceb02
git push origin :refs/tags/v2025.3.1.0
git push origin v2025.3.1.0
```

## Git Hooks

### Pre-commit Hooks
```bash
#!/bin/sh
# .git/hooks/pre-commit

echo "Running pre-commit checks..."

# Lint staged files
npx lint-staged

# Run tests
npm test

# Check for debugging statements
if git diff --cached --name-only | xargs grep -l "console.log\|debugger" 2>/dev/null; then
    echo "❌ Remove debugging statements before committing"
    exit 1
fi

echo "✅ Pre-commit checks passed"
```

### Commit Message Hook
```bash
#!/bin/sh
# .git/hooks/commit-msg

# Check conventional commit format
commit_regex='^(feat|fix|docs|style|refactor|perf|test|chore|ci|revert)(\(.+\))?: .{1,50}'

if ! grep -qE "$commit_regex" "$1"; then
    echo "❌ Invalid commit message format"
    echo "Format: type(scope): description"
    echo "Example: feat(cli): add new command"
    exit 1
fi

echo "✅ Commit message format valid"
```

### Pre-push Hook
```bash
#!/bin/sh
# .git/hooks/pre-push

echo "Running pre-push checks..."

# Run full test suite
npm run test:full

# Run security audit
npm audit --audit-level high

# Check for large files
if git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | awk '/^blob/ {if($3>=1048576) print $3, $4}' | head -1; then
    echo "❌ Large files detected (>1MB). Consider using Git LFS"
    exit 1
fi

echo "✅ Pre-push checks passed"
```

### Hook Installation Script
```javascript
// scripts/install-hooks.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const hooks = {
  'pre-commit': `#!/bin/sh
echo "Running pre-commit checks..."
npx lint-staged
npm test
echo "✅ Pre-commit checks passed"
`,
  
  'commit-msg': `#!/bin/sh
commit_regex='^(feat|fix|docs|style|refactor|perf|test|chore|ci|revert)(\\(.+\\))?: .{1,50}'
if ! grep -qE "$commit_regex" "$1"; then
    echo "❌ Invalid commit message format"
    exit 1
fi
`,
  
  'pre-push': `#!/bin/sh
echo "Running pre-push checks..."
npm run test:full
npm audit --audit-level high
echo "✅ Pre-push checks passed"
`
};

Object.entries(hooks).forEach(([hookName, hookContent]) => {
  const hookPath = path.join('.git', 'hooks', hookName);
  fs.writeFileSync(hookPath, hookContent);
  execSync(`chmod +x ${hookPath}`);
  console.log(`✅ Installed ${hookName} hook`);
});
```

## Best Practices

### Repository Management

1. **Clean History**: Use rebase for feature branches
2. **Meaningful Commits**: Atomic, well-documented commits
3. **Branch Protection**: Protect main branches
4. **Code Review**: Require PR reviews
5. **Automated Testing**: CI/CD integration

### Collaboration Guidelines

1. **Communication**: Use PR descriptions and comments
2. **Code Style**: Follow established conventions
3. **Testing**: Maintain test coverage
4. **Documentation**: Keep docs updated
5. **Security**: Follow security best practices

### Workflow Optimization

```bash
# Git aliases for common operations
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
git config --global alias.unstage 'reset HEAD --'
git config --global alias.last 'log -1 HEAD'
git config --global alias.visual '!gitk'

# Useful git configurations
git config --global pull.rebase true
git config --global push.default simple
git config --global core.editor "code --wait"
git config --global init.defaultBranch main
```

### Repository Structure
```
.github/
├── workflows/           # CI/CD workflows
│   ├── ci.yml
│   ├── release.yml
│   └── security.yml
├── ISSUE_TEMPLATE/     # Issue templates
├── PULL_REQUEST_TEMPLATE.md
└── dependabot.yml      # Dependency updates

.git/
├── hooks/              # Git hooks
│   ├── pre-commit
│   ├── commit-msg
│   └── pre-push
└── config              # Repository configuration

scripts/
├── auto-version.js     # Version management
├── release.js          # Release automation
└── install-hooks.js    # Hook installation

docs/
├── CONTRIBUTING.md     # Contribution guidelines
├── CHANGELOG.md        # Version history
└── README.md           # Project overview
```

---

This Git workflow guide establishes consistent practices for version control and collaboration. All team members should follow these guidelines to maintain code quality and project integrity.