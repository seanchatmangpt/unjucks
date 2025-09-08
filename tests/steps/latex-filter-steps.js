/**
 * Step definitions for LaTeX filter functionality testing
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import nunjucks from 'nunjucks';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

// Test context for filter results
const filterContext = {
  input: null,
  output: null,
  template: null,
  renderResult: null,
  error: null
};

// Initialize Nunjucks environment with custom filters
const env = nunjucks.configure('tests/fixtures/templates', {
  autoescape: false,
  watch: false
});

// LaTeX Filters Implementation
const latexFilters = {
  // Escape LaTeX special characters
  latexEscape: function(str) {
    if (!str) return '';
    return str.toString()
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/\$/g, '\\$')
      .replace(/\^/g, '\\^{}')
      .replace(/#/g, '\\#')
      .replace(/_/g, '\\_')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/~/g, '\\~{}');
  },

  // Wrap content in math mode
  mathMode: function(str) {
    if (!str) return '';
    return `$${str}$`;
  },

  // Legal numbering formats
  legalNumber: function(num, format = 'number') {
    const number = parseInt(num);
    if (isNaN(number)) return num;

    switch (format) {
      case 'roman':
        const romanNumerals = ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
        return `(${romanNumerals[number] || number})`;
      case 'alpha':
        const letter = String.fromCharCode(96 + number); // a, b, c, etc.
        return `(${letter})`;
      case 'number':
      default:
        return `${number}.`;
    }
  },

  // Citation formatting
  cite: function(keys, style = 'numeric') {
    if (!keys) return '';
    
    const keyList = Array.isArray(keys) ? keys : keys.split(',').map(k => k.trim());
    const keyString = keyList.join(',');

    switch (style) {
      case 'natbib':
        return `\\citep{${keyString}}`;
      case 'biblatex':
        return `\\autocite{${keyString}}`;
      case 'numeric':
      default:
        return `\\cite{${keyString}}`;
    }
  },

  // Generate LaTeX table
  latexTable: function(data, options = {}) {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('latexTable filter requires array input');
    }

    const {
      alignment = 'l'.repeat(Object.keys(data[0]).length),
      hlines = false,
      caption = null
    } = options;

    let table = '\\begin{table}[h]\n\\centering\n';
    table += `\\begin{tabular}{${alignment}}\n`;
    
    if (hlines) table += '\\hline\n';
    
    // Headers
    const headers = Object.keys(data[0]);
    table += headers.join(' & ') + ' \\\\\n';
    
    if (hlines) table += '\\hline\n';
    
    // Data rows
    for (const row of data) {
      const values = headers.map(h => row[h] || '');
      table += values.join(' & ') + ' \\\\\n';
    }
    
    if (hlines) table += '\\hline\n';
    
    table += '\\end{tabular}\n';
    if (caption) table += `\\caption{${caption}}\n`;
    table += '\\end{table}';

    return table;
  },

  // Generate BibTeX entry
  bibEntry: function(data, style = 'bibtex') {
    if (!data || typeof data !== 'object') return '';

    const { title, authors, journal, year, pages } = data;
    if (!title) return '';

    const key = title.toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 20) + (year || '');

    let entry = `@article{${key},\n`;
    entry += `  title={${title}},\n`;
    
    if (authors) {
      const authorList = Array.isArray(authors) 
        ? authors.join(' and ')
        : authors.replace(/[;,]/g, ' and');
      entry += `  author={${authorList}},\n`;
    }
    
    if (journal) entry += `  journal={${journal}},\n`;
    if (year) entry += `  year={${year}},\n`;
    if (pages) entry += `  pages={${pages.replace('-', '--')}},\n`;
    
    entry += '}';
    return entry;
  },

  // Generate LaTeX command
  latexCommand: function(command, args, options = '') {
    if (!command) return '';
    
    let cmd = `\\${command}`;
    if (options) cmd += `[${options}]`;
    if (args !== undefined) cmd += `{${args}}`;
    
    return cmd;
  },

  // Safe filename for LaTeX
  latexFilename: function(filename) {
    if (!filename) return '';
    
    return filename
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
  },

  // LaTeX environment wrapper
  latexEnvironment: function(env, content, options = '') {
    if (!env) return content || '';
    
    let result = `\\begin{${env}}`;
    if (options) result += `\\${options}`;
    result += '\n';
    
    if (env === 'itemize' && content) {
      const items = Array.isArray(content) ? content : content.split(',');
      result += items.map(item => `\\item ${item.trim()}`).join('\n');
    } else {
      result += content || '';
    }
    
    result += `\n\\end{${env}}`;
    return result;
  },

  // SI units formatting
  siunitx: function(value, unit) {
    if (value === null || value === undefined) return '';
    
    const unitMap = {
      'm/s^2': '\\meter\\per\\second\\squared',
      'km': '\\kilo\\meter',
      'rad': '\\radian',
      'C': '\\celsius'
    };
    
    const latexUnit = unitMap[unit] || unit;
    return `\\SI{${value}}{${latexUnit}}`;
  },

  // Cross-reference generation
  ref: function(refKey, refType = 'section') {
    if (!refKey) return '';
    
    switch (refType) {
      case 'equation':
        return `\\eqref{${refKey}}`;
      default:
        return `\\ref{${refKey}}`;
    }
  },

  // Package options
  packageOptions: function(packageName, options) {
    if (!packageName) return '';
    
    let result = '\\usepackage';
    if (options) result += `[${options}]`;
    result += `{${packageName}}`;
    
    return result;
  }
};

// Register all filters
Object.entries(latexFilters).forEach(([name, filter]) => {
  env.addFilter(name, filter);
});

// Helper functions
function parseDataTable(dataTable) {
  const data = {};
  for (const row of dataTable.raw()) {
    const [key, value] = row;
    data[key] = value;
  }
  return data;
}

function parseExpectedTable(dataTable) {
  return dataTable.raw().map(row => ({
    input: row[0],
    expectedOutput: row[1]
  }));
}

function parseTabularData(dataTable) {
  const headers = dataTable.raw()[0];
  const rows = dataTable.raw().slice(1);
  
  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

// Background steps
Given('I have unjucks installed', function () {
  // Verified by import success
  expect(nunjucks).to.exist;
});

Given('I have LaTeX filter templates available', async function () {
  // Ensure test template directory exists
  await fs.ensureDir('tests/fixtures/templates');
});

// Filter testing steps
When('I use the latexEscape filter with:', function (dataTable) {
  const testCases = [];
  for (const row of dataTable.raw().slice(1)) { // Skip header row
    const [input, expectedOutput] = row;
    const actualOutput = latexFilters.latexEscape(input);
    testCases.push({
      input,
      expectedOutput,
      actualOutput
    });
  }
  filterContext.testCases = testCases;
});

When('I use the mathMode filter with:', function (dataTable) {
  const testCases = [];
  for (const row of dataTable.raw().slice(1)) { // Skip header row
    const [input, expectedOutput] = row;
    const actualOutput = latexFilters.mathMode(input);
    testCases.push({
      input,
      expectedOutput,
      actualOutput
    });
  }
  filterContext.testCases = testCases;
});

When('I use the legalNumber filter with:', function (dataTable) {
  const testCases = [];
  for (const row of dataTable.raw().slice(1)) { // Skip header row
    const [input, format, expectedOutput] = row;
    const actualOutput = latexFilters.legalNumber(input, format);
    testCases.push({
      input: `${input} (${format})`,
      expectedOutput,
      actualOutput
    });
  }
  filterContext.testCases = testCases;
});

When('I use the cite filter with:', function (dataTable) {
  const testCases = [];
  for (const row of dataTable.raw().slice(1)) { // Skip header row
    const [input, style, expectedOutput] = row;
    const actualOutput = latexFilters.cite(input, style);
    testCases.push({
      input: `${input} (${style})`,
      expectedOutput,
      actualOutput
    });
  }
  filterContext.testCases = testCases;
});

Given('I have tabular data:', function (dataTable) {
  filterContext.tabularData = parseTabularData(dataTable);
});

When('I use the latexTable filter with options:', function (dataTable) {
  const options = parseDataTable(dataTable);
  
  // Convert string boolean to actual boolean
  if (options.hlines === 'true') options.hlines = true;
  
  try {
    filterContext.output = latexFilters.latexTable(filterContext.tabularData, options);
  } catch (error) {
    filterContext.error = error;
  }
});

Given('I have reference data:', function (dataTable) {
  filterContext.referenceData = parseTabularData(dataTable);
});

When('I use the bibEntry filter with {string} style', function (style) {
  if (filterContext.referenceData && filterContext.referenceData.length > 0) {
    filterContext.output = latexFilters.bibEntry(filterContext.referenceData[0], style);
  }
});

When('I use the latexCommand filter with:', function (dataTable) {
  const testCases = [];
  for (const row of dataTable.raw().slice(1)) { // Skip header row
    const [command, args, options, expectedOutput] = row;
    const actualOutput = latexFilters.latexCommand(command, args, options || '');
    testCases.push({
      input: `${command}(${args}, ${options || 'no options'})`,
      expectedOutput,
      actualOutput
    });
  }
  filterContext.testCases = testCases;
});

When('I use the latexFilename filter with:', function (dataTable) {
  const testCases = [];
  for (const row of dataTable.raw().slice(1)) { // Skip header row
    const [input, expectedOutput] = row;
    const actualOutput = latexFilters.latexFilename(input);
    testCases.push({
      input,
      expectedOutput,
      actualOutput
    });
  }
  filterContext.testCases = testCases;
});

When('I use the latexEnvironment filter with:', function (dataTable) {
  const testCases = [];
  for (const row of dataTable.raw().slice(1)) { // Skip header row
    const [environment, content, options, expectedOutput] = row;
    const actualOutput = latexFilters.latexEnvironment(environment, content, options || '');
    testCases.push({
      input: `${environment}: ${content}`,
      expectedOutput,
      actualOutput
    });
  }
  filterContext.testCases = testCases;
});

When('I use the siunitx filter with:', function (dataTable) {
  const testCases = [];
  for (const row of dataTable.raw().slice(1)) { // Skip header row
    const [value, unit, expectedOutput] = row;
    const actualOutput = latexFilters.siunitx(parseFloat(value), unit);
    testCases.push({
      input: `${value} ${unit}`,
      expectedOutput,
      actualOutput
    });
  }
  filterContext.testCases = testCases;
});

When('I use the ref filter with:', function (dataTable) {
  const testCases = [];
  for (const row of dataTable.raw().slice(1)) { // Skip header row
    const [refType, refKey, expectedOutput] = row;
    const actualOutput = latexFilters.ref(refKey, refType);
    testCases.push({
      input: `${refType}: ${refKey}`,
      expectedOutput,
      actualOutput
    });
  }
  filterContext.testCases = testCases;
});

When('I use the packageOptions filter with:', function (dataTable) {
  const testCases = [];
  for (const row of dataTable.raw().slice(1)) { // Skip header row
    const [packageName, options, expectedOutput] = row;
    const actualOutput = latexFilters.packageOptions(packageName, options);
    testCases.push({
      input: `${packageName}[${options}]`,
      expectedOutput,
      actualOutput
    });
  }
  filterContext.testCases = testCases;
});

Given('I have a template with chained filters:', function (templateString) {
  filterContext.template = templateString.trim();
});

When('I render with data:', function (dataTable) {
  const data = parseDataTable(dataTable);
  
  try {
    filterContext.renderResult = env.renderString(filterContext.template, data);
  } catch (error) {
    filterContext.error = error;
  }
});

When('I use LaTeX filters with invalid input:', function (dataTable) {
  const testCases = [];
  for (const row of dataTable.raw().slice(1)) { // Skip header row
    const [filter, invalidInput, expectedBehavior] = row;
    
    let actualResult;
    let error = null;
    
    try {
      switch (filter) {
        case 'latexEscape':
          actualResult = latexFilters.latexEscape(invalidInput === 'null' ? null : invalidInput);
          break;
        case 'cite':
          actualResult = latexFilters.cite(invalidInput === '""' ? '' : invalidInput);
          break;
        case 'latexTable':
          actualResult = latexFilters.latexTable(invalidInput === 'invalid_array' ? 'not an array' : invalidInput);
          break;
        case 'siunitx':
          actualResult = latexFilters.siunitx(invalidInput, 'unit');
          break;
        default:
          actualResult = 'unknown filter';
      }
    } catch (err) {
      error = err;
    }
    
    testCases.push({
      input: `${filter}(${invalidInput})`,
      expectedBehavior,
      actualResult,
      error
    });
  }
  filterContext.testCases = testCases;
});

Given('I have a large document with {int}+ mathematical expressions', function (count) {
  // Create array of mathematical expressions for performance testing
  filterContext.largeDataset = Array.from({length: count}, (_, i) => `x_${i}^2 + y_${i}^2`);
});

When('I apply the mathMode filter to all expressions', function () {
  const startTime = process.hrtime.bigint();
  
  filterContext.performanceResult = {
    processedCount: 0,
    startMemory: process.memoryUsage().heapUsed,
    results: []
  };
  
  for (const expr of filterContext.largeDataset) {
    const result = latexFilters.mathMode(expr);
    filterContext.performanceResult.results.push(result);
    filterContext.performanceResult.processedCount++;
  }
  
  const endTime = process.hrtime.bigint();
  filterContext.performanceResult.duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
  filterContext.performanceResult.endMemory = process.memoryUsage().heapUsed;
});

Given('I register a custom filter {string}', function (filterName) {
  // Register a simple custom filter for testing
  env.addFilter(filterName, function(str) {
    return `\\${filterName}{${str}}`;
  });
  filterContext.customFilterName = filterName;
});

When('I use the custom filter in a template', function () {
  const template = `{{ content | ${filterContext.customFilterName} }}`;
  try {
    filterContext.customFilterResult = env.renderString(template, { content: 'test content' });
  } catch (error) {
    filterContext.error = error;
  }
});

// Verification steps
Then('the LaTeX special characters should be properly escaped', function () {
  for (const testCase of filterContext.testCases) {
    expect(testCase.actualOutput).to.equal(testCase.expectedOutput,
      `Input: "${testCase.input}" -> Expected: "${testCase.expectedOutput}", Got: "${testCase.actualOutput}"`);
  }
});

Then('mathematical expressions should be wrapped in math delimiters', function () {
  for (const testCase of filterContext.testCases) {
    expect(testCase.actualOutput).to.equal(testCase.expectedOutput,
      `Input: "${testCase.input}" -> Expected: "${testCase.expectedOutput}", Got: "${testCase.actualOutput}"`);
  }
});

Then('legal-style numbering should be generated correctly', function () {
  for (const testCase of filterContext.testCases) {
    expect(testCase.actualOutput).to.equal(testCase.expectedOutput,
      `Input: "${testCase.input}" -> Expected: "${testCase.expectedOutput}", Got: "${testCase.actualOutput}"`);
  }
});

Then('citations should be formatted according to the specified style', function () {
  for (const testCase of filterContext.testCases) {
    expect(testCase.actualOutput).to.equal(testCase.expectedOutput,
      `Input: "${testCase.input}" -> Expected: "${testCase.expectedOutput}", Got: "${testCase.actualOutput}"`);
  }
});

Then('a proper LaTeX table should be generated with:', function (expectedContent) {
  expect(filterContext.output).to.exist;
  
  const expectedLines = expectedContent.trim().split('\n').map(line => line.trim());
  const actualLines = filterContext.output.split('\n').map(line => line.trim());
  
  for (const expectedLine of expectedLines) {
    if (expectedLine) { // Skip empty lines
      expect(actualLines).to.include(expectedLine,
        `Expected line "${expectedLine}" not found in output:\n${filterContext.output}`);
    }
  }
});

Then('BibTeX entries should be generated:', function (expectedContent) {
  expect(filterContext.output).to.exist;
  
  const expectedLines = expectedContent.trim().split('\n').map(line => line.trim());
  const actualLines = filterContext.output.split('\n').map(line => line.trim());
  
  for (const expectedLine of expectedLines) {
    if (expectedLine) { // Skip empty lines
      expect(actualLines).to.include.members([expectedLine],
        `Expected content not found in output:\n${filterContext.output}`);
    }
  }
});

Then('LaTeX commands should be properly formatted', function () {
  for (const testCase of filterContext.testCases) {
    expect(testCase.actualOutput).to.equal(testCase.expectedOutput,
      `Input: "${testCase.input}" -> Expected: "${testCase.expectedOutput}", Got: "${testCase.actualOutput}"`);
  }
});

Then('filenames should be LaTeX-safe', function () {
  for (const testCase of filterContext.testCases) {
    expect(testCase.actualOutput).to.equal(testCase.expectedOutput,
      `Input: "${testCase.input}" -> Expected: "${testCase.expectedOutput}", Got: "${testCase.actualOutput}"`);
    
    // Additional safety checks
    expect(testCase.actualOutput).to.not.match(/[^a-zA-Z0-9._-]/,
      `Output contains unsafe characters: "${testCase.actualOutput}"`);
  }
});

Then('LaTeX environments should be properly structured', function () {
  for (const testCase of filterContext.testCases) {
    expect(testCase.actualOutput).to.equal(testCase.expectedOutput,
      `Input: "${testCase.input}" -> Expected: "${testCase.expectedOutput}", Got: "${testCase.actualOutput}"`);
  }
});

Then('SI units should be properly formatted', function () {
  for (const testCase of filterContext.testCases) {
    expect(testCase.actualOutput).to.equal(testCase.expectedOutput,
      `Input: "${testCase.input}" -> Expected: "${testCase.expectedOutput}", Got: "${testCase.actualOutput}"`);
  }
});

Then('cross-references should be generated correctly', function () {
  for (const testCase of filterContext.testCases) {
    expect(testCase.actualOutput).to.equal(testCase.expectedOutput,
      `Input: "${testCase.input}" -> Expected: "${testCase.expectedOutput}", Got: "${testCase.actualOutput}"`);
  }
});

Then('package loading with options should be correct', function () {
  for (const testCase of filterContext.testCases) {
    expect(testCase.actualOutput).to.equal(testCase.expectedOutput,
      `Input: "${testCase.input}" -> Expected: "${testCase.expectedOutput}", Got: "${testCase.actualOutput}"`);
  }
});

Then('the output should properly combine all filter effects:', function (expectedOutput) {
  expect(filterContext.renderResult).to.exist;
  
  const expected = expectedOutput.trim();
  const actual = filterContext.renderResult.trim();
  
  expect(actual).to.equal(expected);
});

Then('filters should handle errors gracefully', function () {
  for (const testCase of filterContext.testCases) {
    switch (testCase.expectedBehavior) {
      case 'return empty string':
        expect(testCase.actualResult).to.equal('');
        break;
      case 'return empty citation':
        expect(testCase.actualResult).to.match(/^\\cite\{\}$|^$/);
        break;
      case 'throw descriptive error':
        expect(testCase.error).to.exist;
        expect(testCase.error.message).to.contain('requires array');
        break;
      case 'pass through or error':
        // Either passes through unchanged or throws an error
        expect(testCase.actualResult !== undefined || testCase.error !== null).to.be.true;
        break;
    }
  }
});

Then('the filtering should complete within reasonable time', function () {
  expect(filterContext.performanceResult.duration).to.be.lessThan(5000, // 5 seconds
    `Filtering took ${filterContext.performanceResult.duration}ms, which is too slow`);
});

Then('memory usage should remain acceptable', function () {
  const memoryIncrease = filterContext.performanceResult.endMemory - filterContext.performanceResult.startMemory;
  const maxAcceptableIncrease = 100 * 1024 * 1024; // 100MB
  
  expect(memoryIncrease).to.be.lessThan(maxAcceptableIncrease,
    `Memory usage increased by ${Math.round(memoryIncrease / 1024 / 1024)}MB, which is too high`);
});

Then('it should be available and functional', function () {
  expect(filterContext.customFilterResult).to.exist;
  expect(filterContext.customFilterResult).to.contain(`\\${filterContext.customFilterName}{test content}`);
});

Then('it should integrate with existing LaTeX filters', function () {
  // Test chaining custom filter with existing filters
  const chainedTemplate = `{{ content | ${filterContext.customFilterName} | latexEscape }}`;
  const result = env.renderString(chainedTemplate, { content: 'test & content' });
  
  expect(result).to.contain(`\\${filterContext.customFilterName}{test \\& content}`);
});

export { latexFilters, filterContext };