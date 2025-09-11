/**
 * Test suite for NamespaceManager module
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { NamespaceManager } from '../../src/rdf/namespace-manager.js';

describe('NamespaceManager', () => {
  let manager;

  beforeEach(() => {
    manager = new NamespaceManager({
      prefixes: {
        ex: 'http://example.org/',
        test: 'http://test.com/'
      }
    });
  });

  afterEach(() => {
    manager?.removeAllListeners();
  });

  describe('Initialization', () => {
    it('should initialize with standard prefixes', () => {
      const standardManager = new NamespaceManager();
      
      expect(standardManager.hasPrefix('rdf')).toBe(true);
      expect(standardManager.hasPrefix('rdfs')).toBe(true);
      expect(standardManager.hasPrefix('owl')).toBe(true);
      expect(standardManager.hasPrefix('xsd')).toBe(true);
    });

    it('should initialize with custom prefixes', () => {
      expect(manager.hasPrefix('ex')).toBe(true);
      expect(manager.hasPrefix('test')).toBe(true);
      expect(manager.getNamespaceURI('ex')).toBe('http://example.org/');
    });
  });

  describe('Prefix Management', () => {
    it('should add new prefixes', () => {
      const result = manager.addPrefix('new', 'http://new.example.org/');
      
      expect(result).toBe(true);
      expect(manager.getNamespaceURI('new')).toBe('http://new.example.org/');
    });

    it('should prevent duplicate prefixes without overwrite', () => {
      expect(() => {
        manager.addPrefix('ex', 'http://different.org/');
      }).toThrow(/already exists/);
    });

    it('should allow overwriting with explicit option', () => {
      const result = manager.addPrefix('ex', 'http://different.org/', { overwrite: true });
      
      expect(result).toBe(true);
      expect(manager.getNamespaceURI('ex')).toBe('http://different.org/');
    });

    it('should remove prefixes', () => {
      const result = manager.removePrefix('ex');
      
      expect(result).toBe(true);
      expect(manager.hasPrefix('ex')).toBe(false);
    });

    it('should return false when removing non-existent prefix', () => {
      const result = manager.removePrefix('nonexistent');
      
      expect(result).toBe(false);
    });

    it('should validate prefix names', () => {
      expect(() => {
        manager.addPrefix('123invalid', 'http://example.org/');
      }).toThrow(/Invalid prefix/);

      expect(() => {
        manager.addPrefix('valid-prefix', 'http://example.org/');
      }).not.toThrow();
    });
  });

  describe('URI Expansion and Compaction', () => {
    it('should expand prefixed URIs', () => {
      const expanded = manager.expand('ex:resource');
      
      expect(expanded).toBe('http://example.org/resource');
    });

    it('should return original string for non-prefixed URIs', () => {
      const fullURI = 'http://example.org/resource';
      const result = manager.expand(fullURI);
      
      expect(result).toBe(fullURI);
    });

    it('should return original string for unknown prefixes', () => {
      const unknown = 'unknown:resource';
      const result = manager.expand(unknown);
      
      expect(result).toBe(unknown);
    });

    it('should compact full URIs to prefixed form', () => {
      const compacted = manager.compact('http://example.org/resource');
      
      expect(compacted).toBe('ex:resource');
    });

    it('should return original URI for unmatchable URIs', () => {
      const unmatchable = 'http://unmatchable.org/resource';
      const result = manager.compact(unmatchable);
      
      expect(result).toBe(unmatchable);
    });

    it('should handle empty and null inputs gracefully', () => {
      expect(manager.expand('')).toBe('');
      expect(manager.expand(null)).toBe(null);
      expect(manager.compact('')).toBe('');
      expect(manager.compact(null)).toBe(null);
    });

    it('should prefer longer namespace matches', () => {
      manager.addPrefix('long', 'http://example.org/long/');
      
      const compacted = manager.compact('http://example.org/long/resource');
      
      expect(compacted).toBe('long:resource');
    });
  });

  describe('Batch Operations', () => {
    it('should expand multiple URIs', () => {
      const prefixed = ['ex:resource1', 'test:resource2', 'unknown:resource3'];
      const expanded = manager.expandAll(prefixed);
      
      expect(expanded).toEqual([
        'http://example.org/resource1',
        'http://test.com/resource2',
        'unknown:resource3'
      ]);
    });

    it('should compact multiple URIs', () => {
      const fullURIs = [
        'http://example.org/resource1',
        'http://test.com/resource2',
        'http://unknown.org/resource3'
      ];
      const compacted = manager.compactAll(fullURIs);
      
      expect(compacted).toEqual([
        'ex:resource1',
        'test:resource2',
        'http://unknown.org/resource3'
      ]);
    });
  });

  describe('Import and Export', () => {
    it('should import prefixes from object', () => {
      const newPrefixes = {
        import1: 'http://import1.org/',
        import2: 'http://import2.org/'
      };
      
      const count = manager.importPrefixes(newPrefixes);
      
      expect(count).toBe(2);
      expect(manager.hasPrefix('import1')).toBe(true);
      expect(manager.hasPrefix('import2')).toBe(true);
    });

    it('should import prefixes from another namespace manager', () => {
      const otherManager = new NamespaceManager({
        prefixes: {
          other1: 'http://other1.org/',
          other2: 'http://other2.org/'
        }
      });
      
      const count = manager.importPrefixes(otherManager);
      
      expect(count).toBeGreaterThan(0);
      expect(manager.hasPrefix('other1')).toBe(true);
      expect(manager.hasPrefix('other2')).toBe(true);
    });

    it('should export prefixes to object', () => {
      const exported = manager.exportPrefixes();
      
      expect(exported).toHaveProperty('ex', 'http://example.org/');
      expect(exported).toHaveProperty('test', 'http://test.com/');
    });

    it('should export prefixes excluding standard ones', () => {
      const exported = manager.exportPrefixes({ excludeStandard: true });
      
      expect(exported).toHaveProperty('ex', 'http://example.org/');
      expect(exported).toHaveProperty('test', 'http://test.com/');
      expect(exported).not.toHaveProperty('rdf');
      expect(exported).not.toHaveProperty('rdfs');
    });
  });

  describe('Validation', () => {
    it('should validate all registered prefixes and namespaces', () => {
      const report = manager.validate();
      
      expect(report.valid).toBe(true);
      expect(report.errors).toHaveLength(0);
      expect(report.statistics.totalPrefixes).toBeGreaterThan(0);
    });

    it('should detect invalid prefixes', () => {
      // Manually add invalid prefix to test validation
      manager.prefixes.set('123invalid', 'http://example.org/');
      
      const report = manager.validate();
      
      expect(report.valid).toBe(false);
      expect(report.errors.length).toBeGreaterThan(0);
    });

    it('should validate URI format when enabled', () => {
      const strictManager = new NamespaceManager({ validateURIs: true });
      
      expect(() => {
        strictManager.addPrefix('invalid', 'not-a-valid-uri');
      }).toThrow(/Invalid namespace URI/);
    });
  });

  describe('Statistics', () => {
    it('should provide namespace statistics', () => {
      const stats = manager.getStatistics();
      
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.standard).toBeGreaterThan(0);
      expect(stats.custom).toBeGreaterThan(0);
      expect(stats.averageURILength).toBeGreaterThan(0);
    });

    it('should detect duplicate namespaces', () => {
      manager.addPrefix('dup1', 'http://example.org/');
      manager.addPrefix('dup2', 'http://example.org/', { overwrite: true });
      
      const stats = manager.getStatistics();
      
      expect(stats.duplicateNamespaces.length).toBeGreaterThan(0);
    });
  });

  describe('Suggestions', () => {
    it('should provide prefix suggestions for URIs', () => {
      const suggestions = manager.getSuggestions('http://example.org/some/path');
      
      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should limit number of suggestions', () => {
      const suggestions = manager.getSuggestions('http://example.org/path', 2);
      
      expect(suggestions.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Clear Operations', () => {
    it('should clear all prefixes except standard ones', () => {
      manager.clear();
      
      expect(manager.hasPrefix('ex')).toBe(false);
      expect(manager.hasPrefix('test')).toBe(false);
      expect(manager.hasPrefix('rdf')).toBe(true); // Standard prefix preserved
    });

    it('should clear all prefixes including standard ones', () => {
      manager.clear({ preserveStandard: false });
      
      expect(manager.hasPrefix('ex')).toBe(false);
      expect(manager.hasPrefix('rdf')).toBe(false);
    });
  });

  describe('Events', () => {
    it('should emit events when prefixes are added', (done) => {
      manager.on('prefix-added', (event) => {
        expect(event.prefix).toBe('newprefix');
        expect(event.uri).toBe('http://newprefix.org/');
        done();
      });
      
      manager.addPrefix('newprefix', 'http://newprefix.org/');
    });

    it('should emit events when prefixes are removed', (done) => {
      manager.on('prefix-removed', (event) => {
        expect(event.prefix).toBe('ex');
        done();
      });
      
      manager.removePrefix('ex');
    });

    it('should emit events when prefixes are imported', (done) => {
      manager.on('prefixes-imported', (event) => {
        expect(event.count).toBeGreaterThan(0);
        done();
      });
      
      manager.importPrefixes({ imported: 'http://imported.org/' });
    });

    it('should emit events when prefixes are cleared', (done) => {
      manager.on('prefixes-cleared', (event) => {
        expect(event.preserveStandard).toBe(true);
        done();
      });
      
      manager.clear();
    });
  });

  describe('Cloning', () => {
    it('should create a clone of the namespace manager', () => {
      const clone = manager.clone();
      
      expect(clone).toBeInstanceOf(NamespaceManager);
      expect(clone.hasPrefix('ex')).toBe(true);
      expect(clone.getNamespaceURI('ex')).toBe('http://example.org/');
      
      // Verify independence
      clone.addPrefix('clone-only', 'http://clone.org/');
      expect(manager.hasPrefix('clone-only')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty prefix correctly', () => {
      manager.addPrefix('', 'http://default.org/');
      
      expect(manager.getNamespaceURI('')).toBe('http://default.org/');
    });

    it('should handle URN namespaces', () => {
      manager.addPrefix('urn', 'urn:example:');
      
      expect(manager.getNamespaceURI('urn')).toBe('urn:example:');
      
      const expanded = manager.expand('urn:resource');
      expect(expanded).toBe('urn:example:resource');
    });

    it('should handle URI schemes that look like prefixes', () => {
      const manager = new NamespaceManager({ autoRegister: true });
      
      const result = manager.expand('mailto:test@example.com');
      expect(result).toBe('mailto:test@example.com');
    });
  });
});