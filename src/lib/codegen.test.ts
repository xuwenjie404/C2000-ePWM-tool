import { describe, expect, it } from 'vitest';
import { createDefaultProject, sanitizeProject } from './project';
import { resolveHardware } from './hardware';
import { generateCode, generateSingleFile } from './targets';

const project = createDefaultProject();

function files(p = project) {
  const hw = resolveHardware(p);
  return generateCode(p, hw);
}

function file(name: string, p = project): string {
  return files(p).find(f => f.name === name)?.content ?? '';
}

describe('生成物结构', () => {
  it('输出 main.c / epwm_config.c / epwm_config.h 三个文件', () => {
    expect(files().map(f => f.name)).toEqual(['main.c', 'epwm_config.c', 'epwm_config.h']);
  });

  it('头文件包含每个启用通道的原型', () => {
    const h = file('epwm_config.h');
    expect(h).toContain('void EPWM_initCh1(void);');
    expect(h).toContain('void EPWM_initCh3(void);');
    expect(h).toContain('__interrupt void epwm1_isr(void);');
  });

  it('相同输入产生完全相同的输出（可复现）', () => {
    expect(file('epwm_config.c')).toBe(file('epwm_config.c'));
  });
});

describe('时基与比较值', () => {
  it('默认工程写入 TBPRD=3000（20 kHz @ 120 MHz 增减计数）', () => {
    expect(file('epwm_config.c')).toContain('EPwm1Regs.TBPRD = 3000U;');
  });

  it('主模块发出同步脉冲，从模块接收', () => {
    const c = file('epwm_config.c');
    expect(c).toContain('EPwm1Regs.TBCTL.bit.SYNCOSEL = TB_CTR_ZERO;');
    expect(c).toContain('EPwm2Regs.TBCTL.bit.SYNCOSEL = TB_SYNC_IN;');
    expect(c).toContain('EPwm2Regs.TBCTL.bit.PHSEN = TB_ENABLE;');
  });

  it('TBCLKSYNC 在配置前后成对出现', () => {
    const m = file('main.c');
    const off = m.indexOf('CpuSysRegs.PCLKCR0.bit.TBCLKSYNC = 0');
    const on = m.indexOf('CpuSysRegs.PCLKCR0.bit.TBCLKSYNC = 1');
    expect(off).toBeGreaterThan(-1);
    expect(on).toBeGreaterThan(off);
  });
});

describe('动作限定子模块', () => {
  it('增减计数使用 CAU=CLEAR / CAD=SET', () => {
    const c = file('epwm_config.c');
    expect(c).toContain('AQCTLA.bit.CAU = AQ_CLEAR;');
    expect(c).toContain('AQCTLA.bit.CAD = AQ_SET;');
  });

  it('单向计数改用 ZRO=SET / CAU=CLEAR（原实现会输出错误波形）', () => {
    const p = sanitizeProject({ ...project, countMode: 'UP' });
    const c = file('epwm_config.c', p);
    expect(c).toContain('AQCTLA.bit.ZRO = AQ_SET;');
    expect(c).toContain('AQCTLA.bit.CAU = AQ_CLEAR;');
    expect(c).toContain('AQCTLA.bit.CAD = AQ_NO_ACTION;');
  });
});

describe('死区', () => {
  it('AHC 写入 DB_ACTV_HIC 与 14-bit 计数', () => {
    const c = file('epwm_config.c');
    expect(c).toContain('EPwm1Regs.DBCTL.bit.POLSEL   = DB_ACTV_HIC;');
    expect(c).toContain('EPwm1Regs.DBCTL.bit.OUT_MODE = DB_FULL_ENABLE;');
    expect(c).toMatch(/EPwm1Regs\.DBRED\.bit\.DBRED = \d+U;/);
  });

  it('BYPASS 关闭死区并补充 AQCTLB 配置', () => {
    const p = sanitizeProject({
      ...project,
      channels: [{ id: 1, mode: 'BYPASS', duty: 30, dutyB: 70 }],
    });
    const c = file('epwm_config.c', p);
    expect(c).toContain('EPwm1Regs.DBCTL.bit.OUT_MODE = DB_DISABLE;');
    expect(c).toContain('EPwm1Regs.AQCTLB.bit.CAU = AQ_CLEAR;');
    expect(c).toMatch(/EPwm1Regs\.CMPB\.bit\.CMPB = \d+U;/);
  });
});

describe('Trip-Zone 与 ADC 触发', () => {
  it('开启 OST 保护后写入 TZSEL/TZCTL', () => {
    const p = sanitizeProject({
      ...project,
      tripZone: { enabled: true, sources: ['TZ1', 'TZ2'], action: 'OST', outA: 'FORCE_LOW', outB: 'HI_Z', interrupt: true },
    });
    const c = file('epwm_config.c', p);
    expect(c).toContain('TZSEL.bit.OSHT1 = 1;');
    expect(c).toContain('TZSEL.bit.OSHT2 = 1;');
    expect(c).toContain('TZCTL.bit.TZA = TZ_FORCE_LO;');
    expect(c).toContain('TZCTL.bit.TZB = TZ_HIZ;');
  });

  it('ADC 触发源映射正确', () => {
    expect(file('epwm_config.c')).toContain('ETSEL.bit.SOCASEL = ET_CTR_ZERO;');
  });
});

describe('DriverLib 风格', () => {
  const p = sanitizeProject({ ...project, codeTarget: 'DRIVERLIB' });
  const c = file('epwm_config.c', p);

  it('使用 EPWM_* API 而不是寄存器结构体', () => {
    expect(c).toContain('EPWM_setTimeBasePeriod(EPWM1_BASE, 3000U);');
    expect(c).toContain('EPWM_setActionQualifierAction(');
    expect(c).not.toContain('EPwm1Regs.TBPRD');
  });

  it('DBCTL 用精确的位组合写入，避免猜测不存在的封装 API', () => {
    // DBCTL: IN_MODE[1:0]=0 | POLSEL[3:2]=AHC(2) | OUT_MODE[5:4]=FULL(3) => 0x0038
    expect(c).toContain('HWREGH(EPWM1_BASE + EPWM_O_DBCTL) = 0x0038U;');
  });

  it('main.c 使用 DriverLib 初始化序列', () => {
    const m = file('main.c', p);
    expect(m).toContain('Device_init();');
    expect(m).toContain('Interrupt_register(INT_EPWM1, &epwm1_isr);');
  });

  it('Trip-Zone 使用 EPWM_enableTripZoneSignals', () => {
    const ptz = sanitizeProject({
      ...p,
      tripZone: { enabled: true, sources: ['TZ1'], action: 'CBC', outA: 'FORCE_LOW', outB: 'FORCE_LOW', interrupt: false },
    });
    expect(file('epwm_config.c', ptz)).toContain('EPWM_enableTripZoneSignals(EPWM1_BASE, EPWM_TZ_SIGNAL_CBC1);');
  });
});

describe('调制 ISR', () => {
  it('SVPWM 生成零序注入代码', () => {
    const c = file('epwm_config.c');
    expect(c).toContain('float v_off = -0.5f * (v_max + v_min);');
    expect(c).toContain('EPWM_toolDutyToCmp');
  });

  it('固定占空比模式不生成 ISR', () => {
    const p = sanitizeProject({ ...project, modulationMode: 'FIXED' });
    const c = file('epwm_config.c', p);
    expect(c).not.toContain('epwm1_isr');
  });

  it('CMP 夹紧保证最小脉宽', () => {
    expect(file('epwm_config.c')).toContain('if (cmp < 1.0f) cmp = 1.0f;');
  });

  it('单项工程导出把三个文件拼在一起', () => {
    const hw = resolveHardware(project);
    const single = generateSingleFile(project, hw);
    expect(single).toContain('/* ======================== main.c ======================== */');
    expect(single).toContain('/* ======================== epwm_config.h ======================== */');
  });
});

describe('注释语言', () => {
  it('中文模式包含中文注释', () => {
    expect(file('epwm_config.c')).toContain('时基子模块');
  });

  it('英文模式切换为英文注释', () => {
    const p = sanitizeProject({ ...project, commentLang: 'EN' });
    const c = file('epwm_config.c', p);
    expect(c).toContain('Time-Base Submodule');
    expect(c).not.toContain('时基子模块');
  });
});
