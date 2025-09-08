# Legal Documents with LaTeX

Specialized guide for creating professional legal documents using LaTeX and Unjucks templates.

## ⚖️ Legal Document Types

### Appellate Briefs

**Document Class**: `lawbrief`  
**Key Features**:
- Automatic page numbering and margins
- Proper citation formatting
- Table of contents and authorities
- Statement of issues formatting

#### Template Structure
```latex
\documentclass[12pt]{lawbrief}
\usepackage{bluebook}
\usepackage{setspace}
\doublespacing

% Case information
\court{ {{- court }} }
\caseno{ {{- caseNumber }} }
\plaintiff{ {{- plaintiff }} }
\defendant{ {{- defendant }} }
\brieftype{ {{- briefType | default('Brief of Appellant') }} }

\begin{document}

% Automatic title page
\maketitle

% Table of contents
\tableofcontents
\newpage

% Table of authorities
\tableofauthorities
\newpage

\section{Statement of Issues}
{% for issue in issues %}
{{ loop.index }}. {{ issue }}

{% endfor %}

\section{Statement of Facts}
{{ factStatement }}

\section{Legal Analysis}
{% for argument in legalArguments %}
\subsection{ {{- argument.heading }} }
{{ argument.content }}

{% endfor %}

\section{Conclusion}
{{ conclusion }}

\end{document}
```

#### Unjucks Template Example
```njk
---
to: briefs/{{ caseNumber | kebabCase }}/{{ briefType | kebabCase }}.tex
---
\documentclass[12pt]{lawbrief}
\usepackage{bluebook}
\usepackage{setspace}
\doublespacing

\court{ {{- court | latexEscape }} }
\caseno{ {{- caseNumber }} }
\plaintiff{ {{- plaintiff | latexEscape }} }
\defendant{ {{- defendant | latexEscape }} }
\brieftype{ {{- briefType | default('Brief of Appellant') }} }
\attorney{ {{- attorney | latexEscape }} }
\firm{ {{- firm | latexEscape }} }
\address{ {{- address | latexEscape }} }

\begin{document}

\maketitle
\tableofcontents
\newpage
\tableofauthorities
\newpage

\section{Statement of Issues}
{% for issue in issues %}
{% set romanNumeral = loop.index | romanize %}
{{ romanNumeral }}. {{ issue | latexEscape }}

{% endfor %}

\section{Statement of Facts}
{{ factStatement }}

\section{Legal Analysis}
{% for argument in arguments %}
\subsection{ {{- argument.title | latexEscape }} }

\paragraph{Applicable Law}
{{ argument.law }}

\paragraph{Application to Facts}
{{ argument.application }}

{% endfor %}

\section{Conclusion}
{{ conclusion }}

\signature{ {{- attorney }} }{ {{- firm }} }

\end{document}
```

### Legal Memoranda

**Document Class**: `lawmemo`  
**Purpose**: Internal legal analysis, client advisories

```latex
\documentclass{lawmemo}
\usepackage{bluebook}

% Memo header information
\to{ {{- recipient }} }
\from{ {{- author }} }
\date{ {{- date | formatDate('MMMM D, YYYY') }} }
\re{ {{- subject }} }

\begin{document}

\memotitle

\section{Executive Summary}
{{ executiveSummary }}

\section{Legal Analysis}
{% for issue in legalIssues %}
\subsection{ {{- issue.question }} }

\paragraph{Brief Answer}
{{ issue.briefAnswer }}

\paragraph{Discussion}
{{ issue.discussion }}

{% endfor %}

\section{Recommendation}
{{ recommendation }}

\end{document}
```

### Contract Templates

**Document Class**: `contract`  
**Purpose**: Agreements, terms of service, employment contracts

```latex
\documentclass{contract}

% Contract metadata
\contracttitle{ {{- contractTitle }} }
\party{ {{- partyOne.name }} }
\partytwo{ {{- partyTwo.name }} }
\contractdate{ {{- date | formatDate('MMMM D, YYYY') }} }
\jurisdiction{ {{- jurisdiction }} }

\begin{document}

\contractheader

\section{Parties}
This agreement is entered into between {{ partyOne.name }}, a {{ partyOne.type }} 
(``{{ partyOne.shortName }}''), and {{ partyTwo.name }}, a {{ partyTwo.type }} 
(``{{ partyTwo.shortName }}'').

\section{Terms and Conditions}
{% for term in terms %}
\subsection{ {{- term.title }} }
{{ term.content }}

{% endfor %}

\section{Signatures}
\signaturepage

\end{document}
```

## 📚 Bluebook Citation System

### Case Citations

#### Basic Case Citation
```latex
\case{Miranda v. Arizona}{384 U.S. 436}{1966}
% Output: Miranda v. Arizona, 384 U.S. 436 (1966).
```

#### Case with Pin Cite
```latex
\casepin{Miranda v. Arizona}{384 U.S. 436}{444}{1966}
% Output: Miranda v. Arizona, 384 U.S. 436, 444 (1966).
```

#### Short Form Citations
```latex
\caseshort{Miranda}{384 U.S. at 444}
% Output: Miranda, 384 U.S. at 444.

\supra{Miranda}
% Output: Miranda, supra.

\id
% Output: Id.

\idat{445}
% Output: Id. at 445.
```

### Statutory Citations

```latex
\statute{42 U.S.C. § 1983}
% Output: 42 U.S.C. § 1983.

\statuteyear{42 U.S.C. § 1983}{2018}
% Output: 42 U.S.C. § 1983 (2018).

\codestatute{Americans with Disabilities Act § 101}{42 U.S.C. § 12111}
% Output: Americans with Disabilities Act § 101, 42 U.S.C. § 12111.
```

### Regulatory Citations

```latex
\regulation{29 C.F.R. § 1630.2}
% Output: 29 C.F.R. § 1630.2.

\federalregister{85 Fed. Reg. 68,292}{Dec. 4, 2020}
% Output: 85 Fed. Reg. 68,292 (Dec. 4, 2020).
```

### Law Review Citations

```latex
\lawreview{John Smith}{The Future of Contract Law}{95}{Harv. L. Rev.}{1234}{2022}
% Output: John Smith, The Future of Contract Law, 95 Harv. L. Rev. 1234 (2022).

\student{Jane Doe}{Note, Digital Privacy Rights}{108}{Yale L.J.}{567}{2023}
% Output: Jane Doe, Note, Digital Privacy Rights, 108 Yale L.J. 567 (2023).
```

### Template Integration Examples

#### Citation Database Template
```njk
---
to: citations/{{ caseType | kebabCase }}-citations.tex
---
% {{ caseType | titleCase }} Citations Database
% Generated on {{ now() | formatDate('YYYY-MM-DD') }}

{% for citation in citations %}
{% if citation.type == 'case' %}
\newcommand{\{{ citation.shortName }}}{%
  \case{ {{- citation.fullName }} }{ {{- citation.reporter }} }{ {{- citation.year }} }%
}
{% elif citation.type == 'statute' %}
\newcommand{\{{ citation.shortName }}}{%
  \statute{ {{- citation.code }} }%
}
{% elif citation.type == 'regulation' %}
\newcommand{\{{ citation.shortName }}}{%
  \regulation{ {{- citation.cfr }} }%
}
{% endif %}

{% endfor %}
```

#### Automatic Citation Generation
```njk
{% macro caseCite(case) %}
{% if case.pinCite %}
\casepin{ {{- case.name }} }{ {{- case.reporter }} }{ {{- case.pinCite }} }{ {{- case.year }} }
{% else %}
\case{ {{- case.name }} }{ {{- case.reporter }} }{ {{- case.year }} }
{% endif %}
{% endmacro %}

{% for case in cases %}
{{ caseCite(case) }}
{% endfor %}
```

## 🎯 Court-Specific Formatting

### Federal Courts

#### Supreme Court
```latex
\documentclass[12pt]{lawbrief}
\usepackage{bluebook}
\usepackage{setspace}
\doublespacing

% SCOTUS specific formatting
\court{Supreme Court of the United States}
\geometry{margin=1.5in}
\setlength{\parindent}{0.5in}
```

#### Circuit Courts
```latex
\court{United States Court of Appeals for the {{ circuit }} Circuit}
\caseno{No. {{ caseNumber }}}
\brieftype{Brief for {{ party }}}

% Circuit-specific rules
{% if circuit == 'Ninth' %}
\geometry{margin=1in}
{% else %}
\geometry{margin=1.5in}
{% endif %}
```

### State Courts

#### California
```latex
\court{{{ courtLevel }} of California}
{% if courtLevel == 'Supreme Court' %}
\caseno{S{{ caseNumber }}}
{% elif courtLevel == 'Court of Appeal' %}
\caseno{ {{- division }} Civ. No. {{ caseNumber }}}
{% endif %}
```

#### New York
```latex
\court{{{ courtName }}}
\county{ {{- county }} County}
{% if isAppellate %}
\caseno{Docket No. {{ caseNumber }}}
{% else %}
\caseno{Index No. {{ caseNumber }}}
{% endif %}
```

## 📋 Specialized Legal Environments

### Pleading Format
```latex
\newenvironment{pleading}[1]{%
  \begin{center}
  \textbf{#1}
  \end{center}
  \begin{enumerate}
}{%
  \end{enumerate}
}

% Usage
\begin{pleading}{FIRST CAUSE OF ACTION}
\item Plaintiff incorporates by reference paragraphs 1-10.
\item On or about {{ date }}, defendant breached the contract.
\item As a direct result, plaintiff suffered damages.
\end{pleading}
```

### Jury Instructions
```latex
\newenvironment{instruction}[1]{%
  \subsection{Instruction No. #1}
  \begin{quote}
}{%
  \end{quote}
}

% Usage
\begin{instruction}{2.01}
The plaintiff has the burden of proving each element of the claim 
by a preponderance of the evidence.
\end{instruction}
```

### Witness Examination
```latex
\newenvironment{examination}[2]{%
  \subsection{#1 of #2}
  \renewcommand{\labelenumi}{Q.\arabic{enumi}.}
  \renewcommand{\labelenumii}{A.}
  \begin{enumerate}
}{%
  \end{enumerate}
}
```

## 🔧 Template Automation Examples

### Multi-Document Brief Generation
```njk
---
to: {{ caseFolder }}/brief-{{ briefType | kebabCase }}.tex
---
\documentclass[12pt]{lawbrief}
\usepackage{bluebook}
\court{ {{- court }} }
\caseno{ {{- caseNumber }} }

\begin{document}

{% include 'legal/brief-header.tex.njk' %}

{% for section in briefSections %}
\section{ {{- section.title }} }
{% if section.subsections %}
{% for subsection in section.subsections %}
\subsection{ {{- subsection.title }} }
{{ subsection.content }}
{% endfor %}
{% else %}
{{ section.content }}
{% endif %}

{% endfor %}

{% include 'legal/brief-signature.tex.njk' %}

\end{document}
```

### Citation Validation Template
```njk
---
to: validation/{{ caseNumber }}-citation-check.tex
---
% Citation Validation Report for {{ caseName }}
% Generated: {{ now() | formatDate('YYYY-MM-DD HH:mm') }}

\documentclass{article}
\usepackage{bluebook}
\usepackage{longtable}

\begin{document}

\title{Citation Validation Report}
\author{Automated System}
\date{ {{- now() | formatDate('\\today') }} }
\maketitle

\section{Citation Summary}
\begin{longtable}{|l|l|l|}
\hline
\textbf{Citation} & \textbf{Type} & \textbf{Status} \\
\hline
{% for citation in citations %}
{{ citation.text | latexEscape }} & {{ citation.type }} & 
{% if citation.valid %}
Valid \\
{% else %}
\textcolor{red}{Invalid} \\
{% endif %}
\hline
{% endfor %}
\end{longtable}

\section{Validation Details}
{% for citation in citations %}
{% if not citation.valid %}
\subsection{Issue: {{ citation.text | latexEscape }}}
\textbf{Problem}: {{ citation.error }}
\textbf{Suggestion}: {{ citation.suggestion }}

{% endif %}
{% endfor %}

\end{document}
```

## 🎪 Advanced Legal Features

### Table of Authorities Generation
```latex
% Automatic TOA generation
\makeatletter
\newcommand{\addcase}[3]{%
  \addtocontents{toa}{\protect\contentsline{case}{#1, #2 (#3)}{\thepage}}%
}
\newcommand{\addstatute}[1]{%
  \addtocontents{toa}{\protect\contentsline{statute}{#1}{\thepage}}%
}
\makeatother

% Usage in templates
{% for case in citedCases %}
\addcase{ {{- case.name }} }{ {{- case.reporter }} }{ {{- case.year }} }
{% endfor %}
```

### Cross-Reference System
```latex
\newcommand{\factref}[1]{\textbf{Fact \ref{fact:#1}}}
\newcommand{\argref}[1]{\textbf{Argument \ref{arg:#1}}}

% Template usage
\label{fact:contract-signing}
As discussed in \factref{contract-signing}, the parties agreed...

\label{arg:breach-damages}
Building on \argref{breach-damages}, plaintiff seeks...
```

### Conditional Formatting
```njk
{% if jurisdiction == 'federal' %}
\usepackage{federal-rules}
{% elif jurisdiction == 'california' %}
\usepackage{california-rules}
{% endif %}

{% if hasExhibits %}
\usepackage{exhibits}
\exhibitspath{exhibits/}
{% endif %}

{% if citationStyle == 'bluebook' %}
\usepackage{bluebook}
{% elif citationStyle == 'alwd' %}
\usepackage{alwd}
{% endif %}
```

## 📊 Legal Document Metrics

### Performance Characteristics
| Document Type | Avg Pages | Compile Time | Complexity |
|---------------|-----------|--------------|------------|
| **Motion** | 5-15 | 2-5s | Low |
| **Brief** | 20-50 | 10-30s | Medium |
| **Contract** | 10-100 | 5-20s | Medium |
| **Pleading** | 5-20 | 3-8s | Low |

### Common Issues and Solutions
| Issue | Cause | Solution |
|-------|-------|----------|
| Citation format errors | Missing bluebook package | Add `\usepackage{bluebook}` |
| Spacing problems | Wrong line spacing | Use `\doublespacing` for briefs |
| Page numbering | Incorrect margins | Use court-specific geometry |
| TOC generation | Missing `\tableofcontents` | Add after title page |

---

This guide covers the essential aspects of legal document creation with LaTeX in Unjucks. For technical troubleshooting, refer to the [Troubleshooting Guide](./troubleshooting.md).