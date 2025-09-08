# Cleanroom Testing Protocol for Export Functionality

## Overview

This document outlines the cleanroom testing protocol for Unjucks export functionality, ensuring reliable and consistent export operations across different environments and configurations.

## Testing Methodology

### Cleanroom Environment Setup

A cleanroom environment is an isolated, controlled testing environment that eliminates external dependencies and variables to ensure consistent, reproducible test results.

#### Environment Isolation

```bash
# Create isolated test environment
mkdir -p /tmp/unjucks-cleanroom
cd /tmp/unjucks-cleanroom

# Clean Node.js environment
export NODE_ENV=test
unset NODE_PATH
unset npm_config_prefix

# Isolated npm cache
export npm_config_cache=/tmp/unjucks-cleanroom/.npm

# Clean PATH for testing
export PATH="/usr/local/bin:/usr/bin:/bin"
```

#### Dependency Isolation

```bash
# Install Unjucks in isolation
npm init -y
npm install @seanchatmangpt/unjucks

# Verify clean installation
npx unjucks --version
npx unjucks export --help
```

## Core Export Testing Protocol

### Phase 1: Basic Functionality Tests

#### Test 1.1: Command Availability
```bash
# Test: Command registration
npx unjucks export --help
# Expected: Help output with all options and subcommands

# Test: Version compatibility  
npx unjucks --version
# Expected: Current version number

# Test: Subcommand availability
npx unjucks export pdf --help
npx unjucks export docx --help
npx unjucks export html --help
# Expected: Format-specific help for each subcommand
```

#### Test 1.2: Template and Preset Discovery
```bash
# Test: Template listing
npx unjucks export templates
# Expected: Complete list of templates by format

# Test: Format-specific templates
npx unjucks export templates --format pdf
# Expected: PDF templates only (academic, article, report, book, slides, minimal)

# Test: Preset discovery
npx unjucks export presets
# Expected: All predefined presets with descriptions
```

### Phase 2: Input Validation Tests

#### Test 2.1: File Input Validation
```bash
# Create test document
echo "# Test Document\n\nThis is a test." > test-doc.md

# Test: Basic file input
npx unjucks export test-doc.md --format html --dry
# Expected: Success with output path preview

# Test: Non-existent file
npx unjucks export non-existent.md --format pdf --dry
# Expected: Error with helpful message

# Test: Invalid format
npx unjucks export test-doc.md --format xyz --dry  
# Expected: Format validation error with supported formats list
```

#### Test 2.2: Template Validation
```bash
# Test: Valid template
npx unjucks export test-doc.md --format pdf --template academic --dry
# Expected: Success with template application

# Test: Invalid template for format
npx unjucks export test-doc.md --format pdf --template invalid --dry
# Expected: Template validation error with available options

# Test: Template-format mismatch
npx unjucks export test-doc.md --format html --template academic --dry
# Expected: Either error or fallback to compatible template
```

### Phase 3: Export Format Tests

#### Test 3.1: HTML Export
```bash
# Test: Basic HTML export
npx unjucks export test-doc.md --format html
# Expected: HTML file created with proper structure

# Verification: HTML structure
if [ -f test-doc.html ]; then
  grep -q "<!DOCTYPE html>" test-doc.html && echo "✓ DOCTYPE found"
  grep -q "<title>" test-doc.html && echo "✓ Title found"
  grep -q "Test Document" test-doc.html && echo "✓ Content found"
fi

# Test: HTML with template
npx unjucks export test-doc.md --format html --template modern
# Expected: Styled HTML with modern template

# Test: Responsive HTML
npx unjucks export test-doc.md --format html --template modern --responsive
# Expected: HTML with responsive CSS
```

#### Test 3.2: PDF Export (LaTeX)
```bash
# Test: PDF export (creates .tex if LaTeX not available)
npx unjucks export test-doc.md --format pdf
# Expected: .tex file created (or .pdf if LaTeX installed)

# Verification: LaTeX structure
if [ -f test-doc.tex ]; then
  grep -q "\\documentclass" test-doc.tex && echo "✓ Document class found"
  grep -q "\\begin{document}" test-doc.tex && echo "✓ Document begin found"  
  grep -q "Test Document" test-doc.tex && echo "✓ Content found"
  grep -q "\\end{document}" test-doc.tex && echo "✓ Document end found"
fi

# Test: PDF with academic template
npx unjucks export test-doc.md --format pdf --template academic
# Expected: Academic-style LaTeX output
```

#### Test 3.3: DOCX Export
```bash
# Test: DOCX export
npx unjucks export test-doc.md --format docx
# Expected: DOCX-compatible XML file

# Verification: DOCX structure
if [ -f test-doc.docx ]; then
  file test-doc.docx | grep -q "XML" && echo "✓ XML structure found"
  grep -q "Test Document" test-doc.docx && echo "✓ Content found"
fi

# Test: DOCX with corporate template
npx unjucks export test-doc.md --format docx --template corporate --header --footer
# Expected: Corporate-styled DOCX with headers/footers
```

#### Test 3.4: Other Formats
```bash
# Test: Markdown export
npx unjucks export test-doc.md --format md
# Expected: Processed markdown file

# Test: LaTeX export
npx unjucks export test-doc.md --format tex
# Expected: LaTeX source file

# Test: RTF export  
npx unjucks export test-doc.md --format rtf
# Expected: RTF formatted file

# Test: Plain text export
npx unjucks export test-doc.md --format txt
# Expected: Clean plain text file
```

### Phase 4: Advanced Feature Tests

#### Test 4.1: Template Variables
```bash
# Test: Variable injection
npx unjucks export test-doc.md --format html --variables '{"title":"Custom Title","author":"Test Author"}'
# Expected: Variables applied in output

# Create template with variables
echo "# {{ title }}\n\nBy {{ author }}\n\n{{ content }}" > variable-test.md

# Test: Complex variables
npx unjucks export variable-test.md --format html --variables '{
  "title":"Advanced Test",
  "author":"Cleanroom Test",
  "content":"This tests variable substitution."
}'
# Expected: All variables substituted correctly
```

#### Test 4.2: Metadata Processing
```bash
# Test: Metadata inclusion
npx unjucks export test-doc.md --format html --metadata '{
  "description":"Test document for cleanroom testing",
  "keywords":["test","export","cleanroom"],
  "language":"en-US"
}'
# Expected: Metadata included in output format
```

#### Test 4.3: Batch Processing
```bash
# Create multiple test files
echo "# Document 1\n\nFirst test document." > doc1.md
echo "# Document 2\n\nSecond test document." > doc2.md  
echo "# Document 3\n\nThird test document." > doc3.md

# Test: Batch export
npx unjucks export "doc*.md" --all --format html
# Expected: All matching files exported

# Verification: Batch results
for file in doc1.html doc2.html doc3.html; do
  [ -f "$file" ] && echo "✓ $file created" || echo "✗ $file missing"
done

# Test: Batch with concurrency
npx unjucks export "doc*.md" --all --format html --concurrency 2
# Expected: Concurrent processing with specified limit
```

### Phase 5: Error Handling Tests

#### Test 5.1: Graceful Failure
```bash
# Test: Invalid JSON variables
npx unjucks export test-doc.md --format html --variables '{invalid json}'
# Expected: Warning about invalid JSON, continues with default

# Test: Invalid JSON metadata
npx unjucks export test-doc.md --format html --metadata '{invalid json}'
# Expected: Warning about invalid JSON, continues with default

# Test: Output permission error
sudo mkdir -p /root/restricted && sudo chmod 000 /root/restricted
npx unjucks export test-doc.md --format html --output /root/restricted/test.html 2>/dev/null
# Expected: Permission error with helpful message
```

#### Test 5.2: Resource Exhaustion
```bash
# Test: Large batch processing
for i in {1..100}; do
  echo "# Document $i\n\nContent for document $i." > "large-doc-$i.md"
done

# Test: High concurrency handling
timeout 30s npx unjucks export "large-doc-*.md" --all --format html --concurrency 50
# Expected: Either completes or fails gracefully without hanging

# Cleanup
rm -f large-doc-*.md large-doc-*.html
```

### Phase 6: Integration Tests

#### Test 6.1: Format Conversion
```bash
# Test: Basic conversion
npx unjucks export convert test-doc.md test-doc.html
# Expected: Conversion from MD to HTML

# Test: Multi-step conversion
npx unjucks export convert test-doc.md intermediate.tex
npx unjucks export convert intermediate.tex final.html
# Expected: Chain conversion works

# Verification: Conversion fidelity
grep -q "Test Document" final.html && echo "✓ Content preserved in conversion"
```

#### Test 6.2: Preset Usage
```bash
# Test: Academic preset
npx unjucks export test-doc.md --preset academic
# Expected: PDF output with academic formatting

# Test: Web preset  
npx unjucks export test-doc.md --preset web
# Expected: HTML output with responsive design

# Test: Report preset
npx unjucks export test-doc.md --preset report
# Expected: DOCX output with corporate formatting
```

## Performance Testing

### Benchmark Tests

#### Test P.1: Single File Performance
```bash
# Create large test document
python3 -c "
content = '# Large Document\\n\\n' + '## Section {0}\\n\\nContent for section {0}.\\n\\n' * 1000
with open('large-doc.md', 'w') as f: f.write(content.format(*range(1000)))
"

# Benchmark: HTML export
time npx unjucks export large-doc.md --format html
# Expected: Completes within reasonable time (< 10s)

# Benchmark: PDF export  
time npx unjucks export large-doc.md --format pdf
# Expected: Completes within reasonable time (< 30s)
```

#### Test P.2: Batch Performance
```bash
# Create medium-sized documents
for i in {1..20}; do
  python3 -c "
content = '# Document $i\\n\\n' + '## Section {0}\\n\\nContent for section {0}.\\n\\n' * 50
with open('perf-doc-$i.md', 'w') as f: f.write(content.format(*range(50)))
  " 
done

# Benchmark: Batch processing
time npx unjucks export "perf-doc-*.md" --all --format html --concurrency 3
# Expected: Reasonable throughput (all files < 30s)

# Cleanup
rm -f large-doc.* perf-doc-*.*
```

## Memory and Resource Testing

### Test R.1: Memory Usage
```bash
# Test: Memory consumption monitoring
(npx unjucks export test-doc.md --format pdf --verbose) &
PID=$!

# Monitor memory usage
while ps -p $PID > /dev/null; do
  ps -p $PID -o pid,vsz,rss,pmem | tail -1
  sleep 1
done

# Expected: Memory usage remains reasonable (< 500MB for simple documents)
```

### Test R.2: File Handle Management
```bash
# Test: File descriptor leaks
ulimit -n 100  # Limit file descriptors

# This should not fail due to file descriptor exhaustion
npx unjucks export "doc*.md" --all --format html --concurrency 5
# Expected: Completes successfully without file descriptor issues

# Reset ulimit
ulimit -n 1024
```

## Cross-Platform Testing

### Test CP.1: Path Handling
```bash
# Test: Various path formats
npx unjucks export "./test-doc.md" --format html --output "./output/test.html"
npx unjucks export "test-doc.md" --format html --output "test-output.html"

# Test: Absolute paths
FULL_PATH=$(pwd)/test-doc.md
npx unjucks export "$FULL_PATH" --format html

# Expected: All path formats work correctly
```

### Test CP.2: Character Encoding
```bash
# Test: Unicode content
echo "# 测试文档 📄\n\n这是一个包含中文和表情符号的测试。\n\n日本語: こんにちは" > unicode-test.md

# Test: Unicode export
npx unjucks export unicode-test.md --format html
npx unjucks export unicode-test.md --format pdf

# Verification: Unicode preservation
grep -q "测试文档" unicode-test.html && echo "✓ Chinese characters preserved"
grep -q "📄" unicode-test.html && echo "✓ Emoji preserved"

# Cleanup
rm -f unicode-test.*
```

## Validation and Verification

### Output Validation

#### HTML Validation
```bash
# Install validator if available
which html5validator > /dev/null || echo "html5validator not available, skipping validation"

# Validate HTML output
if command -v html5validator; then
  npx unjucks export test-doc.md --format html
  html5validator test-doc.html && echo "✓ Valid HTML5"
fi
```

#### LaTeX Validation
```bash
# Validate LaTeX syntax
npx unjucks export test-doc.md --format tex

if command -v chktex; then
  chktex test-doc.tex && echo "✓ Valid LaTeX syntax"
fi
```

### Content Integrity
```bash
# Test: Content preservation
ORIGINAL_CONTENT=$(grep -o "Test Document" test-doc.md)
HTML_CONTENT=$(grep -o "Test Document" test-doc.html)

[ "$ORIGINAL_CONTENT" = "$HTML_CONTENT" ] && echo "✓ Content integrity maintained"
```

## Automated Test Suite

### Complete Test Runner
```bash
#!/bin/bash
# cleanroom-test-runner.sh

set -e

echo "🧪 Starting Unjucks Export Cleanroom Testing"
echo "============================================="

# Phase 1: Basic functionality
echo "Phase 1: Basic Functionality Tests"
npx unjucks export --help > /dev/null && echo "✓ Help command works"
npx unjucks export templates > /dev/null && echo "✓ Templates command works"
npx unjucks export presets > /dev/null && echo "✓ Presets command works"

# Phase 2: Export formats
echo "Phase 2: Export Format Tests"
echo "# Test Document\n\nThis is a test." > test-doc.md

npx unjucks export test-doc.md --format html && echo "✓ HTML export works"
npx unjucks export test-doc.md --format pdf && echo "✓ PDF export works"
npx unjucks export test-doc.md --format docx && echo "✓ DOCX export works"
npx unjucks export test-doc.md --format md && echo "✓ MD export works"

# Phase 3: Advanced features
echo "Phase 3: Advanced Feature Tests"
npx unjucks export test-doc.md --format html --variables '{"title":"Test"}' && echo "✓ Variables work"
npx unjucks export test-doc.md --preset academic && echo "✓ Presets work"

# Phase 4: Batch processing
echo "Phase 4: Batch Processing Tests"
echo "# Doc 1" > doc1.md
echo "# Doc 2" > doc2.md
npx unjucks export "doc*.md" --all --format html && echo "✓ Batch export works"

# Phase 5: Error handling
echo "Phase 5: Error Handling Tests"
npx unjucks export non-existent.md --format pdf 2>/dev/null || echo "✓ Handles missing files"
npx unjucks export test-doc.md --format invalid 2>/dev/null || echo "✓ Handles invalid formats"

# Cleanup
rm -f test-doc.* doc*.* *.html *.pdf *.docx *.tex *.rtf *.txt

echo "============================================="
echo "✅ Cleanroom testing completed successfully"
```

## Test Results Documentation

### Test Report Template
```markdown
# Cleanroom Test Report

## Environment
- Node.js Version: $(node --version)
- Unjucks Version: $(npx unjucks --version)
- Operating System: $(uname -a)
- Test Date: $(date)

## Test Results
- Basic Functionality: [PASS/FAIL]
- Export Formats: [PASS/FAIL] 
- Advanced Features: [PASS/FAIL]
- Batch Processing: [PASS/FAIL]
- Error Handling: [PASS/FAIL]
- Performance: [PASS/FAIL]

## Issues Found
[List any issues discovered during testing]

## Recommendations
[Any recommendations for improvements]
```

### Continuous Testing

```bash
# Set up automated cleanroom testing
crontab -e
# Add: 0 2 * * * /path/to/cleanroom-test-runner.sh > /tmp/cleanroom-test-$(date +\%Y\%m\%d).log 2>&1
```

## Conclusion

This cleanroom testing protocol ensures that Unjucks export functionality works reliably across different environments and configurations. Regular execution of these tests helps maintain quality and catch regressions early in the development cycle.

The protocol covers:
- ✅ Basic functionality verification
- ✅ All supported export formats
- ✅ Advanced features and edge cases
- ✅ Performance and resource usage
- ✅ Error handling and recovery
- ✅ Cross-platform compatibility

For automated testing integration, use the provided test runner script and adapt it to your CI/CD pipeline requirements.