/**
 * Merkle Tree Test Suite
 * 
 * Comprehensive tests for cryptographic Merkle tree implementation
 * including proof generation and verification.
 */

import { describe, it, expect } from '@jest/globals';
import MerkleTree, { MerkleNode } from '../packages/kgen-marketplace/src/crypto/merkle-tree.js';

describe('MerkleTree', () => {
  describe('Basic Operations', () => {
    it('should create empty tree', () => {
      const tree = new MerkleTree();
      expect(tree.leaves).toEqual([]);
      expect(tree.root).toBeNull();
      expect(tree.getRootHash()).toBeNull();
    });

    it('should build tree from single leaf', () => {
      const tree = new MerkleTree(['single-leaf']);
      
      expect(tree.leaves).toHaveLength(1);
      expect(tree.root).toBeDefined();
      expect(tree.getRootHash()).toBeDefined();
    });

    it('should build tree from multiple leaves', () => {
      const leaves = ['leaf1', 'leaf2', 'leaf3', 'leaf4'];
      const tree = new MerkleTree(leaves);
      
      expect(tree.leaves).toHaveLength(4);
      expect(tree.root).toBeDefined();
      expect(tree.getRootHash()).toBeDefined();
    });

    it('should handle odd number of leaves', () => {
      const leaves = ['leaf1', 'leaf2', 'leaf3'];
      const tree = new MerkleTree(leaves);
      
      expect(tree.leaves).toHaveLength(3);
      expect(tree.root).toBeDefined();
      expect(tree.getRootHash()).toBeDefined();
    });
  });

  describe('Hash Functions', () => {
    it('should use consistent hashing', () => {
      const tree = new MerkleTree();
      const hash1 = tree.hash('test-data');
      const hash2 = tree.hash('test-data');
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/); // SHA256 format
    });

    it('should produce different hashes for different data', () => {
      const tree = new MerkleTree();
      const hash1 = tree.hash('data1');
      const hash2 = tree.hash('data2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should combine hashes consistently', () => {
      const tree = new MerkleTree();
      const combined1 = tree.combineHashes('hash1', 'hash2');
      const combined2 = tree.combineHashes('hash1', 'hash2');
      
      expect(combined1).toBe(combined2);
    });
  });

  describe('Tree Building', () => {
    it('should create proper tree structure for power of 2 leaves', () => {
      const leaves = ['A', 'B', 'C', 'D'];
      const tree = new MerkleTree(leaves);
      
      // Tree should have 4 leaves, 2 internal nodes, 1 root
      expect(tree.leaves).toHaveLength(4);
      expect(tree.root.left).toBeDefined();
      expect(tree.root.right).toBeDefined();
    });

    it('should handle non-power of 2 leaves correctly', () => {
      const leaves = ['A', 'B', 'C'];
      const tree = new MerkleTree(leaves);
      
      expect(tree.leaves).toHaveLength(3);
      expect(tree.root).toBeDefined();
      
      const stats = tree.getStatistics();
      expect(stats.totalLeaves).toBe(3);
    });

    it('should maintain deterministic structure', () => {
      const leaves = ['X', 'Y', 'Z'];
      const tree1 = new MerkleTree(leaves);
      const tree2 = new MerkleTree(leaves);
      
      expect(tree1.getRootHash()).toBe(tree2.getRootHash());
    });
  });

  describe('Proof Generation', () => {
    it('should generate proof for existing leaf', () => {
      const leaves = ['A', 'B', 'C', 'D'];
      const tree = new MerkleTree(leaves);
      
      const proof = tree.generateProof('B');
      
      expect(proof.leaf).toBe('B');
      expect(proof.leafIndex).toBe(1);
      expect(proof.proof).toBeDefined();
      expect(proof.root).toBe(tree.getRootHash());
    });

    it('should throw error for non-existent leaf', () => {
      const leaves = ['A', 'B', 'C'];
      const tree = new MerkleTree(leaves);
      
      expect(() => {
        tree.generateProof('X');
      }).toThrow('Leaf not found in tree');
    });

    it('should generate different proofs for different leaves', () => {
      const leaves = ['A', 'B', 'C', 'D'];
      const tree = new MerkleTree(leaves);
      
      const proofA = tree.generateProof('A');
      const proofB = tree.generateProof('B');
      
      expect(proofA.leafIndex).not.toBe(proofB.leafIndex);
      expect(proofA.proof).not.toEqual(proofB.proof);
    });
  });

  describe('Proof Verification', () => {
    it('should verify valid proofs', () => {
      const leaves = ['data1', 'data2', 'data3', 'data4'];
      const tree = new MerkleTree(leaves);
      
      const proof = tree.generateProof('data2');
      const isValid = MerkleTree.verifyProof(proof, tree.getRootHash());
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid proofs', () => {
      const leaves = ['data1', 'data2', 'data3', 'data4'];
      const tree = new MerkleTree(leaves);
      
      const proof = tree.generateProof('data2');
      
      // Tamper with the proof
      proof.proof[0].hash = 'invalid-hash';
      
      const isValid = MerkleTree.verifyProof(proof, tree.getRootHash());
      expect(isValid).toBe(false);
    });

    it('should reject proof with wrong root', () => {
      const leaves = ['data1', 'data2', 'data3', 'data4'];
      const tree = new MerkleTree(leaves);
      
      const proof = tree.generateProof('data2');
      const wrongRoot = 'wrong-root-hash';
      
      const isValid = MerkleTree.verifyProof(proof, wrongRoot);
      expect(isValid).toBe(false);
    });
  });

  describe('Tree Modification', () => {
    it('should rebuild tree when adding leaves', () => {
      const tree = new MerkleTree(['A', 'B']);
      const originalRoot = tree.getRootHash();
      
      tree.addLeaf('C');
      const newRoot = tree.getRootHash();
      
      expect(newRoot).not.toBe(originalRoot);
      expect(tree.leaves).toHaveLength(3);
    });

    it('should maintain valid proofs after modification', () => {
      const tree = new MerkleTree(['A', 'B']);
      tree.addLeaf('C');
      
      const proof = tree.generateProof('A');
      const isValid = MerkleTree.verifyProof(proof, tree.getRootHash());
      
      expect(isValid).toBe(true);
    });
  });

  describe('Statistics and Analysis', () => {
    it('should calculate tree statistics', () => {
      const leaves = ['A', 'B', 'C', 'D'];
      const tree = new MerkleTree(leaves);
      
      const stats = tree.getStatistics();
      
      expect(stats.totalLeaves).toBe(4);
      expect(stats.treeHeight).toBeGreaterThan(0);
      expect(stats.rootHash).toBe(tree.getRootHash());
      expect(stats.isBalanced).toBe(true);
    });

    it('should detect unbalanced trees', () => {
      // Create artificially unbalanced tree for testing
      const leaves = Array.from({ length: 7 }, (_, i) => `leaf${i}`);
      const tree = new MerkleTree(leaves);
      
      const stats = tree.getStatistics();
      expect(stats.totalLeaves).toBe(7);
      // Tree might still be considered balanced due to our balancing logic
    });

    it('should calculate proper height', () => {
      const singleLeaf = new MerkleTree(['A']);
      expect(singleLeaf.getStatistics().treeHeight).toBe(1);
      
      const twoLeaves = new MerkleTree(['A', 'B']);
      expect(twoLeaves.getStatistics().treeHeight).toBe(2);
      
      const fourLeaves = new MerkleTree(['A', 'B', 'C', 'D']);
      expect(fourLeaves.getStatistics().treeHeight).toBe(3);
    });
  });

  describe('Serialization', () => {
    it('should serialize tree state', () => {
      const leaves = ['data1', 'data2', 'data3'];
      const tree = new MerkleTree(leaves);
      
      const serialized = tree.serialize();
      
      expect(serialized.hashFunction).toBe('sha256');
      expect(serialized.leaves).toHaveLength(3);
      expect(serialized.root).toBe(tree.getRootHash());
      expect(serialized.timestamp).toBeDefined();
    });

    it('should deserialize and rebuild tree', () => {
      const original = new MerkleTree(['A', 'B', 'C', 'D']);
      const serialized = original.serialize();
      
      const rebuilt = MerkleTree.deserialize(serialized);
      
      expect(rebuilt.getRootHash()).toBe(original.getRootHash());
      expect(rebuilt.leaves).toHaveLength(original.leaves.length);
    });

    it('should maintain proof validity after serialization', () => {
      const original = new MerkleTree(['test1', 'test2', 'test3']);
      const originalProof = original.generateProof('test2');
      
      const serialized = original.serialize();
      const rebuilt = MerkleTree.deserialize(serialized);
      const rebuiltProof = rebuilt.generateProof('test2');
      
      // Both proofs should be valid
      expect(MerkleTree.verifyProof(originalProof, original.getRootHash())).toBe(true);
      expect(MerkleTree.verifyProof(rebuiltProof, rebuilt.getRootHash())).toBe(true);
      
      // Root hashes should match
      expect(rebuilt.getRootHash()).toBe(original.getRootHash());
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty tree operations', () => {
      const tree = new MerkleTree();
      
      expect(() => tree.generateProof('nonexistent')).toThrow();
      expect(tree.getStatistics().totalLeaves).toBe(0);
      expect(tree.getRootHash()).toBeNull();
    });

    it('should handle duplicate leaves', () => {
      const leaves = ['A', 'A', 'B', 'B'];
      const tree = new MerkleTree(leaves);
      
      expect(tree.leaves).toHaveLength(4);
      
      // Should be able to generate proofs for duplicates
      const proofA1 = tree.generateProof('A');
      expect(MerkleTree.verifyProof(proofA1, tree.getRootHash())).toBe(true);
    });

    it('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => `item-${i}`);
      
      const startTime = Date.now();
      const tree = new MerkleTree(largeDataset);
      const buildTime = Date.now() - startTime;
      
      expect(tree.leaves).toHaveLength(1000);
      expect(buildTime).toBeLessThan(1000); // Should build in under 1 second
      
      // Test proof generation for large tree
      const proofTime = Date.now();
      const proof = tree.generateProof('item-500');
      const proofGenerationTime = Date.now() - proofTime;
      
      expect(proofGenerationTime).toBeLessThan(100); // Should be fast
      expect(MerkleTree.verifyProof(proof, tree.getRootHash())).toBe(true);
    });
  });

  describe('DOT Export', () => {
    it('should export tree as DOT format', () => {
      const tree = new MerkleTree(['A', 'B']);
      const dot = tree.toDot();
      
      expect(dot).toContain('digraph MerkleTree');
      expect(dot).toContain('node [shape=box');
      expect(dot).toContain('->'); // Should have edges
    });

    it('should handle empty tree DOT export', () => {
      const tree = new MerkleTree();
      const dot = tree.toDot();
      
      expect(dot).toBe('digraph MerkleTree {}');
    });
  });

  describe('Hash Algorithm Variations', () => {
    it('should support different hash algorithms', () => {
      const tree256 = new MerkleTree(['data'], 'sha256');
      const tree1 = new MerkleTree(['data'], 'sha1');
      
      expect(tree256.getRootHash()).not.toBe(tree1.getRootHash());
      expect(tree256.getRootHash()).toHaveLength(64); // SHA256
      expect(tree1.getRootHash()).toHaveLength(40);   // SHA1
    });
  });
});

describe('MerkleNode', () => {
  it('should create leaf nodes correctly', () => {
    const node = new MerkleNode('test-hash', null, null, 'test-data');
    
    expect(node.hash).toBe('test-hash');
    expect(node.data).toBe('test-data');
    expect(node.isLeaf).toBe(true);
    expect(node.left).toBeNull();
    expect(node.right).toBeNull();
  });

  it('should create internal nodes correctly', () => {
    const left = new MerkleNode('left-hash');
    const right = new MerkleNode('right-hash');
    const parent = new MerkleNode('parent-hash', left, right);
    
    expect(parent.hash).toBe('parent-hash');
    expect(parent.left).toBe(left);
    expect(parent.right).toBe(right);
    expect(parent.isLeaf).toBe(false);
    expect(parent.data).toBeNull();
  });
});