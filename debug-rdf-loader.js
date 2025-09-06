import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Test RDF data loading directly without TypeScript compilation
async function testRDFLoading() {
  try {
    console.log('Testing RDF data loading without TS compilation...');
    
    // Get current directory
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Load the turtle file content
    const turtleFile = path.join(__dirname, 'tests/fixtures/turtle/basic-person.ttl');
    const content = fs.readFileSync(turtleFile, 'utf-8');
    console.log('Loaded turtle file, length:', content.length);
    
    // Try direct n3 parsing which we know works
    const { Parser, Store } = await import('n3');
    const parser = new Parser();
    const quads = parser.parse(content);
    console.log('N3 direct parsing succeeded, quads:', quads.length);
    
    console.log('Success: We can parse the file correctly!');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testRDFLoading();
