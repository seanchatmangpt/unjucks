/**
 * Security testing utilities for RDF integration
 */

export interface SecurityTestVector {
  name: string;
  category: 'input_validation' | 'resource_exhaustion' | 'template_injection' | 'network_security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  payload: string;
  expectedOutcome: 'blocked' | 'sanitized' | 'timeout';
  description: string;
}

/**
 * Collection of security test vectors for comprehensive testing
 */
export const SECURITY_TEST_VECTORS: SecurityTestVector[] = [
  // Input Validation Attacks
  {
    name: 'javascript_uri_injection',
    category: 'input_validation',
    severity: 'high',
    payload: '<javascript:alert("XSS")>',
    expectedOutcome: 'blocked',
    description: 'JavaScript URI injection in RDF predicates/objects'
  },
  {
    name: 'data_uri_injection',
    category: 'input_validation', 
    severity: 'medium',
    payload: '<data:text/html,<script>alert(1)</script>>',
    expectedOutcome: 'blocked',
    description: 'Data URI with embedded JavaScript'
  },
  {
    name: 'file_uri_access',
    category: 'input_validation',
    severity: 'critical',
    payload: '<file:///etc/passwd>',
    expectedOutcome: 'blocked',
    description: 'Local file system access via file:// URIs'
  },
  {
    name: 'path_traversal_basic',
    category: 'input_validation',
    severity: 'high',
    payload: '../../../etc/passwd',
    expectedOutcome: 'blocked',
    description: 'Basic path traversal attempt'
  },
  {
    name: 'path_traversal_encoded',
    category: 'input_validation',
    severity: 'high',
    payload: '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    expectedOutcome: 'blocked',
    description: 'URL encoded path traversal'
  },
  {
    name: 'unicode_bypass',
    category: 'input_validation',
    severity: 'medium',
    payload: '..\\u002f..\\u002f..\\u002fetc\\u002fpasswd',
    expectedOutcome: 'blocked',
    description: 'Unicode escape sequence bypass attempt'
  },

  // Resource Exhaustion Attacks
  {
    name: 'billion_laughs',
    category: 'resource_exhaustion',
    severity: 'high',
    payload: '<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">',
    expectedOutcome: 'blocked',
    description: 'XML billion laughs attack via entity expansion'
  },
  {
    name: 'large_literal',
    category: 'resource_exhaustion',
    severity: 'medium',
    payload: '"' + 'A'.repeat(10000000) + '"', // 10MB literal
    expectedOutcome: 'blocked',
    description: 'Extremely large literal value'
  },
  {
    name: 'deep_nesting',
    category: 'resource_exhaustion',
    severity: 'medium',
    payload: Array.from({length: 10000}, (_, i) => `ex:nest${i} ex:contains ex:nest${i+1} .`).join('\n'),
    expectedOutcome: 'timeout',
    description: 'Deep nested RDF structure'
  },

  // Template Injection Attacks
  {
    name: 'prototype_pollution',
    category: 'template_injection',
    severity: 'critical',
    payload: '"__proto__"',
    expectedOutcome: 'sanitized',
    description: 'Prototype pollution attempt via __proto__ property'
  },
  {
    name: 'constructor_injection',
    category: 'template_injection',
    severity: 'critical',
    payload: '"{{constructor.constructor(\'alert(1)\')()}}"',
    expectedOutcome: 'sanitized',
    description: 'JavaScript code injection via constructor'
  },
  {
    name: 'process_exit',
    category: 'template_injection',
    severity: 'critical',
    payload: '"{{global.process.exit(1)}}"',
    expectedOutcome: 'sanitized',
    description: 'Node.js process termination attempt'
  },
  {
    name: 'require_injection',
    category: 'template_injection',
    severity: 'critical',
    payload: '"{{require(\'child_process\').exec(\'rm -rf /\')}}"',
    expectedOutcome: 'sanitized',
    description: 'Command execution via require injection'
  },

  // Network Security Attacks
  {
    name: 'ssrf_localhost',
    category: 'network_security',
    severity: 'high',
    payload: 'http://127.0.0.1:8080/admin',
    expectedOutcome: 'blocked',
    description: 'SSRF attack targeting localhost'
  },
  {
    name: 'ssrf_private_ip',
    category: 'network_security',
    severity: 'high',
    payload: 'http://192.168.1.1/config',
    expectedOutcome: 'blocked',
    description: 'SSRF attack targeting private IP range'
  },
  {
    name: 'ssrf_metadata_service',
    category: 'network_security',
    severity: 'critical',
    payload: 'http://169.254.169.254/metadata',
    expectedOutcome: 'blocked',
    description: 'SSRF attack targeting cloud metadata service'
  },
  {
    name: 'protocol_bypass_ftp',
    category: 'network_security',
    severity: 'medium',
    payload: 'ftp://evil.com/malicious.ttl',
    expectedOutcome: 'blocked',
    description: 'Protocol bypass using FTP'
  },
  {
    name: 'protocol_bypass_gopher',
    category: 'network_security',
    severity: 'medium',
    payload: 'gopher://attacker.com:1337/data',
    expectedOutcome: 'blocked',
    description: 'Protocol bypass using Gopher'
  }
];

/**
 * Generate RDF content with security test vector
 */
export function generateMaliciousRDF(vector: SecurityTestVector): string {
  const prefix = `@prefix ex: <http://example.org/> .`;
  
  switch (vector.category) {
    case 'input_validation':
      if (vector.payload.startsWith('<') && vector.payload.endsWith('>')) {
        return `${prefix}\nex:resource ex:property ${vector.payload} .`;
      } else {
        return `${prefix}\nex:resource ex:property "${vector.payload}" .`;
      }
    
    case 'resource_exhaustion':
      if (vector.name === 'deep_nesting') {
        return `${prefix}\n${vector.payload}`;
      } else {
        return `${prefix}\nex:resource ex:property ${vector.payload} .`;
      }
    
    case 'template_injection':
      return `${prefix}\nex:resource ex:property ${vector.payload} .`;
    
    case 'network_security':
      if (vector.payload.startsWith('http')) {
        return `${prefix}\nex:resource ex:externalRef <${vector.payload}> .`;
      } else {
        return `${prefix}\nex:resource ex:property "${vector.payload}" .`;
      }
    
    default:
      return `${prefix}\nex:resource ex:property "${vector.payload}" .`;
  }
}

/**
 * Security test result evaluation
 */
export interface SecurityTestResult {
  vector: SecurityTestVector;
  actualOutcome: 'blocked' | 'allowed' | 'sanitized' | 'timeout' | 'error';
  success: boolean;
  timeElapsed: number;
  errorType?: string;
  details?: string;
}

/**
 * Evaluate if a security test passed based on expected vs actual outcome
 */
export function evaluateSecurityTest(
  vector: SecurityTestVector,
  actualOutcome: SecurityTestResult['actualOutcome'],
  timeElapsed: number,
  errorType?: string,
  details?: string
): SecurityTestResult {
  const success = actualOutcome === vector.expectedOutcome || 
                 (vector.expectedOutcome === 'blocked' && (actualOutcome === 'error' || actualOutcome === 'blocked'));
  
  return {
    vector,
    actualOutcome,
    success,
    timeElapsed,
    errorType,
    details
  };
}

/**
 * Generate security assessment report
 */
export interface SecurityAssessmentReport {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    criticalFailures: number;
    averageResponseTime: number;
  };
  failures: SecurityTestResult[];
  criticalFailures: SecurityTestResult[];
  recommendations: string[];
  riskScore: number; // 0-100, higher is more risky
}

export function generateSecurityReport(results: SecurityTestResult[]): SecurityAssessmentReport {
  const totalTests = results.length;
  const passed = results.filter(r => r.success).length;
  const failed = totalTests - passed;
  const failures = results.filter(r => !r.success);
  const criticalFailures = failures.filter(r => r.vector.severity === 'critical');
  const averageResponseTime = results.reduce((sum, r) => sum + r.timeElapsed, 0) / totalTests;
  
  // Calculate risk score (0-100)
  const severityWeights = { low: 1, medium: 3, high: 7, critical: 15 };
  const totalPossibleRisk = results.reduce((sum, r) => sum + severityWeights[r.vector.severity], 0);
  const actualRisk = failures.reduce((sum, r) => sum + severityWeights[r.vector.severity], 0);
  const riskScore = Math.round((actualRisk / totalPossibleRisk) * 100) || 0;
  
  const recommendations = [
    'Implement strict input validation for all RDF data sources',
    'Add content-length limits to prevent resource exhaustion',
    'Sanitize all template variables before rendering', 
    'Restrict allowed URI schemes to HTTP/HTTPS only',
    'Implement rate limiting for external HTTP requests',
    'Add timeout controls for all parsing operations',
    'Use Content Security Policy (CSP) when rendering in web contexts',
    'Implement comprehensive logging for security events',
    'Regular security testing and penetration testing',
    'Keep RDF parsing libraries up to date'
  ];
  
  return {
    summary: {
      totalTests,
      passed,
      failed,
      criticalFailures: criticalFailures.length,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100
    },
    failures,
    criticalFailures,
    recommendations,
    riskScore
  };
}

/**
 * Common attack patterns for fuzzing
 */
export const ATTACK_PATTERNS = {
  XSS_PAYLOADS: [
    '<script>alert(1)</script>',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '"><script>alert(1)</script>',
    "';alert(1);//"
  ],
  
  SSRF_TARGETS: [
    'http://127.0.0.1:22',
    'http://127.0.0.1:3306', 
    'http://127.0.0.1:6379',
    'http://localhost:8080',
    'http://169.254.169.254',
    'http://[::1]:22'
  ],
  
  PATH_TRAVERSAL: [
    '../etc/passwd',
    '..\\windows\\system32\\config\\sam',
    '....//....//etc/passwd',
    '%2e%2e%2fetc%2fpasswd',
    '..%252f..%252fetc%252fpasswd'
  ],
  
  TEMPLATE_INJECTION: [
    '{{constructor.constructor("alert(1)")()}}',
    '{{global.process.exit(1)}}',
    '${7*7}',
    '<%= 7*7 %>',
    '#{7*7}'
  ]
};

/**
 * Memory usage monitoring for security tests
 */
export class MemoryMonitor {
  private initialHeap: number;
  private peakHeap: number;
  
  constructor() {
    this.initialHeap = process.memoryUsage().heapUsed;
    this.peakHeap = this.initialHeap;
  }
  
  update(): void {
    const current = process.memoryUsage().heapUsed;
    if (current > this.peakHeap) {
      this.peakHeap = current;
    }
  }
  
  getUsage(): {
    initial: number;
    peak: number;
    current: number;
    increase: number;
  } {
    const current = process.memoryUsage().heapUsed;
    return {
      initial: this.initialHeap,
      peak: this.peakHeap,
      current,
      increase: current - this.initialHeap
    };
  }
  
  getUsageMB(): {
    initial: number;
    peak: number;
    current: number;
    increase: number;
  } {
    const usage = this.getUsage();
    return {
      initial: Math.round(usage.initial / 1024 / 1024 * 100) / 100,
      peak: Math.round(usage.peak / 1024 / 1024 * 100) / 100,
      current: Math.round(usage.current / 1024 / 1024 * 100) / 100,
      increase: Math.round(usage.increase / 1024 / 1024 * 100) / 100
    };
  }
}