import type { DeadBandInModeId, DeadBandModeId } from '../types';

/**
 * 死区输出拓扑
 * ----------------------------------------------------------------------------
 * COMPLEMENTARY（互补型，AHC/ALC）：
 *   两路输出构成互补对，死区期间两路同时为低（AHC）或同时为高（ALC）。
 *   A 通道高电平 = 原始高电平 - DBRED
 *   B 通道高电平 = 原始低电平 - DBFED
 *   死区区间恰好是 DBRED（B 关断 -> A 开通）与 DBFED（A 关断 -> B 开通）。
 *   这是半桥/全桥的标配用法，也是 RED/FED 名称的真实含义。
 *
 * DUAL_SAME（同相型，AH/AL）：
 *   两路输出取自同一条延迟链，波形完全一致，仅极性不同。
 *   A 通道高电平 = 原始高电平 - DBRED + DBFED
 *   用于驱动并联管、双管同步开通等无需互补的场景。
 */
export type DeadBandKind = 'COMPLEMENTARY' | 'DUAL_SAME';

export interface DeadBandMode {
  id: DeadBandModeId;
  /** 中文全称 */
  name: string;
  /** 英文全称（UI 语言为 en 时使用） */
  nameEn: string;
  /** 短标签，用于徽标 */
  short: string;
  /** 该模式对应的 DBCTL.POLSEL 编码（0x0~0x3）；BYPASS 不使用 */
  polsel: number;
  /** 头文件中的位域名 */
  polselBitfield: string;
  /** 输出拓扑 */
  kind: DeadBandKind;
  /** 两路输出是否整体反相（低有效） */
  invert: boolean;
  /** 是否旁路死区子模块 */
  bypass: boolean;
  description: string;
  descriptionEn: string;
}

/**
 * DBCTL.POLSEL 四种极性组合
 * ----------------------------------------------------------------------------
 * POLSEL 用两位分别控制两路输出的反相开关，实际效果是：
 *   00 (AH)  双高有效、同相非互补  —— 两管同步动作
 *   01 (ALC) 低有效互补            —— 死区期间两路皆高（低有效驱动 = 双管关断）
 *   10 (AHC) 高有效互补            —— 死区期间两路皆低（高有效驱动 = 双管关断）
 *   11 (AL)  双低有效、同相非互补
 * 半桥/全桥请用 AHC；栅极驱动器为低有效时改用 ALC。
 */
export const DEADBAND_MODES: Record<DeadBandModeId, DeadBandMode> = {
  AHC: {
    id: 'AHC',
    name: 'AHC 高有效互补 (Active High Complementary)',
    nameEn: 'AHC — Active High Complementary',
    short: 'AHC',
    polsel: 0x2,
    polselBitfield: 'DB_ACTV_HIC',
    kind: 'COMPLEMENTARY',
    invert: false,
    bypass: false,
    description:
      '半桥/全桥标配：A 开通前插入 RED、B 开通前插入 FED，死区期间两路皆低，天然防止直通。',
    descriptionEn:
      'Default for half/full bridge: RED delays A turn-on, FED delays B turn-on, both outputs low during dead-band — inherently shoot-through safe.',
  },
  ALC: {
    id: 'ALC',
    name: 'ALC 低有效互补 (Active Low Complementary)',
    nameEn: 'ALC — Active Low Complementary',
    short: 'ALC',
    polsel: 0x1,
    polselBitfield: 'DB_ACTV_LOC',
    kind: 'COMPLEMENTARY',
    invert: true,
    bypass: false,
    description: '互补对整体反相，死区期间两路皆高。适用于栅极驱动器为低有效的场合。',
    descriptionEn:
      'Complementary pair with inverted outputs: both high during dead-band. Use with active-low gate drivers.',
  },
  AH: {
    id: 'AH',
    name: 'AH 双高有效 (Active High，同相非互补)',
    nameEn: 'AH — Dual Active High (in phase, not complementary)',
    short: 'AH',
    polsel: 0x0,
    polselBitfield: 'DB_ACTV_HI',
    kind: 'DUAL_SAME',
    invert: false,
    bypass: false,
    description: '两路输出波形一致且不反相，用于并联管同步开通、或需要 A/B 同相位的驱动。',
    descriptionEn:
      'Both outputs identical and non-inverted: for paralleled switches turned on together, or when A and B must be in phase.',
  },
  AL: {
    id: 'AL',
    name: 'AL 双低有效 (Active Low，同相非互补)',
    nameEn: 'AL — Dual Active Low (in phase, not complementary)',
    short: 'AL',
    polsel: 0x3,
    polselBitfield: 'DB_ACTV_LO',
    kind: 'DUAL_SAME',
    invert: true,
    bypass: false,
    description: '两路输出波形一致但整体反相，用于低有效驱动器驱动并联管。',
    descriptionEn:
      'Both outputs identical but inverted: active-low drivers driving paralleled switches.',
  },
  BYPASS: {
    id: 'BYPASS',
    name: 'BYPASS 死区旁路 (独立 CMPA / CMPB 双输出)',
    nameEn: 'BYPASS — dead-band disabled (independent CMPA / CMPB)',
    short: 'BYPASS',
    polsel: 0x0,
    polselBitfield: 'DB_ACTV_HI',
    kind: 'DUAL_SAME',
    invert: false,
    bypass: true,
    description:
      '关闭死区子模块后，OUTA 由 AQCTLA + CMPA 决定，OUTB 由 AQCTLB + CMPB 决定，两路完全独立、各带自己的占空比与边沿位置。',
    descriptionEn:
      'With the dead-band submodule off, OUTA is driven by AQCTLA + CMPA and OUTB by AQCTLB + CMPB — fully independent duty and edge placement.',
  },
};

export const DEADBAND_MODE_LIST = Object.values(DEADBAND_MODES);

export interface DeadBandInMode {
  id: DeadBandInModeId;
  /** DBCTL.IN_MODE 编码 */
  code: number;
  name: string;
  /** 英文名称 */
  nameEn: string;
  /** 死区输入是否取 ePWMxB */
  usesB: boolean;
  /** RED / FED 是否来自不同边沿源（交叉模式，波形为示意） */
  crossSource: boolean;
  description: string;
  descriptionEn: string;
}

export const DB_IN_MODES: Record<DeadBandInModeId, DeadBandInMode> = {
  DBA_ALL: {
    id: 'DBA_ALL',
    code: 0x0,
    name: 'DBA_ALL (0x0) · RED 与 FED 均取自 ePWMxA',
    nameEn: 'DBA_ALL (0x0) · both RED and FED from ePWMxA',
    usesB: false,
    crossSource: false,
    description: '最常用。单个 AQ 输出经死区后生成互补的 A/B 两路。',
    descriptionEn: 'Most common: one AQ output drives both dead-band delays, producing the complementary A/B pair.',
  },
  DBB_RED_DBA_FED: {
    id: 'DBB_RED_DBA_FED',
    code: 0x1,
    name: 'DBB_RED_DBA_FED (0x1) · RED 取自 ePWMxB，FED 取自 ePWMxA',
    nameEn: 'DBB_RED_DBA_FED (0x1) · RED from ePWMxB, FED from ePWMxA',
    usesB: true,
    crossSource: true,
    description: '交叉输入模式：上升沿延迟来自 B 通道信号，下降沿延迟来自 A 通道信号。',
    descriptionEn: 'Cross-input mode: rising-edge delay comes from the B signal, falling-edge delay from A.',
  },
  DBA_RED_DBB_FED: {
    id: 'DBA_RED_DBB_FED',
    code: 0x2,
    name: 'DBA_RED_DBB_FED (0x2) · RED 取自 ePWMxA，FED 取自 ePWMxB',
    nameEn: 'DBA_RED_DBB_FED (0x2) · RED from ePWMxA, FED from ePWMxB',
    usesB: true,
    crossSource: true,
    description: '交叉输入模式：适合 A/B 两路独立比较值且死区需分别取自对方的场景。',
    descriptionEn:
      'Cross-input mode: for legs where A and B have their own compare values and each delay must come from the other signal.',
  },
  DBB_ALL: {
    id: 'DBB_ALL',
    code: 0x3,
    name: 'DBB_ALL (0x3) · RED 与 FED 均取自 ePWMxB',
    nameEn: 'DBB_ALL (0x3) · both RED and FED from ePWMxB',
    usesB: true,
    crossSource: false,
    description: '以 ePWMxB（AQCTLB + CMPB）为死区输入源，输出再经极性选择。',
    descriptionEn: 'Dead-band input taken from ePWMxB (AQCTLB + CMPB), then polarity is applied.',
  },
};

export const DB_IN_MODE_LIST = Object.values(DB_IN_MODES);

/** OUT_MODE 编码（DSP2833x_EPwm_defines.h） */
export const DB_OUT_MODE = {
  DISABLE: { code: 0x0, bitfield: 'DB_DISABLE' },
  FULL_ENABLE: { code: 0x3, bitfield: 'DB_FULL_ENABLE' },
} as const;
