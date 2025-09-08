/**
 * LaTeX Build Configuration
 */
export default {
  latex: {
    // LaTeX engine to use
    engine: 'pdflatex', // pdflatex, xelatex, lualatex
    
    // Output directory for compiled PDFs
    outputDir: './dist/latex',
    
    // Temporary directory for compilation
    tempDir: './temp/latex',
    
    // Enable bibliography processing
    enableBibtex: true,
    enableBiber: true,
    
    // Compilation settings
    maxRetries: 3,
    timeout: 60000, // 60 seconds
    verbose: false,
    
    // Concurrent compilation limit
    concurrency: 2,
    
    // Watch mode settings
    watch: {
      enabled: false,
      patterns: ['**/*.tex', '**/*.bib'],
      ignored: ['**/node_modules/**', '**/dist/**', '**/temp/**']
    },
    
    // Docker settings (optional)
    docker: {
      enabled: false,
      image: 'texlive/texlive:latest',
      volumes: {},
      environment: {}
    },
    
    // Build integration
    buildIntegration: {
      // Include LaTeX in main build process
      includeInBuild: true,
      
      // Fail build if LaTeX compilation fails
      failOnError: false,
      
      // Skip LaTeX build if no .tex files found
      skipIfNoFiles: true
    }
  }
};
