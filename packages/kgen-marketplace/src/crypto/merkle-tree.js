/**
 * Cryptographic Merkle Tree Implementation
 * 
 * Provides tamper-evident data structures with cryptographic proofs
 * for the KGen marketplace ledger system.
 */

import { createHash } from 'crypto';

/**
 * Merkle Tree Node
 */
export class MerkleNode {
  constructor(hash, left = null, right = null, data = null) {
    this.hash = hash;
    this.left = left;
    this.right = right;
    this.data = data;
    this.isLeaf = !left && !right;
  }
}

/**
 * Enhanced Merkle Tree with Proof Generation
 */
export class MerkleTree {
  constructor(leaves = [], hashFunction = 'sha256') {
    this.hashFunction = hashFunction;
    this.leaves = [];
    this.root = null;
    
    if (leaves.length > 0) {
      this.buildTree(leaves);
    }
  }

  /**
   * Hash function wrapper
   */
  hash(data) {
    return createHash(this.hashFunction)
      .update(typeof data === 'string' ? data : JSON.stringify(data))
      .digest('hex');
  }

  /**
   * Combine two hashes
   */
  combineHashes(left, right) {
    return this.hash(left + right);
  }

  /**
   * Build Merkle tree from leaves
   */
  buildTree(leaves) {
    if (leaves.length === 0) {
      throw new Error('Cannot build tree with empty leaves');
    }

    // Create leaf nodes
    this.leaves = leaves.map(leaf => 
      new MerkleNode(this.hash(leaf), null, null, leaf)
    );

    // Build tree bottom-up
    let level = [...this.leaves];

    while (level.length > 1) {
      const nextLevel = [];

      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1];

        if (right) {
          // Pair exists
          const parentHash = this.combineHashes(left.hash, right.hash);
          const parent = new MerkleNode(parentHash, left, right);
          nextLevel.push(parent);
        } else {
          // Odd number - duplicate the last node
          const parentHash = this.combineHashes(left.hash, left.hash);
          const parent = new MerkleNode(parentHash, left, left);
          nextLevel.push(parent);
        }
      }

      level = nextLevel;
    }

    this.root = level[0];
  }

  /**
   * Add new leaf and rebuild tree
   */
  addLeaf(data) {
    const newLeaves = [...this.leaves.map(node => node.data), data];
    this.buildTree(newLeaves);
  }

  /**
   * Get Merkle root hash
   */
  getRootHash() {
    return this.root ? this.root.hash : null;
  }

  /**
   * Generate Merkle proof for a specific leaf
   */
  generateProof(leafData) {
    const leafHash = this.hash(leafData);
    const leafIndex = this.leaves.findIndex(node => node.hash === leafHash);

    if (leafIndex === -1) {
      throw new Error('Leaf not found in tree');
    }

    const proof = [];
    this._generateProofRecursive(this.root, leafIndex, this.leaves.length, proof);

    return {
      leaf: leafData,
      leafHash,
      leafIndex,
      proof,
      root: this.root.hash
    };
  }

  /**
   * Recursive proof generation helper
   */
  _generateProofRecursive(node, targetIndex, totalLeaves, proof) {
    if (!node || node.isLeaf) {
      return;
    }

    const leftSubtreeSize = Math.pow(2, Math.floor(Math.log2(totalLeaves - 1))) || 1;
    
    if (targetIndex < leftSubtreeSize) {
      // Target is in left subtree
      if (node.right) {
        proof.push({
          hash: node.right.hash,
          position: 'right'
        });
      }
      this._generateProofRecursive(node.left, targetIndex, leftSubtreeSize, proof);
    } else {
      // Target is in right subtree
      if (node.left) {
        proof.push({
          hash: node.left.hash,
          position: 'left'
        });
      }
      this._generateProofRecursive(
        node.right, 
        targetIndex - leftSubtreeSize, 
        totalLeaves - leftSubtreeSize, 
        proof
      );
    }
  }

  /**
   * Verify Merkle proof
   */
  static verifyProof(proof, rootHash, hashFunction = 'sha256') {
    const hash = (data) => createHash(hashFunction)
      .update(typeof data === 'string' ? data : JSON.stringify(data))
      .digest('hex');

    const combineHashes = (left, right) => hash(left + right);

    let computedHash = proof.leafHash;

    for (const step of proof.proof) {
      if (step.position === 'left') {
        computedHash = combineHashes(step.hash, computedHash);
      } else {
        computedHash = combineHashes(computedHash, step.hash);
      }
    }

    return computedHash === rootHash;
  }

  /**
   * Get tree statistics
   */
  getStatistics() {
    return {
      totalLeaves: this.leaves.length,
      treeHeight: this._calculateHeight(this.root),
      rootHash: this.getRootHash(),
      isBalanced: this._isBalanced(this.root)
    };
  }

  /**
   * Calculate tree height
   */
  _calculateHeight(node) {
    if (!node) return 0;
    if (node.isLeaf) return 1;
    
    const leftHeight = this._calculateHeight(node.left);
    const rightHeight = this._calculateHeight(node.right);
    
    return Math.max(leftHeight, rightHeight) + 1;
  }

  /**
   * Check if tree is balanced
   */
  _isBalanced(node) {
    if (!node || node.isLeaf) return true;
    
    const leftHeight = this._calculateHeight(node.left);
    const rightHeight = this._calculateHeight(node.right);
    
    return Math.abs(leftHeight - rightHeight) <= 1 &&
           this._isBalanced(node.left) &&
           this._isBalanced(node.right);
  }

  /**
   * Serialize tree structure for storage
   */
  serialize() {
    return {
      hashFunction: this.hashFunction,
      leaves: this.leaves.map(node => ({
        hash: node.hash,
        data: node.data
      })),
      root: this.root ? this.root.hash : null,
      timestamp: Date.now()
    };
  }

  /**
   * Deserialize and rebuild tree
   */
  static deserialize(serialized) {
    const tree = new MerkleTree([], serialized.hashFunction);
    
    if (serialized.leaves.length > 0) {
      const leafData = serialized.leaves.map(leaf => leaf.data);
      tree.buildTree(leafData);
    }
    
    return tree;
  }

  /**
   * Export tree as DOT format for visualization
   */
  toDot() {
    if (!this.root) return 'digraph MerkleTree {}';
    
    let dot = 'digraph MerkleTree {\n';
    dot += '  node [shape=box, style=filled];\n';
    
    const visited = new Set();
    this._toDotRecursive(this.root, dot, visited);
    
    dot += '}';
    return dot;
  }

  /**
   * Recursive DOT generation helper
   */
  _toDotRecursive(node, dot, visited) {
    if (!node || visited.has(node.hash)) return;
    
    visited.add(node.hash);
    const label = node.isLeaf ? 
      `${node.hash.substring(0, 8)}...\\n(leaf)` : 
      `${node.hash.substring(0, 8)}...`;
    
    dot += `  "${node.hash}" [label="${label}", fillcolor="${node.isLeaf ? 'lightblue' : 'lightgreen'}"];\n`;
    
    if (node.left) {
      dot += `  "${node.hash}" -> "${node.left.hash}";\n`;
      this._toDotRecursive(node.left, dot, visited);
    }
    
    if (node.right && node.right !== node.left) {
      dot += `  "${node.hash}" -> "${node.right.hash}";\n`;
      this._toDotRecursive(node.right, dot, visited);
    }
  }
}

export default MerkleTree;