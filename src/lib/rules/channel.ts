import type { DiagnosticIssue } from '../../types';
import type { ValidationRule } from './types';

/** 单通道取值范围与能力约束 */
export const channelCompareRange: ValidationRule = {
  id: 'channel.compare-range',
  scope: 'channel',
  run({ hw, project, t }) {
    const issues: DiagnosticIssue[] = [];
    for (const ch of hw.channels) {
      if (!ch.cfg.enabled) continue;
      const id = ch.cfg.id;

      if (ch.cmpA === 0) {
        issues.push({
          id: `cmpa-zero-${id}`,
          severity: 'warn',
          title: t(`ePWM${id} 占空比为 0`, `ePWM${id} duty cycle is 0`),
          detail: t(
            'CMPA = 0，经动作限定子模块后 ePWMxA 恒定输出低电平（B 相恒定高电平）。',
            'CMPA = 0, so after the action-qualifier ePWMxA stays low (phase B stays high).',
          ),
          channelId: id,
        });
      } else if (ch.cmpA >= ch.tb.tbprd && project.countMode === 'UP_DOWN') {
        issues.push({
          id: `cmpa-full-${id}`,
          severity: 'warn',
          title: t(`ePWM${id} 占空比为 100%`, `ePWM${id} duty cycle is 100%`),
          detail: t(
            'CMPA = TBPRD，ePWMxA 恒定高电平、ePWMxB 恒定低电平，死区不再起作用。',
            'CMPA = TBPRD, so ePWMxA stays high and ePWMxB stays low; the dead-band no longer takes effect.',
          ),
          channelId: id,
        });
      }
    }
    return issues;
  },
};

export const channelPhaseLimitation: ValidationRule = {
  id: 'channel.phase-limitation',
  scope: 'channel',
  run({ hw, t }) {
    const issues: DiagnosticIssue[] = [];
    for (const ch of hw.channels) {
      if (!ch.cfg.enabled || !ch.syncEnabled || !ch.phase.limited) continue;
      if (ch.cfg.phase <= 0) continue;
      issues.push({
        id: `phase-up-${ch.cfg.id}`,
        severity: 'info',
        title: t(`ePWM${ch.cfg.id} 单向计数下的移相`, `ePWM${ch.cfg.id} phase shift under up-count`),
        detail: t(
          `单向递增计数无法实现 180° 以上的对称移相，当前 TBPHS=${ch.phase.tbphs} 对应延迟 ${ch.phase.delayNs.toFixed(0)} ns（折合 ${ch.phase.actualPhaseDeg.toFixed(1)}°）。三相 120° 互差建议改用增减计数。`,
          `Up-count cannot produce a symmetric phase shift beyond 180°; TBPHS=${ch.phase.tbphs} gives a ${ch.phase.delayNs.toFixed(0)} ns delay (= ${ch.phase.actualPhaseDeg.toFixed(1)}°). For 120° three-phase spacing, use up-down count.`,
        ),
        channelId: ch.cfg.id,
      });
    }
    return issues;
  },
};

export const channelHrpwmSupport: ValidationRule = {
  id: 'channel.hrpwm-support',
  scope: 'channel',
  run({ hw, t }) {
    const issues: DiagnosticIssue[] = [];
    for (const ch of hw.channels) {
      if (!ch.cfg.enabled) continue;
      if (ch.hrpwm.requested && !ch.hrpwm.supported) {
        issues.push({
          id: `hrpwm-${ch.cfg.id}`,
          severity: 'error',
          title: t(`ePWM${ch.cfg.id} 不支持 HRPWM`, `ePWM${ch.cfg.id} does not support HRPWM`),
          detail: t(
            `${hw.device.name} 未集成高分辨率 PWM 子模块，请关闭该通道的 HRPWM。`,
            `${hw.device.name} has no high-resolution PWM submodule; turn HRPWM off for this channel.`,
          ),
          channelId: ch.cfg.id,
        });
      }
    }
    return issues;
  },
};

/** 独立变频通道：TBPRD 与主时基差异过大时的提示 */
export const channelIndependentTimebase: ValidationRule = {
  id: 'channel.independent-timebase',
  scope: 'channel',
  run({ hw, t }) {
    const issues: DiagnosticIssue[] = [];
    for (const ch of hw.channels) {
      if (!ch.cfg.enabled || !ch.cfg.independentFreq) continue;
      const ratio = ch.tb.periodNs / hw.master.tb.periodNs;
      if (ratio > 50) {
        issues.push({
          id: `indep-freq-${ch.cfg.id}`,
          severity: 'info',
          title: t(
            `ePWM${ch.cfg.id} 与主时基相差 ${ratio.toFixed(0)} 倍`,
            `ePWM${ch.cfg.id} period is ${ratio.toFixed(0)}x the main time base`,
          ),
          detail: t(
            `通道频率 ${ch.targetFreqKhz} kHz，主时基 ${hw.master.tb.actualFswKhz.toFixed(3)} kHz。独立变频下 PHSEN 自动关闭，此通道不再与主模块同步。`,
            `Channel frequency ${ch.targetFreqKhz} kHz vs. main time base ${hw.master.tb.actualFswKhz.toFixed(3)} kHz. With independent frequency, PHSEN clears and this channel no longer syncs to the master.`,
          ),
          channelId: ch.cfg.id,
        });
      }
    }
    return issues;
  },
};
