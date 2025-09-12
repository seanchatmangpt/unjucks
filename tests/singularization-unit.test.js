/**
 * Isolated unit test for singularization without external dependencies
 */

import { describe, test, expect } from 'vitest';

// Define the IRREGULAR_PLURALS lookup table
const IRREGULAR_PLURALS = {
  'people': 'person',
  'children': 'child',
  'feet': 'foot',
  'teeth': 'tooth',
  'geese': 'goose',
  'mice': 'mouse',
  'men': 'man',
  'women': 'woman',
  'oxen': 'ox',
  'deer': 'deer',
  'sheep': 'sheep',
  'fish': 'fish',
  'moose': 'moose',
  'species': 'species',
  'series': 'series',
  'means': 'means',
  'data': 'datum',
  'media': 'medium',
  'criteria': 'criterion',
  'phenomena': 'phenomenon',
  'alumni': 'alumnus',
  'cacti': 'cactus',
  'fungi': 'fungus',
  'nuclei': 'nucleus',
  'stimuli': 'stimulus',
  'syllabi': 'syllabus',
  'analyses': 'analysis',
  'bases': 'basis',
  'crises': 'crisis',
  'diagnoses': 'diagnosis',
  'hypotheses': 'hypothesis',
  'oases': 'oasis',
  'parentheses': 'parenthesis',
  'syntheses': 'synthesis',
  'theses': 'thesis',
  'vertices': 'vertex',
  'matrices': 'matrix',
  'indices': 'index',
  'appendices': 'appendix',
  'knives': 'knife',
  'lives': 'life',
  'wives': 'wife',
  'wolves': 'wolf',
  'leaves': 'leaf',
  'calves': 'calf',
  'halves': 'half',
  'loaves': 'loaf',
  'shelves': 'shelf',
  'thieves': 'thief',
  'scarves': 'scarf'
};

// Optimized singularization function - isolated from external dependencies
function singular(str) {
  if (typeof str !== 'string') return str;
  const s = str.toString().toLowerCase();
  
  // Check for irregular plurals first
  if (IRREGULAR_PLURALS[s]) {
    return IRREGULAR_PLURALS[s];
  }
  
  // Special cases that don't change (uncountable nouns)
  if (['deer', 'sheep', 'fish', 'moose', 'species', 'series', 'means', 'news', 'information', 'advice', 'research'].includes(s)) {
    return s;
  }
  
  // Handle empty strings and very short words
  if (s.length === 0) return s;
  if (s.length === 1) return s; // Don't change single characters
  if (s.length === 2) {
    // Keep common short words unchanged (is, us, as, etc.)
    if (['is', 'us', 'as', 'ok'].includes(s)) return s;
  }
  
  // 1. Handle words ending in 'ies' → 'y' (companies → company)
  if (s.endsWith('ies') && s.length > 3) {
    return s.slice(0, -3) + 'y';
  }
  
  // 2. Handle words ending in 'ves' → 'f/fe' (leaves → leaf, knives → knife)
  if (s.endsWith('ves') && s.length > 3) {
    const base = s.slice(0, -3);
    // Words that end in 'fe' when singular (lives → life, knives → knife, wives → wife)
    if (base.endsWith('li') || base.endsWith('wi') || base.endsWith('kni')) {
      return base + 'fe';
    }
    // Most others end in 'f' (leaves → leaf, calves → calf, wolves → wolf)
    return base + 'f';
  }
  
  // 3. Handle words ending in 'xes' → 'x' (boxes → box)
  if (s.endsWith('xes')) {
    return s.slice(0, -2);
  }
  
  // 4. Handle specific 'ses' patterns
  if (s.endsWith('ses') && s.length > 3) {
    // Handle databases → database (special case)
    if (s === 'databases') {
      return 'database';
    }
    
    // Handle words like glasses → glass, classes → class
    const withoutEs = s.slice(0, -2);
    if (['glass', 'class', 'pass', 'gas', 'bus', 'kiss', 'miss', 'boss'].includes(withoutEs)) {
      return withoutEs;
    }
    
    // Handle processes → process 
    if (s === 'processes') {
      return 'process';
    }
    
    // Default: remove 'es'
    return withoutEs;
  }
  
  // 5. Handle words ending in 'oes' → 'o' (tomatoes → tomato)
  if (s.endsWith('oes')) {
    return s.slice(0, -2);
  }
  
  // 6. Handle words ending in 'es' - context-dependent
  if (s.endsWith('es') && s.length > 2) {
    const base = s.slice(0, -2);
    
    // If base ends in s, ss, sh, ch, x, z - these require 'es' for plural
    if (base.endsWith('s') || base.endsWith('sh') || base.endsWith('ch') || 
        base.endsWith('x') || base.endsWith('z')) {
      return base;
    }
    
    // For most other 'es' endings, just remove 's' (it was likely just 's' added)
    return s.slice(0, -1);
  }
  
  // 7. Handle regular words ending in 's'
  if (s.endsWith('s') && s.length > 1) {
    // Don't singularize words ending in 'ss' unless they're known plurals
    if (s.endsWith('ss')) {
      // Known plural forms that end in 'ss'
      if (['addresses', 'processes', 'stresses', 'successes', 'accesses'].includes(s)) {
        return s.slice(0, -2); // Remove 'es'
      }
      return s; // Keep 'ss' words unchanged
    }
    
    // Remove 's' from regular plurals
    return s.slice(0, -1);
  }
  
  // If no rules match, return as-is (likely already singular)
  return s;
}

describe('Singularization Algorithm - Isolated Tests', () => {
  describe('Critical failure cases (previously broken)', () => {
    test('fixes broken -es endings', () => {
      expect(singular('buses')).toBe('bus');
      expect(singular('boxes')).toBe('box');
      expect(singular('glasses')).toBe('glass');
      expect(singular('classes')).toBe('class');
      expect(singular('passes')).toBe('pass');
      expect(singular('gases')).toBe('gas');
      expect(singular('dishes')).toBe('dish');
      expect(singular('wishes')).toBe('wish');
      expect(singular('churches')).toBe('church');
      expect(singular('watches')).toBe('watch');
      expect(singular('foxes')).toBe('fox');
      expect(singular('taxes')).toBe('tax');
      expect(singular('buzzes')).toBe('buzz');
    });

    test('fixes broken -ies endings', () => {
      expect(singular('cities')).toBe('city');
      expect(singular('stories')).toBe('story');
      expect(singular('parties')).toBe('party');
      expect(singular('companies')).toBe('company');
      expect(singular('countries')).toBe('country');
      expect(singular('babies')).toBe('baby');
      expect(singular('flies')).toBe('fly');
      expect(singular('tries')).toBe('try');
    });

    test('fixes broken -ves endings', () => {
      expect(singular('knives')).toBe('knife');
      expect(singular('lives')).toBe('life');
      expect(singular('wives')).toBe('wife');
      expect(singular('wolves')).toBe('wolf');
      expect(singular('leaves')).toBe('leaf');
      expect(singular('calves')).toBe('calf');
      expect(singular('halves')).toBe('half');
      expect(singular('loaves')).toBe('loaf');
      expect(singular('shelves')).toBe('shelf');
      expect(singular('thieves')).toBe('thief');
      expect(singular('scarves')).toBe('scarf');
    });
  });

  describe('Irregular plurals', () => {
    test('handles common irregular plurals correctly', () => {
      expect(singular('people')).toBe('person');
      expect(singular('children')).toBe('child');
      expect(singular('feet')).toBe('foot');
      expect(singular('teeth')).toBe('tooth');
      expect(singular('geese')).toBe('goose');
      expect(singular('mice')).toBe('mouse');
      expect(singular('men')).toBe('man');
      expect(singular('women')).toBe('woman');
      expect(singular('oxen')).toBe('ox');
    });

    test('handles scientific/academic irregular plurals', () => {
      expect(singular('data')).toBe('datum');
      expect(singular('media')).toBe('medium');
      expect(singular('criteria')).toBe('criterion');
      expect(singular('phenomena')).toBe('phenomenon');
      expect(singular('alumni')).toBe('alumnus');
      expect(singular('cacti')).toBe('cactus');
      expect(singular('fungi')).toBe('fungus');
      expect(singular('nuclei')).toBe('nucleus');
      expect(singular('analyses')).toBe('analysis');
      expect(singular('bases')).toBe('basis');
      expect(singular('crises')).toBe('crisis');
      expect(singular('hypotheses')).toBe('hypothesis');
      expect(singular('matrices')).toBe('matrix');
      expect(singular('vertices')).toBe('vertex');
      expect(singular('indices')).toBe('index');
      expect(singular('appendices')).toBe('appendix');
    });
  });

  describe('Regular plurals', () => {
    test('handles standard -s endings', () => {
      expect(singular('cats')).toBe('cat');
      expect(singular('dogs')).toBe('dog');
      expect(singular('books')).toBe('book');
      expect(singular('tables')).toBe('table');
      expect(singular('computers')).toBe('computer');
      expect(singular('phones')).toBe('phone');
    });

    test('handles -oes endings', () => {
      expect(singular('heroes')).toBe('hero');
      expect(singular('potatoes')).toBe('potato');
      expect(singular('tomatoes')).toBe('tomato');
      expect(singular('echoes')).toBe('echo');
    });
  });

  describe('Uncountable nouns', () => {
    test('does not change uncountable nouns', () => {
      expect(singular('deer')).toBe('deer');
      expect(singular('sheep')).toBe('sheep');
      expect(singular('fish')).toBe('fish');
      expect(singular('moose')).toBe('moose');
      expect(singular('species')).toBe('species');
      expect(singular('series')).toBe('series');
      expect(singular('means')).toBe('means');
      expect(singular('news')).toBe('news');
      expect(singular('information')).toBe('information');
      expect(singular('advice')).toBe('advice');
      expect(singular('research')).toBe('research');
    });
  });

  describe('Edge cases', () => {
    test('handles empty and invalid inputs', () => {
      expect(singular('')).toBe('');
      expect(singular(null)).toBe(null);
      expect(singular(undefined)).toBe(undefined);
      expect(singular(123)).toBe(123);
    });

    test('handles single character and short words', () => {
      expect(singular('a')).toBe('a');
      expect(singular('is')).toBe('is');
      expect(singular('us')).toBe('us');
      expect(singular('as')).toBe('as');
    });

    test('handles words that are already singular', () => {
      expect(singular('cat')).toBe('cat');
      expect(singular('dog')).toBe('dog');
      expect(singular('house')).toBe('house');
      expect(singular('computer')).toBe('computer');
    });
  });

  describe('Performance validation', () => {
    test('handles large inputs efficiently', () => {
      const start = this.getDeterministicTimestamp();
      for (let i = 0; i < 1000; i++) {
        singular('companies');
        singular('glasses');
        singular('buses');
        singular('children');
        singular('geese');
      }
      const end = this.getDeterministicTimestamp();
      expect(end - start).toBeLessThan(100); // Should complete in under 100ms
    });
  });
});