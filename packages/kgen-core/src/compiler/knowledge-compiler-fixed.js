/**
 * Fixed version of the N3 pattern parsing in Knowledge Compiler
 * Focus on fixing the rule parsing issue
 */

// Fixed pattern parsing method
function _parseN3Patterns(patternText) {
  const patterns = [];
  
  // Clean up the text and split into lines
  const cleanText = patternText.replace(/[{}]/g, '').trim();
  
  // Split by newline and filter out empty lines
  const lines = cleanText.split(/\n/).filter(line => line.trim());
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed !== '=>') {
      // Match patterns like: ?endpoint <predicate> value
      const match = trimmed.match(/(\??[\w:\/\.-]+|\S+)\s+(<[^>]+>|[\w:\/\.-]+)\s+(.+)/);
      if (match) {
        patterns.push({
          subject: match[1].replace(/[<>]/g, ''),
          predicate: match[2].replace(/[<>]/g, ''),
          object: match[3].replace(/[<>"]/g, '').trim()
        });
      }
    }
  }
  
  return patterns;
}

// Test the pattern parsing
const testRule = `{
      ?endpoint <http://unjucks.dev/api/isPublic> true
    } => {
      ?endpoint <http://unjucks.dev/api/requiresAuth> true
    }`;

const parts = testRule.split('=>');
console.log('Rule parts:', parts);

const conditions = _parseN3Patterns(parts[0].trim());
const conclusions = _parseN3Patterns(parts[1].trim());

console.log('Parsed conditions:', JSON.stringify(conditions, null, 2));
console.log('Parsed conclusions:', JSON.stringify(conclusions, null, 2));