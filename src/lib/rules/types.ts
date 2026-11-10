import type { DiagnosticIssue, ProjectState } from '../../types';
import type { HardwareModel } from '../hardware';
import type { resolvePins } from '../hardware';

/** 规则运行时上下文：一次求解、多处复用，避免每条规则重复算硬件模型 */
export interface RuleContext {
  project: ProjectState;
  hw: HardwareModel;
  pins: ReturnType<typeof resolvePins>;
  /**
   * 文案选择器：`t('中文', 'English')`。
   * 诊断信息在规则里就完成本地化，UI 直接渲染 title/detail，
   * 不需要再维护一张「issue id → 翻译」的映射表。
   */
  t: (zh: string, en: string) => string;
}

/**
 * 一条校验规则。
 *
 * 平台约定：
 *  - `id` 稳定且唯一，仅用于日志/测试定位，不要放进 UI 文案；
 *  - 规则只做判断，不修改入参；
 *  - 返回空数组表示通过。
 */
export interface ValidationRule {
  id: string;
  /** 规则覆盖的范围，仅用于文档与调试分组 */
  scope: 'timebase' | 'deadband' | 'channel' | 'system';
  run(ctx: RuleContext): DiagnosticIssue[];
}

/** 低于该值的脉宽视为「驱动无法可靠识别」 */
export const NARROW_PULSE_NS = 100;
