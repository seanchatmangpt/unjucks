/**
 * Identity Management System
 * Handles key generation, storage, rotation, and HSM integration
 */

import { randomBytes, createHash, pbkdf2 } from 'crypto';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import forge from 'node-forge';
import * as ed25519 from '@noble/ed25519';

const pbkdf2Async = promisify(pbkdf2);

/**
 * Identity Manager with HSM Support
 * Manages cryptographic identities with hardware security module integration
 */
export class IdentityManager {
  constructor(options = {}) {
    this.keyStorePath = options.keyStorePath || '.kgen/keys';
    this.hsmEnabled = options.hsmEnabled || false;
    this.hsmLibPath = options.hsmLibPath;
    this.hsmSlot = options.hsmSlot || 0;
    this.identities = new Map();
    this.keyRotationPeriod = options.keyRotationPeriod || 365 * 24 * 60 * 60 * 1000; // 1 year
  }

  /**
   * Initialize identity manager
   */
  async initialize() {
    await fs.ensureDir(this.keyStorePath);
    await fs.ensureDir(path.join(this.keyStorePath, 'active'));
    await fs.ensureDir(path.join(this.keyStorePath, 'rotated'));
    await fs.ensureDir(path.join(this.keyStorePath, 'revoked'));
    
    if (this.hsmEnabled) {
      await this.initializeHSM();
    }
    
    await this.loadIdentities();
  }

  /**
   * Generate a new cryptographic identity
   */
  async generateIdentity(options = {}) {
    const identityId = options.identityId || this.generateIdentityId();
    const keyType = options.keyType || 'Ed25519';
    const algorithm = options.algorithm || 'EdDSA';
    
    let keyPair;
    if (this.hsmEnabled && options.useHSM !== false) {
      keyPair = await this.generateHSMKeyPair(keyType, identityId);
    } else {
      keyPair = await this.generateSoftwareKeyPair(keyType);
    }

    const identity = {
      id: identityId,
      keyType,
      algorithm,
      created: new Date().toISOString(),
      status: 'active',
      keyPair,
      hsmBacked: this.hsmEnabled && options.useHSM !== false,
      version: 1,
      rotationSchedule: {
        nextRotation: new Date(Date.now() + this.keyRotationPeriod).toISOString(),
        autoRotate: options.autoRotate !== false
      },
      metadata: {
        purpose: options.purpose || 'signing',
        description: options.description,
        tags: options.tags || []
      }
    };

    await this.storeIdentity(identity);
    this.identities.set(identityId, identity);
    
    return identity;
  }

  /**
   * Generate software-based key pair
   */
  async generateSoftwareKeyPair(keyType) {
    switch (keyType) {
      case 'Ed25519':
        const privateKey = ed25519.utils.randomSecretKey();
        const publicKey = await ed25519.getPublicKey(privateKey);
        return {
          privateKey: Buffer.from(privateKey).toString('hex'),
          publicKey: Buffer.from(publicKey).toString('hex'),
          type: 'software'
        };

      case 'RSA':
        const keyPair = forge.pki.rsa.generateKeyPair(2048);
        return {
          privateKey: forge.pki.privateKeyToPem(keyPair.privateKey),
          publicKey: forge.pki.publicKeyToPem(keyPair.publicKey),
          type: 'software'
        };

      default:
        throw new Error(`Unsupported key type: ${keyType}`);
    }
  }

  /**
   * Generate HSM-backed key pair
   */
  async generateHSMKeyPair(keyType, identityId) {
    if (!this.hsmEnabled) {
      throw new Error('HSM not enabled');
    }

    // Mock HSM implementation - in production this would use PKCS#11
    const mockHSMKeyPair = {
      privateKeyHandle: `hsm_handle_${identityId}_${Date.now()}`,
      publicKey: await this.generateSoftwareKeyPair(keyType).then(kp => kp.publicKey),
      type: 'hsm',
      slot: this.hsmSlot,
      mechanism: keyType === 'Ed25519' ? 'CKM_EDDSA' : 'CKM_RSA_PKCS'
    };

    return mockHSMKeyPair;
  }

  /**
   * Initialize HSM connection
   */
  async initializeHSM() {
    // Mock HSM initialization - in production this would:
    // 1. Load PKCS#11 library
    // 2. Initialize token
    // 3. Authenticate with PIN
    // 4. Discover available mechanisms
    
    console.log('Initializing HSM connection...');
    
    // Mock HSM info
    this.hsmInfo = {
      library: this.hsmLibPath || '/usr/lib/pkcs11/mock.so',
      slot: this.hsmSlot,
      tokenLabel: 'KGEN_TOKEN',
      mechanisms: ['CKM_EDDSA', 'CKM_RSA_PKCS', 'CKM_SHA256'],
      initialized: true
    };
    
    console.log('HSM initialized:', this.hsmInfo);
  }

  /**
   * Rotate an identity's keys
   */
  async rotateIdentity(identityId, options = {}) {
    const identity = this.identities.get(identityId);
    if (!identity) {
      throw new Error(`Identity not found: ${identityId}`);
    }

    if (identity.status !== 'active') {
      throw new Error(`Cannot rotate non-active identity: ${identityId}`);
    }

    // Store old key pair in rotated directory
    const oldKeyPath = path.join(this.keyStorePath, 'rotated', `${identityId}_v${identity.version}.json`);
    const oldIdentity = { ...identity, status: 'rotated', rotatedAt: new Date().toISOString() };
    await fs.writeJson(oldKeyPath, oldIdentity, { spaces: 2 });

    // Generate new key pair
    let newKeyPair;
    if (identity.hsmBacked) {
      newKeyPair = await this.generateHSMKeyPair(identity.keyType, identityId);
    } else {
      newKeyPair = await this.generateSoftwareKeyPair(identity.keyType);
    }

    // Update identity with new keys
    const updatedIdentity = {
      ...identity,
      keyPair: newKeyPair,
      version: identity.version + 1,
      lastRotated: new Date().toISOString(),
      rotationSchedule: {
        ...identity.rotationSchedule,
        nextRotation: new Date(Date.now() + this.keyRotationPeriod).toISOString()
      }
    };

    await this.storeIdentity(updatedIdentity);
    this.identities.set(identityId, updatedIdentity);

    return {
      identityId,
      oldVersion: identity.version,
      newVersion: updatedIdentity.version,
      rotatedAt: updatedIdentity.lastRotated
    };
  }

  /**
   * Revoke an identity
   */
  async revokeIdentity(identityId, reason = 'Manual revocation') {
    const identity = this.identities.get(identityId);
    if (!identity) {
      throw new Error(`Identity not found: ${identityId}`);
    }

    const revokedIdentity = {
      ...identity,
      status: 'revoked',
      revokedAt: new Date().toISOString(),
      revocationReason: reason
    };

    // Move to revoked directory
    const revokedPath = path.join(this.keyStorePath, 'revoked', `${identityId}.json`);
    await fs.writeJson(revokedPath, revokedIdentity, { spaces: 2 });

    // Remove from active storage
    const activePath = path.join(this.keyStorePath, 'active', `${identityId}.json`);
    await fs.remove(activePath).catch(() => {}); // Ignore if not exists

    this.identities.set(identityId, revokedIdentity);

    return {
      identityId,
      status: 'revoked',
      revokedAt: revokedIdentity.revokedAt,
      reason
    };
  }

  /**
   * Sign data with an identity
   */
  async signWithIdentity(identityId, data) {
    const identity = this.identities.get(identityId);
    if (!identity) {
      throw new Error(`Identity not found: ${identityId}`);
    }

    if (identity.status !== 'active') {
      throw new Error(`Cannot sign with non-active identity: ${identityId}`);
    }

    const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const dataHash = createHash('sha256').update(dataBuffer).digest();

    let signature;
    if (identity.hsmBacked) {
      signature = await this.signWithHSM(identity.keyPair.privateKeyHandle, dataHash, identity.keyType);
    } else {
      signature = await this.signWithSoftwareKey(identity.keyPair, dataHash, identity.keyType);
    }

    return {
      signature,
      algorithm: identity.algorithm,
      keyType: identity.keyType,
      identityId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Sign with software key
   */
  async signWithSoftwareKey(keyPair, dataHash, keyType) {
    switch (keyType) {
      case 'Ed25519':
        const privateKey = Buffer.from(keyPair.privateKey, 'hex');
        return await ed25519.sign(dataHash, privateKey);

      case 'RSA':
        const rsaPrivateKey = forge.pki.privateKeyFromPem(keyPair.privateKey);
        const md = forge.md.sha256.create();
        md.update(dataHash.toString('binary'));
        return Buffer.from(rsaPrivateKey.sign(md), 'binary');

      default:
        throw new Error(`Unsupported key type for signing: ${keyType}`);
    }
  }

  /**
   * Sign with HSM
   */
  async signWithHSM(privateKeyHandle, dataHash, keyType) {
    if (!this.hsmEnabled) {
      throw new Error('HSM not enabled');
    }

    // Mock HSM signing - in production this would use PKCS#11 C_Sign
    const mockSignature = createHash('sha256')
      .update(privateKeyHandle)
      .update(dataHash)
      .update(Date.now().toString())
      .digest();

    return mockSignature;
  }

  /**
   * Check if keys need rotation
   */
  async checkRotationNeeded() {
    const now = new Date();
    const needsRotation = [];

    for (const [identityId, identity] of this.identities) {
      if (identity.status === 'active' && identity.rotationSchedule.autoRotate) {
        const nextRotation = new Date(identity.rotationSchedule.nextRotation);
        if (now >= nextRotation) {
          needsRotation.push({
            identityId,
            nextRotation: identity.rotationSchedule.nextRotation,
            overdue: now.getTime() - nextRotation.getTime()
          });
        }
      }
    }

    return needsRotation;
  }

  /**
   * Auto-rotate keys that are due
   */
  async autoRotateKeys() {
    const needsRotation = await this.checkRotationNeeded();
    const results = [];

    for (const item of needsRotation) {
      try {
        const result = await this.rotateIdentity(item.identityId, { reason: 'Automatic rotation' });
        results.push({ success: true, ...result });
      } catch (error) {
        results.push({ success: false, identityId: item.identityId, error: error.message });
      }
    }

    return results;
  }

  /**
   * Store identity to disk
   */
  async storeIdentity(identity) {
    const activePath = path.join(this.keyStorePath, 'active', `${identity.id}.json`);
    await fs.writeJson(activePath, identity, { spaces: 2 });
  }

  /**
   * Load existing identities
   */
  async loadIdentities() {
    const directories = ['active', 'rotated', 'revoked'];
    
    for (const dir of directories) {
      const dirPath = path.join(this.keyStorePath, dir);
      try {
        const files = await fs.readdir(dirPath);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const identityPath = path.join(dirPath, file);
            const identity = await fs.readJson(identityPath);
            this.identities.set(identity.id, identity);
          }
        }
      } catch (error) {
        // Directory might not exist
      }
    }
  }

  /**
   * Generate unique identity ID
   */
  generateIdentityId() {
    return `kgen_identity_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  /**
   * Get identity information
   */
  getIdentity(identityId) {
    const identity = this.identities.get(identityId);
    if (!identity) {
      return null;
    }

    // Return without private key information
    const safeIdentity = { ...identity };
    if (safeIdentity.keyPair) {
      safeIdentity.keyPair = {
        ...safeIdentity.keyPair,
        privateKey: identity.hsmBacked ? safeIdentity.keyPair.privateKeyHandle : '[REDACTED]'
      };
    }

    return safeIdentity;
  }

  /**
   * List all identities
   */
  listIdentities(status = null) {
    const results = [];
    for (const [identityId, identity] of this.identities) {
      if (!status || identity.status === status) {
        results.push(this.getIdentity(identityId));
      }
    }
    return results;
  }

  /**
   * Export identity for backup (encrypted)
   */
  async exportIdentity(identityId, password) {
    const identity = this.identities.get(identityId);
    if (!identity) {
      throw new Error(`Identity not found: ${identityId}`);
    }

    // Encrypt with password
    const salt = randomBytes(32);
    const key = await pbkdf2Async(password, salt, 100000, 32, 'sha256');
    
    const cipher = forge.cipher.createCipher('AES-GCM', key.toString('binary'));
    cipher.start({ iv: randomBytes(12).toString('binary') });
    cipher.update(forge.util.createBuffer(JSON.stringify(identity)));
    cipher.finish();

    return {
      encrypted: forge.util.encode64(cipher.output.data),
      salt: salt.toString('hex'),
      iv: Buffer.from(cipher.mode.tag.data, 'binary').toString('hex'),
      tag: Buffer.from(cipher.mode.tag.data, 'binary').toString('hex')
    };
  }
}

/**
 * HSM Configuration Manager
 */
export class HSMConfig {
  constructor() {
    this.configPath = '.kgen/hsm-config.json';
    this.config = {
      enabled: false,
      library: null,
      slots: [],
      tokens: []
    };
  }

  async initialize() {
    await this.loadConfig();
  }

  async loadConfig() {
    try {
      if (await fs.pathExists(this.configPath)) {
        this.config = await fs.readJson(this.configPath);
      }
    } catch (error) {
      console.warn('Failed to load HSM config:', error.message);
    }
  }

  async saveConfig() {
    await fs.ensureDir(path.dirname(this.configPath));
    await fs.writeJson(this.configPath, this.config, { spaces: 2 });
  }

  async configureHSM(options) {
    this.config = {
      enabled: true,
      library: options.library,
      pin: options.pin, // In production, this should be handled securely
      slots: options.slots || [],
      tokens: options.tokens || [],
      mechanisms: options.mechanisms || []
    };

    await this.saveConfig();
    return this.config;
  }

  getConfig() {
    return { ...this.config, pin: this.config.pin ? '[REDACTED]' : null };
  }
}
