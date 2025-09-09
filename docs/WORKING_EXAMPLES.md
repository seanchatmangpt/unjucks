# Working CLI Examples for Unjucks v2025.9.8

## ✅ Commands That Actually Work for End Users

Based on comprehensive testing, here are the commands that users can actually use successfully:

### 1. Version Information - **RELIABLE**
```bash
# Check version (works consistently)
node src/cli/index.js --version
# Output: 2025.9.8

# Alternative syntax
node src/cli/index.js version
```

### 2. Help System - **EXCELLENT UX**
```bash
# Main help (comprehensive with examples)
node src/cli/index.js --help

# Command-specific help
node src/cli/index.js generate --help
node src/cli/index.js perf --help
```

### 3. Template Generation - **CORE FEATURE WORKS**

#### Basic Generation (Interactive)
```bash
# This will prompt for generator selection and variables
node src/cli/index.js generate

# The system will show:
# - 28 available generators
# - Interactive selection
# - Variable prompts with validation
```

#### Hygen-Style Syntax (Preferred)
```bash
# Generate React component (will prompt for missing variables)
node src/cli/index.js component react MyButton

# Generate API endpoint (will show required variables)
node src/cli/index.js api endpoint UserAPI
```

#### Explicit Generation with Variables
```bash
# API endpoint with all required variables
node src/cli/index.js generate api endpoint \
  --resourceName User \
  --apiVersion v1 \
  --dry

# React component (check _templates/component/react/ for available variables)
node src/cli/index.js generate component react \
  --name ButtonComponent \
  --dry
```

### 4. Performance Tools - **FEATURE-RICH**
```bash
# Performance analysis menu
node src/cli/index.js perf

# Available subcommands that work:
# - spec: Spec-driven development performance analysis  
# - benchmark: Run performance benchmarks
# - analyze: Analyze performance bottlenecks
# - monitor: Real-time performance monitoring
# - profile: CPU and memory profiling

# Example usage:
node src/cli/index.js perf benchmark --iterations 20
```

### 5. Preview Mode - **DRY RUN CAPABILITY**
```bash
# Preview template output without writing files
node src/cli/index.js preview

# Can be combined with generation:
node src/cli/index.js generate component react --name Test --dry
```

## 🟡 Partially Working Commands

### List Command - **BROKEN DISCOVERY**
```bash
# This command runs but shows "No generators found"
# despite 28+ templates existing in _templates/
node src/cli/index.js list

# Known issue: Template path resolution broken
# Templates exist in: _templates/component/, _templates/api/, etc.
```

### Export Commands - **RUNTIME ISSUES**
```bash
# Commands load but crash during execution
node src/cli/index.js export --help     # Help works
node src/cli/index.js export-docx --help # Help works

# Actual export fails with runtime errors
```

## ❌ Broken Commands (Do Not Use)

The following commands have path resolution failures and are currently unusable:

```bash
# These all fail with module path errors:
node src/cli/index.js semantic --help    # ❌ BROKEN
node src/cli/index.js migrate --help     # ❌ BROKEN  
node src/cli/index.js latex --help       # ❌ BROKEN
node src/cli/index.js specify --help     # ❌ BROKEN
```

## 🔧 Available Templates (Despite List Being Broken)

The following templates are available based on directory analysis:

### Component Templates
- `component/react` - React components with hooks
- `component/dynamic` - Dynamic components  

### API Templates  
- `api/endpoint` - REST API endpoints
- `api-route` - API route handlers

### Development Templates
- `test/basic` - Basic test files
- `test/api` - API test suites
- `test/component` - Component tests

### Architecture Templates
- `architecture/` - System architecture
- `database/` - Database schemas
- `microservice/` - Microservice setup

### Advanced Templates
- `latex/` - LaTeX document generation
- `semantic/` - RDF/semantic web tools
- `enterprise/` - Enterprise-grade templates

## 🎯 Real-World Usage Recommendations

### For New Users
1. **Start with help**: `node src/cli/index.js --help`
2. **Try interactive generation**: `node src/cli/index.js generate`
3. **Use dry-run mode**: Add `--dry` to any generate command

### For Component Development
```bash
# React component with error handling guidance
node src/cli/index.js component react MyComponent

# The system will guide you through required variables
# and show helpful error messages if something is missing
```

### For API Development  
```bash
# API endpoint generation
node src/cli/index.js api endpoint MyAPI

# System will prompt for:
# - resourceName (required)
# - apiVersion (required)
# - Additional configuration options
```

### For Performance Testing
```bash
# Access full performance suite
node src/cli/index.js perf

# This opens a menu with multiple working tools
```

## ⚠️ Important Limitations

1. **Template Discovery Broken**: The `list` command doesn't work, so users must know template names in advance or use interactive mode

2. **Path Dependencies**: Commands must be run from the project root directory (`/Users/sac/unjucks`)

3. **Binary Issues**: Multiple binary files exist but have various issues with module resolution

4. **Missing Dependencies**: Some executions fail due to missing Node.js modules

## 💡 Workarounds for Common Issues

### Finding Available Templates
Since `list` is broken, explore manually:
```bash
# See available generators
ls _templates/

# See templates for a specific generator  
ls _templates/component/
ls _templates/api/
```

### Testing Templates Safely
Always use dry-run mode first:
```bash
node src/cli/index.js generate [generator] [template] --dry
```

### Getting Help for Specific Templates
Use the interactive mode to discover variables:
```bash
node src/cli/index.js generate
# Then select your generator and template
```

## 🔍 Testing Commands

Before using any command in production, test with these patterns:

```bash
# Check if command loads
node src/cli/index.js [command] --help

# Test with dry run
node src/cli/index.js [command] [args] --dry

# Check version for sanity
node src/cli/index.js --version
```

## 📋 Summary for End Users

**What Works Well:**
- Template generation with excellent UX and error handling
- Performance analysis tools
- Comprehensive help system
- Dry-run/preview capabilities

**What's Broken:**
- Template discovery (list command)
- Semantic/RDF features
- LaTeX compilation
- Export functions
- Many specialized commands

**Recommendation:** Use Unjucks for basic template generation only until path resolution and module dependency issues are resolved.