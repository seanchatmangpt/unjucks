# Migration Guide: Moving to Unjucks Export

## Overview

This guide provides comprehensive instructions for migrating from other document generation and export tools to Unjucks, including Pandoc, LaTeX workflows, Word automation, and other template-based systems.

## Migration from Pandoc

### Common Pandoc to Unjucks Conversions

#### Basic Document Conversion

**Pandoc:**
```bash
# Basic conversion
pandoc document.md -o document.pdf

# With template
pandoc document.md --template=academic.latex -o document.pdf

# With variables
pandoc document.md -V title="My Document" -V author="John Doe" -o document.pdf

# Batch conversion
for file in *.md; do
  pandoc "$file" -o "${file%.md}.pdf"
done
```

**Unjucks Equivalent:**
```bash
# Basic conversion
unjucks export document.md --format pdf

# With template
unjucks export document.md --format pdf --template academic

# With variables
unjucks export document.md --format pdf --variables '{
  "title": "My Document", 
  "author": "John Doe"
}'

# Batch conversion
unjucks export "*.md" --all --format pdf
```

#### Format-Specific Migrations

**HTML Generation:**
```bash
# Pandoc
pandoc document.md -s --css=style.css -o document.html

# Unjucks
unjucks export document.md --format html --template modern --css
```

**DOCX Generation:**
```bash
# Pandoc
pandoc document.md --reference-doc=template.docx -o document.docx

# Unjucks
unjucks export document.md --format docx --template corporate
```

### Template Migration

#### Pandoc Template Structure
```latex
% Pandoc LaTeX template
\documentclass{$documentclass$}
\title{$title$}
\author{$author$}
\begin{document}
\maketitle
$body$
\end{document}
```

#### Unjucks Template Structure
```markdown
---
title: "{{ title }}"
author: "{{ author }}"
template: academic
format: pdf
---

# {{ title }}

By {{ author }}

{{ content }}
```

### Variable Mapping

| Pandoc Variables | Unjucks Variables |
|------------------|-------------------|
| `$title$` | `{{ title }}` |
| `$author$` | `{{ author }}` |
| `$date$` | `{{ date }}` |
| `$body$` | `{{ content }}` |
| `$toc$` | `--toc` flag |
| `$bibliography$` | `--bibliography` flag |

### Migration Script for Pandoc Users

```bash
#!/bin/bash
# pandoc-to-unjucks-migration.sh

# Convert Pandoc commands to Unjucks equivalents
migrate_pandoc_command() {
  local pandoc_cmd="$1"
  
  # Extract input file
  input=$(echo "$pandoc_cmd" | grep -o '\w\+\.md')
  
  # Extract output format
  if echo "$pandoc_cmd" | grep -q '\.pdf'; then
    format="pdf"
  elif echo "$pandoc_cmd" | grep -q '\.html'; then
    format="html"
  elif echo "$pandoc_cmd" | grep -q '\.docx'; then
    format="docx"
  fi
  
  # Extract variables
  variables=$(echo "$pandoc_cmd" | grep -o -- '-V [^=]\+="[^"]*"' | \
    sed 's/-V //' | sed 's/=/":"/g' | sed 's/^/{"/' | sed 's/$/"}/' | \
    tr '\n' ',' | sed 's/,$//' | sed 's/}{/,/g')
  
  # Build Unjucks command
  unjucks_cmd="unjucks export $input --format $format"
  
  if [ -n "$variables" ]; then
    unjucks_cmd="$unjucks_cmd --variables '{$variables}'"
  fi
  
  echo "Pandoc: $pandoc_cmd"
  echo "Unjucks: $unjucks_cmd"
  echo "---"
}

# Example usage
migrate_pandoc_command 'pandoc document.md -V title="My Doc" -V author="Me" -o document.pdf'
```

## Migration from LaTeX Workflows

### Direct LaTeX to Unjucks

**Traditional LaTeX Workflow:**
```bash
# Manual LaTeX compilation
pdflatex document.tex
bibtex document.aux
pdflatex document.tex
pdflatex document.tex

# With Makefile
make document.pdf
```

**Unjucks Workflow:**
```bash
# Direct from Markdown
unjucks export document.md --format pdf --template academic --bibliography

# Or from existing LaTeX
unjucks export convert document.tex document.pdf
```

### LaTeX Template Migration

#### Traditional LaTeX Structure
```latex
\documentclass[12pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[margin=1in]{geometry}
\usepackage{amsmath}
\usepackage{natbib}

\title{My Document}
\author{John Doe}
\date{\today}

\begin{document}
\maketitle
\tableofcontents
\newpage

\section{Introduction}
Content here...

\bibliography{references}
\bibliographystyle{plain}
\end{document}
```

#### Unjucks Markdown + Frontmatter
```markdown
---
title: "My Document"
author: "John Doe"
date: "today"
template: academic
format: pdf
toc: true
bibliography: references.bib
---

# Introduction

Content here...
```

### Academic Workflow Migration

**Before (LaTeX):**
```bash
# Compile thesis
cd thesis/
pdflatex main.tex
bibtex main.aux
pdflatex main.tex
pdflatex main.tex

# Handle errors manually
# Fix bibliography issues
# Recompile multiple times
```

**After (Unjucks):**
```bash
# Compile thesis
unjucks export thesis.md --format pdf --template academic --toc --bibliography

# Or with preset
unjucks export thesis.md --preset academic
```

## Migration from Microsoft Word

### Word Automation to Unjucks

**VBA/Word Automation:**
```vba
' VBA macro for document generation
Sub GenerateDocument()
    Dim doc As Document
    Set doc = Documents.Add("template.dotx")
    doc.ContentControls("Title").Range.Text = "My Document"
    doc.ContentControls("Author").Range.Text = "John Doe"
    doc.ExportAsFixedFormat "output.pdf", wdExportDocumentFormat:=wdExportFormatPDF
End Sub
```

**Unjucks Equivalent:**
```bash
unjucks export document.md --format docx --template corporate --variables '{
  "title": "My Document",
  "author": "John Doe"
}'

# Convert to PDF if needed
unjucks export document.md --format pdf --template corporate --variables '{
  "title": "My Document", 
  "author": "John Doe"
}'
```

### Word Template Migration

**Word Template (.dotx):**
- Content controls: `{{Title}}`, `{{Author}}`
- Styles and formatting
- Headers/footers
- Page layouts

**Unjucks Template:**
```markdown
---
title: "{{ title }}"
author: "{{ author }}"
template: corporate
format: docx
header: true
footer: true
---

# {{ title }}

**Author:** {{ author }}

{{ content }}
```

## Migration from Other Tools

### Hugo/Jekyll to Unjucks

**Hugo/Jekyll:**
```yaml
# Front matter
---
title: "My Post"
author: "John Doe"
date: 2025-01-15
layout: post
---

Content here...
```

**Unjucks:**
```markdown
---
title: "My Post"
author: "John Doe" 
date: "2025-01-15"
template: modern
format: html
---

# {{ title }}

**By {{ author }}** | {{ date }}

{{ content }}
```

### Sphinx to Unjucks

**Sphinx Documentation:**
```python
# conf.py
project = 'My Project'
author = 'John Doe'
html_theme = 'sphinx_rtd_theme'
```

**Unjucks Documentation:**
```bash
# Generate documentation
unjucks export "docs/**/*.md" --all --format html --template modern --output ./build/html/

# Or with preset
unjucks export "docs/**/*.md" --all --preset documentation
```

### GitBook to Unjucks

**GitBook:**
```json
{
  "title": "My Book",
  "author": "John Doe", 
  "structure": {
    "readme": "README.md",
    "summary": "SUMMARY.md"
  }
}
```

**Unjucks:**
```bash
# Generate book
unjucks export "*.md" --all --format pdf --template book --toc --variables '{
  "title": "My Book",
  "author": "John Doe"
}'
```

## Automated Migration Tools

### Migration Script Generator

```bash
#!/bin/bash
# generate-migration-script.sh

create_migration_script() {
  local source_tool="$1"
  local project_dir="$2"
  
  case "$source_tool" in
    "pandoc")
      generate_pandoc_migration "$project_dir"
      ;;
    "latex")
      generate_latex_migration "$project_dir" 
      ;;
    "word")
      generate_word_migration "$project_dir"
      ;;
    *)
      echo "Unsupported source tool: $source_tool"
      ;;
  esac
}

generate_pandoc_migration() {
  local project_dir="$1"
  
  cat > "$project_dir/migrate-to-unjucks.sh" << 'EOF'
#!/bin/bash
# Generated Pandoc to Unjucks migration script

# Find all Pandoc commands in scripts
find . -name "*.sh" -exec grep -l "pandoc" {} \; | while read script; do
  echo "Migrating script: $script"
  
  # Backup original
  cp "$script" "$script.backup"
  
  # Replace common Pandoc patterns
  sed -i.bak 's/pandoc \([^[:space:]]*\.md\) -o \([^[:space:]]*\.pdf\)/unjucks export \1 --format pdf --output \2/g' "$script"
  sed -i.bak 's/pandoc \([^[:space:]]*\.md\) -o \([^[:space:]]*\.html\)/unjucks export \1 --format html --output \2/g' "$script"
  sed -i.bak 's/pandoc \([^[:space:]]*\.md\) -o \([^[:space:]]*\.docx\)/unjucks export \1 --format docx --output \2/g' "$script"
  
  echo "Updated: $script"
done
EOF
  
  chmod +x "$project_dir/migrate-to-unjucks.sh"
}

generate_latex_migration() {
  local project_dir="$1"
  
  cat > "$project_dir/migrate-latex-to-unjucks.sh" << 'EOF'
#!/bin/bash
# Generated LaTeX to Unjucks migration script

# Convert LaTeX files to Markdown
find . -name "*.tex" | while read tex_file; do
  md_file="${tex_file%.tex}.md"
  
  echo "Converting: $tex_file -> $md_file"
  
  # Extract document metadata
  title=$(grep -o '\\title{[^}]*}' "$tex_file" | sed 's/\\title{//; s/}$//')
  author=$(grep -o '\\author{[^}]*}' "$tex_file" | sed 's/\\author{//; s/}$//')
  
  # Create Markdown with frontmatter
  cat > "$md_file" << EOD
---
title: "$title"
author: "$author"
template: academic
format: pdf
toc: true
bibliography: true
---

$(sed -n '/\\begin{document}/,/\\end{document}/p' "$tex_file" | \
  sed '1d; $d' | \
  sed 's/\\section{\([^}]*\)}/# \1/g' | \
  sed 's/\\subsection{\([^}]*\)}/## \1/g' | \
  sed 's/\\textbf{\([^}]*\)}/**\1**/g' | \
  sed 's/\\emph{\([^}]*\)}/*\1*/g')
EOD
  
  echo "Created: $md_file"
  echo "Command: unjucks export '$md_file' --format pdf"
done
EOF
  
  chmod +x "$project_dir/migrate-latex-to-unjucks.sh"
}
```

### Package.json Migration

If migrating a Node.js project with document generation scripts:

```json
{
  "scripts": {
    "docs:old": "pandoc README.md -o README.pdf",
    "docs:new": "unjucks export README.md --format pdf"
  }
}
```

## Step-by-Step Migration Process

### Phase 1: Assessment

1. **Inventory Current Tools:**
   ```bash
   # Document current document generation tools
   which pandoc
   which pdflatex
   which sphinx-build
   
   # Find existing build scripts
   find . -name "*.sh" -o -name "Makefile" -o -name "*.py" | xargs grep -l "pandoc\|pdflatex\|sphinx"
   ```

2. **Identify Templates and Styles:**
   ```bash
   # Find template files
   find . -name "*.latex" -o -name "*.dotx" -o -name "*.html" -o -name "*.css"
   
   # Document current output formats
   find . -name "*.pdf" -o -name "*.html" -o -name "*.docx"
   ```

### Phase 2: Preparation

1. **Install Unjucks:**
   ```bash
   npm install -g @seanchatmangpt/unjucks
   unjucks --version
   ```

2. **Test Basic Functionality:**
   ```bash
   echo "# Test\n\nThis is a test." > test.md
   unjucks export test.md --format html
   unjucks export test.md --format pdf
   ```

### Phase 3: Template Conversion

1. **Convert Templates:**
   - Pandoc templates → Unjucks presets
   - LaTeX classes → PDF templates
   - Word templates → DOCX templates
   - CSS files → HTML templates

2. **Map Variables:**
   - Create variable mapping table
   - Test variable substitution
   - Validate output formatting

### Phase 4: Script Migration

1. **Update Build Scripts:**
   ```bash
   # Backup existing scripts
   cp build-docs.sh build-docs.sh.backup
   
   # Update with Unjucks commands
   sed -i 's/pandoc/unjucks export/g' build-docs.sh
   ```

2. **Test New Scripts:**
   ```bash
   # Test updated scripts
   ./build-docs.sh
   
   # Compare outputs
   diff old-output.pdf new-output.pdf
   ```

### Phase 5: Validation

1. **Quality Assurance:**
   ```bash
   # Run comprehensive tests
   unjucks export "docs/*.md" --all --format pdf --dry
   
   # Validate outputs
   for file in docs/*.pdf; do
     echo "Checking: $file"
     pdfinfo "$file" && echo "✓ Valid PDF"
   done
   ```

2. **Performance Testing:**
   ```bash
   # Time comparisons
   time pandoc document.md -o old.pdf
   time unjucks export document.md --format pdf --output new.pdf
   ```

## Common Migration Issues

### Issue 1: Template Compatibility

**Problem:** Custom Pandoc templates don't work with Unjucks
**Solution:** 
```bash
# Use closest matching preset
unjucks export presets

# Customize with variables
unjucks export document.md --preset academic --variables '{
  "custom_field": "custom_value"
}'
```

### Issue 2: Bibliography Management

**Problem:** Complex BibTeX setups
**Solution:**
```bash
# Unjucks handles bibliography automatically
unjucks export document.md --format pdf --bibliography

# Or with academic preset
unjucks export document.md --preset academic
```

### Issue 3: Custom CSS/Styling

**Problem:** Specific styling requirements
**Solution:**
```bash
# Use custom HTML template
unjucks export document.md --format html --template custom

# Or inline styles
unjucks export document.md --format html --variables '{
  "custom_css": "body { font-family: Arial; }"
}'
```

## Post-Migration Optimization

### Performance Improvements

1. **Batch Processing:**
   ```bash
   # Instead of individual files
   for file in *.md; do unjucks export "$file"; done
   
   # Use batch processing
   unjucks export "*.md" --all --format pdf
   ```

2. **Template Reuse:**
   ```bash
   # Consistent template usage
   unjucks export "docs/*.md" --all --template academic --format pdf
   ```

### Workflow Integration

1. **CI/CD Integration:**
   ```yaml
   # GitHub Actions
   - name: Generate Documentation
     run: unjucks export "docs/*.md" --all --format pdf --output ./artifacts/
   ```

2. **Make Integration:**
   ```makefile
   docs: 
   	unjucks export "docs/*.md" --all --format pdf --output ./build/
   
   clean:
   	rm -rf ./build/
   ```

## Rollback Strategy

### Emergency Rollback

```bash
#!/bin/bash
# rollback-migration.sh

# Restore original scripts
find . -name "*.backup" | while read backup; do
  original="${backup%.backup}"
  cp "$backup" "$original"
  echo "Restored: $original"
done

# Verify rollback
echo "Rollback completed. Testing original functionality..."
./original-build-script.sh
```

### Gradual Migration

```bash
# Keep both systems during transition
alias docs-old="pandoc document.md -o document.pdf"
alias docs-new="unjucks export document.md --format pdf"

# Compare outputs
docs-old && docs-new
diff document.pdf document.pdf
```

## Migration Checklist

- [ ] **Assessment Complete**
  - [ ] Current tools documented
  - [ ] Templates identified
  - [ ] Output requirements mapped

- [ ] **Unjucks Installation**
  - [ ] Tool installed and tested
  - [ ] Available templates reviewed
  - [ ] Basic functionality validated

- [ ] **Template Migration**
  - [ ] Templates converted or mapped
  - [ ] Variables identified and tested
  - [ ] Output quality validated

- [ ] **Script Migration**
  - [ ] Build scripts updated
  - [ ] CI/CD pipelines modified
  - [ ] Documentation updated

- [ ] **Testing and Validation**
  - [ ] Output quality verified
  - [ ] Performance tested
  - [ ] Edge cases handled

- [ ] **Deployment**
  - [ ] Team trained on new tools
  - [ ] Documentation updated
  - [ ] Rollback plan prepared

## Support Resources

### Documentation
- [Unjucks Export Documentation](../export/README.md)
- [Template Guide](../templates/README.md)
- [Troubleshooting Guide](../export/troubleshooting.md)

### Community Support
- GitHub Issues for bugs and feature requests
- Discussions for migration questions
- Examples repository for common patterns

### Professional Services
For complex enterprise migrations, professional migration services are available including:
- Migration assessment and planning
- Custom template development
- CI/CD integration
- Team training and support

---

*This migration guide is regularly updated with new patterns and tools. For the latest migration strategies, visit the [official documentation](https://unjucks.dev/docs/migration).*