/**
 * 全局类型定义 —— 数据层、计算层与 UI 层共享的唯一契约。
 * 该文件不允许 import 任何其它模块，避免循环依赖。
 */

export type CountMode = 'UP_DOWN' | 'UP';
export type PhaseSystem = '1P' | '3P';
export type ModulationMode = 'FIXED' | 'SPWM' | 'SVPWM';
/**
 * 代码生成目标。每种目标是一个可插拔的 CodegenTarget，
 * 通过 codegenRegistry 注册，新增目标无需改动 UI 或内核。
 */
export type CodeTarget = 'BITFIELD' | 'DRIVERLIB' | 'MARKDOWN';
export type CommentLang = 'CN' | 'EN';
export type ViewMode = 'SPLIT' | 'WAVE' | 'PINOUT';

/** DBCTL.POLSEL 的四种极性组合（值即 POLSEL 的 2 bit 编码） */
export type DeadBandModeId = 'AH' | 'ALC' | 'AHC' | 'AL' | 'BYPASS';

/** DBCTL.IN_MODE 的四种输入选择 */
export type DeadBandInModeId = 'DBA_ALL' | 'DBB_RED_DBA_FED' | 'DBA_RED_DBB_FED' | 'DBB_ALL';

export type TripSourceId = 'TZ1' | 'TZ2' | 'TZ3' | 'TZ4' | 'TZ5' | 'TZ6';
export type TripAction = 'FORCE_LOW' | 'FORCE_HIGH' | 'HI_Z' | 'DO_NOTHING';

export interface PinOption {
  /** 封装引脚号 */
  pin: number;
  /** GPIO 名称，如 GPIO0 */
  gpio: string;
  /** GPIOxMUX 取值 */
  mux: number;
  /** 复用寄存器名，如 GPAMUX1 */
  reg: string;
}

export interface DeviceModel {
  id: string;
  name: string;
  package: string;
  series: string;
  /** 代际：决定 HRPWM / TZ / DC 子模块的可用性与写法 */
  generation: 'TYPE0' | 'TYPE4';
  sysclkMHz: number;
  /** ePWM 时基时钟（TBCLK 源的频率，未经 CLKDIV/HSPCLKDIV 分频） */
  tbclkMHz: number;
  /** 芯片拥有的 ePWM 模块数 */
  epwmModules: number;
  hasHRPWM: boolean;
  /** HRPWM 微边沿步进，ps */
  mepStepPs: number;
  /** DBRED/DBFED 位宽 */
  dbMaxBits: number;
  dbMaxCount: number;
  desc: string;
  muxOptions: Record<string, PinOption[]>;
  /** 该封装上的电源/地引脚（仅用于引脚图上色，可留空） */
  powerPins: number[];
}

export interface ChannelConfig {
  id: number;
  name: string;
  enabled: boolean;
  /** 是否脱离主时基使用独立开关频率 */
  independentFreq: boolean;
  customFreqKhz: number;
  /** ePWMxA 占空比 % */
  duty: number;
  /** ePWMxB 占空比 %（仅 BYPASS 独立输出时生效） */
  dutyB: number;
  /** 相对主通道移相角，0~360° */
  phase: number;
  redNs: number;
  fedNs: number;
  /** RED = FED 对称锁定 */
  lockDb: boolean;
  mode: DeadBandModeId;
  inMode: DeadBandInModeId;
  muxIdxA: number;
  muxIdxB: number;
  hrpwm: boolean;
}

export interface TripZoneConfig {
  enabled: boolean;
  sources: TripSourceId[];
  /** CBC = 逐周期限流；OST = 单次跳闸锁存 */
  action: 'CBC' | 'OST';
  outA: TripAction;
  outB: TripAction;
  interrupt: boolean;
}

export interface AdcTriggerConfig {
  enabled: boolean;
  source: 'CTR_ZERO' | 'CTR_PRD' | 'CTR_ZERO_OR_PRD';
  /** 事件分频：ETPS */
  prescale: number;
}

export interface ProjectState {
  schemaVersion: number;
  deviceId: string;
  freqKhz: number;
  countMode: CountMode;
  phaseSystem: PhaseSystem;
  subTopology: string;
  threePhaseSyncLock: boolean;
  modulationMode: ModulationMode;
  modIndex: number;
  fundFreqHz: number;
  elecAngleDeg: number;
  channels: ChannelConfig[];
  tripZone: TripZoneConfig;
  adcTrigger: AdcTriggerConfig;
  hrpwm: boolean;
  codeTarget: CodeTarget;
  commentLang: CommentLang;
}

/** 中英双语文本。库层产生、UI 层按当前语言选取 */
export interface BilingualText {
  zh: string;
  en: string;
}

/** 求解后的时基参数 */
export interface TimeBaseSolution {
  clkDiv: number;
  hspClkDiv: number;
  totalDiv: number;
  effTbclkMHz: number;
  /** 一个 TBCLK 周期的纳秒数 */
  stepNs: number;
  /** 寄存器 TBPRD 的整数写入值 */
  tbprd: number;
  /** 未取整前的理想 TBPRD */
  rawTbprd: number;
  actualFswKhz: number;
  periodNs: number;
  /** 一个完整开关周期的 TBCLK 计数个数 */
  periodTicks: number;
  /** 相对目标频率的误差，% */
  freqErrorPct: number;
  /** 占空比可分辨步长，% */
  dutyLsbPct: number;
  /** TBPRD 已被钳位（目标频率无法精确实现） */
  clamped: 'none' | 'max' | 'min';
  warnings: BilingualText[];
}

export interface Interval {
  start: number;
  end: number;
}

/** 单个通道的死区波形仿真结果（单位：TBCLK 计数，范围 [0, periodTicks)） */
export interface ChannelWaveform {
  periodTicks: number;
  cmpA: number;
  cmpB: number;
  dbRed: number;
  dbFed: number;
  /** AQ 输出（进死区前）的高电平宽度 */
  idealHighTicks: number;
  /** 死区后 ePWMxA 的高电平区间 */
  highA: Interval[];
  /** 死区后 ePWMxB 的高电平区间 */
  highB: Interval[];
  /** 上升沿被 RED 吞掉（脉宽不足） */
  swallowedA: boolean;
  swallowedB: boolean;
  /** 死区造成的实际上升沿/下降沿延迟，ns */
  deadTimeRiseNs: number;
  deadTimeFallNs: number;
  /** 实际 A 通道占空比（死区之后），% */
  actualDutyAPct: number;
  actualDutyBPct: number;
  /** 交叉输入模式下波形为示意（精确配置见生成代码） */
  approximate: boolean;
}

export type Severity = 'error' | 'warn' | 'info';

export interface DiagnosticIssue {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  channelId?: number;
}

export interface GeneratedFile {
  name: string;
  language: 'c' | 'h' | 'md';
  content: string;
}
