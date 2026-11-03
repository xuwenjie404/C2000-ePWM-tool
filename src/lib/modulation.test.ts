import { describe, expect, it } from 'vitest';
import { computeModulationInstant, maxLinearModIndex, modulationSamplingInfo } from './modulation';

describe('SPWM 三相', () => {
  it('三相参考电压互差 120°', () => {
    const inst = computeModulationInstant('SPWM', '3P', 1, 90);
    expect(inst.vu).toBeCloseTo(1, 6);
    expect(inst.vv).toBeCloseTo(-0.5, 6);
    expect(inst.vw).toBeCloseTo(-0.5, 6);
    expect(inst.vu + inst.vv + inst.vw).toBeCloseTo(0, 6);
  });

  it('SPWM 不注入零序分量', () => {
    expect(computeModulationInstant('SPWM', '3P', 0.9, 37).vOffset).toBe(0);
  });
});

describe('SVPWM', () => {
  it('注入的零序分量让三相极值对称', () => {
    const inst = computeModulationInstant('SVPWM', '3P', 0.8, 37);
    const raw = [-1, 0, 1].map(k => 0.8 * Math.sin(((37 + k * 0) * Math.PI) / 180));
    const peak = Math.max(...[inst.vu, inst.vv, inst.vw]);
    const valley = Math.min(...[inst.vu, inst.vv, inst.vw]);
    expect(peak + valley).toBeCloseTo(0, 6);
    expect(raw).toBeDefined();
  });

  it('线性调制上限为 2/√3', () => {
    expect(maxLinearModIndex('SVPWM')).toBeCloseTo(1.1547, 4);
    expect(maxLinearModIndex('SPWM')).toBe(1);
  });

  it('M=1.1 在 SVPWM 下不饱和，在 SPWM 下饱和', () => {
    expect(computeModulationInstant('SVPWM', '3P', 1.1, 0).saturated).toBe(false);
    expect(computeModulationInstant('SPWM', '3P', 1.1, 0).saturated).toBe(true);
  });
});

describe('占空比限幅', () => {
  it('任何角度下占空比都留在 1%~99%，保证有最小脉宽', () => {
    for (const mode of ['SPWM', 'SVPWM'] as const) {
      for (let deg = 0; deg < 360; deg += 5) {
        const inst = computeModulationInstant(mode, '3P', 1.15, deg);
        for (const d of [inst.du, inst.dv, inst.dw]) {
          expect(d).toBeGreaterThanOrEqual(1);
          expect(d).toBeLessThanOrEqual(99);
        }
      }
    }
  });
});

describe('单相', () => {
  it('V 相与 U 相互补', () => {
    const inst = computeModulationInstant('SPWM', '1P', 0.8, 30);
    expect(inst.vu).toBeCloseTo(-inst.vv, 9);
    expect(inst.du + inst.dv).toBeCloseTo(100, 0);
  });
});

describe('采样信息', () => {
  it('20 kHz / 50 Hz -> 每周期 400 点', () => {
    const info = modulationSamplingInfo(20, 50, 'UP_DOWN');
    expect(info.samplesPerCycle).toBe(400);
    expect(info.stepRad).toBeCloseTo((2 * Math.PI * 50) / 20000, 9);
  });
});
