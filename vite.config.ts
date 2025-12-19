import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use empty string for relative paths, which handles subdirectories on GitHub Pages automatically
  base: '' 
})