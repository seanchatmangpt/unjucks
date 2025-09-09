/**
 * Focused test for singularization algorithm - isolated from dependencies
 */

// Direct import of singular function for testing without environment setup
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

// Test the current broken implementation
function currentSingular(str) {
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
  if (s.length === 1) return s;
  if (s.length === 2) {
    if (['is', 'us', 'as', 'ok'].includes(s)) return s;
  }
  
  // 1. Handle words ending in 'ies' → 'y' (companies → company)
  if (s.endsWith('ies') && s.length > 3) {
    return s.slice(0, -3) + 'y';
  }
  
  // 2. Handle words ending in 'ves' → 'f/fe' (leaves → leaf, knives → knife)
  if (s.endsWith('ves') && s.length > 3) {
    const base = s.slice(0, -3);
    if (base.endsWith('li') || base.endsWith('wi') || base.endsWith('kni')) {
      return base + 'fe';
    }
    return base + 'f';
  }
  
  // 3. Handle words ending in 'xes' → 'x' (boxes → box)
  if (s.endsWith('xes')) {
    return s.slice(0, -2);
  }
  
  // 4. Handle specific 'ses' patterns
  if (s.endsWith('ses') && s.length > 3) {
    if (s === 'databases') {
      return 'database';
    }
    
    const withoutEs = s.slice(0, -2);
    if (['glass', 'class', 'pass', 'gas', 'bus', 'kiss', 'miss', 'boss'].includes(withoutEs)) {
      return withoutEs;
    }
    
    if (s === 'processes') {
      return 'process';
    }
    
    return withoutEs;
  }
  
  // 5. Handle words ending in 'oes' → 'o' (tomatoes → tomato)
  if (s.endsWith('oes')) {
    return s.slice(0, -2);
  }
  
  // 6. Handle words ending in 'es' - context-dependent
  if (s.endsWith('es') && s.length > 2) {
    const base = s.slice(0, -2);
    
    if (base.endsWith('s') || base.endsWith('sh') || base.endsWith('ch') || 
        base.endsWith('x') || base.endsWith('z')) {
      return base;
    }
    
    return s.slice(0, -1);
  }
  
  // 7. Handle regular words ending in 's'
  if (s.endsWith('s') && s.length > 1) {
    if (s.endsWith('ss')) {
      if (['addresses', 'processes', 'stresses', 'successes', 'accesses'].includes(s)) {
        return s.slice(0, -2);
      }
      return s;
    }
    
    return s.slice(0, -1);
  }
  
  return s;
}

// Test critical failures
console.log('=== CRITICAL SINGULARIZATION TEST RESULTS ===');
console.log('Testing current implementation...\n');

const criticalTests = [
  { input: 'buses', expected: 'bus', description: 'buses → bus (not buse)' },
  { input: 'glasses', expected: 'glass', description: 'glasses → glass (not glasse)' },
  { input: 'companies', expected: 'company', description: 'companies → company (not companie)' },
  { input: 'children', expected: 'child', description: 'children → child (irregular)' },
  { input: 'geese', expected: 'goose', description: 'geese → goose (irregular)' },
  { input: 'boxes', expected: 'box', description: 'boxes → box' },
  { input: 'cities', expected: 'city', description: 'cities → city' },
  { input: 'knives', expected: 'knife', description: 'knives → knife' },
  { input: 'heroes', expected: 'hero', description: 'heroes → hero' }
];

let failures = 0;
let successes = 0;

criticalTests.forEach(test => {
  const result = currentSingular(test.input);
  const passed = result === test.expected;
  
  if (passed) {
    console.log(`✅ PASS: ${test.description} | Got: ${result}`);
    successes++;
  } else {
    console.log(`❌ FAIL: ${test.description} | Expected: ${test.expected}, Got: ${result}`);
    failures++;
  }
});

console.log(`\n=== SUMMARY ===`);
console.log(`Successes: ${successes}/${criticalTests.length}`);
console.log(`Failures: ${failures}/${criticalTests.length}`);
console.log(`Success Rate: ${((successes / criticalTests.length) * 100).toFixed(1)}%`);

if (failures > 0) {
  console.log('\n🚨 CRITICAL FIXES NEEDED:');
  criticalTests.forEach(test => {
    const result = currentSingular(test.input);
    if (result !== test.expected) {
      console.log(`   - ${test.input} → ${result} (should be ${test.expected})`);
    }
  });
}