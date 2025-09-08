# Microsoft Word (DOCX) Export

Unjucks provides comprehensive Microsoft Word document generation capabilities through multiple export methods and extensive template support.

## Features

- **Multiple Export Methods**: Direct DOCX generation, Pandoc integration, and template-based generation
- **Professional Templates**: Pre-built templates for legal contracts, academic papers, and business reports
- **Theme Support**: Professional, academic, legal, and modern document themes
- **Format Conversion**: Convert from HTML, LaTeX, Markdown, and Nunjucks templates
- **Advanced Formatting**: Tables, images, headers, footers, and complex document structures
- **Batch Processing**: Export multiple documents with concurrent processing
- **Style Management**: Consistent formatting with customizable themes and styles

## Quick Start

### Basic Usage

```bash
# Export HTML to DOCX
unjucks export-docx --input document.html --output report

# Use a template with data
unjucks export-docx --template academic-paper --data paper.json --output research-paper

# Convert Markdown with academic theme
unjucks export-docx --input paper.md --format markdown --theme academic --output thesis
```

### Available Templates

| Template | Description | Use Case |
|----------|-------------|-----------|
| `legal-contract` | Professional legal document template | Contracts, agreements, legal documents |
| `academic-paper` | Standard academic paper with citations | Research papers, theses, academic articles |
| `business-report` | Professional business report template | Company reports, financial documents, presentations |

### Supported Input Formats

- **HTML**: Web content with styling
- **LaTeX**: Mathematical documents with complex formatting  
- **Markdown**: Simple markup with automatic formatting
- **Nunjucks**: Template files with variables and logic
- **Structured**: JSON-based document definitions
- **Auto**: Automatic format detection

### Document Themes

- **Professional**: Modern business theme (default)
- **Academic**: Formal academic styling with Times New Roman
- **Legal**: Traditional legal document formatting
- **Modern**: Contemporary design with clean typography

## Installation Requirements

### Core Dependencies
```bash
npm install docx  # For direct DOCX generation
```

### Optional Dependencies
```bash
# Install Pandoc for enhanced conversion capabilities
# macOS
brew install pandoc

# Ubuntu/Debian
sudo apt-get install pandoc

# Windows
# Download from https://pandoc.org/installing.html
```

## Advanced Usage

### Template-Based Generation

Create custom templates in `templates/docx/`:

```nunjucks
{# my-template.njk #}
[
  {
    "type": "heading",
    "level": 1,
    "text": "{{ title }}"
  },
  {
    "type": "paragraph", 
    "text": "{{ content }}"
  }
]
```

Use the template:

```bash
unjucks export-docx --template my-template --data data.json --output custom-doc
```

### Batch Export

Create a batch configuration file:

```json
{
  "concurrency": 3,
  "documents": [
    {
      "content": "<h1>Document 1</h1><p>Content here</p>",
      "filename": "doc1",
      "format": "html",
      "theme": "professional"
    },
    {
      "template": "academic-paper",
      "data": { "title": "Research Paper", "author": "John Doe" },
      "filename": "research"
    }
  ]
}
```

Execute batch export:

```bash
unjucks export-docx --batch batch-config.json --verbose
```

### Custom Styling

Apply custom themes and formatting:

```bash
# Use predefined themes
unjucks export-docx --input content.html --theme academic --output formal-doc

# Custom theme configuration (via template data)
unjucks export-docx --template custom --data theme-config.json --output styled-doc
```

## CLI Reference

### Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--input, -i` | Input file or content | - |
| `--template, -t` | Template name | - |
| `--output, -o` | Output filename (no extension) | document |
| `--format, -f` | Input format | auto |
| `--theme` | Document theme | professional |
| `--data, -d` | JSON data file for templates | - |
| `--template-dir` | Template directory | ./templates/docx |
| `--output-dir` | Output directory | ./output |
| `--use-pandoc` | Enable Pandoc integration | true |
| `--dry-run` | Preview without creating files | false |
| `--batch` | Batch configuration file | - |
| `--list` | List available templates | false |
| `--validate` | Validate template | - |
| `--verbose, -v` | Detailed output | false |

### Examples

```bash
# List available templates
unjucks export-docx --list

# Validate a template
unjucks export-docx --validate academic-paper

# Convert LaTeX with Pandoc
unjucks export-docx --input paper.tex --format latex --use-pandoc --output dissertation

# Preview generation
unjucks export-docx --template business-report --data report.json --dry-run

# Verbose batch processing
unjucks export-docx --batch reports.json --verbose --output-dir ./generated-docs
```

## Template Development

### Template Structure

Templates use Nunjucks syntax to generate structured document definitions:

```nunjucks
[
  {
    "type": "heading",
    "level": 1,
    "text": "{{ title | default('Document Title') }}"
  },
  {% for section in sections %}
  {
    "type": "heading", 
    "level": 2,
    "text": "{{ section.title }}"
  },
  {
    "type": "paragraph",
    "text": "{{ section.content }}"
  },
  {% endfor %}
  {% if table %}
  {
    "type": "table",
    "headers": {{ table.headers | dump }},
    "rows": {{ table.rows | dump }}
  }
  {% endif %}
]
```

### Built-in Filters

Templates have access to formatting filters:

```nunjucks
{{ text | bold }}           <!-- Bold formatting -->
{{ text | italic }}         <!-- Italic formatting --> 
{{ date | dateFormat }}     <!-- Date formatting -->
{{ number | currency }}     <!-- Currency formatting -->
{{ items | join(', ') }}    <!-- Array joining -->
{{ text | truncate(100) }}  <!-- Text truncation -->
```

### Document Elements

Support for rich document elements:

```json
{
  "type": "paragraph",
  "text": "Content with formatting",
  "runs": [
    { "text": "Bold text", "bold": true },
    { "text": " and ", "italic": false },
    { "text": "colored text", "color": "0000FF" }
  ]
}
```

```json
{
  "type": "table",
  "headers": ["Column 1", "Column 2"],
  "rows": [["Data 1", "Data 2"]],
  "borders": true
}
```

```json
{
  "type": "image",
  "path": "/path/to/image.png",
  "width": 400,
  "height": 300,
  "alignment": "center"
}
```

## Integration

### Programmatic Usage

```javascript
import { quickExport, createDocument } from './src/lib/export/index.js';

// Quick export
const result = await quickExport(htmlContent, {
  filename: 'document',
  format: 'html',
  theme: 'professional'
});

// Template-based generation
const contractResult = await createDocument('legal-contract', {
  title: 'Service Agreement',
  parties: [/* party data */],
  terms: [/* contract terms */]
}, {
  filename: 'service-contract'
});
```

### API Integration

The DOCX export system provides a clean API for integration with other tools:

```javascript
import { DocxExporter } from './src/lib/export/docx-exporter.js';

const exporter = new DocxExporter({
  outputDir: './output',
  enablePandoc: true
});

await exporter.initialize();

const result = await exporter.export(content, {
  filename: 'document',
  format: 'html',
  theme: 'academic'
});
```

## Troubleshooting

### Common Issues

**Pandoc not found**
```bash
# Install Pandoc for enhanced conversion
brew install pandoc  # macOS
sudo apt-get install pandoc  # Ubuntu
```

**docx library missing**
```bash
npm install docx
```

**Template validation errors**
```bash
# Validate template syntax
unjucks export-docx --validate my-template

# Check template directory
unjucks export-docx --list
```

**Permission errors**
```bash
# Ensure output directory is writable
mkdir -p ./output
chmod 755 ./output
```

### Performance Tips

- Use `--batch` for multiple documents
- Enable template caching for repeated generations
- Use Pandoc for complex format conversions
- Optimize image sizes for faster processing

## Examples Repository

Complete examples are available in `examples/docx-export/`:

- `academic-paper-data.json` - Academic paper template data
- `business-report-data.json` - Business report template data
- `batch-export-config.json` - Batch processing configuration

## Contributing

Template contributions and feature requests are welcome! See the main repository for contribution guidelines.

## License

MIT License - see LICENSE file for details.