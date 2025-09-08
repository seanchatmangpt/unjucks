# LaTeX Template Fixes and Workarounds

This document provides immediate fixes for the critical template syntax errors discovered during integration testing.

## Critical Syntax Fixes

### Fix #1: Contract Template Triple-Brace Errors

**File:** `/templates/latex/legal/contract/contract.tex.njk`

**Lines to Fix:**
```diff
- \fancyhead[L]{{{ contractName | title }}}
+ \fancyhead[L]{{ contractName | title }}

- {\Large\textbf{{{ contractName | title }}}}\\[0.5in]
+ {\Large\textbf{{ contractName | title }}}\\[0.5in]

- {\large\textbf{{{ partyA.name }}}}\\
+ {\large\textbf{{ partyA.name }}}\\

- {\large\textbf{{{ partyB.name }}}}\\[0.5in]
+ {\large\textbf{{ partyB.name }}}\\[0.5in]

- \item \party{{{ partyA.name }}}, a {{ partyA.entityType | default('corporation') }}
+ \item \party{{ partyA.name }}, a {{ partyA.entityType | default('corporation') }}

- \item \party{{{ partyB.name }}}, a {{ partyB.entityType | default('corporation') }}
+ \item \party{{ partyB.name }}, a {{ partyB.entityType | default('corporation') }}

- (\define{{{ partyA.shortName | default('Party A') }}});
+ (\define{{ partyA.shortName | default('Party A') }});

- (\define{{{ partyB.shortName | default('Party B') }}}).
+ (\define{{ partyB.shortName | default('Party B') }}).
```

### Fix #2: ArXiv Paper Frontmatter Issues

**File:** `/templates/latex/arxiv/paper/paper.tex.njk`

**Problem:** Frontmatter contains template expressions that should be processed separately.

**Current (Broken):**
```yaml
---
to: "{{ dest }}/{{ filename || 'paper' }}.tex"
---
```

**Fixed Version:**
```yaml
---
to: {{ dest }}/{{ filename or 'paper' }}.tex
inject: false
skipIf: exists
---
```

### Fix #3: Nunjucks Operator Syntax

**Problem:** Using JavaScript `||` operator instead of Nunjucks `or` operator

**Global Find/Replace:**
```diff
- {{ variable || 'default' }}
+ {{ variable or 'default' }}

- {{ revtex_options || 'aps,prd,10pt' }}
+ {{ revtex_options or 'aps,prd,10pt' }}

- {{ ams_options || '11pt' }}  
+ {{ ams_options or '11pt' }}

- {{ article_options || '11pt,a4paper' }}
+ {{ article_options or '11pt,a4paper' }}
```

## Working Template Examples

### Fixed Contract Template (Minimal)

**File:** `tests/integration/latex-workflow/contract-template-working.tex.njk`

```latex
---
to: {{ contractName | lower | replace(' ', '-') }}-contract.tex
inject: false
skipIf: exists
---
\documentclass[12pt,letterpaper]{article}
\usepackage[margin=1in]{geometry}
\usepackage{setspace}
\usepackage{fancyhdr}

\title{{ contractName | title }}
\author{Legal Department}
\date{{{ effectiveDate }}}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{{ contractName | title }}
\fancyhead[R]{\thepage}

\begin{document}

\maketitle

\section{PARTIES}

This agreement is entered into between:

\begin{enumerate}
\item \textbf{{ partyA.name }}, located at {{ partyA.address }}
\item \textbf{{ partyB.name }}, located at {{ partyB.address }}
\end{enumerate}

\section{TERMS}

{{ scopeOfWork or 'Terms to be defined.' }}

\section{SIGNATURES}

\vspace{1in}

\noindent\begin{tabular}{@{}p{0.5\textwidth}@{}p{0.5\textwidth}@{}}
{{ partyA.shortName or 'PARTY A' }}: & {{ partyB.shortName or 'PARTY B' }}: \\[1in]
\rule{0.4\textwidth}{0.5pt} & \rule{0.4\textwidth}{0.5pt} \\
Date: \rule{0.2\textwidth}{0.5pt} & Date: \rule{0.2\textwidth}{0.5pt} \\
\end{tabular}

\end{document}
```

### Fixed ArXiv Paper Template (Minimal)

**File:** `tests/integration/latex-workflow/arxiv-template-working.tex.njk`

```latex
---
to: {{ dest }}/{{ filename or 'paper' }}.tex
inject: false
skipIf: exists
---
\documentclass[{{ article_options or '11pt,a4paper' }}]{article}

\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{amsmath,amsfonts,amssymb}
\usepackage{graphicx}
\usepackage{hyperref}

{% if theorems %}
\usepackage{amsthm}
\newtheorem{theorem}{Theorem}[section]
\newtheorem{lemma}[theorem]{Lemma}
{% endif %}

\title{{ title }}
\author{{ author }}
{% if affiliation %}
\affiliation{{ affiliation }}
{% endif %}
\date{{ date or '\\today' }}

{% if abstract %}
\begin{abstract}
{{ abstract }}
{% if keywords %}
\noindent\textbf{Keywords:} {{ keywords }}
{% endif %}
\end{abstract}
{% endif %}

\begin{document}

\maketitle

\section{Introduction}
{{ introduction or 'Introduction content here.' }}

{% if sections %}
{% for section in sections %}
\section{{ section.title }}
{{ section.content }}
{% endfor %}
{% else %}
\section{Methodology}
Add your methodology here.

\section{Results}  
Add your results here.

\section{Conclusion}
Add your conclusion here.
{% endif %}

{% if bibliography == 'bibtex' %}
\bibliographystyle{{ bibstyle or 'plain' }}
\bibliography{{ bibfile or 'references' }}
{% endif %}

\end{document}
```

## CLI Command Workarounds

Until the template issues are fixed, use these workarounds:

### Manual Template Generation
```bash
# Instead of: unjucks generate latex contract --title "Service Agreement"
# Use direct template rendering:

cd tests/integration/latex-workflow
node -e "
const nunjucks = require('nunjucks');
const fs = require('fs');
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader('./'));
const data = JSON.parse(fs.readFileSync('contract-data.json', 'utf8'));
const result = env.render('contract-template-working.tex.njk', data);
fs.writeFileSync('service-agreement.tex', result);
console.log('Contract generated successfully');
"
```

### Compilation Testing
```bash
# Use working LaTeX compilation:
unjucks latex compile service-agreement.tex --output ./dist
```

### Batch Processing Script
```bash
#!/bin/bash
# batch-latex-gen.sh - Process multiple LaTeX templates

echo "Generating LaTeX documents..."

# Generate contract
node -e "
const nunjucks = require('nunjucks');
const fs = require('fs');
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader('./'));
const contractData = JSON.parse(fs.readFileSync('contract-data.json', 'utf8'));
const contractResult = env.render('contract-template-working.tex.njk', contractData);
fs.writeFileSync('contract.tex', contractResult);
console.log('✅ Contract generated');
"

# Generate paper  
node -e "
const nunjucks = require('nunjucks');
const fs = require('fs');
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader('./'));
const paperData = JSON.parse(fs.readFileSync('arxiv-data.json', 'utf8'));  
const paperResult = env.render('arxiv-template-working.tex.njk', paperData);
fs.writeFileSync('research-paper.tex', paperResult);
console.log('✅ Paper generated');
"

# Compile both
echo "Compiling LaTeX documents..."
pdflatex -interaction=nonstopmode contract.tex
pdflatex -interaction=nonstopmode research-paper.tex

echo "✅ Batch processing complete"
```

## Validation Script

```bash
#!/bin/bash  
# validate-latex-templates.sh - Check template syntax

echo "Validating LaTeX template syntax..."

# Check for triple-brace errors
echo "Checking for triple-brace syntax errors..."
grep -r "{{{" templates/latex/ && echo "❌ Found triple-brace errors" || echo "✅ No triple-brace errors"

# Check for JavaScript operators
echo "Checking for JavaScript operators..."
grep -r " || " templates/latex/ && echo "❌ Found JavaScript || operators" || echo "✅ No JavaScript operators"

# Test template rendering
echo "Testing template rendering..."
node -e "
const nunjucks = require('nunjucks');
try {
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader('./templates/latex'));
  console.log('✅ Nunjucks environment created successfully');
} catch (e) {
  console.log('❌ Template error:', e.message);
}
"

echo "Validation complete"
```

## Implementation Priority

1. **CRITICAL:** Fix triple-brace syntax in all templates
2. **HIGH:** Replace JavaScript operators with Nunjucks operators  
3. **MEDIUM:** Separate frontmatter processing from template rendering
4. **LOW:** Add comprehensive template validation

These fixes will enable the full LaTeX workflow to function as designed.