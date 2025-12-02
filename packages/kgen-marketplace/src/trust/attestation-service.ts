/**
 * @fileoverview Trust and attestation service for marketplace
 * @version 1.0.0
 * @description Cryptographic attestation and trust scoring for KPacks
 */

import { EventEmitter } from 'events';
import { createHash, createSign, createVerify, randomBytes } from 'crypto';
import { KPackManifest, AttestationRequirements } from '../types/kpack.js';

// ==============================================================================
// Attestation Types
// ==============================================================================

/**
 * Supported cryptographic algorithms
 */
export type SignatureAlgorithm = 'ed25519' | 'ecdsa-p256' | 'rsa-sha256' | 'rsa-pss';

/**
 * Hash algorithms for content verification
 */
export type HashAlgorithm = 'sha256' | 'sha512' | 'blake2b' | 'blake3';

/**
 * Attestation type classifications
 */
export type AttestationType = 
  | 'build-provenance'
  | 'code-review'
  | 'security-scan'
  | 'compliance-audit'
  | 'quality-assessment'
  | 'publisher-verification'
  | 'reproducible-build'
  | 'supply-chain-verification';

/**
 * Trust level classifications
 */
export type TrustLevel = 'untrusted' | 'low' | 'medium' | 'high' | 'verified' | 'certified';

/**
 * Cryptographic key pair
 */
export interface KeyPair {
  publicKey: string;
  privateKey: string;
  algorithm: SignatureAlgorithm;
  keyId: string;
  createdAt: Date;
  expiresAt?: Date;
  usage: 'signing' | 'verification' | 'both';
}

/**
 * Digital signature
 */
export interface DigitalSignature {
  algorithm: SignatureAlgorithm;
  signature: string;
  keyId: string;
  timestamp: Date;
  nonce?: string;
}

/**
 * Attestation statement
 */
export interface AttestationStatement {
  id: string;
  type: AttestationType;
  subject: {
    type: 'kpack' | 'artifact' | 'publisher' | 'process';
    identifier: string;
    name?: string;
    contentHash?: string;
  };
  predicate: {
    type: string;
    evidence: Record<string, any>;
    confidence: number; // 0.0 - 1.0
    validFrom: Date;
    validUntil?: Date;
  };
  attestor: {
    id: string;
    name: string;
    type: 'human' | 'automated' | 'service';
    credentials?: string[];
  };
  metadata: {
    tool?: string;
    toolVersion?: string;
    environment?: Record<string, string>;
    buildInfo?: Record<string, any>;
  };
  createdAt: Date;
}

/**
 * Signed attestation bundle
 */
export interface SignedAttestation {
  statement: AttestationStatement;
  signature: DigitalSignature;
  envelope: {
    payloadType: string;
    payload: string; // Base64 encoded statement
    signatures: DigitalSignature[];
  };
  verification: {
    verified: boolean;
    errors?: string[];
    warnings?: string[];
    chainOfTrust?: string[];
  };
}

/**
 * Trust score components
 */
export interface TrustScore {
  overall: number; // 0.0 - 1.0
  components: {
    publisher: number;
    codeQuality: number;
    security: number;
    community: number;
    attestations: number;
    compliance: number;
  };
  factors: {
    positive: string[];
    negative: string[];
    neutral: string[];
  };
  lastUpdated: Date;
  confidence: number; // Confidence in the score accuracy
}

/**
 * Security scan result
 */
export interface SecurityScanResult {
  id: string;
  scannerName: string;
  scannerVersion: string;
  scanDate: Date;
  status: 'passed' | 'failed' | 'warning' | 'incomplete';
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  findings: Array<{
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    category: string;
    title: string;
    description: string;
    location?: string;
    recommendation?: string;
    cve?: string;
    cvss?: number;
  }>;
  metadata: {
    duration: number;
    rulesVersion: string;
    coverage: number;
  };
}

/**
 * Code review attestation
 */
export interface CodeReviewAttestation {
  id: string;
  reviewDate: Date;
  reviewer: {
    id: string;
    name: string;
    credentials: string[];
    verified: boolean;
  };
  scope: {
    files: string[];
    linesOfCode: number;
    coverage: number; // Percentage of code reviewed
  };
  assessment: {
    codeQuality: number; // 0.0 - 1.0
    security: number;
    maintainability: number;
    documentation: number;
    testCoverage: number;
  };
  findings: Array<{
    severity: 'critical' | 'major' | 'minor' | 'suggestion';
    category: string;
    description: string;
    location?: string;
    resolved: boolean;
  }>;
  recommendations: string[];
  approved: boolean;
  signature: DigitalSignature;
}

// ==============================================================================
// Key Management Service
// ==============================================================================

/**
 * Service for managing cryptographic keys
 */
export class KeyManagementService extends EventEmitter {
  private keys = new Map<string, KeyPair>();
  private trustedKeys = new Set<string>();

  /**
   * Generate a new key pair
   */
  async generateKeyPair(
    algorithm: SignatureAlgorithm = 'ed25519',
    usage: 'signing' | 'verification' | 'both' = 'both'
  ): Promise<KeyPair> {
    const keyId = this.generateKeyId();
    
    let publicKey: string;
    let privateKey: string;

    switch (algorithm) {
      case 'ed25519': {
        const { generateKeyPairSync } = await import('crypto');
        const { publicKey: pubKey, privateKey: privKey } = generateKeyPairSync('ed25519', {
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        publicKey = pubKey;
        privateKey = privKey;
        break;
      }
      case 'ecdsa-p256': {
        const { generateKeyPairSync } = await import('crypto');
        const { publicKey: pubKey, privateKey: privKey } = generateKeyPairSync('ec', {
          namedCurve: 'prime256v1',
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        publicKey = pubKey;
        privateKey = privKey;
        break;
      }
      case 'rsa-sha256':
      case 'rsa-pss': {
        const { generateKeyPairSync } = await import('crypto');
        const { publicKey: pubKey, privateKey: privKey } = generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        publicKey = pubKey;
        privateKey = privKey;
        break;
      }
      default:
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }

    const keyPair: KeyPair = {
      publicKey,
      privateKey,
      algorithm,
      keyId,
      createdAt: new Date(),
      usage
    };

    this.keys.set(keyId, keyPair);
    this.emit('key-generated', keyId, algorithm);

    return keyPair;
  }

  /**
   * Import a key pair
   */
  importKeyPair(
    publicKey: string,
    privateKey: string,
    algorithm: SignatureAlgorithm,
    keyId?: string
  ): KeyPair {
    const id = keyId || this.generateKeyId();
    const keyPair: KeyPair = {
      publicKey,
      privateKey,
      algorithm,
      keyId: id,
      createdAt: new Date(),
      usage: 'both'
    };

    this.keys.set(id, keyPair);
    this.emit('key-imported', id, algorithm);

    return keyPair;
  }

  /**
   * Get a key pair by ID
   */
  getKeyPair(keyId: string): KeyPair | undefined {
    return this.keys.get(keyId);
  }

  /**
   * List all key pairs
   */
  listKeys(): KeyPair[] {
    return Array.from(this.keys.values()).map(key => ({
      ...key,
      privateKey: '[REDACTED]' // Don't expose private keys in listings
    }));
  }

  /**
   * Mark a key as trusted
   */
  trustKey(keyId: string): void {
    if (!this.keys.has(keyId)) {
      throw new Error(`Key ${keyId} not found`);
    }
    this.trustedKeys.add(keyId);
    this.emit('key-trusted', keyId);
  }

  /**
   * Check if a key is trusted
   */
  isKeyTrusted(keyId: string): boolean {
    return this.trustedKeys.has(keyId);
  }

  /**
   * Revoke a key
   */
  revokeKey(keyId: string, reason?: string): void {
    this.keys.delete(keyId);
    this.trustedKeys.delete(keyId);
    this.emit('key-revoked', keyId, reason);
  }

  /**
   * Generate a unique key ID
   */
  private generateKeyId(): string {
    return createHash('sha256')
      .update(randomBytes(32))
      .digest('hex')
      .slice(0, 16);
  }
}

// ==============================================================================
// Attestation Service
// ==============================================================================

/**
 * Core attestation service for creating and verifying attestations
 */
export class AttestationService extends EventEmitter {
  private keyService: KeyManagementService;
  private attestations = new Map<string, SignedAttestation>();
  private trustScores = new Map<string, TrustScore>();

  constructor(keyService?: KeyManagementService) {
    super();
    this.keyService = keyService || new KeyManagementService();
  }

  /**
   * Create an attestation statement
   */
  async createAttestation(
    type: AttestationType,
    subject: AttestationStatement['subject'],
    predicate: AttestationStatement['predicate'],
    attestor: AttestationStatement['attestor'],
    metadata: AttestationStatement['metadata'] = {}
  ): Promise<AttestationStatement> {
    const statement: AttestationStatement = {
      id: this.generateAttestationId(),
      type,
      subject,
      predicate,
      attestor,
      metadata,
      createdAt: new Date()
    };

    this.emit('attestation-created', statement);
    return statement;
  }

  /**
   * Sign an attestation statement
   */
  async signAttestation(
    statement: AttestationStatement,
    keyId: string,
    includeNonce: boolean = true
  ): Promise<SignedAttestation> {
    const keyPair = this.keyService.getKeyPair(keyId);
    if (!keyPair) {
      throw new Error(`Key ${keyId} not found`);
    }

    if (keyPair.usage === 'verification') {
      throw new Error(`Key ${keyId} is not for signing`);
    }

    // Create envelope payload
    const payload = Buffer.from(JSON.stringify(statement)).toString('base64');
    const nonce = includeNonce ? randomBytes(16).toString('hex') : undefined;

    // Create signature
    const signature = await this.createSignature(payload, keyPair, nonce);

    const signedAttestation: SignedAttestation = {
      statement,
      signature,
      envelope: {
        payloadType: 'application/vnd.kgen.attestation+json',
        payload,
        signatures: [signature]
      },
      verification: {
        verified: false // Will be set during verification
      }
    };

    this.attestations.set(statement.id, signedAttestation);
    this.emit('attestation-signed', statement.id, keyId);

    return signedAttestation;
  }

  /**
   * Verify a signed attestation
   */
  async verifyAttestation(
    signedAttestation: SignedAttestation,
    trustedKeysOnly: boolean = true
  ): Promise<boolean> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Verify each signature
      for (const signature of signedAttestation.envelope.signatures) {
        const keyPair = this.keyService.getKeyPair(signature.keyId);
        if (!keyPair) {
          errors.push(`Key ${signature.keyId} not found`);
          continue;
        }

        if (trustedKeysOnly && !this.keyService.isKeyTrusted(signature.keyId)) {
          warnings.push(`Key ${signature.keyId} is not trusted`);
        }

        const isValid = await this.verifySignature(
          signedAttestation.envelope.payload,
          signature,
          keyPair.publicKey
        );

        if (!isValid) {
          errors.push(`Invalid signature from key ${signature.keyId}`);
        }
      }

      // Verify statement integrity
      const decodedPayload = JSON.parse(
        Buffer.from(signedAttestation.envelope.payload, 'base64').toString()
      );

      if (JSON.stringify(decodedPayload) !== JSON.stringify(signedAttestation.statement)) {
        errors.push('Statement does not match envelope payload');
      }

      // Check expiration
      if (signedAttestation.statement.predicate.validUntil) {
        if (new Date() > signedAttestation.statement.predicate.validUntil) {
          warnings.push('Attestation has expired');
        }
      }

      const verified = errors.length === 0;
      
      // Update verification status
      signedAttestation.verification = {
        verified,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined
      };

      this.emit('attestation-verified', signedAttestation.statement.id, verified);
      return verified;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown verification error';
      signedAttestation.verification = {
        verified: false,
        errors: [errorMessage]
      };
      
      this.emit('attestation-verification-failed', signedAttestation.statement.id, errorMessage);
      return false;
    }
  }

  /**
   * Create a security scan attestation
   */
  async createSecurityScanAttestation(
    kpackId: string,
    scanResult: SecurityScanResult,
    attestorKeyId: string
  ): Promise<SignedAttestation> {
    const statement = await this.createAttestation(
      'security-scan',
      {
        type: 'kpack',
        identifier: kpackId
      },
      {
        type: 'security-scan-result',
        evidence: {
          scanResult,
          scannerTrust: this.evaluateScannerTrust(scanResult.scannerName),
          automatedAssessment: this.assessSecurityScanResult(scanResult)
        },
        confidence: this.calculateScanConfidence(scanResult),
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      },
      {
        id: `security-scanner-${scanResult.scannerName}`,
        name: scanResult.scannerName,
        type: 'automated',
        credentials: [`scanner:${scanResult.scannerName}:${scanResult.scannerVersion}`]
      },
      {
        tool: scanResult.scannerName,
        toolVersion: scanResult.scannerVersion,
        environment: {
          scanDate: scanResult.scanDate.toISOString(),
          duration: scanResult.metadata.duration.toString(),
          rulesVersion: scanResult.metadata.rulesVersion
        }
      }
    );

    return this.signAttestation(statement, attestorKeyId);
  }

  /**
   * Create a code review attestation
   */
  async createCodeReviewAttestation(
    kpackId: string,
    review: CodeReviewAttestation,
    attestorKeyId: string
  ): Promise<SignedAttestation> {
    const statement = await this.createAttestation(
      'code-review',
      {
        type: 'kpack',
        identifier: kpackId
      },
      {
        type: 'human-code-review',
        evidence: {
          review,
          reviewerCredentials: review.reviewer.credentials,
          qualityMetrics: review.assessment
        },
        confidence: this.calculateReviewConfidence(review),
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
      },
      {
        id: review.reviewer.id,
        name: review.reviewer.name,
        type: 'human',
        credentials: review.reviewer.credentials
      },
      {
        reviewDate: review.reviewDate.toISOString(),
        scope: JSON.stringify(review.scope),
        approved: review.approved.toString()
      }
    );

    return this.signAttestation(statement, attestorKeyId);
  }

  /**
   * Calculate trust score for a KPack
   */
  async calculateTrustScore(kpackId: string, manifest: KPackManifest): Promise<TrustScore> {
    const attestations = this.getAttestationsForSubject(kpackId);
    const components = {
      publisher: this.calculatePublisherScore(manifest.publisher),
      codeQuality: this.calculateCodeQualityScore(attestations),
      security: this.calculateSecurityScore(attestations),
      community: this.calculateCommunityScore(kpackId), // Would integrate with community metrics
      attestations: this.calculateAttestationScore(attestations),
      compliance: this.calculateComplianceScore(manifest, attestations)
    };

    const weights = {
      publisher: 0.2,
      codeQuality: 0.2,
      security: 0.25,
      community: 0.1,
      attestations: 0.15,
      compliance: 0.1
    };

    const overall = Object.entries(components).reduce(
      (sum, [key, value]) => sum + value * weights[key as keyof typeof weights],
      0
    );

    const trustScore: TrustScore = {
      overall,
      components,
      factors: this.identifyTrustFactors(attestations, manifest),
      lastUpdated: new Date(),
      confidence: this.calculateScoreConfidence(attestations)
    };

    this.trustScores.set(kpackId, trustScore);
    this.emit('trust-score-calculated', kpackId, overall);

    return trustScore;
  }

  /**
   * Get trust score for a KPack
   */
  getTrustScore(kpackId: string): TrustScore | undefined {
    return this.trustScores.get(kpackId);
  }

  /**
   * Get all attestations for a subject
   */
  getAttestationsForSubject(subjectId: string): SignedAttestation[] {
    return Array.from(this.attestations.values())
      .filter(attestation => attestation.statement.subject.identifier === subjectId);
  }

  /**
   * Verify KPack against attestation requirements
   */
  async verifyKPackAttestations(
    kpackId: string,
    requirements: AttestationRequirements
  ): Promise<{
    compliant: boolean;
    missingAttestations: AttestationType[];
    invalidAttestations: string[];
    warnings: string[];
  }> {
    if (!requirements.required) {
      return {
        compliant: true,
        missingAttestations: [],
        invalidAttestations: [],
        warnings: []
      };
    }

    const attestations = this.getAttestationsForSubject(kpackId);
    const missingAttestations: AttestationType[] = [];
    const invalidAttestations: string[] = [];
    const warnings: string[] = [];

    // Check required attestation types
    const requiredTypes: AttestationType[] = ['security-scan', 'publisher-verification'];
    
    for (const requiredType of requiredTypes) {
      const typeAttestations = attestations.filter(a => a.statement.type === requiredType);
      
      if (typeAttestations.length === 0) {
        missingAttestations.push(requiredType);
      } else {
        // Verify each attestation
        for (const attestation of typeAttestations) {
          const isValid = await this.verifyAttestation(attestation);
          if (!isValid) {
            invalidAttestations.push(attestation.statement.id);
          }
        }
      }
    }

    // Check algorithm requirements
    for (const attestation of attestations) {
      if (!requirements.algorithms.includes(attestation.signature.algorithm)) {
        warnings.push(`Attestation ${attestation.statement.id} uses unsupported algorithm ${attestation.signature.algorithm}`);
      }
    }

    const compliant = missingAttestations.length === 0 && invalidAttestations.length === 0;

    return {
      compliant,
      missingAttestations,
      invalidAttestations,
      warnings
    };
  }

  // Private helper methods

  private async createSignature(
    payload: string,
    keyPair: KeyPair,
    nonce?: string
  ): Promise<DigitalSignature> {
    const dataToSign = nonce ? `${payload}.${nonce}` : payload;
    const sign = createSign(this.getNodeCryptoAlgorithm(keyPair.algorithm));
    sign.update(dataToSign);
    const signatureBuffer = sign.sign(keyPair.privateKey);
    
    return {
      algorithm: keyPair.algorithm,
      signature: signatureBuffer.toString('base64'),
      keyId: keyPair.keyId,
      timestamp: new Date(),
      nonce
    };
  }

  private async verifySignature(
    payload: string,
    signature: DigitalSignature,
    publicKey: string
  ): Promise<boolean> {
    const dataToVerify = signature.nonce ? `${payload}.${signature.nonce}` : payload;
    const verify = createVerify(this.getNodeCryptoAlgorithm(signature.algorithm));
    verify.update(dataToVerify);
    
    return verify.verify(publicKey, signature.signature, 'base64');
  }

  private getNodeCryptoAlgorithm(algorithm: SignatureAlgorithm): string {
    switch (algorithm) {
      case 'ed25519': return 'ed25519';
      case 'ecdsa-p256': return 'sha256';
      case 'rsa-sha256': return 'RSA-SHA256';
      case 'rsa-pss': return 'RSA-PSS';
      default: throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
  }

  private generateAttestationId(): string {
    return `att_${randomBytes(16).toString('hex')}`;
  }

  private evaluateScannerTrust(scannerName: string): number {
    // Simplified trust evaluation for scanners
    const trustedScanners: Record<string, number> = {
      'snyk': 0.9,
      'sonarqube': 0.8,
      'checkmarx': 0.85,
      'veracode': 0.9,
      'bandit': 0.7,
      'semgrep': 0.75,
      'eslint': 0.6
    };
    
    return trustedScanners[scannerName.toLowerCase()] || 0.5;
  }

  private assessSecurityScanResult(scanResult: SecurityScanResult): {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    score: number;
  } {
    const { critical, high, medium, low } = scanResult.summary;
    const totalIssues = critical + high + medium + low;
    
    if (critical > 0) {
      return { riskLevel: 'critical', score: 0.1 };
    } else if (high > 3) {
      return { riskLevel: 'high', score: 0.3 };
    } else if (high > 0 || medium > 5) {
      return { riskLevel: 'medium', score: 0.6 };
    } else {
      return { riskLevel: 'low', score: 0.9 };
    }
  }

  private calculateScanConfidence(scanResult: SecurityScanResult): number {
    // Base confidence on scanner coverage and known reliability
    const coverage = scanResult.metadata.coverage || 0.5;
    const scannerTrust = this.evaluateScannerTrust(scanResult.scannerName);
    
    return Math.min(coverage * scannerTrust, 1.0);
  }

  private calculateReviewConfidence(review: CodeReviewAttestation): number {
    // Base confidence on reviewer credentials and review coverage
    const reviewerScore = review.reviewer.verified ? 0.8 : 0.5;
    const coverageScore = review.scope.coverage;
    const approvalBonus = review.approved ? 0.2 : 0;
    
    return Math.min(reviewerScore * coverageScore + approvalBonus, 1.0);
  }

  private calculatePublisherScore(publisher: any): number {
    // Simplified publisher scoring
    let score = 0.5; // Base score
    
    if (publisher.verified) score += 0.3;
    if (publisher.reputation?.score) score += publisher.reputation.score * 0.2;
    
    return Math.min(score, 1.0);
  }

  private calculateCodeQualityScore(attestations: SignedAttestation[]): number {
    const codeReviews = attestations.filter(a => a.statement.type === 'code-review');
    if (codeReviews.length === 0) return 0.5;
    
    const avgQuality = codeReviews.reduce((sum, review) => {
      const evidence = review.statement.predicate.evidence;
      return sum + (evidence.review?.assessment?.codeQuality || 0.5);
    }, 0) / codeReviews.length;
    
    return avgQuality;
  }

  private calculateSecurityScore(attestations: SignedAttestation[]): number {
    const securityScans = attestations.filter(a => a.statement.type === 'security-scan');
    if (securityScans.length === 0) return 0.3; // Lower score without security attestation
    
    const avgSecurity = securityScans.reduce((sum, scan) => {
      const evidence = scan.statement.predicate.evidence;
      return sum + (evidence.automatedAssessment?.score || 0.5);
    }, 0) / securityScans.length;
    
    return avgSecurity;
  }

  private calculateCommunityScore(kpackId: string): number {
    // Placeholder for community metrics integration
    return 0.5;
  }

  private calculateAttestationScore(attestations: SignedAttestation[]): number {
    if (attestations.length === 0) return 0.2;
    
    const verifiedCount = attestations.filter(a => a.verification.verified).length;
    const verificationRate = verifiedCount / attestations.length;
    
    // Bonus for having multiple types of attestations
    const types = new Set(attestations.map(a => a.statement.type));
    const diversityBonus = Math.min(types.size * 0.1, 0.3);
    
    return Math.min(verificationRate + diversityBonus, 1.0);
  }

  private calculateComplianceScore(manifest: KPackManifest, attestations: SignedAttestation[]): number {
    const complianceLevel = manifest.facets.compliance;
    if (complianceLevel.includes('none')) return 0.5;
    
    // Higher score for more compliance standards
    const complianceCount = complianceLevel.filter(c => c !== 'none').length;
    let score = Math.min(complianceCount * 0.2, 0.8);
    
    // Bonus if compliance is attested
    const complianceAttestations = attestations.filter(a => a.statement.type === 'compliance-audit');
    if (complianceAttestations.length > 0) {
      score += 0.2;
    }
    
    return Math.min(score, 1.0);
  }

  private identifyTrustFactors(attestations: SignedAttestation[], manifest: KPackManifest): {
    positive: string[];
    negative: string[];
    neutral: string[];
  } {
    const positive: string[] = [];
    const negative: string[] = [];
    const neutral: string[] = [];
    
    // Analyze attestations
    const hasSecurityScan = attestations.some(a => a.statement.type === 'security-scan');
    const hasCodeReview = attestations.some(a => a.statement.type === 'code-review');
    
    if (hasSecurityScan) positive.push('Security scanned');
    else negative.push('No security scanning');
    
    if (hasCodeReview) positive.push('Code reviewed');
    else negative.push('No code review');
    
    // Analyze manifest
    if (manifest.publisher.verified) positive.push('Verified publisher');
    else negative.push('Unverified publisher');
    
    if (manifest.trustIndicators.reproductibleBuild) positive.push('Reproducible build');
    else neutral.push('Build reproducibility unknown');
    
    return { positive, negative, neutral };
  }

  private calculateScoreConfidence(attestations: SignedAttestation[]): number {
    if (attestations.length === 0) return 0.3;
    
    const avgConfidence = attestations.reduce((sum, att) => {
      return sum + att.statement.predicate.confidence;
    }, 0) / attestations.length;
    
    return avgConfidence;
  }
}

// ==============================================================================
// Trust Registry
// ==============================================================================

/**
 * Registry for managing trusted entities and certificates
 */
export class TrustRegistry extends EventEmitter {
  private trustedPublishers = new Map<string, { verified: Date; certifications: string[] }>();
  private trustedTools = new Map<string, { version: string; trustLevel: TrustLevel }>();
  private revocationList = new Set<string>();

  /**
   * Add a trusted publisher
   */
  addTrustedPublisher(
    publisherId: string,
    certifications: string[] = []
  ): void {
    this.trustedPublishers.set(publisherId, {
      verified: new Date(),
      certifications
    });
    this.emit('publisher-trusted', publisherId);
  }

  /**
   * Check if a publisher is trusted
   */
  isPublisherTrusted(publisherId: string): boolean {
    return this.trustedPublishers.has(publisherId) && !this.revocationList.has(publisherId);
  }

  /**
   * Add a trusted tool
   */
  addTrustedTool(
    toolName: string,
    version: string,
    trustLevel: TrustLevel
  ): void {
    this.trustedTools.set(toolName, { version, trustLevel });
    this.emit('tool-trusted', toolName, version);
  }

  /**
   * Get trust level for a tool
   */
  getToolTrustLevel(toolName: string): TrustLevel | undefined {
    return this.trustedTools.get(toolName)?.trustLevel;
  }

  /**
   * Revoke trust for an entity
   */
  revokeTrust(entityId: string, reason: string): void {
    this.revocationList.add(entityId);
    this.emit('trust-revoked', entityId, reason);
  }

  /**
   * Check if an entity is revoked
   */
  isRevoked(entityId: string): boolean {
    return this.revocationList.has(entityId);
  }

  /**
   * Export trust registry for backup/sharing
   */
  exportRegistry(): {
    publishers: Array<{ id: string; verified: Date; certifications: string[] }>;
    tools: Array<{ name: string; version: string; trustLevel: TrustLevel }>;
    revoked: string[];
  } {
    return {
      publishers: Array.from(this.trustedPublishers.entries()).map(([id, data]) => ({
        id,
        ...data
      })),
      tools: Array.from(this.trustedTools.entries()).map(([name, data]) => ({
        name,
        ...data
      })),
      revoked: Array.from(this.revocationList)
    };
  }

  /**
   * Import trust registry from backup
   */
  importRegistry(data: {
    publishers: Array<{ id: string; verified: Date; certifications: string[] }>;
    tools: Array<{ name: string; version: string; trustLevel: TrustLevel }>;
    revoked: string[];
  }): void {
    // Clear existing data
    this.trustedPublishers.clear();
    this.trustedTools.clear();
    this.revocationList.clear();

    // Import new data
    for (const publisher of data.publishers) {
      this.trustedPublishers.set(publisher.id, {
        verified: new Date(publisher.verified),
        certifications: publisher.certifications
      });
    }

    for (const tool of data.tools) {
      this.trustedTools.set(tool.name, {
        version: tool.version,
        trustLevel: tool.trustLevel
      });
    }

    for (const revoked of data.revoked) {
      this.revocationList.add(revoked);
    }

    this.emit('registry-imported', data);
  }
}