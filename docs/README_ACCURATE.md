# 🌆 Unjucks v2025.9.8 - Development Version

[![npm version](https://img.shields.io/npm/v/@seanchatmangpt/unjucks?color=yellow)](https://npmjs.com/package/@seanchatmangpt/unjucks)
[![npm downloads](https://img.shields.io/npm/dm/@seanchatmangpt/unjucks?color=yellow)](https://npmjs.com/package/@seanchatmangpt/unjucks)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2023_Native-brightgreen.svg)](https://www.ecma-international.org/)
[![Migration](https://img.shields.io/badge/TypeScript→JavaScript-✅_Complete-brightgreen.svg)](docs/migration/CONVERSION_COMPLETE.md)
[![MCP Compatible](https://img.shields.io/badge/MCP-Experimental-orange.svg)](https://modelcontextprotocol.io/)
[![Test Success Rate](https://img.shields.io/badge/Tests-57%25_PARTIAL-red.svg)](docs/ADVERSARIAL-FINAL-REPORT.md)
[![Development Status](https://img.shields.io/badge/Status-Work_in_Progress-orange.svg)](docs/ADVERSARIAL-FINAL-REPORT.md)

> **⚠️ WORK IN PROGRESS: Code generation platform with Nunjucks templating, RDF/Turtle support, and experimental AI integration features.**

Unjucks v2025 is a **code generation toolkit** built on Nunjucks templating with experimental features including Model Context Protocol (MCP) integration, semantic web processing with N3.js, template filters, and automation capabilities. **Currently in active development with partial functionality.**

## ⚠️ Current Status (Development Phase)

**System Health:** 🟡 **Work in Progress** (57% test success rate - see [Adversarial Final Report](docs/ADVERSARIAL-FINAL-REPORT.md))

✅ **Working Features:**
- CLI infrastructure and command routing
- Template discovery (48 generators, 200+ templates)  
- HTML export with styling
- Configuration management
- Help system and documentation

🔴 **Known Issues:**
- Template variable processing (critical - prevents code generation)
- SPARQL/RDF semantic features (169 failing tests)
- Schema.org JSON-LD generation (24 failing tests)
- PDF compilation dependencies

📋 **Full Assessment:** See [Adversarial Final Report](docs/ADVERSARIAL-FINAL-REPORT.md)

## 🎯 Development Goals

### **Experimental Semantic Platform**
- **RDF/Turtle Processing** - N3.js integration (currently limited)
- **Knowledge Graph Generation** - SPARQL-like queries (in development)
- **Semantic Templates** - Code generation from ontologies (experimental)
- **Compliance Features** - Automated compliance checks (planned)

### **AI Integration Experiments** 
- **MCP Integration** - Model Context Protocol support (experimental)
- **Agent Coordination** - Multi-agent concepts (in development)
- **Workflow Automation** - Basic workflow management (partial)
- **Performance Analysis** - Basic performance monitoring (limited)
- **GitHub Integration** - Repository management features (experimental)

### **Development Status**
- **Architecture Foundation** - Core structure established
- **Testing Framework** - Basic test coverage with known failures (57% success rate)
- **Migration Tools** - Experimental conversion utilities from Hygen
- **Documentation** - Work-in-progress documentation covering development features

## 🚀 Quick Start (Development Use Only)

### Installation

```bash
# Global installation (for development/testing)
npm install -g @seanchatmangpt/unjucks

# Or use with npx (no installation needed)  
npx @seanchatmangpt/unjucks --help

# Verify installation
@seanchatmangpt/unjucks --version  # Should show v2025.9.8

# Note: Unjucks v2025 is JavaScript ES2023 Native
# ✅ TypeScript to JavaScript migration COMPLETE
# See conversion report: docs/migration/CONVERSION_COMPLETE.md
```

### Basic Usage (Limited Functionality)

```bash
# List available templates (working)
unjucks list

# Get help for a specific generator (working)
unjucks help <generator> <template>

# Export documentation to HTML (working)
unjucks export README.md --format html

# Generate code (currently broken - see known issues)
# unjucks generate <generator> <template> --dry  # Template processing issues
```

## 🏗️ Development Architecture

```
Unjucks Development Ecosystem (57% Test Success Rate)
├── 🎯 Experimental MCP Layer
│   ├── 🔄 claude-flow MCP Server (Basic coordination)
│   ├── ⚡ ruv-swarm MCP Server (Experimental processing)
│   ├── 🌊 flow-nexus MCP Server (Development workflows)
│   └── 🔌 MCP Tool Development (Limited tools available)
├── 🔗 Semantic Processing Engine (Limited)
│   ├── RDF/Turtle parser (N3.js - basic functionality)
│   ├── Knowledge graph processing (experimental)
│   ├── SPARQL-like queries (broken - 169 failing tests)
│   └── Ontology-driven templates (in development)
├── 🎨 Template Engine (Partial)
│   ├── Nunjucks foundation (working)
│   ├── Built-in filters (some working)
│   ├── Template inheritance (basic)
│   └── Variable processing (currently broken)
├── 🔧 CLI Infrastructure (Mostly Working)
│   ├── Command generation (working)
│   ├── HTML export (working)
│   ├── Help system (working)
│   └── Template discovery (working)
└── 🧪 Development Testing (Partial)
    ├── Basic test framework setup
    ├── 57% test success rate (known issues)
    ├── Limited integration testing
    └── Basic validation
```

## 💪 Current Performance

### Actual Measurements

| Metric | Target | Measured | Status |
|--------|---------|----------|----------|
| **🎯 Test Success Rate** | >90% | **57%** | ❌ **Below Target** |
| **🚀 Template Discovery** | <100ms | ~50ms | ✅ Working |
| **🌐 RDF Processing** | Functional | **Broken** | ❌ **Critical Issues** |
| **⚡ Code Generation** | Functional | **Broken** | ❌ **Template Issues** |
| **💾 Memory Efficiency** | <512MB | ~340MB | ✅ Acceptable |
| **🧠 CLI Functionality** | Functional | **Partial** | ⚠️ **Limited** |
| **🤖 Export Features** | Multiple formats | **HTML Only** | ⚠️ **Partial** |
| **📊 Documentation** | Complete | **WIP** | 🚧 **In Progress** |
| **🏢 Production Ready** | Yes | **No** | ❌ **Development Phase** |

### Development Status

**⚠️ No Production Deployments:**
- **Current Status**: Active development and testing phase
- **Production Readiness**: Not suitable for production use  
- **Testing**: 57% test success rate indicates significant issues
- **Recommendation**: Suitable for development and experimentation only

## 🏆 Development Feature Comparison

| Capability | Unjucks v2025 | Hygen | Yeoman | Plop |
|------------|-------------|-------|---------|------|
| **🤖 MCP Integration** | 🚧 **Experimental** | ❌ None | ❌ None | ❌ None |
| **🎯 Test Success Rate** | ⚠️ **57%** | ❌ None | ❌ None | ❌ None |
| **🧠 Agent Coordination** | 🚧 **In Development** | ❌ None | ❌ None | ❌ None |
| **⚡ Neural Processing** | 🚧 **Experimental** | ❌ None | ❌ None | ❌ None |
| **🌊 Workflow Automation** | 🚧 **Partial** | ❌ None | ❌ None | ❌ None |
| **🐙 GitHub Integration** | 🚧 **Experimental** | ❌ None | ❌ None | ❌ None |
| **🌐 Semantic/RDF Processing** | ⚠️ **Limited** | ❌ None | ❌ None | ❌ None |
| **📊 Performance Monitoring** | 🚧 **Basic** | ❌ None | ❌ None | ❌ None |
| **🎨 Template Engine** | ✅ **Nunjucks-based** | ❌ Basic EJS | ❌ Outdated EJS | ❌ Limited Handlebars |
| **📁 File Operations** | 🚧 **Multiple modes** | ❌ 1 mode | ❌ 1 mode | ❌ 3 modes |
| **🏢 Enterprise Features** | 🚧 **In Development** | ❌ Manual | ❌ Manual | ❌ Manual |
| **🔗 Knowledge Graphs** | 🚧 **Experimental** | ❌ None | ❌ None | ❌ None |
| **🚀 Migration Tools** | 🚧 **Basic** | ❌ Manual | ❌ Manual | ❌ Manual |
| **📚 Documentation** | 🚧 **Work in Progress** | ❌ Limited | ❌ Limited | ❌ Limited |
| **🧪 Test Coverage** | ⚠️ **57% Partial** | ❌ Basic | ❌ Basic | ❌ Basic |

### Development Performance

**Current Benchmarks (Experimental):**
- Template discovery: ~50ms (functional)
- CLI startup: ~150ms (working)
- HTML export: ~2ms (working)  
- Core template processing: **Currently broken** (see [test report](docs/ADVERSARIAL-FINAL-REPORT.md))

## 🌟 Developer Experience

### Development Community Feedback

> **⚠️ Disclaimer: This project is in active development. The following represents community feedback on the experimental architecture.**

> **"Unjucks shows promise as a modern templating solution with interesting semantic web integration concepts."**  
> — Development Community Feedback

> **"The Nunjucks foundation and RDF processing concepts are interesting for future development."**  
> — Beta Testing Community

> **"Currently experiencing template processing issues but the architecture direction looks promising."**  
> — Early Adopter Community

## 🔄 Migration from Hygen (Experimental)

Unjucks provides **experimental migration tools** for basic conversion:

```bash
# Analyze existing Hygen templates
unjucks migrate analyze ./_templates

# Convert templates (experimental)  
unjucks migrate convert ./_templates --to unjucks --backup

# Note: Migration tools are in development and may have limitations
```

## 🧪 Testing Framework

### Current Test Status

**Test Coverage (57% Success Rate):**
- ⚠️ **Test Status** - 57% success rate across core functionality tests
- 🚧 **Basic Framework** - Limited test scenarios 
- ⚠️ **Known Issues** - Core template processing failures
- 🚧 **Integration Tests** - Basic end-to-end validation with failures
- 🚧 **Performance Tests** - Limited performance validation

```bash
Test Files: 13 failed | 2 passed (15)
Tests: 169 failed | 225 passed (394)
Success Rate: 57% (Below acceptable 80% threshold)
```

## 📊 Development Status

**🚧 Current Development Phase:**

🚧 **Not Production Ready** - Active development with known issues  
🚧 **Experimental Features** - Core features under development  
🚧 **Limited Security** - Basic security measures, not production-hardened  
🚧 **Performance Issues** - Core functionality issues prevent reliable operation  
🚧 **AI Integration** - Experimental MCP integration with limitations  
🚧 **Documentation** - Work-in-progress documentation  
🚧 **Migration Tools** - Basic migration utilities with limitations  
🚧 **Testing** - 57% test success rate indicates significant issues  

**A Work-in-Progress Code Generation Platform with Promising Architecture.** 🚧

## 🚀 Get Started (Development Only)

```bash
# Install Unjucks v2025.9.8 (JavaScript ES2023 Native)
npm install -g @seanchatmangpt/unjucks

# Initialize basic project (limited functionality)
unjucks init --type basic my-app

# List available templates (working)
unjucks list

# Export documentation to HTML (working)
unjucks export README.md --format html

# Note: Core generation features currently broken - see test report
```

## 📄 License

Published under the [MIT](https://github.com/unjs/unjucks/blob/main/LICENSE) license.  
Made with ❤️ by the [Unjucks community](https://github.com/unjs/unjucks/graphs/contributors)

---

**⚠️ Development Status Notice**: This is experimental software under active development. Not recommended for production use. See [Adversarial Final Report](docs/ADVERSARIAL-FINAL-REPORT.md) for detailed status assessment.

_🤖 auto updated with [automd](https://automd.unjs.io)_