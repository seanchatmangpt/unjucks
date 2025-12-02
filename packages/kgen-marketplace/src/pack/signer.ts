/**
 * @fileoverview Package signing and attestation service for KGEN Marketplace
 * @version 1.0.0
 * @description Signs packages with jose (JWS + Ed25519) and generates attestations
 */

import { SignJWT, jwtVerify, generateKeyPair, exportJWK, importJWK } from 'jose';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { KPackManifest, ContentAddress } from '../types/kpack.js';

// ==============================================================================
// Types and Interfaces
// ==============================================================================

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyJWK: any;
  privateKeyJWK: any;
  fingerprint: string;
}

export interface SigningOptions {
  /** Private key for signing */
  privateKey: CryptoKey;
  /** Publisher ID */
  publisherId: string;
  /** Package content address */
  contentAddress: ContentAddress;
  /** Package manifest */
  manifest: KPackManifest;
  /** Additional metadata */
  metadata?: Record<string, any>;
  /** Timestamp override */
  timestamp?: Date;
}

export interface PackageSignature {
  /** JWS signature */
  signature: string;
  /** Signing algorithm */
  algorithm: string;
  /** Public key fingerprint */
  keyFingerprint: string;
  /** Signature timestamp */
  timestamp: string;
  /** Signed content hash */
  contentHash: string;
  /** Signer identity */
  signer: {
    id: string;
    publicKey: any; // JWK format
  };
}

export interface AttestationClaim {
  /** Claim type */
  type: string;
  /** Claim subject (what is being attested) */
  subject: string;
  /** Claim predicate (what is claimed) */
  predicate: string;
  /** Evidence supporting the claim */
  evidence?: {
    type: string;
    value: any;
    source?: string;
  }[];
  /** Claim confidence (0.0 - 1.0) */
  confidence?: number;
}

export interface PackageAttestation {
  /** Attestation ID */
  id: string;
  /** Attestation type */
  type: string;
  /** Subject of attestation (package) */
  subject: {
    contentAddress: ContentAddress;
    name: string;
    version: string;
  };
  /** Claims made in this attestation */
  claims: AttestationClaim[];
  /** Attestation signature */
  signature: PackageSignature;
  /** Attestation timestamp */
  timestamp: string;
  /** Chain of trust references */
  chainOfTrust?: string[];
}

export interface SignatureBundle {
  /** Package manifest with signatures */
  manifest: KPackManifest & {
    signatures: PackageSignature[];
    attestations?: PackageAttestation[];
  };
  /** Primary signature */
  primarySignature: PackageSignature;
  /** Additional signatures */
  additionalSignatures?: PackageSignature[];
  /** Package attestations */
  attestations: PackageAttestation[];
}

// ==============================================================================
// Package Signer
// ==============================================================================

export class PackageSigner {
  private readonly algorithm = 'EdDSA';
  private readonly curve = 'Ed25519';

  /**
   * Generate a new Ed25519 key pair for signing
   */
  async generateKeyPair(): Promise<KeyPair> {
    const { publicKey, privateKey } = await generateKeyPair(this.algorithm, {
      extractable: true
    });

    const publicKeyJWK = await exportJWK(publicKey);
    const privateKeyJWK = await exportJWK(privateKey);

    // Generate key fingerprint
    const fingerprint = await this.generateKeyFingerprint(publicKeyJWK);

    return {
      publicKey: publicKey as CryptoKey,
      privateKey: privateKey as CryptoKey,
      publicKeyJWK,
      privateKeyJWK,
      fingerprint
    };
  }

  /**
   * Import key pair from JWK format
   */
  async importKeyPair(publicKeyJWK: any, privateKeyJWK?: any): Promise<KeyPair> {
    const publicKey = await importJWK(publicKeyJWK, this.algorithm);
    const privateKey = privateKeyJWK ? await importJWK(privateKeyJWK, this.algorithm) : null;

    const fingerprint = await this.generateKeyFingerprint(publicKeyJWK);

    return {
      publicKey: publicKey as CryptoKey,
      privateKey: privateKey as CryptoKey,
      publicKeyJWK,
      privateKeyJWK,
      fingerprint
    };
  }

  /**
   * Generate key fingerprint from public key
   */
  private async generateKeyFingerprint(publicKeyJWK: any): Promise<string> {
    const keyString = JSON.stringify(publicKeyJWK, Object.keys(publicKeyJWK).sort());
    return crypto.createHash('sha256').update(keyString).digest('hex').substring(0, 16);
  }

  /**
   * Sign a package
   */
  async signPackage(options: SigningOptions): Promise<PackageSignature> {
    const timestamp = options.timestamp || new Date();
    
    // Create signing payload
    const payload = {
      iss: options.publisherId, // Issuer
      sub: options.contentAddress.value, // Subject (package hash)
      aud: 'kgen-marketplace', // Audience
      iat: Math.floor(timestamp.getTime() / 1000), // Issued at
      exp: Math.floor((timestamp.getTime() + 365 * 24 * 60 * 60 * 1000) / 1000), // Expires in 1 year
      
      // Package-specific claims
      pkg: {
        name: options.manifest.name,
        version: options.manifest.version,
        contentAddress: options.contentAddress,
        publisherId: options.publisherId
      },

      // Additional metadata
      metadata: options.metadata || {}
    };

    // Create and sign JWT
    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: this.algorithm })
      .setIssuedAt()
      .setExpirationTime('1y')
      .sign(options.privateKey);

    // Get public key JWK for signature
    const publicKeyJWK = await exportJWK(options.privateKey);
    const keyFingerprint = await this.generateKeyFingerprint(publicKeyJWK);

    return {
      signature: jwt,
      algorithm: this.algorithm,
      keyFingerprint,
      timestamp: timestamp.toISOString(),
      contentHash: options.contentAddress.value,
      signer: {
        id: options.publisherId,
        publicKey: publicKeyJWK
      }
    };
  }

  /**
   * Create package attestation
   */
  async createAttestation(
    packageInfo: {
      contentAddress: ContentAddress;
      name: string;
      version: string;
    },
    claims: AttestationClaim[],
    signingOptions: Omit<SigningOptions, 'contentAddress' | 'manifest'>
  ): Promise<PackageAttestation> {
    const attestationId = crypto.randomUUID();
    const timestamp = new Date();

    // Create mock manifest for signing
    const mockManifest: Partial<KPackManifest> = {
      name: packageInfo.name,
      version: packageInfo.version
    };

    // Sign the attestation
    const signature = await this.signPackage({
      ...signingOptions,
      contentAddress: packageInfo.contentAddress,
      manifest: mockManifest as KPackManifest,
      metadata: {
        type: 'attestation',
        attestationId,
        claims: claims.map(c => ({ type: c.type, subject: c.subject, predicate: c.predicate }))
      },
      timestamp
    });

    return {
      id: attestationId,
      type: 'package-attestation',
      subject: packageInfo,
      claims,
      signature,
      timestamp: timestamp.toISOString(),
      chainOfTrust: []
    };
  }

  /**
   * Create signature bundle for a package
   */
  async createSignatureBundle(
    manifest: KPackManifest,
    primarySigningOptions: SigningOptions,
    additionalSigningOptions?: SigningOptions[]
  ): Promise<SignatureBundle> {
    // Create primary signature
    const primarySignature = await this.signPackage(primarySigningOptions);

    // Create additional signatures if provided
    const additionalSignatures: PackageSignature[] = [];
    if (additionalSigningOptions) {
      for (const options of additionalSigningOptions) {
        const signature = await this.signPackage(options);
        additionalSignatures.push(signature);
      }
    }

    // Combine all signatures
    const allSignatures = [primarySignature, ...additionalSignatures];

    // Create attestations
    const attestations = await this.createDefaultAttestations(
      manifest,
      primarySigningOptions
    );

    // Create enhanced manifest with signatures
    const enhancedManifest: KPackManifest & { signatures: PackageSignature[]; attestations?: PackageAttestation[] } = {
      ...manifest,
      signatures: allSignatures,
      attestations
    };

    return {
      manifest: enhancedManifest,
      primarySignature,
      additionalSignatures: additionalSignatures.length > 0 ? additionalSignatures : undefined,
      attestations
    };
  }

  /**
   * Create default attestations for a package
   */
  private async createDefaultAttestations(
    manifest: KPackManifest,
    signingOptions: SigningOptions
  ): Promise<PackageAttestation[]> {
    const attestations: PackageAttestation[] = [];

    // Publisher identity attestation
    const publisherAttestation = await this.createAttestation(
      {
        contentAddress: signingOptions.contentAddress,
        name: manifest.name,
        version: manifest.version
      },
      [{
        type: 'publisher-identity',
        subject: manifest.name,
        predicate: `is-published-by:${signingOptions.publisherId}`,
        evidence: [{
          type: 'cryptographic-signature',
          value: signingOptions.publisherId,
          source: 'self-attested'
        }],
        confidence: 1.0
      }],
      {
        privateKey: signingOptions.privateKey,
        publisherId: signingOptions.publisherId
      }
    );

    attestations.push(publisherAttestation);

    // Content integrity attestation
    const integrityAttestation = await this.createAttestation(
      {
        contentAddress: signingOptions.contentAddress,
        name: manifest.name,
        version: manifest.version
      },
      [{
        type: 'content-integrity',
        subject: manifest.name,
        predicate: `has-content-hash:${signingOptions.contentAddress.value}`,
        evidence: [{
          type: 'cryptographic-hash',
          value: {
            algorithm: signingOptions.contentAddress.type,
            hash: signingOptions.contentAddress.value,
            size: signingOptions.contentAddress.size
          },
          source: 'computed'
        }],
        confidence: 1.0
      }],
      {
        privateKey: signingOptions.privateKey,
        publisherId: signingOptions.publisherId
      }
    );

    attestations.push(integrityAttestation);

    return attestations;
  }

  /**
   * Save key pair to files
   */
  async saveKeyPair(keyPair: KeyPair, basePath: string): Promise<void> {
    await fs.mkdir(path.dirname(basePath), { recursive: true });

    // Save public key
    const publicKeyPath = `${basePath}.pub.json`;
    await fs.writeFile(
      publicKeyPath,
      JSON.stringify({
        ...keyPair.publicKeyJWK,
        fingerprint: keyPair.fingerprint,
        algorithm: this.algorithm
      }, null, 2)
    );

    // Save private key
    const privateKeyPath = `${basePath}.priv.json`;
    await fs.writeFile(
      privateKeyPath,
      JSON.stringify({
        ...keyPair.privateKeyJWK,
        fingerprint: keyPair.fingerprint,
        algorithm: this.algorithm
      }, null, 2)
    );

    // Set appropriate permissions (Unix only)
    if (process.platform !== 'win32') {
      await fs.chmod(privateKeyPath, 0o600); // Private key readable only by owner
      await fs.chmod(publicKeyPath, 0o644);  // Public key readable by all
    }
  }

  /**
   * Load key pair from files
   */
  async loadKeyPair(basePath: string): Promise<KeyPair> {
    const publicKeyPath = `${basePath}.pub.json`;
    const privateKeyPath = `${basePath}.priv.json`;

    try {
      const publicKeyData = JSON.parse(await fs.readFile(publicKeyPath, 'utf8'));
      const privateKeyData = JSON.parse(await fs.readFile(privateKeyPath, 'utf8'));

      return this.importKeyPair(publicKeyData, privateKeyData);
    } catch (error) {
      throw new Error(`Failed to load key pair: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// ==============================================================================
// Utility Functions
// ==============================================================================

/**
 * Create a package signer instance
 */
export function createPackageSigner(): PackageSigner {
  return new PackageSigner();
}

/**
 * Sign a package with a single function call
 */
export async function signPackage(options: SigningOptions): Promise<PackageSignature> {
  const signer = createPackageSigner();
  return signer.signPackage(options);
}

/**
 * Generate a new signing key pair
 */
export async function generateSigningKeyPair(): Promise<KeyPair> {
  const signer = createPackageSigner();
  return signer.generateKeyPair();
}

/**
 * Create a complete signature bundle for a package
 */
export async function createPackageSignatureBundle(
  manifest: KPackManifest,
  contentAddress: ContentAddress,
  privateKey: CryptoKey,
  publisherId: string
): Promise<SignatureBundle> {
  const signer = createPackageSigner();
  
  const signingOptions: SigningOptions = {
    privateKey,
    publisherId,
    contentAddress,
    manifest
  };

  return signer.createSignatureBundle(manifest, signingOptions);
}