import { defineBuildConfig } from "obuild/config";

export default defineBuildConfig({
  entries: ["./src/index.ts", "./src/cli.ts", "./src/mcp-server.ts"],
  
  // Performance optimizations
  rollup: {
    esbuild: {
      minify: true,
      target: 'node18',
      // Enable tree shaking for better bundle sizes
      treeShaking: true
    }
  },
  
  // Optimize CLI startup by excluding heavy deps from main bundle
  externals: [
    // Keep these as external to reduce bundle size
    'inquirer',
    'yaml', 
    'nunjucks'
  ],
  
  // Output optimizations
  outDir: "dist",
  clean: true,
  
  // Enable source maps for debugging in production
  sourcemap: false, // Disable to reduce bundle size
  
  // Bundle analyzer for optimization insights
  alias: {
    // Optimize common imports
    '@': './src'
  }
});
