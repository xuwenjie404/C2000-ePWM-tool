import { describe, expect, it } from 'vitest';
import { createDefaultProject, sanitizeProject } from './project';
import { resolveHardware } from './hardware';
import { collectEdges, levelAtTick, pickWindowEdge, resolveWaveGeometry, tickToPixel } from './waveformGeometry';

/** 与 WaveformPanel 保持一致的画布常量 */
const PAD_L = 58;
const PAD_R = 14;
const SVG_W = 860;
const PERIODS = 2;
const PLOT_W = SVG_W - PAD_L - PAD_R;
const CYCLE_PX = PLOT_W / PERIODS;

function geometryOf(project = createDefaultProject()) {
  const hw = resolveHardware(project);
  const ch = hw.master;
  const windowStart = PAD_L + CYCLE_PX * (PERIODS - 1);
  const geo = resolveWaveGeometry({
    highA: ch.wave.highA,
    highB: ch.wave.highB,
    periodTicks: ch.wave.periodTicks,
    windowStart,
    cyclePx: CYCLE_PX,
  });
  return { hw, ch, geo, windowStart };
}

describe('抓手几何：必须落在波形的真实跳变沿上', () => {
  it('RED 抓手 = A 相上升沿（低 -> 高）', () => {
    const { ch, geo } = geometryOf();
    const T = ch.wave.periodTicks;
    expect(levelAtTick(ch.wave.highA, geo.riseTick - 1, T)).toBe(false);
    expect(levelAtTick(ch.wave.highA, geo.riseTick + 1, T)).toBe(true);
  });

  it('Duty 抓手 = A 相下降沿（高 -> 低）', () => {
    const { ch, geo } = geometryOf();
    const T = ch.wave.periodTicks;
    expect(levelAtTick(ch.wave.highA, geo.fallTick - 1, T)).toBe(true);
    expect(levelAtTick(ch.wave.highA, geo.fallTick + 1, T)).toBe(false);
  });

  it('FED 抓手 = B 相上升沿（低 -> 高）', () => {
    const { ch, geo } = geometryOf();
    const T = ch.wave.periodTicks;
    expect(levelAtTick(ch.wave.highB, geo.fedTick - 1, T)).toBe(false);
    expect(levelAtTick(ch.wave.highB, geo.fedTick + 1, T)).toBe(true);
  });

  it('三个抓手都落在绘图区内，不会跑到左边距外面', () => {
    const { geo } = geometryOf();
    const xs = [geo.riseTick, geo.fallTick, geo.fedTick].map(t => tickToPixel(t, geo.mapping));
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(PAD_L);
      expect(x).toBeLessThanOrEqual(SVG_W - PAD_R);
    }
  });

  it('回归：抓手不能漏掉左边距（曾经整体左移 58px）', () => {
    const { geo, windowStart } = geometryOf();
    // 默认工程 50% 占空比、300ns 死区：上升沿位于周期约 75% 处
    const riseX = tickToPixel(geo.riseTick, geo.mapping);
    expect(riseX).toBeGreaterThan(windowStart + CYCLE_PX * 0.6);
    expect(geo.mapping.windowStart).toBe(windowStart);
  });

  it('回归：跨零点脉冲的下降沿取第二段末尾，而不是周期边界', () => {
    const { ch, geo } = geometryOf();
    const T = ch.wave.periodTicks;
    // 下降沿应落在周期的 25%（= C/T）附近，而不是 100%
    expect(geo.fallTick / T).toBeLessThan(0.4);
    expect(geo.fallTick).toBeGreaterThan(0);
  });
});

describe('几何随参数变化仍然正确', () => {
  const cases: { name: string; project: ReturnType<typeof sanitizeProject> }[] = [
    {
      name: '10% 占空比',
      project: sanitizeProject({ ...createDefaultProject(), freqKhz: 20, channels: [{ id: 1, duty: 10 }] }),
    },
    {
      name: '90% 占空比',
      project: sanitizeProject({ ...createDefaultProject(), freqKhz: 20, channels: [{ id: 1, duty: 90 }] }),
    },
    {
      name: '单向计数',
      project: sanitizeProject({ ...createDefaultProject(), countMode: 'UP', freqKhz: 20 }),
    },
    {
      name: '大死区 3000ns',
      project: sanitizeProject({ ...createDefaultProject(), freqKhz: 20, channels: [{ id: 1, redNs: 3000, fedNs: 3000 }] }),
    },
  ];

  for (const c of cases) {
    it(`${c.name}：三个抓手都贴合真实边沿`, () => {
      const hw = resolveHardware(c.project);
      const ch = hw.master;
      const T = ch.wave.periodTicks;
      const geo = resolveWaveGeometry({
        highA: ch.wave.highA,
        highB: ch.wave.highB,
        periodTicks: T,
        windowStart: PAD_L + CYCLE_PX * (PERIODS - 1),
        cyclePx: CYCLE_PX,
      });

      expect(levelAtTick(ch.wave.highA, geo.riseTick - 1, T)).toBe(false);
      expect(levelAtTick(ch.wave.highA, geo.riseTick + 1, T)).toBe(true);
      expect(levelAtTick(ch.wave.highA, geo.fallTick - 1, T)).toBe(true);
      expect(levelAtTick(ch.wave.highA, geo.fallTick + 1, T)).toBe(false);
      expect(levelAtTick(ch.wave.highB, geo.fedTick - 1, T)).toBe(false);
      expect(levelAtTick(ch.wave.highB, geo.fedTick + 1, T)).toBe(true);
    });
  }
});

describe('collectEdges / pickWindowEdge', () => {
  it('把区间展开成有序的升/降沿', () => {
    const edges = collectEdges([
      { start: 900, end: 1200 },
      { start: 0, end: 300 },
    ]);
    expect(edges).toEqual([
      { tick: 0, rising: true },
      { tick: 300, rising: false },
      { tick: 900, rising: true },
      { tick: 1200, rising: false },
    ]);
  });

  it('窗口边界上的沿（tick = 周期末尾）被排除，避免抓手贴到右边缘', () => {
    const edges = collectEdges([{ start: 900, end: 1200 }]);
    const mapping = { windowStart: PAD_L, cyclePx: CYCLE_PX, periodTicks: 1200 };
    const tick = pickWindowEdge(edges, false, mapping, 600);
    // 1200 映射到窗口右边界外，应回退到备选值
    expect(tick).toBe(600);
  });

  it('没有候选沿时回退到 fallback，不会返回 undefined', () => {
    const mapping = { windowStart: PAD_L, cyclePx: CYCLE_PX, periodTicks: 1200 };
    expect(pickWindowEdge([], true, mapping, 42)).toBe(42);
  });
});
