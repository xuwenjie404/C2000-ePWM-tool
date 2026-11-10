import type { Interval } from '../types';

/**
 * 波形抓手几何。
 *
 * 这里只做纯粹的坐标换算，不碰 React —— 因为「抓手的 x 必须等于波形跳变沿的 x」
 * 这件事曾经连续错两次（一次漏掉左边距，一次把跨零点脉冲的下降沿取错），
 * 靠肉眼看图是发现不了的，必须由测试锁住。
 *
 * 另一个关键概念是 `originTick`（绘图原点）：
 *   增减对称计数下，`CAU=CLEAR / CAD=SET` 产生的脉冲**跨零点**，
 *   若以 CTR=0 为绘图原点，一个周期会长成"高-低-高"，上升沿跑到下降沿右边。
 *   所以增减计数时把原点移到 CTR=PRD（半周期），脉冲就居中成一整块，
 *   上升沿在左、下降沿在右，符合直觉。单向计数本来就是左对齐，原点保持 0。
 */

export interface Edge {
  tick: number;
  rising: boolean;
}

/** 判断某个 tick 处信号是否为高电平（tick 按周期取模） */
export function levelAtTick(highs: Interval[], tick: number, periodTicks: number): boolean {
  const t = ((tick % periodTicks) + periodTicks) % periodTicks;
  return highs.some(h => t >= h.start && t < h.end);
}

/**
 * 提取**真实跳变沿**。
 *
 * 区间列表在跨零点时会被拆成两段，导致 0 和 T 处各留下一个"假沿"
 * （前后电平其实相同）。这里按周期取模去重，再用前后电平判定真假。
 */
export function collectEdges(highs: Interval[], periodTicks: number): Edge[] {
  const T = periodTicks;
  const ticks = new Set<number>();
  for (const seg of highs) {
    ticks.add(((seg.start % T) + T) % T);
    ticks.add(((seg.end % T) + T) % T);
  }

  const edges: Edge[] = [];
  for (const tick of [...ticks].sort((a, b) => a - b)) {
    const before = levelAtTick(highs, tick - 1, T);
    const after = levelAtTick(highs, tick + 1, T);
    if (before === after) continue; // 假沿（跨零点拆分处）
    edges.push({ tick, rising: !before && after });
  }
  return edges;
}

export interface PixelMapping {
  /** 目标周期在画布上的起始像素（含左边距与移相偏移） */
  windowStart: number;
  /** 一个周期的像素宽度 */
  cyclePx: number;
  periodTicks: number;
  /** 绘图原点对应的 tick：增减计数取 T/2，单向计数取 0 */
  originTick: number;
}

/** tick 在一个周期内的像素偏移（0 ~ cyclePx） */
export function tickToCycleOffset(tick: number, m: PixelMapping): number {
  const T = m.periodTicks;
  const rel = (((tick - m.originTick) % T) + T) % T;
  return (rel / T) * m.cyclePx;
}

/** tick -> 像素。与 scanRuns 使用完全相同的映射 */
export function tickToPixel(tick: number, m: PixelMapping): number {
  return m.windowStart + tickToCycleOffset(tick, m);
}

/**
 * 在「第一个完整周期」内挑选指定方向的沿。
 *
 * collectEdges 已经滤掉了假沿，所以这里只需按像素落在窗口内筛选，
 * 再取 tick 最大（视觉最靠右）的一个即可。
 * 若窗口内没有候选（例如脉宽为 0），退回到 fallbackTick。
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
  originTick: number;
}): WaveGeometry {
  const mapping: PixelMapping = {
    windowStart: params.windowStart,
    cyclePx: params.cyclePx,
    periodTicks: params.periodTicks,
    originTick: params.originTick,
  };
  const edgesA = collectEdges(params.highA, params.periodTicks);
  const edgesB = collectEdges(params.highB, params.periodTicks);

  return {
    riseTick: pickWindowEdge(edgesA, true, mapping, 0),
    fallTick: pickWindowEdge(edgesA, false, mapping, params.periodTicks * 0.5),
    fedTick: pickWindowEdge(edgesB, true, mapping, params.periodTicks * 0.75),
    mapping,
  };
}

/** 增减计数用半周期原点，让脉冲居中；单向计数保持左对齐 */
export function defaultOriginTick(periodTicks: number, countMode: 'UP_DOWN' | 'UP'): number {
  return countMode === 'UP_DOWN' ? Math.round(periodTicks / 2) : 0;
}

/**
 * 按像素采样出高电平区间（供 SVG 画阶梯波）。
 *
 * 与 tickToPixel 共用 `originTick` 与 `cyclePx`，因此「画出来的跳变位置」
 * 与「抓手所在位置」在数学上是同一个映射 —— 这也是能做到 <1px 对齐的原因。
 *
 * @param plotStart 绘图区左边界对应的像素（含移相偏移）
 */
export function scanHighRuns(
  highs: Interval[],
  params: { plotStart: number; cyclePx: number; periodTicks: number; originTick: number },
  xs: number,
  xe: number,
  stepPx = 0.5,
): { x0: number; x1: number }[] {
  const { plotStart, cyclePx, periodTicks, originTick } = params;
  const runs: { x0: number; x1: number }[] = [];
  const inHigh = (x: number): boolean => {
    const rel = (((x - plotStart) % cyclePx) + cyclePx) % cyclePx;
    const tick = originTick + (rel / cyclePx) * periodTicks;
    return levelAtTick(highs, tick, periodTicks);
  };

  let open: number | null = null;
  for (let x = xs; x <= xe; x += stepPx) {
    const high = inHigh(x);
    if (high && open === null) open = x;
    if (!high && open !== null) {
      runs.push({ x0: open, x1: x });
      open = null;
    }
  }
  if (open !== null) runs.push({ x0: open, x1: xe });
  return runs;
}
