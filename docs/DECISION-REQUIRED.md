# 🚨 CRITICAL DECISION REQUIRED

**Date**: 2025-12-02
**Issue**: Four different CLIs, none connected
**Action**: Choose ONE identity, delete the rest

## The Discovery

Searched for citty usage and found:
- **130+ files** using citty `defineCommand`
- **200+ command definitions**
- **30,000+ LOC** of CLI code
- **0 connected commands** (only a 52-line stub works)

## The Four CLIs

### 1. Active Stub (❌ Connected but Broken)
- **Location**: `src/cli-entry.js` → `dist/cli-entry.mjs` → `bin/kgen`
- **Size**: 52 lines
- **Status**: Prints help messages, does nothing else
- **Commands**: `--version`, `--help` only

### 2. Real Unjucks (✅ Complete but Orphaned)
- **Location**: `src/commands/` (30 files)
- **Size**: 10,000 LOC
- **Commands**: generate, list, help, init, inject, semantic, latex, export, workflow, +21 more
- **Status**: Fully implemented, never connected

### 3. V4 Prototype (⚠️ Partial)
- **Location**: `src/v4/cli.mjs`
- **Size**: 85 lines
- **Status**: Experimental rewrite, incomplete

### 4. KGEN Enterprise (✅ Complete but Orphaned)
- **Location**: `packages/kgen-cli/` (99 files)
- **Size**: 20,000 LOC
- **Commands**: 14 groups, 176 defined commands
- **Status**: Knowledge graph engine, never connected

## Decision Matrix

| Criteria | Unjucks (CLI #2) | KGEN (CLI #4) |
|----------|------------------|---------------|
| **Complexity** | 10K LOC | 20K LOC |
| **Time to Ship** | 2 hours | 8 hours |
| **LOC to Delete** | 20K (KGEN) | 10K (Unjucks) |
| **Market Clarity** | ✅ Hygen alternative | ❌ Niche (RDF/semantic web) |
| **README Alignment** | ✅ Describes Unjucks | ❌ Describes wrong product |
| **Template Investment** | ✅ 43 generators ready | ❌ Not template-based |
| **Dependencies** | Nunjucks, gray-matter | N3, SPARQL, SHACL, RDF |
| **Learning Curve** | Low | High |
| **Maintenance** | Low | High |

## Recommended Choice: Unjucks (CLI #2)

### Why Unjucks
1. ✅ **Simpler**: Half the code (10K vs 20K LOC)
2. ✅ **Faster**: 2 hours to working CLI vs 8 hours
3. ✅ **Clear value**: "Hygen alternative" is obvious use case
4. ✅ **README match**: Current README promises Unjucks
5. ✅ **Templates ready**: 43 generators already exist
6. ✅ **Lower deps**: Standard tools (Nunjucks, not RDF stack)
7. ✅ **Lower complexity**: Template generation vs knowledge graphs

### Against KGEN
1. ❌ **No clear audience**: Who needs RDF/SHACL/N3.js CLI?
2. ❌ **Feature bloat**: 176 commands is excessive
3. ❌ **Misleading docs**: README promises Unjucks, not KGEN
4. ❌ **Higher complexity**: Knowledge graphs require expertise
5. ❌ **Longer timeline**: 8 hours vs 2 hours

## Implementation Plan: Unjucks

### Phase 1: Connect (30 minutes)
Create new `src/cli-entry.js`:
```javascript
#!/usr/bin/env node
import { runMain } from 'citty';
import { generateCommand } from './commands/generate.js';
import { listCommand } from './commands/list.js';
import { helpCommand } from './commands/help.js';
import { initCommand } from './commands/init.js';

const main = {
  meta: {
    name: 'unjucks',
    version: '3.0.0',
    description: 'Nunjucks-based code generation'
  },
  subCommands: {
    generate: generateCommand,
    list: listCommand,
    help: helpCommand,
    init: initCommand
  }
};

runMain(main);
```

### Phase 2: Verify (30 minutes)
```bash
npm run build
node dist/cli-entry.mjs list
node dist/cli-entry.mjs generate component react Button --dry
node dist/cli-entry.mjs generate component react Button
ls [verify file exists]
```

### Phase 3: Delete KGEN (30 minutes)
```bash
rm -rf packages/kgen-cli packages/kgen-core packages/kgen-rules
rm -rf src/v4
rm -rf docs/kgen
git add -A
git commit -m "Remove KGEN - focus on Unjucks template generation"
```

### Phase 4: Publish (30 minutes)
```bash
npm link
unjucks list
unjucks --version
npm publish
npx unjucks --help  # Verify from registry
```

**Total Time**: 2 hours

## Core Commands to Keep

### Essential (Keep All)
- ✅ `generate` (1001 LOC) - Core template generation
- ✅ `list` (570 LOC) - Generator discovery
- ✅ `help` (387 LOC) - Interactive help
- ✅ `init` (560 LOC) - Project setup

### Useful (Keep if Time)
- ⚠️ `inject` (520 LOC) - File injection
- ⚠️ `semantic` (890 LOC) - RDF data loading

### Bloat (Remove)
- ❌ `knowledge` (2122 LOC) - Knowledge graphs
- ❌ `neural` (1362 LOC) - Neural networks
- ❌ `swarm` (1711 LOC) - AI swarms
- ❌ `perf` (1529 LOC) - Performance testing
- ❌ 16+ other specialized commands

**Recommended Core**: 4 commands, ~3K LOC

## Next Steps

1. **Make Decision** ← YOU ARE HERE
   - [ ] Confirm: Choose Unjucks (CLI #2)
   - [ ] Or: Choose KGEN (CLI #4)
   - [ ] Document in DECISION.md

2. **Execute Plan**
   - [ ] Create new src/cli-entry.js
   - [ ] Build and test
   - [ ] Delete other CLI implementations
   - [ ] Update documentation

3. **Verify**
   - [ ] All core commands work
   - [ ] Binary works via npm link
   - [ ] Tests pass

4. **Ship**
   - [ ] Publish to npm
   - [ ] Verify npx works
   - [ ] Update README with actual features

## Files to Check

Before making decision, review:
- `src/commands/generate.js` - See real Unjucks implementation
- `src/commands/list.js` - See generator discovery
- `packages/kgen-cli/src/index.js` - See KGEN complexity
- `_templates/` - See existing generators (43 total)
- `README.md` - See what's promised to users

## Questions to Answer

1. **Who is the target user?**
   - Unjucks: Developers wanting template generators (broad)
   - KGEN: RDF/semantic web developers (niche)

2. **What problem does it solve?**
   - Unjucks: "I need to generate boilerplate code"
   - KGEN: "I need to compile RDF graphs to code artifacts"

3. **What's the elevator pitch?**
   - Unjucks: "Hygen alternative with better features"
   - KGEN: "Deterministic code generation from knowledge graphs"

4. **Can you explain it in 30 seconds?**
   - Unjucks: ✅ Yes - template generator
   - KGEN: ❌ No - requires explaining RDF, provenance, CAS

## Red Flags About KGEN

1. No evidence of users requesting RDF/SHACL features
2. 176 commands is maintenance nightmare
3. Knowledge graph tooling is very niche market
4. High complexity = high bug surface
5. README doesn't mention knowledge graphs at all
6. No clear competitive advantage over existing tools

## Green Lights for Unjucks

1. ✅ Clear market: Hygen has proven template generators work
2. ✅ Low complexity: Template in, files out
3. ✅ Existing templates: 43 generators ready
4. ✅ README alignment: Matches what's documented
5. ✅ Fast to ship: 2 hours vs 8 hours
6. ✅ Easy to explain: "Generate code from templates"

## Recommendation

**Choose Unjucks (CLI #2)** and execute the 2-hour implementation plan above.

**Justification**: Simpler, clearer, faster, and matches what README promises.

---

**Status**: 🔴 BLOCKED - Decision required before any development
**Urgency**: HIGH - Every day without decision wastes resources
**Impact**: CRITICAL - Determines entire project direction
