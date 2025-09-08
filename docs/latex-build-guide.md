# LaTeX Build System Integration Guide

## Overview

The Unjucks project now includes comprehensive LaTeX compilation support integrated into the build system. This allows you to compile LaTeX documents as part of your build process with support for multiple engines, bibliography processing, watch mode, and Docker integration.

## Quick Start

### Prerequisites

**Local Installation:**
- LaTeX distribution (TeX Live, MiKTeX, or MacTeX)
- Node.js 18+ 
- Required LaTeX packages: `texlive-latex-base`, `texlive-latex-extra`, `texlive-fonts-recommended`

**Docker Installation (Alternative):**
- Docker installed and running

### Available Commands

```bash
# Build all LaTeX documents
npm run build:latex

# Watch LaTeX files for changes and rebuild
npm run watch:latex

# Clean LaTeX build artifacts
npm run clean:latex

# Full build including LaTeX
npm run build
```

## Configuration

LaTeX compilation is configured through `config/latex.config.js`:

```javascript
export default {
  latex: {
    engine: 'pdflatex',           // LaTeX engine: pdflatex, xelatex, lualatex
    outputDir: './dist/latex',     // Output directory for PDFs
    tempDir: './temp/latex',       // Temporary compilation directory
    enableBibtex: true,            // Enable BibTeX processing
    enableBiber: true,             // Enable Biber processing
    maxRetries: 3,                 // Max compilation retries
    timeout: 60000,                // Compilation timeout (ms)
    concurrency: 2,                // Max concurrent compilations
    
    watch: {
      enabled: false,              // Enable watch mode
      patterns: ['**/*.tex', '**/*.bib'],
      ignored: ['**/node_modules/**', '**/dist/**']
    },
    
    docker: {
      enabled: false,              // Use Docker for compilation
      image: 'texlive/texlive:latest'
    },
    
    buildIntegration: {
      includeInBuild: true,        // Include in main build
      failOnError: false,          // Continue build if LaTeX fails
      skipIfNoFiles: true          // Skip if no .tex files found
    }
  }
};
```

## Docker Support

### Using Docker for Compilation

1. Enable Docker in configuration:
```javascript
docker: {
  enabled: true,
  image: 'texlive/texlive:latest'
}
```

2. Build using Docker:
```bash
# Using docker-compose
docker-compose -f docker/docker-compose.latex.yml up latex-builder

# Direct Docker build
docker build -f docker/Dockerfile.latex -t unjucks-latex .
docker run -v $(pwd):/workspace unjucks-latex
```

### Benefits of Docker
- Consistent LaTeX environment across systems
- No local LaTeX installation required
- Includes all LaTeX packages
- Isolated compilation environment

## Build System Integration

### Automatic Integration

The LaTeX build system integrates automatically with the main build process:

1. **Non-blocking**: LaTeX compilation won't fail the main build
2. **Auto-detection**: Only runs if `.tex` files are found
3. **Concurrent**: Supports parallel document compilation
4. **Caching**: Reuses compilation artifacts when possible

### Manual Integration

For custom build scripts, use the LaTeX build system programmatically:

```javascript
import { LaTeXBuildSystem } from './scripts/build-system-latex.js';

const buildSystem = new LaTeXBuildSystem();
await buildSystem.initialize();
const result = await buildSystem.build();
```

## CI/CD Integration

### GitHub Actions

The CI/CD pipeline automatically:
- Installs LaTeX on Ubuntu runners
- Tests LaTeX compilation (non-blocking)
- Uploads build artifacts
- Supports cross-platform builds

### Custom CI/CD

For other CI systems, ensure:
1. LaTeX is installed or Docker is available
2. Run `npm run build:latex` in your pipeline
3. Use `continue-on-error: true` for non-critical builds

## File Organization

```
project/
├── docs/                    # LaTeX source documents
│   ├── sample.tex          # Example document
│   └── references.bib      # Bibliography
├── dist/latex/             # Compiled PDFs (output)
├── temp/latex/             # Temporary files
├── config/
│   └── latex.config.js     # LaTeX configuration
├── scripts/
│   ├── build-system-latex.js   # LaTeX build system
│   └── latex-build-hook.js     # Build hook script
└── docker/
    ├── Dockerfile.latex         # LaTeX Docker image
    └── docker-compose.latex.yml # Docker compose
```

## Troubleshooting

### Common Issues

1. **"LaTeX command not found"**
   - Install LaTeX distribution locally
   - Or enable Docker mode: `docker.enabled: true`

2. **"Permission denied" errors**
   - Run: `chmod +x scripts/*.js`
   - Ensure output directories are writable

3. **Bibliography not compiling**
   - Check `.aux` files for bibliography references
   - Enable both BibTeX and Biber: `enableBibtex: true, enableBiber: true`

4. **Compilation timeout**
   - Increase timeout: `timeout: 120000` (2 minutes)
   - Check for infinite loops in LaTeX code

### Debug Mode

Enable verbose logging:
```javascript
{
  verbose: true,  // Enable detailed compilation logs
  maxRetries: 1   // Reduce retries for faster debugging
}
```

### Getting Help

1. Check compilation logs in `temp/latex/`
2. Run manual compilation: `pdflatex document.tex`
3. Test with Docker: `npm run build:latex` with `docker.enabled: true`
4. Verify LaTeX installation: `pdflatex --version`

## Advanced Features

### Multiple LaTeX Engines

Support for different LaTeX engines:
- **pdflatex**: Standard, fastest
- **xelatex**: Unicode and system fonts
- **lualatex**: Lua scripting, advanced features

### Bibliography Processing

Automatic detection and processing:
- **BibTeX**: Traditional bibliography processor
- **Biber**: Modern, Unicode-aware processor
- **Auto-retry**: Falls back between processors

### Watch Mode

Real-time compilation during development:
```bash
npm run watch:latex
```

Features:
- File change detection
- Debounced compilation
- Multi-document support
- Graceful error handling

## Performance Optimization

### Compilation Speed
- Use `pdflatex` for fastest compilation
- Limit `concurrency` based on system resources
- Enable compilation caching
- Use incremental builds

### Resource Management
- Configure appropriate `timeout` values
- Limit concurrent Docker containers
- Clean temporary files regularly: `npm run clean:latex`

## Integration Examples

### With Other Build Tools

```javascript
// In your build script
import { LaTeXBuildSystem } from './scripts/build-system-latex.js';

export async function buildDocs() {
  const latex = new LaTeXBuildSystem();
  await latex.initialize();
  
  // Build LaTeX documents
  await latex.build();
  
  // Continue with other documentation tasks
  await buildMarkdown();
  await generateAPI();
}
```

### Custom Template Integration

```javascript
// Generate LaTeX from templates, then compile
import { generateFromTemplate } from './src/lib/generator.js';
import { LaTeXBuildSystem } from './scripts/build-system-latex.js';

// Generate LaTeX from template
await generateFromTemplate('report', 'docs/report.tex', data);

// Compile generated document
const latex = new LaTeXBuildSystem();
await latex.initialize();
await latex.build();
```

This integration provides a robust, flexible LaTeX compilation system that scales from simple documents to complex multi-document projects.