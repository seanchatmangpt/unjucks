# Unjucks Export Command Examples

## Overview

The `unjucks export` command provides comprehensive document export capabilities with support for multiple formats, templates, and presets.

## Basic Usage

### Single File Export

```bash
# Export markdown to PDF (default format)
unjucks export document.md

# Export with specific format
unjucks export document.md --format html
unjucks export document.md --format docx
unjucks export document.md --format pdf

# Export with specific output path
unjucks export document.md --output ./dist/document.pdf

# Export with template
unjucks export document.md --format html --template modern
unjucks export document.md --format pdf --template academic
```

### Subcommand Usage

```bash
# PDF export with advanced options
unjucks export pdf document.md --template academic --toc --bibliography

# DOCX export with template selection
unjucks export docx document.md --template corporate --header --footer

# HTML export with styling
unjucks export html document.md --template bootstrap --responsive
```

## Batch Export

```bash
# Export all markdown files to HTML
unjucks export "*.md" --all --format html

# Export with specific output directory
unjucks export "docs/*.md" --all --format pdf --output ./dist/

# Batch export with concurrency control
unjucks export "**/*.md" --all --format html --concurrency 5
```

## Format Conversion

```bash
# Convert LaTeX to PDF
unjucks export convert document.tex document.pdf

# Convert Markdown to DOCX
unjucks export convert document.md report.docx

# Convert with template
unjucks export convert input.md output.html --template modern
```

## Using Presets

```bash
# Use academic preset (PDF with bibliography and TOC)
unjucks export document.md --preset academic

# Use report preset (DOCX with headers/footers)
unjucks export document.md --preset report

# Use web preset (HTML with responsive design)
unjucks export document.md --preset web
```

## Advanced Options

### Template Variables

```bash
# Pass variables as JSON
unjucks export document.md --variables '{"title":"My Document","author":"John Doe"}'

# Include metadata
unjucks export document.md --metadata '{"description":"Project documentation"}'
```

### Preview Mode

```bash
# Dry run to preview what would be exported
unjucks export document.md --format pdf --dry

# Batch dry run
unjucks export "*.md" --all --format html --dry
```

### Output Control

```bash
# Force overwrite existing files
unjucks export document.md --force

# Verbose output for debugging
unjucks export document.md --format pdf --verbose

# Quiet mode (minimal output)
unjucks export document.md --quiet
```

## Available Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| PDF | .pdf | Portable Document Format (via LaTeX) |
| DOCX | .docx | Microsoft Word format |
| HTML | .html | Web page format |
| MD | .md | Markdown format |
| TEX | .tex | LaTeX source format |
| RTF | .rtf | Rich Text Format |
| TXT | .txt | Plain text format |

## Available Templates

### PDF Templates
- `academic` - Academic paper format
- `article` - Journal article format  
- `report` - Technical report format
- `book` - Book chapter format
- `slides` - Presentation slides
- `minimal` - Clean minimal format

### DOCX Templates
- `corporate` - Corporate document format
- `academic` - Academic paper format
- `modern` - Modern clean format
- `simple` - Simple document format
- `letterhead` - Letterhead format

### HTML Templates
- `modern` - Modern web styling
- `classic` - Traditional web styling
- `minimal` - Clean minimal styling
- `dark` - Dark theme styling
- `bootstrap` - Bootstrap-based styling
- `custom` - Custom CSS styling

### Markdown Templates
- `github` - GitHub-flavored markdown
- `gitlab` - GitLab-flavored markdown
- `standard` - Standard markdown
- `extended` - Extended markdown features
- `minimal` - Minimal markdown

## Export Presets

| Preset | Format | Template | Options |
|--------|--------|----------|---------|
| `academic` | PDF | academic | bibliography, toc |
| `report` | DOCX | corporate | header, footer |
| `web` | HTML | modern | responsive, css |
| `documentation` | MD | github | toc, code |
| `presentation` | PDF | slides | landscape |
| `article` | PDF | article | compact |

## Utility Commands

```bash
# List available templates
unjucks export templates

# List templates for specific format
unjucks export templates --format pdf

# List available presets
unjucks export presets

# Get help for specific subcommand
unjucks export pdf --help
unjucks export docx --help
unjucks export html --help
```

## Error Handling

The export command provides comprehensive error handling:

- **File validation**: Checks if input files exist and are readable
- **Format validation**: Ensures supported export formats
- **Template validation**: Verifies template availability for format
- **Permission checks**: Validates output directory permissions
- **Dependency checks**: Warns about missing external tools (LaTeX, etc.)

## Integration Examples

### With Build Systems

```bash
# In package.json scripts
"scripts": {
  "docs:pdf": "unjucks export \"docs/*.md\" --all --format pdf --output ./dist/docs/",
  "docs:web": "unjucks export \"docs/*.md\" --all --format html --template modern --output ./public/docs/"
}
```

### With CI/CD

```bash
# GitHub Actions example
- name: Export Documentation
  run: |
    unjucks export README.md --format pdf --output ./artifacts/
    unjucks export "docs/**/*.md" --all --format html --output ./artifacts/docs/
```

## Performance Tips

1. **Batch Processing**: Use `--all` for multiple files instead of individual commands
2. **Concurrency**: Adjust `--concurrency` based on system resources
3. **Dry Run**: Use `--dry` to preview before actual export
4. **Template Reuse**: Stick to consistent templates for faster processing
5. **Output Organization**: Use consistent output directories

## Troubleshooting

### Common Issues

1. **LaTeX not found**: Install TeX Live or MiKTeX for PDF export
2. **Permission denied**: Check write permissions for output directory
3. **Template not found**: Use `unjucks export templates` to see available options
4. **Memory issues**: Reduce `--concurrency` for large batch exports

### Debug Mode

```bash
# Enable verbose logging
unjucks export document.md --format pdf --verbose

# Check what would be exported
unjucks export document.md --format pdf --dry --verbose
```