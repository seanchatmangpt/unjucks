# LaTeX Compilation Setup Guide

Complete guide to setting up LaTeX compilation environments for document generation with Unjucks.

## 🚀 TeX Distribution Installation

### TeX Live (Recommended)

#### Linux Installation
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install texlive-full

# Fedora/CentOS
sudo dnf install texlive-scheme-full

# Arch Linux
sudo pacman -S texlive-most texlive-lang

# Manual installation (all Linux)
wget https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz
tar -xzf install-tl-unx.tar.gz
cd install-tl-*
sudo ./install-tl
```

#### macOS Installation
```bash
# MacTeX (recommended)
brew install mactex

# BasicTeX (minimal)
brew install basictex

# Manual download
# Visit: https://tug.org/mactex/
```

#### Windows Installation
```powershell
# Chocolatey
choco install miktex

# Scoop
scoop bucket add extras
scoop install latex

# Manual installation
# Download from: https://miktex.org/download
```

### MiKTeX (Windows Alternative)

#### Features
- **On-demand package installation**
- **Automatic updates**
- **Package manager GUI**
- **Editor integration**

```powershell
# Install MiKTeX
winget install MiKTeX.MiKTeX

# Configure automatic package installation
miktex packages update
miktex packages install amsmath amsfonts amssymb
```

## 🔧 LaTeX Engine Comparison

### pdfLaTeX (Default)
**Best for**: Most documents, traditional LaTeX  
**Pros**: Fast, widely supported, stable  
**Cons**: Limited font support, no Unicode

```bash
pdflatex document.tex
```

**Configuration**:
```latex
\documentclass{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{graphicx}
```

### XeLaTeX
**Best for**: Unicode documents, system fonts  
**Pros**: Full Unicode support, system fonts  
**Cons**: Slower compilation, larger files

```bash
xelatex document.tex
```

**Configuration**:
```latex
\documentclass{article}
\usepackage{fontspec}
\usepackage{polyglossia}
\setmainlanguage{english}
\setmainfont{Times New Roman}
```

### LuaLaTeX
**Best for**: Advanced typography, Lua scripting  
**Pros**: Full Unicode, Lua integration, OpenType features  
**Cons**: Slowest compilation, memory intensive

```bash
lualatex document.tex
```

**Configuration**:
```latex
\documentclass{article}
\usepackage{fontspec}
\usepackage{luacode}
\setmainfont{Libertinus Serif}
```

## 🛠️ Build System Setup

### latexmk (Recommended)

#### Installation
```bash
# Usually included with TeX Live
latexmk -version

# If not available
tlmgr install latexmk
```

#### Configuration File (`.latexmkrc`)
```perl
# Use pdflatex by default
$pdf_mode = 1;
$dvi_mode = 0;
$postscript_mode = 0;

# Output directory
$out_dir = 'build';

# Source directory
$search_path_separator = ':';

# Bibliography handling
$bibtex_use = 2;

# Clean extensions
$clean_ext = 'aux bbl blg fdb_latexmk fls log nav out snm toc';

# Engine selection
# $pdflatex = 'pdflatex -interaction=nonstopmode -synctex=1';
# $xelatex = 'xelatex -interaction=nonstopmode -synctex=1';
# $lualatex = 'lualatex -interaction=nonstopmode -synctex=1';

# Custom commands
add_cus_dep('glo', 'gls', 0, 'run_makeglossaries');
sub run_makeglossaries {
    return system("makeglossaries $_[0]");
}
```

#### Basic Usage
```bash
# Compile document
latexmk document.tex

# Use XeLaTeX
latexmk -xelatex document.tex

# Continuous compilation
latexmk -pvc document.tex

# Clean build files
latexmk -c document.tex
```

### Custom Build Scripts

#### Bash Build Script
```bash
#!/bin/bash
# build-latex.sh

set -e

DOCUMENT="$1"
ENGINE="${2:-pdflatex}"
OUTPUT_DIR="${3:-build}"
BIBLIOGRAPHY="${4:-false}"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Function to compile with bibliography
compile_with_bib() {
    echo "Compiling with bibliography..."
    $ENGINE -output-directory="$OUTPUT_DIR" "$DOCUMENT"
    bibtex "$OUTPUT_DIR/${DOCUMENT%.*}"
    $ENGINE -output-directory="$OUTPUT_DIR" "$DOCUMENT"
    $ENGINE -output-directory="$OUTPUT_DIR" "$DOCUMENT"
}

# Function to compile without bibliography
compile_simple() {
    echo "Simple compilation..."
    $ENGINE -output-directory="$OUTPUT_DIR" "$DOCUMENT"
    $ENGINE -output-directory="$OUTPUT_DIR" "$DOCUMENT"
}

# Main compilation
if [ "$BIBLIOGRAPHY" = "true" ]; then
    compile_with_bib
else
    compile_simple
fi

echo "Compilation complete. Output in $OUTPUT_DIR/"
```

#### Usage
```bash
chmod +x build-latex.sh

# Simple document
./build-latex.sh document.tex

# With XeLaTeX and bibliography
./build-latex.sh document.tex xelatex build true
```

### Node.js Build Integration

#### Package.json Scripts
```json
{
  "scripts": {
    "latex:build": "node scripts/build-latex.js",
    "latex:watch": "chokidar '**/*.tex' -c 'npm run latex:build'",
    "latex:clean": "rimraf build/**/*.{aux,log,toc,bbl,blg}"
  },
  "devDependencies": {
    "chokidar-cli": "^3.0.0",
    "rimraf": "^5.0.0"
  }
}
```

#### Build Script (`scripts/build-latex.js`)
```javascript
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const config = {
  engine: process.env.LATEX_ENGINE || 'pdflatex',
  outputDir: 'build',
  sourceDir: 'documents',
  bibliography: true
};

function buildDocument(texFile) {
  const baseName = path.basename(texFile, '.tex');
  const outputPath = path.join(config.outputDir, baseName);
  
  console.log(`Building ${texFile}...`);
  
  try {
    // Ensure output directory exists
    fs.mkdirSync(config.outputDir, { recursive: true });
    
    // First pass
    execSync(
      `${config.engine} -output-directory=${config.outputDir} ${texFile}`,
      { stdio: 'inherit' }
    );
    
    // Bibliography if needed
    if (config.bibliography) {
      try {
        execSync(`bibtex ${outputPath}`, { stdio: 'inherit' });
      } catch (error) {
        console.log('No bibliography or bibtex failed');
      }
    }
    
    // Second pass
    execSync(
      `${config.engine} -output-directory=${config.outputDir} ${texFile}`,
      { stdio: 'inherit' }
    );
    
    // Third pass for cross-references
    execSync(
      `${config.engine} -output-directory=${config.outputDir} ${texFile}`,
      { stdio: 'inherit' }
    );
    
    console.log(`✓ Successfully built ${baseName}.pdf`);
    
  } catch (error) {
    console.error(`✗ Failed to build ${texFile}:`, error.message);
    process.exit(1);
  }
}

// Build all .tex files in source directory
const texFiles = fs.readdirSync(config.sourceDir)
  .filter(file => file.endsWith('.tex'))
  .map(file => path.join(config.sourceDir, file));

texFiles.forEach(buildDocument);
```

## 🔄 CI/CD Integration

### GitHub Actions

#### Workflow (`.github/workflows/latex.yml`)
```yaml
name: LaTeX Compilation

on:
  push:
    paths:
      - '**/*.tex'
      - '**/*.bib'
  pull_request:
    paths:
      - '**/*.tex'
      - '**/*.bib'

jobs:
  compile-latex:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
      
    - name: Setup TeX Live
      uses: teatimeguest/setup-texlive-action@v3
      with:
        packages: |
          scheme-medium
          amsmath
          amsfonts
          amssymb
          graphicx
          geometry
          biblatex
          
    - name: Generate LaTeX from templates
      run: |
        npm install
        npm run generate:latex
        
    - name: Compile LaTeX documents
      run: |
        find generated -name "*.tex" -exec latexmk -pdf -output-directory=build {} \;
        
    - name: Upload PDFs
      uses: actions/upload-artifact@v4
      with:
        name: latex-documents
        path: build/*.pdf
        
    - name: Check for errors
      run: |
        if find build -name "*.log" -exec grep -l "Error\|Fatal" {} \;; then
          echo "LaTeX compilation errors found"
          exit 1
        fi
```

### Docker Setup

#### Dockerfile
```dockerfile
FROM texlive/texlive:latest

# Install Node.js for template processing
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy templates and source files
COPY . .

# Build command
CMD ["npm", "run", "build:all"]
```

#### Docker Compose
```yaml
version: '3.8'
services:
  latex-builder:
    build: .
    volumes:
      - ./documents:/workspace/documents
      - ./templates:/workspace/templates
      - ./build:/workspace/build
    environment:
      - LATEX_ENGINE=pdflatex
      - OUTPUT_FORMAT=pdf
    command: npm run build:latex
```

## 🎯 Unjucks Integration

### Template Build Pipeline

#### Configuration (`unjucks.config.js`)
```javascript
export default {
  latex: {
    engine: 'pdflatex',
    outputDir: 'build/latex',
    templateDir: 'templates/latex',
    buildScript: './scripts/build-latex.sh',
    autoCompile: true,
    watchMode: process.env.NODE_ENV === 'development'
  },
  
  hooks: {
    afterGenerate: async (files) => {
      const latexFiles = files.filter(f => f.endsWith('.tex'));
      if (latexFiles.length > 0 && config.latex.autoCompile) {
        await compileLatex(latexFiles);
      }
    }
  }
};
```

#### Build Integration
```javascript
// scripts/compile-latex.js
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function compileLatex(texFiles, options = {}) {
  const {
    engine = 'pdflatex',
    outputDir = 'build',
    passes = 2,
    bibliography = true
  } = options;
  
  for (const texFile of texFiles) {
    console.log(`Compiling ${texFile}...`);
    
    const baseName = path.basename(texFile, '.tex');
    const commands = [];
    
    // First pass
    commands.push(
      `${engine} -output-directory=${outputDir} -interaction=nonstopmode ${texFile}`
    );
    
    // Bibliography pass
    if (bibliography) {
      commands.push(`bibtex ${path.join(outputDir, baseName)}`);
    }
    
    // Additional passes
    for (let i = 1; i < passes; i++) {
      commands.push(
        `${engine} -output-directory=${outputDir} -interaction=nonstopmode ${texFile}`
      );
    }
    
    // Execute compilation
    for (const command of commands) {
      try {
        const { stdout, stderr } = await execAsync(command);
        if (stderr && stderr.includes('Error')) {
          throw new Error(stderr);
        }
      } catch (error) {
        console.error(`LaTeX compilation failed for ${texFile}:`, error.message);
        throw error;
      }
    }
    
    console.log(`✓ Successfully compiled ${baseName}.pdf`);
  }
}
```

### Template Generation with Auto-Compilation

```njk
---
to: {{ outputPath }}/{{ documentName }}.tex
compile: true
engine: {{ latexEngine | default('pdflatex') }}
passes: {{ compilationPasses | default(2) }}
bibliography: {{ hasBibliography | default(false) }}
---
\documentclass{ {{- documentClass }} }

{{ content }}

\end{document}
```

## 🔍 Quality Assurance

### Compilation Validation

#### Error Detection Script
```bash
#!/bin/bash
# validate-latex.sh

TEX_FILE="$1"
BUILD_DIR="${2:-build}"

echo "Validating LaTeX compilation for $TEX_FILE..."

# Compile and capture output
latexmk -pdf -output-directory="$BUILD_DIR" "$TEX_FILE" > "$BUILD_DIR/compile.log" 2>&1
COMPILE_EXIT_CODE=$?

# Check for common issues
check_errors() {
    local log_file="$BUILD_DIR/compile.log"
    
    # Fatal errors
    if grep -q "! LaTeX Error\|! Undefined control sequence\|! Emergency stop" "$log_file"; then
        echo "❌ Fatal LaTeX errors found"
        grep -n "! LaTeX Error\|! Undefined control sequence\|! Emergency stop" "$log_file"
        return 1
    fi
    
    # Package errors
    if grep -q "! Package .* Error" "$log_file"; then
        echo "⚠️  Package errors found"
        grep -n "! Package .* Error" "$log_file"
    fi
    
    # Missing references
    if grep -q "LaTeX Warning: Reference.*undefined" "$log_file"; then
        echo "⚠️  Undefined references found"
        grep -n "LaTeX Warning: Reference.*undefined" "$log_file"
    fi
    
    # Overfull boxes
    if grep -q "Overfull" "$log_file"; then
        echo "⚠️  Overfull boxes found"
        grep -c "Overfull" "$log_file" | head -5
    fi
    
    return 0
}

if [ $COMPILE_EXIT_CODE -eq 0 ]; then
    echo "✅ Compilation successful"
    check_errors
else
    echo "❌ Compilation failed (exit code: $COMPILE_EXIT_CODE)"
    check_errors
    exit 1
fi
```

### Performance Monitoring

#### Build Time Tracking
```javascript
// Monitor compilation performance
const buildTimes = [];

function trackBuildTime(texFile, startTime, endTime) {
  const duration = endTime - startTime;
  buildTimes.push({
    file: texFile,
    duration,
    timestamp: new Date()
  });
  
  console.log(`Build time for ${texFile}: ${duration}ms`);
  
  // Warn on slow builds
  if (duration > 30000) { // 30 seconds
    console.warn(`⚠️  Slow build detected: ${texFile} took ${duration/1000}s`);
  }
}
```

## 📊 Configuration Examples

### Multi-Engine Setup
```javascript
// Different engines for different document types
const engineConfig = {
  'legal': {
    engine: 'pdflatex',
    packages: ['bluebook', 'geometry', 'setspace'],
    passes: 2
  },
  'scientific': {
    engine: 'pdflatex',
    packages: ['amsmath', 'amssymb', 'amsthm', 'graphicx'],
    passes: 3,
    bibliography: true
  },
  'multilingual': {
    engine: 'xelatex',
    packages: ['fontspec', 'polyglossia'],
    passes: 2
  }
};
```

### Optimization Settings
```perl
# .latexmkrc optimizations
$max_repeat = 5;           # Max compilation passes
$pdf_mode = 1;             # Direct PDF output
$aux_dir = 'build/aux';    # Separate aux files
$out_dir = 'build/pdf';    # PDF output directory

# Faster compilation options
$pdflatex = 'pdflatex -interaction=nonstopmode -halt-on-error -synctex=1';

# Clean more aggressively
$clean_ext = 'aux bbl blg fdb_latexmk fls log nav out snm toc lof lot';
```

---

This compilation setup guide provides comprehensive coverage of LaTeX build systems for use with Unjucks. For specific troubleshooting, refer to the [Troubleshooting Guide](./troubleshooting.md).