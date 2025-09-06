# Installation Guide

Complete installation options, requirements, and troubleshooting for all environments.

## System Requirements

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher (or equivalent: yarn, pnpm, bun)
- **Operating Systems**: macOS, Linux, Windows
- **Memory**: 512MB available RAM
- **Disk**: 50MB free space

## Installation Methods

### Method 1: Global Installation (Recommended)

Install Unjucks globally for CLI access from any directory:

```bash
npm install -g unjucks
```

**Verify installation:**
```bash
unjucks --version
which unjucks
```

**Alternative package managers:**
```bash
# Yarn
yarn global add unjucks

# pnpm  
pnpm install -g unjucks

# Bun
bun install -g unjucks
```

### Method 2: Project-Local Installation

Install as a development dependency in your project:

```bash
npm install --save-dev unjucks

# Or with other package managers
yarn add -D unjucks
pnpm add -D unjucks
bun add -d unjucks
```

**Usage with local installation:**
```bash
# Via npx
npx unjucks --help

# Via package.json scripts
{
  "scripts": {
    "generate": "unjucks generate",
    "generate:page": "unjucks generate page nuxt"
  }
}
```

### Method 3: No Installation (npx)

Use without installation via npx:

```bash
npx unjucks --help
npx unjucks generate command citty --commandName=user --dest=./src
```

### Method 4: Auto-Detection with nypm

Let nypm detect and use your preferred package manager:

```bash
npx nypm install unjucks
```

## Environment Setup

### Shell Completion (Optional)

Enable tab completion for your shell:

```bash
# Bash
unjucks completion bash >> ~/.bashrc

# Zsh  
unjucks completion zsh >> ~/.zshrc

# Fish
unjucks completion fish >> ~/.config/fish/config.fish
```

### VS Code Integration (Optional)

Install the Unjucks extension for enhanced development experience:

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Unjucks"
4. Install the official extension

## Verification Tests

### Basic Functionality Test

```bash
# 1. Version check
unjucks --version

# 2. Help command
unjucks --help

# 3. List generators (requires templates)
mkdir test-project && cd test-project
unjucks init --type cli --dest .
unjucks list

# 4. Dry run generation
unjucks generate command citty --dry --commandName=test --dest=./temp

# 5. Cleanup
cd .. && rm -rf test-project
```

### Performance Test

```bash
# Test generation speed
time unjucks generate command citty --commandName=perf --dest=./temp --force
```
Expected: Under 2 seconds for basic templates

### Memory Usage Test

```bash
# Monitor memory usage during generation
/usr/bin/time -v unjucks generate command citty --commandName=memory --dest=./temp --force 2>&1 | grep "Maximum resident"
```

## Troubleshooting

### Common Installation Issues

#### Permission Errors (macOS/Linux)
```
Error: EACCES: permission denied
```
**Solutions:**
```bash
# Option 1: Use npm prefix (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
npm install -g unjucks

# Option 2: Use sudo (not recommended)
sudo npm install -g unjucks

# Option 3: Use nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install node
npm install -g unjucks
```

#### Node Version Issues
```
Error: This package requires Node.js >= 18.0.0
```
**Solutions:**
```bash
# Check current Node version
node --version

# Update Node.js
# Via nvm
nvm install node
nvm use node

# Via package manager (macOS)
brew install node

# Via package manager (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Network/Proxy Issues
```
Error: network timeout / proxy errors
```
**Solutions:**
```bash
# Configure npm registry
npm config set registry https://registry.npmjs.org/

# Configure proxy (if behind corporate firewall)
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# Use alternative registry
npm install -g unjucks --registry https://registry.npmmirror.com
```

### Windows-Specific Issues

#### PowerShell Execution Policy
```
Error: cannot be loaded because running scripts is disabled
```
**Solution:**
```powershell
# Run as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Path Issues
```
'unjucks' is not recognized as an internal or external command
```
**Solutions:**
```cmd
# Check npm global path
npm config get prefix

# Add to PATH in System Environment Variables
# Default location: C:\Users\{username}\AppData\Roaming\npm
```

### Verification Commands

After installation, verify everything works:

```bash
# Basic verification
unjucks --version
unjucks --help

# Advanced verification
mkdir verify-install && cd verify-install
unjucks init --type cli --dest .
unjucks list
unjucks generate command citty --dry --commandName=verify --dest=./test
cd .. && rm -rf verify-install

echo "✅ Installation verified successfully!"
```

## Alternative Installation Sources

### Development Builds
```bash
# Install latest development version
npm install -g unjucks@next

# Install from GitHub
npm install -g github:unjs/unjucks

# Install specific commit
npm install -g github:unjs/unjucks#commit-hash
```

### Docker Installation
```bash
# Use in Docker container
FROM node:18-alpine
RUN npm install -g unjucks
WORKDIR /app
```

### CI/CD Installation
```bash
# GitHub Actions
- name: Install Unjucks
  run: npm install -g unjucks

# GitLab CI
install_unjucks:
  script:
    - npm install -g unjucks
```

## Uninstallation

### Remove Global Installation
```bash
npm uninstall -g unjucks

# Verify removal
unjucks --version  # Should show "command not found"
```

### Remove Local Installation
```bash
npm uninstall unjucks
# or
yarn remove unjucks
```

### Clean Cache
```bash
# Clear npm cache
npm cache clean --force

# Clear yarn cache  
yarn cache clean

# Clear pnpm cache
pnpm store prune
```

## Next Steps

- **[Quick Start](quick-start.md)** - Get started in 5 minutes
- **[First Generator](first-generator.md)** - Create custom templates
- **[Configuration Guide](../configuration/README.md)** - Advanced configuration options

---

**Need help?** Check our [troubleshooting guide](../troubleshooting/README.md) or [open an issue](https://github.com/unjs/unjucks/issues).