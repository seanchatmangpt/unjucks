---
to: <%= dest %>/<%=  h.inflection.dasherize(h.changeCase.lower(title)) %>.tex
unless_exists: <%= !force %>
inject: <%= inject %>
---
<%# LaTeX Article Template with AI-Enhanced Structure %>
\documentclass[<%= documentOptions.fontsize || '11pt' %>,<%= documentOptions.papersize || 'a4paper' %><%= documentOptions.twoside ? ',twoside' : '' %>]{<%= documentOptions.documentclass || 'article' %>}

% Package imports - optimized for semantic document processing
<% packages.forEach(function(pkg) { -%>
\usepackage{<%= pkg %>}
<% }); -%>

% Document metadata
\title{<%= title %>}
\author{<%= author %>}
\date{<%= date || '\\today' %>}

% AI-enhanced document configuration
<% if (aiEnhanced) { -%>
% Document generated with AI assistance
% Semantic domain: <%= semanticDomain || 'academic' %>
% Template optimized for: <%= documentOptions.optimizedFor || 'readability and structure' %>
<% } -%>

% Hyperref setup (if enabled)
<% if (documentOptions.hyperref) { -%>
\hypersetup{
    colorlinks=true,
    linkcolor=blue,
    filecolor=magenta,
    urlcolor=cyan,
    citecolor=red,
    pdftitle={<%= title %>},
    pdfauthor={<%= author %>},
    pdfsubject={<%= abstract ? abstract.substring(0, 100) + '...' : 'Academic Document' %>},
    pdfkeywords={<%= keywords ? keywords.join(', ') : 'latex, document, academic' %>}
}
<% } -%>

% Bibliography setup (if enabled)
<% if (documentOptions.bibliography && references && references.length > 0) { -%>
\addbibresource{references.bib}
<% } -%>

\begin{document}

\maketitle

<% if (abstract) { -%>
\begin{abstract}
<%= abstract %>
\end{abstract}
<% } -%>

<% if (sections && sections.length > 0) { -%>
<% sections.forEach(function(section, index) { -%>
\section{<%= section.title %>}
<%= section.content || 'Content for ' + section.title + ' section.' %>

<% if (section.subsections && section.subsections.length > 0) { -%>
<% section.subsections.forEach(function(subsection) { -%>
\subsection{<%= subsection.title %>}
<%= subsection.content || 'Content for ' + subsection.title + ' subsection.' %>
<% }); -%>
<% } -%>

<% }); -%>
<% } else { -%>
\section{Introduction}
Introduction content goes here.

\section{Methodology}
Methodology content goes here.

\section{Results}
Results content goes here.

\section{Discussion}
Discussion content goes here.

\section{Conclusion}
Conclusion content goes here.
<% } -%>

% Bibliography (if enabled)
<% if (documentOptions.bibliography && references && references.length > 0) { -%>
\printbibliography
<% } -%>

\end{document}