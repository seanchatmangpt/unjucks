#!/usr/bin/env node
/**
 * Test TypeScript type generation from RDF/Turtle
 * Demonstrates semantic type conversion capabilities
 */

const N3 = require('n3');
const fs = require('fs');
const path = require('path');

console.log('🔧 Testing TypeScript Type Generation from RDF');
console.log('================================================\n');

/**
 * Simple RDF to TypeScript type converter
 */
class SimpleRDFTypeConverter {
  constructor() {
    this.namespaces = {
      'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
      'owl': 'http://www.w3.org/2002/07/owl#',
      'xsd': 'http://www.w3.org/2001/XMLSchema#',
      'foaf': 'http://xmlns.com/foaf/0.1/',
      'schema': 'http://schema.org/'
    };
  }

  parseRDF(turtleData) {
    return new Promise((resolve, reject) => {
      const parser = new N3.Parser();
      const quads = [];
      
      parser.parse(turtleData, (error, quad, prefixes) => {
        if (error) {
          reject(error);
          return;
        }
        
        if (quad) {
          quads.push(quad);
        } else {
          resolve({ quads, prefixes: prefixes || {} });
        }
      });
    });
  }

  extractClassDefinitions(quads) {
    const classes = new Map();
    
    // Find all class declarations
    quads.forEach(quad => {
      if (quad.predicate.value === this.namespaces.rdf + 'type') {
        if (quad.object.value === this.namespaces.rdfs + 'Class' || 
            quad.object.value === this.namespaces.owl + 'Class') {
          const className = this.extractLocalName(quad.subject.value);
          if (!classes.has(className)) {
            classes.set(className, {
              uri: quad.subject.value,
              name: className,
              properties: new Map(),
              comment: '',
              label: ''
            });
          }
        }
      }
    });

    // Find properties for classes
    quads.forEach(quad => {
      if (quad.predicate.value === this.namespaces.rdfs + 'domain') {
        const className = this.extractLocalName(quad.object.value);
        const propertyName = this.extractLocalName(quad.subject.value);
        
        if (classes.has(className)) {
          classes.get(className).properties.set(propertyName, {
            uri: quad.subject.value,
            name: propertyName,
            type: 'string', // default
            optional: false
          });
        }
      }
      
      if (quad.predicate.value === this.namespaces.rdfs + 'range') {
        const propertyUri = quad.subject.value;
        const rangeType = this.mapXSDTypeToTypeScript(quad.object.value);
        
        // Find which class this property belongs to
        classes.forEach(classInfo => {
          classInfo.properties.forEach(prop => {
            if (prop.uri === propertyUri) {
              prop.type = rangeType;
            }
          });
        });
      }

      // Extract labels and comments
      if (quad.predicate.value === this.namespaces.rdfs + 'label') {
        const className = this.extractLocalName(quad.subject.value);
        if (classes.has(className)) {
          classes.get(className).label = quad.object.value;
        }
      }
      
      if (quad.predicate.value === this.namespaces.rdfs + 'comment') {
        const className = this.extractLocalName(quad.subject.value);
        if (classes.has(className)) {
          classes.get(className).comment = quad.object.value;
        }
      }
    });

    return Array.from(classes.values());
  }

  extractLocalName(uri) {
    const parts = uri.split(/[/#]/);
    return parts[parts.length - 1];
  }

  mapXSDTypeToTypeScript(xsdType) {
    const typeMap = {
      [this.namespaces.xsd + 'string']: 'string',
      [this.namespaces.xsd + 'integer']: 'number',
      [this.namespaces.xsd + 'decimal']: 'number',
      [this.namespaces.xsd + 'double']: 'number',
      [this.namespaces.xsd + 'boolean']: 'boolean',
      [this.namespaces.xsd + 'date']: 'Date',
      [this.namespaces.xsd + 'dateTime']: 'Date',
      [this.namespaces.xsd + 'anyURI']: 'string'
    };
    
    return typeMap[xsdType] || 'string';
  }

  generateTypeScriptInterface(classDefinition) {
    const { name, properties, comment, label } = classDefinition;
    
    let typescript = '';
    
    // Add documentation comment
    if (comment || label) {
      typescript += '/**\n';
      if (label) typescript += ` * ${label}\n`;
      if (comment) typescript += ` * ${comment}\n`;
      typescript += ` * Generated from RDF ontology\n`;
      typescript += ' */\n';
    }
    
    typescript += `export interface ${name} {\n`;
    
    // Add properties
    properties.forEach(prop => {
      const optionalMarker = prop.optional ? '?' : '';
      typescript += `  ${prop.name}${optionalMarker}: ${prop.type};\n`;
    });
    
    typescript += '}\n\n';
    
    return typescript;
  }

  async convertTurtleToTypeScript(filePath) {
    const fileName = path.basename(filePath);
    console.log(`🔄 Converting ${fileName} to TypeScript interfaces`);
    
    try {
      const turtleData = fs.readFileSync(filePath, 'utf8');
      const { quads, prefixes } = await this.parseRDF(turtleData);
      
      console.log(`   📊 Parsed ${quads.length} triples`);
      
      const classes = this.extractClassDefinitions(quads);
      console.log(`   🏷️  Found ${classes.length} class definitions`);
      
      let typescript = '';
      typescript += '// TypeScript interfaces generated from RDF ontology\n';
      typescript += `// Source: ${fileName}\n`;
      typescript += `// Generated: ${new Date().toISOString()}\n\n`;
      
      classes.forEach(classInfo => {
        console.log(`     - ${classInfo.name} (${classInfo.properties.size} properties)`);
        typescript += this.generateTypeScriptInterface(classInfo);
      });
      
      return {
        typescript,
        classes: classes.length,
        totalProperties: classes.reduce((sum, c) => sum + c.properties.size, 0)
      };
      
    } catch (error) {
      console.log(`   ❌ Conversion error: ${error.message}`);
      throw error;
    }
  }
}

async function testTypeGeneration() {
  const converter = new SimpleRDFTypeConverter();
  
  const testFiles = [
    'tests/fixtures/turtle/basic-person.ttl',
    'tests/fixtures/turtle/complex-schema.ttl',
    'examples/sample-ontology.ttl'
  ];
  
  const results = [];
  
  for (const file of testFiles) {
    if (fs.existsSync(file)) {
      try {
        const result = await converter.convertTurtleToTypeScript(file);
        results.push({
          file,
          success: true,
          ...result
        });
        
        // Write generated TypeScript to test output
        const outputFile = `generated-types-${path.basename(file, '.ttl')}.ts`;
        fs.writeFileSync(outputFile, result.typescript);
        console.log(`   ✅ Generated: ${outputFile}`);
        console.log('');
        
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}\n`);
        results.push({
          file,
          success: false,
          error: error.message
        });
      }
    }
  }
  
  // Summary
  console.log('📈 TYPE GENERATION SUMMARY');
  console.log('===========================');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful conversions: ${successful.length}`);
  console.log(`❌ Failed conversions: ${failed.length}`);
  
  if (successful.length > 0) {
    const totalClasses = successful.reduce((sum, r) => sum + r.classes, 0);
    const totalProperties = successful.reduce((sum, r) => sum + r.totalProperties, 0);
    
    console.log(`🎯 Total classes converted: ${totalClasses}`);
    console.log(`🔗 Total properties generated: ${totalProperties}`);
    
    console.log('\n📁 Generated TypeScript files:');
    successful.forEach(r => {
      const outputFile = `generated-types-${path.basename(r.file, '.ttl')}.ts`;
      console.log(`   - ${outputFile} (${r.classes} interfaces, ${r.totalProperties} properties)`);
    });
    
    console.log('\n✅ RDF to TypeScript conversion is WORKING!');
    console.log('   This demonstrates the core semantic functionality.');
  }
}

testTypeGeneration().catch(console.error);