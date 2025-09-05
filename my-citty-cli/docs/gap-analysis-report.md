# Unjucks vs Hygen: Gap Analysis and Implementation Roadmap

## Executive Summary

This document provides a comprehensive analysis of the gaps between the current Unjucks/Citty CLI implementation and Hygen's feature set, along with a detailed roadmap for achieving feature parity.

**Current State**: Basic Citty CLI with static command definitions  
**Target State**: Hygen-compatible code generator with template-driven dynamic commands  
**Estimated Timeline**: 12-17 weeks for full parity  
**Risk Level**: HIGH (requires complete architectural overhaul)

## Critical Gaps Analysis

### 1. Template Engine Infrastructure (CRITICAL)
- **Gap**: No template processing system
- **Hygen Has**: EJS template engine with frontmatter support
- **Implementation Complexity**: HIGH
- **Effort**: 3-4 weeks
- **Architecture Impact**: Complete core rewrite required

### 2. Dynamic Command Structure (CRITICAL)
- **Gap**: Static command definitions in code
- **Hygen Has**: Folder structure maps to command hierarchy
- **Implementation Complexity**: HIGH  
- **Effort**: 2-3 weeks
- **Architecture Impact**: Major Citty integration changes

### 3. File Operations Engine (CRITICAL)
- **Gap**: Basic file operations only
- **Hygen Has**: add, inject, append, prepend with idempotency
- **Implementation Complexity**: HIGH
- **Effort**: 2-3 weeks
- **Architecture Impact**: New file manipulation engine

### 4. Template Discovery System (CRITICAL)
- **Gap**: No template system
- **Hygen Has**: Automatic _templates folder scanning
- **Implementation Complexity**: MEDIUM
- **Effort**: 1-2 weeks
- **Architecture Impact**: New file system module

### 5. Frontmatter Processing (CRITICAL)
- **Gap**: No metadata processing
- **Hygen Has**: Markdown frontmatter parsing
- **Implementation Complexity**: MEDIUM
- **Effort**: 1 week
- **Architecture Impact**: New parsing module

## Nice-to-Have Gaps

### 1. Interactive Prompts
- **Current**: Basic CLI args
- **Needed**: Dynamic prompts for template variables
- **Effort**: 1-2 weeks

### 2. Custom Helper System
- **Current**: None
- **Needed**: Node.js-based helpers with plugin architecture
- **Effort**: 2 weeks

### 3. Case Transformation
- **Current**: None  
- **Needed**: change-case library integration
- **Effort**: 3-5 days

### 4. Dry Run Mode
- **Current**: None
- **Needed**: --dry flag for testing
- **Effort**: 1 week

### 5. Self Documentation
- **Current**: Static help
- **Needed**: Dynamic help from templates
- **Effort**: 1-2 weeks

## Implementation Roadmap

### Phase 1: Foundation (4-6 weeks)
**Goals**: Core template engine and basic operations

**Deliverables**:
- EJS template engine integration
- Template folder scanning system  
- Basic add/inject file operations
- Frontmatter parsing module

**Breaking Changes**: MAJOR - Complete CLI restructuring
**Key Risks**: High complexity, Citty integration challenges

### Phase 2: Core Features (3-4 weeks)
**Goals**: Dynamic commands and advanced operations

**Deliverables**:
- Dynamic command structure from templates
- Advanced file manipulation (append, prepend)
- Custom error handling system
- Basic helper system

**Breaking Changes**: MINOR - Command structure changes
**Key Risks**: Command conflicts, template validation

### Phase 3: Enhancement (3-4 weeks)
**Goals**: User experience and performance

**Deliverables**:
- Interactive prompts system
- Dry run mode
- Performance optimization
- Self-documentation system
- Case transformation helpers

**Breaking Changes**: None
**Key Risks**: UX complexity, performance regression

### Phase 4: Advanced Features (2-3 weeks)
**Goals**: Plugin system and extensibility

**Deliverables**:
- Custom helper plugin system
- Extended template capabilities
- Comprehensive testing suite
- Documentation and examples

**Breaking Changes**: None
**Key Risks**: Plugin complexity, backward compatibility

## Risk Assessment

### High Risk Items

1. **Complete Architectural Overhaul** (HIGH impact, HIGH probability)
   - *Mitigation*: Phased approach with compatibility layers

2. **Citty Integration Challenges** (HIGH impact, MEDIUM probability)
   - *Mitigation*: Early prototyping, consider forking if needed

3. **Performance Regression** (MEDIUM impact, MEDIUM probability)
   - *Mitigation*: Continuous monitoring and optimization

### Medium Risk Items

1. **Template Security Concerns** (MEDIUM impact, MEDIUM probability)
   - *Mitigation*: Comprehensive validation and sandboxing

2. **Breaking Changes Impact** (MEDIUM impact, HIGH probability)
   - *Mitigation*: Version management and migration guides

## Technical Dependencies

### Required New Dependencies
- `ejs`: Template engine
- `gray-matter`: Frontmatter parsing  
- `change-case`: String transformations
- `inquirer`: Interactive prompts
- `glob`: File pattern matching
- `fs-extra`: Enhanced file operations

### Architecture Changes Required

1. **Engine Pattern**: Central orchestrator replacing simple command execution
2. **Lazy Loading**: Performance optimization for startup time
3. **Template Pipeline**: Processing chain for template rendering
4. **Dynamic Command Registration**: Runtime command structure generation
5. **File Operation Engine**: Idempotent file manipulation system

## Recommendations

### Immediate Actions (Week 1-2)
1. Create proof-of-concept for EJS integration
2. Design new architecture with Citty compatibility
3. Prototype template discovery system
4. Assess backward compatibility requirements

### Strategic Decisions Required
1. **Breaking Changes Policy**: How to handle major version changes
2. **Migration Path**: Support for existing users
3. **Performance Targets**: Acceptable startup time and memory usage
4. **Plugin Architecture**: Design for extensibility vs simplicity

### Success Criteria
1. **Functional Parity**: All Hygen features working
2. **Performance**: Startup time < 100ms
3. **Compatibility**: Smooth migration path from current version
4. **Documentation**: Complete usage and development guides
5. **Testing**: 90%+ code coverage with integration tests

## Conclusion

Achieving Hygen parity requires a fundamental architectural transformation of the current Unjucks/Citty CLI. While technically feasible, the project represents a significant engineering effort with substantial breaking changes.

The phased approach minimizes risk while delivering incremental value. Success depends on careful planning, early prototyping, and maintaining backward compatibility where possible.

**Recommendation**: Proceed with Phase 1 implementation after stakeholder approval of breaking changes and resource allocation.