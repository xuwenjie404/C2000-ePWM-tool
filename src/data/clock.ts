/** TBCTL.CLKDIV / HSPCLKDIV 可选分频值 */
export interface ClockDividerOption {
  val: number;
  bitEnum: string;
  driverEnum: string;
}

export const CLKDIV_OPTIONS: ClockDividerOption[] = [
  { val: 1, bitEnum: 'TB_DIV1', driverEnum: 'EPWM_CLOCK_DIVIDER_1' },
  { val: 2, bitEnum: 'TB_DIV2', driverEnum: 'EPWM_CLOCK_DIVIDER_2' },
  { val: 4, bitEnum: 'TB_DIV4', driverEnum: 'EPWM_CLOCK_DIVIDER_4' },
  { val: 8, bitEnum: 'TB_DIV8', driverEnum: 'EPWM_CLOCK_DIVIDER_8' },
  { val: 16, bitEnum: 'TB_DIV16', driverEnum: 'EPWM_CLOCK_DIVIDER_16' },
  { val: 32, bitEnum: 'TB_DIV32', driverEnum: 'EPWM_CLOCK_DIVIDER_32' },
  { val: 64, bitEnum: 'TB_DIV64', driverEnum: 'EPWM_CLOCK_DIVIDER_64' },
  { val: 128, bitEnum: 'TB_DIV128', driverEnum: 'EPWM_CLOCK_DIVIDER_128' },
];

export const HSPCLKDIV_OPTIONS: ClockDividerOption[] = [
  { val: 1, bitEnum: 'TB_DIV1', driverEnum: 'EPWM_HSCLOCK_DIVIDER_1' },
  { val: 2, bitEnum: 'TB_DIV2', driverEnum: 'EPWM_HSCLOCK_DIVIDER_2' },
  { val: 4, bitEnum: 'TB_DIV4', driverEnum: 'EPWM_HSCLOCK_DIVIDER_4' },
  { val: 6, bitEnum: 'TB_DIV6', driverEnum: 'EPWM_HSCLOCK_DIVIDER_6' },
  { val: 8, bitEnum: 'TB_DIV8', driverEnum: 'EPWM_HSCLOCK_DIVIDER_8' },
  { val: 10, bitEnum: 'TB_DIV10', driverEnum: 'EPWM_HSCLOCK_DIVIDER_10' },
  { val: 12, bitEnum: 'TB_DIV12', driverEnum: 'EPWM_HSCLOCK_DIVIDER_12' },
  { val: 14, bitEnum: 'TB_DIV14', driverEnum: 'EPWM_HSCLOCK_DIVIDER_14' },
];

export function findClkDiv(val: number): ClockDividerOption {
  return CLKDIV_OPTIONS.find(o => o.val === val) ?? CLKDIV_OPTIONS[0];
}

export function findHspClkDiv(val: number): ClockDividerOption {
  return HSPCLKDIV_OPTIONS.find(o => o.val === val) ?? HSPCLKDIV_OPTIONS[0];
}

export const TBPRD_MAX = 65535;
export const TBPRD_MIN = 1;
