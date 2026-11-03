import type { CountMode, PhaseSystem, ModulationMode } from '../types';

export interface ModInstant {
  /** 归一化参考电压 -1 ~ 1 */
  vu: number;
  vv: number;
  vw: number;
  /** SVPWM 注入的零序分量 */
  vOffset: number;
  /** 三相瞬时占空比 % */
  du: number;
  dv: number;
  dw: number;
  /** 参考波被限幅（过调制） */
  saturated: boolean;
}

/** 保留 1% 的最小脉宽余量，避免生成 0/100% 的死波形 */
const DUTY_MIN = 1;
const DUTY_MAX = 99;

function toDuty(v: number): number {
  const d = 50 + 50 * v;
  return Math.round(Math.max(DUTY_MIN, Math.min(DUTY_MAX, d)) * 10) / 10;
}

export function clampDuty(v: number): number {
  return Math.max(DUTY_MIN, Math.min(DUTY_MAX, Math.round(v * 10) / 10));
}

/**
 * 计算指定电角度下的瞬时参考电压与占空比。
 * - 1P：单相，V 相互补（双极性/单极性倍频桥臂）
 * - 3P + SPWM：纯正弦，最大线性调制比 1.0
 * - 3P + SVPWM：注入零序分量 (vmax+vmin)/2 的负值，得到马鞍波，
 *   母线电压利用率提升 2/√3 ≈ 15.47%，线性区可达 M = 1.1547
 */
export function computeModulationInstant(
  mode: ModulationMode,
  phaseSystem: PhaseSystem,
  modIndex: number,
  thetaDeg: number,
): ModInstant {
  const rad = (thetaDeg * Math.PI) / 180;
  const m = Math.max(0, modIndex);

  if (phaseSystem === '1P') {
    const vu = m * Math.sin(rad);
    const vv = -vu;
    const sat = Math.abs(vu) > 1;
    return {
      vu,
      vv,
      vw: 0,
      vOffset: 0,
      du: toDuty(vu),
      dv: toDuty(vv),
      dw: 50,
      saturated: sat,
    };
  }

  const vuRaw = m * Math.sin(rad);
  const vvRaw = m * Math.sin(rad - (2 * Math.PI) / 3);
  const vwRaw = m * Math.sin(rad + (2 * Math.PI) / 3);

  let vOffset = 0;
  if (mode === 'SVPWM') {
    const vMax = Math.max(vuRaw, vvRaw, vwRaw);
    const vMin = Math.min(vuRaw, vvRaw, vwRaw);
    vOffset = -0.5 * (vMax + vMin);
  }

  const vu = vuRaw + vOffset;
  const vv = vvRaw + vOffset;
  const vw = vwRaw + vOffset;

  const limit = mode === 'SVPWM' ? 2 / Math.sqrt(3) : 1;
  return {
    vu,
    vv,
    vw,
    vOffset,
    du: toDuty(vu),
    dv: toDuty(vv),
    dw: toDuty(vw),
    saturated: m > limit + 1e-6,
  };
}

/**
 * 该调制方式下的理论最大线性调制比。
 * SPWM: 1.0；SVPWM: 2/√3 ≈ 1.1547。
 */
export function maxLinearModIndex(mode: ModulationMode): number {
  return mode === 'SVPWM' ? 2 / Math.sqrt(3) : 1;
}

/**
 * 中断频率与每个基波周期的采样点数（用于评估 ISR 负载与调制精度）。
 */
export function modulationSamplingInfo(
  fswKhz: number,
  fundFreqHz: number,
  _countMode?: CountMode,
): { isrHz: number; samplesPerCycle: number; stepRad: number } {
  const fsw = fswKhz * 1e3;
  // 增减计数：CTR_ZERO 每周期一次；同时 CMPA 在上下行各更新一次视配置而定。
  const isrHz = fsw;
  const fund = Math.max(0.01, fundFreqHz);
  const samplesPerCycle = Math.round(isrHz / fund);
  return { isrHz, samplesPerCycle, stepRad: (2 * Math.PI * fund) / isrHz };
}
