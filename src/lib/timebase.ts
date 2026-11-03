import { CLKDIV_OPTIONS, HSPCLKDIV_OPTIONS, TBPRD_MAX, TBPRD_MIN } from '../data/clock';
import type { CountMode, TimeBaseSolution } from '../types';

interface DividerCombo {
  clkDiv: number;
  hspClkDiv: number;
  totalDiv: number;
}

const DIVIDER_COMBOS: DividerCombo[] = (() => {
  const list: DividerCombo[] = [];
  for (const c of CLKDIV_OPTIONS) {
    for (const h of HSPCLKDIV_OPTIONS) {
      list.push({ clkDiv: c.val, hspClkDiv: h.val, totalDiv: c.val * h.val });
    }
  }
  return list.sort((a, b) => a.totalDiv - b.totalDiv || a.hspClkDiv - b.hspClkDiv);
})();

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * 求解时基参数。
 *
 * 选择策略：在满足 TBPRD <= 65535 的前提下，取 **最小** 的总分频比，
 * 从而让 TBPRD 尽可能大 —— 即占空比分辨率最高（1/TBPRD）。
 *
 * 周期关系（P = TBPRD）：
 *   增减计数：f_sw = TBCLK / (2P)      -> P = TBCLK / (2 f_sw)
 *   单向计数：f_sw = TBCLK / (P + 1)   -> P = TBCLK / f_sw - 1
 */
export function computeTimeBase(
  tbclkMHz: number,
  targetFswKhz: number,
  countMode: CountMode,
): TimeBaseSolution {
  const warnings: string[] = [];
  const tbclkHz = Math.max(1e3, tbclkMHz * 1e6);
  const fswHz = Math.max(1, Math.min(5e6, targetFswKhz * 1e3));

  const rawFor = (effTbclkHz: number): number =>
    countMode === 'UP_DOWN' ? effTbclkHz / (2 * fswHz) : effTbclkHz / fswHz - 1;

  let chosen = DIVIDER_COMBOS[DIVIDER_COMBOS.length - 1];
  for (const combo of DIVIDER_COMBOS) {
    const raw = rawFor(tbclkHz / combo.totalDiv);
    if (raw <= TBPRD_MAX) {
      chosen = combo;
      break;
    }
  }

  const effTbclkMHz = tbclkMHz / chosen.totalDiv;
  const effTbclkHz = effTbclkMHz * 1e6;
  const stepNs = 1000 / effTbclkMHz;

  const rawTbprd = rawFor(effTbclkHz);
  const tbprd = Math.round(clamp(rawTbprd, TBPRD_MIN, TBPRD_MAX));
  const periodTicks = countMode === 'UP_DOWN' ? 2 * tbprd : tbprd + 1;
  const actualFswHz = effTbclkHz / periodTicks;
  const actualFswKhz = actualFswHz / 1e3;
  const freqErrorPct = Math.abs(actualFswKhz - targetFswKhz) / targetFswKhz * 100;

  let clamped: TimeBaseSolution['clamped'] = 'none';
  if (rawTbprd > TBPRD_MAX) clamped = 'max';
  else if (rawTbprd < TBPRD_MIN) clamped = 'min';

  if (clamped === 'max') {
    warnings.push(
      `目标 ${targetFswKhz} kHz 过低，TBPRD 已钳位到 ${TBPRD_MAX}（该配置下最低可达频率受限）。`,
    );
  }
  if (clamped === 'min') {
    warnings.push(
      `目标 ${targetFswKhz} kHz 超出 ${tbclkMHz} MHz TBCLK 的能力上限，TBPRD 钳位到 ${TBPRD_MIN}，实际频率为 ${actualFswKhz.toFixed(1)} kHz。`,
    );
  }
  if (tbprd < 25 && clamped === 'none') {
    warnings.push(
      `TBPRD 仅 ${tbprd}，占空比分辨率约 ${(100 / Math.max(1, tbprd)).toFixed(2)}%/LSB，建议降低 f_sw 或改用 HRPWM。`,
    );
  }
  if (freqErrorPct > 0.5 && clamped === 'none') {
    warnings.push(
      `TBPRD 取整导致实际频率 ${actualFswKhz.toFixed(3)} kHz 与目标偏差 ${freqErrorPct.toFixed(2)}%。`,
    );
  }

  return {
    clkDiv: chosen.clkDiv,
    hspClkDiv: chosen.hspClkDiv,
    totalDiv: chosen.totalDiv,
    effTbclkMHz,
    stepNs,
    tbprd,
    rawTbprd,
    actualFswKhz,
    periodNs: 1e9 / actualFswHz,
    periodTicks,
    freqErrorPct,
    dutyLsbPct: 100 / periodTicks,
    clamped,
    warnings,
  };
}

/**
 * 由占空比百分比换算 CMPA / CMPB 写入值。
 * 增减计数：duty = CMPA / TBPRD       （CMPA 上限 TBPRD）
 * 单向计数：duty = CMPA / (TBPRD + 1)  （CMPA 上限 TBPRD，取 TBPRD+1 时比较事件不再发生）
 */
export function dutyToCompare(dutyPct: number, tb: TimeBaseSolution, countMode: CountMode): number {
  const ratio = clamp(dutyPct, 0, 100) / 100;
  const span = countMode === 'UP_DOWN' ? tb.tbprd : tb.tbprd + 1;
  return Math.round(clamp(ratio * span, 0, tb.tbprd));
}

/** 由 CMPA 反推理想占空比，% */
export function compareToDuty(cmp: number, tb: TimeBaseSolution, countMode: CountMode): number {
  const span = countMode === 'UP_DOWN' ? tb.tbprd : tb.tbprd + 1;
  return (cmp / span) * 100;
}

/** 纳秒 -> TBCLK 计数（按位宽钳位） */
export function nsToTicks(ns: number, stepNs: number, maxCount: number): number {
  return Math.round(clamp(ns / stepNs, 0, maxCount));
}

export interface PhaseCalculation {
  /** TBPHS 写入值 */
  tbphs: number;
  /** PHSDIR：UP_DOWN 下决定同步后计数方向 */
  phsDir: 'UP' | 'DOWN';
  /** 实际可达移相角（受 TBPHS 整数化影响） */
  actualPhaseDeg: number;
  /** 等效延迟时间，ns */
  delayNs: number;
  /** 单向计数模式下移相只能延时，无法做到精确的任意角度 */
  limited: boolean;
}

/**
 * 移相计算。
 * ----------------------------------------------------------------------------
 * 同步脉冲来自主模块的 CTR_ZERO。从模块收到同步后把 TBCTR 装载为 TBPHS：
 *   PHSDIR = DOWN：从 TBPHS 递减到 0，延时 = TBPHS 个计数
 *   PHSDIR = UP  ：从 TBPHS 递增到 TBPRD 再回 0，延时 = (2*TBPRD - TBPHS) 个计数
 * 因此 φ ∈ [0,180] 用 DOWN，φ ∈ (180,360] 用 UP，保证 TBPHS 落在 [0, TBPRD]。
 * 单向计数模式下 PHSDIR 无效，只能通过 TBPHS 实现「延时」意义上的移相。
 */
export function computePhase(
  phaseDeg: number,
  tb: TimeBaseSolution,
  countMode: CountMode,
): PhaseCalculation {
  const norm = ((phaseDeg % 360) + 360) % 360;
  const periodTicks = tb.periodTicks;
  const delayTicks = (norm / 360) * periodTicks;

  if (countMode === 'UP_DOWN') {
    let tbphs: number;
    let phsDir: 'UP' | 'DOWN';
    if (norm <= 180) {
      tbphs = Math.round(delayTicks);
      phsDir = 'DOWN';
    } else {
      tbphs = Math.round(2 * tb.tbprd - delayTicks);
      phsDir = 'UP';
    }
    tbphs = clamp(tbphs, 0, tb.tbprd);
    const actualDelayTicks = phsDir === 'DOWN' ? tbphs : 2 * tb.tbprd - tbphs;
    return {
      tbphs,
      phsDir,
      actualPhaseDeg: (actualDelayTicks / periodTicks) * 360,
      delayNs: actualDelayTicks * tb.stepNs,
      limited: false,
    };
  }

  // 单向计数：从 TBPHS 计数到 TBPRD 再归零，延时 = (TBPRD + 1 - TBPHS)
  const span = tb.tbprd + 1;
  const tbphs = clamp(Math.round(span - delayTicks), 0, tb.tbprd);
  const actualDelayTicks = span - tbphs;
  return {
    tbphs,
    phsDir: 'UP',
    actualPhaseDeg: (actualDelayTicks / periodTicks) * 360,
    delayNs: actualDelayTicks * tb.stepNs,
    limited: true,
  };
}
