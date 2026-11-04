import { describe, expect, it } from 'vitest';
import { computePhase, computeTimeBase, dutyToCompare } from './timebase';
import { cmpaForDuty, fswFromTbprd, fswRange, tbphsForPhase, tbprdForFsw } from './runtimeApi';

/**
 * 运行时参数层与「设计期求解器」必须给出同样的结果 ——
 * 否则用户在工具里看到的 CMPA，和运行时按 API 算出来的会不一致。
 */
describe('与设计期求解结果一致', () => {
  const tbclk = 120;
  const tb = computeTimeBase(tbclk, 20, 'UP_DOWN'); // TBPRD = 3000

  it('tbprdForFsw 与 computeTimeBase 一致（同一分频下）', () => {
    for (const f of [5, 10, 20, 50, 100, 200, 500]) {
      const design = computeTimeBase(tbclk, f, 'UP_DOWN');
      if (design.totalDiv !== 1) continue; // 只要不换分频的比较
      expect(tbprdForFsw(tbclk, f, 'UP_DOWN', 1)).toBe(design.tbprd);
    }
  });

  it('cmpaForDuty 与 dutyToCompare 一致（避开 0% / 100% 的夹紧区）', () => {
    for (const d of [5, 25, 50, 62.5, 75, 95]) {
      expect(cmpaForDuty(d, tb.tbprd, 'UP_DOWN')).toBe(dutyToCompare(d, tb, 'UP_DOWN'));
    }
  });

  it('tbphsForPhase 与 computePhase 一致', () => {
    for (const deg of [0, 30, 90, 120, 180, 181, 240, 300, 359]) {
      const design = computePhase(deg, tb, 'UP_DOWN');
      const runtime = tbphsForPhase(deg, tb.tbprd, 'UP_DOWN');
      expect(runtime.tbphs).toBe(design.tbphs);
      expect(runtime.phsDir).toBe(design.phsDir);
    }
  });

  it('单向计数下也与设计期一致', () => {
    const up = computeTimeBase(tbclk, 100, 'UP');
    expect(tbprdForFsw(tbclk, 100, 'UP', 1)).toBe(up.tbprd);
    const design = computePhase(90, up, 'UP');
    const runtime = tbphsForPhase(90, up.tbprd, 'UP');
    expect(runtime.tbphs).toBe(design.tbphs);
  });
});

describe('运行时的边界处理', () => {
  it('占空比被夹在 [1, TBPRD-1]，避免输出恒定', () => {
    expect(cmpaForDuty(0, 3000, 'UP_DOWN')).toBe(1);
    expect(cmpaForDuty(100, 3000, 'UP_DOWN')).toBe(2999);
    expect(cmpaForDuty(-50, 3000, 'UP_DOWN')).toBe(1);
    expect(cmpaForDuty(150, 3000, 'UP_DOWN')).toBe(2999);
  });

  it('频率越界时 TBPRD 被夹在 16 bit 范围内', () => {
    expect(tbprdForFsw(120, 1e6, 'UP_DOWN', 1)).toBe(1);
    expect(tbprdForFsw(120, 0.0001, 'UP_DOWN', 1)).toBe(65535);
  });

  it('相位角自动归一化到 [0, 360)', () => {
    expect(tbphsForPhase(360, 3000, 'UP_DOWN')).toEqual(tbphsForPhase(0, 3000, 'UP_DOWN'));
    expect(tbphsForPhase(-90, 3000, 'UP_DOWN')).toEqual(tbphsForPhase(270, 3000, 'UP_DOWN'));
  });

  it('fswFromTbprd 与 tbprdForFsw 互为逆运算（整数范围内）', () => {
    const tbprd = tbprdForFsw(120, 20, 'UP_DOWN', 1);
    expect(fswFromTbprd(120, tbprd, 'UP_DOWN', 1)).toBeCloseTo(20, 4);
  });

  it('fswRange 覆盖当前选定分频下的可用范围', () => {
    const r = fswRange(120, 1, 'UP_DOWN');
    // 上限是寄存器极限：TBPRD=1 时 f_sw = TBCLK/2 = 60 MHz（实际不可用，仅作边界）
    expect(r.maxKhz).toBeCloseTo(60000, 0);
    // 下限是 TBPRD=65535
    expect(r.minKhz).toBeCloseTo(120e6 / (2 * 65535) / 1e3, 4);
    const withinRange = tbprdForFsw(120, 20, 'UP_DOWN', 1);
    expect(withinRange).toBe(3000);
  });
});

describe('改频率时保持其他参数语义', () => {
  it('改频率后按同一占空比重算 CMPA，占空比语义不变', () => {
    const duty = 37.5;
    for (const f of [10, 20, 50, 100]) {
      const tbprd = tbprdForFsw(120, f, 'UP_DOWN', 1);
      const cmpa = cmpaForDuty(duty, tbprd, 'UP_DOWN');
      expect((cmpa / tbprd) * 100).toBeCloseTo(duty, 1);
    }
  });

  it('改频率后按同一相角重算 TBPHS，等效延迟比例不变', () => {
    const phase = 120;
    for (const f of [10, 20, 50]) {
      const tbprd = tbprdForFsw(120, f, 'UP_DOWN', 1);
      const { tbphs, phsDir } = tbphsForPhase(phase, tbprd, 'UP_DOWN');
      const delayTicks = phsDir === 'DOWN' ? tbphs : 2 * tbprd - tbphs;
      expect((delayTicks / (2 * tbprd)) * 360).toBeCloseTo(phase, 0);
    }
  });
});
