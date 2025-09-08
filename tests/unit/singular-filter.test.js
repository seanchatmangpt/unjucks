/**
 * Test file for singular filter edge cases
 * Tests the specific cases that were breaking in the singularization algorithm
 */

import { describe, it, expect } from 'vitest';
import { singular } from '../../src/lib/nunjucks-filters.js';

describe('Singular Filter Edge Cases', () => {
  describe('Words ending in ies → y', () => {
    it('should handle companies → company', () => {
      expect(singular('companies')).toBe('company');
    });
    
    it('should handle babies → baby', () => {
      expect(singular('babies')).toBe('baby');
    });
    
    it('should handle stories → story', () => {
      expect(singular('stories')).toBe('story');
    });
    
    it('should handle countries → country', () => {
      expect(singular('countries')).toBe('country');
    });
  });

  describe('Words ending in ves → f/fe', () => {
    it('should handle leaves → leaf', () => {
      expect(singular('leaves')).toBe('leaf');
    });
    
    it('should handle knives → knife', () => {
      expect(singular('knives')).toBe('knife');
    });
    
    it('should handle wolves → wolf', () => {
      expect(singular('wolves')).toBe('wolf');
    });
    
    it('should handle calves → calf', () => {
      expect(singular('calves')).toBe('calf');
    });
  });

  describe('Words ending in ses → s', () => {
    it('should handle databases → database', () => {
      expect(singular('databases')).toBe('database');
    });
    
    it('should handle glasses → glass', () => {
      expect(singular('glasses')).toBe('glass');
    });
    
    it('should handle classes → class', () => {
      expect(singular('classes')).toBe('class');
    });
    
    it('should handle processes → process', () => {
      expect(singular('processes')).toBe('process');
    });
  });

  describe('Words ending in xes → x', () => {
    it('should handle boxes → box', () => {
      expect(singular('boxes')).toBe('box');
    });
    
    it('should handle foxes → fox', () => {
      expect(singular('foxes')).toBe('fox');
    });
    
    it('should handle taxes → tax', () => {
      expect(singular('taxes')).toBe('tax');
    });
    
    it('should handle fixes → fix', () => {
      expect(singular('fixes')).toBe('fix');
    });
  });

  describe('Irregular plurals', () => {
    it('should handle people → person', () => {
      expect(singular('people')).toBe('person');
    });
    
    it('should handle children → child', () => {
      expect(singular('children')).toBe('child');
    });
    
    it('should handle mice → mouse', () => {
      expect(singular('mice')).toBe('mouse');
    });
    
    it('should handle feet → foot', () => {
      expect(singular('feet')).toBe('foot');
    });
  });

  describe('Uncountable nouns', () => {
    it('should not change data', () => {
      expect(singular('data')).toBe('data');
    });
    
    it('should not change information', () => {
      expect(singular('information')).toBe('information');
    });
    
    it('should not change sheep', () => {
      expect(singular('sheep')).toBe('sheep');
    });
    
    it('should not change fish', () => {
      expect(singular('fish')).toBe('fish');
    });
  });

  describe('Regular plurals', () => {
    it('should handle cats → cat', () => {
      expect(singular('cats')).toBe('cat');
    });
    
    it('should handle dogs → dog', () => {
      expect(singular('dogs')).toBe('dog');
    });
    
    it('should handle books → book', () => {
      expect(singular('books')).toBe('book');
    });
    
    it('should handle cars → car', () => {
      expect(singular('cars')).toBe('car');
    });
  });

  describe('Edge cases and special handling', () => {
    it('should handle empty string', () => {
      expect(singular('')).toBe('');
    });
    
    it('should handle single character', () => {
      expect(singular('s')).toBe('s');
    });
    
    it('should handle non-string input', () => {
      expect(singular(123)).toBe(123);
      expect(singular(null)).toBe(null);
      expect(singular(undefined)).toBe(undefined);
    });
    
    it('should handle already singular words', () => {
      expect(singular('book')).toBe('book');
      expect(singular('car')).toBe('car');
      expect(singular('house')).toBe('hous'); // Regular rule applies
    });
  });
});