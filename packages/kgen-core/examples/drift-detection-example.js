#!/usr/bin/env node

/**
 * KGEN Drift Detection - Practical Usage Example
 * 
 * This example demonstrates how to use the pure JavaScript drift detector
 * for various real-world scenarios including code, configuration, and RDF data.
 */

import DriftDetector, { 
  detectDrift, 
  calculateDriftScore, 
  generateDriftReport,
  DriftSeverity,
  DriftTypes
} from '../src/drift/detector.js';

console.log('🔍 KGEN Drift Detection - Practical Examples');
console.log('==============================================\n');

/**
 * Example 1: JavaScript Code Drift Detection
 */
async function exampleCodeDrift() {
  console.log('📝 Example 1: JavaScript Code Drift Detection\n');
  
  const originalCode = `
    function calculateTax(amount, rate) {
      if (amount < 0 || rate < 0) {
        throw new Error('Invalid input');
      }
      return amount * (rate / 100);
    }
  `;

  const modifiedCode = `
    function calculateTax(amount, rate) {
      // Added validation
      if (amount < 0 || rate < 0 || rate > 100) {
        throw new Error('Invalid input');
      }
      // Use more precise calculation
      return Math.round(amount * (rate / 100) * 100) / 100;
    }
  `;

  const result = await detectDrift(
    { path: 'tax-calculator.js', content: originalCode },
    { path: 'tax-calculator.js', content: modifiedCode }
  );

  console.log('Drift Detection Result:');
  console.log(`- Drift Detected: ${result.hasDrift ? '✅' : '❌'}`);
  console.log(`- Similarity: ${(result.similarity * 100).toFixed(1)}%`);
  console.log(`- Drift Score: ${result.driftScore.toFixed(3)}`);
  console.log(`- Content Changed: ${result.driftTypes.content ? '✅' : '❌'}`);
  console.log(`- Semantic Changed: ${result.driftTypes.semantic ? '✅' : '❌'}`);
  
  if (result.recommendations.length > 0) {
    console.log('\nRecommendations:');
    result.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`);
    });
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
}

/**
 * Example 2: Configuration Drift Detection
 */
async function exampleConfigDrift() {
  console.log('⚙️  Example 2: Configuration Drift Detection\n');
  
  const productionConfig = {
    database: {
      host: 'prod-db.example.com',
      port: 5432,
      name: 'myapp_prod',
      ssl: true,
      connectionPool: {
        min: 5,
        max: 20
      }
    },
    cache: {
      enabled: true,
      ttl: 3600,
      maxSize: '1GB'
    },
    logging: {
      level: 'warn',
      format: 'json'
    }
  };

  const stagingConfig = {
    database: {
      host: 'staging-db.example.com', // Different host
      port: 5432,
      name: 'myapp_staging',           // Different database
      ssl: true,
      connectionPool: {
        min: 2,                        // Smaller pool
        max: 10
      }
    },
    cache: {
      enabled: false,                  // Cache disabled
      ttl: 3600,
      maxSize: '512MB'                 // Smaller cache
    },
    logging: {
      level: 'debug',                  // More verbose logging
      format: 'text'                   // Different format
    }
  };

  const detector = new DriftDetector({
    tolerance: 0.8 // More lenient for config comparison
  });
  
  await detector.initialize();
  const result = await detector.detectDrift(productionConfig, stagingConfig);

  console.log('Configuration Drift Analysis:');
  console.log(`- Drift Detected: ${result.hasDrift ? '✅' : '❌'}`);
  console.log(`- Similarity: ${(result.similarity * 100).toFixed(1)}%`);
  console.log(`- Drift Score: ${result.driftScore.toFixed(3)}`);
  
  if (result.differences.length > 0) {
    console.log('\nDetected Differences:');
    result.differences.forEach((diff, i) => {
      console.log(`  ${i + 1}. [${diff.severity.toUpperCase()}] ${diff.description}`);
    });
  }
  
  // Generate a human-readable report
  const report = generateDriftReport(result, { format: 'human' });
  console.log('\nHuman-Readable Report:');
  console.log(report.humanReadable);
  
  console.log('\n' + '='.repeat(50) + '\n');
}

/**
 * Example 3: RDF/Semantic Data Drift Detection
 */
async function exampleRDFDrift() {
  console.log('🧬 Example 3: RDF/Semantic Data Drift Detection\n');
  
  const originalRDF = `
    @prefix ex: <http://example.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    
    ex:Alice foaf:name "Alice Smith" ;
             foaf:email "alice@example.org" ;
             foaf:knows ex:Bob .
    
    ex:Bob foaf:name "Bob Johnson" ;
           foaf:email "bob@example.org" ;
           foaf:age 30 .
  `;

  const modifiedRDF = `
    @prefix ex: <http://example.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    
    ex:Alice foaf:name "Alice Smith" ;
             foaf:email "alice.smith@example.org" ; # Email changed
             foaf:knows ex:Bob .
    
    ex:Bob foaf:name "Bob Johnson" ;
           foaf:email "bob@example.org" ;
           foaf:age 31 .  # Age updated
           
    ex:Charlie foaf:name "Charlie Brown" ;  # New person added
               foaf:email "charlie@example.org" .
  `;

  const result = await detectDrift(
    { path: 'people.ttl', content: originalRDF },
    { path: 'people.ttl', content: modifiedRDF }
  );

  console.log('RDF Semantic Drift Analysis:');
  console.log(`- Drift Detected: ${result.hasDrift ? '✅' : '❌'}`);
  console.log(`- Similarity: ${(result.similarity * 100).toFixed(1)}%`);
  console.log(`- Drift Score: ${result.driftScore.toFixed(3)}`);
  console.log(`- Semantic Changed: ${result.driftTypes.semantic ? '✅' : '❌'}`);
  
  // Calculate custom drift score based on detected differences
  const customScore = calculateDriftScore(result.differences);
  console.log(`- Custom Calculated Score: ${customScore.toFixed(3)}`);
  
  console.log('\n' + '='.repeat(50) + '\n');
}

/**
 * Example 4: Performance and Caching Demonstration
 */
async function examplePerformanceDemo() {
  console.log('⚡ Example 4: Performance and Caching Demo\n');
  
  const detector = new DriftDetector({
    cacheSize: 100,
    tolerance: 0.95
  });
  
  await detector.initialize();
  
  const testContent = `
    const fibonacci = (n) => {
      if (n <= 1) return n;
      return fibonacci(n - 1) + fibonacci(n - 2);
    };
  `;
  
  // Perform multiple comparisons to test caching
  const startTime = Date.now();
  
  for (let i = 0; i < 5; i++) {
    await detector.detectDrift(testContent, testContent + ` // iteration ${i}`);
  }
  
  const endTime = Date.now();
  const stats = detector.getStats();
  
  console.log('Performance Statistics:');
  console.log(`- Total Comparisons: ${stats.comparisons}`);
  console.log(`- Cache Hits: ${stats.cacheHits}`);
  console.log(`- Cache Misses: ${stats.cacheMisses}`);
  console.log(`- Cache Efficiency: ${stats.cacheEfficiency.toFixed(1)}%`);
  console.log(`- Average Processing Time: ${stats.averageProcessingTime.toFixed(2)}ms`);
  console.log(`- Total Time: ${endTime - startTime}ms`);
  
  // Health check
  const health = detector.healthCheck();
  console.log('\nSystem Health:');
  console.log(`- Status: ${health.status}`);
  console.log(`- Cache Size: ${health.cacheSize} items`);
  
  console.log('\n' + '='.repeat(50) + '\n');
}

/**
 * Example 5: Batch Processing and Reporting
 */
async function exampleBatchProcessing() {
  console.log('📊 Example 5: Batch Processing and Reporting\n');
  
  const detector = new DriftDetector();
  await detector.initialize();
  
  // Simulate multiple artifact comparisons
  const artifacts = [
    {
      name: 'User Model',
      original: 'class User { constructor(name, email) { this.name = name; this.email = email; } }',
      current: 'class User { constructor(name, email, id) { this.name = name; this.email = email; this.id = id; } }'
    },
    {
      name: 'API Config', 
      original: { apiVersion: '1.0', timeout: 5000 },
      current: { apiVersion: '1.1', timeout: 10000 }
    },
    {
      name: 'Database Schema',
      original: 'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));',
      current: 'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100), email VARCHAR(255));'
    }
  ];
  
  const results = [];
  let totalDrift = 0;
  
  for (const artifact of artifacts) {
    const result = await detector.detectDrift(artifact.original, artifact.current);
    result.artifactName = artifact.name;
    results.push(result);
    
    if (result.hasDrift) {
      totalDrift++;
    }
  }
  
  // Generate batch report
  console.log('Batch Processing Results:');
  console.log(`- Total Artifacts: ${artifacts.length}`);
  console.log(`- Artifacts with Drift: ${totalDrift}`);
  console.log(`- Overall Drift Rate: ${((totalDrift / artifacts.length) * 100).toFixed(1)}%`);
  
  console.log('\nDetailed Results:');
  results.forEach((result, i) => {
    console.log(`\n${i + 1}. ${result.artifactName}:`);
    console.log(`   - Drift: ${result.hasDrift ? '✅' : '❌'}`);
    console.log(`   - Score: ${result.driftScore.toFixed(3)}`);
    console.log(`   - Similarity: ${(result.similarity * 100).toFixed(1)}%`);
    
    if (result.recommendations.length > 0) {
      console.log(`   - Top Recommendation: ${result.recommendations[0].message}`);
    }
  });
  
  console.log('\n' + '='.repeat(50) + '\n');
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    await exampleCodeDrift();
    await exampleConfigDrift();
    await exampleRDFDrift();
    await examplePerformanceDemo();
    await exampleBatchProcessing();
    
    console.log('🎉 All examples completed successfully!');
    console.log('\n💡 Key Takeaways:');
    console.log('- Use drift detection to monitor code changes');
    console.log('- Configure tolerance based on your use case');
    console.log('- Leverage semantic hashing for meaningful comparisons');
    console.log('- Cache results for better performance');
    console.log('- Generate reports for stakeholders');
    console.log('- Use recommendations to guide actions');
    
  } catch (error) {
    console.error('❌ Example execution failed:', error);
    process.exit(1);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}