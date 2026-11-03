import { DB_IN_MODES, DEADBAND_MODES } from '../data/deadband';
import { DEFAULT_DEVICE_ID, DEVICES } from '../data/devices';
import { PRESETS, findPreset, makeChannel } from '../data/presets';
import type { ChannelConfig, CodeTarget, CountMode, ProjectState } from '../types';

/**
 * 工程数据版本。
 *
 * 版本号写进 JSON 与分享链接里，**只增不改**：任何一个历史版本的工程文件，
 * 都必须能被 migrateProject() 一路升级到当前版本再导入，
 * 否则用户三年前存的文件就打不开了 —— 这是平台的基本契约。
 *
 * v0：原始 dsp_epwm.tsx 的导出格式（无 schemaVersion，器件字段叫 selectedDspId）
 * v3：当前版本（codeTarget 取代 codeStyle，新增 hrpwm / tripZone / adcTrigger）
 */
export const SCHEMA_VERSION = 3;
export const STORAGE_KEY = 'c2000-epwm-project-v3';
/** UI 支持的最大桥臂数（受引脚库与配色限制） */
export const MAX_CHANNELS = 4;

const COUNT_MODES: CountMode[] = ['UP_DOWN', 'UP'];
const CODE_TARGETS: CodeTarget[] = ['BITFIELD', 'DRIVERLIB', 'MARKDOWN'];

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function num(v: unknown, fallback: number, lo: number, hi: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

/**
 * 把任意历史版本升级到当前结构。
 *
 * 只做「结构搬迁」，不做数值校验 —— 校验统一交给 sanitizeProject。
 * 新增版本时：在 switch 里追加一个分支，并把 SCHEMA_VERSION 加一。
 */
export function migrateProject(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  let doc = { ...(raw as Record<string, unknown>) };
  const version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 0;

  switch (version) {
    case 0: {
      // v0 → v3：原始单文件工具的导出（selectedDspId / version 字段）
      const legacy = doc as Record<string, unknown>;
      doc = {
        ...doc,
        deviceId: legacy.deviceId ?? legacy.selectedDspId,
      };
      delete doc.selectedDspId;
      delete doc.version;
      break;
    }
    default:
      break;
  }

  return { ...doc, schemaVersion: SCHEMA_VERSION };
}

export function createDefaultProject(): ProjectState {
  const base = PRESETS[0].build();
  return {
    schemaVersion: SCHEMA_VERSION,
    deviceId: DEFAULT_DEVICE_ID,
    ...base,
    elecAngleDeg: 35,
    tripZone: {
      enabled: false,
      sources: ['TZ1'],
      action: 'OST',
      outA: 'FORCE_LOW',
      outB: 'FORCE_LOW',
      interrupt: true,
    },
    adcTrigger: { enabled: true, source: 'CTR_ZERO', prescale: 1 },
    hrpwm: false,
    codeTarget: 'BITFIELD',
    commentLang: 'CN',
  };
}

function sanitizeChannel(raw: unknown, index: number): ChannelConfig {
  const o = (raw ?? {}) as Record<string, unknown>;
  const id = index + 1;
  return makeChannel({
    id,
    name: typeof o.name === 'string' && o.name.trim() ? o.name : `ePWM${id} 桥臂`,
    enabled: bool(o.enabled, true),
    independentFreq: bool(o.independentFreq, false),
    customFreqKhz: num(o.customFreqKhz, 100, 0.05, 500),
    duty: num(o.duty, 50, 0.5, 99.5),
    dutyB: num(o.dutyB, 50, 0.5, 99.5),
    phase: num(o.phase, 0, 0, 360),
    redNs: num(o.redNs, 200, 0, 50000),
    fedNs: num(o.fedNs, 200, 0, 50000),
    lockDb: bool(o.lockDb, true),
    mode: pick(o.mode, Object.keys(DEADBAND_MODES) as (keyof typeof DEADBAND_MODES)[], 'AHC'),
    inMode: pick(o.inMode, Object.keys(DB_IN_MODES) as (keyof typeof DB_IN_MODES)[], 'DBA_ALL'),
    muxIdxA: Math.round(num(o.muxIdxA, 0, 0, 8)),
    muxIdxB: Math.round(num(o.muxIdxB, 0, 0, 8)),
    hrpwm: bool(o.hrpwm, false),
  });
}

/**
 * 把任意来源（URL / 本地存储 / 导入的 JSON / 旧版本文件）的数据
 * 规范化成当前版本的 ProjectState，任何非法字段都会退回到默认值。
 */
export function sanitizeProject(raw: unknown): ProjectState {
  const def = createDefaultProject();
  if (!raw || typeof raw !== 'object') return def;
  const o = migrateProject(raw);

  const rawChannels = Array.isArray(o.channels) ? o.channels.slice(0, MAX_CHANNELS) : def.channels;
  const channels = rawChannels.map((c, i) => sanitizeChannel(c, i));
  if (channels.length === 0) channels.push(sanitizeChannel({}, 0));

  // 主通道不允许独立变频 / 移相
  channels[0].independentFreq = false;
  channels[0].phase = 0;

  const deviceId = typeof o.deviceId === 'string' && DEVICES[o.deviceId] ? o.deviceId : def.deviceId;
  const trip = (o.tripZone ?? {}) as Record<string, unknown>;
  const adc = (o.adcTrigger ?? {}) as Record<string, unknown>;

  return {
    schemaVersion: SCHEMA_VERSION,
    deviceId,
    freqKhz: num(o.freqKhz, def.freqKhz, 0.05, 500),
    countMode: pick(o.countMode, COUNT_MODES, def.countMode),
    phaseSystem: pick(o.phaseSystem, ['1P', '3P'] as const, def.phaseSystem),
    subTopology: typeof o.subTopology === 'string' ? o.subTopology : def.subTopology,
    threePhaseSyncLock: bool(o.threePhaseSyncLock, def.threePhaseSyncLock),
    modulationMode: pick(o.modulationMode, ['FIXED', 'SPWM', 'SVPWM'] as const, def.modulationMode),
    modIndex: num(o.modIndex, def.modIndex, 0, 2),
    fundFreqHz: num(o.fundFreqHz, def.fundFreqHz, 1, 5000),
    elecAngleDeg: num(o.elecAngleDeg, 35, 0, 360),
    channels,
    tripZone: {
      enabled: bool(trip.enabled, false),
      sources: Array.isArray(trip.sources)
        ? (trip.sources.filter(s => typeof s === 'string') as ProjectState['tripZone']['sources'])
        : def.tripZone.sources,
      action: pick(trip.action, ['CBC', 'OST'] as const, 'OST'),
      outA: pick(trip.outA, ['FORCE_LOW', 'FORCE_HIGH', 'HI_Z', 'DO_NOTHING'] as const, 'FORCE_LOW'),
      outB: pick(trip.outB, ['FORCE_LOW', 'FORCE_HIGH', 'HI_Z', 'DO_NOTHING'] as const, 'FORCE_LOW'),
      interrupt: bool(trip.interrupt, true),
    },
    adcTrigger: {
      enabled: bool(adc.enabled, true),
      source: pick(adc.source, ['CTR_ZERO', 'CTR_PRD', 'CTR_ZERO_OR_PRD'] as const, 'CTR_ZERO'),
      prescale: Math.round(num(adc.prescale, 1, 1, 15)),
    },
    hrpwm: bool(o.hrpwm, false),
    codeTarget: pick(o.codeTarget ?? o.codeStyle, CODE_TARGETS, 'BITFIELD'),
    commentLang: pick(o.commentLang, ['CN', 'EN'] as const, 'CN'),
  };
}

export function applyPreset(project: ProjectState, presetId: string): ProjectState {
  const preset = findPreset(presetId);
  if (!preset) return project;
  return sanitizeProject({ ...project, ...preset.build() });
}

// ---------------------------------------------------------------------------
// URL 分享：把工程压缩成 base64url 放进 #p=...，便于贴到 issue / 聊天里复现
// ---------------------------------------------------------------------------

export function encodeProjectToHash(project: ProjectState): string {
  const json = JSON.stringify(project);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeProjectFromHash(payload: string): ProjectState | null {
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return sanitizeProject(JSON.parse(json));
  } catch {
    return null;
  }
}

export function readProjectFromLocation(): ProjectState | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash.startsWith('p=')) return null;
  return decodeProjectFromHash(hash.slice(2));
}

export function buildShareUrl(project: ProjectState): string {
  const base =
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}${window.location.pathname}${window.location.search}`;
  return `${base}#p=${encodeProjectToHash(project)}`;
}

// ---------------------------------------------------------------------------
// 本地存储
// ---------------------------------------------------------------------------

export function saveProjectToStorage(project: ProjectState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    /* 隐私模式 / 配额满时静默失败，不影响主流程 */
  }
}

export function loadProjectFromStorage(): ProjectState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return sanitizeProject(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** 清空本地工程（用于「出问题了先重置」和报错恢复） */
export function clearProjectStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 忽略 */
  }
}
