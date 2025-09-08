# LaTeX Integration for Unjucks

This document describes the LaTeX integration capabilities added to Unjucks, providing comprehensive LaTeX document compilation and management features.

## Overview

The LaTeX integration provides:

- **LaTeX Compilation**: Support for pdflatex, xelatex, and lualatex engines
- **Package Management**: Automatic package analysis, dependency checking, and conflict detection
- **Document Validation**: Comprehensive syntax validation and error reporting
- **Docker Support**: Containerized LaTeX environments for consistent builds
- **Build Integration**: Seamless integration with the Unjucks build system
- **Watch Mode**: Automatic recompilation on file changes

## Components

### 1. LaTeX Compiler (`src/lib/latex/compiler.js`)
- Multi-engine support (pdflatex, xelatex, lualatex)
- Bibliography compilation (BibTeX, Biber)
- Watch mode with file monitoring
- Docker integration for consistent environments
- Comprehensive error handling and logging

### 2. Package Manager (`src/lib/latex/package-manager.js`)
- Package dependency analysis
- Conflict detection
- Installation command generation
- Package database with 15+ common packages
- Preamble optimization

### 3. Document Validator (`src/lib/latex/validator.js`)
- Bracket and brace matching validation
- Command syntax checking
- Environment validation
- Citation and reference checking
- Math syntax validation

### 4. LaTeX Utils (`src/lib/latex/utils.js`)
- Text escaping/unescaping
- Command and environment extraction
- Document formatting
- Word counting
- Metadata extraction

### 5. Configuration Management (`src/lib/latex/config.js`)
- Flexible configuration loading
- Engine-specific settings
- Docker preset management
- Security settings

### 6. Docker Support (`src/lib/latex/docker-support.js`)
- Containerized LaTeX compilation
- Custom image building
- Volume and environment management
- Security-focused container settings

### 7. Build Integration (`src/lib/latex/build-integration.js`)
- Automatic document discovery
- Batch compilation
- Build system integration
- Progress reporting

## Usage

### Basic Setup

1. **Install Dependencies** (if using local LaTeX):
   ```bash
   # Ubuntu/Debian
   sudo apt-get install texlive-full
   
   # macOS
   brew install mactex
   
   # Or use Docker (no local installation needed)
   ```

2. **Configuration**:
   Create `config/latex.config.js` with your settings (a default configuration is provided).

### Available Scripts

The integration adds the following npm scripts:

```bash
# Build all LaTeX documents
npm run build:latex

# Watch LaTeX files for changes and auto-compile
npm run watch:latex

# Clean LaTeX build artifacts
npm run clean:latex
```

### Programmatic Usage

```javascript
// LaTeX compilation
import { LaTeXCompiler } from './src/lib/latex/compiler.js';

const compiler = new LaTeXCompiler({
  engine: 'pdflatex',
  outputDir: './dist/latex',
  docker: { enabled: true }
});

await compiler.initialize();
const result = await compiler.compile('./document.tex');

// Package analysis
import { analyzePackages } from './src/lib/latex/package-manager.js';

const analysis = analyzePackages(latexContent);
console.log(`Found ${analysis.packages.length} packages`);
console.log(`Conflicts: ${analysis.analysis.conflicts.length}`);

// Document validation
import { validateLatex } from './src/lib/latex/validator.js';

const validation = validateLatex(latexContent);
if (!validation.isValid) {
  console.log(`${validation.errors.length} errors found`);
}
```

### Docker Usage

For consistent builds across environments, enable Docker support:

```javascript
const compiler = new LaTeXCompiler({
  docker: {
    enabled: true,
    image: 'texlive/texlive:latest',
    volumes: {
      './assets': '/workspace/assets'
    }
  }
});
```

## Features

### Package Management
- **Automatic Detection**: Scans `\\usepackage` commands
- **Dependency Checking**: Validates package dependencies
- **Conflict Detection**: Identifies conflicting packages
- **Recommendations**: Suggests packages based on document content

### Validation
- **Syntax Checking**: Validates LaTeX syntax and structure
- **Bracket Matching**: Ensures proper brace and bracket pairing
- **Environment Validation**: Checks begin/end environment matching
- **Citation Validation**: Validates references and citations
- **Math Validation**: Checks mathematical expressions

### Build Integration
- **Auto-Discovery**: Finds LaTeX documents in the project
- **Batch Processing**: Compiles multiple documents
- **Error Reporting**: Detailed compilation error reporting
- **Progress Tracking**: Real-time compilation progress

## Configuration

The LaTeX integration can be configured via `config/latex.config.js`:

```javascript
export default {
  latex: {
    engine: 'pdflatex',
    outputDir: './dist/latex',
    tempDir: './temp/latex',
    enableBibtex: true,
    enableBiber: true,
    timeout: 60000,
    docker: {
      enabled: false,
      image: 'texlive/texlive:latest'
    },
    watch: {
      enabled: false,
      patterns: ['**/*.tex', '**/*.bib']
    }
  }
};
```

## Dependencies

### Node.js Dependencies
All required dependencies are already included in the main package.json:
- `chokidar` - File watching
- `consola` - Logging
- `chalk` - Terminal colors
- `confbox` - Configuration management
- `glob` - File pattern matching

### LaTeX Dependencies
- **Local Installation**: TeX Live, MiKTeX, or MacTeX
- **Docker**: `texlive/texlive:latest` image (recommended)

## Testing

Run the comprehensive LaTeX integration test:

```bash
node scripts/test-latex-integration.js
```

This test validates all LaTeX components without requiring a LaTeX installation.

## Troubleshooting

### Common Issues

1. **LaTeX Not Found**: Install LaTeX distribution or enable Docker mode
2. **Permission Errors**: Ensure output directories are writable
3. **Docker Issues**: Check Docker installation and image availability
4. **Package Conflicts**: Use the validator to identify conflicting packages

### Debug Mode

Enable verbose logging for detailed compilation information:

```javascript
const compiler = new LaTeXCompiler({ verbose: true });
```

## Integration Status

✅ **Complete**: All LaTeX components are fully integrated and tested
- Package dependencies: All resolved
- Module imports: All working
- Build system: Integrated
- Configuration: Available
- Testing: Comprehensive test suite
- Documentation: Complete

The LaTeX integration is ready for production use and requires no additional setup for basic functionality.