# LaTeX Documentation for Unjucks

Comprehensive guide to LaTeX document generation, rendering, and template integration in Unjucks.

## 📋 Documentation Structure

This directory provides complete documentation for LaTeX functionality:

### 📖 [Commands & Options Reference](./commands-reference.md)
Complete catalog of all LaTeX commands, environments, and options:
- **Document Classes**: `article`, `report`, `book`, `lawbrief`, `lawmemo`
- **Essential Packages**: `amsmath`, `amssymb`, `geometry`, `graphicx`, `biblatex`
- **Mathematical Environments**: `equation`, `align`, `gather`, `theorem`
- **Legal Formatting**: Bluebook citations, contract formatting, section numbering

### ⚖️ [Legal Documents Guide](./legal-documents.md)
Specialized documentation for legal document creation:
- **Bluebook Citations**: Automatic case law, statute, and regulation formatting
- **Brief Templates**: Appellate briefs, trial briefs, motion practice
- **Contract Generation**: Terms, clauses, signature blocks
- **Court Filing Formats**: Jurisdiction-specific requirements

### 🔬 [arXiv & Scientific Papers](./arxiv-scientific.md)
Academic document templates and best practices:
- **arXiv Submission**: TeX Live compatibility, package restrictions
- **Journal Templates**: Two-column, single-column, conference formats
- **Bibliography Management**: BibTeX, BibLaTeX integration
- **Math Notation**: AMS packages, custom operators, theorem environments

### 🎛️ [Filter Reference](./latex-filters.md)
Template filters for LaTeX generation:
- **Document Structure**: Section generation, TOC creation
- **Citation Formatting**: Legal and academic citation styles
- **Math Formula**: Equation numbering, symbol conversion
- **Package Management**: Automatic dependency inclusion

### 🔧 [Compilation Setup](./compilation-setup.md)
Setting up LaTeX compilation environments:
- **TeX Distributions**: TeX Live, MiKTeX installation
- **Engine Selection**: pdfLaTeX, XeLaTeX, LuaLaTeX comparison
- **Build Systems**: latexmk, custom build scripts
- **CI/CD Integration**: Automated document compilation

### 🐛 [Troubleshooting Guide](./troubleshooting.md)
Common issues and solutions:
- **Package Conflicts**: Array package with RevTeX, geometry issues
- **Font Problems**: Missing fonts, encoding issues
- **Citation Errors**: BibTeX failures, missing references
- **Performance Issues**: Compilation speed, memory usage

## 🚀 Quick Start Examples

### Basic Scientific Paper Template
```latex
% Template: src/templates/scientific-paper.tex.njk
\documentclass[11pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{amsmath,amssymb,amsthm}
\usepackage{graphicx}
\usepackage[margin=1in]{geometry}
\usepackage{biblatex}
\addbibresource{references.bib}

\title{ {{- title | escape }} }
\author{ {{- authors | join(', ') }} }
\date{ {{- date | formatDate('MMMM YYYY') }} }

\begin{document}
\maketitle

\begin{abstract}
{{ abstract }}
\end{abstract}

{{ content }}

\printbibliography
\end{document}
```

### Legal Brief Template
```latex
% Template: src/templates/legal-brief.tex.njk
\documentclass{lawbrief}
\usepackage{bluebook}

\court{ {{- court }} }
\caseno{ {{- caseNumber }} }
\plaintiff{ {{- plaintiff }} }
\defendant{ {{- defendant }} }
\brieftype{ {{- briefType | default('Appellant Brief') }} }

\begin{document}

\section{Statement of Issues}
{% for issue in issues %}
{{ loop.index }}. {{ issue }}
{% endfor %}

\section{Statement of Facts}
{{ factStatement }}

\section{Legal Analysis}
{{ legalAnalysis }}

\section{Conclusion}
{{ conclusion }}

\end{document}
```

### Mathematics with Custom Commands
```latex
% Template: src/templates/math-document.tex.njk
\documentclass{article}
\usepackage{amsmath,amssymb,mathtools}

% Custom operators
{% for operator in customOperators %}
\DeclareMathOperator{\{{ operator.name }}}{ {{- operator.symbol }} }
{% endfor %}

% Theorem environments
\newtheorem{theorem}{Theorem}[section]
\newtheorem{lemma}[theorem]{lemma}
\newtheorem{corollary}[theorem]{Corollary}

\begin{document}

\section{ {{- sectionTitle }} }

{% if hasMainTheorem %}
\begin{theorem}
{{ mainTheorem }}
\end{theorem}

\begin{proof}
{{ proof }}
\end{proof}
{% endif %}

{{ mathContent }}

\end{document}
```

## 🎯 Template Generation Patterns

### Document Generation with Variables
```njk
---
to: documents/{{ documentType | kebabCase }}/{{ title | kebabCase }}.tex
inject: false
unless_exists: true
---
\documentclass{ {{- documentClass | default('article') }} }

{% if documentType == 'legal' %}
\usepackage{bluebook}
\usepackage{contract}
{% elif documentType == 'scientific' %}
\usepackage{amsmath,amssymb,amsthm}
\usepackage{biblatex}
{% endif %}

\title{ {{- title | escape }} }
\author{ {{- author | escape }} }
\date{ {{- date | formatDate('\\today') }} }

\begin{document}
{{ content }}
\end{document}
```

### Package Auto-Detection
```njk
---
to: {{ outputPath }}/{{ documentName }}.tex
---
\documentclass{ {{- documentClass }} }

{% set requiredPackages = [] %}
{% if content | contains('\\begin{align}') %}
  {% set requiredPackages = (requiredPackages.push('amsmath'), requiredPackages) %}
{% endif %}
{% if content | contains('\\mathbb') %}
  {% set requiredPackages = (requiredPackages.push('amssymb'), requiredPackages) %}
{% endif %}
{% if content | contains('\\includegraphics') %}
  {% set requiredPackages = (requiredPackages.push('graphicx'), requiredPackages) %}
{% endif %}

{% for package in requiredPackages | unique %}
\usepackage{ {{- package }} }
{% endfor %}

\begin{document}
{{ content }}
\end{document}
```

## 🏗️ Document Structure Patterns

### Academic Paper Structure
```latex
% Frontmatter
\title{Title}
\author{Authors}
\maketitle
\begin{abstract}...\end{abstract}
\tableofcontents

% Main content
\section{Introduction}
\section{Related Work}
\section{Methodology}
\section{Results}
\section{Discussion}
\section{Conclusion}

% Backmatter
\bibliography{references}
\appendix
\section{Additional Data}
```

### Legal Brief Structure
```latex
% Header information
\court{Court Name}
\caseno{Case Number}
\parties{Plaintiff v. Defendant}

% Content sections
\section{Statement of Issues}
\section{Statement of Facts}
\section{Legal Analysis}
\subsection{Issue One}
\paragraph{Applicable Law}
\paragraph{Application to Facts}
\section{Conclusion}

% Supporting documents
\appendix
\section{Supporting Cases}
```

## 🔄 Integration with Unjucks

### Template Organization
```
templates/
├── latex/
│   ├── academic/
│   │   ├── article.tex.njk
│   │   ├── report.tex.njk
│   │   └── thesis.tex.njk
│   ├── legal/
│   │   ├── brief.tex.njk
│   │   ├── contract.tex.njk
│   │   └── memo.tex.njk
│   └── common/
│       ├── preamble.tex.njk
│       └── bibliography.bib.njk
```

### Filter Integration
```njk
{{ equation | latexMath }}           # Format as LaTeX math
{{ citation | bluebook }}           # Format legal citation
{{ author | latexEscape }}          # Escape LaTeX special characters
{{ date | latexDate('\\today') }}   # Format date for LaTeX
{{ content | autoPackages }}        # Auto-detect required packages
```

### Compilation Pipeline
```javascript
// Generate LaTeX from template
const latexContent = await unjucks.render('legal/brief.tex.njk', {
  court: 'Supreme Court',
  caseNumber: '2024-123',
  // ...other variables
});

// Compile to PDF
const pdfResult = await latexService.renderToPdf(latexContent, {
  engine: 'pdflatex',
  passes: 2,
  outputDir: 'dist/documents'
});
```

## 📊 Supported Features

| Feature Category | Legal Documents | Scientific Papers | Support Level |
|-----------------|-----------------|-------------------|---------------|
| **Document Classes** | lawbrief, lawmemo, article | article, report, book | Full |
| **Citations** | Bluebook, custom | BibTeX, BibLaTeX | Full |
| **Mathematics** | Basic | AMS packages, custom | Full |
| **Graphics** | Limited | Full support | Full |
| **Templates** | Brief, contract, memo | Journal, thesis, slides | Full |
| **Compilation** | PDF, HTML preview | PDF, arXiv format | Full |

## 🎯 Use Case Examples

### 1. Law Firm Document Generation
- **Input**: Case details, facts, legal arguments
- **Template**: Appellate brief with automatic citations
- **Output**: Court-ready PDF with proper formatting

### 2. Academic Journal Submission
- **Input**: Research data, bibliography, figures
- **Template**: Journal-specific format requirements
- **Output**: arXiv-compatible submission package

### 3. Batch Document Processing
- **Input**: Database of cases/papers
- **Template**: Standardized format with variables
- **Output**: Hundreds of consistent documents

## 🚀 Getting Started

1. **Install Dependencies**: Set up TeX Live or MiKTeX
2. **Choose Template**: Select from legal or academic templates
3. **Configure Variables**: Define document-specific data
4. **Generate Document**: Run template engine with LaTeX compilation
5. **Review Output**: PDF generation with error checking

## 📚 Additional Resources

- [LaTeX Commands Reference](./commands-reference.md) - Complete command catalog
- [Legal Documents Guide](./legal-documents.md) - Specialized legal formatting
- [Scientific Papers Guide](./arxiv-scientific.md) - Academic document best practices
- [Troubleshooting Guide](./troubleshooting.md) - Common issues and solutions

---

*This documentation covers all aspects of LaTeX integration in Unjucks. Start with the appropriate guide based on your document type (legal or scientific) and refer to the troubleshooting guide for common issues.*