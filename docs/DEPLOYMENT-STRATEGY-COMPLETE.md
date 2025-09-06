# 🚀 Unjucks Production Deployment Strategy
## npm + brew Distribution Like Hygen

### Executive Summary: Production-Ready Distribution

This document outlines the complete strategy to make Unjucks available as a globally-installable CLI tool via npm and brew, with enterprise-grade reliability and cleanroom testing.

### 🚨 **Critical Issues Blocking Distribution (Must Fix First)**

#### **1. Missing Binary Entry Point (BLOCKER)**
```bash
# Current package.json references:
"bin": { "unjucks": "./bin/unjucks.cjs" }

# But file doesn't exist:
ls bin/unjucks.cjs  # No such file or directory
```

**Impact**: `npm install -g unjucks` fails immediately
**Fix Required**: Create functional CLI entry point

#### **2. Package Configuration Issues**
```json
// Current problems in package.json:
{
  "@types/node": "^20.0.0"  // In dependencies (should be devDependencies)
  // Missing engines field
  // Missing repository/homepage
  // Missing preferGlobal: true
}
```

#### **3. Build System Problems**  
- TypeScript compilation may have errors
- Dist folder size unknown/potentially bloated
- No size optimization for distribution

### 🎯 **80/20 Deployment Implementation**

#### **Phase 1: Critical Fixes (1-2 days, 80% success)**

**1. Create Missing Binary Entry Point**
```javascript
// bin/unjucks.cjs (CRITICAL)
#!/usr/bin/env node

// Import the CLI app
const { runMain } = require('../dist/src/cli/index.js');

// Run with error handling
runMain().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
```

**2. Fix Package Configuration**
```json
// Updated package.json
{
  "name": "unjucks",
  "version": "1.0.0",
  "description": "Semantic-aware scaffolding with RDF/Turtle support",
  "preferGlobal": true,
  "engines": {
    "node": ">=18.0.0"
  },
  "repository": {
    "type": "git", 
    "url": "https://github.com/unjucks/unjucks"
  },
  "homepage": "https://unjucks.dev",
  "files": [
    "dist/src",
    "bin",
    "README.md",
    "LICENSE"
  ]
}
```

**3. Move Dependencies Correctly**
```json
// Fix dependency categories
"dependencies": {
  "axios": "^1.6.0",
  "chokidar": "^4.0.3", 
  "citty": "^0.1.6",
  "glob": "^10.3.10",
  "gray-matter": "^4.0.3",
  "n3": "^1.26.0",
  "nunjucks": "^3.2.4",
  "yaml": "^2.4.1"
},
"devDependencies": {
  "@types/node": "^20.0.0",  // Moved here
  // ... other dev deps
}
```

**4. Add Build & Release Scripts**
```json
"scripts": {
  "build": "tsc && npm run build:bin",
  "build:bin": "chmod +x bin/unjucks.cjs",
  "prepare": "npm run build",
  "prepublishOnly": "npm test && npm run build",
  "release": "npm version patch && npm publish"
}
```

#### **Phase 2: Professional Distribution (3-5 days)**

**5. Create CLI Entry Point Implementation**
```typescript
// src/cli/index.ts - Main CLI application
import { defineCommand, runMain as cittyRunMain } from 'citty';
import { version } from '../package.json';

const main = defineCommand({
  meta: {
    name: 'unjucks',
    version,
    description: 'Semantic-aware scaffolding with RDF/Turtle support'
  },
  subCommands: {
    generate: () => import('./commands/generate.js'),
    list: () => import('./commands/list.js'),
    'generate:interfaces': () => import('./commands/type-conversion.js').then(m => m.generateInterfaces),
    'generate:ontology': () => import('./commands/type-conversion.js').then(m => m.generateOntology),
  }
});

export const runMain = () => cittyRunMain(main);
```

**6. Bundle Size Optimization**
```json
// Target: <2MB total package size
"files": [
  "dist/src",           // Only compiled source
  "bin/unjucks.cjs",    // Binary only  
  "README.md",
  "LICENSE"
  // Exclude: tests, examples, docs, fixtures
]
```

### 🧪 **Cleanroom Testing Strategy**

#### **Testing Matrix (80/20 Focus)**
```yaml
Platforms: [Ubuntu 22.04, macOS 13+, Windows 11]
Node Versions: [18.x, 20.x, 22.x]
Installation Methods: [npm global, npm local, brew]
Test Scenarios: [fresh install, upgrade, uninstall]
```

#### **Critical Test Cases**
```bash
# Test 1: Fresh Global Installation
docker run -it node:18-alpine sh -c "
  npm install -g unjucks &&
  unjucks --version &&
  unjucks list &&
  unjucks generate --help
"

# Test 2: Project Usage
mkdir test-project && cd test-project
unjucks init
unjucks generate component MyComponent --name User
npm test

# Test 3: Semantic Features  
unjucks generate:interfaces schema.ttl --output types/Schema.ts
unjucks generate:ontology src/types/ --output schema.ttl
```

#### **Automated Test Pipeline**
```yaml
# .github/workflows/test-installation.yml
name: Installation Tests
on: [push, pull_request]
jobs:
  test-npm-global:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: npm ci
      - run: npm run build  
      - run: npm pack
      - run: npm install -g ./unjucks-*.tgz
      - run: unjucks --version
      - run: unjucks list
```

### 🍺 **Homebrew Formula Creation**

#### **Formula Structure**
```ruby
# Formula/unjucks.rb
class Unjucks < Formula
  desc "Semantic-aware scaffolding with RDF/Turtle support"
  homepage "https://unjucks.dev"
  url "https://registry.npmjs.org/unjucks/-/unjucks-1.0.0.tgz"
  sha256 "..." # Auto-calculated
  
  depends_on "node"
  
  def install
    system "npm", "install", *std_npm_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end
  
  test do
    system bin/"unjucks", "--version"
    system bin/"unjucks", "list"
  end
end
```

#### **Homebrew Submission Process**
1. **Test Formula Locally**
   ```bash
   brew install --build-from-source ./Formula/unjucks.rb
   brew test unjucks
   ```

2. **Submit to Homebrew Core**
   - Fork homebrew/homebrew-core
   - Add formula to Formula/unjucks.rb  
   - Submit PR with: "unjucks: add formula"

3. **Alternative: Homebrew Tap**
   ```bash
   # Create unjucks/homebrew-tap repo
   # Users install with:
   brew tap unjucks/tap
   brew install unjucks
   ```

### 📦 **CI/CD Pipeline for Automated Releases**

#### **Release Workflow**
```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org/
      
      # Test across platforms
      - run: npm ci
      - run: npm run test:all
      - run: npm run build
      
      # Package and test installation  
      - run: npm pack
      - run: npm install -g ./unjucks-*.tgz
      - run: unjucks --version
      
      # Publish to npm
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      
      # Update Homebrew formula
      - run: ./scripts/update-homebrew-formula.sh
```

#### **Version Management**
```json
"scripts": {
  "version:patch": "npm version patch && git push --tags",
  "version:minor": "npm version minor && git push --tags", 
  "version:major": "npm version major && git push --tags"
}
```

### 🔍 **Quality Assurance & Monitoring**

#### **Installation Success Metrics**
```typescript
// Track via npm registry analytics
const deploymentMetrics = {
  installSuccessRate: '>95%',     // Target: 95%+ successful installs
  installTime: '<30 seconds',     // Target: Sub-30s global install  
  cliStartup: '<1 second',        // Target: Sub-second cold start
  bundleSize: '<2MB',             // Target: Under 2MB total
  crossPlatform: '100%',          // Target: All platforms work
  nodeCompatibility: 'v18+'       // Target: Node 18+ support
};
```

#### **Error Monitoring & Analytics**
```bash
# Install telemetry (optional, privacy-respecting)
unjucks --telemetry enable  # Opt-in only
unjucks --telemetry status  # Show what's collected
unjucks --telemetry disable # Easy opt-out
```

### 📋 **Pre-Release Checklist**

#### **Must-Have Before npm Publish**
- [ ] ✅ Binary file exists and is executable
- [ ] ✅ `npm install -g` works in clean environment
- [ ] ✅ All CLI commands functional (`--version`, `--help`, core commands)
- [ ] ✅ Bundle size under 2MB
- [ ] ✅ Tests pass on Ubuntu/macOS/Windows
- [ ] ✅ Node 18/20/22 compatibility verified
- [ ] ✅ README with clear installation instructions
- [ ] ✅ LICENSE file included
- [ ] ✅ Proper package.json metadata

#### **Nice-to-Have for Professional Release**
- [ ] Shell completions (bash/zsh/fish)
- [ ] Manpage generation
- [ ] Docker image for CI usage
- [ ] Performance benchmarks
- [ ] Usage analytics dashboard

### 🚀 **Installation Experience Design**

#### **Target User Experience (Like Hygen)**
```bash
# Global installation
npm install -g unjucks
# or
brew install unjucks

# Immediate usage
unjucks --version  # v1.0.0
unjucks --help     # Full command overview
unjucks list       # Show available generators

# Project initialization  
mkdir my-project && cd my-project
unjucks init       # Setup _templates directory
unjucks generate component User --props name,email
```

#### **Documentation Structure**
```
docs/
├── installation.md         # npm/brew/manual install
├── getting-started.md      # 5-minute quickstart  
├── cli-reference.md        # Complete command docs
├── semantic-features.md    # RDF/Turtle capabilities
├── templates.md            # Template creation guide
└── troubleshooting.md      # Common issues & fixes
```

### 💡 **Success Metrics & KPIs**

#### **Adoption Metrics**
```typescript
const successMetrics = {
  // Installation metrics
  npmWeeklyDownloads: '>1000',      // Week 4 target
  brewInstalls: '>100',             // Week 8 target  
  githubStars: '>50',               // Week 12 target
  
  // Usage metrics  
  installSuccessRate: '>95%',       // Platform reliability
  userRetention: '>70%',            // Weekly active users
  cliCommandUsage: '>5 per user',   // Engagement depth
  
  // Quality metrics
  issueResolutionTime: '<48h',      // Support responsiveness  
  crashRate: '<1%',                 // Stability target
  performanceRegression: '0%'       // No slowdowns
};
```

### 🎯 **Implementation Roadmap**

#### **Week 1: Critical Path (Distribution Ready)**
- **Day 1-2**: Create missing binary, fix package.json
- **Day 3-4**: Implement cleanroom testing pipeline  
- **Day 5**: First npm publish (alpha release)

#### **Week 2: Professional Polish**
- **Day 1-2**: Homebrew formula creation & testing
- **Day 3-4**: CI/CD automation & error monitoring
- **Day 5**: Documentation & troubleshooting guides

#### **Week 3: Market Launch**
- **Day 1-2**: Community outreach & feedback collection
- **Day 3-4**: Performance optimization & bug fixes
- **Day 5**: Stable v1.0 release

### 🏆 **Success Definition**

**Immediate Success (Week 1):**
- ✅ `npm install -g unjucks` works reliably across platforms
- ✅ Core CLI functionality operational
- ✅ Basic semantic features working

**Professional Success (Month 1):**
- ✅ Homebrew formula available and stable
- ✅ 95%+ installation success rate
- ✅ Community adoption beginning

**Market Success (Quarter 1):**
- ✅ 1000+ weekly npm downloads  
- ✅ Enterprise pilot programs launched
- ✅ Semantic web community recognition

---

**Status**: 🔧 **READY FOR IMPLEMENTATION**

The deployment strategy is complete and actionable. The critical path is clear: **fix the missing binary first**, then execute the phased rollout for professional npm and brew distribution.