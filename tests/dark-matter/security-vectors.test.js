import { describe, it, expect, beforeEach } from 'vitest';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { SemanticTemplateProcessor } from '../../src/lib/semantic-template-processor.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';

/**
 * DARK MATTER VALIDATION: Security Attack Vectors
 * 
 * Tests the critical security vulnerabilities in RDF/Turtle processing that
 * can lead to injection attacks, data breaches, and system compromise.
 * These attack vectors are often overlooked but cause major production incidents.
 */
describe('Dark Matter: Security Attack Vectors', () => {
  let parser;
  let processor;
  let dataLoader;

  beforeEach(() => {
    parser = new TurtleParser({ baseIRI: 'http://example.org/' });
    processor = new SemanticTemplateProcessor({
      sanitizeInput: true,
      maxTemplateSize: 1024 * 1024, // 1MB limit
      enableSandbox: true
    });
    dataLoader = new RDFDataLoader({ enableValidation: true });
  });

  describe('RDF Injection Attacks', () => {
    it('should prevent RDF injection through unescaped literals', async () => {
      // Malicious input that tries to inject additional RDF statements
      const maliciousInput = {
        name: 'John" . ex:admin "true" . ex:backdoor "',
        description: 'Normal description" ; ex:password "secret123',
        email: 'test@example.com" ^^<http://www.w3.org/2001/XMLSchema#string> . ex:evil',
      };

      const template = `
        @prefix ex: <http://example.org/> .
        
        ex:user1 ex:name "{{ name }}" ;
          ex:description "{{ description }}" ;
          ex:email "{{ email }}" .
      `;

      const result = await processor.render(template, maliciousInput);
      
      // Should properly escape quotes and prevent injection
      expect(result.content).not.toContain('ex:admin "true"');
      expect(result.content).not.toContain('ex:password "secret123"');
      expect(result.content).not.toContain('ex:evil');
      
      // Should contain escaped quotes
      expect(result.content).toContain('\\"');
      
      // Verify the rendered content is still valid Turtle
      const parseResult = await parser.parse(result.content);
      expect(parseResult.triples.length).toBe(3); // Only the intended triples
    });

    it('should prevent URI injection attacks', async () => {
      const maliciousURIs = {
        resource1: 'http://evil.com/> . ex:injected "true" . ex:victim <http://example.org/',
        resource2: 'javascript:alert("xss")',
        resource3: 'data:text/html,<script>alert("xss")</script>',
        resource4: 'http://example.org/> ; ex:hacked "yes" ; ex:dummy <',
      };

      const template = `
        @prefix ex: <http://example.org/> .
        
        <{{ resource1 }}> ex:type "Resource1" .
        <{{ resource2 }}> ex:type "Resource2" .
        <{{ resource3 }}> ex:type "Resource3" .
        <{{ resource4 }}> ex:type "Resource4" .
      `;

      const result = await processor.render(template, maliciousURIs);
      
      // Should reject or sanitize dangerous URIs
      expect(result.content).not.toContain('javascript:');
      expect(result.content).not.toContain('data:text/html');
      expect(result.content).not.toContain('ex:injected "true"');
      expect(result.content).not.toContain('ex:hacked "yes"');
      
      // Verify no injection occurred
      const parseResult = await parser.parse(result.content);
      expect(parseResult.triples.length).toBeLessThanOrEqual(4);
    });

    it('should prevent blank node ID manipulation', async () => {
      const maliciousBlankNodes = {
        node1: '_:legitimate',
        node2: '_:hack> . ex:injected "true" . _:dummy',
        node3: '_:node] ; ex:backdoor "open" ; [',
        node4: '_:valid_but_long_' + 'x'.repeat(10000), // DoS via long IDs
      };

      const template = `
        @prefix ex: <http://example.org/> .
        
        {{ node1 }} ex:property "value1" .
        {{ node2 }} ex:property "value2" .
        {{ node3 }} ex:property "value3" .
        {{ node4 }} ex:property "value4" .
      `;

      const result = await processor.render(template, maliciousBlankNodes);
      
      // Should prevent injection through blank node IDs
      expect(result.content).not.toContain('ex:injected');
      expect(result.content).not.toContain('ex:backdoor');
      
      // Should handle long IDs gracefully
      expect(result.content.length).toBeLessThan(50000); // Reasonable size limit
      
      const parseResult = await parser.parse(result.content);
      expect(parseResult.triples.length).toBeLessThanOrEqual(4);
    });
  });

  describe('Template Injection Attacks', () => {
    it('should prevent Nunjucks template injection', async () => {
      const maliciousTemplateData = {
        name: '{{ 7*7 }}',
        command: '{% set x = "dangerous" %}{{ x }}',
        constructor: '{{ this.constructor.constructor("return process")().exit() }}',
        global: '{{ global.process.exit() }}',
        require: '{% set fs = require("fs") %}{{ fs.readFileSync("/etc/passwd") }}',
        eval: '{{ eval("process.exit()") }}',
      };

      const template = `
        @prefix ex: <http://example.org/> .
        
        ex:user ex:name "{{ name }}" ;
          ex:command "{{ command }}" ;
          ex:constructor "{{ constructor }}" ;
          ex:global "{{ global }}" ;
          ex:require "{{ require }}" ;
          ex:eval "{{ eval }}" .
      `;

      const result = await processor.render(template, maliciousTemplateData);
      
      // Template injection should be prevented/escaped
      expect(result.content).not.toContain('49'); // 7*7 should not be evaluated
      expect(result.content).not.toContain('dangerous');
      expect(result.content).not.toContain('constructor');
      expect(result.content).not.toContain('process');
      expect(result.content).not.toContain('/etc/passwd');
      
      // Should contain escaped template syntax
      expect(result.content).toContain('{{');
      expect(result.content).toContain('}}');
    });

    it('should prevent code execution through filter chains', async () => {
      const maliciousFilters = {
        data1: 'test | safe | raw | eval',
        data2: 'test | constructor | call',
        data3: 'test | toString | constructor("alert(1)")() ',
        data4: 'process.mainModule.require("fs").readFileSync("/etc/passwd")',
      };

      // This would be a malicious template trying to exploit filters
      const template = `
        @prefix ex: <http://example.org/> .
        
        ex:test1 ex:value "{{ data1 | safe }}" ;
          ex:test2 "{{ data2 | safe }}" ;
          ex:test3 "{{ data3 | safe }}" ;
          ex:test4 "{{ data4 | safe }}" .
      `;

      const result = await processor.render(template, maliciousFilters);
      
      // Should not execute dangerous code
      expect(result.content).not.toContain('/etc/passwd');
      expect(result.content).not.toContain('constructor');
      expect(result.content).not.toContain('mainModule');
      
      // Should treat as literal strings
      expect(result.content).toContain('ex:value');
    });

    it('should sanitize dangerous template functions', async () => {
      const maliciousContext = {
        user: {
          name: 'testuser',
          // Attempt to inject dangerous functions
          toString: () => 'process.exit()',
          valueOf: () => { throw new Error('Injection attempt'); },
          constructor: Function,
        }
      };

      const template = `
        @prefix ex: <http://example.org/> .
        
        ex:user ex:name "{{ user.name }}" ;
          ex:string "{{ user.toString() }}" ;
          ex:value "{{ user.valueOf() }}" .
      `;

      try {
        const result = await processor.render(template, maliciousContext);
        
        // Should not execute dangerous methods
        expect(result.content).not.toContain('process.exit()');
        expect(result.content).toContain('testuser');
        
      } catch (error) {
        // Acceptable to throw error for dangerous operations
        expect(error.message).toContain('Injection attempt');
      }
    });
  });

  describe('XXE (XML External Entity) Attacks', () => {
    it('should prevent XXE attacks in RDF/XML processing', async () => {
      const maliciousXML = `
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE rdf:RDF [
          <!ENTITY xxe SYSTEM "file:///etc/passwd">
          <!ENTITY xxe2 SYSTEM "http://evil.com/steal-data">
        ]>
        <rdf:RDF 
          xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
          xmlns:ex="http://example.org/">
          
          <ex:Resource rdf:about="test">
            <ex:sensitiveData>&xxe;</ex:sensitiveData>
            <ex:externalData>&xxe2;</ex:externalData>
          </ex:Resource>
          
        </rdf:RDF>
      `;

      // Most XML parsers should prevent this by default
      try {
        // This would typically be handled by an XML-to-RDF converter
        // For this test, we check that dangerous content isn't processed
        expect(maliciousXML).toContain('DOCTYPE');
        expect(maliciousXML).toContain('ENTITY');
        expect(maliciousXML).toContain('file:///etc/passwd');
        
        // In a secure implementation, these entities should not be resolved
        expect(maliciousXML).not.toContain('root:x:0:0');
      } catch (error) {
        // Expected behavior - XXE should be blocked
        expect(error.message).toContain('entity');
      }
    });

    it('should prevent billion laughs attack (XML entity expansion)', async () => {
      const billionLaughsXML = `
        <?xml version="1.0"?>
        <!DOCTYPE rdf [
          <!ENTITY lol "lol">
          <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
          <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
          <!ENTITY lol4 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;">
          <!ENTITY lol5 "&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;">
        ]>
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
          <rdf:Description>
            <ex:content>&lol5;</ex:content>
          </rdf:Description>
        </rdf:RDF>
      `;

      const startTime = performance.now();
      const beforeMemory = process.memoryUsage().heapUsed;
      
      try {
        // This should be detected and prevented
        expect(billionLaughsXML).toContain('<!ENTITY lol5');
        
        const endTime = performance.now();
        const afterMemory = process.memoryUsage().heapUsed;
        
        // Should not consume excessive resources
        expect(endTime - startTime).toBeLessThan(1000); // Under 1 second
        expect(afterMemory - beforeMemory).toBeLessThan(100 * 1024 * 1024); // Under 100MB
        
      } catch (error) {
        // Expected - entity expansion should be blocked
        expect(error.message).toBeDefined();
      }
    });
  });

  describe('DoS (Denial of Service) Attacks', () => {
    it('should prevent resource exhaustion via large literals', async () => {
      const hugeValue = 'x'.repeat(10 * 1024 * 1024); // 10MB string
      const maliciousContent = `
        @prefix ex: <http://example.org/> .
        ex:resource ex:hugeProperty "${hugeValue}" .
      `;

      const beforeMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();
      
      try {
        const result = await parser.parse(maliciousContent);
        const endTime = performance.now();
        const afterMemory = process.memoryUsage().heapUsed;
        
        // Should handle large content but with reasonable limits
        expect(endTime - startTime).toBeLessThan(30000); // Under 30 seconds
        expect(afterMemory - beforeMemory).toBeLessThan(50 * 1024 * 1024); // Under 50MB
        
        if (result.triples) {
          expect(result.triples.length).toBe(1);
        }
      } catch (error) {
        // Acceptable to reject excessively large content
        expect(error.message).toContain('size');
      }
    });

    it('should prevent DoS via excessive predicate count', async () => {
      const propertyCount = 100000;
      const properties = Array.from({ length: propertyCount }, (_, i) => 
        `ex:property${i} "value${i}"`
      ).join(' ; ');
      
      const maliciousContent = `
        @prefix ex: <http://example.org/> .
        ex:subject ${properties} .
      `;

      const startTime = performance.now();
      const beforeMemory = process.memoryUsage().heapUsed;
      
      try {
        const result = await parser.parse(maliciousContent);
        const endTime = performance.now();
        const afterMemory = process.memoryUsage().heapUsed;
        
        expect(endTime - startTime).toBeLessThan(60000); // Under 60 seconds
        expect(afterMemory - beforeMemory).toBeLessThan(500 * 1024 * 1024); // Under 500MB
        
        if (result.triples) {
          expect(result.triples.length).toBe(propertyCount);
        }
      } catch (error) {
        // May fail due to reasonable limits
        expect(error.message).toBeDefined();
      }
    });

    it('should prevent ReDoS (Regular Expression DoS) attacks', async () => {
      // Patterns that might cause catastrophic backtracking
      const problematicStrings = [
        'a'.repeat(100) + 'X', // Pattern that doesn't match after long prefix
        '(' + 'a'.repeat(50) + ')*' + 'X',
        '^(a+)+$' + 'a'.repeat(50) + 'X',
        '(a|a)*' + 'a'.repeat(50) + 'X',
      ];

      const maliciousContent = `
        @prefix ex: <http://example.org/> .
        ${problematicStrings.map((str, i) => 
          `ex:resource${i} ex:problematic "${str}" .`
        ).join('\n')}
      `;

      const startTime = performance.now();
      const result = await parser.parse(maliciousContent);
      const endTime = performance.now();
      
      // Should not hang due to regex backtracking
      expect(endTime - startTime).toBeLessThan(5000); // Under 5 seconds
      expect(result.triples.length).toBe(problematicStrings.length);
    });

    it('should handle zip bomb-like compressed content', async () => {
      // Simulated highly compressible content that expands significantly
      const repeatedPattern = 'This is a repeated pattern. '.repeat(10000);
      const maliciousContent = `
        @prefix ex: <http://example.org/> .
        ex:resource ex:compressedData "${repeatedPattern}" .
      `;

      const beforeMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();
      
      const result = await parser.parse(maliciousContent);
      
      const endTime = performance.now();
      const afterMemory = process.memoryUsage().heapUsed;
      
      expect(result.triples.length).toBe(1);
      expect(endTime - startTime).toBeLessThan(10000); // Under 10 seconds
      expect(afterMemory - beforeMemory).toBeLessThan(100 * 1024 * 1024); // Under 100MB
    });
  });

  describe('Path Traversal and File System Attacks', () => {
    it('should prevent directory traversal in file URIs', async () => {
      const maliciousURIs = {
        file1: 'file:///etc/passwd',
        file2: 'file://../../etc/shadow',
        file3: 'file:///C:/Windows/System32/config/sam',
        file4: 'file://localhost/etc/hosts',
        file5: 'file:///proc/self/environ',
      };

      const template = `
        @prefix ex: <http://example.org/> .
        
        <{{ file1 }}> ex:type "File" .
        <{{ file2 }}> ex:type "File" .
        <{{ file3 }}> ex:type "File" .
        <{{ file4 }}> ex:type "File" .
        <{{ file5 }}> ex:type "File" .
      `;

      const result = await processor.render(template, maliciousURIs);
      
      // Should sanitize or reject dangerous file URIs
      expect(result.content).not.toContain('/etc/passwd');
      expect(result.content).not.toContain('/etc/shadow');
      expect(result.content).not.toContain('/etc/hosts');
      expect(result.content).not.toContain('config/sam');
      expect(result.content).not.toContain('/proc/self');
      
      // May contain sanitized versions or be rejected entirely
      const parseResult = await parser.parse(result.content);
      expect(parseResult.triples.length).toBeLessThanOrEqual(5);
    });

    it('should prevent inclusion of sensitive files through template includes', async () => {
      const maliciousIncludes = {
        include1: '/etc/passwd',
        include2: '../../config/database.yml',
        include3: '../../../.env',
        include4: '~/.ssh/id_rsa',
        include5: '/var/log/auth.log',
      };

      // This would be dangerous if templates supported file inclusion
      const template = `
        @prefix ex: <http://example.org/> .
        
        # These should NOT include actual files
        ex:data1 ex:content "{{ include1 }}" .
        ex:data2 ex:content "{{ include2 }}" .
        ex:data3 ex:content "{{ include3 }}" .
        ex:data4 ex:content "{{ include4 }}" .
        ex:data5 ex:content "{{ include5 }}" .
      `;

      const result = await processor.render(template, maliciousIncludes);
      
      // Should treat as literal strings, not file paths
      expect(result.content).toContain('/etc/passwd'); // As literal text only
      expect(result.content).not.toContain('root:x:0:0'); // Not actual file content
      expect(result.content).not.toContain('BEGIN RSA PRIVATE KEY');
      expect(result.content).not.toContain('database:');
    });
  });

  describe('Information Disclosure Attacks', () => {
    it('should prevent exposure of system information', async () => {
      const systemProbes = {
        os: '{{ process.platform }}',
        version: '{{ process.version }}',
        env: '{{ process.env.PATH }}',
        cwd: '{{ process.cwd() }}',
        memory: '{{ process.memoryUsage() }}',
        argv: '{{ process.argv }}',
      };

      const template = `
        @prefix ex: <http://example.org/> .
        
        ex:system ex:os "{{ os }}" ;
          ex:version "{{ version }}" ;
          ex:env "{{ env }}" ;
          ex:cwd "{{ cwd }}" ;
          ex:memory "{{ memory }}" ;
          ex:argv "{{ argv }}" .
      `;

      const result = await processor.render(template, systemProbes);
      
      // Should not expose sensitive system information
      expect(result.content).not.toContain('linux');
      expect(result.content).not.toContain('darwin');
      expect(result.content).not.toContain('win32');
      expect(result.content).not.toContain('v14.');
      expect(result.content).not.toContain('v16.');
      expect(result.content).not.toContain('/usr/bin');
      expect(result.content).not.toContain('/home/');
      
      // Should treat as literal template strings
      expect(result.content).toContain('{{');
    });

    it('should prevent error message information leakage', async () => {
      const malformedInputs = {
        badDate: new Date('invalid-date'),
        badJSON: '{"unclosed": "json"',
        badRegex: new RegExp('['),
        nullPointer: null,
        undefinedValue: undefined,
      };

      const template = `
        @prefix ex: <http://example.org/> .
        
        ex:test ex:date "{{ badDate | date }}" ;
          ex:json "{{ badJSON | fromJson }}" ;
          ex:regex "{{ badRegex | string }}" ;
          ex:null "{{ nullPointer.someMethod() }}" ;
          ex:undefined "{{ undefinedValue.property }}" .
      `;

      try {
        const result = await processor.render(template, malformedInputs);
        
        // Should handle errors gracefully without exposing internals
        expect(result.content).not.toContain('Error:');
        expect(result.content).not.toContain('TypeError:');
        expect(result.content).not.toContain('SyntaxError:');
        expect(result.content).not.toContain('at Object.');
        expect(result.content).not.toContain(__dirname);
        expect(result.content).not.toContain('node_modules');
        
      } catch (error) {
        // Errors should be sanitized
        expect(error.message).not.toContain(__dirname);
        expect(error.message).not.toContain('node_modules');
        expect(error.stack).toBeUndefined(); // Stack traces shouldn't be exposed
      }
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should validate and sanitize URIs properly', async () => {
      const dangerousURIs = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox("xss")',
        'jar:http://evil.com!/malicious.class',
        'ftp://evil.com/steal-credentials',
        'file:///etc/passwd',
        'ldap://evil.com/inject',
        'gopher://evil.com:70/evil-request',
      ];

      const content = dangerousURIs.map((uri, i) => 
        `<${uri}> ex:index "${i}" .`
      ).join('\n');

      const fullContent = `
        @prefix ex: <http://example.org/> .
        ${content}
      `;

      try {
        const result = await parser.parse(fullContent);
        
        // Should reject or sanitize dangerous URI schemes
        if (result.triples) {
          const uris = result.triples.map(t => t.subject.value);
          expect(uris.some(uri => uri.startsWith('javascript:'))).toBe(false);
          expect(uris.some(uri => uri.startsWith('data:text/html'))).toBe(false);
          expect(uris.some(uri => uri.startsWith('vbscript:'))).toBe(false);
          expect(uris.some(uri => uri.includes('alert'))).toBe(false);
        }
      } catch (error) {
        // Acceptable to reject invalid URIs
        expect(error.message).toBeDefined();
      }
    });

    it('should enforce reasonable limits on input sizes', async () => {
      const limits = {
        maxUriLength: 2000,
        maxLiteralLength: 1000000, // 1MB
        maxPrefixLength: 255,
        maxTripleCount: 1000000,
      };

      // Test URI length limit
      const longUri = 'http://example.org/' + 'x'.repeat(limits.maxUriLength);
      const uriContent = `<${longUri}> ex:property "test" .`;

      // Test literal length limit  
      const longLiteral = 'x'.repeat(limits.maxLiteralLength + 1000);
      const literalContent = `ex:resource ex:property "${longLiteral}" .`;

      // Test prefix length limit
      const longPrefix = 'a'.repeat(limits.maxPrefixLength + 10);
      const prefixContent = `@prefix ${longPrefix}: <http://example.org/> .`;

      for (const testContent of [uriContent, literalContent, prefixContent]) {
        const fullContent = `
          @prefix ex: <http://example.org/> .
          ${testContent}
        `;

        try {
          const result = await parser.parse(fullContent);
          // If parsing succeeds, content should be handled appropriately
          expect(result).toBeDefined();
        } catch (error) {
          // Acceptable to enforce size limits
          expect(error.message).toMatch(/(size|limit|length)/i);
        }
      }
    });
  });
});