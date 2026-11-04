import { describe, expect, it } from 'vitest';
import { createDefaultProject, sanitizeProject } from '../project';
import { resolveHardware } from '../hardware';
import { produceRuntimeApi } from './runtimeCode';

function api(project = createDefaultProject()) {
  const hw = resolveHardware(project);
  const files = produceRuntimeApi(project, hw);
  return {
    hw,
    files,
    header: files.find(f => f.name === 'epwm_api.h')?.content ?? '',
    source: files.find(f => f.name === 'epwm_api.c')?.content ?? '',
  };
}

describe('运行时 API 产物结构', () => {
  it('返回 epwm_api.c 与 epwm_api.h', () => {
    expect(api().files.map(f => f.name)).toEqual(['epwm_api.c', 'epwm_api.h']);
  });

  it('头文件导出物理量接口，而不是寄存器接口', () => {
    const { header } = api();
    expect(header).toContain('void  EPWM_setFrequency(unsigned int ch, float fswKhz);');
    expect(header).toContain('void  EPWM_setDuty(unsigned int ch, float dutyPct);');
    expect(header).toContain('void  EPWM_setPhase(unsigned int ch, float phaseDeg);');
    expect(header).toContain('EPWM_actualFswKhz');
    // 不应该把 TBPRD/CMPA 直接暴露给下游
    expect(header).not.toContain('EPWM_setTbprd');
    expect(header).not.toContain('EPWM_setCmpa');
  });

  it('常量来自当前工程：通道数 / TBCLK / 计数模式', () => {
    const { header } = api();
    expect(header).toContain('#define EPWM_API_CH_COUNT    3U');
    expect(header).toContain('#define EPWM_API_TBCLK_HZ    120000000f');
    expect(header).toContain('#define EPWM_API_UP_DOWN     1U');
  });

  it('单向计数工程的宏会切成 0', () => {
    const p = sanitizeProject({ ...createDefaultProject(), countMode: 'UP' });
    expect(api(p).header).toContain('#define EPWM_API_UP_DOWN     0U');
  });

  it('初始参数表带上了工程里的频率/占空比/相位/TBPRD', () => {
    const { source } = api();
    expect(source).toContain('{ 20.0000f, 50.00f, 0.0f, 3000U, 0U }  /* ePWM1 */');
    // 从通道默认跟随主频、可移相
    expect(source).toContain('{ 20.0000f, 50.00f, 0.0f, 3000U, 1U }  /* ePWM2 */');
  });

  it('寄存器访问按代码风格生成', () => {
    const bitfield = api().source;
    expect(bitfield).toContain('#include "F28x_Project.h"');
    expect(bitfield).toContain('EPwm1Regs.TBPRD = (uint16_t)v;');
    expect(bitfield).toContain('EPwm1Regs.CMPA.bit.CMPA = (uint16_t)v;');

    const p = sanitizeProject({ ...createDefaultProject(), codeTarget: 'DRIVERLIB' });
    const lib = api(p).source;
    expect(lib).toContain('#include "driverlib.h"');
    expect(lib).toContain('EPWM_setTimeBasePeriod(EPWM1_BASE, (uint16_t)v);');
    expect(lib).toContain('EPWM_setCounterCompareValue(EPWM1_BASE, EPWM_COUNTER_COMPARE_A, (uint16_t)v);');
  });
});

describe('运行时 API 的换算实现', () => {
  it('改频率时同时重算 CMPA 与 TBPHS（否则占空比/相角会漂移）', () => {
    const { source } = api();
    const body = source.slice(source.indexOf('void EPWM_setFrequency'));
    const end = body.indexOf('void EPWM_setDuty');
    const fn = body.slice(0, end);

    expect(fn).toContain('EPWM_apiWriteTbprd');
    expect(fn).toContain('EPWM_apiWriteCmpa');
    expect(fn).toContain('EPWM_apiCmpaFromDuty(p->dutyPct, tbprd)');
    expect(fn).toContain('EPWM_apiWriteTbphs');
    expect(fn).toContain('EPWM_apiWritePhsdir');
  });

  it('CMPA 夹紧到 [1, TBPRD-1]，不会写出 0 或满幅', () => {
    const { source } = api();
    expect(source).toContain('if (c < 1.0f)                    { c = 1.0f; }');
    expect(source).toContain('if (c > (float)(tbprd - 1U))     { c = (float)(tbprd - 1U); }');
  });

  it('占空比上下限与工具保持一致（0.5% ~ 99.5%）', () => {
    const { header, source } = api();
    expect(header).toContain('#define EPWM_API_DUTY_MIN    0.5f');
    expect(header).toContain('#define EPWM_API_DUTY_MAX    99.5f');
    expect(source).toContain('EPWM_API_DUTY_MIN');
    expect(source).toContain('EPWM_API_DUTY_MAX');
  });

  it('相位在 180° 处切换 PHSDIR', () => {
    const { source } = api();
    expect(source).toContain('if (d <= 180.0f)');
    expect(source).toContain('*phsdirUp = 1U;');
  });

  it('非同步通道忽略相位设置', () => {
    const { source } = api();
    expect(source).toContain('if (p->syncEn == 0U) { return; }');
  });

  it('频率范围宏覆盖 TBCLK 与分频', () => {
    const { header } = api();
    expect(header).toContain('EPWM_API_FSW_MIN_KHZ');
    expect(header).toContain('EPWM_API_FSW_MAX_KHZ');
    // 120 MHz / 2 / 1 = 60 MHz = 60000 kHz
    expect(header).toContain('60000.00f');
  });
});
