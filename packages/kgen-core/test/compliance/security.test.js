/**
 * KGEN Security and Compliance Tests
 * Comprehensive testing for security measures and regulatory compliance
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KGenEngine } from '../../src/kgen/core/engine.js';
import { TestHelpers } from '../utils/test-helpers.js';
import crypto from 'crypto';

describe('KGEN Security and Compliance', () => {
  let engine;
  let testHelpers;
  let securityTestConfig;

  beforeEach(async () => {
    testHelpers = new TestHelpers();
    
    securityTestConfig = {
      mode: 'test',
      security: {
        enableEncryption: true,
        auditLevel: 'FULL',
        complianceMode: 'STRICT',
        authenticationRequired: true,
        encryptionKey: crypto.randomBytes(32).toString('hex')
      },
      provenance: {
        enableAuditing: true,
        complianceFrameworks: ['GDPR', 'SOX', 'HIPAA']
      }
    };
    
    engine = new KGenEngine(securityTestConfig);
    await engine.initialize();
  });

  afterEach(async () => {
    if (engine && engine.state !== 'shutdown') {
      await engine.shutdown();
    }
    await testHelpers.cleanup();
  });

  describe('Authentication and Authorization', () => {
    it('should require valid user authentication', async () => {
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', 'Test User'),
          format: 'turtle'
        }
      ];

      // Test without user - should fail
      await expect(engine.ingest(sources, {}))
        .rejects.toThrow(/authorization/i);

      // Test with invalid user - should fail
      await expect(engine.ingest(sources, { user: null }))
        .rejects.toThrow(/authorization/i);
      
      // Test with valid user - should succeed
      const result = await engine.ingest(sources, { 
        user: { 
          id: 'test-user', 
          permissions: ['ingest'], 
          authenticated: true 
        } 
      });
      
      expect(result).toBeDefined();
      expect(result.entities).toBeDefined();
    });

    it('should enforce role-based access control', async () => {
      const readOnlyUser = {
        id: 'readonly-user',
        permissions: ['query'],
        role: 'reader',
        authenticated: true
      };

      const adminUser = {
        id: 'admin-user',
        permissions: ['ingest', 'query', 'generate', 'reason', 'validate'],
        role: 'admin',
        authenticated: true
      };

      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', 'RBAC Test'),
          format: 'turtle'
        }
      ];

      // Read-only user should not be able to ingest
      await expect(engine.ingest(sources, { user: readOnlyUser }))
        .rejects.toThrow(/permission/i);

      // Admin user should be able to ingest
      const result = await engine.ingest(sources, { user: adminUser });
      expect(result).toBeDefined();

      // Read-only user should be able to query
      const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1';
      const queryResult = await engine.query(query, { user: readOnlyUser });
      expect(queryResult).toBeDefined();
    });

    it('should validate user permissions for each operation', async () => {
      const limitedUser = {
        id: 'limited-user',
        permissions: ['query'], // Only query permission
        authenticated: true
      };

      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', 'Permission Test'),
          format: 'turtle'
        }
      ];

      // Should fail for operations without permission
      await expect(engine.ingest(sources, { user: limitedUser }))
        .rejects.toThrow(/permission/i);

      await expect(engine.reason({}, [], { user: limitedUser }))
        .rejects.toThrow(/permission/i);

      await expect(engine.generate({}, [], { user: limitedUser }))
        .rejects.toThrow(/permission/i);

      await expect(engine.validate({}, [], { user: limitedUser }))
        .rejects.toThrow(/permission/i);
    });
  });

  describe('Data Encryption and Protection', () => {
    it('should encrypt sensitive data at rest', async () => {
      const sensitiveData = {
        personalInfo: {
          ssn: '123-45-6789',
          creditCard: '4111-1111-1111-1111',
          email: 'sensitive@example.com'
        }
      };

      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', 'Sensitive User', sensitiveData),
          format: 'turtle'
        }
      ];

      const user = {
        id: 'test-user',
        permissions: ['ingest'],
        authenticated: true
      };

      const result = await engine.ingest(sources, { user });
      
      // Verify that sensitive data is encrypted in storage
      const storedEntity = result.entities[0];
      
      // SSN and credit card should be hashed/encrypted, not stored in plain text
      const entityStr = JSON.stringify(storedEntity);
      expect(entityStr).not.toContain('123-45-6789');
      expect(entityStr).not.toContain('4111-1111-1111-1111');
      
      // Should contain encrypted/hashed versions instead
      expect(storedEntity.properties.ssnHash).toBeDefined();
      expect(storedEntity.properties.creditCardHash).toBeDefined();
    });

    it('should encrypt data in transit', async () => {
      const user = {
        id: 'test-user',
        permissions: ['query'],
        authenticated: true
      };

      // Mock network transport
      const originalFetch = global.fetch;
      let capturedData = null;
      
      global.fetch = vi.fn(async (url, options) => {
        capturedData = options.body;
        return { ok: true, json: async () => ({}) };
      });

      try {
        const query = 'SELECT * WHERE { ?s ?p ?o }';
        await engine.query(query, { 
          user, 
          transport: 'network',
          endpoint: 'https://example.com/sparql'
        });

        // Verify data was encrypted before transmission
        expect(capturedData).toBeDefined();
        expect(capturedData).not.toContain(query); // Original query should not be visible
        
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should implement secure key management', async () => {
      const securityManager = engine.getSubsystem('security');
      
      // Test key rotation
      const originalKey = securityManager.getCurrentEncryptionKey();
      await securityManager.rotateEncryptionKey();
      const newKey = securityManager.getCurrentEncryptionKey();
      
      expect(newKey).not.toBe(originalKey);
      expect(newKey).toHaveLength(64); // 32 bytes = 64 hex chars
      
      // Test key derivation
      const derivedKey = await securityManager.deriveKey('test-purpose', 'salt123');
      expect(derivedKey).toBeDefined();
      expect(derivedKey).toHaveLength(64);
      
      // Same inputs should produce same key
      const derivedKey2 = await securityManager.deriveKey('test-purpose', 'salt123');
      expect(derivedKey2).toBe(derivedKey);
    });
  });

  describe('Audit Trail and Logging', () => {
    it('should maintain comprehensive audit logs', async () => {
      const user = {
        id: 'audit-test-user',
        permissions: ['ingest', 'query'],
        authenticated: true,
        sessionId: 'test-session-123'
      };

      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', 'Audit Test'),
          format: 'turtle'
        }
      ];

      // Perform operations
      await engine.ingest(sources, { user });
      await engine.query('SELECT * WHERE { ?s ?p ?o } LIMIT 1', { user });

      const provenanceTracker = engine.getSubsystem('provenance');
      const auditLogs = await provenanceTracker.getAuditLogs({
        userId: user.id,
        timeRange: { start: new Date(Date.now() - 60000), end: new Date() }
      });

      expect(auditLogs).toBeDefined();
      expect(auditLogs.length).toBeGreaterThanOrEqual(2); // At least ingest and query operations

      // Verify audit log completeness
      const ingestLog = auditLogs.find(log => log.operation === 'ingest');
      expect(ingestLog).toBeDefined();
      expect(ingestLog.userId).toBe(user.id);
      expect(ingestLog.sessionId).toBe(user.sessionId);
      expect(ingestLog.timestamp).toBeDefined();
      expect(ingestLog.inputHash).toBeDefined();
      expect(ingestLog.outputHash).toBeDefined();
    });

    it('should detect and log security violations', async () => {
      const maliciousUser = {
        id: 'malicious-user',
        permissions: ['query'],
        authenticated: true
      };

      // Attempt unauthorized operation
      try {
        await engine.ingest([], { user: maliciousUser });
      } catch (error) {
        // Expected to fail
      }

      // Attempt SQL injection-like attack in query
      try {
        await engine.query('DROP TABLE users; SELECT * WHERE { ?s ?p ?o }', { user: maliciousUser });
      } catch (error) {
        // Expected to fail
      }

      const securityManager = engine.getSubsystem('security');
      const violations = await securityManager.getSecurityViolations({
        userId: maliciousUser.id,
        timeRange: { start: new Date(Date.now() - 60000), end: new Date() }
      });

      expect(violations).toBeDefined();
      expect(violations.length).toBeGreaterThan(0);

      const unauthorizedAccess = violations.find(v => v.type === 'unauthorized_access');
      expect(unauthorizedAccess).toBeDefined();
      expect(unauthorizedAccess.severity).toBe('high');
    });

    it('should implement tamper-proof logging', async () => {
      const user = {
        id: 'tamper-test-user',
        permissions: ['ingest'],
        authenticated: true
      };

      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', 'Tamper Test'),
          format: 'turtle'
        }
      ];

      await engine.ingest(sources, { user });

      const provenanceTracker = engine.getSubsystem('provenance');
      const auditLogs = await provenanceTracker.getAuditLogs({ userId: user.id });

      // Verify digital signatures on audit logs
      for (const log of auditLogs) {
        expect(log.signature).toBeDefined();
        
        const isValid = await provenanceTracker.verifyLogSignature(log);
        expect(isValid).toBe(true);
      }

      // Test tamper detection
      const tamperingDetected = await provenanceTracker.detectTampering();
      expect(tamperingDetected).toBe(false);
    });
  });

  describe('GDPR Compliance', () => {
    it('should support data subject rights', async () => {
      const user = {
        id: 'gdpr-test-user',
        permissions: ['ingest'],
        authenticated: true
      };

      const personalData = {
        name: 'John GDPR Test',
        email: 'john@gdprtest.com',
        personalId: 'EU123456789'
      };

      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', 'GDPR Subject', personalData),
          format: 'turtle'
        }
      ];

      await engine.ingest(sources, { 
        user,
        gdprMetadata: {
          dataSubjectId: 'gdpr-subject-123',
          legalBasis: 'consent',
          consentId: 'consent-abc-456',
          processingPurpose: 'testing'
        }
      });

      const securityManager = engine.getSubsystem('security');

      // Test right to access
      const personalDataExport = await securityManager.exportPersonalData('gdpr-subject-123');
      expect(personalDataExport).toBeDefined();
      expect(personalDataExport.data).toBeDefined();
      expect(personalDataExport.legalBasis).toBe('consent');

      // Test right to rectification
      await securityManager.rectifyPersonalData('gdpr-subject-123', {
        email: 'corrected@gdprtest.com'
      });

      // Test right to erasure
      const erasureResult = await securityManager.erasePersonalData('gdpr-subject-123');
      expect(erasureResult.success).toBe(true);
      expect(erasureResult.itemsErased).toBeGreaterThan(0);

      // Verify data is actually erased
      const postErasureExport = await securityManager.exportPersonalData('gdpr-subject-123');
      expect(postErasureExport.data).toHaveLength(0);
    });

    it('should enforce data retention policies', async () => {
      const user = {
        id: 'retention-test-user',
        permissions: ['ingest'],
        authenticated: true
      };

      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', 'Retention Test'),
          format: 'turtle'
        }
      ];

      await engine.ingest(sources, { 
        user,
        retentionPolicy: {
          dataCategory: 'personal',
          retentionPeriod: '6years',
          autoDelete: true
        }
      });

      const securityManager = engine.getSubsystem('security');
      
      // Check retention metadata
      const retentionInfo = await securityManager.getRetentionInfo('personal');
      expect(retentionInfo).toBeDefined();
      expect(retentionInfo.retentionPeriod).toBe('6years');
      expect(retentionInfo.autoDelete).toBe(true);

      // Test retention violation detection
      const violations = await securityManager.checkRetentionViolations();
      expect(violations).toBeDefined();
      // Should be empty for fresh data
      expect(violations.length).toBe(0);
    });

    it('should provide consent management', async () => {
      const user = {
        id: 'consent-test-user',
        permissions: ['ingest'],
        authenticated: true
      };

      const securityManager = engine.getSubsystem('security');

      // Record consent
      const consentRecord = await securityManager.recordConsent({
        dataSubjectId: 'subject-123',
        processingPurpose: 'knowledge_graph_generation',
        consentType: 'explicit',
        consentDate: new Date(),
        consentMethod: 'web_form',
        withdrawalMethod: 'email'
      });

      expect(consentRecord.consentId).toBeDefined();

      // Verify consent
      const isConsentValid = await securityManager.verifyConsent('subject-123', 'knowledge_graph_generation');
      expect(isConsentValid).toBe(true);

      // Withdraw consent
      await securityManager.withdrawConsent(consentRecord.consentId);

      // Verify consent is withdrawn
      const isConsentValidAfterWithdrawal = await securityManager.verifyConsent('subject-123', 'knowledge_graph_generation');
      expect(isConsentValidAfterWithdrawal).toBe(false);
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should prevent RDF injection attacks', async () => {
      const user = {
        id: 'injection-test-user',
        permissions: ['ingest'],
        authenticated: true
      };

      // Malicious RDF content with injection attempt
      const maliciousRDF = `
        @prefix ex: <http://example.org/> .
        ex:person1 a ex:Person ;
          ex:hasName "Normal User" .
        
        # Injection attempt
        ex:malicious a ex:Administrator ;
          ex:hasPassword "admin123" ;
          ex:hasPermissions "ALL" .
      `;

      const sources = [
        {
          type: 'rdf',
          content: maliciousRDF,
          format: 'turtle'
        }
      ];

      // Should sanitize or reject malicious content
      const result = await engine.ingest(sources, { user });
      
      // Verify no administrative entities were created
      const adminEntities = result.entities.filter(e => e.type === 'Administrator');
      expect(adminEntities).toHaveLength(0);

      // Verify sensitive properties were filtered
      const hasPasswordProperty = result.entities.some(e => 
        e.properties && ('password' in e.properties || 'hasPassword' in e.properties)
      );
      expect(hasPasswordProperty).toBe(false);
    });

    it('should validate SPARQL query safety', async () => {
      const user = {
        id: 'query-safety-user',
        permissions: ['query'],
        authenticated: true
      };

      // Malicious queries that should be blocked
      const maliciousQueries = [
        'DELETE WHERE { ?s ?p ?o }', // Deletion attempt
        'INSERT { <http://evil.com/admin> a <http://evil.com/Admin> } WHERE { }', // Insertion attempt
        'SELECT * WHERE { ?s ?p ?o } LIMIT 999999999', // Resource exhaustion
        'SELECT * WHERE { ?s ?p ?o . ?s ?p2 ?o2 . ?s ?p3 ?o3 . ?s ?p4 ?o4 }' // Complex query for DoS
      ];

      for (const maliciousQuery of maliciousQueries) {
        await expect(engine.query(maliciousQuery, { user }))
          .rejects.toThrow(/security|validation|unsafe/i);
      }

      // Safe query should work
      const safeQuery = 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10';
      const result = await engine.query(safeQuery, { user });
      expect(result).toBeDefined();
    });

    it('should sanitize template inputs', async () => {
      const user = {
        id: 'template-safety-user',
        permissions: ['generate'],
        authenticated: true
      };

      const knowledgeGraph = testHelpers.createKnowledgeGraph([
        {
          id: 'entity:1',
          type: 'Person',
          properties: {
            name: '<script>alert("XSS")</script>',
            email: 'test@example.com'
          }
        }
      ]);

      const templates = [
        {
          id: 'unsafe-template',
          type: 'html',
          language: 'html',
          template: '<div>{{ entity.name }}</div>' // Potentially unsafe
        }
      ];

      const result = await engine.generate(knowledgeGraph, templates, { user });
      
      // Verify XSS content was sanitized
      const generatedContent = result[0].content;
      expect(generatedContent).not.toContain('<script>');
      expect(generatedContent).not.toContain('alert(');
      expect(generatedContent).toContain('&lt;script&gt;'); // Should be escaped
    });
  });

  describe('Compliance Reporting', () => {
    it('should generate compliance reports', async () => {
      const user = {
        id: 'compliance-report-user',
        permissions: ['ingest', 'query'],
        authenticated: true
      };

      // Perform various operations to generate audit trail
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', 'Compliance Test'),
          format: 'turtle'
        }
      ];

      await engine.ingest(sources, { user });
      await engine.query('SELECT * WHERE { ?s ?p ?o } LIMIT 5', { user });

      const securityManager = engine.getSubsystem('security');
      
      // Generate GDPR compliance report
      const gdprReport = await securityManager.generateComplianceReport('GDPR', {
        timeRange: { start: new Date(Date.now() - 3600000), end: new Date() }
      });

      expect(gdprReport).toBeDefined();
      expect(gdprReport.framework).toBe('GDPR');
      expect(gdprReport.complianceScore).toBeDefined();
      expect(gdprReport.violations).toBeDefined();
      expect(gdprReport.recommendations).toBeDefined();

      // Generate SOX compliance report
      const soxReport = await securityManager.generateComplianceReport('SOX', {
        timeRange: { start: new Date(Date.now() - 3600000), end: new Date() }
      });

      expect(soxReport).toBeDefined();
      expect(soxReport.framework).toBe('SOX');
      expect(soxReport.auditTrail).toBeDefined();
      expect(soxReport.controlsAssessment).toBeDefined();
    });

    it('should track compliance metrics over time', async () => {
      const securityManager = engine.getSubsystem('security');
      
      const metrics = await securityManager.getComplianceMetrics({
        timeRange: { start: new Date(Date.now() - 86400000), end: new Date() }, // Last 24 hours
        frameworks: ['GDPR', 'SOX', 'HIPAA']
      });

      expect(metrics).toBeDefined();
      expect(metrics.gdpr).toBeDefined();
      expect(metrics.sox).toBeDefined();
      expect(metrics.hipaa).toBeDefined();

      // Verify metric structure
      expect(metrics.gdpr.complianceScore).toBeGreaterThanOrEqual(0);
      expect(metrics.gdpr.complianceScore).toBeLessThanOrEqual(1);
      expect(metrics.gdpr.dataProcessingEvents).toBeDefined();
      expect(metrics.gdpr.consentEvents).toBeDefined();
    });
  });

  describe('Security Monitoring and Alerting', () => {
    it('should detect suspicious activity patterns', async () => {
      const user = {
        id: 'suspicious-user',
        permissions: ['query'],
        authenticated: true
      };

      // Simulate suspicious behavior
      const queries = [
        'SELECT * WHERE { ?s ?p ?o } LIMIT 1000',
        'SELECT * WHERE { ?s a ?type }',
        'SELECT * WHERE { ?s ?p ?sensitive }',
        'SELECT * WHERE { ?person ?hasPassword ?pwd }',
        'SELECT * WHERE { ?admin ?hasRole ?role }'
      ];

      // Execute multiple queries rapidly
      for (const query of queries) {
        try {
          await engine.query(query, { user });
        } catch (error) {
          // Some queries may fail validation, which is expected
        }
      }

      const securityManager = engine.getSubsystem('security');
      const suspiciousActivities = await securityManager.detectSuspiciousActivity({
        userId: user.id,
        timeWindow: 300000 // 5 minutes
      });

      expect(suspiciousActivities).toBeDefined();
      expect(suspiciousActivities.length).toBeGreaterThan(0);

      const rapidQueries = suspiciousActivities.find(a => a.type === 'rapid_queries');
      expect(rapidQueries).toBeDefined();
      expect(rapidQueries.severity).toBeGreaterThan(0);
    });

    it('should implement rate limiting', async () => {
      const user = {
        id: 'rate-limit-user',
        permissions: ['query'],
        authenticated: true
      };

      const securityManager = engine.getSubsystem('security');
      
      // Configure rate limiting
      await securityManager.setRateLimit(user.id, {
        maxRequestsPerMinute: 5,
        maxRequestsPerHour: 50
      });

      const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1';
      let successCount = 0;
      let rateLimitHit = false;

      // Try to exceed rate limit
      for (let i = 0; i < 10; i++) {
        try {
          await engine.query(query, { user });
          successCount++;
        } catch (error) {
          if (error.message.includes('rate limit')) {
            rateLimitHit = true;
            break;
          }
        }
      }

      expect(rateLimitHit).toBe(true);
      expect(successCount).toBeLessThanOrEqual(5);
    });

    it('should send security alerts', async () => {
      const securityManager = engine.getSubsystem('security');
      let alertReceived = null;

      // Mock alert handler
      securityManager.on('security-alert', (alert) => {
        alertReceived = alert;
      });

      // Trigger security violation
      const maliciousUser = {
        id: 'alert-test-user',
        permissions: [],
        authenticated: false
      };

      try {
        await engine.ingest([], { user: maliciousUser });
      } catch (error) {
        // Expected to fail
      }

      // Wait for alert processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(alertReceived).toBeDefined();
      expect(alertReceived.type).toBe('unauthorized_access');
      expect(alertReceived.severity).toBe('high');
      expect(alertReceived.userId).toBe(maliciousUser.id);
    });
  });
});