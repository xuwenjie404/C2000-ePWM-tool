import type { CountMode, ChannelWaveform, Interval } from '../types';
import type { DeadBandInMode, DeadBandMode } from '../data/deadband';

export interface WaveInput {
  countMode: CountMode;
  tbprd: number;
  cmpA: number;
  cmpB: number;
  dbRed: number;
  dbFed: number;
  mode: DeadBandMode;
  inMode: DeadBandInMode;
  stepNs: number;
}

/** 把 [start, start+high) 展开成 [0, T) 内不跨越周期边界的高电平区间 */
export function toIntervals(start: number, high: number, periodTicks: number): Interval[] {
  if (high <= 0) return [];
  if (high >= periodTicks) return [{ start: 0, end: periodTicks }];
  const s = ((start % periodTicks) + periodTicks) % periodTicks;
  const end = s + high;
  if (end <= periodTicks) return [{ start: s, end }];
  return [
    { start: s, end: periodTicks },
    { start: 0, end: end - periodTicks },
  ];
}

/** 取补集（用于输出极性反相） */
export function complementIntervals(list: Interval[], periodTicks: number): Interval[] {
  if (list.length === 0) return [{ start: 0, end: periodTicks }];
  const sorted = [...list].sort((a, b) => a.start - b.start);
  if (sorted.length === 1 && sorted[0].start <= 0 && sorted[0].end >= periodTicks) return [];
  const out: Interval[] = [];
  let cursor = 0;
  for (const seg of sorted) {
    if (seg.start > cursor) out.push({ start: cursor, end: seg.start });
    cursor = Math.max(cursor, seg.end);
  }
  if (cursor < periodTicks) out.push({ start: cursor, end: periodTicks });
  return out;
}

function totalHigh(list: Interval[]): number {
  return list.reduce((acc, s) => acc + Math.max(0, s.end - s.start), 0);
}

/**
 * 死区 / 动作限定子模块波形仿真
 * ----------------------------------------------------------------------------
 * 依据 TRM 的边沿延迟语义建模：
 *   · DBRED 延迟的是"开通沿"（ePWMxA 的上升沿），DBFED 延迟的是互补管的开通沿；
 *   · 互补型（AHC/ALC）：
 *       A 高电平 = 原始高电平 - DBRED
 *       B 高电平 = 原始低电平 - DBFED
 *     死区期间两路同电平（AHC 全低 / ALC 全高），不存在直通窗口；
 *   · 同相型（AH/AL）：两路取自同一条延迟链，宽度 = 原始宽 - DBRED + DBFED。
 *
 * 当延迟量超过可用脉宽时脉冲被"吞掉"（输出恒定），这是真实的硬件行为，
 * 也是本工具做最小脉宽校验的依据。
 *
 * 说明：IN_MODE 为交叉模式（RED/FED 取不同边沿源）时，本仿真按 DBA_ALL 等效
 * 绘制并置 approximate = true；寄存器配置与生成代码仍严格按所选 IN_MODE 输出。
 */
export function simulateWaveform(input: WaveInput): ChannelWaveform {
  const { countMode, tbprd, cmpA, cmpB, dbRed, dbFed, mode, inMode, stepNs } = input;
  const T = countMode === 'UP_DOWN' ? 2 * tbprd : tbprd + 1;

  // AQ 输出（进死区前）
  const aqHighA = countMode === 'UP_DOWN' ? 2 * cmpA : cmpA;
  const aqRiseA = countMode === 'UP_DOWN' ? (T - cmpA) % T : 0;
  const aqHighB = countMode === 'UP_DOWN' ? 2 * cmpB : cmpB;
  const aqRiseB = countMode === 'UP_DOWN' ? (T - cmpB) % T : 0;

  if (mode.bypass) {
    const highA = toIntervals(aqRiseA, aqHighA, T);
    const highB = toIntervals(aqRiseB, aqHighB, T);
    return {
      periodTicks: T,
      cmpA,
      cmpB,
      dbRed: 0,
      dbFed: 0,
      idealHighTicks: aqHighA,
      highA,
      highB,
      swallowedA: aqHighA <= 0,
      swallowedB: aqHighB <= 0,
      deadTimeRiseNs: 0,
      deadTimeFallNs: 0,
      actualDutyAPct: (totalHigh(highA) / T) * 100,
      actualDutyBPct: (totalHigh(highB) / T) * 100,
      approximate: false,
    };
  }

  const useB = inMode.id === 'DBB_ALL';
  const srcRise = useB ? aqRiseB : aqRiseA;
  const srcHigh = useB ? aqHighB : aqHighA;

  let highA: Interval[];
  let highB: Interval[];
  let swallowedA: boolean;
  let swallowedB: boolean;

  if (mode.kind === 'COMPLEMENTARY') {
    // 互补对：A 的开通沿被 RED 延迟，B 的开通沿被 FED 延迟
    const widthA = srcHigh - dbRed;
    const widthB = T - srcHigh - dbFed;
    swallowedA = widthA <= 0;
    swallowedB = widthB <= 0;

    let hiA = toIntervals(srcRise + dbRed, Math.max(0, widthA), T);
    let hiB = toIntervals(srcRise + srcHigh + dbFed, Math.max(0, widthB), T);

    // 低有效模式：互补对整体反相，死区期间两路皆高（对低有效驱动 = 双管关断）
    if (mode.invert) {
      hiA = complementIntervals(hiA, T);
      hiB = complementIntervals(hiB, T);
    }
    highA = hiA;
    highB = hiB;
  } else {
    // 同相型：两路共用一条延迟链，上升沿延迟 RED、下降沿延迟 FED
    const width = srcHigh - dbRed + dbFed;
    swallowedA = width <= 0;
    swallowedB = width <= 0;
    let both = toIntervals(srcRise + dbRed, Math.max(0, width), T);
    if (mode.invert) both = complementIntervals(both, T);
    highA = both;
    highB = both;
  }

  return {
    periodTicks: T,
    cmpA,
    cmpB,
    dbRed,
    dbFed,
    idealHighTicks: srcHigh,
    highA,
    highB,
    swallowedA,
    swallowedB,
    deadTimeRiseNs: dbRed * stepNs,
    deadTimeFallNs: dbFed * stepNs,
    actualDutyAPct: (totalHigh(highA) / T) * 100,
    actualDutyBPct: (totalHigh(highB) / T) * 100,
    approximate: inMode.crossSource,
  };
}

/**
 * 采样波形（用于 SVG 阶梯路径）。返回 0/1 电平序列，索引 0..sampleCount-1
 * 对应当前周期的等分相位。
 */
export function sampleWaveform(high: Interval[], periodTicks: number, sampleCount: number): number[] {
  const out = new Array<number>(sampleCount).fill(0);
  if (periodTicks <= 0) return out;
  for (const seg of high) {
    const i0 = Math.floor((seg.start / periodTicks) * sampleCount);
    const i1 = Math.ceil((seg.end / periodTicks) * sampleCount);
    for (let i = Math.max(0, i0); i < Math.min(sampleCount, i1); i++) out[i] = 1;
  }
  return out;
}

/** 计算最小脉宽（高电平与低电平中较短者），单位 ns */
export function minPulseWidthNs(wave: ChannelWaveform, stepNs: number): number {
  const highTicks = totalHigh(wave.highA);
  const lowTicks = wave.periodTicks - highTicks;
  return Math.min(highTicks, lowTicks) * stepNs;
}
