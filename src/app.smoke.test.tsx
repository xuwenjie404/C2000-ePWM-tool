import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from './App';

/**
 * 冒烟测试：整棵组件树必须能完成一次渲染。
 * 这里主要防「改坏了某个 panel 的 props / 解构」导致的运行时崩溃，
 * 单元测试覆盖不到 JSX 层。
 */
describe('App 冒烟渲染', () => {
  it('默认工程可以完整渲染并输出关键区块', () => {
    const html = renderToString(<App />);

    // 顶栏
    expect(html).toContain('C2000 ePWM Tool');
    // 主要面板
    expect(html).toContain('拓扑 · 器件 · 调制');
    expect(html).toContain('波形示波器');
    expect(html).toContain('引脚复用分配');
    expect(html).toContain('逐通道精细参数');
    expect(html).toContain('保护与采样触发');
    expect(html).toContain('设计校验');
    expect(html).toContain('C 代码生成');
    // 真实计算结果的痕迹
    expect(html).toContain('TBPRD');
    expect(html).toContain('TBCLKSYNC');
    expect(html).toContain('EPWM_initCh1');
    expect(html.length).toBeGreaterThan(20000);
  });

  it('渲染结果里不含 NaN / undefined 这类数值错误痕迹', () => {
    const html = renderToString(<App />);
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
    expect(html).not.toContain('undefined');
  });

  it('英文模式渲染出英文界面（i18n 链路打通）', () => {
    const html = renderToString(<App defaultLang="en" />);

    expect(html).toContain('Topology');
    expect(html).toContain('Switching frequency');
    expect(html).toContain('Count mode');
    expect(html).toContain('Checks passed');
    // 中文界面不该出现英文标题
    const zh = renderToString(<App defaultLang="zh" />);
    expect(zh).toContain('开关频率');
    expect(zh).not.toContain('Switching frequency');
  });
});
