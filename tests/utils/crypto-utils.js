const crypto = require('crypto');
const { performance } = require('perf_hooks');

class CryptoUtils {
  static generateIntegrityHash(content) {
    const contentString = typeof content === 'string' ? content : JSON.stringify(content);
    return crypto.createHash('sha256').update(contentString).digest('hex');
  }

  static signContent(content, privateKey = null) {
    // Mock signing implementation
    const contentString = typeof content === 'string' ? content : JSON.stringify(content);
    const hash = crypto.createHash('sha256').update(contentString).digest('hex');
    
    // In a real implementation, this would use actual private key cryptography
    return `sig_${hash.substring(0, 32)}_${Date.now()}`;
  }

  static verifySignature(content, signature, publicKey = null) {
    // Mock signature verification
    if (signature === 'invalid-signature-data') {
      return false;
    }
    
    if (signature.startsWith('sig_')) {
      // Extract hash from signature and verify
      const expectedHash = this.generateIntegrityHash(content);
      const signatureHash = signature.split('_')[1];
      return expectedHash.startsWith(signatureHash);
    }
    
    return false;
  }

  static generateSignature() {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    return `sig_${randomBytes}_${timestamp}`;
  }

  static generateCertificateChain() {
    const now = new Date();
    const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    
    return [
      {
        issuer: 'KPack Root CA',
        subject: 'KPack Intermediate CA',
        serialNumber: crypto.randomBytes(16).toString('hex'),
        notBefore: oneMonthAgo.toISOString(),
        notAfter: oneYearFromNow.toISOString(),
        publicKey: this.generatePublicKey(),
        fingerprint: crypto.randomBytes(20).toString('hex'),
        keyUsage: ['digitalSignature', 'keyCertSign'],
        basicConstraints: { isCA: true, pathLength: 1 }
      },
      {
        issuer: 'KPack Intermediate CA',
        subject: 'KPack Publisher Certificate',
        serialNumber: crypto.randomBytes(16).toString('hex'),
        notBefore: oneMonthAgo.toISOString(),
        notAfter: oneYearFromNow.toISOString(),
        publicKey: this.generatePublicKey(),
        fingerprint: crypto.randomBytes(20).toString('hex'),
        keyUsage: ['digitalSignature'],
        basicConstraints: { isCA: false },
        subjectAltName: ['email:publisher@example.com'],
        extendedKeyUsage: ['codeSigning']
      }
    ];
  }

  static generatePublicKey() {
    // Mock public key generation
    return {
      algorithm: 'RSA',
      keySize: 2048,
      publicExponent: 65537,
      modulus: crypto.randomBytes(256).toString('hex')
    };
  }

  static generateKeyPair() {
    // Mock key pair generation
    const keyId = crypto.randomBytes(8).toString('hex');
    return {
      publicKey: {
        keyId: keyId,
        algorithm: 'RSA-SHA256',
        key: crypto.randomBytes(256).toString('hex')
      },
      privateKey: {
        keyId: keyId,
        algorithm: 'RSA-SHA256',
        key: crypto.randomBytes(256).toString('hex')
      }
    };
  }

  static createAttestation(content, publisherKey) {
    const startTime = performance.now();
    
    const attestation = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      publisher: publisherKey?.keyId || 'test-publisher',
      content: {
        integrity: this.generateIntegrityHash(content),
        contentType: 'application/kpack+json'
      },
      signature: this.signContent(content, publisherKey?.key),
      certificateChain: this.generateCertificateChain(),
      verificationTime: performance.now() - startTime
    };
    
    return attestation;
  }

  static verifyAttestation(attestation, content) {
    const startTime = performance.now();
    
    try {
      // Verify content integrity
      const expectedHash = this.generateIntegrityHash(content);
      if (attestation.content.integrity !== expectedHash) {
        return {
          valid: false,
          error: 'Content integrity check failed',
          verificationTime: performance.now() - startTime
        };
      }
      
      // Verify signature
      const signatureValid = this.verifySignature(content, attestation.signature);
      if (!signatureValid) {
        return {
          valid: false,
          error: 'Signature verification failed',
          verificationTime: performance.now() - startTime
        };
      }
      
      // Verify certificate chain
      const chainValid = this.verifyCertificateChain(attestation.certificateChain);
      if (!chainValid) {
        return {
          valid: false,
          error: 'Certificate chain verification failed',
          verificationTime: performance.now() - startTime
        };
      }
      
      // Check timestamp (not too old, not in future)
      const attestationTime = new Date(attestation.timestamp);
      const now = new Date();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (attestationTime > now) {
        return {
          valid: false,
          error: 'Attestation timestamp is in the future',
          verificationTime: performance.now() - startTime
        };
      }
      
      if (now - attestationTime > maxAge) {
        return {
          valid: false,
          error: 'Attestation is too old',
          verificationTime: performance.now() - startTime
        };
      }
      
      return {
        valid: true,
        publisher: attestation.publisher,
        timestamp: attestation.timestamp,
        verificationTime: performance.now() - startTime
      };
      
    } catch (error) {
      return {
        valid: false,
        error: `Verification failed: ${error.message}`,
        verificationTime: performance.now() - startTime
      };
    }
  }

  static verifyCertificateChain(certificateChain) {
    if (!Array.isArray(certificateChain) || certificateChain.length === 0) {
      return false;
    }
    
    // Mock certificate chain verification
    for (let i = 0; i < certificateChain.length; i++) {
      const cert = certificateChain[i];
      
      // Check certificate validity period
      const now = new Date();
      const notBefore = new Date(cert.notBefore);
      const notAfter = new Date(cert.notAfter);
      
      if (now < notBefore || now > notAfter) {
        return false;
      }
      
      // Check certificate chain integrity
      if (i > 0) {
        const parentCert = certificateChain[i - 1];
        if (cert.issuer !== parentCert.subject) {
          return false;
        }
      }
    }
    
    return true;
  }

  static generateDID() {
    const method = 'kpack';
    const identifier = crypto.randomBytes(16).toString('hex');
    return `did:${method}:${identifier}`;
  }

  static createDIDDocument(did) {
    const publicKey = this.generatePublicKey();
    
    return {
      '@context': 'https://www.w3.org/ns/did/v1',
      id: did,
      publicKey: [{
        id: `${did}#key-1`,
        type: 'RsaVerificationKey2018',
        controller: did,
        publicKeyPem: this.mockPublicKeyPEM(publicKey)
      }],
      authentication: [`${did}#key-1`],
      service: [{
        id: `${did}#kpack-service`,
        type: 'KPackService',
        serviceEndpoint: 'https://kpack.example.com/api/v1'
      }],
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
  }

  static mockPublicKeyPEM(publicKey) {
    // Mock PEM format
    return `-----BEGIN PUBLIC KEY-----
${crypto.randomBytes(64).toString('base64')}
${crypto.randomBytes(64).toString('base64')}
${crypto.randomBytes(64).toString('base64')}
${crypto.randomBytes(32).toString('base64')}
-----END PUBLIC KEY-----`;
  }

  static hashData(data, algorithm = 'sha256') {
    const input = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash(algorithm).update(input).digest('hex');
  }

  static generateNonce() {
    return crypto.randomBytes(16).toString('hex');
  }

  static generateProofOfWork(data, difficulty = 4) {
    // Simple proof of work implementation
    let nonce = 0;
    const target = '0'.repeat(difficulty);
    
    while (true) {
      const input = JSON.stringify(data) + nonce;
      const hash = this.hashData(input);
      
      if (hash.startsWith(target)) {
        return {
          nonce: nonce,
          hash: hash,
          difficulty: difficulty,
          timestamp: new Date().toISOString()
        };
      }
      
      nonce++;
      
      // Prevent infinite loops in tests
      if (nonce > 100000) {
        break;
      }
    }
    
    throw new Error('Proof of work failed');
  }

  static verifyProofOfWork(data, proof) {
    const target = '0'.repeat(proof.difficulty);
    const input = JSON.stringify(data) + proof.nonce;
    const hash = this.hashData(input);
    
    return hash === proof.hash && hash.startsWith(target);
  }

  static encryptData(data, key) {
    // Mock encryption
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted: encrypted,
      iv: iv.toString('hex'),
      algorithm: algorithm
    };
  }

  static decryptData(encryptedData, key) {
    // Mock decryption
    try {
      const decipher = crypto.createDecipher(encryptedData.algorithm, key);
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error('Decryption failed');
    }
  }

  static createMerkleTree(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Items must be a non-empty array');
    }
    
    // Hash all items
    let level = items.map(item => this.hashData(item));
    const tree = [level];
    
    // Build tree bottom-up
    while (level.length > 1) {
      const nextLevel = [];
      
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] || left; // Duplicate last item if odd number
        const combined = this.hashData(left + right);
        nextLevel.push(combined);
      }
      
      level = nextLevel;
      tree.push(level);
    }
    
    return {
      root: level[0],
      tree: tree,
      leaves: tree[0]
    };
  }

  static generateMerkleProof(tree, leafIndex) {
    const proof = [];
    let index = leafIndex;
    
    for (let level = 0; level < tree.tree.length - 1; level++) {
      const currentLevel = tree.tree[level];
      const isRightNode = index % 2 === 1;
      const pairIndex = isRightNode ? index - 1 : index + 1;
      
      if (pairIndex < currentLevel.length) {
        proof.push({
          hash: currentLevel[pairIndex],
          isRight: !isRightNode
        });
      }
      
      index = Math.floor(index / 2);
    }
    
    return proof;
  }

  static verifyMerkleProof(leafHash, proof, root) {
    let currentHash = leafHash;
    
    for (const step of proof) {
      if (step.isRight) {
        currentHash = this.hashData(currentHash + step.hash);
      } else {
        currentHash = this.hashData(step.hash + currentHash);
      }
    }
    
    return currentHash === root;
  }

  static createTimestamp(data) {
    return {
      data: this.hashData(data),
      timestamp: new Date().toISOString(),
      nonce: this.generateNonce(),
      signature: this.signContent(data)
    };
  }

  static verifyTimestamp(timestamp, data) {
    const expectedHash = this.hashData(data);
    return timestamp.data === expectedHash && 
           this.verifySignature(data, timestamp.signature);
  }
}

module.exports = CryptoUtils;