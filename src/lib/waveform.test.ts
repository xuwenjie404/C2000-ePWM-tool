import { describe, expect, it } from 'vitest';
import { DB_IN_MODES, DEADBAND_MODES } from '../data/deadband';
import { complementIntervals, simulateWaveform, toIntervals } from './waveform';

const base = {
  countMode: 'UP_DOWN' as const,
  tbprd: 600,
  cmpA: 300,
  cmpB: 300,
  dbRed: 18,
  dbFed: 18,
  stepNs: 1000 / 120,
  inMode: DB_IN_MODES.DBA_ALL,
};

describe('区间工具', () => {
  it('跨周期边界的高电平被拆成两段', () => {
    expect(toIntervals(900, 600, 1200)).toEqual([
      { start: 900, end: 1200 },
      { start: 0, end: 300 },
    ]);
  });

  it('占满整周期时返回整段', () => {
    expect(toIntervals(0, 1200, 1200)).toEqual([{ start: 0, end: 1200 }]);
  });

  it('补集与自身互不重叠且和为整周期', () => {
    const high = toIntervals(900, 600, 1200);
    const low = complementIntervals(high, 1200);
    const sum = [...high, ...low].reduce((a, s) => a + (s.end - s.start), 0);
    expect(sum).toBe(1200);
    expect(low).toEqual([{ start: 300, end: 900 }]);
  });
});

describe('AHC 互补死区波形', () => {
  const wave = simulateWaveform({ ...base, mode: DEADBAND_MODES.AHC });

  it('A 相高电平 = 原始高电平 - RED', () => {
    expect(wave.actualDutyAPct).toBeCloseTo(((600 - 18) / 1200) * 100, 6);
  });

  it('B 相高电平 = 原始低电平 - FED', () => {
    expect(wave.actualDutyBPct).toBeCloseTo(((600 - 18) / 1200) * 100, 6);
  });

  it('A/B 严格互斥（死区期间两路皆低）', () => {
    for (const a of wave.highA) {
      for (const b of wave.highB) {
        const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
        expect(overlap).toBeLessThanOrEqual(0);
      }
    }
  });

  it('死区总宽度恰好等于 (RED + FED) 个计数', () => {
    const totalHigh = wave.periodTicks - (wave.actualDutyAPct + wave.actualDutyBPct) * 0.01 * wave.periodTicks;
    expect(totalHigh).toBeCloseTo(36, 6);
  });

  it('死区时间按 stepNs 换算正确', () => {
    expect(wave.deadTimeRiseNs).toBeCloseTo(18 * (1000 / 120), 6);
  });
});

describe('ALC 低有效互补', () => {
  const wave = simulateWaveform({ ...base, mode: DEADBAND_MODES.ALC });

  it('互补对整体反相后，死区期间两路皆高', () => {
    expect(wave.actualDutyAPct).toBeCloseTo(100 - ((600 - 18) / 1200) * 100, 6);
    expect(wave.actualDutyBPct).toBeCloseTo(100 - ((600 - 18) / 1200) * 100, 6);
  });
});

describe('AH/AL 同相型', () => {
  it('两路波形完全一致', () => {
    const wave = simulateWaveform({ ...base, mode: DEADBAND_MODES.AH });
    expect(wave.highA).toEqual(wave.highB);
  });

  it('同相型宽度 = 原始宽 - RED + FED', () => {
    const wave = simulateWaveform({ ...base, mode: DEADBAND_MODES.AH, dbRed: 30, dbFed: 10 });
    expect(wave.actualDutyAPct).toBeCloseTo(((600 - 30 + 10) / 1200) * 100, 6);
  });

  it('AL 是 AH 的补集', () => {
    const ah = simulateWaveform({ ...base, mode: DEADBAND_MODES.AH });
    const al = simulateWaveform({ ...base, mode: DEADBAND_MODES.AL });
    expect(ah.actualDutyAPct + al.actualDutyAPct).toBeCloseTo(100, 6);
  });
});

describe('死区吞脉冲检测', () => {
  it('RED 大于高电平宽度时 A 相被吞掉', () => {
    const wave = simulateWaveform({
      ...base,
      cmpA: 20, // 40 ticks 高电平
      dbRed: 50,
      dbFed: 10,
      mode: DEADBAND_MODES.AHC,
    });
    expect(wave.swallowedA).toBe(true);
    expect(wave.highA).toHaveLength(0);
  });

  it('FED 大于低电平宽度时 B 相被吞掉', () => {
    const wave = simulateWaveform({
      ...base,
      cmpA: 580, // 低电平仅 40 ticks
      dbRed: 10,
      dbFed: 50,
      mode: DEADBAND_MODES.AHC,
    });
    expect(wave.swallowedB).toBe(true);
  });
});

describe('BYPASS 模式', () => {
  it('A/B 分别由 CMPA / CMPB 独立决定，且不引入死区', () => {
    const wave = simulateWaveform({
      ...base,
      cmpA: 300,
      cmpB: 150,
      mode: DEADBAND_MODES.BYPASS,
    });
    expect(wave.deadTimeRiseNs).toBe(0);
    expect(wave.actualDutyAPct).toBeCloseTo(50, 6);
    expect(wave.actualDutyBPct).toBeCloseTo(25, 6);
  });
});

describe('单向计数', () => {
  it('周期为 TBPRD+1，占空比 = CMPA/(TBPRD+1)', () => {
    const wave = simulateWaveform({
      ...base,
      countMode: 'UP',
      tbprd: 1199,
      cmpA: 600,
      dbRed: 0,
      dbFed: 0,
      mode: DEADBAND_MODES.AHC,
    });
    expect(wave.periodTicks).toBe(1200);
    expect(wave.actualDutyAPct).toBeCloseTo(50, 6);
  });
});

describe('DBB_ALL 输入源', () => {
  it('改用 B 输入时以 CMPB 为死区输入基准', () => {
    const wave = simulateWaveform({
      ...base,
      cmpA: 300,
      cmpB: 150,
      inMode: DB_IN_MODES.DBB_ALL,
      mode: DEADBAND_MODES.AHC,
    });
    expect(wave.actualDutyAPct).toBeCloseTo(((300 - 18) / 1200) * 100, 6);
  });
});
