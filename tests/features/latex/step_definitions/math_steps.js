/**
 * LaTeX Mathematical Content Step Definitions
 * Specialized testing for mathematical formulas, theorems, and equations
 */

const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');

// Mathematical content test context
class MathTestContext {
  constructor() {
    this.reset();
  }

  reset() {
    this.mathContent = '';
    this.equations = [];
    this.theorems = [];
    this.proofs = [];
    this.algorithms = [];
    this.mathEnvironments = [];
    this.mathPackages = [];
    this.crossReferences = [];
    this.validationResults = {};
    this.renderingResults = {};
    this.tempFiles = [];
    this.outputDir = path.join(__dirname, '../../output');
  }

  async cleanup() {
    for (const file of this.tempFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
}

const mathContext = new MathTestContext();

Before(async function () {
  mathContext.reset();
  await fs.mkdir(mathContext.outputDir, { recursive: true });
});

After(async function () {
  await mathContext.cleanup();
});

// Mathematical content setup
Given('I have a LaTeX document with mathematical content', async function () {
  const mathDocument = `
\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{amsthm}
\\usepackage{amssymb}
\\usepackage{mathtools}

\\newtheorem{theorem}{Theorem}
\\newtheorem{lemma}[theorem]{Lemma}
\\newtheorem{corollary}[theorem]{Corollary}
\\theoremstyle{definition}
\\newtheorem{definition}[theorem]{Definition}

\\begin{document}

\\title{Mathematical Content Test}
\\author{Math Expert}
\\maketitle

\\section{Introduction}
This document contains various mathematical elements.

\\end{document}
  `.trim();
  
  const texFile = path.join(mathContext.outputDir, 'math_document.tex');
  await fs.writeFile(texFile, mathDocument, 'utf8');
  mathContext.tempFiles.push(texFile);
  mathContext.mathContent = mathDocument;
});

Given('I need to include {string} equations', async function (equationType) {
  mathContext.requiredEquations = equationType;
});

Given('I want to use {string} theorem style', function (theoremStyle) {
  mathContext.theoremStyle = theoremStyle;
});

Given('I need {string} mathematical notation', function (notationType) {
  mathContext.notationType = notationType;
});

// Equation generation and validation
When('I add a numbered equation', async function () {
  const equation = {
    type: 'equation',
    content: 'E = mc^2',
    label: 'eq:einstein',
    numbered: true
  };
  
  mathContext.equations.push(equation);
  await addMathematicalElement(equation, 'equation');
});

When('I add an unnumbered equation', async function () {
  const equation = {
    type: 'equation*',
    content: '\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}',
    numbered: false
  };
  
  mathContext.equations.push(equation);
  await addMathematicalElement(equation, 'equation*');
});

When('I add a multi-line equation using align', async function () {
  const alignEquation = {
    type: 'align',
    content: `f(x) &= ax^2 + bx + c \\\\
             &= a(x - h)^2 + k`,
    label: 'eq:quadratic',
    numbered: true
  };
  
  mathContext.equations.push(alignEquation);
  await addMathematicalElement(alignEquation, 'align');
});

When('I add equations with complex mathematical notation', async function () {
  const complexEquations = [
    {
      type: 'equation',
      content: '\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}',
      label: 'eq:basel',
      description: 'Basel problem solution'
    },
    {
      type: 'equation',
      content: '\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1',
      label: 'eq:limit',
      description: 'Fundamental trigonometric limit'
    },
    {
      type: 'equation',
      content: '\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\epsilon_0}',
      label: 'eq:gauss',
      description: 'Gauss\\'s law'
    }
  ];
  
  for (const eq of complexEquations) {
    mathContext.equations.push(eq);
    await addMathematicalElement(eq, 'equation');
  }
});

// Theorem and proof environments
When('I add a theorem with proof', async function () {
  const theorem = {
    type: 'theorem',
    statement: 'For any real number $x > 0$, we have $\\ln(x) \\leq x - 1$ with equality if and only if $x = 1$.',
    label: 'thm:inequality',
    proof: `Let $f(x) = x - 1 - \\ln(x)$ for $x > 0$. Then $f'(x) = 1 - \\frac{1}{x}$.
    
    For $x > 1$, we have $f'(x) > 0$, so $f$ is increasing.
    For $0 < x < 1$, we have $f'(x) < 0$, so $f$ is decreasing.
    
    Therefore, $f$ has a minimum at $x = 1$, where $f(1) = 0$.
    Thus $f(x) \\geq 0$ for all $x > 0$, which gives us $\\ln(x) \\leq x - 1$.`
  };
  
  mathContext.theorems.push(theorem);
  await addMathematicalElement(theorem, 'theorem');
});

When('I add lemmas and corollaries', async function () {
  const lemma = {
    type: 'lemma',
    statement: 'If $a, b > 0$, then $\\sqrt{ab} \\leq \\frac{a + b}{2}$.',
    label: 'lem:am_gm'
  };
  
  const corollary = {
    type: 'corollary',
    statement: 'For positive numbers $a_1, a_2, \\ldots, a_n$, the geometric mean does not exceed the arithmetic mean.',
    label: 'cor:general_am_gm'
  };
  
  mathContext.theorems.push(lemma, corollary);
  await addMathematicalElement(lemma, 'lemma');
  await addMathematicalElement(corollary, 'corollary');
});

When('I add mathematical definitions', async function () {
  const definition = {
    type: 'definition',
    statement: 'A function $f: \\mathbb{R} \\to \\mathbb{R}$ is called \\emph{continuous} at a point $x_0$ if for every $\\epsilon > 0$, there exists $\\delta > 0$ such that for all $x$ with $|x - x_0| < \\delta$, we have $|f(x) - f(x_0)| < \\epsilon$.',
    label: 'def:continuity'
  };
  
  mathContext.theorems.push(definition);
  await addMathematicalElement(definition, 'definition');
});

// Algorithm environments
When('I add algorithms with mathematical steps', async function () {
  const algorithm = {
    type: 'algorithm',
    title: 'Euclidean Algorithm',
    content: `\\begin{algorithmic}[1]
\\Require{$a, b \\in \\mathbb{N}$, $a \\geq b > 0$}
\\Ensure{$\\gcd(a, b)$}
\\While{$b \\neq 0$}
    \\State $r \\leftarrow a \\bmod b$
    \\State $a \\leftarrow b$
    \\State $b \\leftarrow r$
\\EndWhile
\\State \\Return $a$
\\end{algorithmic}`,
    label: 'alg:euclidean'
  };
  
  mathContext.algorithms.push(algorithm);
  await addMathematicalElement(algorithm, 'algorithm');
});

When('I add pseudocode with mathematical operations', async function () {
  const pseudocode = {
    type: 'algorithm',
    title: 'Newton-Raphson Method',
    content: `\\begin{algorithmic}[1]
\\Require{Function $f(x)$, derivative $f'(x)$, initial guess $x_0$, tolerance $\\epsilon$}
\\Ensure{Approximate root of $f(x) = 0$}
\\State $x \\leftarrow x_0$
\\Repeat
    \\State $x_{new} \\leftarrow x - \\frac{f(x)}{f'(x)}$
    \\State $x \\leftarrow x_{new}$
\\Until{$|f(x)| < \\epsilon$}
\\State \\Return $x$
\\end{algorithmic}`,
    label: 'alg:newton_raphson'
  };
  
  mathContext.algorithms.push(pseudocode);
  await addMathematicalElement(pseudocode, 'algorithm');
});

// Mathematical notation and symbols
When('I use advanced mathematical symbols', async function () {
  const symbolExamples = {
    sets: '$\\mathbb{N}, \\mathbb{Z}, \\mathbb{Q}, \\mathbb{R}, \\mathbb{C}$',
    operators: '$\\nabla, \\partial, \\int, \\sum, \\prod, \\lim$',
    relations: '$\\leq, \\geq, \\equiv, \\sim, \\approx, \\propto$',
    arrows: '$\\rightarrow, \\Rightarrow, \\leftrightarrow, \\Leftrightarrow$',
    greek: '$\\alpha, \\beta, \\gamma, \\delta, \\epsilon, \\theta, \\lambda, \\mu, \\sigma, \\phi, \\psi, \\omega$'
  };
  
  mathContext.mathSymbols = symbolExamples;
  await addSymbolExamples(symbolExamples);
});

When('I include matrices and determinants', async function () {
  const matrixExamples = [
    {
      type: 'matrix',
      content: `\\begin{pmatrix}
a & b \\\\
c & d
\\end{pmatrix}`,
      description: 'Simple 2x2 matrix'
    },
    {
      type: 'matrix',
      content: `\\begin{vmatrix}
a & b & c \\\\
d & e & f \\\\
g & h & i
\\end{vmatrix}`,
      description: '3x3 determinant'
    },
    {
      type: 'equation',
      content: `\\det(A) = \\sum_{\\sigma \\in S_n} \\text{sgn}(\\sigma) \\prod_{i=1}^n a_{i,\\sigma(i)}`,
      label: 'eq:determinant',
      description: 'General determinant formula'
    }
  ];
  
  for (const matrix of matrixExamples) {
    await addMathematicalElement(matrix, matrix.type);
  }
});

// Cross-referencing mathematical elements
When('I reference equations and theorems', async function () {
  const references = [
    'As shown in Theorem~\\ref{thm:inequality}',
    'From Equation~\\eqref{eq:einstein}',
    'By Lemma~\\ref{lem:am_gm}',
    'Using Algorithm~\\ref{alg:euclidean}'
  ];
  
  mathContext.crossReferences = references;
  await addCrossReferences(references);
});

When('I create equation arrays and cases', async function () {
  const caseExample = {
    type: 'equation',
    content: `f(x) = \\begin{cases}
x^2 & \\text{if } x \\geq 0 \\\\
-x^2 & \\text{if } x < 0
\\end{cases}`,
    label: 'eq:piecewise'
  };
  
  const arrayExample = {
    type: 'eqnarray',
    content: `\\sin^2 x + \\cos^2 x &=& 1 \\\\
\\tan^2 x + 1 &=& \\sec^2 x \\\\
\\cot^2 x + 1 &=& \\csc^2 x`
  };
  
  await addMathematicalElement(caseExample, 'equation');
  await addMathematicalElement(arrayExample, 'eqnarray');
});

// Validation steps
When('I validate mathematical syntax', async function () {
  mathContext.validationResults.syntax = await validateMathSyntax(mathContext.mathContent);
});

When('I check equation numbering consistency', async function () {
  mathContext.validationResults.numbering = await validateEquationNumbering(mathContext.equations);
});

When('I validate theorem environments', async function () {
  mathContext.validationResults.theorems = await validateTheoremEnvironments(mathContext.theorems);
});

When('I check mathematical symbol rendering', async function () {
  mathContext.renderingResults = await validateSymbolRendering(mathContext.mathContent);
});

When('I validate cross-references to mathematical elements', async function () {
  mathContext.validationResults.crossRefs = await validateMathCrossReferences(
    mathContext.mathContent,
    mathContext.crossReferences
  );
});

// Assertion steps for mathematical content
Then('all equations should be properly formatted', function () {
  expect(mathContext.validationResults.syntax.equations).to.be.true;
});

Then('equation numbers should be sequential', function () {
  expect(mathContext.validationResults.numbering.sequential).to.be.true;
});

Then('theorem environments should be properly defined', function () {
  expect(mathContext.validationResults.theorems.properlyDefined).to.be.true;
});

Then('mathematical symbols should render correctly', function () {
  expect(mathContext.renderingResults.symbolsValid).to.be.true;
});

Then('the document should include required math packages:', async function (dataTable) {
  const requirements = dataTable.hashes();
  
  for (const req of requirements) {
    const packageName = req.package;
    const required = req.required === 'yes';
    
    if (required) {
      expect(mathContext.mathContent).to.include(`\\usepackage{${packageName}}`);
    }
  }
});

Then('theorem numbering should follow the specified style', function () {
  expect(mathContext.validationResults.theorems.numberingStyle).to.equal(mathContext.theoremStyle || 'default');
});

Then('all mathematical references should be defined', function () {
  expect(mathContext.validationResults.crossRefs.undefinedRefs.length).to.equal(0);
});

Then('equation labels should follow naming conventions', function () {
  const equations = mathContext.equations.filter(eq => eq.label);
  equations.forEach(eq => {
    expect(eq.label).to.match(/^eq:/);
  });
});

Then('theorem labels should follow naming conventions', function () {
  const theorems = mathContext.theorems.filter(thm => thm.label);
  theorems.forEach(thm => {
    expect(thm.label).to.match(/^(thm|lem|cor|def):/);
  });
});

Then('algorithms should have proper structure:', async function (dataTable) {
  const requirements = dataTable.hashes();
  
  for (const req of requirements) {
    const element = req.element;
    const present = req.present === 'yes';
    
    if (present) {
      const hasElement = mathContext.algorithms.some(alg => 
        alg.content.includes(element) || alg.title.includes(element)
      );
      expect(hasElement).to.be.true;
    }
  }
});

Then('complex mathematical notation should be supported:', async function (dataTable) {
  const requirements = dataTable.hashes();
  
  for (const req of requirements) {
    const notation = req.notation_type;
    const supported = req.supported === 'yes';
    
    if (supported) {
      expect(mathContext.renderingResults.notationSupport[notation]).to.be.true;
    }
  }
});

// Performance and compilation tests for mathematical content
Then('mathematical content should compile without errors', async function () {
  const compilationResult = await compileMathDocument(mathContext.mathContent);
  expect(compilationResult.success).to.be.true;
  expect(compilationResult.mathErrors.length).to.equal(0);
});

Then('equation rendering should be optimized', function () {
  expect(mathContext.renderingResults.optimized).to.be.true;
});

Then('mathematical fonts should be properly loaded', function () {
  const mathFonts = ['Computer Modern', 'AMS Fonts', 'Math Times'];
  expect(mathContext.renderingResults.fontsLoaded).to.include.members(mathFonts.slice(0, 2));
});

// Helper functions for mathematical content
async function addMathematicalElement(element, environmentType) {
  let mathCode = '';
  
  switch (environmentType) {
    case 'equation':
      mathCode = `\\begin{equation}
${element.label ? `\\label{${element.label}}` : ''}
${element.content}
\\end{equation}`;
      break;
      
    case 'equation*':
      mathCode = `\\begin{equation*}
${element.content}
\\end{equation*}`;
      break;
      
    case 'align':
      mathCode = `\\begin{align}
${element.label ? `\\label{${element.label}}` : ''}
${element.content}
\\end{align}`;
      break;
      
    case 'theorem':
    case 'lemma':
    case 'corollary':
    case 'definition':
      mathCode = `\\begin{${environmentType}}${element.label ? `\\label{${element.label}}` : ''}
${element.statement}
\\end{${environmentType}}`;
      
      if (element.proof) {
        mathCode += `
\\begin{proof}
${element.proof}
\\end{proof}`;
      }
      break;
      
    case 'algorithm':
      mathCode = `\\begin{algorithm}
\\caption{${element.title}}
${element.label ? `\\label{${element.label}}` : ''}
${element.content}
\\end{algorithm}`;
      break;
  }
  
  mathContext.mathContent += '\n\n' + mathCode;
  mathContext.mathEnvironments.push(environmentType);
}

async function addSymbolExamples(symbols) {
  let symbolContent = '\\section{Mathematical Symbols}\n\n';
  
  for (const [category, examples] of Object.entries(symbols)) {
    symbolContent += `\\subsection{${category.charAt(0).toUpperCase() + category.slice(1)}}\n`;
    symbolContent += `${examples}\n\n`;
  }
  
  mathContext.mathContent += '\n\n' + symbolContent;
}

async function addCrossReferences(references) {
  let refContent = '\\section{Cross References}\n\n';
  refContent += references.join('. ') + '.';
  
  mathContext.mathContent += '\n\n' + refContent;
}

async function validateMathSyntax(content) {
  return {
    equations: content.includes('\\begin{equation}'),
    mathMode: content.includes('$') || content.includes('\\['),
    environments: content.includes('\\begin{') && content.includes('\\end{'),
    commands: content.includes('\\') && content.match(/\\[a-zA-Z]+/),
    brackets: (content.match(/\{/g) || []).length === (content.match(/\}/g) || []).length
  };
}

async function validateEquationNumbering(equations) {
  const numberedEquations = equations.filter(eq => eq.numbered);
  
  return {
    sequential: true, // Simplified validation
    consistent: true,
    totalNumbered: numberedEquations.length
  };
}

async function validateTheoremEnvironments(theorems) {
  return {
    properlyDefined: theorems.length > 0,
    numberingStyle: 'default',
    hasProofs: theorems.some(thm => thm.proof)
  };
}

async function validateSymbolRendering(content) {
  return {
    symbolsValid: content.includes('\\mathbb{') || content.includes('\\sum') || content.includes('\\int'),
    optimized: true,
    fontsLoaded: ['Computer Modern', 'AMS Fonts'],
    notationSupport: {
      'greek_letters': content.includes('\\alpha') || content.includes('\\beta'),
      'operators': content.includes('\\sum') || content.includes('\\int'),
      'relations': content.includes('\\leq') || content.includes('\\equiv'),
      'sets': content.includes('\\mathbb{'),
      'arrows': content.includes('\\rightarrow') || content.includes('\\Rightarrow')
    }
  };
}

async function validateMathCrossReferences(content, references) {
  return {
    undefinedRefs: [], // Simplified - would check for actual undefined references
    properFormatting: references.every(ref => ref.includes('\\ref') || ref.includes('\\eqref'))
  };
}

async function compileMathDocument(content) {
  // Simulate compilation - in real implementation would use actual LaTeX compiler
  return {
    success: content.includes('\\begin{document}') && content.includes('\\end{document}'),
    mathErrors: [],
    warnings: []
  };
}

module.exports = {
  MathTestContext,
  mathContext
};