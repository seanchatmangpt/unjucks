# arXiv & Scientific Papers with LaTeX

Comprehensive guide for creating academic papers, research documents, and arXiv-compatible submissions using LaTeX and Unjucks.

## 🔬 Scientific Document Types

### Research Articles

**Document Class**: `article`  
**Key Features**:
- Single or two-column layouts
- Mathematical notation support
- Bibliography integration
- Figure and table management

#### Basic Article Template
```latex
\documentclass[11pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{amsmath,amssymb,amsthm}
\usepackage{graphicx}
\usepackage[margin=1in]{geometry}
\usepackage{biblatex}
\addbibresource{references.bib}

\title{ {{- title }} }
\author{ {{- authors | join(' \\and ') }} }
\date{ {{- date | formatDate('\\today') }} }

\begin{document}
\maketitle

\begin{abstract}
{{ abstract }}
\end{abstract}

\section{Introduction}
{{ introduction }}

\section{Methods}
{{ methods }}

\section{Results}
{{ results }}

\section{Discussion}
{{ discussion }}

\section{Conclusion}
{{ conclusion }}

\printbibliography
\end{document}
```

### Conference Papers

**Two-Column Format**:
```latex
\documentclass[11pt,twocolumn]{article}
\usepackage[utf8]{inputenc}
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage[margin=0.75in]{geometry}
\setlength{\columnsep}{0.25in}

% Conference-specific packages
\usepackage{times}              % Times font for many conferences
\usepackage{cite}               % Compressed citations
```

### Thesis and Dissertations

**Document Class**: `report` or `book`  
```latex
\documentclass[12pt,oneside]{report}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{amsmath,amssymb,amsthm}
\usepackage{graphicx}
\usepackage[margin=1.5in]{geometry}
\usepackage{setspace}
\doublespacing

\title{ {{- thesisTitle }} }
\author{ {{- author }} }
\date{ {{- defenseDate | formatDate('MMMM YYYY') }} }

\begin{document}

% Title page
\maketitle

% Front matter
\pagenumbering{roman}
\tableofcontents
\listoffigures
\listoftables

% Abstract
\chapter*{Abstract}
\addcontentsline{toc}{chapter}{Abstract}
{{ abstract }}

% Main content
\pagenumbering{arabic}
\setcounter{page}{1}

{% for chapter in chapters %}
\chapter{ {{- chapter.title }} }
{{ chapter.content }}

{% endfor %}

% Bibliography
\bibliography{references}
\bibliographystyle{plain}

\end{document}
```

## 📚 arXiv Submission Guidelines

### arXiv-Compatible Template
```latex
% arXiv submission template
\documentclass[11pt]{article}
\usepackage[utf8]{inputenc}

% Essential packages for arXiv
\usepackage{amsmath,amssymb,amsfonts}
\usepackage{graphicx}
\usepackage{color}

% Avoid problematic packages
% \usepackage{hyperref}  % Often causes issues
% \usepackage{tikz}      % Can be problematic

\title{ {{- title }} }
\author{ {{- authors | formatAuthors }} }
\date{}

\begin{document}
\maketitle

\begin{abstract}
{{ abstract }}
\end{abstract}

{{ content }}

% Use \bibliographystyle{plain} for arXiv
\bibliographystyle{plain}
\bibliography{references}

\end{document}
```

### arXiv Package Compatibility
```njk
---
to: papers/{{ paperTitle | kebabCase }}-arxiv.tex
---
\documentclass[11pt]{article}

% arXiv-safe packages only
\usepackage[utf8]{inputenc}
\usepackage{amsmath,amssymb,amsfonts}
\usepackage{graphicx}

{% if texLiveVersion == '2023' %}
% Use older array package for RevTeX compatibility
\usepackage{array}[2020/10/01]
{% endif %}

{% if hasTikzFigures %}
% Include pre-compiled TikZ figures as images
% \usepackage{tikz}  % Avoid on arXiv
{% for figure in tikzFigures %}
% Figure {{ figure.name }} compiled separately
{% endfor %}
{% endif %}

{% if needsHyperref %}
% Add hyperref last if needed (often problematic on arXiv)
% \usepackage{hyperref}
{% endif %}

\title{ {{- title | latexEscape }} }
\author{ {{- authors | formatArxivAuthors }} }
\date{}

\begin{document}
\maketitle

\begin{abstract}
{{ abstract }}
\end{abstract}

{{ content }}

\bibliographystyle{plain}
\bibliography{references}

\end{document}
```

## 🧮 Mathematical Environments

### Theorem Environments
```latex
% Standard theorem environments
\newtheorem{theorem}{Theorem}[section]
\newtheorem{lemma}[theorem]{Lemma}
\newtheorem{corollary}[theorem]{Corollary}
\newtheorem{proposition}[theorem]{Proposition}

\theoremstyle{definition}
\newtheorem{definition}[theorem]{Definition}
\newtheorem{example}[theorem]{Example}

\theoremstyle{remark}
\newtheorem{remark}[theorem]{Remark}
\newtheorem{note}[theorem]{Note}

% Usage in templates
{% for theorem in theorems %}
\begin{theorem}{% if theorem.label %}\label{thm:{{ theorem.label }}}{% endif %}
{{ theorem.statement }}
\end{theorem}

{% if theorem.proof %}
\begin{proof}
{{ theorem.proof }}
\end{proof}
{% endif %}

{% endfor %}
```

### Equation Environments
```latex
% Single equations
\begin{equation}
\label{eq:einstein}
E = mc^2
\end{equation}

% Multiple aligned equations
\begin{align}
\label{eq:system}
a_1 x + b_1 y &= c_1 \\
a_2 x + b_2 y &= c_2
\end{align}

% Equation systems
\begin{equation}
\label{eq:cases}
f(x) = \begin{cases}
x^2 & \text{if } x \geq 0 \\
-x^2 & \text{if } x < 0
\end{cases}
\end{equation}
```

### Template Integration for Math
```njk
{% for equation in equations %}
\begin{equation}
{% if equation.label %}
\label{eq:{{ equation.label }}}
{% endif %}
{{ equation.latex }}
\end{equation}

{% if equation.explanation %}
where {{ equation.explanation }}.
{% endif %}

{% endfor %}

{% for theorem in theorems %}
\begin{{{ theorem.type | default('theorem') }}}
{% if theorem.name %}[{{ theorem.name }}]{% endif %}
{% if theorem.label %}\label{thm:{{ theorem.label }}}{% endif %}
{{ theorem.statement }}
\end{{{ theorem.type | default('theorem') }}}

{% if theorem.proof %}
\begin{proof}
{{ theorem.proof }}
\end{proof}
{% endif %}

{% endfor %}
```

## 📖 Bibliography Management

### BibTeX Integration
```latex
% Traditional BibTeX
\bibliographystyle{plain}
\bibliography{references}
```

### BibLaTeX (Modern Approach)
```latex
\usepackage[style=numeric,backend=biber]{biblatex}
\addbibresource{references.bib}

% Citation commands
\cite{key}              % [1]
\textcite{key}          % Author [1]
\parencite{key}         % (Author 2023)
\footcite{key}          % Footnote citation

% Print bibliography
\printbibliography
```

### Template Bibliography Generation
```njk
---
to: {{ paperTitle | kebabCase }}/references.bib
---
% Bibliography for {{ paperTitle }}
% Generated on {{ now() | formatDate('YYYY-MM-DD') }}

{% for ref in references %}
@{{ ref.type }}{{{ ref.key }},
  title = { {{- ref.title | latexEscape }} },
  author = { {{- ref.authors | formatBibAuthors }} },
{% if ref.type == 'article' %}
  journal = { {{- ref.journal }} },
  volume = { {{- ref.volume }} },
  number = { {{- ref.number }} },
  pages = { {{- ref.pages }} },
{% elif ref.type == 'book' %}
  publisher = { {{- ref.publisher }} },
  address = { {{- ref.address }} },
{% elif ref.type == 'inproceedings' %}
  booktitle = { {{- ref.booktitle }} },
  pages = { {{- ref.pages }} },
{% endif %}
  year = { {{- ref.year }} },
{% if ref.doi %}
  doi = { {{- ref.doi }} },
{% endif %}
{% if ref.url %}
  url = { {{- ref.url }} },
{% endif %}
}

{% endfor %}
```

## 📊 Figures and Tables

### Figure Management
```latex
\begin{figure}[htbp]
\centering
\includegraphics[width=0.8\textwidth]{figure1.pdf}
\caption{Caption text here.}
\label{fig:figure1}
\end{figure}
```

### Table Creation
```latex
\begin{table}[htbp]
\centering
\caption{Experimental Results}
\label{tab:results}
\begin{tabular}{lccr}
\toprule
Method & Accuracy & Time (s) & Memory (MB) \\
\midrule
Algorithm A & 95.2\% & 1.23 & 245 \\
Algorithm B & 97.1\% & 2.45 & 512 \\
Algorithm C & 94.8\% & 0.98 & 189 \\
\bottomrule
\end{tabular}
\end{table}
```

### Dynamic Figure Generation
```njk
{% for figure in figures %}
\begin{figure}[{{ figure.placement | default('htbp') }}]
\centering
{% if figure.width %}
\includegraphics[width={{ figure.width }}]{{{ figure.filename }}}
{% else %}
\includegraphics[scale={{ figure.scale | default('1.0') }}]{{{ figure.filename }}}
{% endif %}
\caption{ {{- figure.caption | latexEscape }} }
\label{fig:{{ figure.label }}}
\end{figure}

{% endfor %}

{% for table in tables %}
\begin{table}[{{ table.placement | default('htbp') }}]
\centering
\caption{ {{- table.caption | latexEscape }} }
\label{tab:{{ table.label }}}
\begin{tabular}{{{ table.columnSpec }}}
\toprule
{% for header in table.headers %}
{{ header }}{% if not loop.last %} & {% endif %}
{% endfor %} \\
\midrule
{% for row in table.data %}
{% for cell in row %}
{{ cell }}{% if not loop.last %} & {% endif %}
{% endfor %} \\
{% endfor %}
\bottomrule
\end{tabular}
\end{table}

{% endfor %}
```

## 🎯 Journal-Specific Templates

### Nature Template
```njk
---
to: journals/nature/{{ paperTitle | kebabCase }}.tex
---
\documentclass{nature}
\usepackage[utf8]{inputenc}
\usepackage{amsmath}
\usepackage{graphicx}

% Nature specific formatting
\title{ {{- title }} }
\author{ {{- authors | formatNatureAuthors }} }

\begin{document}

\maketitle

{{ abstract }}

{{ content }}

% Nature bibliography format
\bibliographystyle{naturemag}
\bibliography{references}

\end{document}
```

### IEEE Template
```njk
---
to: journals/ieee/{{ paperTitle | kebabCase }}.tex
---
\documentclass[journal]{IEEEtran}
\usepackage[utf8]{inputenc}
\usepackage{amsmath,amsfonts,amssymb}
\usepackage{graphicx}
\usepackage{cite}

% IEEE specific settings
\title{ {{- title }} }
\author{
{% for author in authors %}
\IEEEauthorblockN{ {{- author.name }} }
\IEEEauthorblockA{
{{ author.affiliation }}\\
{{ author.email }}
}{% if not loop.last %}\and{% endif %}
{% endfor %}
}

\begin{document}

\maketitle

\begin{abstract}
{{ abstract }}
\end{abstract}

\begin{IEEEkeywords}
{{ keywords | join(', ') }}
\end{IEEEkeywords}

{{ content }}

\bibliographystyle{IEEEtran}
\bibliography{references}

\end{document}
```

### AMS Template
```njk
---
to: journals/ams/{{ paperTitle | kebabCase }}.tex
---
\documentclass{amsart}
\usepackage[utf8]{inputenc}
\usepackage{amsmath,amssymb,amsthm}

% AMS theorem styles
\theoremstyle{plain}
\newtheorem{theorem}{Theorem}
\newtheorem{lemma}[theorem]{Lemma}
\newtheorem{corollary}[theorem]{Corollary}

\theoremstyle{definition}
\newtheorem{definition}[theorem]{Definition}

% AMS specific formatting
\title{ {{- title }} }
\author{ {{- authors | join(' \\and ') }} }
\address{ {{- primaryAffiliation }} }
\email{ {{- correspondingEmail }} }

\subjclass[2020]{ {{- mathSubjectClass }} }
\keywords{ {{- keywords | join(', ') }} }

\begin{document}

\maketitle

\begin{abstract}
{{ abstract }}
\end{abstract}

{{ content }}

\bibliographystyle{amsplain}
\bibliography{references}

\end{document}
```

## 🔧 Advanced Scientific Features

### Algorithm Typesetting
```latex
\usepackage{algorithm}
\usepackage{algorithmic}

\begin{algorithm}
\caption{{{ algorithmTitle }}}
\label{alg:{{ algorithmLabel }}}
\begin{algorithmic}[1]
\REQUIRE {{ algorithmInput }}
\ENSURE {{ algorithmOutput }}
\STATE Initialize variables
\FOR{each iteration}
  \STATE Perform computation
  \IF{condition met}
    \STATE Update result
  \ENDIF
\ENDFOR
\RETURN result
\end{algorithmic}
\end{algorithm}
```

### Code Listings
```latex
\usepackage{listings}
\usepackage{color}

\lstdefinestyle{pythonstyle}{
  language=Python,
  basicstyle=\ttfamily\footnotesize,
  commentstyle=\color{gray},
  keywordstyle=\color{blue},
  numberstyle=\tiny\color{gray},
  numbers=left,
  frame=single
}

\begin{lstlisting}[style=pythonstyle, caption={{ codeTitle }}, label=lst:{{ codeLabel }}]
{{ codeContent }}
\end{lstlisting}
```

### Multi-Column Equations
```latex
% For wide equations in two-column format
\begin{equation*}
\begin{aligned}
&\text{Long equation that spans multiple lines} \\
&\quad = \text{continuation of equation} \\
&\quad = \text{final result}
\end{aligned}
\end{equation*}
```

## 🎪 Template Automation Examples

### Multi-Paper Project
```njk
---
to: papers/{{ project }}/{{ paperType }}/{{ title | kebabCase }}.tex
---
{% set config = paperConfigs[paperType] %}

\documentclass[{{ config.fontSize }},{{ config.paperSize }}]{{{ config.documentClass }}}

{% for package in config.packages %}
\usepackage{ {{- package }} }
{% endfor %}

{% if config.biblatex %}
\usepackage[style={{ config.bibStyle }},backend=biber]{biblatex}
\addbibresource{{{ project }}-references.bib}
{% endif %}

% Custom commands for this project
{% for command in customCommands %}
\newcommand{\{{ command.name }}}{ {{- command.definition }} }
{% endfor %}

\title{ {{- title | latexEscape }} }
\author{ {{- authors | formatAuthors(config.authorFormat) }} }
{% if config.showDate %}
\date{ {{- date | formatDate(config.dateFormat) }} }
{% else %}
\date{}
{% endif %}

\begin{document}

\maketitle

{% if abstract %}
\begin{abstract}
{{ abstract }}
\end{abstract}
{% endif %}

{{ content }}

{% if config.biblatex %}
\printbibliography
{% else %}
\bibliographystyle{{{ config.bibStyle | default('plain') }}}
\bibliography{{{ project }}-references}
{% endif %}

\end{document}
```

### Collaborative Writing Template
```njk
---
to: collaborative/{{ project }}/{{ section }}.tex
---
% Section: {{ section | titleCase }}
% Author: {{ author }}
% Last modified: {{ now() | formatDate('YYYY-MM-DD') }}

{% if isMainFile %}
\documentclass[11pt]{article}
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage{subfiles}

\begin{document}

{% for section in sections %}
\subfile{{{ section }}.tex}
{% endfor %}

\end{document}
{% else %}
\documentclass[main.tex]{subfiles}

\begin{document}

\section{ {{- sectionTitle }} }
{{ content }}

\end{document}
{% endif %}
```

## 📊 Performance and Compatibility

### arXiv Submission Checklist
- [ ] Use standard document classes (`article`, `report`, `book`)
- [ ] Include only essential packages
- [ ] Avoid `hyperref` unless absolutely necessary
- [ ] Use `\bibliographystyle{plain}` for compatibility
- [ ] Compile with both TeX Live 2023 and 2025
- [ ] Check for overfull/underfull boxes
- [ ] Ensure all figures are in PDF format
- [ ] Validate all citations resolve correctly

### Common Issues and Solutions
| Issue | Cause | Solution |
|-------|-------|----------|
| Array package conflict | RevTeX with newer array | Use TeX Live 2023 or older array |
| Hyperref errors | Package conflicts | Load hyperref last or avoid |
| Font warnings | Missing fonts | Use standard CM fonts |
| Bibliography errors | Missing .bib entries | Validate all cite keys |
| Figure placement | Large figures | Use appropriate placement specifiers |

---

This guide covers all essential aspects of scientific document creation with LaTeX and arXiv compatibility. For troubleshooting specific issues, refer to the [Troubleshooting Guide](./troubleshooting.md).