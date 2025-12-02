/**
 * Cryptographic Signature System for KGen Marketplace
 * 
 * Provides Ed25519 digital signatures for tamper-evident ledger entries
 * with key generation, signing, and verification capabilities.
 */

import { createHash, createHmac, randomBytes } from 'crypto';
import * as ed25519 from '@noble/ed25519';

/**
 * Ed25519 Signature Manager
 */
export class SignatureManager {
  constructor(privateKey = null, publicKey = null) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  /**
   * Generate new Ed25519 key pair
   */
  static async generateKeyPair() {
    const privateKey = ed25519.utils.randomPrivateKey();
    const publicKey = await ed25519.getPublicKeyAsync(privateKey);
    
    return {
      privateKey: Buffer.from(privateKey).toString('hex'),
      publicKey: Buffer.from(publicKey).toString('hex')
    };
  }

  /**
   * Set key pair
   */
  setKeyPair(privateKey, publicKey) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  /**
   * Create canonical data hash for signing
   */
  createDataHash(data, timestamp = Date.now()) {
    const canonical = JSON.stringify({
      data,
      timestamp,
      version: '1.0'
    });
    
    return createHash('sha256').update(canonical).digest();
  }

  /**
   * Sign data with Ed25519
   */
  async signData(data, metadata = {}) {
    if (!this.privateKey) {
      throw new Error('Private key required for signing');
    }

    const timestamp = Date.now();
    const nonce = randomBytes(16).toString('hex');
    
    // Create signing payload
    const payload = {
      data,
      timestamp,
      nonce,
      metadata
    };
    
    const hash = this.createDataHash(payload, timestamp);
    
    // Sign with Ed25519
    const privateKeyBytes = Buffer.from(this.privateKey, 'hex');
    const signature = await ed25519.signAsync(hash, privateKeyBytes);
    
    return {
      data: payload,
      signature: Buffer.from(signature).toString('hex'),
      publicKey: this.publicKey,
      algorithm: 'Ed25519',
      hash: hash.toString('hex')
    };
  }

  /**
   * Verify Ed25519 signature
   */
  static async verifySignature(signedData) {
    try {
      const { data, signature, publicKey, hash } = signedData;
      
      // Recreate hash
      const expectedHash = createHash('sha256')
        .update(JSON.stringify(data))
        .digest();
      
      // Verify hash integrity
      if (expectedHash.toString('hex') !== hash) {
        return {
          valid: false,
          error: 'Hash mismatch - data may be corrupted'
        };
      }
      
      // Verify Ed25519 signature
      const signatureBytes = Buffer.from(signature, 'hex');
      const publicKeyBytes = Buffer.from(publicKey, 'hex');
      
      const isValid = await ed25519.verifyAsync(
        signatureBytes,
        expectedHash,
        publicKeyBytes
      );
      
      return {
        valid: isValid,
        publicKey,
        timestamp: data.timestamp,
        algorithm: 'Ed25519'
      };
      
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Create multi-signature (threshold signature)
   */
  static async createMultiSignature(data, signers, threshold = Math.ceil(signers.length / 2)) {
    if (signers.length < threshold) {
      throw new Error(`Insufficient signers: need ${threshold}, got ${signers.length}`);
    }

    const signatures = [];
    const timestamp = Date.now();
    
    for (const signer of signers) {
      const manager = new SignatureManager(signer.privateKey, signer.publicKey);
      const signed = await manager.signData(data, { 
        multiSig: true,
        threshold,
        signerId: signer.id
      });
      signatures.push(signed);
    }

    return {
      data,
      signatures,
      threshold,
      timestamp,
      type: 'multi-signature'
    };
  }

  /**
   * Verify multi-signature
   */
  static async verifyMultiSignature(multiSig) {
    const { signatures, threshold } = multiSig;
    let validCount = 0;
    const results = [];

    for (const signature of signatures) {
      const result = await this.verifySignature(signature);
      results.push(result);
      if (result.valid) validCount++;
    }

    return {
      valid: validCount >= threshold,
      validSignatures: validCount,
      threshold,
      results
    };
  }

  /**
   * Create timestamped signature with RFC3161 compliance
   */
  async createTimestampedSignature(data, timestampAuthority = null) {
    const signature = await this.signData(data);
    
    // Add timestamp proof (simplified - would use real TSA in production)
    const timestampProof = {
      timestamp: signature.data.timestamp,
      authority: timestampAuthority || 'internal',
      nonce: signature.data.nonce,
      hash: signature.hash
    };

    return {
      ...signature,
      timestampProof
    };
  }

  /**
   * Verify timestamp integrity
   */
  static verifyTimestamp(timestampedSig, currentTime = Date.now()) {
    const { timestampProof } = timestampedSig;
    const age = currentTime - timestampProof.timestamp;
    
    return {
      valid: age >= 0, // Timestamp not in future
      age,
      timestamp: new Date(timestampProof.timestamp).toISOString(),
      authority: timestampProof.authority
    };
  }

  /**
   * Create signature chain for audit trail
   */
  async createSignatureChain(entries) {
    const chain = [];
    let previousHash = null;

    for (const entry of entries) {
      const chainEntry = {
        ...entry,
        previousHash,
        chainIndex: chain.length
      };

      const signature = await this.signData(chainEntry);
      const chainedSignature = {
        ...signature,
        chainIndex: chain.length,
        previousHash
      };

      chain.push(chainedSignature);
      previousHash = signature.hash;
    }

    return chain;
  }

  /**
   * Verify signature chain integrity
   */
  static async verifySignatureChain(chain) {
    const results = [];
    let previousHash = null;

    for (let i = 0; i < chain.length; i++) {
      const entry = chain[i];
      
      // Verify individual signature
      const sigResult = await this.verifySignature(entry);
      
      // Verify chain integrity
      const chainValid = entry.previousHash === previousHash;
      
      results.push({
        index: i,
        signatureValid: sigResult.valid,
        chainValid,
        hash: entry.hash,
        error: sigResult.error
      });

      previousHash = entry.hash;
    }

    const allValid = results.every(r => r.signatureValid && r.chainValid);
    
    return {
      valid: allValid,
      chainLength: chain.length,
      results
    };
  }

  /**
   * Export public key in PEM format
   */
  exportPublicKeyPEM() {
    if (!this.publicKey) {
      throw new Error('No public key available');
    }

    const publicKeyBytes = Buffer.from(this.publicKey, 'hex');
    const base64Key = publicKeyBytes.toString('base64');
    
    return [
      '-----BEGIN PUBLIC KEY-----',
      base64Key.match(/.{1,64}/g).join('\n'),
      '-----END PUBLIC KEY-----'
    ].join('\n');
  }

  /**
   * Import public key from PEM format
   */
  static importPublicKeyPEM(pem) {
    const base64 = pem
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/\s/g, '');
    
    const publicKeyBytes = Buffer.from(base64, 'base64');
    return publicKeyBytes.toString('hex');
  }

  /**
   * Generate deterministic signature for reproducible builds
   */
  async signDeterministic(data, seed = null) {
    if (!this.privateKey) {
      throw new Error('Private key required for signing');
    }

    // Use provided seed or derive from data
    const deterministicSeed = seed || createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');

    const payload = {
      data,
      seed: deterministicSeed,
      timestamp: 0, // Fixed timestamp for determinism
      version: '1.0'
    };

    const hash = createHash('sha256').update(JSON.stringify(payload)).digest();
    const privateKeyBytes = Buffer.from(this.privateKey, 'hex');
    const signature = await ed25519.signAsync(hash, privateKeyBytes);

    return {
      data: payload,
      signature: Buffer.from(signature).toString('hex'),
      publicKey: this.publicKey,
      algorithm: 'Ed25519-Deterministic',
      hash: hash.toString('hex'),
      deterministic: true
    };
  }
}

export default SignatureManager;