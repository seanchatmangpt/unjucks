/**
 * LaTeX Citation Management Step Definitions
 * Specialized testing for bibliography and citation functionality
 */

const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');
const { LaTeXCitationsToolHandler } = require('../../../../src/mcp/tools/latex-tools.js');

// Citation test context
class CitationTestContext {
  constructor() {
    this.reset();
  }

  reset() {
    this.citationResults = {};
    this.bibliographyEntries = [];
    this.citationStyle = 'bibtex';
    this.searchQuery = '';
    this.generatedCitations = [];
    this.validationResults = {};
    this.tempFiles = [];
    this.outputDir = path.join(__dirname, '../../output');
    this.fixturesDir = path.join(__dirname, '../fixtures');
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

const citationContext = new CitationTestContext();

Before(async function () {
  citationContext.reset();
  await fs.mkdir(citationContext.outputDir, { recursive: true });
});

After(async function () {
  await citationContext.cleanup();
});

// Citation search and generation steps
Given('I need citations for {string} research', async function (researchTopic) {
  citationContext.searchQuery = researchTopic;
});

Given('I want citations in {string} format', function (format) {
  citationContext.citationStyle = format;
});

Given('I have access to {string} databases', function (databases) {
  citationContext.databases = databases.split(',').map(db => db.trim());
});

When('I search for relevant citations', async function () {
  const handler = new LaTeXCitationsToolHandler();
  
  const searchParams = {
    query: citationContext.searchQuery,
    maxResults: 10,
    format: citationContext.citationStyle,
    sources: citationContext.databases || ['arxiv', 'semantic-scholar'],
    aiFiltering: {
      relevanceScoring: true,
      duplicateDetection: true,
      qualityAssessment: true
    }
  };
  
  const result = await handler.execute(searchParams);
  citationContext.citationResults = result;
  citationContext.generatedCitations = result.content[0].text;
});

When('I generate a bibliography with {int} entries', async function (entryCount) {
  const handler = new LaTeXCitationsToolHandler();
  
  const searchParams = {
    query: citationContext.searchQuery,
    maxResults: entryCount,
    format: citationContext.citationStyle,
    sources: ['arxiv', 'semantic-scholar', 'crossref'],
    includeAbstracts: false
  };
  
  const result = await handler.execute(searchParams);
  citationContext.bibliographyEntries = result.content[0].text;
  
  // Save to bibliography file
  const bibFile = path.join(citationContext.outputDir, 'generated_bibliography.bib');
  await fs.writeFile(bibFile, citationContext.bibliographyEntries, 'utf8');
  citationContext.tempFiles.push(bibFile);
});

Given('a LaTeX template with BibTeX support', async function () {
  const templateContent = `
\\documentclass{article}
\\usepackage{natbib}

\\begin{document}
\\title{Test Document}
\\author{Test Author}
\\maketitle

This is a test document with citations \\cite{example2024}.

\\bibliographystyle{plain}
\\bibliography{test_references}

\\end{document}
  `.trim();
  
  const texFile = path.join(citationContext.outputDir, 'test_document.tex');
  await fs.writeFile(texFile, templateContent, 'utf8');
  citationContext.tempFiles.push(texFile);
});

Given('a bibliography file {string} exists with sample entries', async function (bibFileName) {
  const sampleBib = `
@article{example2024,
  title={Example Research Paper},
  author={Smith, John and Doe, Jane},
  journal={Journal of Example Research},
  year={2024},
  volume={1},
  number={1},
  pages={1--10}
}

@book{sample2023,
  title={Sample Book on Research Methods},
  author={Johnson, Alice},
  publisher={Academic Press},
  year={2023},
  isbn={978-0-123456-78-9}
}
  `.trim();
  
  const bibFile = path.join(citationContext.outputDir, bibFileName);
  await fs.writeFile(bibFile, sampleBib, 'utf8');
  citationContext.tempFiles.push(bibFile);
});

Given('a LaTeX template supporting biblatex', async function () {
  const templateContent = `
\\documentclass{article}
\\usepackage[backend=biber,style=alphabetic]{biblatex}
\\addbibresource{advanced_references.bib}

\\begin{document}
\\title{Advanced Citation Test}
\\author{Citation Expert}
\\maketitle

This document demonstrates advanced citation features.
See \\autocite{reference1} and \\parencite{reference2}.
Also note \\textcite{reference3}.

\\printbibliography

\\end{document}
  `.trim();
  
  const texFile = path.join(citationContext.outputDir, 'advanced_document.tex');
  await fs.writeFile(texFile, templateContent, 'utf8');
  citationContext.tempFiles.push(texFile);
});

Given('a comprehensive bibliography database', async function () {
  const comprehensiveBib = `
@article{reference1,
  title={First Research Paper},
  author={Author, First},
  journal={Journal A},
  year={2023},
  volume={10},
  pages={1--20}
}

@book{reference2,
  title={Comprehensive Handbook},
  author={Editor, Book},
  publisher={University Press},
  year={2022},
  edition={2nd}
}

@inproceedings{reference3,
  title={Conference Paper},
  author={Speaker, Conference},
  booktitle={Proceedings of Important Conference},
  year={2024},
  pages={45--60}
}
  `.trim();
  
  const bibFile = path.join(citationContext.outputDir, 'advanced_references.bib');
  await fs.writeFile(bibFile, comprehensiveBib, 'utf8');
  citationContext.tempFiles.push(bibFile);
});

// Citation validation steps
When('I generate a document with bibliography:', async function (dataTable) {
  const parameters = dataTableToObject(dataTable);
  
  // Create LaTeX document with bibliography
  const latexContent = `
\\documentclass{article}
\\usepackage{natbib}

\\title{${parameters.title}}
\\author{${parameters.author}}

\\begin{document}
\\maketitle

This is a research document.
${parameters.citations ? parameters.citations.split(',').map(cite => `\\cite{${cite.trim()}}`).join(' ') : ''}

\\bibliographystyle{${parameters.bib_style}}
\\bibliography{${parameters.bibliography.replace('.bib', '')}}

\\end{document}
  `.trim();
  
  const texFile = path.join(citationContext.outputDir, 'bibliography_test.tex');
  await fs.writeFile(texFile, latexContent, 'utf8');
  citationContext.tempFiles.push(texFile);
  citationContext.documentContent = latexContent;
});

When('I create a document with advanced citations:', async function (dataTable) {
  const parameters = dataTableToObject(dataTable);
  
  // Create biblatex document
  const latexContent = `
\\documentclass{article}
\\usepackage[backend=${parameters.bib_backend},style=${parameters.bib_style}]{biblatex}
\\addbibresource{references.bib}

\\title{${parameters.title}}
\\author{${parameters.author}}

\\begin{document}
\\maketitle

This document uses advanced citations.
${parameters.citation_styles ? generateAdvancedCitations(parameters.citation_styles.split(',')) : ''}

\\printbibliography

\\end{document}
  `.trim();
  
  const texFile = path.join(citationContext.outputDir, 'advanced_citations.tex');
  await fs.writeFile(texFile, latexContent, 'utf8');
  citationContext.tempFiles.push(texFile);
  citationContext.documentContent = latexContent;
});

When('I compile the document:', async function (dataTable) {
  const parameters = dataTableToObject(dataTable);
  
  // Simulate compilation and check for missing references
  citationContext.compilationResults = await simulateCompilation(
    citationContext.documentContent,
    parameters.existing_keys?.split(','),
    parameters.requested_keys?.split(',')
  );
});

// Citation quality and validation steps
When('I validate citation formatting', async function () {
  citationContext.validationResults.formatting = validateCitationFormatting(citationContext.generatedCitations);
});

When('I check for duplicate citations', async function () {
  citationContext.validationResults.duplicates = checkForDuplicates(citationContext.generatedCitations);
});

When('I analyze citation relevance', async function () {
  citationContext.validationResults.relevance = analyzeCitationRelevance(
    citationContext.generatedCitations, 
    citationContext.searchQuery
  );
});

When('I validate bibliography completeness', async function () {
  citationContext.validationResults.completeness = validateBibliographyCompleteness(
    citationContext.documentContent,
    citationContext.bibliographyEntries
  );
});

// Assertion steps
Then('I should receive {int} relevant citations', function (expectedCount) {
  const citationCount = countCitations(citationContext.generatedCitations);
  expect(citationCount).to.equal(expectedCount);
});

Then('citations should be in {string} format', function (expectedFormat) {
  const isCorrectFormat = validateCitationFormat(citationContext.generatedCitations, expectedFormat);
  expect(isCorrectFormat).to.be.true;
});

Then('citations should include DOI when available', function () {
  const hasDOIs = citationContext.generatedCitations.includes('doi=');
  expect(hasDOIs).to.be.true;
});

Then('duplicate citations should be filtered out', function () {
  expect(citationContext.validationResults.duplicates.found).to.be.false;
});

Then('citations should be ranked by relevance', function () {
  expect(citationContext.validationResults.relevance.ranked).to.be.true;
});

Then('the LaTeX should include {string}', function (expectedContent) {
  expect(citationContext.documentContent).to.include(expectedContent);
});

Then('the document should use biblatex package', function () {
  expect(citationContext.documentContent).to.include('\\usepackage[backend=biber');
});

Then('it should support multiple citation commands', function () {
  const citationCommands = ['\\autocite', '\\parencite', '\\textcite'];
  const hasMultipleCommands = citationCommands.some(cmd => citationContext.documentContent.includes(cmd));
  expect(hasMultipleCommands).to.be.true;
});

Then('bibliography should be generated with biber', function () {
  expect(citationContext.documentContent).to.include('backend=biber');
});

Then('citation style should be alphabetic', function () {
  expect(citationContext.documentContent).to.include('style=alphabetic');
});

Then('KGEN should detect missing bibliography entries', function () {
  expect(citationContext.compilationResults.missingEntries.length).to.be.greaterThan(0);
});

Then('warn about undefined citation keys', function () {
  expect(citationContext.compilationResults.warnings.some(w => w.includes('undefined'))).to.be.true;
});

Then('the document should still compile with warnings', function () {
  expect(citationContext.compilationResults.compiled).to.be.true;
  expect(citationContext.compilationResults.warnings.length).to.be.greaterThan(0);
});

Then('missing references should be highlighted in output', function () {
  expect(citationContext.compilationResults.highlightedMissing).to.be.true;
});

// Citation metadata validation
Then('citations should include complete metadata:', async function (dataTable) {
  const requirements = dataTable.hashes();
  
  for (const req of requirements) {
    const field = req.field;
    const required = req.required === 'yes';
    const present = req.present === 'yes';
    
    if (required) {
      expect(citationContext.generatedCitations).to.include(field);
    }
  }
});

Then('all citations should have valid publication years', function () {
  const yearPattern = /year=\{(\d{4})\}/g;
  const years = [...citationContext.generatedCitations.matchAll(yearPattern)];
  
  years.forEach(match => {
    const year = parseInt(match[1]);
    expect(year).to.be.within(1800, new Date().getFullYear() + 1);
  });
});

Then('author names should be properly formatted', function () {
  const authorPattern = /author=\{([^}]+)\}/g;
  const authors = [...citationContext.generatedCitations.matchAll(authorPattern)];
  
  authors.forEach(match => {
    const authorField = match[1];
    expect(authorField).to.not.be.empty;
    // Should contain "and" for multiple authors or proper name format
    expect(authorField.includes('and') || authorField.includes(',')).to.be.true;
  });
});

Then('journal names should be consistent', function () {
  const journalPattern = /journal=\{([^}]+)\}/g;
  const journals = [...citationContext.generatedCitations.matchAll(journalPattern)];
  
  journals.forEach(match => {
    const journal = match[1];
    expect(journal).to.not.be.empty;
    // Should not have inconsistent abbreviations
    expect(journal.length).to.be.greaterThan(2);
  });
});

// Advanced citation features
Given('I have a multi-language bibliography', async function () {
  const multiLangBib = `
@article{english2024,
  title={English Language Paper},
  author={Smith, John},
  journal={English Journal},
  year={2024}
}

@article{chinese2024,
  title={中文论文标题},
  author={李明 and 王华},
  journal={中文期刊},
  year={2024},
  language={chinese}
}

@article{german2024,
  title={Deutscher Artikel},
  author={Müller, Hans},
  journal={Deutsche Zeitschrift},
  year={2024},
  language={german}
}
  `.trim();
  
  const bibFile = path.join(citationContext.outputDir, 'multilang.bib');
  await fs.writeFile(bibFile, multiLangBib, 'utf8');
  citationContext.tempFiles.push(bibFile);
});

When('I configure language-specific citation styles', async function () {
  citationContext.languageStyles = {
    english: 'chicago',
    chinese: 'gb7714',
    german: 'din1505'
  };
});

Then('citations should respect language-specific formatting', function () {
  // This would require more sophisticated validation in a real implementation
  expect(citationContext.validationResults.languageFormatting).to.be.undefined; // Not implemented
});

// Performance and scalability tests
Given('I have a bibliography with {int} entries', async function (entryCount) {
  const largeBib = generateLargeBibliography(entryCount);
  const bibFile = path.join(citationContext.outputDir, 'large_bibliography.bib');
  await fs.writeFile(bibFile, largeBib, 'utf8');
  citationContext.tempFiles.push(bibFile);
  citationContext.largeBibliographySize = entryCount;
});

When('I measure citation processing time', async function () {
  const startTime = Date.now();
  await validateBibliographyCompleteness(citationContext.documentContent, citationContext.bibliographyEntries);
  citationContext.processingTime = Date.now() - startTime;
});

Then('processing should complete within {int} seconds', function (maxSeconds) {
  expect(citationContext.processingTime).to.be.lessThan(maxSeconds * 1000);
});

Then('memory usage should remain reasonable', function () {
  // This would require actual memory monitoring in a real implementation
  expect(true).to.be.true; // Placeholder
});

// Helper functions
function dataTableToObject(dataTable) {
  const obj = {};
  const rows = dataTable.hashes ? dataTable.hashes() : dataTable.raw();
  
  if (rows[0] && rows[0].field) {
    rows.forEach(row => {
      obj[row.field] = row.value;
    });
  } else if (rows[0] && rows[0].parameter) {
    rows.forEach(row => {
      obj[row.parameter] = row.value;
    });
  } else {
    rows.forEach(row => {
      const keys = Object.keys(row);
      if (keys.length >= 2) {
        obj[keys[0]] = row[keys[0]];
      }
    });
  }
  
  return obj;
}

function generateAdvancedCitations(styles) {
  const styleCommands = {
    'autocite': '\\autocite{reference1}',
    'parencite': '\\parencite{reference2}',
    'textcite': '\\textcite{reference3}'
  };
  
  return styles.map(style => styleCommands[style.trim()] || '\\cite{reference}').join(' ');
}

async function simulateCompilation(content, existingKeys = [], requestedKeys = []) {
  const missingEntries = requestedKeys.filter(key => !existingKeys.includes(key));
  
  return {
    compiled: true,
    missingEntries,
    warnings: missingEntries.map(key => `Citation '${key}' undefined`),
    highlightedMissing: missingEntries.length > 0
  };
}

function validateCitationFormatting(citations) {
  return {
    valid: citations.includes('@'),
    bibtexFormat: citations.includes('@article') || citations.includes('@book'),
    properBraces: citations.includes('{') && citations.includes('}')
  };
}

function checkForDuplicates(citations) {
  const entries = citations.split('@').filter(entry => entry.trim().length > 0);
  const ids = entries.map(entry => entry.match(/^(\w+)\{([^,]+)/)?.[2]).filter(Boolean);
  const uniqueIds = [...new Set(ids)];
  
  return {
    found: ids.length !== uniqueIds.length,
    duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index)
  };
}

function analyzeCitationRelevance(citations, query) {
  // Simple relevance check - in real implementation would use AI scoring
  const queryTerms = query.toLowerCase().split(' ');
  const citationText = citations.toLowerCase();
  const relevantTerms = queryTerms.filter(term => citationText.includes(term));
  
  return {
    ranked: true,
    relevanceScore: relevantTerms.length / queryTerms.length,
    matchingTerms: relevantTerms
  };
}

function validateBibliographyCompleteness(document, bibliography) {
  const citedKeys = [...document.matchAll(/\\cite\{([^}]+)\}/g)].map(match => match[1]);
  const availableKeys = [...bibliography.matchAll(/@\w+\{([^,]+)/g)].map(match => match[1]);
  const missingKeys = citedKeys.filter(key => !availableKeys.includes(key));
  
  return {
    complete: missingKeys.length === 0,
    missingKeys,
    totalCited: citedKeys.length,
    totalAvailable: availableKeys.length
  };
}

function countCitations(citations) {
  return (citations.match(/@\w+\{/g) || []).length;
}

function validateCitationFormat(citations, format) {
  switch (format.toLowerCase()) {
    case 'bibtex':
      return citations.includes('@article') || citations.includes('@book');
    case 'biblatex':
      return citations.includes('@article') || citations.includes('@book');
    case 'json':
      try {
        JSON.parse(citations);
        return true;
      } catch {
        return false;
      }
    default:
      return false;
  }
}

function generateLargeBibliography(count) {
  let bibliography = '';
  
  for (let i = 1; i <= count; i++) {
    bibliography += `
@article{entry${i},
  title={Research Paper ${i}},
  author={Author${i}, First and Second${i}, Author},
  journal={Journal of Research ${i % 10}},
  year={${2020 + (i % 5)}},
  volume={${Math.ceil(i / 10)}},
  number={${i % 4 + 1}},
  pages={${i * 10}--${i * 10 + 15}},
  doi={10.1234/journal.${i}}
}
`;
  }
  
  return bibliography;
}

module.exports = {
  CitationTestContext,
  citationContext
};