/**
 * @fileoverview Package signature verification and trust validation for KGEN Marketplace
 * @version 1.0.0
 * @description Verifies package signatures, attestations, and trust policies
 */

import { jwtVerify, importJWK } from 'jose';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { KPackManifest, ContentAddress } from '../types/kpack.js';
import { PackageSignature, PackageAttestation, SignatureBundle } from './signer.js';

// ==============================================================================
// Types and Interfaces
// ==============================================================================

export interface TrustPolicy {
  /** Policy version */
  version: string;
  /** Trusted publishers */
  trustedPublishers: {
    id: string;
    name: string;
    publicKeys: string[]; // Key fingerprints
    minimumReputation?: number;
    domains?: string[]; // Allowed package name patterns
  }[];
  /** Trusted keys */
  trustedKeys: {
    fingerprint: string;
    publicKey: any; // JWK format
    owner: string;
    validFrom: string;
    validUntil?: string;
    purpose: string[]; // ['signing', 'attestation', 'delegation']
  }[];
  /** Trust requirements */
  requirements: {
    minimumSignatures: number;
    requireAttestations: boolean;
    allowedAlgorithms: string[];
    maxAge: number; // Maximum signature age in seconds
    requirePublisherVerification: boolean;
    requiredAttestationTypes: string[];
  };
  /** Policy metadata */
  metadata: {
    name: string;
    description: string;
    maintainer: string;
    lastUpdated: string;
  };
}

export interface VerificationContext {
  /** Trust policy to apply */
  trustPolicy: TrustPolicy;
  /** Current timestamp for age verification */
  currentTime?: Date;
  /** Allow expired signatures for historical verification */
  allowExpired?: boolean;
  /** Additional trusted keys for this verification */
  additionalTrustedKeys?: any[];
}

export interface VerificationResult {
  /** Overall verification result */
  valid: boolean;
  /** Individual signature verification results */
  signatures: {
    signature: PackageSignature;
    valid: boolean;
    trusted: boolean;
    error?: string;
    warnings: string[];
  }[];
  /** Attestation verification results */
  attestations: {
    attestation: PackageAttestation;
    valid: boolean;
    trusted: boolean;
    error?: string;
    warnings: string[];
  }[];
  /** Trust policy compliance */
  policyCompliance: {
    minimumSignatures: boolean;
    attestationRequirements: boolean;
    algorithmRequirements: boolean;
    ageRequirements: boolean;
    publisherRequirements: boolean;
  };
  /** Overall trust score (0.0 - 1.0) */
  trustScore: number;
  /** Verification warnings */
  warnings: string[];
  /** Verification errors */
  errors: string[];
}

export interface AttestationChainResult {
  /** Chain is valid */
  valid: boolean;
  /** Chain depth */
  depth: number;
  /** Chain of trust path */
  path: string[];
  /** Root trust anchor */
  rootAnchor?: string;
  /** Chain verification errors */
  errors: string[];
}

// ==============================================================================
// Package Verifier
// ==============================================================================

export class PackageVerifier {
  private readonly algorithm = 'EdDSA';

  /**
   * Verify a complete signature bundle
   */
  async verifySignatureBundle(
    bundle: SignatureBundle,
    contentAddress: ContentAddress,
    context: VerificationContext
  ): Promise<VerificationResult> {
    const result: VerificationResult = {
      valid: false,
      signatures: [],
      attestations: [],
      policyCompliance: {
        minimumSignatures: false,
        attestationRequirements: false,
        algorithmRequirements: false,
        ageRequirements: false,
        publisherRequirements: false
      },
      trustScore: 0,
      warnings: [],
      errors: []
    };

    try {
      // Verify all signatures
      for (const signature of bundle.manifest.signatures) {
        const sigResult = await this.verifySignature(signature, contentAddress, context);
        result.signatures.push(sigResult);
      }

      // Verify all attestations
      if (bundle.attestations) {
        for (const attestation of bundle.attestations) {
          const attResult = await this.verifyAttestation(attestation, context);
          result.attestations.push(attResult);
        }
      }

      // Check policy compliance
      result.policyCompliance = this.checkPolicyCompliance(
        bundle.manifest.signatures,
        bundle.attestations || [],
        context.trustPolicy,
        context.currentTime || new Date()
      );

      // Calculate trust score
      result.trustScore = this.calculateTrustScore(result, context.trustPolicy);

      // Overall validity
      result.valid = this.determineOverallValidity(result, context.trustPolicy);

      return result;

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown verification error');
      return result;
    }
  }

  /**
   * Verify a single package signature
   */
  private async verifySignature(
    signature: PackageSignature,
    contentAddress: ContentAddress,
    context: VerificationContext
  ): Promise<{
    signature: PackageSignature;
    valid: boolean;
    trusted: boolean;
    error?: string;
    warnings: string[];
  }> {
    const warnings: string[] = [];
    
    try {
      // Import the public key
      const publicKey = await importJWK(signature.signer.publicKey, this.algorithm);
      
      // Verify the JWT signature
      const { payload } = await jwtVerify(signature.signature, publicKey, {
        issuer: signature.signer.id,
        audience: 'kgen-marketplace'
      });

      // Verify payload content matches expected values
      if (payload.sub !== contentAddress.value) {
        return {
          signature,
          valid: false,
          trusted: false,
          error: `Content hash mismatch: expected ${contentAddress.value}, got ${payload.sub}`,
          warnings
        };
      }

      // Check signature age
      const currentTime = context.currentTime || new Date();
      const signatureTime = new Date(signature.timestamp);
      const ageSeconds = (currentTime.getTime() - signatureTime.getTime()) / 1000;
      
      if (ageSeconds > context.trustPolicy.requirements.maxAge) {
        if (!context.allowExpired) {
          return {
            signature,
            valid: false,
            trusted: false,
            error: `Signature too old: ${ageSeconds} seconds (max ${context.trustPolicy.requirements.maxAge})`,
            warnings
          };
        } else {
          warnings.push(`Signature is expired but allowed by context`);
        }
      }

      // Check algorithm
      if (!context.trustPolicy.requirements.allowedAlgorithms.includes(signature.algorithm)) {
        return {
          signature,
          valid: false,
          trusted: false,
          error: `Algorithm ${signature.algorithm} not allowed by trust policy`,
          warnings
        };
      }

      // Check if key is trusted
      const trusted = this.isKeyTrusted(signature.keyFingerprint, context);
      if (!trusted && context.trustPolicy.requirements.requirePublisherVerification) {
        warnings.push('Signature key is not in trust policy');
      }

      return {
        signature,
        valid: true,
        trusted,
        warnings
      };

    } catch (error) {
      return {
        signature,
        valid: false,
        trusted: false,
        error: error instanceof Error ? error.message : 'Unknown signature verification error',
        warnings
      };
    }
  }

  /**
   * Verify a package attestation
   */
  private async verifyAttestation(
    attestation: PackageAttestation,
    context: VerificationContext
  ): Promise<{
    attestation: PackageAttestation;
    valid: boolean;
    trusted: boolean;
    error?: string;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    try {
      // Verify the attestation signature
      const sigResult = await this.verifySignature(
        attestation.signature,
        attestation.subject.contentAddress,
        context
      );

      if (!sigResult.valid) {
        return {
          attestation,
          valid: false,
          trusted: false,
          error: `Attestation signature invalid: ${sigResult.error}`,
          warnings: sigResult.warnings
        };
      }

      // Verify attestation chain if present
      if (attestation.chainOfTrust && attestation.chainOfTrust.length > 0) {
        const chainResult = await this.verifyAttestationChain(
          attestation.chainOfTrust,
          context
        );
        
        if (!chainResult.valid) {
          warnings.push(`Attestation chain verification failed: ${chainResult.errors.join(', ')}`);
        }
      }

      // Validate claims
      for (const claim of attestation.claims) {
        if (!this.validateClaim(claim, attestation.subject)) {
          warnings.push(`Invalid claim: ${claim.type} - ${claim.predicate}`);
        }
      }

      return {
        attestation,
        valid: sigResult.valid,
        trusted: sigResult.trusted,
        warnings: [...sigResult.warnings, ...warnings]
      };

    } catch (error) {
      return {
        attestation,
        valid: false,
        trusted: false,
        error: error instanceof Error ? error.message : 'Unknown attestation verification error',
        warnings
      };
    }
  }

  /**
   * Verify attestation chain of trust
   */
  private async verifyAttestationChain(
    chainOfTrust: string[],
    context: VerificationContext
  ): Promise<AttestationChainResult> {
    // This is a simplified implementation
    // In a real system, you would traverse the chain and verify each link
    
    return {
      valid: true, // Simplified - assume valid for now
      depth: chainOfTrust.length,
      path: chainOfTrust,
      rootAnchor: chainOfTrust[0],
      errors: []
    };
  }

  /**
   * Validate an attestation claim
   */
  private validateClaim(claim: any, subject: any): boolean {
    // Basic claim validation
    if (!claim.type || !claim.subject || !claim.predicate) {
      return false;
    }

    // Type-specific validation
    switch (claim.type) {
      case 'publisher-identity':
        return claim.subject === subject.name;
      case 'content-integrity':
        return claim.predicate.includes(subject.contentAddress.value);
      default:
        return true; // Unknown claim types are considered valid for now
    }
  }

  /**
   * Check if a key is trusted according to the trust policy
   */
  private isKeyTrusted(keyFingerprint: string, context: VerificationContext): boolean {
    // Check trust policy keys
    const trustedKey = context.trustPolicy.trustedKeys.find(
      key => key.fingerprint === keyFingerprint
    );

    if (trustedKey) {
      // Check key validity period
      const currentTime = context.currentTime || new Date();
      const validFrom = new Date(trustedKey.validFrom);
      const validUntil = trustedKey.validUntil ? new Date(trustedKey.validUntil) : null;

      if (currentTime < validFrom || (validUntil && currentTime > validUntil)) {
        return false;
      }

      return true;
    }

    // Check additional trusted keys from context
    if (context.additionalTrustedKeys) {
      return context.additionalTrustedKeys.some(key => key.fingerprint === keyFingerprint);
    }

    return false;
  }

  /**
   * Check compliance with trust policy requirements
   */
  private checkPolicyCompliance(
    signatures: PackageSignature[],
    attestations: PackageAttestation[],
    policy: TrustPolicy,
    currentTime: Date
  ): VerificationResult['policyCompliance'] {
    const validSignatures = signatures.filter(sig => {
      const sigTime = new Date(sig.timestamp);
      const age = (currentTime.getTime() - sigTime.getTime()) / 1000;
      return age <= policy.requirements.maxAge;
    });

    return {
      minimumSignatures: validSignatures.length >= policy.requirements.minimumSignatures,
      attestationRequirements: !policy.requirements.requireAttestations || 
        attestations.length > 0 && 
        policy.requirements.requiredAttestationTypes.every(type =>
          attestations.some(att => att.claims.some(claim => claim.type === type))
        ),
      algorithmRequirements: signatures.every(sig =>
        policy.requirements.allowedAlgorithms.includes(sig.algorithm)
      ),
      ageRequirements: validSignatures.length === signatures.length,
      publisherRequirements: !policy.requirements.requirePublisherVerification ||
        signatures.every(sig => 
          policy.trustedPublishers.some(pub => pub.id === sig.signer.id)
        )
    };
  }

  /**
   * Calculate overall trust score
   */
  private calculateTrustScore(result: VerificationResult, policy: TrustPolicy): number {
    let score = 0;
    let maxScore = 0;

    // Signature verification score
    const validSigs = result.signatures.filter(s => s.valid).length;
    const trustedSigs = result.signatures.filter(s => s.valid && s.trusted).length;
    
    if (result.signatures.length > 0) {
      score += (validSigs / result.signatures.length) * 0.3;
      score += (trustedSigs / result.signatures.length) * 0.2;
    }
    maxScore += 0.5;

    // Attestation score
    const validAtts = result.attestations.filter(a => a.valid).length;
    const trustedAtts = result.attestations.filter(a => a.valid && a.trusted).length;
    
    if (result.attestations.length > 0) {
      score += (validAtts / result.attestations.length) * 0.2;
      score += (trustedAtts / result.attestations.length) * 0.1;
    }
    maxScore += 0.3;

    // Policy compliance score
    const compliantFields = Object.values(result.policyCompliance).filter(Boolean).length;
    score += (compliantFields / 5) * 0.2;
    maxScore += 0.2;

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Determine overall validity based on trust policy
   */
  private determineOverallValidity(result: VerificationResult, policy: TrustPolicy): boolean {
    // All policy requirements must be met
    const policyMet = Object.values(result.policyCompliance).every(Boolean);
    
    // At least one valid signature required
    const hasValidSignature = result.signatures.some(s => s.valid);
    
    // No critical errors
    const noCriticalErrors = result.errors.length === 0;

    return policyMet && hasValidSignature && noCriticalErrors;
  }

  /**
   * Load trust policy from file
   */
  async loadTrustPolicy(policyPath: string): Promise<TrustPolicy> {
    try {
      const policyContent = await fs.readFile(policyPath, 'utf8');
      const policy = JSON.parse(policyContent) as TrustPolicy;
      
      // Validate policy structure
      if (!this.isValidTrustPolicy(policy)) {
        throw new Error('Invalid trust policy format');
      }

      return policy;
    } catch (error) {
      throw new Error(`Failed to load trust policy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate trust policy format
   */
  private isValidTrustPolicy(policy: any): policy is TrustPolicy {
    return (
      policy &&
      typeof policy.version === 'string' &&
      Array.isArray(policy.trustedPublishers) &&
      Array.isArray(policy.trustedKeys) &&
      policy.requirements &&
      typeof policy.requirements.minimumSignatures === 'number' &&
      typeof policy.requirements.requireAttestations === 'boolean' &&
      Array.isArray(policy.requirements.allowedAlgorithms) &&
      typeof policy.requirements.maxAge === 'number' &&
      policy.metadata
    );
  }
}

// ==============================================================================
// Utility Functions
// ==============================================================================

/**
 * Create a package verifier instance
 */
export function createPackageVerifier(): PackageVerifier {
  return new PackageVerifier();
}

/**
 * Verify a signature bundle with a single function call
 */
export async function verifyPackage(
  bundle: SignatureBundle,
  contentAddress: ContentAddress,
  trustPolicyPath: string
): Promise<VerificationResult> {
  const verifier = createPackageVerifier();
  const trustPolicy = await verifier.loadTrustPolicy(trustPolicyPath);
  
  return verifier.verifySignatureBundle(bundle, contentAddress, {
    trustPolicy
  });
}

/**
 * Create a default trust policy
 */
export function createDefaultTrustPolicy(): TrustPolicy {
  return {
    version: '1.0.0',
    trustedPublishers: [],
    trustedKeys: [],
    requirements: {
      minimumSignatures: 1,
      requireAttestations: false,
      allowedAlgorithms: ['EdDSA', 'ES256', 'RS256'],
      maxAge: 365 * 24 * 60 * 60, // 1 year
      requirePublisherVerification: false,
      requiredAttestationTypes: []
    },
    metadata: {
      name: 'Default KGEN Trust Policy',
      description: 'Default trust policy for KGEN marketplace packages',
      maintainer: 'kgen-system',
      lastUpdated: new Date().toISOString()
    }
  };
}

/**
 * Save trust policy to file
 */
export async function saveTrustPolicy(policy: TrustPolicy, policyPath: string): Promise<void> {
  await fs.mkdir(path.dirname(policyPath), { recursive: true });
  await fs.writeFile(policyPath, JSON.stringify(policy, null, 2));
}