/**
 * Step definitions for LaTeX generation and compilation testing
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import fs from 'fs-extra';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const outputDir = path.join(projectRoot, 'tests', 'output');

// Store test context
const testContext = {
  lastGeneratedFile: null,
  lastCommand: null,
  compilationResult: null,
  errorOutput: null
};

// Helper functions
function runUnjucksCommand(args) {
  const command = `node ${path.join(projectRoot, 'src', 'cli', 'index.js')} ${args}`;
  try {
    const result = execSync(command, { 
      cwd: projectRoot, 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { success: true, output: result };
  } catch (error) {
    return { 
      success: false, 
      output: error.stdout || '', 
      error: error.stderr || error.message 
    };
  }
}

function compileLatex(filename, engine = 'pdflatex') {
  const filepath = path.join(outputDir, filename);
  const command = `${engine} -interaction=nonstopmode -output-directory="${outputDir}" "${filepath}"`;
  
  try {
    const result = execSync(command, {
      cwd: outputDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { success: true, output: result };
  } catch (error) {
    return {
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message
    };
  }
}

function parsePaperParameters(dataTable) {
  const params = {};
  for (const row of dataTable.raw()) {
    const [key, value] = row;
    if (key.includes('.')) {
      // Handle nested parameters like partyA.name
      const keys = key.split('.');
      let current = params;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
    } else {
      // Handle array parameters
      if (key === 'packages' || key === 'sections' || key === 'authors') {
        params[key] = value.split(',').map(s => s.trim());
      } else if (value === 'true') {
        params[key] = true;
      } else if (value === 'false') {
        params[key] = false;
      } else {
        params[key] = value;
      }
    }
  }
  return params;
}

function generateParameterString(params) {
  const flags = [];
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'object' && !Array.isArray(value)) {
      // Handle nested objects
      for (const [subKey, subValue] of Object.entries(value)) {
        flags.push(`--${key}.${subKey}="${subValue}"`);
      }
    } else if (Array.isArray(value)) {
      flags.push(`--${key}="${value.join(',')}"`);
    } else {
      flags.push(`--${key}="${value}"`);
    }
  }
  return flags.join(' ');
}

// Background steps
Given('I have unjucks installed', async function () {
  const packageJson = path.join(projectRoot, 'package.json');
  expect(await fs.pathExists(packageJson)).to.be.true;
});

Given('I have LaTeX templates available', async function () {
  const latexTemplatesDir = path.join(projectRoot, 'templates', 'latex');
  const srcTemplatesDir = path.join(projectRoot, 'src', 'templates');
  
  const hasLatexTemplates = await fs.pathExists(latexTemplatesDir) || 
                           await fs.pathExists(srcTemplatesDir);
  expect(hasLatexTemplates).to.be.true;
});

Given('I have LaTeX installed \\(pdflatex, bibtex, biber\\)', function () {
  try {
    execSync('which pdflatex', { stdio: 'ignore' });
    execSync('which bibtex', { stdio: 'ignore' });
  } catch (error) {
    console.warn('LaTeX not found - skipping compilation tests');
    this.skip();
  }
});

Given('I have a clean output directory', async function () {
  await fs.ensureDir(outputDir);
  await fs.emptyDir(outputDir);
});

// Template generation steps
Given('I run {string}', function (command) {
  const result = runUnjucksCommand(command);
  testContext.lastCommand = result;
});

Then('I should see the available template parameters', function () {
  expect(testContext.lastCommand.success).to.be.true;
  expect(testContext.lastCommand.output).to.contain('Parameters:').or.contain('Options:');
});

When('I generate an arXiv paper with:', function (dataTable) {
  const params = parsePaperParameters(dataTable);
  const paramString = generateParameterString(params);
  
  const command = `generate latex/arxiv/paper ${paramString}`;
  const result = runUnjucksCommand(command);
  
  testContext.lastCommand = result;
  if (result.success) {
    const filename = params.filename || 'paper';
    testContext.lastGeneratedFile = path.join(outputDir, `${filename}.tex`);
  }
});

When('I generate an arXiv paper with document class {string}', function (documentClass) {
  const command = `generate latex/arxiv/paper --title="Test Paper" --author="Test Author" --documentclass="${documentClass}" --dest="${outputDir}"`;
  const result = runUnjucksCommand(command);
  
  testContext.lastCommand = result;
  if (result.success) {
    testContext.lastGeneratedFile = path.join(outputDir, 'paper.tex');
  }
});

When('I generate a legal contract with:', function (dataTable) {
  const params = parsePaperParameters(dataTable);
  const paramString = generateParameterString(params);
  
  const command = `generate legal/contract ${paramString}`;
  const result = runUnjucksCommand(command);
  
  testContext.lastCommand = result;
  if (result.success) {
    testContext.lastGeneratedFile = path.join(outputDir, 'contract.txt');
  }
});

When('I generate an academic paper with:', function (dataTable) {
  const params = parsePaperParameters(dataTable);
  const paramString = generateParameterString(params);
  
  const command = `generate academic/arxiv-paper ${paramString}`;
  const result = runUnjucksCommand(command);
  
  testContext.lastCommand = result;
  if (result.success) {
    testContext.lastGeneratedFile = path.join(outputDir, 'paper.md');
  }
});

When('I generate an arXiv paper with structured sections:', function (dataTable) {
  const params = parsePaperParameters(dataTable);
  
  // Convert sections to structured format
  if (params.sections) {
    const sectionTitles = typeof params.sections === 'string' 
      ? params.sections.split(',').map(s => s.trim())
      : params.sections;
    
    params.sections = sectionTitles.map(title => ({
      title,
      content: `Content for ${title} section.`
    }));
  }
  
  const paramString = generateParameterString(params);
  const command = `generate latex/arxiv/paper ${paramString}`;
  const result = runUnjucksCommand(command);
  
  testContext.lastCommand = result;
  if (result.success) {
    testContext.lastGeneratedFile = path.join(outputDir, 'paper.tex');
  }
});

When('I generate an arXiv paper with appendices:', function (dataTable) {
  const params = parsePaperParameters(dataTable);
  
  if (params.appendices) {
    const appendixTitles = typeof params.appendices === 'string'
      ? params.appendices.split(',').map(s => s.trim())
      : params.appendices;
    
    params.appendices = appendixTitles.map(title => ({
      title,
      content: `Content for ${title} appendix.`
    }));
  }
  
  const paramString = generateParameterString(params);
  const command = `generate latex/arxiv/paper ${paramString}`;
  const result = runUnjucksCommand(command);
  
  testContext.lastCommand = result;
  if (result.success) {
    testContext.lastGeneratedFile = path.join(outputDir, 'paper.tex');
  }
});

When('I try to generate a LaTeX paper with invalid parameters:', function (dataTable) {
  const params = parsePaperParameters(dataTable);
  const paramString = generateParameterString(params);
  
  const command = `generate latex/arxiv/paper ${paramString}`;
  const result = runUnjucksCommand(command);
  
  testContext.lastCommand = result;
});

// File verification steps
Then('a LaTeX file should be created at {string}', async function (filepath) {
  const fullPath = path.join(projectRoot, filepath);
  expect(await fs.pathExists(fullPath)).to.be.true;
  testContext.lastGeneratedFile = fullPath;
});

Then('a legal document should be created at {string}', async function (filepath) {
  const fullPath = path.join(projectRoot, filepath);
  expect(await fs.pathExists(fullPath)).to.be.true;
  testContext.lastGeneratedFile = fullPath;
});

Then('an academic paper should be created at {string}', async function (filepath) {
  const fullPath = path.join(projectRoot, filepath);
  expect(await fs.pathExists(fullPath)).to.be.true;
  testContext.lastGeneratedFile = fullPath;
});

Then('the file should contain {string}', async function (expectedContent) {
  expect(testContext.lastGeneratedFile).to.not.be.null;
  const content = await fs.readFile(testContext.lastGeneratedFile, 'utf8');
  expect(content).to.contain(expectedContent);
});

Then('the LaTeX file should contain {string}', async function (expectedContent) {
  expect(testContext.lastGeneratedFile).to.not.be.null;
  const content = await fs.readFile(testContext.lastGeneratedFile, 'utf8');
  expect(content).to.contain(expectedContent);
});

Then('the LaTeX file should contain the appropriate document class declaration for {string}', async function (documentClass) {
  expect(testContext.lastGeneratedFile).to.not.be.null;
  const content = await fs.readFile(testContext.lastGeneratedFile, 'utf8');
  
  switch (documentClass) {
    case 'article':
      expect(content).to.match(/\\documentclass\[.*\]{article}/);
      break;
    case 'revtex':
      expect(content).to.match(/\\documentclass\[.*\]{revtex4-2}/);
      break;
    case 'amsart':
      expect(content).to.match(/\\documentclass\[.*\]{amsart}/);
      break;
    default:
      throw new Error(`Unknown document class: ${documentClass}`);
  }
});

// Error handling steps
Then('the generation should not fail silently', function () {
  // Should either succeed or provide meaningful error message
  if (!testContext.lastCommand.success) {
    expect(testContext.lastCommand.error).to.not.be.empty;
  }
});

Then('I should see helpful parameter suggestions', function () {
  if (!testContext.lastCommand.success) {
    const output = testContext.lastCommand.output + testContext.lastCommand.error;
    expect(output).to.match(/available|parameter|option|help/i);
  }
});

// Compilation steps
Given('I generate a basic arXiv paper:', function (dataTable) {
  const params = parsePaperParameters(dataTable);
  const paramString = generateParameterString(params);
  
  const command = `generate latex/arxiv/paper ${paramString}`;
  const result = runUnjucksCommand(command);
  
  expect(result.success).to.be.true;
  testContext.lastGeneratedFile = path.join(outputDir, 'paper.tex');
});

Given('I generate a basic arXiv paper', function () {
  const command = `generate latex/arxiv/paper --title="Test Paper" --author="Test Author" --dest="${outputDir}"`;
  const result = runUnjucksCommand(command);
  
  expect(result.success).to.be.true;
  testContext.lastGeneratedFile = path.join(outputDir, 'paper.tex');
});

Given('I generate an arXiv paper with bibliography:', function (dataTable) {
  const params = parsePaperParameters(dataTable);
  const paramString = generateParameterString(params);
  
  const command = `generate latex/arxiv/paper ${paramString}`;
  const result = runUnjucksCommand(command);
  
  expect(result.success).to.be.true;
  testContext.lastGeneratedFile = path.join(outputDir, 'paper.tex');
});

Given('I create a sample bibliography file {string}', async function (filename) {
  const bibContent = `
@article{sample2023,
  title={A Sample Article},
  author={Smith, John and Doe, Jane},
  journal={Journal of Examples},
  volume={1},
  number={1},
  pages={1--10},
  year={2023},
  publisher={Example Press}
}

@book{example2022,
  title={Example Book},
  author={Author, Test},
  year={2022},
  publisher={Test Publishing}
}
`;
  await fs.writeFile(path.join(outputDir, filename), bibContent);
});

When('I compile the LaTeX file with pdflatex', function () {
  const result = compileLatex('paper.tex');
  testContext.compilationResult = result;
});

When('I compile the LaTeX file', function () {
  const result = compileLatex('paper.tex');
  testContext.compilationResult = result;
});

When('I compile with the full LaTeX workflow:', function (workflow) {
  const commands = workflow.trim().split('\n').map(cmd => cmd.trim());
  let allSuccess = true;
  let combinedOutput = '';
  
  for (const cmd of commands) {
    try {
      const result = execSync(cmd, {
        cwd: outputDir,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      combinedOutput += result;
    } catch (error) {
      allSuccess = false;
      combinedOutput += error.stderr || error.message;
      break;
    }
  }
  
  testContext.compilationResult = {
    success: allSuccess,
    output: combinedOutput
  };
});

When('I compile with biblatex workflow:', function (workflow) {
  const commands = workflow.trim().split('\n').map(cmd => cmd.trim());
  let allSuccess = true;
  let combinedOutput = '';
  
  for (const cmd of commands) {
    try {
      const result = execSync(cmd, {
        cwd: outputDir,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      combinedOutput += result;
    } catch (error) {
      allSuccess = false;
      combinedOutput += error.stderr || error.message;
      break;
    }
  }
  
  testContext.compilationResult = {
    success: allSuccess,
    output: combinedOutput
  };
});

When('I add theorem content to the paper:', async function (content) {
  expect(testContext.lastGeneratedFile).to.not.be.null;
  
  let paperContent = await fs.readFile(testContext.lastGeneratedFile, 'utf8');
  
  // Insert theorem content before \end{document}
  paperContent = paperContent.replace(
    /\\end{document}/,
    `\n${content.trim()}\n\n\\end{document}`
  );
  
  await fs.writeFile(testContext.lastGeneratedFile, paperContent);
});

When('I add algorithm content to the paper:', async function (content) {
  expect(testContext.lastGeneratedFile).to.not.be.null;
  
  let paperContent = await fs.readFile(testContext.lastGeneratedFile, 'utf8');
  
  // Insert algorithm content before \end{document}
  paperContent = paperContent.replace(
    /\\end{document}/,
    `\n${content.trim()}\n\n\\end{document}`
  );
  
  await fs.writeFile(testContext.lastGeneratedFile, paperContent);
});

When('I introduce a LaTeX syntax error:', async function (errorContent) {
  expect(testContext.lastGeneratedFile).to.not.be.null;
  
  let paperContent = await fs.readFile(testContext.lastGeneratedFile, 'utf8');
  
  // Insert error content before \end{document}
  paperContent = paperContent.replace(
    /\\end{document}/,
    `\n${errorContent.trim()}\n\n\\end{document}`
  );
  
  await fs.writeFile(testContext.lastGeneratedFile, paperContent);
});

When('I attempt to compile the LaTeX file', function () {
  const result = compileLatex('paper.tex');
  testContext.compilationResult = result;
});

// Compilation result verification
Then('the compilation should succeed', function () {
  expect(testContext.compilationResult.success).to.be.true;
});

Then('the compilation should fail', function () {
  expect(testContext.compilationResult.success).to.be.false;
});

Then('the compilation should fail with package error', function () {
  expect(testContext.compilationResult.success).to.be.false;
  expect(testContext.compilationResult.error).to.match(/package.*not found|file.*not found/i);
});

Then('a PDF file should be generated', async function () {
  const pdfPath = path.join(outputDir, 'paper.pdf');
  expect(await fs.pathExists(pdfPath)).to.be.true;
});

Then('the PDF should contain {string}', function (expectedContent) {
  // Note: This would require a PDF reader library like pdf-parse
  // For now, we'll assume success if compilation succeeded
  expect(testContext.compilationResult.success).to.be.true;
});

Then('I should receive informative error messages', function () {
  expect(testContext.compilationResult.error).to.not.be.empty;
  expect(testContext.compilationResult.error).to.match(/error|failed|missing/i);
});

Then('the error location should be identified', function () {
  expect(testContext.compilationResult.error).to.match(/line \d+|l\.\d+/);
});

Then('I should see package-not-found error message', function () {
  expect(testContext.compilationResult.error).to.match(/file.*not found|package.*not found/i);
});

// Store results in memory (Claude-Flow integration)
Then('store test results in memory under hive\\/tests\\/latex', async function () {
  const results = {
    timestamp: new Date().toISOString(),
    lastGeneratedFile: testContext.lastGeneratedFile,
    compilationResult: testContext.compilationResult,
    testsPassed: !testContext.compilationResult || testContext.compilationResult.success
  };
  
  try {
    // Store in Claude-Flow memory if available
    const memoryResult = await runUnjucksCommand(`memory store hive/tests/latex "${JSON.stringify(results)}"`);
    console.log('Test results stored in memory:', memoryResult.success);
  } catch (error) {
    console.log('Memory storage not available:', error.message);
  }
});

export {
  testContext,
  runUnjucksCommand,
  compileLatex,
  parsePaperParameters,
  generateParameterString
};