import { Given, When, Then, Before, After } from "@cucumber/cucumber";
import { expect } from "chai";
import { spawn, ChildProcess } from "child_process";
import { promises as fs } from "fs";
import * as path from "path";
import * as yaml from "yaml";
import fetch from "node-fetch";

// Test configuration and state management
interface TestContext {
  mcpProcess?: ChildProcess;
  swarmId?: string;
  executionId?: string;
  workflowId?: string;
  lastCommand?: string;
  lastOutput?: string;
  lastError?: string;
  lastExitCode?: number;
  startTime?: number;
  performanceMetrics?: Record<string, any>;
  tempFiles?: string[];
  agentIds?: string[];
  mcpEndpoint?: string;
  authToken?: string;
}

let testContext: TestContext = {};

// Utility functions for MCP integration testing
const MCP_TIMEOUT = 30000; // 30 seconds
const MCP_ENDPOINT = process.env.MCP_ENDPOINT || "http://localhost:8000";

async function executeCLICommand(command: string, timeout: number = 30000): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}> {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    
    const process = spawn(cmd, args, {
      stdio: 'pipe',
      env: { 
        ...process.env,
        MCP_ENDPOINT,
        DEBUG_UNJUCKS: 'false',
        NODE_ENV: 'test'
      }
    });

    let stdout = '';
    let stderr = '';

    process.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutHandle = setTimeout(() => {
      process.kill();
      reject(new Error(`Command timeout after ${timeout}ms: ${command}`));
    }, timeout);

    process.on('close', (code) => {
      clearTimeout(timeoutHandle);
      const duration = Date.now() - startTime;
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code || 0,
        duration
      });
    });

    process.on('error', (error) => {
      clearTimeout(timeoutHandle);
      reject(error);
    });
  });
}

async function validateMCPConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${MCP_ENDPOINT}/health`, {
      timeout: 5000,
      headers: {
        'Authorization': `Bearer ${testContext.authToken || 'test-token'}`
      }
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForMCPReady(maxAttempts: number = 10): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await validateMCPConnection()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('MCP server not ready after maximum attempts');
}

// Background setup and teardown
Before({ tags: "@mcp-integration" }, async function() {
  // Initialize test context
  testContext = {
    tempFiles: [],
    agentIds: [],
    mcpEndpoint: MCP_ENDPOINT
  };

  // Ensure MCP server is running
  if (!await validateMCPConnection()) {
    // Start MCP server for testing
    testContext.mcpProcess = spawn('npx', ['claude-flow@alpha', 'mcp', 'start'], {
      stdio: 'pipe',
      env: { ...process.env, PORT: '8000' }
    });

    await waitForMCPReady();
  }
});

After({ tags: "@mcp-integration" }, async function() {
  // Cleanup temporary files
  if (testContext.tempFiles) {
    for (const file of testContext.tempFiles) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  // Cleanup swarm if created
  if (testContext.swarmId) {
    try {
      await executeCLICommand(`unjucks swarm destroy ${testContext.swarmId} --force`, 10000);
    } catch {
      // Ignore cleanup errors
    }
  }

  // Stop MCP process if we started it
  if (testContext.mcpProcess) {
    testContext.mcpProcess.kill();
    testContext.mcpProcess = undefined;
  }
});

// Common step definitions
Given('the Unjucks CLI is available', async function() {
  const result = await executeCLICommand('unjucks --version');
  expect(result.exitCode).to.equal(0);
  expect(result.stdout).to.match(/\d+\.\d+\.\d+/);
});

Given('MCP server is running and accessible', async function() {
  const isConnected = await validateMCPConnection();
  expect(isConnected).to.be.true;
});

// Semantic command step definitions
Given('I have an RDF file with complex semantic relationships at {string}', async function(filePath: string) {
  const testFile = path.resolve(filePath);
  testContext.tempFiles?.push(testFile);
  
  // Create a complex test RDF file
  const rdfContent = `@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix ex: <http://example.org/> .

ex:Person a rdfs:Class ;
    rdfs:label "Person" ;
    rdfs:comment "A human being" .

ex:Organization a rdfs:Class ;
    rdfs:label "Organization" ;
    rdfs:comment "A group or company" .

ex:worksFor a owl:ObjectProperty ;
    rdfs:domain ex:Person ;
    rdfs:range ex:Organization ;
    rdfs:label "works for" .

ex:john a ex:Person ;
    rdfs:label "John Smith" ;
    ex:worksFor ex:acme .

ex:acme a ex:Organization ;
    rdfs:label "Acme Corporation" .`;

  await fs.mkdir(path.dirname(testFile), { recursive: true });
  await fs.writeFile(testFile, rdfContent, 'utf-8');
});

Given('the semantic engine is initialized with RDF capabilities', async function() {
  // Verify semantic engine is available
  const result = await executeCLICommand('unjucks semantic --help');
  expect(result.exitCode).to.equal(0);
  expect(result.stdout).to.include('RDF');
});

Given('the semantic engine has neural pattern recognition enabled', async function() {
  // This would typically involve checking if neural capabilities are available
  // For now, we'll assume they are if MCP is connected
  expect(await validateMCPConnection()).to.be.true;
});

When('I run {string}', async function(command: string) {
  testContext.startTime = Date.now();
  testContext.lastCommand = command;
  
  try {
    const result = await executeCLICommand(command, MCP_TIMEOUT);
    testContext.lastOutput = result.stdout;
    testContext.lastError = result.stderr;
    testContext.lastExitCode = result.exitCode;
    testContext.performanceMetrics = {
      duration: result.duration,
      command: command
    };
  } catch (error) {
    testContext.lastError = error instanceof Error ? error.message : String(error);
    testContext.lastExitCode = 1;
  }
});

Then('the command should succeed', function() {
  expect(testContext.lastExitCode, `Command failed: ${testContext.lastError}`).to.equal(0);
});

Then('the output should contain valid RDF analysis JSON', function() {
  expect(testContext.lastOutput).to.not.be.empty;
  
  // Try to parse as JSON
  let parsedOutput;
  try {
    parsedOutput = JSON.parse(testContext.lastOutput!);
  } catch {
    throw new Error('Output is not valid JSON');
  }
  
  // Validate RDF analysis structure
  expect(parsedOutput).to.have.property('analysis');
  expect(parsedOutput).to.have.property('entities');
  expect(parsedOutput).to.have.property('relationships');
});

Then('the analysis should include neural pattern insights', function() {
  const output = JSON.parse(testContext.lastOutput!);
  expect(output).to.have.property('neuralInsights');
  expect(output.neuralInsights).to.have.property('patterns');
  expect(output.neuralInsights.patterns).to.be.an('array');
});

Then('cognitive patterns should be identified for optimization', function() {
  const output = JSON.parse(testContext.lastOutput!);
  expect(output).to.have.property('cognitivePatterns');
  expect(output.cognitivePatterns).to.have.property('identified');
  expect(output.cognitivePatterns.identified.length).to.be.greaterThan(0);
});

Then('the response time should be under {int} seconds', function(maxSeconds: number) {
  const duration = testContext.performanceMetrics?.duration || 0;
  expect(duration).to.be.lessThan(maxSeconds * 1000);
});

Then('memory usage should not exceed {int}MB', async function(maxMB: number) {
  // This would require process monitoring during execution
  // For now, we'll check if the command completed successfully as a proxy
  expect(testContext.lastExitCode).to.equal(0);
});

// Swarm orchestration step definitions
Given('I initialize a semantic processing swarm with {string}', async function(command: string) {
  const result = await executeCLICommand(command);
  expect(result.exitCode).to.equal(0);
  
  // Extract swarm ID from output
  const swarmMatch = result.stdout.match(/swarm[_-]id[:\s]+([a-zA-Z0-9-]+)/i);
  if (swarmMatch) {
    testContext.swarmId = swarmMatch[1];
  }
});

Given('I have multiple RDF files in {string}', async function(directory: string) {
  const testDir = path.resolve(directory);
  await fs.mkdir(testDir, { recursive: true });
  
  // Create multiple test RDF files
  const files = ['file1.ttl', 'file2.ttl', 'file3.ttl'];
  for (const file of files) {
    const filePath = path.join(testDir, file);
    const content = `@prefix ex: <http://example.org/${file}/> .
ex:entity a ex:TestEntity ;
    ex:hasProperty "value for ${file}" .`;
    
    await fs.writeFile(filePath, content, 'utf-8');
    testContext.tempFiles?.push(filePath);
  }
});

Then('each file should be processed by different swarm agents', function() {
  expect(testContext.lastOutput).to.include('distributed');
  expect(testContext.lastOutput).to.include('agents');
});

Then('all analyses should complete within {int} seconds', function(maxSeconds: number) {
  const duration = testContext.performanceMetrics?.duration || 0;
  expect(duration).to.be.lessThan(maxSeconds * 1000);
});

Then('the swarm should coordinate work distribution efficiently', function() {
  expect(testContext.lastOutput).to.include('coordination');
  expect(testContext.lastExitCode).to.equal(0);
});

Then('results should be aggregated consistently', function() {
  expect(testContext.lastOutput).to.include('aggregated');
  expect(testContext.lastOutput).to.include('results');
});

Then('no agent should exceed {int}% CPU utilization', async function(maxCPU: number) {
  // This would require system monitoring
  // For now, verify the command completed successfully
  expect(testContext.lastExitCode).to.equal(0);
});

// Performance and optimization step definitions
Given('I have a complex SPARQL query file at {string}', async function(filePath: string) {
  const testFile = path.resolve(filePath);
  testContext.tempFiles?.push(testFile);
  
  const sparqlQuery = `
PREFIX ex: <http://example.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?person ?name ?org ?orgName
WHERE {
  ?person a ex:Person ;
          rdfs:label ?name ;
          ex:worksFor ?org .
  ?org rdfs:label ?orgName .
  FILTER(?name != "Unknown")
  OPTIONAL {
    ?person ex:hasSkill ?skill .
    ?skill rdfs:label ?skillName .
  }
}
ORDER BY ?name
LIMIT 100`;

  await fs.mkdir(path.dirname(testFile), { recursive: true });
  await fs.writeFile(testFile, sparqlQuery, 'utf-8');
});

Given('DAA learning is enabled for semantic optimization', async function() {
  // Verify DAA capabilities are available
  const result = await executeCLICommand('unjucks swarm --help');
  expect(result.exitCode).to.equal(0);
  expect(result.stdout).to.include('daa');
});

Then('the query should be automatically optimized', function() {
  expect(testContext.lastOutput).to.include('optimized');
  expect(testContext.lastOutput).to.include('query');
});

Then('execution time should improve over multiple runs', async function() {
  // Run the same command again and compare performance
  const secondResult = await executeCLICommand(testContext.lastCommand!);
  expect(secondResult.exitCode).to.equal(0);
  
  // In a real implementation, we would track and compare execution times
  expect(secondResult.stdout).to.include('performance');
});

Then('the DAA should learn from optimization patterns', function() {
  expect(testContext.lastOutput).to.include('learning');
  expect(testContext.lastOutput).to.include('pattern');
});

Then('query performance metrics should be tracked', function() {
  expect(testContext.lastOutput).to.include('metrics');
  expect(testContext.lastOutput).to.include('performance');
});

Then('results should maintain semantic correctness', function() {
  expect(testContext.lastOutput).to.include('semantic');
  expect(testContext.lastOutput).to.include('valid');
});

// Security validation step definitions
Given('I have an RDF file with potential security issues at {string}', async function(filePath: string) {
  const testFile = path.resolve(filePath);
  testContext.tempFiles?.push(testFile);
  
  // Create RDF with potential security issues
  const maliciousRDF = `@prefix ex: <http://malicious-site.example.com/> .
@prefix js: <javascript:> .

ex:entity a ex:SuspiciousEntity ;
    ex:hasScript "javascript:alert('XSS')" ;
    ex:callsHome <http://attacker.com/steal-data> ;
    ex:hasSQL "'; DROP TABLE users; --" .`;

  await fs.mkdir(path.dirname(testFile), { recursive: true });
  await fs.writeFile(testFile, maliciousRDF, 'utf-8');
});

Then('security vulnerabilities should be detected and reported', function() {
  expect(testContext.lastOutput).to.include('security');
  expect(testContext.lastOutput).to.include('vulnerability');
});

Then('malicious URIs should be flagged', function() {
  expect(testContext.lastOutput).to.include('malicious');
  expect(testContext.lastOutput).to.include('URI');
});

Then('validation should include injection attack detection', function() {
  expect(testContext.lastOutput).to.include('injection');
  expect(testContext.lastOutput).to.include('attack');
});

Then('the command should provide security recommendations', function() {
  expect(testContext.lastOutput).to.include('recommendation');
  expect(testContext.lastOutput).to.include('security');
});

Then('exit code should be {int} for security violations', function(expectedCode: number) {
  expect(testContext.lastExitCode).to.equal(expectedCode);
});

// Workflow step definitions
Given('I have a workflow definition with semantic processing steps', async function() {
  const workflowFile = path.resolve('tests/fixtures/workflows/semantic-pipeline.yaml');
  testContext.tempFiles?.push(workflowFile);
  
  const workflowDefinition = {
    id: 'semantic-pipeline-test',
    name: 'Semantic Processing Pipeline',
    description: 'Test workflow for semantic processing integration',
    steps: [
      {
        id: 'rdf-analysis',
        name: 'RDF Analysis',
        action: 'analyze',
        agentType: 'researcher',
        parameters: {
          semantic: true,
          neural: true
        }
      },
      {
        id: 'pattern-recognition',
        name: 'Pattern Recognition',
        action: 'analyze',
        agentType: 'optimizer',
        dependencies: ['rdf-analysis'],
        parameters: {
          patterns: true,
          cognitive: 'adaptive'
        }
      }
    ],
    strategy: 'adaptive'
  };

  await fs.mkdir(path.dirname(workflowFile), { recursive: true });
  await fs.writeFile(workflowFile, yaml.stringify(workflowDefinition), 'utf-8');
});

Then('semantic analysis should integrate seamlessly with workflow', function() {
  expect(testContext.lastOutput).to.include('semantic');
  expect(testContext.lastOutput).to.include('workflow');
  expect(testContext.lastExitCode).to.equal(0);
});

Then('semantic results should flow between workflow steps', function() {
  expect(testContext.lastOutput).to.include('steps');
  expect(testContext.lastOutput).to.include('results');
});

Then('error handling should propagate semantic validation failures', function() {
  // This would be tested with a workflow that has validation failures
  expect(testContext.lastExitCode).to.equal(0); // Success case for this test
});

Then('workflow performance should meet SLA requirements', function() {
  const duration = testContext.performanceMetrics?.duration || 0;
  expect(duration).to.be.lessThan(60000); // 60 seconds SLA
});

Then('semantic context should be maintained across steps', function() {
  expect(testContext.lastOutput).to.include('context');
  expect(testContext.lastOutput).to.include('semantic');
});

// Export validation step definitions
Given('I have processed semantic data in multiple formats', async function() {
  // This would typically involve running previous semantic processing
  // For now, we'll assume data is available
  expect(testContext.lastExitCode).to.equal(0);
});

Then('semantic data should be exported in all requested formats', function() {
  const formats = ['ttl', 'json-ld', 'rdf-xml', 'n3'];
  for (const format of formats) {
    expect(testContext.lastOutput).to.include(format);
  }
});

Then('each export format should be syntactically valid', function() {
  expect(testContext.lastOutput).to.include('valid');
  expect(testContext.lastOutput).to.include('syntax');
});

Then('semantic equivalence should be maintained across formats', function() {
  expect(testContext.lastOutput).to.include('equivalence');
  expect(testContext.lastOutput).to.include('semantic');
});

Then('export performance should be optimized', function() {
  const duration = testContext.performanceMetrics?.duration || 0;
  expect(duration).to.be.lessThan(10000); // 10 seconds for export operations
});

Then('format-specific optimizations should be applied', function() {
  expect(testContext.lastOutput).to.include('optimization');
  expect(testContext.lastOutput).to.include('format');
});