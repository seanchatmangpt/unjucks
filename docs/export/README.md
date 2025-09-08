# Unjucks Export Documentation

## Overview

Unjucks provides comprehensive document export capabilities supporting multiple output formats with advanced templating, batch processing, and format conversion features. The export system is designed for professional document generation, academic publishing, and seamless integration with development workflows.

## Supported Export Formats

| Format | Extension | Description | Use Cases |
|--------|-----------|-------------|-----------|
| **PDF** | `.pdf` | High-quality documents via LaTeX | Academic papers, reports, books, presentations |
| **DOCX** | `.docx` | Microsoft Word format | Corporate documents, collaborative editing |
| **HTML** | `.html` | Web-ready documents | Documentation sites, web publishing |
| **Markdown** | `.md` | Portable plain text | GitHub/GitLab wikis, documentation |
| **LaTeX** | `.tex` | Professional typesetting | Academic publications, complex layouts |
| **RTF** | `.rtf` | Rich Text Format | Cross-platform compatibility |
| **TXT** | `.txt` | Plain text | Simple exports, data processing |

## Quick Start

### Basic Export Commands

```bash
# Export single file to PDF (default format)
unjucks export document.md

# Export with specific format
unjucks export document.md --format html
unjucks export document.md --format docx

# Export with custom output path
unjucks export document.md --output ./dist/document.pdf
```

### Format-Specific Commands

```bash
# PDF export with advanced options
unjucks export pdf document.md --template academic --toc --bibliography

# DOCX export with corporate template
unjucks export docx document.md --template corporate --header --footer

# HTML export with responsive design
unjucks export html document.md --template modern --responsive
```

### Batch Export

```bash
# Export all markdown files to PDF
unjucks export "*.md" --all --format pdf

# Export documentation folder to HTML
unjucks export "docs/**/*.md" --all --format html --output ./public/

# Concurrent batch processing
unjucks export "**/*.md" --all --format pdf --concurrency 5
```

## Export Templates

### PDF Templates
- **academic** - Academic paper format with proper margins and typography
- **article** - Journal article format with abstract and references
- **report** - Technical report with title page and sections
- **book** - Book chapter format with headers and page numbers
- **slides** - Presentation slides with landscape orientation
- **minimal** - Clean minimal format for simple documents

### DOCX Templates
- **corporate** - Professional business document format
- **academic** - Academic paper with proper styling
- **modern** - Contemporary clean design
- **simple** - Basic document format
- **letterhead** - Official letterhead format

### HTML Templates
- **modern** - Contemporary web styling with system fonts
- **classic** - Traditional web design with serif fonts
- **minimal** - Clean minimal design
- **dark** - Dark theme for code documentation
- **bootstrap** - Bootstrap-based responsive design
- **custom** - Customizable CSS framework

### Markdown Templates
- **github** - GitHub-flavored markdown with proper formatting
- **gitlab** - GitLab-compatible markdown
- **standard** - Standard markdown specification
- **extended** - Extended markdown with additional features
- **minimal** - Basic markdown format

## Export Presets

Pre-configured export settings for common use cases:

```bash
# Academic preset: PDF with bibliography and table of contents
unjucks export document.md --preset academic

# Report preset: DOCX with corporate styling
unjucks export document.md --preset report

# Web preset: HTML with responsive design and modern styling
unjucks export document.md --preset web

# Documentation preset: Markdown optimized for GitHub
unjucks export document.md --preset documentation

# Presentation preset: PDF slides in landscape mode
unjucks export document.md --preset presentation

# Article preset: Compact PDF format for articles
unjucks export document.md --preset article
```

## Advanced Features

### Template Variables

Inject dynamic content using JSON variables:

```bash
# Basic variables
unjucks export document.md --variables '{
  "title": "My Document",
  "author": "John Doe",
  "date": "2025-09-08"
}'

# Complex variables with nested objects
unjucks export document.md --variables '{
  "project": {
    "name": "Unjucks",
    "version": "2025.9.8",
    "description": "Advanced template system"
  },
  "team": ["Alice", "Bob", "Charlie"]
}'
```

### Document Metadata

Include structured metadata in exports:

```bash
unjucks export document.md --metadata '{
  "description": "Technical documentation",
  "keywords": ["documentation", "technical", "guide"],
  "category": "reference",
  "language": "en-US"
}'
```

### Format Conversion

Convert between different document formats:

```bash
# LaTeX to PDF
unjucks export convert document.tex document.pdf

# Markdown to DOCX
unjucks export convert document.md report.docx

# HTML to PDF (via LaTeX)
unjucks export convert document.html document.pdf

# With template specification
unjucks export convert input.md output.html --template bootstrap
```

### Preview Mode (Dry Run)

Preview exports without creating files:

```bash
# Single file preview
unjucks export document.md --format pdf --dry

# Batch preview
unjucks export "*.md" --all --format html --dry

# Verbose preview with full details
unjucks export document.md --format pdf --dry --verbose
```

## Command Reference

### Main Export Command

```bash
unjucks export [input] [options]
```

**Options:**
- `--format, -f` - Output format (pdf, docx, html, md, tex, rtf, txt)
- `--output, -o` - Output file path
- `--template, -t` - Template name
- `--preset, -p` - Predefined preset
- `--all` - Batch export all matching files
- `--dry` - Preview without creating files
- `--force` - Overwrite existing files
- `--verbose, -v` - Detailed output
- `--quiet, -q` - Minimal output
- `--concurrency` - Concurrent processing limit
- `--toc` - Include table of contents
- `--bibliography` - Include bibliography
- `--variables` - JSON template variables
- `--metadata` - JSON document metadata

### Subcommands

```bash
# Format-specific exports
unjucks export pdf [input] [pdf-options]
unjucks export docx [input] [docx-options] 
unjucks export html [input] [html-options]

# Format conversion
unjucks export convert [input] [output] [options]

# Information commands
unjucks export templates [--format format]
unjucks export presets
```

### PDF-Specific Options

```bash
unjucks export pdf document.md [options]
```

- `--engine` - LaTeX engine (pdflatex, xelatex, lualatex)
- `--template` - PDF template
- `--toc` - Table of contents
- `--bibliography` - Bibliography support
- `--landscape` - Landscape orientation

### DOCX-Specific Options

```bash
unjucks export docx document.md [options]
```

- `--template` - DOCX template
- `--header` - Include header
- `--footer` - Include footer
- `--toc` - Table of contents

### HTML-Specific Options

```bash
unjucks export html document.md [options]
```

- `--template` - HTML template
- `--css` - Include CSS styling
- `--responsive` - Responsive design

## Error Handling

The export system provides comprehensive error handling with helpful diagnostics:

### Common Error Types

1. **File Not Found**
   ```
   Error: Input file not found: document.md
   Suggestion: Check file path and permissions
   ```

2. **Unsupported Format**
   ```
   Error: Unsupported format: xyz
   Supported formats: pdf, docx, html, md, tex, rtf, txt
   ```

3. **Template Not Available**
   ```
   Error: Template 'custom' not available for format 'pdf'
   Available templates: academic, article, report, book, slides, minimal
   ```

4. **Permission Denied**
   ```
   Error: Cannot write to output directory
   Suggestion: Check directory permissions or use different output path
   ```

5. **LaTeX Not Found**
   ```
   Warning: LaTeX not found, generating .tex file instead of PDF
   Suggestion: Install TeX Live or MiKTeX for PDF compilation
   ```

### Debugging and Troubleshooting

```bash
# Enable verbose output for debugging
unjucks export document.md --format pdf --verbose

# Check what would be exported
unjucks export document.md --format pdf --dry --verbose

# List available options
unjucks export templates
unjucks export templates --format pdf
unjucks export presets
```

## Integration Examples

### Package.json Scripts

```json
{
  "scripts": {
    "docs:pdf": "unjucks export 'docs/*.md' --all --format pdf --output ./dist/docs/",
    "docs:web": "unjucks export 'docs/*.md' --all --format html --template modern --output ./public/docs/",
    "export:readme": "unjucks export README.md --format pdf --template article --output ./README.pdf"
  }
}
```

### GitHub Actions Workflow

```yaml
name: Export Documentation

on: [push, pull_request]

jobs:
  export-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Install LaTeX
        run: sudo apt-get install texlive-full
        
      - name: Export documentation
        run: |
          unjucks export README.md --format pdf --output ./artifacts/
          unjucks export "docs/**/*.md" --all --format html --output ./artifacts/docs/
          
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: exported-docs
          path: artifacts/
```

### Makefile Integration

```makefile
.PHONY: docs docs-pdf docs-html docs-clean

docs: docs-pdf docs-html

docs-pdf:
	unjucks export "docs/*.md" --all --format pdf --output ./build/pdf/

docs-html:
	unjucks export "docs/*.md" --all --format html --template modern --output ./build/html/

docs-clean:
	rm -rf ./build/
```

## Performance Optimization

### Batch Processing

- Use `--all` flag for multiple files instead of individual commands
- Adjust `--concurrency` based on system resources (default: 3)
- Use consistent templates to leverage caching

### Resource Management

```bash
# Low resource systems
unjucks export "*.md" --all --format pdf --concurrency 1

# High-performance systems
unjucks export "*.md" --all --format pdf --concurrency 8

# Memory-intensive operations
unjucks export large-document.md --format pdf --verbose
```

### Template Optimization

- Reuse templates across similar documents
- Use minimal templates for simple documents
- Cache template resources when possible

## Output Quality Guidelines

### PDF Best Practices

- Use `academic` template for papers and theses
- Use `report` template for technical documentation
- Use `slides` template for presentations
- Include `--toc` for long documents
- Enable `--bibliography` for academic work

### HTML Best Practices

- Use `modern` template for documentation sites
- Enable `--responsive` for mobile compatibility
- Use `bootstrap` template for web frameworks
- Include custom CSS for branding

### DOCX Best Practices

- Use `corporate` template for business documents
- Enable `--header` and `--footer` for official documents
- Use `academic` template for academic submissions
- Include `--toc` for structured documents

## Extensibility

### Custom Templates

Templates are stored in organized directories and can be extended:

```
templates/
├── pdf/
│   ├── academic.tex
│   ├── article.tex
│   └── custom.tex
├── html/
│   ├── modern.css
│   ├── minimal.css
│   └── custom.css
└── docx/
    ├── corporate.xml
    └── custom.xml
```

### Custom Presets

Create custom presets by modifying the ExportEngine configuration:

```javascript
const customPresets = {
  thesis: { 
    format: 'pdf', 
    template: 'academic', 
    toc: true, 
    bibliography: true,
    landscape: false 
  },
  newsletter: { 
    format: 'html', 
    template: 'modern', 
    responsive: true, 
    css: true 
  }
};
```

## Migration from Other Tools

### From Pandoc

```bash
# Pandoc equivalent
pandoc document.md -o document.pdf

# Unjucks equivalent
unjucks export document.md --format pdf
```

### From LaTeX Direct

```bash
# Direct LaTeX compilation
pdflatex document.tex

# Unjucks with LaTeX template
unjucks export document.md --format pdf --template academic
```

### From Word Export

Replace manual Word exports with automated Unjucks DOCX generation:

```bash
# Automated DOCX generation
unjucks export document.md --format docx --template corporate
```

## Security Considerations

### Input Validation

- All input files are validated before processing
- Template injection is prevented through escaping
- Output paths are sanitized to prevent directory traversal

### Safe Template Processing

- Template variables are properly escaped
- No arbitrary code execution in templates
- Sandboxed processing environment

### File Permissions

- Output files inherit appropriate permissions
- Directory creation respects system umask
- Temporary files are properly cleaned up

## Monitoring and Logging

### Export Metrics

The system tracks export performance and provides metrics:

```bash
# Verbose mode shows timing and size information
unjucks export document.md --format pdf --verbose
```

Output includes:
- Processing duration
- Output file size
- Template compilation time
- Error count and details

### Logging Levels

- `--quiet`: Minimal output, errors only
- Default: Standard progress and results
- `--verbose`: Detailed processing information

## Future Enhancements

### Planned Features

- **Custom CSS injection** for HTML templates
- **Bibliography management** integration
- **Multi-language support** for templates
- **Cloud export services** integration
- **Real-time preview** capabilities
- **Template marketplace** for sharing

### API Integration

Future versions will include programmatic API access:

```javascript
import { ExportEngine } from 'unjucks/export';

const exporter = new ExportEngine();
const result = await exporter.exportFile('document.md', {
  format: 'pdf',
  template: 'academic',
  variables: { title: 'My Paper' }
});
```

## Support and Resources

### Getting Help

```bash
# Command help
unjucks export --help
unjucks export pdf --help

# List available options
unjucks export templates
unjucks export presets
```

### Troubleshooting Resources

1. **Verbose mode**: `--verbose` flag for detailed output
2. **Dry run**: `--dry` flag to preview without creating files
3. **Template listing**: Check available templates and presets
4. **Permission checks**: Verify file and directory permissions
5. **Dependency verification**: Ensure LaTeX installation for PDF export

### Community and Documentation

- [GitHub Repository](https://github.com/unjucks/unjucks)
- [Documentation Site](https://unjucks.dev)
- [Issue Tracker](https://github.com/unjucks/unjucks/issues)
- [Examples Repository](https://github.com/unjucks/examples)

---

*This documentation covers Unjucks v2025.9.8 export capabilities. For the latest updates and features, visit the official documentation.*