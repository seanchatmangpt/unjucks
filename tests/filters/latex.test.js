/**
 * Test suite for LaTeX filters
 * Tests all LaTeX filter functionality including escaping, math, citations, and academic formatting
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LaTeXFilters, createLaTeXFilters } from '../../src/lib/filters/latex.js';

describe('LaTeX Filters', () => {
  let filters;
  let latexFilters;

  beforeEach(() => {
    latexFilters = new LaTeXFilters();
    filters = latexFilters.getAllFilters();
  });

  describe('texEscape filter', () => {
    it('should escape LaTeX special characters', () => {
      expect(filters.texEscape('Hello & World')).toBe('Hello \\& World');
      expect(filters.texEscape('$100 & 50%')).toBe('\\$100 \\& 50\\%');
      expect(filters.texEscape('C++ & C#')).toBe('C\\textasciicircum{}\\textasciicircum{} \\& C\\#');
      expect(filters.texEscape('user_name')).toBe('user\\_name');
      expect(filters.texEscape('~/.bashrc')).toBe('\\textasciitilde{}/.bashrc');
    });

    it('should handle empty or null input', () => {
      expect(filters.texEscape('')).toBe('');
      expect(filters.texEscape(null)).toBe('');
      expect(filters.texEscape(undefined)).toBe('');
    });

    it('should handle complex text with multiple special characters', () => {
      const input = 'Cost: $50 & tax: 10% {total: $55}';
      const expected = 'Cost: \\$50 \\& tax: 10\\% \\{total: \\$55\\}';
      expect(filters.texEscape(input)).toBe(expected);
    });
  });

  describe('mathMode filter', () => {
    it('should create inline math mode by default', () => {
      expect(filters.mathMode('x + y = z')).toBe('$x + y = z$');
      expect(filters.mathMode('\\alpha + \\beta')).toBe('$\\alpha + \\beta$');
    });

    it('should create display math mode when inline is false', () => {
      expect(filters.mathMode('x + y = z', false)).toBe('\\[x + y = z\\]');
      expect(filters.mathMode('\\sum_{i=1}^n x_i', false)).toBe('\\[\\sum_{i=1}^n x_i\\]');
    });

    it('should handle empty input', () => {
      expect(filters.mathMode('')).toBe('');
      expect(filters.mathMode(null)).toBe('');
    });

    it('should trim whitespace', () => {
      expect(filters.mathMode('  x + y  ')).toBe('$x + y$');
    });
  });

  describe('mathEnvironment filter', () => {
    it('should create equation environment by default', () => {
      const result = filters.mathEnvironment('x + y = z');
      expect(result).toBe('\\begin{equation}\nx + y = z\n\\end{equation}');
    });

    it('should create specified environment', () => {
      const result = filters.mathEnvironment('x + y = z\\\\a + b = c', 'align');
      expect(result).toBe('\\begin{align}\nx + y = z\\\\a + b = c\n\\end{align}');
    });

    it('should create unnumbered environment', () => {
      const result = filters.mathEnvironment('x + y = z', 'equation', false);
      expect(result).toBe('\\begin{equation*}\nx + y = z\n\\end{equation*}');
    });

    it('should handle matrix environments', () => {
      const content = '1 & 2 \\\\ 3 & 4';
      const result = filters.mathEnvironment(content, 'pmatrix');
      expect(result).toBe('\\begin{pmatrix}\n1 & 2 \\\\ 3 & 4\n\\end{pmatrix}');
    });
  });

  describe('citation filter', () => {
    it('should create standard citations', () => {
      expect(filters.citation('smith2020')).toBe('\\cite{smith2020}');
      expect(filters.citation(['smith2020', 'jones2021'])).toBe('\\cite{smith2020,jones2021}');
    });

    it('should create natbib citations', () => {
      expect(filters.citation('smith2020', 'natbib')).toBe('\\citep{smith2020}');
      expect(filters.citation('smith2020', 'author')).toBe('\\citet{smith2020}');
      expect(filters.citation('smith2020', 'year')).toBe('\\citeyear{smith2020}');
    });

    it('should create biblatex citations', () => {
      expect(filters.citation('smith2020', 'biblatex')).toBe('\\autocite{smith2020}');
      expect(filters.citation('smith2020', 'footnote')).toBe('\\footcite{smith2020}');
    });

    it('should handle citations with prefix and suffix', () => {
      expect(filters.citation('smith2020', 'natbib', 'see', 'p. 15')).toBe('\\citep[see][p. 15]{smith2020}');
    });

    it('should create author-year citations', () => {
      expect(filters.citation('smith2020', 'author-year')).toBe('\\citeauthor{smith2020} (\\citeyear{smith2020})');
    });
  });

  describe('latexCommand filter', () => {
    it('should create simple commands', () => {
      expect(filters.latexCommand('Bold Text', 'textbf')).toBe('\\textbf{Bold Text}');
      expect(filters.latexCommand('Italic Text', 'textit')).toBe('\\textit{Italic Text}');
    });

    it('should handle commands with optional arguments', () => {
      const options = { optional: ['1in'] };
      expect(filters.latexCommand('', 'vspace', options)).toBe('\\vspace[1in]{}');
    });

    it('should handle commands with required arguments', () => {
      const options = { args: ['2'] };
      expect(filters.latexCommand('Content', 'parbox', options)).toBe('\\parbox{2}{Content}');
    });

    it('should handle commands with both optional and required arguments', () => {
      const options = { optional: ['t'], args: ['2in'] };
      expect(filters.latexCommand('Text', 'minipage', options)).toBe('\\minipage[t]{2in}{Text}');
    });
  });

  describe('environment filter', () => {
    it('should create simple environments', () => {
      const result = filters.environment('Item 1\nItem 2', 'itemize');
      expect(result).toBe('\\begin{itemize}\nItem 1\nItem 2\n\\end{itemize}');
    });

    it('should handle environments with options', () => {
      const options = { optional: ['label=\\arabic*.'] };
      const result = filters.environment('Item 1', 'enumerate', options);
      expect(result).toBe('\\begin{enumerate}[label=\\arabic*.]\nItem 1\n\\end{enumerate}');
    });

    it('should handle environments with arguments', () => {
      const options = { args: ['ccc'] };
      const result = filters.environment('1 & 2 & 3 \\\\', 'array', options);
      expect(result).toBe('\\begin{array}{ccc}\n1 & 2 & 3 \\\\\n\\end{array}');
    });
  });

  describe('documentClass filter', () => {
    it('should create document class without options', () => {
      expect(filters.documentClass(null, 'article')).toBe('\\documentclass{article}');
      expect(filters.documentClass(null, 'book')).toBe('\\documentclass{book}');
    });

    it('should handle string options', () => {
      expect(filters.documentClass('12pt,a4paper', 'article')).toBe('\\documentclass[12pt,a4paper]{article}');
    });

    it('should handle object options', () => {
      const options = { fontsize: '12pt', paper: 'a4paper', twoside: true };
      const result = filters.documentClass(options, 'article');
      expect(result).toBe('\\documentclass[fontsize=12pt,paper=a4paper,twoside]{article}');
    });

    it('should use default document class', () => {
      expect(filters.documentClass()).toBe('\\documentclass{article}');
    });
  });

  describe('bibtex filter', () => {
    it('should create BibTeX entries', () => {
      const entry = {
        type: 'article',
        key: 'smith2020',
        title: 'A Great Paper',
        author: 'John Smith',
        journal: 'Journal of Science',
        year: '2020',
        volume: '10',
        pages: '1--10'
      };

      const result = filters.bibtex(entry);
      expect(result).toContain('@article{smith2020,');
      expect(result).toContain('title = {A Great Paper},');
      expect(result).toContain('author = {John Smith},');
      expect(result).toContain('year = 2020,');
    });

    it('should handle numeric fields properly', () => {
      const entry = {
        type: 'book',
        key: 'book2020',
        title: 'Book Title',
        year: '2020',
        pages: '300'
      };

      const result = filters.bibtex(entry);
      expect(result).toContain('year = 2020,');
      expect(result).toContain('pages = 300,');
    });

    it('should skip empty fields', () => {
      const entry = {
        type: 'article',
        key: 'minimal2020',
        title: 'Title',
        author: '',
        year: '2020'
      };

      const result = filters.bibtex(entry);
      expect(result).not.toContain('author =');
      expect(result).toContain('title = {Title},');
    });
  });

  describe('biblatex filter', () => {
    it('should create biblatex entries with enhanced features', () => {
      const entry = {
        type: 'article',
        key: 'modern2020',
        title: 'Modern Paper',
        author: 'Jane Doe',
        date: '2020-05-15',
        doi: '10.1000/182',
        url: 'https://example.com',
        keywords: ['keyword1', 'keyword2']
      };

      const result = filters.biblatex(entry);
      expect(result).toContain('@article{modern2020,');
      expect(result).toContain('date = {2020-05-15},');
      expect(result).toContain('keywords = {keyword1, keyword2},');
      expect(result).toContain('doi = {10.1000/182},');
    });

    it('should handle arXiv preprints', () => {
      const entry = {
        type: 'article',
        key: 'arxiv2020',
        title: 'Preprint Paper',
        author: 'Author Name',
        date: '2020',
        eprint: '2020.12345',
        eprinttype: 'arxiv',
        eprintclass: 'math.AG'
      };

      const result = filters.biblatex(entry);
      expect(result).toContain('eprint = {2020.12345},');
      expect(result).toContain('eprinttype = {arxiv},');
    });
  });

  describe('bluebook filter', () => {
    it('should format case citations', () => {
      const caseData = {
        caseName: 'Brown v. Board of Education',
        citation: '347 U.S. 483',
        court: 'U.S.',
        year: '1954'
      };

      const result = filters.bluebook(caseData, 'case');
      expect(result).toContain('\\emph{Brown v. Board of Education}');
      expect(result).toContain('347 U.S. 483');
      expect(result).toContain('(U.S. 1954)');
    });

    it('should format statute citations', () => {
      const statute = {
        title: '42 U.S.C.',
        section: '1983',
        publisher: 'West',
        year: '2020'
      };

      const result = filters.bluebook(statute, 'statute');
      expect(result).toBe('42 U.S.C. \\S 1983 (West 2020)');
    });

    it('should format book citations', () => {
      const book = {
        author: 'John Doe',
        title: 'Legal Treatise',
        publisher: 'Legal Press',
        year: '2020',
        pages: '123-45'
      };

      const result = filters.bluebook(book, 'book');
      expect(result).toContain('JOHN DOE');
      expect(result).toContain('\\textsc{Legal Treatise}');
      expect(result).toContain('123-45');
      expect(result).toContain('(Legal Press 2020)');
    });

    it('should format article citations', () => {
      const article = {
        author: 'Jane Smith',
        title: 'Important Article',
        journal: 'Law Review',
        volume: '100',
        pages: '456',
        year: '2020'
      };

      const result = filters.bluebook(article, 'article');
      expect(result).toContain('Jane Smith');
      expect(result).toContain('\\emph{Important Article}');
      expect(result).toContain('Law Review, 100 456 (2020)');
    });
  });

  describe('arXivMeta filter', () => {
    it('should format arXiv string ID', () => {
      expect(filters.arXivMeta('2020.12345')).toBe('arXiv:2020.12345');
    });

    it('should format complete arXiv metadata', () => {
      const arxiv = {
        id: '2020.12345',
        category: 'math.AG',
        version: '2',
        title: 'Amazing Mathematical Result',
        authors: ['John Mathematician', 'Jane Theorist'],
        abstract: 'This paper proves something amazing.',
        doi: '10.1000/182'
      };

      const result = filters.arXivMeta(arxiv);
      expect(result).toContain('\\title{Amazing Mathematical Result}');
      expect(result).toContain('\\author{John Mathematician, Jane Theorist}');
      expect(result).toContain('\\texttt{arXiv:2020.12345v2 [math.AG]}');
      expect(result).toContain('\\texttt{doi:10.1000/182}');
      expect(result).toContain('\\begin{abstract}\nThis paper proves something amazing.\n\\end{abstract}');
    });
  });

  describe('arXivCategory filter', () => {
    it('should return category descriptions for known categories', () => {
      expect(filters.arXivCategory('math.AG')).toBe('Algebraic Geometry');
      expect(filters.arXivCategory('cs.AI')).toBe('Artificial Intelligence');
      expect(filters.arXivCategory('physics.gen-ph')).toBe('General Physics');
    });

    it('should return the category itself for unknown categories', () => {
      expect(filters.arXivCategory('unknown.category')).toBe('unknown.category');
    });
  });

  describe('mscCodes filter', () => {
    it('should format single MSC code', () => {
      const result = filters.mscCodes('14A15');
      expect(result).toBe('\\textbf{Mathematics Subject Classification (2020):} 14A15');
    });

    it('should format multiple MSC codes', () => {
      const codes = ['14A15', '14F05', '18F30'];
      const result = filters.mscCodes(codes);
      expect(result).toBe('\\textbf{Mathematics Subject Classification (2020):} 14A15, 14F05, 18F30');
    });
  });

  describe('latexTable filter', () => {
    it('should create table from array data', () => {
      const data = [
        ['Name', 'Age', 'City'],
        ['John', '25', 'NYC'],
        ['Jane', '30', 'LA']
      ];

      const result = filters.latexTable(data);
      expect(result).toContain('\\begin{table}[htbp]');
      expect(result).toContain('\\begin{tabular}{lll}');
      expect(result).toContain('Name & Age & City \\\\');
      expect(result).toContain('John & 25 & NYC \\\\');
      expect(result).toContain('\\hline');
      expect(result).toContain('\\end{tabular}');
      expect(result).toContain('\\end{table}');
    });

    it('should create table from object data', () => {
      const data = [
        { name: 'John', age: 25, city: 'NYC' },
        { name: 'Jane', age: 30, city: 'LA' }
      ];

      const result = filters.latexTable(data);
      expect(result).toContain('name & age & city \\\\');
      expect(result).toContain('John & 25 & NYC \\\\');
    });

    it('should handle table options', () => {
      const data = [['A', 'B'], ['1', '2']];
      const options = {
        caption: 'Test Table',
        label: 'tab:test',
        position: 'h!',
        columnSpec: 'c|c',
        centering: false,
        hlines: false
      };

      const result = filters.latexTable(data, options);
      expect(result).toContain('\\begin{table}[h!]');
      expect(result).toContain('\\begin{tabular}{c|c}');
      expect(result).toContain('\\caption{Test Table}');
      expect(result).toContain('\\label{tab:test}');
      expect(result).not.toContain('\\centering');
      expect(result).not.toContain('\\hline');
    });
  });

  describe('latexFigure filter', () => {
    it('should create basic figure', () => {
      const result = filters.latexFigure('image.png');
      expect(result).toContain('\\begin{figure}[htbp]');
      expect(result).toContain('\\centering');
      expect(result).toContain('\\includegraphics[width=\\textwidth]{image.png}');
      expect(result).toContain('\\end{figure}');
    });

    it('should handle figure options', () => {
      const options = {
        caption: 'Test Figure',
        label: 'fig:test',
        position: 'h!',
        width: '0.5\\textwidth',
        centering: false
      };

      const result = filters.latexFigure('test.jpg', options);
      expect(result).toContain('\\begin{figure}[h!]');
      expect(result).toContain('\\includegraphics[width=0.5\\textwidth]{test.jpg}');
      expect(result).toContain('\\caption{Test Figure}');
      expect(result).toContain('\\label{fig:test}');
      expect(result).not.toContain('\\centering');
    });
  });

  describe('latexList filter', () => {
    it('should create itemize list', () => {
      const items = ['First item', 'Second item', 'Third item'];
      const result = filters.latexList(items, 'itemize');
      
      expect(result).toContain('\\begin{itemize}');
      expect(result).toContain('\\item First item');
      expect(result).toContain('\\item Second item');
      expect(result).toContain('\\item Third item');
      expect(result).toContain('\\end{itemize}');
    });

    it('should create enumerate list', () => {
      const items = ['One', 'Two', 'Three'];
      const result = filters.latexList(items, 'enumerate');
      
      expect(result).toContain('\\begin{enumerate}');
      expect(result).toContain('\\end{enumerate}');
    });

    it('should create description list', () => {
      const items = [
        { term: 'LaTeX', description: 'A document preparation system' },
        { term: 'BibTeX', description: 'A bibliography management tool' }
      ];
      const result = filters.latexList(items, 'description');
      
      expect(result).toContain('\\begin{description}');
      expect(result).toContain('\\item[LaTeX] A document preparation system');
      expect(result).toContain('\\item[BibTeX] A bibliography management tool');
      expect(result).toContain('\\end{description}');
    });
  });

  describe('usePackage filter', () => {
    it('should create package inclusion without options', () => {
      expect(filters.usePackage('amsmath')).toBe('\\usepackage{amsmath}');
      expect(filters.usePackage('graphicx')).toBe('\\usepackage{graphicx}');
    });

    it('should create package inclusion with options', () => {
      expect(filters.usePackage('geometry', 'margin=1in')).toBe('\\usepackage[margin=1in]{geometry}');
      expect(filters.usePackage('babel', 'english')).toBe('\\usepackage[english]{babel}');
    });
  });

  describe('section filter', () => {
    it('should create section commands', () => {
      expect(filters.section('Introduction')).toBe('\\section{Introduction}');
      expect(filters.section('Methods', 'subsection')).toBe('\\subsection{Methods}');
      expect(filters.section('Results', 'subsubsection')).toBe('\\subsubsection{Results}');
    });

    it('should create unnumbered sections', () => {
      expect(filters.section('Abstract', 'section', false)).toBe('\\section*{Abstract}');
      expect(filters.section('Acknowledgments', 'subsection', false)).toBe('\\subsection*{Acknowledgments}');
    });

    it('should add labels', () => {
      expect(filters.section('Introduction', 'section', true, 'sec:intro')).toBe('\\section{Introduction}\\label{sec:intro}');
    });
  });

  describe('Factory and registration functions', () => {
    it('should create filters with factory function', () => {
      const factoryFilters = createLaTeXFilters();
      expect(typeof factoryFilters.texEscape).toBe('function');
      expect(typeof factoryFilters.mathMode).toBe('function');
      expect(typeof factoryFilters.citation).toBe('function');
    });

    it('should create filters with options', () => {
      const options = { documentClass: 'book', bibStyle: 'authoryear' };
      const customFilters = createLaTeXFilters(options);
      expect(typeof customFilters.documentClass).toBe('function');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle null and undefined inputs gracefully', () => {
      expect(filters.texEscape(null)).toBe('');
      expect(filters.mathMode(undefined)).toBe('');
      expect(filters.citation(null)).toBe('');
      expect(filters.latexCommand(null, null)).toBe(null);
    });

    it('should handle empty arrays and objects', () => {
      expect(filters.latexTable([])).toBe('');
      expect(filters.latexList([])).toBe('');
      expect(filters.bibtex({})).toBe('');
    });

    it('should handle malformed input', () => {
      expect(filters.bibtex({ type: 'article' })).toBe(''); // missing key
      expect(filters.bibtex({ key: 'test' })).toBe(''); // missing type
    });
  });
});