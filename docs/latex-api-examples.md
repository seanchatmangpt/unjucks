# LaTeX API Examples

This document provides comprehensive examples of using the LaTeX API with JSDoc documentation.

## Table of Contents

- [LaTeX Compiler](#latex-compiler)
- [LaTeX Configuration](#latex-configuration)
- [LaTeX Template Generator](#latex-template-generator)
- [Complete Workflow Examples](#complete-workflow-examples)

## LaTeX Compiler

### Basic Usage

```javascript
import { LaTeXCompiler } from '../src/lib/latex/compiler.js';

// Create basic compiler
const compiler = new LaTeXCompiler({
  engine: 'pdflatex',
  outputDir: './dist',
  verbose: true
});

// Initialize and compile
await compiler.initialize();
const result = await compiler.compile('document.tex');

if (result.success) {
  console.log(`PDF created: ${result.outputPath}`);
  console.log(`Compilation took ${result.duration}ms`);
} else {
  console.error(`Compilation failed: ${result.error}`);
}
```

### Docker Usage

```javascript
// Docker-enabled compiler
const dockerCompiler = new LaTeXCompiler({
  docker: {
    enabled: true,
    image: 'texlive/texlive:latest',
    volumes: {
      './assets': '/workspace/assets',
      './references': '/workspace/references'
    },
    environment: {
      'TEXMFVAR': '/tmp/texmf-var'
    }
  }
});

await dockerCompiler.initialize();
const result = await dockerCompiler.compile('complex-document.tex');
```

### Watch Mode

```javascript
// Start watch mode with custom patterns
await compiler.startWatchMode('thesis.tex', {
  patterns: ['**/*.tex', '**/*.bib', 'images/**/*.png'],
  ignored: ['**/temp/**', '**/cache/**'],
  debounceMs: 1000
});

console.log('Watch mode active - edit your files!');

// Stop watch mode when done
process.on('SIGINT', async () => {
  await compiler.stopWatchMode();
  await compiler.cleanup();
  process.exit(0);
});
```

### Performance Monitoring

```javascript
// Get compilation metrics
const metrics = compiler.getMetrics();
console.log(`Compiled ${metrics.compilations} documents`);
console.log(`Success rate: ${(1 - metrics.errors / metrics.compilations) * 100}%`);
console.log(`Average time: ${metrics.averageTime}ms`);
console.log(`Total warnings: ${metrics.warnings}`);

// Reset metrics for benchmarking
compiler.resetMetrics();
```

## LaTeX Configuration

### Loading Configuration

```javascript
import { LaTeXConfig } from '../src/lib/latex/config.js';

const latexConfig = new LaTeXConfig();

// Load specific config file
const config = await latexConfig.load('./my-latex.config.json');

// Auto-discover config files
const autoConfig = await latexConfig.load();
// Searches for: unjucks.config.json, unjucks.config.yaml, .unjucksrc, .unjucksrc.json

// Use loaded config
const compiler = new LaTeXCompiler(config);
```

### Creating Configuration Templates

```javascript
// Create config template
await latexConfig.createTemplate('./unjucks.config.json');

// Create and then load the template
const templatePath = await latexConfig.createTemplate('./latex-config.json');
const config = await latexConfig.load(templatePath);
```

### Engine Information

```javascript
// Get specific engine info
const xelatex = latexConfig.getEngineInfo('xelatex');
console.log(xelatex.description); // 'XeTeX engine with Unicode and system font support'
console.log(xelatex.command);     // 'xelatex'

// List all engines
const engines = latexConfig.listEngines();
engines.forEach(engine => {
  console.log(`${engine.name}: ${engine.description}`);
});
```

### Docker Presets

```javascript
// Get Docker presets
const presets = latexConfig.getDockerPresets();
console.log(presets.full.description); // 'Full TeXLive installation (recommended)'

// Use preset in configuration
const dockerConfig = {
  docker: {
    enabled: true,
    image: presets.basic.image
  }
};
```

### Configuration Merging

```javascript
// Merge configurations
const userConfig = {
  engine: 'xelatex',
  docker: { enabled: true },
  watch: { debounceMs: 1000 }
};

const merged = latexConfig.mergeConfig(userConfig);
// Result: user settings override defaults, but missing settings use defaults
```

## LaTeX Template Generator

### Basic Template Generation

```javascript
import { LaTeXTemplateGenerator } from '../src/lib/latex/template-generator.js';

const generator = new LaTeXTemplateGenerator();

// Generate academic article
const articleContent = generator.generateTemplate({
  type: 'article',
  title: 'Advanced Neural Networks',
  author: 'Dr. Smith',
  bibliography: true,
  packages: ['algorithm', 'tikz']
});

// Generate book template
const bookContent = generator.generateTemplate({
  type: 'book',
  title: 'Complete Guide to LaTeX',
  author: 'Technical Writer'
});

// Generate presentation
const slides = generator.generateTemplate({
  type: 'presentation',
  title: 'Project Results',
  author: 'Research Team'
});
```

### Interactive Generation

```javascript
// Interactive generation from scratch
const config = await generator.interactiveGeneration();
const content = generator.generateTemplate(config);

// Interactive with pre-filled defaults
const prefilledConfig = await generator.interactiveGeneration({
  type: 'article',
  author: 'Default Author',
  bibliography: true
});

// Handle non-interactive environments
try {
  const config = await generator.interactiveGeneration(fallbackConfig);
} catch (error) {
  // Falls back to initial config if interactive prompts fail
  const config = fallbackConfig;
}
```

### Template Information

```javascript
// List all templates
const templates = generator.listTemplates();
templates.forEach(template => {
  console.log(`${template.name}: ${template.documentclass} class`);
  console.log(`  Structure: ${template.structure.join(', ')}`);
});

// Get detailed template info
const info = generator.getTemplateInfo('article');
console.log(`${info.type}: ${info.description}`);
console.log(`Uses ${info.documentclass} class`);
console.log(`Includes: ${info.defaultPackages.join(', ')}`);

// Check template capabilities
const bookInfo = generator.getTemplateInfo('book');
if (bookInfo.structure.includes('chapters')) {
  console.log('This template supports chapters');
}
```

### Bibliography Generation

```javascript
// Generate sample bibliography
const bibContent = generator.generateBibliography();
await fs.writeFile('references.bib', bibContent);

// Use with template generation
const texContent = generator.generateTemplate({ 
  type: 'article', 
  bibliography: true 
});
const bibContent = generator.generateBibliography();
// Save both .tex and .bib files
```

### Template Validation

```javascript
// Validate configuration
try {
  generator.validateConfig({ type: 'article', title: 'My Paper' });
  console.log('Configuration is valid');
} catch (error) {
  console.error('Invalid config:', error.message);
}

// Validate before generation
if (generator.validateConfig(userConfig)) {
  const content = generator.generateTemplate(userConfig);
}
```

## Complete Workflow Examples

### Academic Paper Workflow

```javascript
import { LaTeXCompiler } from '../src/lib/latex/compiler.js';
import { LaTeXConfig } from '../src/lib/latex/config.js';
import { LaTeXTemplateGenerator } from '../src/lib/latex/template-generator.js';
import { promises as fs } from 'fs';

async function createAcademicPaper() {
  // 1. Load configuration
  const latexConfig = new LaTeXConfig();
  const config = await latexConfig.load();

  // 2. Generate template
  const generator = new LaTeXTemplateGenerator();
  const paperContent = generator.generateTemplate({
    type: 'article',
    title: 'Machine Learning in Practice',
    author: 'Dr. Jane Doe',
    bibliography: true,
    packages: ['algorithm', 'amsmath', 'graphicx']
  });

  // 3. Generate bibliography
  const bibContent = generator.generateBibliography();

  // 4. Write files
  await fs.writeFile('paper.tex', paperContent);
  await fs.writeFile('references.bib', bibContent);

  // 5. Compile with bibliography support
  const compiler = new LaTeXCompiler({
    ...config,
    engine: 'pdflatex',
    enableBibtex: true,
    verbose: true
  });

  await compiler.initialize();
  const result = await compiler.compile('paper.tex');

  if (result.success) {
    console.log(`Paper compiled successfully: ${result.outputPath}`);
    console.log(`Compilation time: ${result.duration}ms`);
    if (result.warnings.length > 0) {
      console.log('Warnings:', result.warnings);
    }
  } else {
    console.error(`Compilation failed: ${result.error}`);
  }

  return result;
}

// Run the workflow
createAcademicPaper().catch(console.error);
```

### Docker-based Book Production

```javascript
async function produceBookWithDocker() {
  // 1. Setup Docker configuration
  const latexConfig = new LaTeXConfig();
  const dockerPresets = latexConfig.getDockerPresets();

  const config = latexConfig.mergeConfig({
    engine: 'xelatex', // Better for books with Unicode
    docker: {
      enabled: true,
      image: dockerPresets.full.image,
      volumes: {
        './assets': '/workspace/assets',
        './chapters': '/workspace/chapters'
      }
    },
    outputDir: './build/books',
    verbose: true
  });

  // 2. Generate book template
  const generator = new LaTeXTemplateGenerator();
  const bookContent = generator.generateTemplate({
    type: 'book',
    title: 'The Complete Guide to LaTeX',
    author: 'Technical Writer',
    packages: ['fancyhdr', 'tocloft', 'hyperref']
  });

  await fs.writeFile('book.tex', bookContent);

  // 3. Setup compiler with Docker
  const compiler = new LaTeXCompiler(config);
  await compiler.initialize();

  // 4. Start watch mode for development
  await compiler.startWatchMode('book.tex', {
    patterns: ['book.tex', 'chapters/**/*.tex', 'assets/**'],
    debounceMs: 2000
  });

  console.log('Book production started with Docker');
  console.log('Edit your files and the book will auto-compile');

  // 5. Cleanup handler
  process.on('SIGINT', async () => {
    await compiler.stopWatchMode();
    await compiler.cleanup();
    
    const metrics = compiler.getMetrics();
    console.log('\nFinal metrics:');
    console.log(`  Compilations: ${metrics.compilations}`);
    console.log(`  Success rate: ${(1 - metrics.errors / metrics.compilations) * 100}%`);
    console.log(`  Average time: ${metrics.averageTime}ms`);
    
    process.exit(0);
  });
}

produceBookWithDocker().catch(console.error);
```

### Error Handling and Monitoring

```javascript
async function robustCompilation() {
  const compiler = new LaTeXCompiler({
    engine: 'pdflatex',
    maxRetries: 3,
    timeout: 120000, // 2 minutes
    verbose: true
  });

  try {
    await compiler.initialize();
    
    // Compile with error handling
    const result = await compiler.compile('document.tex');
    
    if (result.success) {
      console.log(`✅ Success: ${result.outputPath}`);
      
      // Check for warnings
      if (result.warnings.length > 0) {
        console.log('⚠️  Warnings:');
        result.warnings.forEach(warning => console.log(`   ${warning}`));
      }
      
      // Log performance
      console.log(`⏱️  Compilation time: ${result.duration}ms`);
      
    } else {
      console.error(`❌ Compilation failed: ${result.error}`);
      
      // Log detailed error information
      if (result.logs && result.logs.length > 0) {
        console.error('📋 Detailed logs:');
        result.logs.forEach(log => {
          if (log.type === 'stderr') {
            console.error(`   ${log.content.trim()}`);
          }
        });
      }
    }
    
    // Show metrics
    const metrics = compiler.getMetrics();
    console.log('\n📊 Compilation Metrics:');
    console.log(`   Total compilations: ${metrics.compilations}`);
    console.log(`   Errors: ${metrics.errors}`);
    console.log(`   Warnings: ${metrics.warnings}`);
    console.log(`   Average time: ${Math.round(metrics.averageTime)}ms`);
    
  } catch (error) {
    console.error(`💥 Critical error: ${error.message}`);
  } finally {
    await compiler.cleanup();
  }
}

robustCompilation().catch(console.error);
```

### Configuration Management

```javascript
async function manageConfigurations() {
  const latexConfig = new LaTeXConfig();

  // Create different configuration profiles
  const profiles = {
    development: {
      engine: 'pdflatex',
      verbose: true,
      watch: { enabled: true, debounceMs: 500 },
      outputDir: './dev-build',
      docker: { enabled: false }
    },
    
    production: {
      engine: 'xelatex',
      verbose: false,
      enableBiber: true,
      outputDir: './dist',
      docker: {
        enabled: true,
        image: 'texlive/texlive:latest'
      },
      output: {
        cleanAux: true,
        compression: true
      }
    },
    
    testing: {
      engine: 'pdflatex',
      timeout: 30000, // Fast timeout for tests
      tempDir: './test-temp',
      outputDir: './test-output'
    }
  };

  // Validate each profile
  Object.entries(profiles).forEach(([name, profile]) => {
    try {
      const validated = latexConfig.validateConfig(profile);
      console.log(`✅ ${name} profile is valid`);
    } catch (error) {
      console.error(`❌ ${name} profile is invalid: ${error.message}`);
    }
  });

  // Merge with defaults
  const devConfig = latexConfig.mergeConfig(profiles.development);
  const prodConfig = latexConfig.mergeConfig(profiles.production);

  // Save configurations
  await fs.writeFile('dev.config.json', JSON.stringify({ latex: devConfig }, null, 2));
  await fs.writeFile('prod.config.json', JSON.stringify({ latex: prodConfig }, null, 2));

  console.log('Configuration profiles created successfully');
}

manageConfigurations().catch(console.error);
```

## Error Handling Best Practices

```javascript
// Always wrap LaTeX operations in try-catch
try {
  const compiler = new LaTeXCompiler(options);
  await compiler.initialize();
  const result = await compiler.compile('document.tex');
  
  // Handle compilation results
  if (!result.success) {
    // Log specific error details
    console.error('Compilation error:', result.error);
    if (result.logs) {
      result.logs.filter(log => log.type === 'stderr')
                 .forEach(log => console.error(log.content));
    }
  }
  
} catch (error) {
  // Handle initialization or critical errors
  console.error('Critical LaTeX error:', error.message);
} finally {
  // Always cleanup
  await compiler?.cleanup();
}
```

This comprehensive guide covers all the documented APIs with practical examples following the 80/20 rule - focusing on the most commonly used functionality with complete working examples.