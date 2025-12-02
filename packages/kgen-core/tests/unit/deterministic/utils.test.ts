/**
 * Tests for deterministic utilities
 */

import {
  sortObjectKeys,
  createDeterministicHash,
  normalizeForHashing,
  stableStringify,
  createDeterministicId,
  sortPaths,
  stripNonDeterministic,
  deterministicMerge,
  deterministicEquals,
  createDeterministicUUID,
  createDeterministicFilename
} from '../../../src/deterministic/utils';

describe('deterministic utils', () => {
  describe('sortObjectKeys', () => {
    it('should sort object keys recursively', () => {
      const obj = {
        z: 3,
        a: {
          y: 2,
          x: 1
        },
        m: [
          { b: 2, a: 1 },
          { d: 4, c: 3 }
        ]
      };
      
      const sorted = sortObjectKeys(obj);
      
      expect(Object.keys(sorted)).toEqual(['a', 'm', 'z']);
      expect(Object.keys(sorted.a)).toEqual(['x', 'y']);
      expect(Object.keys(sorted.m[0])).toEqual(['a', 'b']);
      expect(Object.keys(sorted.m[1])).toEqual(['c', 'd']);
    });
    
    it('should handle primitives', () => {
      expect(sortObjectKeys(null)).toBe(null);
      expect(sortObjectKeys(42)).toBe(42);
      expect(sortObjectKeys('string')).toBe('string');
      expect(sortObjectKeys(true)).toBe(true);
    });
    
    it('should handle arrays', () => {
      const arr = [
        { z: 3, a: 1 },
        'string',
        42,
        { b: 2 }
      ];
      
      const sorted = sortObjectKeys(arr);
      
      expect(Object.keys(sorted[0])).toEqual(['a', 'z']);
      expect(sorted[1]).toBe('string');
      expect(sorted[2]).toBe(42);
      expect(Object.keys(sorted[3])).toEqual(['b']);
    });
    
    it('should handle nested structures', () => {
      const complex = {
        z: {
          nested: {
            deep: { c: 3, a: 1, b: 2 }
          }
        },
        a: [
          { y: 1, x: 2 }
        ]
      };
      
      const sorted = sortObjectKeys(complex);
      
      expect(Object.keys(sorted)).toEqual(['a', 'z']);
      expect(Object.keys(sorted.z.nested.deep)).toEqual(['a', 'b', 'c']);
      expect(Object.keys(sorted.a[0])).toEqual(['x', 'y']);
    });
  });
  
  describe('createDeterministicHash', () => {
    it('should create consistent hashes for same input', () => {
      const input = { name: 'test', value: 42 };
      
      const hash1 = createDeterministicHash(input);
      const hash2 = createDeterministicHash(input);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });
    
    it('should create different hashes for different inputs', () => {
      const input1 = { name: 'test1' };
      const input2 = { name: 'test2' };
      
      const hash1 = createDeterministicHash(input1);
      const hash2 = createDeterministicHash(input2);
      
      expect(hash1).not.toBe(hash2);
    });
    
    it('should be independent of key order', () => {
      const input1 = { a: 1, b: 2, c: 3 };
      const input2 = { c: 3, a: 1, b: 2 };
      
      const hash1 = createDeterministicHash(input1);
      const hash2 = createDeterministicHash(input2);
      
      expect(hash1).toBe(hash2);
    });
    
    it('should support different algorithms', () => {
      const input = { test: 'value' };
      
      const sha256Hash = createDeterministicHash(input, 'sha256');
      const sha1Hash = createDeterministicHash(input, 'sha1');
      
      expect(sha256Hash).toMatch(/^[a-f0-9]{64}$/);
      expect(sha1Hash).toMatch(/^[a-f0-9]{40}$/);
      expect(sha256Hash).not.toBe(sha1Hash);
    });
  });
  
  describe('normalizeForHashing', () => {
    it('should handle primitives', () => {
      expect(normalizeForHashing(null)).toBe(null);
      expect(normalizeForHashing(undefined)).toBe(null);
      expect(normalizeForHashing(42)).toBe(42);
      expect(normalizeForHashing('string')).toBe('string');
      expect(normalizeForHashing(true)).toBe(true);
    });
    
    it('should handle dates', () => {
      const date = new Date('2023-01-01T00:00:00Z');
      const normalized = normalizeForHashing(date);
      
      expect(normalized).toBe('2023-01-01T00:00:00.000Z');
    });
    
    it('should handle regex', () => {
      const regex = /test/gi;
      const normalized = normalizeForHashing(regex);
      
      expect(normalized).toEqual({
        __type: 'RegExp',
        source: 'test',
        flags: 'gi'
      });
    });
    
    it('should handle buffers', () => {
      const buffer = Buffer.from('hello', 'utf8');
      const normalized = normalizeForHashing(buffer);
      
      expect(normalized).toEqual({
        __type: 'Buffer',
        data: buffer.toString('base64')
      });
    });
    
    it('should sort array elements', () => {
      const arr = [{ z: 3 }, { a: 1 }, { m: 2 }];
      const normalized = normalizeForHashing(arr);
      
      // Should be sorted by JSON representation
      expect(normalized).toHaveLength(3);
      expect(normalized[0]).toEqual({ a: 1 });
      expect(normalized[1]).toEqual({ m: 2 });
      expect(normalized[2]).toEqual({ z: 3 });
    });
    
    it('should skip functions and symbols', () => {
      const obj = {
        normalProp: 'value',
        func: () => {},
        symbol: Symbol('test'),
        nested: {
          value: 42,
          anotherFunc: function() {}
        }
      };
      
      const normalized = normalizeForHashing(obj);
      
      expect(normalized).toEqual({
        normalProp: 'value',
        nested: {
          value: 42
        }
      });
    });
  });
  
  describe('stableStringify', () => {
    it('should stringify with sorted keys', () => {
      const obj = { z: 3, a: 1, m: 2 };
      const result = stableStringify(obj);
      
      expect(result).toBe('{"a":1,"m":2,"z":3}');
    });
    
    it('should handle indentation', () => {
      const obj = { b: 2, a: 1 };
      const result = stableStringify(obj, 2);
      
      expect(result).toBe('{\n  "a": 1,\n  "b": 2\n}');
    });
    
    it('should produce identical output for same data', () => {
      const obj1 = { name: 'test', items: [{ z: 3, a: 1 }] };
      const obj2 = { items: [{ a: 1, z: 3 }], name: 'test' };
      
      const result1 = stableStringify(obj1);
      const result2 = stableStringify(obj2);
      
      expect(result1).toBe(result2);
    });
  });
  
  describe('createDeterministicId', () => {
    it('should create consistent short IDs', () => {
      const id1 = createDeterministicId('test', 123, { key: 'value' });
      const id2 = createDeterministicId('test', 123, { key: 'value' });
      
      expect(id1).toBe(id2);
      expect(id1).toMatch(/^[a-f0-9]{8}$/);
    });
    
    it('should create different IDs for different inputs', () => {
      const id1 = createDeterministicId('test1');
      const id2 = createDeterministicId('test2');
      
      expect(id1).not.toBe(id2);
    });
    
    it('should handle multiple inputs', () => {
      const id = createDeterministicId('user', 'john', 'doe', 123);
      expect(id).toMatch(/^[a-f0-9]{8}$/);
    });
  });
  
  describe('sortPaths', () => {
    it('should sort paths alphabetically', () => {
      const paths = [
        'src/utils/helper.js',
        'src/index.js',
        'package.json',
        'src/app.js'
      ];
      
      const sorted = sortPaths(paths);
      
      expect(sorted).toEqual([
        'package.json',
        'src/app.js',
        'src/index.js',
        'src/utils/helper.js'
      ]);
    });
    
    it('should handle directory vs file ordering', () => {
      const paths = [
        'src/file.js',
        'src/',
        'src/utils/',
        'src/utils/helper.js'
      ];
      
      const sorted = sortPaths(paths);
      
      expect(sorted).toEqual([
        'src/',
        'src/file.js',
        'src/utils/',
        'src/utils/helper.js'
      ]);
    });
    
    it('should handle complex path structures', () => {
      const paths = [
        'z/file.txt',
        'a/b/c/deep.txt',
        'a/b/shallow.txt',
        'a/file.txt',
        'm/file.txt'
      ];
      
      const sorted = sortPaths(paths);
      
      expect(sorted[0]).toBe('a/b/c/deep.txt');
      expect(sorted[1]).toBe('a/b/shallow.txt');
      expect(sorted[2]).toBe('a/file.txt');
    });
  });
  
  describe('stripNonDeterministic', () => {
    it('should remove default non-deterministic fields', () => {
      const obj = {
        name: 'test',
        timestamp: '2023-01-01',
        created: new Date(),
        id: 'unique-id',
        value: 42,
        version: '1.0.0'
      };
      
      const cleaned = stripNonDeterministic(obj);
      
      expect(cleaned).toEqual({
        name: 'test',
        value: 42
      });
    });
    
    it('should remove custom fields', () => {
      const obj = {
        name: 'test',
        customField: 'remove me',
        keepThis: 'keep me'
      };
      
      const cleaned = stripNonDeterministic(obj, ['customField']);
      
      expect(cleaned).toEqual({
        name: 'test',
        keepThis: 'keep me'
      });
    });
    
    it('should handle nested objects', () => {
      const obj = {
        user: {
          name: 'John',
          id: 'user-123',
          profile: {
            email: 'john@example.com',
            created: '2023-01-01'
          }
        },
        metadata: {
          version: '1.0.0',
          name: 'app'
        }
      };
      
      const cleaned = stripNonDeterministic(obj);
      
      expect(cleaned).toEqual({
        user: {
          name: 'John',
          profile: {
            email: 'john@example.com'
          }
        },
        metadata: {
          name: 'app'
        }
      });
    });
    
    it('should handle arrays', () => {
      const obj = {
        items: [
          { name: 'item1', id: 'id1' },
          { name: 'item2', timestamp: '2023-01-01' }
        ]
      };
      
      const cleaned = stripNonDeterministic(obj);
      
      expect(cleaned).toEqual({
        items: [
          { name: 'item1' },
          { name: 'item2' }
        ]
      });
    });
  });
  
  describe('deterministicMerge', () => {
    it('should merge objects with sorted keys', () => {
      const obj1 = { z: 3, a: 1 };
      const obj2 = { m: 2, b: 4 };
      
      const merged = deterministicMerge(obj1, obj2);
      
      expect(Object.keys(merged)).toEqual(['a', 'b', 'm', 'z']);
      expect(merged).toEqual({ a: 1, b: 4, m: 2, z: 3 });
    });
    
    it('should handle overlapping keys (later wins)', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { b: 3, c: 4 };
      
      const merged = deterministicMerge(obj1, obj2);
      
      expect(merged).toEqual({ a: 1, b: 3, c: 4 });
    });
    
    it('should skip undefined values', () => {
      const obj1 = { a: 1, b: undefined };
      const obj2 = { c: 3, d: undefined };
      
      const merged = deterministicMerge(obj1, obj2);
      
      expect(merged).toEqual({ a: 1, c: 3 });
    });
    
    it('should handle non-object inputs', () => {
      const merged = deterministicMerge(
        { a: 1 },
        null,
        undefined,
        'string',
        42,
        { b: 2 }
      );
      
      expect(merged).toEqual({ a: 1, b: 2 });
    });
  });
  
  describe('deterministicEquals', () => {
    it('should compare objects deterministically', () => {
      const obj1 = { a: 1, b: { x: 2, y: 3 } };
      const obj2 = { b: { y: 3, x: 2 }, a: 1 };
      
      expect(deterministicEquals(obj1, obj2)).toBe(true);
    });
    
    it('should detect differences', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 3 };
      
      expect(deterministicEquals(obj1, obj2)).toBe(false);
    });
    
    it('should handle primitives', () => {
      expect(deterministicEquals(42, 42)).toBe(true);
      expect(deterministicEquals('test', 'test')).toBe(true);
      expect(deterministicEquals(null, null)).toBe(true);
      expect(deterministicEquals(42, 43)).toBe(false);
    });
  });
  
  describe('createDeterministicUUID', () => {
    it('should create valid UUID v5 format', () => {
      const uuid = createDeterministicUUID('test-namespace', 'input1', 'input2');
      
      expect(uuid).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    });
    
    it('should be deterministic', () => {
      const uuid1 = createDeterministicUUID('ns', 'data');
      const uuid2 = createDeterministicUUID('ns', 'data');
      
      expect(uuid1).toBe(uuid2);
    });
    
    it('should vary with different inputs', () => {
      const uuid1 = createDeterministicUUID('ns', 'data1');
      const uuid2 = createDeterministicUUID('ns', 'data2');
      
      expect(uuid1).not.toBe(uuid2);
    });
  });
  
  describe('createDeterministicFilename', () => {
    it('should create deterministic filenames', () => {
      const content = 'file content';
      const metadata = { type: 'text', version: 1 };
      
      const filename1 = createDeterministicFilename(content, metadata, 'txt');
      const filename2 = createDeterministicFilename(content, metadata, 'txt');
      
      expect(filename1).toBe(filename2);
      expect(filename1).toMatch(/^[a-f0-9]{16}-[a-f0-9]{8}\.txt$/);
    });
    
    it('should handle different content', () => {
      const filename1 = createDeterministicFilename('content1', {}, 'txt');
      const filename2 = createDeterministicFilename('content2', {}, 'txt');
      
      expect(filename1).not.toBe(filename2);
    });
    
    it('should handle buffer content', () => {
      const buffer = Buffer.from('binary data', 'utf8');
      const filename = createDeterministicFilename(buffer, {}, 'bin');
      
      expect(filename).toMatch(/^[a-f0-9]{16}-[a-f0-9]{8}\.bin$/);
    });
    
    it('should handle no extension', () => {
      const filename = createDeterministicFilename('content', {});
      
      expect(filename).toMatch(/^[a-f0-9]{16}-[a-f0-9]{8}$/);
      expect(filename).not.toContain('.');
    });
    
    it('should strip leading dots from extension', () => {
      const filename = createDeterministicFilename('content', {}, '.txt');
      
      expect(filename).toMatch(/^[a-f0-9]{16}-[a-f0-9]{8}\.txt$/);
    });
  });
});