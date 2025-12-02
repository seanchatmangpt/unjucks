# LaTeX Step Definitions

This directory contains comprehensive step definitions for testing LaTeX document generation functionality in the KGEN system.

## Overview

The LaTeX test suite provides complete coverage for:

1. **Academic Paper Generation** - arXiv papers, research documents, thesis formatting
2. **Bibliography Management** - BibTeX, BibLaTeX, citation formatting, reference validation
3. **Mathematical Content** - Equations, theorems, proofs, algorithms, complex notation
4. **Document Validation** - Syntax checking, structure validation, compliance testing
5. **PDF Compilation** - LaTeX compilation, error handling, output validation

## File Structure

### Core Step Definitions

- **`latex_steps.js`** - Main LaTeX document generation step definitions
  - Paper generation with various parameters
  - Document structure validation
  - Error handling and edge cases
  - Special character handling
  - Reproducibility testing

- **`validation_steps.js`** - Document validation and quality assurance
  - Structure compliance checking
  - Legal document validation
  - Performance metrics validation
  - Accessibility compliance
  - Security validation
  - Internationalization testing

- **`citation_steps.js`** - Bibliography and citation management
  - Citation search and generation
  - Bibliography formatting validation
  - Multi-language citation support
  - Citation quality assessment
  - Performance testing for large bibliographies

- **`math_steps.js`** - Mathematical content testing
  - Equation formatting and numbering
  - Theorem environments and proofs
  - Algorithm pseudocode
  - Mathematical symbol rendering
  - Cross-reference validation

### Supporting Files

- **`index.js`** - Test suite coordination and reporting
- **`fixtures/`** - Test data and sample content
  - `academic_content.json` - Academic paper templates and data
  - `sample_paper.bib` - Sample bibliography entries

## Usage

### Running LaTeX Tests

```bash
# Run all LaTeX feature tests
npm run test:latex

# Run specific LaTeX test categories
npm run test:latex:generation
npm run test:latex:validation  
npm run test:latex:citations
npm run test:latex:math
```

### Prerequisites

1. **LaTeX Installation** - Tests require a working LaTeX installation:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install texlive-full
   
   # macOS
   brew install --cask mactex
   
   # Windows
   # Install MiKTeX or TeX Live
   ```

2. **Node.js Dependencies**:
   ```bash
   npm install @cucumber/cucumber chai
   ```

3. **Environment Variables**:
   ```bash
   export SOURCE_DATE_EPOCH=1640995200  # For reproducible builds
   ```

## Step Definition Categories

### 1. Document Generation Steps

```gherkin
Given KGEN is properly configured
And LaTeX with required packages is installed
When I generate an arXiv paper with:
  | parameter | value |
  | title     | My Research Paper |
  | author    | Dr. Researcher |
Then a LaTeX file should be created at "tests/output/paper.tex"
And the file should contain "\\documentclass"
```

### 2. Mathematical Content Steps

```gherkin
Given I have a LaTeX document with mathematical content
When I add a numbered equation
And I add a theorem with proof
Then all equations should be properly formatted
And theorem environments should be properly defined
```

### 3. Citation Management Steps

```gherkin
Given I need citations for "machine learning" research
When I search for relevant citations
Then I should receive 10 relevant citations
And citations should be in "bibtex" format
And citations should include DOI when available
```

### 4. Validation Steps

```gherkin
Given I generate an arXiv paper with standard parameters
When I validate the generated LaTeX structure
Then the document should have proper LaTeX document structure:
  | element         | requirement | status |
  | documentclass   | present     | PASS   |
  | begin{document} | present     | PASS   |
```

## Test Data and Fixtures

### Academic Content (`fixtures/academic_content.json`)

Contains structured academic content including:
- Sample research papers with abstracts, sections, and metadata
- Mathematical theorems, equations, and proofs
- Legal contract templates
- Citation examples and bibliography data
- Package requirements for different document types

### Sample Bibliography (`fixtures/sample_paper.bib`)

Provides realistic bibliography entries for testing:
- Academic articles with proper metadata
- Books, conference papers, and theses
- Multi-language references
- Various citation formats and styles

## Integration with KGEN

### Template Connection

The step definitions integrate directly with KGEN's LaTeX generation system:

```javascript
const { LaTeXGenerateToolHandler } = require('../../../../src/mcp/tools/latex-tools.js');

async function generateLatexDocument(template, parameters) {
  const handler = new LaTeXGenerateToolHandler();
  return await handler.execute(generationParams);
}
```

### Validation Integration

Tests validate against actual LaTeX compilation:

```javascript
async function compileLatexDocument(texFile) {
  const handler = new LaTeXCompileToolHandler();
  return await handler.execute(compilationParams);
}
```

## Quality Assurance Features

### 1. Reproducibility Testing

- Uses `SOURCE_DATE_EPOCH` for consistent timestamps
- Validates identical outputs across multiple runs
- Checks PDF metadata consistency

### 2. Error Handling Validation

- Tests missing package detection
- Validates syntax error reporting
- Checks graceful degradation scenarios

### 3. Performance Testing

- Measures compilation times
- Tests memory usage with large documents
- Validates scalability with numerous references

### 4. Security Validation

- Tests input sanitization
- Validates path traversal protection
- Checks for code injection prevention

## Extending the Test Suite

### Adding New Step Definitions

1. Create focused step definition files for specific functionality
2. Follow the naming convention: `[category]_steps.js`
3. Include proper cleanup in `Before` and `After` hooks
4. Add comprehensive validation assertions

### Adding Test Fixtures

1. Add new test data to `fixtures/` directory
2. Use JSON format for structured data
3. Include realistic academic content
4. Provide multiple examples for edge cases

### Integration Testing

1. Test actual template rendering with real data
2. Validate complete document generation workflows
3. Include PDF compilation and output verification
4. Test cross-platform compatibility

## Troubleshooting

### Common Issues

1. **LaTeX Not Found**: Ensure LaTeX is properly installed and in PATH
2. **Permission Errors**: Check write permissions for test output directory
3. **Timeout Issues**: Increase test timeout for slow LaTeX compilation
4. **Package Missing**: Install required LaTeX packages for specialized tests

### Debug Mode

Enable debug logging:
```bash
export DEBUG_LATEX=true
npm run test:latex
```

### Test Report Generation

After test execution, check the generated report:
```bash
cat tests/features/latex/output/latex_test_report.json
```

This provides detailed information about test execution, environment, and results.