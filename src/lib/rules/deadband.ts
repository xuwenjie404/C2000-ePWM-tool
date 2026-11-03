import type { DiagnosticIssue } from '../../types';
import type { ValidationRule } from './types';
import { NARROW_PULSE_NS } from './types';

/**
 * 死区相关规则。
 *
 * 这一组是全工具最有价值的部分：死区参数「填得进去」不代表「硬件会照做」。
 * 三类问题都会在这里被拦下：
 *   1. 计数溢出（DBRED/DBFED 超出位宽，被静默钳位）
 *   2. 脉宽被吞（延迟大于可用脉宽，输出恒定，桥臂失去驱动）
 *   3. 剩余脉宽过窄（能出来，但驱动器/采样识别不了）
 */
export const deadbandOverflow: ValidationRule = {
  id: 'deadband.overflow',
  scope: 'deadband',
  run({ hw }) {
    const issues: DiagnosticIssue[] = [];
    const { dbMaxBits, dbMaxCount } = hw.device;

    for (const ch of hw.channels) {
      if (!ch.cfg.enabled || ch.mode.bypass) continue;
      const id = ch.cfg.id;

      if (ch.rawDbRed > dbMaxCount + 0.5) {
        issues.push({
          id: `dbred-overflow-${id}`,
          severity: 'warn',
          title: `ePWM${id} DBRED 溢出`,
          detail: `RED = ${ch.cfg.redNs} ns 需要 ${ch.rawDbRed.toFixed(0)} 个计数，超过 ${dbMaxBits}-bit 上限 ${dbMaxCount}，已钳位为 ${ch.dbRed}（实际 ${(ch.dbRed * ch.tb.stepNs).toFixed(0)} ns）。`,
          channelId: id,
        });
      }
      if (ch.rawDbFed > dbMaxCount + 0.5) {
        issues.push({
          id: `dbfed-overflow-${id}`,
          severity: 'warn',
          title: `ePWM${id} DBFED 溢出`,
          detail: `FED = ${ch.cfg.fedNs} ns 需要 ${ch.rawDbFed.toFixed(0)} 个计数，超过 ${dbMaxBits}-bit 上限 ${dbMaxCount}，已钳位为 ${ch.dbFed}（实际 ${(ch.dbFed * ch.tb.stepNs).toFixed(0)} ns）。`,
          channelId: id,
        });
      }
    }
    return issues;
  },
};

export const deadbandPulseSwallowed: ValidationRule = {
  id: 'deadband.pulse-swallowed',
  scope: 'deadband',
  run({ hw }) {
    const issues: DiagnosticIssue[] = [];
    for (const ch of hw.channels) {
      if (!ch.cfg.enabled || ch.mode.bypass) continue;
      const id = ch.cfg.id;
      const highNs = ch.wave.idealHighTicks * ch.tb.stepNs;
      const lowNs = (ch.wave.periodTicks - ch.wave.idealHighTicks) * ch.tb.stepNs;

      if (ch.wave.swallowedA) {
        issues.push({
          id: `db-swallow-a-${id}`,
          severity: 'error',
          title: `ePWM${id} A 相脉宽被死区吞掉`,
          detail: `原始高电平 ${highNs.toFixed(0)} ns，RED(${(ch.dbRed * ch.tb.stepNs).toFixed(0)} ns) 已不小于原始高电平，死区后 A 相将恒定为低电平 —— 桥臂实际失去驱动。请减小 RED 或提高占空比。`,
          channelId: id,
        });
      }
      if (ch.wave.swallowedB) {
        issues.push({
          id: `db-swallow-b-${id}`,
          severity: 'error',
          title: `ePWM${id} B 相脉宽被死区吞掉`,
          detail: `原始低电平 ${lowNs.toFixed(0)} ns，FED(${(ch.dbFed * ch.tb.stepNs).toFixed(0)} ns) 已不小于原始低电平，死区后 B 相将恒定为低电平。请减小 FED 或降低占空比。`,
          channelId: id,
        });
      }
    }
    return issues;
  },
};

export const deadbandNarrowPulse: ValidationRule = {
  id: 'deadband.narrow-pulse',
  scope: 'deadband',
  run({ hw }) {
    const issues: DiagnosticIssue[] = [];
    for (const ch of hw.channels) {
      if (!ch.cfg.enabled || ch.mode.bypass) continue;
      if (ch.wave.swallowedA) continue;
      const id = ch.cfg.id;
      const remainNs = (ch.wave.idealHighTicks - ch.dbRed + ch.dbFed) * ch.tb.stepNs;
      if (remainNs > 0 && remainNs < NARROW_PULSE_NS) {
        issues.push({
          id: `db-narrow-a-${id}`,
          severity: 'warn',
          title: `ePWM${id} A 相剩余脉宽过窄`,
          detail: `死区后 A 相高电平仅 ${remainNs.toFixed(0)} ns，低于 ${NARROW_PULSE_NS} ns，栅极驱动器与电流采样可能无法识别。`,
          channelId: id,
        });
      }
    }
    return issues;
  },
};

/** 死区对称性：RED/FED 差异过大通常意味着配置笔误 */
export const deadbandAsymmetry: ValidationRule = {
  id: 'deadband.asymmetry',
  scope: 'deadband',
  run({ hw }) {
    const issues: DiagnosticIssue[] = [];
    for (const ch of hw.channels) {
      if (!ch.cfg.enabled || ch.mode.bypass || ch.cfg.lockDb) continue;
      const redNs = ch.dbRed * ch.tb.stepNs;
      const fedNs = ch.dbFed * ch.tb.stepNs;
      const big = Math.max(redNs, fedNs);
      const small = Math.min(redNs, fedNs);
      if (big > 0 && big > small * 4) {
        issues.push({
          id: `db-asymmetry-${ch.cfg.id}`,
          severity: 'info',
          title: `ePWM${ch.cfg.id} 两侧死区差异较大`,
          detail: `RED=${redNs.toFixed(0)} ns，FED=${fedNs.toFixed(0)} ns。不对称死区会给输出电压引入直流偏置；若非有意为之，建议开启「RED = FED 锁定」。`,
          channelId: ch.cfg.id,
        });
      }
    }
    return issues;
  },
};
