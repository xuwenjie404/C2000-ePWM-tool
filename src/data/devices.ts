import { createRegistry } from '../platform/registry';
import type { DeviceModel, PinOption } from '../types';

/**
 * 器件数据库
 * ----------------------------------------------------------------------------
 * 说明（重要）：
 *  1. 时基时钟 tbclkMHz 与主频 sysclkMHz 均取自 TI 数据手册中 ePWM 的 EPWMCLK
 *     来源，而非简单等于 SYSCLK 的一半，请以对应器件的 TRM 为准。
 *  2. GPIO 复用表仅覆盖 ePWM1~ePWM4（本工具 UI 支持的最大桥臂数）。如需
 *     ePWM5 及以上通道，直接在 muxOptions 中追加条目即可，UI 会自动识别。
 *  3. 引脚号对应具体封装，换封装（如 64-Pin PM / 100-Pin PZ）时务必按数据手册
 *     核对，或在 UI 里点击备选引脚切换。
 *  4. 数据可在本文件集中校正，不需要改动任何 UI 或计算逻辑。
 */

const F28003X_MUX: Record<string, PinOption[]> = {
  ePWM1A: [
    { pin: 16, gpio: 'GPIO0', mux: 1, reg: 'GPAMUX1' },
    { pin: 49, gpio: 'GPIO30', mux: 5, reg: 'GPAMUX2' },
  ],
  ePWM1B: [
    { pin: 17, gpio: 'GPIO1', mux: 1, reg: 'GPAMUX1' },
    { pin: 50, gpio: 'GPIO31', mux: 5, reg: 'GPAMUX2' },
  ],
  ePWM2A: [
    { pin: 18, gpio: 'GPIO2', mux: 1, reg: 'GPAMUX1' },
    { pin: 53, gpio: 'GPIO14', mux: 1, reg: 'GPAMUX1' },
  ],
  ePWM2B: [
    { pin: 19, gpio: 'GPIO3', mux: 1, reg: 'GPAMUX1' },
    { pin: 54, gpio: 'GPIO15', mux: 1, reg: 'GPAMUX1' },
  ],
  ePWM3A: [
    { pin: 20, gpio: 'GPIO4', mux: 1, reg: 'GPAMUX1' },
    { pin: 57, gpio: 'GPIO16', mux: 5, reg: 'GPBMUX1' },
  ],
  ePWM3B: [
    { pin: 21, gpio: 'GPIO5', mux: 1, reg: 'GPAMUX1' },
    { pin: 58, gpio: 'GPIO17', mux: 5, reg: 'GPBMUX1' },
  ],
  ePWM4A: [
    { pin: 22, gpio: 'GPIO6', mux: 1, reg: 'GPAMUX1' },
    { pin: 61, gpio: 'GPIO22', mux: 6, reg: 'GPAMUX2' },
  ],
  ePWM4B: [
    { pin: 23, gpio: 'GPIO7', mux: 1, reg: 'GPAMUX1' },
    { pin: 62, gpio: 'GPIO23', mux: 6, reg: 'GPAMUX2' },
  ],
};

const F2837X_MUX: Record<string, PinOption[]> = {
  ePWM1A: [
    { pin: 16, gpio: 'GPIO0', mux: 1, reg: 'GPAMUX1' },
    { pin: 49, gpio: 'GPIO145', mux: 1, reg: 'GPEMUX2' },
  ],
  ePWM1B: [
    { pin: 17, gpio: 'GPIO1', mux: 1, reg: 'GPAMUX1' },
    { pin: 50, gpio: 'GPIO146', mux: 1, reg: 'GPEMUX2' },
  ],
  ePWM2A: [
    { pin: 18, gpio: 'GPIO2', mux: 1, reg: 'GPAMUX1' },
    { pin: 53, gpio: 'GPIO147', mux: 1, reg: 'GPEMUX2' },
  ],
  ePWM2B: [
    { pin: 19, gpio: 'GPIO3', mux: 1, reg: 'GPAMUX1' },
    { pin: 54, gpio: 'GPIO148', mux: 1, reg: 'GPEMUX2' },
  ],
  ePWM3A: [{ pin: 20, gpio: 'GPIO4', mux: 1, reg: 'GPAMUX1' }],
  ePWM3B: [{ pin: 21, gpio: 'GPIO5', mux: 1, reg: 'GPAMUX1' }],
  ePWM4A: [{ pin: 22, gpio: 'GPIO6', mux: 1, reg: 'GPAMUX1' }],
  ePWM4B: [{ pin: 23, gpio: 'GPIO7', mux: 1, reg: 'GPAMUX1' }],
};

const F2833X_MUX: Record<string, PinOption[]> = {
  ePWM1A: [{ pin: 16, gpio: 'GPIO0', mux: 1, reg: 'GPAMUX1' }],
  ePWM1B: [{ pin: 17, gpio: 'GPIO1', mux: 1, reg: 'GPAMUX1' }],
  ePWM2A: [{ pin: 18, gpio: 'GPIO2', mux: 1, reg: 'GPAMUX1' }],
  ePWM2B: [{ pin: 19, gpio: 'GPIO3', mux: 1, reg: 'GPAMUX1' }],
  ePWM3A: [{ pin: 20, gpio: 'GPIO4', mux: 1, reg: 'GPAMUX1' }],
  ePWM3B: [{ pin: 21, gpio: 'GPIO5', mux: 1, reg: 'GPAMUX1' }],
  ePWM4A: [{ pin: 22, gpio: 'GPIO6', mux: 1, reg: 'GPAMUX1' }],
  ePWM4B: [{ pin: 23, gpio: 'GPIO7', mux: 1, reg: 'GPAMUX1' }],
};

export const DEVICES: Record<string, DeviceModel> = {
  F280039C: {
    id: 'F280039C',
    name: 'TMS320F280039C',
    package: '64-Pin LQFP (PM)',
    series: 'Gen-3 C28x + CLB (Type-4 ePWM)',
    generation: 'TYPE4',
    sysclkMHz: 120,
    tbclkMHz: 120,
    epwmModules: 8,
    hasHRPWM: true,
    mepStepPs: 150,
    dbMaxBits: 14,
    dbMaxCount: 16383,
    desc: '120 MHz 主频，Type-4 ePWM，14-bit 独立死区计数器 (DBRED/DBFED) 与 150 ps HRPWM。',
    muxOptions: F28003X_MUX,
    powerPins: [1, 14, 25, 32, 51, 64],
  },
  F280049C: {
    id: 'F280049C',
    name: 'TMS320F280049C',
    package: '64-Pin LQFP (PM)',
    series: 'Gen-3 C28x + CLA (Type-4 ePWM)',
    generation: 'TYPE4',
    sysclkMHz: 100,
    tbclkMHz: 100,
    epwmModules: 8,
    hasHRPWM: true,
    mepStepPs: 150,
    dbMaxBits: 14,
    dbMaxCount: 16383,
    desc: '100 MHz 数字电源控制芯片，Type-4 ePWM，支持独立变频分频与 14-bit 独立死区。',
    muxOptions: F28003X_MUX,
    powerPins: [1, 14, 25, 32, 51, 64],
  },
  F28379D: {
    id: 'F28379D',
    name: 'TMS320F28379D',
    package: '100-Pin QFP (PZ)',
    series: 'Dual-Core C28x (Type-4 ePWM)',
    generation: 'TYPE4',
    sysclkMHz: 200,
    tbclkMHz: 100,
    epwmModules: 12,
    hasHRPWM: true,
    mepStepPs: 150,
    dbMaxBits: 14,
    dbMaxCount: 16383,
    desc: '双核浮点 DSP，12 路 ePWM 模块（24 路输出），适合多级/多相复杂变流器。',
    muxOptions: F2837X_MUX,
    powerPins: [],
  },
  F28335: {
    id: 'F28335',
    name: 'TMS320F28335',
    package: '80-Pin LQFP (PGF)',
    series: 'Classic Delfino (Type-0 ePWM)',
    generation: 'TYPE0',
    sysclkMHz: 150,
    tbclkMHz: 150,
    epwmModules: 6,
    // 修正：F28335 具备 HRPWM（MEP 典型 150 ps），Type-0 使用 CMPAHR + SFO 校准写法
    hasHRPWM: true,
    mepStepPs: 150,
    dbMaxBits: 10,
    dbMaxCount: 1023,
    desc: '经典工业控制 DSP，Type-0 ePWM，10-bit 独立死区寄存器（最大 1023），HRPWM 需 SFO 校准。',
    muxOptions: F2833X_MUX,
    powerPins: [],
  },
};

export const DEVICE_IDS = Object.keys(DEVICES);

export const DEFAULT_DEVICE_ID = 'F280039C';

/**
 * 器件注册表。
 * 第三方器件包可以在运行时追加：deviceRegistry.register(customDevice)
 * UI 与计算内核都从这里取器件，不需要改动任何组件。
 */
export const deviceRegistry = createRegistry<DeviceModel>('device').registerAll(Object.values(DEVICES));

/** 取某信号的第 idx 个复用选项（越界时回退到第 0 个） */
export function getMuxOption(device: DeviceModel, signal: string, idx: number): PinOption | undefined {
  const list = device.muxOptions[signal];
  if (!list || list.length === 0) return undefined;
  return list[Math.min(Math.max(idx, 0), list.length - 1)];
}
