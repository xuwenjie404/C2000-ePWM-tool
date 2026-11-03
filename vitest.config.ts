import { defineConfig } from 'vitest/config';

// 独立的测试配置：不加载 react / tailwind 等原生插件，
// 保证单元测试只依赖纯粹的 TS 计算逻辑，可在任何环境（含 CI、受限沙箱）执行。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    reporters: ['default'],
    // 线程池比 fork 池启动更快，且在禁止子进程的受限环境里也能跑
    pool: 'threads',
  },
});
