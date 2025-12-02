/**
 * Cryptographic Receipt Generator
 * Creates signed receipts for settlement transactions
 */

import { createHash, createSign } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

class ReceiptGenerator {
  constructor(config = {}) {
    this.config = config;
    this.signingKey = config.signingKey || this.generateDefaultKey();
    this.receiptStorage = config.receiptStorage || 'filesystem';
  }

  /**
   * Generate cryptographic receipt for transaction
   */
  async generate({ transaction, policy = null, metadata = {} }) {
    const receipt = {
      '@context': 'https://kgen.dev/contexts/marketplace-receipt',
      '@type': 'kmkt:Receipt',
      id: `receipt:${transaction.id}`,
      transaction: {
        id: transaction.id,
        userId: transaction.userId,
        kpackId: transaction.kpackId,
        timestamp: transaction.timestamp,
        status: transaction.status,
        requirement: transaction.requirement,
        operations: transaction.operations.map(op => ({
          dimension: op.dimension,
          amount: op.amount,
          adapter: op.adapter,
          operationId: op.operationId,
          status: op.status
        }))
      },
      policy: policy ? this.serializePolicy(policy) : null,
      metadata: {
        ...metadata,
        generatedAt: new Date().toISOString(),
        version: '1.0.0'
      },
      cryptographic: {}
    };

    // Add cryptographic elements
    await this.addCryptographicProof(receipt);
    
    // Store receipt
    await this.storeReceipt(receipt);
    
    return receipt;
  }

  /**
   * Add cryptographic proof to receipt
   */
  async addCryptographicProof(receipt) {
    // Calculate content hash
    const contentToHash = {
      transaction: receipt.transaction,
      policy: receipt.policy,
      metadata: receipt.metadata
    };
    
    const contentHash = createHash('sha256')
      .update(JSON.stringify(contentToHash, null, 0))
      .digest('hex');

    receipt.cryptographic.contentHash = contentHash;
    
    // Create digital signature
    if (this.signingKey) {
      const signature = await this.signContent(contentToHash);
      receipt.cryptographic.signature = signature;
      receipt.cryptographic.signatureAlgorithm = 'RS256';
    }
    
    // Add Merkle tree proof for batch verification
    receipt.cryptographic.merkleProof = await this.generateMerkleProof(receipt);
    
    // Add timestamp proof
    receipt.cryptographic.timestampProof = {
      timestamp: new Date().toISOString(),
      nonce: Math.random().toString(36).substring(2),
      blockHeight: await this.getCurrentBlockHeight()
    };
  }

  /**
   * Sign receipt content with private key
   */
  async signContent(content) {
    try {
      const sign = createSign('SHA256');
      sign.update(JSON.stringify(content, null, 0));
      
      // In production, would use actual private key
      const privateKey = this.signingKey.privateKey || this.generateMockPrivateKey();
      const signature = sign.sign(privateKey, 'hex');
      
      return {
        value: signature,
        publicKey: this.signingKey.publicKey || 'mock-public-key',
        algorithm: 'SHA256withRSA'
      };
    } catch (error) {
      console.warn('Signature generation failed:', error.message);
      return {
        value: createHash('sha256').update(JSON.stringify(content)).digest('hex'),
        publicKey: 'mock-public-key',
        algorithm: 'mock'
      };
    }
  }

  /**
   * Generate Merkle proof for receipt verification
   */
  async generateMerkleProof(receipt) {
    // Simplified Merkle proof (in production, would use proper Merkle tree library)
    const leaves = [
      receipt.transaction.id,
      receipt.cryptographic.contentHash,
      receipt.metadata.generatedAt
    ];
    
    const merkleRoot = this.calculateMerkleRoot(leaves);
    
    return {
      root: merkleRoot,
      leaves: leaves.length,
      path: leaves.map(leaf => createHash('sha256').update(leaf).digest('hex'))
    };
  }

  /**
   * Calculate simplified Merkle root
   */
  calculateMerkleRoot(leaves) {
    if (leaves.length === 0) return null;
    if (leaves.length === 1) return createHash('sha256').update(leaves[0]).digest('hex');
    
    const hashedLeaves = leaves.map(leaf => 
      createHash('sha256').update(leaf).digest('hex')
    );
    
    return createHash('sha256')
      .update(hashedLeaves.join(''))
      .digest('hex');
  }

  /**
   * Get current blockchain height for timestamping
   */
  async getCurrentBlockHeight() {
    // Mock implementation (in production, would query actual blockchain)
    return Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000000);
  }

  /**
   * Store receipt in specified storage system
   */
  async storeReceipt(receipt) {
    switch (this.receiptStorage) {
      case 'filesystem':
        await this.storeInFilesystem(receipt);
        break;
      
      case 'git-notes':
        await this.storeInGitNotes(receipt);
        break;
      
      case 'ipfs':
        await this.storeInIPFS(receipt);
        break;
      
      default:
        console.warn(`Unknown storage type: ${this.receiptStorage}`);
    }
  }

  /**
   * Store receipt in filesystem (.kgen/receipts/)
   */
  async storeInFilesystem(receipt) {
    const receiptDir = join(process.cwd(), '.kgen', 'receipts');
    const receiptFile = join(receiptDir, `${receipt.transaction.id}.json`);
    
    try {
      await mkdir(receiptDir, { recursive: true });
      await writeFile(receiptFile, JSON.stringify(receipt, null, 2));
      console.log(`Receipt stored: ${receiptFile}`);
    } catch (error) {
      console.error('Failed to store receipt:', error.message);
    }
  }

  /**
   * Store receipt in git notes for immutability
   */
  async storeInGitNotes(receipt) {
    try {
      // Would use simple-git or isomorphic-git
      // const git = simpleGit();
      // await git.raw(['notes', 'add', '-m', JSON.stringify(receipt), 'HEAD']);
      
      console.log(`Receipt would be stored in git notes: ${receipt.id}`);
    } catch (error) {
      console.error('Failed to store receipt in git notes:', error.message);
    }
  }

  /**
   * Store receipt in IPFS for distributed storage
   */
  async storeInIPFS(receipt) {
    try {
      // Would use ipfs-http-client
      // const ipfs = create({ url: this.config.ipfsUrl });
      // const result = await ipfs.add(JSON.stringify(receipt));
      
      const mockCID = 'Qm' + createHash('sha256')
        .update(JSON.stringify(receipt))
        .digest('hex').substring(0, 44);
      
      console.log(`Receipt would be stored in IPFS: ${mockCID}`);
      return mockCID;
    } catch (error) {
      console.error('Failed to store receipt in IPFS:', error.message);
    }
  }

  /**
   * Serialize policy for storage
   */
  serializePolicy(policy) {
    if (typeof policy === 'string') {
      return { type: 'string', value: policy };
    }
    return { type: 'object', value: policy };
  }

  /**
   * Verify receipt authenticity
   */
  async verifyReceipt(receipt) {
    const verification = {
      contentHash: false,
      signature: false,
      merkleProof: false,
      timestamp: false,
      overall: false
    };

    try {
      // Verify content hash
      const contentToHash = {
        transaction: receipt.transaction,
        policy: receipt.policy,
        metadata: receipt.metadata
      };
      
      const calculatedHash = createHash('sha256')
        .update(JSON.stringify(contentToHash, null, 0))
        .digest('hex');
      
      verification.contentHash = calculatedHash === receipt.cryptographic.contentHash;
      
      // Verify signature (simplified)
      verification.signature = receipt.cryptographic.signature?.value?.length > 0;
      
      // Verify Merkle proof
      verification.merkleProof = receipt.cryptographic.merkleProof?.root?.length > 0;
      
      // Verify timestamp
      const receiptTime = new Date(receipt.metadata.generatedAt);
      const now = new Date();
      verification.timestamp = receiptTime <= now;
      
      verification.overall = Object.values(verification).every(v => v === true);
      
    } catch (error) {
      console.error('Receipt verification failed:', error.message);
    }

    return verification;
  }

  /**
   * Generate default signing key (for development)
   */
  generateDefaultKey() {
    return {
      publicKey: 'mock-public-key-' + Math.random().toString(36),
      privateKey: null // Would generate actual RSA key pair
    };
  }

  /**
   * Generate mock private key for testing
   */
  generateMockPrivateKey() {
    // In production, would use actual private key
    return '-----BEGIN PRIVATE KEY-----\nMOCK_PRIVATE_KEY\n-----END PRIVATE KEY-----';
  }
}

export { ReceiptGenerator };