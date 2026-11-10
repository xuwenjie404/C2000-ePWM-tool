import type { DiagnosticIssue } from '../../types';
import { createRegistry } from '../../platform/registry';
import { resolvePins } from '../hardware';
import type { ProjectState } from '../../types';
import type { HardwareModel } from '../hardware';
import { deadbandAsymmetry, deadbandNarrowPulse, deadbandOverflow, deadbandPulseSwallowed } from './deadband';
import { channelCompareRange, channelHrpwmSupport, channelIndependentTimebase, channelPhaseLimitation } from './channel';
import {
  systemChannelCount,
  systemInterleavePhase,
  systemOvermodulation,
  systemPinConflict,
  systemSamplingRate,
  systemSvpwmSinglePhase,
  systemThreePhaseUpCount,
  systemTripZone,
} from './system';
import { timebaseLowFrequency, timebaseReachability, timebaseResolution } from './timebase';
import type { RuleContext, ValidationRule } from './types';

/**
 * 校验规则注册表。
 *
 * 新增一条规则 = 写一个 ValidationRule + 在这里 register 一次，
 * 不需要改动 validateProject()，也不需要动 UI。
 * 第三方扩展可以直接 import 该注册表并追加自己的规则。
 */
export const validationRegistry = createRegistry<ValidationRule>('validation-rule');

validationRegistry
  .register(timebaseReachability)
  .register(timebaseResolution)
  .register(timebaseLowFrequency)
  .register(deadbandOverflow)
  .register(deadbandPulseSwallowed)
  .register(deadbandNarrowPulse)
  .register(deadbandAsymmetry)
  .register(channelCompareRange)
  .register(channelPhaseLimitation)
  .register(channelHrpwmSupport)
  .register(channelIndependentTimebase)
  .register(systemChannelCount)
  .register(systemInterleavePhase)
  .register(systemThreePhaseUpCount)
  .register(systemSvpwmSinglePhase)
  .register(systemOvermodulation)
  .register(systemSamplingRate)
  .register(systemPinConflict)
  .register(systemTripZone);

const SEVERITY_ORDER: Record<DiagnosticIssue['severity'], number> = { error: 0, warn: 1, info: 2 };

/**
 * 运行全部规则，并按严重程度排序。
 * `lang` 决定诊断文案的语言（默认中文，与 UI 默认语言一致）。
 */
export function validateProject(
  project: ProjectState,
  hw: HardwareModel,
  lang: 'zh' | 'en' = 'zh',
): DiagnosticIssue[] {
  const ctx: RuleContext = {
    project,
    hw,
    pins: resolvePins(hw),
    t: (zh, en) => (lang === 'zh' ? zh : en),
  };
  const issues: DiagnosticIssue[] = [];
  for (const rule of validationRegistry.list()) {
    try {
      issues.push(...rule.run(ctx));
    } catch (error) {
      // 单条规则崩溃不应该让整个设计器白屏 —— 平台韧性的一部分
      issues.push({
        id: `rule-crash-${rule.id}`,
        severity: 'error',
        title: ctx.t(`校验规则 ${rule.id} 执行失败`, `Validation rule ${rule.id} failed`),
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export function countIssues(issues: DiagnosticIssue[]): {
  error: number;
  warn: number;
  info: number;
} {
  return issues.reduce(
    (acc, i) => {
      acc[i.severity] += 1;
      return acc;
    },
    { error: 0, warn: 0, info: 0 },
  );
}

export type { ValidationRule, RuleContext } from './types';
export { NARROW_PULSE_NS } from './types';
