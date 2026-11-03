import { describe, expect, it } from 'vitest';
import {
  PRESETS,
  codegenRegistry,
  countIssues,
  createDefaultProject,
  deviceRegistry,
  generateCode,
  generateSingleFile,
  getTarget,
  resolveHardware,
  sanitizeProject,
  topologyRegistry,
  validateProject,
  validationRegistry,
} from './index';

/**
 * 内核入口测试。
 *
 * 这些用例刻意只 import './index'（即 dist-engine 的源码入口），
 * 用来证明「内核可以完全脱离 React / DOM 工作」—— CLI、CI、VSCode 扩展
 * 依赖的正是这条路径。
 */
describe('内核可脱离 UI 独立运行', () => {
  it('从默认工程一路跑到代码生成', () => {
    const project = createDefaultProject();
    const hw = resolveHardware(project);
    const issues = validateProject(project, hw);
    const files = generateCode(project, hw);

    expect(hw.device.id).toBe('F280039C');
    expect(hw.master.tb.tbprd).toBe(3000);
    expect(countIssues(issues).error).toBe(0);
    expect(files.map(f => f.name)).toEqual(['main.c', 'epwm_config.c', 'epwm_config.h']);
  });

  it('切换代码目标会走注册表而不是 if/else', () => {
    const base = createDefaultProject();
    const pick = (target: 'BITFIELD' | 'DRIVERLIB') =>
      generateCode({ ...base, codeTarget: target }, resolveHardware(base)).find(
        f => f.name === 'epwm_config.c',
      )?.content ?? '';

    expect(pick('BITFIELD')).toContain('EPwm1Regs.TBCTL');
    expect(pick('DRIVERLIB')).toContain('EPWM_setTimeBasePeriod');
    expect(pick('DRIVERLIB')).not.toContain('EPwm1Regs.TBCTL');

    const md = generateCode({ ...base, codeTarget: 'MARKDOWN' }, resolveHardware(base));
    expect(md).toHaveLength(1);
    expect(md[0].name).toBe('epwm_config.md');
    expect(md[0].language).toBe('md');
    expect(md[0].content).toContain('# ePWM 配置表');
    expect(md[0].content).toContain('| TBPRD | 3000 |');
  });

  it('未注册的目标会给出明确错误', () => {
    expect(() => getTarget('NOPE' as never)).toThrow(/未注册 id "NOPE"/);
  });

  it('合并单文件导出对 Markdown 目标同样成立', () => {
    const project = { ...createDefaultProject(), codeTarget: 'MARKDOWN' as const };
    const text = generateSingleFile(project, resolveHardware(project));
    expect(text).toContain('/* ======================== epwm_config.md ======================== */');
  });
});

describe('扩展点都已装配', () => {
  it('器件 / 拓扑 / 代码目标 / 校验规则 注册表非空', () => {
    expect(deviceRegistry.size).toBe(4);
    expect(topologyRegistry.size).toBe(6);
    expect(codegenRegistry.size).toBe(3);
    expect(validationRegistry.size).toBeGreaterThanOrEqual(15);
    expect(PRESETS.length).toBeGreaterThanOrEqual(8);
  });

  it('每个器件都能解析出硬件模型', () => {
    for (const device of deviceRegistry.list()) {
      const project = sanitizeProject({ ...createDefaultProject(), deviceId: device.id });
      expect(project.deviceId).toBe(device.id);
      const hw = resolveHardware(project);
      expect(hw.device.id).toBe(device.id);
      expect(hw.master.tb.tbprd).toBeGreaterThan(0);
    }
  });

  it('每个拓扑都能构建出合法通道', () => {
    const base = createDefaultProject();
    for (const topology of topologyRegistry.list()) {
      const channels = topology.build(base);
      expect(channels.length).toBeGreaterThan(0);
      channels.forEach((ch, i) => expect(ch.id).toBe(i + 1));
    }
  });
});
