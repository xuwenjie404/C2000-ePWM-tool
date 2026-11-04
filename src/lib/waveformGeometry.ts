import type { Interval } from '../types';

/**
 * 波形抓手几何。
 *
 * 这里只做纯粹的坐标换算，不碰 React —— 因为「抓手的 x 必须等于波形跳变沿的 x」
 * 这件事曾经连续错两次（一次漏掉左边距，一次把跨零点脉冲的下降沿取错），
 * 靠肉眼看图是发现不了的，必须由测试锁住。
 */

export interface Edge {
  tick: number;
  rising: boolean;
}

/** 把高电平区间展开成升/降沿列表（tick 升序） */
export function collectEdges(highs: Interval[]): Edge[] {
  return highs
    .flatMap(seg => [
      { tick: seg.start, rising: true },
      { tick: seg.end, rising: false },
    ])
    .sort((a, b) => a.tick - b.tick);
}

export interface PixelMapping {
  /** 目标周期在画布上的起始像素（含左边距与移相偏移） */
  windowStart: number;
  /** 一个周期的像素宽度 */
  cyclePx: number;
  periodTicks: number;
}

/** tick -> 像素。与 plotPath / scanRuns 使用完全相同的映射 */
export function tickToPixel(tick: number, m: PixelMapping): number {
  return m.windowStart + (tick / m.periodTicks) * m.cyclePx;
}

/**
 * 在「最后一个完整周期」内挑选指定方向的沿。
 *
 * 增减对称计数下 A 的高电平跨零点，区间被拆成 `[T-C+RED, T)` 与 `[0, C)`：
 * 上升沿在前一段起点，下降沿在后一段终点。因此要按 tick 排序后取窗口内
 * **最靠右** 的那一个，而不是数组里第一个区间的 end。
 *
 * 若窗口内没有任何候选（例如脉宽为 0），退回到 fallbackTick —— 保证抓手不会跑到画布外面。
 */
export function pickWindowEdge(
  edges: Edge[],
  rising: boolean,
  m: PixelMapping,
  fallbackTick: number,
): number {
  const windowEnd = m.windowStart + m.cyclePx;
  const inside = edges.filter(e => {
    if (e.rising !== rising) return false;
    const x = tickToPixel(e.tick, m);
    return x >= m.windowStart - 0.5 && x < windowEnd - 0.5;
  });
  if (inside.length > 0) return inside[inside.length - 1].tick;
  return fallbackTick;
}

/** 判断某个 tick 处信号是否为高电平（用于测试与调试） */
export function levelAtTick(highs: Interval[], tick: number, periodTicks: number): boolean {
  const t = ((tick % periodTicks) + periodTicks) % periodTicks;
  return highs.some(h => t >= h.start && t < h.end);
}

export interface WaveGeometry {
  /** A 相上升沿（RED 抓手） */
  riseTick: number;
  /** A 相下降沿（占空比抓手） */
  fallTick: number;
  /** B 相上升沿（FED 抓手） */
  fedTick: number;
  mapping: PixelMapping;
}

/**
 * 一次性算出某通道三个抓手的 tick 与像素映射。
 * 组件与测试共用，保证「看到的」和「测到的」是同一套数。
 */
export function resolveWaveGeometry(params: {
  highA: Interval[];
  highB: Interval[];
  periodTicks: number;
  windowStart: number;
  cyclePx: number;
}): WaveGeometry {
  const mapping: PixelMapping = {
    windowStart: params.windowStart,
    cyclePx: params.cyclePx,
    periodTicks: params.periodTicks,
  };
  const edgesA = collectEdges(params.highA);
  const edgesB = collectEdges(params.highB);

  return {
    riseTick: pickWindowEdge(edgesA, true, mapping, 0),
    fallTick: pickWindowEdge(edgesA, false, mapping, params.periodTicks * 0.5),
    fedTick: pickWindowEdge(edgesB, true, mapping, params.periodTicks * 0.75),
    mapping,
  };
}
