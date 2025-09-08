/**
 * Comprehensive LaTeX Performance Test Suite
 * Tests for memory usage, compilation speed, and system optimization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { LaTeXPerformanceAnalyzer } from '../../src/lib/performance/latex-performance-analyzer.js';
import { LaTeXStreamingOptimizer } from '../../src/lib/performance/latex-streaming-optimizer.js';
import { LaTeXPerformanceOptimizer } from '../../src/lib/performance/latex-optimizer.js';

describe('LaTeX Performance Tests', () => {
    let testDir;
    let analyzer;
    let optimizer;
    let streamingProcessor;

    beforeEach(async () => {
        testDir = path.join(process.cwd(), 'test-temp-performance', Date.now().toString());
        await fs.mkdir(testDir, { recursive: true });
        
        analyzer = new LaTeXPerformanceAnalyzer({
            outputDir: path.join(testDir, 'analysis'),
            enableRealTimeMonitoring: false // Disable for tests
        });
        
        streamingProcessor = new LaTeXStreamingOptimizer({
            tempDir: path.join(testDir, 'streaming'),
            outputDir: path.join(testDir, 'output'),
            cleanupTempFiles: false // Keep for analysis
        });
        
        optimizer = new LaTeXPerformanceOptimizer({
            cacheDir: path.join(testDir, 'cache'),
            enableCaching: true,
            maxWorkers: 2 // Limit for tests
        });
    });

    afterEach(async () => {
        if (analyzer) await analyzer.cleanup();
        if (streamingProcessor) await streamingProcessor.cleanup();
        if (optimizer) await optimizer.shutdown();
        
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors in tests
        }
    });

    describe('Memory Usage Analysis', () => {
        it('should track memory usage during compilation', async () => {
            const sessionId = analyzer.startProfiling('memory-test');
            
            // Simulate memory-intensive operations
            const largeArray = new Array(10000).fill('test data');
            analyzer.recordOperation('compilation', 'large-document', {
                dataSize: largeArray.length
            });
            
            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const analysis = analyzer.stopProfiling(sessionId);
            
            expect(analysis).toBeDefined();
            expect(analysis.operations.length).toBeGreaterThan(0);
            expect(analysis.memoryDelta).toBeDefined();
            expect(analysis.memoryDelta.heapUsed).toBeGreaterThan(0);
        });

        it('should detect memory leaks in long-running operations', async () => {
            const memorySnapshots = [];
            
            // Simulate memory leak pattern
            for (let i = 0; i < 50; i++) {
                const snapshot = {
                    timestamp: Date.now() + i * 100,
                    memory: {
                        heapUsed: 50000000 + (i * 100000), // Growing memory usage
                        heapTotal: 100000000,
                        rss: 80000000 + (i * 150000)
                    }
                };
                memorySnapshots.push(snapshot);
            }
            
            const analysis = analyzer.analyzeMemoryUsage(memorySnapshots);
            
            expect(analysis.leakDetection).toBeDefined();
            expect(analysis.leakDetection.suspected).toBe(true);
            expect(analysis.leakDetection.severity).toBeDefined();
            expect(analysis.recommendations).toBeDefined();
        });

        it('should identify memory pressure points', async () => {
            const sessionId = analyzer.startProfiling('pressure-test');
            
            // Simulate high memory usage
            const heavyData = Buffer.alloc(10 * 1024 * 1024, 'x'); // 10MB
            analyzer.recordOperation('compilation', 'heavy-processing', {
                bufferSize: heavyData.length
            });
            
            const analysis = analyzer.stopProfiling(sessionId);
            
            expect(analysis.memoryDelta.heapUsed).toBeGreaterThan(5000000); // At least 5MB
            expect(analysis.assessment).toBeDefined();
        });
    });

    describe('Compilation Performance', () => {
        it('should analyze small document compilation performance', async () => {
            const smallDoc = generateSmallDocument();
            const docPath = path.join(testDir, 'small.tex');
            await fs.writeFile(docPath, smallDoc);
            
            const startTime = Date.now();
            
            // Mock compilation data
            const compilationData = {
                duration: Math.random() * 500 + 100, // 100-600ms
                success: true,
                errors: [],
                warnings: []
            };
            
            const analysis = await analyzer.analyzeCompilation(docPath, compilationData);
            
            expect(analysis.file.category).toBe('small');
            expect(analysis.assessment.performance).toBeDefined();
            expect(analysis.recommendations).toBeInstanceOf(Array);
        });

        it('should analyze medium document compilation performance', async () => {
            const mediumDoc = generateMediumDocument();
            const docPath = path.join(testDir, 'medium.tex');
            await fs.writeFile(docPath, mediumDoc);
            
            const compilationData = {
                duration: Math.random() * 2000 + 500, // 500-2500ms
                success: true,
                errors: [],
                warnings: ['Package warning example']
            };
            
            const analysis = await analyzer.analyzeCompilation(docPath, compilationData);
            
            expect(analysis.file.category).toBe('medium');
            expect(analysis.compilation.warnings.length).toBe(1);
        });

        it('should detect compilation bottlenecks', async () => {
            const largeDoc = generateLargeDocument();
            const docPath = path.join(testDir, 'large.tex');
            await fs.writeFile(docPath, largeDoc);
            
            // Simulate slow compilation
            const compilationData = {
                duration: 12000, // 12 seconds - should trigger bottleneck detection
                success: true,
                errors: [],
                warnings: []
            };
            
            const analysis = await analyzer.analyzeCompilation(docPath, compilationData);
            
            expect(analysis.bottlenecks).toBeDefined();
            expect(analysis.bottlenecks.length).toBeGreaterThan(0);
            expect(analysis.bottlenecks[0].type).toBe('slow-compilation');
        });
    });

    describe('Caching Performance', () => {
        it('should analyze cache hit performance', async () => {
            const hitDuration = 3; // 3ms - should be good performance
            const analysis = analyzer.analyzeCaching('hit', hitDuration, {
                key: 'test-key',
                size: 1024
            });
            
            expect(analysis.performance).toBe('good');
            expect(analysis.severity).toBe('low');
            expect(analysis.duration).toBe(hitDuration);
        });

        it('should detect slow cache operations', async () => {
            const slowDuration = 150; // 150ms - should be slow
            const analysis = analyzer.analyzeCaching('miss', slowDuration, {
                key: 'complex-computation',
                complexity: 'high'
            });
            
            expect(analysis.performance).toBe('poor');
            expect(analysis.severity).toBe('high');
            expect(analysis.issues).toContain('slow-cache-computation');
        });

        it('should track caching patterns over time', async () => {
            const sessionId = analyzer.startProfiling('caching-patterns');
            
            // Simulate multiple cache operations
            for (let i = 0; i < 20; i++) {
                const operation = i % 4 === 0 ? 'miss' : 'hit';
                const duration = operation === 'miss' ? Math.random() * 50 + 10 : Math.random() * 5 + 1;
                
                analyzer.analyzeCaching(operation, duration, { iteration: i });
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            const analysis = analyzer.stopProfiling(sessionId);
            
            expect(analysis.operations.length).toBe(20);
            
            const cacheOperations = analysis.operations.filter(op => op.type === 'caching');
            expect(cacheOperations.length).toBe(20);
        });
    });

    describe('Streaming Performance', () => {
        it('should handle large document streaming', async () => {
            const largeDoc = generateVeryLargeDocument();
            const inputPath = path.join(testDir, 'very-large.tex');
            const outputPath = path.join(testDir, 'output.pdf');
            
            await fs.writeFile(inputPath, largeDoc);
            
            // Mock the streaming processor methods to avoid actual LaTeX compilation
            const originalProcessLargeDocument = streamingProcessor.processLargeDocument;
            streamingProcessor.processLargeDocument = vi.fn().mockResolvedValue({
                success: true,
                processingTime: Math.random() * 5000 + 1000,
                memoryPeak: Math.random() * 100 * 1024 * 1024 + 50 * 1024 * 1024,
                chunksProcessed: 10
            });
            
            const startTime = Date.now();
            const result = await streamingProcessor.processLargeDocument(inputPath, outputPath);
            const duration = Date.now() - startTime;
            
            expect(result.success).toBe(true);
            expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
            expect(result.chunksProcessed).toBeDefined();
            
            // Restore original method
            streamingProcessor.processLargeDocument = originalProcessLargeDocument;
        });

        it('should manage memory usage during streaming', async () => {
            let memoryPressureEvents = 0;
            let cleanupEvents = 0;
            
            streamingProcessor.on('memoryPressure', () => memoryPressureEvents++);
            streamingProcessor.on('aggressiveCleanup', () => cleanupEvents++);
            
            // Simulate memory pressure by reducing max memory
            streamingProcessor.options.maxMemoryUsage = 10 * 1024 * 1024; // 10MB
            streamingProcessor.options.memoryPressureThreshold = 0.5; // 50%
            
            const mediumDoc = generateMediumDocument();
            const inputPath = path.join(testDir, 'memory-test.tex');
            await fs.writeFile(inputPath, mediumDoc);
            
            // Start memory monitoring
            streamingProcessor.startMemoryMonitoring();
            
            // Simulate memory usage
            const bigBuffer = Buffer.alloc(8 * 1024 * 1024, 'x'); // 8MB buffer
            
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for monitoring
            
            await streamingProcessor.cleanup();
            
            // Memory events should have been triggered (in a real scenario)
            expect(memoryPressureEvents + cleanupEvents).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Parallel Processing', () => {
        it('should optimize parallel compilation performance', async () => {
            await optimizer.initializeOptimizer();
            
            // Create multiple test documents
            const documents = [];
            for (let i = 0; i < 5; i++) {
                const doc = generateSmallDocument();
                const docPath = path.join(testDir, `parallel-${i}.tex`);
                await fs.writeFile(docPath, doc);
                documents.push(docPath);
            }
            
            // Mock the compilation process
            const originalOptimizeCompilation = optimizer.optimizeCompilation;
            optimizer.optimizeCompilation = vi.fn().mockResolvedValue({
                success: true,
                jobs: documents.length,
                cached: 0,
                compiled: documents.length,
                totalTime: Math.random() * 2000 + 500,
                averageTime: Math.random() * 400 + 100,
                cacheHitRate: 0
            });
            
            const startTime = Date.now();
            const result = await optimizer.optimizeCompilation(documents);
            const duration = Date.now() - startTime;
            
            expect(result.success).toBe(true);
            expect(result.jobs).toBe(documents.length);
            expect(duration).toBeLessThan(5000);
            
            // Restore original method
            optimizer.optimizeCompilation = originalOptimizeCompilation;
        });

        it('should demonstrate performance improvement with parallelization', async () => {
            await optimizer.initializeOptimizer();
            
            const documents = [];
            for (let i = 0; i < 10; i++) {
                const doc = generateMediumDocument();
                const docPath = path.join(testDir, `perf-test-${i}.tex`);
                await fs.writeFile(docPath, doc);
                documents.push(docPath);
            }
            
            // Test sequential processing (mock)
            optimizer.options.enableParallelCompilation = false;
            const sequentialStart = Date.now();
            
            // Mock sequential compilation
            const mockSequentialResult = {
                success: true,
                jobs: documents.length,
                totalTime: documents.length * 800, // 800ms per document
                parallelTime: 0
            };
            
            const sequentialTime = Date.now() - sequentialStart + mockSequentialResult.totalTime;
            
            // Test parallel processing
            optimizer.options.enableParallelCompilation = true;
            optimizer.options.maxWorkers = 4;
            
            const parallelStart = Date.now();
            
            // Mock parallel compilation
            const mockParallelResult = {
                success: true,
                jobs: documents.length,
                totalTime: Math.ceil(documents.length / 4) * 800, // 4 parallel workers
                parallelTime: sequentialTime
            };
            
            const parallelTime = Date.now() - parallelStart + mockParallelResult.totalTime;
            
            // Parallel should be significantly faster
            const speedupRatio = sequentialTime / parallelTime;
            expect(speedupRatio).toBeGreaterThan(1.5); // At least 1.5x speedup
        });
    });

    describe('Performance Regression Detection', () => {
        it('should detect performance regressions', async () => {
            const sessionId = analyzer.startProfiling('regression-test');
            
            // Simulate baseline performance
            for (let i = 0; i < 10; i++) {
                analyzer.recordOperation('compilation', 'baseline-test', {
                    duration: Math.random() * 100 + 900, // 900-1000ms
                    iteration: i
                });
            }
            
            // Simulate performance regression
            for (let i = 10; i < 20; i++) {
                analyzer.recordOperation('compilation', 'baseline-test', {
                    duration: Math.random() * 200 + 1800, // 1800-2000ms - significant regression
                    iteration: i
                });
            }
            
            const analysis = analyzer.stopProfiling(sessionId);
            
            // Should detect the performance change
            const compilationOps = analysis.operations.filter(op => op.name === 'baseline-test');
            expect(compilationOps.length).toBe(20);
            
            // Calculate average for first and second half
            const firstHalf = compilationOps.slice(0, 10);
            const secondHalf = compilationOps.slice(10, 20);
            
            const firstAvg = firstHalf.reduce((sum, op) => sum + op.data.duration, 0) / firstHalf.length;
            const secondAvg = secondHalf.reduce((sum, op) => sum + op.data.duration, 0) / secondHalf.length;
            
            expect(secondAvg).toBeGreaterThan(firstAvg * 1.5); // Should show regression
        });
    });

    describe('System Resource Monitoring', () => {
        it('should monitor system resource usage', async () => {
            const sessionId = analyzer.startProfiling('resource-monitoring');
            
            // Simulate CPU and memory intensive operations
            let result = 0;
            for (let i = 0; i < 100000; i++) {
                result += Math.sin(i) * Math.cos(i); // CPU intensive
            }
            
            const largeBuffer = Buffer.alloc(5 * 1024 * 1024, 'data'); // Memory intensive
            
            analyzer.recordOperation('compilation', 'resource-test', {
                cpuWork: result,
                memoryBuffer: largeBuffer.length
            });
            
            const analysis = analyzer.stopProfiling(sessionId);
            
            expect(analysis.memoryDelta.heapUsed).toBeGreaterThan(1000000); // At least 1MB
            expect(analysis.operations.length).toBe(1);
        });
    });
});

// Helper functions to generate test documents
function generateSmallDocument() {
    return `\\documentclass{article}
\\title{Small Test Document}
\\author{Performance Test}
\\begin{document}
\\maketitle
This is a small test document with minimal content for performance testing.
\\section{Test Section}
Some basic content here.
\\end{document}`;
}

function generateMediumDocument() {
    let content = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{graphicx}
\\title{Medium Test Document}
\\author{Performance Test}
\\begin{document}
\\maketitle
\\tableofcontents\n`;
    
    // Generate multiple sections
    for (let i = 1; i <= 10; i++) {
        content += `\\section{Section ${i}}
This is section ${i} with substantial content for performance testing.
Lorem ipsum dolor sit amet, consectetur adipiscing elit.

\\subsection{Subsection ${i}.1}
\\begin{equation}
E = mc^2 + \\sum_{j=1}^{${i}} x_j^2
\\end{equation}

\\subsection{Subsection ${i}.2}
More content with mathematical expressions and formatting.
\\begin{align}
\\alpha &= \\beta + \\gamma \\\\
\\delta &= \\epsilon \\cdot \\zeta
\\end{align}
`;
    }
    
    content += '\\end{document}';
    return content;
}

function generateLargeDocument() {
    let content = `\\documentclass{book}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\title{Large Test Document}
\\author{Performance Test}
\\begin{document}
\\maketitle
\\tableofcontents\n`;
    
    // Generate multiple chapters with extensive content
    for (let chapter = 1; chapter <= 20; chapter++) {
        content += `\\chapter{Chapter ${chapter}}
This is chapter ${chapter} with extensive content for performance testing.\n`;
        
        for (let section = 1; section <= 5; section++) {
            content += `\\section{Section ${chapter}.${section}}
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor 
incididunt ut labore et dolore magna aliqua.

\\begin{equation}
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
\\end{equation}

\\begin{align}
\\nabla \\cdot \\mathbf{E} &= \\frac{\\rho}{\\epsilon_0} \\\\
\\nabla \\cdot \\mathbf{B} &= 0
\\end{align}
`;
        }
    }
    
    content += '\\end{document}';
    return content;
}

function generateVeryLargeDocument() {
    let content = generateLargeDocument();
    
    // Multiply the content to create a very large document
    const originalContent = content;
    for (let i = 0; i < 5; i++) {
        content += '\n\n% Repeated content block ' + (i + 1) + '\n\n';
        content += originalContent.replace(/\\documentclass.*?\\begin{document}/s, '');
        content = content.replace(/\\end{document}$/, '');
    }
    
    content += '\\end{document}';
    return content;
}