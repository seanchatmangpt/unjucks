/**
 * LaTeX Filter Validation Test Suite
 * Comprehensive validation of all LaTeX filters including:
 * - Function tests with sample inputs
 * - Error handling validation
 * - Performance testing
 * - Filter chaining tests
 * - Edge case validation
 */

import { LaTeXFilters, createLaTeXFilters } from '../src/lib/filters/latex.js';
import nunjucks from 'nunjucks';

// Test data for validation
const TEST_DATA = {
  plainText: "Hello World & Co.",
  specialChars: "Test $ % # ^ _ ~ < > | \" ' \\ { }",
  mathFormula: "E = mc^2",
  longText: "Lorem ipsum ".repeat(100),
  emptyString: "",
  nullValue: null,
  undefinedValue: undefined,
  numberValue: 42,
  arrayValue: ["item1", "item2", "item3"],
  objectValue: { key: "value" }
};

class LaTeXFilterValidator {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      errors: []
    };
    this.filters = new LaTeXFilters();
  }

  /**
   * Run a test case and record results
   */
  runTest(testName, testFn) {
    try {
      console.log(`\n🧪 Testing: ${testName}`);
      const result = testFn();
      if (result === true) {
        console.log(`✅ PASS: ${testName}`);
        this.results.passed++;
      } else if (result === false) {
        console.log(`❌ FAIL: ${testName}`);
        this.results.failed++;
        this.results.errors.push(`FAIL: ${testName}`);
      } else {
        console.log(`✅ PASS: ${testName} - ${result}`);
        this.results.passed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${testName} - ${error.message}`);
      this.results.failed++;
      this.results.errors.push(`ERROR: ${testName} - ${error.message}`);
    }
  }

  /**
   * Validate texEscape filter
   */
  validateTexEscape() {
    this.runTest('texEscape - Basic special chars', () => {
      const result = this.filters.texEscape("Test $ % # ^ _ ~ < > | \" ' \\ { }");
      const expected = "Test \\$ \\% \\# \\textasciicircum{} \\_ \\textasciitilde{} \\textless{} \\textgreater{} \\textbar{} \\textquotedbl{} \\textquotesingle{} \\textbackslash{} \\{ \\}";
      return result === expected;
    });

    this.runTest('texEscape - Empty string', () => {
      return this.filters.texEscape("") === "";
    });

    this.runTest('texEscape - Null/undefined', () => {
      return this.filters.texEscape(null) === "" && 
             this.filters.texEscape(undefined) === "";
    });

    this.runTest('texEscape - Number input', () => {
      return this.filters.texEscape(42) === "42";
    });
  }

  /**
   * Validate mathMode filter
   */
  validateMathMode() {
    this.runTest('mathMode - Inline math', () => {
      const result = this.filters.mathMode("E = mc^2", true);
      return result === "$E = mc^2$";
    });

    this.runTest('mathMode - Display math', () => {
      const result = this.filters.mathMode("E = mc^2", false);
      return result === "\\[E = mc^2\\]";
    });

    this.runTest('mathMode - Empty formula', () => {
      return this.filters.mathMode("") === "";
    });

    this.runTest('mathMode - Null formula', () => {
      return this.filters.mathMode(null) === "";
    });
  }

  /**
   * Validate mathEnvironment filter
   */
  validateMathEnvironment() {
    this.runTest('mathEnvironment - Basic equation', () => {
      const result = this.filters.mathEnvironment("x = y", "equation", true);
      return result === "\\begin{equation}\nx = y\n\\end{equation}";
    });

    this.runTest('mathEnvironment - Unnumbered equation', () => {
      const result = this.filters.mathEnvironment("x = y", "equation", false);
      return result === "\\begin{equation*}\nx = y\n\\end{equation*}";
    });

    this.runTest('mathEnvironment - Align environment', () => {
      const result = this.filters.mathEnvironment("x &= y \\\\ a &= b", "align");
      return result === "\\begin{align}\nx &= y \\\\ a &= b\n\\end{align}";
    });

    this.runTest('mathEnvironment - Empty content', () => {
      return this.filters.mathEnvironment("") === "";
    });
  }

  /**
   * Validate citation filter
   */
  validateCitation() {
    this.runTest('citation - Standard style', () => {
      const result = this.filters.citation("einstein1905");
      return result === "\\cite{einstein1905}";
    });

    this.runTest('citation - Natbib style', () => {
      const result = this.filters.citation("einstein1905", "natbib");
      return result === "\\citep{einstein1905}";
    });

    this.runTest('citation - Author style', () => {
      const result = this.filters.citation("einstein1905", "author");
      return result === "\\citet{einstein1905}";
    });

    this.runTest('citation - Multiple keys', () => {
      const result = this.filters.citation(["key1", "key2"], "standard");
      return result === "\\cite{key1,key2}";
    });

    this.runTest('citation - With prefix and suffix', () => {
      const result = this.filters.citation("key", "natbib", "see", "p. 15");
      return result === "\\citep[see][p. 15]{key}";
    });

    this.runTest('citation - Empty key', () => {
      return this.filters.citation("") === "";
    });
  }

  /**
   * Validate latexCommand filter
   */
  validateLatexCommand() {
    this.runTest('latexCommand - Simple command', () => {
      const result = this.filters.latexCommand("Hello", "textbf");
      return result === "\\textbf{Hello}";
    });

    this.runTest('latexCommand - Command with optional args', () => {
      const result = this.filters.latexCommand("Title", "section", { optional: ["*"] });
      return result === "\\section[*]{Title}";
    });

    this.runTest('latexCommand - Command with required args', () => {
      const result = this.filters.latexCommand("Content", "mycommand", { args: ["arg1", "arg2"] });
      return result === "\\mycommand{arg1}{arg2}{Content}";
    });

    this.runTest('latexCommand - No command', () => {
      const result = this.filters.latexCommand("Hello", "");
      return result === "Hello";
    });
  }

  /**
   * Validate environment filter
   */
  validateEnvironment() {
    this.runTest('environment - Basic itemize', () => {
      const result = this.filters.environment("\\item Item 1", "itemize");
      return result === "\\begin{itemize}\n\\item Item 1\n\\end{itemize}";
    });

    this.runTest('environment - With options', () => {
      const result = this.filters.environment("Content", "figure", { 
        optional: ["htbp"], 
        args: [] 
      });
      return result === "\\begin{figure}[htbp]\nContent\n\\end{figure}";
    });

    this.runTest('environment - No environment name', () => {
      const result = this.filters.environment("Content", "");
      return result === "Content";
    });
  }

  /**
   * Validate latexDocClass filter
   */
  validateLatexDocClass() {
    this.runTest('latexDocClass - Basic article', () => {
      const result = this.filters.latexDocClass(null, "article");
      return result === "\\documentclass{article}";
    });

    this.runTest('latexDocClass - With string options', () => {
      const result = this.filters.latexDocClass("12pt,a4paper", "article");
      return result === "\\documentclass[12pt,a4paper]{article}";
    });

    this.runTest('latexDocClass - With object options', () => {
      const result = this.filters.latexDocClass({ "12pt": true, margin: "1in" }, "article");
      return result === "\\documentclass[12pt,margin=1in]{article}";
    });

    this.runTest('latexDocClass - Invalid class falls back', () => {
      const result = this.filters.latexDocClass(null, "invalidclass");
      return result === "\\documentclass{invalidclass}";
    });
  }

  /**
   * Validate bibtex filter
   */
  validateBibtex() {
    this.runTest('bibtex - Complete entry', () => {
      const entry = {
        type: "article",
        key: "einstein1905",
        title: "On the electrodynamics of moving bodies",
        author: "Albert Einstein",
        year: "1905"
      };
      const result = this.filters.bibtex(entry);
      const expected = "@article{einstein1905,\n  title = {On the electrodynamics of moving bodies},\n  author = {Albert Einstein},\n  year = 1905,\n}\n";
      return result === expected;
    });

    this.runTest('bibtex - Missing required fields', () => {
      return this.filters.bibtex({}) === "";
    });

    this.runTest('bibtex - Null entry', () => {
      return this.filters.bibtex(null) === "";
    });
  }

  /**
   * Validate bluebook filter
   */
  validateBluebook() {
    this.runTest('bluebook - Case citation', () => {
      const caseData = {
        caseName: "Brown v. Board of Education",
        citation: "347 U.S. 483",
        court: "U.S.",
        year: "1954"
      };
      const result = this.filters.bluebook(caseData, "case");
      return result.includes("\\emph{Brown v. Board of Education}") && 
             result.includes("347 U.S. 483") &&
             result.includes("(U.S. 1954)");
    });

    this.runTest('bluebook - Empty citation', () => {
      return this.filters.bluebook("") === "";
    });

    this.runTest('bluebook - Unknown type', () => {
      const result = this.filters.bluebook("test", "unknown");
      return result === "test";
    });
  }

  /**
   * Validate arXivMeta filter
   */
  validateArXivMeta() {
    this.runTest('arXivMeta - String ID', () => {
      const result = this.filters.arXivMeta("2301.00001");
      return result === "arXiv:2301.00001";
    });

    this.runTest('arXivMeta - Full object', () => {
      const arxiv = {
        id: "2301.00001",
        title: "Test Paper",
        authors: ["John Doe", "Jane Smith"],
        category: "cs.AI",
        version: "1"
      };
      const result = this.filters.arXivMeta(arxiv);
      return result.includes("\\title{Test Paper}") &&
             result.includes("\\author{John Doe, Jane Smith}") &&
             result.includes("arXiv:2301.00001v1 [cs.AI]");
    });

    this.runTest('arXivMeta - Empty input', () => {
      return this.filters.arXivMeta("") === "";
    });
  }

  /**
   * Validate arXivCategory filter
   */
  validateArXivCategory() {
    this.runTest('arXivCategory - Known category', () => {
      const result = this.filters.arXivCategory("cs.AI");
      return result === "Artificial Intelligence";
    });

    this.runTest('arXivCategory - Unknown category', () => {
      const result = this.filters.arXivCategory("unknown.category");
      return result === "unknown.category";
    });
  }

  /**
   * Validate latexTable filter
   */
  validateLatexTable() {
    this.runTest('latexTable - Array data', () => {
      const data = [
        ["Name", "Age"],
        ["John", "25"],
        ["Jane", "30"]
      ];
      const result = this.filters.latexTable(data, { headers: ["Name", "Age"] });
      return result.includes("\\begin{table}") &&
             result.includes("\\begin{tabular}") &&
             result.includes("Name & Age") &&
             result.includes("John & 25") &&
             result.includes("Jane & 30");
    });

    this.runTest('latexTable - Object data', () => {
      const data = [
        { name: "John", age: 25 },
        { name: "Jane", age: 30 }
      ];
      const result = this.filters.latexTable(data);
      return result.includes("name & age") &&
             result.includes("John & 25") &&
             result.includes("Jane & 30");
    });

    this.runTest('latexTable - Empty data', () => {
      return this.filters.latexTable([]) === "";
    });
  }

  /**
   * Validate latexFigure filter
   */
  validateLatexFigure() {
    this.runTest('latexFigure - Basic figure', () => {
      const result = this.filters.latexFigure("image.png", { caption: "Test Image" });
      return result.includes("\\begin{figure}") &&
             result.includes("\\includegraphics") &&
             result.includes("{image.png}") &&
             result.includes("\\caption{Test Image}");
    });

    this.runTest('latexFigure - No includegraphics', () => {
      const result = this.filters.latexFigure("Custom content", { 
        includegraphics: false,
        caption: "Test" 
      });
      return result.includes("Custom content") &&
             !result.includes("\\includegraphics");
    });

    this.runTest('latexFigure - Empty image', () => {
      return this.filters.latexFigure("") === "";
    });
  }

  /**
   * Validate latexList filter
   */
  validateLatexList() {
    this.runTest('latexList - Simple itemize', () => {
      const items = ["Item 1", "Item 2", "Item 3"];
      const result = this.filters.latexList(items, "itemize");
      return result.includes("\\begin{itemize}") &&
             result.includes("\\item Item 1") &&
             result.includes("\\item Item 2") &&
             result.includes("\\item Item 3") &&
             result.includes("\\end{itemize}");
    });

    this.runTest('latexList - Description list', () => {
      const items = [
        { term: "Term 1", description: "Description 1" },
        { term: "Term 2", description: "Description 2" }
      ];
      const result = this.filters.latexList(items, "description");
      return result.includes("\\item[Term 1] Description 1") &&
             result.includes("\\item[Term 2] Description 2");
    });

    this.runTest('latexList - Empty items', () => {
      const result = this.filters.latexList([]);
      return result === "" || result === "\\begin{itemize}\n\\end{itemize}";
    });

    this.runTest('latexList - Null items', () => {
      return this.filters.latexList(null) === "";
    });
  }

  /**
   * Validate usePackage filter
   */
  validateUsePackage() {
    this.runTest('usePackage - Basic package', () => {
      const result = this.filters.usePackage("amsmath");
      return result === "\\usepackage{amsmath}";
    });

    this.runTest('usePackage - With options', () => {
      const result = this.filters.usePackage("geometry", "margin=1in");
      return result === "\\usepackage[margin=1in]{geometry}";
    });

    this.runTest('usePackage - Empty package', () => {
      return this.filters.usePackage("") === "";
    });
  }

  /**
   * Validate section filter
   */
  validateSection() {
    this.runTest('section - Basic section', () => {
      const result = this.filters.section("Introduction");
      return result === "\\section{Introduction}";
    });

    this.runTest('section - Unnumbered section', () => {
      const result = this.filters.section("Introduction", "section", false);
      return result === "\\section*{Introduction}";
    });

    this.runTest('section - With label', () => {
      const result = this.filters.section("Introduction", "section", true, "sec:intro");
      return result === "\\section{Introduction}\\label{sec:intro}";
    });

    this.runTest('section - Subsection', () => {
      const result = this.filters.section("Details", "subsection");
      return result === "\\subsection{Details}";
    });

    this.runTest('section - Empty title', () => {
      return this.filters.section("") === "";
    });
  }

  /**
   * Test error handling with various invalid inputs
   */
  validateErrorHandling() {
    const invalidInputs = [null, undefined, "", 0, false, {}, [], NaN, Infinity];
    
    this.runTest('Error handling - texEscape with invalid inputs', () => {
      return invalidInputs.every(input => {
        try {
          const result = this.filters.texEscape(input);
          return typeof result === 'string'; // Should always return string
        } catch (error) {
          return false;
        }
      });
    });

    this.runTest('Error handling - mathMode with invalid inputs', () => {
      return invalidInputs.every(input => {
        try {
          const result = this.filters.mathMode(input);
          return typeof result === 'string';
        } catch (error) {
          return false;
        }
      });
    });

    this.runTest('Error handling - citation with invalid inputs', () => {
      return invalidInputs.every(input => {
        try {
          const result = this.filters.citation(input);
          return typeof result === 'string';
        } catch (error) {
          return false;
        }
      });
    });
  }

  /**
   * Test performance with large inputs
   */
  validatePerformance() {
    this.runTest('Performance - Large text escape', () => {
      const largeText = "Test & $ % # ^ _ ~ ".repeat(1000);
      const startTime = performance.now();
      const result = this.filters.texEscape(largeText);
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`    ⏱️  Large text escape took ${duration.toFixed(2)}ms`);
      return duration < 100 && result.length > 0; // Should complete under 100ms
    });

    this.runTest('Performance - Large table generation', () => {
      const largeData = Array(100).fill().map((_, i) => [`Item ${i}`, `Value ${i}`]);
      const startTime = performance.now();
      const result = this.filters.latexTable(largeData);
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`    ⏱️  Large table generation took ${duration.toFixed(2)}ms`);
      return duration < 200 && result.includes("\\begin{table}");
    });
  }

  /**
   * Test filter chaining and composition
   */
  validateFilterChaining() {
    this.runTest('Filter chaining - Escape then wrap in command', () => {
      const text = "Special & characters";
      const escaped = this.filters.texEscape(text);
      const result = this.filters.latexCommand(escaped, "textbf");
      return result === "\\textbf{Special \\& characters}";
    });

    this.runTest('Filter chaining - Math environment with escaped content', () => {
      const formula = "E = mc^2 & F = ma";
      const escaped = this.filters.texEscape(formula);
      const result = this.filters.mathEnvironment(escaped, "align");
      return result.includes("E = mc^2 \\& F = ma");
    });
  }

  /**
   * Run all validation tests
   */
  runAllTests() {
    console.log("🚀 Starting LaTeX Filter Validation Suite");
    console.log("=" .repeat(50));

    // Core filter tests
    this.validateTexEscape();
    this.validateMathMode();
    this.validateMathEnvironment();
    this.validateCitation();
    this.validateLatexCommand();
    this.validateEnvironment();
    this.validateLatexDocClass();
    this.validateBibtex();
    this.validateBluebook();
    this.validateArXivMeta();
    this.validateArXivCategory();
    this.validateLatexTable();
    this.validateLatexFigure();
    this.validateLatexList();
    this.validateUsePackage();
    this.validateSection();

    // Advanced tests
    this.validateErrorHandling();
    this.validatePerformance();
    this.validateFilterChaining();

    // Summary
    console.log("\n" + "=" .repeat(50));
    console.log("🎯 VALIDATION SUMMARY");
    console.log("=" .repeat(50));
    console.log(`✅ Tests Passed: ${this.results.passed}`);
    console.log(`❌ Tests Failed: ${this.results.failed}`);
    console.log(`📊 Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);

    if (this.results.errors.length > 0) {
      console.log("\n🔍 ERRORS:");
      this.results.errors.forEach(error => console.log(`   ${error}`));
    }

    return this.results.failed === 0;
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new LaTeXFilterValidator();
  const success = validator.runAllTests();
  process.exit(success ? 0 : 1);
}

export { LaTeXFilterValidator };