# LaTeX Template Filters Reference

Comprehensive reference for all LaTeX-specific template filters available in Unjucks.

## 📋 Filter Categories

### 🔤 Text Formatting Filters

#### `latexEscape`
**Purpose**: Escape LaTeX special characters  
**Syntax**: `{{ text | latexEscape }}`  
**Input**: String with special characters  
**Output**: LaTeX-safe string

```njk
{{ "Price: $50 & Co. (100%)" | latexEscape }}
<!-- Output: Price: \$50 \& Co. (100\%) -->

{{ title | latexEscape }}
<!-- Escapes: $ & % # _ { } \ ^ ~ -->
```

#### `latexTitle`
**Purpose**: Format text for LaTeX titles  
**Syntax**: `{{ text | latexTitle }}`  
**Features**: Proper capitalization, escape special chars

```njk
{{ "understanding machine learning & AI" | latexTitle }}
<!-- Output: Understanding Machine Learning \& AI -->
```

#### `latexAuthor`
**Purpose**: Format author names for LaTeX  
**Syntax**: `{{ authors | latexAuthor }}`  
**Input**: String or array of authors  
**Output**: LaTeX-formatted author list

```njk
{{ ["John Smith", "Jane Doe PhD"] | latexAuthor }}
<!-- Output: John Smith \and Jane Doe PhD -->

{{ "Dr. María González & Prof. Jean-Claude" | latexAuthor }}
<!-- Output: Dr. Mar\'ia Gonz\'alez \and Prof. Jean-Claude -->
```

### 📅 Date Formatting Filters

#### `latexDate`
**Purpose**: Format dates for LaTeX documents  
**Syntax**: `{{ date | latexDate(format) }}`  
**Formats**: 'today', 'iso', 'long', 'short', custom

```njk
{{ now() | latexDate('today') }}
<!-- Output: \today -->

{{ "2024-03-15" | latexDate('long') }}
<!-- Output: March 15, 2024 -->

{{ date | latexDate('\\date{MMMM YYYY}') }}
<!-- Output: \date{March 2024} -->
```

#### `formatLatexDate`
**Purpose**: Advanced date formatting with locale support  
**Syntax**: `{{ date | formatLatexDate(format, locale) }}`

```njk
{{ "2024-03-15" | formatLatexDate('D. MMMM YYYY', 'de') }}
<!-- Output: 15. M\"arz 2024 -->

{{ date | formatLatexDate('MMMM Do, YYYY') }}
<!-- Output: March 15th, 2024 -->
```

### 🧮 Mathematical Filters

#### `latexMath`
**Purpose**: Format mathematical expressions  
**Syntax**: `{{ expression | latexMath(mode) }}`  
**Modes**: 'inline', 'display', 'equation'

```njk
{{ "E = mc^2" | latexMath('inline') }}
<!-- Output: $E = mc^2$ -->

{{ formula | latexMath('display') }}
<!-- Output: \[ formula \] -->

{{ equation | latexMath('equation') }}
<!-- Output: \begin{equation} equation \end{equation} -->
```

#### `mathSymbol`
**Purpose**: Convert text to LaTeX math symbols  
**Syntax**: `{{ symbol | mathSymbol }}`

```njk
{{ "alpha" | mathSymbol }}
<!-- Output: \alpha -->

{{ "infinity" | mathSymbol }}
<!-- Output: \infty -->

{{ ["alpha", "beta", "gamma"] | mathSymbol }}
<!-- Output: \alpha, \beta, \gamma -->
```

#### `formatEquation`
**Purpose**: Format complex equations with labels  
**Syntax**: `{{ equation | formatEquation(label, numbered) }}`

```njk
{{ "f(x) = ax^2 + bx + c" | formatEquation('quadratic', true) }}
<!-- Output: \begin{equation}\label{eq:quadratic} f(x) = ax^2 + bx + c \end{equation} -->
```

### 📚 Citation Filters

#### `bluebook`
**Purpose**: Format legal citations in Bluebook style  
**Syntax**: `{{ citation | bluebook(type) }}`  
**Types**: 'case', 'statute', 'regulation', 'book'

```njk
{% set case = {
  name: "Miranda v. Arizona",
  reporter: "384 U.S. 436",
  year: "1966",
  pinCite: "444"
} %}
{{ case | bluebook('case') }}
<!-- Output: \case{Miranda v. Arizona}{384 U.S. 436}{1966} -->

{{ case | bluebook('case', true) }}
<!-- Output: \casepin{Miranda v. Arizona}{384 U.S. 436}{444}{1966} -->
```

#### `bibEntry`
**Purpose**: Generate BibTeX entries  
**Syntax**: `{{ reference | bibEntry(type) }}`  
**Types**: 'article', 'book', 'inproceedings', 'misc'

```njk
{% set ref = {
  key: "smith2024",
  title: "Machine Learning Advances",
  authors: ["John Smith", "Jane Doe"],
  journal: "AI Review",
  year: "2024",
  volume: "15",
  pages: "123-145"
} %}
{{ ref | bibEntry('article') }}
<!-- Output: BibTeX entry for article -->
```

#### `citationKey`
**Purpose**: Generate unique citation keys  
**Syntax**: `{{ reference | citationKey(style) }}`  
**Styles**: 'author-year', 'author-title', 'numeric'

```njk
{% set ref = {
  authors: ["Smith", "Doe"],
  year: "2024",
  title: "Machine Learning"
} %}
{{ ref | citationKey('author-year') }}
<!-- Output: smith-doe-2024 -->

{{ ref | citationKey('author-title') }}
<!-- Output: smith-machine-learning -->
```

### 📄 Document Structure Filters

#### `sectionize`
**Purpose**: Convert text to LaTeX sections  
**Syntax**: `{{ content | sectionize(level, numbered) }}`  
**Levels**: 1-5 (section, subsection, subsubsection, paragraph, subparagraph)

```njk
{{ "Introduction" | sectionize(1) }}
<!-- Output: \section{Introduction} -->

{{ "Background" | sectionize(2, false) }}
<!-- Output: \subsection*{Background} -->

{% for section in sections %}
{{ section.title | sectionize(section.level) }}
{{ section.content }}
{% endfor %}
```

#### `tableOfContents`
**Purpose**: Generate table of contents  
**Syntax**: `{{ sections | tableOfContents(depth) }}`

```njk
{% set sections = [
  {title: "Introduction", level: 1},
  {title: "Methods", level: 1},
  {title: "Data Collection", level: 2}
] %}
{{ sections | tableOfContents(2) }}
<!-- Output: LaTeX TOC structure -->
```

#### `labelGen`
**Purpose**: Generate LaTeX labels  
**Syntax**: `{{ text | labelGen(prefix) }}`

```njk
{{ "Machine Learning Overview" | labelGen('sec') }}
<!-- Output: sec:machine-learning-overview -->

{{ figureName | labelGen('fig') }}
{{ tableName | labelGen('tab') }}
{{ equationName | labelGen('eq') }}
```

### 📦 Package Management Filters

#### `detectPackages`
**Purpose**: Auto-detect required LaTeX packages  
**Syntax**: `{{ content | detectPackages }}`  
**Returns**: Array of required package names

```njk
{% set content = "\\begin{align} E = mc^2 \\end{align} \\includegraphics{fig.pdf}" %}
{% set packages = content | detectPackages %}
{% for package in packages %}
\usepackage{ {{- package }} }
{% endfor %}
<!-- Output: \usepackage{amsmath} \usepackage{graphicx} -->
```

#### `packageOptions`
**Purpose**: Generate package options  
**Syntax**: `{{ options | packageOptions(packageName) }}`

```njk
{{ {margin: "1in", paper: "a4paper"} | packageOptions('geometry') }}
<!-- Output: \usepackage[margin=1in,paper=a4paper]{geometry} -->

{{ ['utf8'] | packageOptions('inputenc') }}
<!-- Output: \usepackage[utf8]{inputenc} -->
```

#### `usePackage`
**Purpose**: Format package declarations  
**Syntax**: `{{ packageName | usePackage(options) }}`

```njk
{{ "geometry" | usePackage({margin: "1in"}) }}
<!-- Output: \usepackage[margin=1in]{geometry} -->

{{ "amsmath" | usePackage() }}
<!-- Output: \usepackage{amsmath} -->
```

### 🎨 Formatting and Layout Filters

#### `environment`
**Purpose**: Wrap content in LaTeX environments  
**Syntax**: `{{ content | environment(envName, options) }}`

```njk
{{ "This is centered text." | environment('center') }}
<!-- Output: \begin{center} This is centered text. \end{center} -->

{{ equation | environment('align', '*') }}
<!-- Output: \begin{align*} equation \end{align*} -->
```

#### `latexList`
**Purpose**: Convert arrays to LaTeX lists  
**Syntax**: `{{ items | latexList(type) }}`  
**Types**: 'itemize', 'enumerate', 'description'

```njk
{{ ["First item", "Second item", "Third item"] | latexList('itemize') }}
<!-- Output: \begin{itemize} \item First item \item Second item \item Third item \end{itemize} -->

{% set descriptions = [
  {term: "API", definition: "Application Programming Interface"},
  {term: "REST", definition: "Representational State Transfer"}
] %}
{{ descriptions | latexList('description') }}
<!-- Output: description list -->
```

#### `latexTable`
**Purpose**: Generate LaTeX tables  
**Syntax**: `{{ data | latexTable(options) }}`  
**Options**: headers, columnSpec, style, caption

```njk
{% set data = [
  ["Name", "Age", "City"],
  ["John", "25", "NYC"],
  ["Jane", "30", "LA"]
] %}
{{ data | latexTable({
  headers: true,
  columnSpec: "lcc",
  style: "booktabs",
  caption: "Sample Data"
}) }}
<!-- Output: Complete LaTeX table -->
```

### 🔍 Validation and Quality Filters

#### `validateLatex`
**Purpose**: Check LaTeX syntax  
**Syntax**: `{{ content | validateLatex }}`  
**Returns**: Validation results with errors/warnings

```njk
{% set latex = "\\begin{equation} E = mc^2 \\end{equation}" %}
{% set validation = latex | validateLatex %}
{% if validation.valid %}
Valid LaTeX: {{ latex }}
{% else %}
Errors found: {{ validation.errors | join(', ') }}
{% endif %}
```

#### `checkCitations`
**Purpose**: Validate citation references  
**Syntax**: `{{ content | checkCitations(bibliography) }}`

```njk
{% set content = "As shown in \\cite{smith2024}, machine learning..." %}
{% set bibKeys = bibliography | map('key') %}
{% set citationCheck = content | checkCitations(bibKeys) %}
<!-- Returns: {valid: true/false, missing: [], unused: []} -->
```

#### `wordCount`
**Purpose**: Count words in LaTeX content  
**Syntax**: `{{ content | wordCount }}`  
**Features**: Ignores LaTeX commands, counts actual content

```njk
{% set content = "\\section{Introduction} This is a sample document with \\emph{emphasis}." %}
Word count: {{ content | wordCount }}
<!-- Output: Word count: 7 -->
```

## 🎯 Advanced Filter Combinations

### Multi-Author Paper Template
```njk
---
to: papers/{{ title | kebabCase }}.tex
---
\documentclass[11pt]{article}

{{ content | detectPackages | map('usePackage') | join('\n') }}

\title{ {{- title | latexEscape }} }
\author{ {{- authors | latexAuthor }} }
\date{ {{- date | latexDate('today') }} }

\begin{document}
\maketitle

\begin{abstract}
{{ abstract | latexEscape }}
\end{abstract}

{{ sections | tableOfContents(3) }}

{% for section in sections %}
{{ section.title | sectionize(section.level) }}
{% if section.label %}
\label{ {{- section.title | labelGen('sec') }} }
{% endif %}
{{ section.content }}

{% endfor %}

\bibliographystyle{plain}
\bibliography{references}

\end{document}
```

### Legal Brief with Auto-Citations
```njk
---
to: briefs/{{ caseNumber | kebabCase }}.tex
---
\documentclass[12pt]{lawbrief}
\usepackage{bluebook}

\court{ {{- court | latexEscape }} }
\caseno{ {{- caseNumber }} }

\begin{document}

{% for section in sections %}
{{ section.title | sectionize(1) }}

{% for paragraph in section.paragraphs %}
{{ paragraph.text }}
{% for citation in paragraph.citations %}
{{ citation | bluebook(citation.type) }}
{% endfor %}

{% endfor %}
{% endfor %}

\end{document}
```

### Dynamic Table Generation
```njk
---
to: tables/{{ tableName | kebabCase }}.tex
---
\documentclass{article}
\usepackage{booktabs}

\begin{document}

{% for table in tables %}
\begin{table}[htbp]
\centering
\caption{ {{- table.caption | latexEscape }} }
\label{ {{- table.name | labelGen('tab') }} }
{{ table.data | latexTable({
  headers: table.hasHeaders,
  columnSpec: table.columns | join(''),
  style: "booktabs"
}) }}
\end{table}

{% endfor %}

\end{document}
```

## 🔧 Filter Configuration

### Custom Filter Options
```javascript
// Custom filter configuration in unjucks.config.js
export default {
  filters: {
    latex: {
      escapeChars: {
        '$': '\\$',
        '&': '\\&',
        '%': '\\%',
        '#': '\\#',
        '_': '\\_',
        '{': '\\{',
        '}': '\\}',
        '\\': '\\textbackslash',
        '^': '\\textasciicircum',
        '~': '\\textasciitilde'
      },
      dateFormats: {
        'today': '\\today',
        'iso': 'YYYY-MM-DD',
        'long': 'MMMM D, YYYY',
        'short': 'M/D/YY'
      },
      mathEnvironments: {
        'inline': ['$', '$'],
        'display': ['\\[', '\\]'],
        'equation': ['\\begin{equation}', '\\end{equation}']
      }
    }
  }
};
```

### Performance Optimization
```njk
<!-- Cache expensive operations -->
{% set packageList = content | detectPackages %}
{% for package in packageList %}
\usepackage{ {{- package }} }
{% endfor %}

<!-- Batch similar operations -->
{% set allCitations = content | extractCitations %}
{% for citation in allCitations | unique %}
{{ citation | bluebook(citation.type) }}
{% endfor %}
```

## 🐛 Common Issues and Solutions

### Filter Error Handling
```njk
<!-- Safe escaping with fallback -->
{{ title | latexEscape | default('Untitled Document') }}

<!-- Validation before processing -->
{% if content | validateLatex %}
{{ content | latexMath('display') }}
{% else %}
<!-- Fallback content -->
Invalid mathematical expression
{% endif %}

<!-- Type checking -->
{% if authors is string %}
{{ authors | latexAuthor }}
{% elif authors is iterable %}
{{ authors | join(' \\and ') | latexEscape }}
{% endif %}
```

### Performance Considerations
| Filter | Performance | Memory | Notes |
|--------|-------------|--------|--------|
| `latexEscape` | Fast | Low | Simple string replacement |
| `detectPackages` | Medium | Medium | Regex-based analysis |
| `validateLatex` | Slow | High | Full syntax parsing |
| `latexTable` | Medium | Medium | Complex formatting |
| `bluebook` | Fast | Low | Template-based output |

---

This filter reference covers all LaTeX-specific template functionality in Unjucks. For troubleshooting specific filter issues, refer to the [Troubleshooting Guide](./troubleshooting.md).