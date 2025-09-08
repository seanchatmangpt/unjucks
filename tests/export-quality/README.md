# Export Quality Validator

A comprehensive quality assurance test suite for validating export functionality across multiple document formats including PDF, HTML, DOCX, and Markdown.

## Features

### ✅ Format-Specific Validation
- **PDF Quality Tests**: Font rendering, image handling, formatting preservation, metadata embedding
- **HTML Quality Tests**: CSS styling, JavaScript functionality, accessibility, SEO optimization
- **DOCX Compatibility**: Microsoft Word and Google Docs compatibility, formatting preservation
- **Markdown Compliance**: Syntax validation, GitHub Flavored Markdown, CommonMark compliance

### 🔄 Cross-Format Validation
- Content preservation across formats
- Metadata consistency
- Formatting equivalence analysis
- Character encoding validation
- Special content handling

### ⚡ Performance Testing
- Processing speed analysis
- Memory usage optimization
- Concurrent processing tests
- File size optimization

### 📊 Comprehensive Reporting
- Detailed validation reports
- Format comparison analysis
- Executive summaries
- Performance metrics
- Quality grades and recommendations

## Installation

```bash
# Install dependencies (from the main project root)
npm install

# Or install just for this test suite
cd tests/export-quality
npm install
```

## Usage

### Basic Usage

```bash
# Run all export quality tests
node run-export-quality-tests.js

# Or using npm scripts
npm test
```

### Format-Specific Testing

```bash
# Test only PDF export quality
npm run test:pdf

# Test only HTML export quality
npm run test:html

# Test only DOCX export quality
npm run test:docx

# Test only Markdown export quality
npm run test:markdown
```

### Test Configuration Options

```bash
# Skip specific formats
node run-export-quality-tests.js --no-pdf --no-docx

# Run quick tests (skip performance and cross-format)
npm run test:quick

# Verbose output for debugging
npm run test:verbose

# Custom output directory
node run-export-quality-tests.js --output ./my-test-results

# Get help
npm run help
```

### Command Line Options

| Option | Description |
|--------|-------------|
| `--help`, `-h` | Show help message |
| `--verbose`, `-v` | Enable verbose output |
| `--output`, `-o <dir>` | Specify output directory |
| `--no-pdf` | Skip PDF quality tests |
| `--no-html` | Skip HTML quality tests |
| `--no-docx` | Skip DOCX quality tests |
| `--no-markdown` | Skip Markdown quality tests |
| `--only-pdf` | Run only PDF tests |
| `--only-html` | Run only HTML tests |
| `--only-docx` | Run only DOCX tests |
| `--only-markdown` | Run only Markdown tests |
| `--no-cross-format` | Skip cross-format validation |
| `--no-performance` | Skip performance tests |
| `--no-comparison` | Skip comparison report generation |

## Test Categories

### 1. PDF Quality Validation
- **Font Handling**: Default fonts, font styles, font sizes
- **Image Quality**: Image embedding, compression, positioning, captions
- **Document Structure**: Page margins, headers, footers, page breaks
- **Table Formatting**: Border styles, cell alignment, column widths
- **Code Blocks**: Syntax highlighting, formatting preservation
- **Metadata**: Document properties, author info, creation dates
- **Performance**: Generation speed, file size optimization
- **Compatibility**: PDF reader compatibility, print quality

### 2. HTML Quality Validation
- **HTML Structure**: Valid markup, semantic elements, accessibility
- **CSS Generation**: Responsive design, print styles, cross-browser compatibility
- **JavaScript Functionality**: DOM manipulation, event handling, performance
- **SEO Optimization**: Meta tags, structured data, header hierarchy
- **Accessibility**: ARIA labels, alt text, keyboard navigation
- **Cross-Platform**: Mobile compatibility, various browsers

### 3. DOCX Quality Validation
- **Microsoft Word Compatibility**: Style preservation, formatting consistency
- **Google Docs Integration**: Import/export compatibility, collaborative features
- **Document Elements**: Tables, images, lists, headers
- **Metadata Embedding**: Document properties, custom fields
- **Style Consistency**: Heading hierarchy, paragraph formatting
- **File Structure**: Valid OOXML structure, relationships

### 4. Markdown Quality Validation
- **Syntax Compliance**: CommonMark standard, GitHub Flavored Markdown
- **Formatting Elements**: Headers, lists, code blocks, tables
- **Link Validation**: Internal links, external links, reference links
- **Image Handling**: Image syntax, alt text, captions
- **Cross-Platform Compatibility**: Line endings, character encoding
- **Metadata Support**: YAML frontmatter validation

## Reports Generated

### Main Reports
- `export-quality-comprehensive-report.json` - Complete test results
- `format-comparison-report.json` - Format performance comparison
- `executive-summary.json` - High-level summary for stakeholders

### Format-Specific Reports
- `pdf-quality-validation-report.json` - PDF-specific test results
- `html-quality-validation-report.json` - HTML-specific test results
- `docx-quality-validation-report.json` - DOCX-specific test results
- `markdown-quality-validation-report.json` - Markdown-specific test results

### Sample Output Structure

```json
{
  "summary": {
    "overall": {
      "totalTests": 150,
      "passed": 142,
      "failed": 3,
      "warnings": 5,
      "successRate": 97.9,
      "qualityGrade": "A"
    }
  },
  "formatResults": {
    "pdf": { "passed": 35, "failed": 1, "warnings": 2 },
    "html": { "passed": 38, "failed": 0, "warnings": 1 },
    "docx": { "passed": 34, "failed": 1, "warnings": 1 },
    "markdown": { "passed": 35, "failed": 1, "warnings": 1 }
  },
  "recommendations": [
    "Address PDF font rendering issue",
    "Improve DOCX table formatting",
    "Enhance Markdown syntax validation"
  ]
}
```

## Quality Grades

The test suite assigns quality grades based on overall performance:

- **A+** (95-100%): Exceptional quality, production-ready
- **A** (90-94%): Excellent quality, minor issues
- **A-** (85-89%): Good quality, some improvements needed
- **B+** (80-84%): Acceptable quality, several issues to address
- **B** (75-79%): Fair quality, significant improvements needed
- **C** (60-74%): Poor quality, major issues present
- **D/F** (<60%): Unacceptable quality, extensive work required

## Integration

### CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
- name: Run Export Quality Tests
  run: |
    cd tests/export-quality
    npm test
  continue-on-error: true
```

### Custom Validation

You can extend the test suite with custom validators:

```javascript
import ExportQualityTestSuite from './export-quality-test-suite.js';

const customSuite = new ExportQualityTestSuite({
  enableCustomTests: true,
  customValidators: {
    'custom-format': new CustomFormatValidator()
  }
});

const results = await customSuite.runComprehensiveValidation();
```

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure write permissions in the output directory
2. **Memory Issues**: Use `--no-performance` for large document sets
3. **Dependency Issues**: Run `npm install` to ensure all dependencies are available
4. **Node Version**: Requires Node.js 18+

### Debug Mode

```bash
# Enable verbose output for debugging
node run-export-quality-tests.js --verbose

# Test individual components
npm run test:pdf --verbose
```

## Contributing

To add new export formats or improve existing validators:

1. Create a new validator class following the existing pattern
2. Implement the required validation methods
3. Add the validator to the main test suite
4. Update documentation and tests

## License

MIT License - see the main project license for details.