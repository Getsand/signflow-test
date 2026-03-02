import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist'], // Exclude to prevent pre-bundling issues with worker
  },
  build: {
    // Production optimizations
    minify: 'esbuild',
    sourcemap: false, // Disable source maps in production for smaller bundle
    rollupOptions: {
      output: {
        // Code splitting for better caching
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'pdf-vendor': ['react-pdf', 'pdfjs-dist'],
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Target modern browsers for smaller bundle
    target: 'es2015',
  },
  // Remove console.log in production (but keep console.error)
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}))


