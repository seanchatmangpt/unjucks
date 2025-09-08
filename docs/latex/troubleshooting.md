# LaTeX Troubleshooting Guide

Comprehensive troubleshooting guide for LaTeX compilation, template generation, and common issues in Unjucks.

## 🚨 Common Compilation Errors

### Package Not Found Errors

#### Error Message
```
! LaTeX Error: File 'amsmath.sty' not found.
```

#### Causes & Solutions

**1. Missing Package Installation**
```bash
# TeX Live
tlmgr install amsmath amssymb amsthm

# MiKTeX (Windows)
mpm --install=amsmath

# Ubuntu/Debian
sudo apt install texlive-latex-recommended
```

**2. Outdated TeX Distribution**
```bash
# Update TeX Live
tlmgr update --self
tlmgr update --all

# Update MiKTeX
mpm --update-db
mpm --update=all
```

**3. Wrong Package Name**
```latex
% ❌ Wrong
\usepackage{amsmaths}

% ✅ Correct
\usepackage{amsmath}
```

### Undefined Control Sequence

#### Error Message
```
! Undefined control sequence.
l.15 \mathb
            b{R}
```

#### Causes & Solutions

**1. Missing Package for Command**
```latex
% ❌ Missing package
\mathbb{R}

% ✅ Add required package
\usepackage{amssymb}
\mathbb{R}
```

**2. Typos in Command Names**
```latex
% ❌ Typo
\mathb{R}

% ✅ Correct
\mathbb{R}
```

**3. Engine-Specific Commands**
```latex
% ❌ XeLaTeX command in pdfLaTeX
\setmainfont{Times New Roman}

% ✅ Use appropriate packages
\usepackage{times}  % for pdfLaTeX
% OR compile with XeLaTeX
```

### File Not Found Errors

#### Error Message
```
! LaTeX Error: File 'figure1.pdf' not found.
```

#### Solutions

**1. Check File Paths**
```latex
% ❌ Wrong path
\includegraphics{figures/figure1.pdf}

% ✅ Verify path exists
\includegraphics{../figures/figure1.pdf}
```

**2. File Extension Issues**
```latex
% ❌ Wrong extension for engine
\includegraphics{figure1.eps}  % pdfLaTeX doesn't support EPS

% ✅ Use appropriate format
\includegraphics{figure1.pdf}  % for pdfLaTeX
\includegraphics{figure1.png}  % also works
```

**3. Build Directory Structure**
```bash
# Ensure proper structure
project/
├── documents/
│   └── paper.tex
├── figures/
│   └── figure1.pdf
└── build/
```

## 🔍 Template Generation Issues

### Nunjucks Syntax Errors

#### Error Message
```
Template render error: expected variable end
```

#### Common Causes & Solutions

**1. Unescaped LaTeX Commands**
```njk
{% raw %}
<!-- ❌ LaTeX conflicts with Nunjucks -->
\section{Results for {{ experiment }}}

<!-- ✅ Use raw blocks -->
{% raw %}\section{Results}{% endraw %} for {{ experiment }}
{% endraw %}
```

**2. Special Character Conflicts**
```njk
<!-- ❌ Percent signs confuse template engine -->
{{ "50% improvement" }}

<!-- ✅ Use filters or escape -->
{{ "50% improvement" | latexEscape }}
<!-- or -->
{{ "50\\% improvement" }}
```

**3. Missing Variable Handling**
```njk
<!-- ❌ Undefined variables cause errors -->
\title{ {{ title }} }

<!-- ✅ Provide defaults -->
\title{ {{ title | default('Untitled Document') | latexEscape }} }
```

### Filter Errors

#### Error Message
```
Filter 'latexEscape' not found
```

#### Solutions

**1. Missing Filter Registration**
```javascript
// In unjucks.config.js
import { latexFilters } from './src/filters/latex-filters.js';

export default {
  filters: {
    ...latexFilters
  }
};
```

**2. Filter Import Issues**
```javascript
// Check filter file exists and exports correctly
// src/filters/latex-filters.js
export const latexFilters = {
  latexEscape: (text) => {
    return text
      .replace(/\\/g, '\\textbackslash')
      .replace(/\$/g, '\\$')
      .replace(/&/g, '\\&')
      // ... more replacements
  }
};
```

### Variable Resolution Problems

#### Common Issues

**1. Scope Problems**
```njk
<!-- ❌ Variable not in scope -->
{% for chapter in book.chapters %}
  \chapter{ {{ chapterTitle }} }  <!-- chapterTitle not defined -->
{% endfor %}

<!-- ✅ Use correct variable -->
{% for chapter in book.chapters %}
  \chapter{ {{ chapter.title | latexEscape }} }
{% endfor %}
```

**2. Type Mismatches**
```njk
<!-- ❌ Expecting array, got string -->
{% for author in authors %}
  {{ author.name }}
{% endfor %}

<!-- ✅ Handle both cases -->
{% if authors is string %}
  {{ authors | latexAuthor }}
{% else %}
  {% for author in authors %}
    {{ author.name | latexEscape }}{% if not loop.last %} \and {% endif %}
  {% endfor %}
{% endif %}
```

## 📦 Package-Specific Issues

### arXiv Submission Problems

#### Array Package Conflict
```
Package array Error: Illegal pream-token (t): `c' used.
```

**Solution**: Use older array package version
```latex
% In template
{% if arxivCompatible %}
\usepackage{array}[2020/10/01]
{% else %}
\usepackage{array}
{% endif %}
```

#### Hyperref Issues on arXiv
```
Package hyperref Error: Wrong driver option `pdftex'
```

**Solutions**:
```latex
% ❌ Problematic on arXiv
\usepackage{hyperref}

% ✅ Conditional loading
{% if not arxivSubmission %}
\usepackage{hyperref}
{% endif %}

% ✅ Or use safe options
\usepackage[draft]{hyperref}
```

### BibTeX/BibLaTeX Errors

#### Missing Bibliography Entries
```
LaTeX Warning: Citation `smith2024' on page 1 undefined.
```

**Solutions**:

**1. Check .bib File Syntax**
```bibtex
% ❌ Syntax error
@article{smith2024
  title = {Machine Learning},
  author = {Smith, John},
  year = 2024
}

% ✅ Correct syntax
@article{smith2024,
  title = {Machine Learning},
  author = {Smith, John},
  year = {2024}
}
```

**2. Verify Citation Keys**
```njk
<!-- Template validation -->
{% set citationKeys = bibliography | map('key') %}
{% for citation in usedCitations %}
  {% if citation not in citationKeys %}
    <!-- Warning: {{ citation }} not found in bibliography -->
  {% endif %}
{% endfor %}
```

**3. Build Process Issues**
```bash
# Complete build with bibliography
pdflatex document.tex
bibtex document       # Note: no .tex extension
pdflatex document.tex
pdflatex document.tex
```

### Font and Encoding Issues

#### Unicode Character Problems
```
Package inputenc Error: Unicode character π (U+03C0) not set up for use with LaTeX.
```

**Solutions**:

**1. Use Proper Engine**
```bash
# ❌ pdfLaTeX with Unicode
pdflatex document.tex

# ✅ Use XeLaTeX or LuaLaTeX
xelatex document.tex
```

**2. Template Engine Selection**
```njk
---
to: {{ documentPath }}.tex
engine: {% if hasUnicode %}xelatex{% else %}pdflatex{% endif %}
---
{% if hasUnicode %}
\usepackage{fontspec}
\usepackage{polyglossia}
{% else %}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
{% endif %}
```

**3. Character Replacement**
```njk
{{ content | replaceUnicode }}
<!-- Filter converts π → $\pi$, α → $\alpha$, etc. -->
```

## 🎯 Performance Issues

### Slow Compilation

#### Diagnosis
```bash
# Time compilation
time pdflatex document.tex

# Profile with detailed timing
pdflatex -recorder document.tex
# Check .fls file for loaded files
```

#### Common Causes & Solutions

**1. Too Many Packages**
```latex
% ❌ Loading unnecessary packages
\usepackage{tikz}
\usepackage{beamer}
\usepackage{memoir}

% ✅ Only load what you need
{% for package in requiredPackages %}
\usepackage{ {{ package }} }
{% endfor %}
```

**2. Large Images**
```latex
% ❌ Unoptimized images
\includegraphics[width=\textwidth]{huge-image.png}

% ✅ Optimize images first
\includegraphics[width=\textwidth]{optimized-image.pdf}
```

**3. Complex TikZ Graphics**
```latex
% ✅ Pre-compile TikZ externally
\usepackage{tikz}
\usetikzlibrary{external}
\tikzexternalize
```

### Memory Issues

#### Error Message
```
! TeX capacity exceeded, sorry [main memory size=5000000].
```

#### Solutions

**1. Increase Memory Limits**
```bash
# Temporary fix
export main_memory=12000000
pdflatex document.tex
```

**2. Split Large Documents**
```latex
% Use subfiles package
\documentclass[main.tex]{subfiles}
\begin{document}
% Chapter content
\end{document}
```

**3. Template Optimization**
```njk
<!-- ❌ Generate huge tables inline -->
\begin{tabular}{...}
{% for row in hugeDataSet %}
...
{% endfor %}
\end{tabular}

<!-- ✅ Split into multiple tables -->
{% for chunk in hugeDataSet | batch(100) %}
\begin{table}
...
{% for row in chunk %}
...
{% endfor %}
\end{table}
{% endfor %}
```

## 🔧 Debugging Strategies

### Compilation Debugging

#### Progressive Commenting
```latex
% Comment out sections to isolate issues
\documentclass{article}
\usepackage{amsmath}

\begin{document}

\section{Working Section}
This compiles fine.

% \section{Problematic Section}
% Content that causes errors

\end{document}
```

#### Minimal Working Example
```latex
% Create minimal reproduction case
\documentclass{article}
\usepackage{problematicpackage}

\begin{document}
Minimal content that reproduces the error.
\end{document}
```

### Template Debugging

#### Debug Mode in Templates
```njk
{% set DEBUG = true %}

{% if DEBUG %}
<!-- Debug: Processing {{ documentName }} -->
<!-- Variables: {{ variables | dump }} -->
{% endif %}

\documentclass{ {{ documentClass }} }

{% if DEBUG %}
% DEBUG: Using {{ documentClass }} class
% DEBUG: {{ packages | length }} packages loaded
{% endif %}
```

#### Validation Helpers
```njk
<!-- Validate required variables -->
{% if not title %}
  {% set missingVars = (missingVars or []).concat(['title']) %}
{% endif %}

{% if missingVars %}
% ERROR: Missing required variables: {{ missingVars | join(', ') }}
\PackageError{template}{Missing variables: {{ missingVars | join(', ') }}}{}
{% endif %}
```

### Log Analysis

#### Key Log Patterns
```bash
# Search for errors in log files
grep -E "Error|Fatal|Emergency" *.log

# Find undefined references
grep "undefined" *.log

# Check for overfull boxes
grep "Overfull" *.log

# Package loading issues
grep "Package.*loaded" *.log
```

#### Automated Log Analysis
```javascript
// scripts/analyze-logs.js
import fs from 'fs';

function analyzeLatexLog(logPath) {
  const content = fs.readFileSync(logPath, 'utf8');
  
  const errors = content.match(/! LaTeX Error:.*$/gm) || [];
  const warnings = content.match(/LaTeX Warning:.*$/gm) || [];
  const overfull = content.match(/Overfull.*$/gm) || [];
  
  return {
    errors: errors.length,
    warnings: warnings.length,
    overfullBoxes: overfull.length,
    details: { errors, warnings, overfull }
  };
}
```

## 🛠️ Recovery Strategies

### Corrupted Build State

#### Clean and Rebuild
```bash
# Remove all auxiliary files
find . -name "*.aux" -delete
find . -name "*.log" -delete
find . -name "*.toc" -delete
find . -name "*.bbl" -delete
find . -name "*.blg" -delete

# Full rebuild
latexmk -pdf -pvc document.tex
```

### Template Generation Failures

#### Rollback Strategy
```javascript
// Keep backup of working templates
async function generateWithBackup(templatePath, data, outputPath) {
  const backupPath = outputPath + '.backup';
  
  try {
    // Create backup if output exists
    if (fs.existsSync(outputPath)) {
      fs.copyFileSync(outputPath, backupPath);
    }
    
    // Generate new version
    await renderTemplate(templatePath, data, outputPath);
    
    // Validate generation
    await validateLatex(outputPath);
    
    // Remove backup on success
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
    
  } catch (error) {
    // Restore backup on failure
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, outputPath);
      fs.unlinkSync(backupPath);
    }
    throw error;
  }
}
```

### Emergency Compilation

#### Fallback Document Class
```njk
{% set fallbackClass = "article" %}

\documentclass{
  {%- if documentClass and isValidClass(documentClass) -%}
    {{ documentClass }}
  {%- else -%}
    {{ fallbackClass }}
  {%- endif -%}
}

% Conditional package loading with fallbacks
{% for package in packages %}
  {% if isPackageAvailable(package) %}
\usepackage{ {{ package }} }
  {% else %}
% Package {{ package }} not available, using fallback
    {% if package == 'tikz' %}
\usepackage{graphicx}  % Fallback for TikZ
    {% endif %}
  {% endif %}
{% endfor %}
```

## 📊 Troubleshooting Checklist

### Before Compilation
- [ ] TeX distribution installed and updated
- [ ] All required packages available
- [ ] File paths exist and are correct
- [ ] Template variables properly defined
- [ ] No syntax errors in .njk files

### During Template Generation
- [ ] Filters properly registered
- [ ] Variable scopes correct
- [ ] Special characters escaped
- [ ] Conditional logic working
- [ ] File permissions correct

### After Compilation
- [ ] No fatal errors in log files
- [ ] All references resolved
- [ ] Bibliography compiled correctly
- [ ] Figures and tables display properly
- [ ] Output PDF opens correctly

### Performance Optimization
- [ ] Minimal package set loaded
- [ ] Images optimized for size
- [ ] Complex graphics pre-compiled
- [ ] Large datasets paginated
- [ ] Build cache utilized

---

This troubleshooting guide covers the most common issues encountered when using LaTeX with Unjucks. For additional help, consult the LaTeX community resources or the specific package documentation.