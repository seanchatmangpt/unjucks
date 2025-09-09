/**
 * Performance Test Command
 * Quick performance validation and benchmarking
 */

import { defineCommand } from "citty";
import chalk from "chalk";
import { performance } from 'perf_hooks';
import { benchmarks } from '../lib/performance-benchmarks.js';
import { optimizedRDF } from '../lib/optimized-rdf-processor.js';
import { templateDiscoveryCache, generatorListCache } from '../lib/performance-cache.js';

export const perfTestCommand = defineCommand({
  meta: {
    name: "perf-test",
    description: "Run performance tests and benchmarks",
  },
  args: {
    full: {
      type: "boolean",
      description: "Run full benchmark suite",
      default: false,
    },
    quick: {
      type: "boolean", 
      description: "Run quick performance validation",
      default: false,
    },
    startup: {
      type: "boolean",
      description: "Test CLI startup performance",
      default: false,
    },
    rdf: {
      type: "boolean",
      description: "Test RDF processing performance", 
      default: false,
    },
    cache: {
      type: "boolean",
      description: "Test cache performance",
      default: false,
    },
  },
  async run({ args }) {
    console.log(chalk.blue.bold("🚀 Unjucks Performance Testing"));
    console.log(chalk.gray("Validating performance optimizations..."));
    console.log();

    try {
      if (args.full) {
        console.log(chalk.yellow("Running full benchmark suite..."));
        const results = await benchmarks.runFullBenchmarks();
        console.log(chalk.green("✅ Full benchmarks completed"));
        return { success: true, results };
      }

      if (args.startup || args.quick) {
        console.log(chalk.cyan("📊 Testing CLI startup performance..."));
        const startupResults = await benchmarks.benchmarkStartup(3);
        
        const isOptimal = startupResults.median < 150;
        const status = isOptimal ? "✅ OPTIMAL" : startupResults.median < 250 ? "⚠️  GOOD" : "❌ NEEDS WORK";
        
        console.log(`  Startup time: ${startupResults.median.toFixed(2)}ms (median) ${status}`);
        console.log(`  Target: <150ms, Current: ${startupResults.median.toFixed(2)}ms`);
      }

      if (args.rdf || args.quick) {
        console.log(chalk.cyan("🔗 Testing RDF processing performance..."));
        const rdfResults = await benchmarks.benchmarkRDFProcessing();
        
        const mediumThroughput = parseFloat(rdfResults.medium.avgThroughput);
        const isOptimal = mediumThroughput > 1000;
        const status = isOptimal ? "✅ OPTIMAL" : mediumThroughput > 500 ? "⚠️  GOOD" : "❌ NEEDS WORK";
        
        console.log(`  RDF throughput: ${rdfResults.medium.avgThroughput} triples/sec ${status}`);
        console.log(`  Target: >1000 triples/sec, Current: ${rdfResults.medium.avgThroughput} triples/sec`);
      }

      if (args.cache || args.quick) {
        console.log(chalk.cyan("💾 Testing cache performance..."));
        const cacheResults = await benchmarks.benchmarkCachePerformance();
        
        console.log("  Cache operations per second:");
        Object.entries(cacheResults).forEach(([name, stats]) => {
          const opsPerSec = parseFloat(stats.opsPerSec);
          const status = opsPerSec > 1000 ? "✅" : opsPerSec > 500 ? "⚠️" : "❌";
          console.log(`    ${name}: ${stats.opsPerSec} ops/sec ${status}`);
        });
      }

      if (args.quick) {
        console.log(chalk.cyan("📦 Testing module loading performance..."));
        const moduleResults = await benchmarks.benchmarkModuleLoading();
        
        const speedup = parseFloat(moduleResults.speedup);
        const status = speedup > 5 ? "✅ OPTIMAL" : speedup > 3 ? "⚠️  GOOD" : "❌ NEEDS WORK";
        
        console.log(`  Module loading speedup: ${moduleResults.speedup}x ${status}`);
        console.log(`  Cold load: ${moduleResults.coldLoad}ms → Warm load: ${moduleResults.warmLoad}ms`);
      }

      // Quick performance validation
      if (!args.full && !args.startup && !args.rdf && !args.cache && !args.quick) {
        console.log(chalk.yellow("Running quick performance validation..."));
        
        // Test CLI startup (single run)
        const startTime = performance.now();
        const { spawn } = await import('child_process');
        const cliProcess = spawn('node', ['bin/unjucks.cjs', '--version'], { 
          cwd: process.cwd(),
          stdio: 'pipe' 
        });
        
        await new Promise((resolve) => {
          cliProcess.on('close', resolve);
        });
        
        const startupTime = performance.now() - startTime;
        const startupStatus = startupTime < 150 ? "✅ OPTIMAL" : startupTime < 250 ? "⚠️  GOOD" : "❌ SLOW";
        
        console.log(`  CLI startup: ${startupTime.toFixed(2)}ms ${startupStatus}`);
        
        // Test cache stats
        const discoveryStats = templateDiscoveryCache.getStats();
        const generatorStats = generatorListCache.getStats();
        
        console.log(`  Template cache hit rate: ${discoveryStats.hitRate}`);
        console.log(`  Generator cache hit rate: ${generatorStats.hitRate}`);
        
        // Test RDF processing (small sample)
        console.log("  Testing RDF processing...");
        const testTurtle = `
          @prefix ex: <http://example.org/> .
          @prefix foaf: <http://xmlns.com/foaf/0.1/> .
          
          ex:person1 foaf:name "Alice" .
          ex:person1 foaf:age 30 .
          ex:person2 foaf:name "Bob" .
          ex:person2 foaf:age 25 .
        `;
        
        const rdfStart = performance.now();
        await optimizedRDF.clear();
        const tripleCount = await optimizedRDF.parseStreamingTurtle(testTurtle, 'perf-test');
        const rdfTime = performance.now() - rdfStart;
        const throughput = tripleCount / (rdfTime / 1000);
        
        const rdfStatus = throughput > 1000 ? "✅ OPTIMAL" : throughput > 500 ? "⚠️  GOOD" : "❌ SLOW";
        console.log(`  RDF processing: ${throughput.toFixed(0)} triples/sec ${rdfStatus}`);
      }

      console.log();
      console.log(chalk.green("✅ Performance testing completed"));
      
      return { success: true };
      
    } catch (error) {
      console.error(chalk.red("❌ Performance testing failed:"), error.message);
      return { success: false, error: error.message };
    }
  },
});

export default perfTestCommand;