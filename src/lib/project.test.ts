import { describe, expect, it } from 'vitest';
import legacyV0 from '../../examples/legacy-v0.epwm.json';
import {
  MAX_CHANNELS,
  SCHEMA_VERSION,
  createDefaultProject,
  decodeProjectFromHash,
  encodeProjectToHash,
  migrateProject,
  sanitizeProject,
} from './project';
import { resolveHardware } from './hardware';
import { freqRangeKhz } from './limits';

describe('版本迁移', () => {
  it('v0 工程（原始单文件工具导出）能升级到当前版本', () => {
    const migrated = migrateProject(legacyV0);
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.deviceId).toBe('F28379D');
    expect(migrated.selectedDspId).toBeUndefined();
    expect(migrated.version).toBeUndefined();
  });

  it('迁移后的 v0 工程可以直接求解出硬件模型', () => {
    const project = sanitizeProject(legacyV0);
    expect(project.deviceId).toBe('F28379D');
    expect(project.channels).toHaveLength(3);
    // v0 没有 hrpwm 字段，应补默认值而不是 undefined
    expect(project.channels[0].hrpwm).toBe(false);
    expect(project.codeTarget).toBe('BITFIELD');

    const hw = resolveHardware(project);
    // 200 MHz / 2 = 100 MHz TBCLK，100 kHz 增减计数 -> TBPRD = 500
    expect(hw.master.tb.tbprd).toBe(500);
    expect(hw.master.tb.actualFswKhz).toBeCloseTo(100, 6);
  });

  it('codeStyle 老字段会被识别为 codeTarget', () => {
    const legacy = { ...createDefaultProject(), codeStyle: 'DRIVERLIB' } as Record<string, unknown>;
    delete legacy.codeTarget; // 模拟只有旧字段的历史文件
    expect(sanitizeProject(legacy).codeTarget).toBe('DRIVERLIB');
  });

  it('未知版本号不会崩溃，只是回到默认值', () => {
    const project = sanitizeProject({ schemaVersion: 999, freqKhz: 50 });
    expect(project.schemaVersion).toBe(SCHEMA_VERSION);
    expect(project.freqKhz).toBe(50);
  });

  it('完全非法的输入退化成默认工程', () => {
    expect(sanitizeProject(null).deviceId).toBe(createDefaultProject().deviceId);
    expect(sanitizeProject('not an object').channels).toHaveLength(3);
  });
});

describe('分享链接编解码', () => {
  it('编码后可以还原出等价工程', () => {
    const project = sanitizeProject(legacyV0);
    const payload = encodeProjectToHash(project);
    expect(payload).not.toMatch(/[+/=]/);

    const restored = decodeProjectFromHash(payload);
    expect(restored).not.toBeNull();
    expect(restored?.deviceId).toBe(project.deviceId);
    expect(restored?.channels.map(c => c.duty)).toEqual(project.channels.map(c => c.duty));
  });

  it('损坏的 payload 返回 null 而不是抛错', () => {
    expect(decodeProjectFromHash('%%%not-base64%%%')).toBeNull();
  });
});

describe('边界钳位', () => {
  it('通道数量上限与 UI 上限一致', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }));
    expect(sanitizeProject({ channels: many }).channels).toHaveLength(MAX_CHANNELS);
  });

  it('占空比 / 移相 / 死区都被钳到合法区间', () => {
    const project = sanitizeProject({
      channels: [{ id: 1, duty: 250, phase: 999, redNs: -100, customFreqKhz: 9999 }],
    });
    const ch = project.channels[0];
    expect(ch.duty).toBeLessThanOrEqual(99.5);
    expect(ch.phase).toBe(0);
    expect(ch.redNs).toBe(0);
    // 频率上限由器件 TBCLK 推出（120 MHz 增减计数约 3 MHz），不再是写死的 500
    expect(ch.customFreqKhz).toBe(freqRangeKhz(120, 'UP_DOWN').maxKhz);
  });
});
