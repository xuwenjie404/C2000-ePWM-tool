import { describe, expect, it } from 'vitest';
import { createDefaultProject, sanitizeProject } from './project';
import { resolveHardware } from './hardware';
import {
  collectEdges,
  defaultOriginTick,
  levelAtTick,
  pickWindowEdge,
  resolveWaveGeometry,
  scanHighRuns,
  tickToCycleOffset,
  tickToPixel,
} from './waveformGeometry';

/** 与 WaveformPanel 保持一致的画布常量 */
const PAD_L = 58;
const PAD_R = 14;
const SVG_W = 860;
const PLOT_W = SVG_W - PAD_L - PAD_R;
const CYCLE_PX = PLOT_W / 2;

function geometryOf(project = createDefaultProject()) {
  const hw = resolveHardware(project);
  const ch = hw.master;
  const T = ch.wave.periodTicks;
  const originTick = defaultOriginTick(T, project.countMode);
  const geo = resolveWaveGeometry({
    highA: ch.wave.highA,
    highB: ch.wave.highB,
    periodTicks: T,
    windowStart: PAD_L,
    cyclePx: CYCLE_PX,
    originTick,
  });
  return { project, ch, geo, T, originTick };
}

describe('抓手必须落在真实跳变沿上', () => {
  it('RED = A 相上升沿（低 -> 高）', () => {
    const { ch, geo, T } = geometryOf();
    expect(levelAtTick(ch.wave.highA, geo.riseTick - 1, T)).toBe(false);
    expect(levelAtTick(ch.wave.highA, geo.riseTick + 1, T)).toBe(true);
  });

  it('Duty = A 相下降沿（高 -> 低）', () => {
    const { ch, geo, T } = geometryOf();
    expect(levelAtTick(ch.wave.highA, geo.fallTick - 1, T)).toBe(true);
    expect(levelAtTick(ch.wave.highA, geo.fallTick + 1, T)).toBe(false);
  });

  it('FED = B 相上升沿（低 -> 高）', () => {
    const { ch, geo, T } = geometryOf();
    expect(levelAtTick(ch.wave.highB, geo.fedTick - 1, T)).toBe(false);
    expect(levelAtTick(ch.wave.highB, geo.fedTick + 1, T)).toBe(true);
  });
});

describe('视觉直觉：上升沿在左、下降沿在右', () => {
  it('左右顺序恒为 RED → Duty → FED（5%~95% 占空比，两种计数模式）', () => {
    for (const mode of ['UP_DOWN', 'UP'] as const) {
      for (const duty of [5, 25, 50, 75, 95]) {
        const p = sanitizeProject({
          ...createDefaultProject(),
          countMode: mode,
          channels: [{ id: 1, duty }],
        });
        const { geo } = geometryOf(p);
        const riseX = tickToPixel(geo.riseTick, geo.mapping);
        const fallX = tickToPixel(geo.fallTick, geo.mapping);
        const fedX = tickToPixel(geo.fedTick, geo.mapping);

        expect(riseX).toBeLessThan(fallX);
        expect(fedX).toBeGreaterThanOrEqual(fallX);
      }
    }
  });

  it('极端占空比（99%）下抓手仍然贴合真实边沿（此时 FED 会绕回左端）', () => {
    const p = sanitizeProject({ ...createDefaultProject(), channels: [{ id: 1, duty: 99 }] });
    const { ch, geo, T } = geometryOf(p);
    expect(levelAtTick(ch.wave.highA, geo.riseTick - 1, T)).toBe(false);
    expect(levelAtTick(ch.wave.highA, geo.riseTick + 1, T)).toBe(true);
    expect(levelAtTick(ch.wave.highA, geo.fallTick - 1, T)).toBe(true);
    expect(levelAtTick(ch.wave.highA, geo.fallTick + 1, T)).toBe(false);
  });

  it('FED 紧跟在 Duty 之后（间隔 = 一个死区宽度）', () => {
    const { geo, ch } = geometryOf();
    const fallX = tickToPixel(geo.fallTick, geo.mapping);
    const fedX = tickToPixel(geo.fedTick, geo.mapping);
    const expected = (ch.dbFed / ch.wave.periodTicks) * CYCLE_PX;
    expect(fedX - fallX).toBeCloseTo(expected, 3);
  });

  it('占空比越大，脉冲越宽，但始终完整落在一个周期内', () => {
    const widths = [10, 50, 90].map(duty => {
      const p = sanitizeProject({ ...createDefaultProject(), channels: [{ id: 1, duty }] });
      const { geo, T } = geometryOf(p);
      const w = tickToCycleOffset(geo.fallTick, geo.mapping) - tickToCycleOffset(geo.riseTick, geo.mapping);
      expect(w).toBeGreaterThan(0);
      expect(w).toBeLessThanOrEqual(CYCLE_PX);
      void T;
      return w;
    });
    expect(widths[0]).toBeLessThan(widths[1]);
    expect(widths[1]).toBeLessThan(widths[2]);
  });
});

describe('坐标基准回归', () => {
  it('三个抓手都落在绘图区内', () => {
    const { geo } = geometryOf();
    for (const tick of [geo.riseTick, geo.fallTick, geo.fedTick]) {
      const x = tickToPixel(tick, geo.mapping);
      expect(x).toBeGreaterThanOrEqual(PAD_L);
      expect(x).toBeLessThanOrEqual(SVG_W - PAD_R);
    }
  });

  it('回归：不能漏掉左边距（曾经整体左移 58px）', () => {
    const { geo } = geometryOf();
    // 50% 占空比下上升沿在绘制周期的约 25% 处，加上左边距后必然 > PAD_L + 10% 周期
    const riseX = tickToPixel(geo.riseTick, geo.mapping);
    expect(riseX).toBeGreaterThan(PAD_L + CYCLE_PX * 0.1);
    expect(geo.mapping.windowStart).toBe(PAD_L);
  });

  it('回归：绘图原点默认在半周期，脉冲不再跨零点分裂', () => {
    const { geo, T } = geometryOf();
    expect(geo.mapping.originTick).toBe(Math.round(T / 2));
    // 高电平区间应当是一整块（跨零点被拆成两段时，这里的宽度会异常）
    const riseOff = tickToCycleOffset(geo.riseTick, geo.mapping);
    const fallOff = tickToCycleOffset(geo.fallTick, geo.mapping);
    expect(fallOff - riseOff).toBeCloseTo(0.5 * CYCLE_PX, -1);
  });
});

describe('参数变化后仍然正确', () => {
  const cases: { name: string; project: ReturnType<typeof sanitizeProject> }[] = [
    { name: '10% 占空比', project: sanitizeProject({ ...createDefaultProject(), channels: [{ id: 1, duty: 10 }] }) },
    { name: '90% 占空比', project: sanitizeProject({ ...createDefaultProject(), channels: [{ id: 1, duty: 90 }] }) },
    { name: '单向计数', project: sanitizeProject({ ...createDefaultProject(), countMode: 'UP' }) },
    {
      name: '大死区 3000ns',
      project: sanitizeProject({ ...createDefaultProject(), channels: [{ id: 1, redNs: 3000, fedNs: 3000 }] }),
    },
    {
      name: '1kHz 低频',
      project: sanitizeProject({ ...createDefaultProject(), freqKhz: 1 }),
    },
  ];

  for (const c of cases) {
    it(`${c.name}：抓手仍贴合真实边沿`, () => {
      const { ch, geo, T } = geometryOf(c.project);
      expect(levelAtTick(ch.wave.highA, geo.riseTick - 1, T)).toBe(false);
      expect(levelAtTick(ch.wave.highA, geo.riseTick + 1, T)).toBe(true);
      expect(levelAtTick(ch.wave.highA, geo.fallTick - 1, T)).toBe(true);
      expect(levelAtTick(ch.wave.highA, geo.fallTick + 1, T)).toBe(false);
      expect(levelAtTick(ch.wave.highB, geo.fedTick - 1, T)).toBe(false);
      expect(levelAtTick(ch.wave.highB, geo.fedTick + 1, T)).toBe(true);
    });
  }
});

describe('collectEdges：过滤跨零点产生的假沿', () => {
  it('跨零点的两段区间不会在 0 处产生假上升沿', () => {
    // 高电平 [0,300) 与 [900,1200)：0 处前后都是高，只有 300 与 900 是真实沿
    const edges = collectEdges(
      [
        { start: 900, end: 1200 },
        { start: 0, end: 300 },
      ],
      1200,
    );
    expect(edges).toEqual([
      { tick: 300, rising: false },
      { tick: 900, rising: true },
    ]);
  });

  it('整周期为高时不产生任何沿', () => {
    expect(collectEdges([{ start: 0, end: 1200 }], 1200)).toEqual([]);
  });

  it('空区间返回空列表', () => {
    expect(collectEdges([], 1200)).toEqual([]);
  });
});

describe('像素级对齐：画出来的跳变 = 抓手所在位置', () => {
  it('阶梯波的每个跳变沿都与抓手的 x 相差 < 1.2px', () => {
    for (const duty of [10, 50, 90]) {
      const p = sanitizeProject({ ...createDefaultProject(), channels: [{ id: 1, duty }] });
      const { ch, geo, originTick } = geometryOf(p);
      const runs = scanHighRuns(
        ch.wave.highA,
        { plotStart: PAD_L, cyclePx: CYCLE_PX, periodTicks: ch.wave.periodTicks, originTick },
        PAD_L,
        SVG_W - PAD_R,
      );
      const boundaries = runs.flatMap(r => [r.x0, r.x1]);
      expect(boundaries.length).toBeGreaterThan(0);

      for (const tick of [geo.riseTick, geo.fallTick]) {
        const x = tickToPixel(tick, geo.mapping);
        const nearest = Math.min(...boundaries.map(b => Math.abs(b - x)));
        expect(nearest).toBeLessThan(1.2);
      }
    }
  });

  it('B 相抓手同样落在阶梯跳变上', () => {
    const { ch, geo, originTick } = geometryOf();
    const runs = scanHighRuns(
      ch.wave.highB,
      { plotStart: PAD_L, cyclePx: CYCLE_PX, periodTicks: ch.wave.periodTicks, originTick },
      PAD_L,
      SVG_W - PAD_R,
    );
    const boundaries = runs.flatMap(r => [r.x0, r.x1]);
    const fedX = tickToPixel(geo.fedTick, geo.mapping);
    expect(Math.min(...boundaries.map(b => Math.abs(b - fedX)))).toBeLessThan(1.2);
  });
});

describe('pickWindowEdge 边界', () => {
  it('窗口内没有候选时回退到 fallback，不返回窗口外的值', () => {
    const mapping = { windowStart: PAD_L, cyclePx: 10, periodTicks: 1200, originTick: 0 };
    // tick=1150 映射到窗口右边界之外，应回退
    const edges = [{ tick: 1150, rising: false }];
    expect(pickWindowEdge(edges, false, mapping, 42)).toBe(42);
  });

  it('窗口内的候选会被选中', () => {
    const mapping = { windowStart: PAD_L, cyclePx: CYCLE_PX, periodTicks: 1200, originTick: 0 };
    const edges = [{ tick: 300, rising: true }];
    expect(pickWindowEdge(edges, true, mapping, 42)).toBe(300);
  });
});
