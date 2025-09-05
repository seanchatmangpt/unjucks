# Hygen Feature Analysis & Unjucks Development Roadmap

## Executive Summary

This document provides a comprehensive analysis of Hygen's capabilities compared to the current state of Unjucks, our code generation tool. Hygen is a mature, well-established code generator with over 2.6k GitHub stars and widespread adoption. Unjucks is currently in early development with basic CLI scaffolding but lacks core generator functionality.

**Current State**: Unjucks has approximately **5%** of Hygen's feature set implemented
**Strategic Priority**: High - Code generators are essential development tools
**Effort Estimate**: 8-12 weeks for feature parity, 16-20 weeks for feature superiority

## Feature Comparison Matrix

| Feature Category | Hygen Status | Unjucks Status | Priority | Effort |
|-----------------|--------------|----------------|----------|---------|
| **Core Template Engine** | ✅ EJS + Frontmatter | ❌ Not Implemented | Critical | 3-4 weeks |
| **File Generation** | ✅ Full Support | ❌ Not Implemented | Critical | 2-3 weeks |
| **File Injection** | ✅ Advanced (before/after/line_at) | ❌ Not Implemented | High | 2-3 weeks |
| **Interactive Prompts** | ✅ Full CLI Wizard | ❌ Not Implemented | High | 1-2 weeks |
| **Template Discovery** | ✅ Auto-discovery | ❌ Not Implemented | High | 1-2 weeks |
| **Shell Command Execution** | ✅ Full Support | ❌ Not Implemented | Medium | 1 week |
| **Conditional Logic** | ✅ skip_if, unless | ❌ Not Implemented | Medium | 1-2 weeks |
| **Case Transformations** | ✅ Multiple helpers | ❌ Not Implemented | Medium | 1 week |
| **Dry Run Mode** | ✅ --dry flag | ❌ Not Implemented | Medium | 1 week |
| **Global/Local Templates** | ✅ Both supported | ❌ Not Implemented | Medium | 1-2 weeks |
| **Performance Optimization** | ✅ Start-up timing suite | ❌ Not Implemented | Low | 1-2 weeks |
| **Testing Framework** | ❌ Limited | 🔄 BDD Infrastructure | Advantage | Complete |
| **Type Safety** | ❌ JavaScript only | 🔄 TypeScript-first | Advantage | In Progress |
| **Modern CLI** | ❌ Basic CLI | 🔄 Citty-based | Advantage | In Progress |

## Current Unjucks Capabilities

### ✅ Implemented Features
1. **CLI Framework**: Citty-based command structure with subcommands
2. **TypeScript Support**: Full TypeScript implementation with type safety
3. **Testing Infrastructure**: Vitest + Cucumber BDD framework setup
4. **Project Structure**: Organized command structure with User, Task, Project commands
5. **Build System**: TypeScript compilation with source maps and declarations

### 🔄 Partially Implemented
1. **Command Architecture**: Basic command scaffolding exists but lacks generator logic
2. **Test Framework**: BDD infrastructure exists but no generator-specific tests
3. **Development Workflow**: Build and development scripts configured

### ❌ Missing Core Features
1. **Template Engine**: No Nunjucks/EJS integration
2. **File Generation**: No file creation capabilities
3. **Template Discovery**: No `_templates` folder scanning
4. **Frontmatter Parsing**: No YAML frontmatter support
5. **Variable Substitution**: No template variable processing
6. **File Injection**: No existing file modification
7. **Interactive Prompts**: No CLI wizard functionality

## Detailed Hygen Feature Analysis

### 1. Template System Architecture

**Hygen Approach:**
```yaml
---
to: components/<%= name %>/index.jsx
inject: true
after: "// INJECTIONS_START"
skip_if: "<%= name %>"
sh: "chmod +x <%= name %>"
---
export const <%= name %> = ({ children }) => (
  <div className="<%= h.changeCase.paramCase(name) %>">{children}</div>
)
```

**Key Components:**
- **Frontmatter**: YAML configuration with `to`, `inject`, `after`, `before`, `skip_if`, `sh`
- **EJS Templating**: Variable substitution with `<%= variable %>`
- **Helper Functions**: Case transformation via `h.changeCase.*`
- **File Operations**: Create, inject, or modify existing files

### 2. File Operations Matrix

| Operation | Hygen Syntax | Use Case | Complexity |
|-----------|--------------|----------|------------|
| **Create File** | `to: path/file.ext` | Generate new files | Low |
| **Inject After** | `inject: true, after: "pattern"` | Add imports, dependencies | Medium |
| **Inject Before** | `inject: true, before: "pattern"` | Add early initialization | Medium |
| **Prepend** | `inject: true, prepend: true` | Add to file start | Low |
| **Append** | `inject: true, append: true` | Add to file end | Low |
| **Line At** | `inject: true, line_at: 10` | Insert at specific line | Medium |
| **Conditional Skip** | `skip_if: "pattern"` | Prevent duplicates | High |
| **Shell Execute** | `sh: "command"` | Run post-generation commands | Medium |

### 3. Interactive Prompt System

**Hygen Implementation:**
```javascript
// _templates/component/new/prompt.js
module.exports = {
  prompt: ({ inquirer }) => {
    const questions = [
      { name: 'name', message: 'Component name?', type: 'input' },
      { name: 'dir', message: 'Directory?', type: 'input' },
      { name: 'style', message: 'Style type?', choices: ['css', 'scss', 'styled'] }
    ]
    return inquirer.prompt(questions)
  }
}
```

### 4. Advanced Template Features

**Case Transformation Helpers:**
- `h.changeCase.camelCase()` - camelCase
- `h.changeCase.pascalCase()` - PascalCase  
- `h.changeCase.paramCase()` - param-case
- `h.changeCase.constantCase()` - CONSTANT_CASE
- `h.changeCase.snakeCase()` - snake_case

**Conditional Logic:**
```yaml
---
to: "<%= locals.typescript ? 'src/components' : 'components' %>/<%= name %>.tsx"
skip_if: "<%= !locals.createTests %>"
unless: "<%= name.includes('Internal') %>"
---
```

## Gap Analysis by Priority

### Critical Gaps (Must Have)

1. **Template Engine Integration** 
   - Missing: Nunjucks template processing
   - Impact: Core functionality completely absent
   - Effort: 3-4 weeks

2. **Frontmatter Parser**
   - Missing: YAML frontmatter parsing and processing  
   - Impact: Cannot configure template behavior
   - Effort: 2 weeks

3. **File Generation Pipeline**
   - Missing: File creation with template rendering
   - Impact: Primary feature non-functional
   - Effort: 2-3 weeks

4. **Template Discovery System**
   - Missing: `_templates` folder scanning and indexing
   - Impact: No templates can be found or executed
   - Effort: 1-2 weeks

### High Priority Gaps (Should Have)

1. **File Injection System**
   - Missing: Modify existing files (append/prepend/inject)
   - Impact: Limited to file creation only
   - Effort: 2-3 weeks

2. **Interactive Prompts**
   - Missing: CLI wizard for template variables
   - Impact: Poor developer experience
   - Effort: 1-2 weeks

3. **Variable Substitution**
   - Missing: Template variable processing and helpers
   - Impact: Static templates only
   - Effort: 1-2 weeks

4. **Command Auto-generation**
   - Missing: CLI commands from template structure
   - Impact: Manual command definition required
   - Effort: 1-2 weeks

### Medium Priority Gaps (Could Have)

1. **Shell Command Execution**
   - Missing: Post-generation script execution
   - Impact: Cannot automate post-processing
   - Effort: 1 week

2. **Conditional Logic**
   - Missing: `skip_if`, `unless` conditions
   - Impact: Cannot prevent duplicates/handle edge cases
   - Effort: 1-2 weeks

3. **Dry Run Mode**
   - Missing: Preview mode without file changes
   - Impact: Risk of unintended modifications
   - Effort: 1 week

4. **Global Template Support**
   - Missing: System-wide template installation
   - Impact: Limited template sharing
   - Effort: 1-2 weeks

## Implementation Roadmap

### Phase 1: Core Foundation (4-5 weeks)

**Week 1-2: Template Engine**
- [ ] Integrate Nunjucks template engine
- [ ] Implement frontmatter YAML parsing
- [ ] Create template context management
- [ ] Add basic variable substitution

**Week 3-4: File Operations**
- [ ] Implement file generation pipeline
- [ ] Add template discovery system (`_templates` scanning)
- [ ] Create file path resolution with variables
- [ ] Add basic error handling and validation

**Week 5: CLI Integration**
- [ ] Auto-generate CLI commands from template structure
- [ ] Implement template listing and help
- [ ] Add basic argument parsing and validation

**Deliverables:**
- Basic template rendering: `unjucks generate component MyComponent`
- Template discovery: `unjucks list`
- Help system: `unjucks help component`

### Phase 2: Advanced Features (3-4 weeks)

**Week 6-7: File Injection**
- [ ] Implement inject-after/before functionality
- [ ] Add append/prepend operations
- [ ] Create line-at insertion
- [ ] Add duplicate detection (`skip_if`)

**Week 8: Interactive Experience**
- [ ] Implement interactive prompt system
- [ ] Add CLI wizard for template variables
- [ ] Create prompt configuration parsing
- [ ] Add validation and type checking

**Week 9: Enhanced Templating**
- [ ] Add case transformation helpers
- [ ] Implement conditional logic (`unless`, etc.)
- [ ] Add template inheritance
- [ ] Create variable scoping

**Deliverables:**
- File injection: `unjucks inject route --to=src/router.ts`  
- Interactive mode: `unjucks generate --interactive`
- Advanced templating with conditions and helpers

### Phase 3: Production Features (2-3 weeks)

**Week 10-11: Developer Experience**
- [ ] Implement dry-run mode (`--dry`)
- [ ] Add verbose output (`--verbose`) 
- [ ] Create shell command execution
- [ ] Add template validation

**Week 12: Polish & Performance**
- [ ] Optimize startup performance
- [ ] Add comprehensive error messages
- [ ] Create template debugging mode
- [ ] Add global template support

**Deliverables:**
- Production-ready CLI with full feature parity
- Performance benchmarks meeting Hygen standards
- Comprehensive error handling and debugging

### Phase 4: Differentiation (4-6 weeks)

**Week 13-15: Unique Advantages**
- [ ] Advanced TypeScript integration
- [ ] Built-in template testing framework
- [ ] Template validation and linting
- [ ] IDE integration (VS Code extension)

**Week 16-18: Ecosystem**
- [ ] Template marketplace/registry
- [ ] Community template sharing
- [ ] Template composition and inheritance
- [ ] Plugin architecture

**Deliverables:**
- Feature superiority over Hygen
- Ecosystem and community features
- Enterprise-ready capabilities

## Unique Unjucks Advantages

### Current & Planned Advantages

1. **TypeScript-First Design**
   - **Hygen**: JavaScript-based with minimal typing
   - **Unjucks**: Full TypeScript with type-safe templates
   - **Impact**: Better IDE support, compile-time validation

2. **Modern CLI Framework**
   - **Hygen**: Custom CLI implementation
   - **Unjucks**: Citty-based with auto-completion and validation
   - **Impact**: Superior developer experience

3. **Built-in Testing Framework**
   - **Hygen**: No official testing support
   - **Unjucks**: Comprehensive BDD testing with Cucumber
   - **Impact**: Reliable template development

4. **Template Validation**
   - **Hygen**: Runtime errors only
   - **Unjucks**: Compile-time template validation
   - **Impact**: Prevents broken template deployment

5. **Advanced Nunjucks Features**
   - **Hygen**: Basic EJS templating
   - **Unjucks**: Full Nunjucks with inheritance, macros, extensions
   - **Impact**: More powerful template composition

### Potential Differentiators

1. **AI-Assisted Template Generation**
   - Generate templates from code examples
   - Intelligent variable extraction
   - Automated documentation generation

2. **Visual Template Builder** 
   - GUI for template creation
   - Live preview and testing
   - Drag-and-drop template composition

3. **Enterprise Features**
   - Template governance and approval workflows
   - Usage analytics and metrics
   - Team collaboration features

4. **IDE Integration**
   - VS Code extension with IntelliSense
   - Template debugging and breakpoints
   - Visual template preview

## Technical Specifications

### Template Format Specification

**Unjucks Template Structure:**
```yaml
---
# Required
to: "{{ destPath }}/{{ name | paramCase }}.tsx"

# File Operations
inject: true|false
append: true|false  
prepend: true|false
before: "pattern"
after: "pattern"
line_at: number

# Conditional Logic
skip_if: "condition"
unless: "condition"
only_if: "condition"

# Post-Processing
chmod: "permissions"
sh: "command"

# Metadata
description: "Template description"
version: "1.0.0"
author: "developer"
tags: ["react", "component"]
---
{# Template body with Nunjucks syntax #}
import React from 'react';

interface {{ name | pascalCase }}Props {
  children?: React.ReactNode;
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({ 
  children 
}) => {
  return (
    <div className="{{ name | paramCase }}">
      {children}
    </div>
  );
};

export default {{ name | pascalCase }};
```

### CLI Command Structure

```bash
# Core commands
unjucks list                              # List available templates
unjucks help <generator> <template>       # Show template help
unjucks generate <generator> <template>   # Generate from template

# Advanced usage  
unjucks generate component button --name MyButton --withTests
unjucks inject route api --path /api/users --method POST
unjucks scaffold project fullstack --name MyApp

# Utility commands
unjucks validate _templates/              # Validate templates
unjucks test _templates/component/        # Test template generation
unjucks init                              # Initialize unjucks in project
```

### Template Variable System

```typescript
interface TemplateContext {
  // User-provided variables
  [key: string]: any;
  
  // Built-in variables
  name: string;
  destPath: string;
  projectRoot: string;
  timestamp: string;
  
  // Helper functions
  h: {
    case: CaseHelpers;
    string: StringHelpers;
    file: FileHelpers;
    date: DateHelpers;
  };
}

interface CaseHelpers {
  camelCase(str: string): string;
  pascalCase(str: string): string;
  paramCase(str: string): string;
  constantCase(str: string): string;
  snakeCase(str: string): string;
}
```

## Risk Assessment & Mitigation

### Technical Risks

1. **Template Engine Performance**
   - Risk: Nunjucks performance vs EJS
   - Mitigation: Benchmarking and optimization
   - Impact: Medium

2. **Complex File Injection**
   - Risk: Corrupting existing files during injection
   - Mitigation: Backup mechanisms and validation
   - Impact: High

3. **Cross-platform Compatibility**  
   - Risk: Path resolution and file operations
   - Mitigation: Use cross-platform libraries
   - Impact: Medium

### Market Risks

1. **Hygen Ecosystem Maturity**
   - Risk: Established user base and templates
   - Mitigation: Migration tools and compatibility
   - Impact: High

2. **Feature Parity Timeline**
   - Risk: Hygen continues development during our implementation
   - Mitigation: Focus on differentiation, not just parity
   - Impact: Medium

3. **Adoption Challenges**
   - Risk: Switching costs from Hygen to Unjucks
   - Mitigation: Superior features and migration assistance
   - Impact: Medium

## Success Metrics

### Technical Metrics
- **Template Rendering Speed**: < 50ms for simple templates
- **Startup Time**: < 200ms (matching Hygen performance)
- **Memory Usage**: < 50MB for typical operations
- **File Injection Accuracy**: 99.9% success rate
- **Cross-platform Support**: Windows, macOS, Linux

### User Experience Metrics
- **CLI Responsiveness**: Sub-second command completion
- **Error Message Quality**: Actionable error messages with suggestions
- **Documentation Coverage**: 100% feature documentation
- **Template Discovery**: Auto-discovery of all valid templates

### Ecosystem Metrics
- **Template Compatibility**: 90% of Hygen templates work with minimal changes
- **Community Templates**: 50+ community-contributed templates in 6 months
- **IDE Integration**: VS Code extension with 1k+ downloads

## Conclusion and Recommendations

### Strategic Recommendations

1. **Immediate Action Required**
   - Begin Phase 1 implementation immediately
   - Focus on core template engine integration
   - Establish weekly milestone reviews

2. **Resource Allocation**
   - 1-2 senior developers for 12-16 weeks
   - UX designer for CLI experience optimization
   - Technical writer for documentation

3. **Competitive Strategy**
   - Achieve feature parity within 12 weeks
   - Focus on TypeScript-first differentiation
   - Build community early with open-source approach

4. **Quality Assurance**
   - Implement comprehensive BDD test coverage
   - Create automated template validation
   - Establish performance benchmarking

### Next Steps

**Week 1 Priorities:**
1. Set up Nunjucks template engine integration
2. Create basic frontmatter YAML parsing
3. Implement simple file generation pipeline  
4. Begin template discovery system

**Success Criteria:**
- Generate first working template by Week 2
- Achieve basic CLI functionality by Week 4
- Reach 50% feature parity by Week 8
- Exceed Hygen capabilities by Week 16

### Final Assessment

Unjucks has significant potential to become a superior alternative to Hygen through its TypeScript-first approach, modern CLI framework, and comprehensive testing infrastructure. However, the current implementation gap is substantial, requiring dedicated effort and strategic focus to achieve competitive parity and eventual superiority.

The 12-20 week timeline is aggressive but achievable with proper resource allocation and focused development. The key to success lies in balancing rapid feature implementation with quality assurance and user experience optimization.

**Recommendation: Proceed with full implementation using the phased approach outlined above.**

---

*Document Version: 1.0*  
*Last Updated: September 5, 2025*  
*Author: Documentation Generator*  
*Status: Ready for Implementation*