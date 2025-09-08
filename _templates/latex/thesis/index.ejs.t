---
to: <%= dest %>/<%=  h.inflection.dasherize(h.changeCase.lower(title)) %>-thesis.tex
unless_exists: <%= !force %>
inject: <%= inject %>
---
<%# LaTeX Thesis Template with Advanced Structure %>
\documentclass[<%= documentOptions.fontsize || '12pt' %>,<%= documentOptions.papersize || 'a4paper' %>,oneside]{<%= documentOptions.documentclass || 'report' %>}

% Advanced package imports for thesis
<% packages.forEach(function(pkg) { -%>
\usepackage{<%= pkg %>}
<% }); -%>
% Additional thesis-specific packages
\usepackage{setspace}
\usepackage{titlesec}
\usepackage{geometry}
\usepackage{fancyhdr}

% Page geometry for thesis
\geometry{
    top=1.5in,
    bottom=1in,
    left=1.5in,
    right=1in
}

% Double spacing for thesis
\doublespacing

% Chapter formatting
\titleformat{\chapter}[display]
  {\normalfont\huge\bfseries}{\chaptertitlename\ \thechapter}{20pt}{\Huge}

% Document metadata
\title{<%= title %>}
\author{<%= author %>}
<% if (degree) { -%>
\newcommand{\degree}{<%= degree %>}
<% } -%>
<% if (department) { -%>
\newcommand{\department}{<%= department %>}
<% } -%>
<% if (university) { -%>
\newcommand{\university}{<%= university %>}
<% } -%>
<% if (advisor) { -%>
\newcommand{\advisor}{<%= advisor %>}
<% } -%>
\date{<%= date || new Date().getFullYear() %>}

% AI-enhanced thesis configuration
<% if (aiEnhanced) { -%>
% Thesis generated with AI assistance
% Semantic domain: <%= semanticDomain || 'academic' %>
% Research area: <%= researchArea || 'interdisciplinary' %>
<% } -%>

% Bibliography setup
<% if (documentOptions.bibliography) { -%>
\usepackage[backend=biber,style=ieee,sorting=ynt]{biblatex}
\addbibresource{references.bib}
<% } -%>

\begin{document}

% Title page
\begin{titlepage}
    \centering
    \vspace*{1in}
    
    {\LARGE\bfseries <%= title %>}
    
    \vspace{1in}
    
    {\Large by}
    
    \vspace{0.5in}
    
    {\Large\bfseries <%= author %>}
    
    \vspace{1in}
    
    <% if (degree && department && university) { -%>
    {\large A thesis submitted in partial fulfillment of the requirements \\
    for the degree of <%= degree %> \\
    in <%= department %>}
    
    \vspace{1in}
    
    {\large <%= university %>}
    <% } -%>
    
    \vspace{0.5in}
    
    {\large <%= date || new Date().getFullYear() %>}
    
\end{titlepage}

% Copyright page
\newpage
\thispagestyle{empty}
\vspace*{\fill}
\begin{center}
Copyright \copyright\ <%= date || new Date().getFullYear() %> <%= author %>
\end{center}
\vspace*{\fill}

% Abstract
<% if (abstract) { -%>
\newpage
\chapter*{Abstract}
\addcontentsline{toc}{chapter}{Abstract}
<%= abstract %>
<% } -%>

% Acknowledgments
\newpage
\chapter*{Acknowledgments}
\addcontentsline{toc}{chapter}{Acknowledgments}
<%= acknowledgments || 'I would like to thank my advisor and committee members for their guidance and support throughout this research.' %>

% Table of Contents
\newpage
\tableofcontents

% List of Figures (if figures are included)
<% if (documentOptions.figures) { -%>
\newpage
\listoffigures
<% } -%>

% List of Tables (if tables are included)
<% if (documentOptions.tables) { -%>
\newpage
\listoftables
<% } -%>

% Main content chapters
<% if (chapters && chapters.length > 0) { -%>
<% chapters.forEach(function(chapter, index) { -%>
\chapter{<%= chapter.title %>}
<%= chapter.content || 'Chapter content goes here.' %>

<% if (chapter.sections && chapter.sections.length > 0) { -%>
<% chapter.sections.forEach(function(section) { -%>
\section{<%= section.title %>}
<%= section.content || 'Section content goes here.' %>

<% if (section.subsections && section.subsections.length > 0) { -%>
<% section.subsections.forEach(function(subsection) { -%>
\subsection{<%= subsection.title %>}
<%= subsection.content || 'Subsection content goes here.' %>
<% }); -%>
<% } -%>
<% }); -%>
<% } -%>

<% }); -%>
<% } else { -%>
\chapter{Introduction}
\label{ch:introduction}

This chapter introduces the research problem and objectives.

\section{Background}
Background information about the research area.

\section{Problem Statement}
Clear statement of the research problem.

\section{Research Objectives}
List of research objectives and goals.

\section{Thesis Organization}
Overview of the thesis structure.

\chapter{Literature Review}
\label{ch:literature}

This chapter reviews relevant literature and prior work.

\section{Related Work}
Discussion of related research and methodologies.

\section{Research Gap}
Identification of gaps in current knowledge.

\chapter{Methodology}
\label{ch:methodology}

This chapter describes the research methodology and approach.

\section{Research Design}
Description of the research design and framework.

\section{Data Collection}
Methods for data collection and analysis.

\chapter{Results and Analysis}
\label{ch:results}

This chapter presents the research results and analysis.

\section{Experimental Results}
Presentation of experimental findings.

\section{Analysis and Discussion}
Analysis and interpretation of results.

\chapter{Conclusion and Future Work}
\label{ch:conclusion}

This chapter concludes the thesis and suggests future research directions.

\section{Summary of Contributions}
Summary of research contributions.

\section{Future Research Directions}
Suggestions for future work.
<% } -%>

% Bibliography
<% if (documentOptions.bibliography) { -%>
\printbibliography[title=References]
\addcontentsline{toc}{chapter}{References}
<% } -%>

% Appendices (if any)
<% if (appendices && appendices.length > 0) { -%>
\appendix
<% appendices.forEach(function(appendix, index) { -%>
\chapter{<%= appendix.title %>}
\label{app:<%= appendix.id || ('appendix-' + (index + 1)) %>}
<%= appendix.content || 'Appendix content goes here.' %>
<% }); -%>
<% } -%>

\end{document}