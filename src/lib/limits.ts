import { HSPCLKDIV_OPTIONS, CLKDIV_OPTIONS, TBPRD_MAX } from '../data/clock';
import type { CountMode } from '../types';

/**
 * 频率可行域。
 *
 * 之前 UI 把上限写死成 500 kHz —— 那是**人为限制**，不是硬件极限。
 * 真正的约束只有三个：
 *   1. TBPRD ∈ [1, 65535]
 *   2. TBCLK = EPWMCLK / (CLKDIV × HSPCLKDIV)，最大分频 128×14 = 1792
 *   3. 占空比分辨率 1/TBPRD：TBPRD 太小则占空比只能大跳变
 *
 * 所以上限 = TBCLK / (2 × MIN_TBPRD)，下限 = TBCLK / (最大分频 × 2 × 65535)。
 */

/**
 * UI 允许的最小 TBPRD。
 *
 * 取 20 是个工程折中：再小的话占空比 LSB 就超过 5%（1/20），
 * 死区也没有剩余空间。需要更高频率时应该换器件或改用 HRPWM。
 */
export const MIN_TBPRD_FOR_UI = 20;

/** 最小的 UI 频率（10 Hz），低于此值工程意义不大 */
export const MIN_FSW_KHZ = 0.01;

const MAX_TOTAL_DIV = (() => {
  let max = 1;
  for (const c of CLKDIV_OPTIONS) {
    for (const h of HSPCLKDIV_OPTIONS) max = Math.max(max, c.val * h.val);
  }
  return max;
})();

export interface FreqRange {
  minKhz: number;
  maxKhz: number;
  /** 该范围是否需要对数刻度才拖得动 */
  wide: boolean;
}

/** 给定器件的 TBCLK 与计数模式，算出可用的开关频率区间（kHz） */
export function freqRangeKhz(tbclkMHz: number, countMode: CountMode): FreqRange {
  const tbclkHz = tbclkMHz * 1e6;
  const upDown = countMode === 'UP_DOWN';

  const minHz = upDown
    ? tbclkHz / (MAX_TOTAL_DIV * 2 * TBPRD_MAX)
    : tbclkHz / (MAX_TOTAL_DIV * (TBPRD_MAX + 1));
  const maxHz = upDown
    ? tbclkHz / (2 * MIN_TBPRD_FOR_UI)
    : tbclkHz / MIN_TBPRD_FOR_UI;

  const minKhz = Math.max(MIN_FSW_KHZ, minHz / 1e3);
  const maxKhz = Math.max(minKhz, maxHz / 1e3);
  return { minKhz, maxKhz, wide: maxKhz / minKhz > 200 };
}

/** 绝对上限（寄存器极限，TBPRD = 1），用于说明「硬件还能更高但不是好主意」 */
export function absoluteMaxFswKhz(tbclkMHz: number, countMode: CountMode): number {
  const tbclkHz = tbclkMHz * 1e6;
  return countMode === 'UP_DOWN' ? tbclkHz / 2 / 1e3 : tbclkHz / 1e3;
}

/** 把频率夹进可行域 */
export function clampFreqKhz(v: number, tbclkMHz: number, countMode: CountMode): number {
  const { minKhz, maxKhz } = freqRangeKhz(tbclkMHz, countMode);
  return Math.max(minKhz, Math.min(maxKhz, v));
}
