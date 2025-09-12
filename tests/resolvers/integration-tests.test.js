/**
 * Integration Test Suite for URI Resolvers
 * 
 * Tests cross-resolver integration, Git operations, and OPC normalization
 * Validates end-to-end workflows and real-world scenarios
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { tmpdir } from 'os';

// Import all resolver classes
import { ContentUriResolver } from '../../src/kgen/cas/content-uri-resolver.js';
import { GitUriResolver } from '../../packages/kgen-core/src/resolvers/git-uri-resolver.js';
import { AttestResolver } from '../../src/kgen/attestation/attest-resolver.js';
import { DriftURIResolver } from '../../src/kgen/drift/drift-uri-resolver.js';
import { PolicyURIResolver } from '../../src/kgen/validation/policy-resolver.js';

describe('Integration Tests', () => {
  let testDir;
  let resolvers;
  let testRepo;
  
  beforeEach(async () => {
    testDir = path.join(tmpdir(), 'integration-test-' + this.getDeterministicTimestamp());
    await fs.ensureDir(testDir);
    
    // Create test git repository structure
    testRepo = path.join(testDir, 'test-repo');
    await fs.ensureDir(testRepo);
    await fs.writeFile(path.join(testRepo, '.gitignore'), 'node_modules/\n*.tmp\n');
    
    resolvers = {
      content: new ContentUriResolver({
        casDir: path.join(testDir, 'cas'),
        enableHardlinks: true,
        enableExtensionPreservation: true,
        enableDriftDetection: true,
        integrityChecks: true
      }),
      git: new GitUriResolver({
        cacheDir: path.join(testDir, 'git-cache'),
        enableAttestation: true,
        allowRemoteRepos: false
      }),
      attest: new AttestResolver({
        storageDir: path.join(testDir, 'attest'),
        verificationEnabled: true
      }),
      drift: new DriftURIResolver({
        storage: {
          patchDirectory: path.join(testDir, 'patches')
        }
      }),
      policy: new PolicyURIResolver({
        shapesPath: path.join(testDir, 'shapes'),
        auditPath: path.join(testDir, 'audit'),
        enableVerdictTracking: true
      })
    };
    
    // Initialize all resolvers
    for (const resolver of Object.values(resolvers)) {
      try {
        await resolver.initialize();
      } catch (error) {
        console.warn('Resolver integration init warning:', error.message);
      }
    }
    
    // Create test SHACL shapes for policy testing
    await fs.ensureDir(path.join(testDir, 'shapes'));
    await fs.writeFile(
      path.join(testDir, 'shapes', 'test-shapes.ttl'),
      `@prefix sh: <http://www.w3.org/ns/shacl#> .
       @prefix kgen: <https://kgen.io/ontology#> .
       
       kgen:TemplateSecurityShape a sh:NodeShape ;
         sh:targetClass kgen:NunjucksTemplate ;
         sh:property [
           sh:path kgen:hasContent ;
           sh:minCount 1 ;
           sh:datatype xsd:string ;
         ] .`
    );
  });
  
  afterEach(async () => {
    if (testDir && await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });

  describe('Content and Attestation Integration', () => {
    test('should create content-addressed artifacts with attestations', async () => {
      const artifactContent = JSON.stringify({
        type: 'Component',
        name: 'UserCard',
        props: ['name', 'email', 'avatar'],
        generated: this.getDeterministicDate().toISOString()
      }, null, 2);
      
      // Store artifact in CAS
      const contentResult = await resolvers.content.store(artifactContent, {
        extension: '.json',
        metadata: {
          type: 'react-component',
          generator: 'integration-test'
        }
      });
      
      expect(contentResult.uri).toMatch(/^content:\/\/sha256\//);
      expect(contentResult.path).toMatch(/\.json$/);
      
      // Create attestation for the artifact
      const attestationData = {
        subject: contentResult.uri,
        contentHash: contentResult.hash,
        validator: 'integration-test-suite',
        claims: {
          'urn:kgen:content-integrity': true,
          'urn:kgen:react-component': true,
          'urn:kgen:generated-artifact': true
        },
        evidence: {
          generator: 'integration-test',
          timestamp: this.getDeterministicDate().toISOString(),
          method: 'deterministic-generation'
        }
      };
      
      const attestation = await resolvers.attest.createAttestation(attestationData, {
        issuer: 'integration-authority',
        contentType: 'application/json'
      });
      
      const attestationUri = await resolvers.attest.store(attestation);
      
      expect(attestationUri).toMatch(/^attest:\/\/sha256\//);
      expect(attestation.subject).toBe(contentResult.uri);
      
      // Verify attestation can be resolved and points to correct content
      const resolvedAttestation = await resolvers.attest.resolve(attestationUri);
      expect(resolvedAttestation.attestation.subject).toBe(contentResult.uri);
      
      // Verify content can still be resolved
      const resolvedContent = await resolvers.content.resolve(contentResult.uri);
      expect(resolvedContent.hash).toBe(contentResult.hash);
      
      // Create relationship record
      const relationship = {
        artifact: contentResult.uri,
        attestation: attestationUri,
        relationship: 'attests-to',
        created: this.getDeterministicDate().toISOString()
      };
      
      expect(relationship.artifact).toMatch(/^content:\/\//);
      expect(relationship.attestation).toMatch(/^attest:\/\//);
    });

    test('should track artifact evolution with drift and attestation', async () => {
      // Create initial version
      const v1Artifact = {
        component: 'LoginForm',
        version: '1.0.0',
        fields: ['username', 'password'],
        validation: ['required', 'minLength']
      };
      
      const v1Result = await resolvers.content.store(JSON.stringify(v1Artifact));
      
      // Create attestation for v1
      const v1Attestation = await resolvers.attest.createAttestation({
        subject: v1Result.uri,
        version: '1.0.0',
        validator: 'code-review-bot'
      });
      const v1AttestUri = await resolvers.attest.store(v1Attestation);
      
      // Create updated version
      const v2Artifact = {
        ...v1Artifact,
        version: '2.0.0',
        fields: ['username', 'password', 'rememberMe'],
        validation: ['required', 'minLength', 'email']
      };
      
      const v2Result = await resolvers.content.store(JSON.stringify(v2Artifact));
      
      // Create drift patch between versions
      const driftResult = await resolvers.drift.storePatch(v1Artifact, v2Artifact, {
        source: 'version-upgrade',
        metadata: {
          from: '1.0.0',
          to: '2.0.0',
          breaking: false
        }
      });
      
      expect(driftResult.uri).toMatch(/^drift:\/\//);
      expect(driftResult.metadata.semantic.significance).toBeGreaterThan(0.1);
      
      // Create attestation for v2
      const v2Attestation = await resolvers.attest.createAttestation({
        subject: v2Result.uri,
        version: '2.0.0',
        validator: 'code-review-bot',
        predecessor: v1AttestUri,
        driftPatch: driftResult.uri
      });
      const v2AttestUri = await resolvers.attest.store(v2Attestation);
      
      // Verify the evolution chain
      const resolvedV2Attestation = await resolvers.attest.resolve(v2AttestUri);
      expect(resolvedV2Attestation.attestation.predecessor).toBe(v1AttestUri);
      expect(resolvedV2Attestation.attestation.driftPatch).toBe(driftResult.uri);
      
      // Apply drift patch to verify consistency
      const patchApplyResult = await resolvers.drift.applyPatch(v1Artifact, driftResult.uri);
      expect(patchApplyResult.result).toEqual(v2Artifact);
    });
  });

  describe('Git Operations Integration', () => {
    test('should handle git URI resolution with mocked operations', async () => {
      const testOid = 'a'.repeat(40);
      const testContent = 'console.log("Hello from Git URI");';
      
      // Mock git operations
      const mockGitOps = {
        createBlob: vi.fn().mockResolvedValue({
          sha: testOid,
          content: testContent
        }),
        readBlob: vi.fn().mockResolvedValue({
          content: testContent,
          size: testContent.length
        }),
        storeProvenance: vi.fn().mockResolvedValue({
          success: true,
          notesRef: 'refs/notes/kgen-provenance'
        }),
        getProvenance: vi.fn().mockResolvedValue({
          provenance: {
            generator: 'test-suite',
            timestamp: this.getDeterministicDate().toISOString()
          },
          notesRef: 'refs/notes/kgen-provenance'
        })
      };
      
      resolvers.git.gitOps = mockGitOps;
      
      // Test URI creation and validation
      const gitUri = resolvers.git.createGitUri('test-repo', testOid, 'src/main.js');
      expect(gitUri).toBe(`git://test-repo@${testOid}/src/main.js`);
      
      const validation = resolvers.git.validateGitUri(gitUri);
      expect(validation.valid).toBe(true);
      expect(validation.parsed.type).toBe('file');
      
      // Test attestation attachment
      const attestationData = {
        type: 'GitCommitAttestation',
        commitSha: testOid,
        reviewer: 'integration-test',
        status: 'approved'
      };
      
      const attachResult = await resolvers.git.attachAttestation(testOid, attestationData);
      expect(attachResult.success).toBe(true);
      expect(mockGitOps.storeProvenance).toHaveBeenCalledWith(testOid, expect.objectContaining({
        '@type': 'Attestation',
        objectSha: testOid
      }));
      
      // Test attestation retrieval
      const retrieveResult = await resolvers.git.getAttestations(testOid);
      expect(retrieveResult.found).toBe(true);
      expect(mockGitOps.getProvenance).toHaveBeenCalledWith(testOid);
    });

    test('should integrate git URIs with content addressing', async () => {
      const templateContent = `
        <template>
          <div class="user-card">
            <h3>{{ user.name }}</h3>
            <p>{{ user.email }}</p>
            {% if user.avatar %}
            <img src="{{ user.avatar }}" alt="Avatar" />
            {% endif %}
          </div>
        </template>
      `.trim();
      
      // Store template in CAS
      const contentResult = await resolvers.content.store(templateContent, {
        extension: '.njk',
        metadata: {
          type: 'nunjucks-template',
          component: 'user-card'
        }
      });
      
      // Create git URI pointing to the same content
      const gitUri = resolvers.git.createGitUri(
        'template-repo', 
        contentResult.hash.substring(0, 40), // Use hash as OID
        'components/user-card.njk'
      );
      
      // Both URIs should reference the same logical content
      expect(contentResult.uri).toMatch(/^content:\/\/sha256\//);
      expect(gitUri).toMatch(/^git:\/\/template-repo@[a-f0-9]{40}\/components\/user-card\.njk$/);
      
      // Create cross-reference attestation
      const crossRefAttestation = await resolvers.attest.createAttestation({
        subject: contentResult.uri,
        gitReference: gitUri,
        relationship: 'same-content',
        validator: 'cross-reference-validator'
      });
      
      const crossRefUri = await resolvers.attest.store(crossRefAttestation);
      
      const resolvedCrossRef = await resolvers.attest.resolve(crossRefUri);
      expect(resolvedCrossRef.attestation.gitReference).toBe(gitUri);
      expect(resolvedCrossRef.attestation.subject).toBe(contentResult.uri);
    });
  });

  describe('Policy Integration', () => {
    test('should validate template security policies', async () => {
      const templateContent = `
        <h1>{{ title | safe }}</h1>
        <p>{{ content }}</p>
        <script>console.log("{{ debug }}");</script>
      `;
      
      // Store potentially unsafe template
      const templateResult = await resolvers.content.store(templateContent, {
        extension: '.njk',
        metadata: {
          type: 'nunjucks-template',
          name: 'debug-template'
        }
      });
      
      // Test template security policy
      const securityPolicyUri = 'policy://template-security/pass';
      
      const policyContext = {
        templatePath: 'debug-template.njk',
        templateContent: templateContent,
        templateUri: templateResult.uri
      };
      
      // Mock policy execution since SHACL validation is complex
      const mockExecuteTemplateSecurity = vi.fn().mockResolvedValue({
        ruleId: 'template-security',
        passed: false, // Unsafe template
        violations: [
          {
            message: 'Template contains potentially unsafe script tag',
            path: 'template.content',
            severity: 'HIGH'
          },
          {
            message: 'Use of "safe" filter detected',
            path: 'template.filters',
            severity: 'MEDIUM'
          }
        ],
        summary: {
          totalViolations: 2,
          riskLevel: 'HIGH'
        }
      });
      
      resolvers.policy.executeTemplateSecurity = mockExecuteTemplateSecurity;
      
      const policyResult = await resolvers.policy.resolvePolicyURI(securityPolicyUri, policyContext);
      
      expect(policyResult.actualVerdict).toBe('fail');
      expect(policyResult.verdictMatches).toBe(false); // Expected 'pass' but got 'fail'
      expect(policyResult.ruleResult.violations).toHaveLength(2);
      
      // Create safe template
      const safeTemplateContent = `
        <h1>{{ title }}</h1>
        <p>{{ content | escape }}</p>
        <!-- Safe template without scripts -->
      `;
      
      const safeTemplateResult = await resolvers.content.store(safeTemplateContent, {
        extension: '.njk',
        metadata: {
          type: 'nunjucks-template',
          name: 'safe-template'
        }
      });
      
      const mockExecuteSafeTemplateSecurity = vi.fn().mockResolvedValue({
        ruleId: 'template-security',
        passed: true,
        violations: [],
        summary: {
          totalViolations: 0,
          riskLevel: 'LOW'
        }
      });
      
      resolvers.policy.executeTemplateSecurity = mockExecuteSafeTemplateSecurity;
      
      const safePolicyResult = await resolvers.policy.resolvePolicyURI(
        'policy://template-security/pass',
        {
          templatePath: 'safe-template.njk',
          templateContent: safeTemplateContent,
          templateUri: safeTemplateResult.uri
        }
      );
      
      expect(safePolicyResult.actualVerdict).toBe('pass');
      expect(safePolicyResult.verdictMatches).toBe(true);
    });

    test('should validate attestation integrity policies', async () => {
      const artifactContent = 'Important artifact content';
      const contentResult = await resolvers.content.store(artifactContent);
      
      // Create valid attestation
      const validAttestation = await resolvers.attest.createAttestation({
        subject: contentResult.uri,
        validator: 'policy-test-validator',
        claims: { 'urn:integrity:verified': true }
      });
      
      const attestationUri = await resolvers.attest.store(validAttestation);
      
      // Mock attestation file creation
      const attestationPath = `${contentResult.path}.attest.json`;
      await fs.writeFile(attestationPath, JSON.stringify(validAttestation, null, 2));
      
      const policyContext = {
        artifactPath: contentResult.path,
        artifactUri: contentResult.uri
      };
      
      // Mock policy execution
      const mockExecuteAttestationIntegrity = vi.fn().mockResolvedValue({
        ruleId: 'attestation-integrity',
        passed: true,
        violations: [],
        summary: {
          hasAttestation: true,
          attestationValid: true,
          violationsCount: 0
        }
      });
      
      resolvers.policy.executeAttestationIntegrity = mockExecuteAttestationIntegrity;
      
      const integrityPolicyResult = await resolvers.policy.resolvePolicyURI(
        'policy://attestation-integrity/pass',
        policyContext
      );
      
      expect(integrityPolicyResult.actualVerdict).toBe('pass');
      expect(integrityPolicyResult.verdictMatches).toBe(true);
      expect(integrityPolicyResult.ruleResult.summary.hasAttestation).toBe(true);
    });
  });

  describe('End-to-End Workflow Integration', () => {
    test('should complete full artifact lifecycle', async () => {
      // Step 1: Generate artifact
      const componentDefinition = {
        name: 'DataTable',
        version: '1.0.0',
        props: ['data', 'columns', 'sortable'],
        template: `
          <table>
            <thead>
              {% for column in columns %}
              <th>{{ column.title }}</th>
              {% endfor %}
            </thead>
            <tbody>
              {% for row in data %}
              <tr>
                {% for column in columns %}
                <td>{{ row[column.key] }}</td>
                {% endfor %}
              </tr>
              {% endfor %}
            </tbody>
          </table>
        `.trim()
      };
      
      // Step 2: Store in CAS
      const artifactContent = JSON.stringify(componentDefinition, null, 2);
      const contentResult = await resolvers.content.store(artifactContent, {
        extension: '.json',
        metadata: {
          type: 'component-definition',
          generator: 'integration-workflow',
          timestamp: this.getDeterministicDate().toISOString()
        }
      });
      
      // Step 3: Create git reference
      const gitUri = resolvers.git.createGitUri(
        'components',
        contentResult.hash.substring(0, 40),
        'DataTable.json'
      );
      
      // Step 4: Generate attestation
      const attestation = await resolvers.attest.createAttestation({
        subject: contentResult.uri,
        gitReference: gitUri,
        validator: 'integration-workflow',
        claims: {
          'urn:kgen:component-definition': true,
          'urn:kgen:template-safe': true,
          'urn:kgen:lifecycle-complete': true
        }
      });
      
      const attestationUri = await resolvers.attest.store(attestation);
      
      // Step 5: Validate policy compliance
      const mockPolicyResult = {
        ruleId: 'template-security',
        passed: true,
        violations: [],
        summary: { riskLevel: 'LOW' }
      };
      
      resolvers.policy.executeTemplateSecurity = vi.fn().mockResolvedValue(mockPolicyResult);
      
      const policyResult = await resolvers.policy.resolvePolicyURI(
        'policy://template-security/pass',
        {
          templateContent: componentDefinition.template,
          templateUri: contentResult.uri
        }
      );
      
      // Step 6: Create final artifact record
      const artifactRecord = {
        id: crypto.randomUUID(),
        contentUri: contentResult.uri,
        gitUri: gitUri,
        attestationUri: attestationUri,
        policyCompliance: {
          templateSecurity: policyResult.passed
        },
        metadata: {
          created: this.getDeterministicDate().toISOString(),
          lifecycle: 'complete',
          version: componentDefinition.version
        }
      };
      
      // Verify all components
      expect(artifactRecord.contentUri).toMatch(/^content:\/\//);
      expect(artifactRecord.gitUri).toMatch(/^git:\/\//);
      expect(artifactRecord.attestationUri).toMatch(/^attest:\/\//);
      expect(artifactRecord.policyCompliance.templateSecurity).toBe(true);
      
      // Verify content can be retrieved through all URIs
      const resolvedContent = await resolvers.content.resolve(contentResult.uri);
      const resolvedAttestation = await resolvers.attest.resolve(attestationUri);
      
      expect(JSON.parse(resolvedContent.path)).toEqual(componentDefinition);
      expect(resolvedAttestation.attestation.subject).toBe(contentResult.uri);
      
      return artifactRecord; // Return for potential further testing
    });

    test('should handle artifact versioning and evolution', async () => {
      // Create initial artifact
      const v1Component = {
        name: 'UserProfile',
        version: '1.0.0',
        fields: ['name', 'email'],
        template: '<div>{{name}}: {{email}}</div>'
      };
      
      const v1Result = await resolvers.content.store(JSON.stringify(v1Component));
      
      // Evolve to v2
      const v2Component = {
        ...v1Component,
        version: '2.0.0',
        fields: [...v1Component.fields, 'avatar', 'bio'],
        template: `
          <div class="user-profile">
            <img src="{{avatar}}" alt="{{name}}" />
            <h2>{{name}}</h2>
            <p>{{email}}</p>
            <p>{{bio}}</p>
          </div>
        `.trim()
      };
      
      const v2Result = await resolvers.content.store(JSON.stringify(v2Component));
      
      // Create drift patch
      const driftResult = await resolvers.drift.storePatch(v1Component, v2Component, {
        source: 'version-evolution',
        format: 'json',
        metadata: {
          majorVersion: true,
          breaking: false
        }
      });
      
      // Create attestations for both versions
      const v1Attestation = await resolvers.attest.createAttestation({
        subject: v1Result.uri,
        version: '1.0.0'
      });
      const v1AttestUri = await resolvers.attest.store(v1Attestation);
      
      const v2Attestation = await resolvers.attest.createAttestation({
        subject: v2Result.uri,
        version: '2.0.0',
        predecessor: v1AttestUri,
        evolutionPatch: driftResult.uri
      });
      const v2AttestUri = await resolvers.attest.store(v2Attestation);
      
      // Create version evolution record
      const evolutionRecord = {
        from: {
          version: '1.0.0',
          contentUri: v1Result.uri,
          attestationUri: v1AttestUri
        },
        to: {
          version: '2.0.0',
          contentUri: v2Result.uri,
          attestationUri: v2AttestUri
        },
        drift: {
          uri: driftResult.uri,
          significance: driftResult.metadata.semantic?.significance,
          breaking: false
        },
        compatibility: {
          backward: true,
          forward: false
        }
      };
      
      // Verify evolution chain integrity
      expect(evolutionRecord.from.contentUri).not.toBe(evolutionRecord.to.contentUri);
      expect(evolutionRecord.drift.uri).toMatch(/^drift:\/\//);
      
      // Test patch application
      const patchResult = await resolvers.drift.applyPatch(v1Component, driftResult.uri);
      expect(patchResult.result).toEqual(v2Component);
      
      // Verify attestation chain
      const resolvedV2Attestation = await resolvers.attest.resolve(v2AttestUri);
      expect(resolvedV2Attestation.attestation.predecessor).toBe(v1AttestUri);
      expect(resolvedV2Attestation.attestation.evolutionPatch).toBe(driftResult.uri);
    });
  });

  describe('OPC Normalization Integration', () => {
    test('should handle OPC-compatible content structures', async () => {
      // Simulate OPC (Open Packaging Conventions) structure
      const opcManifest = {
        '@context': 'http://www.openarchives.org/OAI/2.0/',
        '@type': 'Package',
        identifier: 'urn:kgen:package:test-001',
        metadata: {
          title: 'Test Package',
          creator: 'Integration Test Suite',
          created: this.getDeterministicDate().toISOString()
        },
        parts: [
          {
            name: 'component.json',
            contentType: 'application/json',
            relationship: 'primary'
          },
          {
            name: 'template.njk',
            contentType: 'text/plain',
            relationship: 'template'
          }
        ]
      };
      
      // Store OPC manifest
      const manifestResult = await resolvers.content.store(
        JSON.stringify(opcManifest, null, 2),
        {
          extension: '.json',
          metadata: {
            type: 'opc-manifest',
            standard: 'OPC-1.0'
          }
        }
      );
      
      // Store individual parts
      const componentPart = {
        name: 'TestComponent',
        version: '1.0.0',
        dependencies: [],
        manifest: manifestResult.uri
      };
      
      const templatePart = `
        <div class="{{name | lower}}">
          <h1>{{title}}</h1>
          <p>{{description}}</p>
        </div>
      `.trim();
      
      const componentResult = await resolvers.content.store(
        JSON.stringify(componentPart),
        { extension: '.json' }
      );
      
      const templateResult = await resolvers.content.store(templatePart, {
        extension: '.njk'
      });
      
      // Create normalized package structure
      const normalizedPackage = {
        manifest: {
          uri: manifestResult.uri,
          hash: manifestResult.hash
        },
        parts: {
          component: {
            uri: componentResult.uri,
            hash: componentResult.hash,
            relationship: 'primary'
          },
          template: {
            uri: templateResult.uri,
            hash: templateResult.hash,
            relationship: 'template'
          }
        },
        normalization: {
          standard: 'OPC-1.0',
          algorithm: 'kgen-canonical',
          timestamp: this.getDeterministicDate().toISOString()
        }
      };
      
      // Store normalized package
      const packageResult = await resolvers.content.store(
        JSON.stringify(normalizedPackage, null, 2),
        {
          extension: '.pkg.json',
          metadata: {
            type: 'normalized-package',
            opcCompliant: true
          }
        }
      );
      
      // Verify OPC compliance through policy
      const mockOPCPolicy = vi.fn().mockResolvedValue({
        ruleId: 'opc-compliance',
        passed: true,
        violations: [],
        summary: {
          compliant: true,
          standard: 'OPC-1.0',
          partsValid: true
        }
      });
      
      resolvers.policy.executeCustomRule = mockOPCPolicy;
      
      const opcPolicyResult = await resolvers.policy.resolvePolicyURI(
        'policy://opc-compliance/pass',
        {
          packageUri: packageResult.uri,
          manifest: opcManifest
        }
      );
      
      expect(opcPolicyResult.actualVerdict).toBe('pass');
      expect(opcPolicyResult.ruleResult.summary.compliant).toBe(true);
      
      // Create attestation for OPC compliance
      const opcAttestation = await resolvers.attest.createAttestation({
        subject: packageResult.uri,
        standard: 'OPC-1.0',
        validator: 'opc-validator',
        claims: {
          'urn:opc:compliant': true,
          'urn:opc:normalized': true,
          'urn:kgen:package': true
        }
      });
      
      const opcAttestUri = await resolvers.attest.store(opcAttestation);
      
      expect(opcAttestUri).toMatch(/^attest:\/\//);
      
      // Final verification
      const resolvedPackage = await resolvers.content.resolve(packageResult.uri);
      const packageData = JSON.parse(await fs.readFile(resolvedPackage.path, 'utf8'));
      
      expect(packageData.normalization.standard).toBe('OPC-1.0');
      expect(packageData.parts.component.uri).toMatch(/^content:\/\//);
      expect(packageData.parts.template.uri).toMatch(/^content:\/\//);
    });
  });
});