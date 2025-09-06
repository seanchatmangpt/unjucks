# 🚀 Remote Build & Publish Setup

This guide shows how to set up and use the remote GitHub Actions build system for Unjucks.

## 🔧 Setup Requirements

### 1. GitHub Personal Access Token

Create a GitHub token with the following scopes:
- `repo` (Full control of private repositories)
- `actions` (Read and write actions)

Create token at: https://github.com/settings/tokens

### 2. NPM Token (for GitHub Actions)

Create an automation token at: https://www.npmjs.com/settings/tokens

### 3. Environment Variables

Add to your `.env` file:

```bash
# For local CLI triggering
GITHUB_TOKEN=ghp_your_token_here

# For GitHub Actions (add as repository secret)
NPM_TOKEN=npm_your_token_here
```

### 4. GitHub Repository Secrets

Add these secrets to your GitHub repository at `Settings > Secrets and variables > Actions`:

- `NPM_TOKEN`: Your npm automation token

## 📋 Available Commands

### Remote Build Commands

```bash
# Trigger remote build with auto-versioning and publish
npm run build:remote

# Dry run (no actual publish)
npm run build:remote:dry
npm run build:remote -- --dry-run

# Custom version types
npm run build:remote -- --version-type patch
npm run build:remote -- --version-type minor
npm run build:remote -- --version-type major

# Skip tests
npm run build:remote -- --skip-tests

# Target different environments
npm run build:remote -- --environment staging
npm run build:remote -- --environment development

# Build specific branch
npm run build:remote -- --branch develop
```

### Local Build Commands (Fallback)

```bash
# Local build with auto-versioning
npm run build:version

# Local build and publish
npm run build:publish

# Version only
npm run version:auto
```

## 🔄 Workflow Triggers

### 1. CLI Trigger (Recommended)
```bash
npm run build:remote
```

### 2. GitHub UI Trigger
1. Go to your repository on GitHub
2. Click "Actions" tab
3. Select "🚀 Auto Build & Publish" workflow
4. Click "Run workflow"
5. Configure options and click "Run workflow"

### 3. API Trigger
```bash
curl -X POST \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/seanchatmangpt/unjucks/actions/workflows/auto-build-publish.yml/dispatches \
  -d '{"ref":"main","inputs":{"version_type":"auto","dry_run":"false"}}'
```

## ⚙️ Workflow Options

| Option | Description | Default | Values |
|--------|-------------|---------|--------|
| `version_type` | Version generation method | `auto` | `auto`, `patch`, `minor`, `major` |
| `skip_tests` | Skip lint and type checks | `false` | `true`, `false` |
| `dry_run` | Preview without publishing | `false` | `true`, `false` |
| `environment` | Target deployment environment | `production` | `production`, `staging`, `development` |

## 📊 Version Format

The auto-versioning system generates timestamps in the format:
```
{year}.{month}.{day}.{hour}.{minute}
```

Examples:
- `2025.09.06.14.30` (September 6, 2025 at 14:30 UTC)
- `2025.12.25.09.15` (December 25, 2025 at 09:15 UTC)

## 🔍 Monitoring

### View Workflow Progress
- GitHub Actions: https://github.com/seanchatmangpt/unjucks/actions
- Workflow runs show real-time progress
- Email notifications on completion (if enabled)

### Check Published Package
- npm package: https://www.npmjs.com/package/@seanchatmangpt/unjucks
- Install: `npm install -g @seanchatmangpt/unjucks@latest`

## 🛠️ Troubleshooting

### Common Issues

1. **GitHub Token Issues**
   ```bash
   ❌ GitHub token not found!
   ```
   Solution: Set `GITHUB_TOKEN` environment variable

2. **Repository Not Found**
   ```bash
   ❌ Could not determine GitHub repository info
   ```
   Solution: Ensure you're in a git repository with GitHub remote

3. **Workflow Not Found**
   ```bash
   ❌ Failed to trigger workflow: 404
   ```
   Solution: Ensure the workflow file exists in `.github/workflows/`

4. **NPM Publish Fails**
   ```bash
   ❌ 403 Forbidden - NPM_TOKEN invalid
   ```
   Solution: Update `NPM_TOKEN` secret in repository settings

### Debug Mode

Enable debug logging:
```bash
DEBUG=1 npm run build:remote
```

## 🔐 Security Notes

- Never commit tokens to version control
- Use repository secrets for sensitive data
- Tokens should have minimal required scopes
- Regularly rotate access tokens
- Use environment-specific tokens when possible

## 🎯 Best Practices

1. **Use dry run first**: Always test with `--dry-run`
2. **Monitor workflows**: Check Actions tab for status
3. **Version consistency**: Let auto-versioning handle timestamps
4. **Environment separation**: Use staging for testing
5. **Branch protection**: Protect main branch with required checks