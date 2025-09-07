/**
 * Integration tests for MCP tool integration
 * Tests the core functionality described in Gherkin scenarios
 */

import { test, expect, describe } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

// Helper function to run CLI commands
function runCLI(command, options = {}) {
  const fullCommand = `node src/cli/index.js ${command}`;
  try {
    const result = execSync(fullCommand, {
      cwd: projectRoot,
      encoding: 'utf-8',
      ...options
    });
    return { success: true, output: result, error: null };
  } catch (error) {
    return { 
      success: false, 
      output: error.stdout || '', 
      error: error.stderr || error.message 
    };
  }
}

describe('MCP Integration Tests', () => {
  describe('Swarm Coordination', () => {
    test('should initialize swarm with mesh topology and 5 agents', () => {
      const result = runCLI('swarm init --topology mesh --agents 5');
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('🐝 Initializing AI Swarm');
      expect(result.output).toContain('Topology: mesh');
      expect(result.output).toContain('Agents: 5');
      expect(result.output).toContain('✅ Swarm initialized successfully!');
    });

    test('should initialize swarm with hierarchical topology', () => {
      const result = runCLI('swarm init --topology hierarchical --agents 8 --strategy adaptive');
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('Topology: hierarchical');
      expect(result.output).toContain('Agents: 8');
      expect(result.output).toContain('Strategy: adaptive');
    });

    test('should show swarm status with active swarms', () => {
      const result = runCLI('swarm status');
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('📊 Swarm Status');
      expect(result.output).toMatch(/Available Swarms \(\d+\):/);
    });

    test('should support different topologies: ring and star', () => {
      const ringResult = runCLI('swarm init --topology ring --agents 6');
      expect(ringResult.success).toBe(true);
      expect(ringResult.output).toContain('Topology: ring');

      const starResult = runCLI('swarm init --topology star --agents 4');
      expect(starResult.success).toBe(true);
      expect(starResult.output).toContain('Topology: star');
    });
  });

  describe('Semantic RDF Validation', () => {
    test('should validate turtle ontology files', async () => {
      // Ensure test fixture exists
      const turtleFile = path.join(projectRoot, 'tests/fixtures/turtle/sample-ontology.ttl');
      expect(await fs.pathExists(turtleFile)).toBe(true);

      const result = runCLI(`semantic validate --input ${turtleFile}`);
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('✅ Validating RDF/Turtle Ontology...');
      expect(result.output).toContain('✅ RDF parsing successful!');
      expect(result.output).toContain('📊 Parse Statistics:');
      expect(result.output).toContain('Triples:');
      expect(result.output).toContain('Prefixes:');
    });

    test('should provide detailed analysis with verbose flag', async () => {
      const turtleFile = path.join(projectRoot, 'tests/fixtures/turtle/sample-ontology.ttl');
      const result = runCLI(`semantic validate --input ${turtleFile} --verbose`);
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('🔗 Namespace Prefixes:');
      expect(result.output).toContain('🧠 Semantic Analysis:');
      expect(result.output).toContain('Detected vocabularies:');
    });

    test('should handle invalid RDF files gracefully', () => {
      // Create a temporary invalid RDF file
      const invalidFile = path.join(projectRoot, 'tests/fixtures/turtle/invalid.ttl');
      
      // Write invalid content
      fs.writeFileSync(invalidFile, 'This is not valid RDF content');
      
      const result = runCLI(`semantic validate --input ${invalidFile}`);
      
      expect(result.success).toBe(true); // Command runs but reports errors
      expect(result.output).toContain('❌ RDF Parse Error:');
      
      // Clean up
      fs.unlinkSync(invalidFile);
    });
  });

  describe('MCP Tool Integration', () => {
    test('should detect MCP availability status', () => {
      // Test that the system can determine MCP tool availability
      const result = runCLI('swarm init --topology mesh --agents 3');
      
      expect(result.success).toBe(true);
      // Should show either MCP mode or standalone mode
      expect(result.output).toMatch(/Mode: (mcp|standalone)/);
    });

    test('should support template generation with MCP integration', () => {
      // This tests the basic MCP infrastructure even if specific tools aren't available
      const result = runCLI('list');
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('Available commands:');
      expect(result.output).toContain('semantic');
      expect(result.output).toContain('swarm');
    });
  });

  describe('Command Line Interface', () => {
    test('should provide help information', () => {
      const result = runCLI('--help');
      
      expect(result.success || result.output.length > 0).toBe(true);
      expect(result.output).toContain('Unjucks CLI');
      expect(result.output).toContain('Available commands:');
    });

    test('should support all required commands from Gherkin scenarios', () => {
      // Test that the commands mentioned in Gherkin scenarios exist
      const commands = ['swarm', 'semantic'];
      
      commands.forEach(command => {
        const result = runCLI(command);
        expect(result.success || result.output.length > 0).toBe(true);
        expect(result.output).not.toContain('Unknown command');
      });
    });
  });
});

// Cleanup function for after tests
export function cleanup() {
  // Clean up any test artifacts
  const stateFile = path.join(projectRoot, '.unjucks/swarm-state.json');
  if (fs.pathExistsSync(stateFile)) {
    try {
      const state = fs.readJsonSync(stateFile);
      // Remove test swarms
      state.swarms = state.swarms.filter(swarm => 
        !swarm.name.includes('test-') && 
        !swarm.id.includes('test')
      );
      fs.writeJsonSync(stateFile, state, { spaces: 2 });
    } catch (error) {
      console.warn('Could not clean up swarm state:', error.message);
    }
  }
}