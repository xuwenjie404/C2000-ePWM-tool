import { DB_IN_MODES, DEADBAND_MODES, type DeadBandInMode, type DeadBandMode } from '../data/deadband';
import { DEVICES, getMuxOption } from '../data/devices';
import type {
  ChannelConfig,
  ChannelWaveform,
  DeviceModel,
  PinOption,
  ProjectState,
  TimeBaseSolution,
} from '../types';
import { computeTimeBase, computePhase, dutyToCompare, nsToTicks, type PhaseCalculation } from './timebase';
import { simulateWaveform } from './waveform';

export interface HrpwmInfo {
  requested: boolean;
  supported: boolean;
  /** 每个 TBCLK 周期内可用的 MEP 步进数 */
  mepStepsPerTick: number;
  /** 用于补偿的 MEP 步进数 0..255 */
  mepSteps: number;
  /** 写进 CMPAHR 的原始值 */
  cmpahr: number;
  /** 等效占空比时间分辨率 ps */
  lsbPs: number;
}

export interface ResolvedChannel {
  cfg: ChannelConfig;
  /** 该通道实际目标频率 */
  targetFreqKhz: number;
  tb: TimeBaseSolution;
  cmpA: number;
  cmpB: number;
  phase: PhaseCalculation;
  syncEnabled: boolean;
  dbRed: number;
  dbFed: number;
  /** 未钳位的理想死区计数（用于溢出诊断） */
  rawDbRed: number;
  rawDbFed: number;
  wave: ChannelWaveform;
  mode: DeadBandMode;
  inMode: DeadBandInMode;
  muxA?: PinOption;
  muxB?: PinOption;
  hrpwm: HrpwmInfo;
}

export interface HardwareModel {
  device: DeviceModel;
  channels: ResolvedChannel[];
  master: ResolvedChannel;
}

function resolveHrpwm(
  device: DeviceModel,
  cfg: ChannelConfig,
  idealCmpa: number,
  stepNs: number,
): HrpwmInfo {
  const mepStepsPerTick = Math.max(1, (stepNs * 1000) / device.mepStepPs);
  const fracRaw = idealCmpa - Math.floor(idealCmpa);
  const mepSteps = Math.max(0, Math.min(255, Math.round(fracRaw * 255)));
  return {
    requested: cfg.hrpwm,
    supported: device.hasHRPWM,
    mepStepsPerTick,
    mepSteps,
    // Type-0/Type-4 均在 CMPAHR 高字节携带 Q8 小数补偿
    cmpahr: mepSteps << 8,
    lsbPs: device.mepStepPs,
  };
}

/**
 * 把工程配置解析成完整的硬件模型：每个通道的寄存器值与波形仿真结果。
 */
export function resolveHardware(project: ProjectState): HardwareModel {
  const device = DEVICES[project.deviceId] ?? DEVICES.F280039C;
  const masterTb = computeTimeBase(device.tbclkMHz, project.freqKhz, project.countMode);

  const resolved: ResolvedChannel[] = project.channels.map((cfg, idx) => {
    const isMaster = idx === 0;
    const targetFreqKhz = !isMaster && cfg.independentFreq ? cfg.customFreqKhz : project.freqKhz;
    const tb = isMaster
      ? masterTb
      : computeTimeBase(device.tbclkMHz, targetFreqKhz, project.countMode);

    const mode = DEADBAND_MODES[cfg.mode] ?? DEADBAND_MODES.AHC;
    const inMode = DB_IN_MODES[cfg.inMode] ?? DB_IN_MODES.DBA_ALL;

    const span = project.countMode === 'UP_DOWN' ? tb.tbprd : tb.tbprd + 1;
    const idealCmpa = (Math.max(0, Math.min(100, cfg.duty)) / 100) * span;
    const cmpA = dutyToCompare(cfg.duty, tb, project.countMode);
    const cmpB = dutyToCompare(cfg.dutyB, tb, project.countMode);

    const syncEnabled = !isMaster && !cfg.independentFreq;
    const phase = syncEnabled
      ? computePhase(cfg.phase, tb, project.countMode)
      : { tbphs: 0, phsDir: 'DOWN' as const, actualPhaseDeg: 0, delayNs: 0, limited: false };

    const rawDbRed = mode.bypass ? 0 : cfg.redNs / tb.stepNs;
    const rawDbFed = mode.bypass ? 0 : cfg.fedNs / tb.stepNs;
    const dbRed = mode.bypass ? 0 : nsToTicks(cfg.redNs, tb.stepNs, device.dbMaxCount);
    const dbFed = mode.bypass ? 0 : nsToTicks(cfg.fedNs, tb.stepNs, device.dbMaxCount);

    const wave = simulateWaveform({
      countMode: project.countMode,
      tbprd: tb.tbprd,
      cmpA,
      cmpB,
      dbRed,
      dbFed,
      mode,
      inMode,
      stepNs: tb.stepNs,
    });

    return {
      cfg,
      targetFreqKhz,
      tb,
      cmpA,
      cmpB,
      phase,
      syncEnabled,
      dbRed,
      dbFed,
      rawDbRed,
      rawDbFed,
      wave,
      mode,
      inMode,
      muxA: getMuxOption(device, `ePWM${cfg.id}A`, cfg.muxIdxA),
      muxB: getMuxOption(device, `ePWM${cfg.id}B`, cfg.muxIdxB),
      hrpwm: resolveHrpwm(device, cfg, idealCmpa, tb.stepNs),
    };
  });

  return {
    device,
    channels: resolved,
    master: resolved[0],
  };
}

export interface PinAssignment {
  pin: number;
  gpio: string;
  signal: string;
  channelId: number;
  sub: 'A' | 'B';
}

/**
 * 汇总所有已启用通道占用的物理引脚，并给出冲突信息。
 * 同时返回「备选但仍可用」的引脚，供引脚图点击切换。
 */
export function resolvePins(hw: HardwareModel): {
  active: Map<number, PinAssignment>;
  alternates: Map<number, PinAssignment>;
  conflicts: { pin: number; signals: string[] }[];
} {
  const active = new Map<number, PinAssignment>();
  const alternates = new Map<number, PinAssignment>();
  const byPin = new Map<number, string[]>();

  for (const ch of hw.channels) {
    if (!ch.cfg.enabled) continue;
    (['A', 'B'] as const).forEach(sub => {
      const signal = `ePWM${ch.cfg.id}${sub}`;
      const opts = hw.device.muxOptions[signal] ?? [];
      const selIdx = sub === 'A' ? ch.cfg.muxIdxA : ch.cfg.muxIdxB;
      opts.forEach((opt, idx) => {
        if (idx === selIdx) {
          active.set(opt.pin, {
            pin: opt.pin,
            gpio: opt.gpio,
            signal,
            channelId: ch.cfg.id,
            sub,
          });
          const list = byPin.get(opt.pin) ?? [];
          list.push(`${signal}(${opt.gpio})`);
          byPin.set(opt.pin, list);
        } else if (!alternates.has(opt.pin)) {
          alternates.set(opt.pin, {
            pin: opt.pin,
            gpio: opt.gpio,
            signal,
            channelId: ch.cfg.id,
            sub,
          });
        }
      });
    });
  }

  const conflicts = [...byPin.entries()]
    .filter(([, signals]) => signals.length > 1)
    .map(([pin, signals]) => ({ pin, signals }));

  return { active, alternates, conflicts };
}
