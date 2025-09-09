# Secret Configuration Checklist
## Quick Setup Guide for Repository Secrets

**Status:** Missing Critical Secrets ⚠️  
**Priority:** HIGH - NPM publishing workflows are failing

---

## ✅ Quick Setup Checklist

### 1. **IMMEDIATE ACTION REQUIRED: NPM Token**
- [ ] Go to [NPM Settings > Access Tokens](https://www.npmjs.com/settings/tokens)
- [ ] Create new "Automation" token
- [ ] Copy token (starts with `npm_`)
- [ ] Add to GitHub: Settings > Secrets > Actions > `NPM_TOKEN`
- [ ] Test: Run workflow dispatch on `npm-publish.yml`

**Without this:** All NPM publishing workflows fail ❌

---

### 2. **Production Environment (If Applicable)**
- [ ] `PRODUCTION_DB_URL` - Production database connection
- [ ] `ENTERPRISE_SSO_CONFIG` - SSO configuration JSON
- [ ] `MONITORING_API_KEY` - Application monitoring key
- [ ] `STAKEHOLDER_EMAILS` - Notification email list

---

### 3. **Optional Enhancements**
- [ ] `SLACK_WEBHOOK_URL` - Release notifications
- [ ] `SNYK_TOKEN` - Enhanced security scanning
- [ ] `PERFORMANCE_WEBHOOK_URL` - Performance monitoring
- [ ] `PRODUCTION_URL` - Health check endpoint

---

## 🔧 How to Configure Secrets

### GitHub Repository Secrets
1. Navigate to: **Repository > Settings > Secrets and variables > Actions**
2. Click **"New repository secret"**
3. Enter secret name (e.g., `NPM_TOKEN`)
4. Paste secret value
5. Click **"Add secret"**

### Environment Variables (.env files)
Create `.env` file in repository root:
```bash
# Development secrets (not committed to git)
NPM_TOKEN=npm_your_token_here
GITHUB_TOKEN=ghp_your_token_here  # Usually auto-provided in CI
```

---

## 🚨 Critical Missing Secrets

### NPM_TOKEN
**Status:** ⚠️ MISSING  
**Impact:** HIGH - Cannot publish packages  
**Workflows Affected:** 9 workflows including:
- `npm-publish.yml`
- `release.yml`
- `auto-build-publish.yml`

**How to Create:**
1. Visit https://www.npmjs.com/settings/tokens
2. Generate new token
3. Select "Automation" type
4. Copy token (format: `npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

---

## 🔍 Secret Validation

### Test Your Configuration
Run these commands to validate secret setup:

```bash
# Test NPM publishing (dry run)
gh workflow run npm-publish.yml --ref main -f dry_run=true

# Test release workflow
gh workflow run release.yml --ref main -f dry-run=true

# Check workflow status
gh workflow list
```

### Validation Patterns
The repository automatically validates:
- ✅ Secret length requirements
- ✅ Pattern matching for weak passwords
- ✅ Production security standards
- ✅ Required vs optional secret detection

---

## 🔄 Secret Management

### NPM Token Management
- **Scope:** Automation (required for CI/CD)
- **Permissions:** Publish, Read
- **Rotation:** Every 90 days
- **Backup:** Store securely in password manager

### GitHub Token
- **Status:** ✅ Auto-provided by GitHub Actions
- **Permissions:** Automatically scoped to repository
- **No Action Required**

---

## 🚀 Testing Your Setup

### 1. Test NPM Publishing
```bash
# Trigger dry run
gh workflow dispatch npm-publish.yml --ref main --input dry_run=true
```

### 2. Test Release Pipeline
```bash
# Trigger release workflow
gh workflow dispatch release.yml --ref main --input dry-run=true
```

### 3. Monitor Workflow Status
```bash
# Check recent runs
gh run list --limit 5
```

---

## ❌ Common Issues & Solutions

### NPM Token Not Working
**Error:** `401 Unauthorized`
**Solution:** 
- Verify token is "Automation" type
- Check token hasn't expired
- Ensure token has publish permissions

### Workflow Still Failing
**Error:** `Secret not found`
**Solution:**
- Check exact secret name spelling
- Verify secret is added to repository (not user account)
- Ensure secret has no extra spaces

### Permission Denied
**Error:** `Permission denied to repository`
**Solution:**
- Verify you have admin access to repository
- Check if organization has secret restrictions
- Contact repository owner for access

---

## 🔐 Security Best Practices

### DO
- ✅ Use strong, unique secrets
- ✅ Rotate secrets regularly
- ✅ Limit secret access to necessary workflows
- ✅ Monitor secret usage logs

### DON'T
- ❌ Commit secrets to code
- ❌ Share secrets in chat/email
- ❌ Use the same secret across multiple services
- ❌ Use weak or predictable secrets

---

## 📞 Need Help?

### Quick Support
1. **GitHub Issues:** Create issue with `[SECRET-CONFIG]` label
2. **Documentation:** Check `.env.example` for required format
3. **Workflow Logs:** Review failed workflow runs for specific errors
4. **Team:** Contact DevOps team for production secret access

### Escalation
- **Security Incident:** Immediately revoke compromised secrets
- **Production Impact:** Contact on-call team
- **Workflow Failures:** Check workflow status dashboard

---

**Last Updated:** 2025-01-09  
**Status:** NPM_TOKEN missing - critical workflows failing