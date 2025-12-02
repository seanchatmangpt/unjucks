/**
 * Trust verification system for package signatures and attestations
 */

import { createVerify, createHash, constants } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { RegistryPackage } from './adapter.js';

export interface TrustPolicy {
  version: string;
  trustedKeys: Array<{
    keyId: string;
    algorithm: string;
    publicKey: string;
    owner: string;
    scope?: string[];
    expires?: string;
  }>;
  requireSignature: boolean;
  allowedLicenses: string[];
  blockedPackages: string[];
  minimumTrustScore?: number;
  policies: Array<{
    scope?: string;
    author?: string;
    requireAttestation: boolean;
    requireMultipleSignatures?: boolean;
    minimumSignatures?: number;
  }>;
}

export interface VerificationResult {
  trusted: boolean;
  score: number;
  reasons: string[];
  signatures: Array<{
    valid: boolean;
    keyId: string;
    owner: string;
    timestamp: string;
  }>;
  license: {
    allowed: boolean;
    license: string;
  };
  blocked: boolean;
}

export class TrustVerifier {
  private trustPolicy: TrustPolicy;
  private trustedKeyCache = new Map<string, any>();

  constructor(trustPolicyPath?: string) {
    this.trustPolicy = this.loadTrustPolicy(trustPolicyPath);
  }

  /**
   * Verify a package against trust policy
   */
  async verifyPackage(pkg: RegistryPackage): Promise<VerificationResult> {
    const result: VerificationResult = {
      trusted: false,
      score: 0,
      reasons: [],
      signatures: [],
      license: {
        allowed: false,
        license: pkg.license || 'unknown',
      },
      blocked: false,
    };

    // Check if package is blocked
    if (this.isPackageBlocked(pkg.name)) {
      result.blocked = true;
      result.reasons.push('Package is in blocklist');
      return result;
    }

    // Verify license
    result.license = this.verifyLicense(pkg.license);
    if (!result.license.allowed) {
      result.reasons.push(`License '${pkg.license}' not in allowed list`);
    } else {
      result.score += 20;
    }

    // Get applicable policy
    const policy = this.getApplicablePolicy(pkg);

    // Verify signatures if present
    if (pkg.attestations?.length) {
      result.signatures = await this.verifySignatures(pkg);
      
      const validSignatures = result.signatures.filter(sig => sig.valid);
      if (validSignatures.length > 0) {
        result.score += validSignatures.length * 30;
        result.reasons.push(`${validSignatures.length} valid signature(s) found`);
      }

      // Check if minimum signatures requirement is met
      if (policy.minimumSignatures && validSignatures.length < policy.minimumSignatures) {
        result.reasons.push(`Requires ${policy.minimumSignatures} signatures, only ${validSignatures.length} found`);
      }
    } else if (policy.requireAttestation || this.trustPolicy.requireSignature) {
      result.reasons.push('No signatures found but signatures are required');
    }

    // Calculate final trust score
    if (pkg.repository?.url) {
      result.score += 10; // Has repository
    }
    if (pkg.description) {
      result.score += 5; // Has description
    }
    if (pkg.keywords?.length) {
      result.score += 5; // Has keywords
    }

    // Determine if trusted
    const minimumScore = this.trustPolicy.minimumTrustScore || 50;
    result.trusted = result.score >= minimumScore && 
                     result.license.allowed && 
                     !result.blocked &&
                     (!policy.requireAttestation || result.signatures.some(s => s.valid));

    if (result.trusted) {
      result.reasons.unshift('Package meets trust requirements');
    }

    return result;
  }

  /**
   * Verify package signatures
   */
  private async verifySignatures(pkg: RegistryPackage): Promise<VerificationResult['signatures']> {
    if (!pkg.attestations?.length) {
      return [];
    }

    const signatures = [];
    for (const attestation of pkg.attestations) {
      const trustedKey = this.getTrustedKey(attestation.keyId);
      if (!trustedKey) {
        signatures.push({
          valid: false,
          keyId: attestation.keyId,
          owner: 'unknown',
          timestamp: attestation.timestamp,
        });
        continue;
      }

      // Verify signature
      const packageData = JSON.stringify({
        name: pkg.name,
        version: pkg.version,
        dist: pkg.dist,
      });

      const valid = await this.verifySignature(
        packageData,
        attestation.signature,
        trustedKey.publicKey,
        trustedKey.algorithm
      );

      signatures.push({
        valid,
        keyId: attestation.keyId,
        owner: trustedKey.owner,
        timestamp: attestation.timestamp,
      });
    }

    return signatures;
  }

  /**
   * Verify a cryptographic signature
   */
  private async verifySignature(
    data: string,
    signature: string,
    publicKey: string,
    algorithm: string = 'RSA-SHA256'
  ): Promise<boolean> {
    try {
      const verifier = createVerify(algorithm);
      verifier.update(data);
      return verifier.verify(publicKey, signature, 'base64');
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Verify package license
   */
  private verifyLicense(license?: string): { allowed: boolean; license: string } {
    const packageLicense = license || 'unknown';
    const allowed = this.trustPolicy.allowedLicenses.includes(packageLicense) ||
                    this.trustPolicy.allowedLicenses.includes('*');

    return {
      allowed,
      license: packageLicense,
    };
  }

  /**
   * Check if package is blocked
   */
  private isPackageBlocked(packageName: string): boolean {
    return this.trustPolicy.blockedPackages.some(blocked => {
      if (blocked.includes('*')) {
        const pattern = blocked.replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`).test(packageName);
      }
      return blocked === packageName;
    });
  }

  /**
   * Get applicable policy for package
   */
  private getApplicablePolicy(pkg: RegistryPackage) {
    // Find most specific policy
    for (const policy of this.trustPolicy.policies) {
      if (policy.scope && !pkg.name.startsWith(policy.scope)) {
        continue;
      }
      if (policy.author && pkg.author !== policy.author) {
        continue;
      }
      return policy;
    }

    // Return default policy
    return {
      requireAttestation: this.trustPolicy.requireSignature,
      requireMultipleSignatures: false,
      minimumSignatures: 1,
    };
  }

  /**
   * Get trusted key by ID
   */
  private getTrustedKey(keyId: string) {
    if (this.trustedKeyCache.has(keyId)) {
      return this.trustedKeyCache.get(keyId);
    }

    const key = this.trustPolicy.trustedKeys.find(k => k.keyId === keyId);
    if (key) {
      // Check if key is expired
      if (key.expires && new Date(key.expires) < new Date()) {
        return null;
      }
      this.trustedKeyCache.set(keyId, key);
    }

    return key;
  }

  /**
   * Load trust policy from file
   */
  private loadTrustPolicy(policyPath?: string): TrustPolicy {
    const defaultPolicy: TrustPolicy = {
      version: '1.0.0',
      trustedKeys: [],
      requireSignature: false,
      allowedLicenses: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'GPL-3.0'],
      blockedPackages: [],
      minimumTrustScore: 50,
      policies: [],
    };

    if (!policyPath) {
      // Try to find trust-policy.json in common locations
      const possiblePaths = [
        './trust-policy.json',
        './.kgen/trust-policy.json',
        './config/trust-policy.json',
      ];

      for (const path of possiblePaths) {
        try {
          const content = readFileSync(path, 'utf8');
          return { ...defaultPolicy, ...JSON.parse(content) };
        } catch {
          // Continue to next path
        }
      }

      return defaultPolicy;
    }

    try {
      const content = readFileSync(policyPath, 'utf8');
      return { ...defaultPolicy, ...JSON.parse(content) };
    } catch (error) {
      console.warn(`Failed to load trust policy from ${policyPath}:`, error);
      return defaultPolicy;
    }
  }

  /**
   * Create a signature for a package
   */
  static async createSignature(
    packageData: any,
    privateKey: string,
    keyId: string,
    algorithm: string = 'RSA-SHA256'
  ): Promise<{ signature: string; keyId: string; timestamp: string }> {
    const data = JSON.stringify({
      name: packageData.name,
      version: packageData.version,
      dist: packageData.dist,
    });

    const sign = require('crypto').createSign(algorithm);
    sign.update(data);
    const signature = sign.sign(privateKey, 'base64');

    return {
      signature,
      keyId,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate a trust policy template
   */
  static generateTrustPolicyTemplate(): TrustPolicy {
    return {
      version: '1.0.0',
      trustedKeys: [
        {
          keyId: 'example-key-1',
          algorithm: 'RSA-SHA256',
          publicKey: '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----',
          owner: 'your-organization',
          scope: ['@your-org'],
          expires: '2025-12-31T23:59:59Z',
        },
      ],
      requireSignature: false,
      allowedLicenses: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC'],
      blockedPackages: ['malicious-package', '@bad-actor/*'],
      minimumTrustScore: 60,
      policies: [
        {
          scope: '@your-org',
          requireAttestation: true,
          minimumSignatures: 1,
        },
        {
          author: 'trusted-maintainer',
          requireAttestation: false,
        },
      ],
    };
  }
}

/**
 * Utility functions for trust management
 */
export class TrustUtils {
  /**
   * Calculate package trust score based on metadata
   */
  static calculatePackageScore(pkg: RegistryPackage): number {
    let score = 0;

    // Basic package info
    if (pkg.description) score += 10;
    if (pkg.license) score += 15;
    if (pkg.keywords?.length) score += 5;
    if (pkg.repository?.url) score += 15;
    if (pkg.author) score += 10;

    // Signature verification
    if (pkg.attestations?.length) {
      score += pkg.attestations.length * 25;
    }

    // Package naming
    if (pkg.name.includes('/')) score += 5; // Scoped package
    if (!pkg.name.includes('-')) score -= 5; // No hyphens (less descriptive)

    return Math.min(score, 100);
  }

  /**
   * Check if license is OSI approved
   */
  static isOsiApprovedLicense(license: string): boolean {
    const osiLicenses = [
      'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'GPL-2.0',
      'GPL-3.0', 'LGPL-2.1', 'LGPL-3.0', 'ISC', 'MPL-2.0',
    ];
    return osiLicenses.includes(license);
  }

  /**
   * Validate package name for security
   */
  static validatePackageName(name: string): { valid: boolean; reasons: string[] } {
    const reasons: string[] = [];
    let valid = true;

    // Check for suspicious patterns
    if (name.includes('..')) {
      valid = false;
      reasons.push('Package name contains path traversal pattern');
    }

    if (name.length > 214) {
      valid = false;
      reasons.push('Package name too long');
    }

    if (!/^[@a-z0-9][a-z0-9\-_.]*$/.test(name)) {
      valid = false;
      reasons.push('Package name contains invalid characters');
    }

    // Check for typosquatting patterns
    const suspiciousPatterns = [
      /^[a-z]{1,3}[0-9]+$/, // Very short name with numbers
      /(.)\1{3,}/, // Repeated characters
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(name)) {
        reasons.push('Package name matches suspicious pattern');
        break;
      }
    }

    return { valid, reasons };
  }
}