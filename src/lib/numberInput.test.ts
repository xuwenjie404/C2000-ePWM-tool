import { describe, expect, it } from 'vitest';
import { clampToStep, isOutOfRange, parseNumericInput } from './numberInput';

describe('parseNumericInput', () => {
  it('正常数字按原值通过', () => {
    expect(parseNumericInput('300', 0, 5000, 10)).toEqual({ ok: true, value: 300 });
  });

  it('按 step 吸附到最近的档位', () => {
    expect(parseNumericInput('123', 0, 5000, 10)).toEqual({ ok: true, value: 120 });
    expect(parseNumericInput('127', 0, 5000, 10)).toEqual({ ok: true, value: 130 });
  });

  it('低于下限时夹到下限，高于上限时夹到上限', () => {
    expect(parseNumericInput('-50', 0, 5000, 10)).toEqual({ ok: true, value: 0 });
    expect(parseNumericInput('99999', 0, 5000, 10)).toEqual({ ok: true, value: 5000 });
  });

  it('空串与非法文本被拒绝，而不是静默变成 0', () => {
    expect(parseNumericInput('', 0, 500, 1)).toEqual({ ok: false, reason: 'empty' });
    expect(parseNumericInput('   ', 0, 500, 1)).toEqual({ ok: false, reason: 'empty' });
    expect(parseNumericInput('abc', 0, 500, 1)).toEqual({ ok: false, reason: 'nan' });
    expect(parseNumericInput('1e', 0, 500, 1)).toEqual({ ok: false, reason: 'nan' });
  });

  it('允许前导/尾随空格与科学计数法', () => {
    expect(parseNumericInput(' 20 ', 0.05, 500, 0.05)).toEqual({ ok: true, value: 20 });
    expect(parseNumericInput('1e2', 0.05, 500, 0.05)).toEqual({ ok: true, value: 100 });
  });

  it('小数步长不产生浮点噪声', () => {
    const r = parseNumericInput('0.3', 0, 1, 0.1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(String(r.value)).toBe('0.3');
  });
});

describe('clampToStep', () => {
  it('0.1 步长下的累加误差被消掉', () => {
    // 0.1 * 3 = 0.30000000000000004
    expect(clampToStep(0.1 * 3, 0, 10, 0.1)).toBe(0.3);
  });

  it('step 为 0 时只夹紧不对齐', () => {
    expect(clampToStep(123.456, 0, 200, 0)).toBe(123.456);
  });

  it('非有限值回落到下限，避免把 NaN 写进寄存器', () => {
    expect(clampToStep(Number.NaN, 5, 100, 1)).toBe(5);
    expect(clampToStep(Number.POSITIVE_INFINITY, 5, 100, 1)).toBe(100);
  });

  it('边界值本身保持不变', () => {
    expect(clampToStep(0.5, 0.5, 99.5, 0.1)).toBe(0.5);
    expect(clampToStep(99.5, 0.5, 99.5, 0.1)).toBe(99.5);
  });
});

describe('isOutOfRange（输入过程中的即时提示）', () => {
  it('范围内返回 false，越界/空/非法返回 true', () => {
    expect(isOutOfRange('300', 0, 500)).toBe(false);
    expect(isOutOfRange('500', 0, 500)).toBe(false);
    expect(isOutOfRange('501', 0, 500)).toBe(true);
    expect(isOutOfRange('-1', 0, 500)).toBe(true);
    expect(isOutOfRange('', 0, 500)).toBe(true);
    expect(isOutOfRange('1.2.3', 0, 500)).toBe(true);
  });

  it('负数输入不会被误判（下限为负时）', () => {
    expect(isOutOfRange('-5', -10, 10)).toBe(false);
  });
});
