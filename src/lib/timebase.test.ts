import { describe, expect, it } from 'vitest';
import { computePhase, computeTimeBase, dutyToCompare, nsToTicks } from './timebase';

describe('computeTimeBase', () => {
  it('120 MHz TBCLK / 100 kHz / 增减计数 -> TBPRD=600', () => {
    const tb = computeTimeBase(120, 100, 'UP_DOWN');
    expect(tb.clkDiv).toBe(1);
    expect(tb.hspClkDiv).toBe(1);
    expect(tb.tbprd).toBe(600);
    expect(tb.periodTicks).toBe(1200);
    expect(tb.actualFswKhz).toBeCloseTo(100, 9);
    expect(tb.stepNs).toBeCloseTo(1000 / 120, 9);
    expect(tb.clamped).toBe('none');
  });

  it('单向计数下 f_sw = TBCLK/(TBPRD+1)', () => {
    const tb = computeTimeBase(120, 100, 'UP');
    expect(tb.tbprd).toBe(1199);
    expect(tb.periodTicks).toBe(1200);
    expect(tb.actualFswKhz).toBeCloseTo(100, 9);
  });

  it('频率过低时自动增大分频，让 TBPRD 落回 16 bit 范围', () => {
    const tb = computeTimeBase(120, 0.1, 'UP_DOWN');
    expect(tb.totalDiv).toBe(10);
    expect(tb.tbprd).toBe(60000);
    expect(tb.actualFswKhz).toBeCloseTo(0.1, 9);
    expect(tb.clamped).toBe('none');
  });

  it('极低频率自动加档，直到 TBPRD 落回 16 bit', () => {
    const tb = computeTimeBase(120, 0.02, 'UP_DOWN'); // 20 Hz
    expect(tb.totalDiv).toBe(48);
    expect(tb.tbprd).toBe(62500);
    expect(tb.clamped).toBe('none');
    expect(tb.actualFswKhz).toBeCloseTo(0.02, 9);
  });

  it('TBCLK 极高时钳位 TBPRD 并给出告警', () => {
    // 合成场景：TBCLK 远超实际器件，用于覆盖钳位分支
    const tb = computeTimeBase(100000, 0.02, 'UP_DOWN');
    expect(tb.clamped).toBe('max');
    expect(tb.tbprd).toBe(65535);
    expect(tb.warnings.length).toBeGreaterThan(0);
  });

  it('占空比分辨率随 TBPRD 增大而变细', () => {
    const slow = computeTimeBase(120, 10, 'UP_DOWN');
    const fast = computeTimeBase(120, 400, 'UP_DOWN');
    expect(slow.dutyLsbPct).toBeLessThan(fast.dutyLsbPct);
  });
});

describe('dutyToCompare', () => {
  const tb = computeTimeBase(120, 100, 'UP_DOWN');

  it('增减计数：duty = CMPA / TBPRD', () => {
    expect(dutyToCompare(50, tb, 'UP_DOWN')).toBe(300);
    expect(dutyToCompare(0, tb, 'UP_DOWN')).toBe(0);
    expect(dutyToCompare(100, tb, 'UP_DOWN')).toBe(600);
  });

  it('单向计数：duty = CMPA / (TBPRD+1)', () => {
    const tbUp = computeTimeBase(120, 100, 'UP');
    expect(dutyToCompare(50, tbUp, 'UP')).toBe(600);
    expect(dutyToCompare(100, tbUp, 'UP')).toBe(1199);
  });

  it('越界占空比被安全钳位，不会写出 >TBPRD 的比较值', () => {
    expect(dutyToCompare(-20, tb, 'UP_DOWN')).toBe(0);
    expect(dutyToCompare(150, tb, 'UP_DOWN')).toBe(600);
  });
});

describe('computePhase', () => {
  const tb = computeTimeBase(120, 100, 'UP_DOWN');

  it('0~180° 使用 PHSDIR=DOWN，TBPHS 直接等于延迟计数', () => {
    const p = computePhase(120, tb, 'UP_DOWN');
    expect(p.phsDir).toBe('DOWN');
    expect(p.tbphs).toBe(400);
    expect(p.actualPhaseDeg).toBeCloseTo(120, 6);
  });

  it('180~360° 自动切到 PHSDIR=UP 并换算 TBPHS', () => {
    const p = computePhase(240, tb, 'UP_DOWN');
    expect(p.phsDir).toBe('UP');
    expect(p.tbphs).toBe(400);
    expect(p.actualPhaseDeg).toBeCloseTo(240, 6);
  });

  it('360° 等价于 0°', () => {
    const p0 = computePhase(0, tb, 'UP_DOWN');
    const p360 = computePhase(360, tb, 'UP_DOWN');
    expect(p360.tbphs).toBe(p0.tbphs);
  });

  it('单向计数被标记为能力受限', () => {
    const tbUp = computeTimeBase(120, 100, 'UP');
    const p = computePhase(90, tbUp, 'UP');
    expect(p.limited).toBe(true);
    expect(p.phsDir).toBe('UP');
    expect(p.actualPhaseDeg).toBeCloseTo(90, 3);
  });
});

describe('nsToTicks', () => {
  it('按位宽钳位死区计数', () => {
    expect(nsToTicks(200, 1000 / 120, 16383)).toBe(24);
    expect(nsToTicks(1e6, 1000 / 120, 1023)).toBe(1023);
    expect(nsToTicks(-5, 1000 / 120, 1023)).toBe(0);
  });
});
