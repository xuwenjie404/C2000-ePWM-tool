import { describe, expect, it } from 'vitest';
import { createDefaultProject, sanitizeProject } from './project';
import { resolveHardware, resolvePins } from './hardware';
import { validateProject } from './validation';

const project = createDefaultProject();

describe('默认工程', () => {
  it('三相 20 kHz / 120 MHz TBCLK 解析出正确时基', () => {
    const hw = resolveHardware(project);
    expect(hw.device.id).toBe('F280039C');
    expect(hw.master.tb.tbprd).toBe(3000);
    expect(hw.master.tb.actualFswKhz).toBeCloseTo(20, 6);
    expect(hw.channels).toHaveLength(3);
  });

  it('默认配置没有 error 级诊断', () => {
    const hw = resolveHardware(project);
    const issues = validateProject(project, hw);
    expect(issues.filter(i => i.severity === 'error')).toEqual([]);
  });

  it('引脚无冲突', () => {
    const hw = resolveHardware(project);
    expect(resolvePins(hw).conflicts).toEqual([]);
  });
});

describe('诊断规则', () => {
  it('死区过大导致脉宽被吞掉时报 error', () => {
    const p = sanitizeProject({
      ...project,
      freqKhz: 400,
      channels: [
        { id: 1, duty: 3, redNs: 900, fedNs: 100, mode: 'AHC' },
        { id: 2, duty: 50 },
        { id: 3, duty: 50 },
      ],
    });
    const hw = resolveHardware(p);
    const issues = validateProject(p, hw);
    const swallow = issues.find(i => i.id.startsWith('db-swallow-a'));
    expect(swallow).toBeDefined();
    expect(swallow?.severity).toBe('error');
  });

  it('F28335 的 10-bit 死区寄存器溢出时报 warn', () => {
    const p = sanitizeProject({ ...project, deviceId: 'F28335', freqKhz: 20 });
    // 150 MHz TBCLK 下 20 µs 需要 3000 个计数，超过 10-bit 上限 1023
    p.channels[0].redNs = 20000;
    const hw = resolveHardware(p);
    const issues = validateProject(p, hw);
    const issue = issues.find(i => i.id === 'dbred-overflow-1');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('warn');
  });

  it('调制比超出 SVPWM 线性区时报 warn', () => {
    const p = sanitizeProject({ ...project, modulationMode: 'SVPWM', modIndex: 1.3 });
    const hw = resolveHardware(p);
    const issues = validateProject(p, hw);
    expect(issues.some(i => i.id === 'overmodulation')).toBe(true);
  });

  it('两个通道占用同一引脚时报 error', () => {
    const p = sanitizeProject({
      ...project,
      channels: [{ id: 1 }, { id: 2 }],
    });
    const hw = resolveHardware(p);
    // 把 ePWM2A 的复用表改成与 ePWM1A 相同的 GPIO0（模拟选错引脚）
    hw.device = {
      ...hw.device,
      muxOptions: {
        ...hw.device.muxOptions,
        ePWM2A: [{ pin: 16, gpio: 'GPIO0', mux: 1, reg: 'GPAMUX1' }],
      },
    };
    const issues = validateProject(p, hw);
    expect(issues.some(i => i.id === 'pin-conflict-16')).toBe(true);
  });

  it('引用不存在的器件时回退到默认器件', () => {
    const p = sanitizeProject({ ...project, deviceId: 'NOT_A_CHIP' });
    expect(p.deviceId).toBe('F280039C');
  });
});

describe('工程规范化', () => {
  it('非法通道数据被钳位而不是崩溃', () => {
    const p = sanitizeProject({
      ...project,
      channels: [{ id: 9, duty: 999, redNs: -50, mode: 'NOPE', phase: 9999 }],
    });
    const ch = p.channels[0];
    expect(ch.duty).toBeLessThanOrEqual(99.5);
    expect(ch.redNs).toBe(0);
    expect(ch.mode).toBe('AHC');
    expect(ch.phase).toBe(0);
  });

  it('通道数量被限制在 4 个以内', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: i + 1 }));
    const p = sanitizeProject({ ...project, channels: many });
    expect(p.channels).toHaveLength(4);
    expect(p.channels.map(c => c.id)).toEqual([1, 2, 3, 4]);
  });

  it('主通道的移相角与独立变频被强制清零', () => {
    const p = sanitizeProject({
      ...project,
      channels: [{ id: 1, phase: 120, independentFreq: true, customFreqKhz: 50 }],
    });
    expect(p.channels[0].phase).toBe(0);
    expect(p.channels[0].independentFreq).toBe(false);
  });
});
