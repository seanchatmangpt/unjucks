/**
 * Comprehensive tests for string filters, focusing on singularization fixes
 */

import { describe, test, expect } from 'vitest';
import { singular, pluralize } from '../../src/lib/nunjucks-filters.js';

describe('String Filters - Singularization', () => {
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

  describe('Previously broken cases', () => {
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
      expect(singular('is')).toBe('is'); // Keep 'is' as-is since it ends in 's' but is very short
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
});

describe('String Filters - Pluralization', () => {
  describe('Irregular singulars', () => {
    test('pluralizes irregular singulars correctly', () => {
      expect(pluralize('person')).toBe('people');
      expect(pluralize('child')).toBe('children');
      expect(pluralize('foot')).toBe('feet');
      expect(pluralize('tooth')).toBe('teeth');
      expect(pluralize('goose')).toBe('geese');
      expect(pluralize('mouse')).toBe('mice');
      expect(pluralize('man')).toBe('men');
      expect(pluralize('woman')).toBe('women');
      expect(pluralize('ox')).toBe('oxen');
    });

    test('pluralizes f/fe endings correctly', () => {
      expect(pluralize('knife')).toBe('knives');
      expect(pluralize('life')).toBe('lives');
      expect(pluralize('wife')).toBe('wives');
      expect(pluralize('wolf')).toBe('wolves');
      expect(pluralize('leaf')).toBe('leaves');
      expect(pluralize('calf')).toBe('calves');
      expect(pluralize('half')).toBe('halves');
      expect(pluralize('loaf')).toBe('loaves');
      expect(pluralize('shelf')).toBe('shelves');
      expect(pluralize('thief')).toBe('thieves');
      expect(pluralize('scarf')).toBe('scarves');
    });
  });

  describe('Regular pluralization', () => {
    test('adds -s to most words', () => {
      expect(pluralize('cat')).toBe('cats');
      expect(pluralize('dog')).toBe('dogs');
      expect(pluralize('book')).toBe('books');
      expect(pluralize('table')).toBe('tables');
    });

    test('adds -es to words ending in s, sh, ch, x, z', () => {
      expect(pluralize('bus')).toBe('buses');
      expect(pluralize('dish')).toBe('dishes');
      expect(pluralize('church')).toBe('churches');
      expect(pluralize('box')).toBe('boxes');
      expect(pluralize('buzz')).toBe('buzzes');
    });

    test('converts -y to -ies after consonants', () => {
      expect(pluralize('city')).toBe('cities');
      expect(pluralize('story')).toBe('stories');
      expect(pluralize('party')).toBe('parties');
      expect(pluralize('company')).toBe('companies');
    });

    test('keeps -y after vowels', () => {
      expect(pluralize('boy')).toBe('boys');
      expect(pluralize('day')).toBe('days');
      expect(pluralize('key')).toBe('keys');
    });

    test('handles -o endings correctly', () => {
      expect(pluralize('hero')).toBe('heroes');
      expect(pluralize('potato')).toBe('potatoes');
      expect(pluralize('photo')).toBe('photos'); // Exception
      expect(pluralize('piano')).toBe('pianos'); // Exception
    });
  });
});

describe('String Filters - Round Trip', () => {
  test('singular -> plural -> singular maintains consistency', () => {
    const testWords = [
      'cat', 'bus', 'city', 'knife', 'hero', 
      'person', 'child', 'foot', 'analysis', 'matrix'
    ];
    
    testWords.forEach(word => {
      const pluralized = pluralize(word);
      const singularized = singular(pluralized);
      expect(singularized).toBe(word);
    });
  });

  test('plural -> singular -> plural maintains consistency for regular words', () => {
    const testWords = [
      'cats', 'buses', 'cities', 'knives', 'heroes'
    ];
    
    testWords.forEach(word => {
      const singularized = singular(word);
      const pluralized = pluralize(singularized);
      expect(pluralized).toBe(word);
    });
  });
});