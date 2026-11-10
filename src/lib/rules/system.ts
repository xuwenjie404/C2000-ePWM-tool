import type { DiagnosticIssue } from '../../types';
import { maxLinearModIndex, modulationSamplingInfo } from '../modulation';
import type { ValidationRule } from './types';

/** 系统级规则：拓扑一致性、引脚冲突、调制能力边界、保护配置 */

export const systemChannelCount: ValidationRule = {
  id: 'system.channel-count',
  scope: 'system',
  run({ project, hw, t }) {
    if (project.channels.length <= hw.device.epwmModules) return [];
    return [
      {
        id: 'channel-count',
        severity: 'error',
        title: t('通道数超出器件能力', 'Channel count exceeds device capability'),
        detail: t(
          `${hw.device.name} 只有 ${hw.device.epwmModules} 个 ePWM 模块，当前配置了 ${project.channels.length} 个通道。`,
          `${hw.device.name} has only ${hw.device.epwmModules} ePWM modules, but ${project.channels.length} channels are configured.`,
        ),
      },
    ];
  },
};

export const systemInterleavePhase: ValidationRule = {
  id: 'system.interleave-phase',
  scope: 'system',
  run({ project, hw, t }) {
    if (project.subTopology !== '3P_INTERLEAVED' || hw.channels.length < 3) return [];
    const phases = hw.channels.slice(0, 3).map(c => c.cfg.phase);
    if (!phases.every(p => p === 0)) return [];
    return [
      {
        id: 'interleave-phase-zero',
        severity: 'warn',
        title: t(
          '交错并联拓扑的载波移相角全为 0°',
          'Carrier phase shift is 0° for every leg in the interleaved topology',
        ),
        detail: t(
          '交错并联靠载波互差 120°（或 180°）来抵消电流纹波。当前三相载波同相，等同于并联同步运行，交错收益为零。',
          'Interleaving cancels current ripple by offsetting carriers by 120° (or 180°). All three carriers are in phase now, so this is just synchronized parallel operation and interleaving brings no benefit.',
        ),
      },
    ];
  },
};

export const systemThreePhaseUpCount: ValidationRule = {
  id: 'system.three-phase-up-count',
  scope: 'system',
  run({ project, t }) {
    if (project.phaseSystem !== '3P' || project.countMode !== 'UP') return [];
    return [
      {
        id: 'up-mode-3p',
        severity: 'warn',
        title: t('三相系统使用了单向计数', 'Three-phase system uses up-count'),
        detail: t(
          '单向递增计数（CTRMODE = TB_COUNT_UP）下 PHSDIR 无效，三相 120° 互差只能靠 TBPHS 延时实现，且会引入一个 TBCLK 的固有偏差。建议三相应用切换到增减计数。',
          'In up-count (CTRMODE = TB_COUNT_UP), PHSDIR has no effect; 120° three-phase spacing relies on TBPHS delays and adds a one-TBCLK offset. Switch three-phase designs to up-down count.',
        ),
      },
    ];
  },
};

export const systemSvpwmSinglePhase: ValidationRule = {
  id: 'system.svpwm-single-phase',
  scope: 'system',
  run({ project, t }) {
    if (project.phaseSystem !== '1P' || project.modulationMode !== 'SVPWM') return [];
    return [
      {
        id: 'svpwm-1p',
        severity: 'info',
        title: t('单相系统选择了 SVPWM', 'SVPWM selected for a single-phase system'),
        detail: t(
          '空间矢量调制针对三相三桥臂定义，单相场景请使用 SPWM 或固定占空比。',
          'Space-vector modulation is defined for three-phase, three-leg inverters; use SPWM or a fixed duty cycle for single-phase.',
        ),
      },
    ];
  },
};

export const systemOvermodulation: ValidationRule = {
  id: 'system.overmodulation',
  scope: 'system',
  run({ project, t }) {
    if (project.modulationMode === 'FIXED') return [];
    const limit = maxLinearModIndex(project.modulationMode);
    if (project.modIndex <= limit + 1e-6) return [];
    return [
      {
        id: 'overmodulation',
        severity: 'warn',
        title: t(
          `调制比 M=${project.modIndex.toFixed(2)} 超出线性区`,
          `Modulation index M=${project.modIndex.toFixed(2)} exceeds the linear range`,
        ),
        detail: t(
          `${project.modulationMode} 的线性调制上限为 ${limit.toFixed(4)}，超出后进入过调制，输出波形畸变、低次谐波迅速上升。`,
          `The linear modulation limit for ${project.modulationMode} is ${limit.toFixed(4)}; beyond it the inverter enters over-modulation, with distorted output and rapidly rising low-order harmonics.`,
        ),
      },
    ];
  },
};

export const systemSamplingRate: ValidationRule = {
  id: 'system.sampling-rate',
  scope: 'system',
  run({ project, t }) {
    if (project.modulationMode === 'FIXED') return [];
    const info = modulationSamplingInfo(project.freqKhz, project.fundFreqHz, project.countMode);
    if (info.samplesPerCycle >= 24) return [];
    return [
      {
        id: 'sampling-low',
        severity: 'warn',
        title: t(
          `每基波周期仅 ${info.samplesPerCycle} 个采样点`,
          `Only ${info.samplesPerCycle} samples per fundamental cycle`,
        ),
        detail: t(
          `ISR 频率 ${(info.isrHz / 1e3).toFixed(1)} kHz / 基波 ${project.fundFreqHz} Hz。采样点过少会导致输出波形阶梯化、THD 明显恶化，建议提高开关频率或降低输出频率。`,
          `ISR rate ${(info.isrHz / 1e3).toFixed(1)} kHz / fundamental ${project.fundFreqHz} Hz. Too few samples per cycle makes the output steppy and clearly worsens THD; raise the switching frequency or lower the output frequency.`,
        ),
      },
    ];
  },
};

export const systemPinConflict: ValidationRule = {
  id: 'system.pin-conflict',
  scope: 'system',
  run({ pins, t }) {
    return pins.conflicts.map<DiagnosticIssue>(conflict => ({
      id: `pin-conflict-${conflict.pin}`,
      severity: 'error',
      title: t(`引脚 #${conflict.pin} 复用冲突`, `Pin #${conflict.pin} pin-mux conflict`),
      detail: t(
        `${conflict.signals.join(' 与 ')} 同时占用同一个物理引脚。请在引脚图中点击备选引脚切换，或关闭其中一个通道。`,
        `${conflict.signals.join(' and ')} share the same physical pin. Pick an alternative pin in the pin map to switch, or disable one of the channels.`,
      ),
    }));
  },
};

export const systemTripZone: ValidationRule = {
  id: 'system.trip-zone',
  scope: 'system',
  run({ project, t }) {
    const issues: DiagnosticIssue[] = [];
    const tz = project.tripZone;

    if (!tz.enabled) {
      issues.push({
        id: 'tz-disabled',
        severity: 'info',
        title: t('Trip-Zone 保护未启用', 'Trip-Zone protection is not enabled'),
        detail: t(
          '量产固件建议至少配置一个 OST 单次跳闸源（如过流比较器），否则一旦发生直通故障只能靠硬件保险丝。可在「保护与触发」面板中开启。',
          'Production firmware should configure at least one OST one-shot trip source (e.g. an over-current comparator); otherwise a shoot-through fault is left to a hardware fuse. Enable it in the "Protection & Trip" panel.',
        ),
      });
      return issues;
    }

    if (tz.sources.length === 0) {
      issues.push({
        id: 'tz-no-source',
        severity: 'warn',
        title: t('Trip-Zone 已使能但未选择触发源', 'Trip-Zone enabled but no trip source selected'),
        detail: t(
          'TZSEL 未选择任何 TZ1~TZ6 输入或 DCAEVT，保护不会生效。',
          'TZSEL selects no TZ1~TZ6 input or DCAEVT, so protection will never act.',
        ),
      });
    }
    if (tz.action === 'OST' && tz.outA === 'DO_NOTHING' && tz.outB === 'DO_NOTHING') {
      issues.push({
        id: 'tz-no-action',
        severity: 'warn',
        title: t(
          'Trip-Zone 触发后两路输出都不动作',
          'Neither output acts when Trip-Zone trips',
        ),
        detail: t(
          'TZCTL 的 TZA/TZB 均为「不动作」，跳闸只会置位标志位，功率管不会关断。',
          'TZCTL has both TZA and TZB set to "do nothing", so a trip only sets the flag and the power switches stay on.',
        ),
      });
    }
    return issues;
  },
};
