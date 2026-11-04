import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The React app calls /api/...; Vite forwards those requests to the FastAPI server.
// Override the target with VITE_API_TARGET if the API runs elsewhere.
const apiTarget = process.env.VITE_API_TARGET || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Keep the charting library in its own chunk so the main bundle stays small.
        codeSplitting: { groups: [{ name: 'charts', test: /node_modules[\\/](recharts|d3-|victory)/ }] },
      },
    },
  },
})
