import { describe, expect, it } from 'vitest';
import { DEVICES } from '../data/devices';
import { absoluteMaxFswKhz, clampFreqKhz, freqRangeKhz, MIN_TBPRD_FOR_UI } from './limits';
import { computeTimeBase } from './timebase';

/**
 * 频率可行域必须和时基求解器自洽：
 * 区间内的任何频率都能解出 1 <= TBPRD <= 65535 且分辨率可接受。
 */
describe('freqRangeKhz', () => {
  it('120 MHz / 增减计数：上限约 3 MHz（TBPRD = 20），远高于旧的 500 kHz', () => {
    const r = freqRangeKhz(120, 'UP_DOWN');
    expect(r.maxKhz).toBeCloseTo(3000, 0);
    expect(r.maxKhz).toBeGreaterThan(500); // 回归：不再被写死成 500
    expect(r.wide).toBe(true);
  });

  it('上限对应 MIN_TBPRD_FOR_UI 个计数', () => {
    const r = freqRangeKhz(120, 'UP_DOWN');
    const tb = computeTimeBase(120, r.maxKhz, 'UP_DOWN');
    expect(tb.tbprd).toBe(MIN_TBPRD_FOR_UI);
  });

  it('单向计数上限是增减计数的两倍', () => {
    const up = freqRangeKhz(120, 'UP');
    const upDown = freqRangeKhz(120, 'UP_DOWN');
    expect(up.maxKhz).toBeCloseTo(upDown.maxKhz * 2, 0);
  });

  it('下限覆盖 50 Hz（图腾柱预设的工频慢管）', () => {
    for (const d of Object.values(DEVICES)) {
      const r = freqRangeKhz(d.tbclkMHz, 'UP_DOWN');
      expect(r.minKhz).toBeLessThan(0.05);
    }
  });

  it('区间内的抽样频率都能被时基求解器接受', () => {
    for (const mode of ['UP_DOWN', 'UP'] as const) {
      const r = freqRangeKhz(120, mode);
      for (const t of [0.02, 0.1, 0.3, 0.5, 0.7, 0.9, 0.99]) {
        const f = r.minKhz * Math.pow(r.maxKhz / r.minKhz, t);
        const tb = computeTimeBase(120, f, mode);
        expect(tb.tbprd).toBeGreaterThanOrEqual(1);
        expect(tb.tbprd).toBeLessThanOrEqual(65535);
        expect(tb.clamped).toBe('none');
      }
    }
  });

  it('绝对上限（TBPRD=1）高于 UI 上限，说明硬件还能更极端但无实用价值', () => {
    const abs = absoluteMaxFswKhz(120, 'UP_DOWN');
    const ui = freqRangeKhz(120, 'UP_DOWN').maxKhz;
    expect(abs).toBeGreaterThan(ui);
    expect(abs).toBeCloseTo(60000, 0);
  });

  it('不同器件给出不同上限', () => {
    expect(freqRangeKhz(150, 'UP_DOWN').maxKhz).toBeGreaterThan(freqRangeKhz(120, 'UP_DOWN').maxKhz);
    expect(freqRangeKhz(100, 'UP_DOWN').maxKhz).toBeLessThan(freqRangeKhz(120, 'UP_DOWN').maxKhz);
  });
});

describe('clampFreqKhz', () => {
  it('保留区间内的值', () => {
    expect(clampFreqKhz(100, 120, 'UP_DOWN')).toBe(100);
  });

  it('超出上限时夹到上限', () => {
    const max = freqRangeKhz(120, 'UP_DOWN').maxKhz;
    expect(clampFreqKhz(99999, 120, 'UP_DOWN')).toBe(max);
  });

  it('低于下限时夹到下限', () => {
    expect(clampFreqKhz(0.0001, 120, 'UP_DOWN')).toBe(0.01);
  });
});
