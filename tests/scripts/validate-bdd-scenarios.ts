#!/usr/bin/env tsx

/**
 * Script to validate BDD scenarios work with actual implementation
 * Tests that all scenarios are runnable and use real functionality
 */

import { TurtleParser, TurtleUtils, parseTurtle } from '../../src/lib/turtle-parser.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

interface ValidationResult {
  scenario: string;
  passed: boolean;
  error?: Error;
  duration: number;
}

class BDDValidator {
  private results: ValidationResult[] = [];
  private parser = new TurtleParser();
  private dataLoader = new RDFDataLoader();
  private rdfFilters = new RDFFilters();

  async validateScenarios(): Promise<void> {
    console.log('🧪 Validating BDD scenarios with real implementation...\n');

    await this.validateBasicParsing();
    await this.validateDataLoading();
    await this.validateRDFFilters();
    await this.validatePerformance();
    await this.validateErrorHandling();
    await this.validateSyncAsync();

    this.printResults();
  }

  private async validateBasicParsing(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const content = readFileSync(join(process.cwd(), 'tests/fixtures/turtle/basic-person.ttl'), 'utf-8');
      const result = await this.parser.parse(content);
      
      // Validate structure
      if (!result.triples || result.triples.length === 0) {
        throw new Error('No triples parsed');
      }
      
      if (!result.prefixes || !result.prefixes.foaf) {
        throw new Error('FOAF prefix not found');
      }
      
      if (!result.stats || result.stats.tripleCount === 0) {
        throw new Error('Stats not properly recorded');
      }

      // Validate specific data
      const personTriples = result.triples.filter(t => 
        t.subject.value.includes('person1') && 
        t.predicate.value.includes('name')
      );
      
      if (personTriples.length === 0) {
        throw new Error('Person name triples not found');
      }

      if (personTriples[0].object.value !== 'John Doe') {
        throw new Error(`Expected 'John Doe', got '${personTriples[0].object.value}'`);
      }

      this.results.push({
        scenario: 'Parse basic Turtle data file with TurtleParser',
        passed: true,
        duration: performance.now() - startTime
      });
    } catch (error) {
      this.results.push({
        scenario: 'Parse basic Turtle data file with TurtleParser',
        passed: false,
        error: error as Error,
        duration: performance.now() - startTime
      });
    }
  }

  private async validateDataLoading(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const fileSource = join(process.cwd(), 'tests/fixtures/turtle/complex-project.ttl');
      
      if (!existsSync(fileSource)) {
        throw new Error('Test fixture file not found');
      }

      const inlineData = `
        @prefix ex: <http://example.org/> .
        <#test> ex:name "Inline Test" ; ex:type "inline" .
      `;

      const [fileResult, inlineResult] = await Promise.all([
        this.dataLoader.loadFromSource({ type: 'file', path: fileSource }),
        this.dataLoader.loadFromSource({ type: 'inline', content: inlineData })
      ]);

      if (!fileResult.triples || fileResult.triples.length === 0) {
        throw new Error('File loading failed');
      }

      if (!inlineResult.triples || inlineResult.triples.length === 0) {
        throw new Error('Inline data loading failed');
      }

      this.results.push({
        scenario: 'Load RDF data from multiple sources with RDFDataLoader',
        passed: true,
        duration: performance.now() - startTime
      });
    } catch (error) {
      this.results.push({
        scenario: 'Load RDF data from multiple sources with RDFDataLoader',
        passed: false,
        error: error as Error,
        duration: performance.now() - startTime
      });
    }
  }

  private async validateRDFFilters(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const content = readFileSync(join(process.cwd(), 'tests/fixtures/turtle/complex-project.ttl'), 'utf-8');
      const parseResult = await this.parser.parse(content);
      
      // Test filter functions exist and work
      const subjectFilter = this.rdfFilters.rdfSubject(parseResult.triples, 'unjucks');
      const objectFilter = this.rdfFilters.rdfObject(parseResult.triples, 'name');
      const queryFilter = this.rdfFilters.rdfQuery(parseResult.triples, { predicate: 'doap:name' });

      if (!Array.isArray(subjectFilter)) {
        throw new Error('Subject filter should return array');
      }

      if (!this.rdfFilters.expandPrefix) {
        throw new Error('expandPrefix method not available');
      }

      const expandedUri = this.rdfFilters.expandPrefix('doap:name', parseResult.prefixes);
      if (!expandedUri.startsWith('http')) {
        throw new Error('URI expansion failed');
      }

      this.results.push({
        scenario: 'Use RDF filters in Nunjucks templates',
        passed: true,
        duration: performance.now() - startTime
      });
    } catch (error) {
      this.results.push({
        scenario: 'Use RDF filters in Nunjucks templates',
        passed: false,
        error: error as Error,
        duration: performance.now() - startTime
      });
    }
  }

  private async validatePerformance(): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Generate test data if large fixture doesn't exist
      const largeFilePath = join(process.cwd(), 'tests/fixtures/turtle/performance/large-10000.ttl');
      let largeContent: string;
      
      if (existsSync(largeFilePath)) {
        largeContent = readFileSync(largeFilePath, 'utf-8');
      } else {
        let content = '@prefix ex: <http://example.org/> .\n';
        for (let i = 0; i < 1000; i++) {
          content += `<#entity${i}> ex:name "Entity ${i}" ; ex:id "${i}" ; ex:type "test" .\n`;
        }
        largeContent = content;
      }

      const memoryBefore = process.memoryUsage().heapUsed;
      const parseStart = performance.now();
      
      const parseResult = await this.parser.parse(largeContent);
      
      const parseTime = performance.now() - parseStart;
      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryAfter - memoryBefore;

      if (parseTime > 2000) {
        throw new Error(`Parsing took ${parseTime}ms, expected < 2000ms`);
      }

      if (memoryIncrease > 100 * 1024 * 1024) {
        throw new Error(`Memory increase ${memoryIncrease} bytes, expected < 100MB`);
      }

      if (parseResult.triples.length < 1000) {
        throw new Error(`Expected > 1000 triples, got ${parseResult.triples.length}`);
      }

      this.results.push({
        scenario: 'Validate performance with large RDF datasets',
        passed: true,
        duration: performance.now() - startTime
      });
    } catch (error) {
      this.results.push({
        scenario: 'Validate performance with large RDF datasets',
        passed: false,
        error: error as Error,
        duration: performance.now() - startTime
      });
    }
  }

  private async validateErrorHandling(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const invalidContent = readFileSync(join(process.cwd(), 'tests/fixtures/turtle/invalid-syntax.ttl'), 'utf-8');
      
      let parseError: Error | null = null;
      try {
        await this.parser.parse(invalidContent);
      } catch (error) {
        parseError = error as Error;
      }

      if (!parseError) {
        throw new Error('Expected parsing to fail with invalid syntax');
      }

      if (parseError.name !== 'TurtleParseError') {
        throw new Error(`Expected TurtleParseError, got ${parseError.name}`);
      }

      if (!parseError.message.includes('Failed to parse Turtle')) {
        throw new Error('Error message should mention parsing failure');
      }

      this.results.push({
        scenario: 'Handle Turtle syntax errors gracefully',
        passed: true,
        duration: performance.now() - startTime
      });
    } catch (error) {
      this.results.push({
        scenario: 'Handle Turtle syntax errors gracefully',
        passed: false,
        error: error as Error,
        duration: performance.now() - startTime
      });
    }
  }

  private async validateSyncAsync(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const content = readFileSync(join(process.cwd(), 'tests/fixtures/turtle/basic-person.ttl'), 'utf-8');
      
      const asyncResult = await this.parser.parse(content);
      const syncResult = this.parser.parseSync(content);

      if (asyncResult.triples.length !== syncResult.triples.length) {
        throw new Error('Async and sync results have different triple counts');
      }

      if (asyncResult.stats.tripleCount !== syncResult.stats.tripleCount) {
        throw new Error('Async and sync stats differ');
      }

      if (Object.keys(asyncResult.prefixes).length !== Object.keys(syncResult.prefixes).length) {
        throw new Error('Async and sync prefixes differ');
      }

      this.results.push({
        scenario: 'Compare synchronous and asynchronous parsing',
        passed: true,
        duration: performance.now() - startTime
      });
    } catch (error) {
      this.results.push({
        scenario: 'Compare synchronous and asynchronous parsing',
        passed: false,
        error: error as Error,
        duration: performance.now() - startTime
      });
    }
  }

  private printResults(): void {
    console.log('\n📊 Validation Results:\n');
    
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const duration = `${result.duration.toFixed(2)}ms`;
      
      console.log(`${status} ${result.scenario} (${duration})`);
      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error.message}`);
      }
    });
    
    console.log(`\n🎯 Summary: ${passed}/${total} scenarios passed`);
    
    if (passed === total) {
      console.log('🎉 All BDD scenarios validated successfully!');
      process.exit(0);
    } else {
      console.log('⚠️  Some scenarios failed validation');
      process.exit(1);
    }
  }
}

// Run validation if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new BDDValidator();
  validator.validateScenarios().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

export { BDDValidator };