import type { DiagnosticIssue } from '../../types';
import type { ValidationRule } from './types';

/**
 * 时基相关规则：目标频率是否可达、分辨率是否够用。
 *
 * 这些问题的共同点是「参数看起来合法，但离硬件能力边界很近」，
 * 早期发现可以避免调试时误以为是控制环问题。
 */
export const timebaseReachability: ValidationRule = {
  id: 'timebase.reachability',
  scope: 'timebase',
  run({ hw }) {
    const issues: DiagnosticIssue[] = [];
    for (const ch of hw.channels) {
      if (!ch.cfg.enabled) continue;
      for (const warning of ch.tb.warnings) {
        issues.push({
          id: `tb-${ch.cfg.id}`,
          severity: ch.tb.clamped === 'none' ? 'info' : 'error',
          title: `ePWM${ch.cfg.id} 时基：${ch.tb.clamped === 'none' ? '精度提示' : '目标频率不可达'}`,
          detail: warning,
          channelId: ch.cfg.id,
        });
      }
    }
    return issues;
  },
};

export const timebaseResolution: ValidationRule = {
  id: 'timebase.resolution',
  scope: 'timebase',
  run({ hw }) {
    const issues: DiagnosticIssue[] = [];
    for (const ch of hw.channels) {
      if (!ch.cfg.enabled) continue;
      const tb = ch.tb;
      // TBPRD 太小时占空比量化误差显著，提示开启 HRPWM
      if (ch.cmpA > 0 && ch.cmpA < tb.tbprd && tb.tbprd < 100) {
        const quantErr = (Math.abs(tb.stepNs * 100) / tb.periodNs) * 100;
        issues.push({
          id: `resolution-${ch.cfg.id}`,
          severity: 'info',
          title: `ePWM${ch.cfg.id} 占空比量化误差约 ${quantErr.toFixed(2)}%`,
          detail: `TBPRD=${tb.tbprd}，一个 TBCLK 对应 ${tb.stepNs.toFixed(2)} ns。开启 HRPWM 可把时间分辨率提升到 MEP 级别。`,
          channelId: ch.cfg.id,
        });
      }
    }
    return issues;
  },
};

export const timebaseLowFrequency: ValidationRule = {
  id: 'timebase.low-frequency',
  scope: 'timebase',
  run({ hw }) {
    const master = hw.master;
    if (!master) return [];
    if (master.tb.periodTicks > 60000) {
      return [
        {
          id: 'low-fsw',
          severity: 'info',
          title: `开关周期 ${(master.tb.periodNs / 1000).toFixed(1)} µs 接近计数上限`,
          detail: `TBPRD=${master.tb.tbprd} 已接近 65535，继续降低频率需要增大 CLKDIV/HSPCLKDIV。`,
        },
      ];
    }
    return [];
  },
};
