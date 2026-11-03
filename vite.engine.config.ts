import { defineConfig } from 'vite';

/**
 * 内核构建配置：把 src/engine/index.ts 打包成不依赖 React 的 ESM 库，
 * 供 CLI（bin/epwm.mjs）与第三方工具消费。
 */
export default defineConfig({
  build: {
    outDir: 'dist-engine',
    emptyOutDir: true,
    target: 'es2022',
    minify: false,
    lib: {
      entry: 'src/engine/index.ts',
      formats: ['es'],
      fileName: () => 'engine.js',
    },
    rollupOptions: {
      // 内核不依赖任何运行时第三方库，这里保持为空即可
      external: [],
    },
  },
});
