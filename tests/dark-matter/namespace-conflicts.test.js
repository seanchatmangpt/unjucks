import { describe, it, expect, beforeEach } from 'vitest';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { SemanticTemplateProcessor } from '../../src/lib/semantic-template-processor.js';

/**
 * DARK MATTER VALIDATION: Namespace Conflicts and Prefix Collisions
 * 
 * Tests the critical namespace resolution edge cases that cause data corruption,
 * URI resolution failures, and semantic ambiguity in RDF applications.
 * These conflicts are responsible for subtle but devastating production bugs.
 */
describe('Dark Matter: Namespace Conflicts', () => {
  let parser;
  let processor;

  beforeEach(() => {
    parser = new TurtleParser({ baseIRI: 'http://example.org/' });
    processor = new SemanticTemplateProcessor();
  });

  describe('Prefix Collision Hell', () => {
    it('should handle identical prefixes with different namespaces', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        ex:resource1 ex:property "first definition" .
        
        # Redefine the same prefix to a different namespace
        @prefix ex: <http://different.org/> .
        ex:resource2 ex:property "second definition" .
        
        # Use both resources - should resolve to their respective namespaces
        ex:resource1 ex:relatesTo ex:resource2 .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(3);

      // Verify that the last prefix definition wins
      const resource1Triples = result.triples.filter(t => 
        t.subject.value.includes('resource1')
      );
      const resource2Triples = result.triples.filter(t => 
        t.subject.value.includes('resource2')
      );

      // resource1 should resolve with the namespace active when it was defined
      // resource2 should resolve with the redefined namespace
      expect(resource1Triples.length).toBe(2); // original property + relates to
      expect(resource2Triples.length).toBe(1); // just the property

      // Check that different namespaces are actually used
      const subjects = result.triples.map(t => t.subject.value);
      const uniqueNamespaces = new Set(subjects.map(s => s.substring(0, s.lastIndexOf('/') + 1)));
      expect(uniqueNamespaces.size).toBeGreaterThan(1); // Should have different namespaces
    });

    it('should handle case-sensitive prefix conflicts', async () => {
      const content = `
        @prefix ex: <http://example.org/lower/> .
        @prefix Ex: <http://example.org/upper/> .
        @prefix EX: <http://example.org/caps/> .
        @prefix eX: <http://example.org/mixed/> .
        
        ex:lowerCase ex:property "lowercase" .
        Ex:upperCase Ex:property "uppercase" .
        EX:allCaps EX:property "allcaps" .
        eX:mixedCase eX:property "mixed" .
        
        # Cross-prefix references to test resolution
        ex:lowerCase ex:relatesTo Ex:upperCase, EX:allCaps, eX:mixedCase .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(7); // 4 property triples + 3 relatesTo triples

      const subjects = result.triples.map(t => t.subject.value);
      
      // Verify all different case variants resolve to different namespaces
      expect(subjects.some(s => s.includes('/lower/'))).toBe(true);
      expect(subjects.some(s => s.includes('/upper/'))).toBe(true);
      expect(subjects.some(s => s.includes('/caps/'))).toBe(true);
      expect(subjects.some(s => s.includes('/mixed/'))).toBe(true);
      
      // Should have 4 different namespace bases
      const namespaces = subjects.map(s => s.substring(0, s.lastIndexOf('/') + 1));
      const uniqueNamespaces = new Set(namespaces);
      expect(uniqueNamespaces.size).toBe(4);
    });

    it('should handle empty and default namespace conflicts', async () => {
      const content = `
        # Define empty prefix
        @prefix : <http://default.example.org/> .
        @prefix empty: <http://empty.example.org/> .
        
        # Use default namespace
        :defaultResource :property "default value" .
        
        # Use empty prefix
        empty:emptyResource empty:property "empty value" .
        
        # Redefine default namespace
        @prefix : <http://redefined.example.org/> .
        :redefinedResource :property "redefined value" .
        
        # Reference between namespaces
        :redefinedResource :references empty:emptyResource .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(4);

      const subjects = result.triples.map(t => t.subject.value);
      
      // Verify different default namespace resolutions
      expect(subjects.some(s => s.includes('default.example.org'))).toBe(true);
      expect(subjects.some(s => s.includes('empty.example.org'))).toBe(true);
      expect(subjects.some(s => s.includes('redefined.example.org'))).toBe(true);
    });

    it('should handle prefix conflicts with reserved/standard namespaces', async () => {
      const content = `
        # Override standard RDF namespace (dangerous!)
        @prefix rdf: <http://malicious.example.org/rdf/> .
        @prefix rdfs: <http://malicious.example.org/rdfs/> .
        @prefix owl: <http://malicious.example.org/owl/> .
        @prefix xsd: <http://malicious.example.org/xsd/> .
        
        # Use the "standard" prefixes with malicious namespaces
        rdf:resource rdf:type "MaliciousType" .
        rdfs:Class rdfs:label "Hijacked Schema" .
        owl:Class owl:sameAs "Evil Twin" .
        xsd:string xsd:pattern "Dangerous Pattern" .
        
        # Also define legitimate namespaces with different prefixes
        @prefix legitRdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        @prefix legitRdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        legitRdf:type a legitRdfs:Class .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(5);

      const subjects = result.triples.map(t => t.subject.value);
      const predicates = result.triples.map(t => t.predicate.value);
      
      // Verify malicious namespace is used for overridden prefixes
      expect(subjects.some(s => s.includes('malicious.example.org/rdf/'))).toBe(true);
      expect(subjects.some(s => s.includes('malicious.example.org/rdfs/'))).toBe(true);
      expect(subjects.some(s => s.includes('malicious.example.org/owl/'))).toBe(true);
      expect(subjects.some(s => s.includes('malicious.example.org/xsd/'))).toBe(true);
      
      // Verify legitimate namespaces work with different prefixes
      expect(predicates.some(p => p.includes('www.w3.org/1999/02/22-rdf-syntax-ns'))).toBe(true);
    });
  });

  describe('Namespace Resolution Edge Cases', () => {
    it('should handle very long namespace URIs and prefix names', async () => {
      const longNamespace = 'http://very.long.domain.name.with.many.subdomains.example.org/' + 'path/'.repeat(100) + 'final/';
      const longPrefix = 'a'.repeat(255); // Very long prefix name
      
      const content = `
        @prefix ${longPrefix}: <${longNamespace}> .
        @prefix short: <http://short.org/> .
        
        ${longPrefix}:resource ${longPrefix}:property "Long namespace value" .
        short:resource short:property "Short namespace value" .
        
        # Cross-references
        ${longPrefix}:resource ${longPrefix}:relatesTo short:resource .
        short:resource short:relatesTo ${longPrefix}:resource .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(4);

      const subjects = result.triples.map(t => t.subject.value);
      
      // Verify long namespace is properly resolved
      expect(subjects.some(s => s.includes(longNamespace))).toBe(true);
      expect(subjects.some(s => s.includes('short.org'))).toBe(true);
      
      // Verify URIs are not truncated
      const longUris = subjects.filter(s => s.includes(longNamespace));
      expect(longUris.every(uri => uri.includes('final/'))).toBe(true);
    });

    it('should handle Unicode characters in namespace URIs and prefixes', async () => {
      const content = `
        @prefix 测试: <http://测试.example.org/命名空间/> .
        @prefix café: <http://café.example.org/espace/> .
        @prefix 🚀: <http://rocket.example.org/emoji/> .
        @prefix العربية: <http://arabic.example.org/namespace/> .
        
        测试:资源 测试:属性 "测试值" .
        café:ressource café:propriété "valeur française" .
        🚀:resource 🚀:property "rocket value" .
        العربية:مورد العربية:خاصية "قيمة عربية" .
        
        # Cross-unicode references
        测试:资源 测试:关联 café:ressource .
        🚀:resource 🚀:pointsTo العربية:مورد .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(6);

      const subjects = result.triples.map(t => t.subject.value);
      
      // Verify Unicode namespace URIs are preserved
      expect(subjects.some(s => s.includes('测试.example.org'))).toBe(true);
      expect(subjects.some(s => s.includes('café.example.org'))).toBe(true);
      expect(subjects.some(s => s.includes('rocket.example.org'))).toBe(true);
      expect(subjects.some(s => s.includes('arabic.example.org'))).toBe(true);
      
      // Verify Unicode local names are preserved
      expect(subjects.some(s => s.includes('资源'))).toBe(true);
      expect(subjects.some(s => s.includes('ressource'))).toBe(true);
      expect(subjects.some(s => s.includes('مورد'))).toBe(true);
    });

    it('should handle namespace URI edge cases and malformed URIs', async () => {
      const content = `
        # Valid but unusual namespace URIs
        @prefix file: <file:///local/path/> .
        @prefix data: <data:text/plain;base64,> .
        @prefix urn: <urn:example:namespace:> .
        @prefix ftp: <ftp://ftp.example.org/namespace/> .
        
        # Edge case URIs that might cause issues
        @prefix query: <http://example.org/ns?param=value&other=data#fragment> .
        @prefix encoded: <http://example.org/%E2%9C%93/> .
        @prefix spaces: <http://example.org/path with spaces/> .
        @prefix special: <http://example.org/chars!@#$%^&*()_+-=[]{}|;:'".,<>?/> .
        
        file:resource file:property "file scheme" .
        data:resource data:property "data scheme" .
        urn:resource urn:property "urn scheme" .
        ftp:resource ftp:property "ftp scheme" .
        query:resource query:property "query namespace" .
        encoded:resource encoded:property "encoded namespace" .
        spaces:resource spaces:property "spaces namespace" .
        special:resource special:property "special chars namespace" .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(8);

      const subjects = result.triples.map(t => t.subject.value);
      
      // Verify different URI schemes work as namespaces
      expect(subjects.some(s => s.startsWith('file:///'))).toBe(true);
      expect(subjects.some(s => s.startsWith('data:'))).toBe(true);
      expect(subjects.some(s => s.startsWith('urn:'))).toBe(true);
      expect(subjects.some(s => s.startsWith('ftp://'))).toBe(true);
      
      // Verify special characters in URIs
      expect(subjects.some(s => s.includes('?param=value'))).toBe(true);
      expect(subjects.some(s => s.includes('%E2%9C%93'))).toBe(true);
      expect(subjects.some(s => s.includes('path with spaces'))).toBe(true);
      expect(subjects.some(s => s.includes('!@#$%^&*()'))).toBe(true);
    });

    it('should handle relative URI resolution edge cases', async () => {
      const parser_with_base = new TurtleParser({ baseIRI: 'http://base.example.org/path/document.ttl' });
      
      const content = `
        # Relative namespace URIs
        @prefix rel: <../relative/namespace/> .
        @prefix curr: <./current/namespace/> .
        @prefix abs: </absolute/namespace/> .
        @prefix frag: <#fragment> .
        
        # Relative references in triples
        <../relative/resource> rel:property "relative resource" .
        <./current/resource> curr:property "current resource" .
        </absolute/resource> abs:property "absolute resource" .
        <#fragment-resource> frag:property "fragment resource" .
        
        # References with query parameters and fragments
        <?query=param> rel:property "query resource" .
        <resource#section> curr:property "fragment section" .
      `;

      const result = await parser_with_base.parse(content);
      expect(result.triples.length).toBe(6);

      const subjects = result.triples.map(t => t.subject.value);
      
      // Verify relative URI resolution against base URI
      // Results depend on specific URI resolution implementation
      expect(subjects.length).toBe(6);
      expect(subjects.every(s => s.startsWith('http://'))).toBe(true);
    });
  });

  describe('Template Processing with Namespace Conflicts', () => {
    it('should handle dynamic namespace generation and conflicts', async () => {
      const namespaceData = {
        baseUrl: 'http://dynamic.example.org',
        version: 'v2',
        namespace1: 'users',
        namespace2: 'products',
        conflictingPrefix: 'data',
        
        // Data that might cause prefix conflicts
        prefixes: [
          { name: 'ex', url: 'http://example.org/' },
          { name: 'ex', url: 'http://different.example.org/' }, // Conflict!
          { name: 'test', url: 'http://test.org/' },
          { name: 'Test', url: 'http://test.org/caps/' }, // Case conflict
        ],
        
        resources: [
          { prefix: 'ex', name: 'resource1', value: 'first' },
          { prefix: 'ex', name: 'resource2', value: 'second' },
          { prefix: 'test', name: 'resource3', value: 'third' },
          { prefix: 'Test', name: 'resource4', value: 'fourth' },
        ]
      };

      const template = `
        # Dynamic namespace generation
        @prefix {{ conflictingPrefix }}: <{{ baseUrl }}/{{ version }}/{{ namespace1 }}/> .
        @prefix {{ conflictingPrefix }}: <{{ baseUrl }}/{{ version }}/{{ namespace2 }}/> .
        
        # Generate prefixes from data (potential conflicts)
        {% for prefix in prefixes %}
        @prefix {{ prefix.name }}: <{{ prefix.url }}> .
        {% endfor %}
        
        # Use the dynamically generated prefixes
        {{ conflictingPrefix }}:user1 {{ conflictingPrefix }}:name "Dynamic User" .
        
        {% for resource in resources %}
        {{ resource.prefix }}:{{ resource.name }} {{ resource.prefix }}:value "{{ resource.value }}" .
        {% endfor %}
      `;

      const result = await processor.render(template, namespaceData);
      
      // Should contain multiple @prefix declarations
      expect(result.content).toContain('@prefix data:');
      expect(result.content).toContain('@prefix ex:');
      expect(result.content).toContain('@prefix test:');
      expect(result.content).toContain('@prefix Test:');
      
      // Should handle conflicts (last definition wins)
      expect(result.content).toContain('users/');
      expect(result.content).toContain('products/');
      expect(result.content).toContain('example.org/');
      expect(result.content).toContain('different.example.org/');
      
      const parseResult = await parser.parse(result.content);
      expect(parseResult.triples.length).toBe(5); // 1 user + 4 resources
    });

    it('should prevent namespace injection attacks', async () => {
      const maliciousData = {
        userNamespace: 'http://safe.example.org/> . ex:injected "true" . @prefix evil: <http://evil.com/',
        prefixName: 'safe> . ex:backdoor "open" . @prefix hack',
        resourceName: 'normal> ; ex:compromised "yes" ; <http://evil.com/resource',
        
        // Data that might break namespace declarations
        namespaces: [
          {
            prefix: 'legitimate',
            uri: 'http://good.example.org/'
          },
          {
            prefix: 'malicious"> . ex:injection "success" . @prefix evil',
            uri: 'http://safe.example.org/'
          }
        ]
      };

      const template = `
        @prefix user: <{{ userNamespace }}> .
        @prefix {{ prefixName }}: <http://example.org/> .
        
        {% for ns in namespaces %}
        @prefix {{ ns.prefix | replace('"', '') | replace('>', '') | replace('.', '') }}: <{{ ns.uri }}> .
        {% endfor %}
        
        user:{{ resourceName | replace('>', '') | replace(';', '') | replace('<', '') }} user:property "safe value" .
      `;

      const result = await processor.render(template, maliciousData);
      
      // Should prevent injection through proper escaping
      expect(result.content).not.toContain('ex:injected "true"');
      expect(result.content).not.toContain('ex:backdoor "open"');
      expect(result.content).not.toContain('ex:compromised "yes"');
      expect(result.content).not.toContain('ex:injection "success"');
      
      // Should contain escaped/sanitized content
      expect(result.content).toContain('safe.example.org');
      expect(result.content).toContain('good.example.org');
      
      const parseResult = await parser.parse(result.content);
      expect(parseResult.triples.length).toBeLessThanOrEqual(3); // Only legitimate triples
    });

    it('should handle namespace resolution in complex template loops', async () => {
      const complexData = {
        organizations: [
          {
            name: 'ACME Corp',
            domain: 'acme.com',
            departments: [
              { name: 'Engineering', code: 'eng' },
              { name: 'Sales', code: 'sales' },
              { name: 'Marketing', code: 'mkt' }
            ]
          },
          {
            name: 'Beta LLC',
            domain: 'beta.org',
            departments: [
              { name: 'Research', code: 'research' },
              { name: 'Development', code: 'dev' }
            ]
          }
        ]
      };

      const template = `
        @prefix org: <http://organization.example.org/> .
        @prefix dept: <http://department.example.org/> .
        
        {% for organization in organizations %}
        @prefix {{ organization.name | lower | replace(' ', '') }}: <http://{{ organization.domain }}/> .
        
        {{ organization.name | lower | replace(' ', '') }}:organization org:name "{{ organization.name }}" ;
          org:domain "{{ organization.domain }}" .
        
        {% for department in organization.departments %}
        {{ organization.name | lower | replace(' ', '') }}:{{ department.code }} dept:name "{{ department.name }}" ;
          dept:belongsTo {{ organization.name | lower | replace(' ', '') }}:organization .
        {% endfor %}
        {% endfor %}
      `;

      const result = await processor.render(template, complexData);
      
      // Verify namespace declarations
      expect(result.content).toContain('@prefix acmecorp:');
      expect(result.content).toContain('@prefix betallc:');
      expect(result.content).toContain('<http://acme.com/>');
      expect(result.content).toContain('<http://beta.org/>');
      
      // Verify proper namespace usage
      expect(result.content).toContain('acmecorp:organization');
      expect(result.content).toContain('betallc:organization');
      expect(result.content).toContain('acmecorp:eng');
      expect(result.content).toContain('betallc:research');
      
      const parseResult = await parser.parse(result.content);
      expect(parseResult.triples.length).toBe(12); // 2 orgs * 2 props + 5 depts * 2 props - (3+2) depts
    });
  });

  describe('Performance with Complex Namespace Hierarchies', () => {
    it('should handle many namespace prefixes efficiently', async () => {
      const prefixCount = 1000;
      
      // Generate many unique prefixes
      const prefixes = Array.from({ length: prefixCount }, (_, i) => ({
        prefix: `ns${i}`,
        namespace: `http://namespace${i}.example.org/`
      }));

      let content = '';
      
      // Add all prefix declarations
      for (const { prefix, namespace } of prefixes) {
        content += `@prefix ${prefix}: <${namespace}> .\n`;
      }
      
      content += '\n';
      
      // Add triples using all prefixes
      for (const { prefix } of prefixes) {
        content += `${prefix}:resource ${prefix}:property "value${prefix}" .\n`;
      }

      const beforeMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();
      
      const result = await parser.parse(content);
      
      const endTime = performance.now();
      const afterMemory = process.memoryUsage().heapUsed;
      
      expect(result.triples.length).toBe(prefixCount);
      expect(result.stats.prefixCount).toBe(prefixCount);
      expect(endTime - startTime).toBeLessThan(15000); // Under 15 seconds
      expect(afterMemory - beforeMemory).toBeLessThan(200 * 1024 * 1024); // Under 200MB
      
      // Verify all prefixes are resolved correctly
      const subjects = result.triples.map(t => t.subject.value);
      const uniqueNamespaces = new Set(subjects.map(s => s.substring(0, s.lastIndexOf('/') + 1)));
      expect(uniqueNamespaces.size).toBe(prefixCount);
    });

    it('should handle deeply nested namespace hierarchies', async () => {
      const depth = 50;
      const width = 10;
      
      let content = '';
      let tripleCount = 0;
      
      // Generate hierarchical namespaces
      for (let level = 0; level < depth; level++) {
        const prefix = `level${level}`;
        const namespace = `http://example.org/${'level/'.repeat(level + 1)}`;
        content += `@prefix ${prefix}: <${namespace}> .\n`;
        
        for (let item = 0; item < width; item++) {
          content += `${prefix}:item${item} ${prefix}:level "${level}"^^<http://www.w3.org/2001/XMLSchema#integer> .\n`;
          tripleCount++;
          
          // Add cross-level references
          if (level > 0) {
            const parentPrefix = `level${level - 1}`;
            content += `${prefix}:item${item} ${prefix}:childOf ${parentPrefix}:item${item} .\n`;
            tripleCount++;
          }
        }
      }

      const beforeMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();
      
      const result = await parser.parse(content);
      
      const endTime = performance.now();
      const afterMemory = process.memoryUsage().heapUsed;
      
      expect(result.triples.length).toBe(tripleCount);
      expect(result.stats.prefixCount).toBe(depth);
      expect(endTime - startTime).toBeLessThan(10000); // Under 10 seconds
      expect(afterMemory - beforeMemory).toBeLessThan(150 * 1024 * 1024); // Under 150MB
      
      // Verify hierarchical structure
      const subjects = result.triples.map(t => t.subject.value);
      const maxDepth = Math.max(...subjects.map(s => (s.match(/level\//g) || []).length));
      expect(maxDepth).toBe(depth);
    });
  });

  describe('Namespace Validation and Security', () => {
    it('should detect suspicious namespace patterns', async () => {
      const suspiciousContent = `
        # Suspicious: Overriding well-known namespaces
        @prefix rdf: <http://malicious.example.org/fake-rdf/> .
        @prefix xsd: <http://evil.com/fake-xsd/> .
        @prefix owl: <http://attacker.net/fake-owl/> .
        
        # Suspicious: Very similar to legitimate namespaces
        @prefix w3: <http://www.w3.org.evil.com/> .
        @prefix xmlschema: <http://www.w3.org/2001/XMLSchema.fake.com/> .
        
        # Suspicious: Localhost/private IP namespaces in production
        @prefix local: <http://localhost:8080/namespace/> .
        @prefix private: <http://192.168.1.1/namespace/> .
        @prefix internal: <http://10.0.0.1/internal/> .
        
        # Suspicious: Data exfiltration namespaces
        @prefix exfil: <http://attacker.com/collect?data=> .
        
        # Legitimate namespace for comparison
        @prefix legit: <http://legitimate.example.org/> .
        
        rdf:type rdf:Property "Fake RDF" .
        w3:schema xmlschema:type "Spoofed" .
        local:resource private:property "Local data" .
        legit:resource legit:property "Safe data" .
      `;

      const result = await parser.parse(suspiciousContent);
      expect(result.triples.length).toBe(4);
      
      // Content should parse but namespaces should be preserved for security analysis
      const subjects = result.triples.map(t => t.subject.value);
      const predicates = result.triples.map(t => t.predicate.value);
      const allURIs = [...subjects, ...predicates];
      
      // Verify suspicious URIs are preserved (for security scanning)
      expect(allURIs.some(uri => uri.includes('malicious.example.org'))).toBe(true);
      expect(allURIs.some(uri => uri.includes('evil.com'))).toBe(true);
      expect(allURIs.some(uri => uri.includes('attacker.net'))).toBe(true);
      expect(allURIs.some(uri => uri.includes('w3.org.evil.com'))).toBe(true);
      expect(allURIs.some(uri => uri.includes('localhost'))).toBe(true);
      expect(allURIs.some(uri => uri.includes('192.168.1.1'))).toBe(true);
      expect(allURIs.some(uri => uri.includes('10.0.0.1'))).toBe(true);
      
      // Should also have legitimate namespace
      expect(allURIs.some(uri => uri.includes('legitimate.example.org'))).toBe(true);
    });

    it('should handle namespace collision attacks', async () => {
      const collisionContent = `
        # Normal namespaces
        @prefix user: <http://safe.example.org/user/> .
        @prefix admin: <http://safe.example.org/admin/> .
        
        user:alice user:role "user" .
        admin:bob admin:role "admin" .
        
        # Attempt to create collision by redefining user prefix
        @prefix user: <http://safe.example.org/admin/> .
        
        # This should now resolve to admin namespace
        user:charlie user:role "elevated" .
        
        # Verify original alice still exists with old namespace
        <http://safe.example.org/user/alice> user:verified "true" .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(4);
      
      const subjects = result.triples.map(t => t.subject.value);
      
      // Should have both user and admin namespace URIs
      expect(subjects.some(s => s.includes('/user/'))).toBe(true);
      expect(subjects.some(s => s.includes('/admin/'))).toBe(true);
      
      // Charlie should resolve to admin namespace due to prefix redefinition
      const charlieTriple = result.triples.find(t => t.subject.value.includes('charlie'));
      expect(charlieTriple.subject.value).toContain('/admin/');
      
      // Alice with full URI should be preserved
      expect(subjects.some(s => s === 'http://safe.example.org/user/alice')).toBe(true);
    });
  });
});