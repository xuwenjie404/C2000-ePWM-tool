import type { CountMode } from '../types';

/**
 * 运行时参数层的换算逻辑（与代码生成器生成的 C 版本一一对应）。
 *
 * 为什么单独抽出来：把「频率 / 占空比 / 相位」暴露成 API 之后，
 * 真正难的不是写寄存器，而是**参数之间的耦合**——
 *   · 改 TBPRD 会让原来的 CMPA 对应到新的占空比；
 *   · 改 TBPRD 也让 TBPHS 的物理角度改变。
 * 所以每次改频率都要用「保持在语义上的占空比与相角」重算派生值。
 * 这里用纯函数实现一遍，C 端照抄，单测再把两者钉在一起。
 */

export interface PhaseResult {
  tbphs: number;
  phsDir: 'UP' | 'DOWN';
}

/** 频率 -> TBPRD。clkTotalDiv 是生成时固定下来的 CLKDIV×HSPCLKDIV */
export function tbprdForFsw(
  tbclkMHz: number,
  fswKhz: number,
  countMode: CountMode,
  totalDiv: number,
): number {
  const tbclkHz = (tbclkMHz * 1e6) / Math.max(1, totalDiv);
  const f = Math.max(1e-3, fswKhz) * 1e3;
  const raw = countMode === 'UP_DOWN' ? tbclkHz / (2 * f) : tbclkHz / f - 1;
  return Math.round(Math.max(1, Math.min(65535, raw)));
}

/** 从 TBPRD 反算实际频率（kHz） */
export function fswFromTbprd(
  tbclkMHz: number,
  tbprd: number,
  countMode: CountMode,
  totalDiv: number,
): number {
  const tbclkHz = (tbclkMHz * 1e6) / Math.max(1, totalDiv);
  const period = countMode === 'UP_DOWN' ? 2 * Math.max(1, tbprd) : Math.max(1, tbprd) + 1;
  return tbclkHz / period / 1e3;
}

/**
 * 占空比 -> CMPA。
 * 会把结果夹在 [1, TBPRD-1]：0 或满幅会让输出恒定，死区后更没有脉宽可言。
 */
export function cmpaForDuty(dutyPct: number, tbprd: number, countMode: CountMode): number {
  const span = countMode === 'UP_DOWN' ? tbprd : tbprd + 1;
  const raw = (Math.max(0, Math.min(100, dutyPct)) / 100) * span;
  const lo = 1;
  const hi = Math.max(lo, tbprd - 1);
  return Math.round(Math.max(lo, Math.min(hi, raw)));
}

/** 相位角 -> TBPHS / PHSDIR（与 computePhase 同规则，供运行时复用） */
export function tbphsForPhase(phaseDeg: number, tbprd: number, countMode: CountMode): PhaseResult {
  const norm = ((phaseDeg % 360) + 360) % 360;
  const periodTicks = countMode === 'UP_DOWN' ? 2 * tbprd : tbprd + 1;
  const delayTicks = (norm / 360) * periodTicks;

  if (countMode === 'UP_DOWN') {
    if (norm <= 180) {
      const tbphs = Math.max(0, Math.min(tbprd, Math.round(delayTicks)));
      return { tbphs, phsDir: 'DOWN' };
    }
    const tbphs = Math.max(0, Math.min(tbprd, Math.round(2 * tbprd - delayTicks)));
    return { tbphs, phsDir: 'UP' };
  }

  const span = tbprd + 1;
  const tbphs = Math.max(0, Math.min(tbprd, Math.round(span - delayTicks)));
  return { tbphs, phsDir: 'UP' };
}

/** 当前分频固定时，这套参数能覆盖的频率范围（kHz） */
export function fswRange(
  tbclkMHz: number,
  totalDiv: number,
  countMode: CountMode,
): { minKhz: number; maxKhz: number } {
  return {
    minKhz: fswFromTbprd(tbclkMHz, 65535, countMode, totalDiv),
    maxKhz: fswFromTbprd(tbclkMHz, 1, countMode, totalDiv),
  };
}

/** 运行时参数的一份快照，用于生成 C 端的默认值 */
export interface RuntimeParam {
  ch: number;
  fswKhz: number;
  dutyPct: number;
  phaseDeg: number;
  tbprd: number;
  /** 主通道或独立变频通道不参与移相 */
  sync: boolean;
}
