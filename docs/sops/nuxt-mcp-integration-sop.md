# Standard Operating Procedures: Nuxt-MCP Integration

## Overview
This document provides comprehensive standard operating procedures for integrating MCP (Model Context Protocol) into Nuxt.js applications based on real-world implementation analysis.

## Key Findings from Real Implementation
- **Project**: Full-stack rubric application (Nuxt 4.0.3)
- **MCP Version**: nuxt-mcp@0.2.4
- **Package Manager**: PNPM 10.15.0
- **Integration Status**: Successfully running MCP server at http://localhost:3000/__mcp/sse
- **Configuration**: Auto-updates Claude config at ~/.codeium/windsurf/mcp_config.json

---

## 1. PRE-INTEGRATION CHECKLIST

### 1.1 Project Assessment Criteria

#### ✅ **PASS/FAIL Criteria**
- [ ] **Nuxt Version**: >= 3.0.0 (Verified: 4.0.3 in reference)
- [ ] **Node.js Version**: >= 18.0.0 (Check with `node --version`)
- [ ] **Package Manager**: PNPM recommended (Verified working)
- [ ] **TypeScript Support**: Configured (nuxt.config.ts present)
- [ ] **Module System**: ESM (type: "module" in package.json)

#### ✅ **Dependency Verification Checklist**
- [ ] Nuxt core modules compatible
- [ ] No conflicting MCP implementations
- [ ] Build tools compatible (Vite, Webpack)
- [ ] CSS framework compatibility (TailwindCSS verified)
- [ ] Content management compatibility (@nuxt/content verified)

#### ✅ **Risk Assessment Protocol**
| Risk Level | Criteria | Mitigation |
|------------|----------|------------|
| **LOW** | Standard Nuxt 3/4 + TypeScript | Proceed with standard installation |
| **MEDIUM** | Custom build pipeline, complex dependencies | Extended testing phase required |
| **HIGH** | Legacy Nuxt 2, incompatible modules | Upgrade project first or consider alternatives |

### 1.2 Backup and Rollback Procedures

#### ✅ **Pre-Integration Backup**
```bash
# 1. Create project backup
cp -r . ../project-backup-$(date +%Y%m%d-%H%M%S)

# 2. Create git stash (if using git)
git stash push -m "Pre-MCP integration backup"

# 3. Document current versions
echo "$(date): Pre-MCP Integration Snapshot" > backup-manifest.txt
echo "Nuxt: $(npx nuxt --version)" >> backup-manifest.txt
echo "Node: $(node --version)" >> backup-manifest.txt
echo "Package Manager: $(npm --version)" >> backup-manifest.txt
```

---

## 2. INSTALLATION SOPs

### 2.1 Standard Installation Procedure

#### **Step 1: Environment Verification**
```bash
# Verify prerequisites
node --version  # Must be >= 18.0.0
npm --version   # Or pnpm --version
npx nuxt --version  # Must be >= 3.0.0
```
**Success Criteria**: All versions meet minimum requirements

#### **Step 2: Package Installation**
```bash
# Primary installation (PNPM recommended)
pnpm add nuxt-mcp

# Alternative for NPM
npm install nuxt-mcp

# Alternative for Yarn
yarn add nuxt-mcp
```
**Success Criteria**: Package installs without dependency conflicts

#### **Step 3: Module Configuration**
```typescript
// nuxt.config.ts - Add to modules array
export default defineNuxtConfig({
  modules: [
    // ... existing modules
    'nuxt-mcp'
  ]
})
```
**Success Criteria**: Configuration validates without TypeScript errors

#### **Step 4: Development Server Test**
```bash
# Start development server
pnpm dev  # or npm run dev

# Verify MCP endpoint
curl http://localhost:3000/__mcp/sse
```
**Success Criteria**: 
- Server starts without errors
- MCP endpoint responds
- Log shows "MCP server is running at http://localhost:3000/__mcp/sse"

### 2.2 Quality Gates and Verification

#### **Gate 1: Build Integrity**
```bash
# Test production build
pnpm build
echo "Build Status: $?"  # Should be 0
```

#### **Gate 2: Type Safety**
```bash
# TypeScript check
pnpm typecheck
echo "TypeCheck Status: $?"  # Should be 0
```

#### **Gate 3: MCP Server Functionality**
```bash
# Verify MCP server startup
pnpm dev &
sleep 5
curl -f http://localhost:3000/__mcp/sse || echo "MCP_SERVER_FAILED"
```

### 2.3 Configuration Management

#### **Standard Configuration Template**
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/content',
    'nuxt-mcp',  // Add after core modules
    // ... other modules
  ],
  
  // Optional MCP-specific configuration
  mcp: {
    // Configuration options if available
    server: {
      endpoint: '/__mcp/sse',
      autoUpdate: true
    }
  },

  devtools: {
    enabled: true  // Recommended for MCP debugging
  }
})
```

---

## 3. POST-INTEGRATION SOPs

### 3.1 Testing and Validation Procedures

#### **Test Suite 1: Basic Functionality**
```bash
# 1. Server startup test
timeout 30s pnpm dev > startup.log 2>&1 &
sleep 10
if grep -q "MCP server is running" startup.log; then
  echo "✅ MCP Server: PASS"
else
  echo "❌ MCP Server: FAIL"
fi

# 2. Endpoint accessibility test
if curl -s -f http://localhost:3000/__mcp/sse > /dev/null; then
  echo "✅ MCP Endpoint: PASS"
else
  echo "❌ MCP Endpoint: FAIL"
fi

# 3. Config file update test
if [ -f ~/.codeium/windsurf/mcp_config.json ]; then
  echo "✅ Config Update: PASS"
else
  echo "❌ Config Update: FAIL"
fi
```

#### **Test Suite 2: Integration Validation**
```bash
# 1. Build test with MCP
pnpm build && echo "✅ Build: PASS" || echo "❌ Build: FAIL"

# 2. Type checking with MCP
pnpm typecheck && echo "✅ Types: PASS" || echo "❌ Types: FAIL"

# 3. Development hot reload test
# (Manual test - verify MCP server restarts on config changes)
```

### 3.2 Performance Validation

#### **Performance Benchmarks**
```bash
# Development server startup time
time pnpm dev &
# Target: < 10 seconds to MCP server ready

# Build time impact
time pnpm build
# Target: < 20% increase over baseline

# Memory usage
ps aux | grep nuxt | awk '{print $6}' # Monitor RSS memory
# Target: < 200MB base increase
```

### 3.3 Monitoring and Health Checks

#### **Continuous Monitoring Script**
```bash
#!/bin/bash
# mcp-health-check.sh

echo "$(date): Starting MCP Health Check"

# Check if MCP endpoint is responding
if curl -s -f http://localhost:3000/__mcp/sse > /dev/null; then
  echo "✅ MCP Endpoint: Healthy"
else
  echo "❌ MCP Endpoint: Unhealthy"
  exit 1
fi

# Check for MCP errors in logs
if tail -100 logs/nuxt.log | grep -i "mcp.*error" > /dev/null; then
  echo "⚠️  MCP Errors detected in logs"
  tail -10 logs/nuxt.log | grep -i "mcp.*error"
fi

echo "$(date): MCP Health Check Complete"
```

---

## 4. TROUBLESHOOTING PROCEDURES

### 4.1 Common Issues and Resolutions

#### **Issue 1: Module Not Found Error**
```bash
# Symptom: Cannot resolve 'nuxt-mcp'
# Solution:
rm -rf node_modules package-lock.json
npm install
# or
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### **Issue 2: MCP Server Not Starting**
```bash
# Symptom: No MCP server log message
# Diagnosis:
echo "Checking nuxt.config.ts..."
grep -n "nuxt-mcp" nuxt.config.ts

echo "Checking for conflicting modules..."
grep -A 10 -B 10 modules nuxt.config.ts

# Solution: Verify module order and configuration
```

#### **Issue 3: Port Conflicts**
```bash
# Symptom: EADDRINUSE error
# Solution:
lsof -ti:3000 | xargs kill -9
pnpm dev
```

#### **Issue 4: TypeScript Errors**
```bash
# Symptom: Type errors related to MCP
# Solution:
echo 'declare module "nuxt-mcp"' >> types/nuxt-mcp.d.ts
pnpm typecheck
```

### 4.2 Diagnostic Tools

#### **MCP Diagnostic Script**
```bash
#!/bin/bash
# mcp-diagnostics.sh

echo "=== MCP Integration Diagnostics ==="
echo "Date: $(date)"
echo

echo "1. Environment Information:"
echo "   Node.js: $(node --version)"
echo "   Nuxt: $(npx nuxt --version)"
echo "   Package Manager: $(pnpm --version 2>/dev/null || npm --version)"
echo

echo "2. Package Information:"
echo "   nuxt-mcp version: $(pnpm list nuxt-mcp 2>/dev/null || npm list nuxt-mcp)"
echo

echo "3. Configuration Check:"
if grep -q "nuxt-mcp" nuxt.config.ts; then
  echo "   ✅ nuxt-mcp found in nuxt.config.ts"
else
  echo "   ❌ nuxt-mcp not found in nuxt.config.ts"
fi

echo "4. Process Check:"
if pgrep -f "nuxt.*dev" > /dev/null; then
  echo "   ✅ Nuxt dev server is running"
else
  echo "   ❌ Nuxt dev server is not running"
fi

echo "5. Network Check:"
if nc -z localhost 3000; then
  echo "   ✅ Port 3000 is accessible"
else
  echo "   ❌ Port 3000 is not accessible"
fi

echo "=== End Diagnostics ==="
```

---

## 5. EMERGENCY PROCEDURES

### 5.1 Rollback Procedures

#### **Emergency Rollback (Level 1)**
```bash
# Quick rollback - remove module only
pnpm remove nuxt-mcp

# Remove from nuxt.config.ts
sed -i.bak '/nuxt-mcp/d' nuxt.config.ts

# Restart development server
pnpm dev
```

#### **Full Rollback (Level 2)**
```bash
# Restore from git stash
git stash pop

# Or restore from backup
rm -rf ./*
cp -r ../project-backup-*/* .

# Reinstall dependencies
pnpm install
pnpm dev
```

### 5.2 Issue Escalation Protocols

#### **Escalation Matrix**
| Severity | Response Time | Action Required |
|----------|---------------|-----------------|
| **P1 - Critical** | Immediate | Production down - rollback immediately |
| **P2 - High** | 2 hours | Development blocked - investigate & fix |
| **P3 - Medium** | 24 hours | Feature impacted - planned fix |
| **P4 - Low** | Next sprint | Enhancement or minor issue |

### 5.3 Recovery Procedures

#### **Data Recovery Checklist**
- [ ] Backup validation
- [ ] Configuration file restoration  
- [ ] Dependency tree restoration
- [ ] Environment variable restoration
- [ ] Database connection restoration (if applicable)

#### **Service Recovery Validation**
```bash
# Validate full system recovery
pnpm install && \
pnpm build && \
pnpm dev &

# Wait for startup
sleep 10

# Validate all endpoints
curl -f http://localhost:3000/ && \
echo "✅ Main application recovered"
```

---

## 6. MAINTENANCE PROTOCOLS

### 6.1 Regular Maintenance Tasks

#### **Weekly Tasks**
```bash
# Check for nuxt-mcp updates
pnpm outdated nuxt-mcp

# Health check
./scripts/mcp-health-check.sh

# Log rotation
logrotate /path/to/nuxt-logs
```

#### **Monthly Tasks**
```bash
# Dependency audit
pnpm audit

# Performance baseline check
./scripts/performance-benchmark.sh

# Documentation review
echo "Review integration docs for accuracy"
```

### 6.2 Update Procedures

#### **nuxt-mcp Version Update**
```bash
# Before update - backup
git stash push -m "Pre nuxt-mcp update"

# Update package
pnpm update nuxt-mcp

# Test integration
pnpm dev &
sleep 10
./scripts/mcp-health-check.sh

# If successful - commit
git add . && git commit -m "Update nuxt-mcp to $(pnpm list nuxt-mcp --depth=0 | grep nuxt-mcp)"
```

---

## 7. SUCCESS CRITERIA & KPIs

### 7.1 Integration Success Metrics
- [ ] **Startup Time**: < 10 seconds to MCP ready
- [ ] **Build Success Rate**: 100% successful builds
- [ ] **Endpoint Availability**: 99.9% uptime
- [ ] **Memory Overhead**: < 200MB additional RAM usage
- [ ] **Zero Critical Errors**: No blocking errors in logs

### 7.2 Operational Excellence KPIs
- **Mean Time to Recovery (MTTR)**: < 5 minutes
- **Change Success Rate**: > 95%
- **Monitoring Coverage**: 100% of critical paths
- **Documentation Accuracy**: 100% up-to-date procedures

---

## 8. COMMUNICATION TEMPLATES

### 8.1 Integration Status Report Template
```
Subject: Nuxt-MCP Integration Status - [DATE]

Integration Status: [SUCCESSFUL/IN PROGRESS/FAILED]
Environment: [Development/Staging/Production]

✅ Completed:
- Package installation
- Configuration update
- Basic functionality test

⚠️  Issues Encountered:
- [List any issues]

📋 Next Steps:
- [List next actions]

🔧 Technical Details:
- Nuxt Version: [version]
- nuxt-mcp Version: [version] 
- MCP Endpoint: http://localhost:3000/__mcp/sse

Contact: [Team/Person responsible]
```

### 8.2 Incident Report Template
```
Subject: MCP Integration Incident - [INCIDENT_ID]

Incident Summary: [Brief description]
Severity: [P1/P2/P3/P4]
Status: [Open/In Progress/Resolved]

Impact:
- Services Affected: [list]
- Users Affected: [number/description]
- Business Impact: [description]

Timeline:
- Detection: [timestamp]
- Response: [timestamp]
- Resolution: [timestamp]

Root Cause: [Analysis]

Actions Taken:
1. [Action 1]
2. [Action 2]

Prevention Measures:
- [Measure 1]
- [Measure 2]
```

---

## Appendix A: Reference Implementation

Based on the real-world implementation at `/Users/sac/full-stack-rubric`:

- **Project Structure**: Standard Nuxt 4 application
- **Key Dependencies**: nuxt-mcp@0.2.4, @nuxt/ui@4.0.0-alpha.1, @nuxt/content@3.6.3
- **Package Manager**: PNPM 10.15.0 
- **MCP Server**: Auto-starts at http://localhost:3000/__mcp/sse
- **Config Management**: Auto-updates ~/.codeium/windsurf/mcp_config.json

## Appendix B: Quick Reference Commands

```bash
# Installation
pnpm add nuxt-mcp

# Development
pnpm dev

# Health Check
curl http://localhost:3000/__mcp/sse

# Diagnostics
./scripts/mcp-diagnostics.sh

# Emergency Rollback
pnpm remove nuxt-mcp && sed -i.bak '/nuxt-mcp/d' nuxt.config.ts
```

---

**Document Version**: 1.0  
**Last Updated**: 2025-09-06  
**Next Review**: 2025-10-06  
**Owner**: SOP Creation Specialist  
**Reviewers**: Technical Documentation Agent, System Architect