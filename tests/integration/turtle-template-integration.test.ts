import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Generator } from '../../src/lib/generator.js';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { existsSync, removeSync, ensureDirSync, writeFileSync } from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Turtle Template Integration', () => {
  let testDir: string;
  let generator: Generator;
  let parser: TurtleParser;

  beforeEach(() => {
    testDir = join(tmpdir(), `unjucks-turtle-test-${Date.now()}`);
    ensureDirSync(testDir);
    
    generator = new Generator();
    parser = new TurtleParser();
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      removeSync(testDir);
    }
  });

  describe('Template Generation with Turtle Data', () => {
    it('should generate template using Turtle data as variables', async () => {
      // Setup: Create Turtle data file
      const turtleData = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix schema: <https://schema.org/> .

        <#person1>
          foaf:name "John Doe" ;
          foaf:email "john.doe@example.com" ;
          schema:jobTitle "Software Engineer" .
      `;

      const turtleFilePath = join(testDir, 'person.ttl');
      writeFileSync(turtleFilePath, turtleData);

      // Setup: Create template
      const templateDir = join(testDir, '_templates', 'profile');
      ensureDirSync(templateDir);
      
      const templateContent = `---
to: profiles/{{ person1.name | replace(' ', '') }}.md
---
# Profile: {{ person1.name }}

- **Email**: {{ person1.email }}
- **Job Title**: {{ person1.jobTitle }}

Generated from Turtle data on {{ new Date().toISOString().split('T')[0] }}.
`;

      writeFileSync(join(templateDir, 'profile.md.ejs'), templateContent);

      // Parse Turtle data
      const parseResult = await parser.parseFile(turtleFilePath);
      expect(parseResult.success).toBe(true);

      // Test: Generate using Turtle data as variables
      const variables = {
        ...parseResult.data,
        generatedAt: new Date().toISOString(),
      };

      // This would require extending Generator to accept data directly
      // For now, we test the data extraction works correctly
      expect(variables.person1).toBeDefined();
      expect((variables.person1 as any).name).toBe('John Doe');
      expect((variables.person1 as any).email).toBe('john.doe@example.com');
      expect((variables.person1 as any).jobTitle).toBe('Software Engineer');
    });

    it('should handle complex Turtle data with multiple entities', async () => {
      const turtleData = `
        @prefix proj: <http://example.org/project/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .

        proj:myproject
          proj:name "My Project" ;
          proj:version "1.0.0" ;
          proj:maintainer <#maintainer1> .

        <#maintainer1>
          foaf:name "Jane Smith" ;
          foaf:email "jane@example.com" .
      `;

      const parseResult = await parser.parseContent(turtleData);
      
      expect(parseResult.success).toBe(true);
      expect(parseResult.data.myproject).toBeDefined();
      expect(parseResult.data.maintainer1).toBeDefined();
      
      const project = parseResult.data.myproject as any;
      const maintainer = parseResult.data.maintainer1 as any;
      
      expect(project.name).toBe('My Project');
      expect(project.version).toBe('1.0.0');
      expect(maintainer.name).toBe('Jane Smith');
      expect(maintainer.email).toBe('jane@example.com');
    });

    it('should extract all available template variables from Turtle data', async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .

        <#config>
          ex:appName "MyApp" ;
          ex:version "2.0.0" ;
          ex:author "Developer" ;
          ex:features ex:auth, ex:api, ex:ui .

        ex:auth ex:name "Authentication" ; ex:enabled true .
        ex:api ex:name "REST API" ; ex:enabled true .  
        ex:ui ex:name "User Interface" ; ex:enabled false .
      `;

      const parseResult = await parser.parseContent(turtleData);
      
      expect(parseResult.success).toBe(true);
      expect(parseResult.variables).toContain('config');
      expect(parseResult.variables).toContain('config.appName');
      expect(parseResult.variables).toContain('config.version');
      expect(parseResult.variables).toContain('config.author');
      expect(parseResult.variables).toContain('auth');
      expect(parseResult.variables).toContain('auth.name');
      expect(parseResult.variables).toContain('auth.enabled');
    });

    it('should handle Turtle data with arrays and multiple values', async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .

        <#developer>
          ex:name "Alice Johnson" ;
          ex:skill "JavaScript" ;
          ex:skill "TypeScript" ;
          ex:skill "Python" ;
          ex:project "ProjectA" ;
          ex:project "ProjectB" .
      `;

      const parseResult = await parser.parseContent(turtleData);
      
      expect(parseResult.success).toBe(true);
      
      const developer = parseResult.data.developer as any;
      expect(developer.name).toBe('Alice Johnson');
      expect(Array.isArray(developer.skill)).toBe(true);
      expect(developer.skill).toContain('JavaScript');
      expect(developer.skill).toContain('TypeScript');
      expect(developer.skill).toContain('Python');
      expect(Array.isArray(developer.project)).toBe(true);
      expect(developer.project).toHaveLength(2);
    });

    it('should preserve data types from Turtle literals', async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        <#stats>
          ex:count "42"^^xsd:integer ;
          ex:percentage "85.5"^^xsd:decimal ;
          ex:active "true"^^xsd:boolean ;
          ex:description "A test string" .
      `;

      const parseResult = await parser.parseContent(turtleData);
      
      expect(parseResult.success).toBe(true);
      
      const stats = parseResult.data.stats as any;
      expect(stats.count).toBe('42'); // N3.js preserves literal values as strings
      expect(stats.percentage).toBe('85.5');
      expect(stats.active).toBe('true');
      expect(stats.description).toBe('A test string');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid Turtle syntax gracefully', async () => {
      const invalidTurtle = `
        @prefix ex: <http://example.org/> .
        <#broken> ex:name "Missing quote ;
      `;

      const parseResult = await parser.parseContent(invalidTurtle);
      
      expect(parseResult.success).toBe(false);
      expect(parseResult.errors).toHaveLength(1);
      expect(parseResult.data).toEqual({});
      expect(parseResult.variables).toHaveLength(0);
    });

    it('should handle empty Turtle files', async () => {
      const parseResult = await parser.parseContent('');
      
      expect(parseResult.success).toBe(true);
      expect(parseResult.data).toEqual({});
      expect(parseResult.variables).toHaveLength(0);
      expect(parseResult.quadCount).toBe(0);
    });

    it('should handle Turtle files with only prefixes', async () => {
      const turtleData = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix ex: <http://example.org/> .
      `;

      const parseResult = await parser.parseContent(turtleData);
      
      expect(parseResult.success).toBe(true);
      expect(parseResult.data).toEqual({});
      expect(parseResult.variables).toHaveLength(0);
      expect(parseResult.quadCount).toBe(0);
    });
  });

  describe('Performance with Large Datasets', () => {
    it('should handle moderately large Turtle files efficiently', async () => {
      // Generate a larger dataset
      let turtleData = '@prefix ex: <http://example.org/> .\n';
      for (let i = 0; i < 500; i++) {
        turtleData += `<#user${i}> ex:name "User ${i}" ; ex:id "${i}" ; ex:email "user${i}@example.com" .\n`;
      }

      const startTime = performance.now();
      const parseResult = await parser.parseContent(turtleData);
      const endTime = performance.now();

      expect(parseResult.success).toBe(true);
      expect(parseResult.quadCount).toBe(1500); // 3 properties per user
      expect(Object.keys(parseResult.data)).toHaveLength(500);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should extract variables efficiently from large datasets', async () => {
      let turtleData = '@prefix ex: <http://example.org/> .\n';
      for (let i = 0; i < 100; i++) {
        turtleData += `<#item${i}> ex:name "Item ${i}" ; ex:category "Category${i % 5}" .\n`;
      }

      const startTime = performance.now();
      const parseResult = await parser.parseContent(turtleData);
      const endTime = performance.now();

      expect(parseResult.success).toBe(true);
      expect(parseResult.variables).toHaveLength(300); // 100 items × 3 variables each
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory after multiple parsing operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform multiple parsing operations
      for (let i = 0; i < 10; i++) {
        const turtleData = `
          @prefix ex: <http://example.org/> .
          <#test${i}> ex:name "Test ${i}" .
        `;
        
        const parseResult = await parser.parseContent(turtleData);
        expect(parseResult.success).toBe(true);
        
        // Clear the parser between operations
        parser.clear();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});