import { defineConfig } from 'vite'
// import vue from '@vitejs/plugin-vue' // Commented out - not needed for this CLI project
import { resolve } from 'path'

export default defineConfig({
  plugins: [], // Removed vue() since it's not needed for CLI project
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Unjucks',
      fileName: 'unjucks'
    },
    rollupOptions: {
      external: [], // Removed Vue/Nuxt externals since they're not used
      output: {
        globals: {
          // Removed vue global since it's not used
        }
      }
    },
    outDir: 'dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '~': resolve(__dirname, './')
    }
  }
})