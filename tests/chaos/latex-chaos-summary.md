# LaTeX Chaos Engineering Report

Generated: 2025-09-08T16:41:04.694Z

## Executive Summary

- **Total Tests:** 43
- **Failures:** 20 (46.51%)
- **Success Rate:** 53.49%

## Critical Findings

- ⚠️  Syntax errors that should fail but didn't: 2 cases

## Test Categories

### SYNTAX
- Total: 5
- Failures: 3
- Success Rate: 40.0%

### MISSING
- Total: 5
- Failures: 4
- Success Rate: 20.0%

### INFINITE
- Total: 4
- Failures: 4
- Success Rate: 0.0%

### COMPLEX
- Total: 5
- Failures: 4
- Success Rate: 20.0%

### BIBLIOGRAPHY
- Total: 4
- Failures: 1
- Success Rate: 75.0%

### MALFORMED
- Total: 2
- Failures: 0
- Success Rate: 100.0%

### BROKEN
- Total: 4
- Failures: 2
- Success Rate: 50.0%

### ENGINE
- Total: 3
- Failures: 1
- Success Rate: 66.7%

### SIMULTANEOUS
- Total: 4
- Failures: 1
- Success Rate: 75.0%

### FILTER
- Total: 7
- Failures: 0
- Success Rate: 100.0%

## Recommendations

- 💡 Implement comprehensive LaTeX error reporting and recovery
- 💡 Add LaTeX security scanning for malicious input
- 💡 Create LaTeX compilation sandbox with resource limits

## Detailed Test Results

### syntax-error-unclosed-brace ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:40:26.265Z
- **Details:** {
  "reason": "SUCCESS",
  "code": 0,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/unclosed-brace.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/2024/"
}

### syntax-error-unmatched-environment ❌
- **Status:** FAILED
- **Timestamp:** 2025-09-08T16:40:26.457Z
- **Details:** {
  "reason": "EXIT_CODE_1",
  "code": 1,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/unmatched-environment.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texliv"
}

### syntax-error-undefined-command ❌
- **Status:** FAILED
- **Timestamp:** 2025-09-08T16:40:26.645Z
- **Details:** {
  "reason": "EXIT_CODE_1",
  "code": 1,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/undefined-command.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/20"
}

### syntax-error-malformed-math ❌
- **Status:** FAILED
- **Timestamp:** 2025-09-08T16:40:26.862Z
- **Details:** {
  "reason": "EXIT_CODE_1",
  "code": 1,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/malformed-math.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/2024/"
}

### syntax-error-nested-brace-chaos ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:40:27.053Z
- **Details:** {
  "reason": "SUCCESS",
  "code": 0,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/nested-brace-chaos.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/2"
}

### missing-packages-missing-amsmath ❌
- **Status:** FAILED
- **Timestamp:** 2025-09-08T16:40:27.244Z
- **Details:** {
  "reason": "EXIT_CODE_1",
  "code": 1,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/missing-amsmath.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/2024"
}

### missing-packages-missing-graphicx ❌
- **Status:** FAILED
- **Timestamp:** 2025-09-08T16:40:27.434Z
- **Details:** {
  "reason": "EXIT_CODE_1",
  "code": 1,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/missing-graphicx.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/202"
}

### missing-packages-missing-babel ❌
- **Status:** FAILED
- **Timestamp:** 2025-09-08T16:40:27.626Z
- **Details:** {
  "reason": "EXIT_CODE_1",
  "code": 1,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/missing-babel.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/2024/t"
}

### missing-packages-nonexistent-package ❌
- **Status:** FAILED
- **Timestamp:** 2025-09-08T16:40:27.830Z
- **Details:** {
  "reason": "EXIT_CODE_1",
  "code": 1,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/nonexistent-package.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n\n! LaTeX Error: File"
}

### missing-packages-circular-package-deps ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:40:28.326Z
- **Details:** {
  "reason": "SUCCESS",
  "code": 0,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/circular-package-deps.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texliv"
}

### infinite-loop-recursive-macro ❌
- **Status:** FAILED
- **Timestamp:** 2025-09-08T16:40:38.330Z
- **Details:** {
  "reason": "TIMEOUT",
  "code": null,
  "timedOut": true,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/recursive-macro.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/2024"
}

### infinite-loop-mutual-recursion ❌
- **Status:** FAILED
- **Timestamp:** 2025-09-08T16:40:48.334Z
- **Details:** {
  "reason": "TIMEOUT",
  "code": null,
  "timedOut": true,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/mutual-recursion.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/202"
}

### infinite-loop-expand-forever ❌
- **Status:** FAILED
- **Timestamp:** 2025-09-08T16:40:48.592Z
- **Details:** {
  "reason": "EXIT_CODE_1",
  "code": 1,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/expand-forever.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/2024/"
}

### infinite-loop-counter-loop ❌
- **Status:** FAILED
- **Timestamp:** 2025-09-08T16:40:48.781Z
- **Details:** {
  "reason": "EXIT_CODE_1",
  "code": 1,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/counter-loop.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/2024/te"
}

### complex-math-deeply-nested-fractions ❌
- **Status:** FAILED
- **Timestamp:** 2025-09-08T16:40:48.983Z
- **Details:** {
  "reason": "EXIT_CODE_1",
  "code": 1,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/deeply-nested-fractions.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texl"
}

### complex-math-massive-matrix ❌
- **Status:** FAILED
- **Timestamp:** 2025-09-08T16:40:49.186Z
- **Details:** {
  "reason": "EXIT_CODE_1",
  "code": 1,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/massive-matrix.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/2024/"
}

### complex-math-invalid-math-commands ❌
- **Status:** FAILED
- **Timestamp:** 2025-09-08T16:40:49.388Z
- **Details:** {
  "reason": "EXIT_CODE_1",
  "code": 1,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/invalid-math-commands.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texliv"
}

### complex-math-unicode-math-chaos ❌
- **Status:** FAILED
- **Timestamp:** 2025-09-08T16:40:49.582Z
- **Details:** {
  "reason": "EXIT_CODE_1",
  "code": 1,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/unicode-math-chaos.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/2"
}

### complex-math-malformed-align ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:40:49.946Z
- **Details:** {
  "reason": "SUCCESS",
  "code": 0,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/malformed-align.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/2024"
}

### bibliography-chaos-cite-without-bib ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:40:50.300Z
- **Details:** {
  "reason": "SUCCESS",
  "code": 0,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/cite-without-bib.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/202"
}

### bibliography-chaos-natbib-chaos ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:40:50.662Z
- **Details:** {
  "reason": "SUCCESS",
  "code": 0,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/natbib-chaos.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/2024/te"
}

### bibliography-chaos-biblatex-broken ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:40:51.357Z
- **Details:** {
  "reason": "SUCCESS",
  "code": 0,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/biblatex-broken.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/2024"
}

### bibliography-chaos-mixed-bibliography-styles ❌
- **Status:** FAILED
- **Timestamp:** 2025-09-08T16:40:51.568Z
- **Details:** {
  "reason": "EXIT_CODE_1",
  "code": 1,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/mixed-bibliography-styles.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/te"
}

### malformed-bibtex-use-broken-bib ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:40:51.921Z
- **Details:** {
  "reason": "SUCCESS",
  "code": 0,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/use-broken-bib.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/2024/"
}

### malformed-bibtex-use-syntax-chaos-bib ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:40:52.271Z
- **Details:** {
  "reason": "SUCCESS",
  "code": 0,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/use-syntax-chaos-bib.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive"
}

### broken-references-missing-labels ❌
- **Status:** FAILED
- **Timestamp:** 2025-09-08T16:40:52.462Z
- **Details:** {
  "reason": "EXIT_CODE_1",
  "code": 1,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/missing-labels.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/2024/"
}

### broken-references-circular-references ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:40:52.814Z
- **Details:** {
  "reason": "SUCCESS",
  "code": 0,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/circular-references.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/"
}

### broken-references-malformed-labels ❌
- **Status:** FAILED
- **Timestamp:** 2025-09-08T16:40:53.005Z
- **Details:** {
  "reason": "EXIT_CODE_1",
  "code": 1,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/malformed-labels.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/202"
}

### broken-references-hyperref-broken ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:40:53.488Z
- **Details:** {
  "reason": "SUCCESS",
  "code": 0,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/hyperref-broken.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/2024"
}

### engine-conflict-engine-specific-pdflatex ❌
- **Status:** FAILED
- **Timestamp:** 2025-09-08T16:40:53.675Z
- **Details:** {
  "reason": "EXIT_CODE_1",
  "code": 1,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/engine-specific-pdflatex.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/tex"
}

### engine-conflict-engine-specific-xelatex ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:40:54.411Z
- **Details:** {
  "reason": "SUCCESS",
  "code": 0,
  "timedOut": false,
  "engine": "xelatex",
  "stderr": "",
  "stdout": "This is XeTeX, Version 3.141592653-2.6-0.999996 (TeX Live 2024) (preloaded format=xelatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/engine-specific-xelatex.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texli"
}

### engine-conflict-engine-specific-lualatex ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:41:03.922Z
- **Details:** {
  "reason": "SUCCESS",
  "code": 0,
  "timedOut": false,
  "engine": "lualatex",
  "stderr": "",
  "stdout": "This is LuaHBTeX, Version 1.18.0 (TeX Live 2024) \n restricted system commands enabled.\n(/Users/sac/unjucks/tests/chaos/latex-chaos/engine-specific-lualatex.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n (/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo\nluaotfload | db : Font names database not found, generating new one.\nluaot"
}

### simultaneous-simultaneous-pdflatex ❌
- **Status:** FAILED
- **Timestamp:** 2025-09-08T16:41:04.123Z
- **Details:** {
  "reason": "EXIT_CODE_1",
  "code": 1,
  "timedOut": false,
  "engine": "pdflatex",
  "stderr": "",
  "stdout": "This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024) (preloaded format=pdflatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/simultaneous-pdflatex.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texliv"
}

### simultaneous-simultaneous-xelatex ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:41:04.608Z
- **Details:** {
  "reason": "SUCCESS",
  "code": 0,
  "timedOut": false,
  "engine": "xelatex",
  "stderr": "",
  "stdout": "This is XeTeX, Version 3.141592653-2.6-0.999996 (TeX Live 2024) (preloaded format=xelatex)\n restricted \\write18 enabled.\nentering extended mode\n(/Users/sac/unjucks/tests/chaos/latex-chaos/simultaneous-xelatex.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/"
}

### simultaneous-simultaneous-lualatex ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:41:04.683Z
- **Details:** {
  "reason": "SUCCESS",
  "code": 0,
  "timedOut": false,
  "engine": "lualatex",
  "stderr": "",
  "stdout": "This is LuaHBTeX, Version 1.18.0 (TeX Live 2024) \n restricted system commands enabled.\n(/Users/sac/unjucks/tests/chaos/latex-chaos/simultaneous-lualatex.tex\nLaTeX2e <2023-11-01> patch level 1\nL3 programming layer <2024-02-20>\n (/usr/local/texlive/2024/texmf-dist/tex/latex/base/article.cls\nDocument Class: article 2023/05/17 v1.4n Standard LaTeX document class\n(/usr/local/texlive/2024/texmf-dist/tex/latex/base/size10.clo))\n(/usr/local/texlive/2024/texmf-dist/tex/latex/fontspec/fontspec.sty\n(/usr/l"
}

### simultaneous-engines ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:41:04.683Z
- **Details:** All engines completed simultaneously

### filter-texEscape with malicious input ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:41:04.684Z
- **Details:** Result: \textbackslash{}malicious\{\}\&\%\#\textasciicircum{}\_\textasciitilde{}\textless{}\textgreater{}\textbar{}\textquotedbl{}\textquotesingle{}

### filter-mathMode with invalid formula ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:41:04.684Z
- **Details:** Result: $\frac{1}{0} \undefined{command}$

### filter-citation with null input ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:41:04.684Z
- **Details:** Result: 

### filter-bibtex with malformed entry ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:41:04.684Z
- **Details:** Result: @article{test,
}


### filter-latexTable with empty data ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:41:04.684Z
- **Details:** Result: 

### filter-environment with circular reference ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:41:04.684Z
- **Details:** Result: \begin{recursiveEnv}
\recursiveCommand
\end{recursiveEnv}

### filter-registration ✅
- **Status:** PASSED
- **Timestamp:** 2025-09-08T16:41:04.693Z
- **Details:** Filters registered successfully


---

*Report generated by LaTeX Chaos Engineering Suite*
