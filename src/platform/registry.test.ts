import { describe, expect, it } from 'vitest';
import { createRegistry } from './registry';

interface Plugin {
  id: string;
  label: string;
}

describe('Registry', () => {
  it('注册后可取回，并保持注册顺序', () => {
    const reg = createRegistry<Plugin>('demo');
    reg.register({ id: 'a', label: 'A' }).register({ id: 'b', label: 'B' });

    expect(reg.has('a')).toBe(true);
    expect(reg.get('b')?.label).toBe('B');
    expect(reg.list().map(p => p.id)).toEqual(['a', 'b']);
    expect(reg.size).toBe(2);
  });

  it('重复 id 默认抛错，避免扩展互相覆盖', () => {
    const reg = createRegistry<Plugin>('demo');
    reg.register({ id: 'a', label: 'A' });
    expect(() => reg.register({ id: 'a', label: 'A2' })).toThrow(/已存在/);
  });

  it('显式 override 时才允许替换', () => {
    const reg = createRegistry<Plugin>('demo');
    reg.register({ id: 'a', label: 'A' });
    reg.register({ id: 'a', label: 'A2' }, { override: true });
    expect(reg.get('a')?.label).toBe('A2');
    expect(reg.size).toBe(1);
  });

  it('缺少 id 时立刻失败', () => {
    const reg = createRegistry<Plugin>('demo');
    expect(() => reg.register({ id: '', label: 'x' })).toThrow(/缺少合法的 id/);
  });

  it('require 在缺失时给出可读错误', () => {
    const reg = createRegistry<Plugin>('device');
    reg.register({ id: 'only', label: 'Only' });
    expect(() => reg.require('missing')).toThrow(/\[device\].*missing.*only/);
  });

  it('unregister 可用于测试替身与用户自定义覆盖', () => {
    const reg = createRegistry<Plugin>('demo');
    reg.register({ id: 'a', label: 'A' });
    expect(reg.unregister('a')).toBe(true);
    expect(reg.has('a')).toBe(false);
    expect(reg.unregister('a')).toBe(false);
  });
});
