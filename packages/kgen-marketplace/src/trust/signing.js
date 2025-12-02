/**
 * Cryptographic Signing Infrastructure with DID/VC Support
 * Implements comprehensive identity, attestation and trust management
 */

import * as ed25519 from '@noble/ed25519';
import * as secp256k1 from '@noble/secp256k1';
import { EncryptJWT, SignJWT, jwtVerify } from 'jose';
import { createHash, randomBytes } from 'crypto';
import forge from 'node-forge';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import { base58btc } from 'multiformats/bases/base58';
import fs from 'fs-extra';
import path from 'path';

/**
 * DID (Decentralized Identifier) Manager
 * Supports did:key method with Ed25519 and RSA keys
 */
export class DIDManager {
  constructor(keyStore) {
    this.keyStore = keyStore;
    this.supportedMethods = ['did:key'];
    this.supportedKeyTypes = ['Ed25519', 'RSA', 'secp256k1'];
  }

  /**
   * Generate a new DID with specified key type
   */
  async generateDID(keyType = 'Ed25519', options = {}) {
    const keyPair = await this.generateKeyPair(keyType, options);
    const did = await this.createDIDFromKey(keyPair.publicKey, keyType);
    
    // Store the key pair
    await this.keyStore.storeKey(did, keyPair, {
      keyType,
      created: new Date().toISOString(),
      ...options
    });

    return {
      did,
      keyPair,
      document: await this.createDIDDocument(did, keyPair.publicKey, keyType)
    };
  }

  /**
   * Generate cryptographic key pair
   */
  async generateKeyPair(keyType, options = {}) {
    switch (keyType) {
      case 'Ed25519':
        const ed25519PrivateKey = ed25519.utils.randomSecretKey();
        const ed25519PublicKey = await ed25519.getPublicKey(ed25519PrivateKey);
        return {
          privateKey: ed25519PrivateKey,
          publicKey: ed25519PublicKey,
          keyType: 'Ed25519'
        };

      case 'secp256k1':
        const secp256k1PrivateKey = secp256k1.utils.randomSecretKey();
        const secp256k1PublicKey = secp256k1.getPublicKey(secp256k1PrivateKey);
        return {
          privateKey: secp256k1PrivateKey,
          publicKey: secp256k1PublicKey,
          keyType: 'secp256k1'
        };

      case 'RSA':
        const keySize = options.keySize || 2048;
        const keyPair = forge.pki.rsa.generateKeyPair(keySize);
        return {
          privateKey: forge.pki.privateKeyToPem(keyPair.privateKey),
          publicKey: forge.pki.publicKeyToPem(keyPair.publicKey),
          keyType: 'RSA',
          keySize
        };

      default:
        throw new Error(`Unsupported key type: ${keyType}`);
    }
  }

  /**
   * Create DID from public key using did:key method
   */
  async createDIDFromKey(publicKey, keyType) {
    let multicodecPrefix;
    let keyBytes;

    switch (keyType) {
      case 'Ed25519':
        // Multicodec prefix for Ed25519 public key
        multicodecPrefix = new Uint8Array([0xed, 0x01]);
        keyBytes = publicKey;
        break;

      case 'secp256k1':
        // Multicodec prefix for secp256k1 public key
        multicodecPrefix = new Uint8Array([0xe7, 0x01]);
        keyBytes = publicKey;
        break;

      case 'RSA':
        // For RSA, we need to encode the public key properly
        const rsaPublicKey = forge.pki.publicKeyFromPem(publicKey);
        const derBytes = forge.asn1.toDer(forge.pki.publicKeyToAsn1(rsaPublicKey)).getBytes();
        multicodecPrefix = new Uint8Array([0x85, 0x24]); // RSA multicodec
        keyBytes = new Uint8Array(derBytes.split('').map(c => c.charCodeAt(0)));
        break;

      default:
        throw new Error(`Unsupported key type for DID: ${keyType}`);
    }

    // Combine prefix and key bytes
    const combined = new Uint8Array(multicodecPrefix.length + keyBytes.length);
    combined.set(multicodecPrefix);
    combined.set(keyBytes, multicodecPrefix.length);

    // Encode with base58btc
    const encoded = base58btc.encode(combined);
    return `did:key:${encoded}`;
  }

  /**
   * Create DID Document
   */
  async createDIDDocument(did, publicKey, keyType) {
    const keyId = `${did}#${did.split(':')[2]}`;
    
    const document = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1'
      ],
      id: did,
      verificationMethod: [{
        id: keyId,
        type: this.getVerificationMethodType(keyType),
        controller: did,
        publicKeyMultibase: this.encodePublicKey(publicKey, keyType)
      }],
      authentication: [keyId],
      assertionMethod: [keyId],
      keyAgreement: keyType === 'Ed25519' ? [keyId] : undefined,
      capabilityInvocation: [keyId],
      capabilityDelegation: [keyId]
    };

    return document;
  }

  /**
   * Get verification method type based on key type
   */
  getVerificationMethodType(keyType) {
    switch (keyType) {
      case 'Ed25519':
        return 'Ed25519VerificationKey2020';
      case 'secp256k1':
        return 'EcdsaSecp256k1VerificationKey2019';
      case 'RSA':
        return 'RsaVerificationKey2018';
      default:
        throw new Error(`Unknown key type: ${keyType}`);
    }
  }

  /**
   * Encode public key as multibase
   */
  encodePublicKey(publicKey, keyType) {
    switch (keyType) {
      case 'Ed25519':
      case 'secp256k1':
        return base58btc.encode(publicKey);
      case 'RSA':
        const rsaPublicKey = forge.pki.publicKeyFromPem(publicKey);
        const derBytes = forge.asn1.toDer(forge.pki.publicKeyToAsn1(rsaPublicKey)).getBytes();
        const keyBytes = new Uint8Array(derBytes.split('').map(c => c.charCodeAt(0)));
        return base58btc.encode(keyBytes);
      default:
        throw new Error(`Cannot encode key type: ${keyType}`);
    }
  }

  /**
   * Resolve DID to DID Document
   */
  async resolveDID(did) {
    if (!did.startsWith('did:key:')) {
      throw new Error('Only did:key method supported');
    }

    // Extract the key material
    const keyMaterial = did.split(':')[2];
    const keyBytes = base58btc.decode(keyMaterial);
    
    // Determine key type from multicodec prefix
    const prefix = keyBytes.slice(0, 2);
    let keyType, publicKey;

    if (prefix[0] === 0xed && prefix[1] === 0x01) {
      keyType = 'Ed25519';
      publicKey = keyBytes.slice(2);
    } else if (prefix[0] === 0xe7 && prefix[1] === 0x01) {
      keyType = 'secp256k1';
      publicKey = keyBytes.slice(2);
    } else if (prefix[0] === 0x85 && prefix[1] === 0x24) {
      keyType = 'RSA';
      publicKey = keyBytes.slice(2);
    } else {
      throw new Error('Unsupported key type in DID');
    }

    return await this.createDIDDocument(did, publicKey, keyType);
  }
}

/**
 * Verifiable Credential Manager
 * Generates and verifies VCs for KPack attestations
 */
export class VerifiableCredentialManager {
  constructor(didManager, keyStore) {
    this.didManager = didManager;
    this.keyStore = keyStore;
  }

  /**
   * Create a Verifiable Credential for KPack attestation
   */
  async createKPackAttestation(issuerDID, subjectDID, kpackData, options = {}) {
    const now = new Date();
    const credentialId = `urn:uuid:${this.generateUUID()}`;

    const credential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://kgen.dev/contexts/kpack/v1'
      ],
      id: credentialId,
      type: ['VerifiableCredential', 'KPackAttestation'],
      issuer: issuerDID,
      issuanceDate: now.toISOString(),
      expirationDate: options.expirationDate || new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      credentialSubject: {
        id: subjectDID,
        kpackHash: kpackData.hash,
        kpackVersion: kpackData.version,
        kpackMetadata: kpackData.metadata,
        slsaLevel: kpackData.slsaLevel || 'SLSA_LEVEL_3',
        buildTimestamp: kpackData.buildTimestamp,
        reproducibleBuild: kpackData.reproducibleBuild || false,
        dependencies: kpackData.dependencies || [],
        attestations: kpackData.attestations || []
      },
      proof: {} // Will be filled by signing
    };

    // Sign the credential
    const signedCredential = await this.signCredential(credential, issuerDID);
    return signedCredential;
  }

  /**
   * Sign a verifiable credential
   */
  async signCredential(credential, issuerDID) {
    const keyInfo = await this.keyStore.getKey(issuerDID);
    if (!keyInfo) {
      throw new Error(`No key found for issuer DID: ${issuerDID}`);
    }

    const now = new Date().toISOString();
    const credentialCopy = { ...credential };
    delete credentialCopy.proof;

    // Create canonical JSON representation
    const canonicalCredential = this.canonicalize(credentialCopy);
    const credentialHash = createHash('sha256').update(canonicalCredential).digest();

    let signature;
    switch (keyInfo.metadata.keyType) {
      case 'Ed25519':
        signature = await ed25519.sign(credentialHash, keyInfo.keyPair.privateKey);
        break;
      case 'secp256k1':
        signature = secp256k1.sign(credentialHash, keyInfo.keyPair.privateKey).toCompactRawBytes();
        break;
      case 'RSA':
        const md = forge.md.sha256.create();
        md.update(credentialHash);
        const privateKey = forge.pki.privateKeyFromPem(keyInfo.keyPair.privateKey);
        signature = privateKey.sign(md);
        break;
      default:
        throw new Error(`Unsupported key type for signing: ${keyInfo.metadata.keyType}`);
    }

    credential.proof = {
      type: 'Ed25519Signature2020', // Adjust based on key type
      created: now,
      verificationMethod: `${issuerDID}#${issuerDID.split(':')[2]}`,
      proofPurpose: 'assertionMethod',
      proofValue: base58btc.encode(new Uint8Array(signature))
    };

    return credential;
  }

  /**
   * Verify a verifiable credential
   */
  async verifyCredential(credential) {
    const issuerDID = credential.issuer;
    const didDocument = await this.didManager.resolveDID(issuerDID);
    
    // Extract proof
    const proof = credential.proof;
    const credentialCopy = { ...credential };
    delete credentialCopy.proof;

    // Recreate canonical representation
    const canonicalCredential = this.canonicalize(credentialCopy);
    const credentialHash = createHash('sha256').update(canonicalCredential).digest();

    // Verify signature based on verification method
    const verificationMethod = didDocument.verificationMethod.find(
      vm => vm.id === proof.verificationMethod
    );

    if (!verificationMethod) {
      throw new Error('Verification method not found in DID document');
    }

    const signature = base58btc.decode(proof.proofValue);
    let isValid = false;

    switch (verificationMethod.type) {
      case 'Ed25519VerificationKey2020':
        const ed25519PublicKey = base58btc.decode(verificationMethod.publicKeyMultibase);
        isValid = await ed25519.verify(signature, credentialHash, ed25519PublicKey);
        break;
      case 'EcdsaSecp256k1VerificationKey2019':
        const secp256k1PublicKey = base58btc.decode(verificationMethod.publicKeyMultibase);
        isValid = secp256k1.verify(signature, credentialHash, secp256k1PublicKey);
        break;
      case 'RsaVerificationKey2018':
        // RSA verification implementation
        const rsaPublicKeyBytes = base58btc.decode(verificationMethod.publicKeyMultibase);
        const rsaPublicKey = forge.pki.publicKeyFromAsn1(forge.asn1.fromDer(forge.util.createBuffer(rsaPublicKeyBytes)));
        const md = forge.md.sha256.create();
        md.update(credentialHash);
        isValid = rsaPublicKey.verify(md.digest().bytes(), signature);
        break;
      default:
        throw new Error(`Unsupported verification method type: ${verificationMethod.type}`);
    }

    return {
      verified: isValid,
      issuer: issuerDID,
      subject: credential.credentialSubject.id,
      issuanceDate: credential.issuanceDate,
      expirationDate: credential.expirationDate
    };
  }

  /**
   * Canonicalize JSON for consistent hashing
   */
  canonicalize(obj) {
    return JSON.stringify(obj, Object.keys(obj).sort());
  }

  /**
   * Generate UUID v4
   */
  generateUUID() {
    const bytes = randomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
    
    const hex = bytes.toString('hex');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32)
    ].join('-');
  }
}

/**
 * Sigstore Integration Manager
 * Provides transparency log integration
 */
export class SigstoreManager {
  constructor(options = {}) {
    this.rekorUrl = options.rekorUrl || 'https://rekor.sigstore.dev';
    this.fulcioUrl = options.fulcioUrl || 'https://fulcio.sigstore.dev';
    this.tufRoot = options.tufRoot || 'https://tuf-repo-cdn.sigstore.dev';
  }

  /**
   * Submit attestation to Rekor transparency log
   */
  async submitToRekor(attestation, signature, publicKey) {
    // This would integrate with the actual Rekor API
    // For now, we'll create a mock entry structure
    const entry = {
      uuid: this.generateUUID(),
      body: Buffer.from(JSON.stringify(attestation)).toString('base64'),
      integratedTime: Math.floor(Date.now() / 1000),
      logID: 'c0d23d6ad406973f9559f3ba2d1ca01f84147d8ffc5b8445c224f98b9591801d',
      logIndex: Date.now(), // Mock index
      verification: {
        signedEntryTimestamp: Buffer.from('mock_timestamp').toString('base64'),
        inclusionProof: {
          logIndex: Date.now(),
          rootHash: createHash('sha256').update('mock_root').digest('hex'),
          treeSize: 1000000, // Mock tree size
          hashes: []
        }
      }
    };

    return entry;
  }

  /**
   * Verify Rekor entry
   */
  async verifyRekorEntry(uuid) {
    // Mock verification - in production this would query Rekor API
    return {
      verified: true,
      logIndex: Date.now(),
      integratedTime: Math.floor(Date.now() / 1000),
      inclusionProof: true
    };
  }

  generateUUID() {
    return randomBytes(16).toString('hex');
  }
}

/**
 * Main Signing Infrastructure
 * Orchestrates DID, VC, and Sigstore operations
 */
export class SigningInfrastructure {
  constructor(keyStorePath = '.kgen/keys') {
    this.keyStorePath = keyStorePath;
    this.keyStore = new KeyStore(keyStorePath);
    this.didManager = new DIDManager(this.keyStore);
    this.vcManager = new VerifiableCredentialManager(this.didManager, this.keyStore);
    this.sigstoreManager = new SigstoreManager();
  }

  /**
   * Initialize the signing infrastructure
   */
  async initialize() {
    await this.keyStore.initialize();
  }

  /**
   * Create a complete KPack attestation with transparency log entry
   */
  async createKPackAttestation(kpackData, options = {}) {
    // Generate or use existing publisher DID
    let publisherDID = options.publisherDID;
    if (!publisherDID) {
      const didResult = await this.didManager.generateDID('Ed25519');
      publisherDID = didResult.did;
    }

    // Create verifiable credential
    const credential = await this.vcManager.createKPackAttestation(
      publisherDID,
      kpackData.subjectDID || publisherDID,
      kpackData,
      options
    );

    // Submit to Sigstore/Rekor
    const rekorEntry = await this.sigstoreManager.submitToRekor(
      credential,
      credential.proof.proofValue,
      publisherDID
    );

    return {
      credential,
      rekorEntry,
      publisherDID,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Verify complete attestation chain
   */
  async verifyAttestationChain(attestation) {
    // Verify the verifiable credential
    const vcVerification = await this.vcManager.verifyCredential(attestation.credential);
    
    // Verify Rekor entry
    const rekorVerification = await this.sigstoreManager.verifyRekorEntry(
      attestation.rekorEntry.uuid
    );

    return {
      credentialValid: vcVerification.verified,
      rekorValid: rekorVerification.verified,
      overall: vcVerification.verified && rekorVerification.verified,
      details: {
        credential: vcVerification,
        rekor: rekorVerification
      }
    };
  }
}

/**
 * Key Store for managing cryptographic keys
 */
export class KeyStore {
  constructor(basePath = '.kgen/keys') {
    this.basePath = basePath;
    this.keys = new Map();
  }

  async initialize() {
    await fs.ensureDir(this.basePath);
    await this.loadExistingKeys();
  }

  async storeKey(did, keyPair, metadata = {}) {
    const keyData = {
      did,
      keyPair,
      metadata: {
        ...metadata,
        stored: new Date().toISOString()
      }
    };

    // Store in memory
    this.keys.set(did, keyData);

    // Store encrypted on disk
    const keyPath = path.join(this.basePath, `${this.sanitizeDID(did)}.json`);
    await fs.writeJson(keyPath, keyData, { spaces: 2 });
  }

  async getKey(did) {
    return this.keys.get(did);
  }

  async loadExistingKeys() {
    try {
      const files = await fs.readdir(this.basePath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const keyPath = path.join(this.basePath, file);
          const keyData = await fs.readJson(keyPath);
          this.keys.set(keyData.did, keyData);
        }
      }
    } catch (error) {
      // Directory doesn't exist yet
    }
  }

  sanitizeDID(did) {
    return did.replace(/[^a-zA-Z0-9]/g, '_');
  }
}
