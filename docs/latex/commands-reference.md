# LaTeX Commands & Options Reference

Complete reference for all LaTeX commands, environments, and packages supported in Unjucks.

## 📚 Document Classes

### Core Document Classes

#### `\documentclass{article}`
**Purpose**: Standard articles, papers, reports  
**Options**: 
- `10pt`, `11pt`, `12pt` - Font sizes
- `a4paper`, `letterpaper` - Paper sizes
- `twocolumn` - Two-column layout
- `twoside` - Two-sided printing
- `draft` - Draft mode with overfull boxes shown

**Example**:
```latex
\documentclass[11pt,a4paper,twoside]{article}
```

#### `\documentclass{report}`
**Purpose**: Multi-chapter reports, theses  
**Options**: Same as article, plus:
- `openright` - Chapters start on odd pages
- `openany` - Chapters start on any page

#### `\documentclass{book}`
**Purpose**: Books, long documents with parts  
**Options**: Same as report, plus:
- `oneside` - Single-sided book

### Legal Document Classes (LawTeX)

#### `\documentclass{lawbrief}`
**Purpose**: Appellate briefs, trial briefs  
**Options**:
- `12pt` - Required 12pt font for most courts
- `doublespace` - Double spacing
- `singlespace` - Single spacing (rare)

**Commands**:
```latex
\court{Supreme Court of State}
\caseno{No. 2024-123}
\plaintiff{John Doe}
\defendant{Jane Smith}
\brieftype{Brief of Appellant}
```

#### `\documentclass{lawmemo}`
**Purpose**: Legal memoranda, office documents  
**Options**: Similar to lawbrief but for internal use

#### `\documentclass{contract}`
**Purpose**: Contracts, agreements  
**Commands**:
```latex
\party{First Party Name}
\partytwo{Second Party Name}
\contractdate{\today}
\jurisdiction{State of California}
```

## 📦 Essential Packages

### Mathematics Packages

#### `\usepackage{amsmath}`
**Purpose**: Enhanced math environments and commands  
**Key Commands**:
- `\begin{align}...\end{align}` - Multi-line equations
- `\begin{gather}...\end{gather}` - Centered equations
- `\begin{split}...\end{split}` - Split long equations
- `\DeclareMathOperator{\name}{symbol}` - Custom operators

**Example**:
```latex
\begin{align}
f(x) &= ax^2 + bx + c \\
f'(x) &= 2ax + b \\
f''(x) &= 2a
\end{align}
```

#### `\usepackage{amssymb}`
**Purpose**: Extended mathematical symbols  
**Key Symbols**:
- `\mathbb{R}` - Blackboard bold (ℝ, ℕ, ℤ, ℚ, ℂ)
- `\mathcal{A}` - Calligraphic letters
- `\mathfrak{g}` - Fraktur letters
- `\varnothing` - Empty set symbol

#### `\usepackage{amsthm}`
**Purpose**: Theorem environments  
**Commands**:
```latex
\newtheorem{theorem}{Theorem}[section]
\newtheorem{lemma}[theorem]{Lemma}
\newtheorem{corollary}[theorem]{Corollary}
\newtheorem{definition}[theorem]{Definition}

\begin{theorem}
Every bounded sequence has a convergent subsequence.
\end{theorem}

\begin{proof}
Proof content here.
\end{proof}
```

#### `\usepackage{mathtools}`
**Purpose**: Fixes amsmath issues and adds features  
**Key Features**:
- `\DeclarePairedDelimiter{\abs}{\lvert}{\rvert}` - Auto-sizing delimiters
- `\mathllap`, `\mathrlap`, `\mathclap` - Math overlaps
- Enhanced matrix environments

### Document Layout Packages

#### `\usepackage{geometry}`
**Purpose**: Page layout control  
**Options**:
```latex
\usepackage[
  margin=1in,
  top=1.5in,
  bottom=1in,
  left=1.25in,
  right=1.25in,
  includeheadfoot
]{geometry}
```

**Commands**:
```latex
\newgeometry{margin=0.5in}  % Change mid-document
\restoregeometry            % Restore original
```

#### `\usepackage{setspace}`
**Purpose**: Line spacing control  
**Commands**:
```latex
\singlespacing
\onehalfspacing
\doublespacing
\setstretch{1.25}           % Custom spacing
```

#### `\usepackage{fancyhdr}`
**Purpose**: Headers and footers  
**Setup**:
```latex
\usepackage{fancyhdr}
\pagestyle{fancy}
\fancyhf{}                  % Clear all fields
\fancyhead[L]{Left Header}
\fancyhead[C]{Center Header}
\fancyhead[R]{Right Header}
\fancyfoot[C]{\thepage}
```

### Graphics and Floats

#### `\usepackage{graphicx}`
**Purpose**: Image inclusion  
**Commands**:
```latex
\includegraphics[width=0.8\textwidth]{filename}
\includegraphics[height=3cm]{filename}
\includegraphics[scale=0.5]{filename}
\includegraphics[angle=90]{filename}
```

**Supported formats**: PDF, PNG, JPG (with pdflatex)

#### `\usepackage{float}`
**Purpose**: Float control  
**Commands**:
- `\begin{figure}[H]` - Force here placement
- `\begin{table}[htbp]` - Placement specifiers
- `\floatbarrier` - Prevent floats from crossing

### Legal Citation Packages

#### `\usepackage{bluebook}` (LawTeX)
**Purpose**: Automatic Bluebook citations  
**Commands**:
```latex
\case{Miranda v. Arizona}{384 U.S. 436}{1966}
\statute{42 U.S.C. § 1983}
\regulation{29 C.F.R. § 1630.2}
\law{Americans with Disabilities Act}{42 U.S.C. § 12101}

% Short form citations
\caseshort{Miranda}{384 U.S. at 444}
\supra{Miranda}
\infra{Discussion}
```

**Citation Types**:
- Cases: `\case{name}{citation}{year}`
- Statutes: `\statute{citation}`
- Regulations: `\regulation{citation}`
- Books: `\book{author}{title}{year}`
- Law reviews: `\lawreview{author}{title}{volume}{journal}{page}{year}`

### Bibliography Packages

#### `\usepackage{biblatex}`
**Purpose**: Modern bibliography system  
**Setup**:
```latex
\usepackage[style=authoryear,backend=biber]{biblatex}
\addbibresource{references.bib}
```

**Commands**:
```latex
\cite{key}              % Standard citation
\textcite{key}          % In-text citation
\parencite{key}         % Parenthetical citation
\footcite{key}          % Footnote citation
\printbibliography      % Print bibliography
```

**Styles**: `authoryear`, `numeric`, `alphabetic`, `apa`, `mla`

#### `\usepackage{natbib}`
**Purpose**: Author-year citations  
**Commands**:
```latex
\citet{key}             % Author (year)
\citep{key}             % (Author, year)
\citealt{key}           % Author year
\citealp{key}           % Author, year
\citeauthor{key}        % Author
\citeyear{key}          % year
```

## 🏗️ Document Structure Commands

### Sectioning Commands

```latex
\part{Part Title}              % Level -1 (books only)
\chapter{Chapter Title}        % Level 0 (books and reports)
\section{Section Title}        % Level 1
\subsection{Subsection}        % Level 2
\subsubsection{Subsubsection}  % Level 3
\paragraph{Paragraph}          % Level 4
\subparagraph{Subparagraph}    % Level 5
```

**Numbering Control**:
```latex
\section*{Unnumbered Section}
\setcounter{secnumdepth}{3}    % Number down to subsubsection
\setcounter{tocdepth}{2}       % TOC includes subsections
```

### Cross-References

```latex
\label{sec:intro}              % Create label
\ref{sec:intro}                % Reference section number
\pageref{sec:intro}            % Reference page number
\nameref{sec:intro}            % Reference section title (nameref package)

% Enhanced references (cleveref package)
\cref{sec:intro}               % Smart reference
\Cref{sec:intro}               % Capitalized reference
```

### Table of Contents

```latex
\tableofcontents               % Generate TOC
\listoffigures                 % List of figures
\listoftables                  % List of tables

% Custom TOC entries
\addcontentsline{toc}{section}{Custom Entry}
```

## 🧮 Mathematical Environments

### Equation Environments

#### Single Equations
```latex
% Inline math
$E = mc^2$

% Display equations
\begin{equation}
E = mc^2
\label{eq:einstein}
\end{equation}

% Unnumbered display
\begin{equation*}
E = mc^2
\end{equation*}

% Alternative syntax
\[ E = mc^2 \]
```

#### Multi-line Equations
```latex
% Aligned equations
\begin{align}
a &= b + c \\
d &= e + f
\end{align}

% Gathered equations (centered)
\begin{gather}
a = b + c \\
d = e + f
\end{gather}

% Cases
\begin{equation}
f(x) = \begin{cases}
x^2 & \text{if } x \geq 0 \\
-x^2 & \text{if } x < 0
\end{cases}
\end{equation}
```

### Matrix Environments
```latex
\begin{pmatrix}  % Parentheses
a & b \\
c & d
\end{pmatrix}

\begin{bmatrix}  % Brackets
a & b \\
c & d
\end{bmatrix}

\begin{vmatrix}  % Determinant
a & b \\
c & d
\end{vmatrix}
```

## 📋 List Environments

### Basic Lists
```latex
% Unordered list
\begin{itemize}
\item First item
\item Second item
  \begin{itemize}
  \item Nested item
  \end{itemize}
\end{itemize}

% Ordered list
\begin{enumerate}
\item First item
\item Second item
\end{enumerate}

% Description list
\begin{description}
\item[Term] Definition
\item[Another term] Another definition
\end{description}
```

### Custom Lists
```latex
% Custom enumerate
\begin{enumerate}[label=(\roman*)]
\item Roman numerals in parentheses
\end{enumerate}

% Custom itemize
\begin{itemize}[label=\textbullet]
\item Bullet points
\end{itemize}
```

## 🎨 Font and Text Formatting

### Font Families
```latex
\textrm{Roman family}          % \rmfamily
\textsf{Sans serif family}     % \sffamily
\texttt{Typewriter family}     % \ttfamily
```

### Font Series and Shape
```latex
\textbf{Bold text}             % \bfseries
\textit{Italic text}           % \itshape
\textsl{Slanted text}          % \slshape
\textsc{Small caps}            % \scshape
```

### Font Sizes
```latex
{\tiny tiny text}
{\scriptsize script size}
{\footnotesize footnote size}
{\small small text}
{\normalsize normal text}
{\large large text}
{\Large Large text}
{\LARGE LARGE text}
{\huge huge text}
{\Huge Huge text}
```

## 🔗 Special Characters and Symbols

### LaTeX Special Characters
```latex
\$  \&  \%  \#  \_  \{  \}     % Literal symbols
\textbackslash                  % Backslash
\textasciitilde                % Tilde
\textasciicircum               % Caret
```

### Accents and International Characters
```latex
\'{a}  \'a                     % Acute accent: á
\`{a}  \`a                     % Grave accent: à
\^{a}  \^a                     % Circumflex: â
\"{a}  \"a                     % Umlaut: ä
\~{a}  \~a                     % Tilde: ã
\={a}  \=a                     % Macron: ā
\.{a}  \.a                     % Dot: ȧ
\v{a}  \va                     % Caron: ǎ
```

## 📊 Table Environments

### Basic Tables
```latex
\begin{tabular}{|l|c|r|}
\hline
Left & Center & Right \\
\hline
Data & Data & Data \\
More & Data & Here \\
\hline
\end{tabular}
```

### Enhanced Tables (booktabs package)
```latex
\begin{tabular}{lcc}
\toprule
Item & Quantity & Price \\
\midrule
Widget & 5 & \$10.00 \\
Gadget & 2 & \$25.00 \\
\bottomrule
\end{tabular}
```

### Table Positioning
```latex
\begin{table}[htbp]
\centering
\caption{Table Caption}
\label{tab:mytable}
\begin{tabular}{...}
...
\end{tabular}
\end{table}
```

## 🎯 Template Integration Examples

### Variable Substitution
```njk
\documentclass[{{ fontSize | default('11pt') }}]{article}
\title{ {{- title | latexEscape }} }
\author{ {{- authors | join(', ') | latexEscape }} }

{% if mathMode %}
\usepackage{amsmath,amssymb,amsthm}
{% endif %}

{% if hasFigures %}
\usepackage{graphicx}
{% endif %}
```

### Conditional Package Loading
```njk
{% if documentType == 'legal' %}
\usepackage{bluebook}
\usepackage{setspace}
\doublespacing
{% elif documentType == 'scientific' %}
\usepackage{amsmath,amssymb}
\usepackage{biblatex}
{% endif %}
```

### Dynamic Content Generation
```njk
{% for section in sections %}
\section{ {{- section.title | latexEscape }} }
{{ section.content }}

{% if section.hasSubsections %}
{% for subsection in section.subsections %}
\subsection{ {{- subsection.title | latexEscape }} }
{{ subsection.content }}
{% endfor %}
{% endif %}
{% endfor %}
```

## 🎪 Advanced Features

### Custom Commands
```latex
% Define new commands
\newcommand{\ve}[1]{\mathbf{#1}}          % Bold vectors
\newcommand{\abs}[1]{\left|#1\right|}     % Absolute value
\newcommand{\norm}[1]{\left\|#1\right\|}  % Norm

% Renewed commands
\renewcommand{\abstract}[1]{%
  \begin{center}
  \textbf{Abstract}
  \end{center}
  #1
}
```

### Custom Environments
```latex
\newenvironment{myenv}[1][default]{%
  \begin{center}
  \textbf{#1}
  \hrule
}{%
  \hrule
  \end{center}
}
```

### Counters
```latex
\newcounter{mycounter}
\setcounter{mycounter}{5}
\addtocounter{mycounter}{3}
\stepcounter{mycounter}
\refstepcounter{mycounter}
\themycounter                              % Display counter
```

---

This reference covers the essential LaTeX commands and options needed for document generation in Unjucks. For specific use cases, refer to the [Legal Documents Guide](./legal-documents.md) or [Scientific Papers Guide](./arxiv-scientific.md).