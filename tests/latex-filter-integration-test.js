/**
 * LaTeX Filter Integration Test
 * Tests filters working with Nunjucks templates in real scenarios
 */

import { addCommonFilters } from '../src/lib/nunjucks-filters.js';
import nunjucks from 'nunjucks';

class LaTeXIntegrationTester {
  constructor() {
    this.env = nunjucks.configure();
    addCommonFilters(this.env);
    this.results = { passed: 0, failed: 0, errors: [] };
  }

  runTest(name, templateStr, data, expectedPattern) {
    try {
      console.log(`\n🧪 Testing: ${name}`);
      const template = this.env.compile(templateStr);
      const result = template.render(data);
      
      let success;
      if (typeof expectedPattern === 'string') {
        success = result === expectedPattern;
      } else if (expectedPattern instanceof RegExp) {
        success = expectedPattern.test(result);
      } else if (typeof expectedPattern === 'function') {
        success = expectedPattern(result);
      }
      
      if (success) {
        console.log(`✅ PASS: ${name}`);
        console.log(`   Result: ${result}`);
        this.results.passed++;
      } else {
        console.log(`❌ FAIL: ${name}`);
        console.log(`   Expected pattern: ${expectedPattern}`);
        console.log(`   Actual result: ${result}`);
        this.results.failed++;
        this.results.errors.push(`FAIL: ${name}`);
      }
    } catch (error) {
      console.log(`❌ ERROR: ${name} - ${error.message}`);
      this.results.failed++;
      this.results.errors.push(`ERROR: ${name} - ${error.message}`);
    }
  }

  runAllTests() {
    console.log("🚀 LaTeX Filter Integration Tests");
    console.log("=" .repeat(50));

    // Test 1: Basic text escaping
    this.runTest(
      'Basic LaTeX escaping',
      '{{ text | texEscape }}',
      { text: 'Hello & World $ 100%' },
      'Hello \\& World \\$ 100\\%'
    );

    // Test 2: Math mode formatting
    this.runTest(
      'Inline math formatting',
      '{{ formula | mathMode }}',
      { formula: 'E = mc^2' },
      '$E = mc^2$'
    );

    // Test 3: Display math formatting
    this.runTest(
      'Display math formatting',
      '{{ formula | mathMode(false) }}',
      { formula: 'E = mc^2' },
      '\\[E = mc^2\\]'
    );

    // Test 4: Citation generation
    this.runTest(
      'Standard citation',
      '{{ key | citation }}',
      { key: 'einstein1905' },
      '\\cite{einstein1905}'
    );

    // Test 5: Natbib citation
    this.runTest(
      'Natbib citation',
      '{{ key | citation("natbib") }}',
      { key: 'einstein1905' },
      '\\citep{einstein1905}'
    );

    // Test 6: LaTeX command generation
    this.runTest(
      'LaTeX command generation',
      '{{ text | latexCommand("textbf") }}',
      { text: 'Bold Text' },
      '\\textbf{Bold Text}'
    );

    // Test 7: Environment generation
    this.runTest(
      'Environment generation',
      '{{ content | environment("center") }}',
      { content: 'Centered text' },
      '\\begin{center}\nCentered text\n\\end{center}'
    );

    // Test 8: Document class generation  
    this.runTest(
      'Document class generation',
      '{{ options | latexDocClass("article") }}',
      { options: '12pt,a4paper' },
      '\\documentclass[12pt,a4paper]{article}'
    );

    // Test 9: Package usage
    this.runTest(
      'Package usage',
      '{{ package | usePackage }}',
      { package: 'amsmath' },
      '\\usepackage{amsmath}'
    );

    // Test 10: Package with options
    this.runTest(
      'Package with options',
      '{{ pkg | usePackage("margin=1in") }}',
      { pkg: 'geometry' },
      '\\usepackage[margin=1in]{geometry}'
    );

    // Test 11: Section generation
    this.runTest(
      'Section generation',
      '{{ title | section }}',
      { title: 'Introduction' },
      '\\section{Introduction}'
    );

    // Test 12: Unnumbered section
    this.runTest(
      'Unnumbered section',
      '{{ title | section("section", false) }}',
      { title: 'Introduction' },
      '\\section*{Introduction}'
    );

    // Test 13: Math environment
    this.runTest(
      'Math environment',
      '{{ eq | mathEnvironment("equation") }}',
      { eq: 'x = y + z' },
      '\\begin{equation}\nx = y + z\n\\end{equation}'
    );

    // Test 14: BibTeX entry
    this.runTest(
      'BibTeX entry generation',
      '{{ entry | bibtex }}',
      { 
        entry: {
          type: 'article',
          key: 'test2023',
          title: 'Test Article',
          author: 'John Doe',
          year: '2023'
        }
      },
      result => result.includes('@article{test2023,') && 
                result.includes('title = {Test Article}') &&
                result.includes('author = {John Doe}') &&
                result.includes('year = 2023')
    );

    // Test 15: arXiv metadata
    this.runTest(
      'arXiv metadata',
      '{{ arxiv | arXivMeta }}',
      { arxiv: '2301.00001' },
      'arXiv:2301.00001'
    );

    // Test 16: arXiv category
    this.runTest(
      'arXiv category description',
      '{{ category | arXivCategory }}',
      { category: 'cs.AI' },
      'Artificial Intelligence'
    );

    // Test 17: LaTeX table
    this.runTest(
      'LaTeX table generation',
      '{{ data | latexTable }}',
      { 
        data: [
          { name: 'John', age: 25 },
          { name: 'Jane', age: 30 }
        ]
      },
      result => result.includes('\\begin{table}') &&
                result.includes('\\begin{tabular}') &&
                result.includes('John & 25') &&
                result.includes('Jane & 30')
    );

    // Test 18: LaTeX list
    this.runTest(
      'LaTeX itemize list',
      '{{ items | latexList("itemize") }}',
      { items: ['First item', 'Second item', 'Third item'] },
      result => result.includes('\\begin{itemize}') &&
                result.includes('\\item First item') &&
                result.includes('\\item Second item') &&
                result.includes('\\end{itemize}')
    );

    // Test 19: LaTeX figure
    this.runTest(
      'LaTeX figure generation',
      '{{ image | latexFigure({"caption": "Test Figure"}) }}',
      { image: 'test-image.png' },
      result => result.includes('\\begin{figure}') &&
                result.includes('\\includegraphics') &&
                result.includes('{test-image.png}') &&
                result.includes('\\caption{Test Figure}')
    );

    // Test 20: Filter chaining
    this.runTest(
      'Filter chaining - escape and command',
      '{{ text | texEscape | latexCommand("textbf") }}',
      { text: 'Bold & Escaped' },
      '\\textbf{Bold \\& Escaped}'
    );

    // Summary
    console.log("\n" + "=" .repeat(50));
    console.log("🎯 INTEGRATION TEST SUMMARY");
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

// Run integration tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new LaTeXIntegrationTester();
  const success = tester.runAllTests();
  process.exit(success ? 0 : 1);
}

export { LaTeXIntegrationTester };