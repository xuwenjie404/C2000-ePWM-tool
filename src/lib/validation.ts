import type { DiagnosticIssue, ProjectState } from '../types';
import { resolvePins, type HardwareModel } from './hardware';
import { maxLinearModIndex, modulationSamplingInfo } from './modulation';

/** 低于该值的脉宽视为"驱动无法可靠识别" */
const NARROW_PULSE_NS = 100;

/**
 * 工程完整性校验 —— 把「能生成代码」升级为「生成能跑且不会炸管的代码」。
 * 这里覆盖了时基可达性、死区溢出、死区吞脉冲、引脚冲突、过调制等实际踩过的坑。
 */
export function validateProject(project: ProjectState, hw: HardwareModel): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const { device } = hw;

  if (project.channels.length > device.epwmModules) {
    issues.push({
      id: 'channel-count',
      severity: 'error',
      title: `通道数超出器件能力`,
      detail: `${device.name} 只有 ${device.epwmModules} 个 ePWM 模块，当前配置了 ${project.channels.length} 个通道。`,
    });
  }

  for (const ch of hw.channels) {
    const id = ch.cfg.id;
    const tag = `ePWM${id}`;

    if (!ch.cfg.enabled) continue;

    // 1. 时基可达性
    for (const w of ch.tb.warnings) {
      issues.push({
        id: `tb-${id}`,
        severity: ch.tb.clamped === 'none' ? 'info' : 'error',
        title: `${tag} 时基：` + (ch.tb.clamped === 'none' ? '精度提示' : '目标频率不可达'),
        detail: w,
        channelId: id,
      });
    }

    // 2. 比较值边界
    if (ch.cmpA === 0) {
      issues.push({
        id: `cmpa-zero-${id}`,
        severity: 'warn',
        title: `${tag} 占空比为 0`,
        detail: `CMPA = 0，经动作限定子模块后 ePWMxA 恒定输出低电平（B 相恒定高电平）。`,
        channelId: id,
      });
    } else if (ch.cmpA >= ch.tb.tbprd && project.countMode === 'UP_DOWN') {
      issues.push({
        id: `cmpa-full-${id}`,
        severity: 'warn',
        title: `${tag} 占空比为 100%`,
        detail: `CMPA = TBPRD，ePWMxA 恒定高电平、ePWMxB 恒定低电平，死区不再起作用。`,
        channelId: id,
      });
    }

    // 3. 死区寄存器溢出
    if (!ch.mode.bypass) {
      if (ch.rawDbRed > device.dbMaxCount + 0.5) {
        issues.push({
          id: `dbred-overflow-${id}`,
          severity: 'warn',
          title: `${tag} DBRED 溢出`,
          detail: `RED = ${ch.cfg.redNs} ns 需要 ${ch.rawDbRed.toFixed(0)} 个计数，超过 ${device.dbMaxBits}-bit 上限 ${device.dbMaxCount}，已钳位为 ${ch.dbRed}（实际 ${(ch.dbRed * ch.tb.stepNs).toFixed(0)} ns）。`,
          channelId: id,
        });
      }
      if (ch.rawDbFed > device.dbMaxCount + 0.5) {
        issues.push({
          id: `dbfed-overflow-${id}`,
          severity: 'warn',
          title: `${tag} DBFED 溢出`,
          detail: `FED = ${ch.cfg.fedNs} ns 需要 ${ch.rawDbFed.toFixed(0)} 个计数，超过 ${device.dbMaxBits}-bit 上限 ${device.dbMaxCount}，已钳位为 ${ch.dbFed}（实际 ${(ch.dbFed * ch.tb.stepNs).toFixed(0)} ns）。`,
          channelId: id,
        });
      }

      // 4. 死区吞脉冲：这是最危险的隐性错误
      const highNs = ch.wave.idealHighTicks * ch.tb.stepNs;
      const lowNs = (ch.wave.periodTicks - ch.wave.idealHighTicks) * ch.tb.stepNs;
      if (ch.wave.swallowedA) {
        issues.push({
          id: `db-swallow-a-${id}`,
          severity: 'error',
          title: `${tag} A 相脉宽被死区吞掉`,
          detail: `原始高电平 ${highNs.toFixed(0)} ns，RED(${(ch.dbRed * ch.tb.stepNs).toFixed(0)} ns) 大于「高电平 + FED」，死区后 A 相将恒定为低电平 —— 桥臂实际失去驱动。请减小 RED 或提高占空比。`,
          channelId: id,
        });
      }
      if (ch.wave.swallowedB) {
        issues.push({
          id: `db-swallow-b-${id}`,
          severity: 'error',
          title: `${tag} B 相脉宽被死区吞掉`,
          detail: `原始低电平 ${lowNs.toFixed(0)} ns，FED(${(ch.dbFed * ch.tb.stepNs).toFixed(0)} ns) 大于「低电平 + RED」，死区后 B 相将恒定为低电平。请减小 FED 或降低占空比。`,
          channelId: id,
        });
      }
      if (!ch.wave.swallowedA) {
        const remainNs = (ch.wave.idealHighTicks - ch.dbRed + ch.dbFed) * ch.tb.stepNs;
        if (remainNs > 0 && remainNs < NARROW_PULSE_NS) {
          issues.push({
            id: `db-narrow-a-${id}`,
            severity: 'warn',
            title: `${tag} A 相剩余脉宽过窄`,
            detail: `死区后 A 相高电平仅 ${remainNs.toFixed(0)} ns，低于 ${NARROW_PULSE_NS} ns，栅极驱动器与电流采样可能无法识别。`,
            channelId: id,
          });
        }
      }
    }

    // 5. 移相
    if (ch.syncEnabled && ch.phase.limited && ch.cfg.phase > 0) {
      issues.push({
        id: `phase-up-${id}`,
        severity: 'info',
        title: `${tag} 单向计数下的移相`,
        detail: `单向递增计数无法实现 180°以上的对称移相，当前 TBPHS=${ch.phase.tbphs} 对应延迟 ${ch.phase.delayNs.toFixed(0)} ns（折合 ${ch.phase.actualPhaseDeg.toFixed(1)}°）。三相 120° 互差建议改用增减计数。`,
        channelId: id,
      });
    }

    // 6. HRPWM
    if (ch.hrpwm.requested && !ch.hrpwm.supported) {
      issues.push({
        id: `hrpwm-${id}`,
        severity: 'error',
        title: `${tag} 不支持 HRPWM`,
        detail: `${device.name} 未集成高分辨率 PWM 子模块，请关闭该通道的 HRPWM。`,
        channelId: id,
      });
    }

    // 7. 占空比分辨率
    if (ch.cmpA > 0 && ch.cmpA < ch.tb.tbprd && ch.tb.tbprd < 100) {
      const quantErr = Math.abs(ch.tb.stepNs * 100) / ch.tb.periodNs * 100;
      issues.push({
        id: `resolution-${id}`,
        severity: 'info',
        title: `${tag} 占空比量化误差约 ${quantErr.toFixed(2)}%`,
        detail: `TBPRD=${ch.tb.tbprd}，一个 TBCLK 对应 ${ch.tb.stepNs.toFixed(2)} ns。开启 HRPWM 可把时间分辨率提升到 ${device.mepStepPs} ps。`,
        channelId: id,
      });
    }
  }

  // 8. 交错拓扑应设置载波移相
  if (project.subTopology === '3P_INTERLEAVED' && hw.channels.length >= 3) {
    const phases = hw.channels.slice(0, 3).map(c => c.cfg.phase);
    if (phases.every(p => p === 0)) {
      issues.push({
        id: 'interleave-phase-zero',
        severity: 'warn',
        title: '交错并联拓扑的载波移相角全为 0°',
        detail:
          '交错并联靠载波互差 120°（或 180°）来抵消电流纹波。当前三相载波同相，等同于并联同步运行，交错收益为零。',
      });
    }
  }

  if (project.phaseSystem === '3P' && project.countMode === 'UP') {
    issues.push({
      id: 'up-mode-3p',
      severity: 'warn',
      title: '三相系统使用了单向计数',
      detail:
        '单向递增计数（CTRMODE = TB_COUNT_UP）下 PHSDIR 无效，三相 120° 互差只能靠 TBPHS 延时实现，且会引入一个 TBCLK 的固有偏差。建议三相应用切换到增减计数。',
    });
  }

  if (project.phaseSystem === '1P' && project.modulationMode === 'SVPWM') {
    issues.push({
      id: 'svpwm-1p',
      severity: 'info',
      title: '单相系统选择了 SVPWM',
      detail: '空间矢量调制针对三相三桥臂定义，单相场景请使用 SPWM 或固定占空比。',
    });
  }

  // 9. 过调制
  const limit = maxLinearModIndex(project.modulationMode);
  if (project.modulationMode !== 'FIXED' && project.modIndex > limit + 1e-6) {
    issues.push({
      id: 'overmodulation',
      severity: 'warn',
      title: `调制比 M=${project.modIndex.toFixed(2)} 超出线性区`,
      detail: `${project.modulationMode} 的线性调制上限为 ${limit.toFixed(4)}，超出后进入过调制，输出波形畸变、低次谐波迅速上升。`,
    });
  }

  // 10. 调制采样率
  if (project.modulationMode !== 'FIXED') {
    const info = modulationSamplingInfo(project.freqKhz, project.fundFreqHz, project.countMode);
    if (info.samplesPerCycle < 24) {
      issues.push({
        id: 'sampling-low',
        severity: 'warn',
        title: `每基波周期仅 ${info.samplesPerCycle} 个采样点`,
        detail: `ISR 频率 ${(info.isrHz / 1e3).toFixed(1)} kHz / 基波 ${project.fundFreqHz} Hz。采样点过少会导致输出波形阶梯化、THD 明显恶化，建议提高开关频率或降低输出频率。`,
      });
    }
  }

  // 11. 引脚冲突
  const pins = resolvePins(hw);
  for (const c of pins.conflicts) {
    issues.push({
      id: `pin-conflict-${c.pin}`,
      severity: 'error',
      title: `引脚 #${c.pin} 复用冲突`,
      detail: `${c.signals.join(' 与 ')} 同时占用同一个物理引脚。请在引脚图中点击备选引脚切换，或关闭其中一个通道。`,
    });
  }

  // 12. Trip-Zone
  if (project.tripZone.enabled && project.tripZone.sources.length === 0) {
    issues.push({
      id: 'tz-no-source',
      severity: 'warn',
      title: 'Trip-Zone 已使能但未选择触发源',
      detail: 'TZSEL 未选择任何 TZ1~TZ6 输入或 DCAEVT，保护不会生效。',
    });
  }
  if (!project.tripZone.enabled) {
    issues.push({
      id: 'tz-disabled',
      severity: 'info',
      title: 'Trip-Zone 保护未启用',
      detail:
        '量产固件建议至少配置一个 OST 单次跳闸源（如过流比较器），否则一旦发生直通故障只能靠硬件保险丝。可在「保护与触发」面板中开启。',
    });
  }

  if (project.countMode === 'UP_DOWN' && project.channels.length > 0) {
    const m = hw.master;
    if (m.tb.periodTicks > 60000) {
      issues.push({
        id: 'low-fsw',
        severity: 'info',
        title: `开关周期 ${(m.tb.periodNs / 1000).toFixed(1)} µs 接近计数上限`,
        detail: `TBPRD=${m.tb.tbprd} 已接近 65535，继续降低频率需要增大 CLKDIV/HSPCLKDIV。`,
      });
    }
  }

  const order: Record<DiagnosticIssue['severity'], number> = { error: 0, warn: 1, info: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
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
