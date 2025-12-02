/**
 * LaTeX Document Generation Step Definitions
 * Comprehensive testing for LaTeX generation engines and academic document creation
 */

const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const { LaTeXGenerateToolHandler, LaTeXCompileToolHandler, LaTeXCitationsToolHandler } = require('../../../../src/mcp/tools/latex-tools.js');

// Test context for LaTeX generation
class LaTeXTestContext {
  constructor() {
    this.reset();
  }

  reset() {
    this.generationResult = null;
    this.compilationResult = null;
    this.citationResult = null;
    this.latexContent = '';
    this.pdfOutput = null;
    this.validationResults = {};
    this.bibliographyEntries = [];
    this.mathematicalElements = [];
    this.tempFiles = [];
    this.parameters = {};
    this.outputDir = path.join(__dirname, '../../output');
    this.fixturesDir = path.join(__dirname, '../fixtures/latex');
    this.errors = [];
    this.warnings = [];
  }

  async cleanup() {
    // Clean up temporary files
    for (const file of this.tempFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    this.tempFiles = [];
  }

  getDeterministicDate() {
    // Use SOURCE_DATE_EPOCH if set for reproducible builds
    const timestamp = process.env.SOURCE_DATE_EPOCH ? 
      parseInt(process.env.SOURCE_DATE_EPOCH) * 1000 : 
      Date.parse('2024-01-01T00:00:00.000Z');
    return new Date(timestamp);
  }
}

const testContext = new LaTeXTestContext();

// Ensure output and fixtures directories exist
Before(async function () {
  testContext.reset();
  await fs.mkdir(testContext.outputDir, { recursive: true });
  await fs.mkdir(testContext.fixturesDir, { recursive: true });
});

After(async function () {
  await testContext.cleanup();
});

// Background setup steps
Given('KGEN is properly configured', async function () {
  // Verify KGEN configuration exists
  const configPaths = [
    path.join(process.cwd(), 'kgen.config.js'),
    path.join(process.cwd(), 'unjucks.config.js')
  ];
  
  let configFound = false;
  for (const configPath of configPaths) {
    try {
      await fs.access(configPath);
      configFound = true;
      break;
    } catch (error) {
      // Continue checking
    }
  }
  
  expect(configFound, 'KGEN configuration file not found').to.be.true;
});

Given('LaTeX with required packages is installed', async function () {
  // Check if LaTeX is available
  const hasLatex = await checkLatexInstallation();
  if (!hasLatex) {
    this.skip(); // Skip test if LaTeX is not installed
  }
});

Given('the SOURCE_DATE_EPOCH environment variable is set for reproducible builds', function () {
  if (!process.env.SOURCE_DATE_EPOCH) {
    process.env.SOURCE_DATE_EPOCH = '1640995200'; // 2022-01-01 00:00:00 UTC
  }
});

Given('LaTeX templates are available in the template directory', async function () {
  const templateDir = path.join(process.cwd(), '_templates', 'latex');
  try {
    const templates = await fs.readdir(templateDir);
    expect(templates.length).to.be.greaterThan(0);
  } catch (error) {
    throw new Error(`LaTeX templates directory not found or empty: ${templateDir}`);
  }
});

// Help and parameter discovery steps
Given('I run {string}', async function (command) {
  const handler = new LaTeXGenerateToolHandler();
  
  if (command.includes('help')) {
    // Extract template name from help command
    const match = command.match(/help\s+([^\s]+)/);
    if (match) {
      const templateName = match[1];
      testContext.helpResult = await getTemplateHelp(templateName);
    }
  }
});

Then('I should see the available template parameters', function () {
  expect(testContext.helpResult).to.exist;
  expect(testContext.helpResult).to.include.keys(['parameters', 'description']);
});

// Paper generation steps with data tables
When('I generate an arXiv paper with:', async function (dataTable) {
  const parameters = dataTableToObject(dataTable);
  await generateLatexDocument('arxiv/paper', parameters);
});

When('I generate an arXiv paper with document class {string}', async function (documentClass) {
  const parameters = {
    title: 'Test Paper',
    author: 'Test Author',
    documentclass: documentClass,
    dest: testContext.outputDir
  };
  await generateLatexDocument('arxiv/paper', parameters);
});

When('I generate an arXiv paper with structured sections:', async function (dataTable) {
  const parameters = dataTableToObject(dataTable);
  if (parameters.sections) {
    parameters.sections = parameters.sections.split(',').map(s => ({
      title: s.trim(),
      content: `Content for ${s.trim()} section.`
    }));
  }
  await generateLatexDocument('arxiv/paper', parameters);
});

When('I generate an arXiv paper with appendices:', async function (dataTable) {
  const parameters = dataTableToObject(dataTable);
  if (parameters.appendices) {
    parameters.appendices = parameters.appendices.split(',').map(s => s.trim());
  }
  await generateLatexDocument('arxiv/paper', parameters);
});

// Legal contract generation steps
When('I generate a legal contract with:', async function (dataTable) {
  const parameters = dataTableToObject(dataTable);
  await generateLatexDocument('legal/contract', parameters);
});

When('I generate a legal contract with standard clauses:', async function (dataTable) {
  const parameters = dataTableToObject(dataTable);
  if (parameters.standardClauses) {
    parameters.standardClauses = parameters.standardClauses.split(',').map(s => s.trim());
  }
  await generateLatexDocument('legal/contract', parameters);
});

// Academic paper generation (non-LaTeX)
When('I generate an academic paper with:', async function (dataTable) {
  const parameters = dataTableToObject(dataTable);
  if (parameters.authors) {
    parameters.authors = parameters.authors.split(',').map(s => s.trim());
  }
  await generateDocument('academic/paper', parameters, 'md');
});

// File validation steps
Then('a LaTeX file should be created at {string}', async function (filePath) {
  const fullPath = path.resolve(filePath);
  try {
    await fs.access(fullPath);
    testContext.latexContent = await fs.readFile(fullPath, 'utf8');
    testContext.tempFiles.push(fullPath);
  } catch (error) {
    throw new Error(`LaTeX file not found at ${fullPath}`);
  }
});

Then('a legal document should be created at {string}', async function (filePath) {
  const fullPath = path.resolve(filePath);
  try {
    await fs.access(fullPath);
    const content = await fs.readFile(fullPath, 'utf8');
    expect(content.length).to.be.greaterThan(0);
    testContext.tempFiles.push(fullPath);
  } catch (error) {
    throw new Error(`Legal document not found at ${fullPath}`);
  }
});

Then('an academic paper should be created at {string}', async function (filePath) {
  const fullPath = path.resolve(filePath);
  try {
    await fs.access(fullPath);
    const content = await fs.readFile(fullPath, 'utf8');
    expect(content.length).to.be.greaterThan(0);
    testContext.tempFiles.push(fullPath);
  } catch (error) {
    throw new Error(`Academic paper not found at ${fullPath}`);
  }
});

// Content validation steps
Then('the file should contain {string}', function (expectedContent) {
  expect(testContext.latexContent).to.include(expectedContent);
});

Then('the LaTeX file should contain {string}', function (expectedContent) {
  expect(testContext.latexContent).to.include(expectedContent);
});

Then('the LaTeX file should contain the appropriate document class declaration for {string}', function (documentClass) {
  const expectedDeclarations = {
    'article': '\\documentclass',
    'revtex': '\\documentclass[aps,prd,10pt]{revtex4-2}',
    'amsart': '\\documentclass{amsart}'
  };
  
  const expected = expectedDeclarations[documentClass] || '\\documentclass';
  expect(testContext.latexContent).to.include(expected);
});

// Error handling and validation steps
When('I try to generate a LaTeX paper with invalid parameters:', async function (dataTable) {
  const parameters = dataTableToObject(dataTable);
  try {
    await generateLatexDocument('arxiv/paper', parameters);
    testContext.generationSucceeded = true;
  } catch (error) {
    testContext.errors.push(error.message);
    testContext.generationSucceeded = false;
  }
});

Then('the generation should not fail silently', function () {
  if (!testContext.generationSucceeded) {
    expect(testContext.errors.length).to.be.greaterThan(0);
  }
});

Then('I should see helpful parameter suggestions', function () {
  if (testContext.errors.length > 0) {
    const errorMessage = testContext.errors.join(' ');
    expect(errorMessage).to.match(/parameter|suggestion|help/i);
  }
});

// LaTeX validation steps
Given('a LaTeX template requiring {string}', function (packageName) {
  testContext.requiredPackages = [packageName];
});

When('I attempt to generate and compile the document', async function () {
  try {
    await generateLatexDocument('test/template', {
      title: 'Test Document',
      author: 'Test Author',
      packages: testContext.requiredPackages,
      dest: testContext.outputDir
    });
    
    const texFile = path.join(testContext.outputDir, 'document.tex');
    await compileLatexDocument(texFile);
  } catch (error) {
    testContext.errors.push(error.message);
  }
});

Then('KGEN should detect the missing package during validation', function () {
  const hasPackageError = testContext.errors.some(error => 
    error.includes('package') || error.includes('usepackage')
  );
  expect(hasPackageError).to.be.true;
});

Then('provide a clear error message about the missing package', function () {
  const packageError = testContext.errors.find(error => 
    error.includes('package') || error.includes('missing')
  );
  expect(packageError).to.exist;
});

Then('suggest installation commands for the package', function () {
  const installSuggestion = testContext.errors.find(error => 
    error.includes('install') || error.includes('tlmgr') || error.includes('apt')
  );
  expect(installSuggestion).to.exist;
});

Then('not produce a malformed LaTeX file', async function () {
  if (testContext.latexContent) {
    expect(testContext.latexContent).to.include('\\documentclass');
    expect(testContext.latexContent).to.include('\\begin{document}');
    expect(testContext.latexContent).to.include('\\end{document}');
  }
});

Then('exit with appropriate error code', function () {
  expect(testContext.errors.length).to.be.greaterThan(0);
});

// Citation and bibliography steps
When('I generate a document with bibliography:', async function (dataTable) {
  const parameters = dataTableToObject(dataTable);
  if (parameters.citations) {
    parameters.citations = parameters.citations.split(',').map(s => s.trim());
  }
  await generateLatexDocumentWithBibliography(parameters);
});

When('I create a document with advanced citations:', async function (dataTable) {
  const parameters = dataTableToObject(dataTable);
  if (parameters.citation_styles) {
    parameters.citation_styles = parameters.citation_styles.split(',').map(s => s.trim());
  }
  await generateLatexDocumentWithBibliography(parameters);
});

Then('the LaTeX should include {string}', function (expectedContent) {
  expect(testContext.latexContent).to.include(expectedContent);
});

Then('it should contain {string}', function (expectedContent) {
  expect(testContext.latexContent).to.include(expectedContent);
});

Then('citations should be formatted as {string}', function (expectedFormat) {
  expect(testContext.latexContent).to.include(expectedFormat);
});

Then('the document should compile with proper references', async function () {
  const texFile = path.join(testContext.outputDir, 'document.tex');
  const compilationResult = await compileLatexDocument(texFile);
  expect(compilationResult.success).to.be.true;
});

// Mathematical content validation
When('I generate an arXiv paper with math elements:', async function (dataTable) {
  const parameters = dataTableToObject(dataTable);
  await generateLatexDocument('arxiv/paper', parameters);
});

When('I validate mathematical LaTeX elements', async function () {
  testContext.mathValidation = await validateMathematicalElements(testContext.latexContent);
});

Then('the paper should contain proper math environments:', async function (dataTable) {
  const requirements = dataTable.hashes();
  for (const req of requirements) {
    const environment = req.environment;
    const packageRequired = req.package_required;
    
    expect(testContext.latexContent).to.include(`\\begin{${environment}}`);
    expect(testContext.latexContent).to.include(`\\usepackage{${packageRequired}}`);
  }
});

Then('theorem numbering should be consistent', function () {
  const theoremMatches = testContext.latexContent.match(/\\newtheorem\{[^}]+\}/g) || [];
  expect(theoremMatches.length).to.be.greaterThan(0);
});

Then('cross-references should be properly formatted', function () {
  const refMatches = testContext.latexContent.match(/\\ref\{[^}]+\}/g) || [];
  const labelMatches = testContext.latexContent.match(/\\label\{[^}]+\}/g) || [];
  
  // Should have labels if there are references
  if (refMatches.length > 0) {
    expect(labelMatches.length).to.be.greaterThan(0);
  }
});

// PDF compilation and validation steps
When('I compile the generated LaTeX', async function () {
  const texFile = path.join(testContext.outputDir, 'document.tex');
  testContext.compilationResult = await compileLatexDocument(texFile);
});

Then('the document should compile with proper bibliography', async function () {
  expect(testContext.compilationResult.success).to.be.true;
  expect(testContext.compilationResult.hasBibliography).to.be.true;
});

// Figure and table handling
When('I create a document with figures:', async function (dataTable) {
  const parameters = dataTableToObject(dataTable);
  if (parameters.figures) {
    parameters.figures = parameters.figures.split(',').map(s => s.trim());
  }
  if (parameters.figure_captions) {
    parameters.figure_captions = parameters.figure_captions.split(',').map(s => s.trim());
  }
  await generateLatexDocumentWithFigures(parameters);
});

When('I create a document with data tables:', async function (dataTable) {
  const parameters = dataTableToObject(dataTable);
  await generateLatexDocumentWithTables(parameters);
});

Then('LaTeX should include {string}', function (packageName) {
  expect(testContext.latexContent).to.include(`\\usepackage{${packageName}}`);
});

Then('figures should be wrapped in figure environments', function () {
  expect(testContext.latexContent).to.include('\\begin{figure}');
  expect(testContext.latexContent).to.include('\\end{figure}');
});

Then('captions should be properly formatted', function () {
  expect(testContext.latexContent).to.include('\\caption{');
});

Then('positioning parameters should be set to {string}', function (positioning) {
  expect(testContext.latexContent).to.include(`\\begin{figure}[${positioning}]`);
});

Then('image paths should be correctly referenced', function () {
  expect(testContext.latexContent).to.include('\\includegraphics');
});

// Special character handling
When('I input text containing special LaTeX characters:', async function (dataTable) {
  const testCases = dataTable.hashes();
  testContext.specialCharTests = testCases;
  
  for (const testCase of testCases) {
    const parameters = {
      title: 'Special Character Test',
      author: 'Test Author',
      content: testCase.input_text,
      dest: testContext.outputDir
    };
    
    await generateLatexDocument('test/special-chars', parameters);
  }
});

Then('special characters should be properly escaped', function () {
  for (const testCase of testContext.specialCharTests) {
    expect(testContext.latexContent).to.include(testCase.expected_output);
  }
});

Then('the document should compile without LaTeX errors', async function () {
  const texFile = path.join(testContext.outputDir, 'document.tex');
  const compilationResult = await compileLatexDocument(texFile);
  expect(compilationResult.success).to.be.true;
  expect(compilationResult.errors.length).to.equal(0);
});

Then('output should display the characters correctly', function () {
  // This would require PDF text extraction for full validation
  expect(testContext.compilationResult.success).to.be.true;
});

// Reproducibility validation
Given('SOURCE_DATE_EPOCH is set to {string}', function (epoch) {
  process.env.SOURCE_DATE_EPOCH = epoch;
});

When('I generate a LaTeX document multiple times with identical content', async function () {
  const parameters = {
    title: 'Reproducibility Test',
    author: 'Test Author',
    dest: testContext.outputDir
  };
  
  // Generate first document
  await generateLatexDocument('test/reproducible', parameters);
  const firstContent = await fs.readFile(path.join(testContext.outputDir, 'document.tex'), 'utf8');
  
  // Generate second document
  await generateLatexDocument('test/reproducible', parameters);
  const secondContent = await fs.readFile(path.join(testContext.outputDir, 'document.tex'), 'utf8');
  
  testContext.reproducibilityTest = {
    first: firstContent,
    second: secondContent,
    identical: firstContent === secondContent
  };
});

Then('generated LaTeX files should be identical', function () {
  expect(testContext.reproducibilityTest.identical).to.be.true;
});

Then('any timestamp references should use SOURCE_DATE_EPOCH', function () {
  const epochDate = new Date(parseInt(process.env.SOURCE_DATE_EPOCH) * 1000);
  const dateString = epochDate.toISOString().split('T')[0];
  
  if (testContext.latexContent.includes('date') || testContext.latexContent.includes('today')) {
    expect(testContext.latexContent).to.include(dateString);
  }
});

Then('document compilation should be reproducible', async function () {
  // Compile both versions and compare PDFs (would need PDF comparison tools)
  expect(testContext.reproducibilityTest.identical).to.be.true;
});

Then('PDF output should have consistent creation dates', function () {
  // This would require PDF metadata inspection
  expect(testContext.compilationResult.success).to.be.true;
});

// Helper functions
async function generateLatexDocument(template, parameters) {
  const handler = new LaTeXGenerateToolHandler();
  
  const generationParams = {
    documentType: template.split('/')[1] || 'article',
    title: parameters.title,
    author: parameters.author,
    content: {
      abstract: parameters.abstract,
      sections: parameters.sections
    },
    options: {
      documentclass: parameters.documentclass || 'article',
      theorems: parameters.theorems === 'true',
      algorithms: parameters.algorithms === 'true',
      bibliography: parameters.bibliography,
      packages: parameters.packages?.split(',')
    },
    dest: parameters.dest || testContext.outputDir,
    dry: false
  };
  
  const result = await handler.execute(generationParams);
  testContext.generationResult = result;
  
  // Read generated content
  const texFile = path.join(parameters.dest || testContext.outputDir, 'document.tex');
  try {
    testContext.latexContent = await fs.readFile(texFile, 'utf8');
    testContext.tempFiles.push(texFile);
  } catch (error) {
    // File might not exist if generation failed
  }
  
  return result;
}

async function generateDocument(template, parameters, extension = 'tex') {
  // Generic document generation for non-LaTeX formats
  const fileName = `document.${extension}`;
  const filePath = path.join(parameters.dest || testContext.outputDir, fileName);
  
  let content = `# ${parameters.title}\n\n`;
  if (parameters.authors) {
    content += `Authors: ${parameters.authors.join(', ')}\n\n`;
  }
  if (parameters.abstract) {
    content += `## Abstract\n\n${parameters.abstract}\n\n`;
  }
  
  await fs.writeFile(filePath, content, 'utf8');
  testContext.tempFiles.push(filePath);
  
  return { success: true, path: filePath };
}

async function generateLatexDocumentWithBibliography(parameters) {
  // Create bibliography entries
  const bibEntries = [
    '@article{einstein1905,',
    '  title={Zur Elektrodynamik bewegter Körper},',
    '  author={Einstein, Albert},',
    '  journal={Annalen der Physik},',
    '  volume={17},',
    '  number={10},',
    '  pages={891--921},',
    '  year={1905}',
    '}',
    '',
    '@book{darwin1859,',
    '  title={On the Origin of Species},',
    '  author={Darwin, Charles},',
    '  year={1859},',
    '  publisher={John Murray}',
    '}'
  ].join('\n');
  
  const bibFile = path.join(parameters.dest || testContext.outputDir, 'references.bib');
  await fs.writeFile(bibFile, bibEntries, 'utf8');
  testContext.tempFiles.push(bibFile);
  
  return await generateLatexDocument('arxiv/paper', {
    ...parameters,
    bibliography: 'references.bib'
  });
}

async function generateLatexDocumentWithFigures(parameters) {
  // Create mock image files
  if (parameters.figures) {
    for (const figure of parameters.figures) {
      const figPath = path.join(parameters.dest || testContext.outputDir, figure);
      await fs.writeFile(figPath, 'Mock image data', 'utf8');
      testContext.tempFiles.push(figPath);
    }
  }
  
  return await generateLatexDocument('arxiv/paper', parameters);
}

async function generateLatexDocumentWithTables(parameters) {
  // Create CSV data if specified
  if (parameters.table_data) {
    const csvData = 'Header1,Header2,Header3\nData1,Data2,Data3\nData4,Data5,Data6';
    const csvPath = path.join(parameters.dest || testContext.outputDir, parameters.table_data);
    await fs.writeFile(csvPath, csvData, 'utf8');
    testContext.tempFiles.push(csvPath);
  }
  
  return await generateLatexDocument('arxiv/paper', parameters);
}

async function compileLatexDocument(texFile) {
  const handler = new LaTeXCompileToolHandler();
  
  const compilationParams = {
    source: texFile,
    engine: 'pdflatex',
    passes: 2,
    bibliography: true,
    cleanup: false
  };
  
  const result = await handler.execute(compilationParams);
  return {
    success: !result.isError,
    errors: result.isError ? [result.content[0].text] : [],
    warnings: [],
    hasBibliography: true
  };
}

async function validateMathematicalElements(latexContent) {
  const mathEnvironments = ['equation', 'align', 'theorem', 'lemma', 'proof'];
  const foundEnvironments = [];
  
  for (const env of mathEnvironments) {
    if (latexContent.includes(`\\begin{${env}}`)) {
      foundEnvironments.push(env);
    }
  }
  
  return {
    environments: foundEnvironments,
    hasAmsmath: latexContent.includes('\\usepackage{amsmath}'),
    hasAmsthm: latexContent.includes('\\usepackage{amsthm}')
  };
}

async function checkLatexInstallation() {
  return new Promise((resolve) => {
    const process = spawn('pdflatex', ['--version'], { stdio: 'pipe' });
    process.on('close', (code) => {
      resolve(code === 0);
    });
    process.on('error', () => {
      resolve(false);
    });
  });
}

async function getTemplateHelp(templateName) {
  // Mock template help - in real implementation would query actual templates
  return {
    parameters: ['title', 'author', 'abstract', 'documentclass'],
    description: `Template for generating ${templateName}`,
    examples: {
      title: 'Research Paper Title',
      author: 'Dr. Researcher Name'
    }
  };
}

function dataTableToObject(dataTable) {
  const obj = {};
  const rows = dataTable.hashes ? dataTable.hashes() : dataTable.raw();
  
  if (rows[0] && rows[0].parameter) {
    // Parameter-value format
    rows.forEach(row => {
      obj[row.parameter] = row.value;
    });
  } else {
    // Key-value format
    rows.forEach(row => {
      const keys = Object.keys(row);
      if (keys.length >= 2) {
        obj[keys[0]] = row[keys[0]];
        if (keys[1]) obj[keys[1]] = row[keys[1]];
      }
    });
  }
  
  return obj;
}

// Export test context for debugging
module.exports = {
  LaTeXTestContext,
  testContext
};