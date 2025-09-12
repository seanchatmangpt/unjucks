/**
 * LaTeX Chaos Engineering Tests
 * Break LaTeX functionality systematically to find real failure modes
 */

import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export class LaTeXChaosEngine {
  constructor(options = {}) {
    this.testDir = path.join(process.cwd(), 'tests/chaos/latex-chaos');
    this.timeout = options.timeout || 30000;
    this.results = [];
  }

  async initialize() {
    await fs.mkdir(this.testDir, { recursive: true });
    console.log(`LaTeX Chaos Engine initialized in: ${this.testDir}`);
  }

  async runAllTests() {
    console.log('🔥 Starting LaTeX Chaos Engineering Tests...\n');
    
    await this.initialize();
    
    const tests = [
      this.testSyntaxErrors,
      this.testMissingPackages,
      this.testInfiniteLoops,
      this.testComplexMathChaos,
      this.testBibliographyChaos,
      this.testMalformedBibTeX,
      this.testBrokenReferences,
      this.testEngineConflicts,
      this.testFilterAccessibility
    ];

    for (const test of tests) {
      try {
        await test.call(this);
      } catch (error) {
        console.error(`Test failed: ${test.name}`, error.message);
      }
    }

    return this.generateReport();
  }

  /**
   * Test 1: LaTeX Syntax Error Chaos
   */
  async testSyntaxErrors() {
    console.log('🚨 Test 1: LaTeX Compilation with Syntax Errors');
    
    const syntaxErrorDocs = [
      {
        name: 'unclosed-brace',
        content: `\\documentclass{article}
\\begin{document}
This has an unclosed brace {like this
\\end{document}`
      },
      {
        name: 'unmatched-environment',
        content: `\\documentclass{article}
\\begin{document}
\\begin{itemize}
\\item Test item
\\end{enumerate}  % Wrong end tag
\\end{document}`
      },
      {
        name: 'undefined-command',
        content: `\\documentclass{article}
\\begin{document}
\\undefinedcommand{This will fail}
\\nonexistentcommand
\\end{document}`
      },
      {
        name: 'malformed-math',
        content: `\\documentclass{article}
\\usepackage{amsmath}
\\begin{document}
$x = \\frac{1}{2$  % Missing closing brace
\\end{document}`
      },
      {
        name: 'nested-brace-chaos',
        content: `\\documentclass{article}
\\begin{document}
{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{}}}}}}}  % Severely unbalanced
\\end{document}`
      }
    ];

    for (const doc of syntaxErrorDocs) {
      await this.testLatexCompilation(doc.name, doc.content, 'syntax-error');
    }
  }

  /**
   * Test 2: Missing Package Chaos
   */
  async testMissingPackages() {
    console.log('🚨 Test 2: Missing LaTeX Packages');
    
    const missingPackageDocs = [
      {
        name: 'missing-amsmath',
        content: `\\documentclass{article}
\\begin{document}
\\begin{align}  % Requires amsmath
x &= 1 \\\\
y &= 2
\\end{align}
\\end{document}`
      },
      {
        name: 'missing-graphicx',
        content: `\\documentclass{article}
\\begin{document}
\\includegraphics[width=0.5\\textwidth]{nonexistent.png}
\\end{document}`
      },
      {
        name: 'missing-babel',
        content: `\\documentclass{article}
\\begin{document}
This uses UTF-8 characters: αβγδε without babel
\\end{document}`
      },
      {
        name: 'nonexistent-package',
        content: `\\documentclass{article}
\\usepackage{totallyfakepackage}
\\usepackage{anotherfakeone}
\\begin{document}
This will never compile
\\end{document}`
      },
      {
        name: 'circular-package-deps',
        content: `\\documentclass{article}
\\usepackage{xcolor}
\\usepackage{xcolor}  % Duplicate
\\usepackage{tikz}
\\usepackage{pgf}     % Already loaded by tikz
\\begin{document}
Testing circular dependencies
\\end{document}`
      }
    ];

    for (const doc of missingPackageDocs) {
      await this.testLatexCompilation(doc.name, doc.content, 'missing-packages');
    }
  }

  /**
   * Test 3: Infinite Loop Scenarios
   */
  async testInfiniteLoops() {
    console.log('🚨 Test 3: Infinite Loop LaTeX Scenarios');
    
    const infiniteLoopDocs = [
      {
        name: 'recursive-macro',
        content: `\\documentclass{article}
\\newcommand{\\recursivemacro}{\\recursivemacro}  % Self-referential
\\begin{document}
\\recursivemacro  % This will loop forever
\\end{document}`
      },
      {
        name: 'mutual-recursion',
        content: `\\documentclass{article}
\\newcommand{\\macroA}{\\macroB}
\\newcommand{\\macroB}{\\macroA}
\\begin{document}
\\macroA  % Mutual recursion
\\end{document}`
      },
      {
        name: 'expand-forever',
        content: `\\documentclass{article}
\\def\\expandforever#1{#1\\expandforever{#1#1}}
\\begin{document}
\\expandforever{a}  % Exponential expansion
\\end{document}`
      },
      {
        name: 'counter-loop',
        content: `\\documentclass{article}
\\newcounter{loopcounter}
\\setcounter{loopcounter}{-1}
\\begin{document}
\\whiledo{\\value{loopcounter} < 0}{
  \\stepcounter{loopcounter}
  \\addtocounter{loopcounter}{-1}  % Never ends
}
\\end{document}`
      }
    ];

    for (const doc of infiniteLoopDocs) {
      await this.testLatexCompilation(doc.name, doc.content, 'infinite-loop', 10000); // Short timeout
    }
  }

  /**
   * Test 4: Complex Math Equation Chaos
   */
  async testComplexMathChaos() {
    console.log('🚨 Test 4: Complex Mathematical Equations Edge Cases');
    
    const complexMathDocs = [
      {
        name: 'deeply-nested-fractions',
        content: `\\documentclass{article}
\\usepackage{amsmath}
\\begin{document}
\\begin{align}
x = \\frac{1}{\\frac{2}{\\frac{3}{\\frac{4}{\\frac{5}{\\frac{6}{\\frac{7}{\\frac{8}{\\frac{9}{\\frac{10}{11}}}}}}}}}}}
\\end{align}
\\end{document}`
      },
      {
        name: 'massive-matrix',
        content: `\\documentclass{article}
\\usepackage{amsmath}
\\begin{document}
\\begin{align}
M = \\begin{pmatrix}
${Array(50).fill().map((_, i) => Array(50).fill().map((_, j) => `a_{${i}${j}}`).join(' & ')).join(' \\\\\n')}
\\end{pmatrix}
\\end{align}
\\end{document}`
      },
      {
        name: 'invalid-math-commands',
        content: `\\documentclass{article}
\\usepackage{amsmath}
\\begin{document}
\\begin{align}
\\invalidmathcommand{x} &= \\anotherfake{y} \\\\
\\notreal{\\sqrt{-1}} &= \\complex{i}
\\end{align}
\\end{document}`
      },
      {
        name: 'unicode-math-chaos',
        content: `\\documentclass{article}
\\usepackage{unicode-math}  % May not be available
\\begin{document}
Mathematical symbols: ℝ ℤ ℕ ∀ ∃ ∈ ∉ ∪ ∩ ⊂ ⊆ ⊄
\\end{document}`
      },
      {
        name: 'malformed-align',
        content: `\\documentclass{article}
\\usepackage{amsmath}
\\begin{document}
\\begin{align}
x &= 1 \\\\
y & missing equals
z &= 3 & extra ampersand & problem \\\\
\\end{align}
\\end{document}`
      }
    ];

    for (const doc of complexMathDocs) {
      await this.testLatexCompilation(doc.name, doc.content, 'complex-math');
    }
  }

  /**
   * Test 5: Bibliography Without .bib Files
   */
  async testBibliographyChaos() {
    console.log('🚨 Test 5: Bibliography Without .bib Files');
    
    const bibliographyDocs = [
      {
        name: 'cite-without-bib',
        content: `\\documentclass{article}
\\begin{document}
This cites a non-existent reference \\cite{nonexistent2023}.
And another one \\cite{alsofake2024}.

\\bibliographystyle{plain}
\\bibliography{nonexistent}  % File doesn't exist
\\end{document}`
      },
      {
        name: 'natbib-chaos',
        content: `\\documentclass{article}
\\usepackage{natbib}
\\begin{document}
Using natbib citations: \\citep{fake2023}, \\citet{another2024}.
\\citeyear{broken}, \\citeauthor{missing}.

\\bibliographystyle{plainnat}
\\bibliography{missing,alsoMissing,anotherMissing}
\\end{document}`
      },
      {
        name: 'biblatex-broken',
        content: `\\documentclass{article}
\\usepackage[backend=biber]{biblatex}
\\addbibresource{nonexistent.bib}
\\begin{document}
Citations with biblatex: \\autocite{missing2023}.

\\printbibliography
\\end{document}`
      },
      {
        name: 'mixed-bibliography-styles',
        content: `\\documentclass{article}
\\usepackage{natbib}
\\usepackage[backend=bibtex]{biblatex}  % Conflict!
\\begin{document}
This should cause conflicts between natbib and biblatex.
\\cite{anything} \\autocite{anything}

\\bibliographystyle{plain}
\\bibliography{fake}
\\printbibliography
\\end{document}`
      }
    ];

    for (const doc of bibliographyDocs) {
      await this.testLatexCompilation(doc.name, doc.content, 'bibliography-chaos');
    }
  }

  /**
   * Test 6: Malformed BibTeX Entries
   */
  async testMalformedBibTeX() {
    console.log('🚨 Test 6: Malformed BibTeX Entries');
    
    // Create malformed .bib files
    const malformedBibs = [
      {
        name: 'broken.bib',
        content: `
@article{broken2023
  title = {Missing comma and brace
  author = {No Closing Quote},
  year = 2023,
  journal = Unquoted Journal Name
}

@inproceedings{another-broken,
  title = "Unmatched quotes',
  author = {Unclosed {brace},
  year = {not a number},
  booktitle = ,  # Empty value
}

% This entry has no closing brace
@book{incomplete
  title = {Never Ends}
`
      },
      {
        name: 'syntax-chaos.bib',
        content: `
@article{}  % Empty key
@{no-type-key}
@article{key1,}  % Empty fields

@mastersthesis{invalid-fields,
  title = {Test},
  invalidfield = {Should not exist},
  anotherfield = {Also invalid}
}

# This is not a valid comment in BibTeX
// Neither is this

@article{duplicate-keys,
  title = {First},
  title = {Duplicate title field}
}
`
      }
    ];

    for (const bib of malformedBibs) {
      const bibPath = path.join(this.testDir, bib.name);
      await fs.writeFile(bibPath, bib.content);
    }

    const malformedBibDocs = [
      {
        name: 'use-broken-bib',
        content: `\\documentclass{article}
\\begin{document}
Citing from broken bibliography: \\cite{broken2023}, \\cite{another-broken}.

\\bibliographystyle{plain}
\\bibliography{broken}
\\end{document}`
      },
      {
        name: 'use-syntax-chaos-bib',
        content: `\\documentclass{article}
\\begin{document}
More broken citations: \\cite{incomplete}, \\cite{duplicate-keys}.

\\bibliographystyle{alpha}
\\bibliography{syntax-chaos}
\\end{document}`
      }
    ];

    for (const doc of malformedBibDocs) {
      await this.testLatexCompilation(doc.name, doc.content, 'malformed-bibtex');
    }
  }

  /**
   * Test 7: Cross-references to Non-existent Labels
   */
  async testBrokenReferences() {
    console.log('🚨 Test 7: Cross-references to Non-existent Labels');
    
    const brokenRefDocs = [
      {
        name: 'missing-labels',
        content: `\\documentclass{article}
\\begin{document}
\\section{Introduction}
See Section \\ref{nonexistent}, Figure \\ref{missing-fig}, and Equation \\eqref{no-equation}.

As shown in \\cite{fakereference}, the results in Table \\ref{no-table} indicate...

\\pageref{nowhere} shows the page reference issue.
\\end{document}`
      },
      {
        name: 'circular-references',
        content: `\\documentclass{article}
\\begin{document}
\\section{Section A}\\label{secA}
This refers to Section \\ref{secB}.

\\section{Section B}\\label{secB}
This refers back to Section \\ref{secA}, creating a circular reference pattern.

But what about Section \\ref{secC} that doesn't exist?
\\end{document}`
      },
      {
        name: 'malformed-labels',
        content: `\\documentclass{article}
\\begin{document}
\\section{Test}\\label{with spaces in label}  % Spaces in labels
\\section{Another}\\label{special!@#$%characters}  % Special chars

References: \\ref{with spaces in label}, \\ref{special!@#$%characters}

\\label{}  % Empty label
\\ref{}    % Empty reference
\\end{document}`
      },
      {
        name: 'hyperref-broken',
        content: `\\documentclass{article}
\\usepackage{hyperref}
\\begin{document}
\\section{Introduction}\\label{intro}
With hyperref, broken links become more problematic.

See \\hyperref[nonexistent]{this broken link}.
\\autoref{missing} and \\nameref{also-missing}.

\\href{http://broken-url}{Broken external link}
\\url{not-a-valid-url-format}
\\end{document}`
      }
    ];

    for (const doc of brokenRefDocs) {
      await this.testLatexCompilation(doc.name, doc.content, 'broken-references');
    }
  }

  /**
   * Test 8: Different LaTeX Engines Simultaneously
   */
  async testEngineConflicts() {
    console.log('🚨 Test 8: Testing Different LaTeX Engines Simultaneously');
    
    const engineTestDoc = {
      name: 'engine-specific',
      content: `\\documentclass{article}
\\usepackage{fontspec}  % XeLaTeX/LuaLaTeX only
\\usepackage[utf8]{inputenc}  % pdfLaTeX only
\\usepackage{microtype}

\\begin{document}
This document has conflicting requirements:
- fontspec needs XeLaTeX or LuaLaTeX
- inputenc with utf8 is for pdfLaTeX only

Unicode: αβγδε ∀∃∈∉ ℝℤℕ

\\setmainfont{Times New Roman}  % XeLaTeX/LuaTeX only
\\end{document}`
    };

    const engines = ['pdflatex', 'xelatex', 'lualatex'];
    
    for (const engine of engines) {
      await this.testLatexCompilation(
        `${engineTestDoc.name}-${engine}`, 
        engineTestDoc.content, 
        'engine-conflict',
        this.timeout,
        engine
      );
    }

    // Test simultaneous compilation with different engines
    console.log('  Testing simultaneous compilation...');
    const promises = engines.map(engine => 
      this.testLatexCompilation(
        `simultaneous-${engine}`, 
        engineTestDoc.content, 
        'simultaneous',
        this.timeout,
        engine
      )
    );
    
    try {
      await Promise.all(promises);
      this.recordResult('simultaneous-engines', false, 'All engines completed simultaneously');
    } catch (error) {
      this.recordResult('simultaneous-engines', true, `Simultaneous execution failed: ${error.message}`);
    }
  }

  /**
   * Test 9: LaTeX Filter Accessibility
   */
  async testFilterAccessibility() {
    console.log('🚨 Test 9: Verifying LaTeX Filter Accessibility');
    
    try {
      // Try to import and test the LaTeX filters
      const { LaTeXFilters } = await import('../../src/lib/filters/latex.js');
      const latexFilters = new LaTeXFilters();
      
      const testCases = [
        {
          name: 'texEscape with malicious input',
          test: () => latexFilters.texEscape('\\malicious{}&%#^_~<>|"\''),
          expected: 'Should escape all special characters'
        },
        {
          name: 'mathMode with invalid formula',
          test: () => latexFilters.mathMode('\\frac{1}{0} \\undefined{command}'),
          expected: 'Should wrap in math delimiters'
        },
        {
          name: 'citation with null input',
          test: () => latexFilters.citation(null),
          expected: 'Should handle null gracefully'
        },
        {
          name: 'bibtex with malformed entry',
          test: () => latexFilters.bibtex({ type: 'article', key: 'test' }),
          expected: 'Should generate basic BibTeX entry'
        },
        {
          name: 'latexTable with empty data',
          test: () => latexFilters.latexTable([]),
          expected: 'Should handle empty data'
        },
        {
          name: 'environment with circular reference',
          test: () => latexFilters.environment('\\recursiveCommand', 'recursiveEnv'),
          expected: 'Should create environment structure'
        }
      ];

      for (const testCase of testCases) {
        try {
          const result = testCase.test();
          console.log(`  ✓ ${testCase.name}: ${result ? 'PASSED' : 'RETURNED_EMPTY'}`);
          this.recordResult(`filter-${testCase.name}`, false, `Result: ${result}`);
        } catch (error) {
          console.log(`  ✗ ${testCase.name}: FAILED - ${error.message}`);
          this.recordResult(`filter-${testCase.name}`, true, error.message);
        }
      }

      // Test filter registration
      try {
        const nunjucks = await import('nunjucks');
        const env = new nunjucks.Environment();
        const { registerLaTeXFilters } = await import('../../src/lib/filters/latex.js');
        
        registerLaTeXFilters(env);
        console.log('  ✓ Filter registration: SUCCESS');
        this.recordResult('filter-registration', false, 'Filters registered successfully');
      } catch (error) {
        console.log(`  ✗ Filter registration: FAILED - ${error.message}`);
        this.recordResult('filter-registration', true, error.message);
      }

    } catch (importError) {
      console.log(`  ✗ LaTeX Filters Import: FAILED - ${importError.message}`);
      this.recordResult('filter-import', true, importError.message);
    }
  }

  /**
   * Test LaTeX compilation with timeout and error handling
   */
  async testLatexCompilation(name, content, category, timeout = this.timeout, engine = 'pdflatex') {
    const texFile = path.join(this.testDir, `${name}.tex`);
    await fs.writeFile(texFile, content);

    console.log(`  Testing ${name} with ${engine}...`);

    return new Promise((resolve) => {
      const process = spawn(engine, ['-interaction=nonstopmode', '-halt-on-error', texFile], {
        cwd: this.testDir,
        timeout: timeout
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timeoutId = setTimeout(() => {
        timedOut = true;
        process.kill('SIGKILL');
      }, timeout);

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        clearTimeout(timeoutId);
        
        const failed = code !== 0 || timedOut;
        const reason = timedOut ? 'TIMEOUT' : 
                      code !== 0 ? `EXIT_CODE_${code}` : 'SUCCESS';
        
        console.log(`    ${name}: ${failed ? '✗ FAILED' : '✓ PASSED'} (${reason})`);
        
        this.recordResult(`${category}-${name}`, failed, {
          reason,
          code,
          timedOut,
          engine,
          stderr: stderr.slice(0, 500), // Truncate for brevity
          stdout: stdout.slice(0, 500)
        });
        
        resolve();
      });

      process.on('error', (error) => {
        clearTimeout(timeoutId);
        console.log(`    ${name}: ✗ ERROR - ${error.message}`);
        this.recordResult(`${category}-${name}`, true, error.message);
        resolve();
      });
    });
  }

  recordResult(testName, failed, details) {
    this.results.push({
      test: testName,
      failed,
      details,
      timestamp: this.getDeterministicDate().toISOString()
    });
  }

  generateReport() {
    const totalTests = this.results.length;
    const failures = this.results.filter(r => r.failed);
    const successes = this.results.filter(r => !r.failed);

    const report = {
      summary: {
        total: totalTests,
        failures: failures.length,
        successes: successes.length,
        failureRate: (failures.length / totalTests * 100).toFixed(2) + '%'
      },
      categories: this.categorizeResults(),
      criticalFindings: this.findCriticalIssues(),
      recommendations: this.generateRecommendations(),
      fullResults: this.results
    };

    console.log('\\n🔥 LaTeX Chaos Engineering Report');
    console.log('=====================================');
    console.log(`Total Tests: ${report.summary.total}`);
    console.log(`Failures: ${report.summary.failures} (${report.summary.failureRate})`);
    console.log(`Successes: ${report.summary.successes}`);
    
    console.log('\\nCritical Findings:');
    report.criticalFindings.forEach(finding => {
      console.log(`  - ${finding}`);
    });
    
    console.log('\\nRecommendations:');
    report.recommendations.forEach(rec => {
      console.log(`  - ${rec}`);
    });

    return report;
  }

  categorizeResults() {
    const categories = {};
    this.results.forEach(result => {
      const category = result.test.split('-')[0];
      if (!categories[category]) {
        categories[category] = { total: 0, failures: 0 };
      }
      categories[category].total++;
      if (result.failed) categories[category].failures++;
    });
    return categories;
  }

  findCriticalIssues() {
    const issues = [];
    
    // Check for infinite loops that didn't timeout
    const infiniteLoopResults = this.results.filter(r => r.test.includes('infinite-loop'));
    const nonTimeoutLoops = infiniteLoopResults.filter(r => !r.details.timedOut && !r.failed);
    if (nonTimeoutLoops.length > 0) {
      issues.push(`Infinite loops completed without timeout: ${nonTimeoutLoops.length} cases`);
    }

    // Check for missing error handling
    const syntaxErrors = this.results.filter(r => r.test.includes('syntax-error'));
    const unexpectedSuccesses = syntaxErrors.filter(r => !r.failed);
    if (unexpectedSuccesses.length > 0) {
      issues.push(`Syntax errors that should fail but didn't: ${unexpectedSuccesses.length} cases`);
    }

    // Check filter accessibility
    const filterResults = this.results.filter(r => r.test.includes('filter-'));
    const filterFailures = filterResults.filter(r => r.failed);
    if (filterFailures.length > 0) {
      issues.push(`LaTeX filters not accessible: ${filterFailures.length} filter functions failed`);
    }

    // Check engine conflicts
    const engineResults = this.results.filter(r => r.test.includes('engine-'));
    const engineIssues = engineResults.filter(r => r.failed);
    if (engineIssues.length === engineResults.length) {
      issues.push('All LaTeX engines failed - no working LaTeX installation');
    }

    return issues;
  }

  generateRecommendations() {
    const recommendations = [];
    
    const categories = this.categorizeResults();
    
    if (categories['syntax-error']?.failures < categories['syntax-error']?.total) {
      recommendations.push('Implement stricter LaTeX syntax validation before compilation');
    }
    
    if (categories['infinite-loop']?.failures < categories['infinite-loop']?.total) {
      recommendations.push('Add compilation timeout and resource limits');
    }
    
    if (categories['missing-packages']?.failures > 0) {
      recommendations.push('Create package dependency checker and auto-installer');
    }
    
    if (categories['filter-']?.failures > 0) {
      recommendations.push('Fix LaTeX filter accessibility and error handling');
    }
    
    if (categories['bibliography-chaos']?.failures > 0) {
      recommendations.push('Add bibliography validation and missing .bib file handling');
    }
    
    recommendations.push('Implement comprehensive LaTeX error reporting and recovery');
    recommendations.push('Add LaTeX security scanning for malicious input');
    recommendations.push('Create LaTeX compilation sandbox with resource limits');

    return recommendations;
  }
}

// Export for use in tests
export default LaTeXChaosEngine;