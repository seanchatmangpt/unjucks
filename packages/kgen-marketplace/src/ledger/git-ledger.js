/**
 * Git-based Immutable Ledger for KGen Marketplace
 * 
 * Provides cryptographically secure, append-only storage using git-notes
 * with tamper-evident design and audit trail capabilities.
 */

import { execSync, spawn } from 'child_process';
import { createHash, createHmac } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { promisify } from 'util';

/**
 * Git Notes Namespace Configuration
 */
export const NOTES_REFS = {
  RECEIPTS: 'refs/notes/kgen/receipts',
  ATTESTATIONS: 'refs/notes/kgen/attestations', 
  INSTALLS: 'refs/notes/kgen/installs',
  TRUST: 'refs/notes/kgen/trust',
  MERKLE: 'refs/notes/kgen/merkle'
};

/**
 * Git-based Immutable Ledger Implementation
 */
export class GitLedger {
  constructor(repoPath = process.cwd(), options = {}) {
    this.repoPath = repoPath;
    this.privateKey = options.privateKey;
    this.publicKey = options.publicKey;
    this.merkleCache = new Map();
    
    // Verify git repository
    this.ensureGitRepo();
  }

  /**
   * Ensure we're in a git repository
   */
  ensureGitRepo() {
    try {
      this.execGit(['rev-parse', '--git-dir']);
    } catch (error) {
      throw new Error(`Not a git repository: ${this.repoPath}`);
    }
  }

  /**
   * Execute git command with proper error handling
   */
  execGit(args, options = {}) {
    try {
      return execSync(`git ${args.join(' ')}`, {
        cwd: this.repoPath,
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        ...options
      }).toString().trim();
    } catch (error) {
      if (!options.silent) {
        throw new Error(`Git command failed: git ${args.join(' ')}\n${error.message}`);
      }
      return null;
    }
  }

  /**
   * Create cryptographic signature for data
   */
  createSignature(data, timestamp = Date.now()) {
    if (!this.privateKey) {
      throw new Error('Private key required for signing');
    }
    
    const payload = JSON.stringify({ data, timestamp });
    const hash = createHash('sha256').update(payload).digest('hex');
    
    // Simple HMAC signature (replace with Ed25519 for production)
    const signature = createHmac('sha256', this.privateKey)
      .update(hash)
      .digest('hex');
    
    return {
      hash,
      signature,
      timestamp,
      publicKey: this.publicKey
    };
  }

  /**
   * Verify cryptographic signature
   */
  verifySignature(data, signatureInfo) {
    if (!signatureInfo.publicKey) {
      throw new Error('Public key required for verification');
    }
    
    const payload = JSON.stringify({ data, timestamp: signatureInfo.timestamp });
    const hash = createHash('sha256').update(payload).digest('hex');
    
    if (hash !== signatureInfo.hash) {
      return false;
    }
    
    const expectedSignature = createHmac('sha256', this.privateKey)
      .update(hash)
      .digest('hex');
    
    return expectedSignature === signatureInfo.signature;
  }

  /**
   * Append entry to specific notes namespace
   */
  async appendToLedger(namespace, data, metadata = {}) {
    const timestamp = Date.now();
    const entryId = createHash('sha256')
      .update(`${timestamp}-${JSON.stringify(data)}`)
      .digest('hex');
    
    // Create signed entry
    const signature = this.privateKey ? this.createSignature(data, timestamp) : null;
    
    const entry = {
      id: entryId,
      timestamp,
      data,
      metadata,
      signature,
      version: '1.0'
    };
    
    // Get current commit hash for anchoring
    const currentCommit = this.execGit(['rev-parse', 'HEAD']) || 'initial';
    
    // Create note content
    const noteContent = JSON.stringify({
      ...entry,
      anchorCommit: currentCommit
    }, null, 2);
    
    // Write note to git
    await this.writeNote(namespace, entryId, noteContent);
    
    // Update Merkle tree
    await this.updateMerkleTree(namespace, entryId, entry);
    
    return entryId;
  }

  /**
   * Write note to git notes
   */
  async writeNote(notesRef, noteId, content) {
    try {
      // Create temporary file for note content
      const tempFile = join(this.repoPath, '.git', `temp-note-${noteId}`);
      await writeFile(tempFile, content);
      
      // Add note using git notes
      this.execGit(['notes', '--ref', notesRef, 'add', '-F', tempFile, noteId]);
      
      // Clean up temp file
      await this.execGit(['rm', tempFile]).catch(() => {}); // Ignore errors
      
    } catch (error) {
      throw new Error(`Failed to write note: ${error.message}`);
    }
  }

  /**
   * Read note from git notes
   */
  async readNote(notesRef, noteId) {
    try {
      const content = this.execGit(['notes', '--ref', notesRef, 'show', noteId], { silent: true });
      return content ? JSON.parse(content) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * List all notes in namespace
   */
  async listNotes(notesRef, options = {}) {
    try {
      const notes = this.execGit(['notes', '--ref', notesRef, 'list'], { silent: true });
      if (!notes) return [];
      
      const noteIds = notes.split('\n').filter(Boolean);
      const entries = [];
      
      for (const noteId of noteIds) {
        const entry = await this.readNote(notesRef, noteId);
        if (entry && this.matchesFilter(entry, options.filter)) {
          entries.push(entry);
        }
      }
      
      // Sort by timestamp
      entries.sort((a, b) => b.timestamp - a.timestamp);
      
      if (options.limit) {
        return entries.slice(0, options.limit);
      }
      
      return entries;
    } catch (error) {
      return [];
    }
  }

  /**
   * Filter entries based on criteria
   */
  matchesFilter(entry, filter) {
    if (!filter) return true;
    
    for (const [key, value] of Object.entries(filter)) {
      if (entry.data[key] !== value && entry.metadata[key] !== value) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Update Merkle tree for tamper evidence
   */
  async updateMerkleTree(namespace, entryId, entry) {
    // Get existing tree
    const treeEntries = await this.listNotes(namespace);
    const leaves = treeEntries.map(e => this.hashEntry(e));
    leaves.push(this.hashEntry(entry));
    
    // Build Merkle tree
    const tree = this.buildMerkleTree(leaves);
    const root = tree[tree.length - 1][0];
    
    // Store tree root
    await this.writeNote(NOTES_REFS.MERKLE, `${namespace}-root`, JSON.stringify({
      namespace,
      root,
      timestamp: Date.now(),
      entryCount: leaves.length
    }));
    
    return root;
  }

  /**
   * Hash entry for Merkle tree
   */
  hashEntry(entry) {
    const canonical = JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp,
      data: entry.data
    });
    return createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Build Merkle tree from leaf hashes
   */
  buildMerkleTree(leaves) {
    if (leaves.length === 0) return [];
    
    let level = [...leaves];
    const tree = [level];
    
    while (level.length > 1) {
      const nextLevel = [];
      
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] || left; // Duplicate if odd number
        const parent = createHash('sha256')
          .update(left + right)
          .digest('hex');
        nextLevel.push(parent);
      }
      
      level = nextLevel;
      tree.push(level);
    }
    
    return tree;
  }

  /**
   * Generate Merkle proof for entry
   */
  async generateMerkleProof(namespace, entryId) {
    const entries = await this.listNotes(namespace);
    const targetEntry = entries.find(e => e.id === entryId);
    
    if (!targetEntry) {
      throw new Error(`Entry not found: ${entryId}`);
    }
    
    const leaves = entries.map(e => this.hashEntry(e));
    const targetIndex = entries.findIndex(e => e.id === entryId);
    const tree = this.buildMerkleTree(leaves);
    
    // Build proof path
    const proof = [];
    let index = targetIndex;
    
    for (let i = 0; i < tree.length - 1; i++) {
      const level = tree[i];
      const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
      
      if (siblingIndex < level.length) {
        proof.push({
          hash: level[siblingIndex],
          position: index % 2 === 0 ? 'right' : 'left'
        });
      }
      
      index = Math.floor(index / 2);
    }
    
    return {
      entryId,
      proof,
      root: tree[tree.length - 1][0],
      namespace
    };
  }

  /**
   * Verify Merkle proof
   */
  verifyMerkleProof(proof, entryHash) {
    let hash = entryHash;
    
    for (const step of proof.proof) {
      if (step.position === 'left') {
        hash = createHash('sha256').update(step.hash + hash).digest('hex');
      } else {
        hash = createHash('sha256').update(hash + step.hash).digest('hex');
      }
    }
    
    return hash === proof.root;
  }

  /**
   * Export audit trail for compliance
   */
  async exportAuditTrail(namespace, options = {}) {
    const entries = await this.listNotes(namespace, options);
    const merkleRoot = await this.readNote(NOTES_REFS.MERKLE, `${namespace}-root`);
    
    const audit = {
      namespace,
      exportedAt: new Date().toISOString(),
      totalEntries: entries.length,
      merkleRoot: merkleRoot ? JSON.parse(merkleRoot) : null,
      entries: entries.map(entry => ({
        ...entry,
        verified: entry.signature ? this.verifySignature(entry.data, entry.signature) : null
      }))
    };
    
    return audit;
  }

  /**
   * Replicate ledger via git push/pull
   */
  async replicateLedger(remoteUrl, direction = 'push') {
    try {
      if (direction === 'push') {
        // Push all notes references
        for (const ref of Object.values(NOTES_REFS)) {
          this.execGit(['push', remoteUrl, ref]);
        }
      } else {
        // Pull all notes references
        for (const ref of Object.values(NOTES_REFS)) {
          this.execGit(['fetch', remoteUrl, ref]);
        }
      }
      return true;
    } catch (error) {
      throw new Error(`Replication failed: ${error.message}`);
    }
  }

  /**
   * Marketplace-specific methods
   */

  /**
   * Record transaction receipt
   */
  async recordReceipt(transactionData) {
    return this.appendToLedger(NOTES_REFS.RECEIPTS, transactionData, {
      type: 'transaction',
      category: 'receipt'
    });
  }

  /**
   * Record KPack attestation
   */
  async recordAttestation(attestationData) {
    return this.appendToLedger(NOTES_REFS.ATTESTATIONS, attestationData, {
      type: 'attestation',
      category: 'kpack'
    });
  }

  /**
   * Record installation
   */
  async recordInstallation(installData) {
    return this.appendToLedger(NOTES_REFS.INSTALLS, installData, {
      type: 'installation',
      category: 'kpack'
    });
  }

  /**
   * Record trust decision
   */
  async recordTrustDecision(trustData) {
    return this.appendToLedger(NOTES_REFS.TRUST, trustData, {
      type: 'trust',
      category: 'decision'
    });
  }

  /**
   * Query receipts with filters
   */
  async queryReceipts(filter = {}) {
    return this.listNotes(NOTES_REFS.RECEIPTS, { filter });
  }

  /**
   * Query attestations with filters
   */
  async queryAttestations(filter = {}) {
    return this.listNotes(NOTES_REFS.ATTESTATIONS, { filter });
  }

  /**
   * Query installations with filters
   */
  async queryInstallations(filter = {}) {
    return this.listNotes(NOTES_REFS.INSTALLS, { filter });
  }

  /**
   * Query trust decisions with filters
   */
  async queryTrustDecisions(filter = {}) {
    return this.listNotes(NOTES_REFS.TRUST, { filter });
  }

  /**
   * Get complete audit trail for a KPack
   */
  async getKPackAuditTrail(kpackId) {
    const filter = { kpackId };
    
    const [receipts, attestations, installs, trust] = await Promise.all([
      this.queryReceipts(filter),
      this.queryAttestations(filter), 
      this.queryInstallations(filter),
      this.queryTrustDecisions(filter)
    ]);
    
    return {
      kpackId,
      receipts,
      attestations,
      installs,
      trust,
      auditedAt: new Date().toISOString()
    };
  }
}

export default GitLedger;