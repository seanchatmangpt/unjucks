# Quick Start Guide

Get up and running with Unjucks in 5 minutes. This guide walks through essential commands and your first code generation.

## Prerequisites

- Node.js 18+ installed
- Terminal/command line access

## 5-Minute Setup

### 1. Install Unjucks

```bash
# Option A: Global installation (recommended for CLI usage)
npm install -g unjucks

# Option B: Use with npx (no installation needed)
npx unjucks --help

# Option C: Local project installation
npm install --save-dev unjucks
```

**Test installation:**
```bash
unjucks --version
```
Expected: Version number displayed (e.g., `1.0.0`)

### 2. Initialize Your First Project

```bash
# Create and enter project directory
mkdir my-app && cd my-app

# Initialize with CLI templates
unjucks init --type cli --dest .
```

**Verify initialization:**
```bash
ls -la
```
Expected files:
- `_templates/` directory
- `unjucks.yml` configuration file

### 3. Explore Available Templates

```bash
unjucks list
```

**Expected output example:**
```
📦 Available Generators:

command
├── citty - Citty command with subcommands
└── Description: Generate Citty CLI commands

cli
└── citty - Citty CLI application
    Description: Generate CLI applications
```

### 4. Generate Your First Files

```bash
# Generate a CLI command with tests
unjucks generate command citty --commandName=user --withTests --dest=./src
```

**Verify generation:**
```bash
ls -la src/
```
Expected:
- `User.ts` - Command implementation
- `User.test.ts` - Test file

### 5. Test the Generated Code

```bash
# View generated command
cat src/User.ts

# Run tests (if test framework is set up)
npm test
```

## Essential Commands

### Discovery Commands
```bash
unjucks list                    # List all generators
unjucks list --verbose          # Detailed generator info
unjucks help command citty      # Help for specific template
```

### Generation Commands  
```bash
# Interactive mode (prompts for variables)
unjucks generate

# With all parameters
unjucks generate command citty --commandName=auth --withTests --dest=./src

# Dry run (preview without creating files)
unjucks generate command citty --dry --commandName=test --dest=./src

# Force overwrite existing files
unjucks generate command citty --force --commandName=user --dest=./src
```

### Verification Commands
```bash
unjucks --version               # Check version
unjucks --help                  # Show all commands
```

## Quick Test Checklist

Verify your setup works by running these commands:

- [ ] `unjucks --version` shows version number
- [ ] `unjucks list` shows available generators
- [ ] `unjucks generate command citty --dry --commandName=test --dest=./temp` previews files
- [ ] `unjucks help command citty` shows template variables
- [ ] Generated files contain expected content and variable substitutions

## Common Issues & Solutions

### Template Not Found
```
Error: Template 'citty' not found in generator 'command'
```
**Solution:** Check available templates with `unjucks list`

### Permission Denied
```
Error: EACCES: permission denied
```
**Solution:** Ensure write permissions to destination directory:
```bash
chmod +w ./destination-directory
```

### No Templates Directory
```
Error: No generators found
```
**Solution:** Initialize project first:
```bash
unjucks init --type cli --dest .
```

## Next Steps

1. **[Installation Guide](installation.md)** - Detailed installation options and troubleshooting
2. **[First Generator](first-generator.md)** - Create your own custom templates
3. **[CLI Reference](../cli/README.md)** - Complete command documentation

---

**Ready for more?** Try generating different types of files or create your own templates!