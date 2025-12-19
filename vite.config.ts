import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 设置为相对路径 './' 可以适配 GitHub Pages 无论是在根目录还是在子目录
  base: './' 
})