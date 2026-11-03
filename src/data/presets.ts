import type { ChannelConfig, ProjectState } from '../types';

/** 通道默认值工厂 —— 所有预设都基于它派生，保证字段完整 */
export function makeChannel(partial: Partial<ChannelConfig> & { id: number }): ChannelConfig {
  const { id, ...rest } = partial;
  return {
    id,
    name: `ePWM${id} 桥臂`,
    enabled: true,
    independentFreq: false,
    customFreqKhz: 100,
    duty: 50,
    dutyB: 50,
    phase: 0,
    redNs: 200,
    fedNs: 200,
    lockDb: true,
    mode: 'AHC',
    inMode: 'DBA_ALL',
    muxIdxA: 0,
    muxIdxB: 0,
    hrpwm: false,
    ...rest,
  };
}

export type PresetPatch = Pick<
  ProjectState,
  | 'freqKhz'
  | 'countMode'
  | 'phaseSystem'
  | 'subTopology'
  | 'modulationMode'
  | 'modIndex'
  | 'fundFreqHz'
  | 'threePhaseSyncLock'
  | 'channels'
>;

export interface Preset {
  id: string;
  name: string;
  tag: '逆变' | 'DC-DC' | 'PFC' | '电机';
  description: string;
  build: () => PresetPatch;
}

/**
 * 典型拓扑预设 —— 一键装载完整的通道/死区/调制配置，
 * 相当于把常用工程的"起点"固化下来。
 */
export const PRESETS: Preset[] = [
  {
    id: '3P_INV_SVPWM',
    name: '三相两电平逆变 (SVPWM)',
    tag: '逆变',
    description: '20 kHz 载波、50 Hz 输出、SVPWM 马鞍波注入，U/V/W 载波同相、死区 300 ns。',
    build: () => ({
      freqKhz: 20,
      countMode: 'UP_DOWN',
      phaseSystem: '3P',
      subTopology: '3P_3LEG',
      modulationMode: 'SVPWM',
      modIndex: 0.95,
      fundFreqHz: 50,
      threePhaseSyncLock: true,
      channels: ['U 相桥臂 (Phase U)', 'V 相桥臂 (Phase V)', 'W 相桥臂 (Phase W)'].map((name, i) =>
        makeChannel({ id: i + 1, name, duty: 50, phase: 0, redNs: 300, fedNs: 300 }),
      ),
    }),
  },
  {
    id: '3P_RECT_SPWM',
    name: '三相整流 / 有源前端 (SPWM)',
    tag: 'PFC',
    description: '16 kHz 载波、SPWM 正弦调制、M=0.9，适合三相 Vienna / 两电平 AFE 的调制部分。',
    build: () => ({
      freqKhz: 16,
      countMode: 'UP_DOWN',
      phaseSystem: '3P',
      subTopology: '3P_3LEG',
      modulationMode: 'SPWM',
      modIndex: 0.9,
      fundFreqHz: 50,
      threePhaseSyncLock: true,
      channels: ['U 相桥臂 (Phase U)', 'V 相桥臂 (Phase V)', 'W 相桥臂 (Phase W)'].map((name, i) =>
        makeChannel({ id: i + 1, name, duty: 50, phase: 0, redNs: 250, fedNs: 250 }),
      ),
    }),
  },
  {
    id: '3P_INTERLEAVE',
    name: '三相交错并联 (0°/120°/240° 载波移相)',
    tag: 'DC-DC',
    description: '100 kHz、载波互差 120° 的交错 Buck/Boost，用于降低输入电流纹波。',
    build: () => ({
      freqKhz: 100,
      countMode: 'UP_DOWN',
      phaseSystem: '3P',
      subTopology: '3P_INTERLEAVED',
      modulationMode: 'FIXED',
      modIndex: 0.9,
      fundFreqHz: 50,
      threePhaseSyncLock: false,
      channels: [0, 120, 240].map((phase, i) =>
        makeChannel({
          id: i + 1,
          name: `交错相 ${i + 1} (${phase}°)`,
          duty: 50,
          phase,
          redNs: 150,
          fedNs: 150,
        }),
      ),
    }),
  },
  {
    id: '1P_FB_PS',
    name: '单相全桥移相 (PSFB / 移相全桥)',
    tag: 'DC-DC',
    description: '100 kHz、两桥臂互补 50% 占空比，通过 0°/180° 载波移相实现移相控制。',
    build: () => ({
      freqKhz: 100,
      countMode: 'UP_DOWN',
      phaseSystem: '1P',
      subTopology: '1P_FB',
      modulationMode: 'FIXED',
      modIndex: 0.9,
      fundFreqHz: 50,
      threePhaseSyncLock: false,
      channels: [
        makeChannel({ id: 1, name: '超前桥臂 (Leading Leg)', duty: 50, phase: 0, redNs: 200, fedNs: 200 }),
        makeChannel({ id: 2, name: '滞后桥臂 (Lagging Leg)', duty: 50, phase: 180, redNs: 200, fedNs: 200 }),
      ],
    }),
  },
  {
    id: '1P_TOTEM',
    name: '图腾柱无桥 PFC (快慢管异频)',
    tag: 'PFC',
    description: '65 kHz SiC 快管 + 50 Hz 工频慢管，演示独立变频时基与 PHSEN 关闭。',
    build: () => ({
      freqKhz: 65,
      countMode: 'UP_DOWN',
      phaseSystem: '1P',
      subTopology: '1P_TOTEM',
      modulationMode: 'FIXED',
      modIndex: 0.9,
      fundFreqHz: 50,
      threePhaseSyncLock: false,
      channels: [
        makeChannel({ id: 1, name: '高频快管臂 (65 kHz SiC)', duty: 90, redNs: 60, fedNs: 60 }),
        makeChannel({
          id: 2,
          name: '工频慢管臂 (50 Hz)',
          independentFreq: true,
          customFreqKhz: 0.05,
          duty: 50,
          redNs: 2000,
          fedNs: 2000,
        }),
      ],
    }),
  },
  {
    id: 'BUCK_SYNC',
    name: '同步 Buck (500 kHz)',
    tag: 'DC-DC',
    description: '高频同步 Buck，单桥臂 500 kHz，RED/FED 各 60 ns，检验 TBPRD 分辨率与死区吞脉冲。',
    build: () => ({
      freqKhz: 500,
      countMode: 'UP_DOWN',
      phaseSystem: '1P',
      subTopology: '1P_HB',
      modulationMode: 'FIXED',
      modIndex: 0.9,
      fundFreqHz: 50,
      threePhaseSyncLock: false,
      channels: [
        makeChannel({ id: 1, name: '同步 Buck 桥臂', duty: 45, redNs: 60, fedNs: 60, hrpwm: true }),
      ],
    }),
  },
  {
    id: 'LLC_HB',
    name: 'LLC 半桥谐振 (变频)',
    tag: 'DC-DC',
    description: '100 kHz 半桥、固定 50% 占空比，实际运行靠调频改变增益。',
    build: () => ({
      freqKhz: 100,
      countMode: 'UP_DOWN',
      phaseSystem: '1P',
      subTopology: '1P_HB',
      modulationMode: 'FIXED',
      modIndex: 0.9,
      fundFreqHz: 50,
      threePhaseSyncLock: false,
      channels: [makeChannel({ id: 1, name: 'LLC 半桥', duty: 50, redNs: 250, fedNs: 250 })],
    }),
  },
  {
    id: '3P_4LEG',
    name: '三相四桥臂 (含 N 相中线)',
    tag: '逆变',
    description: '带中线桥臂的三相四桥臂逆变器，可输出零序分量补偿不平衡负载。',
    build: () => ({
      freqKhz: 20,
      countMode: 'UP_DOWN',
      phaseSystem: '3P',
      subTopology: '3P_4LEG',
      modulationMode: 'SVPWM',
      modIndex: 0.95,
      fundFreqHz: 50,
      threePhaseSyncLock: true,
      channels: ['U 相桥臂', 'V 相桥臂', 'W 相桥臂', 'N 相中线桥臂'].map((name, i) =>
        makeChannel({ id: i + 1, name, duty: 50, phase: 0, redNs: 300, fedNs: 300 }),
      ),
    }),
  },
];

export function findPreset(id: string): Preset | undefined {
  return PRESETS.find(p => p.id === id);
}
