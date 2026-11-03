/**
 * C2000 ePWM Tool 内核入口（headless，不依赖 React / DOM）。
 *
 * 同一份内核同时服务于：
 *   · Web UI（src/App.tsx）
 *   · CLI（bin/epwm.mjs，用于「配置即代码」的 CI 流水线）
 *   · 未来的 VSCode 扩展 / 文档站 / 单元测试
 *
 * 对外承诺：
 *   1. 本文件导出的符号是稳定 API，破坏性变更需要提升主版本；
 *   2. 所有函数都是纯函数（除 migrate/sanitize 这类显式转换外不产生副作用）；
 *   3. 不 import 任何 components/ 内容。
 */

/* ---- 类型 ---- */
export type {
  AdcTriggerConfig,
  ChannelConfig,
  ChannelWaveform,
  CodeTarget,
  CommentLang,
  CountMode,
  DeadBandInModeId,
  DeadBandModeId,
  DeviceModel,
  DiagnosticIssue,
  GeneratedFile,
  Interval,
  ModulationMode,
  PhaseSystem,
  PinOption,
  ProjectState,
  Severity,
  TimeBaseSolution,
  TripAction,
  TripSourceId,
  TripZoneConfig,
  ViewMode,
} from '../types';

/* ---- 数据与注册表 ---- */
export { DEVICES, DEVICE_IDS, DEFAULT_DEVICE_ID, deviceRegistry, getMuxOption } from '../data/devices';
export { DEADBAND_MODES, DEADBAND_MODE_LIST, DB_IN_MODES, DB_IN_MODE_LIST, DB_OUT_MODE } from '../data/deadband';
export { CLKDIV_OPTIONS, HSPCLKDIV_OPTIONS, TBPRD_MAX, TBPRD_MIN } from '../data/clock';
export { PRESETS, makeChannel, findPreset } from '../data/presets';
export { topologyRegistry, topologiesFor, getTopology } from '../data/topologies';
export type { Topology } from '../data/topologies';

/* ---- 计算 ---- */
export { computeTimeBase, dutyToCompare, compareToDuty, computePhase, nsToTicks } from '../lib/timebase';
export { computeModulationInstant, maxLinearModIndex, modulationSamplingInfo, clampDuty } from '../lib/modulation';
export {
  simulateWaveform,
  toIntervals,
  complementIntervals,
  sampleWaveform,
  minPulseWidthNs,
} from '../lib/waveform';
export { resolveHardware, resolvePins } from '../lib/hardware';
export type { HardwareModel, ResolvedChannel, HrpwmInfo, PinAssignment } from '../lib/hardware';

/* ---- 校验 ---- */
export { validateProject, countIssues, validationRegistry, NARROW_PULSE_NS } from '../lib/rules';
export type { ValidationRule, RuleContext } from '../lib/rules';

/* ---- 代码生成 ---- */
export { generateCode, generateSingleFile, codegenRegistry, getTarget } from '../lib/targets';
export type { CodegenTarget } from '../lib/targets';

/* ---- 工程 IO ---- */
export {
  SCHEMA_VERSION,
  STORAGE_KEY,
  MAX_CHANNELS,
  createDefaultProject,
  sanitizeProject,
  migrateProject,
  applyPreset,
  encodeProjectToHash,
  decodeProjectFromHash,
  buildShareUrl,
} from '../lib/project';

/* ---- 平台基建 ---- */
export { createRegistry, Registry } from '../platform/registry';
export type { Registrable } from '../platform/registry';
