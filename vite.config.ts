import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base: './' 让构建产物可在任意子路径下运行：
// 既能部署到 GitHub Pages 的 /<repo>/ 子目录，也能直接用 file:// 打开 dist/index.html。
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
