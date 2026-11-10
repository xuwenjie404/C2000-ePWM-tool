import { afterEach, describe, expect, it } from 'vitest';
import type { DiagnosticIssue } from '../../types';
import { createDefaultProject, sanitizeProject } from '../project';
import { resolveHardware } from '../hardware';
import { countIssues, validateProject, validationRegistry } from './index';
import type { ValidationRule } from './types';

/**
 * 规则扩展点测试：证明「第三方规则」不需要改核心文件即可生效。
 * 这正是平台化与「一个写死的校验函数」的区别。
 */
describe('校验规则插件', () => {
  const added: string[] = [];

  afterEach(() => {
    added.splice(0).forEach(id => validationRegistry.unregister(id));
  });

  it('在运行时注册的规则会被执行', () => {
    const rule: ValidationRule = {
      id: 'test.custom-rule',
      scope: 'system',
      run: () => [
        {
          id: 'custom-hit',
          severity: 'info',
          title: '自定义规则命中',
          detail: '由测试动态注册。',
        },
      ],
    };
    validationRegistry.register(rule);
    added.push(rule.id);

    const project = createDefaultProject();
    const issues = validateProject(project, resolveHardware(project));
    expect(issues.some(i => i.id === 'custom-hit')).toBe(true);
  });

  it('规则抛异常时不会中断整体校验，会转成一条 error', () => {
    const rule: ValidationRule = {
      id: 'test.throwing-rule',
      scope: 'system',
      run: (): DiagnosticIssue[] => {
        throw new Error('boom');
      },
    };
    validationRegistry.register(rule);
    added.push(rule.id);

    const project = createDefaultProject();
    const issues = validateProject(project, resolveHardware(project));
    const crash = issues.find(i => i.id === 'rule-crash-test.throwing-rule');
    expect(crash?.severity).toBe('error');
    expect(crash?.detail).toContain('boom');
    // 其它规则仍然执行
    expect(issues.some(i => i.id === 'tz-disabled')).toBe(true);
  });

  it('注册后立即对后续调用生效，移除后失效', () => {
    const rule: ValidationRule = {
      id: 'test.toggle-rule',
      scope: 'system',
      run: () => [{ id: 'toggle-hit', severity: 'warn', title: 't', detail: 'd' }],
    };
    validationRegistry.register(rule);
    added.push(rule.id);

    const project = createDefaultProject();
    const hw = resolveHardware(project);
    expect(validateProject(project, hw).some(i => i.id === 'toggle-hit')).toBe(true);

    validationRegistry.unregister(rule.id);
    added.pop();
    expect(validateProject(project, hw).some(i => i.id === 'toggle-hit')).toBe(false);
  });
});

describe('双语诊断', () => {
  it('英文模式下所有 title / detail 都不含中文', () => {
    const project = sanitizeProject({
      ...createDefaultProject(),
      freqKhz: 400,
      channels: [
        { id: 1, duty: 3, redNs: 900, fedNs: 100, mode: 'AHC' },
        { id: 2, duty: 50 },
        { id: 3, duty: 50 },
      ],
    });
    const hw = resolveHardware(project);
    const zh = validateProject(project, hw, 'zh');
    const en = validateProject(project, hw, 'en');

    expect(zh.length).toBeGreaterThan(0);
    expect(en).toHaveLength(zh.length);
    // 中文版必须含中文，英文版必须不含
    const cjk = /[\u4e00-\u9fa5]/;
    expect(zh.some(i => cjk.test(i.title + i.detail))).toBe(true);
    for (const issue of en) {
      expect(cjk.test(issue.title)).toBe(false);
      expect(cjk.test(issue.detail)).toBe(false);
    }
  });

  it('时基告警本身携带中英两段（由 computeTimeBase 产生）', () => {
    const project = sanitizeProject({ ...createDefaultProject(), freqKhz: 99999 });
    const hw = resolveHardware(project);
    const warnings = hw.master.tb.warnings;
    expect(warnings.length).toBeGreaterThan(0);
    for (const w of warnings) {
      expect(w.zh.length).toBeGreaterThan(0);
      expect(w.en.length).toBeGreaterThan(0);
      expect(w.zh).not.toBe(w.en);
    }
  });

  it('两种语言的 issue id 与严重级完全一致（只是文案不同）', () => {
    const project = createDefaultProject();
    const hw = resolveHardware(project);
    const zh = validateProject(project, hw, 'zh');
    const en = validateProject(project, hw, 'en');
    expect(en.map(i => i.id).sort()).toEqual(zh.map(i => i.id).sort());
    expect(en.map(i => i.severity).sort()).toEqual(zh.map(i => i.severity).sort());
  });
});

describe('规则产出的严重级排序', () => {
  it('error 永远排在 warn 与 info 之前', () => {
    const project = sanitizeProject({
      ...createDefaultProject(),
      freqKhz: 400,
      channels: [
        { id: 1, duty: 3, redNs: 900, fedNs: 100, mode: 'AHC' },
        { id: 2, duty: 50 },
        { id: 3, duty: 50 },
      ],
    });
    const issues = validateProject(project, resolveHardware(project));
    const ranks = issues.map(i => (i.severity === 'error' ? 0 : i.severity === 'warn' ? 1 : 2));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(countIssues(issues).error).toBeGreaterThan(0);
  });
});
