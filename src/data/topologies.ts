import { createRegistry } from '../platform/registry';
import type { ChannelConfig, PhaseSystem, ProjectState } from '../types';
import { makeChannel } from './presets';

/**
 * 拓扑插件。
 *
 * 一个拓扑 = 「当前相数下的桥臂组合方式」+ 「如何从现有工程派生通道」。
 * 新增拓扑（如维也纳整流、T 型三电平、矩阵变换器）只需在这里 register，
 * App 与 ControlPanel 会自动出现对应按钮，不需要改 UI 代码。
 */
export interface Topology {
  id: string;
  phaseSystem: PhaseSystem;
  label: string;
  hint: string;
  /** 从当前工程派生通道（沿用已调好的死区值等，避免每次重调） */
  build(prev: ProjectState): ChannelConfig[];
}

export const topologyRegistry = createRegistry<Topology>('topology');

const dbOf = (prev: ProjectState): number => prev.channels[0]?.redNs ?? 200;

topologyRegistry.registerAll([
  {
    id: '1P_HB',
    phaseSystem: '1P',
    label: '半桥',
    hint: '单桥臂 + 互补死区，LLC / 同步 Buck 的基本单元',
    build: prev => [makeChannel({ id: 1, name: '半桥主桥臂', redNs: dbOf(prev), fedNs: dbOf(prev) })],
  },
  {
    id: '1P_FB',
    phaseSystem: '1P',
    label: '全桥 / 移相',
    hint: '两桥臂载波互差 180°，用于移相全桥与双极性调制',
    build: prev => [
      makeChannel({ id: 1, name: '超前桥臂 (Leading)', phase: 0, redNs: dbOf(prev), fedNs: dbOf(prev) }),
      makeChannel({ id: 2, name: '滞后桥臂 (Lagging)', phase: 180, redNs: dbOf(prev), fedNs: dbOf(prev) }),
    ],
  },
  {
    id: '1P_TOTEM',
    phaseSystem: '1P',
    label: '图腾柱 PFC',
    hint: '快管高频 + 慢管工频，演示独立变频时基',
    build: prev => [
      makeChannel({ id: 1, name: '高频快管臂', duty: 90, redNs: 60, fedNs: 60 }),
      makeChannel({
        id: 2,
        name: '工频慢管臂 (50 Hz)',
        independentFreq: true,
        customFreqKhz: 0.05,
        duty: 50,
        redNs: Math.max(2000, dbOf(prev)),
        fedNs: Math.max(2000, dbOf(prev)),
      }),
    ],
  },
  {
    id: '3P_3LEG',
    phaseSystem: '3P',
    label: '三桥臂',
    hint: '标准三相逆变 / 整流，载波同相、调制互差 120°',
    build: prev =>
      ['U 相桥臂', 'V 相桥臂', 'W 相桥臂'].map((name, i) =>
        makeChannel({ id: i + 1, name, redNs: dbOf(prev), fedNs: dbOf(prev) }),
      ),
  },
  {
    id: '3P_4LEG',
    phaseSystem: '3P',
    label: '四桥臂',
    hint: '带 N 相中线桥臂，可输出零序补偿不平衡负载',
    build: prev =>
      ['U 相桥臂', 'V 相桥臂', 'W 相桥臂', 'N 相中线桥臂'].map((name, i) =>
        makeChannel({ id: i + 1, name, redNs: dbOf(prev), fedNs: dbOf(prev) }),
      ),
  },
  {
    id: '3P_INTERLEAVED',
    phaseSystem: '3P',
    label: '交错并联',
    hint: '载波 0°/120°/240° 互差，用于降低输入电流纹波',
    build: prev =>
      [0, 120, 240].map((phase, i) =>
        makeChannel({
          id: i + 1,
          name: `交错相 ${i + 1} (${phase}°)`,
          phase,
          redNs: dbOf(prev),
          fedNs: dbOf(prev),
        }),
      ),
  },
]);

export function topologiesFor(phaseSystem: PhaseSystem): Topology[] {
  return topologyRegistry.list().filter(t => t.phaseSystem === phaseSystem);
}

export function getTopology(id: string): Topology | undefined {
  return topologyRegistry.get(id);
}
