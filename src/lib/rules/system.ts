import type { DiagnosticIssue } from '../../types';
import { maxLinearModIndex, modulationSamplingInfo } from '../modulation';
import type { ValidationRule } from './types';

/** 系统级规则：拓扑一致性、引脚冲突、调制能力边界、保护配置 */

export const systemChannelCount: ValidationRule = {
  id: 'system.channel-count',
  scope: 'system',
  run({ project, hw }) {
    if (project.channels.length <= hw.device.epwmModules) return [];
    return [
      {
        id: 'channel-count',
        severity: 'error',
        title: '通道数超出器件能力',
        detail: `${hw.device.name} 只有 ${hw.device.epwmModules} 个 ePWM 模块，当前配置了 ${project.channels.length} 个通道。`,
      },
    ];
  },
};

export const systemInterleavePhase: ValidationRule = {
  id: 'system.interleave-phase',
  scope: 'system',
  run({ project, hw }) {
    if (project.subTopology !== '3P_INTERLEAVED' || hw.channels.length < 3) return [];
    const phases = hw.channels.slice(0, 3).map(c => c.cfg.phase);
    if (!phases.every(p => p === 0)) return [];
    return [
      {
        id: 'interleave-phase-zero',
        severity: 'warn',
        title: '交错并联拓扑的载波移相角全为 0°',
        detail:
          '交错并联靠载波互差 120°（或 180°）来抵消电流纹波。当前三相载波同相，等同于并联同步运行，交错收益为零。',
      },
    ];
  },
};

export const systemThreePhaseUpCount: ValidationRule = {
  id: 'system.three-phase-up-count',
  scope: 'system',
  run({ project }) {
    if (project.phaseSystem !== '3P' || project.countMode !== 'UP') return [];
    return [
      {
        id: 'up-mode-3p',
        severity: 'warn',
        title: '三相系统使用了单向计数',
        detail:
          '单向递增计数（CTRMODE = TB_COUNT_UP）下 PHSDIR 无效，三相 120° 互差只能靠 TBPHS 延时实现，且会引入一个 TBCLK 的固有偏差。建议三相应用切换到增减计数。',
      },
    ];
  },
};

export const systemSvpwmSinglePhase: ValidationRule = {
  id: 'system.svpwm-single-phase',
  scope: 'system',
  run({ project }) {
    if (project.phaseSystem !== '1P' || project.modulationMode !== 'SVPWM') return [];
    return [
      {
        id: 'svpwm-1p',
        severity: 'info',
        title: '单相系统选择了 SVPWM',
        detail: '空间矢量调制针对三相三桥臂定义，单相场景请使用 SPWM 或固定占空比。',
      },
    ];
  },
};

export const systemOvermodulation: ValidationRule = {
  id: 'system.overmodulation',
  scope: 'system',
  run({ project }) {
    if (project.modulationMode === 'FIXED') return [];
    const limit = maxLinearModIndex(project.modulationMode);
    if (project.modIndex <= limit + 1e-6) return [];
    return [
      {
        id: 'overmodulation',
        severity: 'warn',
        title: `调制比 M=${project.modIndex.toFixed(2)} 超出线性区`,
        detail: `${project.modulationMode} 的线性调制上限为 ${limit.toFixed(4)}，超出后进入过调制，输出波形畸变、低次谐波迅速上升。`,
      },
    ];
  },
};

export const systemSamplingRate: ValidationRule = {
  id: 'system.sampling-rate',
  scope: 'system',
  run({ project }) {
    if (project.modulationMode === 'FIXED') return [];
    const info = modulationSamplingInfo(project.freqKhz, project.fundFreqHz, project.countMode);
    if (info.samplesPerCycle >= 24) return [];
    return [
      {
        id: 'sampling-low',
        severity: 'warn',
        title: `每基波周期仅 ${info.samplesPerCycle} 个采样点`,
        detail: `ISR 频率 ${(info.isrHz / 1e3).toFixed(1)} kHz / 基波 ${project.fundFreqHz} Hz。采样点过少会导致输出波形阶梯化、THD 明显恶化，建议提高开关频率或降低输出频率。`,
      },
    ];
  },
};

export const systemPinConflict: ValidationRule = {
  id: 'system.pin-conflict',
  scope: 'system',
  run({ pins }) {
    return pins.conflicts.map<DiagnosticIssue>(conflict => ({
      id: `pin-conflict-${conflict.pin}`,
      severity: 'error',
      title: `引脚 #${conflict.pin} 复用冲突`,
      detail: `${conflict.signals.join(' 与 ')} 同时占用同一个物理引脚。请在引脚图中点击备选引脚切换，或关闭其中一个通道。`,
    }));
  },
};

export const systemTripZone: ValidationRule = {
  id: 'system.trip-zone',
  scope: 'system',
  run({ project }) {
    const issues: DiagnosticIssue[] = [];
    const tz = project.tripZone;

    if (!tz.enabled) {
      issues.push({
        id: 'tz-disabled',
        severity: 'info',
        title: 'Trip-Zone 保护未启用',
        detail:
          '量产固件建议至少配置一个 OST 单次跳闸源（如过流比较器），否则一旦发生直通故障只能靠硬件保险丝。可在「保护与触发」面板中开启。',
      });
      return issues;
    }

    if (tz.sources.length === 0) {
      issues.push({
        id: 'tz-no-source',
        severity: 'warn',
        title: 'Trip-Zone 已使能但未选择触发源',
        detail: 'TZSEL 未选择任何 TZ1~TZ6 输入或 DCAEVT，保护不会生效。',
      });
    }
    if (tz.action === 'OST' && tz.outA === 'DO_NOTHING' && tz.outB === 'DO_NOTHING') {
      issues.push({
        id: 'tz-no-action',
        severity: 'warn',
        title: 'Trip-Zone 触发后两路输出都不动作',
        detail: 'TZCTL 的 TZA/TZB 均为「不动作」，跳闸只会置位标志位，功率管不会关断。',
      });
    }
    return issues;
  },
};
